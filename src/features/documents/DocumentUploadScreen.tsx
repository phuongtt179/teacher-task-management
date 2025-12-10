import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { documentService } from '@/services/documentService';
import { schoolYearService } from '@/services/schoolYearService';
import { documentCategoryService } from '@/services/documentCategoryService';
import { departmentService } from '@/services/departmentService';
import { SchoolYear, DocumentCategory, DocumentSubCategory, Department } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function DocumentUploadScreen() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [subCategories, setSubCategories] = useState<DocumentSubCategory[]>([]);
  const [userDepartment, setUserDepartment] = useState<Department | null>(null);

  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadSchoolYears();
    loadUserDepartment();
  }, [user]);

  useEffect(() => {
    if (selectedYearId) {
      loadCategories(selectedYearId);
    }
  }, [selectedYearId]);

  useEffect(() => {
    if (selectedCategoryId) {
      const category = categories.find(c => c.id === selectedCategoryId);
      if (category?.hasSubCategories) {
        loadSubCategories(selectedCategoryId);
      } else {
        setSubCategories([]);
      }
    }
  }, [selectedCategoryId]);

  const loadSchoolYears = async () => {
    try {
      const years = await schoolYearService.getAllSchoolYears();
      setSchoolYears(years);
      const activeYear = years.find(y => y.isActive);
      if (activeYear) {
        setSelectedYearId(activeYear.id);
      }
    } catch (error) {
      console.error('Error loading school years:', error);
    }
  };

  const loadCategories = async (yearId: string) => {
    try {
      const cats = await documentCategoryService.getCategoriesBySchoolYear(yearId);
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSubCategories = async (categoryId: string) => {
    try {
      const subs = await documentCategoryService.getSubCategories(categoryId);
      setSubCategories(subs);
    } catch (error) {
      console.error('Error loading subcategories:', error);
    }
  };

  const loadUserDepartment = async () => {
    if (!user) return;
    try {
      const dept = await departmentService.getDepartmentByUserId(user.uid);
      setUserDepartment(dept);
    } catch (error) {
      console.error('Error loading user department:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!documentTitle.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên hồ sơ',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedFile || !selectedYearId || !selectedCategoryId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn đầy đủ thông tin và file',
        variant: 'destructive',
      });
      return;
    }

    const category = categories.find(c => c.id === selectedCategoryId);
    if (category?.hasSubCategories && !selectedSubCategoryId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn mục con',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);

      // TODO: Upload to Google Drive first, get driveFileId and driveFileUrl
      // For now, just create metadata without actual file upload

      // Determine status based on role
      let status: 'pending' | 'approved' = 'pending';
      if (user?.role === 'admin' || user?.role === 'vice_principal') {
        status = 'approved'; // Admin/VP uploads are auto-approved
      }

      await documentService.createDocument({
        schoolYearId: selectedYearId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId || undefined,
        title: documentTitle.trim(),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        uploadedBy: user!.uid,
        uploadedByName: user!.displayName,
        departmentId: userDepartment?.id,
        isPublic: false,
        status,
      });

      toast({
        title: 'Thành công',
        description:
          status === 'approved'
            ? 'Hồ sơ đã được tải lên'
            : 'Hồ sơ đã được tải lên và đang chờ phê duyệt',
      });

      // Reset form
      setDocumentTitle('');
      setSelectedFile(null);
      setSelectedCategoryId('');
      setSelectedSubCategoryId('');
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải lên hồ sơ',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Upload Hồ sơ</h1>
        <p className="text-gray-600 mt-2">Tải lên hồ sơ điện tử mới</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin hồ sơ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Year Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Năm học <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Chọn năm học</option>
              {schoolYears.map(year => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Danh mục <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={!selectedYearId}
            >
              <option value="">Chọn danh mục</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sub-Category Selection */}
          {subCategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Mục con <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSubCategoryId}
                onChange={(e) => setSelectedSubCategoryId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Chọn mục con</option>
                {subCategories.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Document Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tên hồ sơ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="VD: Kế hoạch môn học tuần 1, Kế hoạch giáo dục..."
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              File <span className="text-red-500">*</span>
            </label>
            <input
              id="file-input"
              type="file"
              onChange={handleFileChange}
              className="w-full border rounded px-3 py-2"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600">
                Đã chọn: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-800">
              <strong>Lưu ý:</strong>{' '}
              {user?.role === 'teacher'
                ? 'Hồ sơ của bạn sẽ cần được tổ trưởng phê duyệt trước khi hiển thị.'
                : 'Hồ sơ của bạn sẽ được hiển thị ngay sau khi tải lên.'}
            </p>
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!documentTitle.trim() || !selectedFile || uploading}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Đang tải lên...' : 'Tải lên'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
