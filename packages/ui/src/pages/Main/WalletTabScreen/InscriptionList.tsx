import { useCallback, useEffect, useState } from 'react';

import { Inscription } from '@dojak/core/types';
import { getDogIndexerClient } from '@dojak/core/background/service/providers/dogIndexer';
import { useTools } from '@dojak/ui/components/ActionComponent';
import InscriptionPreview from '@dojak/ui/components/InscriptionPreview';
import { VirtualList } from '@dojak/ui/components/VirtualList';
import { useExtensionIsInTab } from '@dojak/ui/features/browser/tabs';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useRarityEnrichment } from '@dojak/ui/hooks/useRarityEnrichment';
import { useCurrentAccount } from '@dojak/ui/state/accounts/hooks';
import { useChainType } from '@dojak/ui/state/settings/hooks';
import { useWallet } from '@dojak/ui/utils';

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
  const { enrichInscriptions } = useRarityEnrichment();

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
      // Try the dog indexer first — it returns rarity from on-chain charms,
      // so enrichInscriptions will use that directly without local recalculation.
      try {
        const indexer = getDogIndexerClient();
        const alive = await indexer.ping();
        if (alive) {
          const indexerResult = await indexer.getAddressInscriptions(fetchParams.address);
          // Indexer returns all inscriptions; apply manual pagination to match VirtualList contract
          const start = page * pageSize;
          const slice = indexerResult.slice(start, start + pageSize);
          // rarity is already set from charms — enrichInscriptions will pass them through
          return enrichInscriptions(slice);
        }
      } catch {
        // Indexer unavailable — fall through to legacy providers
      }

      // Fallback: existing wallet API (Tatum / localRpc / Dojak)
      const result = await wallet.getDoginalsInscriptions(fetchParams.address, page, pageSize);
      if (result && Array.isArray(result)) {
        return enrichInscriptions(result);
      }
      return result;
    },
    [wallet, filterType, enrichInscriptions]
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
