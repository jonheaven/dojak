import { useCallback } from 'react';

import { TxType } from '@dojak/core/types';
import { KeyringType } from '@unisat/keyring-service/types';

export const usePsbtInitializer = (setTxInfo, setLoading, tools) => {
  const initializePsbt = useCallback(
    async ({
      type,
      psbtHex,
      options,
      sendDogeParams,
      sendInscriptionParams,
      sendDunesParams,
      sendCharmsParams,
      session,
      currentAccount,
      wallet,
      prepareSendDOGE,
      prepareSendDoginalsInscription,
      prepareSendDunes,
      prepareSendCharms
    }) => {
      let txError = '';
      let finalPsbtHex = psbtHex;

      // handle PSBT based on transaction type
      try {
        if (type === TxType.SIGN_TX) {
          if (psbtHex && currentAccount.type === KeyringType.KeystoneKeyring) {
            const toSignInputs = await wallet.formatOptionsToSignInputs(psbtHex, options);
            finalPsbtHex = await wallet.signPsbtWithHex(psbtHex, toSignInputs, false);
          }
        } else if (type === TxType.SEND_BITCOIN && sendDogeParams) {
          if (!psbtHex) {
            const rawTxInfo = await prepareSendDOGE({
              toAddressInfo: { address: sendDogeParams.toAddress, domain: '' },
              toAmount: sendDogeParams.koinu,
              feeRate: sendDogeParams.feeRate,
              enableRBF: false,
              memo: sendDogeParams.memo,
              memos: sendDogeParams.memos,
              disableAutoAdjust: true
            });
            finalPsbtHex = rawTxInfo.psbtHex;
          }
        } else if (type === TxType.SEND_doginals_INSCRIPTION && sendInscriptionParams) {
          if (!psbtHex) {
            const rawTxInfo = await prepareSendDoginalsInscription({
              toAddressInfo: { address: sendInscriptionParams.toAddress, domain: '' },
              inscriptionId: sendInscriptionParams.inscriptionId,
              feeRate: sendInscriptionParams.feeRate,
              enableRBF: false
            });
            finalPsbtHex = rawTxInfo.psbtHex;
          }
        } else if (type === TxType.SEND_DUNES && sendDunesParams) {
          if (!psbtHex) {
            const rawTxInfo = await prepareSendDunes({
              toAddressInfo: { address: sendDunesParams.toAddress, domain: '' },
              runeid: sendDunesParams.runeid,
              runeAmount: sendDunesParams.amount,
              feeRate: sendDunesParams.feeRate,
              enableRBF: false
            });
            finalPsbtHex = rawTxInfo.psbtHex;
          }
        } else if (type === TxType.SEND_Charms && sendCharmsParams) {
          if (!psbtHex) {
            const rawTxInfo = await prepareSendCharms({
              toAddressInfo: { address: sendCharmsParams.toAddress, domain: '' },
              charmsid: sendCharmsParams.charmsid,
              amount: sendCharmsParams.amount,
              feeRate: sendCharmsParams.feeRate,
              enableRBF: false
            });
            finalPsbtHex = rawTxInfo.psbtHex;
          }
        }
      } catch (e: any) {
        txError = e.message;
        tools.toastError(txError);
      }

      // return error status if no PSBT
      if (!finalPsbtHex) {
        setLoading(false);
        setTxInfo((prev) => ({ ...prev, txError }));
        return;
      }

      // continue processing decoded PSBT and preparing signature inputs
      try {
        const decodedPsbt = await wallet.decodePsbt(finalPsbtHex, session?.origin || '');

        let toSignInputs = [];
        if (
          [TxType.SEND_BITCOIN, TxType.SEND_doginals_INSCRIPTION, TxType.SEND_DUNES, TxType.SEND_Charms].includes(type)
        ) {
          toSignInputs = decodedPsbt.inputInfos.map((v, index) => ({
            index,
            publicKey: currentAccount.pubkey
          }));
        } else {
          toSignInputs = await wallet.formatOptionsToSignInputs(finalPsbtHex, options);
        }

        // handle contract information
        if (options && options.contracts) {
          try {
            const results = await wallet.decodeContracts(options?.contracts || [], {
              address: currentAccount.address,
              publicKey: currentAccount.pubkey
            });

            // update contract information to input and output with null checks
            decodedPsbt.inputInfos.forEach((v) => {
              if (!v) return;
              results.forEach((r) => {
                if (!r) return;
                if (v.address == r.address) v.contract = r;
              });
            });

            decodedPsbt.outputInfos.forEach((v) => {
              if (!v) return;
              results.forEach((r) => {
                if (!r) return;
                if (v.address == r.address) v.contract = r;
              });
            });
          } catch (e) {
            // ignore contract parsing error
          }
        }

        // update status
        setTxInfo({
          decodedPsbt,
          changedBalance: 0,
          changedInscriptions: [],
          psbtHex: finalPsbtHex,
          rawtx: '',
          toSignInputs,
          txError,
          contractResults: []
        });

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setTxInfo((prev) => ({ ...prev, txError: e.message }));
        tools.toastError(e.message);
      }
    },
    []
  );

  return { initializePsbt };
};
