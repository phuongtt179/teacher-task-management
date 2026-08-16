import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, HardDrive, AlertTriangle } from 'lucide-react';

const GB = 1024 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < GB) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / GB).toFixed(2)}GB`;
}

interface UsageData {
  planName: string;
  aiUsed: number;
  aiLimit: number; // -1 = unlimited
  storageUsed: number;
  storageLimit: number; // -1 = unlimited
}

// Mức dùng gói hiện tại của trường — cho admin/BGH xem, KHÔNG chặn thao tác gì
// (giới hạn ở đây chỉ mang tính cảnh báo; việc chặn thật sự là super-admin tự
// khóa trường ở "Quản lý trường" khi cần).
export const UsagePanel = ({ schoolId }: { schoolId: string }) => {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
        if (!schoolSnap.exists()) { setData(null); return; }
        const school = schoolSnap.data();

        let plan: any = null;
        if (school.planId) {
          const planSnap = await getDoc(doc(db, 'plans', school.planId));
          if (planSnap.exists()) plan = planSnap.data();
        }

        const monthKey = new Date().toISOString().slice(0, 7);
        const usageSnap = await getDoc(doc(db, 'usageStats', `${schoolId}_${monthKey}`));

        setData({
          planName: plan?.name || 'Chưa gán gói',
          aiUsed: usageSnap.exists() ? (usageSnap.data().aiMessageCount || 0) : 0,
          aiLimit: plan?.aiMessageLimit ?? -1,
          storageUsed: school.storageUsedBytes || 0,
          storageLimit: plan?.storageLimitBytes ?? -1,
        });
      } catch (error) {
        console.error('Error loading usage panel:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  if (loading || !data) return null;

  const aiOver = data.aiLimit !== -1 && data.aiUsed > data.aiLimit;
  const storageOver = data.storageLimit !== -1 && data.storageUsed > data.storageLimit;
  const aiPct = data.aiLimit === -1 ? 0 : Math.min(100, (data.aiUsed / Math.max(data.aiLimit, 1)) * 100);
  const storagePct = data.storageLimit === -1 ? 0 : Math.min(100, (data.storageUsed / Math.max(data.storageLimit, 1)) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Mức dùng gói — {data.planName}</span>
          {(aiOver || storageOver) && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" /> Đã vượt hạn mức
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="flex items-center gap-1.5 text-gray-600"><MessageSquare className="w-4 h-4" /> Trợ lý AI (tháng này)</span>
            <span className={aiOver ? 'text-red-600 font-medium' : 'text-gray-700'}>
              {data.aiUsed}{data.aiLimit !== -1 ? ` / ${data.aiLimit} tin` : ' tin (không giới hạn)'}
            </span>
          </div>
          {data.aiLimit !== -1 && (
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${aiOver ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${aiPct}%` }} />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="flex items-center gap-1.5 text-gray-600"><HardDrive className="w-4 h-4" /> Hồ sơ điện tử</span>
            <span className={storageOver ? 'text-red-600 font-medium' : 'text-gray-700'}>
              {formatBytes(data.storageUsed)}{data.storageLimit !== -1 ? ` / ${formatBytes(data.storageLimit)}` : ' (không giới hạn)'}
            </span>
          </div>
          {data.storageLimit !== -1 && (
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${storageOver ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${storagePct}%` }} />
            </div>
          )}
        </div>

        {(aiOver || storageOver) && (
          <p className="text-xs text-gray-500">
            Trường đã dùng vượt hạn mức gói hiện tại. Liên hệ quản trị hệ thống để nâng gói, tránh bị tạm khóa truy cập.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
