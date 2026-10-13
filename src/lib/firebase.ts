import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { 
  getMessaging, 
  isSupported, 
  getToken, 
  onMessage 
} from 'firebase/messaging';

// Firebase config từ environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Chạy thử trên máy với Firebase Emulator (npm run dev:emulator, xem scripts/emulator/) — chỉ
// khi build với VITE_USE_EMULATOR=true; bản deploy không bao giờ bật.
export const USE_EMULATOR = import.meta.env.VITE_USE_EMULATOR === 'true';
if (USE_EMULATOR) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  // Đăng nhập không cần popup Google — kịch bản kiểm thử tự động tạo custom token cho đúng
  // tài khoản trong dữ liệu mẫu (scripts/emulator/seed.mjs) rồi gọi hàm này.
  (window as unknown as { __devLogin: (token: string) => Promise<unknown> }).__devLogin = (token) =>
    signInWithCustomToken(auth, token);
}

// Force account selection on login
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/// Initialize Firebase Cloud Messaging
export const initMessaging = async () => {
  try {
    const isMessagingSupported = await isSupported();
    
    if (isMessagingSupported) {
      const messaging = getMessaging(app);
      
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Get token với VAPID key từ environment variables
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });
        console.log('FCM Token:', token);

        // Optional: Listen to messages
        onMessage(messaging, (payload) => {
          console.log('Message received:', payload);
        });
      }
    }
  } catch (error) {
    console.error('Messaging setup error:', error);
  }
};

// Don't export messaging directly to avoid errors in non-HTTPS environments
// Use getMessaging(app) in components where needed with proper error handling