import { useEffect, useMemo, useState } from 'react';

import { ChainType } from '@/shared/constant';
import { dunesUtils } from '@/shared/lib/dunes-utils';
import { AddressDunesTokenSummary } from '@/shared/types';
import { Button, Column, Content, Footer, Header, Icon, Image, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { DRC20Ticker } from '@/ui/components/DRC20Ticker';
import { Line } from '@/ui/components/Line';
import { Section } from '@/ui/components/Section';
import { TickUsdWithoutPrice, TokenType } from '@/ui/components/TickUsd';
import { useI18n } from '@/ui/hooks/useI18n';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import {
  useChainType,
  useDoginalsWebsite,
  useDunesMarketPlaceWebsite,
  useTxExplorerUrl,
  usedojakWebsite
} from '@/ui/state/settings/hooks';
import { colors } from '@/ui/theme/colors';
import { fontSizes } from '@/ui/theme/font';
import { showLongNumber, useLocationState, useWallet } from '@/ui/utils';
import { LoadingOutlined } from '@ant-design/icons';

import { useNavigate } from '../MainRoute';

interface LocationState {
  runeid: string;
}

export default function DunesTokenScreen() {
  const { runeid } = useLocationState<LocationState>();
  const [tokenSummary, setTokenSummary] = useState<AddressDunesTokenSummary>({
    duneBalance: {
      duneid: '',
      dune: '',
      spacedDune: '',
      amount: '',
      symbol: '',
      divisibility: 0
    },
    duneInfo: {
      dune: '',
      duneid: '',
      spacedDune: '',
      symbol: '',
      premine: '',
      mints: '',
      divisibility: 0,
      etching: '',
      terms: {
        amount: '',
        cap: '',
        heightStart: 0,
        heightEnd: 0,
        offsetStart: 0,
        offsetEnd: 0
      },
      number: 0,
      height: 0,
      txidx: 0,
      timestamp: 0,
      burned: '',
      holders: 0,
      transactions: 0,
      mintable: false,
      remaining: '',
      start: 0,
      end: 0,
      supply: '0',
      parent: ''
    }
  });

  const wallet = useWallet();

  const account = useCurrentAccount();

  const [loading, setLoading] = useState(true);

  const { t } = useI18n();

  useEffect(() => {
    wallet.getAddressDunesTokenSummary(account.address, runeid).then((tokenSummary) => {
      setTokenSummary(tokenSummary);
      setLoading(false);
    });
  }, []);

  const navigate = useNavigate();

  const dojakWebsite = usedojakWebsite();

  const enableMint = tokenSummary.duneInfo.mintable;

  const enableTransfer = useMemo(() => {
    let enable = false;
    if (tokenSummary.duneBalance.amount !== '0') {
      enable = true;
    }
    return enable;
  }, [tokenSummary]);

  const tools = useTools();

  const doginalsWebsite = useDoginalsWebsite();

  const txExplorerUrl = useTxExplorerUrl(tokenSummary.duneInfo.etching);

  const chainType = useChainType();
  const enableTrade = useMemo(() => {
    if (chainType === ChainType.BITCOIN_MAINNET) {
      return true;
    } else {
      return false;
    }
  }, [chainType]);
  const marketPlaceUrl = useDunesMarketPlaceWebsite(tokenSummary.duneInfo.spacedDune);

  if (loading) {
    return (
      <Layout>
        <Content itemsCenter justifyCenter>
          <Icon size={fontSizes.xxxl} color="gold">
            <LoadingOutlined />
          </Icon>
        </Content>
      </Layout>
    );
  }
  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
      />
      {tokenSummary && (
        <Content>
          <Column justifyCenter itemsCenter>
            <Image src={tokenSummary.duneInfo.logo} size={48} style={{ borderRadius: 24 }} />

            <Row justifyCenter itemsCenter>
              <DRC20Ticker tick={tokenSummary.duneInfo.spacedDune} preset="md" showOrigin color={'ticker_color2'} />
            </Row>
            <Column itemsCenter fullX justifyCenter>
              <Text
                text={`${dunesUtils.toDecimalAmount(
                  tokenSummary.duneBalance.amount,
                  tokenSummary.duneBalance.divisibility
                )} `}
                preset="bold"
                textCenter
                size="xxl"
                wrap
                digital
                color="white"
              />
            </Column>
            <Row justifyCenter fullX>
              <TickUsdWithoutPrice
                tick={tokenSummary.duneInfo.spacedDune}
                balance={dunesUtils.toDecimalAmount(
                  tokenSummary.duneBalance.amount,
                  tokenSummary.duneBalance.divisibility
                )}
                type={TokenType.DUNES}
                size={'md'}
              />
            </Row>
          </Column>

          <Column
            gap="lg"
            px="md"
            py="md"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 15
            }}
          >
            <Section title={t('duneid')} value={tokenSummary.duneInfo.duneid} />
            <Line />
            <Section title={t('mints')} value={showLongNumber(tokenSummary.duneInfo.mints)} />
            <Line />

            <Section
              title={t('current_supply')}
              value={`${showLongNumber(
                dunesUtils.toDecimalAmount(tokenSummary.duneInfo.supply, tokenSummary.duneInfo.divisibility)
              )} ${tokenSummary.duneInfo.symbol}`}
            />
            <Line />

            <Section
              title={t('premine')}
              value={`${showLongNumber(
                dunesUtils.toDecimalAmount(tokenSummary.duneInfo.premine, tokenSummary.duneInfo.divisibility)
              )} ${tokenSummary.duneInfo.symbol}`}
            />
            <Line />

            <Section
              title={t('burned')}
              value={`${showLongNumber(
                dunesUtils.toDecimalAmount(tokenSummary.duneInfo.burned, tokenSummary.duneInfo.divisibility)
              )} ${tokenSummary.duneInfo.symbol}`}
            />
            <Line />

            <Section title={t('divisibility')} value={tokenSummary.duneInfo.divisibility} />
            <Line />

            <Section title={t('symbol')} value={tokenSummary.duneInfo.symbol} />
            <Line />

            <Section title={t('holders')} value={showLongNumber(tokenSummary.duneInfo.holders)} />
            <Line />

            <Section title={t('transactions')} value={showLongNumber(tokenSummary.duneInfo.transactions)} />
            <Line />

            <Section title={t('etching')} value={tokenSummary.duneInfo.etching} link={txExplorerUrl} />
            {tokenSummary.duneInfo.parent ? <Line /> : null}

            {tokenSummary.duneInfo.parent ? (
              <Section
                title={t('parent')}
                value={tokenSummary.duneInfo.parent}
                link={`${doginalsWebsite}/inscription/${tokenSummary.duneInfo.parent}`}
              />
            ) : null}
          </Column>
        </Content>
      )}
      <Footer
        style={{
          borderTopWidth: 1,
          borderColor: colors.border2
        }}
      >
        <Column gap="sm" fullX>
          <Row gap="sm" mt="sm" mb="md">
            <Button
              text={t('mint')}
              preset="drc20-action"
              disabled={!enableMint}
              icon="pencil"
              onClick={(e) => {
                window.open(`${dojakWebsite}/dunes/inscribe?tab=mint&dune=${tokenSummary.duneInfo.dune}`);
              }}
              full
            />

            <Button
              text={t('send')}
              preset="drc20-action"
              icon="send"
              disabled={!enableTransfer}
              onClick={(e) => {
                navigate('SendDunesScreen', {
                  duneBalance: tokenSummary.duneBalance,
                  duneInfo: tokenSummary.duneInfo
                });
              }}
              full
            />

            {enableTrade ? (
              <Button
                text={t('trade')}
                preset="drc20-action"
                icon="trade"
                disabled={!enableTrade}
                onClick={(e) => {
                  window.open(marketPlaceUrl);
                }}
                full
              />
            ) : null}
          </Row>
        </Column>
      </Footer>
    </Layout>
  );
}
