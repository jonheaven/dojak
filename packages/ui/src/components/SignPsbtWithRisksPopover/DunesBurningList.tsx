import BigNumber from 'bignumber.js';

import { dunesUtils } from '@dojak/core/lib/dunes-utils';
import { DecodedPsbt } from '@dojak/core/types';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { colors } from '@dojak/ui/theme/colors';

import { Column } from '../Column';
import { Icon } from '../Icon';
import { Popover } from '../Popover';
import { Row } from '../Row';
import { Text } from '../Text';

export const DunesBurningList = ({ decodedPsbt, onClose }: { decodedPsbt: DecodedPsbt; onClose: () => void }) => {
  const inputTokenMap: {
    [ticker: string]: {
      amount: string;
      symbol: string;
      divisibility: number;
      spacedDune: string;
    };
  } = {};

  const { t } = useI18n();

  decodedPsbt.inputInfos.forEach((inputInfo) => {
    (inputInfo.dunes || []).forEach((balance) => {
      const duneid = balance.duneid || '';
      inputTokenMap[duneid] = inputTokenMap[duneid] || {
        amount: '0',
        symbol: balance.symbol,
        divisibility: balance.divisibility,
        spacedDune: balance.spacedDune
      };
      inputTokenMap[duneid].amount = BigNumber(inputTokenMap[duneid].amount).plus(balance.amount).toString();
    });
  });

  const outputTokenMap: {
    [ticker: string]: {
      amount: string;
      symbol: string;
      divisibility: number;
      spacedDune: string;
    };
  } = {};
  decodedPsbt.outputInfos.forEach((outputInfo) => {
    (outputInfo.dunes || []).forEach((balance) => {
      const duneid = balance.duneid || '';
      outputTokenMap[duneid] = outputTokenMap[duneid] || {
        amount: '0',
        symbol: balance.symbol,
        divisibility: balance.divisibility,
        spacedDune: balance.spacedDune
      };
      outputTokenMap[duneid] = outputTokenMap[duneid] || 0;
      outputTokenMap[duneid].amount = BigNumber(outputTokenMap[duneid].amount).plus(balance.amount).toString();
    });
  });

  const burnList: {
    amount: string;
    symbol: string;
    divisibility: number;
    spacedDune: string;
  }[] = [];
  Object.keys(inputTokenMap).forEach((ticker) => {
    if (outputTokenMap[ticker]) {
      const inputAmount = BigNumber(inputTokenMap[ticker].amount);
      const outputAmount = BigNumber(outputTokenMap[ticker].amount);
      if (inputAmount.isGreaterThan(outputAmount)) {
        burnList.push({
          amount: inputAmount.minus(outputAmount).toString(),
          symbol: inputTokenMap[ticker].symbol,
          divisibility: inputTokenMap[ticker].divisibility,
          spacedDune: inputTokenMap[ticker].spacedDune
        });
      }
    } else {
      burnList.push({
        amount: inputTokenMap[ticker].amount,
        symbol: inputTokenMap[ticker].symbol,
        divisibility: inputTokenMap[ticker].divisibility,
        spacedDune: inputTokenMap[ticker].spacedDune
      });
    }
  });

  return (
    <Popover>
      <Column justifyCenter itemsCenter>
        <Row fullX justifyBetween>
          <Row />
          <Text text={t('dunes_burn_risk_list')} preset="bold" />
          <Icon
            icon="close"
            onClick={() => {
              onClose();
            }}
          />
        </Row>

        <Row fullX style={{ borderBottomWidth: 1, borderColor: colors.border }} />

        {burnList.map((burn, index) => {
          return (
            <Row
              key={'dunes_burn_' + index}
              justifyBetween
              fullX
              px="md"
              py="xl"
              style={{
                backgroundColor: '#1e1a1e',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#442326'
              }}
            >
              <Row>
                <Icon icon="burn" color="red" />
                <Text text={burn.spacedDune} />
              </Row>

              <Text text={`${dunesUtils.toDecimalAmount(burn.amount, burn.divisibility)} ${burn.symbol}`} />
            </Row>
          );
        })}
      </Column>
    </Popover>
  );
};
