import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DocumentHistory, DocumentHistoryAction, DocumentFile, DocumentStatus } from '@/types';

class DocumentHistoryService {
  private collectionName = 'document_history';

  /**
   * Create a history record for document actions
   */
  async createHistory(data: {
    documentId: string;
    documentTitle: string;
    action: DocumentHistoryAction;
    performedBy: string;
    performedByName: string;
    details?: {
      addedFiles?: DocumentFile[];
      removedFiles?: DocumentFile[];
      oldTitle?: string;
      newTitle?: string;
      oldStatus?: DocumentStatus;
      newStatus?: DocumentStatus;
      note?: string;
    };
  }): Promise<string> {
    try {
      const historyRef = collection(db, this.collectionName);

      const historyData = {
        documentId: data.documentId,
        documentTitle: data.documentTitle,
        action: data.action,
        performedBy: data.performedBy,
        performedByName: data.performedByName,
        performedAt: serverTimestamp(),
        details: data.details || {},
      };

      const docRef = await addDoc(historyRef, historyData);

      console.log(`📝 Document history created: ${data.action} for document ${data.documentId}`);

      return docRef.id;
    } catch (error) {
      console.error('Error creating document history:', error);
      throw error;
    }
  }

  /**
   * Get history for a specific document
   */
  async getDocumentHistory(documentId: string): Promise<DocumentHistory[]> {
    try {
      const historyRef = collection(db, this.collectionName);
      const q = query(
        historyRef,
        where('documentId', '==', documentId),
        orderBy('performedAt', 'desc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        performedAt: (doc.data().performedAt as Timestamp).toDate(),
      })) as DocumentHistory[];
    } catch (error) {
      console.error('Error fetching document history:', error);
      throw error;
    }
  }

  /**
   * Get all history performed by a specific user
   */
  async getUserHistory(userId: string, limit: number = 50): Promise<DocumentHistory[]> {
    try {
      const historyRef = collection(db, this.collectionName);
      const q = query(
        historyRef,
        where('performedBy', '==', userId),
        orderBy('performedAt', 'desc')
      );

      const snapshot = await getDocs(q);

      const history = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        performedAt: (doc.data().performedAt as Timestamp).toDate(),
      })) as DocumentHistory[];

      return history.slice(0, limit);
    } catch (error) {
      console.error('Error fetching user history:', error);
      throw error;
    }
  }

  /**
   * Get all history (for admin audit)
   */
  async getAllHistory(limit: number = 100): Promise<DocumentHistory[]> {
    try {
      const historyRef = collection(db, this.collectionName);
      const q = query(historyRef, orderBy('performedAt', 'desc'));

      const snapshot = await getDocs(q);

      const history = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        performedAt: (doc.data().performedAt as Timestamp).toDate(),
      })) as DocumentHistory[];

      return history.slice(0, limit);
    } catch (error) {
      console.error('Error fetching all history:', error);
      throw error;
    }
  }
}

export const documentHistoryService = new DocumentHistoryService();
