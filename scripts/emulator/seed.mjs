// Tạo dữ liệu GIẢ cho Firebase Emulator, đúng quy mô trường thật (~92 người, 7 tổ, 36 tuần kế
// hoạch bài dạy, ~2.100 hồ sơ, công việc, bài nộp, thông báo) — npm run seed:emulator.
// Chỉ chạy được với emulator + dự án "demo-…"; không đọc/chép dữ liệu thật.
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
const PROJECT = 'demo-ttm';
admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const auth = admin.auth();

export const SCHOOL = 'school-test';
const YEAR = 'year-2026';
const CAMPUS = 'campus-main';
const WEEK1_MONDAY = '2026-09-07';
const MERGE_UNTIL_WEEK = 7;
const TODAY = new Date();

// Số ngẫu nhiên lặp lại được (cùng dữ liệu mỗi lần seed).
let seed = 20261013;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const ts = (d) => admin.firestore.Timestamp.fromDate(d);
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
const sunday = (w) => addDays(WEEK1_MONDAY, (w - 1) * 7 + 6);
const monday = (w) => addDays(WEEK1_MONDAY, (w - 1) * 7);

async function clearAll() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

const writes = [];
const put = (col, id, data) => writes.push({ ref: id ? db.collection(col).doc(id) : db.collection(col).doc(), data });
async function flush() {
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    writes.slice(i, i + 450).forEach((w) => batch.set(w.ref, w.data));
    await batch.commit();
  }
}

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ'];
const DEM = ['Thị', 'Văn', 'Thị Thanh', 'Thị Mỹ', 'Minh', 'Thị Thu'];
const TEN = ['An', 'Bình', 'Chi', 'Dung', 'Hà', 'Hương', 'Lan', 'Linh', 'Mai', 'Nga', 'Phương', 'Quỳnh', 'Tâm', 'Trang', 'Vân', 'Yến'];
const DEPTS = [['Tổ 1', 17], ['Tổ 2', 16], ['Tổ 3', 10], ['Tổ 4', 14], ['Tổ 5', 12], ['Tổ bộ môn', 11], ['Tổ văn phòng', 1]];

export async function seedAll() {
  await clearAll();
  const now = ts(TODAY);
  const users = [];
  const mkUser = (role, deptIdx = null) => {
    const n = users.length + 1;
    const u = {
      uid: `u${String(n).padStart(3, '0')}`,
      email: `gv${String(n).padStart(3, '0')}@test.local`,
      displayName: `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`,
      role,
      deptIdx,
    };
    users.push(u);
    return u;
  };
  const adminUser = mkUser('admin');
  const principal = mkUser('principal');
  const vps = [mkUser('vice_principal'), mkUser('vice_principal')];
  const depts = DEPTS.map(([name, size], i) => {
    const members = [];
    for (let k = 0; k < size; k++) {
      members.push(mkUser(k === 0 ? 'department_head' : k === 1 && size >= 10 ? 'deputy_department_head' : 'teacher', i));
    }
    return { id: `dept-${i + 1}`, name, members };
  });
  while (users.length < 92) mkUser('teacher');

  // Trường, cài đặt, cơ sở, năm học
  put('schools', SCHOOL, { name: 'Trường Thử Nghiệm', isActive: true, driveRootFolderId: 'fake-root', createdAt: now });
  put('schoolSettings', SCHOOL, { schoolId: SCHOOL, aiForStaff: false, requireDocumentApproval: false, configVersion: '1' });
  put('campuses', CAMPUS, { schoolId: SCHOOL, name: 'Cơ sở chính', order: 0, createdAt: now, updatedAt: now });
  put('schoolYears', YEAR, {
    schoolId: SCHOOL, name: 'NH 2026-2027', startDate: ts(new Date('2026-09-05')), endDate: ts(new Date('2027-05-31')),
    isActive: true, activeSemester: 'HK1', createdBy: adminUser.uid, createdAt: now, updatedAt: now,
  });

  // Người dùng (Auth + users + whitelist) và tổ
  for (const u of users) {
    await auth.createUser({ uid: u.uid, email: u.email, displayName: u.displayName, emailVerified: true });
    put('users', u.uid, {
      uid: u.uid, email: u.email, displayName: u.displayName, role: u.role, schoolId: SCHOOL,
      primaryCampusId: CAMPUS, campusIds: [CAMPUS], subject: 'Chủ nhiệm', isActive: true, createdAt: now, updatedAt: now,
    });
    put('whitelist', u.email, { email: u.email, schoolId: SCHOOL, role: u.role, addedBy: adminUser.uid, addedAt: now });
  }
  for (const d of depts) {
    put('departments', d.id, {
      schoolId: SCHOOL, name: d.name, headTeacherId: d.members[0].uid, headTeacherName: d.members[0].displayName,
      memberIds: d.members.map((m) => m.uid), createdAt: now, updatedAt: now,
    });
  }

  // Loại hồ sơ, danh mục, mục con (36 tuần theo quy tắc nộp trước 1 tuần, gộp tuần 1–7)
  put('documentTypes', 'type-teacher', {
    schoolId: SCHOOL, name: 'Hồ sơ Giáo viên', viewPermissionType: 'everyone', allowedUploaderUserIds: [],
    viewMode: 'personal', order: 1, isActive: true, createdBy: adminUser.uid, createdAt: now, updatedAt: now,
  });
  put('documentTypes', 'type-dept', {
    schoolId: SCHOOL, name: 'Hồ sơ Tổ chuyên môn', viewPermissionType: 'everyone',
    allowedUploaderUserIds: depts.map((d) => d.members[0].uid), viewMode: 'shared', order: 2, isActive: true,
    createdBy: adminUser.uid, createdAt: now, updatedAt: now,
  });
  const cat = (id, name, typeId, hasSubCategories, order, extra = {}) => put('documentCategories', id, {
    schoolId: SCHOOL, schoolYearId: YEAR, documentTypeId: typeId, name, hasSubCategories, order,
    createdBy: adminUser.uid, createdAt: now, updatedAt: now, ...extra,
  });
  cat('cat-khbd', 'Kế hoạch bài dạy', 'type-teacher', true, 1);
  cat('cat-khmh', 'Kế hoạch môn học', 'type-teacher', false, 2, { deadline: '2026-10-10' });
  ['TỔ CM1', 'TỔ CM2', 'TỔ CM3', 'TỔ CM4', 'TỔ CM5', 'TỔ BỘ MÔN'].forEach((n, i) => cat(`cat-to-${i + 1}`, n, 'type-dept', false, 10 + i));
  for (let w = 1; w <= 36; w++) {
    const merged = w <= MERGE_UNTIL_WEEK;
    put('documentSubCategories', `sub-w${w}`, {
      schoolId: SCHOOL, categoryId: 'cat-khbd', name: `Tuần ${w}`, order: w,
      deadline: merged ? sunday(MERGE_UNTIL_WEEK) : sunday(w - 1),
      openFrom: merged ? null : monday(w - 1),
      createdAt: now, updatedAt: now,
    });
  }

  // Hồ sơ: mỗi giáo viên nộp kế hoạch bài dạy từ tuần 1 đến tuần k (vài người nộp dồn tới tuần 30)
  const teachers = users.filter((u) => !['admin', 'principal', 'vice_principal'].includes(u.role));
  let docCount = 0;
  const mkDoc = (u, categoryId, subCategoryId, title, uploadedAt) => {
    docCount++;
    put('documents', null, {
      schoolId: SCHOOL, campusId: CAMPUS, schoolYearId: YEAR, categoryId, ...(subCategoryId ? { subCategoryId } : {}),
      title, files: [{ name: `${title}.docx`, size: 20000, mimeType: 'application/msword', driveFileId: `seed-${docCount}`, driveFileUrl: 'https://example.invalid' }],
      uploadedBy: u.uid, uploadedByName: u.displayName, uploadedAt: ts(uploadedAt), status: 'approved',
      departmentId: u.deptIdx !== null ? depts[u.deptIdx].id : null, isPublic: false,
    });
  };
  for (const u of teachers) {
    const k = rand() < 0.15 ? 30 : 15 + Math.floor(rand() * 14); // ~15% nộp dồn tới tuần 30
    for (let w = 1; w <= k; w++) mkDoc(u, 'cat-khbd', `sub-w${w}`, `KHBD tuần ${w}`, new Date(`${monday(Math.max(1, w - 1))}T09:00:00+07:00`));
    mkDoc(u, 'cat-khmh', null, 'Kế hoạch môn học', new Date('2026-10-05T09:00:00+07:00'));
  }
  depts.slice(0, 6).forEach((d, i) => {
    for (let k = 0; k < 8; k++) mkDoc(d.members[0], `cat-to-${i + 1}`, null, `Biên bản sinh hoạt tổ ${k + 1}`, new Date('2026-10-01T09:00:00+07:00'));
  });

  // Công việc, bài nộp, thông báo
  const taskIds = [];
  for (let t = 1; t <= 52; t++) {
    const assigned = teachers.filter(() => rand() < 0.35);
    const id = `task-${t}`;
    taskIds.push({ id, assigned });
    const deadline = new Date(Date.parse('2026-09-10T10:00:00Z') + t * 2.5 * 864e5);
    put('tasks', id, {
      schoolId: SCHOOL, campusId: CAMPUS, schoolYearId: YEAR, semester: 'HK1', title: `Công việc ${t}`, description: 'Mô tả',
      priority: 'medium', status: 'assigned', maxScore: 10, scoreDeadline1: 10, scoreDeadline2: 5,
      deadline: ts(deadline), deadline2: ts(new Date(deadline.getTime() + 3 * 864e5)),
      createdBy: vps[0].uid, createdByName: vps[0].displayName,
      assignedTo: assigned.map((u) => u.uid), assignedToNames: assigned.map((u) => u.displayName), createdAt: now, updatedAt: now,
    });
  }
  let subCount = 0;
  while (subCount < 134) {
    const { id, assigned } = pick(taskIds);
    if (!assigned.length) continue;
    const u = pick(assigned);
    subCount++;
    put('submissions', null, {
      schoolId: SCHOOL, campusId: CAMPUS, taskId: id, schoolYearId: YEAR, semester: 'HK1', teacherId: u.uid, teacherName: u.displayName,
      content: 'Báo cáo', fileUrls: [], submittedAt: now, metDeadline: 1, score: 8 + Math.floor(rand() * 3), version: 1, isLatest: true,
    });
  }
  for (let i = 0; i < 3000; i++) {
    const u = pick(users);
    put('notifications', null, {
      schoolId: SCHOOL, userId: u.uid, type: 'task_assigned', title: 'Thông báo', message: 'Có công việc mới',
      read: rand() < 0.8, createdAt: ts(new Date(Date.now() - rand() * 30 * 864e5)),
    });
  }

  await flush();
  const summary = { users: users.length, departments: depts.length, documents: docCount, tasks: 52, submissions: subCount, notifications: 3000 };
  const out = { school: SCHOOL, users: users.map(({ uid, email, displayName, role, deptIdx }) => ({ uid, email, displayName, role, dept: deptIdx === null ? null : depts[deptIdx].id })) };
  fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-users.json'), JSON.stringify(out, null, 2));
  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const summary = await seedAll();
  console.log('✅ Đã tạo dữ liệu mẫu trên emulator:', summary);
  process.exit(0);
}
