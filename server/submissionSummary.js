import admin from 'firebase-admin';
import { db } from './firebase-config.js';

/**
 * Bảng tổng hợp NỘP HỒ SƠ (màn "Theo dõi nộp hồ sơ") — lưu sẵn ở
 * submissionSummaries/{schoolId}__{categoryId}:
 *   { schoolId, schoolYearId, categoryId, byTeacher: { uid: [subCategoryId | 'x'] }, updatedAt, rebuiltAt }
 * ('x' = hồ sơ của danh mục không có mục con).
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

const summaryRef = (schoolId, categoryId) => db.collection(COLLECTION).doc(`${schoolId}__${categoryId}`);

const submittedKeys = (docs) => [
  ...new Set(docs.filter((d) => d.status !== 'rejected').map((d) => d.subCategoryId || NO_SUB)),
].sort();

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
  const keys = submittedKeys(snap.docs.map((d) => d.data()));

  await summaryRef(schoolId, categoryId).set({
    schoolId,
    categoryId,
    schoolYearId: category.schoolYearId || null,
    byTeacher: { [uid]: keys.length ? keys : admin.firestore.FieldValue.delete() },
    updatedAt: admin.firestore.Timestamp.now(),
  }, { merge: true });
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
    const keys = submittedKeys(docs);
    if (keys.length) byTeacher[uid] = keys;
  });
  const now = admin.firestore.Timestamp.now();
  const summary = {
    schoolId,
    categoryId,
    schoolYearId: category.schoolYearId || null,
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
  if (data && Date.now() - rebuiltMs < FULL_REBUILD_MS) return data;

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
