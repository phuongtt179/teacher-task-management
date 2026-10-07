import { useEffect, useState } from 'react';
import { getDocs, getCountFromServer } from 'firebase/firestore';
import { schoolSettingsService, useSchoolSettings } from '../../services/schoolSettingsService';
import { useToast } from '@/hooks/use-toast';
import { tenantCollection } from '../../lib/tenantQuery';
import { useAuth } from '../../hooks/useAuth';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { QuickAction } from '../../components/dashboard/QuickAction';
import { UsagePanel } from '../../components/dashboard/UsagePanel';
import { Users, Mail, ClipboardList, Award, FolderTree, Building2, Tag } from 'lucide-react';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const schoolSettings = useSchoolSettings(user?.schoolId);
  const [savingAi, setSavingAi] = useState(false);

  const handleToggleAi = async () => {
    if (!user?.schoolId || !schoolSettings) return;
    const next = !schoolSettings.aiForStaff;
    try {
      setSavingAi(true);
      await schoolSettingsService.setAiForStaff(user.schoolId, next, user.uid);
      toast({ title: next ? 'Đã bật Trợ lý AI cho giáo viên' : 'Đã tắt Trợ lý AI cho giáo viên (BGH vẫn dùng được)' });
    } catch (error) {
      console.error('Error saving AI setting:', error);
      toast({ title: 'Không lưu được cài đặt', variant: 'destructive' });
    } finally {
      setSavingAi(false);
    }
  };
  const [stats, setStats] = useState({
    totalUsers: 0,
    whitelistCount: 0,
    totalTasks: 0,
    activeUsers: 0,
  });

  useEffect(() => {
    if (!user?.schoolId) return;
    const schoolId = user.schoolId;

    const loadStats = async () => {
      try {
        // Whitelist và công việc chỉ cần ĐẾM — dùng đếm phía server (~1 lượt đọc/1000 bản
        // ghi) thay vì tải về toàn bộ (trước đây tải mọi việc của mọi năm học chỉ để lấy số lượng).
        const [usersSnap, whitelistCount, tasksCount] = await Promise.all([
          getDocs(tenantCollection('users', schoolId)),
          getCountFromServer(tenantCollection('whitelist', schoolId)),
          getCountFromServer(tenantCollection('tasks', schoolId)),
        ]);

        setStats({
          totalUsers: usersSnap.size,
          whitelistCount: whitelistCount.data().count,
          totalTasks: tasksCount.data().count,
          activeUsers: usersSnap.docs.filter(doc => {
            const lastActive = doc.data().lastActive?.toDate();
            if (!lastActive) return false;
            const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceActive < 7;
          }).length,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };

    loadStats();
  }, [user?.schoolId]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Admin</h2>
        <p className="text-gray-600">Tổng quan hệ thống</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Tổng người dùng"
          value={stats.totalUsers}
          icon={Users}
          color="blue"
          description="Đã đăng ký"
        />
        
        <StatsCard
          title="Whitelist"
          value={stats.whitelistCount}
          icon={Mail}
          color="green"
          description="Email được phép"
        />
        
        <StatsCard
          title="Tổng công việc"
          value={stats.totalTasks}
          icon={ClipboardList}
          color="purple"
          description="Đã tạo"
        />
        
        <StatsCard
          title="Hoạt động gần đây"
          value={stats.activeUsers}
          icon={Award}
          color="orange"
          description="7 ngày qua"
        />
      </div>

      {user?.schoolId && <UsagePanel schoolId={user.schoolId} />}

      {/* Công tắc Trợ lý AI cho giáo viên/nhân viên (BGH/admin luôn dùng được) */}
      <div className="bg-white rounded-lg border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Trợ lý AI cho giáo viên, nhân viên</h3>
          <p className="text-sm text-gray-600">
            {schoolSettings?.aiForStaff === false
              ? 'Đang TẮT — chỉ Ban giám hiệu và admin dùng được Trợ lý AI.'
              : 'Đang BẬT — mọi người trong trường đều dùng được Trợ lý AI.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleAi}
          disabled={!schoolSettings || savingAi}
          className={`px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 ${
            schoolSettings?.aiForStaff === false ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-600 hover:bg-gray-700'
          }`}
        >
          {savingAi ? 'Đang lưu...' : schoolSettings?.aiForStaff === false ? 'Bật cho giáo viên' : 'Tắt cho giáo viên'}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickAction
          label="Quản lý Whitelist"
          icon={Mail}
          path="/admin/whitelist"
          variant="default"
        />

        <QuickAction
          label="Quản lý người dùng"
          icon={Users}
          path="/admin/users"
        />

        <QuickAction
          label="Quản lý loại hồ sơ"
          icon={FolderTree}
          path="/documents/config"
        />

        {user?.isSuperAdmin && (
          <QuickAction
            label="Quản lý trường"
            icon={Building2}
            path="/super-admin/schools"
          />
        )}

        {user?.isSuperAdmin && (
          <QuickAction
            label="Quản lý gói"
            icon={Tag}
            path="/super-admin/plans"
          />
        )}
      </div>

      {/* System Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Thông tin hệ thống</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Phiên bản:</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Database:</span>
            <span className="font-medium">Firestore</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Trạng thái:</span>
            <span className="text-green-600 font-medium">● Hoạt động</span>
          </div>
        </div>
      </div>
    </div>
  );
};