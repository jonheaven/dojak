import { BigNumber } from 'bignumber.js';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { dunesUtils } from '@/shared/lib/dunes-utils';
import { DuneInfo, RawTxInfo } from '@/shared/types';
import { Button, Column, Content, Header, Input, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { DRC20Ticker } from '@/ui/components/DRC20Ticker';
import { FeeRateBar } from '@/ui/components/FeeRateBar';
import { TickUsdWithoutPrice, TokenType } from '@/ui/components/TickUsd';
import { useI18n } from '@/ui/hooks/useI18n';
import { useNavigate } from '@/ui/pages/MainRoute';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useFetchUtxosCallback } from '@/ui/state/transactions/hooks';
import { colors } from '@/ui/theme/colors';
import { showLongNumber, useWallet } from '@/ui/utils';

export default function MintDunesScreen() {
  const { state } = useLocation();
  const props = state as {
    duneInfo: DuneInfo;
  };
  const { t } = useI18n();

  const duneInfo = props.duneInfo;

  const navigate = useNavigate();
  const wallet = useWallet();
  const tools = useTools();
  const currentAccount = useCurrentAccount();

  const [numMints, setNumMints] = useState('1');
  const [disabled, setDisabled] = useState(true);
  const [error, setError] = useState('');
  const [feeRate, setFeeRate] = useState(5);
  const [rawTxInfo, setRawTxInfo] = useState<RawTxInfo>();

  const fetchUtxos = useFetchUtxosCallback();

  // Calculate mint values
  const mintAmount = useMemo(() => {
    if (!duneInfo.terms || !numMints) return '0';
    const mints = new BigNumber(numMints);
    const perMint = new BigNumber(duneInfo.terms.amount);
    return mints.times(perMint).toString();
  }, [numMints, duneInfo.terms]);

  const mintAmountDecimal = useMemo(() => {
    return dunesUtils.toDecimalAmount(mintAmount, duneInfo.divisibility);
  }, [mintAmount, duneInfo.divisibility]);

  // Calculate max mints based on remaining and cap
  const maxMints = useMemo(() => {
    if (!duneInfo.terms) return 0;
    
    const remaining = new BigNumber(duneInfo.remaining);
    const perMint = new BigNumber(duneInfo.terms.amount);
    
    if (remaining.isZero() || perMint.isZero()) return 0;
    
    // Maximum number of mints based on remaining supply
    const maxFromRemaining = remaining.dividedBy(perMint).integerValue(BigNumber.ROUND_DOWN);
    
    // Could add additional constraints here (e.g., max per transaction)
    // For now, limit to 100 mints per transaction as a safety measure
    return Math.min(maxFromRemaining.toNumber(), 100);
  }, [duneInfo.remaining, duneInfo.terms]);

  useEffect(() => {
    fetchUtxos();
  }, []);

  useEffect(() => {
    setError('');
    setDisabled(true);

    if (!numMints || numMints === '0') {
      return;
    }

    const mints = parseInt(numMints);
    if (isNaN(mints) || mints < 1) {
      setError(t('invalid_mint_count'));
      return;
    }

    if (mints > maxMints) {
      setError(`${t('max_mints_available')}: ${maxMints}`);
      return;
    }

    if (feeRate <= 0) {
      return;
    }

    // TODO: Implement prepareMintDunes in wallet controller
    // For now, we'll navigate with the intent and let the confirmation screen handle it
    setDisabled(false);

    // prepareMintDunes({
    //   duneid: duneInfo.duneid,
    //   numMints: mints,
    //   feeRate
    // })
    //   .then((data) => {
    //     setRawTxInfo(data);
    //     setDisabled(false);
    //   })
    //   .catch((e) => {
    //     console.log(e);
    //     setError(e.message);
    //   });
  }, [numMints, feeRate, maxMints]);

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('mint_dunes')}
      />
      <Content>
        <Column justifyCenter itemsCenter gap="lg">
          <Row justifyCenter itemsCenter>
            <DRC20Ticker tick={duneInfo.spacedDune} preset="lg" showOrigin color={'ticker_color2'} />
          </Row>

          <Column itemsCenter gap="zero">
            <Text text={t('mint_amount')} color="textDim" size="sm" />
            <Text
              text={`${showLongNumber(mintAmountDecimal)} ${duneInfo.symbol}`}
              preset="bold"
              textCenter
              size="xxl"
              wrap
              digital
            />
          </Column>

          <Row justifyCenter fullX>
            <TickUsdWithoutPrice
              tick={duneInfo.spacedDune}
              balance={mintAmountDecimal}
              type={TokenType.DUNES}
              size={'md'}
            />
          </Row>
        </Column>

        <Column
          mt="lg"
          gap="md"
          px="md"
          py="md"
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 15
          }}
        >
          <Row justifyBetween>
            <Text text={t('mint_amount')} color="textDim" size="xs" />
            <Text
              text={`${showLongNumber(
                dunesUtils.toDecimalAmount(duneInfo.terms?.amount || '0', duneInfo.divisibility)
              )} ${duneInfo.symbol}`}
              preset="bold"
              size="sm"
            />
          </Row>

          <Row justifyBetween>
            <Text text={t('remaining_mints')} color="textDim" size="xs" />
            <Text
              text={showLongNumber(
                dunesUtils.toDecimalAmount(duneInfo.remaining, duneInfo.divisibility)
              )}
              preset="bold"
              size="sm"
              digital
            />
          </Row>

          {duneInfo.terms && duneInfo.terms.cap !== '0' && (
            <Row justifyBetween>
              <Text text={t('mint_cap')} color="textDim" size="xs" />
              <Text text={showLongNumber(duneInfo.terms.cap)} preset="bold" size="sm" digital />
            </Row>
          )}

          {duneInfo.terms && (duneInfo.terms.heightStart > 0 || duneInfo.terms.heightEnd > 0) && (
            <Row justifyBetween>
              <Text text={t('mint_height_range')} color="textDim" size="xs" />
              <Text
                text={`${duneInfo.terms.heightStart || 0} - ${duneInfo.terms.heightEnd || '∞'}`}
                preset="bold"
                size="sm"
              />
            </Row>
          )}
        </Column>

        <Column mt="lg">
          <Row justifyBetween>
            <Text text={t('number_of_mints')} color="textDim" />
            <Row
              itemsCenter
              onClick={() => {
                setNumMints(maxMints.toString());
              }}
              style={{ cursor: 'pointer' }}
            >
              <Text text={t('max')} preset="sub" style={{ color: colors.white_muted }} />
              <Text text={`${maxMints}`} preset="bold" size="sm" />
            </Row>
          </Row>
          <Input
            preset="amount"
            placeholder={t('number_of_mints')}
            value={numMints}
            onAmountInputChange={(amount) => {
              // Only allow whole numbers for number of mints
              const value = amount.replace(/[^0-9]/g, '');
              setNumMints(value);
            }}
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

        {error && <Text text={error} color="error" mt="lg" />}

        <Column mt="lg">
          <Button
            disabled={disabled}
            preset="primary"
            text={t('next')}
            onClick={(e) => {
              // TODO: Once prepareMintDunes is implemented, use rawTxInfo
              // For now, open external minting interface
              const dojakWebsite = 'https://dojak.dog'; // Could use usedojakWebsite() hook
              window.open(`${dojakWebsite}/dunes/inscribe?tab=mint&dune=${duneInfo.dune}&count=${numMints}`);
              
              // Future implementation when wallet minting is ready:
              // navigate('TxConfirmScreen', { rawTxInfo });
            }}
          />
        </Column>

        <Row justifyCenter mt="md">
          <Text 
            text={t('mint_will_open_external')} 
            color="textDim" 
            size="xs" 
            textCenter 
          />
        </Row>
      </Content>
    </Layout>
  );
}
