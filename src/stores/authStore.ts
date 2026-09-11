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
  // Tên trường của user đang đăng nhập — luôn được set (kể cả trường đang hoạt
  // động bình thường), khác với suspendedSchoolName chỉ set khi trường bị khóa.
  // Dùng để hiện "đang ở trường nào" trên sidebar (hệ thống multi-tenant, nhiều
  // trường dùng chung 1 app nên cần phân biệt rõ).
  schoolName: string | null;

  setFirebaseUser: (user: FirebaseUser | null) => void;
  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsWhitelisted: (whitelisted: boolean) => void;
  setSuspendedSchoolName: (name: string | null) => void;
  setSchoolName: (name: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  user: null,
  isLoading: true,
  isWhitelisted: null,
  suspendedSchoolName: null,
  schoolName: null,

  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsWhitelisted: (isWhitelisted) => set({ isWhitelisted }),
  setSuspendedSchoolName: (suspendedSchoolName) => set({ suspendedSchoolName }),
  setSchoolName: (schoolName) => set({ schoolName }),

  logout: () => set({
    firebaseUser: null,
    user: null,
    isWhitelisted: null,
    suspendedSchoolName: null,
    schoolName: null,
  }),
}));