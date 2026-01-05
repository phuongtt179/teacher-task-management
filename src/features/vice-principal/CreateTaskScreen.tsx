import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { taskService } from '../../services/taskService';
import { suggestionService, TeacherSuggestion } from '../../services/suggestionService';
import { schoolYearService } from '../../services/schoolYearService';
import { googleDriveServiceBackend } from '../../services/googleDriveServiceBackend';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, TrendingUp, AlertCircle, Upload, FileText, X } from 'lucide-react';
import { format } from 'date-fns';
import { TaskPriority, SchoolYear } from '../../types';
import { Semester, SEMESTER_LABELS, getActiveSemester } from '../../utils/semesterUtils';

const taskSchema = z.object({
  schoolYearId: z.string().min(1, 'Vui lòng chọn năm học'),
  semester: z.enum(['HK1', 'HK2']),
  title: z.string().min(5, 'Tiêu đề phải có ít nhất 5 ký tự'),
  description: z.string().min(10, 'Mô tả phải có ít nhất 10 ký tự'),
  priority: z.enum(['low', 'medium', 'high']),
  maxScore: z.number().min(1).max(10),
  scoreDeadline1: z.number().min(0).max(100),
  scoreDeadline2: z.number().min(0).max(100),
  deadline: z.string().min(1, 'Vui lòng chọn deadline 1'),
  deadline2: z.string().min(1, 'Vui lòng chọn deadline 2'),
  assignedTo: z.array(z.string()).min(1, 'Phải chọn ít nhất 1 giáo viên'),
});

type TaskFormData = z.infer<typeof taskSchema>;

export const CreateTaskScreen = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Array<{ uid: string; displayName: string; email: string }>>([]);
  const [suggestions, setSuggestions] = useState<TeacherSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<Semester>('HK1');
  const [descriptionPdf, setDescriptionPdf] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      schoolYearId: '',
      semester: 'HK1',
      priority: 'medium',
      maxScore: 10,
      scoreDeadline1: 10,
      scoreDeadline2: 5,
      assignedTo: [],
    },
  });

  // Watch deadline to auto-fill deadline2
  const deadline = watch('deadline');

  // Auto-fill deadline2 when deadline changes (5 days after deadline1)
  useEffect(() => {
    if (deadline) {
      const deadline1Date = new Date(deadline);
      const deadline2Date = new Date(deadline1Date);
      deadline2Date.setDate(deadline2Date.getDate() + 5);
      setValue('deadline2', format(deadline2Date, 'yyyy-MM-dd'));
    }
  }, [deadline, setValue]);

  // Load teachers, suggestions, and school years
  useEffect(() => {
    const loadData = async () => {
      try {
        const [teachersData, suggestionsData, schoolYearsData, activeYear] = await Promise.all([
          taskService.getAllTeachers(),
          (async () => {
            setIsLoadingSuggestions(true);
            try {
              return await suggestionService.getRecommendedTeachers(10);
            } finally {
              setIsLoadingSuggestions(false);
            }
          })(),
          schoolYearService.getAllSchoolYears(),
          schoolYearService.getActiveSchoolYear(),
        ]);

        setTeachers(teachersData);
        setSuggestions(suggestionsData);
        setSchoolYears(schoolYearsData);

        // Default to active school year
        if (activeYear) {
          setSelectedSchoolYearId(activeYear.id);
          setValue('schoolYearId', activeYear.id, { shouldValidate: true });

          // Default to active semester (set by admin)
          if (activeYear.activeSemester) {
            setSelectedSemester(activeYear.activeSemester);
            setValue('semester', activeYear.activeSemester, { shouldValidate: true });
          }
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể tải dữ liệu',
        });
      }
    };
    loadData();
  }, []);

  // Handle PDF upload
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setDescriptionPdf(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPdfPreviewUrl(url);
    } else if (file) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Chỉ chấp nhận file PDF',
      });
    }
  };

  const handleRemovePdf = () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    setDescriptionPdf(null);
    setPdfPreviewUrl(null);
  };

  // Handle teacher selection
  const handleTeacherToggle = (teacherId: string) => {
    const newSelection = selectedTeachers.includes(teacherId)
      ? selectedTeachers.filter((id) => id !== teacherId)
      : [...selectedTeachers, teacherId];

    setSelectedTeachers(newSelection);
    setValue('assignedTo', newSelection);
  };

  // Quick select from suggestions
  const handleSelectSuggested = (teacherIds: string[]) => {
    setSelectedTeachers(teacherIds);
    setValue('assignedTo', teacherIds);
    toast({
      title: 'Đã chọn',
      description: `Đã chọn ${teacherIds.length} giáo viên được đề xuất`,
    });
  };

  // Select/deselect all teachers
  const handleSelectAll = () => {
    if (selectedTeachers.length === teachers.length) {
      // Deselect all
      setSelectedTeachers([]);
      setValue('assignedTo', []);
      toast({
        title: 'Đã bỏ chọn tất cả',
        description: 'Đã bỏ chọn tất cả giáo viên',
      });
    } else {
      // Select all
      const allTeacherIds = teachers.map(t => t.uid);
      setSelectedTeachers(allTeacherIds);
      setValue('assignedTo', allTeacherIds);
      toast({
        title: 'Đã chọn tất cả',
        description: `Đã chọn ${teachers.length} giáo viên`,
      });
    }
  };

  // Submit form
  const onSubmit = async (data: TaskFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const assignedToNames = teachers
        .filter((t) => data.assignedTo.includes(t.uid))
        .map((t) => t.displayName);

      // Upload PDF to Google Drive if present
      let descriptionPdfUrl: string | undefined;
      if (descriptionPdf) {
        try {
          // Get school year name
          const schoolYear = await schoolYearService.getSchoolYear(data.schoolYearId);
          if (!schoolYear) {
            throw new Error('Không tìm thấy năm học');
          }

          // Sanitize task title for folder name
          const sanitizeFileName = (str: string): string => {
            str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
            str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
            str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
            str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
            str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
            str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
            str = str.replace(/đ/g, "d");
            str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
            str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
            str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
            str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
            str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
            str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
            str = str.replace(/Đ/g, "D");
            str = str.replace(/\s+/g, "_");
            str = str.replace(/[^a-zA-Z0-9._-]/g, "_");
            return str;
          };

          const sanitizedTaskTitle = sanitizeFileName(data.title);

          // Upload PDF to Google Drive: [Năm học] cv / [Task title] / description.pdf
          const driveFile = await googleDriveServiceBackend.uploadFile({
            file: descriptionPdf,
            schoolYear: `${schoolYear.name} cv`,
            category: sanitizedTaskTitle,
          });

          descriptionPdfUrl = driveFile.webViewLink;
        } catch (uploadError) {
          console.error('Error uploading PDF:', uploadError);
          toast({
            variant: 'destructive',
            title: 'Lỗi upload PDF',
            description: 'Không thể upload file PDF. Vui lòng thử lại.',
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Build task data, only include descriptionPdfUrl if it exists
      const taskData: any = {
        schoolYearId: data.schoolYearId,
        semester: data.semester,
        title: data.title,
        description: data.description,
        priority: data.priority as TaskPriority,
        maxScore: data.maxScore,
        scoreDeadline1: data.scoreDeadline1,
        scoreDeadline2: data.scoreDeadline2,
        deadline: new Date(data.deadline),
        deadline2: new Date(data.deadline2),
        createdBy: user.uid,
        createdByName: user.displayName,
        assignedTo: data.assignedTo,
        assignedToNames,
      };

      // Only add descriptionPdfUrl if it was uploaded
      if (descriptionPdfUrl) {
        taskData.descriptionPdfUrl = descriptionPdfUrl;
      }

      const newTaskId = await taskService.createTask(taskData);

      // Send push notification to assigned teachers
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        await fetch(`${API_URL}/api/notifications/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'new_task',
            task: {
              id: newTaskId,
              title: data.title,
              priority: data.priority,
            },
            assignedTo: data.assignedTo,
          }),
        });
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
        // Don't fail the whole operation if notification fails
      }

      toast({
        title: 'Thành công',
        description: 'Đã tạo công việc mới',
      });

      navigate('/vp/tasks');
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tạo công việc',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWorkloadBadge = (status: string) => {
    switch (status) {
      case 'light':
        return <Badge className="bg-green-100 text-green-700">Nhẹ</Badge>;
      case 'moderate':
        return <Badge className="bg-yellow-100 text-yellow-700">Vừa</Badge>;
      case 'heavy':
        return <Badge className="bg-red-100 text-red-700">Nặng</Badge>;
      default:
        return null;
    }
  };

  const getPerformanceBadge = (status: string) => {
    switch (status) {
      case 'excellent':
        return <Badge className="bg-purple-100 text-purple-700">Xuất sắc</Badge>;
      case 'good':
        return <Badge className="bg-blue-100 text-blue-700">Tốt</Badge>;
      case 'average':
        return <Badge className="bg-gray-100 text-gray-700">TB</Badge>;
      case 'needs_improvement':
        return <Badge className="bg-orange-100 text-orange-700">Cần cải thiện</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Tạo công việc mới</h2>
        <p className="text-gray-600">Phân công công việc cho giáo viên với gợi ý thông minh</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Thông tin công việc</CardTitle>
                <CardDescription>Điền đầy đủ thông tin bên dưới</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* School Year */}
                <div className="space-y-2">
                  <Label htmlFor="schoolYear">Năm học *</Label>
                  <Select
                    key={selectedSchoolYearId || 'no-selection'}
                    value={selectedSchoolYearId}
                    onValueChange={(value) => {
                      setSelectedSchoolYearId(value);
                      setValue('schoolYearId', value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn năm học" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name} {year.isActive && '(Hiện tại)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.schoolYearId && (
                    <p className="text-sm text-red-600">{errors.schoolYearId.message}</p>
                  )}
                </div>

                {/* Semester */}
                <div className="space-y-2">
                  <Label htmlFor="semester">Học kỳ *</Label>
                  <Select
                    value={selectedSemester}
                    onValueChange={(value) => {
                      setSelectedSemester(value as Semester);
                      setValue('semester', value as Semester);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn học kỳ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HK1">{SEMESTER_LABELS.HK1}</SelectItem>
                      <SelectItem value="HK2">{SEMESTER_LABELS.HK2}</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.semester && (
                    <p className="text-sm text-red-600">{errors.semester.message}</p>
                  )}
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Tiêu đề *</Label>
                  <Input
                    id="title"
                    placeholder="Nhập tiêu đề công việc..."
                    {...register('title')}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-600">{errors.title.message}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Mô tả *</Label>
                  <Textarea
                    id="description"
                    placeholder="Mô tả chi tiết công việc..."
                    rows={4}
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>

                {/* PDF Upload */}
                <div className="space-y-2">
                  <Label htmlFor="pdfFile">File mô tả PDF (tùy chọn)</Label>
                  {!descriptionPdf ? (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                      <input
                        id="pdfFile"
                        type="file"
                        accept="application/pdf"
                        onChange={handlePdfUpload}
                        className="hidden"
                      />
                      <label htmlFor="pdfFile" className="cursor-pointer">
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">
                          Click để chọn file PDF
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          File PDF chứa mô tả chi tiết công việc
                        </p>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* File Info */}
                      <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{descriptionPdf.name}</p>
                          <p className="text-xs text-gray-500">
                            {(descriptionPdf.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePdf}
                          className="flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* PDF Preview */}
                      {pdfPreviewUrl && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-100 px-3 py-2 border-b">
                            <p className="text-sm font-medium">Xem trước PDF</p>
                          </div>
                          <iframe
                            src={pdfPreviewUrl}
                            className="w-full h-96"
                            title="PDF Preview"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Priority & Max Score */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Độ ưu tiên *</Label>
                    <Select
                      defaultValue="medium"
                      onValueChange={(value) => setValue('priority', value as TaskPriority)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Thấp</SelectItem>
                        <SelectItem value="medium">Trung bình</SelectItem>
                        <SelectItem value="high">Cao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxScore">Điểm tối đa *</Label>
                    <Input
                      id="maxScore"
                      type="number"
                      min="1"
                      max="10"
                      defaultValue="10"
                      {...register('maxScore', { valueAsNumber: true })}
                    />
                    {errors.maxScore && (
                      <p className="text-sm text-red-600">{errors.maxScore.message}</p>
                    )}
                  </div>
                </div>

                {/* Deadline 1 và Điểm */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline 1 *</Label>
                    <Input
                      id="deadline"
                      type="date"
                      min={format(new Date(), 'yyyy-MM-dd')}
                      {...register('deadline')}
                    />
                    {errors.deadline && (
                      <p className="text-sm text-red-600">{errors.deadline.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scoreDeadline1">Điểm hoàn thành Deadline 1 *</Label>
                    <Input
                      id="scoreDeadline1"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue="10"
                      {...register('scoreDeadline1', { valueAsNumber: true })}
                    />
                    {errors.scoreDeadline1 && (
                      <p className="text-sm text-red-600">{errors.scoreDeadline1.message}</p>
                    )}
                  </div>
                </div>

                {/* Deadline 2 và Điểm */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deadline2">Deadline 2 *</Label>
                    <Input
                      id="deadline2"
                      type="date"
                      min={deadline || format(new Date(), 'yyyy-MM-dd')}
                      {...register('deadline2')}
                    />
                    {errors.deadline2 && (
                      <p className="text-sm text-red-600">{errors.deadline2.message}</p>
                    )}
                    <p className="text-xs text-gray-500">Tự động điền 5 ngày sau deadline 1, có thể chỉnh sửa</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scoreDeadline2">Điểm hoàn thành Deadline 2 *</Label>
                    <Input
                      id="scoreDeadline2"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue="5"
                      {...register('scoreDeadline2', { valueAsNumber: true })}
                    />
                    {errors.scoreDeadline2 && (
                      <p className="text-sm text-red-600">{errors.scoreDeadline2.message}</p>
                    )}
                  </div>
                </div>

                {/* Assign Teachers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Phân công cho giáo viên * ({selectedTeachers.length} đã chọn)</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSelectAll}
                      disabled={teachers.length === 0}
                    >
                      {selectedTeachers.length === teachers.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </Button>
                  </div>
                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                    {teachers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Chưa có giáo viên nào
                      </p>
                    ) : (
                      teachers.map((teacher) => {
                        const suggestion = suggestions.find(s => s.uid === teacher.uid);
                        return (
                          <div
                            key={teacher.uid}
                            className="flex items-center space-x-2 p-3 hover:bg-gray-50 rounded border"
                          >
                            <Checkbox
                              id={teacher.uid}
                              checked={selectedTeachers.includes(teacher.uid)}
                              onCheckedChange={() => handleTeacherToggle(teacher.uid)}
                            />
                            <label
                              htmlFor={teacher.uid}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{teacher.displayName}</div>
                                  <div className="text-gray-500 text-xs">{teacher.email}</div>
                                </div>
                                {suggestion && (
                                  <div className="flex gap-1">
                                    {getWorkloadBadge(suggestion.workloadStatus)}
                                    {getPerformanceBadge(suggestion.performanceStatus)}
                                  </div>
                                )}
                              </div>
                              {suggestion && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {suggestion.reason}
                                </div>
                              )}
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {errors.assignedTo && (
                    <p className="text-sm text-red-600">{errors.assignedTo.message}</p>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang tạo...
                      </>
                    ) : (
                      'Tạo công việc'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/vp/tasks')}
                  >
                    Hủy
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Suggestions Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Gợi ý phân công
              </CardTitle>
              <CardDescription>
                Dựa trên điểm số và khối lượng công việc
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSuggestions ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-2">Đang phân tích...</p>
                </div>
              ) : suggestions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Chưa có dữ liệu để gợi ý
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Quick select buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSelectSuggested(suggestions.slice(0, 3).map(s => s.uid))}
                      className="flex-1"
                    >
                      Top 3
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSelectSuggested(suggestions.slice(0, 5).map(s => s.uid))}
                      className="flex-1"
                    >
                      Top 5
                    </Button>
                  </div>

                  {/* Suggestions list */}
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {suggestions.slice(0, 10).map((suggestion, index) => (
                      <div
                        key={suggestion.uid}
                        className={`p-3 rounded-lg border ${
                          selectedTeachers.includes(suggestion.uid)
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                            <div>
                              <p className="font-semibold text-sm">{suggestion.displayName}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <TrendingUp className="w-3 h-3 text-green-600" />
                                <span className="text-xs font-medium text-green-600">
                                  {suggestion.score}/100
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-gray-600">
                          <div className="flex justify-between">
                            <span>Điểm TB:</span>
                            <span className="font-medium">{suggestion.averageScore}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Đang làm:</span>
                            <span className="font-medium">{suggestion.pendingTasks} việc</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Hoàn thành:</span>
                            <span className="font-medium">{suggestion.completionRate}%</span>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {getWorkloadBadge(suggestion.workloadStatus)}
                          {getPerformanceBadge(suggestion.performanceStatus)}
                        </div>

                        <p className="text-xs text-gray-500 mt-2">{suggestion.reason}</p>

                        <Button
                          type="button"
                          size="sm"
                          variant={selectedTeachers.includes(suggestion.uid) ? 'secondary' : 'outline'}
                          className="w-full mt-2"
                          onClick={() => handleTeacherToggle(suggestion.uid)}
                        >
                          {selectedTeachers.includes(suggestion.uid) ? 'Đã chọn ✓' : 'Chọn'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Cách tính gợi ý:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Khối lượng công việc hiện tại</li>
                    <li>• Điểm trung bình so với toàn trường</li>
                    <li>• Tỷ lệ hoàn thành công việc</li>
                    <li>• Tỷ lệ nộp đúng hạn</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};