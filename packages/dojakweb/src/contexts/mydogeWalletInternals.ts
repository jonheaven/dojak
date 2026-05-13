'use client';

import { createContext } from 'react';
import type { UseMyDogeWalletReturn } from './MyDogeWalletContext';

const noop = async () => {
  throw new Error('Wallet not connected');
};

export const MyDogeWalletContext = createContext<UseMyDogeWalletReturn | null>(null);

export const NULL_MYDOGE_WALLET: UseMyDogeWalletReturn = {
  myDoge: null,
  connected: false,
  address: null,
  balance: 0,
  connecting: false,
  connect: noop,
  disconnect: noop,
  sendTransaction: noop as any,
  signMessage: noop as any,
  signPSBT: noop as any,
  signPSBTOnly: noop as any,
  sendInscription: noop as any,
  getTransactionStatus: noop as any,
  debugProbeRequestPsbt: async () => [],
};
