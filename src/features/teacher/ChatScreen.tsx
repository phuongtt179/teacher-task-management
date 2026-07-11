import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { taskService, removeVietnameseTones } from '@/services/taskService';
import { notificationService } from '@/services/notificationService';
import { schoolYearService } from '@/services/schoolYearService';
import { userService } from '@/services/userService';
import { googleDriveServiceBackend } from '@/services/googleDriveServiceBackend';
import { authFetch } from '@/lib/authFetch';
import { Sparkles, Send, Loader2, ListChecks, Award, Upload, FolderSearch, CheckCircle2, X, Paperclip, ExternalLink, Building2, FileUp } from 'lucide-react';
import type { UserRole } from '@/types';

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

interface ChatProfileCandidate {
  currentName: string;
  newName: string;
}

interface ChatSchoolInfoCandidate {
  topic: string;
  content: string;
  schoolYearId: string | null;
  yearLabel: string;
  existingId: string | null;
  existingContent: string | null;
}

interface ChatCreateTaskCandidate {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string;
  schoolYearId: string;
  semester: string | null;
  assigneeUids: string[];
  assigneeNames: string[];
  createdByName: string;
}

interface ChatEditTaskAssigneesCandidate {
  taskId: string;
  taskTitle: string;
  beforeUids: string[];
  beforeNames: string[];
  afterUids: string[];
  afterNames: string[];
}

interface ParsedTaskCard {
  localId: string;
  title: string;
  description: string;
  deadline: string | null;
  priority: 'low' | 'medium' | 'high';
  assigneeUids: string[];
  assigneeNames: string[];
  unresolvedNames: string[]; // tên không khớp được ai — cần giao thủ công
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
  profileCandidate?: ChatProfileCandidate;
  schoolInfoCandidate?: ChatSchoolInfoCandidate;
  createTaskCandidate?: ChatCreateTaskCandidate;
  editTaskAssigneesCandidate?: ChatEditTaskAssigneesCandidate;
}

interface Channel {
  id: string;
  label: string;
  subtitle: string;
  icon: typeof Sparkles;
  color: string; // avatar background
  autoSend?: string; // câu hỏi tự động gửi khi mở kênh lần đầu (nếu chưa có tin nhắn)
  comingSoon?: boolean;
  roles?: UserRole[]; // để trống = hiện với mọi vai trò
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
  {
    id: 'school-info',
    label: 'Thông tin trường',
    subtitle: 'Tra cứu & cập nhật dữ kiện nội bộ',
    icon: Building2,
    color: 'bg-teal-500',
    roles: ['admin', 'principal', 'vice_principal', 'van_thu'],
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

  // Đổi tên hiển thị
  const [updatedProfileKeys, setUpdatedProfileKeys] = useState<Set<string>>(new Set());
  const [updatingProfileKey, setUpdatingProfileKey] = useState<string | null>(null);

  // Thêm/ghi đè dữ kiện nhà trường (kênh "Thông tin trường")
  const [savedSchoolInfoKeys, setSavedSchoolInfoKeys] = useState<Set<string>>(new Set());
  const [savingSchoolInfoKey, setSavingSchoolInfoKey] = useState<string | null>(null);

  // Giao việc / sửa phân công qua chat
  const [createdTaskKeys, setCreatedTaskKeys] = useState<Set<string>>(new Set());
  const [creatingTaskKey, setCreatingTaskKey] = useState<string | null>(null);
  const [editedAssigneesKeys, setEditedAssigneesKeys] = useState<Set<string>>(new Set());
  const [editingAssigneesKey, setEditingAssigneesKey] = useState<string | null>(null);

  // Dán văn bản để AI phân tích ra nhiều việc cùng lúc (giống ImportTasksScreen nhưng trong chat)
  const [parseTasksModalOpen, setParseTasksModalOpen] = useState(false);
  const [parseTasksText, setParseTasksText] = useState('');
  const [isAnalyzingTasks, setIsAnalyzingTasks] = useState(false);
  const [parsedTaskCards, setParsedTaskCards] = useState<ParsedTaskCard[] | null>(null);
  const [creatingParsedTaskId, setCreatingParsedTaskId] = useState<string | null>(null);
  const [createdParsedTaskIds, setCreatedParsedTaskIds] = useState<Set<string>>(new Set());
  const [isCreatingAllParsedTasks, setIsCreatingAllParsedTasks] = useState(false);

  const activeChannel = CHANNELS.find(c => c.id === activeChannelId)!;
  const visibleChannels = CHANNELS.filter(c => !c.roles || (user && c.roles.includes(user.role)));
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
      const res = await authFetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: user.displayName, messages: newMessages, channelId }),
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
          profileCandidate: data.profileCandidate,
          schoolInfoCandidate: data.schoolInfoCandidate,
          createTaskCandidate: data.createTaskCandidate,
          editTaskAssigneesCandidate: data.editTaskAssigneesCandidate,
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

      const res = await authFetch(`${API_BASE_URL}/chat/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

      const res = await authFetch(`${API_BASE_URL}/chat/submit-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      const res = await authFetch(`${API_BASE_URL}/chat/document-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.documentId }),
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
      const res = await authFetch(`${API_BASE_URL}/chat/forward-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: user.displayName, ...candidate }),
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

  const handleUpdateProfile = async (candidate: ChatProfileCandidate) => {
    if (!user) return;
    const key = candidate.newName;
    setUpdatingProfileKey(key);
    try {
      const res = await authFetch(`${API_BASE_URL}/chat/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: candidate.newName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể đổi tên');
      setUpdatedProfileKeys(prev => new Set(prev).add(key));
      toast({ title: 'Đã đổi tên hiển thị', description: 'Tên mới sẽ hiện đầy đủ sau khi tải lại trang.' });
    } catch (err: any) {
      toast({ title: 'Đổi tên không thành công, thử lại nhé', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingProfileKey(null);
    }
  };

  const schoolInfoKey = (c: ChatSchoolInfoCandidate) => `${c.topic}|${c.schoolYearId || ''}`;

  const handleSaveSchoolInfo = async (candidate: ChatSchoolInfoCandidate) => {
    if (!user) return;
    const key = schoolInfoKey(candidate);
    setSavingSchoolInfoKey(key);
    try {
      const res = await authFetch(`${API_BASE_URL}/chat/add-school-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: user.displayName,
          topic: candidate.topic,
          content: candidate.content,
          schoolYearId: candidate.schoolYearId,
          existingId: candidate.existingId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể lưu thông tin');
      setSavedSchoolInfoKeys(prev => new Set(prev).add(key));
      toast({ title: data.overwritten ? 'Đã cập nhật thông tin' : 'Đã lưu thông tin mới' });
    } catch (err: any) {
      toast({ title: 'Lưu không thành công, thử lại nhé', description: err.message, variant: 'destructive' });
    } finally {
      setSavingSchoolInfoKey(null);
    }
  };

  const createTaskKey = (c: ChatCreateTaskCandidate) => `${c.title}|${c.deadline}|${c.assigneeUids.join(',')}`;

  // Ghi trực tiếp qua Firestore client SDK (không qua endpoint Admin SDK) — firestore.rules đã
  // cho phép admin/VP/hiệu trưởng tạo task, đúng cơ chế UI cũ (CreateTaskScreen) đang dùng.
  const handleCreateTask = async (candidate: ChatCreateTaskCandidate) => {
    if (!user) return;
    const key = createTaskKey(candidate);
    setCreatingTaskKey(key);
    try {
      const deadline = new Date(`${candidate.deadline}T23:59:59`);
      const deadline2 = new Date(deadline);
      deadline2.setDate(deadline2.getDate() + 5);
      await taskService.createTask({
        schoolYearId: candidate.schoolYearId,
        semester: candidate.semester === 'HK1' || candidate.semester === 'HK2' ? candidate.semester : undefined,
        title: candidate.title,
        description: candidate.description,
        priority: candidate.priority,
        maxScore: 10,
        scoreDeadline1: 10,
        scoreDeadline2: 5,
        deadline,
        deadline2,
        assignedTo: candidate.assigneeUids,
        assignedToNames: candidate.assigneeNames,
        createdBy: user.uid,
        createdByName: user.displayName,
      });
      setCreatedTaskKeys(prev => new Set(prev).add(key));
      toast({ title: 'Đã giao việc thành công' });
    } catch (err: any) {
      toast({ title: 'Giao việc không thành công, thử lại nhé', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingTaskKey(null);
    }
  };

  const editAssigneesKey = (c: ChatEditTaskAssigneesCandidate) => `${c.taskId}|${c.afterUids.join(',')}`;

  const handleEditTaskAssignees = async (candidate: ChatEditTaskAssigneesCandidate) => {
    if (!user) return;
    const key = editAssigneesKey(candidate);
    setEditingAssigneesKey(key);
    try {
      await taskService.updateTask(candidate.taskId, {
        assignedTo: candidate.afterUids,
        assignedToNames: candidate.afterNames,
      });
      const newlyAddedUids = candidate.afterUids.filter(uid => !candidate.beforeUids.includes(uid));
      if (newlyAddedUids.length > 0) {
        await notificationService.notifyTaskAssigned(newlyAddedUids, candidate.taskId, candidate.taskTitle, user.displayName);
      }
      setEditedAssigneesKeys(prev => new Set(prev).add(key));
      toast({ title: 'Đã cập nhật phân công' });
    } catch (err: any) {
      toast({ title: 'Cập nhật không thành công, thử lại nhé', description: err.message, variant: 'destructive' });
    } finally {
      setEditingAssigneesKey(null);
    }
  };

  // Năm học/học kỳ đang hoạt động lúc phân tích — dùng lại y hệt lúc tạo, tránh lệch nếu năm học đổi giữa chừng.
  const [parseTasksSchoolYearId, setParseTasksSchoolYearId] = useState('');
  const [parseTasksSemester, setParseTasksSemester] = useState<'HK1' | 'HK2' | undefined>(undefined);

  const analyzeTasksFromText = async () => {
    if (!parseTasksText.trim() || !user) return;
    setIsAnalyzingTasks(true);
    try {
      const [allUsers, activeYear] = await Promise.all([
        userService.getAllUsers(),
        schoolYearService.getActiveSchoolYear(),
      ]);
      if (!activeYear) throw new Error('Chưa có năm học nào đang hoạt động');
      setParseTasksSchoolYearId(activeYear.id);
      setParseTasksSemester((activeYear.activeSemester as 'HK1' | 'HK2') || undefined);

      const teachers = allUsers
        .filter(u => ['teacher', 'department_head', 'vice_principal', 'principal', 'staff'].includes(u.role))
        .map(u => ({ uid: u.uid, displayName: u.displayName }));

      const findCandidates = (name: string) => {
        const normalized = name.toLowerCase().replace(/^(cô|thầy|anh|chị)\s+/i, '').trim();
        if (!normalized) return [];
        return teachers.filter(t => t.displayName.toLowerCase().includes(normalized));
      };

      const res = await authFetch(`${API_BASE_URL}/parse-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: parseTasksText, teachers }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Phân tích thất bại');

      const cards: ParsedTaskCard[] = (data.tasks || []).map((t: any, i: number) => {
        const assigneeNames: string[] = t.assigneeNames || [];
        const matchedTeacherIds: (string | null)[] = t.matchedTeacherIds || [];
        const resolvedUids: string[] = [];
        const resolvedNames: string[] = [];
        const unresolvedNames: string[] = [];
        assigneeNames.forEach((name, j) => {
          const candidates = findCandidates(name);
          const uid = candidates.length === 1 ? candidates[0].uid : (candidates.length === 0 ? matchedTeacherIds[j] : null);
          if (uid) {
            const teacher = teachers.find(x => x.uid === uid);
            resolvedUids.push(uid);
            resolvedNames.push(teacher?.displayName || name);
          } else {
            unresolvedNames.push(name);
          }
        });
        return {
          localId: `parsed-${i}`,
          title: t.title || '',
          description: t.description || '',
          deadline: t.deadline || null,
          priority: (['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium') as 'low' | 'medium' | 'high',
          assigneeUids: resolvedUids,
          assigneeNames: resolvedNames,
          unresolvedNames,
        };
      });
      setParsedTaskCards(cards);
      setCreatedParsedTaskIds(new Set());
      toast({ title: `Phân tích xong! Tìm thấy ${cards.length} công việc` });
    } catch (err: any) {
      toast({ title: 'Lỗi phân tích', description: err.message, variant: 'destructive' });
    } finally {
      setIsAnalyzingTasks(false);
    }
  };

  const createOneParsedTask = async (card: ParsedTaskCard) => {
    if (!user || !parseTasksSchoolYearId || card.assigneeUids.length === 0) return;
    setCreatingParsedTaskId(card.localId);
    try {
      const deadline = card.deadline ? new Date(`${card.deadline}T23:59:59`) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const deadline2 = new Date(deadline);
      deadline2.setDate(deadline2.getDate() + 5);
      await taskService.createTask({
        schoolYearId: parseTasksSchoolYearId,
        semester: parseTasksSemester,
        title: card.title,
        description: card.description,
        priority: card.priority,
        maxScore: 10,
        scoreDeadline1: 10,
        scoreDeadline2: 5,
        deadline,
        deadline2,
        assignedTo: card.assigneeUids,
        assignedToNames: card.assigneeNames,
        createdBy: user.uid,
        createdByName: user.displayName,
      });
      setCreatedParsedTaskIds(prev => new Set(prev).add(card.localId));
    } catch (err: any) {
      toast({ title: `Tạo "${card.title}" thất bại`, description: err.message, variant: 'destructive' });
    } finally {
      setCreatingParsedTaskId(null);
    }
  };

  const createAllParsedTasks = async () => {
    if (!parsedTaskCards) return;
    setIsCreatingAllParsedTasks(true);
    const toCreate = parsedTaskCards.filter(c => c.assigneeUids.length > 0 && !createdParsedTaskIds.has(c.localId));
    for (const card of toCreate) {
      await createOneParsedTask(card);
    }
    setIsCreatingAllParsedTasks(false);
    toast({ title: 'Đã tạo xong các công việc hợp lệ' });
  };

  const removeEditFile = async (fileIndex: number) => {
    if (!editingTarget || !user) return;
    setRemovingFileIndex(fileIndex);
    try {
      const res = await authFetch(`${API_BASE_URL}/chat/remove-document-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: editingTarget.documentId, fileIndex }),
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

      const res = await authFetch(`${API_BASE_URL}/chat/add-document-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: editingTarget.documentId, files }),
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
          {visibleChannels.map(channel => {
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
              const channel = visibleChannels.find(c => c.id === e.target.value);
              if (channel) selectChannel(channel);
            }}
          >
            {visibleChannels.map(channel => (
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

                  {m.profileCandidate && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <p className="text-xs text-gray-500">
                        Đổi tên hiển thị: <span className="line-through text-gray-400">{m.profileCandidate.currentName}</span> → <span className="font-medium text-gray-900">{m.profileCandidate.newName}</span>
                      </p>
                      {updatedProfileKeys.has(m.profileCandidate.newName) ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã đổi tên
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          disabled={updatingProfileKey === m.profileCandidate.newName}
                          onClick={() => handleUpdateProfile(m.profileCandidate!)}
                        >
                          {updatingProfileKey === m.profileCandidate.newName
                            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                          Xác nhận đổi tên
                        </Button>
                      )}
                    </div>
                  )}

                  {m.schoolInfoCandidate && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <span className="font-medium text-sm text-gray-900">{m.schoolInfoCandidate.topic}</span>
                      {m.schoolInfoCandidate.existingId ? (
                        <p className="text-xs text-gray-500 mt-1">
                          Ghi đè: <span className="line-through text-gray-400">{m.schoolInfoCandidate.existingContent}</span> → <span className="text-gray-900">{m.schoolInfoCandidate.content}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">{m.schoolInfoCandidate.content}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">Áp dụng: {m.schoolInfoCandidate.yearLabel}</p>
                      {savedSchoolInfoKeys.has(schoolInfoKey(m.schoolInfoCandidate)) ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          disabled={savingSchoolInfoKey === schoolInfoKey(m.schoolInfoCandidate)}
                          onClick={() => handleSaveSchoolInfo(m.schoolInfoCandidate!)}
                        >
                          {savingSchoolInfoKey === schoolInfoKey(m.schoolInfoCandidate)
                            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                          {m.schoolInfoCandidate.existingId ? 'Xác nhận ghi đè' : 'Xác nhận lưu'}
                        </Button>
                      )}
                    </div>
                  )}

                  {m.createTaskCandidate && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <span className="font-medium text-sm text-gray-900">{m.createTaskCandidate.title}</span>
                      <p className="text-xs text-gray-500 mt-1">{m.createTaskCandidate.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Giao cho: {m.createTaskCandidate.assigneeNames.join(', ')} · Hạn: {m.createTaskCandidate.deadline}
                      </p>
                      {createdTaskKeys.has(createTaskKey(m.createTaskCandidate)) ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã giao việc
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          disabled={creatingTaskKey === createTaskKey(m.createTaskCandidate)}
                          onClick={() => handleCreateTask(m.createTaskCandidate!)}
                        >
                          {creatingTaskKey === createTaskKey(m.createTaskCandidate)
                            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                          Xác nhận giao việc
                        </Button>
                      )}
                    </div>
                  )}

                  {m.editTaskAssigneesCandidate && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <span className="font-medium text-sm text-gray-900">{m.editTaskAssigneesCandidate.taskTitle}</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Trước: <span className="line-through text-gray-400">{m.editTaskAssigneesCandidate.beforeNames.join(', ') || '(chưa có ai)'}</span>
                      </p>
                      <p className="text-xs text-gray-900 mt-1">
                        Sau: {m.editTaskAssigneesCandidate.afterNames.join(', ')}
                      </p>
                      {editedAssigneesKeys.has(editAssigneesKey(m.editTaskAssigneesCandidate)) ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã cập nhật
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          disabled={editingAssigneesKey === editAssigneesKey(m.editTaskAssigneesCandidate)}
                          onClick={() => handleEditTaskAssignees(m.editTaskAssigneesCandidate!)}
                        >
                          {editingAssigneesKey === editAssigneesKey(m.editTaskAssigneesCandidate)
                            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                          Xác nhận thay đổi
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
          {user && ['admin', 'vice_principal', 'principal'].includes(user.role) && (
            <button
              onClick={() => setParseTasksModalOpen(true)}
              title="Dán văn bản để giao việc hàng loạt"
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 shrink-0"
            >
              <FileUp size={16} />
            </button>
          )}
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

      {/* Dán văn bản để AI phân tích ra nhiều việc, giao hàng loạt */}
      {parseTasksModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => { if (!isAnalyzingTasks) { setParseTasksModalOpen(false); setParsedTaskCards(null); } }}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Giao việc hàng loạt từ văn bản</h2>
              <button
                onClick={() => { setParseTasksModalOpen(false); setParsedTaskCards(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!parsedTaskCards ? (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Dán nội dung thông báo/kế hoạch (ví dụ biên bản họp phân công) — AI sẽ tự tách thành từng công việc và khớp đúng người phụ trách.
                </p>
                <textarea
                  value={parseTasksText}
                  onChange={e => setParseTasksText(e.target.value)}
                  placeholder="Dán văn bản vào đây..."
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-40 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <Button
                  onClick={analyzeTasksFromText}
                  disabled={!parseTasksText.trim() || isAnalyzingTasks}
                  className="w-full mt-3"
                >
                  {isAnalyzingTasks ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang phân tích...</> : 'Phân tích'}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600">Tìm thấy {parsedTaskCards.length} công việc</p>
                  <Button size="sm" variant="outline" onClick={() => setParsedTaskCards(null)}>Dán văn bản khác</Button>
                </div>
                <div className="space-y-2">
                  {parsedTaskCards.map(card => (
                    <div key={card.localId} className="border border-gray-200 rounded-lg p-3">
                      <p className="font-medium text-sm text-gray-900">{card.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{card.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Hạn: {card.deadline || '(chưa rõ, mặc định +7 ngày)'} · Ưu tiên: {PRIORITY_LABELS[card.priority]}
                      </p>
                      {card.assigneeNames.length > 0 && (
                        <p className="text-xs text-gray-700 mt-1">Giao cho: {card.assigneeNames.join(', ')}</p>
                      )}
                      {card.unresolvedNames.length > 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Chưa khớp được: {card.unresolvedNames.join(', ')} — cần giao thủ công qua hội thoại
                        </p>
                      )}
                      {card.assigneeUids.length === 0 ? (
                        <span className="inline-block mt-2 text-xs text-gray-400">Bỏ qua (chưa xác định người nhận)</span>
                      ) : createdParsedTaskIds.has(card.localId) ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã tạo
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          disabled={creatingParsedTaskId === card.localId || isCreatingAllParsedTasks}
                          onClick={() => createOneParsedTask(card)}
                        >
                          {creatingParsedTaskId === card.localId
                            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                          Tạo việc này
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={createAllParsedTasks}
                  disabled={isCreatingAllParsedTasks || parsedTaskCards.every(c => c.assigneeUids.length === 0 || createdParsedTaskIds.has(c.localId))}
                  className="w-full mt-4"
                >
                  {isCreatingAllParsedTasks ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang tạo...</> : 'Tạo tất cả công việc hợp lệ'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
