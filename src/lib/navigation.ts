import {
    LayoutDashboard,
    Users,
    ClipboardList,
    BarChart3,
    Trophy,
    Bell,
    Settings,
    Mail,
    CheckSquare,
    Award,
    FolderOpen,
    FileCheck,
    FileText,
    Cog,
    User,
    Table,
    Building2,
    Tag,
  } from 'lucide-react';
  import { User as AppUser, UserRole } from '../types';

  export interface NavItem {
    label: string;
    shortLabel?: string; // For mobile bottom nav
    path: string;
    icon: any;
    roles: UserRole[];
    // Orthogonal to `roles` — a school's own admin can also carry this flag
    // (see the User type), so it can't be expressed as a `roles` entry.
    requiresSuperAdmin?: boolean;
  }

  export const navigationItems: NavItem[] = [
    // Common
    {
      label: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      roles: ['admin', 'vice_principal', 'youth_leader', 'principal', 'teacher', 'department_head', 'deputy_department_head', 'staff'],
    },

    // Admin only
    {
      label: 'Whitelist',
      path: '/admin/whitelist',
      icon: Mail,
      roles: ['admin'],
    },
    {
      label: 'Quản lý Users',
      path: '/admin/users',
      icon: Users,
      roles: ['admin'],
    },
    {
      label: 'Cơ sở / Phân hiệu',
      path: '/admin/campuses',
      icon: Building2,
      roles: ['admin', 'principal'],
    },

    // Super-admin only (platform-level, orthogonal to role)
    {
      label: 'Quản lý trường',
      path: '/super-admin/schools',
      icon: Building2,
      roles: [],
      requiresSuperAdmin: true,
    },
    {
      label: 'Quản lý gói',
      path: '/super-admin/plans',
      icon: Tag,
      roles: [],
      requiresSuperAdmin: true,
    },

    // Vice Principal & Principal
    {
      label: 'Tạo công việc',
      path: '/vp/create-task',
      icon: ClipboardList,
      roles: ['vice_principal', 'youth_leader', 'principal'],
    },
    {
      label: 'Danh sách công việc',
      path: '/vp/tasks',
      icon: CheckSquare,
      roles: ['vice_principal', 'youth_leader', 'principal'],
    },
    {
      label: 'Thống kê',
      path: '/vp/statistics',
      icon: BarChart3,
      roles: ['vice_principal', 'youth_leader', 'principal'],
    },
    {
      label: 'Theo dõi nộp hồ sơ',
      shortLabel: 'Nộp hồ sơ',
      path: '/vp/submission-matrix',
      icon: Table,
      roles: ['admin', 'vice_principal', 'youth_leader', 'principal'],
    },

    // Teacher
    {
      label: 'Công việc của tôi',
      shortLabel: 'Công việc',
      path: '/teacher/my-tasks',
      icon: ClipboardList,
      roles: ['teacher', 'department_head', 'deputy_department_head'],
    },
    {
      label: 'Điểm của tôi',
      shortLabel: 'Điểm',
      path: '/teacher/my-scores',
      icon: Award,
      roles: ['teacher', 'department_head', 'deputy_department_head'],
    },

    // Common
    {
      label: 'Bảng xếp hạng',
      shortLabel: 'Xếp hạng',
      path: '/rankings',
      icon: Trophy,
      roles: ['admin', 'vice_principal', 'youth_leader', 'principal', 'teacher', 'department_head', 'deputy_department_head'],
    },
    {
      label: 'Thông báo',
      path: '/notifications',
      icon: Bell,
      roles: ['admin', 'vice_principal', 'youth_leader', 'principal', 'teacher', 'department_head', 'deputy_department_head', 'staff'],
    },

    // Document Management - Common
    {
      label: 'Hồ sơ điện tử',
      path: '/documents',
      icon: FolderOpen,
      roles: ['admin', 'vice_principal', 'youth_leader', 'principal', 'teacher', 'department_head', 'deputy_department_head', 'staff'],
    },

    // Document Management - Approval (Department Head, Admin, VP, Principal)
    {
      label: 'Phê duyệt hồ sơ',
      path: '/documents/approvals',
      icon: FileCheck,
      roles: ['admin', 'vice_principal', 'youth_leader', 'principal', 'department_head', 'deputy_department_head'],
    },

    // Document Management - My Requests (Teacher, Staff, Department Head)
    {
      label: 'Yêu cầu của tôi',
      path: '/documents/my-requests',
      icon: FileText,
      roles: ['teacher', 'department_head', 'deputy_department_head', 'staff'],
    },

    // Document Management - Config (Admin, VP, Principal)
    {
      label: 'Cấu hình hồ sơ',
      path: '/documents/config',
      icon: Cog,
      roles: ['admin', 'vice_principal', 'youth_leader', 'principal'],
    },
  ];

  export const getNavigationForRole = (role: UserRole): NavItem[] => {
    return navigationItems.filter(item => item.roles.includes(role));
  };

  // Preferred over getNavigationForRole now that some items gate on the
  // orthogonal isSuperAdmin flag instead of (or in addition to) role.
  export const getNavigationForUser = (user: Pick<AppUser, 'role' | 'isSuperAdmin'>): NavItem[] => {
    return navigationItems.filter(item => {
      if (item.requiresSuperAdmin) return user.isSuperAdmin === true;
      return item.roles.includes(user.role);
    });
  };
