import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { User } from '../types';

export const useAuth = () => {
  const { 
    firebaseUser, 
    user, 
    isLoading, 
    isWhitelisted,
    setFirebaseUser, 
    setUser, 
    setIsLoading,
    setIsWhitelisted,
    logout: clearAuth 
  } = useAuthStore();

  // Check if email is whitelisted
  const checkWhitelist = async (email: string): Promise<boolean> => {
    try {
      const whitelistRef = collection(db, 'whitelist');
      const q = query(whitelistRef, where('email', '==', email));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking whitelist:', error);
      return false;
    }
  };

  // Get or create user document
  const getUserDocument = async (uid: string, email: string): Promise<User | null> => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        return {
          uid,
          email: data.email,
          displayName: data.displayName,
          photoURL: data.photoURL,
          role: data.role,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as User;
      }

      // Create new user document (default role: teacher)
      const newUser: User = {
        uid,
        email,
        displayName: email.split('@')[0],
        role: 'teacher',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(userRef, {
        ...newUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return newUser;
    } catch (error) {
      console.error('Error getting user document:', error);
      return null;
    }
  };

  // Login with Google
  const login = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email!;

      // Check whitelist
      const whitelisted = await checkWhitelist(email);
      setIsWhitelisted(whitelisted);

      if (!whitelisted) {
        await signOut(auth);
        throw new Error('Email không có trong danh sách cho phép');
      }

      // Get user document
      const userData = await getUserDocument(result.user.uid, email);
      if (userData) {
        setUser(userData);
      }

      return result.user;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      clearAuth();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Auth state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser?.email) {
        const whitelisted = await checkWhitelist(firebaseUser.email);
        setIsWhitelisted(whitelisted);

        if (whitelisted) {
          const userData = await getUserDocument(firebaseUser.uid, firebaseUser.email);
          setUser(userData);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
        setIsWhitelisted(false);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return {
    firebaseUser,
    user,
    isLoading,
    isWhitelisted,
    login,
    logout,
  };
};