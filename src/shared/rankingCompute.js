// Tính bảng xếp hạng — JavaScript thuần (không phụ thuộc Firebase) để DÙNG CHUNG
// giữa server (tính bảng xếp hạng hàng tuần) và test. Kiểu dữ liệu: xem file
// rankingCompute.d.ts cùng thư mục.

export const RANKING_PERIODS = ['school_year', 'last_4_weeks', 'last_week'];
export const RANKING_TYPES = ['total_score', 'average_score', 'completion_rate'];
export const RANKING_SEMESTERS = ['all', 'HK1', 'HK2'];

// Vai trò được xem tên thật của mọi người trên bảng xếp hạng.
const ROLES_SEE_ALL_NAMES = ['admin', 'principal', 'vice_principal', 'youth_leader'];

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Việt Nam = UTC+7, không đổi giờ mùa hè
const DAY_MS = 24 * 60 * 60 * 1000;

export const toDate = (value) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
};

/** 0h sáng thứ Hai (giờ Việt Nam) của tuần chứa thời điểm `now`. */
export function getWeekStart(now = new Date()) {
  const vn = new Date(now.getTime() + VN_OFFSET_MS); // đọc các trường UTC của mốc này = giờ VN
  const daysSinceMonday = (vn.getUTCDay() + 6) % 7;
  const vnMidnight = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());
  return new Date(vnMidnight - daysSinceMonday * DAY_MS - VN_OFFSET_MS);
}

/**
 * Khoảng thời gian của từng lựa chọn. Bảng xếp hạng chỉ tính lại mỗi sáng thứ Hai
 * nên mọi lựa chọn đều tính "đến hết Chủ nhật vừa qua" (end = 0h thứ Hai tuần này).
 */
export function getRankingWindow(period, weekStart) {
  const end = new Date(weekStart.getTime());
  if (period === 'last_week') return { start: new Date(end.getTime() - 7 * DAY_MS), end };
  if (period === 'last_4_weeks') return { start: new Date(end.getTime() - 28 * DAY_MS), end };
  return { start: null, end };
}

/**
 * Số liệu thô từng giáo viên (chưa xếp hạng). Việc lọc theo ngày tạo, bài nộp lọc
 * theo ngày nộp; việc/bài nộp thiếu ngày thì vẫn tính khi không giới hạn ngày bắt đầu.
 */
export function computeRankingStats(teachers, schoolTasks, schoolSubmissions, startDate, semesterFilter, endDate) {
  const inWindow = (value) => {
    if (!value) return !startDate;
    const d = toDate(value);
    if (startDate && d < startDate) return false;
    if (endDate && d >= endDate) return false;
    return true;
  };
  const semOk = (item) => !semesterFilter || semesterFilter === 'all' || item.semester === semesterFilter;

  const stats = teachers.map((teacher) => {
    const tasks = schoolTasks.filter(t =>
      Array.isArray(t.assignedTo) && t.assignedTo.includes(teacher.uid) && inWindow(t.createdAt) && semOk(t));
    const submissions = schoolSubmissions.filter(s =>
      s.teacherId === teacher.uid && inWindow(s.submittedAt) && semOk(s));

    const scoredSubmissions = submissions.filter(s => s.score !== undefined && s.score !== null);
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
      totalScore: Math.round(totalScore * 10) / 10,
      averageScore,
      completedTasks,
      totalTasks: tasks.length,
      completionRate,
      onTimeRate,
    };
  });

  return stats.filter(stat => stat.totalTasks > 0);
}

/**
 * Sắp xếp + ẩn danh. BGH/admin thấy tên thật; giáo viên chỉ thấy tên mình —
 * với người khác, tên thật và uid bị XÓA khỏi dữ liệu trả về (không chỉ giấu ở giao diện).
 */
export function rankTeachers(stats, rankBy, currentUserId, currentUserRole) {
  const sorted = [...stats];
  switch (rankBy) {
    case 'average_score': sorted.sort((a, b) => b.averageScore - a.averageScore); break;
    case 'completion_rate': sorted.sort((a, b) => b.completionRate - a.completionRate); break;
    default: sorted.sort((a, b) => b.totalScore - a.totalScore);
  }

  const seeAll = ROLES_SEE_ALL_NAMES.includes(currentUserRole);
  return sorted.map((stat, index) => {
    const isCurrentUser = currentUserId === stat.actualUid;
    const revealed = seeAll || isCurrentUser;
    return {
      ...stat,
      actualUid: revealed ? stat.actualUid : '',
      displayName: revealed ? stat.displayName : '',
      anonymousId: revealed ? stat.displayName : `Giáo viên ${index + 1}`,
      rank: index + 1,
      isCurrentUser,
    };
  });
}
