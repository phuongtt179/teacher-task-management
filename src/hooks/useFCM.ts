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