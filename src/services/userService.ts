import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'vice_principal' | 'department_head' | 'teacher';
  createdAt: Date;
  updatedAt: Date;
  isActive?: boolean;
  fcmToken?: string;
}

export const userService = {
  // Get all users
  async getAllUsers(): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL,
          role: data.role || 'teacher',
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

  // Get users by role
  async getUsersByRole(role: 'admin' | 'vice_principal' | 'department_head' | 'teacher'): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
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
    newRole: 'admin' | 'vice_principal' | 'department_head' | 'teacher'
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
      role: 'admin' | 'vice_principal' | 'department_head' | 'teacher';
      isActive: boolean;
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
  async getUserStats(): Promise<{
    total: number;
    admins: number;
    vicePrincipals: number;
    departmentHeads: number;
    teachers: number;
    active: number;
    inactive: number;
  }> {
    try {
      const users = await this.getAllUsers();

      return {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        vicePrincipals: users.filter(u => u.role === 'vice_principal').length,
        departmentHeads: users.filter(u => u.role === 'department_head').length,
        teachers: users.filter(u => u.role === 'teacher').length,
        active: users.filter(u => u.isActive !== false).length,
        inactive: users.filter(u => u.isActive === false).length
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  },

  // Add user to whitelist
  async addToWhitelist(
    email: string,
    role: 'admin' | 'vice_principal' | 'department_head' | 'teacher',
    addedBy: string
  ): Promise<void> {
    try {
      const whitelistRef = doc(db, 'whitelist', email);
      await setDoc(whitelistRef, {
        email,
        role,
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
