import { Column, Content, Header, Icon, Layout, Row, Text } from '@dojak/ui/components';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { colors } from '@dojak/ui/theme/colors';
import { useLocationState } from '@dojak/ui/utils';

export default function TxFailScreen() {
  const { error } = useLocationState<{ error: string }>();
  const { t } = useI18n();

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
      />
      <Content>
        <Column justifyCenter mt="xxl" gap="xl">
          <Row justifyCenter>
            <Icon icon="delete" size={50} />
          </Row>

          <Text preset="title" text={t('payment_failed')} textCenter />
          <Text preset="sub" style={{ color: colors.red }} text={error} textCenter />
        </Column>
      </Content>
    </Layout>
  );
}
