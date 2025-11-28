import { useCallback, useMemo } from 'react';

import { RawTxInfo, ToAddressInfo } from '@/shared/types';
import { useTools } from '@/ui/components/ActionComponent';
import { useI18n } from '@/ui/hooks/useI18n';
import { usePEPUnit } from '@/ui/state/settings/hooks';
import { satoshisToPEP, sleep, useWallet } from '@/ui/utils';
import { UnspentOutput } from '@unisat/tx-helpers/types';

import { AppState } from '..';
import { useAccountAddress, useCurrentAccount } from '../accounts/hooks';
import { accountActions } from '../accounts/reducer';
import { useAppDispatch, useAppSelector } from '../hooks';
import { transactionsActions } from './reducer';

export function useTransactionsState(): AppState['transactions'] {
  return useAppSelector((state) => state.transactions);
}

export function useBitcoinTx() {
  const transactionsState = useTransactionsState();
  return transactionsState.bitcoinTx;
}

export function usePrepareSendPEPCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const fromAddress = useAccountAddress();
  const utxos = useUtxos();
  const fetchUtxos = useFetchUtxosCallback();
  const account = useCurrentAccount();
  const btcUnit = usePEPUnit();
  const { t } = useI18n();
  return useCallback(
    async ({
      toAddressInfo,
      toAmount,
      feeRate,
      enableRBF,
      memo,
      memos,
      disableAutoAdjust
    }: {
      toAddressInfo: ToAddressInfo;
      toAmount: number;
      feeRate?: number;
      enableRBF: boolean;
      memo?: string;
      memos?: string[];
      disableAutoAdjust?: boolean;
    }) => {
      let _utxos: UnspentOutput[] = utxos;
      if (_utxos.length === 0) {
        _utxos = await fetchUtxos();
      }
      const safeBalance = _utxos.filter((v) => v.inscriptions.length == 0).reduce((pre, cur) => pre + cur.satoshis, 0);
      if (safeBalance < toAmount) {
        throw new Error(t('insufficient_balance'));
      }

      if (!feeRate) {
        const summary = await wallet.getFeeSummary();
        feeRate = summary.list[1].feeRate;
      }
      let res: {
        psbtHex: string;
        rawtx: string;
        fee: number;
      };

      if (safeBalance === toAmount && !disableAutoAdjust) {
        res = await wallet.sendAllPEP({
          to: toAddressInfo.address,
          btcUtxos: _utxos,
          enableRBF,
          feeRate
        });
      } else {
        res = await wallet.sendPEP({
          to: toAddressInfo.address,
          amount: toAmount,
          btcUtxos: _utxos,
          enableRBF,
          feeRate,
          memo,
          memos
        });
      }

      dispatch(
        transactionsActions.updateBitcoinTx({
          rawtx: res.rawtx,
          psbtHex: res.psbtHex,
          fromAddress,
          feeRate,
          enableRBF
        })
      );
      const rawTxInfo: RawTxInfo = {
        psbtHex: res.psbtHex,
        rawtx: res.rawtx,
        toAddressInfo,
        fee: res.fee
      };
      return rawTxInfo;
    },
    [dispatch, wallet, fromAddress, utxos, fetchUtxos]
  );
}

export function usePrepareSendBypassHeadOffsetsCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const fromAddress = useAccountAddress();
  const account = useCurrentAccount();
  const btcUnit = usePEPUnit();
  return useCallback(
    async ({
      toAddressInfo,
      toAmount,
      feeRate
    }: {
      toAddressInfo: ToAddressInfo;
      toAmount: number;
      feeRate: number;
    }) => {
      const res = await wallet.sendCoinBypassHeadOffsets(
        [
          {
            address: toAddressInfo.address,
            satoshis: toAmount
          }
        ],
        feeRate
      );

      dispatch(
        transactionsActions.updateBitcoinTx({
          rawtx: res.rawtx,
          psbtHex: res.psbtHex,
          fromAddress,
          feeRate
        })
      );
      const rawTxInfo: RawTxInfo = {
        psbtHex: res.psbtHex,
        rawtx: res.rawtx,
        toAddressInfo,
        fee: res.fee
      };
      return rawTxInfo;
    },
    [dispatch, wallet, fromAddress]
  );
}

export function usePushBitcoinTxCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const tools = useTools();
  return useCallback(
    async (rawtx: string) => {
      const ret = {
        success: false,
        txid: '',
        error: ''
      };
      try {
        tools.showLoading(true);
        const txid = await wallet.pushTx(rawtx);
        await sleep(3); // Wait for transaction synchronization
        tools.showLoading(false);
        dispatch(transactionsActions.updateBitcoinTx({ txid }));
        dispatch(accountActions.expireBalance());
        setTimeout(() => {
          dispatch(accountActions.expireBalance());
        }, 2000);
        setTimeout(() => {
          dispatch(accountActions.expireBalance());
        }, 5000);

        ret.success = true;
        ret.txid = txid;
      } catch (e) {
        ret.error = (e as Error).message;
        tools.showLoading(false);
      }

      return ret;
    },
    [dispatch, wallet]
  );
}

export function useDoginalsTx() {
  const transactionsState = useTransactionsState();
  return transactionsState.doginalsTx;
}

export function usePrepareSendDoginalsInscriptionCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const fromAddress = useAccountAddress();
  const utxos = useUtxos();
  const fetchUtxos = useFetchUtxosCallback();
  const account = useCurrentAccount();
  return useCallback(
    async ({
      toAddressInfo,
      inscriptionId,
      feeRate,
      outputValue,
      enableRBF
    }: {
      toAddressInfo: ToAddressInfo;
      inscriptionId: string;
      feeRate?: number;
      outputValue?: number;
      enableRBF: boolean;
    }) => {
      if (!feeRate) {
        const summary = await wallet.getFeeSummary();
        feeRate = summary.list[1].feeRate;
      }

      let btcUtxos = utxos;
      if (btcUtxos.length === 0) {
        btcUtxos = await fetchUtxos();
      }

      const res = await wallet.sendDoginalsInscription({
        to: toAddressInfo.address,
        inscriptionId,
        feeRate,
        outputValue,
        enableRBF,
        btcUtxos
      });
      dispatch(
        transactionsActions.updateDoginalsTx({
          rawtx: res.rawtx,
          psbtHex: res.psbtHex,
          fromAddress,
          // inscription,
          feeRate,
          outputValue,
          enableRBF
        })
      );
      const rawTxInfo: RawTxInfo = {
        psbtHex: res.psbtHex,
        rawtx: res.rawtx,
        toAddressInfo
      };
      return rawTxInfo;
    },
    [dispatch, wallet, fromAddress, utxos]
  );
}

export function usePrepareSendDoginalsInscriptionsCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const fromAddress = useAccountAddress();
  const fetchUtxos = useFetchUtxosCallback();
  const utxos = useUtxos();
  const account = useCurrentAccount();
  return useCallback(
    async ({
      toAddressInfo,
      inscriptionIds,
      feeRate,
      enableRBF
    }: {
      toAddressInfo: ToAddressInfo;
      inscriptionIds: string[];
      feeRate?: number;
      enableRBF: boolean;
    }) => {
      if (!feeRate) {
        const summary = await wallet.getFeeSummary();
        feeRate = summary.list[1].feeRate;
      }

      let btcUtxos = utxos;
      if (btcUtxos.length === 0) {
        btcUtxos = await fetchUtxos();
      }
      const res = await wallet.sendDoginalsInscriptions({
        to: toAddressInfo.address,
        inscriptionIds,
        feeRate,
        enableRBF,
        btcUtxos
      });
      dispatch(
        transactionsActions.updateDoginalsTx({
          rawtx: res.rawtx,
          psbtHex: res.psbtHex,
          fromAddress,
          feeRate,
          enableRBF
        })
      );
      const rawTxInfo: RawTxInfo = {
        psbtHex: res.psbtHex,
        rawtx: res.rawtx,
        toAddressInfo
      };
      return rawTxInfo;
    },
    [dispatch, wallet, fromAddress, utxos]
  );
}

export function useCreateSplitTxCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const fromAddress = useAccountAddress();
  const utxos = useUtxos();
  const fetchUtxos = useFetchUtxosCallback();
  const account = useCurrentAccount();
  return useCallback(
    async ({
      inscriptionId,
      feeRate,
      outputValue,
      enableRBF
    }: {
      inscriptionId: string;
      feeRate: number;
      outputValue: number;
      enableRBF: boolean;
    }) => {
      let btcUtxos = utxos;
      if (btcUtxos.length === 0) {
        btcUtxos = await fetchUtxos();
      }

      const res = await wallet.splitDoginalsInscription({
        inscriptionId,
        feeRate,
        outputValue,
        enableRBF,
        btcUtxos
      });
      dispatch(
        transactionsActions.updateDoginalsTx({
          rawtx: res.rawtx,
          psbtHex: res.psbtHex,
          fromAddress,
          // inscription,
          enableRBF,
          feeRate,
          outputValue
        })
      );
      const rawTxInfo: RawTxInfo = {
        psbtHex: res.psbtHex,
        rawtx: res.rawtx,
        toAddressInfo: {
          address: fromAddress
        }
      };
      return { rawTxInfo, splitedCount: res.splitedCount };
    },
    [dispatch, wallet, fromAddress, utxos]
  );
}

export function usePushDoginalsTxCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const tools = useTools();
  return useCallback(
    async (rawtx: string) => {
      const ret = {
        success: false,
        txid: '',
        error: ''
      };
      try {
        tools.showLoading(true);
        const txid = await wallet.pushTx(rawtx);
        await sleep(3); // Wait for transaction synchronization
        tools.showLoading(false);
        dispatch(transactionsActions.updateDoginalsTx({ txid }));

        dispatch(accountActions.expireBalance());
        setTimeout(() => {
          dispatch(accountActions.expireBalance());
        }, 2000);
        setTimeout(() => {
          dispatch(accountActions.expireBalance());
        }, 5000);

        ret.success = true;
        ret.txid = txid;
      } catch (e) {
        console.log(e);
        ret.error = (e as Error).message;
        tools.showLoading(false);
      }

      return ret;
    },
    [dispatch, wallet]
  );
}

export function useUtxos() {
  const transactionsState = useTransactionsState();
  return transactionsState.utxos;
}

export function useFetchUtxosCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const account = useCurrentAccount();
  return useCallback(async () => {
    const data = await wallet.getPEPUtxos();
    dispatch(transactionsActions.setUtxos(data));
    return data;
  }, [wallet, account]);
}

export function useSpendUnavailableUtxos() {
  const transactionsState = useTransactionsState();
  return transactionsState.spendUnavailableUtxos;
}

export function useSetSpendUnavailableUtxosCallback() {
  const dispatch = useAppDispatch();
  return useCallback(
    (utxos: UnspentOutput[]) => {
      dispatch(transactionsActions.setSpendUnavailableUtxos(utxos));
    },
    [dispatch]
  );
}

export function useSafeBalance() {
  const utxos = useUtxos();
  return useMemo(() => {
    const satoshis = utxos.filter((v) => v.inscriptions.length === 0).reduce((pre, cur) => pre + cur.satoshis, 0);
    return satoshisToPEP(satoshis);
  }, [utxos]);
}

export function useAssetUtxosDunes() {
  const transactionsState = useTransactionsState();
  return transactionsState.assetUtxos_dunes;
}

export function useFetchAssetUtxosDunesCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const account = useCurrentAccount();
  return useCallback(
    async (dune: string) => {
      const data = await wallet.getAssetUtxosDunes(dune);
      dispatch(transactionsActions.setAssetUtxosDunes(data));
      return data;
    },
    [wallet, account]
  );
}

export function usePrepareSendDunesCallback() {
  const dispatch = useAppDispatch();
  const wallet = useWallet();
  const fromAddress = useAccountAddress();
  const utxos = useUtxos();
  const fetchUtxos = useFetchUtxosCallback();
  const assetUtxosDunes = useAssetUtxosDunes();
  const fetchAssetUtxosDunes = useFetchAssetUtxosDunesCallback();
  const account = useCurrentAccount();
  return useCallback(
    async ({
      toAddressInfo,
      runeid,
      runeAmount,
      outputValue,
      feeRate,
      enableRBF
    }: {
      toAddressInfo: ToAddressInfo;
      runeid: string;
      runeAmount: string;
      outputValue?: number;
      feeRate: number;
      enableRBF: boolean;
    }) => {
      if (!feeRate) {
        const summary = await wallet.getFeeSummary();
        feeRate = summary.list[1].feeRate;
      }

      let btcUtxos = utxos;
      if (btcUtxos.length === 0) {
        btcUtxos = await fetchUtxos();
      }

      let assetUtxos = assetUtxosDunes;
      if (assetUtxos.length == 0) {
        assetUtxos = await fetchAssetUtxosDunes(duneid);
      }

      const res = await wallet.sendDunes({
        to: toAddressInfo.address,
        runeid,
        runeAmount,
        outputValue,
        feeRate,
        enableRBF,
        btcUtxos,
        assetUtxos
      });

      dispatch(
        transactionsActions.updateDunesTx({
          rawtx: res.rawtx,
          psbtHex: res.psbtHex,
          fromAddress,
          feeRate,
          enableRBF,
          runeid,
          runeAmount,
          outputValue
        })
      );
      const rawTxInfo: RawTxInfo = {
        psbtHex: res.psbtHex,
        rawtx: res.rawtx,
        toAddressInfo
      };
      return rawTxInfo;
    },
    [dispatch, wallet, fromAddress, utxos, assetUtxosDunes, fetchAssetUtxosDunes, account]
  );
}

export function useDunesTx() {
  const transactionsState = useTransactionsState();
  return transactionsState.dunesTx;
}

export function usePrepareSendCharmsCallback() {
  const wallet = useWallet();
  const account = useCurrentAccount();
  const callback = useCallback(
    async (toAddressInfo: ToAddressInfo, charmsid: string, amount: string, feeRate: number, enableRBF = false) => {
      return await wallet.sendCharms({
        to: toAddressInfo.address,
        charmsid,
        amount,
        feeRate,
        enableRBF
      });
    },
    [wallet, account]
  );
  return callback;
}


