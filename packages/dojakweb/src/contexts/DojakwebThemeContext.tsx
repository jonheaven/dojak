'use client';

import React, { createContext, useContext, type ReactNode } from 'react';

export type DojakwebTheme = 'dark' | 'light';

interface DojakwebThemeContextValue {
  theme: DojakwebTheme;
}

const DojakwebThemeContext = createContext<DojakwebThemeContextValue>({ theme: 'dark' });

interface DojakwebThemeProviderProps {
  theme: DojakwebTheme;
  children: ReactNode;
}

export function DojakwebThemeProvider({ theme, children }: DojakwebThemeProviderProps) {
  return (
    <DojakwebThemeContext.Provider value={{ theme }}>
      {children}
    </DojakwebThemeContext.Provider>
  );
}

export function useDojakwebTheme(): DojakwebThemeContextValue {
  return useContext(DojakwebThemeContext);
}
