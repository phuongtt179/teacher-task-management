import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { authFetch } from '../../lib/authFetch';
import { useAuth } from '../../hooks/useAuth';
import { planService } from '../../services/planService';
import { School, Plan } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Power, UserPlus, Tag } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const GB = 1024 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < GB) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / GB).toFixed(2)}GB`;
}

// Super-admin-only screen for managing the `schools` (tenant) collection.
// Deliberately scoped to create/list/deactivate/plan-assignment + bootstrapping
// each school's first admin — no "browse this school's data" picker here; a
// super-admin operates on the schools collection (and whitelist bootstrap) only.
export const SchoolsScreen = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usageByMonth, setUsageByMonth] = useState<Record<string, number>>({}); // schoolId -> aiMessageCount this month
  const [newName, setNewName] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [newPlanId, setNewPlanId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [addAdminForSchoolId, setAddAdminForSchoolId] = useState<string | null>(null);
  const [addAdminEmail, setAddAdminEmail] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const planById = new Map(plans.map(p => [p.id, p]));
  const monthKey = new Date().toISOString().slice(0, 7);

  const loadAll = async () => {
    setIsFetching(true);
    try {
      const [schoolsSnap, plansList] = await Promise.all([
        getDocs(query(collection(db, 'schools'), orderBy('createdAt', 'desc'))),
        planService.getAllPlans(),
      ]);

      const schoolsData = schoolsSnap.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          name: raw.name,
          shortName: raw.shortName || undefined,
          isActive: raw.isActive !== false,
          driveRootFolderId: raw.driveRootFolderId,
          planId: raw.planId || null,
          storageUsedBytes: raw.storageUsedBytes || 0,
          createdBy: raw.createdBy,
          createdAt: raw.createdAt?.toDate() || new Date(),
          updatedAt: raw.updatedAt?.toDate() || new Date(),
        } as School;
      });
      setSchools(schoolsData);
      setPlans(plansList);
      if (!newPlanId && plansList.length > 0) {
        setNewPlanId(plansList.find(p => p.isActive)?.id || plansList[0].id);
      }

      // Usage docs are per-school-per-month with a predictable id, fetch each
      // directly instead of a query (cheap, no index needed).
      const usageEntries = await Promise.all(
        schoolsData.map(async s => {
          const snap = await getDoc(doc(db, 'usageStats', `${s.id}_${monthKey}`));
          return [s.id, snap.exists() ? (snap.data().aiMessageCount || 0) : 0] as const;
        })
      );
      setUsageByMonth(Object.fromEntries(usageEntries));
    } catch (error) {
      console.error('Error loading schools:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể tải danh sách trường' });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadAll();
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
          planId: newPlanId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || error.error || 'Tạo trường thất bại');
      }

      toast({ title: 'Thành công', description: `Đã tạo trường "${newName.trim()}"` });
      setNewName('');
      setNewShortName('');
      loadAll();
    } catch (error) {
      console.error('Error creating school:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: error instanceof Error ? error.message : 'Không thể tạo trường' });
    } finally {
      setIsLoading(false);
    }
  };

  // Bootstrap a school's first admin by adding a whitelist entry scoped to that
  // school. Whitelist doc ID must be the email itself (matches firestore.rules
  // and WhitelistScreen's convention). A super-admin can create a whitelist
  // entry for ANY school (rules: isSuperAdmin() bypasses the same-school check
  // required for a regular school admin).
  const handleAddAdmin = async (school: School) => {
    const email = addAdminEmail.trim().toLowerCase();
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast({ variant: 'destructive', title: 'Email không hợp lệ', description: 'Vui lòng nhập đúng định dạng email' });
      return;
    }

    setIsAddingAdmin(true);
    try {
      const existing = await getDoc(doc(db, 'whitelist', email));
      if (existing.exists() && existing.data().schoolId !== school.id) {
        const proceed = confirm(
          `Email ${email} đang thuộc 1 trường khác (schoolId: ${existing.data().schoolId}). ` +
          `Chuyển sang "${school.name}" sẽ khiến người này MẤT quyền truy cập trường cũ. Tiếp tục?`
        );
        if (!proceed) { setIsAddingAdmin(false); return; }
      }

      await setDoc(doc(db, 'whitelist', email), {
        email,
        schoolId: school.id,
        role: 'admin',
        addedBy: currentUser?.email || 'super-admin',
        addedAt: Timestamp.now(),
      });

      toast({ title: 'Thành công', description: `Đã thêm ${email} làm admin của "${school.name}"` });
      setAddAdminEmail('');
      setAddAdminForSchoolId(null);
    } catch (error) {
      console.error('Error adding school admin:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể thêm admin' });
    } finally {
      setIsAddingAdmin(false);
    }
  };

  // Toggle isActive — this is the real "ngắt/mở": firestore.rules blocks ALL
  // data access for the school the instant this flips to false, and restores
  // it instantly when flipped back (see schoolIsActive() in firestore.rules).
  const handleToggleActive = async (school: School) => {
    try {
      await updateDoc(doc(db, 'schools', school.id), {
        isActive: !school.isActive,
        updatedAt: serverTimestamp(),
      });
      toast({
        title: 'Thành công',
        description: school.isActive ? `Đã khóa trường "${school.name}"` : `Đã mở lại trường "${school.name}"`,
      });
      loadAll();
    } catch (error) {
      console.error('Error toggling school status:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể cập nhật trạng thái trường' });
    }
  };

  const handleChangePlan = async (school: School, planId: string) => {
    try {
      await updateDoc(doc(db, 'schools', school.id), { planId, updatedAt: serverTimestamp() });
      toast({ title: 'Đã đổi gói', description: `"${school.name}" → ${planById.get(planId)?.name || planId}` });
      loadAll();
    } catch (error) {
      console.error('Error changing plan:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể đổi gói' });
    }
  };

  return (
    <div className="container max-w-5xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quản lý trường</CardTitle>
          <CardDescription>
            Tạo và quản lý các trường (tenant) dùng chung hệ thống — gói, mức dùng AI/lưu trữ, khóa/mở truy cập theo thanh toán.
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
              className="sm:max-w-[160px]"
            />
            <Select value={newPlanId} onValueChange={setNewPlanId}>
              <SelectTrigger className="sm:max-w-[180px]">
                <SelectValue placeholder="Chọn gói" />
              </SelectTrigger>
              <SelectContent>
                {plans.filter(p => p.isActive).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {p.priceVnd.toLocaleString('vi-VN')}đ</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCreateSchool} disabled={isLoading || !newName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Tạo trường
            </Button>
          </div>
          {plans.length === 0 && !isFetching && (
            <p className="text-xs text-amber-600">
              Chưa có gói nào — vào <a href="/super-admin/plans" className="underline">Quản lý gói</a> để tạo gói trước khi tạo trường.
            </p>
          )}

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
              <div className="space-y-2 max-h-[36rem] overflow-y-auto">
                {schools.map((school) => {
                  const plan = school.planId ? planById.get(school.planId) : undefined;
                  const aiUsed = usageByMonth[school.id] ?? 0;
                  const aiLimit = plan?.aiMessageLimit ?? -1;
                  const aiOver = aiLimit !== -1 && aiUsed > aiLimit;
                  const storageLimit = plan?.storageLimitBytes ?? -1;
                  const storageOver = storageLimit !== -1 && school.storageUsedBytes > storageLimit;

                  return (
                    <div key={school.id} className="bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between p-3 flex-wrap gap-2">
                        <div>
                          <p className="font-medium flex items-center gap-2 flex-wrap">
                            {school.name}
                            {school.shortName && <span className="text-xs text-gray-500">({school.shortName})</span>}
                            <Badge variant={school.isActive ? 'default' : 'secondary'}>
                              {school.isActive ? 'Hoạt động' : 'Đã khóa'}
                            </Badge>
                            {(aiOver || storageOver) && (
                              <Badge variant="destructive">Vượt hạn mức</Badge>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-1">
                            <span>
                              AI: <span className={aiOver ? 'text-red-600 font-medium' : ''}>{aiUsed}{aiLimit !== -1 ? `/${aiLimit}` : ''}</span> tin/tháng
                            </span>
                            <span>·</span>
                            <span>
                              Lưu trữ: <span className={storageOver ? 'text-red-600 font-medium' : ''}>{formatBytes(school.storageUsedBytes)}{storageLimit !== -1 ? `/${formatBytes(storageLimit)}` : ''}</span>
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Select value={school.planId || ''} onValueChange={(v) => handleChangePlan(school, v)}>
                            <SelectTrigger className="w-36 h-8 text-xs">
                              <Tag className="w-3 h-3 mr-1 text-gray-400" />
                              <SelectValue placeholder="Chưa gán gói" />
                            </SelectTrigger>
                            <SelectContent>
                              {plans.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAddAdminForSchoolId(addAdminForSchoolId === school.id ? null : school.id);
                              setAddAdminEmail('');
                            }}
                            title="Thêm admin cho trường này"
                          >
                            <UserPlus className="w-4 h-4 text-indigo-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(school)}
                            title={school.isActive ? 'Khóa trường (ngắt truy cập)' : 'Mở lại trường'}
                          >
                            <Power className={`w-4 h-4 ${school.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                          </Button>
                        </div>
                      </div>

                      {addAdminForSchoolId === school.id && (
                        <div className="flex flex-col sm:flex-row gap-2 px-3 pb-3">
                          <Input
                            type="email"
                            placeholder={`Email admin đầu tiên của "${school.name}"...`}
                            value={addAdminEmail}
                            onChange={(e) => setAddAdminEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin(school)}
                            autoFocus
                          />
                          <Button onClick={() => handleAddAdmin(school)} disabled={isAddingAdmin || !addAdminEmail.trim()}>
                            Thêm admin
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
