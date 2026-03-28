import { dunesUtils } from '@dojak/core/lib/dunes-utils';
import { DuneBalance, TickPriceItem } from '@dojak/core/types';
import { TickUsd } from '@dojak/ui/components/TickUsd';

import { Column } from './Column';
import { Row } from './Row';
import { Text } from './Text';

export interface DunesPreviewCardProps {
  balance: DuneBalance;
  onClick?: () => void;
  price: TickPriceItem | undefined;
}

export default function DunesPreviewCard({ balance, onClick, price }: DunesPreviewCardProps) {
  const balanceStr = `${dunesUtils.toDecimalAmount(balance.amount, balance.divisibility)} ${balance.symbol}`;

  let size = 'sm';
  if (balanceStr.length > 10) {
    size = 'xxs';
  } else if (balanceStr.length > 20) {
    size = 'xxxs';
  }
  return (
    <Column
      style={{
        position: 'relative',
        backgroundColor: '#A14419',
        width: 80,
        height: 90,
        minWidth: 80,
        minHeight: 90,
        borderRadius: 5,
        padding: 0
      }}
      onClick={onClick}
    >
      <Row
        style={{
          borderTopLeftRadius: 5,
          borderTopRightRadius: 5,
          position: 'absolute'
        }}
      >
        <Row
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderBottomRightRadius: 5,
            borderTopLeftRadius: 5,
            width: 70
          }}
          px="sm"
        >
          <Text text={balance.spacedDune} wrap color="white" size="xxxs" />
        </Row>
      </Row>

      <Column fullY justifyCenter itemsCenter gap={'xs'}>
        <Text text={balanceStr} size={size as any} textCenter wrap />
        <TickUsd
          style={{ marginBottom: -16 }}
          price={price}
          balance={dunesUtils.toDecimalAmount(balance.amount, balance.divisibility)}
        />
      </Column>
    </Column>
  );
}
