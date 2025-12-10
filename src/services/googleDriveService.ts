/* eslint-disable @typescript-eslint/no-explicit-any */
import { gapi } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

interface UploadFileOptions {
  file: File;
  folderId?: string;
  onProgress?: (progress: number) => void;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink?: string;
}

export class GoogleDriveService {
  private static instance: GoogleDriveService;
  private initialized = false;
  private accessToken: string | null = null;

  private constructor() {}

  static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  /**
   * Initialize Google API client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      gapi.load('client:auth2', async () => {
        try {
          await gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES,
          });

          this.initialized = true;
          console.log('Google Drive API initialized');
          resolve();
        } catch (error) {
          console.error('Error initializing Google Drive API:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Sign in to Google
   */
  async signIn(): Promise<void> {
    await this.initialize();

    const authInstance = gapi.auth2.getAuthInstance();
    if (authInstance.isSignedIn.get()) {
      this.accessToken = authInstance.currentUser.get().getAuthResponse().access_token;
      return;
    }

    try {
      await authInstance.signIn();
      this.accessToken = authInstance.currentUser.get().getAuthResponse().access_token;
      console.log('Signed in to Google Drive');
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  /**
   * Sign out from Google
   */
  async signOut(): Promise<void> {
    const authInstance = gapi.auth2.getAuthInstance();
    if (authInstance) {
      await authInstance.signOut();
      this.accessToken = null;
      console.log('Signed out from Google Drive');
    }
  }

  /**
   * Check if user is signed in
   */
  isSignedIn(): boolean {
    const authInstance = gapi.auth2.getAuthInstance();
    return authInstance ? authInstance.isSignedIn.get() : false;
  }

  /**
   * Get or create a folder by name
   */
  async getOrCreateFolder(folderName: string, parentFolderId?: string): Promise<string> {
    await this.ensureSignedIn();

    try {
      // Check if folder exists
      let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
      }

      const response = await gapi.client.drive.files.list({
        q: query,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id!;
      }

      // Create folder if it doesn't exist
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : [],
      };

      const folder = await gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id',
      });

      return folder.result.id!;
    } catch (error) {
      console.error('Error getting/creating folder:', error);
      throw error;
    }
  }

  /**
   * Upload file to Google Drive
   */
  async uploadFile(options: UploadFileOptions): Promise<GoogleDriveFile> {
    await this.ensureSignedIn();

    const { file, folderId, onProgress } = options;

    try {
      // Create file metadata
      const metadata = {
        name: file.name,
        mimeType: file.type,
        parents: folderId ? [folderId] : [],
      };

      // Create form data
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      // Upload using XMLHttpRequest for progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink');
        xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(form);
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.ensureSignedIn();

    try {
      await gapi.client.drive.files.delete({
        fileId: fileId,
      });
      console.log('File deleted:', fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<GoogleDriveFile> {
    await this.ensureSignedIn();

    try {
      const response = await gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink',
      });

      return response.result as GoogleDriveFile;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Make file public and get shareable link
   */
  async makeFilePublic(fileId: string): Promise<string> {
    await this.ensureSignedIn();

    try {
      // Set file permission to anyone with link can view
      await gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Get the web view link
      const file = await this.getFileMetadata(fileId);
      return file.webViewLink;
    } catch (error) {
      console.error('Error making file public:', error);
      throw error;
    }
  }

  /**
   * Ensure user is signed in
   */
  private async ensureSignedIn(): Promise<void> {
    if (!this.isSignedIn()) {
      await this.signIn();
    }
  }
}

// Export singleton instance
export const googleDriveService = GoogleDriveService.getInstance();
