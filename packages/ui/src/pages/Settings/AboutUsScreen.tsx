import { useEffect, useState } from 'react';

import { VERSION } from '@dojak/core/constant';
import { Column, Content, Header, Icon, Layout, Row, Text } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useNavigate } from '@dojak/ui/pages/MainRoute';
import { useDeveloperMode, useSetDeveloperModeCallback } from '@dojak/ui/state/settings/hooks';
import { spacing } from '@dojak/ui/theme/spacing';

export default function AboutUsScreen() {
  const navigate = useNavigate();
  const hasUpdate = false; // Disabled version checking - always false
  const { t } = useI18n();
  const tools = useTools();
  const developerMode = useDeveloperMode();
  const setDeveloperMode = useSetDeveloperModeCallback();

  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  useEffect(() => {
    if (tapCount >= 10) {
      const newMode = !developerMode;
      setDeveloperMode(newMode);
      tools.toastSuccess(newMode ? t('developer_mode_enabled') : t('developer_mode_disabled'));
      setTapCount(0);
    }
  }, [tapCount, developerMode, setDeveloperMode, tools, t]);

  const handleVersionTap = () => {
    const now = Date.now();
    const timeDiff = now - lastTapTime;

    if (timeDiff < 500) {
      setTapCount((prev) => prev + 1);
    } else {
      setTapCount(1);
    }

    setLastTapTime(now);
  };

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('about_us')}
      />
      <Content style={{ padding: 2 }}>
        <Column gap="lg" style={{ padding: spacing.small }}>
          {/* Logo Section */}
          <Column itemsCenter style={{ marginTop: spacing.tiny }}>
            <img 
              src="/images/logo/dojak-logo-full-dark.png" 
              alt="Dojak Logo" 
              style={{ width: '160px', height: 'auto' }} 
            />
          </Column>

          {/* App Name */}
          <Column itemsCenter>
            <Text text="Dojak Wallet" preset="title-bold" size="xxl" />
          </Column>

          {/* Version Info */}
          <Column itemsCenter>
            <Text
              text={`${t('version')} ${VERSION}${developerMode ? ' (Dev)' : ''}`}
              preset="sub"
              color={developerMode ? 'gold' : 'textDim'}
              onClick={handleVersionTap}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            />
          </Column>

          {/* Update Status */}
          <Column itemsCenter>
            {hasUpdate ? (
              <Row
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(235, 185, 76, 0.6)',
                  cursor: 'pointer',
                  width: 173,
                  height: 32,
                  justifyContent: 'center',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  gap: 0
                }}
                onClick={() => window.open('https://dojak.dog/extension/update')}
              >
                <Icon icon="arrowUp" size={14} />
                <Text
                  text={t('new_update_available')}
                  style={{ marginLeft: 3, whiteSpace: 'nowrap', color: '#00FF88' }}
                />
              </Row>
            ) : null}
          </Column>

          {/* Terms of Service & Privacy Policy */}
          <Column style={{ width: '100%', marginTop: spacing.large }}>
            <div
              style={{
                width: '328px',
                height: '104px',
                flexShrink: 0,
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.06)',
                margin: '0 auto'
              }}
            >
              <Row
                style={{
                  width: '100%',
                  padding: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  height: '52px'
                }}
                onClick={() => navigate('TermsOfServiceScreen')}
              >
                <Row style={{ justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Text text={t('terms_of_service')} preset="regular" size="sm" style={{ color: 'white' }} />
                  <Icon icon="arrow-right" size={20} color="textDim" />
                </Row>
              </Row>
              <Row
                style={{
                  width: '100%',
                  padding: '16px',
                  cursor: 'pointer',
                  height: '52px'
                }}
                onClick={() => navigate('PrivacyPolicyScreen')}
              >
                <Row style={{ justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Text text={t('privacy_policy')} preset="regular" size="sm" style={{ color: 'white' }} />
                  <Icon icon="arrow-right" size={20} color="textDim" />
                </Row>
              </Row>
            </div>
          </Column>
        </Column>
      </Content>
    </Layout>
  );
}
