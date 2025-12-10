import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { analyticsService, TeacherStats } from '../../services/analyticsService';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { QuickAction } from '../../components/dashboard/QuickAction';
import { 
  ClipboardList, 
  CheckCircle, 
  Clock,
  Award,
  Trophy,
  TrendingUp
} from 'lucide-react';

export const TeacherDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [schoolAverage, setSchoolAverage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const [teacherStats, schoolStats] = await Promise.all([
          analyticsService.getTeacherStats(user.uid),
          analyticsService.getSchoolStats(),
        ]);

        setStats(teacherStats);
        setSchoolAverage(schoolStats.averageScore);
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [user]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    );
  }

  if (!stats) return null;

  const performanceVsSchool = stats.scoredTasksCount > 0 
    ? stats.averageScore - schoolAverage 
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Giáo viên</h2>
        <p className="text-gray-600">Công việc và thành tích của bạn</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Công việc của tôi"
          value={stats.totalTasks}
          icon={ClipboardList}
          color="blue"
          description="Được giao"
        />
        
        <StatsCard
          title="Hoàn thành"
          value={stats.completedTasks}
          icon={CheckCircle}
          color="green"
          description={`${stats.completionRate}% tổng số`}
        />
        
        <StatsCard
          title="Đang làm"
          value={stats.pendingTasks}
          icon={Clock}
          color="orange"
          description="Cần hoàn thành"
        />
        
        <StatsCard
          title="Điểm trung bình"
          value={stats.scoredTasksCount > 0 ? stats.averageScore : '--'}
          icon={Award}
          color="purple"
          description="Thang điểm 10"
          trend={stats.scoredTasksCount > 0 ? {
            value: Math.abs(performanceVsSchool),
            isPositive: performanceVsSchool >= 0,
          } : undefined}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          label="Công việc của tôi"
          icon={ClipboardList}
          path="/teacher/my-tasks"
          variant="default"
        />
        
        <QuickAction
          label="Điểm của tôi"
          icon={Award}
          path="/teacher/my-scores"
        />
        
        <QuickAction
          label="Bảng xếp hạng"
          icon={Trophy}
          path="/rankings"
        />
      </div>

      {/* Motivational Card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            {stats.scoredTasksCount > 0 && performanceVsSchool >= 0 ? (
              <TrendingUp className="w-8 h-8" />
            ) : (
              <Trophy className="w-8 h-8" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">
              {stats.scoredTasksCount === 0 && 'Hãy bắt đầu thôi!'}
              {stats.scoredTasksCount > 0 && performanceVsSchool > 1 && 'Xuất sắc!'}
              {stats.scoredTasksCount > 0 && performanceVsSchool >= 0 && performanceVsSchool <= 1 && 'Tiếp tục phát huy!'}
              {stats.scoredTasksCount > 0 && performanceVsSchool < 0 && 'Cố gắng hơn nữa!'}
            </h3>
            <p className="text-indigo-100">
              {stats.scoredTasksCount === 0 && 
                'Hoàn thành công việc được giao để nhận điểm đánh giá và leo rank!'}
              {stats.scoredTasksCount > 0 && performanceVsSchool > 1 && 
                `Bạn đang dẫn đầu với ${stats.averageScore} điểm, cao hơn ${performanceVsSchool.toFixed(1)} điểm so với trung bình!`}
              {stats.scoredTasksCount > 0 && performanceVsSchool >= 0 && performanceVsSchool <= 1 && 
                `Bạn đang duy trì phong độ tốt với ${stats.averageScore} điểm!`}
              {stats.scoredTasksCount > 0 && performanceVsSchool < 0 && 
                `Hãy cố gắng để cải thiện điểm từ ${stats.averageScore} lên cao hơn!`}
            </p>
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tiến độ công việc</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Hoàn thành</span>
                <span className="font-medium text-green-600">{stats.completedTasks}/{stats.totalTasks}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Nộp đúng hạn</span>
                <span className="font-medium text-blue-600">{stats.onTimeRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${stats.onTimeRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">So sánh với trường</h3>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Điểm của bạn</p>
              <div className="flex items-center justify-center gap-3">
                <div className="text-center">
                  <p className="text-3xl font-bold text-indigo-600">{stats.averageScore}</p>
                  <p className="text-xs text-gray-500">Của bạn</p>
                </div>
                <div className="text-2xl text-gray-400">vs</div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-600">{schoolAverage}</p>
                  <p className="text-xs text-gray-500">TB trường</p>
                </div>
              </div>
              {stats.scoredTasksCount > 0 && (
                <p className={`text-sm mt-2 font-medium ${
                  performanceVsSchool > 0 ? 'text-green-600' : 
                  performanceVsSchool < 0 ? 'text-orange-600' : 'text-gray-600'
                }`}>
                  {performanceVsSchool > 0 && `+${performanceVsSchool.toFixed(1)} điểm`}
                  {performanceVsSchool < 0 && `${performanceVsSchool.toFixed(1)} điểm`}
                  {performanceVsSchool === 0 && 'Ngang bằng'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};