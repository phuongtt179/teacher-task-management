/**
 * Script để update Firebase config trong service worker từ .env file
 * Chạy: node scripts/update-sw-config.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Đọc file .env
function loadEnv() {
  try {
    const envPath = join(ROOT_DIR, '.env');
    const envContent = readFileSync(envPath, 'utf-8');

    const env = {};
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        env[key.trim()] = valueParts.join('=').trim();
      }
    });

    return env;
  } catch (error) {
    console.error('❌ Không thể đọc file .env:', error.message);
    console.log('💡 Đảm bảo file .env đã tồn tại (copy từ .env.example)');
    process.exit(1);
  }
}

// Update service worker file
function updateServiceWorker(env) {
  const swPath = join(ROOT_DIR, 'public', 'firebase-messaging-sw.js');

  try {
    let swContent = readFileSync(swPath, 'utf-8');

    // Tạo Firebase config object từ env
    const firebaseConfig = {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID
    };

    // Kiểm tra các giá trị cần thiết
    const missingKeys = Object.entries(firebaseConfig)
      .filter(([key, value]) => !value || value.includes('your-') || value.includes('AIza'))
      .map(([key]) => key);

    if (missingKeys.length > 0) {
      console.warn('⚠️  Cảnh báo: Các giá trị sau chưa được cập nhật trong .env:');
      missingKeys.forEach(key => console.warn(`   - ${key}`));
      console.log('');
    }

    // Tìm và replace Firebase config trong service worker
    const configRegex = /firebase\.initializeApp\(\{[\s\S]*?\}\);/;
    const newConfig = `firebase.initializeApp({
    apiKey: "${firebaseConfig.apiKey}",
    authDomain: "${firebaseConfig.authDomain}",
    projectId: "${firebaseConfig.projectId}",
    storageBucket: "${firebaseConfig.storageBucket}",
    messagingSenderId: "${firebaseConfig.messagingSenderId}",
    appId: "${firebaseConfig.appId}"
});`;

    if (configRegex.test(swContent)) {
      swContent = swContent.replace(configRegex, newConfig);
      writeFileSync(swPath, swContent, 'utf-8');
      console.log('✅ Đã cập nhật Firebase config trong service worker!');
      console.log('📁 File: public/firebase-messaging-sw.js');
    } else {
      console.error('❌ Không tìm thấy Firebase config trong service worker');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Lỗi khi cập nhật service worker:', error.message);
    process.exit(1);
  }
}

// Main
console.log('🔧 Đang cập nhật Firebase config cho service worker...\n');

const env = loadEnv();
console.log('✅ Đã đọc file .env');

updateServiceWorker(env);

console.log('\n✨ Hoàn tất! Service worker đã sẵn sàng sử dụng.');
console.log('💡 Lưu ý: Chạy lại script này mỗi khi thay đổi Firebase config trong .env\n');
