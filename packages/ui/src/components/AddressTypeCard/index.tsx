import { ReactEventHandler } from 'react';

import { AddressAssets } from '@dojak/core/types';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useChain, useDOGEUnit } from '@dojak/ui/state/settings/hooks';
import { fontSizes } from '@dojak/ui/theme/font';
import { satoshisToDOGE } from '@dojak/ui/utils';

import { Card } from '../Card';
import { Column } from '../Column';
import { CopyableAddress } from '../CopyableAddress';
import { Icon } from '../Icon';
import { Image } from '../Image';
import { Row } from '../Row';
import { Text } from '../Text';

interface SingleAddressCardProps {
  label: string;
  address: string;
  checked: boolean;
  assets: AddressAssets;
  onClick?: ReactEventHandler<HTMLDivElement>;
}

interface MultiAddressCardProps {
  label: string;
  items: {
    address: string;
    path: string;
    satoshis: number;
  }[];
  checked: boolean;
  onClick?: ReactEventHandler<HTMLDivElement>;
}

type AddressTypeCardProps = SingleAddressCardProps | MultiAddressCardProps;

export function AddressTypeCard(props: AddressTypeCardProps) {
  const btcUnit = useDOGEUnit();
  const { label, checked, onClick } = props;
  const { t } = useI18n();
  const chain = useChain();

  const isSingle = 'address' in props;

  return (
    <Card px="zero" py="zero" gap="zero" rounded onClick={onClick}>
      <Column full>
        <Row justifyBetween px="md" pt="md">
          <Column justifyCenter>
            <Text text={label} size="xs" disableTranslate />
          </Column>
          <Column justifyCenter>{checked && <Icon icon="check" />}</Column>
        </Row>

        {isSingle ? (
          <>
            <Row justifyBetween px="md" pb="md">
              <CopyableAddress address={props.address} />
            </Row>
            {Boolean(props.assets.satoshis && props.assets.satoshis > 0) && (
              <Row justifyBetween bg="bg3" roundedBottom px="md" py="md">
                <Row justifyCenter>
                  <Image src={chain.icon} size={fontSizes.iconMiddle} />
                  <Text text={`${props.assets.total_doge} ${btcUnit}`} color="yellow" />
                </Row>
                <Row>
                  {props.assets.total_inscription > 0 && (
                    <Text text={`${props.assets.total_inscription} ${t('inscriptions_capital')}`} color="gold" preset="bold" />
                  )}
                </Row>
              </Row>
            )}
          </>
        ) : (
          props.items.map((v) => (
            <Row px="md" pb="sm" key={v.address} itemsCenter>
              <Row style={{ width: '120px' }} key={`${v.address}-copy`}>
                <CopyableAddress address={v.address} />
              </Row>

              <Text text={`(${v.path})`} size="xs" color="textDim" disableTranslate />

              {v.satoshis > 0 && (
                <Row justifyCenter gap="zero" itemsCenter key={`${v.address}-balance`}>
                  <Icon icon="btc" size={fontSizes.iconMiddle} />
                  <Text text={`${satoshisToDOGE(v.satoshis)} ${btcUnit}`} color="yellow" size="xxxs" />
                </Row>
              )}
            </Row>
          ))
        )}
      </Column>
    </Card>
  );
}
