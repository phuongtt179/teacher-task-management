import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { oauth2Client, getAuthUrl, getTokenFromCode, loadSavedCredentials, getValidOAuth2Client } from './oauth-config.js';
import { sendNewTaskNotification, sendTaskScoredNotification } from './notificationService.js';
import admin, { db as adminDb } from './firebase-config.js';
import { getGeminiKeys, callGeminiRotate, isDailyLimit } from './_gemini.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Chỉ cho phép frontend thật của app gọi API này từ trình duyệt — chặn website khác
// nhúng lệnh gọi tới API bằng token của người dùng. Không có Origin (curl, app di động,
// gọi server-to-server) vẫn được phép vì CORS chỉ có ý nghĩa chặn trình duyệt.
const ALLOWED_ORIGINS = [
  'https://teacher-task-management-12.onrender.com',
  'http://localhost:5173',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS_NOT_ALLOWED'));
    }
  },
}));
app.use((err, req, res, next) => {
  if (err?.message === 'CORS_NOT_ALLOWED') return res.status(403).json({ error: 'cors_not_allowed' });
  next(err);
});
app.use(express.json());

// Xác thực Firebase ID token — bắt buộc cho mọi endpoint đọc/ghi dữ liệu người dùng.
// KHÔNG bao giờ tin uid do client tự khai trong body/query — phải lấy từ token đã được
// Firebase ký và giải mã ở đây (req.uid), để tránh giả danh (gọi API bằng uid người khác).
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthenticated' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

// Google Drive configuration
const ROOT_FOLDER_ID = process.env.ADMIN_DRIVE_FOLDER_ID;

// Initialize Google Drive API with OAuth2 (deprecated - use getDrive() instead)
let drive;

function initializeDrive() {
  try {
    drive = google.drive({ version: 'v3', auth: oauth2Client });
    console.log('✅ Google Drive API initialized with OAuth 2.0');
    return true;
  } catch (error) {
    console.error('❌ Error initializing Google Drive API:', error.message);
    return false;
  }
}

/**
 * Get Google Drive instance with auto-refreshed token
 */
async function getDrive() {
  try {
    const validAuth = await getValidOAuth2Client();
    return google.drive({ version: 'v3', auth: validAuth });
  } catch (error) {
    console.error('❌ Error getting Drive instance:', error);
    throw error;
  }
}

// Initialize on startup if credentials exist
if (loadSavedCredentials()) {
  initializeDrive();
} else {
  console.log('⚠️  OAuth credentials not found. Admin needs to authorize first.');
  console.log('👉 Visit: http://localhost:3001/api/auth/google');
}

/**
 * Get or create a folder in Google Drive
 */
async function getOrCreateFolder(folderName, parentId = ROOT_FOLDER_ID) {
  try {
    // Get Drive instance with refreshed token
    const drive = await getDrive();

    // Search for existing folder
    const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // Create folder if it doesn't exist
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id',
    });

    return folder.data.id;
  } catch (error) {
    console.error('Error getting/creating folder:', error);
    throw error;
  }
}

/**
 * Upload file to Google Drive
 */
async function uploadFileToDrive(file, folderId) {
  try {
    // Get Drive instance with refreshed token
    const drive = await getDrive();

    // Fix UTF-8 encoding for Vietnamese filenames
    // Multer receives filename in Latin1, need to convert to UTF-8
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const fileMetadata = {
      name: originalName,
    };

    // Only set parents if folderId is provided
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(file.path),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink',
    });

    // Delete temp file
    fs.unlinkSync(file.path);

    return response.data;
  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
}

/**
 * Make file accessible to anyone with the link
 */
async function makeFilePublic(fileId) {
  try {
    // Get Drive instance with refreshed token
    const drive = await getDrive();

    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const file = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink',
    });

    return file.data.webViewLink;
  } catch (error) {
    console.error('Error making file public:', error);
    throw error;
  }
}

// ============================================
// OAuth 2.0 Authorization Endpoints
// ============================================

/**
 * Step 1: Redirect admin to Google authorization page
 */
app.get('/api/auth/google', (req, res) => {
  const authUrl = getAuthUrl();
  res.redirect(authUrl);
});

/**
 * Step 2: Handle OAuth callback from Google
 */
app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code not found');
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokenFromCode(code);

    // Initialize Drive API with new credentials
    initializeDrive();

    res.send(`
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .success {
              background: #4CAF50;
              color: white;
              padding: 20px;
              border-radius: 5px;
              text-align: center;
            }
            .info {
              background: white;
              padding: 20px;
              border-radius: 5px;
              margin-top: 20px;
            }
            code {
              background: #f0f0f0;
              padding: 2px 5px;
              border-radius: 3px;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Authorization Successful!</h1>
            <p>Your Google Drive has been connected successfully.</p>
          </div>
          <div class="info">
            <h3>Next Steps:</h3>
            <ol>
              <li>Create a folder in your Google Drive for storing documents</li>
              <li>Get the Folder ID from the URL</li>
              <li>Add it to your .env file as <code>ADMIN_DRIVE_FOLDER_ID</code></li>
              <li>Restart the server</li>
            </ol>
            <p>You can close this window now.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1 style="color: red;">❌ Authorization Failed</h1>
          <p>${error.message}</p>
          <p><a href="/api/auth/google">Try again</a></p>
        </body>
      </html>
    `);
  }
});

/**
 * Check OAuth status
 */
app.get('/api/auth/status', (req, res) => {
  const hasCredentials = !!(oauth2Client.credentials && oauth2Client.credentials.access_token);
  res.json({
    authorized: hasCredentials,
    driveConfigured: !!drive,
    rootFolderId: ROOT_FOLDER_ID ? 'configured' : 'missing',
  });
});

/**
 * ADMIN: Export current OAuth tokens for updating ENV VAR
 *
 * Usage:
 * 1. Authorize first at: /api/auth/google
 * 2. Then visit: /api/auth/export-tokens?secret=YOUR_ADMIN_SECRET
 * 3. Copy the "envVarValue" and paste into Render ENV VAR: GOOGLE_OAUTH_TOKENS
 *
 * Security: Requires ADMIN_SECRET environment variable
 */
app.get('/api/auth/export-tokens', (req, res) => {
  const secret = req.query.secret;
  const adminSecret = process.env.ADMIN_SECRET;

  // Check if admin secret is configured
  if (!adminSecret) {
    return res.status(500).json({
      error: 'ADMIN_SECRET not configured',
      message: 'Please add ADMIN_SECRET environment variable on Render'
    });
  }

  // Verify secret
  if (secret !== adminSecret) {
    return res.status(403).json({ error: 'Unauthorized - Invalid secret' });
  }

  // Check if credentials exist
  const credentials = oauth2Client.credentials;
  if (!credentials || !credentials.refresh_token) {
    return res.status(404).json({
      error: 'No credentials found. Please authorize first.',
      authUrl: '/api/auth/google',
      instructions: [
        '1. Visit /api/auth/google to authorize',
        '2. After successful authorization, come back to this endpoint'
      ]
    });
  }

  // Return formatted for easy copy-paste
  res.json({
    success: true,
    message: 'Copy the value below and update Render ENV VAR: GOOGLE_OAUTH_TOKENS',
    instructions: [
      '1. Go to Render Dashboard → Your Service → Environment',
      '2. Edit GOOGLE_OAUTH_TOKENS variable',
      '3. Replace with the value from "envVarValue" below',
      '4. Save (Render will auto-redeploy)'
    ],
    envVarValue: JSON.stringify(credentials),
    previewCredentials: {
      hasAccessToken: !!credentials.access_token,
      hasRefreshToken: !!credentials.refresh_token,
      scope: credentials.scope,
      expiryDate: new Date(credentials.expiry_date).toISOString()
    }
  });
});

// ============================================
// File Upload/Delete Endpoints
// ============================================

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  const hasCredentials = !!(oauth2Client.credentials && oauth2Client.credentials.access_token);
  res.json({
    status: 'ok',
    message: 'Server is running',
    oauthConfigured: hasCredentials,
    driveConfigured: !!drive,
    rootFolderId: ROOT_FOLDER_ID ? 'configured' : 'missing',
  });
});

/**
 * Upload file endpoint
 */
app.post('/api/upload', verifyAuth, upload.single('file'), async (req, res) => {
  try {
    if (!drive) {
      return res.status(500).json({
        error: 'Google Drive not configured. Admin needs to authorize first.',
        authUrl: '/api/auth/google',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
      });
    }

    const { schoolYear, category, subCategory, uploaderName, documentTitle, documentType } = req.body;

    if (!schoolYear || !category) {
      return res.status(400).json({
        error: 'Missing required fields: schoolYear, category',
      });
    }

    // Create folder structure
    let targetFolderId;

    if (uploaderName && documentTitle) {
      // NEW Structure with DocumentType: Root > SchoolYear > DocumentType > Category > [SubCategory] > UploaderName > DocumentTitle
      const folderPath = documentType
        ? `${schoolYear} > ${documentType} > ${category}${subCategory ? ' > ' + subCategory : ''} > ${uploaderName} > ${documentTitle}`
        : `${schoolYear} > ${category}${subCategory ? ' > ' + subCategory : ''} > ${uploaderName} > ${documentTitle}`;
      console.log(`📁 Creating folder structure: ${folderPath}`);

      const yearFolderId = await getOrCreateFolder(schoolYear, ROOT_FOLDER_ID);

      // NEW: Add DocumentType folder if provided
      let parentFolderId = yearFolderId;
      if (documentType) {
        parentFolderId = await getOrCreateFolder(documentType, yearFolderId);
      }

      const categoryFolderId = await getOrCreateFolder(category, parentFolderId);

      let subParentFolderId = categoryFolderId;
      if (subCategory) {
        subParentFolderId = await getOrCreateFolder(subCategory, categoryFolderId);
      }

      const uploaderFolderId = await getOrCreateFolder(uploaderName, subParentFolderId);
      targetFolderId = await getOrCreateFolder(documentTitle, uploaderFolderId);
    } else {
      // Backward compatibility: Root > School Year > [DocumentType] > Category > Subcategory
      const folderPath = documentType
        ? `${schoolYear} > ${documentType} > ${category}${subCategory ? ' > ' + subCategory : ''}`
        : `${schoolYear} > ${category}${subCategory ? ' > ' + subCategory : ''}`;
      console.log(`📁 Creating folder structure: ${folderPath}`);

      const yearFolderId = await getOrCreateFolder(schoolYear, ROOT_FOLDER_ID);

      // NEW: Add DocumentType folder if provided
      let parentFolderId = yearFolderId;
      if (documentType) {
        parentFolderId = await getOrCreateFolder(documentType, yearFolderId);
      }

      const categoryFolderId = await getOrCreateFolder(category, parentFolderId);

      targetFolderId = categoryFolderId;
      if (subCategory) {
        targetFolderId = await getOrCreateFolder(subCategory, categoryFolderId);
      }
    }

    // Upload file
    console.log(`⬆️  Uploading file: ${req.file.originalname}`);
    const driveFile = await uploadFileToDrive(req.file, targetFolderId);

    // Make file public
    console.log(`🔓 Making file public: ${driveFile.id}`);
    const publicUrl = await makeFilePublic(driveFile.id);

    res.json({
      success: true,
      file: {
        id: driveFile.id,
        name: driveFile.name,
        mimeType: driveFile.mimeType,
        size: parseInt(driveFile.size || '0'),
        webViewLink: publicUrl,
        webContentLink: driveFile.webContentLink,
        thumbnailLink: driveFile.thumbnailLink,
      },
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message,
    });
  }
});

/**
 * Delete file endpoint
 */
app.delete('/api/files/:fileId', verifyAuth, async (req, res) => {
  try {
    // Get Drive instance with refreshed token
    const drive = await getDrive();

    const { fileId } = req.params;

    await drive.files.delete({
      fileId: fileId,
    });

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({
      error: 'Delete failed',
      message: error.message,
    });
  }
});

/**
 * Parse tasks from text using Gemini AI
 */
app.post('/api/parse-tasks', verifyAuth, express.json(), async (req, res) => {
  try {
    const { text, teachers } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Vui lòng cung cấp văn bản cần phân tích' });
    }

    const keys = getGeminiKeys();
    if (!keys.length) {
      return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình' });
    }

    const teacherListText = teachers && teachers.length > 0
      ? teachers.map(t => `- "${t.displayName}" (uid: ${t.uid})`).join('\n')
      : '(Không có danh sách giáo viên)';

    const prompt = `Bạn là hệ thống phân tích văn bản phân công công việc trường học Việt Nam.

DANH SÁCH GIÁO VIÊN TRONG HỆ THỐNG:
${teacherListText}

VĂN BẢN PHÂN CÔNG:
${text}

NHIỆM VỤ:
Trích xuất các CÔNG VIỆC CHÍNH từ văn bản (không liệt kê từng chi tiết nhỏ lẻ như mua từng món ăn riêng lẻ).
Gom nhóm các công việc liên quan thành 1 task có ý nghĩa.

Với mỗi công việc:
1. Tóm tắt tiêu đề ngắn gọn (dưới 80 ký tự)
2. Mô tả chi tiết đầy đủ nội dung
3. Tìm tên người phụ trách chính - so sánh không phân biệt hoa thường, bỏ qua "cô/thầy/anh/chị" phía trước
4. Xác định deadline rõ ràng nhất (YYYY-MM-DD), ưu tiên ngày tổ chức sự kiện nếu không có deadline riêng
5. Mức ưu tiên: high (quan trọng/cần nhiều người), medium (thông thường), low (hỗ trợ)

Quy tắc khớp tên giáo viên:
- "cô Bình" → tìm giáo viên có tên chứa "Bình"
- Nếu có nhiều giáo viên trùng tên, lấy uid đầu tiên khớp
- Nếu không khớp → matchedTeacherIds để null tại vị trí đó

CHỈ trả về JSON array thuần túy, KHÔNG có markdown, KHÔNG có text khác:
[
  {
    "title": "Tên công việc ngắn gọn",
    "description": "Mô tả chi tiết công việc",
    "assigneeNames": ["Tên đầy đủ như trong văn bản"],
    "matchedTeacherIds": ["uid hoặc null"],
    "deadline": "YYYY-MM-DD hoặc null",
    "priority": "high|medium|low"
  }
]`;

    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });

    const geminiRes = await callGeminiRotate({ model: 'gemini-3.1-flash-lite', keys, payload });

    if (geminiRes.status === 429) {
      const errBody = await geminiRes.json().catch(() => ({}));
      return res.status(429).json({
        error: isDailyLimit(errBody)
          ? 'Đã hết lượt phân tích AI hôm nay, thử lại vào ngày mai'
          : 'Đang có nhiều yêu cầu, thử lại sau ít phút',
      });
    }
    if (!geminiRes.ok) {
      const body = await geminiRes.json().catch(() => ({}));
      throw new Error(body?.error?.message || 'Gemini API error');
    }

    const data = await geminiRes.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('AI không trả về dữ liệu JSON hợp lệ');
    }

    const tasks = JSON.parse(jsonMatch[0]);

    res.json({ success: true, tasks });
  } catch (error) {
    console.error('❌ Parse tasks error:', error);
    res.status(500).json({ error: 'Phân tích thất bại', message: error.message });
  }
});

/**
 * Chat AI cho giáo viên — dùng Gemini function calling để vừa trò chuyện
 * vừa thực thi hành động thật (đọc công việc/điểm qua Admin SDK).
 * Giai đoạn 1: chỉ có các hàm ĐỌC dữ liệu, chưa có hàm ghi (hoàn thành việc, nộp tài liệu).
 */
const CHAT_MODEL = 'gemini-3.1-flash-lite';

// Tool đọc/ghi thông thường — gửi cho Gemini ở MỌI kênh chat.
const CHAT_TOOLS_BASE_DECLARATIONS = [
    {
      name: 'list_my_tasks',
      description: 'Liệt kê công việc được giao cho giáo viên đang hỏi, kèm trạng thái (assigned=đã giao chưa nộp, submitted=đã nộp chờ chấm, completed=đã có điểm, overdue=quá hạn chưa nộp), mức ưu tiên và hạn nộp.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'get_my_scores',
      description: 'Lấy lịch sử điểm các công việc đã được chấm điểm của giáo viên đang hỏi, kèm nhận xét (nếu có).',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'get_recent_notifications',
      description: 'Lấy các thông báo CHƯA ĐỌC gần đây của giáo viên đang hỏi (việc mới được giao, đã chấm điểm...). Dùng để chào hỏi đầu phiên trò chuyện.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'search_public_documents',
      description: 'Tìm tài liệu/công văn/hồ sơ CÔNG KHAI (không phải hồ sơ cá nhân) theo từ khóa trong tên tài liệu. Trích xuất từ khóa quan trọng nhất từ câu hỏi, ví dụ "tìm công văn về tuyển sinh" → keyword="tuyển sinh".',
      parameters: {
        type: 'OBJECT',
        properties: {
          keyword: { type: 'STRING', description: 'Từ khóa cần tìm trong tên tài liệu' },
        },
        required: ['keyword'],
      },
    },
    {
      name: 'list_upload_categories',
      description: 'Lấy TOÀN BỘ danh sách danh mục hồ sơ mà giáo viên đang hỏi ĐƯỢC PHÉP nộp trong năm học hiện tại, kèm mục con nếu có (ví dụ các tuần). Gọi hàm này ngay khi giáo viên muốn nộp tài liệu. Sau khi có danh sách, TỰ suy luận đúng danh mục dựa trên tên gọi thông thường giáo viên dùng (ví dụ "giáo án" thường ứng với danh mục "Kế hoạch bài dạy", không nhất thiết trùng chữ) — không cần giáo viên gõ đúng tên danh mục.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'confirm_upload_target',
      description: 'Xác nhận CHÍNH XÁC 1 danh mục (và mục con nếu có) sẽ dùng để nộp tài liệu — chỉ gọi SAU KHI đã chắc chắn từ kết quả list_upload_categories, dùng đúng categoryId/subCategoryId lấy từ đó, KHÔNG tự bịa id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          categoryId: { type: 'STRING', description: 'categoryId lấy từ kết quả list_upload_categories' },
          subCategoryId: { type: 'STRING', description: 'id mục con lấy từ kết quả list_upload_categories, nếu danh mục có mục con' },
        },
        required: ['categoryId'],
      },
    },
    {
      name: 'list_my_documents',
      description: 'Lấy TOÀN BỘ tài liệu mà CHÍNH giáo viên đang hỏi đã tự nộp (mọi trạng thái, mọi năm học), kèm danh mục/mục con/trạng thái duyệt. Dùng khi giáo viên hỏi "tôi đã nộp... chưa", "tôi nộp những tuần nào rồi", "xem tài liệu tôi đã nộp", hoặc khi giáo viên muốn SỬA/thêm/xóa file trong 1 tài liệu đã nộp (gọi hàm này trước để tìm đúng tài liệu đó).',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'confirm_edit_target',
      description: 'Xác nhận CHÍNH XÁC 1 tài liệu (trong số tài liệu của chính giáo viên, lấy từ list_my_documents) mà giáo viên muốn sửa (thêm/xóa file) — dùng đúng documentId lấy từ list_my_documents, KHÔNG tự bịa id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          documentId: { type: 'STRING', description: 'documentId lấy từ kết quả list_my_documents' },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'get_submission_summary',
      description: 'Tổng hợp tình hình nộp Kế hoạch bài dạy/Sổ chủ nhiệm/Sổ dự giờ của NGƯỜI KHÁC (không phải của chính người hỏi) — dùng khi giáo viên hỏi kiểu "tổ tôi ai chưa nộp X", "toàn trường nộp thế nào rồi". Hàm tự xác định người hỏi là tổ trưởng hay hiệu trưởng/hiệu phó/admin để trả về đúng phạm vi (tổ mình hoặc toàn trường) — KHÔNG cần truyền tham số gì. Nếu người hỏi không có quyền xem tổng hợp này (ví dụ giáo viên thường), hàm trả lỗi not_authorized.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'get_my_submission',
      description: 'Xem lại NỘI DUNG/FILE báo cáo mà CHÍNH giáo viên đang hỏi đã nộp cho 1 công việc cụ thể (lấy taskId từ list_my_tasks), kèm điểm/nhận xét và lịch sử các lần nộp lại nếu có. Dùng khi giáo viên hỏi "tôi đã nộp gì cho việc X", "xem lại báo cáo tôi nộp", "tôi nộp lại mấy lần rồi".',
      parameters: {
        type: 'OBJECT',
        properties: {
          taskId: { type: 'STRING', description: 'id công việc, lấy từ kết quả list_my_tasks' },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'get_my_task_stats',
      description: 'Tổng hợp số liệu công việc của CHÍNH giáo viên đang hỏi: tổng số việc, tỷ lệ hoàn thành, tỷ lệ nộp đúng hạn, điểm trung bình — cả tổng chung lẫn tách theo học kỳ. Dùng khi giáo viên hỏi "tôi hoàn thành được bao nhiêu %", "tỷ lệ nộp đúng hạn của tôi", "điểm trung bình học kỳ này của tôi".',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'get_my_document_progress',
      description: 'Đối chiếu các danh mục hồ sơ giáo viên được phép nộp với những gì đã thực sự nộp, chỉ rõ CÒN THIẾU mục con nào (ví dụ còn thiếu Tuần 5, Tuần 12 của Kế hoạch bài dạy). Dùng khi giáo viên hỏi "tôi còn thiếu hồ sơ gì", "còn thiếu tuần nào chưa nộp".',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'search_everything',
      description: 'Tìm theo 1 từ khóa xuyên suốt: công việc của chính giáo viên (theo tên+mô tả), tài liệu chính giáo viên đã nộp, và tài liệu công khai toàn trường — dùng khi giáo viên hỏi mơ hồ về 1 chủ đề/sự kiện mà không rõ là việc hay tài liệu (ví dụ "có gì liên quan tới Ngày hội Văn hóa dân gian không").',
      parameters: {
        type: 'OBJECT',
        properties: {
          keyword: { type: 'STRING', description: 'từ khóa/chủ đề cần tìm' },
        },
        required: ['keyword'],
      },
    },
    {
      name: 'confirm_forward_task_to_bgh',
      description: 'CHỈ dùng khi người dùng có vai trò VĂN THƯ, muốn CHUYỂN một công việc (thường là xử lý công văn/giấy tờ vừa nhận được) cho Ban Giám Hiệu (hiệu trưởng + hiệu phó) giải quyết. Gọi hàm này SAU KHI đã xác định rõ tiêu đề + nội dung cần chuyển từ tin nhắn của văn thư — hàm chỉ tìm người nhận (BGH) và trả về bản nháp để văn thư xác nhận, KHÔNG tự ghi vào hệ thống. Nếu người gọi không phải văn thư, hàm trả lỗi not_authorized.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Tiêu đề ngắn gọn của công việc cần chuyển, ví dụ "Xử lý công văn về tuyển sinh đầu cấp".' },
          description: { type: 'STRING', description: 'Nội dung/yêu cầu chi tiết cần chuyển cho BGH xử lý.' },
          deadline: { type: 'STRING', description: 'Hạn xử lý dạng YYYY-MM-DD nếu văn thư có nói rõ, để trống nếu không nói.' },
          priority: { type: 'STRING', description: 'Mức ưu tiên: low, medium, hoặc high. Để trống nếu không rõ, sẽ mặc định medium.' },
        },
        required: ['title', 'description'],
      },
    },
    {
      name: 'get_profile',
      description: 'Xem thông tin cá nhân của CHÍNH người đang hỏi (tên hiển thị, email, vai trò, tổ). Dùng khi hỏi "thông tin của tôi", "tôi thuộc tổ nào", "email của tôi là gì".',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'confirm_update_profile',
      description: 'Chuẩn bị đổi TÊN HIỂN THỊ của CHÍNH người đang hỏi (không đổi được email/vai trò/tổ qua đây). Dùng khi người dùng nói RÕ muốn đổi tên hiển thị, ví dụ "đổi tên tôi thành Nguyễn Văn A". Chỉ trả về bản nháp để xác nhận, KHÔNG tự ghi vào hệ thống.',
      parameters: {
        type: 'OBJECT',
        properties: {
          displayName: { type: 'STRING', description: 'Tên hiển thị mới' },
        },
        required: ['displayName'],
      },
    },
    {
      name: 'search_school_info',
      description: 'Tra cứu thông tin/dữ kiện nội bộ nhà trường đã được lưu (ví dụ phân công chủ nhiệm lớp, số lượng thiết bị phòng chức năng, số điện thoại nội bộ...). Dùng cho câu hỏi về dữ kiện nhà trường không thuộc công việc/hồ sơ/điểm số. Ưu tiên trình bày kết quả của năm học hiện tại trước, chỉ nhắc thông tin năm khác nếu người dùng hỏi rõ về quá khứ hoặc không có dữ liệu năm hiện tại.',
      parameters: {
        type: 'OBJECT',
        properties: {
          keyword: { type: 'STRING', description: 'từ khóa/chủ đề cần tra cứu' },
        },
        required: ['keyword'],
      },
    },
];

// Tool THÊM/GHI ĐÈ dữ kiện nhà trường — CHỈ gửi cho Gemini khi đang ở kênh "Thông tin trường"
// (xem /api/chat: channelId === 'school-info'), để tránh AI nhận nhầm ý định lưu dữ kiện
// khi người dùng chỉ đang trò chuyện thông thường ở kênh khác.
const SCHOOL_INFO_WRITE_DECLARATIONS = [
    {
      name: 'confirm_add_school_info',
      description: 'CHỈ dành cho admin/hiệu trưởng/hiệu phó/văn thư: chuẩn bị THÊM MỚI hoặc GHI ĐÈ 1 dữ kiện nội bộ nhà trường (ví dụ "phòng tin học có 40 máy tính", "lớp 3/2 năm nay cô Nguyễn Thị A chủ nhiệm"). Đặt isYearSpecific=true nếu thông tin có thể đổi theo từng năm học (như phân công chủ nhiệm), false nếu là thông tin cố định lâu dài (như số lượng thiết bị). Chỉ trả về bản nháp để xác nhận, KHÔNG tự ghi vào hệ thống. Nếu người gọi không có quyền, trả lỗi not_authorized.',
      parameters: {
        type: 'OBJECT',
        properties: {
          topic: { type: 'STRING', description: 'Chủ đề ngắn gọn, ví dụ "phòng tin học" hoặc "chủ nhiệm lớp 3/2"' },
          content: { type: 'STRING', description: 'Nội dung dữ kiện' },
          isYearSpecific: { type: 'BOOLEAN', description: 'true nếu thông tin theo năm học, false nếu cố định' },
        },
        required: ['topic', 'content', 'isYearSpecific'],
      },
    },
    {
      name: 'list_school_info',
      description: 'CHỈ dành cho admin/hiệu trưởng/hiệu phó/văn thư: liệt kê TOÀN BỘ dữ kiện nhà trường đã lưu để rà soát/kiểm tra trùng lặp. Dùng khi được yêu cầu "xem danh sách thông tin đã lưu".',
      parameters: { type: 'OBJECT', properties: {} },
    },
];

const CHAT_TOOLS = [{ functionDeclarations: CHAT_TOOLS_BASE_DECLARATIONS }];
const CHAT_TOOLS_WITH_SCHOOL_WRITE = [{
  functionDeclarations: [...CHAT_TOOLS_BASE_DECLARATIONS, ...SCHOOL_INFO_WRITE_DECLARATIONS],
}];

function computeTeacherStatus(deadline, deadline2, submission) {
  if (submission) {
    return (submission.score !== undefined && submission.score !== null) ? 'completed' : 'submitted';
  }
  const finalDeadline = deadline2 || deadline;
  if (finalDeadline && new Date() > finalDeadline) return 'overdue';
  return 'assigned';
}

async function toolListMyTasks(uid) {
  const [tasksSnap, subsSnap] = await Promise.all([
    adminDb.collection('tasks').where('assignedTo', 'array-contains', uid).get(),
    adminDb.collection('submissions').where('teacherId', '==', uid).get(),
  ]);

  const latestSubByTask = new Map();
  subsSnap.docs.forEach(d => {
    const s = d.data();
    if (s.isLatest === false) return;
    latestSubByTask.set(s.taskId, s);
  });

  const tasks = tasksSnap.docs.map(d => {
    const t = d.data();
    const deadline = t.deadline?.toDate ? t.deadline.toDate() : null;
    const deadline2 = t.deadline2?.toDate ? t.deadline2.toDate() : null;
    const submission = latestSubByTask.get(d.id);
    return {
      id: d.id,
      title: t.title,
      description: t.description || null,
      descriptionPdfUrl: t.descriptionPdfUrl || null,
      priority: t.priority || 'medium',
      deadline: deadline ? deadline.toISOString().slice(0, 10) : null,
      status: computeTeacherStatus(deadline, deadline2, submission),
      score: submission?.score ?? null,
    };
  });

  return { tasks };
}

async function toolGetMyScores(uid) {
  const subsSnap = await adminDb.collection('submissions').where('teacherId', '==', uid).get();
  const scored = subsSnap.docs
    .map(d => d.data())
    .filter(s => s.isLatest !== false && s.score !== undefined && s.score !== null);

  const taskIds = [...new Set(scored.map(s => s.taskId))];
  const taskTitles = {};
  await Promise.all(taskIds.map(async id => {
    const t = await adminDb.collection('tasks').doc(id).get();
    taskTitles[id] = t.exists ? t.data().title : '(không rõ)';
  }));

  const scores = scored.map(s => ({
    taskTitle: taskTitles[s.taskId] || '(không rõ)',
    score: s.score,
    feedback: s.feedback || null,
  }));

  return { scores };
}

// Tổng hợp số liệu công việc của CHÍNH giáo viên này: tỷ lệ hoàn thành, tỷ lệ nộp đúng hạn,
// điểm trung bình — cả tổng chung lẫn tách theo từng học kỳ.
async function toolGetMyTaskStats(uid) {
  const [tasksSnap, subsSnap] = await Promise.all([
    adminDb.collection('tasks').where('assignedTo', 'array-contains', uid).get(),
    adminDb.collection('submissions').where('teacherId', '==', uid).get(),
  ]);

  const latestSubByTask = new Map();
  subsSnap.docs.forEach(d => {
    const s = d.data();
    if (s.isLatest === false) return;
    latestSubByTask.set(s.taskId, s);
  });

  const computeGroup = (taskDocs) => {
    let completed = 0, submittedOnTime = 0, submittedTotal = 0, overdue = 0;
    let scoreSum = 0, scoreCount = 0;

    taskDocs.forEach(d => {
      const t = d.data();
      const deadline = t.deadline?.toDate ? t.deadline.toDate() : null;
      const deadline2 = t.deadline2?.toDate ? t.deadline2.toDate() : null;
      const submission = latestSubByTask.get(d.id);
      const status = computeTeacherStatus(deadline, deadline2, submission);

      if (status === 'overdue') overdue++;
      if (submission) {
        submittedTotal++;
        if (submission.metDeadline === 1) submittedOnTime++;
        if (typeof submission.score === 'number') {
          scoreSum += submission.score;
          scoreCount++;
          completed++;
        }
      }
    });

    return {
      totalTasks: taskDocs.length,
      completed,
      overdue,
      completionRate: taskDocs.length ? Math.round((completed / taskDocs.length) * 100) : 0,
      onTimeRate: submittedTotal ? Math.round((submittedOnTime / submittedTotal) * 100) : null,
      averageScore: scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
    };
  };

  const bySemester = {};
  ['HK1', 'HK2'].forEach(sem => {
    const docsInSem = tasksSnap.docs.filter(d => d.data().semester === sem);
    if (docsInSem.length > 0) bySemester[sem] = computeGroup(docsInSem);
  });

  return { overall: computeGroup(tasksSnap.docs), bySemester };
}

// Xem lại nội dung/file báo cáo CHÍNH giáo viên này đã nộp cho 1 công việc cụ thể,
// kèm toàn bộ lịch sử các lần nộp lại (version) nếu có.
async function toolGetMySubmission(uid, taskId) {
  if (!taskId) return { error: 'missing_task_id' };
  const taskSnap = await adminDb.collection('tasks').doc(taskId).get();
  if (!taskSnap.exists) return { error: 'task_not_found' };

  const subsSnap = await adminDb.collection('submissions')
    .where('taskId', '==', taskId)
    .where('teacherId', '==', uid)
    .get();
  if (subsSnap.empty) return { taskTitle: taskSnap.data().title, submitted: false };

  const versions = subsSnap.docs
    .map(d => d.data())
    .sort((a, b) => (b.version || 1) - (a.version || 1));
  const latest = versions.find(v => v.isLatest !== false) || versions[0];

  return {
    taskTitle: taskSnap.data().title,
    submitted: true,
    latest: {
      content: latest.content,
      fileUrls: latest.fileUrls || [],
      fileNames: latest.fileNames || [],
      score: latest.score ?? null,
      feedback: latest.feedback || null,
      version: latest.version || 1,
      submittedAt: latest.submittedAt?.toDate ? latest.submittedAt.toDate().toISOString().slice(0, 10) : null,
    },
    history: versions.map(v => ({
      version: v.version || 1,
      score: v.score ?? null,
      submittedAt: v.submittedAt?.toDate ? v.submittedAt.toDate().toISOString().slice(0, 10) : null,
    })),
  };
}

async function toolSearchPublicDocuments(keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return { documents: [] };

  const [categoriesSnap, typesSnap, documentsSnap] = await Promise.all([
    adminDb.collection('documentCategories').get(),
    adminDb.collection('documentTypes').get(),
    adminDb.collection('documents').where('status', '==', 'approved').get(),
  ]);

  const typeById = new Map();
  typesSnap.docs.forEach(d => typeById.set(d.id, d.data()));

  const categoryById = new Map();
  const publicCategoryIds = new Set();
  categoriesSnap.docs.forEach(d => {
    const c = d.data();
    categoryById.set(d.id, c);

    const docType = c.documentTypeId ? typeById.get(c.documentTypeId) : null;
    const isPublic = docType
      ? docType.viewPermissionType === 'everyone'
      : (c.viewPermissions ? c.viewPermissions.type === 'everyone' : c.categoryType === 'public');
    if (isPublic) publicCategoryIds.add(d.id);
  });

  // Khớp cả theo tên tài liệu (title) LẪN tên từng file bên trong — công văn hay được
  // gộp nhiều file (vd theo tháng) dưới 1 tài liệu, tên file mới là thứ giáo viên nhớ.
  const results = [];
  documentsSnap.docs.forEach(d => {
    const doc = d.data();
    if (!publicCategoryIds.has(doc.categoryId)) return;

    const categoryName = categoryById.get(doc.categoryId)?.name || '(không rõ)';
    const files = Array.isArray(doc.files) ? doc.files : [];
    const titleMatches = (doc.title || '').toLowerCase().includes(kw);
    const matchedFiles = files.filter(f => (f.name || '').toLowerCase().includes(kw));

    if (matchedFiles.length > 0) {
      // Khớp đúng theo tên file cụ thể — trả đúng (các) file đó, không lấy đại file đầu
      matchedFiles.forEach(f => {
        results.push({ title: doc.title, category: categoryName, fileUrl: f.driveFileUrl || null, fileName: f.name || null });
      });
    } else if (titleMatches) {
      // Chỉ khớp tên tài liệu chung, không khớp file cụ thể nào — vẫn trả về, lấy file đầu làm đại diện
      results.push({ title: doc.title, category: categoryName, fileUrl: files[0]?.driveFileUrl || null, fileName: files[0]?.name || null });
    }
  });

  return { documents: results.slice(0, 10) };
}

// Tìm xuyên suốt theo 1 từ khóa: công việc CỦA CHÍNH giáo viên (tên+mô tả), tài liệu CỦA CHÍNH
// giáo viên (tên), và tài liệu công khai toàn trường (tên/tên file) — gộp lại 1 kết quả duy nhất.
async function toolSearchEverything(uid, keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return { tasks: [], myDocuments: [], publicDocuments: [] };

  const [tasksSnap, myDocsResult, publicDocsResult] = await Promise.all([
    adminDb.collection('tasks').where('assignedTo', 'array-contains', uid).get(),
    toolListMyDocuments(uid),
    toolSearchPublicDocuments(keyword),
  ]);

  const matchedTasks = tasksSnap.docs
    .map(d => d.data())
    .filter(t => (t.title || '').toLowerCase().includes(kw) || (t.description || '').toLowerCase().includes(kw))
    .map(t => ({ title: t.title, status: t.status }))
    .slice(0, 10);

  const matchedMyDocuments = (myDocsResult.documents || [])
    .filter(d => (d.title || '').toLowerCase().includes(kw))
    .slice(0, 10);

  return {
    tasks: matchedTasks,
    myDocuments: matchedMyDocuments,
    publicDocuments: publicDocsResult.documents || [],
  };
}

// Chuẩn bị bản nháp "chuyển công việc cho BGH" — CHỈ tìm người nhận + validate quyền,
// KHÔNG ghi Firestore (theo đúng nguyên tắc confirm-before-write của cả app: việc ghi
// thật sự chỉ xảy ra khi văn thư bấm nút xác nhận ở UI, gọi /api/chat/forward-task).
async function toolConfirmForwardTaskToBgh(uid, args) {
  const callerSnap = await adminDb.collection('users').doc(uid).get();
  const role = callerSnap.exists ? callerSnap.data().role : null;
  if (role !== 'van_thu') return { error: 'not_authorized' };

  const title = String(args?.title || '').trim();
  const description = String(args?.description || '').trim();
  if (!title || !description) return { error: 'missing_fields' };

  const [bghSnap, yearsSnap] = await Promise.all([
    adminDb.collection('users').where('role', 'in', ['principal', 'vice_principal']).get(),
    adminDb.collection('schoolYears').where('isActive', '==', true).limit(1).get(),
  ]);
  if (bghSnap.empty) return { error: 'no_bgh_members' };
  if (yearsSnap.empty) return { error: 'no_active_school_year' };

  const targetUids = bghSnap.docs.map(d => d.id);
  const targetNames = bghSnap.docs.map(d => d.data().displayName || d.data().email || d.id);
  const schoolYearId = yearsSnap.docs[0].id;

  const priority = ['low', 'medium', 'high'].includes(args?.priority) ? args.priority : 'medium';
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(args?.deadline || '')
    ? args.deadline
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return {
    confirmed: true,
    title, description, priority, deadline, schoolYearId,
    targetUids, targetNames,
    createdByName: callerSnap.data().displayName || callerSnap.data().email || uid,
  };
}

// Tài liệu mà ĐÚNG giáo viên này đã tự nộp (mọi trạng thái: chờ duyệt/đã duyệt/từ chối), mọi năm học.
async function toolListMyDocuments(uid) {
  const [documentsSnap, categoriesSnap, subsSnap] = await Promise.all([
    adminDb.collection('documents').where('uploadedBy', '==', uid).get(),
    adminDb.collection('documentCategories').get(),
    adminDb.collection('documentSubCategories').get(),
  ]);

  const categoryById = new Map();
  categoriesSnap.docs.forEach(d => categoryById.set(d.id, d.data()));
  const subById = new Map();
  subsSnap.docs.forEach(d => subById.set(d.id, d.data()));

  const documents = documentsSnap.docs.map(d => {
    const doc = d.data();
    return {
      documentId: d.id,
      title: doc.title,
      category: categoryById.get(doc.categoryId)?.name || '(không rõ)',
      subCategory: doc.subCategoryId ? (subById.get(doc.subCategoryId)?.name || null) : null,
      status: doc.status,
      fileCount: Array.isArray(doc.files) ? doc.files.length : 0,
    };
  });

  return { documents };
}

// Xác nhận 1 tài liệu CỤ THỂ (thuộc đúng giáo viên đang hỏi) để sửa — trả chi tiết từng file
// bên trong để AI/giao diện cho chọn xóa, hoặc để thêm file mới vào.
async function toolConfirmEditTarget(uid, documentId) {
  if (!documentId) return { error: 'missing_document_id' };
  const docSnap = await adminDb.collection('documents').doc(documentId).get();
  if (!docSnap.exists) return { error: 'document_not_found' };
  const doc = docSnap.data();
  if (doc.uploadedBy !== uid) return { error: 'not_owner' };

  const categorySnap = doc.categoryId ? await adminDb.collection('documentCategories').doc(doc.categoryId).get() : null;
  const subSnap = doc.subCategoryId ? await adminDb.collection('documentSubCategories').doc(doc.subCategoryId).get() : null;

  return {
    confirmed: true,
    documentId,
    schoolYearId: doc.schoolYearId || null,
    title: doc.title,
    category: categorySnap?.exists ? categorySnap.data().name : '(không rõ)',
    subCategory: subSnap?.exists ? subSnap.data().name : null,
    status: doc.status,
    files: (Array.isArray(doc.files) ? doc.files : []).map((f, idx) => ({
      index: idx,
      name: f.name,
      url: f.driveFileUrl || null,
    })),
  };
}

// 3 loại hồ sơ tổ trưởng/hiệu trưởng cần tổng hợp việc nộp của thành viên.
const OVERSIGHT_CATEGORY_NAMES = ['kế hoạch bài dạy', 'sổ chủ nhiệm', 'sổ dự giờ'];

// Tính tình hình nộp 3 loại hồ sơ trên cho 1 danh sách giáo viên (dùng chung cho cả
// báo cáo tổ trưởng lẫn báo cáo toàn trường, chỉ khác nhau ở việc truyền vào ai).
async function computeSubmissionSummary(memberUids) {
  if (memberUids.length === 0) return { members: [] };

  const yearsSnap = await adminDb.collection('schoolYears').where('isActive', '==', true).limit(1).get();
  if (yearsSnap.empty) return { members: [], note: 'no_active_school_year' };
  const schoolYearId = yearsSnap.docs[0].id;

  const [categoriesSnap, usersSnap] = await Promise.all([
    adminDb.collection('documentCategories').where('schoolYearId', '==', schoolYearId).get(),
    adminDb.collection('users').get(),
  ]);

  const nameById = new Map();
  usersSnap.docs.forEach(d => nameById.set(d.id, d.data().displayName || d.data().email || d.id));

  const targetCategories = categoriesSnap.docs.filter(d => {
    const name = (d.data().name || '').toLowerCase();
    return OVERSIGHT_CATEGORY_NAMES.some(n => name.includes(n));
  });
  if (targetCategories.length === 0) return { members: [], note: 'no_target_categories_this_year' };

  const categoryIds = targetCategories.map(d => d.id);
  const subsSnap = await adminDb.collection('documentSubCategories')
    .where('categoryId', 'in', categoryIds.slice(0, 10))
    .get();
  const subCountByCategory = new Map();
  subsSnap.docs.forEach(d => {
    const catId = d.data().categoryId;
    subCountByCategory.set(catId, (subCountByCategory.get(catId) || 0) + 1);
  });

  // Firestore 'in' tối đa 10 phần tử — 3 danh mục mục tiêu chắc chắn nằm trong giới hạn này.
  const documentsSnap = await adminDb.collection('documents').where('categoryId', 'in', categoryIds.slice(0, 10)).get();

  // key: uid|categoryId -> Set(subCategoryId hoặc 'x' nếu không có mục con)
  const submittedByMemberCategory = new Map();
  documentsSnap.docs.forEach(d => {
    const doc = d.data();
    if (!memberUids.includes(doc.uploadedBy)) return;
    const key = `${doc.uploadedBy}|${doc.categoryId}`;
    if (!submittedByMemberCategory.has(key)) submittedByMemberCategory.set(key, new Set());
    submittedByMemberCategory.get(key).add(doc.subCategoryId || 'x');
  });

  const members = memberUids.map(uid => {
    const categories = targetCategories.map(d => {
      const totalSubs = subCountByCategory.get(d.id) || 0;
      const submittedSet = submittedByMemberCategory.get(`${uid}|${d.id}`) || new Set();
      return totalSubs > 0
        ? { categoryName: d.data().name, submittedCount: submittedSet.size, totalCount: totalSubs }
        : { categoryName: d.data().name, submitted: submittedSet.size > 0 };
    });
    return { uid, name: nameById.get(uid) || uid, categories };
  });

  return { members };
}

// 1 tool duy nhất, backend tự dò phạm vi cao nhất người gọi được phép xem
// (thay vì 1 tool riêng cho tổ trưởng + 1 tool riêng cho hiệu trưởng/hiệu phó/admin).
// Tự tra role/headTeacherId từ Firestore, KHÔNG tin role client tự khai báo.
async function toolGetSubmissionSummary(uid) {
  const callerSnap = await adminDb.collection('users').doc(uid).get();
  const role = callerSnap.exists ? callerSnap.data().role : null;

  if (['admin', 'vice_principal', 'principal'].includes(role)) {
    const [departmentsSnap, usersSnap] = await Promise.all([
      adminDb.collection('departments').get(),
      adminDb.collection('users').where('role', 'in', ['teacher', 'department_head']).get(),
    ]);

    const allTeacherUids = usersSnap.docs.map(d => d.id);
    const summary = await computeSubmissionSummary(allTeacherUids);
    const memberByUid = new Map(summary.members.map(m => [m.uid, m]));

    const departments = departmentsSnap.docs.map(d => {
      const dept = d.data();
      return {
        departmentName: dept.name,
        members: (dept.memberIds || []).map(uid => memberByUid.get(uid)).filter(Boolean),
      };
    });

    const assignedUids = new Set(departmentsSnap.docs.flatMap(d => d.data().memberIds || []));
    const unassigned = summary.members.filter(m => !assignedUids.has(m.uid));

    return { scope: 'school', departments, unassigned, note: summary.note };
  }

  const deptSnap = await adminDb.collection('departments').where('headTeacherId', '==', uid).limit(1).get();
  if (!deptSnap.empty) {
    const dept = deptSnap.docs[0].data();
    const summary = await computeSubmissionSummary(dept.memberIds || []);
    return { scope: 'department', departmentName: dept.name, ...summary };
  }

  return { error: 'not_authorized' };
}

// Danh sách danh mục mà ĐÚNG giáo viên này được phép nộp, trong năm học đang hoạt động.
// Không tự so khớp tên ở đây — trả hết danh sách để AI tự suy luận ngữ nghĩa
// (vd "giáo án" ứng với danh mục "Kế hoạch bài dạy" dù không trùng chữ nào).
async function getAllowedUploadCategories(uid) {
  const yearsSnap = await adminDb.collection('schoolYears').where('isActive', '==', true).limit(1).get();
  if (yearsSnap.empty) return { schoolYearId: null, categories: [] };
  const schoolYearId = yearsSnap.docs[0].id;

  const [categoriesSnap, typesSnap, subsSnap] = await Promise.all([
    adminDb.collection('documentCategories').where('schoolYearId', '==', schoolYearId).get(),
    adminDb.collection('documentTypes').get(),
    adminDb.collection('documentSubCategories').get(),
  ]);

  const typeById = new Map();
  typesSnap.docs.forEach(d => typeById.set(d.id, d.data()));

  const subsByCategory = new Map();
  subsSnap.docs.forEach(d => {
    const s = d.data();
    if (!subsByCategory.has(s.categoryId)) subsByCategory.set(s.categoryId, []);
    subsByCategory.get(s.categoryId).push({ id: d.id, name: s.name });
  });

  const allowedCategoryDocs = categoriesSnap.docs.filter(d => {
    const c = d.data();
    const docType = c.documentTypeId ? typeById.get(c.documentTypeId) : null;
    if (docType) {
      return Array.isArray(docType.allowedUploaderUserIds) && docType.allowedUploaderUserIds.includes(uid);
    }
    if (Array.isArray(c.allowedUploaders) && c.allowedUploaders.length > 0) {
      return c.allowedUploaders.includes(uid);
    }
    // Danh mục kiểu cũ không khai báo allowedUploaders: coi như hồ sơ cá nhân, ai cũng nộp được
    return c.categoryType !== 'public';
  });

  const categories = allowedCategoryDocs.map(d => {
    const c = d.data();
    const subs = subsByCategory.get(d.id) || [];
    const docType = c.documentTypeId ? typeById.get(c.documentTypeId) : null;
    return {
      categoryId: d.id,
      categoryName: c.name,
      documentTypeName: docType?.name || null,
      hasSubCategories: subs.length > 0,
      subCategories: subs.map(s => ({ id: s.id, name: s.name })),
    };
  });

  return { schoolYearId, categories };
}

async function toolListUploadCategories(uid) {
  const { schoolYearId, categories } = await getAllowedUploadCategories(uid);
  return {
    schoolYearId,
    categories: categories.map(c => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      hasSubCategories: c.hasSubCategories,
      subCategories: c.subCategories.map(s => ({ id: s.id, name: s.name })),
    })),
  };
}

// Đối chiếu danh mục ĐƯỢC PHÉP nộp (kèm mục con, vd 36 tuần) với những gì CHÍNH giáo viên
// này đã thực sự nộp, để chỉ ra rõ còn THIẾU mục con nào — vd "còn thiếu Tuần 5, Tuần 12".
async function toolGetMyDocumentProgress(uid) {
  const [{ categories }, documentsSnap] = await Promise.all([
    getAllowedUploadCategories(uid),
    adminDb.collection('documents').where('uploadedBy', '==', uid).get(),
  ]);

  const submittedByCategory = new Map(); // categoryId -> Set(subCategoryId hoặc 'x')
  documentsSnap.docs.forEach(d => {
    const doc = d.data();
    if (!submittedByCategory.has(doc.categoryId)) submittedByCategory.set(doc.categoryId, new Set());
    submittedByCategory.get(doc.categoryId).add(doc.subCategoryId || 'x');
  });

  const progress = categories.map(c => {
    const submittedSet = submittedByCategory.get(c.categoryId) || new Set();
    if (!c.hasSubCategories) {
      return { categoryName: c.categoryName, hasSubCategories: false, submitted: submittedSet.size > 0 };
    }
    const missing = c.subCategories.filter(s => !submittedSet.has(s.id)).map(s => s.name);
    return {
      categoryName: c.categoryName,
      hasSubCategories: true,
      submittedCount: submittedSet.size,
      totalCount: c.subCategories.length,
      missing,
    };
  });

  return { progress };
}

async function toolConfirmUploadTarget(uid, categoryId, subCategoryId) {
  const { schoolYearId, categories } = await getAllowedUploadCategories(uid);
  const category = categories.find(c => c.categoryId === categoryId);
  if (!category) return { error: 'category_not_allowed' };

  let subCategory = null;
  if (subCategoryId) {
    subCategory = category.subCategories.find(s => s.id === subCategoryId) || null;
    if (!subCategory) return { error: 'subcategory_not_found' };
  }
  if (category.hasSubCategories && !subCategory) {
    return { error: 'subcategory_required', availableSubCategories: category.subCategories.map(s => s.name) };
  }

  return {
    confirmed: true,
    schoolYearId,
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    subCategoryId: subCategory?.id || null,
    subCategoryName: subCategory?.name || null,
  };
}

async function toolGetRecentNotifications(uid) {
  // Chỉ lọc theo userId (equality đơn) để tránh cần composite index; lọc/sắp xếp còn lại làm ở JS.
  const snap = await adminDb.collection('notifications').where('userId', '==', uid).get();
  const unreadDocs = snap.docs
    .filter(d => d.data().read !== true)
    .sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0))
    .slice(0, 5);

  // Đã đưa cho AI đọc/tóm tắt cho giáo viên nghe = coi như đã đọc, giống mở màn hình Thông báo.
  if (unreadDocs.length > 0) {
    const batch = adminDb.batch();
    unreadDocs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  }

  return { notifications: unreadDocs.map(d => ({ title: d.data().title, message: d.data().message })) };
}

async function toolGetProfile(uid) {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) return { error: 'user_not_found' };
  const u = snap.data();
  const deptSnap = await adminDb.collection('departments').where('memberIds', 'array-contains', uid).limit(1).get();
  return {
    displayName: u.displayName || null,
    email: u.email || null,
    role: u.role || null,
    department: deptSnap.empty ? null : deptSnap.docs[0].data().name,
  };
}

// Chỉ chuẩn bị bản nháp đổi tên hiển thị — KHÔNG ghi Firestore, việc ghi thật sự chỉ
// xảy ra khi người dùng bấm xác nhận ở UI, gọi /api/chat/update-profile.
async function toolConfirmUpdateProfile(uid, args) {
  const newName = String(args?.displayName || '').trim();
  if (!newName) return { error: 'missing_display_name' };
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) return { error: 'user_not_found' };
  return { confirmed: true, currentName: snap.data().displayName || '', newName };
}

const SCHOOL_INFO_EDITOR_ROLES = ['admin', 'principal', 'vice_principal', 'van_thu'];

// Đọc dữ kiện nội bộ nhà trường — dùng ở MỌI kênh, mọi vai trò (chỉ đọc, không rủi ro).
// So khớp theo TỪNG TỪ (không chỉ nguyên cụm) vì AI có thể diễn đạt câu hỏi khác chữ với
// lúc lưu (vd hỏi "phòng tin học có bao nhiêu máy tính" nhưng dữ liệu lưu chỉ ghi "phòng tin học").
async function toolSearchSchoolInfo(keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return { results: [] };
  const tokens = kw.split(/\s+/).filter(t => t.length >= 2);

  const [infoSnap, yearsSnap] = await Promise.all([
    adminDb.collection('schoolInfo').get(),
    adminDb.collection('schoolYears').get(),
  ]);
  const yearNameById = new Map(yearsSnap.docs.map(d => [d.id, d.data().name]));

  const results = infoSnap.docs
    .map(d => d.data())
    .map(i => ({ i, haystack: `${i.topic || ''} ${i.content || ''}`.toLowerCase() }))
    .filter(({ haystack }) => haystack.includes(kw) || tokens.some(t => haystack.includes(t)))
    .sort((a, b) => {
      const scoreOf = (x) => (x.haystack.includes(kw) ? 100 : 0) + tokens.filter(t => x.haystack.includes(t)).length;
      return scoreOf(b) - scoreOf(a);
    })
    .map(({ i }) => ({
      topic: i.topic,
      content: i.content,
      year: i.schoolYearId ? (yearNameById.get(i.schoolYearId) || null) : null,
    }))
    .slice(0, 10);

  return { results };
}

// Liệt kê toàn bộ dữ kiện để rà soát — CHỈ dành cho nhóm được sửa (xem executeChatTool
// và CHAT_TOOLS_WITH_SCHOOL_WRITE: tool này chỉ được gửi cho Gemini ở kênh "Thông tin trường").
async function toolListSchoolInfo(uid) {
  const callerSnap = await adminDb.collection('users').doc(uid).get();
  const role = callerSnap.exists ? callerSnap.data().role : null;
  if (!SCHOOL_INFO_EDITOR_ROLES.includes(role)) return { error: 'not_authorized' };

  const [infoSnap, yearsSnap] = await Promise.all([
    adminDb.collection('schoolInfo').get(),
    adminDb.collection('schoolYears').get(),
  ]);
  const yearNameById = new Map(yearsSnap.docs.map(d => [d.id, d.data().name]));

  const results = infoSnap.docs.map(d => ({
    id: d.id,
    topic: d.data().topic,
    content: d.data().content,
    year: d.data().schoolYearId ? (yearNameById.get(d.data().schoolYearId) || 'Không rõ năm') : 'Cố định',
  }));

  return { results };
}

// Chuẩn bị bản nháp thêm/ghi đè 1 dữ kiện — KHÔNG ghi Firestore, việc ghi thật sự chỉ
// xảy ra khi người dùng bấm xác nhận ở UI, gọi /api/chat/add-school-info.
async function toolConfirmAddSchoolInfo(uid, args) {
  const callerSnap = await adminDb.collection('users').doc(uid).get();
  const role = callerSnap.exists ? callerSnap.data().role : null;
  if (!SCHOOL_INFO_EDITOR_ROLES.includes(role)) return { error: 'not_authorized' };

  const topic = String(args?.topic || '').trim();
  const content = String(args?.content || '').trim();
  if (!topic || !content) return { error: 'missing_fields' };

  let schoolYearId = null;
  let yearLabel = 'Cố định (áp dụng mọi lúc)';
  if (args?.isYearSpecific) {
    const yearsSnap = await adminDb.collection('schoolYears').where('isActive', '==', true).limit(1).get();
    if (yearsSnap.empty) return { error: 'no_active_school_year' };
    schoolYearId = yearsSnap.docs[0].id;
    yearLabel = yearsSnap.docs[0].data().name;
  }

  // Tìm bản ghi trùng chủ đề trong cùng phạm vi (cùng năm học, hoặc cùng "cố định") để hỏi ghi đè.
  const topicLower = topic.toLowerCase();
  const sameScopeSnap = await adminDb.collection('schoolInfo').where('schoolYearId', '==', schoolYearId).get();
  const existing = sameScopeSnap.docs.find(d => (d.data().topic || '').trim().toLowerCase() === topicLower);

  return {
    confirmed: true,
    topic, content, schoolYearId, yearLabel,
    existingId: existing ? existing.id : null,
    existingContent: existing ? existing.data().content : null,
  };
}

async function executeChatTool(name, uid, args) {
  switch (name) {
    case 'list_my_tasks': return toolListMyTasks(uid);
    case 'get_my_scores': return toolGetMyScores(uid);
    case 'get_recent_notifications': return toolGetRecentNotifications(uid);
    case 'search_public_documents': return toolSearchPublicDocuments(args?.keyword);
    case 'list_upload_categories': return toolListUploadCategories(uid);
    case 'confirm_upload_target': return toolConfirmUploadTarget(uid, args?.categoryId, args?.subCategoryId);
    case 'list_my_documents': return toolListMyDocuments(uid);
    case 'confirm_edit_target': return toolConfirmEditTarget(uid, args?.documentId);
    case 'get_submission_summary': return toolGetSubmissionSummary(uid);
    case 'get_my_submission': return toolGetMySubmission(uid, args?.taskId);
    case 'get_my_task_stats': return toolGetMyTaskStats(uid);
    case 'get_my_document_progress': return toolGetMyDocumentProgress(uid);
    case 'search_everything': return toolSearchEverything(uid, args?.keyword);
    case 'confirm_forward_task_to_bgh': return toolConfirmForwardTaskToBgh(uid, args);
    case 'get_profile': return toolGetProfile(uid);
    case 'confirm_update_profile': return toolConfirmUpdateProfile(uid, args);
    case 'search_school_info': return toolSearchSchoolInfo(args?.keyword);
    case 'list_school_info': return toolListSchoolInfo(uid);
    case 'confirm_add_school_info': return toolConfirmAddSchoolInfo(uid, args);
    default: return { error: 'unknown_tool' };
  }
}

const APP_GUIDE = `HƯỚNG DẪN SỬ DỤNG APP (dùng để trả lời khi giáo viên hỏi "làm sao để...", "app này dùng thế nào", "sao tôi không thấy...", hoặc gặp lỗi khi thao tác):
- Đây là app quản lý công việc + hồ sơ điện tử của trường, giao tiếp chủ yếu qua chat này (kiểu Zalo). Bên trái có các kênh: "Trợ lý AI" (hỏi đáp chung), "Công việc", "Điểm số", "Nộp hồ sơ", "Tìm tài liệu".
- Xem/hoàn thành công việc: hỏi trực tiếp trong chat (vd "việc của tôi", "việc nào gấp") — AI liệt kê kèm nút "Hoàn thành" ngay dưới từng việc, bấm vào đó để nộp nội dung/điểm hoàn thành, không cần vào màn hình riêng.
- Nộp hồ sơ/tài liệu (giáo án, kế hoạch bài dạy, sổ chủ nhiệm...): gõ ví dụ "tôi muốn nộp giáo án tuần 3", AI sẽ tự xác định đúng danh mục và hiện nút xác nhận + khung đính kèm file — bấm xác nhận rồi chọn file từ máy để tải lên. Nếu không biết có những danh mục nào, hỏi "hồ sơ gồm những mục nào" để xem cây danh mục trước.
- Sửa hồ sơ đã nộp (thêm/xóa file): hỏi "sửa giáo án tuần 3" hoặc "xóa file trong sổ chủ nhiệm", AI xác nhận đúng tài liệu rồi hiện khung thêm/xóa file.
- Tìm tài liệu người khác đã công khai: hỏi "tìm file X" hoặc "có sổ Y không".
- Xem điểm số, thống kê tỷ lệ hoàn thành/đúng hạn của bản thân, hoặc hồ sơ còn thiếu: hỏi thẳng trong chat (vd "điểm của tôi thế nào", "tôi còn thiếu hồ sơ gì").
- Nếu bật app mà không thấy giao diện chat (vẫn thấy menu cũ): tính năng chat đang được bật dần theo tài khoản, báo giáo viên liên hệ quản trị viên (admin) để được bật.
- Nếu tải file lỗi hoặc app báo lỗi hệ thống khi nộp hồ sơ: đây thường là lỗi kỹ thuật phía máy chủ (không phải do thao tác sai) — khuyên giáo viên thử lại sau ít phút, nếu vẫn lỗi thì báo admin.
- Mọi thao tác quan trọng (nộp bài, tải file, xác nhận danh mục) đều cần giáo viên tự bấm nút xác nhận hiện ra trong chat — AI không tự ý nộp/sửa thay.`;

app.post('/api/chat', verifyAuth, express.json(), async (req, res) => {
  try {
    const uid = req.uid;
    const { displayName, messages, channelId } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'no_message' });
    }

    const keys = getGeminiKeys();
    if (!keys.length) return res.status(500).json({ error: 'no_api_key' });

    const isFirstMessage = messages.length === 1;
    const systemPrompt = `Bạn là trợ lý AI thân thiện cho giáo viên "${displayName || ''}" trong ứng dụng quản lý công việc trường học.
Trả lời ngắn gọn, tiếng Việt, lịch sự.
Khi giáo viên hỏi về công việc/nhiệm vụ của mình, hoặc việc nào cần làm/ưu tiên, hãy gọi hàm list_my_tasks rồi dựa vào priority và deadline trong dữ liệu trả về để tư vấn — KHÔNG tự bịa công việc.
Mặc định khi liệt kê, CHỈ nêu các việc có status "assigned" hoặc "overdue" (chưa hoàn thành) — không nhắc tới việc "submitted"/"completed" trừ khi giáo viên hỏi rõ về việc đã nộp/đã hoàn thành.
Khi giáo viên hỏi về điểm số, hãy gọi hàm get_my_scores.
QUY TẮC BẮT BUỘC: bất kỳ câu nào có dạng "tìm/xem/có/cho xem + [cụm danh từ]" đều PHẢI được hiểu là tìm 1 FILE có tên [cụm danh từ] đó — gọi NGAY hàm search_public_documents(keyword=[cụm danh từ]), TUYỆT ĐỐI KHÔNG được tự trả lời "chưa hỗ trợ tính năng này/chưa có chức năng này" khi chưa gọi hàm. Ví dụ bắt buộc:
- "tìm danh sách giáo viên" → gọi search_public_documents(keyword="danh sách giáo viên") — KHÔNG được hiểu là xin tính năng tra cứu danh bạ, phải coi đây là tìm 1 file tên "danh sách giáo viên" đã có ai đó nộp lên hệ thống.
- "cho xem file X" → search_public_documents(keyword="X").
- "có sổ Y không" → search_public_documents(keyword="Y" hoặc "sổ Y").
Chỉ được nói "không tìm thấy"/"chưa hỗ trợ" SAU KHI đã gọi hàm và trường "documents" trả về rỗng.
Khi giáo viên hỏi CẤU TRÚC danh mục hồ sơ (ví dụ "hồ sơ gồm những mục nào", "cấu trúc danh mục thế nào", "tôi được nộp vào những đâu"), tức là chỉ muốn XEM/TÌM HIỂU chứ CHƯA CHẮC muốn nộp ngay: gọi hàm list_upload_categories, rồi trình bày kết quả dưới dạng CÂY THEO THỨ BẬC (dùng gạch đầu dòng/thụt lề markdown), nhóm theo documentTypeName trước, rồi tới categoryName, rồi tới subCategories (nếu có, chỉ liệt kê vài mục con đầu + ghi tổng số, ví dụ "Tuần 1, Tuần 2, ... (36 tuần)" thay vì liệt kê hết 36 dòng). Dừng lại ở đây — ĐỪNG tự động gọi confirm_upload_target khi giáo viên chỉ đang hỏi cấu trúc, chỉ làm bước xác nhận khi họ nói rõ muốn NỘP vào 1 mục cụ thể ở tin nhắn sau.
Khi giáo viên muốn NỘP tài liệu (giáo án, kế hoạch bài dạy, sổ chủ nhiệm...):
1. Gọi hàm list_upload_categories để lấy TOÀN BỘ danh mục giáo viên này được phép nộp.
2. TỰ suy luận đúng danh mục dựa trên Ý NGHĨA, không cần trùng chữ — ví dụ "giáo án" thường ứng với danh mục "Kế hoạch bài dạy". Nếu danh mục đó có mục con (subCategories, ví dụ theo tuần), tìm mục con khớp với thông tin giáo viên nói (ví dụ "tuần 1" → mục con tên "Tuần 1").
3. Nếu xác định RÕ RÀNG được đúng 1 danh mục (và đúng mục con nếu cần) → gọi hàm confirm_upload_target(categoryId, subCategoryId) với đúng id lấy từ bước 1, KHÔNG tự bịa id.
4. Sau khi confirm_upload_target trả về confirmed=true, xác nhận lại bằng lời với giáo viên (tên danh mục/mục con), mời họ đính kèm file để nộp — KHÔNG tự nộp giúp, việc chọn file do giáo viên tự làm qua nút bấm hiện ra.
5. Nếu danh mục có mục con nhưng chưa xác định được (ví dụ giáo viên chỉ nói "kế hoạch bài dạy" không nói tuần mấy), hỏi lại rõ ràng "Tuần mấy ạ?" — ĐỪNG gọi confirm_upload_target khi còn thiếu thông tin.
6. Nếu không tìm thấy danh mục nào phù hợp với ý giáo viên trong danh sách, báo thẳng và gợi ý mô tả lại.
7. Nếu suy luận ra nhiều hơn 1 khả năng hợp lý, hỏi lại giáo viên muốn nộp vào danh mục nào trong số đó, đừng tự chọn đại.
Khi giáo viên hỏi về tài liệu CHÍNH HỌ đã nộp (ví dụ "tôi đã nộp kế hoạch bài dạy tuần nào rồi", "tôi nộp sổ chủ nhiệm chưa", "xem tài liệu tôi đã nộp"), hoặc muốn SỬA/thêm/xóa file trong tài liệu đã nộp:
1. Gọi hàm list_my_documents để lấy toàn bộ tài liệu của chính giáo viên đó.
2. Nếu chỉ hỏi xem đã nộp gì, trả lời trực tiếp dựa trên danh sách (ví dụ liệt kê các tuần đã nộp của "Kế hoạch bài dạy"), không cần làm gì thêm.
3. Nếu muốn SỬA 1 tài liệu cụ thể, tự suy luận đúng tài liệu đó từ danh sách (theo tên danh mục/mục con, ví dụ "tuần 3"), rồi gọi confirm_edit_target(documentId) với đúng id lấy được — KHÔNG tự bịa id. Nếu không xác định được rõ tài liệu nào, hỏi lại.
4. Sau khi confirm_edit_target trả về confirmed=true, xác nhận lại bằng lời (tên tài liệu, số file hiện có), mời giáo viên tự thêm file mới hoặc xóa bớt file qua giao diện hiện ra — không tự sửa giúp.
Khi người dùng hỏi tổng hợp tình hình nộp hồ sơ CỦA NGƯỜI KHÁC/của tổ/toàn trường (ví dụ "tổ tôi ai chưa nộp kế hoạch bài dạy", "xem tổng hợp nộp hồ sơ của tổ", "toàn trường nộp thế nào rồi"): gọi get_submission_summary (hàm tự xác định phạm vi phù hợp với người hỏi, không cần đoán trước là tổ hay trường); nếu hàm báo lỗi not_authorized thì báo thẳng người dùng không có quyền xem tổng hợp này, đừng tự bịa số liệu. Kết quả có trường "scope": "department" (chỉ 1 tổ, xem trường "members") hoặc "school" (toàn trường, xem trường "departments" gồm nhiều tổ + "unassigned" là người chưa thuộc tổ nào). Khi trình bày, nêu rõ tên từng người/tổ kèm số liệu đã nộp/tổng số (đặc biệt "Kế hoạch bài dạy" tính theo số tuần đã nộp/tổng số tuần).
Khi giáo viên hỏi về NỘI DUNG chi tiết 1 công việc cụ thể (không chỉ tên), hãy đọc trường "description" (và "descriptionPdfUrl" nếu có) trong dữ liệu list_my_tasks đã có sẵn để trả lời — KHÔNG cần gọi thêm hàm nào.
Khi giáo viên hỏi đã nộp NỘI DUNG/FILE gì cho 1 công việc, hoặc đã nộp lại mấy lần: gọi list_my_tasks trước (nếu chưa có) để xác định đúng taskId, rồi gọi get_my_submission(taskId).
Khi giáo viên hỏi số liệu tổng hợp CỦA CHÍNH MÌNH (tỷ lệ hoàn thành, tỷ lệ đúng hạn, điểm trung bình): gọi get_my_task_stats.
Khi giáo viên hỏi CÒN THIẾU hồ sơ gì chưa nộp (khác với "đã nộp gì" — đây là hỏi phần TRỐNG): gọi get_my_document_progress, nêu rõ tên các mục con còn thiếu.
Khi giáo viên hỏi mơ hồ về 1 chủ đề/sự kiện, không rõ là việc hay tài liệu (ví dụ "có gì liên quan đến X không"): gọi search_everything(keyword) thay vì đoán dùng list_my_tasks hay search_public_documents, rồi trình bày gộp cả công việc lẫn tài liệu tìm được.
Nếu người dùng có vai trò VĂN THƯ và muốn CHUYỂN một công việc/công văn cho Ban Giám Hiệu xử lý (ví dụ "chuyển cho BGH xử lý công văn X", "gửi việc này cho hiệu trưởng"): xác định rõ tiêu đề + nội dung cần chuyển từ tin nhắn, rồi gọi confirm_forward_task_to_bgh(title, description, deadline nếu có, priority nếu có). Sau khi hàm trả về confirmed=true, xác nhận lại bằng lời (tiêu đề, người nhận, hạn xử lý) và mời văn thư bấm nút xác nhận hiện ra trong chat — KHÔNG tự nói là "đã chuyển xong", việc ghi vào hệ thống chỉ xảy ra khi văn thư tự bấm xác nhận.
Khi người dùng hỏi thông tin cá nhân của CHÍNH mình (tên hiển thị, email, vai trò, thuộc tổ nào): gọi get_profile.
Khi người dùng muốn đổi TÊN HIỂN THỊ của chính mình (ví dụ "đổi tên tôi thành X"): gọi confirm_update_profile(displayName). Sau khi confirmed=true, xác nhận lại tên mới và mời người dùng bấm nút xác nhận hiện ra trong chat — KHÔNG tự nói là "đã đổi xong".
Khi người dùng nhờ soạn/viết giúp nội dung báo cáo hoàn thành cho 1 công việc (ví dụ "soạn giúp tôi báo cáo cho việc này", "viết hộ nội dung nộp"): dựa vào mô tả công việc (từ list_my_tasks) để soạn 1 đoạn nội dung báo cáo hợp lý bằng lời, rồi nói rõ đây chỉ là gợi ý — người dùng vẫn cần tự vào phần "Hoàn thành công việc" để dán/sửa lại nội dung và nộp chính thức, AI không tự nộp giúp.
Khi người dùng hỏi về 1 dữ kiện/thông tin nội bộ nhà trường (ví dụ "lớp 3/2 ai chủ nhiệm", "phòng tin học có bao nhiêu máy", số điện thoại nội bộ...) mà không phải công việc/hồ sơ/điểm số của họ: gọi search_school_info(keyword). Nếu có kết quả nhiều năm học khác nhau, ưu tiên nêu năm học hiện tại trước; nếu không có kết quả nào, báo thẳng chưa có dữ liệu này, đừng tự bịa.
${channelId !== 'school-info' ? `Bạn KHÔNG có khả năng LƯU/THÊM/GHI ĐÈ dữ kiện nhà trường ở kênh này (không có hàm nào để làm việc đó). Nếu người dùng cung cấp 1 thông tin mới và có vẻ muốn lưu lại (ví dụ "phòng thể chất có 20 quả bóng"), TUYỆT ĐỐI KHÔNG được nói "đã lưu"/"đã ghi nhận" — phải nói rõ bạn chưa lưu được ở đây và hướng dẫn họ chuyển sang kênh "Thông tin trường" để lưu.
` : ''}${channelId === 'school-info' ? `Đang ở kênh "Thông tin trường" — CHỈ dành cho admin/hiệu trưởng/hiệu phó/văn thư quản lý dữ kiện nội bộ nhà trường:
Khi người dùng muốn THÊM hoặc CẬP NHẬT 1 dữ kiện (ví dụ "phòng tin học có 40 máy tính", "lớp 3/2 năm nay cô A chủ nhiệm"): xác định chủ đề (topic) + nội dung (content), tự đánh giá isYearSpecific=true nếu thông tin có thể đổi theo năm học (như phân công lớp), false nếu cố định lâu dài (như số thiết bị), rồi gọi confirm_add_school_info(topic, content, isYearSpecific). Sau khi hàm trả về confirmed=true: nếu existingId khác null, PHẢI nói rõ đây là GHI ĐÈ, nêu cả nội dung cũ (existingContent) và nội dung mới trước khi mời xác nhận; nếu existingId là null thì nói đây là THÊM MỚI. Luôn mời người dùng bấm nút xác nhận hiện ra trong chat — KHÔNG tự nói "đã lưu xong", việc ghi chỉ xảy ra khi bấm xác nhận.
Khi người dùng muốn xem lại toàn bộ dữ kiện đã lưu để rà soát: gọi list_school_info, trình bày gọn theo từng dòng "chủ đề — nội dung — năm áp dụng".` : ''}
${isFirstMessage ? `Đây là tin nhắn ĐẦU TIÊN của phiên trò chuyện — TRƯỚC KHI trả lời, LUÔN gọi hàm get_recent_notifications trước. Chào hỏi thân thiện, và nếu có thông báo chưa đọc thì tóm tắt ngắn gọn số lượng + nội dung chính (ví dụ: "cô có 2 thông báo mới: ..."), nếu không có thông báo nào thì chào bình thường không cần nhắc tới việc không có thông báo.
` : ''}Nếu chỉ chào hỏi/hỏi thăm thông thường, trả lời trực tiếp không cần gọi hàm.

${APP_GUIDE}
Khi giáo viên hỏi CÁCH DÙNG app (không phải hỏi dữ liệu cụ thể), trả lời dựa vào phần HƯỚNG DẪN SỬ DỤNG APP ở trên — KHÔNG cần gọi hàm nào.`;

    const contents = messages.map(m => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    const tools = channelId === 'school-info' ? CHAT_TOOLS_WITH_SCHOOL_WRITE : CHAT_TOOLS;
    const callOnce = () => {
      const payload = JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      });
      return callGeminiRotate({ model: CHAT_MODEL, keys, payload });
    };

    let geminiRes = await callOnce();
    if (geminiRes.status === 429) {
      const errBody = await geminiRes.json().catch(() => ({}));
      return res.status(429).json({ error: isDailyLimit(errBody) ? 'quota_rpd' : 'quota_rpm' });
    }
    if (!geminiRes.ok) {
      const body = await geminiRes.json().catch(() => ({}));
      return res.status(500).json({ error: 'gemini_error', details: body });
    }

    let data = await geminiRes.json();
    let parts = data.candidates?.[0]?.content?.parts || [];
    let taskListForUI = null;
    let documentListForUI = null;
    let categoryCandidatesForUI = null;
    let myDocumentListForUI = null;
    let editTargetForUI = null;
    let bghTaskCandidateForUI = null;
    let profileCandidateForUI = null;
    let schoolInfoCandidateForUI = null;

    // Một số việc (vd nộp tài liệu) cần NHIỀU vòng gọi hàm liên tiếp
    // (list_upload_categories → suy luận → confirm_upload_target → trả lời),
    // nên lặp cho tới khi Gemini trả về text thay vì functionCall, giới hạn số vòng để tránh lặp vô hạn.
    for (let round = 0; round < 5; round++) {
      const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);
      if (functionCalls.length === 0) break;

      contents.push({ role: 'model', parts });

      const responseParts = [];
      for (const fc of functionCalls) {
        const result = await executeChatTool(fc.name, uid, fc.args);
        if (fc.name === 'list_my_tasks' && Array.isArray(result.tasks)) {
          taskListForUI = result.tasks.filter(t => t.status === 'assigned' || t.status === 'overdue');
        }
        if (fc.name === 'search_public_documents' && Array.isArray(result.documents)) {
          documentListForUI = result.documents;
        }
        if (fc.name === 'confirm_upload_target' && result.confirmed) {
          categoryCandidatesForUI = [result];
        }
        if (fc.name === 'list_my_documents' && Array.isArray(result.documents)) {
          myDocumentListForUI = result.documents;
        }
        if (fc.name === 'confirm_edit_target' && result.confirmed) {
          editTargetForUI = result;
        }
        if (fc.name === 'confirm_forward_task_to_bgh' && result.confirmed) {
          bghTaskCandidateForUI = result;
        }
        if (fc.name === 'confirm_update_profile' && result.confirmed) {
          profileCandidateForUI = result;
        }
        if (fc.name === 'confirm_add_school_info' && result.confirmed) {
          schoolInfoCandidateForUI = result;
        }
        responseParts.push({ functionResponse: { name: fc.name, response: result } });
      }
      contents.push({ role: 'function', parts: responseParts });

      geminiRes = await callOnce();
      if (!geminiRes.ok) {
        const body = await geminiRes.json().catch(() => ({}));
        return res.status(500).json({ error: 'gemini_error', details: body });
      }
      data = await geminiRes.json();
      parts = data.candidates?.[0]?.content?.parts || [];
    }

    const answer = (parts.find(p => p.text)?.text || '').trim();
    if (!answer) return res.status(500).json({ error: 'empty' });

    const responseBody = { success: true, answer };
    if (taskListForUI) responseBody.taskList = taskListForUI;
    if (documentListForUI) responseBody.documentList = documentListForUI;
    if (categoryCandidatesForUI) responseBody.categoryCandidates = categoryCandidatesForUI;
    if (myDocumentListForUI) responseBody.myDocumentList = myDocumentListForUI;
    if (editTargetForUI) responseBody.editTarget = editTargetForUI;
    if (bghTaskCandidateForUI) responseBody.bghTaskCandidate = bghTaskCandidateForUI;
    if (profileCandidateForUI) responseBody.profileCandidate = profileCandidateForUI;
    if (schoolInfoCandidateForUI) responseBody.schoolInfoCandidate = schoolInfoCandidateForUI;
    return res.json(responseBody);
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ error: 'chat_failed', message: error.message });
  }
});

/**
 * Hoàn thành công việc qua Chat AI — ghi y hệt logic taskService.submitReport
 * (tính điểm tự động theo deadline, versioning khi nộp lại, cập nhật trạng thái,
 * báo cho người giao việc) nhưng chạy ở server qua Admin SDK.
 * Client tự upload file lên Drive trước (dùng lại /api/upload) rồi gửi fileUrls/fileNames vào đây.
 */
app.post('/api/chat/complete-task', verifyAuth, express.json(), async (req, res) => {
  try {
    const uid = req.uid;
    const { displayName, taskId, content, fileUrls, fileNames } = req.body || {};
    if (!taskId || !content || !content.trim()) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const taskRef = adminDb.collection('tasks').doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
      return res.status(404).json({ error: 'task_not_found' });
    }
    const task = taskSnap.data();

    if (!Array.isArray(task.assignedTo) || !task.assignedTo.includes(uid)) {
      return res.status(403).json({ error: 'not_assigned' });
    }

    const now = new Date();
    const deadline1 = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
    const deadline2 = task.deadline2?.toDate ? task.deadline2.toDate() : (task.deadline2 ? new Date(task.deadline2) : null);

    let score = 0;
    let metDeadline;
    if (now <= deadline1) {
      score = task.scoreDeadline1 || task.maxScore;
      metDeadline = 1;
    } else if (deadline2 && now <= deadline2) {
      score = task.scoreDeadline2 || (task.maxScore / 2);
      metDeadline = 2;
    }

    // Existing latest submission by this teacher, if any (handles resubmission/versioning)
    const existingSnap = await adminDb.collection('submissions')
      .where('taskId', '==', taskId)
      .where('teacherId', '==', uid)
      .where('isLatest', '==', true)
      .get();

    let version = 1;
    let previousVersionId;
    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      version = (existingDoc.data().version || 1) + 1;
      previousVersionId = existingDoc.id;
      await existingDoc.ref.update({ isLatest: false });
    }

    const submissionData = {
      taskId,
      schoolYearId: task.schoolYearId,
      semester: task.semester || null,
      teacherId: uid,
      teacherName: displayName || '',
      content: content.trim(),
      fileUrls: Array.isArray(fileUrls) ? fileUrls : [],
      fileNames: Array.isArray(fileNames) ? fileNames : [],
      submittedAt: admin.firestore.Timestamp.now(),
      score,
      version,
      isLatest: true,
    };
    if (metDeadline !== undefined) submissionData.metDeadline = metDeadline;
    if (previousVersionId) submissionData.previousVersionId = previousVersionId;

    const submissionRef = await adminDb.collection('submissions').add(submissionData);

    await taskRef.update({ status: 'submitted', updatedAt: admin.firestore.Timestamp.now() });

    // Recompute aggregate task status (mirrors taskService.updateTaskStatus)
    const latestSubsSnap = await adminDb.collection('submissions')
      .where('taskId', '==', taskId)
      .where('isLatest', '==', true)
      .get();
    const latestSubs = latestSubsSnap.docs.map(d => d.data());
    let newStatus = task.status;
    if (latestSubs.length === 0 && now > deadline1) {
      newStatus = 'overdue';
    } else if (latestSubs.length === (task.assignedTo || []).length) {
      const allGraded = latestSubs.every(s => s.score !== undefined);
      newStatus = allGraded ? 'completed' : 'submitted';
    } else if (latestSubs.length > 0) {
      newStatus = 'submitted';
    }
    if (newStatus !== task.status) {
      await taskRef.update({ status: newStatus });
    }

    if (task.createdBy) {
      await adminDb.collection('notifications').add({
        userId: task.createdBy,
        type: 'task_submitted',
        title: 'Có bài nộp mới',
        message: `${displayName || 'Giáo viên'} đã nộp bài cho "${task.title}"`,
        data: { taskId, taskTitle: task.title },
        read: false,
        createdAt: admin.firestore.Timestamp.now(),
      });
    }

    res.json({ success: true, submissionId: submissionRef.id, score });
  } catch (error) {
    console.error('❌ Complete task error:', error);
    res.status(500).json({ error: 'complete_task_failed', message: error.message });
  }
});

/**
 * Văn thư chuyển công việc cho Ban Giám Hiệu qua Chat AI — bước ghi thật sự, chỉ chạy
 * SAU KHI văn thư đã bấm xác nhận trên thẻ bản nháp do confirm_forward_task_to_bgh trả về.
 * Tự tra lại role='van_thu' ở server, KHÔNG tin dữ liệu client gửi lên.
 */
app.post('/api/chat/forward-task', verifyAuth, express.json(), async (req, res) => {
  try {
    const uid = req.uid;
    const { displayName, title, description, priority, deadline, schoolYearId, targetUids, targetNames } = req.body || {};
    if (!title || !description || !deadline || !schoolYearId || !Array.isArray(targetUids) || targetUids.length === 0) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const callerSnap = await adminDb.collection('users').doc(uid).get();
    const role = callerSnap.exists ? callerSnap.data().role : null;
    if (role !== 'van_thu') return res.status(403).json({ error: 'not_authorized' });

    const createdByName = displayName || callerSnap.data()?.displayName || 'Văn thư';
    const taskData = {
      schoolYearId,
      title: String(title).trim(),
      description: String(description).trim(),
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      status: 'assigned',
      maxScore: 10,
      scoreDeadline1: 10,
      scoreDeadline2: 5,
      deadline: admin.firestore.Timestamp.fromDate(new Date(`${deadline}T23:59:59`)),
      createdBy: uid,
      createdByName,
      assignedTo: targetUids,
      assignedToNames: Array.isArray(targetNames) ? targetNames : [],
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    const taskRef = await adminDb.collection('tasks').add(taskData);

    const notifyBatch = adminDb.batch();
    targetUids.forEach((targetUid) => {
      const notifRef = adminDb.collection('notifications').doc();
      notifyBatch.set(notifRef, {
        userId: targetUid,
        type: 'task_assigned',
        title: 'Công việc mới',
        message: `${createdByName} đã giao cho bạn: "${taskData.title}"`,
        data: { taskId: taskRef.id, taskTitle: taskData.title },
        read: false,
        createdAt: admin.firestore.Timestamp.now(),
      });
    });
    await notifyBatch.commit();

    res.json({ success: true, taskId: taskRef.id });
  } catch (error) {
    console.error('❌ Forward task to BGH error:', error);
    res.status(500).json({ error: 'forward_task_failed', message: error.message });
  }
});

/**
 * Đổi tên hiển thị qua Chat AI — bước ghi thật sự, chỉ chạy SAU KHI người dùng đã bấm
 * xác nhận trên thẻ bản nháp do confirm_update_profile trả về.
 */
app.post('/api/chat/update-profile', verifyAuth, express.json(), async (req, res) => {
  try {
    const uid = req.uid;
    const { displayName } = req.body || {};
    const newName = String(displayName || '').trim();
    if (!newName) return res.status(400).json({ error: 'missing_fields' });

    await adminDb.collection('users').doc(uid).update({
      displayName: newName,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    res.json({ success: true, displayName: newName });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ error: 'update_profile_failed', message: error.message });
  }
});

/**
 * Thêm/ghi đè 1 dữ kiện nội bộ nhà trường qua Chat AI (kênh "Thông tin trường") — bước ghi
 * thật sự, chỉ chạy SAU KHI người dùng đã bấm xác nhận trên thẻ bản nháp do
 * confirm_add_school_info trả về. Tự tra lại quyền ở server, KHÔNG tin dữ liệu client gửi lên.
 */
app.post('/api/chat/add-school-info', verifyAuth, express.json(), async (req, res) => {
  try {
    const uid = req.uid;
    const { displayName, topic, content, schoolYearId, existingId } = req.body || {};
    if (!topic || !content) return res.status(400).json({ error: 'missing_fields' });

    const callerSnap = await adminDb.collection('users').doc(uid).get();
    const role = callerSnap.exists ? callerSnap.data().role : null;
    if (!SCHOOL_INFO_EDITOR_ROLES.includes(role)) return res.status(403).json({ error: 'not_authorized' });

    const data = {
      topic: String(topic).trim(),
      content: String(content).trim(),
      schoolYearId: schoolYearId || null,
      createdBy: uid,
      createdByName: displayName || callerSnap.data()?.displayName || '',
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (existingId) {
      await adminDb.collection('schoolInfo').doc(existingId).update(data);
      return res.json({ success: true, id: existingId, overwritten: true });
    }

    data.createdAt = admin.firestore.Timestamp.now();
    const ref = await adminDb.collection('schoolInfo').add(data);
    res.json({ success: true, id: ref.id, overwritten: false });
  } catch (error) {
    console.error('❌ Add school info error:', error);
    res.status(500).json({ error: 'add_school_info_failed', message: error.message });
  }
});

/**
 * Nộp tài liệu qua Chat AI — sao chép logic tạo Document của DocumentUploadScreen
 * (auto duyệt cho admin/vp/principal, còn lại ở trạng thái chờ duyệt) nhưng chạy qua Admin SDK.
 * Client tự upload file lên Drive trước (dùng lại googleDriveServiceBackend/api/upload)
 * rồi gửi mảng file (driveFileId/driveFileUrl/name/size/mimeType) vào đây.
 */
app.post('/api/chat/submit-document', verifyAuth, express.json(), async (req, res) => {
  try {
    const uid = req.uid;
    const { displayName, schoolYearId, categoryId, subCategoryId, title, files } = req.body || {};
    if (!schoolYearId || !categoryId || !title || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const role = userSnap.exists ? userSnap.data().role : 'teacher';
    const status = (role === 'admin' || role === 'vice_principal' || role === 'principal') ? 'approved' : 'pending';

    const documentData = {
      schoolYearId,
      categoryId,
      title: String(title).trim(),
      files: files.map(f => ({
        name: f.name,
        size: f.size || 0,
        mimeType: f.mimeType || 'application/octet-stream',
        driveFileId: f.driveFileId || '',
        driveFileUrl: f.driveFileUrl || '',
      })),
      uploadedBy: uid,
      uploadedByName: displayName || '',
      uploadedAt: admin.firestore.Timestamp.now(),
      status,
      isPublic: false,
    };
    if (subCategoryId) documentData.subCategoryId = subCategoryId;

    const docRef = await adminDb.collection('documents').add(documentData);

    res.json({ success: true, documentId: docRef.id, status });
  } catch (error) {
    console.error('❌ Submit document error:', error);
    res.status(500).json({ error: 'submit_document_failed', message: error.message });
  }
});

/**
 * Thêm file vào tài liệu đã nộp (chỉ chính chủ mới sửa được).
 * Client tự upload file lên Drive trước (dùng lại /api/upload) rồi gửi mảng file vào đây.
 * Sửa tài liệu đã duyệt sẽ tự đưa về "chờ duyệt" lại — giống đúng luật ở màn Hồ sơ điện tử cũ.
 */
app.post('/api/chat/add-document-files', verifyAuth, express.json(), async (req, res) => {
  try {
    const uid = req.uid;
    const { documentId, files } = req.body || {};
    if (!documentId || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const docRef = adminDb.collection('documents').doc(documentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'document_not_found' });
    const doc = docSnap.data();
    if (doc.uploadedBy !== uid) return res.status(403).json({ error: 'not_owner' });

    const existingFiles = Array.isArray(doc.files) ? doc.files : [];
    const newFiles = files.map(f => ({
      name: f.name,
      size: f.size || 0,
      mimeType: f.mimeType || 'application/octet-stream',
      driveFileId: f.driveFileId || '',
      driveFileUrl: f.driveFileUrl || '',
    }));

    const updateData = {
      files: [...existingFiles, ...newFiles],
      updatedBy: uid,
      updatedAt: admin.firestore.Timestamp.now(),
      editCount: (doc.editCount || 0) + 1,
    };
    if (doc.status === 'approved') updateData.status = 'pending';

    await docRef.update(updateData);
    res.json({ success: true, fileCount: updateData.files.length, status: updateData.status || doc.status });
  } catch (error) {
    console.error('❌ Add document files error:', error);
    res.status(500).json({ error: 'add_files_failed', message: error.message });
  }
});

/**
 * Xóa 1 file khỏi tài liệu đã nộp (chỉ chính chủ mới sửa được).
 */
app.post('/api/chat/remove-document-file', verifyAuth, express.json(), async (req, res) => {
  try {
    const uid = req.uid;
    const { documentId, fileIndex } = req.body || {};
    if (!documentId || typeof fileIndex !== 'number') {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const docRef = adminDb.collection('documents').doc(documentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'document_not_found' });
    const doc = docSnap.data();
    if (doc.uploadedBy !== uid) return res.status(403).json({ error: 'not_owner' });

    const existingFiles = Array.isArray(doc.files) ? doc.files : [];
    if (fileIndex < 0 || fileIndex >= existingFiles.length) {
      return res.status(400).json({ error: 'invalid_file_index' });
    }

    const remainingFiles = existingFiles.filter((_, i) => i !== fileIndex);
    const updateData = {
      files: remainingFiles,
      updatedBy: uid,
      updatedAt: admin.firestore.Timestamp.now(),
      editCount: (doc.editCount || 0) + 1,
    };
    if (doc.status === 'approved') updateData.status = 'pending';

    await docRef.update(updateData);
    res.json({ success: true, fileCount: remainingFiles.length, status: updateData.status || doc.status });
  } catch (error) {
    console.error('❌ Remove document file error:', error);
    res.status(500).json({ error: 'remove_file_failed', message: error.message });
  }
});

/**
 * Lấy chi tiết 1 tài liệu (của chính giáo viên) để sửa — gọi thẳng từ nút "Sửa" trên
 * danh sách myDocumentList, không cần đi qua AI vì documentId đã biết chắc rồi.
 */
app.post('/api/chat/document-details', verifyAuth, express.json(), async (req, res) => {
  try {
    const uid = req.uid;
    const { documentId } = req.body || {};
    if (!documentId) return res.status(400).json({ error: 'missing_fields' });
    const result = await toolConfirmEditTarget(uid, documentId);
    if (result.error) return res.status(400).json(result);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Document details error:', error);
    res.status(500).json({ error: 'document_details_failed', message: error.message });
  }
});

/**
 * Send notification endpoint
 */
app.post('/api/notifications/send', verifyAuth, express.json(), async (req, res) => {
  try {
    const { type, task, assignedTo, userId, score } = req.body;

    if (!type || !task) {
      return res.status(400).json({
        error: 'Missing required fields: type, task',
      });
    }

    let result;
    switch (type) {
      case 'new_task':
        if (!assignedTo || assignedTo.length === 0) {
          return res.status(400).json({
            error: 'assignedTo is required for new_task notifications',
          });
        }
        result = await sendNewTaskNotification(task, assignedTo);
        break;

      case 'task_scored':
        if (!userId || score === undefined) {
          return res.status(400).json({
            error: 'userId and score are required for task_scored notifications',
          });
        }
        result = await sendTaskScoredNotification(task, userId, score);
        break;

      default:
        return res.status(400).json({
          error: `Invalid notification type: ${type}`,
        });
    }

    res.json({
      success: true,
      message: 'Notification sent',
      result,
    });
  } catch (error) {
    console.error('❌ Notification error:', error);
    res.status(500).json({
      error: 'Failed to send notification',
      message: error.message,
    });
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve static files from the React app (for production)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  console.log('📦 Serving static files from:', distPath);
  app.use(express.static(distPath));

  // Handle React Router - return index.html for all non-API routes
  // Express 5 requires regex pattern instead of '*'
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('⚠️  dist folder not found. Frontend will not be served.');
  console.log('   Run "npm run build" to build the frontend first.');
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Root Folder ID: ${ROOT_FOLDER_ID || 'NOT CONFIGURED'}`);
  console.log(`🔐 OAuth Method: Google OAuth 2.0`);

  const hasCredentials = oauth2Client.credentials && oauth2Client.credentials.access_token;
  if (hasCredentials) {
    console.log('✅ OAuth credentials loaded');
  } else {
    console.log('⚠️  OAuth not authorized yet');
    console.log(`👉 Visit: http://localhost:${PORT}/api/auth/google to authorize`);
  }
  console.log('\n');
});
