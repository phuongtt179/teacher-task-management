import { useEffect, useRef } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';

export const useFCM = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  // user (object) và toast (hàm mới mỗi lần useToast() render) không ổn định về
  // reference, nên effect bên dưới từng chạy lại mỗi khi App.tsx re-render dù
  // vẫn cùng 1 người đăng nhập — tự ghi FCM token lặp lại nhiều lần/trang
  // (thấy rõ trong log: "saving to user document" lặp 5 lần cho 1 người),
  // tốn ghi Firestore vô ích và góp phần làm hết quota khi nhiều GV cùng dùng.
  // Dùng ref để chỉ chạy đúng 1 lần cho mỗi lượt đăng nhập (theo uid).
  const initializedForUid = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (initializedForUid.current === user.uid) return;
    initializedForUid.current = user.uid;

    const setupFCM = async () => {
      try {
        console.log('🔔 Initializing FCM for user:', user.displayName);

        // Initialize FCM and get token
        const token = await notificationService.initializeFCM();
        if (token) {
          console.log('✅ FCM token obtained, saving to user document');
          // Save token to user document
          await notificationService.saveFCMToken(user.uid, token);
        }
        // If no token, silently continue - FCM is optional

        // Setup foreground message listener
        notificationService.setupForegroundListener((payload) => {
          console.log('📬 Foreground message received:', payload);
          toast({
            title: payload.notification?.title || 'Thông báo mới',
            description: payload.notification?.body || '',
          });
        });
      } catch (error) {
        // Silently fail - FCM is optional, app works fine without it
      }
    };

    setupFCM();
  }, [user, toast]);
};