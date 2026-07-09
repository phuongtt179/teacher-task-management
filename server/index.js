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
app.use(cors());
app.use(express.json());

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
app.post('/api/upload', upload.single('file'), async (req, res) => {
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
app.delete('/api/files/:fileId', async (req, res) => {
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
app.post('/api/parse-tasks', express.json(), async (req, res) => {
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

const CHAT_TOOLS = [{
  functionDeclarations: [
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
      name: 'get_department_submission_summary',
      description: 'CHỈ dùng khi giáo viên đang hỏi là TỔ TRƯỞNG: tổng hợp tình hình nộp Kế hoạch bài dạy/Sổ chủ nhiệm/Sổ dự giờ của các thành viên trong tổ mình phụ trách. Nếu người hỏi không phải tổ trưởng, hàm sẽ trả lỗi not_authorized.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'get_school_submission_summary',
      description: 'CHỈ dùng khi giáo viên đang hỏi là hiệu trưởng/hiệu phó/admin: tổng hợp tình hình nộp Kế hoạch bài dạy/Sổ chủ nhiệm/Sổ dự giờ của TẤT CẢ giáo viên toàn trường, theo từng tổ. Nếu người hỏi không có quyền này, hàm sẽ trả lỗi not_authorized.',
      parameters: { type: 'OBJECT', properties: {} },
    },
  ],
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

async function toolGetDepartmentSubmissionSummary(uid) {
  const deptSnap = await adminDb.collection('departments').where('headTeacherId', '==', uid).limit(1).get();
  if (deptSnap.empty) return { error: 'not_department_head' };
  const dept = deptSnap.docs[0].data();
  const memberIds = dept.memberIds || [];

  const summary = await computeSubmissionSummary(memberIds);
  return { departmentName: dept.name, ...summary };
}

async function toolGetSchoolSubmissionSummary(uid) {
  // Tự tra role từ Firestore, KHÔNG tin role client tự khai báo — tránh giả mạo quyền xem toàn trường.
  const callerSnap = await adminDb.collection('users').doc(uid).get();
  const role = callerSnap.exists ? callerSnap.data().role : null;
  if (!['admin', 'vice_principal', 'principal'].includes(role)) return { error: 'not_authorized' };

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

  return { departments, unassigned, note: summary.note };
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
  const unread = snap.docs
    .map(d => d.data())
    .filter(n => n.read !== true)
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    .slice(0, 5)
    .map(n => ({ title: n.title, message: n.message }));

  return { notifications: unread };
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
    case 'get_department_submission_summary': return toolGetDepartmentSubmissionSummary(uid);
    case 'get_school_submission_summary': return toolGetSchoolSubmissionSummary(uid);
    default: return { error: 'unknown_tool' };
  }
}

app.post('/api/chat', express.json(), async (req, res) => {
  try {
    const { uid, displayName, messages } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'missing_uid' });
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
Khi người dùng hỏi tổng hợp tình hình nộp hồ sơ CỦA NGƯỜI KHÁC/của tổ/toàn trường (ví dụ "tổ tôi ai chưa nộp kế hoạch bài dạy", "xem tổng hợp nộp hồ sơ của tổ", "toàn trường nộp thế nào rồi"): thử gọi get_department_submission_summary trước (dành cho tổ trưởng); nếu trả về lỗi not_authorized, thử gọi get_school_submission_summary (dành cho hiệu trưởng/hiệu phó/admin); nếu hàm đó cũng báo not_authorized thì báo thẳng người dùng không có quyền xem tổng hợp này, đừng tự bịa số liệu. Khi trình bày, nêu rõ tên từng người/tổ kèm số liệu đã nộp/tổng số (đặc biệt "Kế hoạch bài dạy" tính theo số tuần đã nộp/tổng số tuần).
${isFirstMessage ? `Đây là tin nhắn ĐẦU TIÊN của phiên trò chuyện — TRƯỚC KHI trả lời, LUÔN gọi hàm get_recent_notifications trước. Chào hỏi thân thiện, và nếu có thông báo chưa đọc thì tóm tắt ngắn gọn số lượng + nội dung chính (ví dụ: "cô có 2 thông báo mới: ..."), nếu không có thông báo nào thì chào bình thường không cần nhắc tới việc không có thông báo.
` : ''}Nếu chỉ chào hỏi/hỏi thăm thông thường, trả lời trực tiếp không cần gọi hàm.`;

    const contents = messages.map(m => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    const callOnce = () => {
      const payload = JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: CHAT_TOOLS,
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
app.post('/api/chat/complete-task', express.json(), async (req, res) => {
  try {
    const { uid, displayName, taskId, content, fileUrls, fileNames } = req.body || {};
    if (!uid || !taskId || !content || !content.trim()) {
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
 * Nộp tài liệu qua Chat AI — sao chép logic tạo Document của DocumentUploadScreen
 * (auto duyệt cho admin/vp/principal, còn lại ở trạng thái chờ duyệt) nhưng chạy qua Admin SDK.
 * Client tự upload file lên Drive trước (dùng lại googleDriveServiceBackend/api/upload)
 * rồi gửi mảng file (driveFileId/driveFileUrl/name/size/mimeType) vào đây.
 */
app.post('/api/chat/submit-document', express.json(), async (req, res) => {
  try {
    const { uid, displayName, schoolYearId, categoryId, subCategoryId, title, files } = req.body || {};
    if (!uid || !schoolYearId || !categoryId || !title || !Array.isArray(files) || files.length === 0) {
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
app.post('/api/chat/add-document-files', express.json(), async (req, res) => {
  try {
    const { uid, documentId, files } = req.body || {};
    if (!uid || !documentId || !Array.isArray(files) || files.length === 0) {
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
app.post('/api/chat/remove-document-file', express.json(), async (req, res) => {
  try {
    const { uid, documentId, fileIndex } = req.body || {};
    if (!uid || !documentId || typeof fileIndex !== 'number') {
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
app.post('/api/chat/document-details', express.json(), async (req, res) => {
  try {
    const { uid, documentId } = req.body || {};
    if (!uid || !documentId) return res.status(400).json({ error: 'missing_fields' });
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
app.post('/api/notifications/send', express.json(), async (req, res) => {
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
