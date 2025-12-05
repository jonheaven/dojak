import { useCallback } from 'react';

import { ChainType } from '@/shared/constant';
import { Column, Row, Text } from '@/ui/components';
import { useI18n } from '@/ui/hooks/useI18n';
import { useAppDispatch } from '@/ui/state/hooks';
import { useChainType } from '@/ui/state/settings/hooks';
import { useInscriptionFilter, useSupportedInscriptionFilters } from '@/ui/state/ui/hooks';
import { InscriptionFilterKey, uiActions } from '@/ui/state/ui/reducer';

import { CharmsTab } from './CharmsTab';
import { DRC20List } from './DRC20List';
import { DunesList } from './DunesList';
import { InscriptionList } from './InscriptionList';

const FILTER_LABELS: Record<InscriptionFilterKey, string> = {
  [InscriptionFilterKey.ALL]: 'All',
  [InscriptionFilterKey.DOGINALS]: 'Doginals',
  [InscriptionFilterKey.DRC20]: 'DRC-20',
  [InscriptionFilterKey.DUNES]: 'Dunes',
  [InscriptionFilterKey.CHARMS]: 'Charms'
};

export function InscriptionsTab() {
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
      case InscriptionFilterKey.ALL:
        return <InscriptionList />;
      case InscriptionFilterKey.DOGINALS:
        return <InscriptionList filterType="doginals" />;
      case InscriptionFilterKey.DRC20:
        return <DRC20List />;
      case InscriptionFilterKey.DUNES:
        return <DunesList />;
      case InscriptionFilterKey.CHARMS:
        return chainType === ChainType.BITCOIN_MAINNET ? <CharmsTab /> : <InscriptionList />;
      default:
        return <InscriptionList />;
    }
  };

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
        {supportedFilters.map((filter) => {
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
                text={FILTER_LABELS[filter]}
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
