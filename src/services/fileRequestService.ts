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
import { FileRequest, FileRequestType, FileRequestStatus } from '@/types';

export const fileRequestService = {
  // Get all requests (with filters)
  async getRequests(filters?: {
    requestedBy?: string;
    departmentId?: string;
    status?: FileRequestStatus;
  }): Promise<FileRequest[]> {
    try {
      const requestsRef = collection(db, 'fileRequests');
      const constraints: any[] = [orderBy('requestedAt', 'desc')];

      if (filters?.requestedBy) {
        constraints.unshift(where('requestedBy', '==', filters.requestedBy));
      }
      if (filters?.status) {
        constraints.unshift(where('status', '==', filters.status));
      }

      const q = query(requestsRef, ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          documentId: data.documentId,
          documentName: data.documentName,
          requestType: data.requestType,
          requestedBy: data.requestedBy,
          requestedByName: data.requestedByName,
          requestedAt: data.requestedAt?.toDate() || new Date(),
          reason: data.reason,
          status: data.status || 'pending',
          reviewedBy: data.reviewedBy,
          reviewedByName: data.reviewedByName,
          reviewedAt: data.reviewedAt?.toDate(),
          reviewNote: data.reviewNote,
          newFileName: data.newFileName,
          newFileId: data.newFileId,
          newFileUrl: data.newFileUrl,
        };
      });
    } catch (error) {
      console.error('Error getting requests:', error);
      throw error;
    }
  },

  // Get pending requests by department
  async getPendingRequestsByDepartment(departmentId: string): Promise<FileRequest[]> {
    try {
      // First get all pending requests
      const requestsRef = collection(db, 'fileRequests');
      const q = query(
        requestsRef,
        where('status', '==', 'pending'),
        orderBy('requestedAt', 'desc')
      );
      const snapshot = await getDocs(q);

      // Then filter by checking if document belongs to department
      const requests: FileRequest[] = [];
      for (const requestDoc of snapshot.docs) {
        const data = requestDoc.data();

        // Check if document belongs to department
        const docRef = doc(db, 'documents', data.documentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().departmentId === departmentId) {
          requests.push({
            id: requestDoc.id,
            documentId: data.documentId,
            documentName: data.documentName,
            requestType: data.requestType,
            requestedBy: data.requestedBy,
            requestedByName: data.requestedByName,
            requestedAt: data.requestedAt?.toDate() || new Date(),
            reason: data.reason,
            status: data.status,
            reviewedBy: data.reviewedBy,
            reviewedByName: data.reviewedByName,
            reviewedAt: data.reviewedAt?.toDate(),
            reviewNote: data.reviewNote,
            newFileName: data.newFileName,
            newFileId: data.newFileId,
            newFileUrl: data.newFileUrl,
          });
        }
      }

      return requests;
    } catch (error) {
      console.error('Error getting pending requests by department:', error);
      throw error;
    }
  },

  // Get request by ID
  async getRequest(id: string): Promise<FileRequest | null> {
    try {
      const requestDoc = await getDoc(doc(db, 'fileRequests', id));
      if (!requestDoc.exists()) return null;

      const data = requestDoc.data();
      return {
        id: requestDoc.id,
        documentId: data.documentId,
        documentName: data.documentName,
        requestType: data.requestType,
        requestedBy: data.requestedBy,
        requestedByName: data.requestedByName,
        requestedAt: data.requestedAt?.toDate() || new Date(),
        reason: data.reason,
        status: data.status || 'pending',
        reviewedBy: data.reviewedBy,
        reviewedByName: data.reviewedByName,
        reviewedAt: data.reviewedAt?.toDate(),
        reviewNote: data.reviewNote,
        newFileName: data.newFileName,
        newFileId: data.newFileId,
        newFileUrl: data.newFileUrl,
      };
    } catch (error) {
      console.error('Error getting request:', error);
      throw error;
    }
  },

  // Create delete request
  async createDeleteRequest(data: {
    documentId: string;
    documentName: string;
    requestedBy: string;
    requestedByName: string;
    reason: string;
  }): Promise<string> {
    try {
      const requestDoc = await addDoc(collection(db, 'fileRequests'), {
        documentId: data.documentId,
        documentName: data.documentName,
        requestType: 'delete' as FileRequestType,
        requestedBy: data.requestedBy,
        requestedByName: data.requestedByName,
        requestedAt: Timestamp.now(),
        reason: data.reason,
        status: 'pending' as FileRequestStatus,
      });

      return requestDoc.id;
    } catch (error) {
      console.error('Error creating delete request:', error);
      throw error;
    }
  },

  // Create edit request
  async createEditRequest(data: {
    documentId: string;
    documentName: string;
    requestedBy: string;
    requestedByName: string;
    reason: string;
    newFileName?: string;
    newFileId?: string;
    newFileUrl?: string;
  }): Promise<string> {
    try {
      const requestDoc = await addDoc(collection(db, 'fileRequests'), {
        documentId: data.documentId,
        documentName: data.documentName,
        requestType: 'edit' as FileRequestType,
        requestedBy: data.requestedBy,
        requestedByName: data.requestedByName,
        requestedAt: Timestamp.now(),
        reason: data.reason,
        status: 'pending' as FileRequestStatus,
        newFileName: data.newFileName,
        newFileId: data.newFileId,
        newFileUrl: data.newFileUrl,
      });

      return requestDoc.id;
    } catch (error) {
      console.error('Error creating edit request:', error);
      throw error;
    }
  },

  // Approve request
  async approveRequest(requestId: string, reviewedBy: string, reviewedByName: string, reviewNote?: string): Promise<void> {
    try {
      // Get the request first to know what to do
      const requestRef = doc(db, 'fileRequests', requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        throw new Error('Request not found');
      }

      const request = requestSnap.data();

      // Update request status
      await updateDoc(requestRef, {
        status: 'approved',
        reviewedBy,
        reviewedByName,
        reviewedAt: Timestamp.now(),
        reviewNote: reviewNote || '',
      });

      // Execute the actual operation
      if (request.requestType === 'delete') {
        // Delete the document from Firestore
        await deleteDoc(doc(db, 'documents', request.documentId));

        // TODO: Also delete from Google Drive
        // This would require calling the backend service to delete the file
        // await googleDriveServiceBackend.deleteFile(documentData.driveFileId);
      } else if (request.requestType === 'edit') {
        // Update the document
        const updateData: any = {};
        if (request.newFileName) updateData.fileName = request.newFileName;
        if (request.newFileId) updateData.driveFileId = request.newFileId;
        if (request.newFileUrl) updateData.driveFileUrl = request.newFileUrl;

        if (Object.keys(updateData).length > 0) {
          await updateDoc(doc(db, 'documents', request.documentId), updateData);
        }
      }
    } catch (error) {
      console.error('Error approving request:', error);
      throw error;
    }
  },

  // Reject request
  async rejectRequest(requestId: string, reviewedBy: string, reviewedByName: string, reviewNote: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'fileRequests', requestId), {
        status: 'rejected',
        reviewedBy,
        reviewedByName,
        reviewedAt: Timestamp.now(),
        reviewNote,
      });
    } catch (error) {
      console.error('Error rejecting request:', error);
      throw error;
    }
  },

  // Delete request
  async deleteRequest(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fileRequests', id));
    } catch (error) {
      console.error('Error deleting request:', error);
      throw error;
    }
  },
};
