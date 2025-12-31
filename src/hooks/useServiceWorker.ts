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

      // Listen for controller change (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 New Service Worker activated, reloading page...');
        window.location.reload();
      });
    }
  }, []);
};
