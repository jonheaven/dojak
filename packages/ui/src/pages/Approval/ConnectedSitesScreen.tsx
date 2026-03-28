import { useEffect, useState } from 'react';

import { ConnectedSite } from '@dojak/core/background/service/permission';
import { Card, Column, Content, Header, Icon, Image, Layout, Row, Text } from '@dojak/ui/components';
import { Empty } from '@dojak/ui/components/Empty';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { fontSizes } from '@dojak/ui/theme/font';
import { formatSessionIcon, useWallet } from '@dojak/ui/utils';

export default function ConnectedSitesScreen() {
  const wallet = useWallet();
  const { t } = useI18n();

  const [sites, setSites] = useState<ConnectedSite[]>([]);

  const getSites = async () => {
    const sites = await wallet.getConnectedSites();
    setSites(sites.filter((v) => v.origin));
  };

  useEffect(() => {
    getSites();
  }, []);

  const handleRemove = async (origin: string) => {
    await wallet.removeConnectedSite(origin);
    getSites();
  };
  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('connected_sites')}
      />
      <Content>
        <Column>
          {sites.length > 0 ? (
            sites.map((item, index) => {
              return (
                <Card key={item.origin}>
                  <Row full justifyBetween itemsCenter>
                    <Row itemsCenter>
                      <Image src={formatSessionIcon(item)} size={fontSizes.logo} />
                      <Text text={item.origin} preset="sub" />
                    </Row>
                    <Column justifyCenter>
                      <Icon
                        icon="close"
                        onClick={() => {
                          handleRemove(item.origin);
                        }}
                      />
                    </Column>
                  </Row>
                </Card>
              );
            })
          ) : (
            <Empty />
          )}
        </Column>
      </Content>
    </Layout>
  );
}
