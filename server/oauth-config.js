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
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// OAuth2 Client configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback'
);

// Scopes required for Google Drive access
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
];

// Path to store refresh token
const TOKEN_PATH = path.join(__dirname, '..', 'google-oauth-tokens.json');

/**
 * Load saved credentials if they exist
 */
function loadSavedCredentials() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const content = fs.readFileSync(TOKEN_PATH, 'utf8');
      const credentials = JSON.parse(content);
      oauth2Client.setCredentials(credentials);
      console.log('✅ Loaded saved OAuth credentials');
      return true;
    }
  } catch (error) {
    console.error('Error loading saved credentials:', error);
  }
  return false;
}

/**
 * Save credentials to file
 */
function saveCredentials(tokens) {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('✅ OAuth credentials saved to', TOKEN_PATH);
  } catch (error) {
    console.error('Error saving credentials:', error);
  }
}

/**
 * Generate authorization URL for admin to visit
 */
function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
async function getTokenFromCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  saveCredentials(tokens);
  return tokens;
}

/**
 * Refresh access token if expired
 */
async function refreshAccessToken() {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    saveCredentials(credentials);
    console.log('✅ Access token refreshed');
    return credentials;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

// Try to load saved credentials on startup
loadSavedCredentials();

export {
  oauth2Client,
  SCOPES,
  getAuthUrl,
  getTokenFromCode,
  refreshAccessToken,
  loadSavedCredentials,
};
