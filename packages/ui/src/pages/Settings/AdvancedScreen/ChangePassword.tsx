import { useNavigate } from 'react-router-dom';

import { Card, Icon, Row, Text } from '@dojak/ui/components';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { fontSizes } from '@dojak/ui/theme/font';

export function ChangePasswordCard() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <Card style={{ borderRadius: 10, cursor: 'pointer' }} onClick={() => navigate('/settings/password')}>
      <Row full justifyBetween>
        <Text text={t('change_password')} preset="bold" size="sm" />
        <Icon icon="right" size={fontSizes.lg} color="textDim" />
      </Row>
    </Card>
  );
}
