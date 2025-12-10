import { useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';

export const useFCM = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    // TODO: Tạm thời disable FCM để test
    // Sẽ enable lại sau khi fix service worker issue
    console.log('FCM disabled temporarily for testing');

    /* COMMENTED OUT - Will re-enable after fixing service worker
    const setupFCM = async () => {
      try {
        // Initialize FCM and get token
        const token = await notificationService.initializeFCM();
        if (token) {
          // Save token to user document
          await notificationService.saveFCMToken(user.uid, token);
        }

        // Setup foreground message listener
        notificationService.setupForegroundListener((payload) => {
          toast({
            title: payload.notification?.title || 'Thông báo mới',
            description: payload.notification?.body || '',
          });
        });
      } catch (error) {
        console.error('Error setting up FCM:', error);
      }
    };

    setupFCM();
    */
  }, [user]);
};