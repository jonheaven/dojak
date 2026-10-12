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

export type PopupDoginal = {
  id: string;
  contentType: string;
  contentUrl: string;
  outputValue: number;
  offset: number;
  number?: number;
  protected: boolean;
};

export type PopupDrc20 = { ticker: string; available: string; transferable: string };
export type PopupDune = { name: string; amount: string; divisibility: number };

export type ConnectedSiteRow = { origin: string; name?: string; icon?: string };

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
  listDoginals?: () => Promise<PopupDoginal[]>;
  listTokens?: () => Promise<{ drc20: PopupDrc20[]; dunes: PopupDune[] }>;
  protectDoginal?: (inscriptionId: string) => Promise<{ already: boolean; txid: string | null }>;
  sendDoginal?: (inscriptionId: string, to: string) => Promise<{ txid: string }>;
  listDoginalForSale?: (inscriptionId: string, priceDoge: number) => Promise<unknown>;
  getConnectedSites?: () => Promise<ConnectedSiteRow[]>;
  removeConnectedSite?: (origin: string) => Promise<void>;
};

const WalletCoreContext = createContext<WalletCoreAdapter>({});

export function WalletCoreProvider({ children, adapter }: PropsWithChildren<{ adapter?: WalletCoreAdapter }>) {
  return <WalletCoreContext.Provider value={adapter ?? {}}>{children}</WalletCoreContext.Provider>;
}

export function useWalletCore() {
  return useContext(WalletCoreContext);
}
