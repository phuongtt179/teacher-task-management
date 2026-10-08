import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { cached, invalidateCache } from '../lib/localCache';
import type { UserRole } from '../types';

/**
 * Cấu hình RIÊNG của từng trường, lưu ở schoolSettings/{schoolId} (không dùng chung
 * giữa các trường như config/roleLabels).
 *
 * aiForStaff: giáo viên/nhân viên (không phải BGH) có được dùng Trợ lý AI không.
 * Mặc định BẬT (giữ nguyên như trước khi có công tắc). BGH và admin luôn dùng được.
 */
export interface SchoolSettings {
  aiForStaff: boolean;
}

const DEFAULTS: SchoolSettings = { aiForStaff: true };

/** Vai trò luôn được dùng Trợ lý AI, bất kể công tắc. */
export const AI_ALWAYS_ALLOWED_ROLES: UserRole[] = ['admin', 'principal', 'vice_principal', 'youth_leader'];

// Đọc 1 lần mỗi phiên cho mỗi trường (Header hiện trên mọi trang — không đọc lại mỗi lần chuyển trang).
const cache = new Map<string, Promise<SchoolSettings>>();
const listeners = new Set<() => void>();

export const schoolSettingsService = {
  get(schoolId: string): Promise<SchoolSettings> {
    let hit = cache.get(schoolId);
    if (!hit) {
      // Nhớ tạm thêm 3 giờ trên máy (lib/localCache.ts) — tải lại trang không đọc lại.
      // Công tắc AI vẫn được server kiểm tra ở mỗi lần gọi nên chậm cập nhật ở đây chỉ ảnh hưởng nút hiển thị.
      hit = cached(`schoolSettings:${schoolId}:doc`, async () => {
        const snap = await getDoc(doc(db, 'schoolSettings', schoolId));
        return { ...DEFAULTS, ...(snap.exists() ? (snap.data() as Partial<SchoolSettings>) : {}) };
      })
        .catch((error) => {
          console.error('Error loading school settings:', error);
          cache.delete(schoolId);
          return DEFAULTS;
        });
      cache.set(schoolId, hit);
    }
    return hit;
  },

  async setAiForStaff(schoolId: string, enabled: boolean, updatedBy: string): Promise<void> {
    await setDoc(
      doc(db, 'schoolSettings', schoolId),
      { schoolId, aiForStaff: enabled, updatedBy, updatedAt: Timestamp.now() },
      { merge: true }
    );
    invalidateCache('schoolSettings');
    cache.set(schoolId, Promise.resolve({ ...(await this.get(schoolId)), aiForStaff: enabled }));
    listeners.forEach((notify) => notify());
  },
};

export const canUseAi = (role: UserRole | undefined, settings: SchoolSettings | null) =>
  !!role && (AI_ALWAYS_ALLOWED_ROLES.includes(role) || settings?.aiForStaff !== false);

/** Cấu hình trường hiện tại (null khi đang tải); tự cập nhật khi admin đổi công tắc. */
export function useSchoolSettings(schoolId: string | null | undefined): SchoolSettings | null {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  useEffect(() => {
    if (!schoolId) return;
    let active = true;
    const load = () => schoolSettingsService.get(schoolId).then((s) => { if (active) setSettings(s); });
    load();
    listeners.add(load);
    return () => { active = false; listeners.delete(load); };
  }, [schoolId]);
  return settings;
}
