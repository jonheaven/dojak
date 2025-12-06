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

export function DogemapsTab() {
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

  const fetchDogemapsInscriptions = useCallback(
    async (fetchParams: { address: string }, page: number, pageSize: number) => {
      // For now, fetch all inscriptions and filter for Dogemaps ones client-side
      // Later this should be done server-side when Dogemaps detection is implemented
      const allInscriptions = await wallet.getDoginalsInscriptions(fetchParams.address, page, pageSize);

      // Filter for Dogemaps inscriptions (plain text that looks like block.dogemap)
      const dogemapsInscriptions = allInscriptions.list.filter((inscription: Inscription) => {
        // Check if it's a plain text inscription that looks like a block number + .dogemap
        if (inscription.contentType?.includes('text/plain') &&
            inscription.contentBody &&
            typeof inscription.contentBody === 'string') {

          const content = inscription.contentBody.trim();

          // Basic dogemap pattern: number.dogemap (e.g., "1234.dogemap")
          const dogemapPattern = /^\d+\.dogemap$/;
          return dogemapPattern.test(content) && content.length < 20; // Reasonable length limit
        }
        return false;
      });

      return {
        list: dogemapsInscriptions,
        total: dogemapsInscriptions.length // This will be approximate until server-side filtering
      };
    },
    [wallet]
  );

  const renderDogemapsInscription = useCallback(
    (inscription: Inscription, index: number) => {
      // Add Dogemaps-specific verification badge
      const blockNumber = inscription.contentBody?.trim() || '';
      const isVerified = false; // TODO: Check against Dojaker indexer for verification
      const isInvalid = false; // TODO: Check if this block has been claimed by someone else

      return (
        <div style={{ position: 'relative' }}>
          <InscriptionPreview
            key={inscription.inscriptionId || `dogemap-${index}`}
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

          {/* Dogemaps Verification Badge */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: isVerified
                ? 'linear-gradient(135deg, #28a745, #20c997)' // Green for verified
                : isInvalid
                  ? 'linear-gradient(135deg, #dc3545, #fd7e14)' // Red/orange for invalid
                  : 'linear-gradient(135deg, #6c757d, #adb5bd)', // Gray for unverified
              color: 'white',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            {isVerified ? (
              <>
                <span>✓</span>
                <span>VERIFIED</span>
              </>
            ) : isInvalid ? (
              <>
                <span>✗</span>
                <span>INVALID</span>
              </>
            ) : (
              <>
                <span>?</span>
                <span>UNVERIFIED</span>
              </>
            )}
          </div>

          {/* Block number overlay for easy reading */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            Block {blockNumber}
          </div>

          {/* Metaverse land indicator */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: 'linear-gradient(135deg, #ff6b35, #f7931a)',
              color: 'white',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 9,
              fontWeight: 600,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            🏞️ LAND
          </div>
        </div>
      );
    },
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
      fetchData={fetchDogemapsInscriptions}
      renderItem={renderDogemapsInscription}
      onError={handleError}
      emptyText={t('no_dogemaps_found')}
      errorText="Unable to retrieve Dogemaps"
      itemsPerRow={itemsPerRow}
    />
  );
}
