import { dunesUtils } from '@dojak/core/lib/dunes-utils';
import { DuneBalance, TickPriceItem } from '@dojak/core/types';
import { TickPriceChange, TickUsd } from '@dojak/ui/components/TickUsd';
import { showLongNumber } from '@dojak/ui/utils';

import { Card } from '../Card';
import { Column } from '../Column';
import { DunesTicker } from '../DunesTicker';
import { Row } from '../Row';
import { Text } from '../Text';

export interface DunesBalanceCardProps {
  tokenBalance: DuneBalance;
  onClick?: () => void;
  showPrice?: boolean;
  price?: TickPriceItem;
}

export default function DunesBalanceCard(props: DunesBalanceCardProps) {
  const { tokenBalance, onClick, showPrice, price } = props;
  const balance = dunesUtils.toDecimalNumber(tokenBalance.amount, tokenBalance.divisibility);
  let str = balance.toString();
  if (balance.lt(0.0001)) {
    str = '<0.0001';
  } else {
    str = showLongNumber(balance.toString());
  }
  return (
    <Card
      style={{
        backgroundColor: '#1E1F24',
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12
      }}
      fullX
      onClick={() => {
        onClick && onClick();
      }}
    >
      <Column full py="zero" gap="zero">
        <Row fullY justifyBetween justifyCenter>
          <Column fullY justifyCenter>
            <DunesTicker tick={tokenBalance.spacedDune} />
          </Column>

          <Row itemsCenter fullY gap="zero">
            <Text text={str} size="xs" />
            <Text text={tokenBalance.symbol} size="xs" mx="sm" />
          </Row>
        </Row>
        {showPrice && (
          <Row justifyBetween mt={'xs'}>
            <TickPriceChange price={price} />
            <TickUsd price={price} balance={balance.toString()} />
          </Row>
        )}
      </Column>
    </Card>
  );
}
