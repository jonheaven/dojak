import { CSSProperties } from 'react';
import { getRarityTierColor, getRarityTierLabel, RarityTier } from '@dojak/core/lib/rarity';
import { Tooltip } from '../Tooltip';
import { Text } from '../Text';

export interface RarityBadgeProps {
  tier: RarityTier;
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
  showLabel?: boolean;
  compact?: boolean;
}

/**
 * Displays a rarity tier badge for Doginals inscriptions
 * Shows color-coded tier indicator with optional label tooltip
 */
export function RarityBadge({
  tier,
  size = 'md',
  style,
  showLabel = true,
  compact = false
}: RarityBadgeProps) {
  const color = getRarityTierColor(tier);
  const label = getRarityTierLabel(tier);

  const sizeMap = {
    sm: {
      padding: '2px 6px',
      fontSize: '10px',
      height: '16px',
      borderRadius: '3px'
    },
    md: {
      padding: '4px 8px',
      fontSize: '12px',
      height: '20px',
      borderRadius: '4px'
    },
    lg: {
      padding: '6px 12px',
      fontSize: '14px',
      height: '24px',
      borderRadius: '5px'
    }
  };

  const badgeStyle: CSSProperties = {
    ...sizeMap[size],
    backgroundColor: color,
    color: '#000',
    fontWeight: 'bold',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    boxShadow: `0 0 8px ${color}80`,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    ...style
  };

  if (compact) {
    return (
      <Tooltip title={label} overlayStyle={{ fontSize: '12px' }}>
        <div
          style={{
            width: size === 'sm' ? '12px' : size === 'md' ? '16px' : '20px',
            height: size === 'sm' ? '12px' : size === 'md' ? '16px' : '20px',
            backgroundColor: color,
            borderRadius: '50%',
            boxShadow: `0 0 8px ${color}80`,
            cursor: 'help'
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={`Rarity: ${label}`}
      overlayStyle={{ fontSize: '12px' }}
    >
      <div style={badgeStyle} title={label}>
        {showLabel ? label.charAt(0).toUpperCase() + label.slice(1) : null}
      </div>
    </Tooltip>
  );
}
