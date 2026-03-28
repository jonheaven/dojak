import { useEffect, useState } from 'react';

import { DuneBalance, TickPriceItem } from '@dojak/core/types';
import { Column, Row } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import DunesBalanceCard from '@dojak/ui/components/DunesBalanceCard';
import { Empty } from '@dojak/ui/components/Empty';
import { Pagination } from '@dojak/ui/components/Pagination';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useCurrentAccount } from '@dojak/ui/state/accounts/hooks';
import { useChainType } from '@dojak/ui/state/settings/hooks';
import { useWallet } from '@dojak/ui/utils';
import { LoadingOutlined } from '@ant-design/icons';

import { useNavigate } from '../../MainRoute';

export function DunesList() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const currentAccount = useCurrentAccount();
  const chainType = useChainType();
  const { t } = useI18n();

  const [tokens, setTokens] = useState<DuneBalance[]>([]);
  const [total, setTotal] = useState(-1);
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 100 });
  const [priceMap, setPriceMap] = useState<{ [key: string]: TickPriceItem }>();

  const tools = useTools();
  const fetchData = async () => {
    try {
      const { list, total } = await wallet.getDunesList(
        currentAccount.address,
        pagination.currentPage,
        pagination.pageSize
      );
      setTokens(list);
      setTotal(total);
      if (list.length > 0) {
        wallet.getDunesPrice(list.map((item) => item.spacedDune)).then(setPriceMap);
      }
    } catch (e) {
      tools.toastError((e as Error).message);
    } finally {
      // tools.showLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination, currentAccount.address, chainType]);

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
          <Text text="About Dunes" preset="bold" />
          <Text
            text="Dunes are fungible tokens on Dogecoin using the Dunes protocol. They're similar to DRC-20 tokens but use a more efficient, native protocol."
            size="sm"
            color="textDim"
          />
          <Text
            text="You don't have any Dunes yet. Receive some to view them here."
            size="sm"
            color="textDim"
          />
        </Column>
      </Column>
    );
  }

  return (
    <Column>
      <Row style={{ flexWrap: 'wrap' }} gap="sm">
        {tokens.map((data, index) => (
          <DunesBalanceCard
            key={index}
            tokenBalance={data}
            showPrice={priceMap !== undefined}
            price={priceMap?.[data.spacedDune]}
            onClick={() => {
              navigate('DunesTokenScreen', {
                duneid: data.duneid
              });
            }}
          />
        ))}
      </Row>

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
