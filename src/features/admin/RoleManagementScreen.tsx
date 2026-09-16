import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { roleLabelService } from '@/services/roleLabelService';
import { DEFAULT_ROLE_LABELS, MANAGEABLE_ROLES, getRoleLabel, setCustomRoleLabels, getCustomRoleLabels } from '@/lib/roleLabels';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Check, X, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Chỉ đổi TÊN HIỂN THỊ của vai trò có sẵn (vd "Tổ trưởng" -> "Trưởng bộ môn").
// KHÔNG tạo/xóa vai trò và KHÔNG đụng tới quyền hạn — quyền hạn của mỗi vai trò
// vẫn cố định trong code/firestore.rules như trước, đổi tên ở đây chỉ đổi chữ
// hiển thị trên giao diện.
export const RoleManagementScreen = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [customLabels, setLocalCustomLabels] = useState<Partial<Record<UserRole, string>>>({});
  const [isFetching, setIsFetching] = useState(true);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsFetching(true);
    try {
      const labels = await roleLabelService.getCustomLabels();
      setLocalCustomLabels(labels);
      setCustomRoleLabels(labels); // đồng bộ cache dùng chung
    } catch (error) {
      console.error('Error loading role labels:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể tải danh sách vai trò' });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStartEdit = (role: UserRole) => {
    setEditingRole(role);
    setEditingValue(getRoleLabel(role));
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setEditingValue('');
  };

  const handleSave = async (role: UserRole) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Tên không được để trống' });
      return;
    }
    setIsSaving(true);
    try {
      await roleLabelService.setLabel(role, trimmed, user?.email || 'admin');
      const updated = { ...getCustomRoleLabels(), [role]: trimmed };
      setCustomRoleLabels(updated);
      setLocalCustomLabels(updated);
      handleCancelEdit();
      toast({ title: 'Đã lưu', description: `Đổi tên vai trò thành "${trimmed}"` });
    } catch (error) {
      console.error('Error saving role label:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể lưu tên vai trò' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async (role: UserRole) => {
    if (!confirm(`Đưa tên vai trò về mặc định "${DEFAULT_ROLE_LABELS[role]}"?`)) return;
    setIsSaving(true);
    try {
      await roleLabelService.resetLabel(role, user?.email || 'admin');
      const updated = { ...getCustomRoleLabels() };
      delete updated[role];
      setCustomRoleLabels(updated);
      setLocalCustomLabels(updated);
      toast({ title: 'Đã đưa về mặc định' });
    } catch (error) {
      console.error('Error resetting role label:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể đặt lại' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quản lý vai trò</CardTitle>
          <CardDescription>
            Đổi tên hiển thị của các vai trò có sẵn trong hệ thống — chỉ đổi CHỮ hiển thị
            (Header, danh sách User, Whitelist...), KHÔNG đổi quyền hạn của vai trò đó.
            Không tạo/xóa vai trò mới được ở đây.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="text-center py-8 text-gray-400">Đang tải...</div>
          ) : (
            <div className="space-y-2">
              {MANAGEABLE_ROLES.map((role) => {
                const isCustom = !!customLabels[role];
                return (
                  <div key={role} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-2 flex-wrap">
                    {editingRole === role ? (
                      <div className="flex items-center gap-1 flex-1 min-w-[200px]">
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(role);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="h-8"
                          autoFocus
                        />
                        <Button variant="ghost" size="sm" onClick={() => handleSave(role)} disabled={isSaving} title="Lưu">
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit} title="Hủy">
                          <X className="w-4 h-4 text-gray-500" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <p className="font-medium flex items-center gap-2 flex-wrap">
                          {getRoleLabel(role)}
                          {isCustom && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                              đã đổi tên
                            </span>
                          )}
                        </p>
                        {isCustom && (
                          <p className="text-xs text-gray-500">Mặc định: {DEFAULT_ROLE_LABELS[role]}</p>
                        )}
                      </div>
                    )}
                    {editingRole !== role && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleStartEdit(role)} title="Đổi tên">
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </Button>
                        {isCustom && (
                          <Button variant="ghost" size="sm" onClick={() => handleResetToDefault(role)} title="Đặt lại mặc định" disabled={isSaving}>
                            <RotateCcw className="w-4 h-4 text-gray-400" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
