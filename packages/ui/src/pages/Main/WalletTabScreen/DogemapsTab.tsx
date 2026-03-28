import { useCallback, useEffect, useState } from 'react';

import { Inscription } from '@dojak/core/types';
import { getDogIndexerClient, IndexerDogemapEntry } from '@dojak/core/background/service/providers/dogIndexer';
import { useTools } from '@dojak/ui/components/ActionComponent';
import InscriptionPreview from '@dojak/ui/components/InscriptionPreview';
import { VirtualList } from '@dojak/ui/components/VirtualList';
import { useExtensionIsInTab } from '@dojak/ui/features/browser/tabs';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useCurrentAccount } from '@dojak/ui/state/accounts/hooks';
import { useChainType } from '@dojak/ui/state/settings/hooks';
import { useWallet } from '@dojak/ui/utils';

import { useNavigate } from '../../MainRoute';

// ─── Per-item verification component ──────────────────────────────────────────

interface DogemapItemProps {
  inscription: Inscription;
  index: number;
  onNavigate: () => void;
}

function DogemapItem({ inscription, index, onNavigate }: DogemapItemProps) {
  const blockNumber = inscription.contentBody?.trim() ?? '';
  const [entry, setEntry] = useState<IndexerDogemapEntry | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const n = parseInt(blockNumber, 10);
    if (isNaN(n)) {
      setChecked(true);
      return;
    }
    const indexer = getDogIndexerClient();
    indexer
      .ping()
      .then((alive) => {
        if (!alive) return null;
        return indexer.getDogemapEntry(n);
      })
      .then((e) => {
        setEntry(e ?? null);
      })
      .catch(() => {
        /* indexer offline — leave entry null */
      })
      .finally(() => setChecked(true));
  }, [blockNumber]);

  const isVerified =
    checked &&
    entry !== null &&
    entry.claimed === true &&
    entry.ownerInscriptionId === inscription.inscriptionId;

  const isInvalid =
    checked &&
    entry !== null &&
    entry.claimed === true &&
    entry.ownerInscriptionId !== inscription.inscriptionId;

  return (
    <div style={{ position: 'relative' }}>
      <InscriptionPreview
        key={inscription.inscriptionId || `dogemap-${index}`}
        data={inscription}
        style={{ width: '100%' }}
        preset="medium"
        onClick={onNavigate}
      />

      {/* Verification badge */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: isVerified
            ? 'linear-gradient(135deg, #28a745, #20c997)'
            : isInvalid
              ? 'linear-gradient(135deg, #dc3545, #fd7e14)'
              : 'linear-gradient(135deg, #6c757d, #adb5bd)',
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
            <span>{checked ? '?' : '…'}</span>
            <span>UNVERIFIED</span>
          </>
        )}
      </div>

      {/* Block number overlay */}
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

      {/* Biome tag from indexer metadata */}
      {entry?.metaverse?.biome && (
        <div
          style={{
            position: 'absolute',
            bottom: 34,
            left: 8,
            background: 'rgba(0,0,0,0.6)',
            color: '#f7931a',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 9,
            fontWeight: 600
          }}
        >
          {entry.metaverse.biome.toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ─── Tab ───────────────────────────────────────────────────────────────────────

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
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchDogemapsInscriptions = useCallback(
    async (fetchParams: { address: string }, page: number, pageSize: number) => {
      const allInscriptions = await wallet.getDoginalsInscriptions(fetchParams.address, page, pageSize);

      const dogemapsInscriptions = allInscriptions.list.filter((inscription: Inscription) => {
        if (
          inscription.contentType?.includes('text/plain') &&
          inscription.contentBody &&
          typeof inscription.contentBody === 'string'
        ) {
          const content = inscription.contentBody.trim();
          return /^\d+\.dogemap$/.test(content) && content.length < 20;
        }
        return false;
      });

      return {
        list: dogemapsInscriptions,
        total: dogemapsInscriptions.length
      };
    },
    [wallet]
  );

  const renderDogemapsInscription = useCallback(
    (inscription: Inscription, index: number) => (
      <DogemapItem
        key={inscription.inscriptionId || `dogemap-${index}`}
        inscription={inscription}
        index={index}
        onNavigate={() =>
          navigate(
            'DoginalsInscriptionScreen',
            { inscription },
            { inscriptionId: inscription.inscriptionId }
          )
        }
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Claim button header */}
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'flex-end'
        }}
      >
        <div
          onClick={() => navigate('DogemapClaimScreen')}
          style={{
            background: 'linear-gradient(135deg, #ff6b35, #f7931a)',
            color: 'white',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(255, 107, 53, 0.4)'
          }}
        >
          <span>🏞️</span>
          <span>Claim a Block</span>
        </div>
      </div>

      <div style={{ flex: 1 }}>
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
      </div>
    </div>
  );
}
