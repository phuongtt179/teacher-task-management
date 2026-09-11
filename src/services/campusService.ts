import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { tenantCollection } from '@/lib/tenantQuery';
import { Campus } from '@/types';

// Cơ sở/phân hiệu — chỉ là 1 field dữ liệu để chọn/lọc khi phân công hoặc xem
// thống kê, KHÔNG phải ranh giới phân quyền (hiệu phó/hiệu trưởng đều xem/phân
// công được cả 2 cơ sở). Số lượng cơ sở được tạo ở đây ("cấu hình"), chỉ
// admin/principal được tạo/sửa/xóa (xem firestore.rules).
export const campusService = {
  async getAllCampuses(schoolId: string): Promise<Campus[]> {
    try {
      const q = query(tenantCollection('campuses', schoolId), orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          schoolId: data.schoolId,
          name: data.name,
          vicePrincipalUid: data.vicePrincipalUid,
          order: data.order ?? 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Campus;
      });
    } catch (error) {
      console.error('Error getting campuses:', error);
      throw error;
    }
  },

  async getCampus(id: string): Promise<Campus | null> {
    try {
      const snap = await getDoc(doc(db, 'campuses', id));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        id: snap.id,
        schoolId: data.schoolId,
        name: data.name,
        vicePrincipalUid: data.vicePrincipalUid,
        order: data.order ?? 0,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Campus;
    } catch (error) {
      console.error('Error getting campus:', error);
      throw error;
    }
  },

  async createCampus(schoolId: string, data: { name: string; vicePrincipalUid?: string; order?: number }): Promise<string> {
    try {
      const campusData: Record<string, any> = {
        schoolId,
        name: data.name,
        order: data.order ?? 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      if (data.vicePrincipalUid) campusData.vicePrincipalUid = data.vicePrincipalUid;

      const ref = await addDoc(collection(db, 'campuses'), campusData);
      return ref.id;
    } catch (error) {
      console.error('Error creating campus:', error);
      throw error;
    }
  },

  async updateCampus(id: string, data: { name?: string; vicePrincipalUid?: string; order?: number }): Promise<void> {
    try {
      const updateData: Record<string, any> = { updatedAt: Timestamp.now() };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.vicePrincipalUid !== undefined) updateData.vicePrincipalUid = data.vicePrincipalUid;
      if (data.order !== undefined) updateData.order = data.order;

      await updateDoc(doc(db, 'campuses', id), updateData);
    } catch (error) {
      console.error('Error updating campus:', error);
      throw error;
    }
  },

  async deleteCampus(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'campuses', id));
    } catch (error) {
      console.error('Error deleting campus:', error);
      throw error;
    }
  },
};
