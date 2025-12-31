import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DocumentType, UserRole } from '@/types';

export const documentTypeService = {
  // Get all document types
  async getAllDocumentTypes(): Promise<DocumentType[]> {
    try {
      const typesRef = collection(db, 'documentTypes');
      const q = query(typesRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
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
  async getActiveDocumentTypes(): Promise<DocumentType[]> {
    try {
      const typesRef = collection(db, 'documentTypes');
      const q = query(
        typesRef,
        where('isActive', '==', true),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
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
    try {
      const docRef = doc(db, 'documentTypes', id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
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
  async createDocumentType(data: {
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
    } catch (error) {
      console.error('Error deleting document type:', error);
      throw error;
    }
  },

  // Initialize default document types if none exist
  async initializeDefaultTypes(createdBy: string): Promise<void> {
    try {
      // Check if any types already exist
      const existing = await this.getAllDocumentTypes();
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
        await this.createDocumentType(type);
      }

      console.log('Default document types initialized successfully');
      console.log('NOTE: Please configure allowed uploaders for each document type in the admin panel');
    } catch (error) {
      console.error('Error initializing default document types:', error);
      throw error;
    }
  },
};
