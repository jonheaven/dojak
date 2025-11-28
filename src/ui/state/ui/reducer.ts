import { Inscription } from '@/shared/types';
import { createSlice } from '@reduxjs/toolkit';

import { updateVersion } from '../global/actions';

export interface UIState {
  assetTabKey: AssetTabKey;
  doginalsAssetTabKey: DoginalsAssetTabKey;
  pepStakeAssetTabKey: PepStakeAssetTabKey;
  charmsAssetTabKey: CharmsAssetTabKey;
  uiTxCreateScreen: {
    toInfo: {
      address: string;
      domain: string;
      inscription?: Inscription;
    };
    inputAmount: string;
    enableRBF: boolean;
    feeRate: number;
  };
  PepStakeSendScreen: {
    inputAmount: string;
    memo: string;
  };
  navigationSource: NavigationSource;
  isBalanceHidden: boolean;
}

export enum AssetTabKey {
  doginals = 0,
  ATOMICALS = 1, // IGNORED
  DUNES = 2,
  PEPSTAKE = 3,
  FEELS = 4
}

export enum DoginalsAssetTabKey {
  ALL = 0,
  DRC20 = 1,
  DRC20_6BYTE = 2
}

export enum PepStakeAssetTabKey {
  DASHBOARD = 0,
  STAKES = 1,
  HISTORY = 2
}

export enum CharmsAssetTabKey {
  TOKEN = 0,
  COLLECTION = 1
}


export enum NavigationSource {
  BACK,
  NORMAL
}

export const initialState: UIState = {
  assetTabKey: AssetTabKey.doginals,
  doginalsAssetTabKey: DoginalsAssetTabKey.ALL,
  pepStakeAssetTabKey: PepStakeAssetTabKey.DASHBOARD,
  charmsAssetTabKey: CharmsAssetTabKey.TOKEN,
  uiTxCreateScreen: {
    toInfo: {
      address: '',
      domain: '',
      inscription: undefined
    },
    inputAmount: '',
    enableRBF: false,
    feeRate: 1
  },
  PepStakeSendScreen: {
    inputAmount: '',
    memo: ''
  },
  navigationSource: NavigationSource.NORMAL,
  isBalanceHidden: false
};

const slice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    reset(state) {
      return initialState;
    },
    updateAssetTabScreen(
      state,
      action: {
        payload: {
          assetTabKey?: AssetTabKey;
          doginalsAssetTabKey?: DoginalsAssetTabKey;
          pepStakeAssetTabKey?: PepStakeAssetTabKey;
          charmsAssetTabKey?: CharmsAssetTabKey;
        };
      }
    ) {
      const { payload } = action;
      if (payload.assetTabKey !== undefined) {
        state.assetTabKey = payload.assetTabKey;
      }
      if (payload.doginalsAssetTabKey !== undefined) {
        state.doginalsAssetTabKey = payload.doginalsAssetTabKey;
      }
      if (payload.pepStakeAssetTabKey !== undefined) {
        state.pepStakeAssetTabKey = payload.pepStakeAssetTabKey;
      }
      if (payload.charmsAssetTabKey !== undefined) {
        state.charmsAssetTabKey = payload.charmsAssetTabKey;
      }

      return state;
    },
    updateTxCreateScreen(
      state,
      action: {
        payload: {
          toInfo?: {
            address: string;
            domain: string;
            inscription?: Inscription;
          };
          inputAmount?: string;
          enableRBF?: boolean;
          feeRate?: number;
        };
      }
    ) {
      if (action.payload.toInfo !== undefined) {
        state.uiTxCreateScreen.toInfo = action.payload.toInfo;
      }
      if (action.payload.inputAmount !== undefined) {
        state.uiTxCreateScreen.inputAmount = action.payload.inputAmount;
      }
      if (action.payload.enableRBF !== undefined) {
        state.uiTxCreateScreen.enableRBF = action.payload.enableRBF;
      }
      if (action.payload.feeRate !== undefined) {
        state.uiTxCreateScreen.feeRate = action.payload.feeRate;
      }
    },
    resetTxCreateScreen(state) {
      state.uiTxCreateScreen = initialState.uiTxCreateScreen;
    },
    updatePepStakeSendScreen(
      state,
      action: {
        payload: {
          inputAmount?: string;
          memo?: string;
        };
      }
    ) {
      if (action.payload.inputAmount !== undefined) {
        state.PepStakeSendScreen.inputAmount = action.payload.inputAmount;
      }
      if (action.payload.memo !== undefined) {
        state.PepStakeSendScreen.memo = action.payload.memo;
      }
    },
    resetPepStakeSendScreen(state) {
      state.PepStakeSendScreen = initialState.PepStakeSendScreen;
    },
    setNavigationSource(state, action: { payload: NavigationSource }) {
      state.navigationSource = action.payload;
    },
    setBalanceHidden(state, action: { payload: boolean }) {
      state.isBalanceHidden = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(updateVersion, (state) => {
      // todo
      if (!state.assetTabKey) {
        state.assetTabKey = AssetTabKey.doginals;
      }
      if (!state.doginalsAssetTabKey) {
        state.doginalsAssetTabKey = DoginalsAssetTabKey.ALL;
      }
      if (!state.pepStakeAssetTabKey) {
        state.pepStakeAssetTabKey = PepStakeAssetTabKey.DASHBOARD;
      }
      if (!state.uiTxCreateScreen) {
        state.uiTxCreateScreen = initialState.uiTxCreateScreen;
      }
      if (!state.PepStakeSendScreen) {
        state.PepStakeSendScreen = initialState.PepStakeSendScreen;
      }
      if (state.isBalanceHidden === undefined) {
        state.isBalanceHidden = false;
      }
    });
  }
});

export const uiActions = slice.actions;
export default slice.reducer;


