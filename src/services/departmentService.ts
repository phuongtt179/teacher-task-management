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
  deleteField,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Department } from '@/types';

export const departmentService = {
  // Get all departments
  async getAllDepartments(): Promise<Department[]> {
    try {
      const departmentsRef = collection(db, 'departments');
      const q = query(departmentsRef, orderBy('name', 'asc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          headTeacherId: data.headTeacherId,
          headTeacherName: data.headTeacherName,
          memberIds: data.memberIds || [],
          subCategoryId: data.subCategoryId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error getting departments:', error);
      throw error;
    }
  },

  // Get department by ID
  async getDepartment(id: string): Promise<Department | null> {
    try {
      const deptDoc = await getDoc(doc(db, 'departments', id));
      if (!deptDoc.exists()) return null;

      const data = deptDoc.data();
      return {
        id: deptDoc.id,
        name: data.name,
        headTeacherId: data.headTeacherId,
        headTeacherName: data.headTeacherName,
        memberIds: data.memberIds || [],
        subCategoryId: data.subCategoryId,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting department:', error);
      throw error;
    }
  },

  // Get department by user ID (find which department a teacher belongs to)
  async getDepartmentByUserId(userId: string): Promise<Department | null> {
    try {
      const departmentsRef = collection(db, 'departments');
      const q = query(
        departmentsRef,
        where('memberIds', 'array-contains', userId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        headTeacherId: data.headTeacherId,
        headTeacherName: data.headTeacherName,
        memberIds: data.memberIds || [],
        subCategoryId: data.subCategoryId,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting department by user:', error);
      throw error;
    }
  },

  // Create department
  async createDepartment(data: {
    name: string;
    headTeacherId?: string;
    headTeacherName?: string;
    memberIds?: string[];
    subCategoryId?: string;
  }): Promise<string> {
    try {
      const deptData: any = {
        name: data.name,
        memberIds: data.memberIds || [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only add optional fields if they have values
      if (data.headTeacherId) {
        deptData.headTeacherId = data.headTeacherId;
      }
      if (data.headTeacherName) {
        deptData.headTeacherName = data.headTeacherName;
      }
      if (data.subCategoryId) {
        deptData.subCategoryId = data.subCategoryId;
      }

      const deptDoc = await addDoc(collection(db, 'departments'), deptData);

      return deptDoc.id;
    } catch (error) {
      console.error('Error creating department:', error);
      throw error;
    }
  },

  // Update department
  async updateDepartment(id: string, data: {
    name?: string;
    headTeacherId?: string;
    headTeacherName?: string;
    memberIds?: string[];
    subCategoryId?: string;
  }): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.headTeacherId !== undefined) updateData.headTeacherId = data.headTeacherId;
      if (data.headTeacherName !== undefined) updateData.headTeacherName = data.headTeacherName;
      if (data.memberIds !== undefined) updateData.memberIds = data.memberIds;
      if (data.subCategoryId !== undefined) updateData.subCategoryId = data.subCategoryId;

      await updateDoc(doc(db, 'departments', id), updateData);
    } catch (error) {
      console.error('Error updating department:', error);
      throw error;
    }
  },

  // Add member to department
  async addMember(departmentId: string, userId: string): Promise<void> {
    try {
      const dept = await this.getDepartment(departmentId);
      if (!dept) throw new Error('Department not found');

      const memberIds = [...dept.memberIds];
      if (!memberIds.includes(userId)) {
        memberIds.push(userId);
        await this.updateDepartment(departmentId, { memberIds });
      }
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  },

  // Remove member from department
  async removeMember(departmentId: string, userId: string): Promise<void> {
    try {
      const dept = await this.getDepartment(departmentId);
      if (!dept) throw new Error('Department not found');

      const memberIds = dept.memberIds.filter(id => id !== userId);
      await this.updateDepartment(departmentId, { memberIds });
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  },

  // Delete department
  async deleteDepartment(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'departments', id));
    } catch (error) {
      console.error('Error deleting department:', error);
      throw error;
    }
  },

  // Check if user is department head
  async isUserDepartmentHead(userId: string): Promise<boolean> {
    try {
      const departmentsRef = collection(db, 'departments');
      const q = query(
        departmentsRef,
        where('headTeacherId', '==', userId)
      );
      const snapshot = await getDocs(q);

      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking if user is department head:', error);
      return false;
    }
  },

  // Clear department head (remove headTeacherId and headTeacherName)
  async clearDepartmentHead(departmentId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'departments', departmentId), {
        headTeacherId: deleteField(),
        headTeacherName: deleteField(),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error clearing department head:', error);
      throw error;
    }
  },

  // Set department head
  async setDepartmentHead(departmentId: string, userId: string, userName: string): Promise<void> {
    try {
      // First check if this department already has a different head
      const dept = await this.getDepartment(departmentId);
      if (dept?.headTeacherId && dept.headTeacherId !== userId) {
        throw new Error(`Tổ "${dept.name}" đã có tổ trưởng: ${dept.headTeacherName}. Vui lòng xóa tổ trưởng hiện tại trước.`);
      }

      await updateDoc(doc(db, 'departments', departmentId), {
        headTeacherId: userId,
        headTeacherName: userName,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error setting department head:', error);
      throw error;
    }
  },
};
