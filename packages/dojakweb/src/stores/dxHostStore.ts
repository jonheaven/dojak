import { create } from 'zustand';

export interface DxHostPending {
  requestId: string;
  xHandle: string;
  origin: string;
  source: Window | null;
}

interface DxHostState {
  pending: DxHostPending | null;
  /** When true, ConnectWalletButton should open the drawer/modal (consumed by UI). */
  openWalletSignal: number;
  setPending: (p: DxHostPending | null) => void;
  signalOpenWallet: () => void;
  clearPending: () => void;
}

export const useDxHostStore = create<DxHostState>((set) => ({
  pending: null,
  openWalletSignal: 0,
  setPending: (pending) => set({ pending }),
  signalOpenWallet: () => set((s) => ({ openWalletSignal: s.openWalletSignal + 1 })),
  clearPending: () => set({ pending: null }),
}));
