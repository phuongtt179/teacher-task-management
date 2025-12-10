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
  and,
  or,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Document, DocumentStatus } from '@/types';

export const documentService = {
  // Get all documents (with filters)
  async getDocuments(filters?: {
    schoolYearId?: string;
    categoryId?: string;
    subCategoryId?: string;
    departmentId?: string;
    status?: DocumentStatus;
    uploadedBy?: string;
  }): Promise<Document[]> {
    try {
      const documentsRef = collection(db, 'documents');
      const constraints: any[] = [];

      if (filters?.schoolYearId) {
        constraints.push(where('schoolYearId', '==', filters.schoolYearId));
      }
      if (filters?.categoryId) {
        constraints.push(where('categoryId', '==', filters.categoryId));
      }
      if (filters?.subCategoryId) {
        constraints.push(where('subCategoryId', '==', filters.subCategoryId));
      }
      if (filters?.departmentId) {
        constraints.push(where('departmentId', '==', filters.departmentId));
      }
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters?.uploadedBy) {
        constraints.push(where('uploadedBy', '==', filters.uploadedBy));
      }

      // Only add orderBy if not too many filters (to avoid index requirement)
      // When querying by specific teacher, we don't need orderBy as there won't be many docs
      if (!filters?.uploadedBy) {
        constraints.push(orderBy('uploadedAt', 'desc'));
      }

      const q = query(documentsRef, ...constraints);
      const snapshot = await getDocs(q);

      // If we didn't orderBy in query, sort in memory
      let docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          schoolYearId: data.schoolYearId,
          categoryId: data.categoryId,
          subCategoryId: data.subCategoryId,
          title: data.title || data.fileName,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          driveFileId: data.driveFileId,
          driveFileUrl: data.driveFileUrl,
          thumbnailUrl: data.thumbnailUrl,
          uploadedBy: data.uploadedBy,
          uploadedByName: data.uploadedByName,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          status: data.status || 'pending',
          approvedBy: data.approvedBy,
          approvedByName: data.approvedByName,
          approvedAt: data.approvedAt?.toDate(),
          rejectionReason: data.rejectionReason,
          departmentId: data.departmentId,
          isPublic: data.isPublic !== false,
        };
      });

      // Sort by uploadedAt desc if we have uploadedBy filter
      if (filters?.uploadedBy) {
        docs = docs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
      }

      return docs;
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  },

  // Get pending documents for approval (by department)
  async getPendingDocumentsByDepartment(departmentId: string): Promise<Document[]> {
    try {
      const documentsRef = collection(db, 'documents');
      const q = query(
        documentsRef,
        where('departmentId', '==', departmentId),
        where('status', '==', 'pending'),
        orderBy('uploadedAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          schoolYearId: data.schoolYearId,
          categoryId: data.categoryId,
          subCategoryId: data.subCategoryId,
          title: data.title || data.fileName,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          driveFileId: data.driveFileId,
          driveFileUrl: data.driveFileUrl,
          thumbnailUrl: data.thumbnailUrl,
          uploadedBy: data.uploadedBy,
          uploadedByName: data.uploadedByName,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          status: data.status,
          approvedBy: data.approvedBy,
          approvedByName: data.approvedByName,
          approvedAt: data.approvedAt?.toDate(),
          rejectionReason: data.rejectionReason,
          departmentId: data.departmentId,
          isPublic: data.isPublic !== false,
        };
      });
    } catch (error) {
      console.error('Error getting pending documents:', error);
      throw error;
    }
  },

  // Get document by ID
  async getDocument(id: string): Promise<Document | null> {
    try {
      const docRef = await getDoc(doc(db, 'documents', id));
      if (!docRef.exists()) return null;

      const data = docRef.data();
      return {
        id: docRef.id,
        schoolYearId: data.schoolYearId,
        categoryId: data.categoryId,
        subCategoryId: data.subCategoryId,
        title: data.title || data.fileName,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        driveFileId: data.driveFileId,
        driveFileUrl: data.driveFileUrl,
        thumbnailUrl: data.thumbnailUrl,
        uploadedBy: data.uploadedBy,
        uploadedByName: data.uploadedByName,
        uploadedAt: data.uploadedAt?.toDate() || new Date(),
        status: data.status || 'pending',
        approvedBy: data.approvedBy,
        approvedByName: data.approvedByName,
        approvedAt: data.approvedAt?.toDate(),
        rejectionReason: data.rejectionReason,
        departmentId: data.departmentId,
        isPublic: data.isPublic !== false,
      };
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  },

  // Create document (upload)
  async createDocument(data: {
    schoolYearId: string;
    categoryId: string;
    subCategoryId?: string;
    title: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    driveFileId?: string;
    driveFileUrl?: string;
    thumbnailUrl?: string;
    uploadedBy: string;
    uploadedByName: string;
    departmentId?: string;
    isPublic?: boolean;
    status?: DocumentStatus; // Admin/VP can upload as 'approved' directly
  }): Promise<string> {
    try {
      // Build document data, excluding undefined fields (Firestore doesn't accept undefined)
      const documentData: Record<string, any> = {
        schoolYearId: data.schoolYearId,
        categoryId: data.categoryId,
        title: data.title,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        uploadedBy: data.uploadedBy,
        uploadedByName: data.uploadedByName,
        uploadedAt: Timestamp.now(),
        status: data.status || 'pending',
        isPublic: data.isPublic !== false,
      };

      // Only add optional fields if they have values
      if (data.subCategoryId) {
        documentData.subCategoryId = data.subCategoryId;
      }
      if (data.driveFileId) {
        documentData.driveFileId = data.driveFileId;
      }
      if (data.driveFileUrl) {
        documentData.driveFileUrl = data.driveFileUrl;
      }
      if (data.thumbnailUrl) {
        documentData.thumbnailUrl = data.thumbnailUrl;
      }
      if (data.departmentId) {
        documentData.departmentId = data.departmentId;
      }

      const docRef = await addDoc(collection(db, 'documents'), documentData);

      return docRef.id;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  },

  // Approve document
  async approveDocument(documentId: string, approvedBy: string, approvedByName: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'documents', documentId), {
        status: 'approved',
        approvedBy,
        approvedByName,
        approvedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error approving document:', error);
      throw error;
    }
  },

  // Reject document
  async rejectDocument(documentId: string, rejectedBy: string, rejectedByName: string, reason: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'documents', documentId), {
        status: 'rejected',
        approvedBy: rejectedBy,
        approvedByName: rejectedByName,
        approvedAt: Timestamp.now(),
        rejectionReason: reason,
      });
    } catch (error) {
      console.error('Error rejecting document:', error);
      throw error;
    }
  },

  // Delete document
  async deleteDocument(id: string): Promise<void> {
    try {
      // TODO: Also delete from Google Drive
      await deleteDoc(doc(db, 'documents', id));
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  // Get document count by status
  async getDocumentStats(departmentId?: string) {
    try {
      const documentsRef = collection(db, 'documents');
      let q;

      if (departmentId) {
        q = query(documentsRef, where('departmentId', '==', departmentId));
      } else {
        q = query(documentsRef);
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => doc.data());

      return {
        total: docs.length,
        pending: docs.filter(d => d.status === 'pending').length,
        approved: docs.filter(d => d.status === 'approved').length,
        rejected: docs.filter(d => d.status === 'rejected').length,
      };
    } catch (error) {
      console.error('Error getting document stats:', error);
      throw error;
    }
  },
};
