import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { googleDriveServiceBackend } from '@/services/googleDriveServiceBackend';
import { documentService } from '@/services/documentService';
import { schoolYearService } from '@/services/schoolYearService';
import { documentCategoryService } from '@/services/documentCategoryService';
import { departmentService } from '@/services/departmentService';
import { fileRequestService } from '@/services/fileRequestService';
import { Document, SchoolYear, DocumentCategory, DocumentSubCategory, Department } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Download,
  FileText,
  Trash2,
  Eye,
  Plus,
  Upload as UploadIcon,
  ChevronRight,
  ChevronDown,
  Search,
  Calendar,
  User,
  FileIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DepartmentDocumentsTreeView } from './DepartmentDocumentsTreeView';

export function DocumentBrowseScreen() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [subCategories, setSubCategories] = useState<DocumentSubCategory[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [userDepartment, setUserDepartment] = useState<Department | null>(null);

  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [treeViewRefreshTrigger, setTreeViewRefreshTrigger] = useState(0);

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
        loadDocuments();
      }
    }
  }, [selectedCategoryId]);

  // Auto load documents when subcategory changes
  useEffect(() => {
    if (selectedSubCategoryId) {
      loadDocuments();
    }
  }, [selectedSubCategoryId]);

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
      setSelectedCategoryId('');
      setSelectedSubCategoryId('');
      setDocuments([]);
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

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const filters: any = {
        schoolYearId: selectedYearId,
        categoryId: selectedCategoryId,
      };

      if (selectedSubCategoryId) {
        filters.subCategoryId = selectedSubCategoryId;
      }

      const allDocs = await documentService.getDocuments(filters);

      // Get selected category to check type
      const selectedCategory = categories.find(c => c.id === selectedCategoryId);
      const isPersonalCategory = selectedCategory?.categoryType === 'personal';

      let filteredDocs: Document[];

      if (isPersonalCategory) {
        // Hồ sơ cá nhân - apply role-based filtering
        if (user?.role === 'admin' || user?.role === 'vice_principal') {
          // Admin & Vice Principal: see all approved documents + own pending
          filteredDocs = allDocs.filter(doc =>
            doc.status === 'approved' || doc.uploadedBy === user?.uid
          );
        } else if (user?.role === 'department_head') {
          // Department Head: see all documents from their department + own pending
          const deptMemberIds = userDepartment?.memberIds || [];
          filteredDocs = allDocs.filter(doc =>
            (doc.status === 'approved' && deptMemberIds.includes(doc.uploadedBy)) ||
            doc.uploadedBy === user?.uid
          );
        } else {
          // Teacher: only see own documents
          filteredDocs = allDocs.filter(doc => doc.uploadedBy === user?.uid);
        }
      } else {
        // Hồ sơ công khai - everyone sees all approved documents + own pending
        filteredDocs = allDocs.filter(doc =>
          doc.status === 'approved' || doc.uploadedBy === user?.uid
        );
      }

      setDocuments(filteredDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách hồ sơ',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (doc: Document) => {
    const reason = prompt('Lý do xóa hồ sơ:');
    if (!reason) return;

    try {
      await fileRequestService.createDeleteRequest({
        documentId: doc.id,
        documentName: doc.title, // Use document title instead of fileName
        requestedBy: user!.uid,
        requestedByName: user!.displayName,
        reason,
      });

      toast({
        title: 'Thành công',
        description: 'Yêu cầu xóa hồ sơ đã được gửi',
      });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi yêu cầu xóa',
        variant: 'destructive',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
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

    // Validate files selected
    if (selectedFiles.length === 0 || !selectedYearId || !selectedCategoryId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn ít nhất 1 file để tải lên',
        variant: 'destructive',
      });
      return;
    }

    // Validate file count (max 20)
    if (selectedFiles.length > 20) {
      toast({
        title: 'Vượt quá giới hạn',
        description: `Chỉ có thể tải tối đa 20 files. Bạn đã chọn ${selectedFiles.length} files.`,
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

    // Validate file sizes and types
    const maxFileSize = 50 * 1024 * 1024; // 50MB per file
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
    ];

    for (const file of selectedFiles) {
      // Check file size
      if (file.size > maxFileSize) {
        toast({
          title: 'File quá lớn',
          description: `File "${file.name}" vượt quá 50MB (${(file.size / 1024 / 1024).toFixed(2)}MB). Vui lòng chọn file nhỏ hơn.`,
          variant: 'destructive',
        });
        return;
      }

      // Check file type
      if (!allowedTypes.includes(file.type) && file.type !== '') {
        toast({
          title: 'Định dạng không hỗ trợ',
          description: `File "${file.name}" có định dạng không được hỗ trợ. Vui lòng chọn file PDF, Word, Excel, PowerPoint, hoặc ảnh.`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Check backend health
      const isHealthy = await googleDriveServiceBackend.checkHealth();
      if (!isHealthy) {
        toast({
          title: 'Lỗi',
          description: 'Server chưa chạy. Vui lòng chạy: npm run server',
          variant: 'destructive',
        });
        return;
      }

      // Get folder names
      const schoolYear = schoolYears.find(y => y.id === selectedYearId);
      const categoryName = categories.find(c => c.id === selectedCategoryId)?.name || 'Khác';
      const subCategoryName = selectedSubCategoryId
        ? subCategories.find(s => s.id === selectedSubCategoryId)?.name
        : undefined;

      toast({
        title: 'Đang tải lên',
        description: `Đang tải ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} lên Drive...`,
      });

      // Upload all files via backend
      const uploadedFiles: any[] = [];
      const totalFiles = selectedFiles.length;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileProgress = (i / totalFiles) * 100;

        toast({
          title: 'Đang tải lên',
          description: `Đang tải file ${i + 1}/${totalFiles}: ${file.name}`,
        });

        const driveFile = await googleDriveServiceBackend.uploadFile({
          file,
          schoolYear: schoolYear?.name || 'Hồ sơ',
          category: categoryName,
          subCategory: subCategoryName,
          uploaderName: user!.displayName, // NEW: Teacher name for folder structure
          documentTitle: documentTitle.trim(), // NEW: Document title for folder structure
          onProgress: (progress) => {
            // Calculate overall progress
            const overallProgress = fileProgress + (progress / totalFiles);
            setUploadProgress(Math.min(overallProgress, 100));
          },
        });

        uploadedFiles.push(driveFile);
      }

      // Save to Firestore
      let status: 'pending' | 'approved' = 'pending';

      // Get the selected category to check allowedUploaders
      const selectedCategory = categories.find(c => c.id === selectedCategoryId);

      // Auto-approve if Admin/VP OR in allowedUploaders for public categories OR department head of own department
      if (user?.role === 'admin' || user?.role === 'vice_principal') {
        status = 'approved';
      } else if (
        selectedCategory?.categoryType === 'public' &&
        selectedCategory?.allowedUploaders?.includes(user!.uid)
      ) {
        status = 'approved';
      } else if (user?.role === 'department_head') {
        // Auto-approve for department head IF uploading to their own department
        if (
          userDepartment &&
          selectedSubCategoryId &&
          selectedSubCategoryId === userDepartment.subCategoryId
        ) {
          status = 'approved';
        }
      }

      // Build document data with multiple files
      const docData: Record<string, any> = {
        schoolYearId: selectedYearId,
        categoryId: selectedCategoryId,
        title: documentTitle.trim(),

        // NEW: Array of files
        files: uploadedFiles.map(f => ({
          name: f.name,
          size: f.size,
          mimeType: f.mimeType,
          driveFileId: f.id,
          driveFileUrl: f.webViewLink,
        })),

        uploadedBy: user!.uid,
        uploadedByName: user!.displayName,
        isPublic: false,
        status,
      };

      // Add optional fields only if they exist
      if (selectedSubCategoryId) {
        docData.subCategoryId = selectedSubCategoryId;
      }
      if (userDepartment?.id) {
        docData.departmentId = userDepartment.id;
      }

      // Debug logging
      console.log('📝 Upload document data:', {
        categoryName: categories.find(c => c.id === selectedCategoryId)?.name,
        categoryId: selectedCategoryId,
        subCategoryName: selectedSubCategoryId
          ? subCategories.find(s => s.id === selectedSubCategoryId)?.name
          : 'None',
        subCategoryId: selectedSubCategoryId,
        filesCount: uploadedFiles.length,
        docData
      });
      console.log('📄 Files array in docData:', docData.files);
      console.log('📦 Uploaded files from backend:', uploadedFiles);

      await documentService.createDocument(docData as any);

      // Close dialog and reset form
      setShowUploadDialog(false);
      setDocumentTitle('');
      setSelectedFiles([]);
      setUploadProgress(0);

      // Reload documents to show the newly uploaded one
      await loadDocuments();

      // Trigger tree view reload
      setTreeViewRefreshTrigger(Date.now());

      toast({
        title: 'Thành công',
        description: status === 'approved'
          ? `Đã tải lên ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}. Hồ sơ đã được thêm vào danh sách.`
          : `Đã tải lên ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} và đang chờ phê duyệt. Hồ sơ đã được thêm vào danh sách.`,
      });
    } catch (error) {
      console.error('Error uploading document:', error);

      // Provide specific error messages based on error type
      let errorTitle = 'Lỗi tải lên';
      let errorMessage = 'Không thể tải lên hồ sơ. Vui lòng thử lại.';

      if (error instanceof Error) {
        const errMsg = error.message.toLowerCase();

        // Network errors
        if (errMsg.includes('network') || errMsg.includes('fetch')) {
          errorTitle = 'Lỗi kết nối';
          errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối internet hoặc chạy backend server (npm run server).';
        }
        // File size errors from backend
        else if (errMsg.includes('file too large') || errMsg.includes('quá lớn')) {
          errorTitle = 'Lỗi kích thước file';
          errorMessage = 'File quá lớn để tải lên Google Drive. Vui lòng nén file hoặc chọn file nhỏ hơn.';
        }
        // Google Drive API errors
        else if (errMsg.includes('drive') || errMsg.includes('quota')) {
          errorTitle = 'Lỗi Google Drive';
          errorMessage = 'Không thể tải lên Google Drive. Có thể đã hết quota hoặc quyền truy cập bị từ chối.';
        }
        // Permission errors
        else if (errMsg.includes('permission') || errMsg.includes('quyền')) {
          errorTitle = 'Lỗi phân quyền';
          errorMessage = 'Bạn không có quyền tải file lên mục này.';
        }
        // Firestore errors
        else if (errMsg.includes('firestore') || errMsg.includes('database')) {
          errorTitle = 'Lỗi lưu dữ liệu';
          errorMessage = 'File đã tải lên Drive nhưng không thể lưu thông tin vào database. Vui lòng liên hệ quản trị viên.';
        }
        // Use original error message if none of the above
        else {
          errorMessage = error.message;
        }
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCategoryClick = (category: DocumentCategory) => {
    setSelectedCategoryId(category.id);
    setSelectedSubCategoryId('');
    if (category.hasSubCategories) {
      toggleCategory(category.id);
    } else {
      loadDocuments();
    }
  };

  const handleSubCategoryClick = (subCategory: DocumentSubCategory) => {
    setSelectedSubCategoryId(subCategory.id);
    // loadDocuments will be called automatically by useEffect when selectedSubCategoryId changes
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const canDeleteFile = (doc: Document) => {
    if (user?.role === 'admin' || user?.role === 'vice_principal') return false;
    return doc.uploadedBy === user?.uid;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Đã duyệt</span>;
      case 'pending':
        return <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">Chờ duyệt</span>;
      case 'rejected':
        return <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">Từ chối</span>;
      default:
        return null;
    }
  };

  const personalCategories = categories.filter(c => c.categoryType === 'personal');
  const publicCategories = categories.filter(c => c.categoryType === 'public');

  const filteredDocuments = documents.filter(doc => {
    if (searchQuery === '') return true;

    const query = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(query) ||
      doc.uploadedByName.toLowerCase().includes(query) ||
      (doc.files || []).some(f => f.name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Sidebar - Categories */}
      <div className="w-80 border-r bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold mb-2">Hồ sơ điện tử</h1>
          <div>
            <label className="block text-sm font-medium mb-1">Năm học</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">Chọn năm học</option>
              {schoolYears.map(year => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedYearId ? (
            <p className="text-sm text-gray-500 text-center py-8">Vui lòng chọn năm học</p>
          ) : (
            <div className="space-y-6">
              {/* Personal Categories */}
              {personalCategories.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Hồ sơ cá nhân</h3>
                  <div className="space-y-1">
                    {personalCategories.map(category => (
                      <div key={category.id}>
                        <button
                          onClick={() => handleCategoryClick(category)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                            selectedCategoryId === category.id
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="flex-1">{category.name}</span>
                          {category.hasSubCategories && (
                            expandedCategories.has(category.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )
                          )}
                        </button>

                        {/* Subcategories */}
                        {category.hasSubCategories && expandedCategories.has(category.id) && (
                          <div className="ml-4 mt-1 space-y-1">
                            {subCategories
                              .filter(sub => sub.categoryId === category.id)
                              .map(subCategory => (
                                <button
                                  key={subCategory.id}
                                  onClick={() => handleSubCategoryClick(subCategory)}
                                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                                    selectedSubCategoryId === subCategory.id
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  {subCategory.name}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Public Categories */}
              {publicCategories.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Hồ sơ công khai</h3>
                  <div className="space-y-1">
                    {publicCategories.map(category => (
                      <div key={category.id}>
                        <button
                          onClick={() => handleCategoryClick(category)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                            selectedCategoryId === category.id
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="flex-1">{category.name}</span>
                          {category.hasSubCategories && (
                            expandedCategories.has(category.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )
                          )}
                        </button>

                        {/* Subcategories */}
                        {category.hasSubCategories && expandedCategories.has(category.id) && (
                          <div className="ml-4 mt-1 space-y-1">
                            {subCategories
                              .filter(sub => sub.categoryId === category.id)
                              .map(subCategory => (
                                <button
                                  key={subCategory.id}
                                  onClick={() => handleSubCategoryClick(subCategory)}
                                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                                    selectedSubCategoryId === subCategory.id
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  {subCategory.name}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {categories.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Chưa có danh mục nào</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Documents */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {!selectedCategoryId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Chọn danh mục để xem hồ sơ</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {categories.find(c => c.id === selectedCategoryId)?.name}
                    {selectedSubCategoryId && (
                      <span className="text-gray-400 font-normal"> {' > '} {subCategories.find(s => s.id === selectedSubCategoryId)?.name}</span>
                    )}
                  </h2>
                </div>
                {(() => {
                  // Check if tree view is active
                  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
                  const isPersonalCategory = selectedCategory?.categoryType === 'personal';

                  const isTreeViewActive =
                    isPersonalCategory &&
                    selectedSubCategoryId &&
                    (user?.role === 'admin' ||
                     user?.role === 'vice_principal' ||
                     user?.role === 'department_head');

                  // Don't show upload button in tree view mode
                  if (isTreeViewActive) {
                    return null;
                  }

                  const category = categories.find(c => c.id === selectedCategoryId);
                  const canUpload = !category?.hasSubCategories || selectedSubCategoryId;

                  // Check if user has permission to upload to this category
                  const hasUploadPermission =
                    user?.role === 'admin' ||
                    user?.role === 'vice_principal' ||
                    (category?.categoryType === 'public' && category?.allowedUploaders?.includes(user!.uid)) ||
                    (category?.categoryType === 'personal');

                  return canUpload && hasUploadPermission ? (
                    <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Thêm hồ sơ
                    </Button>
                  ) : canUpload ? (
                    <p className="text-sm text-gray-500 italic">
                      Bạn không có quyền tải lên danh mục này
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      Chọn danh mục con để thêm hồ sơ
                    </p>
                  );
                })()}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Tìm kiếm hồ sơ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Documents List */}
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                // Check if this is a personal category subcategory for Admin/VP/Dept Head
                const selectedCategory = categories.find(c => c.id === selectedCategoryId);
                const isPersonalCategory = selectedCategory?.categoryType === 'personal';

                const showTreeView =
                  isPersonalCategory &&
                  selectedSubCategoryId &&
                  (user?.role === 'admin' ||
                   user?.role === 'vice_principal' ||
                   user?.role === 'department_head');

                if (showTreeView) {
                  // Show Department → Teacher → Documents tree view
                  return (
                    <DepartmentDocumentsTreeView
                      key={selectedSubCategoryId}
                      subCategoryId={selectedSubCategoryId}
                      categoryId={selectedCategoryId}
                      schoolYearId={selectedYearId}
                      onUploadClick={() => setShowUploadDialog(true)}
                      refreshTrigger={treeViewRefreshTrigger}
                    />
                  );
                }

                // Show regular list view for other cases
                if (loading) {
                  return (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      <p className="text-gray-500 mt-2">Đang tải...</p>
                    </div>
                  );
                }

                if (filteredDocuments.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <FileIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">
                        {searchQuery ? 'Không tìm thấy hồ sơ nào' : 'Chưa có hồ sơ nào'}
                      </p>
                    </div>
                  );
                }

                return (
                <div className="space-y-3">
                  {filteredDocuments.map(doc => (
                    <Card key={doc.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-3 p-3">
                          {/* File Icon */}
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Title & Status */}
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="font-semibold text-sm truncate flex-1" title={doc.title}>
                                {doc.title}
                              </h3>
                              {getStatusBadge(doc.status)}
                            </div>

                            {/* Metadata */}
                            <div className="bg-gray-50 rounded px-2 py-1 mb-2">
                              <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-gray-400" />
                                  <span>{doc.uploadedByName}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  <span>{doc.uploadedAt.toLocaleDateString('vi-VN')}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <FileIcon className="w-3 h-3 text-gray-400" />
                                  <span>{doc.files?.length || 0} file{(doc.files?.length || 0) > 1 ? 's' : ''}</span>
                                </div>
                              </div>
                            </div>

                            {/* Files List */}
                            {doc.files && doc.files.length > 0 ? (
                              <div className="space-y-1 mb-2">
                                <div className="text-xs font-medium text-gray-700 mb-1 px-1">
                                  📎 Files ({doc.files.length}):
                                </div>
                                {doc.files.map((file, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs bg-white border border-blue-100 rounded px-2 py-1.5 hover:bg-blue-50 transition-colors">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                      <span className="truncate font-medium" title={file.name}>
                                        {file.name}
                                      </span>
                                      <span className="text-gray-400 flex-shrink-0 text-[10px]">
                                        ({formatFileSize(file.size)})
                                      </span>
                                    </div>
                                    <div className="flex gap-1.5 ml-2">
                                      <button
                                        onClick={() => window.open(file.driveFileUrl, '_blank')}
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 p-1 rounded"
                                        title="Xem file"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          const link = document.createElement('a');
                                          link.href = file.driveFileUrl;
                                          link.download = file.name;
                                          link.click();
                                        }}
                                        className="text-green-600 hover:text-green-800 hover:bg-green-100 p-1 rounded"
                                        title="Tải xuống"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 italic mb-2 px-1">
                                Hồ sơ cũ - không có danh sách file
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-1">
                              {canDeleteFile(doc) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteRequest(doc)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowUploadDialog(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Thêm hồ sơ</h2>

            <div className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium mb-2">
                  Chọn file <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="w-full border rounded px-3 py-2"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Có thể chọn nhiều file (tối đa 20 files). Định dạng: PDF, Word, Excel, PowerPoint, Ảnh
                </p>

                {selectedFiles.length > 0 && (
                  <div className="mt-3 border rounded p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">
                        Đã chọn: {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles([])}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm bg-white rounded px-2 py-1">
                          <span className="flex-1 truncate">
                            📄 {file.name} ({formatFileSize(file.size)})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
                            }}
                            className="ml-2 text-red-600 hover:text-red-800 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    {selectedFiles.length < 20 && (
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.multiple = true;
                          input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt';
                          input.onchange = (e: any) => {
                            const newFiles = Array.from(e.target.files || []) as File[];
                            const totalFiles = selectedFiles.length + newFiles.length;
                            if (totalFiles > 20) {
                              toast({
                                title: 'Vượt quá giới hạn',
                                description: `Chỉ có thể tải tối đa 20 files. Bạn đang có ${selectedFiles.length} files, chỉ có thể thêm ${20 - selectedFiles.length} files nữa.`,
                                variant: 'destructive',
                              });
                              return;
                            }
                            setSelectedFiles([...selectedFiles, ...newFiles]);
                          };
                          input.click();
                        }}
                        className="mt-2 w-full text-sm text-blue-600 hover:text-blue-800 border border-dashed border-blue-300 rounded py-2 hover:bg-blue-50"
                      >
                        + Thêm file khác
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                <p>
                  <strong>Lưu ý:</strong> Hồ sơ của bạn sẽ được tải lên vào danh mục{' '}
                  <strong>{categories.find(c => c.id === selectedCategoryId)?.name}</strong>
                  {selectedSubCategoryId && (
                    <>
                      {' > '}
                      <strong>{subCategories.find(s => s.id === selectedSubCategoryId)?.name}</strong>
                    </>
                  )}
                </p>
                {(user?.role === 'teacher' || user?.role === 'department_head') && (
                  <p className="mt-2">
                    Hồ sơ sẽ ở trạng thái <strong>chờ duyệt</strong> cho đến khi được Admin/Hiệu trưởng phê duyệt.
                  </p>
                )}
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Đang tải lên...</span>
                    <span className="text-gray-600">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleUpload}
                disabled={!documentTitle.trim() || selectedFiles.length === 0 || uploading}
                className="flex-1"
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                {uploading ? 'Đang tải lên...' : 'Tải lên'}
              </Button>
              <Button
                onClick={() => {
                  setShowUploadDialog(false);
                  setDocumentTitle('');
                  setSelectedFiles([]);
                }}
                variant="outline"
                className="flex-1"
                disabled={uploading}
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
