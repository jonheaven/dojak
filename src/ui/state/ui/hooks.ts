import { useMemo } from 'react';

import { ChainType } from '@/shared/constant';
import { Inscription } from '@/shared/types';

import { AppState } from '..';
import { useCurrentAccount, useCurrentAddress } from '../accounts/hooks';
import { useAppDispatch, useAppSelector } from '../hooks';
import { useChainType, useNetworkType } from '../settings/hooks';
import { AssetTabKey, uiActions } from './reducer';

export function useUIState(): AppState['ui'] {
  return useAppSelector((state) => state.ui);
}

export function useAssetTabKey() {
  const uiState = useUIState();
  return uiState.assetTabKey;
}

export function useDoginalsAssetTabKey() {
  const uiState = useUIState();
  return uiState.doginalsAssetTabKey;
}

export function usePepStakeAssetTabKey() {
  const uiState = useUIState();
  return uiState.pepStakeAssetTabKey;
}

export function useCharmsAssetTabKey() {
  const uiState = useUIState();
  return uiState.charmsAssetTabKey;
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
  const currentAddress = useCurrentAddress();
  const networkType = useNetworkType();
  const currentAccount = useCurrentAccount();

  const assetTabKeys: AssetTabKey[] = [];
  const assets = {
    doginals: false,
    dunes: false,
    Charms: false,
    PepStake: false,
    Feels: false
  };

  assets.doginals = true;
  assetTabKeys.push(AssetTabKey.doginals);

  assets.dunes = true;
  assetTabKeys.push(AssetTabKey.RUNES);

  assets.Feels = true;
  assetTabKeys.push(AssetTabKey.FEELS);

  if (chainType === ChainType.BITCOIN_MAINNET) {
    assets.Charms = true;
    assetTabKeys.push(AssetTabKey.Charms);

    assets.PepStake = true;
    assetTabKeys.push(AssetTabKey.PEPSTAKE);
  }

  return {
    tabKeys: assetTabKeys,
    assets,
    key: assetTabKeys.join(',')
  };
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


