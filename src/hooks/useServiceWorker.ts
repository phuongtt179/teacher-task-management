import { useEffect } from 'react';

export const useServiceWorker = () => {
  useEffect(() => {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
      // Listen for service worker updates
      navigator.serviceWorker.ready.then((registration) => {
        console.log('✅ Service Worker ready');

        // Check for updates every hour
        setInterval(() => {
          console.log('🔄 Checking for Service Worker updates...');
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      });

      // DISABLED: Auto-reload on controllerchange (was causing infinite loop)
      // VitePWA with registerType: 'autoUpdate' already handles updates
      // Manual refresh by user is sufficient
    }
  }, []);
};
