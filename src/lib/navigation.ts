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
    User
  } from 'lucide-react';
  import { UserRole } from '../types';

  export interface NavItem {
    label: string;
    shortLabel?: string; // For mobile bottom nav
    path: string;
    icon: any;
    roles: UserRole[];
  }

  export const navigationItems: NavItem[] = [
    // Common
    {
      label: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      roles: ['admin', 'vice_principal', 'principal', 'teacher', 'department_head', 'staff'],
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

    // Vice Principal & Principal
    {
      label: 'Tạo công việc',
      path: '/vp/create-task',
      icon: ClipboardList,
      roles: ['vice_principal', 'principal'],
    },
    {
      label: 'Danh sách công việc',
      path: '/vp/tasks',
      icon: CheckSquare,
      roles: ['vice_principal', 'principal'],
    },
    {
      label: 'Thống kê',
      path: '/vp/statistics',
      icon: BarChart3,
      roles: ['vice_principal', 'principal'],
    },

    // Teacher
    {
      label: 'Công việc của tôi',
      shortLabel: 'Công việc',
      path: '/teacher/my-tasks',
      icon: ClipboardList,
      roles: ['teacher', 'department_head'],
    },
    {
      label: 'Điểm của tôi',
      shortLabel: 'Điểm',
      path: '/teacher/my-scores',
      icon: Award,
      roles: ['teacher', 'department_head'],
    },

    // Common
    {
      label: 'Bảng xếp hạng',
      shortLabel: 'Xếp hạng',
      path: '/rankings',
      icon: Trophy,
      roles: ['admin', 'vice_principal', 'principal', 'teacher', 'department_head'],
    },
    {
      label: 'Thông báo',
      path: '/notifications',
      icon: Bell,
      roles: ['admin', 'vice_principal', 'principal', 'teacher', 'department_head', 'staff'],
    },

    // Document Management - Common
    {
      label: 'Hồ sơ điện tử',
      path: '/documents',
      icon: FolderOpen,
      roles: ['admin', 'vice_principal', 'principal', 'teacher', 'department_head', 'staff'],
    },

    // Document Management - Approval (Department Head, Admin, VP, Principal)
    {
      label: 'Phê duyệt hồ sơ',
      path: '/documents/approvals',
      icon: FileCheck,
      roles: ['admin', 'vice_principal', 'principal', 'department_head'],
    },

    // Document Management - My Requests (Teacher, Staff, Department Head)
    {
      label: 'Yêu cầu của tôi',
      path: '/documents/my-requests',
      icon: FileText,
      roles: ['teacher', 'department_head', 'staff'],
    },

    // Document Management - Config (Admin, VP, Principal)
    {
      label: 'Cấu hình hồ sơ',
      path: '/documents/config',
      icon: Cog,
      roles: ['admin', 'vice_principal', 'principal'],
    },
  ];

  export const getNavigationForRole = (role: UserRole): NavItem[] => {
    return navigationItems.filter(item => item.roles.includes(role));
  };
