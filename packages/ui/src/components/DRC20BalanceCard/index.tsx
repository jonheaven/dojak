import { TickPriceItem, TokenBalance } from '@dojak/core/types';

import { Column } from '../Column';
import { Row } from '../Row';
import { Text } from '../Text';

export interface DRC20BalanceCardProps {
  tokenBalance: TokenBalance;
  showPrice?: boolean;
  price?: TickPriceItem;
  onClick?: () => void;
}

export default function DRC20BalanceCard({ tokenBalance, onClick }: DRC20BalanceCardProps) {
  const ticker = tokenBalance.displayName || tokenBalance.ticker;
  return (
    <Row
      justifyBetween
      itemsCenter
      onClick={onClick}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 14,
        border: '1px solid var(--theme-border)',
        background: 'var(--theme-card)',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <Column gap="zero">
        <Text text={ticker} preset="bold" />
        <Text text="DRC-20" size="xs" color="textDim" />
      </Column>
      <Column gap="zero" style={{ alignItems: 'flex-end' }}>
        <Text text={tokenBalance.overallBalance || '0'} preset="bold" />
        <Text text={`${tokenBalance.availableBalance || '0'} available`} size="xs" color="textDim" />
      </Column>
    </Row>
  );
}
