import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { userService } from '../../services/userService';
import { analyticsService, TeacherStats } from '../../services/analyticsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, User as UserIcon } from 'lucide-react';

export const TeacherStatisticsTab = () => {
  const navigate = useNavigate();
  const [teachersStats, setTeachersStats] = useState<TeacherStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTeachersStats();
  }, []);

  const loadTeachersStats = async () => {
    try {
      setIsLoading(true);
      const stats = await analyticsService.getAllTeachersStats();
      // Sort by display name
      stats.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setTeachersStats(stats);
    } catch (error) {
      console.error('Error loading teachers stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeacherClick = (teacherId: string) => {
    navigate(`/vice-principal/statistics/teacher/${teacherId}`);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Đang tải danh sách giáo viên...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Danh sách giáo viên ({teachersStats.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {teachersStats.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Chưa có giáo viên nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teachersStats.map((teacher) => (
                <div
                  key={teacher.uid}
                  onClick={() => handleTeacherClick(teacher.uid)}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{teacher.displayName}</h4>
                      <p className="text-sm text-gray-600">{teacher.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-600">Tổng CV</p>
                        <p className="text-lg font-bold text-gray-900">
                          {teacher.completedTasks + teacher.pendingTasks}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Hoàn thành</p>
                        <p className="text-lg font-bold text-green-600">{teacher.completedTasks}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Điểm TB</p>
                        <p className="text-lg font-bold text-indigo-600">
                          {teacher.scoredTasksCount > 0 ? teacher.averageScore : '--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Tỷ lệ</p>
                        <p className="text-lg font-bold text-blue-600">{teacher.completionRate}%</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
