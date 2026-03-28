import { BigNumber } from 'bignumber.js';
import { useEffect, useMemo, useState } from 'react';

import { ChainType } from '@dojak/core/constant';
import { Spin, Text } from '@dojak/ui/components';
import { Sizes, TextProps } from '@dojak/ui/components/Text';
import { usePrice } from '@dojak/ui/provider/PriceProvider';
import { useChain, useChainType } from '@dojak/ui/state/settings/hooks';
import type { ColorTypes } from '@dojak/ui/theme/colors';

/**
 * Display USD value of Dogecoin amount
 * @param koinu - Amount in koinu (smallest unit of DOGE, 1 DOGE = 100,000,000 koinu)
 * Note: Also accepts 'sats' prop for backwards compatibility
 */
export function DOGEUSD(
  props: {
    sats: number; // Amount in koinu (renamed from sats, kept for backwards compatibility)
    color?: ColorTypes;
    size?: Sizes;
    bracket?: boolean; // ()
    isHidden?: boolean;
  } & TextProps
) {
  const { sats: koinu, color = 'textDim', size = 'sm', bracket = false, isHidden = false } = props;

  const { coinPrice, refreshCoinPrice, isLoadingCoinPrice } = usePrice();
  const chainType = useChainType();
  const chain = useChain();

  const [shown, setShown] = useState(false);
  const [showNoValue, setShowNoValue] = useState(false);

  useEffect(() => {
    setShown(chainType === ChainType.BITCOIN_MAINNET);
    setShowNoValue(chainType === ChainType.BITCOIN_TESTNET);
  }, [chainType]);

  useEffect(() => {
    refreshCoinPrice();
  }, []);

  const usd = useMemo(() => {
    let price = 0;
    if (chainType === ChainType.BITCOIN_MAINNET) {
      price = coinPrice.btc;
      price = coinPrice.fb;
    }

    if (isNaN(koinu)) {
      return '-';
    }
    if (price <= 0) {
      return '-';
    }
    if (koinu <= 0) {
      return '0.00';
    }
    const result = new BigNumber(koinu).dividedBy(1e8).multipliedBy(price);

    if (result.isLessThan('0.01')) {
      return '<0.01';
    }

    return result.toFixed(2);
  }, [chainType, coinPrice.btc, coinPrice.fb, koinu]);

  if (isHidden) {
    if (bracket) {
      return <Text color={color} size={size} text={'(****)'} {...props} />;
    }
    return <Text color={color} size={size} text={'****'} {...props} />;
  }

  if (!chain.showPrice) {
    return <></>;
  }

  if (showNoValue) {
    if (bracket) {
      return <Text color={color} size={size} text={'($0.00)'} {...props} />;
    }
    return <Text color={color} size={size} text={'$0.00'} {...props} />;
  }

  if (!shown) {
    return <></>;
  }

  if (isNaN(koinu)) {
    return <></>;
  }

  if (isLoadingCoinPrice) {
    return <Spin size={'small'} />;
  }

  if (bracket) {
    return <Text color={color} size={size} text={`($${usd})`} {...props} />;
  }
  return <Text color={color} size={size} text={`$${usd}`} {...props} />;
}
