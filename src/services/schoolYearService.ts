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
  setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SchoolYear } from '@/types';

export const schoolYearService = {
  // Get all school years
  async getAllSchoolYears(): Promise<SchoolYear[]> {
    try {
      const yearsRef = collection(db, 'schoolYears');
      const q = query(yearsRef, orderBy('startDate', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          isActive: data.isActive !== false,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error getting school years:', error);
      throw error;
    }
  },

  // Get active school year
  async getActiveSchoolYear(): Promise<SchoolYear | null> {
    try {
      const yearsRef = collection(db, 'schoolYears');
      const q = query(yearsRef, where('isActive', '==', true));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        startDate: data.startDate?.toDate() || new Date(),
        endDate: data.endDate?.toDate() || new Date(),
        isActive: data.isActive,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting active school year:', error);
      throw error;
    }
  },

  // Get school year by ID
  async getSchoolYear(id: string): Promise<SchoolYear | null> {
    try {
      const yearDoc = await getDoc(doc(db, 'schoolYears', id));
      if (!yearDoc.exists()) return null;

      const data = yearDoc.data();
      return {
        id: yearDoc.id,
        name: data.name,
        startDate: data.startDate?.toDate() || new Date(),
        endDate: data.endDate?.toDate() || new Date(),
        isActive: data.isActive !== false,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting school year:', error);
      throw error;
    }
  },

  // Create school year
  async createSchoolYear(data: {
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    activeSemester?: 'HK1' | 'HK2';
    createdBy: string;
  }): Promise<string> {
    try {
      // If this is set to active, deactivate others first
      if (data.isActive) {
        await this.deactivateAllSchoolYears();
      }

      const yearData: any = {
        name: data.name,
        startDate: Timestamp.fromDate(data.startDate),
        endDate: Timestamp.fromDate(data.endDate),
        isActive: data.isActive,
        createdBy: data.createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (data.activeSemester) {
        yearData.activeSemester = data.activeSemester;
      }

      const yearDoc = await addDoc(collection(db, 'schoolYears'), yearData);

      return yearDoc.id;
    } catch (error) {
      console.error('Error creating school year:', error);
      throw error;
    }
  },

  // Update school year
  async updateSchoolYear(id: string, data: {
    name?: string;
    startDate?: Date;
    endDate?: Date;
    isActive?: boolean;
    activeSemester?: 'HK1' | 'HK2';
  }): Promise<void> {
    try {
      // If setting to active, deactivate others first
      if (data.isActive === true) {
        await this.deactivateAllSchoolYears();
      }

      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.startDate !== undefined) updateData.startDate = Timestamp.fromDate(data.startDate);
      if (data.endDate !== undefined) updateData.endDate = Timestamp.fromDate(data.endDate);
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.activeSemester !== undefined) updateData.activeSemester = data.activeSemester;

      await updateDoc(doc(db, 'schoolYears', id), updateData);
    } catch (error) {
      console.error('Error updating school year:', error);
      throw error;
    }
  },

  // Delete school year
  async deleteSchoolYear(id: string): Promise<void> {
    try {
      // TODO: Check if school year has documents before deleting
      await deleteDoc(doc(db, 'schoolYears', id));
    } catch (error) {
      console.error('Error deleting school year:', error);
      throw error;
    }
  },

  // Deactivate all school years (helper)
  async deactivateAllSchoolYears(): Promise<void> {
    try {
      const yearsRef = collection(db, 'schoolYears');
      const q = query(yearsRef, where('isActive', '==', true));
      const snapshot = await getDocs(q);

      const updates = snapshot.docs.map(doc =>
        updateDoc(doc.ref, { isActive: false, updatedAt: Timestamp.now() })
      );

      await Promise.all(updates);
    } catch (error) {
      console.error('Error deactivating school years:', error);
      throw error;
    }
  },
};
