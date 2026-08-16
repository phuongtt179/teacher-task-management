import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plan } from '../types';

// Global catalog (not tenant-scoped) — writes gated to super-admin by firestore.rules.
// This is the ONE place billing numbers live; nothing in the app hardcodes them.
export const planService = {
  async getAllPlans(): Promise<Plan[]> {
    const q = query(collection(db, 'plans'), orderBy('priceVnd', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        priceVnd: data.priceVnd,
        promoPriceVnd: data.promoPriceVnd,
        promoMonths: data.promoMonths,
        aiMessageLimit: data.aiMessageLimit,
        storageLimitBytes: data.storageLimitBytes,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Plan;
    });
  },

  async createPlan(input: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Timestamp.now();
    const ref = await addDoc(collection(db, 'plans'), { ...input, createdAt: now, updatedAt: now });
    return ref.id;
  },

  async updatePlan(planId: string, updates: Partial<Omit<Plan, 'id' | 'createdAt'>>): Promise<void> {
    await updateDoc(doc(db, 'plans', planId), { ...updates, updatedAt: Timestamp.now() });
  },

  async deletePlan(planId: string): Promise<void> {
    await deleteDoc(doc(db, 'plans', planId));
  },
};
