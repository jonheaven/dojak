import React, { createContext, useContext, useEffect, useState } from 'react';

import { useTheme } from '@/ui/state/settings/hooks';
import { getThemeColors } from '@/ui/theme/colors';

interface ThemeContextType {
  theme: 'light' | 'dark';
  colors: ReturnType<typeof getThemeColors>;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const savedTheme = useTheme();
  const [theme, setThemeState] = useState<'light' | 'dark'>(savedTheme);

  // Update theme when settings change
  useEffect(() => {
    setThemeState(savedTheme);
  }, [savedTheme]);

  const colors = getThemeColors(theme);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;
  }, [theme, colors]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
  };

  const value: ThemeContextType = {
    theme,
    colors,
    toggleTheme,
    setTheme
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
