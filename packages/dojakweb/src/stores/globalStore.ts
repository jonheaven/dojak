import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ja'; // Add more as needed
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY';
export type WalletInterface = 'modal' | 'drawer';
export type DrawerSide = 'left' | 'right';

export interface RecentActivity {
  id: string;
  type: 'send' | 'receive' | 'inscribe' | 'deploy' | 'mint';
  amount?: number;
  timestamp: Date;
  description: string;
}

interface GlobalState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Wallet Interface
  walletInterface: WalletInterface;
  setWalletInterface: (walletInterface: WalletInterface) => void;

  // Drawer Side
  drawerSide: DrawerSide;
  setDrawerSide: (drawerSide: DrawerSide) => void;

  // Language
  language: Language;
  setLanguage: (language: Language) => void;

  // Currency
  currency: Currency;
  setCurrency: (currency: Currency) => void;

  // Recent Activity
  recentActivities: RecentActivity[];
  addActivity: (activity: RecentActivity) => void;
  clearActivities: () => void;
}

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set) => ({
      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      // Wallet Interface
      walletInterface: 'drawer',
      setWalletInterface: (walletInterface) => set({ walletInterface }),

      // Drawer Side
      drawerSide: 'right',
      setDrawerSide: (drawerSide) => set({ drawerSide }),

      // Language
      language: 'en',
      setLanguage: (language) => set({ language }),

      // Currency
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),

      // Recent Activity
      recentActivities: [],
      addActivity: (activity) => set((state) => ({
        recentActivities: [activity, ...state.recentActivities.slice(0, 9)],
      })),
      clearActivities: () => set({ recentActivities: [] }),
    }),
    {
      name: 'dojakweb-global-store',
      partialize: (state) => ({
        theme: state.theme,
        walletInterface: state.walletInterface,
        drawerSide: state.drawerSide,
        language: state.language,
        currency: state.currency,
      }),
    }
  )
);
