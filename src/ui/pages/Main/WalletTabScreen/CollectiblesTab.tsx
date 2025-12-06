import { useCallback } from 'react';

import { ChainType } from '@/shared/constant';
import { Column, Row, Text } from '@/ui/components';
import { useI18n } from '@/ui/hooks/useI18n';
import { useAppDispatch } from '@/ui/state/hooks';
import { useChainType } from '@/ui/state/settings/hooks';
import { useInscriptionFilter, useSupportedInscriptionFilters } from '@/ui/state/ui/hooks';
import { InscriptionFilterKey, uiActions } from '@/ui/state/ui/reducer';

import { DNSTab } from './DNSTab';
import { DogemapsTab } from './DogemapsTab';
import { InscriptionList } from './InscriptionList';

const COLLECTIBLES_FILTER_LABELS: Record<InscriptionFilterKey, string> = {
  [InscriptionFilterKey.ALL_COLLECTIBLES]: 'All',
  [InscriptionFilterKey.DNS]: 'DNS',
  [InscriptionFilterKey.DOGEMAPS]: 'Dogemaps',
  [InscriptionFilterKey.NFTS]: 'NFTs'
};

const TOKENS_FILTER_LABELS: Record<InscriptionFilterKey, string> = {
  [InscriptionFilterKey.ALL_TOKENS]: 'All',
  [InscriptionFilterKey.DRC20]: 'DRC-20',
  [InscriptionFilterKey.DUNES]: 'Dunes',
  [InscriptionFilterKey.CHARMS]: 'Charms'
};

export function CollectiblesTab() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const currentFilter = useInscriptionFilter();
  const supportedFilters = useSupportedInscriptionFilters();
  const chainType = useChainType();

  const handleFilterChange = useCallback(
    (filter: InscriptionFilterKey) => {
      dispatch(uiActions.updateAssetTabScreen({ inscriptionFilter: filter }));
    },
    [dispatch]
  );

  // Render content based on active filter
  const renderContent = () => {
    switch (currentFilter) {
      case InscriptionFilterKey.ALL_COLLECTIBLES:
        return <InscriptionList />;
      case InscriptionFilterKey.DNS:
        return <DNSTab />;
      case InscriptionFilterKey.DOGEMAPS:
        return <DogemapsTab />;
      case InscriptionFilterKey.NFTS:
        return <InscriptionList filterType="doginals" />; // For now, show all doginals as NFTs
      default:
        return <InscriptionList />;
    }
  };

  // Filter to only show collectibles filters
  const collectiblesFilters = supportedFilters.filter(filter =>
    [InscriptionFilterKey.ALL_COLLECTIBLES, InscriptionFilterKey.DNS, InscriptionFilterKey.DOGEMAPS, InscriptionFilterKey.NFTS].includes(filter)
  );

  return (
    <Column gap="md">
      {/* Filter Pills */}
      <Row
        style={{
          gap: 8,
          flexWrap: 'wrap',
          padding: '8px 0'
        }}
      >
        {collectiblesFilters.map((filter) => {
          const isActive = currentFilter === filter;
          return (
            <div
              key={filter}
              onClick={() => handleFilterChange(filter)}
              style={{
                padding: '6px 14px',
                borderRadius: 16,
                cursor: 'pointer',
                background: isActive
                  ? 'linear-gradient(135deg, #f7931a 0%, #ffb347 100%)'
                  : 'rgba(255, 255, 255, 0.08)',
                border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                transition: 'all 0.2s ease'
              }}
            >
              <Text
                text={COLLECTIBLES_FILTER_LABELS[filter]}
                size="sm"
                style={{
                  color: isActive ? '#000' : 'rgba(255, 255, 255, 0.7)',
                  fontWeight: isActive ? 600 : 400
                }}
              />
            </div>
          );
        })}
      </Row>

      {/* Content */}
      {renderContent()}
    </Column>
  );
}
