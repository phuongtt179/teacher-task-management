// Phần TÍNH TOÁN thống kê, tách riêng khỏi phần đọc Firestore (không import
// firebase ở đây) để: (1) tải dữ liệu 1 lần cho cả trường rồi tính cho từng
// giáo viên trong bộ nhớ, thay vì mỗi giáo viên tự gửi truy vấn riêng; (2) test
// được bằng dữ liệu giả lập. Logic lọc/tính giữ NGUYÊN như phiên bản cũ.
import type { Task, Submission } from '../types';

export const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
};

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

const filterByYearAndSemester = (tasks: Task[], schoolYearId?: string, semester?: SemesterParam) => {
  let result = tasks;
  if (schoolYearId && schoolYearId !== 'all') result = result.filter(t => t.schoolYearId === schoolYearId);
  if (semester && semester !== 'all') result = result.filter(t => t.semester === semester);
  return result;
};

/**
 * Thống kê cho 1 giáo viên. `schoolTasks`/`schoolSubmissions` là dữ liệu của cả
 * trường (đã tải sẵn 1 lần) — hàm tự lọc phần của giáo viên này.
 */
export function computeTeacherStats(
  user: StatsUser,
  schoolTasks: Task[],
  schoolSubmissions: Submission[],
  semesterFilter?: SemesterParam,
  schoolYearId?: string
): TeacherStats {
  const tasks = filterByYearAndSemester(
    schoolTasks.filter(t => Array.isArray(t.assignedTo) && t.assignedTo.includes(user.uid)),
    schoolYearId,
    semesterFilter
  );

  let submissions = schoolSubmissions.filter(s => s.teacherId === user.uid);

  // Bài nộp mới có schoolYearId (denormalize); bài cũ chưa có thì đối chiếu qua taskId.
  if (schoolYearId && schoolYearId !== 'all') {
    const taskIdSet = new Set(tasks.map(t => t.id));
    submissions = submissions.filter(s =>
      s.schoolYearId === schoolYearId ||
      (!s.schoolYearId && taskIdSet.has(s.taskId))
    );
  }
  if (semesterFilter && semesterFilter !== 'all') {
    submissions = submissions.filter(s => s.semester === semesterFilter);
  }

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = tasks.filter(
    t => t.status === 'assigned' || t.status === 'in_progress' || t.status === 'submitted'
  ).length;

  const scoredSubmissions = submissions.filter(s => s.score !== undefined);
  const totalScore = scoredSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
  const averageScore = scoredSubmissions.length > 0
    ? Math.round((totalScore / scoredSubmissions.length) * 10) / 10
    : 0;

  const completionRate = tasks.length > 0
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  let onTimeCount = 0;
  submissions.forEach(submission => {
    const task = tasks.find(t => t.id === submission.taskId);
    if (task && submission.submittedAt && task.deadline) {
      if (toDate(submission.submittedAt) <= toDate(task.deadline)) onTimeCount++;
    }
  });
  const onTimeRate = submissions.length > 0
    ? Math.round((onTimeCount / submissions.length) * 100)
    : 0;

  return {
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    totalTasks: tasks.length,
    completedTasks,
    pendingTasks,
    averageScore,
    totalScore,
    scoredTasksCount: scoredSubmissions.length,
    completionRate,
    onTimeRate,
  };
}

/** Tổng quan toàn trường từ thống kê từng giáo viên + danh sách việc. */
export function computeSchoolStats(
  teachersStats: TeacherStats[],
  schoolTasks: Task[],
  semesterFilter?: SemesterParam,
  schoolYearId?: string,
  vpUid?: string
): SchoolStats {
  // Đếm tasks trực tiếp từ danh sách việc (1 việc giao nhiều GV chỉ tính 1 lần);
  // có vpUid thì chỉ tính việc do người đó tạo.
  const scopedTasks = vpUid ? schoolTasks.filter(t => t.createdBy === vpUid) : schoolTasks;
  const allTasks = filterByYearAndSemester(scopedTasks, schoolYearId, semesterFilter);

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'completed').length;

  const teachersWithScores = teachersStats.filter(t => t.scoredTasksCount > 0);
  const totalWeightedScore = teachersWithScores.reduce((sum, t) => sum + (t.averageScore * t.scoredTasksCount), 0);
  const totalScoredTasks = teachersWithScores.reduce((sum, t) => sum + t.scoredTasksCount, 0);
  const averageScore = totalScoredTasks > 0
    ? Math.round((totalWeightedScore / totalScoredTasks) * 10) / 10
    : 0;

  const highPerformers = teachersWithScores.filter(t => t.averageScore > averageScore).length;
  const lowPerformers = teachersWithScores.filter(t => t.averageScore < averageScore).length;
  const averagePerformers = teachersWithScores.length - highPerformers - lowPerformers;

  return {
    totalTeachers: teachersStats.length,
    totalTasks,
    completedTasks,
    averageScore,
    highPerformers,
    lowPerformers,
    averagePerformers,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
}

/** Thống kê việc do 1 người tạo (hoặc toàn trường). `submissions` = mọi bài nộp của các việc đó. */
export function computeVPStats(
  tasksInScope: Task[],
  submissions: Submission[],
  semesterFilter?: SemesterParam,
  schoolYearId?: string
) {
  const tasks = filterByYearAndSemester(tasksInScope, schoolYearId, semesterFilter);
  const taskIdSet = new Set(tasks.map(t => t.id));
  let allSubmissions = submissions.filter(s => taskIdSet.has(s.taskId));
  if (semesterFilter && semesterFilter !== 'all') {
    allSubmissions = allSubmissions.filter(s => s.semester === semesterFilter);
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const submittedTasks = tasks.filter(t => t.status === 'submitted').length;
  const assignedTasks = tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress').length;

  const scoredSubmissions = allSubmissions.filter(s => s.score !== undefined);
  const averageScore = scoredSubmissions.length > 0
    ? Math.round((scoredSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / scoredSubmissions.length) * 10) / 10
    : 0;

  const uniqueTeachers = new Set<string>();
  tasks.forEach(task => {
    if (task.assignedTo && Array.isArray(task.assignedTo)) {
      task.assignedTo.forEach((teacherId: string) => uniqueTeachers.add(teacherId));
    }
  });

  return {
    totalTasks,
    completedTasks,
    submittedTasks,
    assignedTasks,
    averageScore,
    totalTeachers: uniqueTeachers.size,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    submissionRate: totalTasks > 0 ? Math.round(((submittedTasks + completedTasks) / totalTasks) * 100) : 0,
  };
}

// ==================== Bảng xếp hạng ====================

export type RankingPeriod = 'all_time' | 'this_month' | 'this_week';
export type RankingType = 'total_score' | 'average_score' | 'completion_rate';

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
  isCurrentUser?: boolean;
}

export function getRankingStartDate(period: RankingPeriod, now: Date = new Date()): Date | null {
  if (period === 'this_month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'this_week') {
    const d = new Date(now);
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  }
  return null;
}

/** Số liệu thô để xếp hạng (chưa sắp xếp) — đổi kiểu xếp hạng không cần tải lại. */
export function computeRankingStats(
  teachers: StatsUser[],
  schoolTasks: Task[],
  schoolSubmissions: Submission[],
  startDate: Date | null,
  semesterFilter?: SemesterParam
): RankingStat[] {
  const stats = teachers.map((teacher) => {
    let tasks = schoolTasks.filter(t => Array.isArray(t.assignedTo) && t.assignedTo.includes(teacher.uid));
    if (startDate) {
      tasks = tasks.filter(task => task.createdAt ? toDate(task.createdAt) >= startDate : false);
    }
    if (semesterFilter && semesterFilter !== 'all') tasks = tasks.filter(t => t.semester === semesterFilter);

    let submissions = schoolSubmissions.filter(s => s.teacherId === teacher.uid);
    if (startDate) {
      submissions = submissions.filter(sub => sub.submittedAt ? toDate(sub.submittedAt) >= startDate : false);
    }
    if (semesterFilter && semesterFilter !== 'all') submissions = submissions.filter(s => s.semester === semesterFilter);

    const scoredSubmissions = submissions.filter(s => s.score !== undefined);
    const totalScore = scoredSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
    const averageScore = scoredSubmissions.length > 0
      ? Math.round((totalScore / scoredSubmissions.length) * 10) / 10
      : 0;

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    let onTimeCount = 0;
    submissions.forEach(submission => {
      const task = tasks.find(t => t.id === submission.taskId);
      if (task && submission.submittedAt && task.deadline) {
        if (toDate(submission.submittedAt) <= toDate(task.deadline)) onTimeCount++;
      }
    });
    const onTimeRate = submissions.length > 0 ? Math.round((onTimeCount / submissions.length) * 100) : 0;

    return {
      actualUid: teacher.uid,
      displayName: teacher.displayName || 'Unknown',
      totalScore,
      averageScore,
      completedTasks,
      totalTasks: tasks.length,
      completionRate,
      onTimeRate,
    };
  });

  return stats.filter(stat => stat.totalTasks > 0);
}

/** Sắp xếp + ẩn danh. Admin/VP thấy tên thật; giáo viên chỉ thấy tên mình. */
export function rankTeachers(
  stats: RankingStat[],
  rankBy: RankingType,
  currentUserId?: string,
  currentUserRole?: string
): AnonymousRanking[] {
  const sorted = [...stats];
  switch (rankBy) {
    case 'total_score': sorted.sort((a, b) => b.totalScore - a.totalScore); break;
    case 'average_score': sorted.sort((a, b) => b.averageScore - a.averageScore); break;
    case 'completion_rate': sorted.sort((a, b) => b.completionRate - a.completionRate); break;
  }

  const showAllNames = currentUserRole === 'admin' || currentUserRole === 'vice_principal' || currentUserRole === 'youth_leader';

  return sorted.map((stat, index) => ({
    ...stat,
    anonymousId: showAllNames || currentUserId === stat.actualUid ? stat.displayName : `Giáo viên ${index + 1}`,
    rank: index + 1,
    isCurrentUser: currentUserId === stat.actualUid,
  }));
}
