import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { campusService } from '@/services/campusService';
import { userService } from '@/services/userService';
import { Campus, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Quản lý danh sách cơ sở/phân hiệu của trường ("cấu hình" — chỉ admin/principal
// tạo/sửa/xóa, xem firestore.rules). campusId chỉ là 1 field dữ liệu để chọn/lọc
// khi phân công việc hoặc xem thống kê — KHÔNG phải ranh giới phân quyền: hiệu
// phó/hiệu trưởng đều xem và phân công được cho cả 2 cơ sở.
export const CampusesScreen = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [vicePrincipals, setVicePrincipals] = useState<User[]>([]);
  const [newName, setNewName] = useState('');
  const [newVicePrincipalUid, setNewVicePrincipalUid] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const schoolId = user?.schoolId;

  const loadAll = async () => {
    if (!schoolId) return;
    setIsFetching(true);
    try {
      const [campusesData, vpData] = await Promise.all([
        campusService.getAllCampuses(schoolId),
        userService.getUsersByRole(schoolId, 'vice_principal'),
      ]);
      setCampuses(campusesData);
      setVicePrincipals(vpData);
    } catch (error) {
      console.error('Error loading campuses:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể tải danh sách cơ sở' });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [schoolId]);

  const handleCreate = async () => {
    if (!newName.trim() || !schoolId) return;
    setIsLoading(true);
    try {
      await campusService.createCampus(schoolId, {
        name: newName.trim(),
        vicePrincipalUid: newVicePrincipalUid || undefined,
        order: campuses.length,
      });
      toast({ title: 'Thành công', description: `Đã tạo cơ sở "${newName.trim()}"` });
      setNewName('');
      setNewVicePrincipalUid('');
      loadAll();
    } catch (error) {
      console.error('Error creating campus:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể tạo cơ sở' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeVicePrincipal = async (campus: Campus, vicePrincipalUid: string) => {
    try {
      await campusService.updateCampus(campus.id, { vicePrincipalUid });
      toast({ title: 'Đã cập nhật', description: `Hiệu phó phụ trách "${campus.name}"` });
      loadAll();
    } catch (error) {
      console.error('Error updating campus:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể cập nhật' });
    }
  };

  const handleDelete = async (campus: Campus) => {
    if (!confirm(`Xóa cơ sở "${campus.name}"? Các việc/hồ sơ đã gắn cơ sở này sẽ không bị xóa nhưng sẽ mất nhãn cơ sở.`)) return;
    try {
      await campusService.deleteCampus(campus.id);
      toast({ title: 'Thành công', description: `Đã xóa cơ sở "${campus.name}"` });
      loadAll();
    } catch (error) {
      console.error('Error deleting campus:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể xóa cơ sở' });
    }
  };

  const vpNameByUid = new Map(vicePrincipals.map(v => [v.uid, v.displayName]));

  return (
    <div className="container max-w-3xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cơ sở / Phân hiệu</CardTitle>
          <CardDescription>
            Quản lý danh sách cơ sở của trường — dùng để chọn/lọc khi phân công việc hoặc xem thống kê.
            Hiệu phó và hiệu trưởng đều xem/phân công được việc của mọi cơ sở.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Tên cơ sở (vd: Cơ sở chính, Phân hiệu 1)..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Select value={newVicePrincipalUid} onValueChange={setNewVicePrincipalUid}>
              <SelectTrigger className="sm:max-w-[220px]">
                <SelectValue placeholder="Hiệu phó phụ trách (tùy chọn)" />
              </SelectTrigger>
              <SelectContent>
                {vicePrincipals.map(vp => (
                  <SelectItem key={vp.uid} value={vp.uid}>{vp.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCreate} disabled={isLoading || !newName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm cơ sở
            </Button>
          </div>

          <div className="space-y-2">
            {isFetching ? (
              <div className="text-center py-8 text-gray-400">Đang tải...</div>
            ) : campuses.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có cơ sở nào</p>
              </div>
            ) : (
              campuses.map((campus) => (
                <div key={campus.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-2 flex-wrap">
                  <p className="font-medium">{campus.name}</p>
                  <div className="flex items-center gap-2">
                    <Select value={campus.vicePrincipalUid || ''} onValueChange={(v) => handleChangeVicePrincipal(campus, v)}>
                      <SelectTrigger className="w-48 h-8 text-xs">
                        <SelectValue placeholder="Chưa gán hiệu phó">
                          {campus.vicePrincipalUid ? vpNameByUid.get(campus.vicePrincipalUid) || campus.vicePrincipalUid : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {vicePrincipals.map(vp => (
                          <SelectItem key={vp.uid} value={vp.uid}>{vp.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(campus)} title="Xóa cơ sở">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
