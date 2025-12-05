import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { CharmsInfo } from '@/shared/types';
import { Button, Card, Column, Content, Header, Layout, Row, Text } from '@/ui/components';
import CharmsNFTPreview from '@/ui/components/CharmsNFTPreview';
import { Line } from '@/ui/components/Line';
import { Section } from '@/ui/components/Section';
import { useI18n } from '@/ui/hooks/useI18n';
import { useNavigate } from '@/ui/pages/MainRoute';
import { useWallet } from '@/ui/utils';

export default function CharmsNFTScreen() {
  const { state } = useLocation();
  const props = state as {
    CharmsInfo: CharmsInfo;
  };
  const { t } = useI18n();

  const CharmsInfo = props.CharmsInfo;

  const navigate = useNavigate();

  const [availableUtxo, setAvailableUtxo] = useState(0);
  const wallet = useWallet();

  useEffect(() => {
    const fetchData = async () => {
      const utxos = await wallet.getAssetUtxosCharms(CharmsInfo.charmsid);
      setAvailableUtxo(utxos.length);
    };
    fetchData();
  }, [wallet]);

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
      >
        <Row>
          <Text text={`${CharmsInfo.name} `} />
        </Row>
      </Header>
      <Content>
        <Row justifyCenter>
          <CharmsNFTPreview preset="large" CharmsInfo={CharmsInfo} />
        </Row>

        <Card style={{ borderRadius: 15 }}>
          <Column fullX my="sm">
            <Section title={t('name_label')} value={CharmsInfo.name} />
            <Line />

            <Section title={t('symbol_Charms')} value={CharmsInfo.symbol} />
            <Line />
            <Section title={'Charms ID'} value={CharmsInfo.charmsid} showCopyIcon />
          </Column>
        </Card>
        <Button
          text={t('send')}
          icon="send"
          preset="default"
          disabled={availableUtxo <= 0}
          onClick={(e) => {
            navigate('SendCharmsNFTScreen', {
              CharmsInfo: CharmsInfo
            });
          }}
        ></Button>
      </Content>
    </Layout>
  );
}
