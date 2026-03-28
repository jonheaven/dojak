import { Card, Column, Row, ScrollableList, Text } from '@dojak/ui/components';
import { AddressText } from '@dojak/ui/components/AddressText';
import { colors } from '@dojak/ui/theme/colors';
import { satoshisToAmount } from '@dojak/ui/utils';

import AssetList from './AssetList';
import ContractSection from './ContractSection';

const OutputsList = ({ txInfo, t, currentAccount, btcUnit, canChanged, dunesPriceMap, setContractPopoverData }) => {
  const outputInfos = txInfo.decodedPsbt.outputInfos;

  const renderOutputItem = (v, index) => {
    const isMyAddress = v.address === currentAccount.address;
    const inscriptions = v.inscriptions;
    const dunes = v.dunes || [];
    const Charms = v.Charms || [];

    // only show inscriptions when the condition is met
    const filteredInscriptions = !canChanged ? inscriptions : [];

    return (
      <Column style={index === 0 ? {} : { borderColor: colors.border, borderTopWidth: 1, paddingTop: 10 }}>
        <Column>
          <Row justifyBetween>
            <Column>
              <AddressText address={v.address} color={isMyAddress ? 'white' : 'textDim'} />
              {v.contract && <ContractSection contract={v.contract} setContractPopoverData={setContractPopoverData} />}
            </Column>

            <Row>
              <Text text={`${satoshisToAmount(v.value)}`} color={isMyAddress ? 'white' : 'textDim'} />
              <Text text={btcUnit} color="textDim" />
            </Row>
          </Row>
        </Column>

        <AssetList
          inscriptions={filteredInscriptions}
          dunes={dunes}
          txInfo={txInfo}
          Charms={Charms}
          t={t}
          isMyAddress={isMyAddress}
          dunesPriceMap={dunesPriceMap}
          isToSign={false}
        />
      </Column>
    );
  };

  return (
    <Column>
      <Text text={`${t('outputs')}: (${outputInfos.length})`} preset="bold" />
      <Card>
        <ScrollableList
          items={outputInfos}
          renderItem={renderOutputItem}
          maxVisibleItems={5}
          showScrollIndicator={true}
          showJumpButtons={true}
          emptyText={t('no_outputs')}
          itemHeight={70}
          style={{ width: '100%' }}
        />
      </Card>
    </Column>
  );
};

export default OutputsList;
