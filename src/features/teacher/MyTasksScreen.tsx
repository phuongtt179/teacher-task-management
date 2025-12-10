import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import { schoolYearService } from '../../services/schoolYearService';
import { useAuth } from '../../hooks/useAuth';
import { Task, TaskStatus, SchoolYear, Submission } from '../../types';
import { TaskCard } from '../../components/tasks/TaskCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Calendar, Clock, ChevronRight, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Task with teacher-specific status
interface TaskWithStatus extends Task {
  teacherStatus: TaskStatus; // Status specific to the current teacher
  submission?: Submission;
}

export const MyTasksScreen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>('all');

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const [tasksData, schoolYearsData, activeYear] = await Promise.all([
          taskService.getTasksForTeacher(user.uid),
          schoolYearService.getAllSchoolYears(),
          schoolYearService.getActiveSchoolYear(),
        ]);

        // Load submissions for each task and determine teacher-specific status
        const tasksWithStatus: TaskWithStatus[] = await Promise.all(
          tasksData.map(async (task) => {
            // Get submission for this teacher
            const submission = await taskService.getSubmission(task.id, user.uid);

            // Determine teacher-specific status
            let teacherStatus: TaskStatus;
            const now = new Date();

            if (submission) {
              // Has submission
              if (submission.score !== undefined) {
                teacherStatus = 'completed'; // Has been scored
              } else {
                teacherStatus = 'submitted'; // Submitted but not scored yet
              }
            } else {
              // No submission yet
              if (now > task.deadline) {
                teacherStatus = 'overdue'; // Past deadline
              } else {
                teacherStatus = 'assigned'; // Not yet submitted
              }
            }

            return {
              ...task,
              teacherStatus,
              submission: submission || undefined,
            };
          })
        );

        // Define status priority (lower number = higher priority)
        const statusPriority: Record<TaskStatus, number> = {
          assigned: 1,      // Đã giao - cao nhất
          submitted: 2,     // Đã nộp
          completed: 3,     // Hoàn thành
          overdue: 4,       // Quá hạn - thấp nhất
          in_progress: 1,   // Treat same as assigned
        };

        // Sort by status priority first, then by deadline within same status
        const sortedTasks = tasksWithStatus.sort((a, b) => {
          // First, sort by status priority
          const priorityDiff = statusPriority[a.teacherStatus] - statusPriority[b.teacherStatus];
          if (priorityDiff !== 0) {
            return priorityDiff;
          }

          // If same priority, sort by deadline (earliest first)
          return a.deadline.getTime() - b.deadline.getTime();
        });

        setTasks(sortedTasks);
        setFilteredTasks(sortedTasks);
        setSchoolYears(schoolYearsData);

        // Default to active school year if exists
        if (activeYear) {
          setSelectedSchoolYearId(activeYear.id);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  useEffect(() => {
    let filtered = [...tasks];

    // School year filter
    if (selectedSchoolYearId !== 'all') {
      filtered = filtered.filter((task) => task.schoolYearId === selectedSchoolYearId);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((task) => task.teacherStatus === statusFilter);
    }

    setFilteredTasks(filtered);
  }, [tasks, searchQuery, statusFilter, selectedSchoolYearId]);

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'assigned':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Đã giao</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Đang làm</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Đã nộp</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Hoàn thành</Badge>;
      case 'overdue':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Quá hạn</Badge>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Cao</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Trung bình</Badge>;
      case 'low':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Thấp</Badge>;
      default:
        return null;
    }
  };

  // Check if task is due today and not completed
  const isDueToday = (task: TaskWithStatus): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(task.deadline);
    deadline.setHours(0, 0, 0, 0);

    return today.getTime() === deadline.getTime() &&
           task.teacherStatus !== 'completed' &&
           task.teacherStatus !== 'submitted';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Công việc của tôi</h2>
        <p className="text-gray-600">Danh sách công việc được giao</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Tìm kiếm công việc..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedSchoolYearId} onValueChange={setSelectedSchoolYearId}>
          <SelectTrigger className="w-full md:w-56">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Năm học" />
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="assigned">Đã giao</SelectItem>
            <SelectItem value="in_progress">Đang làm</SelectItem>
            <SelectItem value="submitted">Đã nộp</SelectItem>
            <SelectItem value="completed">Hoàn thành</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Tổng số</p>
          <p className="text-2xl font-bold text-gray-900">{filteredTasks.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Chưa làm</p>
          <p className="text-2xl font-bold text-blue-600">
            {filteredTasks.filter((t) => t.teacherStatus === 'assigned').length}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-sm text-red-600 font-medium">⚠️ Hết hạn hôm nay</p>
          <p className="text-2xl font-bold text-red-600">
            {filteredTasks.filter((t) => isDueToday(t)).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Đã nộp</p>
          <p className="text-2xl font-bold text-purple-600">
            {filteredTasks.filter((t) => t.teacherStatus === 'submitted').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Hoàn thành</p>
          <p className="text-2xl font-bold text-green-600">
            {filteredTasks.filter((t) => t.teacherStatus === 'completed').length}
          </p>
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Đang tải...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-600">
            {searchQuery || statusFilter !== 'all' || selectedSchoolYearId !== 'all'
              ? 'Không tìm thấy công việc phù hợp'
              : 'Chưa có công việc nào'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="divide-y">
            {filteredTasks.map((task) => {
              const isUrgent = isDueToday(task);
              return (
                <div
                  key={task.id}
                  onClick={() => navigate(`/teacher/tasks/${task.id}`)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isUrgent
                      ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title and Status */}
                      <div className="flex items-center gap-2 mb-2">
                        {isUrgent && (
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 animate-pulse" />
                        )}
                        <h3 className={`font-semibold text-lg truncate ${isUrgent ? 'text-red-900' : 'text-gray-900'}`}>
                          {task.title}
                        </h3>
                        {getStatusBadge(task.teacherStatus)}
                        {getPriorityBadge(task.priority)}
                        {isUrgent && (
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-semibold">
                            HẾT HẠN HÔM NAY
                          </Badge>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {task.description}
                      </p>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div className={`flex items-center gap-1 ${isUrgent ? 'text-red-700 font-medium' : ''}`}>
                          <Clock className="w-4 h-4" />
                          <span>
                            Deadline: {format(task.deadline, 'dd/MM/yyyy', { locale: vi })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Giao bởi: {task.createdByName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex-shrink-0">
                      <ChevronRight className={`w-5 h-5 ${isUrgent ? 'text-red-600' : 'text-gray-400'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};