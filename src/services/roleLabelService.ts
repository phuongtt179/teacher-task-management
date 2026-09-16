import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserRole } from '@/types';

// Tên hiển thị tùy chỉnh cho từng vai trò — lưu chung 1 doc, KHÔNG theo trường
// (config/{configId} vốn đã là collection dùng chung toàn hệ thống, xem
// firestore.rules — chỉ admin/super-admin được ghi). Đây chỉ đổi CHỮ hiển thị,
// không đụng tới quyền hạn thật của vai trò.
const DOC_REF = () => doc(db, 'config', 'roleLabels');

export const roleLabelService = {
  async getCustomLabels(): Promise<Partial<Record<UserRole, string>>> {
    try {
      const snap = await getDoc(DOC_REF());
      if (!snap.exists()) return {};
      const { updatedAt, updatedBy, ...labels } = snap.data();
      return labels as Partial<Record<UserRole, string>>;
    } catch (error) {
      console.error('Error loading role labels:', error);
      return {};
    }
  },

  async setLabel(role: UserRole, label: string, updatedBy: string): Promise<void> {
    await setDoc(
      DOC_REF(),
      { [role]: label, updatedAt: Timestamp.now(), updatedBy },
      { merge: true }
    );
  },

  async resetLabel(role: UserRole, updatedBy: string): Promise<void> {
    const { deleteField } = await import('firebase/firestore');
    await setDoc(
      DOC_REF(),
      { [role]: deleteField(), updatedAt: Timestamp.now(), updatedBy },
      { merge: true }
    );
  },
};
