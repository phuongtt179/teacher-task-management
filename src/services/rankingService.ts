import { getDocs, query, where } from 'firebase/firestore';
import { tenantCollection } from '../lib/tenantQuery';
import { loadTasksAndSubmissions } from './analyticsService';
import { schoolYearService } from './schoolYearService';
import {
  computeRankingStats,
  getRankingStartDate,
  rankTeachers,
  type AnonymousRanking,
  type RankingPeriod,
  type RankingStat,
  type RankingType,
  type SemesterParam,
} from './statsCompute';

export type { AnonymousRanking, RankingPeriod, RankingStat, RankingType } from './statsCompute';

// Bảng xếp hạng tính trên toàn bộ dữ liệu của trường — dùng lại kết quả trong 10
// phút để mở lại màn hình / đổi qua lại bộ lọc không phải tải lại từ đầu.
const STATS_TTL_MS = 10 * 60 * 1000;
const statsCache = new Map<string, { at: number; data: RankingStat[] }>();

export const rankingService = {
  /**
   * Số liệu thô (chưa xếp hạng) của mọi giáo viên. Tải toàn bộ việc + bài nộp của
   * trường trong 2 truy vấn rồi tính trong bộ nhớ — trước đây mỗi giáo viên tự gửi
   * truy vấn riêng, 1 việc giao 80 người bị đọc lại 80 lần.
   */
  async getRankingStats(schoolId: string, period: RankingPeriod = 'all_time', semesterFilter?: SemesterParam): Promise<RankingStat[]> {
    try {
      // Xếp hạng tính riêng từng năm học ("năm nào dứt điểm năm đó"): chỉ tải việc +
      // bài nộp của năm học hiện tại. "all_time" = cả năm học này. Chưa có năm học
      // nào đang hoạt động thì mới tính trên toàn bộ dữ liệu.
      const activeYear = await schoolYearService.getActiveSchoolYear(schoolId);
      const yearId = activeYear?.id;

      const cacheKey = `${schoolId}|${yearId ?? 'all'}|${period}|${semesterFilter ?? 'all'}`;
      const hit = statsCache.get(cacheKey);
      if (hit && Date.now() - hit.at < STATS_TTL_MS) return hit.data;

      const [teachersSnap, { tasks, submissions }] = await Promise.all([
        getDocs(query(tenantCollection('users', schoolId), where('role', '==', 'teacher'))),
        loadTasksAndSubmissions(schoolId, yearId),
      ]);
      const teachers = teachersSnap.docs.map(d => ({ uid: d.id, displayName: d.data().displayName }));

      const data = computeRankingStats(teachers, tasks, submissions, getRankingStartDate(period), semesterFilter);
      statsCache.set(cacheKey, { at: Date.now(), data });
      return data;
    } catch (error) {
      console.error('Error getting ranking stats:', error);
      return [];
    }
  },

  rankTeachers,

  async getRankings(
    schoolId: string,
    period: RankingPeriod = 'all_time',
    rankBy: RankingType = 'total_score',
    semesterFilter?: SemesterParam,
    currentUserId?: string,
    currentUserRole?: string
  ): Promise<AnonymousRanking[]> {
    const stats = await this.getRankingStats(schoolId, period, semesterFilter);
    return rankTeachers(stats, rankBy, currentUserId, currentUserRole);
  },
};
