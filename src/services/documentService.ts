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
          title: data.title || (data.files && data.files[0]?.name) || 'Untitled',
          // NEW: Multi-file support
          files: data.files || [],
          uploadedBy: data.uploadedBy,
          uploadedByName: data.uploadedByName,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          // Edit tracking
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy,
          editCount: data.editCount || 0,
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

  // Lấy gọn dữ liệu để dựng bảng ma trận nộp hồ sơ (ai đã nộp mục con nào, trạng thái gì).
  // Chỉ where theo categoryId (không orderBy) để KHÔNG cần composite index.
  async getSubmissionCells(categoryId: string): Promise<Array<{ uploadedBy: string; subCategoryId?: string; status: DocumentStatus }>> {
    try {
      const q = query(collection(db, 'documents'), where('categoryId', '==', categoryId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => {
        const data = d.data();
        return {
          uploadedBy: data.uploadedBy,
          subCategoryId: data.subCategoryId,
          status: (data.status || 'pending') as DocumentStatus,
        };
      });
    } catch (error) {
      console.error('Error getting submission cells:', error);
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
          title: data.title || (data.files && data.files[0]?.name) || 'Untitled',
          // NEW: Multi-file support
          files: data.files || [],
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
        title: data.title || (data.files && data.files[0]?.name) || 'Untitled',
        // NEW: Multi-file support
        files: data.files || [],
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
    // NEW: Multi-file support
    files?: Array<{
      name: string;
      size: number;
      mimeType: string;
      driveFileId: string;
      driveFileUrl: string;
    }>;
    // OLD: Single-file fields (backward compatibility)
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
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
        uploadedBy: data.uploadedBy,
        uploadedByName: data.uploadedByName,
        uploadedAt: Timestamp.now(),
        status: data.status || 'pending',
        isPublic: data.isPublic !== false,
      };

      // Add files array (NEW multi-file support) or fallback to old single-file fields
      if (data.files && Array.isArray(data.files) && data.files.length > 0) {
        console.log('✅ Using NEW multi-file structure:', data.files.length, 'files');
        documentData.files = data.files;
      } else if (data.fileName) {
        // Backward compatibility: convert old single-file to array format
        console.log('⚙️ Using OLD single-file structure (backward compatibility)');
        documentData.files = [{
          name: data.fileName,
          size: data.fileSize || 0,
          mimeType: data.mimeType || 'application/octet-stream',
          driveFileId: data.driveFileId || '',
          driveFileUrl: data.driveFileUrl || '',
        }];
      } else {
        // Default: empty array (should not happen in normal flow)
        console.warn('⚠️ No files provided in document data!', data);
        documentData.files = [];
      }

      // Only add optional fields if they have values
      if (data.subCategoryId) {
        documentData.subCategoryId = data.subCategoryId;
      }
      if (data.departmentId) {
        documentData.departmentId = data.departmentId;
      }

      console.log('💾 Saving to Firestore:', {
        ...documentData,
        files: documentData.files.map((f: any) => ({
          name: f.name,
          size: f.size,
          hasDriveId: !!f.driveFileId,
          hasDriveUrl: !!f.driveFileUrl,
        }))
      });

      const docRef = await addDoc(collection(db, 'documents'), documentData);

      console.log('✅ Document saved with ID:', docRef.id);

      // Verify by reading back
      const savedDoc = await getDoc(docRef);
      if (savedDoc.exists()) {
        const savedData = savedDoc.data();
        console.log('🔍 Verification - Document read back from Firestore:', {
          id: savedDoc.id,
          filesCount: savedData.files?.length || 0,
          files: savedData.files || []
        });
      }

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

      if (error instanceof Error) {
        const errMsg = error.message.toLowerCase();

        if (errMsg.includes('permission')) {
          throw new Error('Bạn không có quyền phê duyệt hồ sơ này.');
        } else if (errMsg.includes('not found') || errMsg.includes('no document')) {
          throw new Error('Không tìm thấy hồ sơ. Có thể đã bị xóa.');
        } else if (errMsg.includes('network')) {
          throw new Error('Lỗi kết nối mạng. Vui lòng thử lại.');
        }
      }

      throw new Error('Không thể phê duyệt hồ sơ. Vui lòng thử lại.');
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

      if (error instanceof Error) {
        const errMsg = error.message.toLowerCase();

        if (errMsg.includes('permission')) {
          throw new Error('Bạn không có quyền từ chối hồ sơ này.');
        } else if (errMsg.includes('not found') || errMsg.includes('no document')) {
          throw new Error('Không tìm thấy hồ sơ. Có thể đã bị xóa.');
        } else if (errMsg.includes('network')) {
          throw new Error('Lỗi kết nối mạng. Vui lòng thử lại.');
        }
      }

      throw new Error('Không thể từ chối hồ sơ. Vui lòng thử lại.');
    }
  },

  // Update document
  async updateDocument(
    id: string,
    data: {
      title?: string;
      files?: Array<{
        name: string;
        size: number;
        mimeType: string;
        driveFileId: string;
        driveFileUrl: string;
      }>;
      status?: DocumentStatus;
      updatedBy?: string;
      editCount?: number;
    }
  ): Promise<void> {
    try {
      console.log(`📝 Updating document ${id}:`, data);

      const updateData: Record<string, any> = {};

      if (data.title !== undefined) {
        updateData.title = data.title;
      }

      if (data.files !== undefined) {
        updateData.files = data.files;
      }

      if (data.status !== undefined) {
        updateData.status = data.status;
      }

      if (data.updatedBy !== undefined) {
        updateData.updatedBy = data.updatedBy;
        updateData.updatedAt = Timestamp.now();
      }

      if (data.editCount !== undefined) {
        updateData.editCount = data.editCount;
      }

      console.log(`✅ Update data prepared:`, updateData);

      await updateDoc(doc(db, 'documents', id), updateData);

      console.log(`✅ Document ${id} updated successfully`);
    } catch (error) {
      console.error(`❌ Error updating document ${id}:`, error);

      if (error instanceof Error) {
        const errMsg = error.message.toLowerCase();

        if (errMsg.includes('permission')) {
          throw new Error('Bạn không có quyền cập nhật hồ sơ này.');
        } else if (errMsg.includes('not found') || errMsg.includes('no document')) {
          throw new Error('Không tìm thấy hồ sơ để cập nhật.');
        } else if (errMsg.includes('network')) {
          throw new Error('Lỗi kết nối mạng. Vui lòng thử lại.');
        }
      }

      throw new Error('Không thể cập nhật hồ sơ. Vui lòng thử lại.');
    }
  },

  // Delete document
  async deleteDocument(id: string): Promise<void> {
    try {
      // TODO: Also delete from Google Drive
      await deleteDoc(doc(db, 'documents', id));
    } catch (error) {
      console.error('Error deleting document:', error);

      if (error instanceof Error) {
        const errMsg = error.message.toLowerCase();

        if (errMsg.includes('permission')) {
          throw new Error('Bạn không có quyền xóa hồ sơ này.');
        } else if (errMsg.includes('not found') || errMsg.includes('no document')) {
          throw new Error('Không tìm thấy hồ sơ để xóa.');
        } else if (errMsg.includes('network')) {
          throw new Error('Lỗi kết nối mạng. Vui lòng thử lại.');
        }
      }

      throw new Error('Không thể xóa hồ sơ. Vui lòng thử lại.');
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
