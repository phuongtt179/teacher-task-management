import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { authFetch } from '../../lib/authFetch';
import { School } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Power } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Super-admin-only screen for managing the `schools` (tenant) collection.
// Deliberately scoped to create/list/deactivate — no "browse this school's data"
// picker here; a super-admin operates on the schools collection only.
export const SchoolsScreen = () => {
  const { toast } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [newName, setNewName] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const loadSchools = async () => {
    setIsFetching(true);
    try {
      const q = query(collection(db, 'schools'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          name: raw.name,
          shortName: raw.shortName || undefined,
          isActive: raw.isActive !== false,
          driveRootFolderId: raw.driveRootFolderId,
          createdBy: raw.createdBy,
          createdAt: raw.createdAt?.toDate() || new Date(),
          updatedAt: raw.updatedAt?.toDate() || new Date(),
        } as School;
      });
      setSchools(data);
    } catch (error) {
      console.error('Error loading schools:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải danh sách trường',
      });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  // Create a new school — must go through the backend (not a direct Firestore
  // write) because it also creates the school's Google Drive root folder.
  const handleCreateSchool = async () => {
    if (!newName.trim()) return;

    setIsLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/schools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          shortName: newShortName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || error.error || 'Tạo trường thất bại');
      }

      toast({
        title: 'Thành công',
        description: `Đã tạo trường "${newName.trim()}"`,
      });

      setNewName('');
      setNewShortName('');
      loadSchools();
    } catch (error) {
      console.error('Error creating school:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error instanceof Error ? error.message : 'Không thể tạo trường',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle isActive — allowed as a direct Firestore write per firestore.rules
  // (super-admin can update any schools/{id} doc).
  const handleToggleActive = async (school: School) => {
    try {
      await updateDoc(doc(db, 'schools', school.id), {
        isActive: !school.isActive,
        updatedAt: serverTimestamp(),
      });
      toast({
        title: 'Thành công',
        description: school.isActive
          ? `Đã vô hiệu hóa trường "${school.name}"`
          : `Đã kích hoạt trường "${school.name}"`,
      });
      loadSchools();
    } catch (error) {
      console.error('Error toggling school status:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể cập nhật trạng thái trường',
      });
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quản lý trường</CardTitle>
          <CardDescription>
            Tạo và quản lý các trường (tenant) dùng chung hệ thống. Mỗi trường có dữ liệu tách biệt hoàn toàn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new school */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Tên trường (bắt buộc)..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSchool()}
            />
            <Input
              placeholder="Tên viết tắt (tùy chọn)..."
              value={newShortName}
              onChange={(e) => setNewShortName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSchool()}
              className="sm:max-w-[200px]"
            />
            <Button onClick={handleCreateSchool} disabled={isLoading || !newName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Tạo trường
            </Button>
          </div>

          {/* School list */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-gray-600">
              Danh sách trường ({schools.length})
            </h3>

            {isFetching ? (
              <div className="text-center py-8 text-gray-400">Đang tải...</div>
            ) : schools.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có trường nào</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                {schools.map((school) => (
                  <div
                    key={school.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {school.name}
                        {school.shortName && (
                          <span className="text-xs text-gray-500">({school.shortName})</span>
                        )}
                        <Badge variant={school.isActive ? 'default' : 'secondary'}>
                          {school.isActive ? 'Hoạt động' : 'Vô hiệu hóa'}
                        </Badge>
                      </p>
                      <p className="text-xs text-gray-500">
                        Tạo lúc {school.createdAt?.toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(school)}
                      title={school.isActive ? 'Vô hiệu hóa trường' : 'Kích hoạt trường'}
                    >
                      <Power className={`w-4 h-4 ${school.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
