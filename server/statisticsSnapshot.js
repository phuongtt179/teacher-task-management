import { db } from './firebase-config.js';
import { computeTeacherStats, computeSchoolStats, computeVPStats } from '../src/shared/statsCompute.js';

/**
 * Thống kê cho BGH (màn "Thống kê", tab "Theo giáo viên", Dashboard hiệu trưởng/hiệu
 * phó) — server tính sẵn và lưu ở statisticsSnapshots/{schoolId}__{năm học}.
 *
 * Trước đây MỖI lần mở màn hình, mỗi lần đổi học kỳ, trình duyệt lại tự đọc toàn bộ
 * việc + bài nộp của năm học (cuối năm ~10.000–15.000 lượt đọc/lần) — vài người BGH
 * mở vài lần/ngày là vượt hạn mức Firestore miễn phí.
 *
 * Giờ: tính 1 lần cho cả 3 lựa chọn học kỳ, mọi người BGH xem chung; kết quả dùng
 * lại trong 1 giờ. Nút "Làm mới" ép tính lại ngay (nhưng không quá 1 lần/10 phút để
 * tránh bấm liên tục làm tốn quota).
 */

const SNAPSHOT_COLLECTION = 'statisticsSnapshots';
const TTL_MS = 60 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const IN_QUERY_LIMIT = 30;
const TEACHER_ROLES = ['teacher', 'department_head', 'deputy_department_head'];
export const STAT_SEMESTERS = ['all', 'HK1', 'HK2'];
const SCHOOL_SCOPE = '__school__'; // thống kê việc của cả trường (dashboard hiệu trưởng)

const inflight = new Map(); // tránh nhiều request cùng lúc cùng tính

async function loadData(schoolId, schoolYearId) {
  const tasksBase = db.collection('tasks').where('schoolId', '==', schoolId);
  const [usersSnap, tasksSnap] = await Promise.all([
    db.collection('users').where('schoolId', '==', schoolId).where('role', 'in', TEACHER_ROLES).get(),
    (schoolYearId ? tasksBase.where('schoolYearId', '==', schoolYearId) : tasksBase).get(),
  ]);
  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let submissions;
  if (schoolYearId) {
    // Bài nộp (mọi phiên bản) của đúng các việc trong năm — gồm cả bài nộp cũ chưa
    // có trường schoolYearId.
    const ids = tasks.map((t) => t.id);
    const chunks = [];
    for (let i = 0; i < ids.length; i += IN_QUERY_LIMIT) chunks.push(ids.slice(i, i + IN_QUERY_LIMIT));
    const snaps = await Promise.all(chunks.map((chunk) =>
      db.collection('submissions').where('schoolId', '==', schoolId).where('taskId', 'in', chunk).get()));
    submissions = snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
  } else {
    const snap = await db.collection('submissions').where('schoolId', '==', schoolId).get();
    submissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const teachers = usersSnap.docs.map((d) => ({ uid: d.id, displayName: d.data().displayName, email: d.data().email }));
  return { teachers, tasks, submissions };
}

async function computeSnapshot(schoolId, yearKey) {
  const schoolYearId = yearKey === 'all' ? undefined : yearKey;
  const { teachers, tasks, submissions } = await loadData(schoolId, schoolYearId);

  const bySemester = {};
  for (const sem of STAT_SEMESTERS) {
    const teachersStats = teachers.map((t) => computeTeacherStats(t, tasks, submissions, sem, schoolYearId));
    const schoolStats = computeSchoolStats(teachersStats, tasks, sem, schoolYearId);
    bySemester[sem] = { schoolStats, teachersStats };
  }

  // "Công việc của tôi" cho từng người tạo việc + toàn trường (cho hiệu trưởng).
  const scopes = { [SCHOOL_SCOPE]: tasks };
  for (const task of tasks) {
    if (!task.createdBy) continue;
    (scopes[task.createdBy] ??= []).push(task);
  }
  const vpStats = {};
  for (const [scope, scopeTasks] of Object.entries(scopes)) {
    vpStats[scope] = {};
    for (const sem of STAT_SEMESTERS) vpStats[scope][sem] = computeVPStats(scopeTasks, submissions, sem, schoolYearId);
  }

  const snapshot = { schoolId, yearKey, computedAt: Date.now(), bySemester, vpStats };
  await db.collection(SNAPSHOT_COLLECTION).doc(`${schoolId}__${yearKey}`).set(snapshot);
  console.log(`📈 Statistics snapshot computed for ${schoolId}/${yearKey}: ${tasks.length} tasks, ${submissions.length} submissions`);
  return snapshot;
}

async function isValidYear(schoolId, yearKey) {
  if (yearKey === 'all') return true;
  const snap = await db.collection('schoolYears').doc(yearKey).get();
  return snap.exists && snap.data().schoolId === schoolId;
}

export async function getStatisticsSnapshot(schoolId, yearKey, { refresh = false } = {}) {
  const docId = `${schoolId}__${yearKey}`;
  const existing = await db.collection(SNAPSHOT_COLLECTION).doc(docId).get();
  if (existing.exists) {
    const data = existing.data();
    const age = Date.now() - data.computedAt;
    if (age < TTL_MS && !(refresh && age >= MIN_REFRESH_INTERVAL_MS)) return data;
  } else if (!(await isValidYear(schoolId, yearKey))) {
    // Năm học không thuộc trường này → không tạo bản lưu rác theo tham số tùy ý.
    return null;
  }

  if (!inflight.has(docId)) {
    inflight.set(docId, computeSnapshot(schoolId, yearKey).finally(() => inflight.delete(docId)));
  }
  return inflight.get(docId);
}

/** Phần dữ liệu gửi cho 1 người xem: thống kê trường + "công việc của tôi" của họ. */
export function viewForUser(snapshot, uid) {
  const empty = Object.fromEntries(STAT_SEMESTERS.map((sem) => [sem, computeVPStats([], [], sem)]));
  return {
    computedAt: snapshot.computedAt,
    bySemester: snapshot.bySemester,
    myVpStats: snapshot.vpStats[uid] || empty,
    schoolVpStats: snapshot.vpStats[SCHOOL_SCOPE],
  };
}
