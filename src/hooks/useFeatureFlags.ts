import { useEffect, useState } from 'react';
import { featureFlagService } from '@/services/featureFlagService';

// Returns null while loading (caller should treat null as "not enabled yet")
export function useChatUIEnabled(email: string | null | undefined): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!email) {
      setEnabled(false);
      return;
    }
    featureFlagService.isChatUIEnabledFor(email).then(result => {
      if (!cancelled) setEnabled(result);
    });
    return () => { cancelled = true; };
  }, [email]);

  return enabled;
}
