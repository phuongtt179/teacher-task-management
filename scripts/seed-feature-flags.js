/**
 * Tạo/cập nhật document cấu hình feature flag cho tính năng Chat AI (config/featureFlags)
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
}, 'seed-feature-flags-app');
const db = admin.firestore(app);

async function seedFeatureFlags() {
  const ref = db.collection('config').doc('featureFlags');
  const snap = await ref.get();

  const betaEmails = [
    'phuongtt179@gmail.com',
    'haiyen.st1510@gmail.com',
    'laptrinhsangtao@gmail.com',
  ];

  if (snap.exists) {
    await ref.set({ chatUIBetaEmails: betaEmails }, { merge: true });
    console.log('Đã cập nhật document config/featureFlags (giữ nguyên các field khác).');
  } else {
    await ref.set({
      chatUIEnabled: false,
      chatUIBetaEmails: betaEmails,
    });
    console.log('Đã tạo mới document config/featureFlags.');
  }

  const result = await ref.get();
  console.log('Nội dung hiện tại:', JSON.stringify(result.data(), null, 2));
}

seedFeatureFlags()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
