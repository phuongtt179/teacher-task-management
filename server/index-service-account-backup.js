import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

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

// Load Service Account credentials
const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, '..', 'google-service-account-key.json');
const ROOT_FOLDER_ID = process.env.VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID; // My Drive folder ID
const WORKSPACE_USER_EMAIL = process.env.GOOGLE_WORKSPACE_USER_EMAIL; // User to impersonate

// Initialize Google Drive API with JWT for domain-wide delegation
let drive;
let jwtClient;

(async () => {
  try {
    // Read service account key
    const serviceAccountKey = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8'));

    // Verify private key exists
    if (!serviceAccountKey.private_key) {
      throw new Error('Private key not found in service account JSON file');
    }

    // Create JWT client with domain-wide delegation
    jwtClient = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/drive'],
      subject: WORKSPACE_USER_EMAIL,
    });

    // IMPORTANT: Authorize the JWT client for domain-wide delegation
    await jwtClient.authorize();

    drive = google.drive({ version: 'v3', auth: jwtClient });
    console.log('✅ Google Drive API initialized successfully (using JWT)');
    console.log(`📧 Service Account: ${serviceAccountKey.client_email}`);
    if (WORKSPACE_USER_EMAIL) {
      console.log(`👤 Impersonating user: ${WORKSPACE_USER_EMAIL}`);
      console.log('✅ JWT Client authorized successfully');
    } else {
      console.log('⚠️  Warning: GOOGLE_WORKSPACE_USER_EMAIL not set (domain-wide delegation disabled)');
    }
  } catch (error) {
    console.error('❌ Error initializing Google Drive API:', error.message);
    console.error('Full error:', error);
  }
})();

/**
 * Get or create a folder in Google Drive (My Drive)
 */
async function getOrCreateFolder(folderName, parentId = ROOT_FOLDER_ID) {
  try {
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
    const fileMetadata = {
      name: file.originalname,
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

// API Endpoints

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
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
        error: 'Google Drive not configured',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
      });
    }

    const { schoolYear, category, subCategory, uploaderName, documentTitle } = req.body;

    if (!schoolYear || !category) {
      return res.status(400).json({
        error: 'Missing required fields: schoolYear, category',
      });
    }

    // NEW: Create folder structure based on whether uploaderName and documentTitle are provided
    let targetFolderId;

    if (uploaderName && documentTitle) {
      // NEW Structure: Root > SchoolYear > Category > [SubCategory] > UploaderName > DocumentTitle
      console.log(`📁 Creating folder structure: ${schoolYear} > ${category}${subCategory ? ' > ' + subCategory : ''} > ${uploaderName} > ${documentTitle}`);

      const yearFolderId = await getOrCreateFolder(schoolYear, ROOT_FOLDER_ID);
      const categoryFolderId = await getOrCreateFolder(category, yearFolderId);

      // If there's a subcategory, create it between category and uploader
      let parentFolderId = categoryFolderId;
      if (subCategory) {
        parentFolderId = await getOrCreateFolder(subCategory, categoryFolderId);
      }

      const uploaderFolderId = await getOrCreateFolder(uploaderName, parentFolderId);
      targetFolderId = await getOrCreateFolder(documentTitle, uploaderFolderId);
    } else {
      // OLD Structure (backward compatibility): Root > School Year > Category > Subcategory
      console.log(`📁 Creating folder structure: ${schoolYear} > ${category}${subCategory ? ' > ' + subCategory : ''}`);

      const yearFolderId = await getOrCreateFolder(schoolYear);
      const categoryFolderId = await getOrCreateFolder(category, yearFolderId);

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
    if (!drive) {
      return res.status(500).json({
        error: 'Google Drive not configured',
      });
    }

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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Root Folder ID: ${ROOT_FOLDER_ID || 'NOT CONFIGURED'}`);
  console.log(`🔑 Service Account Key: ${fs.existsSync(SERVICE_ACCOUNT_KEY_PATH) ? 'Found' : 'NOT FOUND'}`);
  console.log('\n');
});
