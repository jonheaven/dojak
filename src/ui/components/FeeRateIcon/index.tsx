import { useEffect, useState } from 'react';

import { useI18n } from '@/ui/hooks/useI18n';
import { useChainType } from '@/ui/state/settings/hooks';
import { colors } from '@/ui/theme/colors';
import { useWallet } from '@/ui/utils';

import { Card } from '../Card';
import { Column } from '../Column';
import { Icon } from '../Icon';
import { Popover } from '../Popover';
import { Row } from '../Row';
import { Text } from '../Text';

enum FeeRateType {
  SLOW,
  AVG,
  FAST,
  CUSTOM
}

const FEE_TITLES = ['low_priority', 'medium_priority', 'high_priority'];

interface FeeOption {
  title: string;
  desc?: string;
  feeRate: number;
}
export function FeeRateIcon() {
  const wallet = useWallet();
  const [feeOptions, setFeeOptions] = useState<FeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [feeOptionVisible, setFeeOptionVisible] = useState(false);

  const chainType = useChainType();
  useEffect(() => {
    setLoading(true);
    setError(null);
    wallet
      .getFeeSummary()
      .then((v) => {
        try {
          if (v && v.list && Array.isArray(v.list)) {
            setFeeOptions(v.list);
          } else if (Array.isArray(v)) {
            // Handle if v itself is an array
            setFeeOptions(v);
          } else {
            console.warn('[FeeRateIcon] Unexpected fee summary structure:', v);
            setError('No fee data');
          }
        } catch (parseErr) {
          console.error('[FeeRateIcon] Error parsing fee data:', parseErr);
          setError('Failed to parse fee data');
        }
      })
      .catch((err) => {
        console.error('[FeeRateIcon] Error fetching fees:', err);
        setError('Failed to fetch fees');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [chainType]);

  const feeRate = feeOptions[FeeRateType.AVG] ? feeOptions[FeeRateType.AVG].feeRate : 0;

  let color = 'textDim';
  if (feeRate > 100) {
    color = 'red';
  } else if (feeRate > 20) {
    color = 'yellow';
  } else if (feeRate > 0) {
    color = 'yellow';
  }

  if (loading) {
    return (
      <Card
        preset="style2"
        style={{
          backgroundColor: 'rgba(255,255,255,0.12)',
          height: 28,
          borderRadius: 8,
          padding: '2px 4px',
          gap: 2
        }}
      >
        <Row>
          <Icon icon="gas" />
          <Text text="..." size="xxs" color="textDim" />
        </Row>
      </Card>
    );
  }

  if (error || feeOptions.length === 0) {
    return (
      <Card
        preset="style2"
        style={{
          backgroundColor: 'rgba(255,255,255,0.12)',
          height: 28,
          borderRadius: 8,
          padding: '2px 4px',
          gap: 2
        }}
      >
        <Row>
          <Icon icon="gas" />
          <Text text="-" size="xxs" color="textDim" title={error ? `Error: ${error}` : 'No fee data available'} />
        </Row>
      </Card>
    );
  }
  return (
    <Card
      preset="style2"
      style={{
        backgroundColor: 'rgba(255,255,255,0.12)',
        height: 28,
        borderRadius: 8,
        padding: '2px 4px',
        gap: 2
      }}
    >
      <Row
        onClick={() => {
          setFeeOptionVisible(true);
        }}
      >
        <Icon icon="gas" />
        <Text text={feeRate > 0 ? feeRate : '-'} size="xxs" color={color as any} />
      </Row>

      {feeOptionVisible ? (
        <FeeOptionsPopover
          feeOptions={feeOptions}
          onClose={() => {
            setFeeOptionVisible(false);
          }}
        />
      ) : null}
    </Card>
  );
}

function FeeOptionsPopover({ feeOptions, onClose }: { feeOptions: FeeOption[]; onClose: () => void }) {
  const { t } = useI18n();

  if (!feeOptions || feeOptions.length === 0) {
    return (
      <Popover onClose={onClose}>
        <Column style={{ minWidth: 250 }}>
          <Row style={{ borderBottomWidth: 1, borderColor: colors.border, marginBottom: 10, paddingBottom: 10 }}>
            <Text text={t('network_fee_2')} preset="bold" />
          </Row>
          <Text text="Unable to load network fees. Please try again later." color="textDim" />
        </Column>
      </Popover>
    );
  }

  return (
    <Popover onClose={onClose}>
      <Column>
        <Row style={{ borderBottomWidth: 1, borderColor: colors.border, marginBottom: 10, paddingBottom: 10 }}>
          <Text text={t('network_fee_2')} preset="bold" />
        </Row>
        {feeOptions.map((v, i) => {
          return (
            <Card
              key={i}
              mb="sm"
              preset="style1"
              itemsCenter
              style={{
                height: 50,
                minHeight: 50,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderBottomColor: colors.transparent,
                borderBottomWidth: 0.2
              }}
            >
              <Row justifyBetween full itemsCenter>
                <Column>
                  <Text color={'textDim'} size="sm" text={t(FEE_TITLES[i] || v.title)}></Text>
                </Column>

                <Row>
                  <Text color={'white'} size="sm" text={v.feeRate}></Text>
                  <Text color={'textDim'} size="sm" text="sats/vB"></Text>
                </Row>
              </Row>
            </Card>
          );
        })}
      </Column>
    </Popover>
  );
}
