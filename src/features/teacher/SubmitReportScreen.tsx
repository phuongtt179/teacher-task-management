import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import { taskUpdateService } from '../../services/taskUpdateService';
import { useAuth } from '../../hooks/useAuth';
import { Task, Submission, TaskUpdate } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Calendar, Upload, FileText, Download, Award, Loader2, TrendingUp, AlertCircle, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Nhãn + màu cho trạng thái xử lý của BGH
const UPDATE_STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: 'Chờ xử lý', className: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Đã xử lý', className: 'bg-green-100 text-green-700' },
  approved: { label: 'Đã duyệt', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Từ chối', className: 'bg-red-100 text-red-700' },
};
const UPDATE_TYPE_LABEL: Record<string, string> = {
  progress: 'Tiến độ',
  blocker: 'Vướng mắc',
  extension: 'Xin gia hạn',
};

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

  // Cập nhật giữa chừng: tiến độ / vướng mắc / xin gia hạn
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [activeAction, setActiveAction] = useState<'progress' | 'blocker' | 'extension' | null>(null);
  const [updateNote, setUpdateNote] = useState('');
  const [updatePercent, setUpdatePercent] = useState('50');
  const [requestedDate, setRequestedDate] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);

  const loadUpdates = async (tId: string, uid: string) => {
    try {
      const data = await taskUpdateService.getUpdatesForTeacherTask(uid, tId);
      setUpdates(data);
    } catch (error) {
      console.error('Error loading task updates:', error);
    }
  };

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
        await loadUpdates(taskId, user.uid);
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

  const resetActionForm = () => {
    setActiveAction(null);
    setUpdateNote('');
    setUpdatePercent('50');
    setRequestedDate('');
  };

  const handleSendUpdate = async () => {
    if (!task || !user) return;

    if (activeAction === 'extension' && !requestedDate) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng chọn hạn mới mong muốn' });
      return;
    }
    if ((activeAction === 'blocker' || activeAction === 'extension') && !updateNote.trim()) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: activeAction === 'blocker' ? 'Vui lòng mô tả vướng mắc' : 'Vui lòng nêu lý do xin gia hạn',
      });
      return;
    }

    setSavingUpdate(true);
    try {
      await taskUpdateService.createUpdate({
        taskId: task.id,
        taskTitle: task.title,
        teacherId: user.uid,
        teacherName: user.displayName || 'Giáo viên',
        type: activeAction!,
        note: updateNote.trim(),
        percent: activeAction === 'progress' ? parseInt(updatePercent, 10) : undefined,
        requestedDeadline: activeAction === 'extension' ? new Date(`${requestedDate}T23:59:59`) : undefined,
      });

      toast({
        title: 'Đã gửi',
        description:
          activeAction === 'progress'
            ? 'Đã báo tiến độ tới ban giám hiệu'
            : activeAction === 'blocker'
            ? 'Đã báo vướng mắc tới ban giám hiệu'
            : 'Đã gửi yêu cầu gia hạn, chờ ban giám hiệu duyệt',
      });
      resetActionForm();
      await loadUpdates(task.id, user.uid);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error instanceof Error ? error.message : 'Không gửi được cập nhật',
      });
    } finally {
      setSavingUpdate(false);
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

      {/* Cập nhật giữa chừng: báo tiến độ / vướng mắc / xin gia hạn */}
      <Card>
        <CardHeader>
          <CardTitle>Báo cáo giữa chừng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nút chọn hành động — ẩn khi việc đã được chấm điểm */}
          {submission?.score === undefined && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activeAction === 'progress' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => (activeAction === 'progress' ? resetActionForm() : setActiveAction('progress'))}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Báo tiến độ
                </Button>
                <Button
                  variant={activeAction === 'blocker' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => (activeAction === 'blocker' ? resetActionForm() : setActiveAction('blocker'))}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Báo vướng mắc
                </Button>
                <Button
                  variant={activeAction === 'extension' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => (activeAction === 'extension' ? resetActionForm() : setActiveAction('extension'))}
                >
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Xin gia hạn
                </Button>
              </div>

              {activeAction && (
                <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                  {activeAction === 'progress' && (
                    <div className="space-y-2">
                      <Label>Mức độ hoàn thành: {updatePercent}%</Label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={updatePercent}
                        onChange={(e) => setUpdatePercent(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}

                  {activeAction === 'extension' && (
                    <div className="space-y-2">
                      <Label>Hạn mới mong muốn *</Label>
                      <Input
                        type="date"
                        value={requestedDate}
                        onChange={(e) => setRequestedDate(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>
                      {activeAction === 'progress'
                        ? 'Ghi chú (tùy chọn)'
                        : activeAction === 'blocker'
                        ? 'Mô tả vướng mắc *'
                        : 'Lý do xin gia hạn *'}
                    </Label>
                    <Textarea
                      value={updateNote}
                      onChange={(e) => setUpdateNote(e.target.value)}
                      placeholder={
                        activeAction === 'progress'
                          ? 'VD: Đã xong phần thống kê, còn phần nhận xét...'
                          : activeAction === 'blocker'
                          ? 'VD: Thiếu số liệu từ tổ 2 nên chưa tổng hợp được...'
                          : 'VD: Bận công tác đột xuất, xin dời hạn...'
                      }
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSendUpdate} disabled={savingUpdate}>
                      {savingUpdate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Gửi
                    </Button>
                    <Button variant="outline" onClick={resetActionForm} disabled={savingUpdate}>
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Lịch sử cập nhật đã gửi */}
          {updates.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có báo cáo giữa chừng nào.</p>
          ) : (
            <div className="space-y-2">
              {updates.map((u) => {
                const meta = UPDATE_STATUS_META[u.status] || UPDATE_STATUS_META.open;
                return (
                  <div key={u.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{UPDATE_TYPE_LABEL[u.type]}</span>
                      {u.type === 'progress' && u.percent !== undefined && (
                        <span className="text-indigo-600 font-medium">{u.percent}%</span>
                      )}
                      {u.type === 'extension' && u.requestedDeadline && (
                        <span className="text-gray-500">
                          → {format(u.requestedDeadline, 'dd/MM/yyyy', { locale: vi })}
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${meta.className}`}>{meta.label}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {format(u.createdAt, 'HH:mm dd/MM/yyyy', { locale: vi })}
                      </span>
                    </div>
                    {u.note && <p className="mt-1 text-gray-600 whitespace-pre-wrap">{u.note}</p>}
                    {u.reviewNote && (
                      <p className="mt-1 text-gray-700 bg-gray-50 rounded p-2">
                        <span className="font-medium">Phản hồi:</span> {u.reviewNote}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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