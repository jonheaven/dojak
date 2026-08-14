'use client';

import { createContext } from 'react';
import type { UnifiedWalletContextValue } from '../types/wallet';

const noop = async () => {
  throw new Error('Wallet not connected');
};

export const UnifiedWalletContext = createContext<UnifiedWalletContextValue | null>(null);

export const NULL_WALLET: UnifiedWalletContextValue = {
  walletType: null,
  connected: false,
  address: null,
  balance: 0,
  balanceVerified: false,
  connecting: false,
  accountIndex: null,
  derivationPath: null,
  availableWallets: [],
  balanceRefreshing: false,
  balanceError: null,
  connect: noop,
  setActiveWallet: noop as any,
  refreshBalance: noop,
  switchAccount: noop,
  disconnect: noop,
  disconnectWallet: noop,
  disconnectAll: noop,
  sendTransaction: noop,
  signMessage: noop,
  signPSBT: noop,
  signPSBTOnly: noop,
  signDMPIntent: noop as any,
  sendInscription: noop,
  getTransactionStatus: noop as any,
  createBrowserWallet: noop as any,
  importBrowserWallet: noop as any,
  importBrowserWalletFromMnemonic: noop as any,
  saveBrowserWallet: noop,
  loadBrowserWallet: noop as any,
  loadBrowserSeedMaterial: noop as any,
  hasBrowserWallet: noop as any,
  removeBrowserWallet: noop,
};
