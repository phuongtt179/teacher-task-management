import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getAppUpdater } from '@/lib/appUpdate';

/**
 * Dòng "Có bản cập nhật" — chỉ hiện khi đã có bản app mới nhưng chưa tự tải lại được
 * vì người dùng đang dùng dở (xem lib/appUpdate.ts).
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(() => getAppUpdater()?.isUpdateReady() ?? false);

  useEffect(() => getAppUpdater()?.subscribe(setReady), []);

  if (!ready) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white shadow-lg">
        <span>Đã có phiên bản mới của ứng dụng.</span>
        <button
          type="button"
          onClick={() => getAppUpdater()?.reloadNow()}
          className="flex items-center gap-1 rounded-md bg-white px-3 py-1 font-medium text-indigo-700 hover:bg-indigo-50"
        >
          <RefreshCw className="h-4 w-4" />
          Tải lại
        </button>
      </div>
    </div>
  );
}
