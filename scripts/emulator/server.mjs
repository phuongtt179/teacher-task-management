// Chạy server/index.js nối vào Firebase Emulator (npm run server:emulator).
// Biến môi trường đặt TRƯỚC khi nạp server — dotenv không ghi đè biến đã có, nên dự án giả
// "demo-ttm" luôn thắng giá trị thật trong .env; Admin SDK tự chuyển sang emulator.
process.env.GCLOUD_PROJECT = 'demo-ttm';
process.env.VITE_FIREBASE_PROJECT_ID = 'demo-ttm';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.PORT = process.env.PORT || '3001';

await import('../../server/index.js');
