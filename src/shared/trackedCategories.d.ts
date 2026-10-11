export function normalizeName(name: string | null | undefined): string;
export function isTeacherPlanCategory(name: string | null | undefined): boolean;
export function isDepartmentPlanCategory(name: string | null | undefined): boolean;
export const SCHOOL_WIDE_ROLES: string[];
export const DEPARTMENT_HEAD_ROLES: string[];
export function canTrackCategory(role: string | null | undefined, categoryName: string | null | undefined): boolean;
