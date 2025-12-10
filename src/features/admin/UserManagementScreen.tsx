import { useState, useEffect } from 'react';
import { userService, User } from '@/services/userService';
import { departmentService } from '@/services/departmentService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  GraduationCap,
  Crown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Department } from '@/types';
import { auth } from '@/lib/firebase';
import { updatePassword as firebaseUpdatePassword } from 'firebase/auth';

interface EditUserDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Edit User Dialog component
const EditUserDialog = ({ user, isOpen, onClose, onSuccess }: EditUserDialogProps) => {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [role, setRole] = useState(user?.role || 'teacher');
  const [isActive, setIsActive] = useState(user?.isActive !== false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentDepartment, setCurrentDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setRole(user.role);
      setIsActive(user.isActive !== false);
      setPassword('');
      loadUserDepartment();
    }
  }, [user]);

  const loadDepartments = async () => {
    try {
      const depts = await departmentService.getAllDepartments();
      setDepartments(depts);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadUserDepartment = async () => {
    if (!user) return;
    try {
      const dept = await departmentService.getDepartmentByUserId(user.uid);
      setCurrentDepartment(dept);
      setSelectedDepartmentId(dept?.id || '');
    } catch (error) {
      console.error('Error loading user department:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Update user info
      await userService.updateUser(user.uid, {
        displayName: displayName.trim(),
        role,
        isActive
      });

      // Update department if changed
      if (selectedDepartmentId !== currentDepartment?.id) {
        // Remove from old department
        if (currentDepartment) {
          await departmentService.removeMember(currentDepartment.id, user.uid);
        }
        // Add to new department
        if (selectedDepartmentId) {
          await departmentService.addMember(selectedDepartmentId, user.uid);
        }
      }

      // Update password if provided
      if (password && password.length >= 6) {
        // Note: This requires admin SDK or different approach
        // For now, we'll skip password update from admin panel
        // Users should reset password via profile page
        toast({
          title: 'Lưu ý',
          description: 'Cập nhật mật khẩu từ admin panel chưa được hỗ trợ. Vui lòng yêu cầu người dùng đổi mật khẩu từ trang hồ sơ.',
        });
      }

      toast({
        title: 'Thành công',
        description: 'Đã cập nhật thông tin người dùng',
      });

      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật người dùng',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Chỉnh sửa người dùng</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Họ và tên</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập họ và tên"
                required
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label>Vai trò</Label>
              <Select value={role} onValueChange={(value: any) => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="vice_principal">Hiệu trưởng</SelectItem>
                  <SelectItem value="department_head">Tổ trưởng</SelectItem>
                  <SelectItem value="teacher">Giáo viên</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label>Tổ</Label>
              <Select value={selectedDepartmentId || 'none'} onValueChange={(val) => setSelectedDepartmentId(val === 'none' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tổ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không thuộc tổ nào</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu mới (tùy chọn)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Để trống nếu không đổi"
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Tối thiểu 6 ký tự. Để trống nếu không muốn đổi mật khẩu.
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Tài khoản hoạt động
              </label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default function UserManagementScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    vicePrincipals: 0,
    departmentHeads: 0,
    teachers: 0,
    active: 0,
    inactive: 0
  });

  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    loadStats();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getAllUsers();
      setUsers(data);
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách người dùng',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await userService.getUserStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Bạn có chắc muốn xóa người dùng ${user.email}?`)) {
      return;
    }

    try {
      await userService.deleteUser(user.uid);
      toast({
        title: 'Thành công',
        description: 'Đã xóa người dùng',
      });
      loadUsers();
      loadStats();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa người dùng',
        variant: 'destructive',
      });
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await userService.updateUserStatus(user.uid, !user.isActive);
      toast({
        title: 'Thành công',
        description: user.isActive ? 'Đã vô hiệu hóa tài khoản' : 'Đã kích hoạt tài khoản',
      });
      loadUsers();
      loadStats();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật trạng thái',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4" />;
      case 'vice_principal':
        return <Shield className="w-4 h-4" />;
      case 'department_head':
        return <Users className="w-4 h-4" />;
      case 'teacher':
        return <GraduationCap className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'vice_principal':
        return 'Hiệu trưởng';
      case 'department_head':
        return 'Tổ trưởng';
      case 'teacher':
        return 'Giáo viên';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'vice_principal':
        return 'bg-blue-100 text-blue-800';
      case 'department_head':
        return 'bg-purple-100 text-purple-800';
      case 'teacher':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Quản lý người dùng</h1>
        <p className="text-muted-foreground">
          Quản lý tài khoản và phân quyền người dùng
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tổng số</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Admin</CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.admins}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hiệu trưởng</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{stats.vicePrincipals}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tổ trưởng</CardDescription>
            <CardTitle className="text-2xl text-purple-600">{stats.departmentHeads}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Giáo viên</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.teachers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hoạt động</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vô hiệu hóa</CardDescription>
            <CardTitle className="text-2xl text-gray-600">{stats.inactive}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo email hoặc tên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Lọc theo vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả vai trò</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="vice_principal">Hiệu trưởng</SelectItem>
                <SelectItem value="department_head">Tổ trưởng</SelectItem>
                <SelectItem value="teacher">Giáo viên</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Danh sách người dùng ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Đang tải...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không tìm thấy người dùng nào
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Avatar</th>
                    <th className="text-left py-3 px-4">Họ và tên</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Vai trò</th>
                    <th className="text-left py-3 px-4">Trạng thái</th>
                    <th className="text-left py-3 px-4">Ngày tạo</th>
                    <th className="text-right py-3 px-4">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.uid}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setEditingUser(user);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <td className="py-3 px-4">
                        <Avatar>
                          <AvatarImage src={user.photoURL} />
                          <AvatarFallback>
                            {user.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{user.displayName}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${getRoleBadgeColor(user.role)} flex items-center gap-1 w-fit`}>
                          {getRoleIcon(user.role)}
                          {getRoleLabel(user.role)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.isActive !== false ? 'default' : 'secondary'}>
                          {user.isActive !== false ? 'Hoạt động' : 'Vô hiệu hóa'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {format(user.createdAt, 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Chỉnh sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                                {user.isActive !== false ? (
                                  <>
                                    <UserX className="w-4 h-4 mr-2" />
                                    Vô hiệu hóa
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Kích hoạt
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteUser(user)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Xóa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EditUserDialog
        user={editingUser}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingUser(null);
        }}
        onSuccess={() => {
          loadUsers();
          loadStats();
        }}
      />
    </div>
  );
}
