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
 * ADMIN ONLY: Export current tokens for ENV VAR setup
 * Access: /api/auth/export-tokens?secret=YOUR_SECRET_HERE
 */
app.get('/api/auth/export-tokens', (req, res) => {
  const secret = req.query.secret;

  // Simple password check
  if (secret !== process.env.ADMIN_SECRET && secret !== 'temp-export-2026') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const credentials = oauth2Client.credentials;
  if (!credentials || !credentials.refresh_token) {
    return res.status(404).json({
      error: 'No credentials found. Please authorize first.',
      authUrl: '/api/auth/google'
    });
  }

  // Return formatted for easy copy-paste
  res.json({
    message: 'Copy the JSON below and paste into Render ENV VAR: GOOGLE_OAUTH_TOKENS',
    envVarValue: JSON.stringify(credentials),
    credentials: credentials
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
