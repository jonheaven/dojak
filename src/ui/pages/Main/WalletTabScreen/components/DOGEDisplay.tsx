import { useMemo } from 'react';

import { ChainType } from '@/shared/constant';
import { Row, Text } from '@/ui/components';
import { useChainType, usePEPUnit } from '@/ui/state/settings/hooks';

export function PEPDisplay({ balance }: { balance: string }) {
  const chainType = useChainType();
  const pepUnit = usePEPUnit();
  const { intPart, decPart } = useMemo(() => {
    //   split balance into integer and decimal parts
    const [intPart, decPart] = balance.split('.');

    return {
      intPart,
      decPart: decPart || ''
    };
  }, [balance]);

  const isPEPChain =
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
      <Text text={intPart} preset="title-bold" size="xxxl" color={isPEPChain ? 'white' : undefined} />
      {decPart && (
        <Text
          text={'.' + decPart.slice(0, decimalPlaces)}
          preset="title-bold"
          style={{
            color: isPEPChain ? '#FFFFFF' : '#8a8a8a',
            fontSize: 28
          }}
        />
      )}
      <Text
        text={pepUnit}
        preset="title-bold"
        size="xxxl"
        style={{ marginLeft: '0.25em' }}
        color={isPEPChain ? 'white' : undefined}
      />
    </Row>
  );
}


