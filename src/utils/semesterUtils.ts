import { schoolYearService } from '../services/schoolYearService';

export type Semester = 'HK1' | 'HK2';
export type SemesterFilter = Semester | 'all' | 'unassigned';

// Display labels for semesters
export const SEMESTER_LABELS: Record<Semester, string> = {
  HK1: 'Học kì I',
  HK2: 'Học kì II',
};

// Display labels for semester filters (includes all options)
export const SEMESTER_FILTER_LABELS: Record<SemesterFilter, string> = {
  HK1: 'Học kì I',
  HK2: 'Học kì II',
  all: 'Tất cả',
  unassigned: 'Chưa phân kỳ',
};

/**
 * Get active semester from active school year (set by admin)
 * @returns Active semester or null if no active school year or no active semester set
 */
export async function getActiveSemester(): Promise<Semester | null> {
  try {
    const activeYear = await schoolYearService.getActiveSchoolYear();
    return activeYear?.activeSemester || null;
  } catch (error) {
    console.error('Error getting active semester:', error);
    return null;
  }
}

/**
 * @deprecated Use getActiveSemester() instead
 * Detect current semester based on current date
 * Vietnamese school calendar:
 * - HK1 (Học kì I): September 1 - December 31
 * - HK2 (Học kì II): January 1 - May 31
 * - Summer break: June - August
 *
 * @returns Current semester or null if in summer break
 */
export function getCurrentSemester(): Semester | null {
  const month = new Date().getMonth() + 1; // 1-12

  // HK1: September (9) to December (12)
  if (month >= 9 && month <= 12) {
    return 'HK1';
  }

  // HK2: January (1) to May (5)
  if (month >= 1 && month <= 5) {
    return 'HK2';
  }

  // Summer break: June (6) to August (8)
  return null;
}

/**
 * Get default filter value for semester dropdowns
 * Uses active semester from admin settings
 *
 * @param includeAll - If true, defaults to 'all' when no active semester. If false, defaults to 'HK1'
 * @returns Default semester filter value
 */
export async function getDefaultSemesterFilter(includeAll: boolean = true): Promise<SemesterFilter> {
  const activeSemester = await getActiveSemester();
  if (activeSemester) {
    return activeSemester;
  }
  return includeAll ? 'all' : 'HK1';
}
