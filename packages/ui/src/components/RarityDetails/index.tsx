import { Inscription } from '@dojak/core/types';
import { getRarityTierLabel, getRarityTierColor } from '@dojak/core/lib/rarity';
import { Column } from '../Column';
import { Row } from '../Row';
import { Text } from '../Text';
import { Tooltip } from '../Tooltip';

export interface RarityDetailsProps {
  inscription: Inscription;
  compact?: boolean;
}

/**
 * Displays detailed rarity information for an inscription
 * Shows tier, block, koinu position, and supply percentage
 */
export function RarityDetails({ inscription, compact = false }: RarityDetailsProps) {
  const rarity = inscription.rarity;

  if (!rarity) {
    return null;
  }

  const tierLabel = getRarityTierLabel(rarity.tier);
  const tierColor = getRarityTierColor(rarity.tier);

  if (compact) {
    return (
      <Row gap="sm" itemsCenter>
        <div
          style={{
            backgroundColor: tierColor,
            color: '#000',
            padding: '4px 8px',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '12px',
            textTransform: 'uppercase',
            boxShadow: `0 0 8px ${tierColor}80`
          }}
        >
          {tierLabel}
        </div>
        {rarity.blockHeight !== undefined && (
          <Tooltip title={`Block ${rarity.blockHeight}`}>
            <Text text={`Block #${rarity.blockHeight}`} size="xs" preset="sub" />
          </Tooltip>
        )}
      </Row>
    );
  }

  return (
    <Column gap="md" full>
      <Row gap="md" itemsCenter>
        <div
          style={{
            backgroundColor: tierColor,
            color: '#000',
            padding: '6px 12px',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '14px',
            textTransform: 'uppercase',
            boxShadow: `0 0 12px ${tierColor}80`
          }}
        >
          {tierLabel}
        </div>
      </Row>

      <Column gap="xs">
        {rarity.blockHeight !== undefined && (
          <Row justifyBetween>
            <Text text="Block Height:" size="sm" preset="sub" />
            <Text text={`${rarity.blockHeight}`} size="sm" />
          </Row>
        )}

        {rarity.koinuStart !== undefined && (
          <Row justifyBetween>
            <Text text="Koinu Position:" size="sm" preset="sub" />
            <Tooltip title={`Satoshi index in total supply`}>
              <Text text={`${rarity.koinuStart.toLocaleString()}`} size="sm" />
            </Tooltip>
          </Row>
        )}

        {rarity.percentageOfSupply !== undefined && (
          <Row justifyBetween>
            <Text text="Supply %:" size="sm" preset="sub" />
            <Text text={`${rarity.percentageOfSupply.toFixed(4)}%`} size="sm" />
          </Row>
        )}
      </Column>
    </Column>
  );
}
