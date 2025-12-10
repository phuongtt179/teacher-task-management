import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

export const messaging = getMessaging(app);