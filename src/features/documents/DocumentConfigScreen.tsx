import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { schoolYearService } from '@/services/schoolYearService';
import { documentCategoryService } from '@/services/documentCategoryService';
import { departmentService } from '@/services/departmentService';
import { userService, User } from '@/services/userService';
import { SchoolYear, DocumentCategory, DocumentSubCategory, Department } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  // Categories
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<'public' | 'personal'>('personal');
  const [categoryHasSubCats, setCategoryHasSubCats] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

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

  // Load school years
  useEffect(() => {
    loadSchoolYears();
  }, []);

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
  }, [activeTab]);

  const loadSchoolYears = async () => {
    try {
      setLoadingYears(true);
      const years = await schoolYearService.getAllSchoolYears();
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
    try {
      setLoadingCategories(true);
      const cats = await documentCategoryService.getCategoriesBySchoolYear(yearId);
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const depts = await departmentService.getAllDepartments();
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
    } else {
      // Create mode
      setEditingYearId(null);
      setYearName('');
      setYearStartDate('');
      setYearEndDate('');
      setYearIsActive(false);
    }
    setShowYearDialog(true);
  };

  const handleSaveYear = async () => {
    if (!yearName || !yearStartDate || !yearEndDate) {
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
        await schoolYearService.updateSchoolYear(editingYearId, {
          name: yearName,
          startDate: new Date(yearStartDate),
          endDate: new Date(yearEndDate),
          isActive: yearIsActive,
        });
        toast({ title: 'Thành công', description: 'Đã cập nhật năm học' });
      } else {
        // Create new year
        await schoolYearService.createSchoolYear({
          name: yearName,
          startDate: new Date(yearStartDate),
          endDate: new Date(yearEndDate),
          isActive: yearIsActive,
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

  const handleOpenCategoryDialog = (category?: DocumentCategory) => {
    if (category) {
      // Edit mode
      setEditingCategoryId(category.id);
      setCategoryName(category.name);
      setCategoryType(category.categoryType);
      setCategoryHasSubCats(category.hasSubCategories ?? false);
    } else {
      // Create mode
      setEditingCategoryId(null);
      setCategoryName('');
      setCategoryType('personal'); // Default to personal
      setCategoryHasSubCats(false);
    }
    setShowCategoryDialog(true);
  };

  const handleSaveCategoryDialog = async () => {
    if (!categoryName) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên danh mục',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingCategoryId) {
        // Update existing category
        await documentCategoryService.updateCategory(editingCategoryId, {
          name: categoryName,
          categoryType: categoryType,
          hasSubCategories: categoryHasSubCats,
        });
        toast({ title: 'Thành công', description: 'Đã cập nhật danh mục' });
      } else {
        // Create new category
        await documentCategoryService.createCategory({
          schoolYearId: selectedYearId,
          name: categoryName,
          categoryType: categoryType,
          hasSubCategories: categoryHasSubCats,
          order: categories.length,
          createdBy: user!.uid,
        });
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

  // ============ SUBCATEGORY FUNCTIONS ============

  const loadSubCategories = async (categoryId: string) => {
    try {
      const subs = await documentCategoryService.getSubCategories(categoryId);
      setSubCategories(subs);
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
    if (!subCategoryName) {
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
        await documentCategoryService.createSubCategory({
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
    try {
      const users = await userService.getAllUsers();
      const teachersAndHeads = users.filter(
        u => u.role === 'teacher' || u.role === 'department_head'
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
    if (!departmentName) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên tổ chuyên môn',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get head teacher info if selected
      let headTeacherName: string | undefined;
      if (selectedHeadTeacherId) {
        const headTeacher = availableUsers.find(u => u.uid === selectedHeadTeacherId);
        headTeacherName = headTeacher?.displayName;
      }

      if (editingDepartmentId) {
        // Update existing department
        await departmentService.updateDepartment(editingDepartmentId, {
          name: departmentName,
          memberIds: selectedMemberIds,
          headTeacherId: selectedHeadTeacherId || undefined,
          headTeacherName: headTeacherName,
        });
        toast({ title: 'Thành công', description: 'Đã cập nhật tổ chuyên môn' });
      } else {
        // Create new department
        await departmentService.createDepartment({
          name: departmentName,
          memberIds: selectedMemberIds,
          headTeacherId: selectedHeadTeacherId || undefined,
          headTeacherName: headTeacherName,
        });
        toast({ title: 'Thành công', description: 'Đã tạo tổ chuyên môn' });
      }

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="years">Năm học</TabsTrigger>
          <TabsTrigger value="categories">Danh mục hồ sơ</TabsTrigger>
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
                        {year.isActive && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                            Đang hoạt động
                          </span>
                        )}
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Danh mục hồ sơ</CardTitle>
              <div className="flex gap-2">
                <select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="border rounded px-3 py-2"
                >
                  <option value="">Chọn năm học</option>
                  {schoolYears.map(year => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!selectedYearId} onClick={handleOpenCategoryDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm danh mục
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
                      <div className="flex items-center justify-between p-4 hover:bg-gray-50">
                        <div className="flex-1 flex items-center gap-2">
                          {category.hasSubCategories && (
                            <button
                              onClick={() => handleToggleCategory(category.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              {expandedCategoryId === category.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{category.name}</h3>
                              <span className={`text-xs px-2 py-1 rounded ${
                                category.categoryType === 'public'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {category.categoryType === 'public' ? 'Công khai' : 'Cá nhân'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {category.hasSubCategories ? 'Có mục con' : 'Không có mục con'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {category.hasSubCategories && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenSubCategoryDialog(category.id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Thêm mục con
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenCategoryDialog(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      {/* SubCategories (when expanded) */}
                      {category.hasSubCategories && expandedCategoryId === category.id && (
                        <div className="border-t bg-gray-50 p-4">
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
                                  <div className="flex gap-2">
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
                  placeholder="Ví dụ: Kế hoạch giáo dục"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Loại danh mục <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50 cursor-pointer"
                       onClick={() => setCategoryType('personal')}>
                    <input
                      type="radio"
                      id="type-personal"
                      name="categoryType"
                      checked={categoryType === 'personal'}
                      onChange={() => setCategoryType('personal')}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <label htmlFor="type-personal" className="text-sm font-medium cursor-pointer">
                        Hồ sơ cá nhân
                      </label>
                      <p className="text-xs text-gray-500">
                        Giáo viên thấy của mình, tổ trưởng thấy cả tổ, BGH/Admin thấy toàn trường
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50 cursor-pointer"
                       onClick={() => setCategoryType('public')}>
                    <input
                      type="radio"
                      id="type-public"
                      name="categoryType"
                      checked={categoryType === 'public'}
                      onChange={() => setCategoryType('public')}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <label htmlFor="type-public" className="text-sm font-medium cursor-pointer">
                        Hồ sơ công khai
                      </label>
                      <p className="text-xs text-gray-500">
                        Chỉ Admin/Hiệu trưởng được tải lên, toàn trường có thể xem
                      </p>
                    </div>
                  </div>
                </div>
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
                <select
                  value={selectedHeadTeacherId}
                  onChange={(e) => setSelectedHeadTeacherId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Chọn tổ trưởng</option>
                  {availableUsers.map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.email})
                    </option>
                  ))}
                </select>
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
