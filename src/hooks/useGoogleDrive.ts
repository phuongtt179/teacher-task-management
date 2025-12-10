import { useState, useEffect } from 'react';
import { googleDriveService } from '@/services/googleDriveService';

export function useGoogleDrive() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeDrive();
  }, []);

  const initializeDrive = async () => {
    try {
      setIsLoading(true);
      await googleDriveService.initialize();
      setIsInitialized(true);
      setIsSignedIn(googleDriveService.isSignedIn());
    } catch (error) {
      console.error('Error initializing Google Drive:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async () => {
    try {
      setIsLoading(true);
      await googleDriveService.signIn();
      setIsSignedIn(true);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await googleDriveService.signOut();
      setIsSignedIn(false);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isInitialized,
    isSignedIn,
    isLoading,
    signIn,
    signOut,
    driveService: googleDriveService,
  };
}
