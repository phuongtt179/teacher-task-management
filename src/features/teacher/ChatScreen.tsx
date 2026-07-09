import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { taskService, removeVietnameseTones } from '@/services/taskService';
import { schoolYearService } from '@/services/schoolYearService';
import { googleDriveServiceBackend } from '@/services/googleDriveServiceBackend';
import { Sparkles, Send, Loader2, ListChecks, Award, Upload, FolderSearch, CheckCircle2, X, Paperclip, ExternalLink } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ChatTask {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string | null;
  status: string;
}

interface ChatDocument {
  title: string;
  category: string;
  fileUrl: string | null;
  fileName: string | null;
}

interface ChatCategoryCandidate {
  schoolYearId: string;
  categoryId: string;
  categoryName: string;
  subCategoryId: string | null;
  subCategoryName: string | null;
}

interface ChatMyDocument {
  documentId: string;
  title: string;
  category: string;
  subCategory: string | null;
  status: string;
  fileCount: number;
}

interface ChatEditFile {
  index: number;
  name: string;
  url: string | null;
}

interface ChatEditTarget {
  documentId: string;
  schoolYearId: string | null;
  title: string;
  category: string;
  subCategory: string | null;
  status: string;
  files: ChatEditFile[];
}

interface ChatBghTaskCandidate {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string;
  schoolYearId: string;
  targetUids: string[];
  targetNames: string[];
  createdByName: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  taskList?: ChatTask[];
  documentList?: ChatDocument[];
  categoryCandidates?: ChatCategoryCandidate[];
  myDocumentList?: ChatMyDocument[];
  editTarget?: ChatEditTarget;
  bghTaskCandidate?: ChatBghTaskCandidate;
}

interface Channel {
  id: string;
  label: string;
  subtitle: string;
  icon: typeof Sparkles;
  color: string; // avatar background
  autoSend?: string; // câu hỏi tự động gửi khi mở kênh lần đầu (nếu chưa có tin nhắn)
  comingSoon?: boolean;
}

const CHANNELS: Channel[] = [
  {
    id: 'general',
    label: 'Trợ lý AI',
    subtitle: 'Hỏi bất kỳ điều gì',
    icon: Sparkles,
    color: 'bg-indigo-500',
    autoSend: 'Xin chào',
  },
  {
    id: 'tasks',
    label: 'Công việc của tôi',
    subtitle: 'Xem & hỏi việc cần ưu tiên',
    icon: ListChecks,
    color: 'bg-blue-500',
    autoSend: 'Tôi có những công việc gì cần làm?',
  },
  {
    id: 'scores',
    label: 'Điểm của tôi',
    subtitle: 'Xem lịch sử điểm số',
    icon: Award,
    color: 'bg-amber-500',
    autoSend: 'Điểm của tôi thế nào rồi?',
  },
  {
    id: 'submit-doc',
    label: 'Nộp tài liệu',
    subtitle: 'Giáo án, sổ chủ nhiệm...',
    icon: Upload,
    color: 'bg-emerald-500',
  },
  {
    id: 'find-doc',
    label: 'Tài liệu công khai',
    subtitle: 'Tìm công văn, tài liệu...',
    icon: FolderSearch,
    color: 'bg-purple-500',
  },
];

const PRIORITY_LABELS: Record<string, string> = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

const DOC_STATUS_LABELS: Record<string, string> = { approved: 'Đã duyệt', pending: 'Chờ duyệt', rejected: 'Bị từ chối' };
const DOC_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

export function ChatScreen() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeChannelId, setActiveChannelId] = useState('general');
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [loadingChannelId, setLoadingChannelId] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form đánh dấu hoàn thành công việc
  const [completingTask, setCompletingTask] = useState<ChatTask | null>(null);
  const [completeContent, setCompleteContent] = useState('');
  const [completeFiles, setCompleteFiles] = useState<File[]>([]);
  const [completing, setCompleting] = useState(false);

  // Form nộp tài liệu
  const [uploadingTarget, setUploadingTarget] = useState<ChatCategoryCandidate | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submittedTargets, setSubmittedTargets] = useState<Set<string>>(new Set());

  // Form sửa tài liệu đã nộp (thêm/xóa file)
  const [editingTarget, setEditingTarget] = useState<ChatEditTarget | null>(null);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [addingFiles, setAddingFiles] = useState(false);
  const [removingFileIndex, setRemovingFileIndex] = useState<number | null>(null);
  const [loadingEditTarget, setLoadingEditTarget] = useState<string | null>(null);

  // Văn thư chuyển công việc cho BGH
  const [forwardedBghKeys, setForwardedBghKeys] = useState<Set<string>>(new Set());
  const [forwardingBghKey, setForwardingBghKey] = useState<string | null>(null);

  const activeChannel = CHANNELS.find(c => c.id === activeChannelId)!;
  const activeMessages = messagesByChannel[activeChannelId] || [];
  const isLoading = loadingChannelId === activeChannelId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isLoading]);

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  const sendMessage = async (channelId: string, text: string) => {
    const content = text.trim();
    if (!content || loadingChannelId || !user) return;

    const prior = messagesByChannel[channelId] || [];
    const newMessages: ChatMessage[] = [...prior, { role: 'user', content }];
    setMessagesByChannel(prev => ({ ...prev, [channelId]: newMessages }));
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoadingChannelId(channelId);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, displayName: user.displayName, messages: newMessages }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.answer) {
        if (res.status === 429) {
          toast({
            title: data.error === 'quota_rpd'
              ? 'Trợ lý AI đã hết lượt hôm nay, mai dùng lại nhé'
              : 'Nhiều người đang hỏi cùng lúc, thử lại sau vài giây',
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Chưa hỏi được trợ lý AI, thử lại nhé', variant: 'destructive' });
        }
        return;
      }

      setMessagesByChannel(prev => ({
        ...prev,
        [channelId]: [...(prev[channelId] || newMessages), {
          role: 'model',
          content: data.answer,
          taskList: data.taskList,
          documentList: data.documentList,
          categoryCandidates: data.categoryCandidates,
          myDocumentList: data.myDocumentList,
          editTarget: data.editTarget,
          bghTaskCandidate: data.bghTaskCandidate,
        }],
      }));
    } catch {
      toast({ title: 'Có lỗi xảy ra, thử lại nhé', variant: 'destructive' });
    } finally {
      setLoadingChannelId(current => (current === channelId ? null : current));
    }
  };

  const selectChannel = (channel: Channel) => {
    if (channel.comingSoon) return;
    setActiveChannelId(channel.id);
    const existing = messagesByChannel[channel.id];
    if ((!existing || existing.length === 0) && channel.autoSend) {
      sendMessage(channel.id, channel.autoSend);
    }
  };

  // Kênh mặc định ("Trợ lý AI") đã active sẵn từ đầu nên không đi qua selectChannel
  // khi mở màn hình — kích hoạt lời chào tự động ở đây thay vì chờ người dùng bấm.
  useEffect(() => {
    if (!user) return;
    const defaultChannel = CHANNELS[0];
    if (defaultChannel.autoSend) {
      sendMessage(defaultChannel.id, defaultChannel.autoSend);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const openCompleteForm = (task: ChatTask) => {
    setCompletingTask(task);
    setCompleteContent('');
    setCompleteFiles([]);
  };

  const submitCompleteTask = async () => {
    if (!completingTask || !user || !completeContent.trim()) return;
    setCompleting(true);

    try {
      const task = await taskService.getTaskById(completingTask.id);
      if (!task) throw new Error('Không tìm thấy công việc');
      const schoolYear = await schoolYearService.getSchoolYear(task.schoolYearId);

      const fileUrls: string[] = [];
      const fileNames: string[] = [];
      for (const file of completeFiles) {
        const sanitizedTaskTitle = removeVietnameseTones(task.title);
        const sanitizedTeacherName = removeVietnameseTones(user.displayName || '');
        const driveFile = await googleDriveServiceBackend.uploadFile({
          file,
          schoolYear: `${schoolYear?.name || 'Nam hoc'} cv`,
          category: sanitizedTaskTitle,
          subCategory: `submissions/${sanitizedTeacherName}`,
        });
        fileUrls.push(driveFile.webViewLink);
        fileNames.push(file.name);
      }

      const res = await fetch(`${API_BASE_URL}/chat/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          displayName: user.displayName,
          taskId: completingTask.id,
          content: completeContent.trim(),
          fileUrls,
          fileNames,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể báo hoàn thành');
      }

      setCompletedTaskIds(prev => new Set(prev).add(completingTask.id));
      setMessagesByChannel(prev => ({
        ...prev,
        [activeChannelId]: [
          ...(prev[activeChannelId] || []),
          {
            role: 'model',
            content: `✅ Đã ghi nhận hoàn thành "${completingTask.title}". Điểm tạm tính: ${data.score}/${task.maxScore}.`,
          },
        ],
      }));
      toast({ title: 'Đã báo hoàn thành công việc' });
      setCompletingTask(null);
    } catch (err: any) {
      toast({ title: 'Không thể báo hoàn thành', description: err.message, variant: 'destructive' });
    } finally {
      setCompleting(false);
    }
  };

  const candidateKey = (c: ChatCategoryCandidate) => `${c.categoryId}|${c.subCategoryId || ''}`;

  const openUploadForm = (candidate: ChatCategoryCandidate) => {
    setUploadingTarget(candidate);
    setUploadTitle('');
    setUploadFiles([]);
  };

  const submitDocument = async () => {
    if (!uploadingTarget || !user || !uploadTitle.trim() || uploadFiles.length === 0) return;
    setUploading(true);

    try {
      const schoolYear = await schoolYearService.getSchoolYear(uploadingTarget.schoolYearId);

      const files = [];
      for (const file of uploadFiles) {
        const driveFile = await googleDriveServiceBackend.uploadFile({
          file,
          schoolYear: schoolYear?.name || 'Nam hoc',
          category: uploadingTarget.categoryName,
          subCategory: uploadingTarget.subCategoryName || undefined,
          uploaderName: user.displayName,
          documentTitle: uploadTitle.trim(),
        });
        files.push({
          name: file.name,
          size: file.size,
          mimeType: file.type,
          driveFileId: driveFile.id,
          driveFileUrl: driveFile.webViewLink,
        });
      }

      const res = await fetch(`${API_BASE_URL}/chat/submit-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          displayName: user.displayName,
          schoolYearId: uploadingTarget.schoolYearId,
          categoryId: uploadingTarget.categoryId,
          subCategoryId: uploadingTarget.subCategoryId,
          title: uploadTitle.trim(),
          files,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể nộp tài liệu');
      }

      setSubmittedTargets(prev => new Set(prev).add(candidateKey(uploadingTarget)));
      const label = uploadingTarget.subCategoryName
        ? `${uploadingTarget.categoryName} - ${uploadingTarget.subCategoryName}`
        : uploadingTarget.categoryName;
      setMessagesByChannel(prev => ({
        ...prev,
        [activeChannelId]: [
          ...(prev[activeChannelId] || []),
          {
            role: 'model',
            content: data.status === 'approved'
              ? `✅ Đã nộp "${uploadTitle.trim()}" vào ${label}.`
              : `✅ Đã nộp "${uploadTitle.trim()}" vào ${label}, đang chờ duyệt.`,
          },
        ],
      }));
      toast({ title: 'Đã nộp tài liệu' });
      setUploadingTarget(null);
    } catch (err: any) {
      toast({ title: 'Không thể nộp tài liệu', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // Bấm "Sửa" từ danh sách tài liệu của tôi — chưa có sẵn chi tiết file, cần gọi lấy trước
  const openEditFromDocument = async (doc: ChatMyDocument) => {
    if (!user) return;
    setLoadingEditTarget(doc.documentId);
    try {
      const res = await fetch(`${API_BASE_URL}/chat/document-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, documentId: doc.documentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không lấy được chi tiết tài liệu');
      setEditingTarget(data);
      setEditNewFiles([]);
    } catch (err: any) {
      toast({ title: 'Không mở được tài liệu để sửa', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingEditTarget(null);
    }
  };

  // AI đã xác nhận sẵn (confirm_edit_target) — có luôn đầy đủ dữ liệu, không cần gọi lại
  const openEditFromTarget = (target: ChatEditTarget) => {
    setEditingTarget(target);
    setEditNewFiles([]);
  };

  const bghTaskKey = (c: ChatBghTaskCandidate) => `${c.title}|${c.deadline}`;

  const handleForwardTaskToBgh = async (candidate: ChatBghTaskCandidate) => {
    if (!user) return;
    const key = bghTaskKey(candidate);
    setForwardingBghKey(key);
    try {
      const res = await fetch(`${API_BASE_URL}/chat/forward-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, displayName: user.displayName, ...candidate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể chuyển công việc');
      setForwardedBghKeys(prev => new Set(prev).add(key));
      toast({ title: 'Đã chuyển công việc cho Ban Giám Hiệu' });
    } catch (err: any) {
      toast({ title: 'Chuyển việc không thành công, thử lại nhé', description: err.message, variant: 'destructive' });
    } finally {
      setForwardingBghKey(null);
    }
  };

  const removeEditFile = async (fileIndex: number) => {
    if (!editingTarget || !user) return;
    setRemovingFileIndex(fileIndex);
    try {
      const res = await fetch(`${API_BASE_URL}/chat/remove-document-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, documentId: editingTarget.documentId, fileIndex }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể xóa file');

      setEditingTarget(prev => prev ? {
        ...prev,
        status: data.status,
        files: prev.files.filter(f => f.index !== fileIndex).map((f, i) => ({ ...f, index: i })),
      } : prev);
      toast({ title: 'Đã xóa file' });
    } catch (err: any) {
      toast({ title: 'Không thể xóa file', description: err.message, variant: 'destructive' });
    } finally {
      setRemovingFileIndex(null);
    }
  };

  const addEditFiles = async () => {
    if (!editingTarget || !user || editNewFiles.length === 0) return;
    setAddingFiles(true);

    try {
      const schoolYear = editingTarget.schoolYearId
        ? await schoolYearService.getSchoolYear(editingTarget.schoolYearId)
        : null;

      const files: { name: string; size: number; mimeType: string; driveFileId: string; driveFileUrl: string }[] = [];
      for (const file of editNewFiles) {
        const driveFile = await googleDriveServiceBackend.uploadFile({
          file,
          schoolYear: schoolYear?.name || 'Nam hoc',
          category: editingTarget.category,
          subCategory: editingTarget.subCategory || undefined,
          uploaderName: user.displayName,
          documentTitle: editingTarget.title,
        });
        files.push({
          name: file.name,
          size: file.size,
          mimeType: file.type,
          driveFileId: driveFile.id,
          driveFileUrl: driveFile.webViewLink,
        });
      }

      const res = await fetch(`${API_BASE_URL}/chat/add-document-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, documentId: editingTarget.documentId, files }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể thêm file');

      setEditingTarget(prev => prev ? {
        ...prev,
        status: data.status,
        files: [
          ...prev.files,
          ...files.map((f, i) => ({ index: prev.files.length + i, name: f.name, url: f.driveFileUrl })),
        ],
      } : prev);
      setEditNewFiles([]);
      toast({ title: 'Đã thêm file' });
    } catch (err: any) {
      toast({ title: 'Không thể thêm file', description: err.message, variant: 'destructive' });
    } finally {
      setAddingFiles(false);
    }
  };

  return (
    <div className="flex h-full bg-white">
      {/* Cột trái: danh sách kênh, giống danh sách hội thoại Zalo. Ẩn trên màn hình nhỏ (giống Sidebar gốc) */}
      <div className="hidden lg:flex w-72 shrink-0 border-r border-gray-200 flex-col">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">Trợ lý AI</h2>
          <p className="text-xs text-gray-400">Chọn 1 mục để bắt đầu trò chuyện</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {CHANNELS.map(channel => {
            const isActive = channel.id === activeChannelId;
            return (
              <button
                key={channel.id}
                onClick={() => selectChannel(channel)}
                disabled={channel.comingSoon}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors
                  ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                  ${channel.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full ${channel.color} flex items-center justify-center text-white shrink-0`}>
                  <channel.icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-700' : 'text-gray-900'}`}>
                    {channel.label}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{channel.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cột phải: khung chat của kênh đang chọn */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${activeChannel.color} flex items-center justify-center text-white shrink-0`}>
            <activeChannel.icon size={14} />
          </div>
          <h3 className="font-semibold text-gray-900 flex-1">{activeChannel.label}</h3>

          {/* Chọn kênh dạng dropdown khi màn hình nhỏ (thay cho cột trái đang ẩn) */}
          <select
            className="lg:hidden text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
            value={activeChannelId}
            onChange={e => {
              const channel = CHANNELS.find(c => c.id === e.target.value);
              if (channel) selectChannel(channel);
            }}
          >
            {CHANNELS.map(channel => (
              <option key={channel.id} value={channel.id} disabled={channel.comingSoon}>
                {channel.label}{channel.comingSoon ? ' (sắp ra mắt)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
          {activeMessages.length === 0 && !isLoading && (
            <div className="text-center text-gray-400 text-sm py-10">
              <div className="text-4xl mb-2">🤖</div>
              Gõ câu hỏi bên dưới để bắt đầu.
            </div>
          )}
          {activeMessages.map((m, i) => {
            const pendingTasks = (m.taskList || []).filter(t => !completedTaskIds.has(t.id));
            const pendingCandidates = (m.categoryCandidates || []).filter(c => !submittedTargets.has(candidateKey(c)));
            return (
              <div key={i} className={`flex ${m.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                {m.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white shrink-0 mr-2 mt-auto mb-1">
                    <Sparkles size={14} />
                  </div>
                )}
                <div className="max-w-[80%] space-y-2">
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'model'
                        ? 'bg-white text-gray-800 border border-indigo-100 rounded-bl-md shadow-sm'
                        : 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-br-md shadow-md'
                    }`}
                  >
                    {m.content}
                  </div>

                  {pendingTasks.length > 0 && (
                    <div className="space-y-2">
                      {pendingTasks.map(task => (
                        <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-900">{task.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                              {PRIORITY_LABELS[task.priority]}
                            </span>
                          </div>
                          {task.deadline && (
                            <p className="text-xs text-gray-400 mt-1">Hạn: {task.deadline}</p>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs"
                            onClick={() => openCompleteForm(task)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Đánh dấu hoàn thành
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(m.documentList || []).length > 0 && (
                    <div className="space-y-2">
                      {m.documentList!.map((doc, di) => (
                        <div key={di} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-900">{doc.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                              {doc.category}
                            </span>
                          </div>
                          {doc.fileName && (
                            <p className="text-xs text-gray-400 mt-1 truncate">{doc.fileName}</p>
                          )}
                          {doc.fileUrl && (
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                Mở tài liệu
                              </Button>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingCandidates.length > 0 && (
                    <div className="space-y-2">
                      {pendingCandidates.map((c, ci) => (
                        <div key={ci} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-900">
                              {c.categoryName}{c.subCategoryName ? ` - ${c.subCategoryName}` : ''}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs"
                            onClick={() => openUploadForm(c)}
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            Nộp vào đây
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(m.myDocumentList || []).length > 0 && (
                    <div className="space-y-2">
                      {m.myDocumentList!.map(doc => (
                        <div key={doc.documentId} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-900">{doc.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${DOC_STATUS_COLORS[doc.status] || 'bg-gray-100 text-gray-600'}`}>
                              {DOC_STATUS_LABELS[doc.status] || doc.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {doc.category}{doc.subCategory ? ` - ${doc.subCategory}` : ''} · {doc.fileCount} file
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs"
                            disabled={loadingEditTarget === doc.documentId}
                            onClick={() => openEditFromDocument(doc)}
                          >
                            {loadingEditTarget === doc.documentId
                              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              : <Paperclip className="w-3.5 h-3.5 mr-1.5" />}
                            Sửa
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {m.editTarget && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">{m.editTarget.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${DOC_STATUS_COLORS[m.editTarget.status] || 'bg-gray-100 text-gray-600'}`}>
                          {DOC_STATUS_LABELS[m.editTarget.status] || m.editTarget.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {m.editTarget.category}{m.editTarget.subCategory ? ` - ${m.editTarget.subCategory}` : ''} · {m.editTarget.files.length} file
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 text-xs"
                        onClick={() => openEditFromTarget(m.editTarget!)}
                      >
                        <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                        Quản lý file
                      </Button>
                    </div>
                  )}

                  {m.bghTaskCandidate && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <span className="font-medium text-sm text-gray-900">{m.bghTaskCandidate.title}</span>
                      <p className="text-xs text-gray-500 mt-1">{m.bghTaskCandidate.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Gửi tới: {m.bghTaskCandidate.targetNames.join(', ')} · Hạn: {m.bghTaskCandidate.deadline}
                      </p>
                      {forwardedBghKeys.has(bghTaskKey(m.bghTaskCandidate)) ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã chuyển
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          disabled={forwardingBghKey === bghTaskKey(m.bghTaskCandidate)}
                          onClick={() => handleForwardTaskToBgh(m.bghTaskCandidate!)}
                        >
                          {forwardingBghKey === bghTaskKey(m.bghTaskCandidate)
                            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                          Xác nhận chuyển cho BGH
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white shrink-0 mr-2">
                <Sparkles size={14} />
              </div>
              <div className="bg-white border border-indigo-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <Loader2 size={16} className="animate-spin text-indigo-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-200 bg-white px-3 py-3 flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(activeChannelId, input);
              }
            }}
            disabled={isLoading}
            rows={1}
            placeholder={`Nhắn trong "${activeChannel.label}"...`}
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50 resize-none overflow-y-auto leading-snug"
            style={{ maxHeight: 140 }}
          />
          <button
            onClick={() => sendMessage(activeChannelId, input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 shadow-md shrink-0"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* Form đánh dấu hoàn thành công việc */}
      {completingTask && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !completing && setCompletingTask(null)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Báo hoàn thành công việc</h2>
              <button onClick={() => !completing && setCompletingTask(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">{completingTask.title}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nội dung báo cáo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={completeContent}
                  onChange={e => setCompleteContent(e.target.value)}
                  placeholder="Mô tả ngắn gọn những gì đã làm..."
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-24 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Minh chứng (không bắt buộc)</label>
                <label className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
                  <Paperclip className="w-4 h-4" />
                  {completeFiles.length > 0 ? `${completeFiles.length} file đã chọn` : 'Đính kèm file'}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => setCompleteFiles(Array.from(e.target.files || []))}
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={submitCompleteTask}
                disabled={!completeContent.trim() || completing}
                className="flex-1"
              >
                {completing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang gửi...</> : 'Gửi báo cáo'}
              </Button>
              <Button
                onClick={() => setCompletingTask(null)}
                variant="outline"
                disabled={completing}
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Form nộp tài liệu */}
      {uploadingTarget && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !uploading && setUploadingTarget(null)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Nộp tài liệu</h2>
              <button onClick={() => !uploading && setUploadingTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {uploadingTarget.categoryName}{uploadingTarget.subCategoryName ? ` - ${uploadingTarget.subCategoryName}` : ''}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tên tài liệu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Ví dụ: Giáo án tuần 1"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  File <span className="text-red-500">*</span>
                </label>
                <label className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
                  <Paperclip className="w-4 h-4" />
                  {uploadFiles.length > 0 ? `${uploadFiles.length} file đã chọn` : 'Chọn 1 hoặc nhiều file'}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => setUploadFiles(Array.from(e.target.files || []))}
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={submitDocument}
                disabled={!uploadTitle.trim() || uploadFiles.length === 0 || uploading}
                className="flex-1"
              >
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang nộp...</> : 'Nộp tài liệu'}
              </Button>
              <Button
                onClick={() => setUploadingTarget(null)}
                variant="outline"
                disabled={uploading}
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Form quản lý file (thêm/xóa) của tài liệu đã nộp */}
      {editingTarget && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingTarget(null)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Quản lý file</h2>
              <button onClick={() => setEditingTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-1">{editingTarget.title}</p>
            <p className="text-xs text-gray-400 mb-4">
              {editingTarget.category}{editingTarget.subCategory ? ` - ${editingTarget.subCategory}` : ''}
            </p>

            <div className="space-y-2 mb-4">
              {editingTarget.files.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">Chưa có file nào</p>
              )}
              {editingTarget.files.map(f => (
                <div key={f.index} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm">
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate text-indigo-600 hover:underline">
                      {f.name}
                    </a>
                  ) : (
                    <span className="truncate">{f.name}</span>
                  )}
                  <button
                    onClick={() => removeEditFile(f.index)}
                    disabled={removingFileIndex === f.index}
                    className="shrink-0 text-gray-400 hover:text-red-600"
                  >
                    {removingFileIndex === f.index ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
                <Paperclip className="w-4 h-4" />
                {editNewFiles.length > 0 ? `${editNewFiles.length} file mới đã chọn` : 'Thêm file mới'}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => setEditNewFiles(Array.from(e.target.files || []))}
                />
              </label>
              {editNewFiles.length > 0 && (
                <Button
                  onClick={addEditFiles}
                  disabled={addingFiles}
                  className="w-full"
                  size="sm"
                >
                  {addingFiles ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang tải lên...</> : `Thêm ${editNewFiles.length} file`}
                </Button>
              )}
            </div>

            <Button
              onClick={() => setEditingTarget(null)}
              variant="outline"
              className="w-full mt-4"
            >
              Đóng
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
