import { normalizeName } from '@/shared/trackedCategories';

/**
 * Hạn nộp hồ sơ (màn "Theo dõi nộp hồ sơ" + "Cấu hình hồ sơ").
 *
 * Hạn lưu dạng ngày 'YYYY-MM-DD' (không giờ, tránh lệch múi giờ). Hết ngày đó theo giờ
 * Việt Nam (23:59:59) vẫn là đúng hạn; từ 0h hôm sau là TRỄ.
 * Kế hoạch bài dạy "Tuần N" (quy tắc BGH): nộp TRƯỚC 1 tuần — trong tuần N−1 (thứ Hai → CN)
 * nộp kế hoạch của tuần N; hạn = hết Chủ nhật tuần N−1; tuần N chỉ mở nhận hồ sơ từ thứ Hai
 * tuần N−1 (khóa tuần tương lai, tuần đã qua vẫn nộp bù nhưng tính TRỄ). Các tuần đầu năm có
 * thể gộp chung 1 hạn (vd tuần 1–7 hạn hết tuần 7). Mọi mốc là DỮ LIỆU của từng mục con
 * (deadline / openFrom) do admin đặt ở "Cấu hình hồ sơ" — weekSchedule() chỉ để tự điền gợi ý.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isDateString = (s: unknown): s is string => typeof s === 'string' && DATE_RE.test(s);

/** Mốc cuối cùng còn đúng hạn (ms) — hết ngày `date` theo giờ Việt Nam; null nếu không có hạn. */
export function deadlineEndMs(date: string | null | undefined): number | null {
  if (!isDateString(date)) return null;
  return Date.parse(`${date}T23:59:59.999+07:00`);
}

/** Cộng/trừ ngày cho chuỗi 'YYYY-MM-DD'. */
export function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Thứ trong tuần của 'YYYY-MM-DD' (0 = Chủ nhật, 1 = thứ Hai … 5 = thứ Sáu). */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Số tuần trong tên mục con ("Tuần 6", "tuan 06"...) — null nếu tên không có số tuần. */
export function weekNumberOf(name: string): number | null {
  const m = normalizeName(name).match(/\btuan\s*0*(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Thứ Hai / Chủ nhật của tuần thứ `week` theo lịch, biết ngày thứ Hai của tuần 1. */
export const mondayOfWeek = (week1Monday: string, week: number) => addDays(week1Monday, (week - 1) * 7);
export const sundayOfWeek = (week1Monday: string, week: number) => addDays(week1Monday, (week - 1) * 7 + 6);

/**
 * Lịch gợi ý cho mục con "Tuần N":
 *  - Bình thường: hạn = Chủ nhật tuần N−1, mở từ thứ Hai tuần N−1.
 *  - Tuần N <= mergeUntilWeek (các tuần đầu năm gộp hạn): hạn = Chủ nhật tuần mergeUntilWeek,
 *    không khóa (openFrom null).
 */
export function weekSchedule(week1Monday: string, week: number, mergeUntilWeek?: number | null): { deadline: string; openFrom: string | null } {
  if (mergeUntilWeek && week <= mergeUntilWeek) {
    return { deadline: sundayOfWeek(week1Monday, mergeUntilWeek), openFrom: null };
  }
  return { deadline: sundayOfWeek(week1Monday, week - 1), openFrom: mondayOfWeek(week1Monday, week - 1) };
}

/** Hôm nay theo giờ Việt Nam, dạng 'YYYY-MM-DD'. */
export function todayVN(now = Date.now()): string {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Admin + BGH nộp/sửa được cả tuần chưa mở (nộp hộ, chỉnh sửa khi cần). */
export const OPEN_LOCK_EXEMPT_ROLES = ['admin', 'principal', 'vice_principal', 'youth_leader'];

/** Mục con (tuần) chưa tới ngày mở nhận hồ sơ với người này → không được nộp/sửa. */
export function isNotYetOpen(
  sub: { openFrom?: string | null } | null | undefined,
  role: string | null | undefined,
  now = Date.now()
): boolean {
  if (!sub || !isDateString(sub.openFrom)) return false;
  if (role && OPEN_LOCK_EXEMPT_ROLES.includes(role)) return false;
  return todayVN(now) < sub.openFrom;
}

export type SubmissionCellStatus =
  | 'ontime'   // đã nộp, đúng hạn (hoặc không có hạn)
  | 'late'     // đã nộp, trễ
  | 'overdue'  // chưa nộp, đã quá hạn
  | 'pending'; // chưa nộp, chưa tới hạn (hoặc không có hạn)

export function cellStatus(submittedAt: number | undefined, deadline: string | null | undefined, now = Date.now()): SubmissionCellStatus {
  const end = deadlineEndMs(deadline);
  if (submittedAt !== undefined) return end !== null && submittedAt > end ? 'late' : 'ontime';
  return end !== null && now > end ? 'overdue' : 'pending';
}

/** 'YYYY-MM-DD' → "thứ Hai 19/10" (ngày mở nhận hồ sơ). */
export function formatOpenDate(date: string | null | undefined): string {
  if (!isDateString(date)) return '';
  const names = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];
  return names[weekdayOf(date)] + ' ' + date.slice(8, 10) + '/' + date.slice(5, 7);
}

/** 'YYYY-MM-DD' → 'dd/mm' để hiện gọn trong bảng. */
export const shortDate = (date: string | null | undefined) =>
  isDateString(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : '';
