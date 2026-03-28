import { createContext, PropsWithChildren, useContext } from 'react';

import type { DogecoinBalanceV2 } from '@dojak/core';

export type SendDogecoinRequest = {
  to: string;
  amount: number;
  feeRate?: number;
};

export type SendDogecoinResult = {
  txid: string;
  rawtx?: string;
};

export type WalletCoreAdapter = {
  getBalance?: () => Promise<DogecoinBalanceV2 | null>;
  sendDogecoin?: (request: SendDogecoinRequest) => Promise<SendDogecoinResult>;
};

const WalletCoreContext = createContext<WalletCoreAdapter>({});

export function WalletCoreProvider({ children, adapter }: PropsWithChildren<{ adapter?: WalletCoreAdapter }>) {
  return <WalletCoreContext.Provider value={adapter ?? {}}>{children}</WalletCoreContext.Provider>;
}

export function useWalletCore() {
  return useContext(WalletCoreContext);
}
