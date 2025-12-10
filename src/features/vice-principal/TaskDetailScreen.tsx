import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import { Task, Submission } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { TaskStatusBadge } from '../../components/tasks/TaskStatusBadge';
import { ArrowLeft, Calendar, Users, Award, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';

export const TaskDetailScreen = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scoringSubmission, setScoringSubmission] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!taskId) return;

      try {
        setIsLoading(true);
        const [taskData, submissionsData] = await Promise.all([
          taskService.getTaskById(taskId),
          taskService.getSubmissionsForTask(taskId),
        ]);

        setTask(taskData);
        setSubmissions(submissionsData);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể tải thông tin công việc',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [taskId]);

  const handleScoreSubmission = async (submissionId: string) => {
    if (!user || !task) return;

    const scoreNum = parseFloat(score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > task.maxScore) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: `Điểm phải từ 0 đến ${task.maxScore}`,
      });
      return;
    }

    try {
      await taskService.scoreSubmission(
        submissionId,
        scoreNum,
        feedback,
        user.uid,
        user.displayName,
        task.id
      );

      toast({
        title: 'Thành công',
        description: 'Đã chấm điểm',
      });

      // Reload data
      const submissionsData = await taskService.getSubmissionsForTask(task.id);
      setSubmissions(submissionsData);
      setScoringSubmission(null);
      setScore('');
      setFeedback('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể chấm điểm',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Đang tải...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Không tìm thấy công việc</p>
        <Button onClick={() => navigate('/vp/tasks')} className="mt-4">
          Quay lại
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/vp/tasks')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{task.title}</h2>
          <p className="text-gray-600">Chi tiết công việc</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      {/* Task Info */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin công việc</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-600">Mô tả</Label>
            <p className="mt-1">{task.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-600">Độ ưu tiên</Label>
              <p className="mt-1 capitalize">{task.priority}</p>
            </div>
            <div>
              <Label className="text-gray-600">Điểm tối đa</Label>
              <p className="mt-1">{task.maxScore}</p>
            </div>
            <div>
              <Label className="text-gray-600">Deadline</Label>
              <p className="mt-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(task.deadline, 'dd/MM/yyyy', { locale: vi })}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-gray-600">
              Phân công cho ({task.assignedTo.length})
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {task.assignedToNames.map((name, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Bài nộp ({submissions.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submissions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Chưa có bài nộp nào</p>
          ) : (
            submissions.map((submission) => (
              <div key={submission.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{submission.teacherName}</p>
                    <p className="text-sm text-gray-500">
                      Nộp lúc: {format(submission.submittedAt, 'HH:mm dd/MM/yyyy', { locale: vi })}
                    </p>
                  </div>
                  {submission.score !== undefined ? (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">{submission.score}/{task.maxScore}</p>
                      <p className="text-xs text-gray-500">Đã chấm điểm</p>
                    </div>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                      Chưa chấm
                    </span>
                  )}
                </div>

                <div>
                  <Label className="text-gray-600">Nội dung báo cáo</Label>
                  <p className="mt-1 whitespace-pre-wrap">{submission.content}</p>
                </div>

                {submission.fileUrls.length > 0 && (
                  <div>
                    <Label className="text-gray-600">File đính kèm</Label>
                    <div className="mt-2 space-y-1">
                      {submission.fileUrls.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                        >
                          <Download className="w-4 h-4" />
                          {submission.fileNames && submission.fileNames[index]
                            ? submission.fileNames[index]
                            : `File ${index + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {submission.feedback && (
                  <div className="bg-gray-50 p-3 rounded">
                    <Label className="text-gray-600">Nhận xét</Label>
                    <p className="mt-1">{submission.feedback}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Bởi {submission.scoredByName} • {submission.scoredAt && format(submission.scoredAt, 'HH:mm dd/MM/yyyy', { locale: vi })}
                    </p>
                  </div>
                )}

                {submission.score === undefined && (
                  <div>
                    {scoringSubmission === submission.id ? (
                      <div className="space-y-3 border-t pt-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Điểm (0-{task.maxScore})</Label>
                            <Input
                              type="number"
                              min="0"
                              max={task.maxScore}
                              value={score}
                              onChange={(e) => setScore(e.target.value)}
                              placeholder="Nhập điểm"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Nhận xét</Label>
                          <Textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Nhận xét về bài làm..."
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleScoreSubmission(submission.id)}>
                            Xác nhận chấm điểm
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setScoringSubmission(null);
                              setScore('');
                              setFeedback('');
                            }}
                          >
                            Hủy
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScoringSubmission(submission.id)}
                      >
                        <Award className="w-4 h-4 mr-2" />
                        Chấm điểm
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};