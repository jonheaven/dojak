import { useMemo } from 'react';

import { ChainType } from '@dojak/core/constant';
import { Inscription } from '@dojak/core/types';

import { AppState } from '..';
import { useCurrentAccount, useCurrentAddress } from '../accounts/hooks';
import { useAppDispatch, useAppSelector } from '../hooks';
import { useChainType, useNetworkType } from '../settings/hooks';
import { AssetTabKey, InscriptionFilterKey, uiActions } from './reducer';

export function useUIState(): AppState['ui'] {
  return useAppSelector((state) => state.ui);
}

export function useAssetTabKey() {
  const uiState = useUIState();
  return uiState.assetTabKey;
}

export function useInscriptionFilter() {
  const uiState = useUIState();
  return uiState.inscriptionFilter;
}

export function useSteakAssetTabKey() {
  const uiState = useUIState();
  return uiState.steakAssetTabKey;
}

export function useUiTxCreateScreen() {
  const uiState = useUIState();
  return uiState.uiTxCreateScreen;
}

export function useUpdateUiTxCreateScreen() {
  const dispatch = useAppDispatch();
  return ({
    toInfo,
    inputAmount,
    enableRBF,
    feeRate
  }: {
    toInfo?: { address: string; domain: string; inscription?: Inscription };
    inputAmount?: string;
    enableRBF?: boolean;
    feeRate?: number;
  }) => {
    dispatch(uiActions.updateTxCreateScreen({ toInfo, inputAmount, enableRBF, feeRate }));
  };
}

export function useResetUiTxCreateScreen() {
  const dispatch = useAppDispatch();
  return () => {
    dispatch(uiActions.resetTxCreateScreen());
  };
}

export function useSupportedAssets() {
  const chainType = useChainType();

  const assetTabKeys: AssetTabKey[] = [];
  const assets = {
    inscriptions: true, // Always show inscriptions tab
    steak: false,
    woof: true // Woof is always available
  };

  // Inscriptions tab is always available (contains Doginals, DRC20, Dunes, Charms)
  assetTabKeys.push(AssetTabKey.INSCRIPTIONS);

  // Woof is always available
  assetTabKeys.push(AssetTabKey.WOOF);

  // Steak is only available on mainnet
  if (chainType === ChainType.BITCOIN_MAINNET) {
    assets.steak = true;
    assetTabKeys.push(AssetTabKey.STEAK);
  }

  return {
    tabKeys: assetTabKeys,
    assets,
    key: assetTabKeys.join(',')
  };
}

// Get available inscription filter options based on current tab and chain
export function useSupportedInscriptionFilters() {
  const assetTab = useAssetTabKey();
  const chainType = useChainType();

  if (assetTab === AssetTabKey.COLLECTIBLES) {
    // Collectibles tab: DNS, Dogemaps, NFTs
    return [
      InscriptionFilterKey.ALL_COLLECTIBLES,
      InscriptionFilterKey.DNS,
      InscriptionFilterKey.DOGEMAPS,
      InscriptionFilterKey.NFTS
    ];
  } else if (assetTab === AssetTabKey.TOKENS) {
    // Tokens tab: DRC-20, Dunes, Charms
    const filters = [
      InscriptionFilterKey.ALL_TOKENS,
      InscriptionFilterKey.DRC20,
      InscriptionFilterKey.DUNES
    ];

    // Charms only on mainnet
    if (chainType === ChainType.BITCOIN_MAINNET) {
      filters.push(InscriptionFilterKey.CHARMS);
    }

    return filters;
  }

  // Fallback - return all filters
  return [
    InscriptionFilterKey.ALL_COLLECTIBLES,
    InscriptionFilterKey.DNS,
    InscriptionFilterKey.DOGEMAPS,
    InscriptionFilterKey.NFTS,
    InscriptionFilterKey.ALL_TOKENS,
    InscriptionFilterKey.DRC20,
    InscriptionFilterKey.DUNES,
    ...(chainType === ChainType.BITCOIN_MAINNET ? [InscriptionFilterKey.CHARMS] : [])
  ];
}

export const useIsInExpandView = () => {
  return useMemo(() => {
    if (window.innerWidth > 156 * 3) {
      return true;
    } else {
      return false;
    }
  }, [window.innerWidth]);
};
