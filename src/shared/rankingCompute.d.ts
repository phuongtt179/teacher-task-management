export type RankingPeriod = 'school_year' | 'last_4_weeks' | 'last_week';
export type RankingType = 'total_score' | 'average_score' | 'completion_rate';
export type RankingSemester = 'all' | 'HK1' | 'HK2';

export interface RankingStat {
  actualUid: string;
  displayName: string;
  totalScore: number;
  averageScore: number;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  onTimeRate: number;
}

export interface AnonymousRanking extends RankingStat {
  anonymousId: string;
  rank: number;
  isCurrentUser: boolean;
}

export const RANKING_PERIODS: RankingPeriod[];
export const RANKING_TYPES: RankingType[];
export const RANKING_SEMESTERS: RankingSemester[];

export function toDate(value: unknown): Date;
export function getWeekStart(now?: Date): Date;
export function getRankingWindow(period: RankingPeriod, weekStart: Date): { start: Date | null; end: Date };
export function computeRankingStats(
  teachers: { uid: string; displayName?: string }[],
  schoolTasks: any[],
  schoolSubmissions: any[],
  startDate: Date | null,
  semesterFilter?: string,
  endDate?: Date | null
): RankingStat[];
export function rankTeachers(
  stats: RankingStat[],
  rankBy: RankingType,
  currentUserId?: string,
  currentUserRole?: string
): AnonymousRanking[];
