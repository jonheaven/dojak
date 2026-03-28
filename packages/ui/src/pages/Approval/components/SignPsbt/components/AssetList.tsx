import { Column, Row, Text } from '@dojak/ui/components';
import CharmsNFTPreview from '@dojak/ui/components/CharmsNFTPreview';
import CharmsPreviewCard from '@dojak/ui/components/CharmsPreviewCard/CharmsPreviewCard';
import DunesPreviewCard from '@dojak/ui/components/DunesPreviewCard';
import InscriptionPreview from '@dojak/ui/components/InscriptionPreview';

const AssetList = ({ inscriptions, dunes, txInfo, Charms, t, isToSign, isMyAddress, dunesPriceMap }) => {
  // use provided properties isToSign or isMyAddress to determine text color
  const textColor = isToSign ? 'white' : isMyAddress ? 'white' : 'textDim';

  return (
    <>
      {inscriptions.length > 0 && (
        <Row>
          <Column justifyCenter>
            <Text text={`${t('inscriptions')} (${inscriptions.length})`} color={textColor} />
            <Row overflowX gap="lg" style={{ width: 280 }} pb="lg">
              {inscriptions.map((w) => (
                <InscriptionPreview
                  key={w.inscriptionId}
                  data={txInfo.decodedPsbt.inscriptions[w.inscriptionId]}
                  preset="small"
                  hideValue
                  onClick={() => {
                    window.open(txInfo.decodedPsbt.inscriptions[w.inscriptionId]?.preview);
                  }}
                />
              ))}
            </Row>
          </Column>
        </Row>
      )}

      {dunes.length > 0 && (
        <Row>
          <Column justifyCenter>
            <Text text={t('dunes')} color={textColor} />
            <Row overflowX gap="lg" style={{ width: 280 }} pb="lg">
              {dunes.map((w) => (
                <DunesPreviewCard key={w.runeid} balance={w} price={dunesPriceMap?.[w.spacedDune]} />
              ))}
            </Row>
          </Column>
        </Row>
      )}

      {Charms.length > 0 && (
        <Row>
          <Column justifyCenter>
            <Text text={t('Charms') || 'Charms'} color={textColor} />
            <Row overflowX gap="lg" style={{ width: 280 }} pb="lg">
              {Charms.map((v) => {
                if (v.type === 'nft') {
                  return <CharmsNFTPreview key={v.charmsid} CharmsInfo={v} preset="small" />;
                } else {
                  return <CharmsPreviewCard key={v.charmsid} balance={v} />;
                }
              })}
            </Row>
          </Column>
        </Row>
      )}
    </>
  );
};

export default AssetList;
