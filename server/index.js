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

async function executeChatTool(name, uid) {
  switch (name) {
    case 'list_my_tasks': return toolListMyTasks(uid);
    case 'get_my_scores': return toolGetMyScores(uid);
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

    const systemPrompt = `Bạn là trợ lý AI thân thiện cho giáo viên "${displayName || ''}" trong ứng dụng quản lý công việc trường học.
Trả lời ngắn gọn, tiếng Việt, lịch sự.
Khi giáo viên hỏi về công việc/nhiệm vụ của mình, hoặc việc nào cần làm/ưu tiên, hãy gọi hàm list_my_tasks rồi dựa vào priority và deadline trong dữ liệu trả về để tư vấn — KHÔNG tự bịa công việc.
Mặc định khi liệt kê, CHỈ nêu các việc có status "assigned" hoặc "overdue" (chưa hoàn thành) — không nhắc tới việc "submitted"/"completed" trừ khi giáo viên hỏi rõ về việc đã nộp/đã hoàn thành.
Khi giáo viên hỏi về điểm số, hãy gọi hàm get_my_scores.
Nếu chỉ chào hỏi/hỏi thăm thông thường, trả lời trực tiếp không cần gọi hàm.`;

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
    const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);
    let taskListForUI = null;

    if (functionCalls.length > 0) {
      contents.push({ role: 'model', parts });

      const responseParts = [];
      for (const fc of functionCalls) {
        const result = await executeChatTool(fc.name, uid);
        if (fc.name === 'list_my_tasks' && Array.isArray(result.tasks)) {
          taskListForUI = result.tasks.filter(t => t.status === 'assigned' || t.status === 'overdue');
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
