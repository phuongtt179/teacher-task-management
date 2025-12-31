import { useState, useEffect } from 'react';
import { documentTypeService } from '@/services/documentTypeService';
import { userService } from '@/services/userService';
import { DocumentType, User } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Edit, Trash2, FolderTree, RefreshCw, X } from 'lucide-react';

export const DocumentTypesScreen = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    viewPermissionType: 'everyone' as 'everyone' | 'specific_users',
    allowedViewerUserIds: [] as string[],
    allowedUploaderUserIds: [] as string[],
    viewMode: 'personal' as 'personal' | 'shared',
    order: 0,
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [typesData, usersData] = await Promise.all([
        documentTypeService.getAllDocumentTypes(),
        userService.getAllUsers(),
      ]);
      setTypes(typesData);
      setAllUsers(usersData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải dữ liệu',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeDefaults = async () => {
    if (!user) return;

    try {
      setIsInitializing(true);
      await documentTypeService.initializeDefaultTypes(user.uid);
      toast({
        title: 'Thành công',
        description: 'Đã khởi tạo 4 loại hồ sơ mặc định. Vui lòng cấu hình người được phép upload.',
      });
      await loadData();
    } catch (error) {
      console.error('Error initializing defaults:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể khởi tạo loại hồ sơ mặc định',
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: '',
      viewPermissionType: 'everyone',
      allowedViewerUserIds: [],
      allowedUploaderUserIds: [],
      viewMode: 'personal',
      order: types.length + 1,
      isActive: true,
    });
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (type: DocumentType) => {
    setSelectedType(type);
    setFormData({
      name: type.name,
      description: type.description || '',
      icon: type.icon || '',
      viewPermissionType: type.viewPermissionType,
      allowedViewerUserIds: type.allowedViewerUserIds || [],
      allowedUploaderUserIds: type.allowedUploaderUserIds,
      viewMode: type.viewMode,
      order: type.order,
      isActive: type.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (formData.viewPermissionType === 'specific_users' && formData.allowedViewerUserIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Vui lòng chọn ít nhất một người được xem',
      });
      return;
    }

    if (formData.allowedUploaderUserIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Vui lòng chọn ít nhất một người được upload',
      });
      return;
    }

    try {
      await documentTypeService.createDocumentType({
        ...formData,
        createdBy: user.uid,
      });

      toast({
        title: 'Thành công',
        description: 'Đã tạo loại hồ sơ mới',
      });

      setIsCreateDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Error creating document type:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error.message || 'Không thể tạo loại hồ sơ',
      });
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;

    // Validation
    if (formData.viewPermissionType === 'specific_users' && formData.allowedViewerUserIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Vui lòng chọn ít nhất một người được xem',
      });
      return;
    }

    if (formData.allowedUploaderUserIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Vui lòng chọn ít nhất một người được upload',
      });
      return;
    }

    try {
      await documentTypeService.updateDocumentType(selectedType.id, formData);

      toast({
        title: 'Thành công',
        description: 'Đã cập nhật loại hồ sơ',
      });

      setIsEditDialogOpen(false);
      setSelectedType(null);
      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Error updating document type:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật loại hồ sơ',
      });
    }
  };

  const handleDelete = async (type: DocumentType) => {
    if (!confirm(`Bạn có chắc muốn xóa loại hồ sơ "${type.name}"?`)) {
      return;
    }

    try {
      await documentTypeService.deleteDocumentType(type.id);
      toast({
        title: 'Thành công',
        description: 'Đã xóa loại hồ sơ',
      });
      await loadData();
    } catch (error) {
      console.error('Error deleting document type:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xóa loại hồ sơ',
      });
    }
  };

  const toggleViewerUser = (uid: string) => {
    setFormData(prev => {
      const viewers = prev.allowedViewerUserIds;
      const uploaders = prev.allowedUploaderUserIds;

      if (viewers.includes(uid)) {
        // Remove from viewers and also from uploaders
        return {
          ...prev,
          allowedViewerUserIds: viewers.filter(id => id !== uid),
          allowedUploaderUserIds: uploaders.filter(id => id !== uid),
        };
      } else {
        return {
          ...prev,
          allowedViewerUserIds: [...viewers, uid],
        };
      }
    });
  };

  const toggleUploaderUser = (uid: string) => {
    setFormData(prev => {
      const uploaders = prev.allowedUploaderUserIds;
      if (uploaders.includes(uid)) {
        return { ...prev, allowedUploaderUserIds: uploaders.filter(id => id !== uid) };
      } else {
        return { ...prev, allowedUploaderUserIds: [...uploaders, uid] };
      }
    });
  };

  const getUserName = (uid: string): string => {
    const user = allUsers.find(u => u.uid === uid);
    return user ? user.displayName : uid;
  };

  // Get list of users who can be selected as uploaders (only viewers)
  const getAvailableUploaders = (): User[] => {
    if (formData.viewPermissionType === 'everyone') {
      return allUsers;
    } else {
      return allUsers.filter(u => formData.allowedViewerUserIds.includes(u.uid));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  const renderFormDialog = (isOpen: boolean, onClose: () => void, onSubmit: (e: React.FormEvent) => void, title: string) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Tên loại hồ sơ *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Hồ sơ giáo viên"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Mô tả</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả ngắn về loại hồ sơ này"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="icon">Icon (tùy chọn)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="VD: user-graduate"
                />
              </div>
            </div>

            {/* View Mode */}
            <div className="space-y-2">
              <Label>Chế độ hiển thị *</Label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="viewMode"
                    value="personal"
                    checked={formData.viewMode === 'personal'}
                    onChange={(e) => setFormData({ ...formData, viewMode: 'personal' })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">Cá nhân</div>
                    <div className="text-sm text-gray-600">
                      Mỗi user chỉ thấy file của mình. Admin/BGH/Tổ trưởng có thể chọn user để xem.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="viewMode"
                    value="shared"
                    checked={formData.viewMode === 'shared'}
                    onChange={(e) => setFormData({ ...formData, viewMode: 'shared' })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">Chia sẻ</div>
                    <div className="text-sm text-gray-600">
                      Tất cả người được xem sẽ thấy file của tất cả người upload.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* View Permission Type */}
            <div className="space-y-2">
              <Label>Quyền xem *</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="viewPermissionType"
                    value="everyone"
                    checked={formData.viewPermissionType === 'everyone'}
                    onChange={(e) => setFormData({
                      ...formData,
                      viewPermissionType: 'everyone',
                      allowedViewerUserIds: [],
                    })}
                  />
                  <span>Tất cả mọi người</span>
                </label>

                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="viewPermissionType"
                    value="specific_users"
                    checked={formData.viewPermissionType === 'specific_users'}
                    onChange={(e) => setFormData({ ...formData, viewPermissionType: 'specific_users' })}
                  />
                  <span>Chọn từng người cụ thể</span>
                </label>
              </div>
            </div>

            {/* Viewer Selection (only if specific_users) */}
            {formData.viewPermissionType === 'specific_users' && (
              <div className="space-y-2">
                <Label>Người được xem * ({formData.allowedViewerUserIds.length} người)</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                  {allUsers.map(u => (
                    <label key={u.uid} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.allowedViewerUserIds.includes(u.uid)}
                        onChange={() => toggleViewerUser(u.uid)}
                      />
                      <span>{u.displayName}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {u.role === 'admin' && 'Admin'}
                        {u.role === 'vice_principal' && 'Hiệu phó'}
                        {u.role === 'department_head' && 'Tổ trưởng'}
                        {u.role === 'teacher' && 'Giáo viên'}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Uploader Selection */}
            <div className="space-y-2">
              <Label>Người được upload * ({formData.allowedUploaderUserIds.length} người)</Label>
              <p className="text-sm text-gray-600">
                {formData.viewPermissionType === 'everyone'
                  ? 'Chọn những người được phép upload file'
                  : 'Chỉ người được xem mới có thể được chọn làm uploader'}
              </p>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                {getAvailableUploaders().map(u => (
                  <label key={u.uid} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowedUploaderUserIds.includes(u.uid)}
                      onChange={() => toggleUploaderUser(u.uid)}
                    />
                    <span>{u.displayName}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {u.role === 'admin' && 'Admin'}
                      {u.role === 'vice_principal' && 'Hiệu phó'}
                      {u.role === 'department_head' && 'Tổ trưởng'}
                      {u.role === 'teacher' && 'Giáo viên'}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            {/* Other Settings */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="order">Thứ tự hiển thị</Label>
                <Input
                  id="order"
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <span>Kích hoạt</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit">
                {title.includes('Tạo') ? 'Tạo' : 'Cập nhật'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quản lý loại hồ sơ</h2>
          <p className="text-gray-600">Tạo và quản lý các loại hồ sơ trong hệ thống</p>
        </div>
        <div className="flex gap-2">
          {types.length === 0 && (
            <Button onClick={handleInitializeDefaults} disabled={isInitializing} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
              Khởi tạo mặc định
            </Button>
          )}
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm loại hồ sơ
          </Button>
        </div>
      </div>

      {/* Types List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách loại hồ sơ</CardTitle>
          <CardDescription>
            {types.length} loại hồ sơ trong hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          {types.length === 0 ? (
            <div className="text-center py-12">
              <FolderTree className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Chưa có loại hồ sơ nào</p>
              <Button onClick={handleInitializeDefaults} className="mt-4" disabled={isInitializing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
                Khởi tạo 4 loại mặc định
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {types.map(type => (
                <div
                  key={type.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{type.name}</h3>
                      <Badge variant={type.viewMode === 'personal' ? 'default' : 'secondary'}>
                        {type.viewMode === 'personal' ? 'Cá nhân' : 'Chia sẻ'}
                      </Badge>
                      {!type.isActive && (
                        <Badge variant="secondary">Đã tắt</Badge>
                      )}
                    </div>
                    {type.description && (
                      <p className="text-sm text-gray-600 mb-2">{type.description}</p>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <div>
                        <span className="font-medium">Quyền xem: </span>
                        {type.viewPermissionType === 'everyone'
                          ? 'Tất cả mọi người'
                          : `${type.allowedViewerUserIds?.length || 0} người`}
                      </div>
                      <div>
                        <span className="font-medium">Upload: </span>
                        {type.allowedUploaderUserIds.length} người
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(type)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(type)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      {renderFormDialog(
        isCreateDialogOpen,
        () => setIsCreateDialogOpen(false),
        handleSubmitCreate,
        'Tạo loại hồ sơ mới'
      )}

      {/* Edit Dialog */}
      {renderFormDialog(
        isEditDialogOpen,
        () => {
          setIsEditDialogOpen(false);
          setSelectedType(null);
        },
        handleSubmitEdit,
        'Chỉnh sửa loại hồ sơ'
      )}
    </div>
  );
};
