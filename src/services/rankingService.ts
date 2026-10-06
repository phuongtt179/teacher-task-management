import { authFetch } from '../lib/authFetch';
import type { AnonymousRanking, RankingPeriod, RankingSemester, RankingType } from '../shared/rankingCompute';

export type { AnonymousRanking, RankingPeriod, RankingSemester, RankingType } from '../shared/rankingCompute';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface RankingsResult {
  rankings: AnonymousRanking[];
  /** 0h thứ Hai (giờ VN) của tuần đang dùng — bảng tính đến hết Chủ nhật trước mốc này. */
  weekStart: number;
  computedAt: number;
}

export const rankingService = {
  /**
   * Bảng xếp hạng do server tính sẵn mỗi tuần (xem server/rankingSnapshot.js) — mỗi
   * lần xem chỉ tốn vài lượt đọc thay vì trình duyệt tự đọc toàn bộ dữ liệu của trường.
   */
  async getRankings(period: RankingPeriod, rankBy: RankingType, semester: RankingSemester): Promise<RankingsResult> {
    const params = new URLSearchParams({ period, rankBy, semester });
    const response = await authFetch(`${API_BASE_URL}/rankings?${params}`);
    if (!response.ok) throw new Error(`Rankings request failed: ${response.status}`);
    return response.json();
  },
};
