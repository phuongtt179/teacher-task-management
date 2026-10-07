import {
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { tenantCollection } from '../lib/tenantQuery';
import { authFetch } from '../lib/authFetch';
import { Task, Submission } from '../types';
import {
  computeTeacherStats,
  computeSchoolStats,
  computeVPStats,
  type TeacherStats,
  type SchoolStats,
  type SemesterParam,
} from './statsCompute';

export type { TeacherStats, SchoolStats } from './statsCompute';

// Firestore giới hạn tối đa 30 giá trị cho toán tử 'in'.
const IN_QUERY_LIMIT = 30;

const TEACHER_ROLES = ['teacher', 'department_head', 'deputy_department_head'];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const isYearFilter = (schoolYearId?: string): schoolYearId is string =>
  !!schoolYearId && schoolYearId !== 'all';

async function loadSchoolTasks(schoolId: string, schoolYearId?: string): Promise<Task[]> {
  const base = tenantCollection('tasks', schoolId);
  const q = isYearFilter(schoolYearId) ? query(base, where('schoolYearId', '==', schoolYearId)) : base;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
}

async function loadAllSubmissions(schoolId: string): Promise<Submission[]> {
  const snap = await getDocs(tenantCollection('submissions', schoolId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission));
}

/** Mọi bài nộp (mọi phiên bản) của các task cho trước — gộp 30 task/truy vấn, chạy song song. */
async function loadSubmissionsForTasks(schoolId: string, taskIds: string[]): Promise<Submission[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < taskIds.length; i += IN_QUERY_LIMIT) {
    chunks.push(taskIds.slice(i, i + IN_QUERY_LIMIT));
  }
  const snaps = await Promise.all(
    chunks.map(chunk => getDocs(query(tenantCollection('submissions', schoolId), where('taskId', 'in', chunk))))
  );
  return snaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
}

/**
 * Việc + bài nộp (mọi phiên bản) của trường. Có schoolYearId thì chỉ lấy việc
 * của năm đó và bài nộp của đúng các việc đó; không có thì lấy toàn bộ.
 */
export async function loadTasksAndSubmissions(schoolId: string, schoolYearId?: string) {
  const tasks = await loadSchoolTasks(schoolId, schoolYearId);
  const submissions = isYearFilter(schoolYearId)
    ? await loadSubmissionsForTasks(schoolId, tasks.map(t => t.id))
    : await loadAllSubmissions(schoolId);
  return { tasks, submissions };
}

/**
 * Tải dữ liệu của CẢ TRƯỜNG đúng 1 lần cho mọi thống kê theo giáo viên.
 *
 * Trước đây mỗi giáo viên tự gửi 3 truy vấn riêng (hồ sơ + mọi việc được giao,
 * kể cả các năm cũ + mọi bài nộp) — 1 việc giao cho 80 người bị đọc lại 80 lần.
 * Với ~100 giáo viên, mỗi lần mở dashboard giáo viên tốn hàng chục nghìn lượt đọc,
 * là nguyên nhân chính làm hết quota Firestore miễn phí.
 *
 * Có lọc năm học: chỉ tải việc của năm đó, và bài nộp của đúng các việc đó (gồm
 * cả bài nộp cũ chưa có schoolYearId — logic đối chiếu taskId vẫn giữ nguyên).
 */
async function loadSchoolData(schoolId: string, schoolYearId?: string) {
  const [usersSnap, { tasks, submissions }] = await Promise.all([
    getDocs(query(tenantCollection('users', schoolId), where('role', 'in', TEACHER_ROLES))),
    loadTasksAndSubmissions(schoolId, schoolYearId),
  ]);

  const teachers = usersSnap.docs.map(d => ({
    uid: d.id,
    displayName: d.data().displayName,
    email: d.data().email,
  }));
  return { teachers, tasks, submissions };
}

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
   * Thống kê toàn trường + từng giáo viên trong 1 lần tải. Màn hình nào cần cả
   * 2 thì gọi hàm này thay vì gọi getSchoolStats + getAllTeachersStats (trước
   * đây mỗi hàm tự tải toàn bộ dữ liệu trường 1 lần riêng).
   */
  async getSchoolOverview(schoolId: string, semesterFilter?: SemesterParam, schoolYearId?: string, vpUid?: string): Promise<{ schoolStats: SchoolStats; teachersStats: TeacherStats[] }> {
    const { teachers, tasks, submissions } = await loadSchoolData(schoolId, schoolYearId);
    const teachersStats = teachers.map(t => computeTeacherStats(t, tasks, submissions, semesterFilter, schoolYearId));

    // vpUid: chỉ đếm việc do người đó tạo — trong mọi năm học nếu không lọc năm,
    // nên khi không lọc năm thì `tasks` (toàn trường) đã đủ; có lọc năm thì
    // `tasks` đã là việc của năm đó.
    const schoolStats = computeSchoolStats(teachersStats, tasks, semesterFilter, schoolYearId, vpUid);
    return { schoolStats, teachersStats };
  },

  async getAllTeachersStats(schoolId: string, semesterFilter?: SemesterParam, schoolYearId?: string): Promise<TeacherStats[]> {
    try {
      return (await this.getSchoolOverview(schoolId, semesterFilter, schoolYearId)).teachersStats;
    } catch (error) {
      console.error('Error getting all teachers stats:', error);
      return [];
    }
  },

  async getSchoolStats(schoolId: string, semesterFilter?: SemesterParam, schoolYearId?: string, vpUid?: string): Promise<SchoolStats> {
    try {
      return (await this.getSchoolOverview(schoolId, semesterFilter, schoolYearId, vpUid)).schoolStats;
    } catch (error) {
      console.error('Error getting school stats:', error);
      return {
        totalTeachers: 0,
        totalTasks: 0,
        completedTasks: 0,
        averageScore: 0,
        highPerformers: 0,
        lowPerformers: 0,
        averagePerformers: 0,
        completionRate: 0,
      };
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

  // Get VP statistics
  // vpUid bỏ trống = toàn trường (dùng cho hiệu trưởng xem tổng quan); truyền vào =
  // chỉ tính việc do đúng người đó tạo (dùng cho "Công việc của tôi" của hiệu phó/...).
  async getVPStats(schoolId: string, vpUid?: string, semesterFilter?: SemesterParam, schoolYearId?: string) {
    try {
      const tasksQuery = vpUid
        ? query(tenantCollection('tasks', schoolId), where('createdBy', '==', vpUid))
        : tenantCollection('tasks', schoolId);
      const tasksSnap = await getDocs(tasksQuery);
      const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));

      // Chỉ tải bài nộp của các việc còn lại sau khi lọc năm/học kỳ — gộp 30 việc
      // mỗi truy vấn, chạy song song (trước đây 1 truy vấn/việc, chạy tuần tự).
      const scopedIds = allTasks
        .filter(t => !isYearFilter(schoolYearId) || t.schoolYearId === schoolYearId)
        .filter(t => !semesterFilter || semesterFilter === 'all' || t.semester === semesterFilter)
        .map(t => t.id);
      const submissions = await loadSubmissionsForTasks(schoolId, scopedIds);

      return computeVPStats(allTasks, submissions, semesterFilter, schoolYearId);
    } catch (error) {
      console.error('Error getting VP stats:', error);
      return null;
    }
  },
};
