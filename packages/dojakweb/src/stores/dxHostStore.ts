import { create } from 'zustand';

export interface DxHostPending {
  requestId: string;
  xHandle: string;
  origin: string;
  source: Window | null;
}

/** Optional focus when host opens the wallet drawer (e.g. ÐLotto assets). */
export type WalletOpenFocus = {
  /** Dashboard tab */
  tab?: 'assets' | 'transactions' | 'listings';
  /** Assets subtype */
  assetType?: 'nft' | 'drc20' | 'treats';
  /** NFT grid filter */
  nftFilter?: 'all' | 'media' | 'dlotto';
};

interface DxHostState {
  pending: DxHostPending | null;
  /** When true, ConnectWalletButton should open the drawer/modal (consumed by UI). */
  openWalletSignal: number;
  /** Bump to close the host wallet drawer/modal (e.g. approval Reject). */
  closeWalletSignal: number;
  /** Latest open focus request (read then cleared by ConnectWalletButton). */
  openFocus: WalletOpenFocus | null;
  setPending: (p: DxHostPending | null) => void;
  signalOpenWallet: (focus?: WalletOpenFocus | null) => void;
  signalCloseWallet: () => void;
  consumeOpenFocus: () => WalletOpenFocus | null;
  clearPending: () => void;
}

export const useDxHostStore = create<DxHostState>((set, get) => ({
  pending: null,
  openWalletSignal: 0,
  closeWalletSignal: 0,
  openFocus: null,
  setPending: (pending) => set({ pending }),
  signalOpenWallet: (focus) =>
    set((s) => ({
      openWalletSignal: s.openWalletSignal + 1,
      openFocus: focus ?? null,
    })),
  signalCloseWallet: () => set((s) => ({ closeWalletSignal: s.closeWalletSignal + 1 })),
  consumeOpenFocus: () => {
    const focus = get().openFocus;
    if (focus) set({ openFocus: null });
    return focus;
  },
  clearPending: () => set({ pending: null }),
}));
