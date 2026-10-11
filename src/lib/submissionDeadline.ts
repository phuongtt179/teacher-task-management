import { normalizeName } from '@/shared/trackedCategories';

/**
 * Hạn nộp hồ sơ (màn "Theo dõi nộp hồ sơ" + "Cấu hình hồ sơ").
 *
 * Hạn lưu dạng ngày 'YYYY-MM-DD' (không giờ, tránh lệch múi giờ). Hết ngày đó theo giờ
 * Việt Nam (23:59:59) vẫn là đúng hạn; từ 0h hôm sau là TRỄ.
 * Kế hoạch bài dạy "Tuần N": hạn = thứ Sáu của tuần N → nộp từ thứ Bảy trở đi là trễ.
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

/** Hạn (thứ Sáu) của tuần thứ `week`, biết ngày thứ Hai của tuần 1. */
export function fridayOfWeek(week1Monday: string, week: number): string {
  return addDays(week1Monday, (week - 1) * 7 + 4);
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

/** 'YYYY-MM-DD' → 'dd/mm' để hiện gọn trong bảng. */
export const shortDate = (date: string | null | undefined) =>
  isDateString(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : '';
