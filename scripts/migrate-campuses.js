/**
 * Tạo cơ sở/phân hiệu mặc định cho 1 trường và backfill campusId vào dữ liệu cũ.
 * Chạy: node scripts/migrate-campuses.js
 *
 * campusId chỉ là 1 field dữ liệu để chọn/lọc khi phân công việc hoặc xem thống kê —
 * KHÔNG phải ranh giới phân quyền (hiệu phó/hiệu trưởng đều xem/phân công được cả
 * mọi cơ sở). Vì vậy script này CHỈ cần backfill campusId mặc định vào dữ liệu cũ
 * (tất cả về "Cơ sở chính"), không cần xử lý phân quyền theo user.
 *
 * CHỈ CHẠY SAU KHI:
 *  - Đã deploy code frontend/backend mới (đã thêm field campusId).
 *  - Đã chỉnh SCHOOL_ID bên dưới cho đúng ID trường thật (xem trong Firestore
 *    console, collection `schools`, hoặc màn "Quản lý trường" nếu là super-admin).
 *
 * An toàn / idempotent: chỉ thêm field campusId vào doc chưa có, không xóa hay ghi
 * đè field khác. Cơ sở mặc định dùng ID cố định nên chạy lại nhiều lần không tạo trùng.
 */
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ==================== CHỈNH TRƯỚC KHI CHẠY ====================
const SCHOOL_ID = process.env.MIGRATE_CAMPUSES_SCHOOL_ID || 'default';
const DEFAULT_CAMPUS_ID = 'default-campus';
const DEFAULT_CAMPUS_NAME = process.env.DEFAULT_CAMPUS_NAME || 'Cơ sở chính';
const SECOND_CAMPUS_NAME = process.env.SECOND_CAMPUS_NAME || 'Phân hiệu 1';
// ================================================================

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}, 'migrate-campuses-app');

const db = admin.firestore(app);

const BATCH_SIZE = 400;

async function commitInBatches(refUpdatePairs, label) {
  let done = 0;
  for (let i = 0; i < refUpdatePairs.length; i += BATCH_SIZE) {
    const chunk = refUpdatePairs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
    done += chunk.length;
    console.log(`   ✍️  ${label}: ${done}/${refUpdatePairs.length}...`);
  }
}

// Bước 1: tạo "Cơ sở chính" (nếu chưa có) + 1 cơ sở thứ 2 rỗng để BGH tự đổi tên/gán hiệu phó sau.
async function ensureDefaultCampus() {
  console.log('🏫 Bước 1: Tạo cơ sở mặc định...');
  const ref = db.collection('campuses').doc(DEFAULT_CAMPUS_ID);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`   ✅ Cơ sở mặc định đã tồn tại (${DEFAULT_CAMPUS_ID})\n`);
    return;
  }

  await ref.set({
    schoolId: SCHOOL_ID,
    name: DEFAULT_CAMPUS_NAME,
    order: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`   🎉 Đã tạo "${DEFAULT_CAMPUS_NAME}" (id=${DEFAULT_CAMPUS_ID})\n`);
}

async function ensureSecondCampus() {
  console.log('🏫 Bước 2: Tạo cơ sở thứ 2 (phân hiệu)...');
  const existing = await db.collection('campuses').where('schoolId', '==', SCHOOL_ID).get();
  if (existing.size >= 2) {
    console.log(`   ✅ Trường đã có ${existing.size} cơ sở, bỏ qua tạo mới\n`);
    return;
  }

  await db.collection('campuses').add({
    schoolId: SCHOOL_ID,
    name: SECOND_CAMPUS_NAME,
    order: 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`   🎉 Đã tạo "${SECOND_CAMPUS_NAME}"\n`);
}

// Bước 3: backfill campusId vào dữ liệu cũ (tất cả về Cơ sở chính — BGH tự chuyển
// bản ghi thuộc phân hiệu khác sau, script không đoán được).
const CAMPUS_COLLECTIONS = ['tasks', 'taskUpdates', 'departments', 'documents'];

async function backfillCollection(name) {
  const snap = await db.collection(name).where('schoolId', '==', SCHOOL_ID).get();
  const toUpdate = [];
  let alreadyHas = 0;
  snap.forEach(doc => {
    if (doc.data().campusId) {
      alreadyHas++;
      return;
    }
    toUpdate.push({ ref: doc.ref, data: { campusId: DEFAULT_CAMPUS_ID } });
  });
  console.log(`   📄 ${name}: ${snap.size} doc — đã có campusId: ${alreadyHas}, cần cập nhật: ${toUpdate.length}`);
  if (toUpdate.length > 0) {
    await commitInBatches(toUpdate, name);
  }
}

async function backfillAllCollections() {
  console.log('📦 Bước 3: Backfill campusId vào dữ liệu cũ (tasks/taskUpdates/departments/documents)...');
  for (const name of CAMPUS_COLLECTIONS) {
    await backfillCollection(name);
  }
  console.log('');
}

// Bước 4: backfill primaryCampusId/campusIds cho user — chỉ để tiện mặc định lúc
// tạo việc/tải hồ sơ (KHÔNG dùng để giới hạn quyền).
async function backfillUsers() {
  console.log('👤 Bước 4: Backfill primaryCampusId/campusIds cho user (tiện mặc định, không giới hạn quyền)...');
  const snap = await db.collection('users').where('schoolId', '==', SCHOOL_ID).get();
  const toUpdate = [];
  let alreadyHas = 0;
  snap.forEach(doc => {
    if (doc.data().primaryCampusId) {
      alreadyHas++;
      return;
    }
    toUpdate.push({ ref: doc.ref, data: { primaryCampusId: DEFAULT_CAMPUS_ID, campusIds: [DEFAULT_CAMPUS_ID] } });
  });
  console.log(`   📄 users: ${snap.size} doc — đã có primaryCampusId: ${alreadyHas}, cần cập nhật: ${toUpdate.length}`);
  if (toUpdate.length > 0) {
    await commitInBatches(toUpdate, 'users');
  }
  console.log('');
}

async function main() {
  console.log(`🚀 Bắt đầu migrate campuses cho schoolId="${SCHOOL_ID}"...\n`);
  await ensureDefaultCampus();
  await ensureSecondCampus();
  await backfillAllCollections();
  await backfillUsers();
  console.log('🎉 Hoàn tất. Vào "Cơ sở / Phân hiệu" trong app để đổi tên/gán hiệu phó cho từng cơ sở,');
  console.log('   và tự chuyển các Task/Document/Department thực sự thuộc phân hiệu khác sang đúng cơ sở.');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });
