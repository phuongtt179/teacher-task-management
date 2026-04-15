/**
 * Backfill schoolYearId vào tất cả submissions hiện có
 * Chạy: node scripts/backfill-submission-school-year.js
 *
 * Script này đọc mỗi submission, tra taskId để lấy schoolYearId,
 * rồi cập nhật submission với field schoolYearId mới.
 * An toàn: chỉ thêm field, không xóa hay thay đổi field hiện có.
 */
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}, 'backfill-app');

const db = admin.firestore(app);

async function backfill() {
  console.log('🚀 Bắt đầu backfill schoolYearId vào submissions...\n');

  // 1. Load tất cả tasks vào Map để tra nhanh
  console.log('📥 Đang load tasks...');
  const tasksSnap = await db.collection('tasks').get();
  const taskMap = new Map();
  tasksSnap.forEach(doc => {
    taskMap.set(doc.id, doc.data());
  });
  console.log(`   → Đã load ${taskMap.size} tasks\n`);

  // 2. Load tất cả submissions
  console.log('📥 Đang load submissions...');
  const submissionsSnap = await db.collection('submissions').get();
  console.log(`   → Đã load ${submissionsSnap.size} submissions\n`);

  // 3. Phân loại
  let alreadyHas = 0;
  let willUpdate = 0;
  let taskNotFound = 0;
  const toUpdate = [];

  submissionsSnap.forEach(doc => {
    const data = doc.data();

    // Bỏ qua nếu đã có schoolYearId
    if (data.schoolYearId) {
      alreadyHas++;
      return;
    }

    const task = taskMap.get(data.taskId);
    if (!task) {
      taskNotFound++;
      console.warn(`   ⚠️  Submission ${doc.id}: task ${data.taskId} không tìm thấy — bỏ qua`);
      return;
    }

    if (!task.schoolYearId) {
      taskNotFound++;
      console.warn(`   ⚠️  Task ${data.taskId} không có schoolYearId — bỏ qua`);
      return;
    }

    toUpdate.push({ ref: doc.ref, schoolYearId: task.schoolYearId });
    willUpdate++;
  });

  console.log(`📊 Thống kê:`);
  console.log(`   ✅ Đã có schoolYearId: ${alreadyHas}`);
  console.log(`   🔄 Cần cập nhật: ${willUpdate}`);
  console.log(`   ⚠️  Bỏ qua (task không tồn tại): ${taskNotFound}\n`);

  if (toUpdate.length === 0) {
    console.log('✅ Không có gì cần cập nhật. Hoàn tất!');
    return;
  }

  // 4. Cập nhật theo batch (Firestore giới hạn 500 ops/batch)
  const BATCH_SIZE = 400;
  let updated = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    chunk.forEach(({ ref, schoolYearId }) => {
      batch.update(ref, { schoolYearId });
    });

    await batch.commit();
    updated += chunk.length;
    console.log(`   ✍️  Đã cập nhật ${updated}/${willUpdate} submissions...`);
  }

  console.log(`\n🎉 Hoàn tất! Đã cập nhật ${updated} submissions với schoolYearId.`);
}

backfill()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });
