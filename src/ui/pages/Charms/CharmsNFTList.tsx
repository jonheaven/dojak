import { useCallback, useEffect, useState } from 'react';

import { CharmsInfo } from '@/shared/types';
import { useTools } from '@/ui/components/ActionComponent';
import CharmsNFTPreview from '@/ui/components/CharmsNFTPreview';
import { VirtualList } from '@/ui/components/VirtualList';
import { useExtensionIsInTab } from '@/ui/features/browser/tabs';
import { useI18n } from '@/ui/hooks/useI18n';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useChainType } from '@/ui/state/settings/hooks';
import { useWallet } from '@/ui/utils';

import { useNavigate } from '../MainRoute';

export function CharmsNFTList(props: { collectionId: string }) {
  const navigate = useNavigate();
  const wallet = useWallet();
  const currentAccount = useCurrentAccount();
  const chainType = useChainType();
  const tools = useTools();
  const isInTab = useExtensionIsInTab();
  const [isMobile, setIsMobile] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const checkMobile = () => {
      const mobileCheck = window.innerWidth <= 768;
      setIsMobile(mobileCheck);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const fetchCharmsNFT = useCallback(
    async (params: any, page: number, pageSize: number) => {
      return wallet.getCharmsCollectionItems(params.address, params.collectionId, page, pageSize);
    },
    [wallet]
  );

  const renderItem = useCallback(
    (item: CharmsInfo, index: number) => (
      <CharmsNFTPreview
        key={item.charmsid}
        preset="medium"
        CharmsInfo={item}
        onClick={() => {
          navigate('CharmsNFTScreen', {
            CharmsInfo: item
          });
        }}
      />
    ),
    [navigate]
  );

  const handleError = useCallback(
    (error: Error) => {
      tools.toastError(error.message);
    },
    [tools]
  );

  const itemsPerRow = isInTab && !isMobile ? 9 : 2;

  return (
    <VirtualList<CharmsInfo>
      fetchParams={{ collectionId: props.collectionId, address: currentAccount.address }}
      chainType={chainType}
      fetchData={fetchCharmsNFT}
      renderItem={renderItem}
      onError={handleError}
      emptyText={t('no_inscriptions_found')}
      itemsPerRow={itemsPerRow}
    />
  );
}
