import { useEffect, useState } from 'react';

import { CharmsCollection } from '@/shared/types';
import { Column, Row } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { CharmsCollectionCard } from '@/ui/components/CharmsCollectionCard';
import { Empty } from '@/ui/components/Empty';
import { Pagination } from '@/ui/components/Pagination';
import { useI18n } from '@/ui/hooks/useI18n';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useChain, useChainType } from '@/ui/state/settings/hooks';
import { useIsInExpandView, useSupportedAssets } from '@/ui/state/ui/hooks';
import { useWallet } from '@/ui/utils';
import { LoadingOutlined } from '@ant-design/icons';

import { useNavigate } from '../../MainRoute';

export function CharmsCollectionList() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const currentAccount = useCurrentAccount();
  const chainType = useChainType();
  const chain = useChain();
  const { t } = useI18n();

  const [collections, setCollections] = useState<CharmsCollection[]>([]);
  const [total, setTotal] = useState(-1);
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 100 });

  const tools = useTools();

  const supportedAssets = useSupportedAssets();

  const inExpandView = useIsInExpandView();
  const justifyContent = inExpandView ? 'left' : 'space-between';

  useEffect(() => {
    const fetchData = async () => {
      if (!supportedAssets.assets.Charms) {
        setCollections([]);
        setTotal(0);
        return;
      }
      try {
        const { list, total } = await wallet.getCharmsCollectionList(
          currentAccount.address,
          pagination.currentPage,
          pagination.pageSize
        );
        setCollections(list);
        setTotal(total);
      } catch (e) {
        setCollections([]);
        tools.toastError((e as Error).message);
      } finally {
        // tools.showLoading(false);
      }
    };

    fetchData();
  }, [pagination, currentAccount.address, chainType, supportedAssets.key]);

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
      <Row style={{ flexWrap: 'wrap', justifyContent }} gap="sm">
        {collections.map((data, index) => (
          <CharmsCollectionCard
            key={index}
            CharmsCollection={data}
            onClick={() => {
              navigate('CharmsCollectionScreen', {
                collectionId: data.charmsid
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
