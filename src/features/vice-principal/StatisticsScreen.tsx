import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { analyticsService, TeacherStats, SchoolStats } from '../../services/analyticsService';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { Users, Award, TrendingUp, CheckCircle, Target, BarChart3 } from 'lucide-react';
import { TaskStatisticsTab } from './TaskStatisticsTab';
import { TeacherStatisticsTab } from './TeacherStatisticsTab';

export const StatisticsScreen = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [schoolStats, setSchoolStats] = useState<SchoolStats | null>(null);
  const [teachersStats, setTeachersStats] = useState<TeacherStats[]>([]);
  const [vpStats, setVpStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const activeTab = searchParams.get('tab') || 'overview';

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const [school, teachers, vp] = await Promise.all([
          analyticsService.getSchoolStats(),
          analyticsService.getAllTeachersStats(),
          analyticsService.getVPStats(user.uid),
        ]);

        setSchoolStats(school);
        setTeachersStats(teachers.sort((a, b) => b.averageScore - a.averageScore));
        setVpStats(vp);
      } catch (error) {
        console.error('Error loading statistics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Thống kê & Phân tích</h2>
        <p className="text-gray-600">Tổng quan hiệu suất và kết quả công việc</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams({ tab: value })}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="teachers">Giáo viên</TabsTrigger>
          <TabsTrigger value="my-tasks">Công việc của tôi</TabsTrigger>
          <TabsTrigger value="by-task">Theo công việc</TabsTrigger>
          <TabsTrigger value="by-teacher">Theo giáo viên</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Đang tải thống kê...</p>
            </div>
          ) : schoolStats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="Tổng giáo viên"
                  value={schoolStats.totalTeachers}
                  icon={Users}
                  color="blue"
                />
                <StatsCard
                  title="Tổng công việc"
                  value={schoolStats.totalTasks}
                  icon={Target}
                  color="purple"
                />
                <StatsCard
                  title="Đã hoàn thành"
                  value={schoolStats.completedTasks}
                  icon={CheckCircle}
                  color="green"
                  description={`${schoolStats.totalTasks > 0 ? Math.round((schoolStats.completedTasks / schoolStats.totalTasks) * 100) : 0}% tổng số`}
                />
                <StatsCard
                  title="Điểm TB toàn trường"
                  value={schoolStats.averageScore}
                  icon={Award}
                  color="orange"
                  description="Thang điểm 10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Phân bố hiệu suất</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Xuất sắc (≥ TB + 1)</span>
                          <span className="text-sm font-bold text-green-600">
                            {schoolStats.highPerformers} người
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{
                              width: `${schoolStats.totalTeachers > 0 ? (schoolStats.highPerformers / schoolStats.totalTeachers) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Trung bình</span>
                          <span className="text-sm font-bold text-blue-600">
                            {schoolStats.totalTeachers - schoolStats.highPerformers - schoolStats.lowPerformers} người
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${schoolStats.totalTeachers > 0 ? ((schoolStats.totalTeachers - schoolStats.highPerformers - schoolStats.lowPerformers) / schoolStats.totalTeachers) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Cần cải thiện (≤ TB - 1)</span>
                          <span className="text-sm font-bold text-orange-600">
                            {schoolStats.lowPerformers} người
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-orange-600 h-2 rounded-full"
                            style={{
                              width: `${schoolStats.totalTeachers > 0 ? (schoolStats.lowPerformers / schoolStats.totalTeachers) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-900">
                          {schoolStats.highPerformers} giáo viên xuất sắc
                        </p>
                        <p className="text-xs text-green-700">
                          Đạt điểm trên trung bình trường
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Tỷ lệ hoàn thành: {schoolStats.totalTasks > 0 ? Math.round((schoolStats.completedTasks / schoolStats.totalTasks) * 100) : 0}%
                        </p>
                        <p className="text-xs text-blue-700">
                          {schoolStats.completedTasks}/{schoolStats.totalTasks} công việc
                        </p>
                      </div>
                    </div>

                    {schoolStats.lowPerformers > 0 && (
                      <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                        <Target className="w-5 h-5 text-orange-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-orange-900">
                            {schoolStats.lowPerformers} giáo viên cần hỗ trợ
                          </p>
                          <p className="text-xs text-orange-700">
                            Cân nhắc giảm workload hoặc đào tạo thêm
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* Teachers Tab */}
        <TabsContent value="teachers" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Đang tải thống kê...</p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Bảng xếp hạng giáo viên (Theo điểm TB)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teachersStats.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Chưa có dữ liệu</p>
                  ) : (
                  teachersStats.map((teacher, index) => (
                    <div
                      key={teacher.uid}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-bold">
                        #{index + 1}
                      </div>

                      <div className="flex-1">
                        <p className="font-semibold">{teacher.displayName}</p>
                        <p className="text-sm text-gray-500">{teacher.email}</p>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-600">Điểm TB</p>
                          <p className="text-lg font-bold text-indigo-600">
                            {teacher.scoredTasksCount > 0 ? teacher.averageScore : '--'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Hoàn thành</p>
                          <p className="text-lg font-bold text-green-600">
                            {teacher.completedTasks}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Đang làm</p>
                          <p className="text-lg font-bold text-orange-600">
                            {teacher.pendingTasks}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Tỷ lệ</p>
                          <p className="text-lg font-bold text-gray-900">
                            {teacher.completionRate}%
                          </p>
                        </div>
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* My Tasks Tab */}
        <TabsContent value="my-tasks" className="space-y-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Đang tải thống kê...</p>
            </div>
          ) : vpStats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="Công việc đã tạo"
                  value={vpStats.totalTasks}
                  icon={Target}
                  color="blue"
                />
                <StatsCard
                  title="Hoàn thành"
                  value={vpStats.completedTasks}
                  icon={CheckCircle}
                  color="green"
                  description={`${vpStats.completionRate}% tổng số`}
                />
                <StatsCard
                  title="Đã nộp"
                  value={vpStats.submittedTasks}
                  icon={TrendingUp}
                  color="purple"
                  description="Chờ chấm điểm"
                />
                <StatsCard
                  title="Điểm TB"
                  value={vpStats.averageScore || '--'}
                  icon={Award}
                  color="orange"
                  description="Các task đã chấm"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Tổng quan công việc của bạn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-4">Trạng thái công việc</h4>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Hoàn thành</span>
                            <span className="text-sm font-medium">{vpStats.completedTasks}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${vpStats.completionRate}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Đã nộp</span>
                            <span className="text-sm font-medium">{vpStats.submittedTasks}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{
                                width: `${vpStats.totalTasks > 0 ? (vpStats.submittedTasks / vpStats.totalTasks) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Chưa hoàn thành</span>
                            <span className="text-sm font-medium">{vpStats.assignedTasks}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-600 h-2 rounded-full"
                              style={{
                                width: `${vpStats.totalTasks > 0 ? (vpStats.assignedTasks / vpStats.totalTasks) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-4">Thống kê</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between p-3 bg-gray-50 rounded">
                          <span className="text-sm">Giáo viên được phân công</span>
                          <span className="font-bold">{vpStats.totalTeachers}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-50 rounded">
                          <span className="text-sm">Tỷ lệ hoàn thành</span>
                          <span className="font-bold text-green-600">{vpStats.completionRate}%</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-50 rounded">
                          <span className="text-sm">Tỷ lệ nộp bài</span>
                          <span className="font-bold text-blue-600">{vpStats.submissionRate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* By Task Tab */}
        <TabsContent value="by-task" className="space-y-6">
          <TaskStatisticsTab />
        </TabsContent>

        {/* By Teacher Tab */}
        <TabsContent value="by-teacher" className="space-y-6">
          <TeacherStatisticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};