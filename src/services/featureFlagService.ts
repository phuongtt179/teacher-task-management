import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface FeatureFlags {
  chatUIEnabled: boolean;
  chatUIBetaEmails: string[];
}

const DEFAULT_FLAGS: FeatureFlags = {
  chatUIEnabled: false,
  chatUIBetaEmails: [],
};

export const featureFlagService = {
  // Reads config/featureFlags. Fails safe: any error/missing doc returns the
  // default (chat UI OFF) so a Firestore hiccup never accidentally exposes
  // the beta UI to everyone.
  async getFlags(): Promise<FeatureFlags> {
    try {
      const snap = await getDoc(doc(db, 'config', 'featureFlags'));
      if (!snap.exists()) return DEFAULT_FLAGS;
      const data = snap.data();
      return {
        chatUIEnabled: data.chatUIEnabled === true,
        chatUIBetaEmails: Array.isArray(data.chatUIBetaEmails) ? data.chatUIBetaEmails : [],
      };
    } catch (error) {
      console.error('Error loading feature flags:', error);
      return DEFAULT_FLAGS;
    }
  },

  async isChatUIEnabledFor(email: string | null | undefined): Promise<boolean> {
    if (!email) return false;
    const flags = await this.getFlags();
    if (flags.chatUIEnabled) return true;
    return flags.chatUIBetaEmails.some(e => e.toLowerCase() === email.toLowerCase());
  },
};
