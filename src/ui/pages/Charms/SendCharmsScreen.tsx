import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { dunesUtils } from '@/shared/lib/dunes-utils';
import { CharmsBalance, CharmsInfo, Inscription, TxType, UserToSignInput } from '@/shared/types';
import { Button, Column, Content, Header, Input, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { FeeRateBar } from '@/ui/components/FeeRateBar';
import { TickUsdWithoutPrice, TokenType } from '@/ui/components/TickUsd';
import { useI18n } from '@/ui/hooks/useI18n';
import { useNavigate } from '@/ui/pages/MainRoute';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { usePushBitcoinTxCallback } from '@/ui/state/transactions/hooks';
import { colors } from '@/ui/theme/colors';
import { isValidAddress, showLongNumber, useWallet } from '@/ui/utils';

import { SignPsbt } from '../Approval/components';

enum Step {
  CREATE_TX = 0,
  SIGN_TX = 1
}

export default function SendCharmsScreen() {
  const { state } = useLocation();
  const props = state as {
    tokenBalance: CharmsBalance;
    tokenInfo: CharmsInfo;
  };
  const { t } = useI18n();

  const tokenBalance = props.tokenBalance;

  const tokenInfo = props.tokenInfo;

  const navigate = useNavigate();
  const [inputAmount, setInputAmount] = useState('');
  const [disabled, setDisabled] = useState(true);
  const [toInfo, setToInfo] = useState<{
    address: string;
    domain: string;
    inscription?: Inscription;
  }>({
    address: '',
    domain: '',
    inscription: undefined
  });

  const [availableBalance, setAvailableBalance] = useState(tokenBalance.amount);
  const [error, setError] = useState('');

  const currentAccount = useCurrentAccount();

  const tools = useTools();

  const [feeRate, setFeeRate] = useState(5);

  useEffect(() => {
    const run = async () => {
      const tokenSummary = await wallet.getAddressCharmsTokenSummary(
        currentAccount.address,
        tokenBalance.charmsid,
        true
      );
      setAvailableBalance(tokenSummary.tokenBalance.available);
    };

    run();
  }, []);

  useEffect(() => {
    setError('');
    setDisabled(true);

    if (!isValidAddress(toInfo.address)) {
      return;
    }
    if (!inputAmount) {
      return;
    }

    if (feeRate <= 0) {
      return;
    }

    const sendingAmount = dunesUtils.fromDecimalAmount(inputAmount, tokenBalance.divisibility);

    if (sendingAmount === '0') {
      return;
    }

    if (dunesUtils.compareAmount(sendingAmount, availableBalance) > 0) {
      setError(t('send_amount_exceeds_balance'));
      return;
    }

    setDisabled(false);
  }, [toInfo, inputAmount, availableBalance, feeRate]);

  const transferData = useRef<{
    id: string;
    commitTx: string;
    commitToSignInputs: UserToSignInput[];
  }>({
    id: '',
    commitTx: '',
    commitToSignInputs: []
  });

  const [step, setStep] = useState(Step.CREATE_TX);

  const wallet = useWallet();

  const pushBitcoinTx = usePushBitcoinTxCallback();

  const onConfirm = async () => {
    tools.showLoading(true);
    try {
      const step1 = await wallet.createCharmsSendTx({
        userAddress: currentAccount.address,
        userPubkey: currentAccount.pubkey,
        receiver: toInfo.address,
        charmsid: tokenBalance.charmsid,
        amount: dunesUtils.fromDecimalAmount(inputAmount, tokenBalance.divisibility),
        feeRate
      });
      if (step1) {
        transferData.current.commitTx = step1.psbtHex;
        transferData.current.commitToSignInputs = step1.toSignInputs;
        setStep(1);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      tools.showLoading(false);
    }
  };

  if (step == Step.SIGN_TX) {
    return (
      <SignPsbt
        header={
          <Header
            onBack={() => {
              setStep(0);
            }}
          />
        }
        params={{
          data: {
            psbtHex: transferData.current.commitTx,
            type: TxType.SIGN_TX,
            options: { autoFinalized: true, toSignInputs: transferData.current.commitToSignInputs }
          }
        }}
        handleCancel={() => {
          setStep(0);
        }}
        handleConfirm={async (res) => {
          tools.showLoading(true);
          try {
            if (res && res.psbtHex) {
              const { success, txid, error } = await pushBitcoinTx(res.psbtHex);
              if (success) {
                navigate('TxSuccessScreen', { txid });
              } else {
                throw new Error(error);
              }
              return;
            }

            const toSignInputs = await wallet.formatOptionsToSignInputs(transferData.current.commitTx, {
              autoFinalized: true,
              toSignInputs: transferData.current.commitToSignInputs
            });
            const result = await wallet.signCharmsSendTx({
              commitTx: transferData.current.commitTx,
              toSignInputs
            });
            navigate('TxSuccessScreen', { txid: result.txid });
          } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            navigate('TxFailScreen', { error: errorMsg });
          } finally {
            tools.showLoading(false);
          }
        }}
      />
    );
  }

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('send_Charms')}
      />
      <Content>
        <Row justifyCenter>
          <Text
            text={`${showLongNumber(dunesUtils.toDecimalAmount(tokenBalance.amount, tokenBalance.divisibility))} ${
              tokenInfo.symbol
            }`}
            preset="bold"
            textCenter
            size="xxl"
            wrap
          />
        </Row>
        <Row justifyCenter fullX style={{ marginTop: -12, marginBottom: -12 }}>
          <TickUsdWithoutPrice
            tick={tokenBalance.charmsid}
            balance={dunesUtils.toDecimalAmount(tokenBalance.amount, tokenBalance.divisibility)}
            type={TokenType.Charms}
            size={'md'}
          />
        </Row>

        <Column mt="lg">
          <Input
            preset="address"
            addressInputData={toInfo}
            onAddressInputChange={(val) => {
              setToInfo(val);
            }}
            recipientLabel={<Text text={t('recipient')} preset="regular" color="textDim" />}
            autoFocus={true}
          />
        </Column>

        <Column mt="lg">
          <Row justifyBetween>
            <Text text={t('balance')} color="textDim" />
            <TickUsdWithoutPrice tick={tokenBalance.name} balance={inputAmount} type={TokenType.DUNES} />
            <Row
              itemsCenter
              onClick={() => {
                setInputAmount(dunesUtils.toDecimalAmount(availableBalance, tokenBalance.divisibility));
              }}
            >
              <Text text={t('max')} preset="sub" style={{ color: colors.white_muted }} />
              <Text
                text={`${showLongNumber(dunesUtils.toDecimalAmount(availableBalance, tokenBalance.divisibility))} ${
                  tokenInfo.symbol
                }`}
                preset="bold"
                size="sm"
                wrap
              />
            </Row>
          </Row>
          <Input
            preset="amount"
            placeholder={t('amount')}
            value={inputAmount.toString()}
            onAmountInputChange={(amount) => {
              setInputAmount(amount);
            }}
            dunesDecimal={tokenBalance.divisibility}
          />
        </Column>

        <Column mt="lg">
          <Text text={t('fee')} color="textDim" />

          <FeeRateBar
            onChange={(val) => {
              setFeeRate(val);
            }}
          />
        </Column>

        {error && <Text text={error} color="error" />}

        <Button
          disabled={disabled}
          preset="primary"
          text={t('next')}
          onClick={(e) => {
            onConfirm();
          }}
        ></Button>
      </Content>
    </Layout>
  );
}
