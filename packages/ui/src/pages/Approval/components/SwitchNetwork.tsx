import { NETWORK_TYPES } from '@dojak/core/constant';
import { NetworkType } from '@dojak/core/types';
import { Button, Card, Column, Content, Footer, Header, Layout, Row, Text } from '@dojak/ui/components';
import WebsiteBar from '@dojak/ui/components/WebsiteBar';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useNetworkType } from '@dojak/ui/state/settings/hooks';
import { useApproval } from '@dojak/ui/utils';

interface Props {
  params: {
    data: {
      networkType: NetworkType;
    };
    session: {
      origin: string;
      icon: string;
      name: string;
    };
  };
}

export default function SwitchNetwork({ params: { data, session } }: Props) {
  const networkType = useNetworkType();
  const from = NETWORK_TYPES[networkType];
  const to = NETWORK_TYPES[data.networkType];
  const { t } = useI18n();

  const [getApproval, resolveApproval, rejectApproval] = useApproval();

  const handleCancel = () => {
    rejectApproval(t('user_rejected_the_request'));
  };

  const handleConnect = async () => {
    resolveApproval();
  };

  return (
    <Layout>
      <Header>
        <WebsiteBar session={session} />
      </Header>
      <Content>
        <Column mt="lg">
          <Text text={t('allow_this_site_to_switch_the_network')} textCenter preset="title-bold" mt="lg" />

          <Row justifyBetween itemsCenter mt="lg">
            <Card preset="style2" px="lg">
              <Text text={from.label} preset="title-bold" />
            </Card>
            <Text text=">" />
            <Card preset="style2" px="lg">
              <Text text={to.label} preset="title-bold" />
            </Card>
          </Row>
        </Column>
      </Content>

      <Footer>
        <Row full>
          <Button text={t('cancel')} preset="default" onClick={handleCancel} full />
          <Button text={t('switch_network')} preset="primary" onClick={handleConnect} full />
        </Row>
      </Footer>
    </Layout>
  );
}
