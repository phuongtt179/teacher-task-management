/**
 * Script để xóa dữ liệu test từ Firestore
 *
 * CẢNH BÁO: Script này sẽ XÓA DỮ LIỆU!
 * Hãy chạy trên môi trường test trước!
 *
 * Cách chạy:
 * node scripts/cleanup-test-data.js
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
dotenv.config({ path: join(__dirname, '..', '.env') });

// Firebase config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Xóa tất cả documents trong một collection
 */
async function deleteCollection(collectionName) {
  console.log(`\n🗑️  Đang xóa collection: ${collectionName}...`);

  const snapshot = await getDocs(collection(db, collectionName));
  let count = 0;

  for (const docSnapshot of snapshot.docs) {
    await deleteDoc(doc(db, collectionName, docSnapshot.id));
    count++;
    console.log(`   Đã xóa: ${docSnapshot.id}`);
  }

  console.log(`✅ Đã xóa ${count} documents từ ${collectionName}`);
  return count;
}

/**
 * Xóa users trừ admin
 */
async function deleteNonAdminUsers(adminEmail) {
  console.log(`\n🗑️  Đang xóa users (trừ admin: ${adminEmail})...`);

  const snapshot = await getDocs(collection(db, 'users'));
  let count = 0;

  for (const docSnapshot of snapshot.docs) {
    const userData = docSnapshot.data();

    // Giữ lại admin và vice_principal
    if (userData.email !== adminEmail && userData.role !== 'admin') {
      await deleteDoc(doc(db, 'users', docSnapshot.id));
      count++;
      console.log(`   Đã xóa user: ${userData.email}`);
    } else {
      console.log(`   Giữ lại: ${userData.email} (${userData.role})`);
    }
  }

  console.log(`✅ Đã xóa ${count} users`);
  return count;
}

/**
 * Main cleanup function
 */
async function cleanup() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   CLEANUP TEST DATA - FIREBASE FIRESTORE  ║');
  console.log('╚═══════════════════════════════════════════╝');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

  console.log(`\n⚠️  CẢNH BÁO: Script này sẽ XÓA DỮ LIỆU!`);
  console.log(`   Admin email được giữ lại: ${adminEmail}`);
  console.log(`\n   Đang đếm ngược 5 giây...`);

  // Countdown
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`   ${i}... `);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log('\n\n🚀 Bắt đầu xóa dữ liệu...\n');

  try {
    const stats = {
      tasks: 0,
      submissions: 0,
      notifications: 0,
      documents: 0,
      schoolYears: 0,
      categories: 0,
      subCategories: 0,
      departments: 0,
      users: 0,
    };

    // Xóa các collections
    stats.tasks = await deleteCollection('tasks');
    stats.submissions = await deleteCollection('submissions');
    stats.notifications = await deleteCollection('notifications');
    stats.documents = await deleteCollection('documents');
    stats.schoolYears = await deleteCollection('schoolYears');
    stats.categories = await deleteCollection('documentCategories');
    stats.subCategories = await deleteCollection('documentSubCategories');
    stats.departments = await deleteCollection('departments');

    // Xóa users (trừ admin)
    stats.users = await deleteNonAdminUsers(adminEmail);

    // Tổng kết
    console.log('\n\n╔═══════════════════════════════════════════╗');
    console.log('║            CLEANUP COMPLETED              ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('\n📊 THỐNG KÊ:');
    console.log(`   Tasks xóa:             ${stats.tasks}`);
    console.log(`   Submissions xóa:       ${stats.submissions}`);
    console.log(`   Notifications xóa:     ${stats.notifications}`);
    console.log(`   Documents xóa:         ${stats.documents}`);
    console.log(`   School Years xóa:      ${stats.schoolYears}`);
    console.log(`   Categories xóa:        ${stats.categories}`);
    console.log(`   SubCategories xóa:     ${stats.subCategories}`);
    console.log(`   Departments xóa:       ${stats.departments}`);
    console.log(`   Users xóa:             ${stats.users}`);
    console.log(`\n   Tổng cộng:             ${Object.values(stats).reduce((a, b) => a + b, 0)} documents`);

    console.log('\n✅ Dữ liệu đã được xóa thành công!');
    console.log('   Bạn có thể bắt đầu test với dữ liệu mới.\n');

  } catch (error) {
    console.error('\n❌ Lỗi khi xóa dữ liệu:', error);
    console.error('   Chi tiết:', error.message);
  }

  process.exit(0);
}

// Run cleanup
cleanup();
