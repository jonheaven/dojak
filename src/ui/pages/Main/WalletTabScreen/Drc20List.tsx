import { useEffect, useState } from 'react';

import { TickPriceItem, TokenBalance } from '@/shared/types';
import { Column, Row } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import DRC20BalanceCard from '@/ui/components/DRC20BalanceCard';
import { Empty } from '@/ui/components/Empty';
import { Pagination } from '@/ui/components/Pagination';
import { useI18n } from '@/ui/hooks/useI18n';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useChain } from '@/ui/state/settings/hooks';
import { useWallet } from '@/ui/utils';
import { LoadingOutlined } from '@ant-design/icons';

import { useNavigate } from '../../MainRoute';

export function DRC20List() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const currentAccount = useCurrentAccount();
  const chain = useChain();
  const { t } = useI18n();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [total, setTotal] = useState(-1);
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 100 });
  const [priceMap, setPriceMap] = useState<{ [key: string]: TickPriceItem }>();

  const tools = useTools();
  const fetchData = async () => {
    try {
      setPriceMap(undefined);
      const { list, total } = await wallet.getDRC20List(
        currentAccount.address,
        pagination.currentPage,
        pagination.pageSize
      );
      setTokens(list);
      setTotal(total);
      if (list.length > 0) {
        wallet.getDrc20sPrice(list.map((item) => item.ticker)).then(setPriceMap);
      }
    } catch (e) {
      tools.toastError((e as Error).message);
    } finally {
      // tools.showLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination, currentAccount.address, chain]);

  if (total === -1) {
    return (
      <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
        <LoadingOutlined />
      </Column>
    );
  }

  if (total === 0) {
    return (
      <Column style={{ minHeight: 200 }} itemsCenter justifyCenter gap="lg">
        <Empty text={t('empty')} />
        <Column
          gap="md"
          style={{
            maxWidth: 300,
            padding: '16px',
            backgroundColor: 'rgba(201, 130, 42, 0.08)',
            border: '1px solid rgba(201, 130, 42, 0.3)',
            borderRadius: '8px',
            textAlign: 'center'
          }}
        >
          <Text text="About DRC-20 Tokens" preset="bold" />
          <Text
            text="DRC-20 tokens are inscription-based tokens on Dogecoin. They follow the DRC-20 standard for creating fungible assets."
            size="sm"
            color="textDim"
          />
          <Text
            text="You don't have any DRC-20 tokens yet. Receive some or mint them to view them here."
            size="sm"
            color="textDim"
          />
        </Column>
      </Column>
    );
  }

  return (
    <Column>
      <Column gap="md">
        {tokens.map((data, index) => (
          <DRC20BalanceCard
            key={'drc20-' + index + data.ticker}
            tokenBalance={data}
            showPrice={chain.showPrice && priceMap !== undefined}
            price={priceMap?.[data.ticker]}
            onClick={() => {
              navigate('DRC20TokenScreen', { tokenBalance: data, ticker: data.ticker });
            }}
          />
        ))}
      </Column>

      <Row justifyCenter mt="lg">
        <Pagination
          pagination={pagination}
          total={total}
          onChange={(pagination) => {
            setPagination(pagination);
          }}
        />
      </Row>
    </Column>
  );
}
