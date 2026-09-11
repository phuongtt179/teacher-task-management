import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { departmentService } from '../../services/departmentService';
import { campusService } from '../../services/campusService';
import { User, Department, Campus } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Building2 } from 'lucide-react';

const TEACHER_ROLES: User['role'][] = ['teacher', 'department_head', 'deputy_department_head'];

const ROLE_LABELS: Partial<Record<User['role'], string>> = {
  teacher: 'Giáo viên',
  department_head: 'Tổ trưởng',
  deputy_department_head: 'Tổ phó',
};

export const TeacherDirectoryScreen = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const [teachers, setTeachers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [campusFilter, setCampusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      try {
        setIsLoading(true);
        const [allUsers, depts, camps] = await Promise.all([
          userService.getAllUsers(schoolId),
          departmentService.getAllDepartments(schoolId),
          campusService.getAllCampuses(schoolId),
        ]);
        setTeachers(allUsers.filter(u => TEACHER_ROLES.includes(u.role)));
        setDepartments(depts);
        setCampuses(camps);
      } catch (error) {
        console.error('Error loading teacher directory:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [schoolId]);

  // Tổ chuyên môn dùng chung toàn trường — tra theo memberIds, không theo cơ sở.
  const departmentByUid = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach(dept => {
      dept.memberIds.forEach(uid => map.set(uid, dept.name));
    });
    return map;
  }, [departments]);

  const campusNameById = useMemo(() => {
    const map = new Map<string, string>();
    campuses.forEach(c => map.set(c.id, c.name));
    return map;
  }, [campuses]);

  const filteredTeachers = useMemo(() => {
    let filtered = teachers;

    if (campusFilter !== 'all') {
      filtered = filtered.filter(t => (t.campusIds || []).includes(campusFilter));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        t => t.displayName.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));
  }, [teachers, campusFilter, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Bảng tổng hợp giáo viên</h2>
        <p className="text-gray-600">Danh sách giáo viên theo cơ sở, tổ chuyên môn, môn dạy</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Tìm theo tên hoặc email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={campusFilter} onValueChange={setCampusFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <Building2 className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Cơ sở" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toàn trường</SelectItem>
                {campuses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({filteredTeachers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Không tìm thấy giáo viên nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Họ tên</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Vai trò</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Cơ sở</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Tổ chuyên môn</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Môn dạy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTeachers.map(t => {
                    const campusNames = (t.campusIds || []).map(id => campusNameById.get(id)).filter(Boolean);
                    return (
                      <tr key={t.uid} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{t.displayName}</p>
                          <p className="text-xs text-gray-500">{t.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{ROLE_LABELS[t.role] || t.role}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {campusNames.length > 0 ? campusNames.join(', ') : <span className="text-gray-400">Chưa gán</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {departmentByUid.get(t.uid) || <span className="text-gray-400">Chưa có tổ</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {t.subject || <span className="text-gray-400">Chưa cập nhật</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
