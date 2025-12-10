import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Task, Submission } from '../../types';
import { userService } from '../../services/userService';
import { taskService } from '../../services/taskService';
import { submissionService } from '../../services/submissionService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

interface TaskWithSubmission {
  task: Task;
  submission: Submission | null;
  isCompleted: boolean;
  isOverdue: boolean;
}

type FilterType = 'all' | 'completed' | 'not_completed';

export const TeacherDetailStatisticsScreen = () => {
  const { teacherId } = useParams<{ teacherId: string }>();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<User | null>(null);
  const [taskSubmissions, setTaskSubmissions] = useState<TaskWithSubmission[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskWithSubmission[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (teacherId) {
      loadTeacherDetails();
    }
  }, [teacherId]);

  useEffect(() => {
    applyFilters();
  }, [taskSubmissions, selectedMonth, filter]);

  const loadTeacherDetails = async () => {
    if (!teacherId) return;

    try {
      setIsLoading(true);
      const teacherData = await userService.getUser(teacherId);
      if (!teacherData) {
        toast.error('Không tìm thấy giáo viên');
        navigate('/vp/statistics?tab=by-teacher');
        return;
      }

      setTeacher(teacherData);

      // Load all tasks assigned to this teacher
      const tasks = await taskService.getTasksForTeacher(teacherId);

      // Load submissions for all these tasks
      const tasksWithSubmissions = await Promise.all(
        tasks.map(async (task) => {
          const submissions = await submissionService.getSubmissionsByTask(task.id);
          const submission = submissions.find((s) => s.teacherId === teacherId);

          const isCompleted = submission?.score !== undefined;
          const isOverdue = !submission && new Date() > new Date(task.deadline);

          return {
            task,
            submission: submission || null,
            isCompleted,
            isOverdue,
          };
        })
      );

      setTaskSubmissions(tasksWithSubmissions);
    } catch (error) {
      console.error('Error loading teacher details:', error);
      toast.error('Không thể tải thông tin giáo viên');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...taskSubmissions];

    // Filter by month
    if (selectedMonth !== 'all') {
      const [year, month] = selectedMonth.split('-');
      filtered = filtered.filter((ts) => {
        const taskDate = new Date(ts.task.deadline);
        return (
          taskDate.getFullYear() === parseInt(year) &&
          taskDate.getMonth() === parseInt(month) - 1
        );
      });
    }

    // Filter by completion status
    switch (filter) {
      case 'completed':
        filtered = filtered.filter((ts) => ts.isCompleted);
        break;
      case 'not_completed':
        filtered = filtered.filter((ts) => !ts.isCompleted);
        break;
      default:
        // 'all' - no filter
        break;
    }

    setFilteredTasks(filtered);
  };

  const getMonthOptions = () => {
    const months = new Set<string>();
    taskSubmissions.forEach((ts) => {
      const date = new Date(ts.task.deadline);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Đang tải thông tin...</p>
      </div>
    );
  }

  if (!teacher) {
    return null;
  }

  const completedCount = taskSubmissions.filter((ts) => ts.isCompleted).length;
  const submittedCount = taskSubmissions.filter((ts) => ts.submission).length;
  const averageScore =
    completedCount > 0
      ? taskSubmissions
          .filter((ts) => ts.submission?.score !== undefined)
          .reduce((sum, ts) => sum + (ts.submission?.score || 0), 0) / completedCount
      : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/vp/statistics?tab=by-teacher')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{teacher.displayName}</h2>
          <p className="text-gray-600">{teacher.email}</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Tổng công việc</p>
              <p className="text-3xl font-bold text-indigo-600">{taskSubmissions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Đã nộp</p>
              <p className="text-3xl font-bold text-blue-600">{submittedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Đã chấm điểm</p>
              <p className="text-3xl font-bold text-green-600">{completedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Điểm TB</p>
              <p className="text-3xl font-bold text-orange-600">
                {completedCount > 0 ? averageScore.toFixed(2) : '--'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                Tất cả ({taskSubmissions.length})
              </Button>
              <Button
                variant={filter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('completed')}
              >
                Đã hoàn thành ({completedCount})
              </Button>
              <Button
                variant={filter === 'not_completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('not_completed')}
              >
                Chưa hoàn thành ({taskSubmissions.length - completedCount})
              </Button>
            </div>

            {/* Month filter */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 h-9 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tất cả tháng</option>
              {getMonthOptions().map((monthKey) => {
                const [year, month] = monthKey.split('-');
                return (
                  <option key={monthKey} value={monthKey}>
                    Tháng {month}/{year}
                  </option>
                );
              })}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách công việc</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Công việc
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Hạn nộp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Điểm
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    File báo cáo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Không có công việc nào
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map(({ task, submission, isCompleted, isOverdue }) => (
                    <tr key={task.id} className={isOverdue ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{task.title}</p>
                          <p className="text-sm text-gray-600">{task.createdByName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {format(new Date(task.deadline), 'dd/MM/yyyy', { locale: vi })}
                      </td>
                      <td className="px-4 py-3">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            <CheckCircle className="w-3 h-3" />
                            Đã chấm điểm
                          </span>
                        ) : submission ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                            <Clock className="w-3 h-3" />
                            Chờ chấm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                            <XCircle className="w-3 h-3" />
                            Chưa nộp
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {submission?.score !== undefined ? (
                          <span className="font-semibold text-indigo-600">
                            {submission.score}/{task.maxScore}
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {submission && submission.fileUrls && submission.fileUrls.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {submission.fileUrls.map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                              >
                                <FileText className="w-3 h-3" />
                                {submission.fileNames && submission.fileNames[index]
                                  ? submission.fileNames[index]
                                  : `File ${index + 1}`}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Chưa có</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
