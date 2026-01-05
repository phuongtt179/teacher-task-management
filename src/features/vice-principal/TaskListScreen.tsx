import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import { schoolYearService } from '../../services/schoolYearService';
import { useAuth } from '../../hooks/useAuth';
import { Task, TaskStatus, SchoolYear } from '../../types';
import { TaskCard } from '../../components/tasks/TaskCard';
import { SemesterFilter, SEMESTER_FILTER_LABELS } from '../../utils/semesterUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter, Calendar, Clock, Users, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export const TaskListScreen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<SemesterFilter>('all');

  // Load tasks and school years
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const [tasksData, schoolYearsData, activeYear] = await Promise.all([
          taskService.getTasksByCreator(user.uid),
          schoolYearService.getAllSchoolYears(),
          schoolYearService.getActiveSchoolYear(),
        ]);

        setTasks(tasksData);
        setFilteredTasks(tasksData);
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

  // Filter tasks
  useEffect(() => {
    let filtered = [...tasks];

    // School year filter
    if (selectedSchoolYearId !== 'all') {
      filtered = filtered.filter((task) => task.schoolYearId === selectedSchoolYearId);
    }

    // Semester filter
    if (semesterFilter !== 'all') {
      if (semesterFilter === 'unassigned') {
        filtered = filtered.filter((task) => !task.semester);
      } else {
        filtered = filtered.filter((task) => task.semester === semesterFilter);
      }
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    setFilteredTasks(filtered);
  }, [tasks, searchQuery, statusFilter, selectedSchoolYearId, semesterFilter]);

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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Danh sách công việc</h2>
          <p className="text-gray-600">Quản lý tất cả công việc đã tạo</p>
        </div>
        <Button onClick={() => navigate('/vp/create-task')}>
          <Plus className="w-4 h-4 mr-2" />
          Tạo mới
        </Button>
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

        <Select value={semesterFilter} onValueChange={(value) => setSemesterFilter(value as SemesterFilter)}>
          <SelectTrigger className="w-full md:w-56">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Học kỳ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{SEMESTER_FILTER_LABELS.all}</SelectItem>
            <SelectItem value="HK1">{SEMESTER_FILTER_LABELS.HK1}</SelectItem>
            <SelectItem value="HK2">{SEMESTER_FILTER_LABELS.HK2}</SelectItem>
            <SelectItem value="unassigned">{SEMESTER_FILTER_LABELS.unassigned}</SelectItem>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-lg border p-3 md:p-4">
          <p className="text-xs md:text-sm text-gray-600">Tổng số</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{filteredTasks.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-3 md:p-4">
          <p className="text-xs md:text-sm text-gray-600">Đã giao</p>
          <p className="text-xl md:text-2xl font-bold text-blue-600">
            {filteredTasks.filter((t) => t.status === 'assigned').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-3 md:p-4">
          <p className="text-xs md:text-sm text-gray-600">Đã nộp</p>
          <p className="text-xl md:text-2xl font-bold text-purple-600">
            {filteredTasks.filter((t) => t.status === 'submitted').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-3 md:p-4">
          <p className="text-xs md:text-sm text-gray-600">Hoàn thành</p>
          <p className="text-xl md:text-2xl font-bold text-green-600">
            {filteredTasks.filter((t) => t.status === 'completed').length}
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
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => navigate(`/vp/tasks/${task.id}`)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title and Status */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900 truncate">
                        {task.title}
                      </h3>
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {task.description}
                    </p>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          Deadline: {format(task.deadline, 'dd/MM/yyyy', { locale: vi })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{task.assignedTo.length} giáo viên</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Tạo: {format(task.createdAt, 'dd/MM/yyyy', { locale: vi })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};