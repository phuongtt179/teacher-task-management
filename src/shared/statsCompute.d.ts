export type SemesterParam = 'HK1' | 'HK2' | 'all' | undefined;

export interface StatsUser {
  uid: string;
  displayName?: string;
  email?: string;
}

export interface TeacherStats {
  uid: string;
  displayName: string;
  email: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  averageScore: number;
  totalScore: number;
  scoredTasksCount: number;
  completionRate: number;
  onTimeRate: number;
}

export interface SchoolStats {
  totalTeachers: number;
  totalTasks: number;
  completedTasks: number;
  averageScore: number;
  highPerformers: number;
  lowPerformers: number;
  averagePerformers: number;
  completionRate: number;
}

export interface VPStats {
  totalTasks: number;
  completedTasks: number;
  submittedTasks: number;
  assignedTasks: number;
  averageScore: number;
  totalTeachers: number;
  completionRate: number;
  submissionRate: number;
}

export function toDate(value: unknown): Date;
export function computeTeacherStats(
  user: StatsUser,
  schoolTasks: any[],
  schoolSubmissions: any[],
  semesterFilter?: SemesterParam,
  schoolYearId?: string
): TeacherStats;
export function computeSchoolStats(
  teachersStats: TeacherStats[],
  schoolTasks: any[],
  semesterFilter?: SemesterParam,
  schoolYearId?: string,
  vpUid?: string
): SchoolStats;
export function computeVPStats(
  tasksInScope: any[],
  submissions: any[],
  semesterFilter?: SemesterParam,
  schoolYearId?: string
): VPStats;
