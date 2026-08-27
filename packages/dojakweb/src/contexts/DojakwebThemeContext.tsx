'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  readWalletTheme,
  WALLET_THEME_EVENT,
  writeWalletTheme,
  type WalletChromeTheme,
} from '../lib/wallet-theme-pref';

export type DojakwebTheme = 'dark' | 'light';

interface DojakwebThemeContextValue {
  theme: DojakwebTheme;
  setTheme: (theme: DojakwebTheme) => void;
}

function persistTheme(theme: DojakwebTheme): void {
  writeWalletTheme(theme);
}

const DojakwebThemeContext = createContext<DojakwebThemeContextValue>({
  theme: 'dark',
  setTheme: persistTheme,
});

interface DojakwebThemeProviderProps {
  theme: DojakwebTheme;
  children: ReactNode;
}

export function DojakwebThemeProvider({ theme: themeProp, children }: DojakwebThemeProviderProps) {
  const [override, setOverride] = useState<WalletChromeTheme | null>(() =>
    typeof window === 'undefined' ? null : readWalletTheme(),
  );

  useEffect(() => {
    const sync = () => setOverride(readWalletTheme());
    window.addEventListener(WALLET_THEME_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WALLET_THEME_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setTheme = useCallback((next: DojakwebTheme) => {
    writeWalletTheme(next);
    setOverride(next);
  }, []);

  const theme = override ?? themeProp;
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <DojakwebThemeContext.Provider value={value}>
      {children}
    </DojakwebThemeContext.Provider>
  );
}

export function useDojakwebTheme(): DojakwebThemeContextValue {
  return useContext(DojakwebThemeContext);
}
