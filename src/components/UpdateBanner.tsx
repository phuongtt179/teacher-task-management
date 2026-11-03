import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getAppUpdater } from '@/lib/appUpdate';
import { subscribeConfigChanges } from '@/services/schoolSettingsService';
import { useAuthStore } from '@/stores/authStore';

/**
 * Dòng "bấm để cập nhật" cuối màn hình, hiện khi:
 *  - đã có bản app mới nhưng chưa tự tải lại được vì người dùng đang dùng dở (lib/appUpdate.ts);
 *  - admin/BGH vừa sửa lịch nộp, danh mục... trong lúc app đang mở (subscribeConfigChanges).
 * Tải lại trang là đủ: lúc tải trang app so phiên bản cấu hình và xóa bộ nhớ tạm cũ.
 */
export function UpdateBanner() {
  const [appReady, setAppReady] = useState(() => getAppUpdater()?.isUpdateReady() ?? false);
  const [configChanged, setConfigChanged] = useState(false);
  const schoolId = useAuthStore((s) => s.user?.schoolId);

  useEffect(() => getAppUpdater()?.subscribe(setAppReady), []);

  useEffect(() => {
    if (!schoolId) return;
    const unsubscribe = subscribeConfigChanges(schoolId, () => setConfigChanged(true));
    return () => {
      unsubscribe();
      setConfigChanged(false); // đăng xuất / đổi tài khoản trên máy dùng chung
    };
  }, [schoolId]);

  if (!appReady && !configChanged) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white shadow-lg">
        <span>{appReady ? 'Đã có phiên bản mới của ứng dụng.' : 'Nhà trường vừa cập nhật lịch nộp hoặc danh mục hồ sơ.'}</span>
        <button
          type="button"
          onClick={() => (appReady ? getAppUpdater()?.reloadNow() : window.location.reload())}
          className="flex shrink-0 items-center gap-1 rounded-md bg-white px-3 py-1 font-medium text-indigo-700 hover:bg-indigo-50"
        >
          <RefreshCw className="h-4 w-4" />
          {appReady ? 'Tải lại' : 'Cập nhật'}
        </button>
      </div>
    </div>
  );
}
