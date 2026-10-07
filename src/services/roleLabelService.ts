import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserRole } from '@/types';

// Tên hiển thị tùy chỉnh cho từng vai trò — lưu RIÊNG từng trường ở
// schoolSettings/{schoolId}.roleLabels (admin/hiệu trưởng của chính trường đó ghi
// được, xem firestore.rules). Đây chỉ đổi CHỮ hiển thị, không đụng tới quyền hạn
// thật của vai trò.
//
// Trước đây lưu chung ở config/roleLabels cho mọi trường (admin trường này đổi được
// tên vai trò của trường khác). config/ giờ chỉ super-admin ghi được; doc cũ chỉ còn
// được ĐỌC làm giá trị ban đầu cho trường chưa từng lưu tên riêng.
type Labels = Partial<Record<UserRole, string>>;

const SCHOOL_REF = (schoolId: string) => doc(db, 'schoolSettings', schoolId);
const LEGACY_REF = () => doc(db, 'config', 'roleLabels');

export const roleLabelService = {
  async getCustomLabels(schoolId: string): Promise<Labels> {
    try {
      const snap = await getDoc(SCHOOL_REF(schoolId));
      const own = snap.exists() ? snap.data().roleLabels : undefined;
      if (own && typeof own === 'object') return own as Labels;

      const legacy = await getDoc(LEGACY_REF());
      if (!legacy.exists()) return {};
      const { updatedAt, updatedBy, ...labels } = legacy.data();
      return labels as Labels;
    } catch (error) {
      console.error('Error loading role labels:', error);
      return {};
    }
  },

  // Ghi đè TOÀN BỘ map roleLabels (mergeFields) để xóa 1 tên chỉ cần bỏ khỏi map —
  // và lần lưu đầu tiên tự chép luôn các tên cũ từ config/roleLabels sang trường.
  async saveLabels(schoolId: string, labels: Labels, updatedBy: string): Promise<void> {
    await setDoc(
      SCHOOL_REF(schoolId),
      { schoolId, roleLabels: labels, updatedAt: Timestamp.now(), updatedBy },
      { mergeFields: ['schoolId', 'roleLabels', 'updatedAt', 'updatedBy'] }
    );
  },

  async setLabel(schoolId: string, role: UserRole, label: string, updatedBy: string): Promise<void> {
    const current = await this.getCustomLabels(schoolId);
    await this.saveLabels(schoolId, { ...current, [role]: label }, updatedBy);
  },

  async resetLabel(schoolId: string, role: UserRole, updatedBy: string): Promise<void> {
    const { [role]: _removed, ...rest } = await this.getCustomLabels(schoolId);
    await this.saveLabels(schoolId, rest, updatedBy);
  },
};
