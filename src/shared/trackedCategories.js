/**
 * Danh mục hồ sơ được THEO DÕI NỘP ở màn "Theo dõi nộp hồ sơ" — dùng chung cho app
 * (chọn danh mục hiện ra) và server (chặn xem danh mục khác qua API).
 *
 * - Kế hoạch của GIÁO VIÊN (theo từng người): "Kế hoạch bài dạy", "Kế hoạch môn học".
 *   Tổ trưởng/tổ phó xem của tổ mình; BGH/admin xem toàn trường.
 * - Kế hoạch TỔ CHUYÊN MÔN (theo từng tổ): các danh mục hồ sơ tổ "TỔ CM1"…"TỔ CM5",
 *   "TỔ BỘ MÔN" (không gồm Tổ văn phòng). Chỉ BGH/admin xem.
 *
 * Nhận diện theo TÊN danh mục (không phân biệt hoa thường, dấu, khoảng trắng).
 */

export function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const TEACHER_PLAN_NAMES = ['ke hoach bai day', 'ke hoach mon hoc'];

/** Danh mục kế hoạch của giáo viên (theo dõi theo từng người). */
export function isTeacherPlanCategory(name) {
  return TEACHER_PLAN_NAMES.includes(normalizeName(name));
}

/** Danh mục hồ sơ của 1 tổ chuyên môn (theo dõi theo từng tổ). */
export function isDepartmentPlanCategory(name) {
  const n = normalizeName(name);
  return /^to cm ?\d+$/.test(n) || n === 'to bo mon';
}

export const SCHOOL_WIDE_ROLES = ['admin', 'principal', 'vice_principal', 'youth_leader'];
export const DEPARTMENT_HEAD_ROLES = ['department_head', 'deputy_department_head'];

/** Vai trò này có được xem tiến độ nộp của danh mục này không. */
export function canTrackCategory(role, categoryName) {
  if (SCHOOL_WIDE_ROLES.includes(role)) {
    return isTeacherPlanCategory(categoryName) || isDepartmentPlanCategory(categoryName);
  }
  if (DEPARTMENT_HEAD_ROLES.includes(role)) return isTeacherPlanCategory(categoryName);
  return false;
}
