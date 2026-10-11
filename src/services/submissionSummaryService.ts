import { authFetch } from '../lib/authFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/** Mục không có mục con (danh mục không chia tuần) được ghi là 'x'. */
export const NO_SUBCATEGORY_KEY = 'x';

export interface SubmissionSummary {
  categoryId: string;
  /** 'school': BGH/admin thấy cả trường; 'department': tổ trưởng/tổ phó chỉ thấy tổ mình. */
  scope: 'school' | 'department';
  /** Tổ mà tổ trưởng/tổ phó phụ trách (null khi scope = 'school'). */
  departmentIds: string[] | null;
  /** uid → các mục con đã nộp (hoặc ['x'] nếu danh mục không có mục con). */
  byTeacher: Record<string, string[]>;
  updatedAt: number | null;
}

/**
 * Bảng tổng hợp nộp hồ sơ do server lưu sẵn (server/submissionSummary.js) — xem chỉ tốn
 * ~1 lượt đọc/danh mục thay vì đọc toàn bộ hồ sơ của danh mục như trước.
 */
export const submissionSummaryService = {
  async get(categoryId: string): Promise<SubmissionSummary> {
    const response = await authFetch(`${API_BASE_URL}/submission-summary?categoryId=${encodeURIComponent(categoryId)}`);
    if (!response.ok) throw new Error(`Submission summary request failed: ${response.status}`);
    return response.json();
  },

  /**
   * Báo server đếm lại phần của 1 người trong 1 danh mục — gọi sau khi nộp / xóa / từ chối
   * hồ sơ, hoặc sau khi xóa danh mục (server xóa bản tổng hợp của danh mục đó).
   * Không chặn thao tác chính: lỗi chỉ ghi log (bảng tự dựng lại đủ sau tối đa 7 ngày).
   */
  refresh(categoryId: string | undefined, uid?: string): void {
    if (!categoryId) return;
    authFetch(`${API_BASE_URL}/submission-summary/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uid ? { categoryId, uid } : { categoryId }),
    })
      .then((r) => { if (!r.ok) console.error('Submission summary refresh failed:', r.status); })
      .catch((e) => console.error('Submission summary refresh error:', e));
  },
};
