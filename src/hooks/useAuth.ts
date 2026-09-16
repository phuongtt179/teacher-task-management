import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { departmentService } from '../services/departmentService';
import { User, WhitelistEmail } from '../types';

export const useAuth = () => {
  const {
    firebaseUser,
    user,
    isLoading,
    isWhitelisted,
    suspendedSchoolName,
    schoolName,
    setFirebaseUser,
    setUser,
    setIsLoading,
    setIsWhitelisted,
    setSuspendedSchoolName,
    setSchoolName,
    logout: clearAuth
  } = useAuthStore();

  // schools/{schoolId} stays readable even when isActive is false (see
  // firestore.rules — deliberately NOT gated by schoolIsActive), so this check
  // must run BEFORE getUserDocument: once a school is suspended, sameSchool()
  // blocks the users/{uid} read too, and that would otherwise look like a
  // generic "account not found" instead of a clear suspension message.
  const checkSchoolActive = async (schoolId: string): Promise<{ active: boolean; name: string }> => {
    const snap = await getDoc(doc(db, 'schools', schoolId));
    if (!snap.exists()) return { active: true, name: '' }; // fail open on missing doc, not our problem to diagnose here
    const data = snap.data();
    return { active: data.isActive !== false, name: data.name || '' };
  };

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
  const getUserDocument = async (uid: string, email: string, whitelistEntry: WhitelistEmail, googlePhotoURL?: string | null): Promise<User | null> => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        // Ảnh Google có thể đổi theo thời gian (hoặc chưa từng được lưu ở các tài
        // khoản tạo trước khi có field này) — đồng bộ lại mỗi lần đăng nhập nếu khác.
        const photoURL = googlePhotoURL ?? data.photoURL;
        if (googlePhotoURL && googlePhotoURL !== data.photoURL) {
          updateDoc(userRef, { photoURL: googlePhotoURL }).catch((e) => console.error('Error syncing photoURL:', e));
        }
        return {
          uid,
          email: data.email,
          displayName: data.displayName,
          photoURL,
          role: data.role,
          schoolId: data.schoolId ?? null,
          isSuperAdmin: data.isSuperAdmin === true,
          phoneNumber: data.phoneNumber,
          primaryCampusId: data.primaryCampusId ?? null,
          campusIds: data.campusIds || [],
          subject: data.subject,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as User;
      }

      // Create new user document — role/schoolId come from the whitelist entry
      // that matched this email (not hardcoded, and not chosen by the user).
      // Họ tên/môn dạy/cơ sở: dùng giá trị điền sẵn lúc "Nhập hàng loạt" nếu có
      // (xem WhitelistEmail.pending* trong types) — admin không biết uid trước
      // khi người này đăng nhập lần đầu nên phải gửi kèm qua whitelist.
      const newUser: User = {
        uid,
        email,
        displayName: whitelistEntry.pendingDisplayName || email.split('@')[0],
        photoURL: googlePhotoURL || undefined,
        role: whitelistEntry.role,
        schoolId: whitelistEntry.schoolId,
        primaryCampusId: whitelistEntry.pendingCampusIds?.[0] ?? null,
        campusIds: whitelistEntry.pendingCampusIds ?? [],
        subject: whitelistEntry.pendingSubject || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userData: Record<string, any> = { ...newUser, createdAt: new Date(), updatedAt: new Date() };
      Object.keys(userData).forEach((k) => userData[k] === undefined && delete userData[k]);
      await setDoc(userRef, userData);

      // Gắn vào Tổ chuyên môn điền sẵn (nếu có) — chỉ addMember, không tự đặt
      // tổ trưởng (tránh xung đột "tổ đã có tổ trưởng" âm thầm lúc đăng nhập).
      if (whitelistEntry.pendingDepartmentId) {
        try {
          await departmentService.addMember(whitelistEntry.pendingDepartmentId, uid);
        } catch (deptError) {
          console.error('Error adding new user to pending department:', deptError);
        }
      }

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

      // Get/create user document TRƯỚC khi check trường có bị khóa không — vì
      // firestore.rules đọc schools/{id} cần userSchoolId() (đọc qua users/{uid}).
      // Với người đăng nhập lần đầu (users/{uid} chưa tồn tại), đọc schools trước
      // sẽ luôn bị "Missing or insufficient permissions" (get() trên doc chưa có
      // khiến userSchoolId()/isSuperAdmin() lỗi → rule deny).
      const userData = await getUserDocument(result.user.uid, email, whitelistEntry, result.user.photoURL);

      const { active, name } = await checkSchoolActive(whitelistEntry.schoolId);
      setSchoolName(name || null);
      if (!active) {
        setSuspendedSchoolName(name);
        setUser(null);
        return result.user;
      }
      setSuspendedSchoolName(null);

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

      // try/finally bao toàn bộ: một lỗi Firestore bất ngờ ở bất kỳ bước nào cũng
      // KHÔNG được để app treo mãi ở "Đang tải..." (setIsLoading(false) phải luôn
      // chạy — trước đây nằm cuối hàm nên 1 exception giữa chừng làm nó không bao giờ chạy).
      try {
        if (firebaseUser?.email) {
          const whitelistEntry = await checkWhitelist(firebaseUser.email);
          setIsWhitelisted(whitelistEntry !== null);

          if (whitelistEntry) {
            // Thứ tự giống login(): tạo/lấy users/{uid} TRƯỚC khi check trường bị
            // khóa — đọc schools/{id} cần users/{uid} đã tồn tại (xem giải thích trong login()).
            const userData = await getUserDocument(firebaseUser.uid, firebaseUser.email, whitelistEntry, firebaseUser.photoURL);
            const { active, name } = await checkSchoolActive(whitelistEntry.schoolId);
            setSchoolName(name || null);
            if (!active) {
              setSuspendedSchoolName(name);
              setUser(null);
            } else {
              setSuspendedSchoolName(null);
              setUser(userData);
            }
          } else {
            setUser(null);
            setSchoolName(null);
          }
        } else {
          setUser(null);
          setIsWhitelisted(false);
          setSchoolName(null);
        }
      } catch (error) {
        console.error('Auth state observer error:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    firebaseUser,
    user,
    isLoading,
    isWhitelisted,
    suspendedSchoolName,
    schoolName,
    login,
    logout,
  };
};