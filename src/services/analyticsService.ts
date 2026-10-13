import {
  query,
  where
} from 'firebase/firestore';
import { getDocs } from '@/lib/readTracker';
import { tenantCollection } from '../lib/tenantQuery';
import { authFetch } from '../lib/authFetch';
import { Task, Submission } from '../types';
import {
  computeTeacherStats,
  type TeacherStats,
  type SemesterParam,
} from './statsCompute';

export type { TeacherStats, SchoolStats } from './statsCompute';

// Firestore giới hạn tối đa 30 giá trị cho toán tử 'in'.
const IN_QUERY_LIMIT = 30;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const isYearFilter = (schoolYearId?: string): schoolYearId is string =>
  !!schoolYearId && schoolYearId !== 'all';

export const analyticsService = {
  /**
   * Dữ liệu thô của 1 giáo viên: hồ sơ + việc được giao + mọi bài nộp (mọi phiên bản).
   * onlyYearId: chỉ đọc dữ liệu của năm học đó thay vì của mọi năm (chỉ truyền cho
   * năm học HIỆN TẠI — bài nộp có trường schoolYearId từ 15/04/2026, năm cũ hơn có
   * thể thiếu nên khi xem năm cũ vẫn phải đọc toàn bộ như trước).
   */
  async loadTeacherData(schoolId: string, teacherId: string, onlyYearId?: string) {
    const tasksQuery = query(tenantCollection('tasks', schoolId), where('assignedTo', 'array-contains', teacherId));
    const submissionsQuery = query(tenantCollection('submissions', schoolId), where('teacherId', '==', teacherId));
    const [usersSnap, tasksSnap, submissionsSnap] = await Promise.all([
      getDocs(query(tenantCollection('users', schoolId), where('__name__', '==', teacherId))),
      getDocs(onlyYearId ? query(tasksQuery, where('schoolYearId', '==', onlyYearId)) : tasksQuery),
      getDocs(onlyYearId ? query(submissionsQuery, where('schoolYearId', '==', onlyYearId)) : submissionsQuery),
    ]);
    const userData = usersSnap.empty ? null : usersSnap.docs[0].data();
    return {
      user: userData ? { uid: teacherId, displayName: userData.displayName, email: userData.email } : null,
      tasks: tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)),
      submissions: submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)),
    };
  },

  /** Lấy task theo danh sách id — gộp 30 id/truy vấn, chạy song song. */
  async getTasksByIds(schoolId: string, taskIds: string[]): Promise<Task[]> {
    const chunks: string[][] = [];
    for (let i = 0; i < taskIds.length; i += IN_QUERY_LIMIT) chunks.push(taskIds.slice(i, i + IN_QUERY_LIMIT));
    const snaps = await Promise.all(
      chunks.map(chunk => getDocs(query(tenantCollection('tasks', schoolId), where('__name__', 'in', chunk))))
    );
    return snaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
  },

  // Thống kê của 1 giáo viên — chỉ đọc dữ liệu của đúng người đó.
  // activeYearId: năm học hiện tại — nếu đang xem đúng năm đó thì chỉ đọc dữ liệu năm này.
  async getTeacherStats(schoolId: string, teacherId: string, semesterFilter?: SemesterParam, schoolYearId?: string, activeYearId?: string): Promise<TeacherStats | null> {
    try {
      const onlyYearId = activeYearId && schoolYearId === activeYearId ? activeYearId : undefined;
      const { user, tasks, submissions } = await this.loadTeacherData(schoolId, teacherId, onlyYearId);
      if (!user) return null;
      return computeTeacherStats(user, tasks, submissions, semesterFilter, schoolYearId);
    } catch (error) {
      console.error('Error getting teacher stats:', error);
      return null;
    }
  },

  /**
   * Điểm trung bình toàn trường cho dashboard/"Điểm của tôi" của giáo viên.
   *
   * Server tính bằng truy vấn tổng hợp average() (~1 lượt đọc/1000 bài nộp) — không
   * tính ở trình duyệt nữa vì giáo viên không được đọc bài nộp của người khác
   * (firestore.rules). Lọc năm học theo trường schoolYearId của bài nộp (bài nộp
   * rất cũ chưa có trường này sẽ không được tính khi lọc năm).
   */
  async getSchoolAverageScore(_schoolId: string, semesterFilter?: SemesterParam, schoolYearId?: string): Promise<number> {
    try {
      const params = new URLSearchParams({
        year: isYearFilter(schoolYearId) ? schoolYearId : 'all',
        semester: semesterFilter || 'all',
      });
      const response = await authFetch(`${API_BASE_URL}/school-average?${params}`);
      if (!response.ok) throw new Error(`School average request failed: ${response.status}`);
      const { average } = await response.json();
      return typeof average === 'number' ? average : 0;
    } catch (error) {
      console.error('Error getting school average score:', error);
      return 0;
    }
  },
};
