import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DocumentCategory, DocumentSubCategory } from '@/types';

export const documentCategoryService = {
  // ============ CATEGORIES ============

  // Get all categories for a school year
  async getCategoriesBySchoolYear(schoolYearId: string): Promise<DocumentCategory[]> {
    try {
      const categoriesRef = collection(db, 'documentCategories');
      const q = query(
        categoriesRef,
        where('schoolYearId', '==', schoolYearId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          schoolYearId: data.schoolYearId,
          name: data.name,
          categoryType: data.categoryType || 'personal', // Default to personal for backward compatibility
          hasSubCategories: data.hasSubCategories || false,
          order: data.order || 0,
          driveFolderId: data.driveFolderId,
          allowedUploaders: data.allowedUploaders || [], // Default to empty array for backward compatibility
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  },

  // Create category
  async createCategory(data: {
    schoolYearId: string;
    name: string;
    categoryType: 'public' | 'personal';
    hasSubCategories: boolean;
    order: number;
    createdBy: string;
    allowedUploaders?: string[];
  }): Promise<string> {
    try {
      const categoryDocData: any = {
        schoolYearId: data.schoolYearId,
        name: data.name,
        categoryType: data.categoryType,
        hasSubCategories: data.hasSubCategories ?? false, // Ensure it's never undefined
        order: data.order,
        createdBy: data.createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only add allowedUploaders if provided and not empty
      if (data.allowedUploaders && data.allowedUploaders.length > 0) {
        categoryDocData.allowedUploaders = data.allowedUploaders;
      }

      const categoryDoc = await addDoc(collection(db, 'documentCategories'), categoryDocData);

      return categoryDoc.id;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },

  // Update category
  async updateCategory(id: string, data: {
    name?: string;
    categoryType?: 'public' | 'personal';
    hasSubCategories?: boolean;
    order?: number;
    allowedUploaders?: string[];
  }): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.categoryType !== undefined) updateData.categoryType = data.categoryType;
      if (data.hasSubCategories !== undefined) updateData.hasSubCategories = data.hasSubCategories;
      if (data.order !== undefined) updateData.order = data.order;

      // Handle allowedUploaders
      if (data.allowedUploaders !== undefined) {
        if (data.allowedUploaders.length > 0) {
          updateData.allowedUploaders = data.allowedUploaders;
        } else {
          // Clear the field if empty array provided
          updateData.allowedUploaders = [];
        }
      }

      await updateDoc(doc(db, 'documentCategories', id), updateData);
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  },

  // Delete category
  async deleteCategory(id: string): Promise<void> {
    try {
      // TODO: Delete all subcategories first
      await deleteDoc(doc(db, 'documentCategories', id));
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  },

  // ============ SUB-CATEGORIES ============

  // Get subcategories for a category
  async getSubCategories(categoryId: string): Promise<DocumentSubCategory[]> {
    try {
      const subCategoriesRef = collection(db, 'documentSubCategories');
      const q = query(
        subCategoriesRef,
        where('categoryId', '==', categoryId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          categoryId: data.categoryId,
          name: data.name,
          order: data.order || 0,
          driveFolderId: data.driveFolderId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error getting subcategories:', error);
      throw error;
    }
  },

  // Create subcategory
  async createSubCategory(data: {
    categoryId: string;
    name: string;
    order: number;
  }): Promise<string> {
    try {
      const subCategoryDoc = await addDoc(collection(db, 'documentSubCategories'), {
        categoryId: data.categoryId,
        name: data.name,
        order: data.order,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return subCategoryDoc.id;
    } catch (error) {
      console.error('Error creating subcategory:', error);
      throw error;
    }
  },

  // Update subcategory
  async updateSubCategory(id: string, data: {
    name?: string;
    order?: number;
  }): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.order !== undefined) updateData.order = data.order;

      await updateDoc(doc(db, 'documentSubCategories', id), updateData);
    } catch (error) {
      console.error('Error updating subcategory:', error);
      throw error;
    }
  },

  // Delete subcategory
  async deleteSubCategory(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'documentSubCategories', id));
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      throw error;
    }
  },
};
