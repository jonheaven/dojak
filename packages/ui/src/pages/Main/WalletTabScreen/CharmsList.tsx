import { useEffect, useState } from 'react';

import { CharmsBalance, TickPriceItem } from '@dojak/core/types';
import { Column, Row } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import CharmsBalanceCard from '@dojak/ui/components/CharmsBalanceCard';
import { Empty } from '@dojak/ui/components/Empty';
import { Pagination } from '@dojak/ui/components/Pagination';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useCurrentAccount } from '@dojak/ui/state/accounts/hooks';
import { useChainType } from '@dojak/ui/state/settings/hooks';
import { useWallet } from '@dojak/ui/utils';
import { LoadingOutlined } from '@ant-design/icons';

import { useNavigate } from '../../MainRoute';

export function CharmsList() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const currentAccount = useCurrentAccount();
  const chainType = useChainType();
  const { t } = useI18n();

  const [tokens, setTokens] = useState<CharmsBalance[]>([]);
  const [total, setTotal] = useState(-1);
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 100 });
  const [priceMap, setPriceMap] = useState<{ [key: string]: TickPriceItem }>();

  const tools = useTools();
  const fetchData = async () => {
    try {
      const { list, total } = await wallet.getCharmsList(
        currentAccount.address,
        pagination.currentPage,
        pagination.pageSize
      );
      setTokens(list);
      setTotal(total);
      if (list.length > 0) {
        wallet.getCharmsPrice(list.map((item) => item.charmsid)).then(setPriceMap);
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
      <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
        <Empty text={t('empty')} />
      </Column>
    );
  }

  return (
    <Column>
      <Row style={{ flexWrap: 'wrap' }} gap="sm">
        {tokens.map((data, index) => (
          <CharmsBalanceCard
            key={index}
            tokenBalance={data}
            showPrice={priceMap !== undefined}
            price={priceMap?.[data.charmsid]}
            onClick={() => {
              navigate('CharmsTokenScreen', {
                charmsid: data.charmsid
              });
            }}
          />
        ))}
      </Row>

      {tokens.length > 0 ? (
        <Row justifyCenter mt="lg">
          <Pagination
            pagination={pagination}
            total={total}
            onChange={(pagination) => {
              setPagination(pagination);
            }}
          />
        </Row>
      ) : (
        <Empty text={t('empty')} />
      )}
    </Column>
  );
}
