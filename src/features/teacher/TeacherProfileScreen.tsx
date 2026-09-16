import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import { departmentService } from '@/services/departmentService';
import { campusService } from '@/services/campusService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Save, Building2, Phone, BookOpen, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Department, Campus } from '@/types';

export function TeacherProfileScreen() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [department, setDepartment] = useState<Department | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusIds, setSelectedCampusIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.schoolId) {
      setDisplayName(user.displayName);
      setEmail(user.email);
      setPhoneNumber(user.phoneNumber || '');
      setSubject(user.subject || '');
      setSelectedCampusIds(user.campusIds || []);
      loadDepartments();
      loadDepartment();
      loadCampuses();
    }
  }, [user]);

  const loadDepartments = async () => {
    if (!user?.schoolId) return;
    try {
      const depts = await departmentService.getAllDepartments(user.schoolId);
      setDepartments(depts);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadCampuses = async () => {
    if (!user?.schoolId) return;
    try {
      const camps = await campusService.getAllCampuses(user.schoolId);
      setCampuses(camps);
    } catch (error) {
      console.error('Error loading campuses:', error);
    }
  };

  const toggleCampus = (campusId: string) => {
    setSelectedCampusIds((prev) =>
      prev.includes(campusId) ? prev.filter((id) => id !== campusId) : [...prev, campusId]
    );
  };

  const loadDepartment = async () => {
    if (!user || !user.schoolId) return;

    try {
      const dept = await departmentService.getDepartmentByUserId(user.schoolId, user.uid);
      setDepartment(dept);
      setSelectedDepartmentId(dept?.id || '');
    } catch (error) {
      console.error('Error loading department:', error);
    }
  };

  const handleDepartmentChange = async (newDepartmentId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Remove from old department if exists
      if (department) {
        await departmentService.removeMember(department.id, user.uid);
      }

      // Add to new department
      if (newDepartmentId) {
        await departmentService.addMember(newDepartmentId, user.uid);
      }

      // Reload department info
      await loadDepartment();

      toast({
        title: 'Thành công',
        description: 'Đã cập nhật tổ',
      });
    } catch (error) {
      console.error('Error updating department:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật tổ',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      await userService.updateUser(user.uid, {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        subject: subject.trim(),
        primaryCampusId: selectedCampusIds[0] || null,
        campusIds: selectedCampusIds,
      });

      toast({
        title: 'Thành công',
        description: 'Đã cập nhật thông tin cá nhân',
      });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật thông tin',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
        <p className="text-gray-600 mt-2">Quản lý thông tin cá nhân của bạn</p>
      </div>

      <div className="grid gap-6">
        {/* Profile Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Thông tin cá nhân</CardTitle>
            <CardDescription>
              Cập nhật thông tin của bạn
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={user.photoURL} />
                  <AvatarFallback className="text-2xl">
                    {user.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">Ảnh đại diện</p>
                  <p className="text-sm text-gray-500">
                    Được đồng bộ từ tài khoản Google
                  </p>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">
                  <User className="w-4 h-4 inline mr-2" />
                  Họ và tên
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              {/* Phone number */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Số điện thoại
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="VD: 0912345678"
                />
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={email}
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                />
                <p className="text-sm text-gray-500">
                  Email không thể thay đổi
                </p>
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label>
                  <Building2 className="w-4 h-4 inline mr-2" />
                  Tổ
                </Label>
                <Select
                  value={selectedDepartmentId}
                  onValueChange={handleDepartmentChange}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tổ" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">
                  <BookOpen className="w-4 h-4 inline mr-2" />
                  Môn dạy
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="VD: Toán, Tiếng Việt..."
                />
              </div>

              {/* Campus(es) — GV có thể dạy ở nhiều cơ sở */}
              <div className="space-y-2">
                <Label>
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Cơ sở
                </Label>
                {campuses.length === 0 ? (
                  <p className="text-sm text-gray-500">Trường chưa có cơ sở nào được cấu hình</p>
                ) : (
                  <div className="border rounded-md p-3 space-y-2">
                    {campuses.map((campus) => (
                      <label key={campus.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCampusIds.includes(campus.id)}
                          onChange={() => toggleCampus(campus.id)}
                          className="h-4 w-4"
                        />
                        {campus.name}
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  Chọn nhiều nếu bạn dạy ở nhiều cơ sở
                </p>
              </div>

              {/* Submit Button */}
              <Button type="submit" disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
