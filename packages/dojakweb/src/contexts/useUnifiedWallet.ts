'use client';

import { useContext } from 'react';
import type { UnifiedWalletContextValue } from '../types/wallet';
import { NULL_WALLET, UnifiedWalletContext } from './unifiedWalletInternals';

export function useUnifiedWallet(): UnifiedWalletContextValue {
  return useContext(UnifiedWalletContext) ?? NULL_WALLET;
}
