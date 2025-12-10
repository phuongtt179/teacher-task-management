import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Task, Submission, User } from '../../types';
import { taskService } from '../../services/taskService';
import { submissionService } from '../../services/submissionService';
import { userService } from '../../services/userService';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle, XCircle, Clock, FileText, Save } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

interface TeacherSubmission {
  teacher: User;
  submission: Submission | null;
  isCompleted: boolean;
  isOverdue: boolean;
  completedAt?: Date;
}

type FilterType = 'all' | 'completed' | 'not_completed';

export const TaskDetailStatisticsScreen = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [teacherSubmissions, setTeacherSubmissions] = useState<TeacherSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<TeacherSubmission[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [savingScores, setSavingScores] = useState<Set<string>>(new Set());

  // Local state for scores and feedback
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (taskId) {
      loadTaskDetails();
    }
  }, [taskId]);

  useEffect(() => {
    applyFilter();
  }, [teacherSubmissions, filter]);

  const loadTaskDetails = async () => {
    if (!taskId) return;

    try {
      setIsLoading(true);
      const taskData = await taskService.getTaskById(taskId);
      if (!taskData) {
        toast.error('Không tìm thấy công việc');
        navigate('/vp/statistics?tab=by-task');
        return;
      }

      setTask(taskData);

      // Load submissions for this task
      const submissions = await submissionService.getSubmissionsByTask(taskId);

      // Load teacher details
      const teacherDetails = await Promise.all(
        taskData.assignedTo.map((teacherId) => userService.getUser(teacherId))
      );

      // Combine data
      const combined: TeacherSubmission[] = teacherDetails
        .filter((teacher): teacher is User => teacher !== null)
        .map((teacher) => {
          const submission = submissions.find((s) => s.teacherId === teacher.uid);
          const isCompleted = submission?.score !== undefined;
          const isOverdue =
            !submission && new Date() > new Date(taskData.deadline);

          return {
            teacher,
            submission: submission || null,
            isCompleted,
            isOverdue,
            completedAt: submission?.submittedAt,
          };
        });

      // Sort by completion time (earliest first, then not done)
      combined.sort((a, b) => {
        if (a.completedAt && b.completedAt) {
          return a.completedAt.getTime() - b.completedAt.getTime();
        }
        if (a.completedAt) return -1;
        if (b.completedAt) return 1;
        return 0;
      });

      setTeacherSubmissions(combined);

      // Initialize scores and feedbacks
      const initialScores: Record<string, number> = {};
      const initialFeedbacks: Record<string, string> = {};
      combined.forEach(({ submission }) => {
        if (submission) {
          if (submission.score !== undefined) {
            initialScores[submission.id] = submission.score;
          }
          if (submission.feedback) {
            initialFeedbacks[submission.id] = submission.feedback;
          }
        }
      });
      setScores(initialScores);
      setFeedbacks(initialFeedbacks);
    } catch (error) {
      console.error('Error loading task details:', error);
      toast.error('Không thể tải thông tin công việc');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered = [...teacherSubmissions];

    switch (filter) {
      case 'completed':
        filtered = filtered.filter((ts) => ts.submission && ts.submission.score !== undefined);
        break;
      case 'not_completed':
        filtered = filtered.filter((ts) => !ts.submission || ts.submission.score === undefined);
        break;
      default:
        // 'all' - no filter
        break;
    }

    setFilteredSubmissions(filtered);
  };

  const handleSaveScore = async (submissionId: string) => {
    if (!task || !user) return;

    const score = scores[submissionId];
    const feedback = feedbacks[submissionId] || '';

    const maxAllowedScore = task.scoreDeadline1 || task.maxScore;

    if (score === undefined || score < 0 || score > maxAllowedScore) {
      toast.error(`Điểm phải từ 0 đến ${maxAllowedScore}`);
      return;
    }

    try {
      setSavingScores((prev) => new Set(prev).add(submissionId));
      await submissionService.scoreSubmission(
        submissionId,
        score,
        feedback,
        user.uid,
        user.displayName,
        task.id
      );
      toast.success('Đã lưu điểm thành công');

      // Reload to update status
      await loadTaskDetails();
    } catch (error) {
      console.error('Error saving score:', error);
      toast.error('Không thể lưu điểm');
    } finally {
      setSavingScores((prev) => {
        const newSet = new Set(prev);
        newSet.delete(submissionId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Đang tải chi tiết...</p>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  const completedCount = teacherSubmissions.filter((ts) => ts.isCompleted).length;
  const submittedCount = teacherSubmissions.filter((ts) => ts.submission).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/vp/statistics?tab=by-task')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{task.title}</h2>
          <p className="text-gray-600">
            Hạn nộp: {format(new Date(task.deadline), 'dd/MM/yyyy HH:mm', { locale: vi })}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Tổng số GV</p>
              <p className="text-3xl font-bold text-indigo-600">{teacherSubmissions.length}</p>
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
              <p className="text-sm text-gray-600">Chưa nộp</p>
              <p className="text-3xl font-bold text-red-600">
                {teacherSubmissions.length - submittedCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Tất cả ({teacherSubmissions.length})
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
              Chưa hoàn thành ({teacherSubmissions.length - completedCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Teacher List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách giáo viên</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSubmissions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Không có kết quả</p>
            ) : (
              filteredSubmissions.map(({ teacher, submission, isCompleted, isOverdue }) => (
                <div
                  key={teacher.uid}
                  className={`p-3 border rounded-lg ${
                    !submission && isOverdue ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  {/* Compact Layout */}
                  <div className="space-y-2">
                    {/* Single Info Row */}
                    <div className="flex items-center gap-4 text-sm">
                      <h4 className="font-semibold text-gray-900 min-w-[150px]">{teacher.displayName}</h4>

                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 min-w-[100px]">
                          <CheckCircle className="w-4 h-4" />
                          Đã chấm điểm
                        </span>
                      ) : submission ? (
                        <span className="flex items-center gap-1 text-xs text-blue-600 min-w-[100px]">
                          <Clock className="w-4 h-4" />
                          Chờ chấm điểm
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600 min-w-[100px]">
                          <XCircle className="w-4 h-4" />
                          Chưa nộp
                        </span>
                      )}

                      {submission && (
                        <>
                          <span className="text-gray-600">
                            Thời gian nộp: <span className="font-medium text-gray-900">
                              {format(new Date(submission.submittedAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                            </span>
                          </span>
                          {submission.metDeadline && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              submission.metDeadline === 1
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              Deadline {submission.metDeadline}
                            </span>
                          )}
                        </>
                      )}

                      <span className="text-gray-600 ml-auto">{teacher.email}</span>
                    </div>

                    {submission && submission.fileUrls && submission.fileUrls.length > 0 && (
                      <div className="flex gap-2 pl-1">
                        {submission.fileUrls.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            <FileText className="w-4 h-4" />
                            {submission.fileNames && submission.fileNames[index]
                              ? submission.fileNames[index]
                              : `File ${index + 1}`}
                          </a>
                        ))}
                      </div>
                    )}

                    {submission && (
                      <>

                        {/* Score and Feedback Row - Compact */}
                        <div className="flex gap-2 items-end p-3 border-t border-emerald-300">
                          <div className="w-32">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Điểm (max: {task.scoreDeadline1 || task.maxScore})
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max={task.scoreDeadline1 || task.maxScore}
                              step="0.1"
                              value={scores[submission.id] ?? ''}
                              onChange={(e) =>
                                setScores({
                                  ...scores,
                                  [submission.id]: parseFloat(e.target.value),
                                })
                              }
                              placeholder="Điểm"
                              className="h-9"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Nhận xét
                            </label>
                            <Input
                              value={feedbacks[submission.id] ?? ''}
                              onChange={(e) =>
                                setFeedbacks({
                                  ...feedbacks,
                                  [submission.id]: e.target.value,
                                })
                              }
                              placeholder="Nhập nhận xét..."
                              className="h-9"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSaveScore(submission.id)}
                            disabled={savingScores.has(submission.id)}
                            className="h-9"
                          >
                            {savingScores.has(submission.id) ? (
                              'Đang lưu...'
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-1" />
                                Lưu
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
