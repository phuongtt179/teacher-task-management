import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  isLoading: boolean;
  isWhitelisted: boolean | null;
  // Set when the caller's whitelist entry resolves to a school whose
  // isActive flag is false (billing suspension) — checked BEFORE trying to
  // read users/{uid}, since that read is itself blocked once schoolIsActive()
  // fails in firestore.rules and would otherwise just look like "user not found".
  suspendedSchoolName: string | null;

  setFirebaseUser: (user: FirebaseUser | null) => void;
  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsWhitelisted: (whitelisted: boolean) => void;
  setSuspendedSchoolName: (name: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  user: null,
  isLoading: true,
  isWhitelisted: null,
  suspendedSchoolName: null,

  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsWhitelisted: (isWhitelisted) => set({ isWhitelisted }),
  setSuspendedSchoolName: (suspendedSchoolName) => set({ suspendedSchoolName }),

  logout: () => set({
    firebaseUser: null,
    user: null,
    isWhitelisted: null,
    suspendedSchoolName: null,
  }),
}));