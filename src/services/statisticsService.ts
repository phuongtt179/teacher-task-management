import { authFetch } from '../lib/authFetch';
import type { SchoolStats, TeacherStats, VPStats } from '../shared/statsCompute';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export type StatSemester = 'all' | 'HK1' | 'HK2';

export interface SchoolStatistics {
  /** Thời điểm server tính (ms) — hiển thị "Cập nhật lúc ...". */
  computedAt: number;
  bySemester: Record<StatSemester, { schoolStats: SchoolStats; teachersStats: TeacherStats[] }>;
  /** Việc do chính người xem tạo. */
  myVpStats: Record<StatSemester, VPStats>;
  /** Việc của cả trường (dashboard hiệu trưởng). */
  schoolVpStats: Record<StatSemester, VPStats>;
}

// Nhớ kết quả 15 phút, dùng chung giữa màn Thống kê, tab "Theo giáo viên" và
// Dashboard — quay lại màn hình hay chuyển tab không phải gọi server lại.
const CLIENT_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; promise: Promise<SchoolStatistics> }>();

export const toStatSemester = (semester: string | undefined): StatSemester =>
  semester === 'HK1' || semester === 'HK2' ? semester : 'all';

/** Dòng ghi chú dưới tiêu đề: thống kê chỉ tính 1 lần/ngày nên ghi rõ tính lúc nào. */
export const describeComputedAt = (computedAt: number) => {
  const d = new Date(computedAt);
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  return `Số liệu tính lúc ${time} ngày ${date} — mỗi ngày cập nhật 1 lần, bài chấm hôm nay sẽ hiện vào ngày mai.`;
};

export const statisticsService = {
  /**
   * Thống kê của cả 3 lựa chọn học kỳ cho 1 năm học (đổi học kỳ không cần tải lại).
   * Server mỗi ngày chỉ tính 1 lần (giờ VN), cả BGH dùng chung.
   */
  getStatistics(schoolYearId: string): Promise<SchoolStatistics> {
    const yearKey = schoolYearId || 'all';
    const hit = cache.get(yearKey);
    if (hit && Date.now() - hit.at < CLIENT_TTL_MS) return hit.promise;

    const params = new URLSearchParams({ year: yearKey });
    const promise = authFetch(`${API_BASE_URL}/statistics?${params}`).then(async (response) => {
      if (!response.ok) throw new Error(`Statistics request failed: ${response.status}`);
      return response.json() as Promise<SchoolStatistics>;
    });
    cache.set(yearKey, { at: Date.now(), promise });
    promise.catch(() => cache.delete(yearKey)); // lỗi thì lần sau thử lại, không nhớ lỗi
    return promise;
  },
};
