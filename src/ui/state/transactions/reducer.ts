import { Inscription } from '@/shared/types';
import { createSlice } from '@reduxjs/toolkit';
import { UnspentOutput } from '@unisat/tx-helpers/types';

import { updateVersion } from '../global/actions';

export interface BitcoinTx {
  fromAddress: string;
  toAddress: string;
  toSatoshis: number;
  rawtx: string;
  txid: string;
  fee: number;
  estimateFee: number;
  changeSatoshis: number;
  sending: boolean;
  autoAdjust: boolean;
  psbtHex: string;
  feeRate: number;
  toDomain: string;
  enableRBF: boolean;
}

export interface DoginalsTx {
  fromAddress: string;
  toAddress: string;
  inscription: Inscription;
  rawtx: string;
  txid: string;
  fee: number;
  estimateFee: number;
  changeSatoshis: number;
  sending: boolean;
  psbtHex: string;
  feeRate: number;
  toDomain: string;
  outputValue: number;
  enableRBF: boolean;
}

export interface DunesTx {
  fromAddress: string;
  toAddress: string;
  rawtx: string;
  txid: string;
  fee: number;
  estimateFee: number;
  changeSatoshis: number;
  sending: boolean;
  psbtHex: string;
  feeRate: number;
  toDomain: string;
  outputValue: number;
  enableRBF: boolean;
  runeid?: string;
  runeAmount?: string;
}

export interface TransactionsState {
  bitcoinTx: BitcoinTx;
  doginalsTx: DoginalsTx;
  dunesTx: DunesTx;
  utxos: UnspentOutput[];
  spendUnavailableUtxos: UnspentOutput[];
  assetUtxos_inscriptions: UnspentOutput[];
  assetUtxos_dunes: UnspentOutput[];
}

export const initialState: TransactionsState = {
  bitcoinTx: {
    fromAddress: '',
    toAddress: '',
    toSatoshis: 0,
    rawtx: '',
    txid: '',
    fee: 0,
    estimateFee: 0,
    changeSatoshis: 0,
    sending: false,
    autoAdjust: false,
    psbtHex: '',
    feeRate: 5,
    toDomain: '',
    enableRBF: false
  },
  doginalsTx: {
    fromAddress: '',
    toAddress: '',
    inscription: {
      inscriptionId: '',
      inscriptionNumber: 0,
      address: '',
      outputValue: 0,
      preview: '',
      content: '',
      contentType: '',
      contentLength: 0,
      timestamp: 0,
      genesisTransaction: '',
      location: '',
      output: '',
      offset: 0,
      contentBody: '',
      utxoHeight: 0,
      utxoConfirmation: 0
    },
    rawtx: '',
    txid: '',
    fee: 0,
    estimateFee: 0,
    changeSatoshis: 0,
    sending: false,
    psbtHex: '',
    feeRate: 5,
    toDomain: '',
    outputValue: 10000,
    enableRBF: false
  },

  dunesTx: {
    fromAddress: '',
    toAddress: '',
    rawtx: '',
    txid: '',
    fee: 0,
    estimateFee: 0,
    changeSatoshis: 0,
    sending: false,
    psbtHex: '',
    feeRate: 5,
    toDomain: '',
    outputValue: 10000,
    enableRBF: false
  },
  utxos: [],
  spendUnavailableUtxos: [],
  assetUtxos_inscriptions: [],
  assetUtxos_dunes: []
};

const slice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    updateBitcoinTx(
      state,
      action: {
        payload: {
          fromAddress?: string;
          toAddress?: string;
          toSatoshis?: number;
          changeSatoshis?: number;
          rawtx?: string;
          txid?: string;
          fee?: number;
          estimateFee?: number;
          sending?: boolean;
          autoAdjust?: boolean;
          psbtHex?: string;
          feeRate?: number;
          toDomain?: string;
          enableRBF?: boolean;
        };
      }
    ) {
      const { payload } = action;
      state.bitcoinTx = Object.assign({}, state.bitcoinTx, payload);
    },
    updateDoginalsTx(
      state,
      action: {
        payload: {
          fromAddress?: string;
          toAddress?: string;
          inscription?: Inscription;
          changeSatoshis?: number;
          rawtx?: string;
          txid?: string;
          fee?: number;
          estimateFee?: number;
          sending?: boolean;
          psbtHex?: string;
          feeRate?: number;
          toDomain?: string;
          outputValue?: number;
          enableRBF?: boolean;
        };
      }
    ) {
      const { payload } = action;
      state.doginalsTx = Object.assign({}, state.doginalsTx, payload);
    },

    updateDunesTx(
      state,
      action: {
        payload: {
          fromAddress?: string;
          toAddress?: string;
          changeSatoshis?: number;
          rawtx?: string;
          txid?: string;
          fee?: number;
          estimateFee?: number;
          sending?: boolean;
          psbtHex?: string;
          feeRate?: number;
          toDomain?: string;
          outputValue?: number;
          enableRBF?: boolean;
          runeid?: string;
          runeAmount?: string;
        };
      }
    ) {
      const { payload } = action;
      state.dunesTx = Object.assign({}, state.dunesTx, payload);
    },
    setUtxos(state, action: { payload: UnspentOutput[] }) {
      state.utxos = action.payload;
    },
    setSpendUnavailableUtxos(state, action: { payload: UnspentOutput[] }) {
      state.spendUnavailableUtxos = action.payload;
    },

    setAssetUtxosInscriptions(state, action: { payload: UnspentOutput[] }) {
      state.assetUtxos_inscriptions = action.payload;
    },
    setAssetUtxosDunes(state, action: { payload: UnspentOutput[] }) {
      state.assetUtxos_dunes = action.payload;
    },
    reset(state) {
      return initialState;
    }
  },

  extraReducers: (builder) => {
    builder.addCase(updateVersion, (state) => {
      if (!state.assetUtxos_inscriptions) {
        state.assetUtxos_inscriptions = [];
      }

      if (!state.spendUnavailableUtxos) {
        state.spendUnavailableUtxos = [];
      }

      if (!state.assetUtxos_dunes) {
        state.assetUtxos_dunes = [];
      }
    });
  }
});

export const transactionsActions = slice.actions;
export default slice.reducer;
