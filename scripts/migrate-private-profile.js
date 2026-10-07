/**
 * Chuyển số điện thoại + FCM token từ users/{uid} (cả trường đọc được) sang
 * users/{uid}/private/info (chỉ chính chủ + admin/BGH đọc được).
 *
 * Chạy thử (KHÔNG ghi gì):   node scripts/migrate-private-profile.js
 * Chạy thật:                 node scripts/migrate-private-profile.js --apply
 *
 * CHỈ CHẠY SAU KHI đã deploy code mới (app đọc/ghi ở private/info) và TRƯỚC KHI
 * deploy firestore.rules mới (rules mới chặn chính chủ ghi các field này vào users/{uid}).
 *
 * An toàn / chạy lại nhiều lần được: field nào đã có ở private/info thì GIỮ giá trị ở
 * đó (mới hơn), chỉ chép field còn thiếu; sau khi chép xong mới xóa khỏi users/{uid}.
 */
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const PRIVATE_FIELDS = ['phoneNumber', 'fcmToken', 'fcmTokenUpdatedAt'];

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}, 'migrate-private-profile-app');
const db = admin.firestore(app);

const mask = (v) => (typeof v === 'string' && v.length > 4 ? `${v.slice(0, 2)}…${v.slice(-2)}` : v ? '…' : v);

async function main() {
  console.log(APPLY ? '=== CHẠY THẬT (--apply) ===' : '=== CHẠY THỬ — không ghi gì. Thêm --apply để chạy thật ===');
  const usersSnap = await db.collection('users').get();
  let moved = 0, skipped = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const present = PRIVATE_FIELDS.filter((f) => data[f] !== undefined);
    if (present.length === 0) { skipped++; continue; }

    const privateRef = userDoc.ref.collection('private').doc('info');
    const privateSnap = await privateRef.get();
    const existing = privateSnap.exists ? privateSnap.data() : {};

    const toCopy = { schoolId: data.schoolId ?? null };
    for (const f of present) if (existing[f] === undefined && data[f] !== '') toCopy[f] = data[f];

    console.log(`- ${data.email || userDoc.id}: chuyển [${present.join(', ')}]` +
      ` (phone=${mask(data.phoneNumber)}, đã có ở private: ${PRIVATE_FIELDS.filter((f) => existing[f] !== undefined).join(', ') || 'không'})`);

    if (APPLY) {
      await privateRef.set(toCopy, { merge: true });
      const del = Object.fromEntries(present.map((f) => [f, admin.firestore.FieldValue.delete()]));
      await userDoc.ref.update(del);
    }
    moved++;
  }

  console.log(`\nTổng ${usersSnap.size} người dùng: ${moved} cần chuyển, ${skipped} không có thông tin riêng tư.`);

  if (APPLY) {
    const left = (await db.collection('users').get()).docs
      .filter((d) => PRIVATE_FIELDS.some((f) => d.data()[f] !== undefined));
    console.log(left.length === 0
      ? '✅ Kiểm tra lại: không còn số điện thoại/FCM token nào ở users/{uid}.'
      : `⚠️ Còn ${left.length} người dùng chưa chuyển xong: ${left.map((d) => d.id).join(', ')}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
