import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

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
