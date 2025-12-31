import { useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';

export const useFCM = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const setupFCM = async () => {
      try {
        console.log('🔔 Initializing FCM for user:', user.displayName);

        // Initialize FCM and get token
        const token = await notificationService.initializeFCM();
        if (token) {
          console.log('✅ FCM token obtained, saving to user document');
          // Save token to user document
          await notificationService.saveFCMToken(user.uid, token);
        } else {
          console.log('⚠️ FCM token not available (permission denied or not supported)');
        }

        // Setup foreground message listener
        notificationService.setupForegroundListener((payload) => {
          console.log('📬 Foreground message received:', payload);
          toast({
            title: payload.notification?.title || 'Thông báo mới',
            description: payload.notification?.body || '',
          });
        });
      } catch (error) {
        console.error('❌ Error setting up FCM:', error);
        // Don't throw error - FCM is optional, app should continue working
      }
    };

    setupFCM();
  }, [user, toast]);
};