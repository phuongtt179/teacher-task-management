import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { schoolYearService } from '@/services/schoolYearService';
import { documentCategoryService } from '@/services/documentCategoryService';
import { documentTypeService } from '@/services/documentTypeService';
import { departmentService } from '@/services/departmentService';
import { userService } from '@/services/userService';
import { SchoolYear, DocumentCategory, DocumentSubCategory, Department, DocumentType, User } from '@/types';
import { Semester, SEMESTER_LABELS } from '@/utils/semesterUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { weekSchedule, weekNumberOf, weekdayOf, isDateString, shortDate } from '@/lib/submissionDeadline';
import { DocumentTypesScreen } from '@/features/admin/DocumentTypesScreen';

export function DocumentConfigScreen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('years');

  // School Years
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [showYearDialog, setShowYearDialog] = useState(false);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [yearName, setYearName] = useState('');
  const [yearStartDate, setYearStartDate] = useState('');
  const [yearEndDate, setYearEndDate] = useState('');
  const [yearIsActive, setYearIsActive] = useState(false);
  const [yearActiveSemester, setYearActiveSemester] = useState<Semester | ''>('');

  // Categories
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<'public' | 'personal'>('personal');
  const [categoryDocumentTypeId, setCategoryDocumentTypeId] = useState<string>(''); // NEW: DocumentType selection
  const [categoryHasSubCats, setCategoryHasSubCats] = useState(false);
  // Hạn nộp chung (danh mục không chia mục con, vd Kế hoạch môn học) — 'YYYY-MM-DD' hoặc ''.
  const [categoryDeadline, setCategoryDeadline] = useState('');
  // Hạn nộp từng mục con đang sửa (subId → 'YYYY-MM-DD' | '') + ngày thứ Hai của Tuần 1 để tự điền.
  const [subDeadlines, setSubDeadlines] = useState<Record<string, string>>({});
  const [week1Monday, setWeek1Monday] = useState('');
  // Các tuần đầu năm gộp chung 1 hạn: tuần 1 → tuần này hạn = hết tuần này (bỏ trống = không gộp).
  const [mergeUntilWeek, setMergeUntilWeek] = useState('');
  const [subOpenFrom, setSubOpenFrom] = useState<Record<string, string>>({});
  const [savingDeadlines, setSavingDeadlines] = useState(false);
  const [categoryAllowedUploaders, setCategoryAllowedUploaders] = useState<string[]>([]);
  const [categoryViewPermissionType, setCategoryViewPermissionType] = useState<'everyone' | 'specific_users'>('everyone');
  const [categoryViewUserIds, setCategoryViewUserIds] = useState<string[]>([]);
  const [viewPermissionDepartmentFilter, setViewPermissionDepartmentFilter] = useState<string>(''); // For filtering users by department
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyTargetYearId, setCopyTargetYearId] = useState<string>('');
  const [copying, setCopying] = useState(false);

  // Document Types (NEW)
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loadingDocumentTypes, setLoadingDocumentTypes] = useState(false);

  // SubCategories
  const [subCategories, setSubCategories] = useState<DocumentSubCategory[]>([]);
  const [showSubCategoryDialog, setShowSubCategoryDialog] = useState(false);
  const [editingSubCategoryId, setEditingSubCategoryId] = useState<string | null>(null);
  const [subCategoryName, setSubCategoryName] = useState('');
  const [currentCategoryId, setCurrentCategoryId] = useState<string>('');

  // Departments
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedHeadTeacherId, setSelectedHeadTeacherId] = useState<string>('');

  const schoolId = user?.schoolId;

  // Load school years and document types
  useEffect(() => {
    if (!schoolId) return;
    loadSchoolYears();
    loadDocumentTypes();
  }, [schoolId]);

  // Load categories when year changes
  useEffect(() => {
    if (selectedYearId) {
      loadCategories(selectedYearId);
    }
  }, [selectedYearId]);

  // Load departments
  useEffect(() => {
    if (activeTab === 'departments') {
      loadDepartments();
    }
  }, [activeTab, schoolId]);

  const loadSchoolYears = async () => {
    if (!schoolId) return;
    try {
      setLoadingYears(true);
      const years = await schoolYearService.getAllSchoolYears(schoolId);
      setSchoolYears(years);

      // Auto-select active year
      const activeYear = years.find(y => y.isActive);
      if (activeYear) {
        setSelectedYearId(activeYear.id);
      }
    } catch (error) {
      console.error('Error loading school years:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách năm học',
        variant: 'destructive',
      });
    } finally {
      setLoadingYears(false);
    }
  };

  const loadCategories = async (yearId: string) => {
    if (!schoolId) return;
    try {
      setLoadingCategories(true);
      const cats = await documentCategoryService.getCategoriesBySchoolYear(schoolId, yearId);
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadDocumentTypes = async () => {
    if (!schoolId) return;
    try {
      setLoadingDocumentTypes(true);
      const types = await documentTypeService.getActiveDocumentTypes(schoolId);
      setDocumentTypes(types);
    } catch (error) {
      console.error('Error loading document types:', error);
    } finally {
      setLoadingDocumentTypes(false);
    }
  };

  const loadDepartments = async () => {
    if (!schoolId) return;
    try {
      setLoadingDepartments(true);
      const depts = await departmentService.getAllDepartments(schoolId);
      setDepartments(depts);
    } catch (error) {
      console.error('Error loading departments:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách tổ chuyên môn',
        variant: 'destructive',
      });
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleDeleteYear = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa năm học này?')) return;

    try {
      await schoolYearService.deleteSchoolYear(id);
      toast({ title: 'Thành công', description: 'Đã xóa năm học' });
      loadSchoolYears();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa năm học',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa danh mục này?')) return;

    try {
      await documentCategoryService.deleteCategory(id);
      toast({ title: 'Thành công', description: 'Đã xóa danh mục' });
      loadCategories(selectedYearId);
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa danh mục',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa tổ này?')) return;

    try {
      await departmentService.deleteDepartment(id);
      toast({ title: 'Thành công', description: 'Đã xóa tổ chuyên môn' });
      loadDepartments();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa tổ',
        variant: 'destructive',
      });
    }
  };

  // Handlers for adding items
  const handleOpenYearDialog = (year?: SchoolYear) => {
    if (year) {
      // Edit mode
      setEditingYearId(year.id);
      setYearName(year.name);
      setYearStartDate(year.startDate.toISOString().split('T')[0]);
      setYearEndDate(year.endDate.toISOString().split('T')[0]);
      setYearIsActive(year.isActive);
      setYearActiveSemester(year.activeSemester || '');
    } else {
      // Create mode
      setEditingYearId(null);
      setYearName('');
      setYearStartDate('');
      setYearEndDate('');
      setYearIsActive(false);
      setYearActiveSemester('');
    }
    setShowYearDialog(true);
  };

  const handleSaveYear = async () => {
    if (!yearName || !yearStartDate || !yearEndDate || !schoolId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền đầy đủ thông tin',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingYearId) {
        // Update existing year
        await schoolYearService.updateSchoolYear(schoolId, editingYearId, {
          name: yearName,
          startDate: new Date(yearStartDate),
          endDate: new Date(yearEndDate),
          isActive: yearIsActive,
          activeSemester: yearActiveSemester || undefined,
        });
        toast({ title: 'Thành công', description: 'Đã cập nhật năm học' });
      } else {
        // Create new year
        await schoolYearService.createSchoolYear(schoolId, {
          name: yearName,
          startDate: new Date(yearStartDate),
          endDate: new Date(yearEndDate),
          isActive: yearIsActive,
          activeSemester: yearActiveSemester || undefined,
          createdBy: user!.uid,
        });
        toast({ title: 'Thành công', description: 'Đã tạo năm học mới' });
      }

      // Close dialog first, then reload
      setShowYearDialog(false);

      // Reload after a short delay to ensure dialog is closed
      setTimeout(() => {
        loadSchoolYears();
      }, 100);
    } catch (error) {
      console.error('Error saving school year:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể lưu năm học: ' + (error as Error).message,
        variant: 'destructive',
      });
      // Still close dialog even if error
      setShowYearDialog(false);
    }
  };

  const handleOpenCategoryDialog = async (category?: DocumentCategory) => {
    if (!schoolId) return;
    // Load document types first
    try {
      setLoadingDocumentTypes(true);
      const types = await documentTypeService.getAllDocumentTypes(schoolId);
      setDocumentTypes(types);
    } catch (error) {
      console.error('Error loading document types:', error);
    } finally {
      setLoadingDocumentTypes(false);
    }

    if (category) {
      // Edit mode
      setEditingCategoryId(category.id);
      setCategoryName(category.name);
      setCategoryDocumentTypeId(category.documentTypeId || '');
      setCategoryHasSubCats(category.hasSubCategories ?? false);
      setCategoryDeadline(category.deadline || '');
    } else {
      // Create mode
      setEditingCategoryId(null);
      setCategoryName('');
      setCategoryDocumentTypeId('');
      setCategoryHasSubCats(false);
      setCategoryDeadline('');
    }

    setShowCategoryDialog(true);
  };

  const handleSaveCategoryDialog = async () => {
    if (!categoryName || !schoolId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên danh mục',
        variant: 'destructive',
      });
      return;
    }

    if (!categoryDocumentTypeId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn loại hồ sơ',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingCategoryId) {
        // Update existing category
        const updateData: any = {
          name: categoryName,
          documentTypeId: categoryDocumentTypeId,
          hasSubCategories: categoryHasSubCats,
          // Hạn chung chỉ dùng cho danh mục không chia mục con (có mục con thì hạn đặt theo từng mục).
          deadline: !categoryHasSubCats && isDateString(categoryDeadline) ? categoryDeadline : null,
        };

        await documentCategoryService.updateCategory(editingCategoryId, updateData);
        toast({ title: 'Thành công', description: 'Đã cập nhật danh mục' });
      } else {
        // Create new category
        const createData: any = {
          schoolYearId: selectedYearId,
          name: categoryName,
          documentTypeId: categoryDocumentTypeId,
          hasSubCategories: categoryHasSubCats,
          order: categories.length,
          createdBy: user!.uid,
        };

        const newCategoryId = await documentCategoryService.createCategory(schoolId, createData);
        if (!categoryHasSubCats && isDateString(categoryDeadline)) {
          await documentCategoryService.updateCategory(newCategoryId, { deadline: categoryDeadline });
        }
        toast({ title: 'Thành công', description: 'Đã tạo danh mục mới' });
      }

      // Close dialog first, then reload
      setShowCategoryDialog(false);

      // Reload after a short delay to ensure dialog is closed
      setTimeout(() => {
        loadCategories(selectedYearId);
      }, 100);
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể lưu danh mục: ' + (error as Error).message,
        variant: 'destructive',
      });
      // Still close dialog even if error
      setShowCategoryDialog(false);
    }
  };

  const handleOpenCopyDialog = () => {
    setCopyTargetYearId('');
    setShowCopyDialog(true);
  };

  const handleCopyCategories = async () => {
    if (!copyTargetYearId || !schoolId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn năm học đích',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCopying(true);
      const count = await documentCategoryService.copyCategoriesToSchoolYear(
        schoolId,
        selectedYearId,
        copyTargetYearId,
        user!.uid
      );
      toast({
        title: 'Thành công',
        description: `Đã sao chép ${count} danh mục sang năm học mới`,
      });
      setShowCopyDialog(false);

      if (copyTargetYearId === selectedYearId) {
        loadCategories(selectedYearId);
      }
    } catch (error) {
      console.error('Error copying categories:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể sao chép danh mục: ' + (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setCopying(false);
    }
  };

  // ============ SUBCATEGORY FUNCTIONS ============

  const loadSubCategories = async (categoryId: string) => {
    if (!schoolId) return;
    try {
      const subs = await documentCategoryService.getSubCategories(schoolId, categoryId);
      // Mục con dạng "Tuần N" xếp theo số tuần (trường order cũ không đáng tin).
      const rank = (x: DocumentSubCategory) => weekNumberOf(x.name) ?? 10000 + (x.order ?? 0);
      setSubCategories([...subs].sort((a, b) => rank(a) - rank(b)));
      setSubDeadlines(Object.fromEntries(subs.map(x => [x.id, x.deadline || ''])));
      setSubOpenFrom(Object.fromEntries(subs.map(x => [x.id, x.openFrom || ''])));
      setWeek1Monday('');
    } catch (error) {
      console.error('Error loading subcategories:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh mục con',
        variant: 'destructive',
      });
    }
  };

  const handleToggleCategory = async (categoryId: string) => {
    if (expandedCategoryId === categoryId) {
      setExpandedCategoryId(null);
      setSubCategories([]);
    } else {
      setExpandedCategoryId(categoryId);
      await loadSubCategories(categoryId);
    }
  };

  // Tự điền: mục con "Tuần N" → hạn = Chủ nhật tuần N−1, mở từ thứ Hai tuần N−1 (nộp trước 1
  // tuần); các tuần <= "gộp đến tuần" có chung hạn = hết tuần đó và không khóa (xem weekSchedule).
  // Chỉ điền vào ô, chưa lưu — sửa tay các tuần nghỉ (Tết...) rồi bấm "Lưu hạn nộp".
  const handleAutoFillDeadlines = () => {
    if (!isDateString(week1Monday)) {
      toast({ title: 'Chọn ngày thứ Hai của Tuần 1 trước', variant: 'destructive' });
      return;
    }
    if (weekdayOf(week1Monday) !== 1) {
      toast({ title: 'Ngày đã chọn không phải thứ Hai', description: 'Các mốc vẫn được tính từ ngày đó, mỗi tuần cộng 7 ngày.' });
    }
    const merge = mergeUntilWeek.trim() ? Number(mergeUntilWeek) : null;
    if (merge !== null && (!Number.isInteger(merge) || merge < 1)) {
      toast({ title: 'Số tuần gộp hạn không hợp lệ', variant: 'destructive' });
      return;
    }
    let filled = 0;
    const nextDeadlines = { ...subDeadlines };
    const nextOpen = { ...subOpenFrom };
    subCategories.forEach(sub => {
      const week = weekNumberOf(sub.name);
      if (!week) return;
      const plan = weekSchedule(week1Monday, week, merge);
      nextDeadlines[sub.id] = plan.deadline;
      nextOpen[sub.id] = plan.openFrom || '';
      filled++;
    });
    setSubDeadlines(nextDeadlines);
    setSubOpenFrom(nextOpen);
    toast({ title: 'Đã điền hạn cho ' + filled + ' mục con', description: 'Kiểm tra lại các tuần nghỉ rồi bấm "Lưu hạn nộp".' });
  };

  const changedSubDeadlines = subCategories.filter(sub =>
    (subDeadlines[sub.id] || '') !== (sub.deadline || '') || (subOpenFrom[sub.id] || '') !== (sub.openFrom || ''));

  const handleSaveSubDeadlines = async () => {
    if (changedSubDeadlines.length === 0) return;
    try {
      setSavingDeadlines(true);
      await documentCategoryService.setSubCategoryDeadlines(
        changedSubDeadlines.map(sub => ({
          id: sub.id,
          deadline: isDateString(subDeadlines[sub.id]) ? subDeadlines[sub.id] : null,
          openFrom: isDateString(subOpenFrom[sub.id]) ? subOpenFrom[sub.id] : null,
        }))
      );
      toast({ title: 'Đã lưu hạn nộp cho ' + changedSubDeadlines.length + ' mục con' });
      if (expandedCategoryId) await loadSubCategories(expandedCategoryId);
    } catch (error) {
      console.error('Error saving deadlines:', error);
      toast({ title: 'Không lưu được hạn nộp', variant: 'destructive' });
    } finally {
      setSavingDeadlines(false);
    }
  };

  const handleOpenSubCategoryDialog = (categoryId: string, subCategory?: DocumentSubCategory) => {
    setCurrentCategoryId(categoryId);
    if (subCategory) {
      setEditingSubCategoryId(subCategory.id);
      setSubCategoryName(subCategory.name);
    } else {
      setEditingSubCategoryId(null);
      setSubCategoryName('');
    }
    setShowSubCategoryDialog(true);
  };

  const handleSaveSubCategoryDialog = async () => {
    if (!subCategoryName || !schoolId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên danh mục con',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingSubCategoryId) {
        await documentCategoryService.updateSubCategory(editingSubCategoryId, {
          name: subCategoryName,
        });
        toast({ title: 'Thành công', description: 'Đã cập nhật danh mục con' });
      } else {
        await documentCategoryService.createSubCategory(schoolId, {
          categoryId: currentCategoryId,
          name: subCategoryName,
          order: subCategories.length,
        });
        toast({ title: 'Thành công', description: 'Đã tạo danh mục con mới' });
      }

      setShowSubCategoryDialog(false);
      await loadSubCategories(currentCategoryId);
    } catch (error) {
      console.error('Error saving subcategory:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể lưu danh mục con',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSubCategory = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa danh mục con này?')) return;

    try {
      await documentCategoryService.deleteSubCategory(id);
      toast({ title: 'Thành công', description: 'Đã xóa danh mục con' });
      await loadSubCategories(currentCategoryId);
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa danh mục con',
        variant: 'destructive',
      });
    }
  };

  // ============ DEPARTMENT FUNCTIONS ============

  const handleOpenDepartmentDialog = async (department?: Department) => {
    // Reset state first
    if (department) {
      // Edit mode
      setEditingDepartmentId(department.id);
      setDepartmentName(department.name);
      setSelectedMemberIds(department.memberIds || []);
      setSelectedHeadTeacherId(department.headTeacherId || '');
    } else {
      // Create mode
      setEditingDepartmentId(null);
      setDepartmentName('');
      setSelectedMemberIds([]);
      setSelectedHeadTeacherId('');
    }

    // Show dialog first with current state
    setShowDepartmentDialog(true);

    // Then load available users (teachers and department heads)
    if (!schoolId) return;
    try {
      const users = await userService.getAllUsers(schoolId);
      const teachersAndHeads = users.filter(
        u => u.role === 'teacher' || u.role === 'department_head' || u.role === 'deputy_department_head'
      );
      setAvailableUsers(teachersAndHeads);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách giáo viên',
        variant: 'destructive',
      });
    }
  };

  const handleSaveDepartmentDialog = async () => {
    if (!departmentName || !schoolId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên tổ chuyên môn',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Tổ trưởng KHÔNG đổi ở đây — chỉ admin đổi ở "Quản lý người dùng" (đổi luôn vai trò của
      // người đó cho khớp). Trước đây đặt tổ trưởng ở đây chỉ ghi vào tổ, tài khoản vẫn là
      // giáo viên nên không có quyền tổ trưởng.
      const previousMembers = editingDepartmentId
        ? departments.find(d => d.id === editingDepartmentId)?.memberIds || []
        : [];
      let departmentId = editingDepartmentId;
      if (editingDepartmentId) {
        await departmentService.updateDepartment(editingDepartmentId, {
          name: departmentName,
          memberIds: selectedMemberIds,
        });
      } else {
        departmentId = await departmentService.createDepartment(schoolId, {
          name: departmentName,
          memberIds: selectedMemberIds,
        });
      }

      // Người vừa được thêm vào tổ này → gỡ khỏi tổ cũ (mỗi người chỉ thuộc 1 tổ). Trước đây
      // không gỡ nên người chuyển tổ vẫn còn ở tổ cũ, tổ trưởng tổ cũ vẫn thấy họ.
      const added = selectedMemberIds.filter(uid => !previousMembers.includes(uid));
      for (const uid of added) {
        await departmentService.setUserDepartment(schoolId, uid, departmentId, { clearHeadOfOthers: user?.role === 'admin' });
      }
      toast({ title: 'Thành công', description: editingDepartmentId ? 'Đã cập nhật tổ chuyên môn' : 'Đã tạo tổ chuyên môn' });

      // Close dialog first, then reload
      setShowDepartmentDialog(false);

      // Reload after a short delay to ensure dialog is closed
      setTimeout(() => {
        loadDepartments();
      }, 100);
    } catch (error) {
      console.error('Error saving department:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể lưu tổ chuyên môn: ' + (error as Error).message,
        variant: 'destructive',
      });
      // Still close dialog even if error
      setShowDepartmentDialog(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Cấu hình Hồ sơ điện tử</h1>
        <p className="text-gray-600 mt-2">
          Quản lý năm học, danh mục và tổ chuyên môn
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="years">Năm học</TabsTrigger>
          <TabsTrigger value="categories">Danh mục hồ sơ</TabsTrigger>
          <TabsTrigger value="document-types">Loại hồ sơ</TabsTrigger>
          <TabsTrigger value="departments">Tổ chuyên môn</TabsTrigger>
        </TabsList>

        {/* SCHOOL YEARS TAB */}
        <TabsContent value="years">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Năm học</CardTitle>
              <Button size="sm" onClick={() => handleOpenYearDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm năm học
              </Button>
            </CardHeader>
            <CardContent>
              {loadingYears ? (
                <p className="text-center py-8 text-gray-500">Đang tải...</p>
              ) : schoolYears.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Chưa có năm học nào</p>
              ) : (
                <div className="space-y-2">
                  {schoolYears.map(year => (
                    <div
                      key={year.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{year.name}</h3>
                        <p className="text-sm text-gray-600">
                          {year.startDate.toLocaleDateString('vi-VN')} - {year.endDate.toLocaleDateString('vi-VN')}
                        </p>
                        <div className="flex gap-2 mt-1">
                          {year.isActive && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Đang hoạt động
                            </span>
                          )}
                          {year.activeSemester && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {SEMESTER_LABELS[year.activeSemester]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenYearDialog(year)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteYear(year.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIES TAB */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Danh mục hồ sơ</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="border rounded px-3 py-2 text-sm md:text-base"
                >
                  <option value="">Chọn năm học</option>
                  {schoolYears.map(year => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!selectedYearId} onClick={() => handleOpenCategoryDialog()} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm danh mục
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedYearId || categories.length === 0}
                  onClick={handleOpenCopyDialog}
                  className="w-full sm:w-auto"
                >
                  Sao chép sang năm khác
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedYearId ? (
                <p className="text-center py-8 text-gray-500">Vui lòng chọn năm học</p>
              ) : loadingCategories ? (
                <p className="text-center py-8 text-gray-500">Đang tải...</p>
              ) : categories.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Chưa có danh mục nào</p>
              ) : (
                <div className="space-y-2">
                  {categories.map(category => (
                    <div key={category.id} className="border rounded-lg">
                      {/* Category Header */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 md:p-4 hover:bg-gray-50">
                        <div className="flex-1 flex items-start md:items-center gap-2">
                          {category.hasSubCategories && (
                            <button
                              onClick={() => handleToggleCategory(category.id)}
                              className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                            >
                              {expandedCategoryId === category.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm md:text-base">{category.name}</h3>
                              {/* Show DocumentType name if available, otherwise show legacy categoryType */}
                              {category.documentTypeId ? (
                                <span className="text-[10px] md:text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-800 flex-shrink-0">
                                  {documentTypes.find(dt => dt.id === category.documentTypeId)?.name || 'DocumentType'}
                                </span>
                              ) : (
                                <span className={`text-[10px] md:text-xs px-2 py-1 rounded flex-shrink-0 ${
                                  category.categoryType === 'public'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {category.categoryType === 'public' ? 'Công khai (Cũ)' : 'Cá nhân (Cũ)'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs md:text-sm text-gray-600">
                              {category.hasSubCategories ? 'Có mục con' : 'Không có mục con'}
                              {!category.hasSubCategories && category.deadline ? ' · Hạn nộp ' + shortDate(category.deadline) + '/' + category.deadline.slice(0, 4) : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 md:gap-2 flex-wrap">
                          {category.hasSubCategories && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenSubCategoryDialog(category.id)}
                              className="h-8 md:h-9 text-xs"
                            >
                              <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                              <span className="hidden sm:inline">Thêm mục con</span>
                              <span className="sm:hidden">Mục con</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenCategoryDialog(category)}
                            className="h-8 md:h-9"
                          >
                            <Pencil className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                            className="h-8 md:h-9"
                          >
                            <Trash2 className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      {/* SubCategories (when expanded) */}
                      {category.hasSubCategories && expandedCategoryId === category.id && (
                        <div className="border-t bg-gray-50 p-4">
                          {subCategories.length > 0 && (
                            <div className="mb-3 p-3 bg-white border rounded space-y-2">
                              <p className="text-sm font-medium">Hạn nộp theo tuần</p>
                              <p className="text-xs text-gray-500">
                                "Mở từ": trước ngày này giáo viên chưa nộp được tuần đó (admin, BGH vẫn nộp được); bỏ trống = luôn mở.
                                "Hạn": hết ngày này còn đúng hạn, nộp từ hôm sau là TRỄ (vẫn cho nộp bù); bỏ trống = không theo dõi trễ.
                              </p>
                              <p className="text-xs text-gray-500">
                                Tự điền: kế hoạch Tuần N mở từ thứ Hai tuần N−1, hạn hết Chủ nhật tuần N−1. Các tuần từ 1 đến
                                tuần "gộp hạn" dùng chung hạn = hết tuần đó và không khóa.
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-gray-600">Thứ Hai của Tuần 1:</span>
                                <input
                                  type="date"
                                  value={week1Monday}
                                  onChange={(e) => setWeek1Monday(e.target.value)}
                                  className="border rounded px-2 py-1 text-sm"
                                />
                                <span className="text-sm text-gray-600">Gộp hạn tuần 1 đến tuần:</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={mergeUntilWeek}
                                  onChange={(e) => setMergeUntilWeek(e.target.value)}
                                  placeholder="(không)"
                                  className="border rounded px-2 py-1 text-sm w-20"
                                />
                                <Button type="button" variant="outline" size="sm" onClick={handleAutoFillDeadlines}>
                                  Tự điền theo tuần
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleSaveSubDeadlines}
                                  disabled={changedSubDeadlines.length === 0 || savingDeadlines}
                                >
                                  {savingDeadlines ? 'Đang lưu...' : 'Lưu hạn nộp' + (changedSubDeadlines.length ? ' (' + changedSubDeadlines.length + ')' : '')}
                                </Button>
                              </div>
                            </div>
                          )}
                          {subCategories.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                              Chưa có mục con nào
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {subCategories.map(sub => (
                                <div
                                  key={sub.id}
                                  className="flex items-center justify-between p-3 bg-white border rounded"
                                >
                                  <div className="flex items-center gap-2">
                                    <List className="h-4 w-4 text-gray-400" />
                                    <span className="font-medium">{sub.name}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <label className="text-xs text-gray-500 hidden sm:inline">Mở từ</label>
                                    <input
                                      type="date"
                                      value={subOpenFrom[sub.id] || ''}
                                      onChange={(e) => setSubOpenFrom(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                      className={'border rounded px-2 py-1 text-sm ' + ((subOpenFrom[sub.id] || '') !== (sub.openFrom || '') ? 'border-amber-400 bg-amber-50' : '')}
                                    />
                                    <label className="text-xs text-gray-500 hidden sm:inline">Hạn</label>
                                    <input
                                      type="date"
                                      value={subDeadlines[sub.id] || ''}
                                      onChange={(e) => setSubDeadlines(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                      className={'border rounded px-2 py-1 text-sm ' + ((subDeadlines[sub.id] || '') !== (sub.deadline || '') ? 'border-amber-400 bg-amber-50' : '')}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenSubCategoryDialog(category.id, sub)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteSubCategory(sub.id)}
                                    >
                                      <Trash2 className="h-3 w-3 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENT TYPES TAB */}
        <TabsContent value="document-types">
          <DocumentTypesScreen />
        </TabsContent>

        {/* DEPARTMENTS TAB */}
        <TabsContent value="departments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tổ chuyên môn</CardTitle>
              <Button size="sm" onClick={() => handleOpenDepartmentDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm tổ
              </Button>
            </CardHeader>
            <CardContent>
              {loadingDepartments ? (
                <p className="text-center py-8 text-gray-500">Đang tải...</p>
              ) : departments.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Chưa có tổ nào</p>
              ) : (
                <div className="space-y-2">
                  {departments.map(dept => (
                    <div
                      key={dept.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{dept.name}</h3>
                        <p className="text-sm text-gray-600">
                          Tổ trưởng: {dept.headTeacherName || 'Chưa có'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Số thành viên: {dept.memberIds.length}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDepartmentDialog(dept)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDepartment(dept.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add School Year Dialog */}
      {showYearDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowYearDialog(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              {editingYearId ? 'Sửa năm học' : 'Thêm năm học mới'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tên năm học <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={yearName}
                  onChange={(e) => setYearName(e.target.value)}
                  placeholder="Ví dụ: Năm học 2024-2025"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Ngày bắt đầu <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={yearStartDate}
                  onChange={(e) => setYearStartDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Ngày kết thúc <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={yearEndDate}
                  onChange={(e) => setYearEndDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={yearIsActive}
                  onChange={(e) => setYearIsActive(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  Đang hoạt động
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Học kỳ đang hoạt động
                </label>
                <select
                  value={yearActiveSemester}
                  onChange={(e) => setYearActiveSemester(e.target.value as Semester | '')}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Chưa chọn</option>
                  <option value="HK1">{SEMESTER_LABELS.HK1}</option>
                  <option value="HK2">{SEMESTER_LABELS.HK2}</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Học kỳ mặc định khi tạo nhiệm vụ hoặc xem thống kê
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleSaveYear}
                className="flex-1"
              >
                Lưu
              </Button>
              <Button
                onClick={() => setShowYearDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Dialog */}
      {showCategoryDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowCategoryDialog(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              {editingCategoryId ? 'Sửa danh mục' : 'Thêm danh mục mới'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tên danh mục <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Ví dụ: Kế hoạch bài dạy"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Loại hồ sơ <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">(Tính năng mới)</span>
                </label>
                <select
                  value={categoryDocumentTypeId}
                  onChange={(e) => setCategoryDocumentTypeId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- Chọn loại hồ sơ --</option>
                  {documentTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Chọn loại hồ sơ để tự động kế thừa quyền quản lý quyền theo vai trò. Bỏ qua nếu muốn dùng cách cũ (Hồ sơ cá nhân/công khai).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasSubCats"
                  checked={categoryHasSubCats}
                  onChange={(e) => setCategoryHasSubCats(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="hasSubCats" className="text-sm font-medium">
                  Có mục con
                </label>
              </div>

              {!categoryHasSubCats && (
                <div>
                  <label className="block text-sm font-medium mb-1">Hạn nộp (tùy chọn)</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={categoryDeadline}
                      onChange={(e) => setCategoryDeadline(e.target.value)}
                      className="flex-1 border rounded px-3 py-2"
                    />
                    {categoryDeadline && (
                      <Button type="button" variant="outline" onClick={() => setCategoryDeadline('')}>Bỏ hạn</Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Nộp sau ngày này bị đánh dấu TRỄ ở màn "Theo dõi nộp hồ sơ". Danh mục có mục con thì đặt hạn theo từng mục con.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleSaveCategoryDialog}
                className="flex-1"
              >
                Lưu
              </Button>
              <Button
                onClick={() => setShowCategoryDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Categories Dialog */}
      {showCopyDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowCopyDialog(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Sao chép danh mục sang năm học khác</h2>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Sẽ sao chép toàn bộ {categories.length} danh mục (và mục con) từ năm học{' '}
                <strong>{schoolYears.find(y => y.id === selectedYearId)?.name}</strong> sang năm học đích bên dưới.
                Danh mục ở năm học nguồn vẫn được giữ nguyên.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Năm học đích <span className="text-red-500">*</span>
                </label>
                <select
                  value={copyTargetYearId}
                  onChange={(e) => setCopyTargetYearId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- Chọn năm học --</option>
                  {schoolYears
                    .filter(y => y.id !== selectedYearId)
                    .map(year => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleCopyCategories}
                disabled={!copyTargetYearId || copying}
                className="flex-1"
              >
                {copying ? 'Đang sao chép...' : 'Sao chép'}
              </Button>
              <Button
                onClick={() => setShowCopyDialog(false)}
                variant="outline"
                className="flex-1"
                disabled={copying}
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit SubCategory Dialog */}
      {showSubCategoryDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowSubCategoryDialog(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              {editingSubCategoryId ? 'Sửa danh mục con' : 'Thêm danh mục con mới'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tên danh mục con <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subCategoryName}
                  onChange={(e) => setSubCategoryName(e.target.value)}
                  placeholder="Ví dụ: Tổ 1 - Toán Lý, Học kỳ 1..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleSaveSubCategoryDialog}
                disabled={!subCategoryName}
                className="flex-1"
              >
                Lưu
              </Button>
              <Button
                onClick={() => setShowSubCategoryDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Department Dialog */}
      {showDepartmentDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowDepartmentDialog(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              {editingDepartmentId ? 'Sửa tổ chuyên môn' : 'Thêm tổ chuyên môn mới'}
            </h2>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tên tổ chuyên môn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="Ví dụ: Tổ Toán - Tin"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Tổ trưởng
                </label>
                <div className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-700">
                  {availableUsers.find(u => u.uid === selectedHeadTeacherId)?.displayName || 'Chưa có'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Chỉ admin đổi tổ trưởng, ở mục "Quản lý người dùng" (chọn vai trò Tổ trưởng và tổ).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Thành viên
                </label>
                <div className="border rounded px-3 py-2 max-h-48 overflow-y-auto space-y-2">
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-gray-500">Đang tải danh sách giáo viên...</p>
                  ) : (
                    availableUsers.map(u => (
                      <div key={u.uid} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`member-${u.uid}`}
                          checked={selectedMemberIds.includes(u.uid)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMemberIds([...selectedMemberIds, u.uid]);
                            } else {
                              setSelectedMemberIds(selectedMemberIds.filter(id => id !== u.uid));
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`member-${u.uid}`} className="text-sm cursor-pointer flex-1">
                          {u.displayName}
                          <span className="text-gray-500 ml-1">({u.email})</span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Đã chọn: {selectedMemberIds.length} thành viên
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleSaveDepartmentDialog}
                className="flex-1"
              >
                Lưu
              </Button>
              <Button
                onClick={() => setShowDepartmentDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
