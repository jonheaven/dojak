'use client';

import { useEffect, useState } from 'react';

/** SSR-safe matchMedia hook. Defaults to `false` until mounted. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Narrow viewports: full-screen wallet, no paw chassis (desktop-only gimmick). */
export const WALLET_MOBILE_MQ = '(max-width: 768px)';

export function useIsMobileWallet(): boolean {
  return useMediaQuery(WALLET_MOBILE_MQ);
}
