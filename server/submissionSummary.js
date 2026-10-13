import admin from 'firebase-admin';
import { db } from './firebase-config.js';

/**
 * Bảng tổng hợp NỘP HỒ SƠ (màn "Theo dõi nộp hồ sơ") — lưu sẵn ở
 * submissionSummaries/{schoolId}__{categoryId}:
 *   { schoolId, schoolYearId, categoryId, format: 2,
 *     byTeacher: { uid: { subCategoryId | 'x': thời điểm nộp sớm nhất (ms) } }, updatedAt, rebuiltAt }
 * ('x' = hồ sơ của danh mục không có mục con). Thời điểm nộp dùng để đánh dấu NỘP TRỄ
 * (so với hạn của mục con/danh mục — app tự so, server chỉ lưu thời điểm). Sửa/thêm file
 * không đổi uploadedAt nên không thành trễ; xóa hẳn rồi nộp lại thì tính theo lần nộp mới.
 * Bản cũ (format 1, chỉ lưu danh sách mục) được tự dựng lại ở lần xem kế tiếp.
 *
 * Trước đây mỗi lần mở màn theo dõi đọc TOÀN BỘ hồ sơ của danh mục (cuối năm vài
 * nghìn lượt/lần). Giờ:
 *  - Mỗi khi 1 người nộp/xóa/bị từ chối hồ sơ → server ĐẾM LẠI phần của đúng người đó
 *    trong đúng danh mục đó (refreshSubmissionSummary, vài chục lượt đọc) — đếm lại từ dữ
 *    liệu thật nên không bị lệch dồn như cách cộng/trừ 1.
 *  - Xem tổng hợp: đọc 1 bản ghi/danh mục.
 *  - Lưới an toàn: bản ghi chưa từng dựng đủ, hoặc dựng đủ lần cuối quá 7 ngày, thì lần
 *    xem kế tiếp dựng lại toàn bộ danh mục đó (phòng lúc nộp bị rớt mạng chưa kịp báo).
 *
 * "Đã nộp" = có hồ sơ trong mục đó, trừ hồ sơ bị TỪ CHỐI (chờ duyệt vẫn tính là đã nộp).
 * Danh mục bị xóa → bản tổng hợp của nó bị xóa theo.
 */

const COLLECTION = 'submissionSummaries';
const FULL_REBUILD_MS = 7 * 24 * 60 * 60 * 1000;
const NO_SUB = 'x';
const FORMAT = 2;

const summaryRef = (schoolId, categoryId) => db.collection(COLLECTION).doc(`${schoolId}__${categoryId}`);

const uploadedMs = (d) => (d.uploadedAt?.toMillis ? d.uploadedAt.toMillis() : 0); // không rõ → 0 (coi như đúng hạn)

/** { mục: thời điểm nộp sớm nhất } của 1 người — bỏ hồ sơ bị từ chối. */
const submittedTimes = (docs) => {
  const out = {};
  docs.filter((d) => d.status !== 'rejected').forEach((d) => {
    const key = d.subCategoryId || NO_SUB;
    const ms = uploadedMs(d);
    if (out[key] === undefined || ms < out[key]) out[key] = ms;
  });
  return out;
};

/** Danh mục của đúng trường (null nếu không có / đã xóa / trường khác). */
export async function getCategory(schoolId, categoryId) {
  const snap = await db.collection('documentCategories').doc(categoryId).get();
  if (!snap.exists || snap.data().schoolId !== schoolId) return null;
  return snap.data();
}

/**
 * Đếm lại phần của 1 người trong 1 danh mục và ghi vào bảng tổng hợp.
 * Danh mục không còn → xóa bản tổng hợp của danh mục.
 */
export async function refreshSubmissionSummary(schoolId, categoryId, uid) {
  if (!schoolId || !categoryId) return;
  const category = await getCategory(schoolId, categoryId);
  if (!category) {
    await summaryRef(schoolId, categoryId).delete();
    return;
  }
  if (!uid) return;

  const snap = await db.collection('documents')
    .where('schoolId', '==', schoolId)
    .where('categoryId', '==', categoryId)
    .where('uploadedBy', '==', uid)
    .get();
  const times = submittedTimes(snap.docs.map((d) => d.data()));

  // mergeFields: thay TRỌN phần của người này (merge thường sẽ trộn map, giữ lại mục đã xóa).
  const teacherPath = new admin.firestore.FieldPath('byTeacher', uid);
  await summaryRef(schoolId, categoryId).set({
    schoolId,
    categoryId,
    schoolYearId: category.schoolYearId || null,
    byTeacher: { [uid]: Object.keys(times).length ? times : admin.firestore.FieldValue.delete() },
    updatedAt: admin.firestore.Timestamp.now(),
  }, { mergeFields: ['schoolId', 'categoryId', 'schoolYearId', teacherPath, 'updatedAt'] });
}

/**
 * Đếm lại đúng 1 tuần (mục con) của 1 người — dùng khi nộp/xóa/từ chối hồ sơ có mục con.
 * Chỉ đọc hồ sơ của người đó trong tuần đó (thường 1–3 tài liệu) thay vì mọi tuần của danh
 * mục, rồi ghi đúng 1 ô byTeacher.<uid>.<tuần>. Bảng chưa có thì bỏ qua — lần xem kế tiếp
 * sẽ dựng lại đủ (getSubmissionSummary).
 */
export async function refreshSubmissionSummaryWeek(schoolId, categoryId, uid, subCategoryId) {
  if (!schoolId || !categoryId || !uid || !subCategoryId) return;
  const category = await getCategory(schoolId, categoryId);
  if (!category) {
    await summaryRef(schoolId, categoryId).delete();
    return;
  }
  const snap = await db.collection('documents')
    .where('schoolId', '==', schoolId)
    .where('categoryId', '==', categoryId)
    .where('uploadedBy', '==', uid)
    .where('subCategoryId', '==', subCategoryId)
    .get();
  const ms = submittedTimes(snap.docs.map((d) => d.data()))[subCategoryId];
  try {
    await summaryRef(schoolId, categoryId).update(
      new admin.firestore.FieldPath('byTeacher', uid, subCategoryId),
      ms === undefined ? admin.firestore.FieldValue.delete() : ms,
      'updatedAt', admin.firestore.Timestamp.now(),
    );
  } catch (error) {
    if (error?.code !== 5) throw error; // 5 = NOT_FOUND: chưa có bảng tổng hợp
  }
}

const inflight = new Map(); // tránh nhiều người cùng mở → dựng lại nhiều lần cùng lúc

async function rebuildCategory(schoolId, categoryId, category) {
  const snap = await db.collection('documents')
    .where('schoolId', '==', schoolId)
    .where('categoryId', '==', categoryId)
    .get();
  const byUploader = new Map();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (!data.uploadedBy) return;
    if (!byUploader.has(data.uploadedBy)) byUploader.set(data.uploadedBy, []);
    byUploader.get(data.uploadedBy).push(data);
  });
  const byTeacher = {};
  byUploader.forEach((docs, uid) => {
    const times = submittedTimes(docs);
    if (Object.keys(times).length) byTeacher[uid] = times;
  });
  const now = admin.firestore.Timestamp.now();
  const summary = {
    schoolId,
    categoryId,
    schoolYearId: category.schoolYearId || null,
    format: FORMAT,
    byTeacher,
    updatedAt: now,
    rebuiltAt: now,
  };
  await summaryRef(schoolId, categoryId).set(summary); // ghi đè toàn bộ
  return summary;
}

/** Bảng tổng hợp của 1 danh mục (tự dựng lại nếu chưa có hoặc quá 7 ngày). null = danh mục không có. */
export async function getSubmissionSummary(schoolId, categoryId, preloadedCategory) {
  const category = preloadedCategory || await getCategory(schoolId, categoryId);
  if (!category) return null;

  const snap = await summaryRef(schoolId, categoryId).get();
  const data = snap.exists ? snap.data() : null;
  const rebuiltMs = data?.rebuiltAt?.toMillis?.() || 0;
  if (data && data.format === FORMAT && Date.now() - rebuiltMs < FULL_REBUILD_MS) return data;

  const key = `${schoolId}__${categoryId}`;
  if (!inflight.has(key)) {
    inflight.set(key, rebuildCategory(schoolId, categoryId, category).finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

// Phòng ban (tổ) của trường — nhớ 5 phút, dùng để lọc phạm vi tổ trưởng/tổ phó.
const DEPT_TTL_MS = 5 * 60 * 1000;
const deptCache = new Map(); // schoolId -> { at, depts }

async function getDepartments(schoolId) {
  const hit = deptCache.get(schoolId);
  if (hit && Date.now() - hit.at < DEPT_TTL_MS) return hit.depts;
  const snap = await db.collection('departments').where('schoolId', '==', schoolId).get();
  const depts = snap.docs.map((d) => ({ id: d.id, headTeacherId: d.data().headTeacherId, memberIds: d.data().memberIds || [] }));
  deptCache.set(schoolId, { at: Date.now(), depts });
  return depts;
}

/** Tổ mà tổ trưởng/tổ phó này phụ trách (là tổ trưởng, hoặc là thành viên). */
export async function getDepartmentScope(schoolId, uid) {
  const depts = await getDepartments(schoolId);
  const mine = depts.filter((d) => d.headTeacherId === uid || d.memberIds.includes(uid));
  const memberUids = new Set();
  mine.forEach((d) => {
    d.memberIds.forEach((m) => memberUids.add(m));
    if (d.headTeacherId) memberUids.add(d.headTeacherId);
  });
  return { departmentIds: mine.map((d) => d.id), memberUids };
}
