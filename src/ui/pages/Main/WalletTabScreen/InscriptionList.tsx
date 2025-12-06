import { useCallback, useEffect, useState } from 'react';

import { Inscription } from '@/shared/types';
import { useTools } from '@/ui/components/ActionComponent';
import InscriptionPreview from '@/ui/components/InscriptionPreview';
import { VirtualList } from '@/ui/components/VirtualList';
import { useExtensionIsInTab } from '@/ui/features/browser/tabs';
import { useI18n } from '@/ui/hooks/useI18n';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useChainType } from '@/ui/state/settings/hooks';
import { useWallet } from '@/ui/utils';

import { useNavigate } from '../../MainRoute';

interface InscriptionListProps {
  filterType?: 'doginals' | 'all'; // Optional filter for inscription types
}

export function InscriptionList({ filterType = 'all' }: InscriptionListProps) {
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

  const fetchInscriptions = useCallback(
    async (fetchParams: { address: string }, page: number, pageSize: number) => {
      // Fetch inscriptions - filterType can be used for future server-side filtering
      return wallet.getDoginalsInscriptions(fetchParams.address, page, pageSize);
    },
    [wallet, filterType]
  );

  const renderInscription = useCallback(
    (inscription: Inscription, index: number) => (
      <InscriptionPreview
        key={inscription.inscriptionId || `inscription-${index}`}
        data={inscription}
        style={{ width: '100%' }}
        preset="medium"
        onClick={() => {
          navigate(
            'DoginalsInscriptionScreen',
            {
              inscription
            },
            {
              inscriptionId: inscription.inscriptionId
            }
          );
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
    <VirtualList<Inscription>
      fetchParams={{ address: currentAccount.address }}
      chainType={chainType}
      fetchData={fetchInscriptions}
      renderItem={renderInscription}
      onError={handleError}
      emptyText={t('no_inscriptions_found')}
      errorText={t('Unable to retrieve inscriptions')}
      itemsPerRow={itemsPerRow}
    />
  );
}
