import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Chế độ chạy thử trên máy với Firebase Emulator (scripts/emulator/) — dự án giả "demo-…"
// không bao giờ chạm tới Firestore/Auth thật. Đếm lượt đọc của server để đo chi phí từng thao tác.
export const IS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
export const emulatorReads = { count: 0 };

if (!admin.apps.length && IS_EMULATOR) {
  const projectId = process.env.GCLOUD_PROJECT || 'demo-ttm';
  if (!projectId.startsWith('demo-')) throw new Error('Emulator phải dùng project "demo-…" để không chạm dữ liệu thật');
  admin.initializeApp({ projectId });
  console.log(`🧪 Firebase Admin dùng EMULATOR (${process.env.FIRESTORE_EMULATOR_HOST}), project ${projectId}`);

  const { Query, DocumentReference, Firestore } = admin.firestore;
  const origQueryGet = Query.prototype.get;
  Query.prototype.get = async function (...args) {
    const snap = await origQueryGet.apply(this, args);
    emulatorReads.count += Math.max(1, snap.size);
    return snap;
  };
  const origDocGet = DocumentReference.prototype.get;
  DocumentReference.prototype.get = async function (...args) {
    emulatorReads.count += 1;
    return origDocGet.apply(this, args);
  };
  const origGetAll = Firestore.prototype.getAll;
  Firestore.prototype.getAll = async function (...refs) {
    const snaps = await origGetAll.apply(this, refs);
    emulatorReads.count += snaps.length;
    return snaps;
  };
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Thiếu/sai 1 trong 3 biến này khiến mọi request xác thực (login, upload...) bị
  // từ chối 401 cho TẤT CẢ tài khoản — log ra lúc khởi động để kiểm tra nhanh qua
  // Render > Logs mà không cần đợi user báo lỗi rồi mới soi.
  const missing = ['VITE_FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']
    .filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`⚠️ Firebase Admin thiếu biến môi trường: ${missing.join(', ')} — mọi xác thực token sẽ thất bại.`);
  } else {
    console.log(`✅ Firebase Admin init cho project: ${process.env.VITE_FIREBASE_PROJECT_ID}`);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const db = admin.firestore();
export default admin;
