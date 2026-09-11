/**
 * Sáp nhập 2 trường: chuyển TOÀN BỘ dữ liệu của 1 trường nguồn (schoolId cũ)
 * sang 1 trường đích (schoolId mới), rồi khóa (isActive=false) trường nguồn.
 * Dùng khi 2 trường thật sự nhập làm 1 — KHÔNG dùng để "thêm cơ sở" (xem
 * tính năng Cơ sở/Phân hiệu riêng, không liên quan file này).
 *
 * Chạy: node scripts/merge-schools.js
 *
 * Đã xác nhận trước khi chạy (2026-09-11, qua lookup read-only):
 *   Nguồn:  "TH Nguyễn Phan Vinh"  schoolId = "default"
 *   Đích:   "TH Nguyễn Tri Phương" schoolId = "ojKD4nijA5LSy4myim2Y" (trường mới, RỖNG dữ liệu)
 *
 * An toàn: chỉ đổi field `schoolId` trên các doc đang thuộc trường nguồn, không
 * xóa/ghi đè field nào khác. Vì trường đích rỗng nên không có nguy cơ trùng/gộp
 * nhầm dữ liệu 2 trường vào 1 doc. Idempotent theo từng collection (chạy lại sẽ
 * thấy "cần cập nhật: 0" nếu đã chạy xong).
 */
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ==================== CHỈNH TRƯỚC KHI CHẠY (đã điền sẵn theo lookup thật) ====================
const SOURCE_SCHOOL_ID = 'default'; // TH Nguyễn Phan Vinh
const TARGET_SCHOOL_ID = 'ojKD4nijA5LSy4myim2Y'; // TH Nguyễn Tri Phương
// ================================================================================================

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}, 'merge-schools-app');

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

// Mọi collection có field schoolId trong toàn hệ thống (đúng danh sách trong
// migrate-multi-tenant.js, cộng thêm `campuses` mới thêm gần đây).
const TENANT_COLLECTIONS = [
  'users', 'whitelist', 'tasks', 'taskUpdates', 'submissions', 'notifications',
  'schoolYears', 'documentTypes', 'documentCategories', 'documentSubCategories',
  'departments', 'documents', 'fileRequests', 'documentPermissions', 'schoolInfo',
  'campuses',
];

async function moveCollection(name) {
  const snap = await db.collection(name).where('schoolId', '==', SOURCE_SCHOOL_ID).get();
  if (snap.empty) {
    console.log(`   📄 ${name}: 0 doc cần chuyển`);
    return 0;
  }
  const toUpdate = snap.docs.map(doc => ({ ref: doc.ref, data: { schoolId: TARGET_SCHOOL_ID } }));
  console.log(`   📄 ${name}: ${toUpdate.length} doc cần chuyển`);
  await commitInBatches(toUpdate, name);
  return toUpdate.length;
}

async function moveAllCollections() {
  console.log('📦 Bước 1: Chuyển schoolId trên mọi collection...');
  let total = 0;
  for (const name of TENANT_COLLECTIONS) {
    total += await moveCollection(name);
  }
  console.log(`   Tổng: ${total} doc đã chuyển sang schoolId="${TARGET_SCHOOL_ID}"\n`);
  return total;
}

// Khóa trường nguồn (không xóa doc — giữ lại làm lịch sử, đã hết dữ liệu con).
async function deactivateSourceSchool() {
  console.log('🔒 Bước 2: Khóa trường nguồn (isActive=false)...');
  await db.collection('schools').doc(SOURCE_SCHOOL_ID).update({
    isActive: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`   ✅ Đã khóa trường "${SOURCE_SCHOOL_ID}"\n`);
}

async function sanityCheck() {
  console.log('🔍 Bước 3: Sanity check — còn doc nào chưa chuyển không...');
  let remaining = 0;
  for (const name of TENANT_COLLECTIONS) {
    const snap = await db.collection(name).where('schoolId', '==', SOURCE_SCHOOL_ID).get();
    if (!snap.empty) {
      remaining += snap.size;
      console.warn(`   ❌ ${name}: vẫn còn ${snap.size} doc chưa chuyển`);
    }
  }
  if (remaining === 0) {
    console.log('   ✅ Sạch — trường nguồn đã hết dữ liệu con.\n');
  } else {
    console.warn(`   ⚠️  Còn ${remaining} doc — chạy lại script để tiếp tục.\n`);
  }
  return remaining === 0;
}

async function main() {
  console.log(`🚀 Sáp nhập trường: "${SOURCE_SCHOOL_ID}" → "${TARGET_SCHOOL_ID}"\n`);
  await moveAllCollections();
  const clean = await sanityCheck();
  if (clean) {
    await deactivateSourceSchool();
  } else {
    console.warn('⚠️  Bỏ qua bước khóa trường nguồn vì sanity check chưa sạch — chạy lại script.');
  }
  console.log(clean
    ? '🎉 Hoàn tất sáp nhập. Đăng nhập thử 1 tài khoản cũ của Nguyễn Phan Vinh để xác nhận thấy đúng dữ liệu ở Nguyễn Tri Phương.'
    : '⚠️  Hoàn tất 1 phần, xem log ở trên.');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });
