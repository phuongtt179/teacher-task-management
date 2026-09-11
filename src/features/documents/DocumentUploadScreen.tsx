import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { documentService } from '@/services/documentService';
import { schoolYearService } from '@/services/schoolYearService';
import { documentCategoryService } from '@/services/documentCategoryService';
import { documentTypeService } from '@/services/documentTypeService';
import { departmentService } from '@/services/departmentService';
import { campusService } from '@/services/campusService';
import { googleDriveServiceBackend } from '@/services/googleDriveServiceBackend';
import { SchoolYear, DocumentCategory, DocumentSubCategory, Department, DocumentType, Campus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function DocumentUploadScreen() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [subCategories, setSubCategories] = useState<DocumentSubCategory[]>([]);
  const [userDepartment, setUserDepartment] = useState<Department | null>(null);
  const [currentDocumentType, setCurrentDocumentType] = useState<DocumentType | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('');

  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const schoolId = user?.schoolId;

  useEffect(() => {
    if (!schoolId) return;
    loadSchoolYears();
    loadUserDepartment();
    campusService.getAllCampuses(schoolId).then(setCampuses).catch(console.error);
  }, [user, schoolId]);

  // Mặc định cơ sở: theo tổ chuyên môn (nếu có) hoặc cơ sở "nhà" của người tải,
  // người dùng vẫn chọn lại được thủ công.
  useEffect(() => {
    if (selectedCampusId || campuses.length === 0) return;
    const defaultId = userDepartment?.campusId || user?.primaryCampusId || campuses[0]?.id || '';
    if (defaultId) setSelectedCampusId(defaultId);
  }, [campuses, userDepartment, user?.primaryCampusId]);

  useEffect(() => {
    if (selectedYearId) {
      loadCategories(selectedYearId);
    }
  }, [selectedYearId]);

  useEffect(() => {
    if (selectedCategoryId) {
      const category = categories.find(c => c.id === selectedCategoryId);

      // Load DocumentType if category has one
      if (category?.documentTypeId) {
        loadDocumentType(category.documentTypeId);
      } else {
        setCurrentDocumentType(null);
      }

      if (category?.hasSubCategories) {
        loadSubCategories(selectedCategoryId);
      } else {
        setSubCategories([]);
      }
    }
  }, [selectedCategoryId]);

  const loadSchoolYears = async () => {
    if (!schoolId) return;
    try {
      const years = await schoolYearService.getAllSchoolYears(schoolId);
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
    if (!schoolId) return;
    try {
      const cats = await documentCategoryService.getCategoriesBySchoolYear(schoolId, yearId);
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSubCategories = async (categoryId: string) => {
    if (!schoolId) return;
    try {
      const subs = await documentCategoryService.getSubCategories(schoolId, categoryId);
      setSubCategories(subs);
    } catch (error) {
      console.error('Error loading subcategories:', error);
    }
  };

  const loadUserDepartment = async () => {
    if (!user || !schoolId) return;
    try {
      const dept = await departmentService.getDepartmentByUserId(schoolId, user.uid);
      setUserDepartment(dept);
    } catch (error) {
      console.error('Error loading user department:', error);
    }
  };

  const loadDocumentType = async (documentTypeId: string) => {
    try {
      const docType = await documentTypeService.getDocumentTypeById(documentTypeId);
      setCurrentDocumentType(docType);
    } catch (error) {
      console.error('Error loading document type:', error);
      setCurrentDocumentType(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(selectedFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = async () => {
    if (!schoolId) return;
    if (!documentTitle.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên hồ sơ',
        variant: 'destructive',
      });
      return;
    }

    if (selectedFiles.length === 0 || !selectedYearId || !selectedCategoryId || !selectedCampusId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn đầy đủ thông tin và ít nhất 1 file',
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

      // Get necessary metadata
      const schoolYear = schoolYears.find(y => y.id === selectedYearId);
      const selectedCategory = categories.find(c => c.id === selectedCategoryId);
      const selectedSubCategory = subCategories.find(s => s.id === selectedSubCategoryId);

      if (!schoolYear || !selectedCategory) {
        throw new Error('Invalid school year or category');
      }

      // Upload all files to Google Drive
      const uploadedFiles = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const driveFile = await googleDriveServiceBackend.uploadFile({
          file,
          schoolYear: schoolYear.name,
          category: selectedCategory.name,
          subCategory: selectedSubCategory?.name,
          uploaderName: user!.displayName,
          documentTitle: documentTitle.trim(),
          documentType: currentDocumentType?.name,
        });

        uploadedFiles.push({
          name: file.name,
          size: file.size,
          mimeType: file.type,
          driveFileId: driveFile.id,
          driveFileUrl: driveFile.webViewLink,
        });
      }

      // Determine status based on role
      let status: 'pending' | 'approved' = 'pending';

      // Auto-approve for admin/VP
      if (user?.role === 'admin' || user?.role === 'vice_principal' || user?.role === 'youth_leader') {
        status = 'approved';
      }
      // Auto-approve for department head/deputy IF uploading to their own department
      else if (user?.role === 'department_head' || user?.role === 'deputy_department_head') {
        if (
          userDepartment &&
          selectedSubCategoryId &&
          selectedSubCategoryId === userDepartment.subCategoryId
        ) {
          status = 'approved';
        }
      }

      await documentService.createDocument(schoolId, {
        campusId: selectedCampusId,
        schoolYearId: selectedYearId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId || undefined,
        title: documentTitle.trim(),
        files: uploadedFiles,
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
            ? `Đã tải lên ${uploadedFiles.length} file`
            : `Đã tải lên ${uploadedFiles.length} file và đang chờ phê duyệt`,
      });

      // Reset form
      setDocumentTitle('');
      setSelectedFiles([]);
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
          {/* Campus Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Cơ sở <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCampusId}
              onChange={(e) => setSelectedCampusId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Chọn cơ sở</option>
              {campuses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

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
              multiple
              onChange={handleFileChange}
              className="w-full border rounded px-3 py-2"
            />
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-gray-700">
                  Đã chọn {selectedFiles.length} file(s):
                </p>
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                    <span>{file.name} ({formatFileSize(file.size)})</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
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
            disabled={!documentTitle.trim() || selectedFiles.length === 0 || !selectedCampusId || uploading}
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
