'use client';

import { useContext } from 'react';
import type { UseMyDogeWalletReturn } from './MyDogeWalletContext';
import { MyDogeWalletContext, NULL_MYDOGE_WALLET } from './mydogeWalletInternals';

export function useMyDogeWallet(): UseMyDogeWalletReturn {
  return useContext(MyDogeWalletContext) ?? NULL_MYDOGE_WALLET;
}
