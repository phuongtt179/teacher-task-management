import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { User, WhitelistEmail } from '../types';

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

  // Whitelist doc ID is the email itself — a direct get(), not a query, since a
  // brand-new user has no users/{uid} doc yet (so schoolId isn't known until
  // this lookup resolves it).
  const checkWhitelist = async (email: string): Promise<WhitelistEmail | null> => {
    try {
      const snap = await getDoc(doc(db, 'whitelist', email));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        id: snap.id,
        email: data.email,
        schoolId: data.schoolId,
        role: data.role,
        addedBy: data.addedBy,
        addedAt: data.addedAt?.toDate ? data.addedAt.toDate() : data.addedAt,
      };
    } catch (error) {
      console.error('Error checking whitelist:', error);
      return null;
    }
  };

  // Get or create user document. `whitelistEntry` supplies role/schoolId when the
  // user doc doesn't exist yet — the account is provisioned into whichever school
  // its matching whitelist entry grants access to, never a school the caller chooses.
  const getUserDocument = async (uid: string, email: string, whitelistEntry: WhitelistEmail): Promise<User | null> => {
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
          schoolId: data.schoolId ?? null,
          isSuperAdmin: data.isSuperAdmin === true,
          phoneNumber: data.phoneNumber,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as User;
      }

      // Create new user document — role/schoolId come from the whitelist entry
      // that matched this email (not hardcoded, and not chosen by the user).
      const newUser: User = {
        uid,
        email,
        displayName: email.split('@')[0],
        role: whitelistEntry.role,
        schoolId: whitelistEntry.schoolId,
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
      const whitelistEntry = await checkWhitelist(email);
      setIsWhitelisted(whitelistEntry !== null);

      if (!whitelistEntry) {
        await signOut(auth);
        throw new Error('Email không có trong danh sách cho phép');
      }

      // Get user document
      const userData = await getUserDocument(result.user.uid, email, whitelistEntry);
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
        const whitelistEntry = await checkWhitelist(firebaseUser.email);
        setIsWhitelisted(whitelistEntry !== null);

        if (whitelistEntry) {
          const userData = await getUserDocument(firebaseUser.uid, firebaseUser.email, whitelistEntry);
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