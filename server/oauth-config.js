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
 * Priority: GOOGLE_REFRESH_TOKEN (recommended) -> GOOGLE_OAUTH_TOKENS -> File
 */
function loadSavedCredentials() {
  try {
    // PRIORITY 1: Load from GOOGLE_REFRESH_TOKEN (for Render production)
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      console.log('📦 Loading refresh token from GOOGLE_REFRESH_TOKEN...');
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
      console.log('✅ Loaded refresh token from environment variable');
      console.log('🔄 Google SDK will auto-refresh access_token when needed');
      return true;
    }

    // PRIORITY 2: Load from GOOGLE_OAUTH_TOKENS (legacy support)
    if (process.env.GOOGLE_OAUTH_TOKENS) {
      console.log('📦 Loading OAuth tokens from GOOGLE_OAUTH_TOKENS...');
      const credentials = JSON.parse(process.env.GOOGLE_OAUTH_TOKENS);
      oauth2Client.setCredentials(credentials);
      console.log('✅ Loaded OAuth credentials from environment variable');
      return true;
    }

    // PRIORITY 3: Fallback to file (for local development)
    if (fs.existsSync(TOKEN_PATH)) {
      const content = fs.readFileSync(TOKEN_PATH, 'utf8');
      const credentials = JSON.parse(content);
      oauth2Client.setCredentials(credentials);
      console.log('✅ Loaded OAuth credentials from file');
      return true;
    }

    console.log('⚠️  No OAuth credentials found');
    console.log('💡 Set GOOGLE_REFRESH_TOKEN environment variable or authorize via /api/auth/google');
  } catch (error) {
    console.error('❌ Error loading saved credentials:', error);
  }
  return false;
}

/**
 * Save credentials to file (PRESERVES refresh_token)
 */
function saveCredentials(tokens) {
  try {
    // Preserve refresh_token from existing credentials
    const currentCredentials = oauth2Client.credentials || {};
    const refreshToken = tokens.refresh_token || currentCredentials.refresh_token;

    const credentialsToSave = {
      ...tokens,
      refresh_token: refreshToken, // Always preserve refresh_token
    };

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentialsToSave, null, 2));
    console.log('✅ OAuth credentials saved to', TOKEN_PATH);

    if (refreshToken) {
      console.log('💾 Refresh token preserved in saved credentials');
    } else {
      console.warn('⚠️  No refresh token found to preserve');
    }
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
 * Refresh access token if expired (PRESERVES refresh_token)
 */
async function refreshAccessToken() {
  try {
    console.log('🔄 Refreshing access token...');

    // Save current refresh_token before refresh
    const currentRefreshToken = oauth2Client.credentials?.refresh_token;

    const { credentials } = await oauth2Client.refreshAccessToken();

    // Merge new credentials with existing refresh_token
    const mergedCredentials = {
      ...credentials,
      refresh_token: currentRefreshToken, // Preserve refresh_token
    };

    oauth2Client.setCredentials(mergedCredentials);
    saveCredentials(mergedCredentials);
    console.log('✅ Access token refreshed successfully');
    return mergedCredentials;
  } catch (error) {
    console.error('❌ Error refreshing access token:', error);
    throw error;
  }
}

/**
 * Get OAuth2 client with valid token (auto-refresh if needed)
 */
async function getValidOAuth2Client() {
  try {
    const credentials = oauth2Client.credentials;

    // Check if we have credentials
    if (!credentials || !credentials.refresh_token) {
      throw new Error('No OAuth credentials found. Please authorize first.');
    }

    // Check if access token is expired or about to expire (within 5 minutes)
    const now = Date.now();
    const expiryDate = credentials.expiry_date || 0;
    const fiveMinutes = 5 * 60 * 1000;

    if (!credentials.access_token || expiryDate < (now + fiveMinutes)) {
      console.log('⏰ Access token expired or about to expire, refreshing...');
      await refreshAccessToken();
    }

    return oauth2Client;
  } catch (error) {
    console.error('❌ Error getting valid OAuth2 client:', error);
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
  getValidOAuth2Client,
};
