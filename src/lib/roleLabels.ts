import { UserRole } from '@/types';

// Tên hiển thị MẶC ĐỊNH của từng vai trò — dùng khi chưa có tên tùy chỉnh.
// Đây KHÔNG phải danh sách quyền hạn, chỉ là chữ hiển thị lên UI.
export const DEFAULT_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  principal: 'Hiệu trưởng',
  vice_principal: 'Hiệu phó',
  youth_leader: 'Tổng phụ trách Đội',
  department_head: 'Tổ trưởng',
  deputy_department_head: 'Tổ phó',
  teacher: 'Giáo viên',
  staff: 'Nhân viên',
  van_thu: 'Văn thư',
  super_admin: 'Super Admin',
};

// Vai trò hiện ra ở "Quản lý vai trò" cho admin đổi tên — không gồm super_admin
// (vai trò nền tảng, không thuộc về 1 trường cụ thể nên không cho đổi ở đây).
export const MANAGEABLE_ROLES: UserRole[] = [
  'admin', 'principal', 'vice_principal', 'youth_leader',
  'department_head', 'deputy_department_head', 'teacher', 'staff', 'van_thu',
];

// Cache tên tùy chỉnh trong bộ nhớ — nạp 1 lần lúc đăng nhập (xem App.tsx),
// đọc lại đồng bộ ở mọi nơi khỏi phải async/loading riêng từng chỗ.
let customLabels: Partial<Record<UserRole, string>> = {};

export function setCustomRoleLabels(labels: Partial<Record<UserRole, string>>) {
  customLabels = labels || {};
}

export function getCustomRoleLabels() {
  return customLabels;
}

export function getRoleLabel(role: UserRole | string | undefined | null): string {
  if (!role) return '';
  return customLabels[role as UserRole] || DEFAULT_ROLE_LABELS[role as UserRole] || role;
}
