import { useEffect, useMemo, useState } from 'react';

import { dunesUtils } from '@dojak/core/lib/dunes-utils';
import { AddressCharmsTokenSummary } from '@dojak/core/types';
import { Button, Column, Content, Footer, Header, Icon, Image, Layout, Row, Text } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import { DRC20Ticker } from '@dojak/ui/components/DRC20Ticker';
import { Line } from '@dojak/ui/components/Line';
import { Section } from '@dojak/ui/components/Section';
import { TickUsdWithoutPrice, TokenType } from '@dojak/ui/components/TickUsd';
import { WarningPopover } from '@dojak/ui/components/WarningPopover';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useCurrentAccount } from '@dojak/ui/state/accounts/hooks';
import { colors } from '@dojak/ui/theme/colors';
import { fontSizes } from '@dojak/ui/theme/font';
import { showLongNumber, useLocationState, useWallet } from '@dojak/ui/utils';
import { LoadingOutlined } from '@ant-design/icons';

import { useNavigate } from '../MainRoute';

interface LocationState {
  charmsid: string;
}

export default function CharmsTokenScreen() {
  const { charmsid } = useLocationState<LocationState>();
  const [tokenSummary, setTokenSummary] = useState<AddressCharmsTokenSummary>({
    tokenBalance: {
      charmsid: '',
      name: '',
      amount: '',
      symbol: '',
      divisibility: 0,
      available: ''
    },
    tokenInfo: {
      charmsid: '',
      name: '',
      symbol: '',
      totalSupply: '10000000000000',
      maxSupply: '10000000000000',
      cap: 0,
      mintable: false,
      perMint: '0',
      minted: 0,
      holders: 0,
      aligned: true,
      nftData: {
        collectionId: ''
      },
      logo: ''
    },
    tradeUrl: '',
    mintUrl: ''
  });

  const wallet = useWallet();

  const account = useCurrentAccount();

  const [loading, setLoading] = useState(true);

  const [warning, setWarning] = useState(false);

  const { t } = useI18n();

  useEffect(() => {
    wallet.getAddressCharmsTokenSummary(account.address, charmsid, false).then((tokenSummary) => {
      setTokenSummary(tokenSummary);
      setLoading(false);
    });
  }, []);

  const navigate = useNavigate();

  const enableMint = useMemo(() => {
    return tokenSummary.mintUrl && tokenSummary.mintUrl.trim() !== '';
  }, [tokenSummary.mintUrl]);

  const enableTransfer = useMemo(() => {
    let enable = false;
    if (tokenSummary.tokenBalance.amount !== '0') {
      enable = true;
    }
    return enable;
  }, [tokenSummary]);

  const tools = useTools();

  const enableTrade = useMemo(() => {
    return tokenSummary.tradeUrl && tokenSummary.tradeUrl.trim() !== '';
  }, [tokenSummary.tradeUrl]);

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

  const sendCharms = () => {
    if (tokenSummary.tokenInfo?.aligned === false) {
      // tools.toastError(t('important_to_not_transfer_this_token'));
      setWarning(true);
      return;
    }
    navigate('SendCharmsScreen', {
      tokenBalance: tokenSummary.tokenBalance,
      tokenInfo: tokenSummary.tokenInfo
    });
  };

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
            <Image src={tokenSummary.tokenInfo.logo} size={48} style={{ borderRadius: 24 }} />

            <Row justifyCenter itemsCenter>
              <DRC20Ticker tick={tokenSummary.tokenInfo.name} preset="md" showOrigin color={'ticker_color2'} />
            </Row>
            <Column itemsCenter fullX justifyCenter>
              <Text
                text={`${dunesUtils.toDecimalAmount(
                  tokenSummary.tokenBalance.amount,
                  tokenSummary.tokenBalance.divisibility
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
                tick={tokenSummary.tokenInfo.charmsid}
                balance={dunesUtils.toDecimalAmount(
                  tokenSummary.tokenBalance.amount,
                  tokenSummary.tokenBalance.divisibility
                )}
                type={TokenType.Charms}
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
            <Section title={'Charms ID'} value={tokenSummary.tokenBalance.charmsid} />
            <Line />

            <Section title={t('name_label')} value={tokenSummary.tokenBalance.name} />
            <Line />

            <Section title={t('symbol_Charms')} value={tokenSummary.tokenBalance.symbol} />
            <Line />

            <Section title={t('decimals_Charms')} value={tokenSummary.tokenBalance.divisibility} />
            <Line />

            <Section title={t('holders_Charms')} value={showLongNumber(tokenSummary.tokenInfo.holders)} />
            <Line />

            <Section
              title={t('total_supply')}
              value={`${
                tokenSummary.tokenInfo.totalSupply
                  ? showLongNumber(
                      dunesUtils.toDecimalAmount(
                        tokenSummary.tokenInfo.totalSupply.toString(),
                        tokenSummary.tokenBalance.divisibility
                      )
                    )
                  : '--'
              }/${
                tokenSummary.tokenInfo.maxSupply && tokenSummary.tokenInfo.maxSupply !== '0'
                  ? showLongNumber(
                      dunesUtils.toDecimalAmount(
                        tokenSummary.tokenInfo.maxSupply.toString(),
                        tokenSummary.tokenBalance.divisibility
                      )
                    )
                  : '--'
              }`}
              maxLength={100}
            />
            <Line />

            <Section
              title={t('minted_Charms')}
              value={`${showLongNumber(tokenSummary.tokenInfo.minted)}/${showLongNumber(tokenSummary.tokenInfo.cap)}`}
            />
            <Line />

            <Section
              title={t('per_mint')}
              value={
                tokenSummary.tokenInfo.perMint
                  ? `${showLongNumber(
                      dunesUtils.toDecimalAmount(tokenSummary.tokenInfo.perMint, tokenSummary.tokenBalance.divisibility)
                    )} `
                  : '--'
              }
            />

            <Line />
          </Column>

          {warning && (
            <WarningPopover
              risks={[
                {
                  desc: t('important_to_not_transfer_this_token')
                }
              ]}
              onClose={() => {
                setWarning(false);
              }}
            />
          )}
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
                if (tokenSummary.mintUrl) {
                  window.open(tokenSummary.mintUrl);
                }
              }}
              full
            />

            <Button
              text={t('send')}
              preset="drc20-action"
              icon="send"
              disabled={!enableTransfer}
              onClick={sendCharms}
              full
            />

            <Button
              text={t('trade')}
              preset="drc20-action"
              icon="trade"
              disabled={!enableTrade}
              onClick={(e) => {
                if (tokenSummary.tradeUrl) {
                  window.open(tokenSummary.tradeUrl);
                }
              }}
              full
            />
          </Row>
        </Column>
      </Footer>
    </Layout>
  );
}
