import { Inscription } from '@/shared/types';
import { createSlice } from '@reduxjs/toolkit';

import { updateVersion } from '../global/actions';

export interface UIState {
  assetTabKey: AssetTabKey;
  inscriptionFilter: InscriptionFilterKey;
  steakAssetTabKey: SteakAssetTabKey;
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
  SteakSendScreen: {
    inputAmount: string;
    memo: string;
  };
  navigationSource: NavigationSource;
  isBalanceHidden: boolean;
}

// Main asset tabs - simplified to 3 categories
export enum AssetTabKey {
  INSCRIPTIONS = 0, // All inscription-based assets (Doginals, DRC20, Dunes, Charms)
  STEAK = 1,
  WOOF = 2
}

// Filter for inscription types within the Inscriptions tab
export enum InscriptionFilterKey {
  ALL = 0, // Show all inscriptions
  DOGINALS = 1, // Generic doginals/images
  DRC20 = 2, // DRC-20 tokens
  DUNES = 3, // Dunes (runes-like)
  CHARMS = 4 // Charms metaprotocol
}

export enum SteakAssetTabKey {
  DASHBOARD = 0,
  STAKES = 1,
  HISTORY = 2
}

export enum NavigationSource {
  BACK,
  NORMAL
}

export const initialState: UIState = {
  assetTabKey: AssetTabKey.INSCRIPTIONS,
  inscriptionFilter: InscriptionFilterKey.ALL,
  steakAssetTabKey: SteakAssetTabKey.DASHBOARD,
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
  SteakSendScreen: {
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
          inscriptionFilter?: InscriptionFilterKey;
          steakAssetTabKey?: SteakAssetTabKey;
        };
      }
    ) {
      const { payload } = action;
      if (payload.assetTabKey !== undefined) {
        state.assetTabKey = payload.assetTabKey;
      }
      if (payload.inscriptionFilter !== undefined) {
        state.inscriptionFilter = payload.inscriptionFilter;
      }
      if (payload.steakAssetTabKey !== undefined) {
        state.steakAssetTabKey = payload.steakAssetTabKey;
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
    updateSteakSendScreen(
      state,
      action: {
        payload: {
          inputAmount?: string;
          memo?: string;
        };
      }
    ) {
      if (action.payload.inputAmount !== undefined) {
        state.SteakSendScreen.inputAmount = action.payload.inputAmount;
      }
      if (action.payload.memo !== undefined) {
        state.SteakSendScreen.memo = action.payload.memo;
      }
    },
    resetSteakSendScreen(state) {
      state.SteakSendScreen = initialState.SteakSendScreen;
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
      // Migration: convert old tab keys to new simplified system
      if (!state.assetTabKey || state.assetTabKey > AssetTabKey.WOOF) {
        state.assetTabKey = AssetTabKey.INSCRIPTIONS;
      }
      if (state.inscriptionFilter === undefined) {
        state.inscriptionFilter = InscriptionFilterKey.ALL;
      }
      if (!state.steakAssetTabKey) {
        state.steakAssetTabKey = SteakAssetTabKey.DASHBOARD;
      }
      if (!state.uiTxCreateScreen) {
        state.uiTxCreateScreen = initialState.uiTxCreateScreen;
      }
      if (!state.SteakSendScreen) {
        state.SteakSendScreen = initialState.SteakSendScreen;
      }
      if (state.isBalanceHidden === undefined) {
        state.isBalanceHidden = false;
      }
    });
  }
});

export const uiActions = slice.actions;
export default slice.reducer;
