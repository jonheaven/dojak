import { createContext, PropsWithChildren, useContext } from 'react';

import type { DogecoinBalanceV2 } from '@dojak/core';

export type SendDogecoinRequest = {
  to: string;
  amount: number;
  feeRate?: number;
  memo?: string;
};

export type SendDogecoinResult = {
  txid: string;
  rawtx?: string;
};

export type WalletTransaction = {
  txid: string;
  amount: number;
  direction: 'sent' | 'received';
  timestamp?: number;
  to?: string;
  from?: string;
  confirmations?: number;
  status?: 'pending' | 'confirmed' | 'failed';
};

export type WalletCoreAdapter = {
  getBalance?: () => Promise<DogecoinBalanceV2 | null>;
  getAddress?: () => Promise<string>;
  getTransactions?: () => Promise<WalletTransaction[]>;
  getUsdRate?: () => Promise<number>;
  sendDogecoin?: (request: SendDogecoinRequest) => Promise<SendDogecoinResult>;
  validateAddress?: (address: string) => boolean | Promise<boolean>;
  copyText?: (value: string) => Promise<void>;
  getConnectedAccounts?: () => Promise<string[]>;
  getVersion?: () => Promise<string>;
  logout?: () => Promise<void>;
};

const WalletCoreContext = createContext<WalletCoreAdapter>({});

export function WalletCoreProvider({ children, adapter }: PropsWithChildren<{ adapter?: WalletCoreAdapter }>) {
  return <WalletCoreContext.Provider value={adapter ?? {}}>{children}</WalletCoreContext.Provider>;
}

export function useWalletCore() {
  return useContext(WalletCoreContext);
}
