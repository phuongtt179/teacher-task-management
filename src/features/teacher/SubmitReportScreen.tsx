import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import { useAuth } from '../../hooks/useAuth';
import { Task, Submission } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Calendar, Upload, FileText, Download, Award, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export const SubmitReportScreen = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!taskId || !user) return;

      try {
        setIsLoading(true);
        const [taskData, submissionData] = await Promise.all([
          taskService.getTaskById(taskId),
          taskService.getSubmission(taskId, user.uid),
        ]);

        setTask(taskData);
        setSubmission(submissionData);
        if (submissionData) {
          setContent(submissionData.content);
        }
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
  }, [taskId, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async () => {
    if (!task || !user || !content.trim()) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Vui lòng nhập nội dung báo cáo',
      });
      return;
    }
  
    setIsSubmitting(true);
    try {
      await taskService.submitReport(
        task.id,
        user.uid,
        user.displayName || 'Giáo viên',
        content,
        files
      );
  
      toast({
        title: 'Thành công',
        description: 'Đã nộp báo cáo',
      });
  
      navigate('/teacher/my-tasks');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error instanceof Error ? error.message : 'Không thể nộp báo cáo',
      });
    } finally {
      setIsSubmitting(false);
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
        <Button onClick={() => navigate('/teacher/my-tasks')} className="mt-4">
          Quay lại
        </Button>
      </div>
    );
  }

  const hasSubmitted = submission !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/my-tasks')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{task.title}</h2>
          <p className="text-gray-600">
            {hasSubmitted
              ? submission?.score !== undefined
                ? '✅ Đã chấm điểm'
                : '📝 Đã nộp - Chờ chấm điểm'
              : '📋 Nộp báo cáo'}
          </p>
        </div>
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
            <Label className="text-gray-600">Giao bởi</Label>
            <p className="mt-1">{task.createdByName}</p>
          </div>
        </CardContent>
      </Card>

      {/* Submission Form or Submitted Report */}
      {hasSubmitted && submission ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Báo cáo đã nộp</span>
              {submission.score !== undefined && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    {submission.score}/{task.maxScore}
                  </p>
                  <p className="text-xs text-gray-500">Điểm</p>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-600">Nội dung</Label>
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
                      File {index + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-gray-600">Thời gian nộp</Label>
              <p className="mt-1">
                {format(submission.submittedAt, 'HH:mm dd/MM/yyyy', { locale: vi })}
              </p>
            </div>

            {submission.feedback && (
              <div className="bg-indigo-50 p-4 rounded-lg">
                <Label className="text-indigo-900 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Nhận xét từ {submission.scoredByName}
                </Label>
                <p className="mt-2 text-indigo-900">{submission.feedback}</p>
                <p className="text-xs text-indigo-600 mt-2">
                  {submission.scoredAt && format(submission.scoredAt, 'HH:mm dd/MM/yyyy', { locale: vi })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nộp báo cáo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Nội dung báo cáo *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Mô tả chi tiết công việc đã thực hiện..."
                rows={8}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="files">File đính kèm (tùy chọn)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  id="files"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isSubmitting}
                />
                <label htmlFor="files" className="cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    Click để chọn file hoặc kéo thả vào đây
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Hỗ trợ: PDF, Word, Excel, PowerPoint, hình ảnh
                  </p>
                </label>
              </div>
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span>{file.name}</span>
                      <span className="text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !content.trim()}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang nộp...
                  </>
                ) : (
                  'Nộp báo cáo'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/teacher/my-tasks')}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};