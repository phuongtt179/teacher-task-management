import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  deleteDoc,
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db, app } from '../lib/firebase';
// ✅ FIXED: Import Notification từ types (custom type)
import type { Notification, NotificationType } from '../types';

export const notificationService = {
  // Initialize FCM and get token
  async initializeFCM(): Promise<string | null> {
    try {
      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return null;
      }

      // Register service worker first
      console.log('Registering service worker for FCM...');
      let registration: ServiceWorkerRegistration;

      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        console.log('Service worker registered:', registration);

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('Service worker ready');
      } catch (swError) {
        console.error('Service worker registration failed:', swError);
        return null;
      }

      const messaging = getMessaging(app);

      // ✅ FIXED: Dùng window.Notification (browser API) thay vì imported Notification (custom type)
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      // Get FCM token with VAPID key from environment
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.error('VAPID key not configured');
        return null;
      }

      // Pass the service worker registration to getToken
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration
      });

      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Error initializing FCM:', error);
      return null;
    }
  },

  // Listen for foreground messages
  setupForegroundListener(callback: (payload: any) => void) {
    try {
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        callback(payload);
      });
    } catch (error) {
      console.error('Error setting up foreground listener:', error);
    }
  },

  // Save FCM token to user document
  async saveFCMToken(userId: string, token: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        fcmToken: token,
        fcmTokenUpdatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  },

  // Create notification in Firestore
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        userId,
        type,
        title,
        message,
        data: data || {},
        read: false,
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  // Get notifications for user
  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data || {},
          read: data.read,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as Notification;
      }).slice(0, limit);
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  },

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, {
        read: true,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  // Mark all as read
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);

      const updatePromises = snapshot.docs.map((docSnap) =>
        updateDoc(docSnap.ref, { read: true })
      );

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  },

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  },

  // Helper: Send notification when task is assigned
  async notifyTaskAssigned(teacherIds: string[], taskId: string, taskTitle: string, createdByName: string): Promise<void> {
    try {
      const promises = teacherIds.map((teacherId) =>
        this.createNotification(
          teacherId,
          'task_assigned',
          'Công việc mới',
          `${createdByName} đã giao cho bạn: "${taskTitle}"`,
          { taskId, taskTitle }
        )
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error notifying task assigned:', error);
    }
  },

  // Helper: Send notification for upcoming deadline
  async notifyDeadline(teacherId: string, taskId: string, taskTitle: string, hoursLeft: number): Promise<void> {
    try {
      await this.createNotification(
        teacherId,
        'task_deadline',
        'Deadline sắp đến',
        `Công việc "${taskTitle}" sẽ hết hạn trong ${hoursLeft} giờ nữa`,
        { taskId, taskTitle }
      );
    } catch (error) {
      console.error('Error notifying deadline:', error);
    }
  },

  // Helper: Send notification when task is scored
  async notifyTaskScored(
    teacherId: string,
    taskId: string,
    taskTitle: string,
    score: number,
    maxScore: number,
    scoredByName: string
  ): Promise<void> {
    try {
      await this.createNotification(
        teacherId,
        'task_scored',
        'Bài làm đã được chấm',
        `${scoredByName} đã chấm "${taskTitle}": ${score}/${maxScore} điểm`,
        { taskId, taskTitle, score }
      );
    } catch (error) {
      console.error('Error notifying task scored:', error);
    }
  },

  // Helper: Send notification when task is submitted
  async notifyTaskSubmitted(
    vpId: string,
    taskId: string,
    taskTitle: string,
    teacherName: string
  ): Promise<void> {
    try {
      await this.createNotification(
        vpId,
        'task_submitted',
        'Có bài nộp mới',
        `${teacherName} đã nộp bài cho "${taskTitle}"`,
        { taskId, taskTitle }
      );
    } catch (error) {
      console.error('Error notifying task submitted:', error);
    }
  },
};