import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Thông tin RIÊNG TƯ của người dùng, tách khỏi users/{uid} (cả trường đọc được để
 * hiện tên/vai trò/tổ trong các ô chọn người) sang users/{uid}/private/info — chỉ
 * chính người đó và admin/BGH của trường đọc được (xem firestore.rules).
 */
export interface PrivateProfile {
  phoneNumber?: string;
  fcmToken?: string;
}

const REF = (uid: string) => doc(db, 'users', uid, 'private', 'info');

export const privateProfileService = {
  async get(uid: string): Promise<PrivateProfile> {
    const snap = await getDoc(REF(uid));
    if (!snap.exists()) return {};
    const data = snap.data();
    return { phoneNumber: data.phoneNumber, fcmToken: data.fcmToken };
  },

  async setPhoneNumber(uid: string, schoolId: string, phoneNumber: string): Promise<void> {
    await setDoc(REF(uid), { schoolId, phoneNumber, updatedAt: Timestamp.now() }, { merge: true });
  },

  async setFcmToken(uid: string, schoolId: string, token: string): Promise<void> {
    await setDoc(REF(uid), { schoolId, fcmToken: token, fcmTokenUpdatedAt: Timestamp.now() }, { merge: true });
  },
};
