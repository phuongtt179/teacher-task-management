import {
  collection,
  query,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { getDocs, getDoc } from '@/lib/readTracker';
import { db } from '@/lib/firebase';
import { tenantCollection } from '@/lib/tenantQuery';
import { DocumentType, UserRole } from '@/types';
import { invalidateCache } from '@/lib/localCache';

// Loại hồ sơ quyết định QUYỀN (ai được nộp/được xem) nên KHÔNG nhớ tạm qua lần tải trang
// (localStorage) — chỉ nhớ 5 phút trong phiên đang mở: trước đây mỗi lần bấm chọn 1 danh mục
// lại đọc lại từ máy chủ. Admin cấp quyền thì tối đa 5 phút (hoặc tải lại trang) là có hiệu lực;
// sửa loại hồ sơ trên chính máy này thì xóa bộ nhớ ngay.
const SESSION_TTL_MS = 5 * 60 * 1000;
const sessionCache = new Map<string, { at: number; value: Promise<unknown> }>();
function sessionCached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = sessionCache.get(key);
  if (hit && Date.now() - hit.at < SESSION_TTL_MS) return hit.value as Promise<T>;
  const value = load();
  sessionCache.set(key, { at: Date.now(), value });
  value.catch(() => sessionCache.delete(key));
  return value;
}
const clearSessionCache = () => sessionCache.clear();

export const documentTypeService = {
  // Get all document types
  async getAllDocumentTypes(schoolId: string): Promise<DocumentType[]> {
    try {
      const q = query(tenantCollection('documentTypes', schoolId), orderBy('order', 'asc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          schoolId: data.schoolId,
          name: data.name,
          description: data.description,
          icon: data.icon,
          viewPermissionType: data.viewPermissionType || 'everyone',
          allowedViewerUserIds: data.allowedViewerUserIds || [],
          allowedUploaderUserIds: data.allowedUploaderUserIds || [],
          viewMode: data.viewMode || 'personal',
          order: data.order || 0,
          isActive: data.isActive !== false, // Default to true for backward compatibility
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error getting document types:', error);
      throw error;
    }
  },

  // Get active document types only
  async getActiveDocumentTypes(schoolId: string): Promise<DocumentType[]> {
    return sessionCached(`active:${schoolId}`, () => this.loadActiveDocumentTypes(schoolId));
  },

  async loadActiveDocumentTypes(schoolId: string): Promise<DocumentType[]> {
    try {
      const q = query(
        tenantCollection('documentTypes', schoolId),
        where('isActive', '==', true),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          schoolId: data.schoolId,
          name: data.name,
          description: data.description,
          icon: data.icon,
          viewPermissionType: data.viewPermissionType || 'everyone',
          allowedViewerUserIds: data.allowedViewerUserIds || [],
          allowedUploaderUserIds: data.allowedUploaderUserIds || [],
          viewMode: data.viewMode || 'personal',
          order: data.order || 0,
          isActive: data.isActive !== false,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error getting active document types:', error);
      throw error;
    }
  },

  // Get document type by ID
  async getDocumentTypeById(id: string): Promise<DocumentType | null> {
    return sessionCached(`id:${id}`, () => this.loadDocumentTypeById(id));
  },

  async loadDocumentTypeById(id: string): Promise<DocumentType | null> {
    try {
      const docRef = doc(db, 'documentTypes', id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        schoolId: data.schoolId,
        name: data.name,
        description: data.description,
        icon: data.icon,
        viewPermissionType: data.viewPermissionType || 'everyone',
        allowedViewerUserIds: data.allowedViewerUserIds || [],
        allowedUploaderUserIds: data.allowedUploaderUserIds || [],
        viewMode: data.viewMode || 'personal',
        order: data.order || 0,
        isActive: data.isActive !== false,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting document type:', error);
      throw error;
    }
  },

  // Create document type
  async createDocumentType(schoolId: string, data: {
    name: string;
    description?: string;
    icon?: string;
    viewPermissionType: 'everyone' | 'specific_users';
    allowedViewerUserIds?: string[];
    allowedUploaderUserIds: string[];
    viewMode: 'personal' | 'shared';
    order: number;
    isActive?: boolean;
    createdBy: string;
  }): Promise<string> {
    try {
      // Validation: If viewPermissionType is 'specific_users', allowedViewerUserIds is required
      if (data.viewPermissionType === 'specific_users' && (!data.allowedViewerUserIds || data.allowedViewerUserIds.length === 0)) {
        throw new Error('allowedViewerUserIds is required when viewPermissionType is "specific_users"');
      }

      // Validation: allowedUploaderUserIds must be a subset of allowedViewerUserIds
      const viewerIds = data.viewPermissionType === 'everyone' ? [] : (data.allowedViewerUserIds || []);
      if (data.viewPermissionType === 'specific_users') {
        const invalidUploaders = data.allowedUploaderUserIds.filter(uid => !viewerIds.includes(uid));
        if (invalidUploaders.length > 0) {
          throw new Error('All uploaders must have view permission. Invalid uploaders: ' + invalidUploaders.join(', '));
        }
      }

      const typeDoc = await addDoc(collection(db, 'documentTypes'), {
        schoolId,
        name: data.name,
        description: data.description || '',
        icon: data.icon || '',
        viewPermissionType: data.viewPermissionType,
        allowedViewerUserIds: data.allowedViewerUserIds || [],
        allowedUploaderUserIds: data.allowedUploaderUserIds,
        viewMode: data.viewMode,
        order: data.order,
        isActive: data.isActive !== false, // Default to true
        createdBy: data.createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      invalidateCache('documentTypes');
      clearSessionCache();
      return typeDoc.id;
    } catch (error) {
      console.error('Error creating document type:', error);
      throw error;
    }
  },

  // Update document type
  async updateDocumentType(
    id: string,
    data: {
      name?: string;
      description?: string;
      icon?: string;
      viewPermissionType?: 'everyone' | 'specific_users';
      allowedViewerUserIds?: string[];
      allowedUploaderUserIds?: string[];
      viewMode?: 'personal' | 'shared';
      order?: number;
      isActive?: boolean;
    }
  ): Promise<void> {
    try {
      // Get current document type for validation
      const currentDoc = await this.getDocumentTypeById(id);
      if (!currentDoc) {
        throw new Error('Document type not found');
      }

      // Merge current data with updates for validation
      const viewPermissionType = data.viewPermissionType ?? currentDoc.viewPermissionType;
      const allowedViewerUserIds = data.allowedViewerUserIds ?? currentDoc.allowedViewerUserIds;
      const allowedUploaderUserIds = data.allowedUploaderUserIds ?? currentDoc.allowedUploaderUserIds;

      // Validation: If viewPermissionType is 'specific_users', allowedViewerUserIds is required
      if (viewPermissionType === 'specific_users' && (!allowedViewerUserIds || allowedViewerUserIds.length === 0)) {
        throw new Error('allowedViewerUserIds is required when viewPermissionType is "specific_users"');
      }

      // Validation: allowedUploaderUserIds must be a subset of allowedViewerUserIds
      if (viewPermissionType === 'specific_users') {
        const invalidUploaders = allowedUploaderUserIds.filter(uid => !allowedViewerUserIds!.includes(uid));
        if (invalidUploaders.length > 0) {
          throw new Error('All uploaders must have view permission. Invalid uploaders: ' + invalidUploaders.join(', '));
        }
      }

      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.viewPermissionType !== undefined) updateData.viewPermissionType = data.viewPermissionType;
      if (data.allowedViewerUserIds !== undefined) updateData.allowedViewerUserIds = data.allowedViewerUserIds;
      if (data.allowedUploaderUserIds !== undefined) updateData.allowedUploaderUserIds = data.allowedUploaderUserIds;
      if (data.viewMode !== undefined) updateData.viewMode = data.viewMode;
      if (data.order !== undefined) updateData.order = data.order;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await updateDoc(doc(db, 'documentTypes', id), updateData);
      invalidateCache('documentTypes');
      clearSessionCache();
    } catch (error) {
      console.error('Error updating document type:', error);
      throw error;
    }
  },

  // Delete document type
  async deleteDocumentType(id: string): Promise<void> {
    try {
      // Note: Should check if any categories are using this type before deleting
      await deleteDoc(doc(db, 'documentTypes', id));
      invalidateCache('documentTypes');
      clearSessionCache();
    } catch (error) {
      console.error('Error deleting document type:', error);
      throw error;
    }
  },

  // Initialize default document types if none exist
  async initializeDefaultTypes(schoolId: string, createdBy: string): Promise<void> {
    try {
      // Check if any types already exist
      const existing = await this.getAllDocumentTypes(schoolId);
      if (existing.length > 0) {
        console.log('Document types already exist, skipping initialization');
        return;
      }

      console.log('Initializing default document types...');

      // NOTE: Default types use viewPermissionType = 'everyone'
      // Admin can later edit these to use 'specific_users' if needed

      const defaultTypes = [
        {
          name: 'Hồ sơ Ban giám hiệu',
          description: 'Hồ sơ dành cho Hiệu trưởng và Hiệu phó',
          icon: 'building',
          viewPermissionType: 'everyone' as const,
          allowedUploaderUserIds: [], // Admin will set specific users later
          viewMode: 'shared' as const, // BGH documents are typically shared
          order: 1,
          isActive: true,
          createdBy,
        },
        {
          name: 'Hồ sơ Giáo viên',
          description: 'Hồ sơ cá nhân của giáo viên',
          icon: 'user-graduate',
          viewPermissionType: 'everyone' as const,
          allowedUploaderUserIds: [], // Admin will set specific users later
          viewMode: 'personal' as const, // Teacher documents are personal
          order: 2,
          isActive: true,
          createdBy,
        },
        {
          name: 'Hồ sơ Nhân viên',
          description: 'Hồ sơ cá nhân của nhân viên',
          icon: 'user',
          viewPermissionType: 'everyone' as const,
          allowedUploaderUserIds: [], // Admin will set specific users later
          viewMode: 'personal' as const, // Staff documents are personal
          order: 3,
          isActive: true,
          createdBy,
        },
        {
          name: 'Hồ sơ Tổ chức',
          description: 'Hồ sơ của các tổ chức (Nhà trường, Chi bộ, Chi đoàn, Đội)',
          icon: 'sitemap',
          viewPermissionType: 'everyone' as const,
          allowedUploaderUserIds: [], // Admin will set specific users later
          viewMode: 'shared' as const, // Organization documents are shared
          order: 4,
          isActive: true,
          createdBy,
        },
      ];

      // Create all default types
      for (const type of defaultTypes) {
        await this.createDocumentType(schoolId, type);
      }

      console.log('Default document types initialized successfully');
      console.log('NOTE: Please configure allowed uploaders for each document type in the admin panel');
      invalidateCache('documentTypes');
      clearSessionCache();
    } catch (error) {
      console.error('Error initializing default document types:', error);
      throw error;
    }
  },
};
