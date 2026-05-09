import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DogeNetworkId = 'dogecoin' | 'dogeos';

export interface WalletState {
  dogeosEnabled: boolean;
  pureDogeosMode: boolean;
  currentNetwork: DogeNetworkId;
  dogeosEverUsed: boolean;
  dogecoinAddress: string | null;
  dogeosAddress: string | null;
  dogecoinBalance: string;
  dogeosBalance: string;
  setDogeosEnabled: (enabled: boolean) => void;
  setPureDogeosMode: (enabled: boolean) => void;
  setCurrentNetwork: (network: DogeNetworkId) => void;
  markDogeosUsed: () => void;
  setDogeosAddress: (address: string | null) => void;
  setDogecoinAddress: (address: string | null) => void;
  setDogeosBalance: (balance: string) => void;
  setDogecoinBalance: (balance: string) => void;
  resetEvmSession: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      dogeosEnabled: false,
      pureDogeosMode: false,
      currentNetwork: 'dogecoin',
      dogeosEverUsed: false,
      dogecoinAddress: null,
      dogeosAddress: null,
      dogecoinBalance: '',
      dogeosBalance: '',

      setDogeosEnabled: (enabled) =>
        set((s) => {
          if (!enabled) {
            return {
              dogeosEnabled: false,
              pureDogeosMode: false,
              currentNetwork: 'dogecoin' as const,
              dogeosAddress: null,
              dogeosBalance: '',
            };
          }
          return { dogeosEnabled: true };
        }),

      setPureDogeosMode: (enabled) =>
        set((s) => {
          if (!s.dogeosEnabled) return { pureDogeosMode: false };
          if (enabled) return { pureDogeosMode: true, currentNetwork: 'dogeos' as const };
          return { pureDogeosMode: false, currentNetwork: 'dogecoin' as const };
        }),

      setCurrentNetwork: (network) =>
        set((s) => {
          if (!s.dogeosEnabled && network === 'dogeos') return {};
          if (s.pureDogeosMode && network === 'dogecoin') return {};
          const dogeosEverUsed = network === 'dogeos' ? true : s.dogeosEverUsed;
          return { currentNetwork: network, dogeosEverUsed };
        }),

      markDogeosUsed: () => set({ dogeosEverUsed: true }),

      setDogeosAddress: (dogeosAddress) => set({ dogeosAddress }),
      setDogecoinAddress: (dogecoinAddress) => set({ dogecoinAddress }),
      setDogeosBalance: (dogeosBalance) => set({ dogeosBalance }),
      setDogecoinBalance: (dogecoinBalance) => set({ dogecoinBalance }),

      resetEvmSession: () =>
        set({
          dogeosAddress: null,
          dogeosBalance: '',
          dogecoinAddress: null,
          dogecoinBalance: '',
        }),
    }),
    {
      name: 'dojakweb-wallet-ecosystem',
      partialize: (state) => ({
        dogeosEnabled: state.dogeosEnabled,
        pureDogeosMode: state.pureDogeosMode,
        currentNetwork: state.currentNetwork,
        dogeosEverUsed: state.dogeosEverUsed,
      }),
    }
  )
);
