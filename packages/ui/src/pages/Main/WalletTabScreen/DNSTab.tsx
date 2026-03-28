import { useCallback, useEffect, useState } from 'react';

import { Inscription } from '@dojak/core/types';
import { useTools } from '@dojak/ui/components/ActionComponent';
import InscriptionPreview from '@dojak/ui/components/InscriptionPreview';
import { VirtualList } from '@dojak/ui/components/VirtualList';
import { useExtensionIsInTab } from '@dojak/ui/features/browser/tabs';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useCurrentAccount } from '@dojak/ui/state/accounts/hooks';
import { useChainType } from '@dojak/ui/state/settings/hooks';
import { useWallet } from '@dojak/ui/utils';

import { useNavigate } from '../../MainRoute';

export function DNSTab() {
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

  const fetchDNSInscriptions = useCallback(
    async (fetchParams: { address: string }, page: number, pageSize: number) => {
      // For now, fetch all inscriptions and filter for DNS ones client-side
      // Later this should be done server-side when DNS detection is implemented
      const allInscriptions = await wallet.getDoginalsInscriptions(fetchParams.address, page, pageSize);

      // Filter for DNS inscriptions (plain text that looks like domains)
      const dnsInscriptions = allInscriptions.list.filter((inscription: Inscription) => {
        // Check if it's a plain text inscription that looks like a domain
        if (inscription.contentType?.includes('text/plain') &&
            inscription.contentBody &&
            typeof inscription.contentBody === 'string') {

          const content = inscription.contentBody.trim();

          // Basic domain pattern: word.doge (or other TLDs)
          const domainPattern = /^[a-zA-Z0-9]+\.[a-zA-Z]+$/;
          return domainPattern.test(content) && content.length < 50; // Reasonable length limit
        }
        return false;
      });

      return {
        list: dnsInscriptions,
        total: dnsInscriptions.length // This will be approximate until server-side filtering
      };
    },
    [wallet]
  );

  const renderDNSInscription = useCallback(
    (inscription: Inscription, index: number) => {
      // Add DNS-specific verification badge
      const domainName = inscription.contentBody?.trim() || '';
      const isVerified = false; // TODO: Check against Dojaker indexer for verification
      const isInvalid = false; // TODO: Check if this domain has been claimed by someone else

      return (
        <div style={{ position: 'relative' }}>
          <InscriptionPreview
            key={inscription.inscriptionId || `dns-${index}`}
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

          {/* DNS Verification Badge */}
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

          {/* Domain name overlay for easy reading */}
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
            {domainName}
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
      fetchData={fetchDNSInscriptions}
      renderItem={renderDNSInscription}
      onError={handleError}
      emptyText={t('no_dns_domains_found')}
      errorText="Unable to retrieve DNS domains"
      itemsPerRow={itemsPerRow}
    />
  );
}
