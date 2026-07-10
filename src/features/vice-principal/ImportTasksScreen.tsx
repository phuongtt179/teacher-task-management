import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { taskService } from '../../services/taskService';
import { schoolYearService } from '../../services/schoolYearService';
import { userService } from '../../services/userService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Trash2, ArrowLeft, Users, Calendar } from 'lucide-react';
import { SchoolYear, TaskPriority } from '../../types';
import { Semester, SEMESTER_LABELS } from '../../utils/semesterUtils';
import { authFetch } from '@/lib/authFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

interface Teacher {
  uid: string;
  displayName: string;
}

interface ParsedTask {
  localId: string;
  title: string;
  description: string;
  assigneeNames: string[];
  matchedTeacherIds: (string | null)[];
  assigneeResolutions: (string | null)[];
  deadline: string | null;
  priority: TaskPriority;
  selected: boolean;
}

export const ImportTasksScreen = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [pastedText, setPastedText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<Semester>('HK1');
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    const load = async () => {
      const [years, activeYear, allUsers] = await Promise.all([
        schoolYearService.getAllSchoolYears(),
        schoolYearService.getActiveSchoolYear(),
        userService.getAllUsers(),
      ]);
      setSchoolYears(years);
      if (activeYear) {
        setSelectedSchoolYearId(activeYear.id);
        if (activeYear.activeSemester) setSelectedSemester(activeYear.activeSemester as Semester);
      }
      const teacherList = allUsers
        .filter(u => ['teacher', 'department_head', 'vice_principal', 'principal', 'staff'].includes(u.role))
        .map(u => ({ uid: u.uid, displayName: u.displayName }));
      setTeachers(teacherList);
    };
    load();
  }, []);

  // Find all teachers whose name contains the given assignee name (honorifics stripped)
  const findCandidates = (name: string): Teacher[] => {
    const normalized = name.toLowerCase().replace(/^(cô|thầy|anh|chị)\s+/i, '').trim();
    if (!normalized) return [];
    return teachers.filter(t => t.displayName.toLowerCase().includes(normalized));
  };

  const handleAnalyze = async () => {
    if (!pastedText.trim()) {
      toast({ title: 'Vui lòng dán văn bản vào ô bên dưới', variant: 'destructive' });
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/parse-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pastedText, teachers }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Phân tích thất bại');

      const tasks: ParsedTask[] = data.tasks.map((t: any, i: number) => {
        const assigneeNames: string[] = t.assigneeNames || [];
        const matchedTeacherIds: (string | null)[] = t.matchedTeacherIds || [];
        const assigneeResolutions = assigneeNames.map((name, j) => {
          const candidates = findCandidates(name);
          if (candidates.length === 1) return candidates[0].uid;
          if (candidates.length === 0) return matchedTeacherIds[j] || null;
          return null; // ambiguous: multiple teachers share this name, require manual pick
        });
        return {
          localId: `task-${i}`,
          title: t.title || '',
          description: t.description || '',
          assigneeNames,
          matchedTeacherIds,
          assigneeResolutions,
          deadline: t.deadline || null,
          priority: (['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium') as TaskPriority,
          selected: true,
        };
      });
      setParsedTasks(tasks);
      toast({ title: `Phân tích xong! Tìm thấy ${tasks.length} công việc` });
    } catch (err: any) {
      toast({ title: 'Lỗi phân tích', description: err.message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateTask = (localId: string, field: keyof ParsedTask, value: any) => {
    setParsedTasks(prev => prev.map(t => t.localId === localId ? { ...t, [field]: value } : t));
  };

  const removeTask = (localId: string) => {
    setParsedTasks(prev => prev.filter(t => t.localId !== localId));
  };

  const toggleAll = (selected: boolean) => {
    setParsedTasks(prev => prev.map(t => ({ ...t, selected })));
  };

  const updateAssigneeResolution = (localId: string, index: number, uid: string) => {
    setParsedTasks(prev => prev.map(t => {
      if (t.localId !== localId) return t;
      const next = [...t.assigneeResolutions];
      next[index] = uid;
      return { ...t, assigneeResolutions: next };
    }));
  };

  const getResolvedAssignees = (task: ParsedTask) => {
    const ids: string[] = [];
    const names: string[] = [];
    task.assigneeResolutions.forEach(uid => {
      if (!uid) return;
      const teacher = teachers.find(t => t.uid === uid);
      if (teacher) { ids.push(uid); names.push(teacher.displayName); }
    });
    return { ids, names };
  };

  const handleCreate = async () => {
    const selected = parsedTasks.filter(t => t.selected);
    if (selected.length === 0) {
      toast({ title: 'Chưa chọn công việc nào', variant: 'destructive' });
      return;
    }
    if (!selectedSchoolYearId) {
      toast({ title: 'Vui lòng chọn năm học', variant: 'destructive' });
      return;
    }

    const invalid = selected.filter(t => !t.title.trim() || !t.deadline);
    if (invalid.length > 0) {
      toast({ title: `${invalid.length} công việc thiếu tiêu đề hoặc deadline`, variant: 'destructive' });
      return;
    }

    const hasUnresolvedDuplicateName = selected.some(t =>
      t.assigneeNames.some((name, i) => findCandidates(name).length > 1 && !t.assigneeResolutions[i])
    );
    if (hasUnresolvedDuplicateName) {
      toast({
        title: 'Có tên trùng với nhiều giáo viên chưa được chọn cụ thể',
        description: 'Vui lòng chọn đúng người trong ô dropdown (viền cam) trước khi tạo',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    let successCount = 0;
    let failCount = 0;

    for (const task of selected) {
      try {
        const { ids, names } = getResolvedAssignees(task);
        const deadline = new Date(task.deadline!);
        const deadline2 = new Date(deadline);
        deadline2.setDate(deadline2.getDate() + 5);

        await taskService.createTask({
          schoolYearId: selectedSchoolYearId,
          semester: selectedSemester,
          title: task.title,
          description: task.description,
          priority: task.priority,
          maxScore: 10,
          scoreDeadline1: 10,
          scoreDeadline2: 5,
          deadline,
          deadline2,
          assignedTo: ids,
          assignedToNames: names,
          createdBy: user!.uid,
          createdByName: user!.displayName,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsCreating(false);
    toast({
      title: `Tạo xong! ${successCount} công việc thành công${failCount > 0 ? `, ${failCount} thất bại` : ''}`,
    });
    if (successCount > 0) navigate('/vp/tasks');
  };

  const selectedCount = parsedTasks.filter(t => t.selected).length;
  const unmatchedCount = parsedTasks.filter(t =>
    t.selected && t.assigneeNames.length > 0 && t.assigneeResolutions.every(id => !id)
  ).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Import công việc từ văn bản</h2>
          <p className="text-gray-500 text-sm">Dán văn bản phân công từ Word, AI sẽ tự động nhận dạng</p>
        </div>
      </div>

      {/* Step 1: Settings + Paste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bước 1: Chọn năm học và dán văn bản</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="space-y-1">
              <Label>Năm học</Label>
              <Select value={selectedSchoolYearId} onValueChange={setSelectedSchoolYearId}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map(y => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name} {y.isActive && '(Hiện tại)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Học kỳ</Label>
              <Select value={selectedSemester} onValueChange={v => setSelectedSemester(v as Semester)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HK1">{SEMESTER_LABELS.HK1}</SelectItem>
                  <SelectItem value="HK2">{SEMESTER_LABELS.HK2}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Văn bản phân công</Label>
            <Textarea
              placeholder="Dán nội dung văn bản phân công từ Word vào đây..."
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              className="min-h-48 font-mono text-sm"
            />
            <p className="text-xs text-gray-400">{pastedText.length} ký tự</p>
          </div>

          <Button onClick={handleAnalyze} disabled={isAnalyzing || !pastedText.trim()}>
            {isAnalyzing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang phân tích...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Phân tích bằng AI</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Preview */}
      {parsedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                Bước 2: Kiểm tra và xác nhận ({selectedCount}/{parsedTasks.length} được chọn)
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Chọn tất cả</Button>
                <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Bỏ chọn tất cả</Button>
              </div>
            </div>
            {unmatchedCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {unmatchedCount} công việc có người phụ trách chưa khớp với hệ thống — sẽ tạo không có người được phân công
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {parsedTasks.map(task => (
              <div
                key={task.localId}
                className={`border rounded-lg p-4 space-y-3 transition-colors ${task.selected ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 bg-gray-50 opacity-60'}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={task.selected}
                    onChange={e => updateTask(task.localId, 'selected', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <div className="flex-1 space-y-3">
                    {/* Title */}
                    <Input
                      value={task.title}
                      onChange={e => updateTask(task.localId, 'title', e.target.value)}
                      placeholder="Tiêu đề công việc"
                      className="font-medium"
                    />

                    {/* Description */}
                    <Textarea
                      value={task.description}
                      onChange={e => updateTask(task.localId, 'description', e.target.value)}
                      placeholder="Mô tả..."
                      className="text-sm min-h-16"
                    />

                    <div className="flex flex-wrap gap-4">
                      {/* Assignees */}
                      <div className="space-y-1 flex-1 min-w-48">
                        <Label className="text-xs flex items-center gap-1">
                          <Users className="w-3 h-3" /> Người phụ trách
                        </Label>
                        <div className="flex flex-wrap gap-1">
                          {task.assigneeNames.length === 0 && (
                            <span className="text-xs text-gray-400">Chưa có</span>
                          )}
                          {task.assigneeNames.map((name, i) => {
                            const candidates = findCandidates(name);
                            const resolvedId = task.assigneeResolutions[i];

                            if (candidates.length > 1) {
                              // Ambiguous: multiple teachers share this name — require manual selection
                              return (
                                <Select
                                  key={i}
                                  value={resolvedId || undefined}
                                  onValueChange={v => updateAssigneeResolution(task.localId, i, v)}
                                >
                                  <SelectTrigger
                                    className={`h-7 text-xs w-44 ${resolvedId ? 'border-green-300' : 'border-amber-400 text-amber-700'}`}
                                  >
                                    <SelectValue placeholder={`"${name}" trùng tên — chọn người`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {candidates.map(c => (
                                      <SelectItem key={c.uid} value={c.uid}>
                                        {c.displayName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            }

                            if (candidates.length === 0) {
                              // No automatic match — let admin pick manually from the full teacher list (optional)
                              return (
                                <Select
                                  key={i}
                                  value={resolvedId || undefined}
                                  onValueChange={v => updateAssigneeResolution(task.localId, i, v)}
                                >
                                  <SelectTrigger
                                    className={`h-7 text-xs w-48 ${resolvedId ? 'border-green-300' : 'border-amber-400 text-amber-700'}`}
                                  >
                                    <SelectValue placeholder={`"${name}" chưa khớp — chọn thủ công`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {teachers.map(t => (
                                      <SelectItem key={t.uid} value={t.uid}>
                                        {t.displayName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            }

                            return (
                              <Badge
                                key={i}
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200 text-xs"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                {name}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* Deadline */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Deadline
                        </Label>
                        <Input
                          type="date"
                          value={task.deadline || ''}
                          onChange={e => updateTask(task.localId, 'deadline', e.target.value || null)}
                          className="w-40 text-sm"
                        />
                      </div>

                      {/* Priority */}
                      <div className="space-y-1">
                        <Label className="text-xs">Ưu tiên</Label>
                        <Select
                          value={task.priority}
                          onValueChange={v => updateTask(task.localId, 'priority', v as TaskPriority)}
                        >
                          <SelectTrigger className="w-32 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(['high', 'medium', 'low'] as TaskPriority[]).map(p => (
                              <SelectItem key={p} value={p}>
                                <span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_COLORS[p]}`}>
                                  {PRIORITY_LABELS[p]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTask(task.localId)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleCreate}
                disabled={isCreating || selectedCount === 0}
                size="lg"
              >
                {isCreating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang tạo...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Tạo {selectedCount} công việc</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
