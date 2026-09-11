import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  query,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { tenantCollection } from '@/lib/tenantQuery';
import { User, UserRole } from '@/types';

export const userService = {
  // Get all users in a school
  async getAllUsers(schoolId: string): Promise<User[]> {
    try {
      const q = query(tenantCollection('users', schoolId), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL,
          role: data.role || 'teacher',
          schoolId: data.schoolId ?? null,
          isSuperAdmin: data.isSuperAdmin === true,
          phoneNumber: data.phoneNumber,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          isActive: data.isActive !== false, // Default true
          fcmToken: data.fcmToken
        };
      });
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  },

  // Get users by role within a school
  async getUsersByRole(schoolId: string, role: UserRole): Promise<User[]> {
    try {
      const q = query(
        tenantCollection('users', schoolId),
        where('role', '==', role),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL,
          role: data.role || 'teacher',
          schoolId: data.schoolId ?? null,
          isSuperAdmin: data.isSuperAdmin === true,
          phoneNumber: data.phoneNumber,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          isActive: data.isActive !== false,
          fcmToken: data.fcmToken
        };
      });
    } catch (error) {
      console.error('Error getting users by role:', error);
      throw error;
    }
  },

  // Get single user
  async getUser(uid: string): Promise<User | null> {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return null;
      }

      const data = userDoc.data();
      return {
        uid: userDoc.id,
        email: data.email || '',
        displayName: data.displayName || '',
        photoURL: data.photoURL,
        role: data.role || 'teacher',
        schoolId: data.schoolId ?? null,
        isSuperAdmin: data.isSuperAdmin === true,
        phoneNumber: data.phoneNumber,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        isActive: data.isActive !== false,
        fcmToken: data.fcmToken
      };
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  },

  // Update user role
  async updateUserRole(
    uid: string,
    newRole: UserRole
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: Timestamp.now()
      });

      // Also update in whitelist if exists
      const user = await this.getUser(uid);
      if (user?.email) {
        const whitelistRef = doc(db, 'whitelist', user.email);
        const whitelistDoc = await getDoc(whitelistRef);

        if (whitelistDoc.exists()) {
          await updateDoc(whitelistRef, {
            role: newRole
          });
        }
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  // Update user status (active/inactive)
  async updateUserStatus(uid: string, isActive: boolean): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        isActive,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  },

  // Update user info
  async updateUser(
    uid: string,
    updates: Partial<{
      displayName: string;
      role: UserRole;
      isActive: boolean;
      phoneNumber: string;
    }>
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      // Update role in whitelist if role changed
      if (updates.role) {
        const user = await this.getUser(uid);
        if (user?.email) {
          const whitelistRef = doc(db, 'whitelist', user.email);
          const whitelistDoc = await getDoc(whitelistRef);

          if (whitelistDoc.exists()) {
            await updateDoc(whitelistRef, {
              role: updates.role
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user (also removes from whitelist)
  async deleteUser(uid: string): Promise<void> {
    try {
      // Get user email first
      const user = await this.getUser(uid);

      // Delete from users collection
      const userRef = doc(db, 'users', uid);
      await deleteDoc(userRef);

      // Delete from whitelist if exists
      if (user?.email) {
        const whitelistRef = doc(db, 'whitelist', user.email);
        const whitelistDoc = await getDoc(whitelistRef);

        if (whitelistDoc.exists()) {
          await deleteDoc(whitelistRef);
        }
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // Get user statistics
  async getUserStats(schoolId: string): Promise<{
    total: number;
    admins: number;
    vicePrincipals: number;
    departmentHeads: number;
    teachers: number;
    active: number;
    inactive: number;
  }> {
    try {
      const users = await this.getAllUsers(schoolId);

      return {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        vicePrincipals: users.filter(u => u.role === 'vice_principal').length,
        departmentHeads: users.filter(u => u.role === 'department_head' || u.role === 'deputy_department_head').length,
        teachers: users.filter(u => u.role === 'teacher').length,
        active: users.filter(u => u.isActive !== false).length,
        inactive: users.filter(u => u.isActive === false).length
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  },

  // Add user to whitelist (grants access to a specific school)
  async addToWhitelist(
    email: string,
    role: UserRole,
    schoolId: string,
    addedBy: string
  ): Promise<void> {
    try {
      const whitelistRef = doc(db, 'whitelist', email);
      await setDoc(whitelistRef, {
        email,
        role,
        schoolId,
        addedAt: Timestamp.now(),
        addedBy
      });
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      throw error;
    }
  },

  // Remove from whitelist
  async removeFromWhitelist(email: string): Promise<void> {
    try {
      const whitelistRef = doc(db, 'whitelist', email);
      await deleteDoc(whitelistRef);
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      throw error;
    }
  }
};
