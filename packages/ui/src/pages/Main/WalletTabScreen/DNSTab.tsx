import { useCallback, useEffect, useState } from 'react';

import { Inscription } from '@dojak/core/types';
import { isDNSName } from '@dojak/core/lib/dns';
import { useTools } from '@dojak/ui/components/ActionComponent';
import InscriptionPreview from '@dojak/ui/components/InscriptionPreview';
import { VirtualList } from '@dojak/ui/components/VirtualList';
import { useExtensionIsInTab } from '@dojak/ui/features/browser/tabs';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useCurrentAccount } from '@dojak/ui/state/accounts/hooks';
import { useChainType } from '@dojak/ui/state/settings/hooks';
import { useWallet } from '@dojak/ui/utils';

import { useNavigate } from '../../MainRoute';

function dnsNameFromInscription(inscription: Inscription): string | null {
  const body = inscription.contentBody;
  if (typeof body !== 'string') return null;
  const text = body.trim();
  if (!text) return null;
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text.replace(/,\s*([}\]])/g, '$1')) as {
        p?: string;
        op?: string;
        name?: string;
      };
      if (String(parsed.p || '').toLowerCase() !== 'dns') return null;
      const op = String(parsed.op || '').toLowerCase();
      if (op && !['register', 'reg', 'config', 'update', 'upd'].includes(op)) return null;
      const name = typeof parsed.name === 'string' ? parsed.name.trim().toLowerCase() : '';
      return isDNSName(name) ? name : null;
    } catch {
      return null;
    }
  }
  const token = (text.split(/\s+/)[0] || '').toLowerCase();
  return isDNSName(token) ? token : null;
}

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
        return Boolean(dnsNameFromInscription(inscription));
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
      const domainName = dnsNameFromInscription(inscription) || inscription.contentBody?.trim() || '';

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

          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'linear-gradient(135deg, #b45309, #fbbf24)',
              color: '#1c1917',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em'
            }}
          >
            DNS
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
