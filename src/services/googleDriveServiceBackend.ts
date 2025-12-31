/**
 * Google Drive Service using Backend API with Service Account
 *
 * This service calls the backend Express server which uses Service Account
 * to upload files to the school's Shared Drive.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface UploadFileOptions {
  file: File;
  schoolYear: string;
  category: string;
  subCategory?: string;
  uploaderName?: string; // NEW: Teacher name for folder structure (optional for backward compatibility)
  documentTitle?: string; // NEW: Document title for folder structure (optional for backward compatibility)
  documentType?: string; // NEW: DocumentType name for folder structure
  onProgress?: (progress: number) => void;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

export class GoogleDriveServiceBackend {
  private static instance: GoogleDriveServiceBackend;

  private constructor() {}

  static getInstance(): GoogleDriveServiceBackend {
    if (!GoogleDriveServiceBackend.instance) {
      GoogleDriveServiceBackend.instance = new GoogleDriveServiceBackend();
    }
    return GoogleDriveServiceBackend.instance;
  }

  /**
   * Check if backend is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      return data.status === 'ok' && data.driveConfigured;
    } catch (error) {
      console.error('Error checking backend health:', error);
      return false;
    }
  }

  /**
   * Upload file to Google Drive via backend
   */
  async uploadFile(options: UploadFileOptions): Promise<DriveFile> {
    const { file, schoolYear, category, subCategory, uploaderName, documentTitle, documentType, onProgress } = options;

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('schoolYear', schoolYear);
      formData.append('category', category);
      if (subCategory) {
        formData.append('subCategory', subCategory);
      }
      if (uploaderName) {
        formData.append('uploaderName', uploaderName);
      }
      if (documentTitle) {
        formData.append('documentTitle', documentTitle);
      }
      if (documentType) {
        formData.append('documentType', documentType);
      }

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve(response.file);
            } else {
              reject(new Error(response.error || 'Upload failed'));
            }
          } catch (error) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.open('POST', `${API_BASE_URL}/upload`);
      xhr.send(formData);
    });
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Get file URL (already public from backend)
   */
  getFileUrl(file: DriveFile): string {
    return file.webViewLink;
  }
}

// Export singleton instance
export const googleDriveServiceBackend = GoogleDriveServiceBackend.getInstance();
