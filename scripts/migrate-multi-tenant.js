/**
 * Migrate dữ liệu single-tenant hiện có sang multi-tenant (thêm schoolId).
 * Chạy: node scripts/migrate-multi-tenant.js
 *
 * CHỈ CHẠY SAU KHI:
 *  - Đã deploy code backend/frontend mới (Phase 0-3) — nhưng TRƯỚC KHI deploy
 *    firestore.rules mới (Phase 1), vì rules mới yêu cầu schoolId đã tồn tại
 *    trên mọi doc, còn Admin SDK (script này) bỏ qua rules nên chạy được trước.
 *  - Đã chỉnh DEFAULT_SCHOOL_NAME và SUPER_ADMIN_EMAIL bên dưới cho đúng.
 *
 * An toàn / idempotent: chỉ thêm field schoolId vào doc chưa có, không xóa hay
 * ghi đè field khác. Trường mặc định dùng ID cố định 'default' nên chạy lại
 * nhiều lần không tạo trùng trường mặc định.
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
const DEFAULT_SCHOOL_ID = 'default';
const DEFAULT_SCHOOL_NAME = process.env.DEFAULT_SCHOOL_NAME || 'Trường mặc định (dữ liệu cũ)';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'phuongtt179@gmail.com';
// ================================================================

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}, 'migrate-multi-tenant-app');

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

// Bước 1: tạo trường mặc định (nếu chưa có) — driveRootFolderId dùng lại đúng
// ADMIN_DRIVE_FOLDER_ID hiện tại, giữ nguyên cây Drive cũ, không cần chuyển file.
async function ensureDefaultSchool() {
  console.log('🏫 Bước 1: Tạo trường mặc định...');
  const ref = db.collection('schools').doc(DEFAULT_SCHOOL_ID);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`   ✅ Trường mặc định đã tồn tại (${DEFAULT_SCHOOL_ID})\n`);
    return;
  }

  const driveRootFolderId = process.env.ADMIN_DRIVE_FOLDER_ID;
  if (!driveRootFolderId) {
    throw new Error('Thiếu ADMIN_DRIVE_FOLDER_ID trong .env — cần để gán làm driveRootFolderId của trường mặc định');
  }

  await ref.set({
    name: DEFAULT_SCHOOL_NAME,
    shortName: null,
    isActive: true,
    driveRootFolderId,
    createdBy: 'migration-script',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`   🎉 Đã tạo trường mặc định "${DEFAULT_SCHOOL_NAME}" (id=${DEFAULT_SCHOOL_ID})\n`);
}

// Bước 2: backfill schoolId vào mọi collection dữ liệu theo trường.
const TENANT_COLLECTIONS = [
  'users', 'tasks', 'taskUpdates', 'submissions', 'notifications',
  'schoolYears', 'documentTypes', 'documentCategories', 'documentSubCategories',
  'departments', 'documents', 'fileRequests', 'documentPermissions', 'schoolInfo',
];

async function backfillCollection(name) {
  const snap = await db.collection(name).get();
  const toUpdate = [];
  let alreadyHas = 0;
  snap.forEach(doc => {
    if (doc.data().schoolId) {
      alreadyHas++;
      return;
    }
    toUpdate.push({ ref: doc.ref, data: { schoolId: DEFAULT_SCHOOL_ID } });
  });
  console.log(`   📄 ${name}: ${snap.size} doc — đã có schoolId: ${alreadyHas}, cần cập nhật: ${toUpdate.length}`);
  if (toUpdate.length > 0) {
    await commitInBatches(toUpdate, name);
  }
}

async function backfillAllCollections() {
  console.log('📦 Bước 2: Backfill schoolId vào các collection dữ liệu...');
  for (const name of TENANT_COLLECTIONS) {
    await backfillCollection(name);
  }
  console.log('');
}

// Bước 3: backfill whitelist — set schoolId, backfill role thiếu (cross-reference
// users theo email), và sửa doc có ID khác email (tạo bởi WhitelistScreen cũ dùng
// addDoc auto-ID) thành đúng convention doc ID = email.
async function backfillWhitelist() {
  console.log('📧 Bước 3: Backfill whitelist...');
  const [whitelistSnap, usersSnap] = await Promise.all([
    db.collection('whitelist').get(),
    db.collection('users').get(),
  ]);

  const roleByEmail = new Map();
  usersSnap.forEach(doc => {
    const u = doc.data();
    if (u.email) roleByEmail.set(u.email, u.role);
  });

  let alreadyOk = 0;
  let fixedInPlace = 0;
  let recreated = 0;

  for (const doc of whitelistSnap.docs) {
    const data = doc.data();
    const email = data.email;
    if (!email) {
      console.warn(`   ⚠️  Whitelist doc ${doc.id} không có field email — bỏ qua, cần xử lý thủ công`);
      continue;
    }

    const role = data.role || roleByEmail.get(email) || 'teacher';
    const needsSchoolId = !data.schoolId;
    const needsRole = !data.role;
    const idMismatch = doc.id !== email;

    if (!needsSchoolId && !needsRole && !idMismatch) {
      alreadyOk++;
      continue;
    }

    if (idMismatch) {
      // Tạo lại đúng doc ID = email, xóa doc cũ (auto-ID).
      await db.collection('whitelist').doc(email).set({
        email,
        schoolId: data.schoolId || DEFAULT_SCHOOL_ID,
        role,
        addedBy: data.addedBy || 'migration-script',
        addedAt: data.addedAt || admin.firestore.FieldValue.serverTimestamp(),
      });
      await doc.ref.delete();
      recreated++;
    } else {
      await doc.ref.update({
        schoolId: data.schoolId || DEFAULT_SCHOOL_ID,
        role,
      });
      fixedInPlace++;
    }
  }

  console.log(`   ✅ Đã đúng chuẩn: ${alreadyOk}`);
  console.log(`   🔄 Cập nhật tại chỗ (thêm schoolId/role): ${fixedInPlace}`);
  console.log(`   🔁 Tạo lại đúng doc ID = email (trước đó auto-ID): ${recreated}\n`);
}

// Bước 4: promote super-admin — giữ nguyên role/schoolId hiện có, chỉ thêm cờ.
async function promoteSuperAdmin() {
  console.log(`👑 Bước 4: Gán isSuperAdmin cho ${SUPER_ADMIN_EMAIL}...`);
  const snap = await db.collection('users').where('email', '==', SUPER_ADMIN_EMAIL).limit(1).get();
  if (snap.empty) {
    console.warn(`   ⚠️  Không tìm thấy user với email ${SUPER_ADMIN_EMAIL} — họ cần đăng nhập ít nhất 1 lần trước, rồi chạy lại script này.`);
    return;
  }
  const doc = snap.docs[0];
  if (doc.data().isSuperAdmin === true) {
    console.log('   ✅ Đã là super-admin từ trước\n');
    return;
  }
  await doc.ref.update({ isSuperAdmin: true });
  console.log(`   🎉 Đã gán isSuperAdmin=true cho ${SUPER_ADMIN_EMAIL} (role hiện tại: ${doc.data().role}, schoolId: ${doc.data().schoolId || DEFAULT_SCHOOL_ID})\n`);
}

// Bước 5: sanity check — không được tiếp tục sang deploy rules cho tới khi sạch.
async function sanityCheck() {
  console.log('🔍 Bước 5: Sanity check...');
  let problems = 0;

  for (const name of TENANT_COLLECTIONS) {
    const snap = await db.collection(name).get();
    const missing = snap.docs.filter(d => !d.data().schoolId);
    if (missing.length > 0) {
      problems += missing.length;
      console.warn(`   ❌ ${name}: ${missing.length} doc vẫn thiếu schoolId (vd: ${missing[0].id})`);
    }
  }

  const whitelistSnap = await db.collection('whitelist').get();
  const badWhitelist = whitelistSnap.docs.filter(d => d.id !== d.data().email || !d.data().schoolId || !d.data().role);
  if (badWhitelist.length > 0) {
    problems += badWhitelist.length;
    console.warn(`   ❌ whitelist: ${badWhitelist.length} doc vẫn sai chuẩn (id≠email hoặc thiếu schoolId/role)`);
  }

  if (problems === 0) {
    console.log('   ✅ Sạch — có thể deploy firestore.rules mới.\n');
  } else {
    console.warn(`   ⚠️  Còn ${problems} vấn đề — KHÔNG deploy firestore.rules cho tới khi chạy lại script này và sạch.\n`);
  }
  return problems === 0;
}

async function main() {
  console.log('🚀 Bắt đầu migrate multi-tenant...\n');
  await ensureDefaultSchool();
  await backfillAllCollections();
  await backfillWhitelist();
  await promoteSuperAdmin();
  const clean = await sanityCheck();
  console.log(clean ? '🎉 Hoàn tất, sẵn sàng deploy firestore.rules.' : '⚠️  Hoàn tất nhưng còn vấn đề cần xử lý, xem log ở trên.');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });
