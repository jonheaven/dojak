import { useMemo } from 'react';

import { ChainType } from '@dojak/core/constant';
import { Row, Text } from '@dojak/ui/components';
import { useChainType, useDOGEUnit } from '@dojak/ui/state/settings/hooks';

export function DOGEDisplay({ balance }: { balance: string }) {
  const chainType = useChainType();
  const dogeUnit = useDOGEUnit();
  const { intPart, decPart } = useMemo(() => {
    //   split balance into integer and decimal parts
    const [intPart, decPart] = balance.split('.');

    return {
      intPart,
      decPart: decPart || ''
    };
  }, [balance]);

  const isDOGEChain =
    chainType === ChainType.BITCOIN_MAINNET ||
    chainType === ChainType.BITCOIN_TESTNET ||
    chainType === ChainType.BITCOIN_TESTNET4 ||
    chainType === ChainType.BITCOIN_SIGNET;

  // Dogecoin networks don't have special display logic
  //   show 3 decimal places for fractal bitcoin
  let decimalPlaces = 3;
  if (parseInt(balance) < 1) {
    decimalPlaces = 8;
  }

  return (
    <Row style={{ alignItems: 'flex-end' }} justifyCenter gap={'zero'} my="sm">
      <Text text={intPart} preset="title-bold" size="xxxl" color={isDOGEChain ? 'white' : undefined} />
      {decPart && (
        <Text
          text={'.' + decPart.slice(0, decimalPlaces)}
          preset="title-bold"
          style={{
            color: isDOGEChain ? '#FFFFFF' : '#8a8a8a',
            fontSize: 28
          }}
        />
      )}
      <Text
        text={dogeUnit}
        preset="title-bold"
        size="xxxl"
        style={{ marginLeft: '0.25em' }}
        color={isDOGEChain ? 'white' : undefined}
      />
    </Row>
  );
}
