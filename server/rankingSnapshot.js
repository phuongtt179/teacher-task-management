import { db } from './firebase-config.js';
import {
  computeRankingStats,
  getRankingWindow,
  getWeekStart,
  RANKING_PERIODS,
  RANKING_SEMESTERS,
} from '../src/shared/rankingCompute.js';

/**
 * Bảng xếp hạng tính 1 lần mỗi tuần cho mỗi trường, lưu ở rankingSnapshots/{schoolId}.
 *
 * Trước đây mỗi giáo viên mở bảng xếp hạng là trình duyệt tự đọc toàn bộ việc + bài
 * nộp của cả trường (cuối năm học ~9.000 lượt đọc/lần) — vài người xem là hết hạn
 * mức Firestore miễn phí. Giờ người đầu tiên mở bảng trong tuần mới (từ 0h thứ Hai,
 * giờ VN) khiến server tính 1 lần cho mọi lựa chọn; cả tuần đó mọi người chỉ đọc lại
 * kết quả đã lưu (1 lượt đọc). Lưu vào Firestore thay vì bộ nhớ để server khởi động
 * lại (deploy, Render ngủ dậy) không phải tính lại.
 */

const SNAPSHOT_COLLECTION = 'rankingSnapshots';
const IN_QUERY_LIMIT = 30;
const inflight = new Map(); // tránh 2 request cùng lúc cùng tính cho 1 trường

const comboKey = (period, semester) => `${period}__${semester}`;

async function loadYearData(schoolId) {
  // Bảng xếp hạng chỉ tính năm học đang hoạt động ("năm nào dứt điểm năm đó").
  const yearSnap = await db.collection('schoolYears')
    .where('schoolId', '==', schoolId).where('isActive', '==', true).get();
  const yearId = yearSnap.empty ? null : yearSnap.docs[0].id;

  const tasksQuery = db.collection('tasks').where('schoolId', '==', schoolId);
  const [teachersSnap, tasksSnap] = await Promise.all([
    db.collection('users').where('schoolId', '==', schoolId).where('role', '==', 'teacher').get(),
    (yearId ? tasksQuery.where('schoolYearId', '==', yearId) : tasksQuery).get(),
  ]);
  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let submissions;
  if (yearId) {
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

  const teachers = teachersSnap.docs.map((d) => ({ uid: d.id, displayName: d.data().displayName }));
  return { yearId, teachers, tasks, submissions };
}

async function computeSnapshot(schoolId, weekStart) {
  const { yearId, teachers, tasks, submissions } = await loadYearData(schoolId);
  const weekStartDate = new Date(weekStart);

  const combos = {};
  for (const period of RANKING_PERIODS) {
    const { start, end } = getRankingWindow(period, weekStartDate);
    for (const semester of RANKING_SEMESTERS) {
      combos[comboKey(period, semester)] = computeRankingStats(teachers, tasks, submissions, start, semester, end);
    }
  }

  const snapshot = { schoolId, weekStart, yearId, computedAt: Date.now(), combos };
  await db.collection(SNAPSHOT_COLLECTION).doc(schoolId).set(snapshot);
  console.log(`📊 Ranking snapshot computed for ${schoolId}: ${tasks.length} tasks, ${submissions.length} submissions`);
  return snapshot;
}

export async function getRankingSnapshot(schoolId, now = new Date()) {
  const weekStart = getWeekStart(now).getTime();

  const existing = await db.collection(SNAPSHOT_COLLECTION).doc(schoolId).get();
  if (existing.exists && existing.data().weekStart === weekStart) return existing.data();

  const key = `${schoolId}|${weekStart}`;
  if (!inflight.has(key)) {
    inflight.set(key, computeSnapshot(schoolId, weekStart).finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

export function getComboStats(snapshot, period, semester) {
  return snapshot.combos?.[comboKey(period, semester)] || [];
}
