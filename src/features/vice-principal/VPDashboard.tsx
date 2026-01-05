import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { analyticsService } from '../../services/analyticsService';
import { schoolYearService } from '../../services/schoolYearService';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { QuickAction } from '../../components/dashboard/QuickAction';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SemesterFilter, SEMESTER_FILTER_LABELS } from '../../utils/semesterUtils';
import { SchoolYear } from '../../types';
import {
  ClipboardList,
  Users,
  CheckCircle,
  Clock,
  Plus,
  BarChart3,
  Award,
  Calendar
} from 'lucide-react';

export const VPDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<SemesterFilter>('all');

  // Load school years and set initial filters
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);

        // Load school years and active year
        const [years, activeYear] = await Promise.all([
          schoolYearService.getAllSchoolYears(),
          schoolYearService.getActiveSchoolYear(),
        ]);

        setSchoolYears(years);

        // Set initial filters based on active year
        let initialSchoolYearId = 'all';
        let initialSemester: SemesterFilter = 'all';

        if (activeYear) {
          initialSchoolYearId = activeYear.id;
          if (activeYear.activeSemester) {
            initialSemester = activeYear.activeSemester as SemesterFilter;
          }
        }

        setSelectedSchoolYearId(initialSchoolYearId);
        setSelectedSemester(initialSemester);

        // Load stats with initial filters
        const semesterParam = (initialSemester === 'all' || initialSemester === 'unassigned') ? 'all' : initialSemester;
        const data = await analyticsService.getVPStats(user.uid, semesterParam, initialSchoolYearId);
        setStats(data);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Reload stats when filters change (but not on initial load)
  useEffect(() => {
    // Skip if initial load hasn't completed (selectedSchoolYearId is still empty)
    if (!user || selectedSchoolYearId === '') return;

    const loadStats = async () => {
      try {
        setIsLoading(true);
        const semesterParam = selectedSemester === 'all' || selectedSemester === 'unassigned' ? 'all' : selectedSemester;
        const data = await analyticsService.getVPStats(user.uid, semesterParam, selectedSchoolYearId);
        setStats(data);
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [selectedSemester, selectedSchoolYearId]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Hiệu trưởng</h2>
          <p className="text-gray-600">Quản lý và theo dõi công việc</p>
        </div>

        {/* Year and Semester Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedSchoolYearId} onValueChange={setSelectedSchoolYearId}>
            <SelectTrigger className="w-full sm:w-48">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Chọn năm học" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả năm học</SelectItem>
              {schoolYears.map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  {year.name} {year.isActive && '(Hiện tại)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSemester} onValueChange={(value) => setSelectedSemester(value as SemesterFilter)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Chọn học kỳ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{SEMESTER_FILTER_LABELS.all}</SelectItem>
              <SelectItem value="HK1">{SEMESTER_FILTER_LABELS.HK1}</SelectItem>
              <SelectItem value="HK2">{SEMESTER_FILTER_LABELS.HK2}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Tổng công việc"
            value={stats.totalTasks}
            icon={ClipboardList}
            color="blue"
            description="Đã tạo"
          />
          
          <StatsCard
            title="Giáo viên"
            value={stats.totalTeachers}
            icon={Users}
            color="green"
            description="Được phân công"
          />
          
          <StatsCard
            title="Hoàn thành"
            value={stats.completedTasks}
            icon={CheckCircle}
            color="purple"
            description={`${stats.completionRate}% tổng số`}
          />
          
          <StatsCard
            title="Điểm trung bình"
            value={stats.averageScore || '--'}
            icon={Award}
            color="orange"
            description="Của các task đã chấm"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          label="Tạo công việc mới"
          icon={Plus}
          path="/vp/create-task"
          variant="default"
        />
        
        <QuickAction
          label="Danh sách công việc"
          icon={ClipboardList}
          path="/vp/tasks"
        />
        
        <QuickAction
          label="Xem thống kê"
          icon={BarChart3}
          path="/vp/statistics"
        />
      </div>

      {/* Activity Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Trạng thái công việc</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Hoàn thành</span>
                  <span className="font-medium">{stats.completedTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${stats.completionRate}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Đã nộp (chờ chấm)</span>
                  <span className="font-medium">{stats.submittedTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${stats.totalTasks > 0 ? (stats.submittedTasks / stats.totalTasks) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Đang thực hiện</span>
                  <span className="font-medium">{stats.assignedTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${stats.totalTasks > 0 ? (stats.assignedTasks / stats.totalTasks) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
            <h3 className="font-semibold mb-2">Hiệu suất</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-indigo-100">Tỷ lệ hoàn thành</span>
                <span className="text-2xl font-bold">{stats.completionRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-indigo-100">Tỷ lệ nộp bài</span>
                <span className="text-2xl font-bold">{stats.submissionRate}%</span>
              </div>
              <div className="pt-3 border-t border-indigo-400">
                <p className="text-sm text-indigo-100">
                  {stats.submittedTasks > 0 && (
                    `Bạn có ${stats.submittedTasks} bài nộp cần chấm điểm`
                  )}
                  {stats.submittedTasks === 0 && stats.completedTasks === stats.totalTasks && (
                    'Tất cả công việc đã được hoàn thành!'
                  )}
                  {stats.submittedTasks === 0 && stats.completedTasks < stats.totalTasks && (
                    'Chưa có bài nộp nào cần chấm'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};