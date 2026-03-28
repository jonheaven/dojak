/* eslint-disable quotes */
import { useEffect, useState } from 'react';

import { Button, Column, Content, Layout, Row, Text } from '@dojak/ui/components';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useWallet } from '@dojak/ui/utils';

import { useNavigate } from '../MainRoute';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const { t } = useI18n();
  const [checkedUnlock, setCheckedUnlock] = useState(false);

  useEffect(() => {
    (async () => {
      const hasVault = await wallet.hasVault();
      if (!hasVault) {
        // No vault, so prompt to create password
        setCheckedUnlock(true);
        return;
      }
      const isUnlocked = await wallet.isUnlocked();
      if (!isUnlocked) {
        navigate('UnlockScreen');
      } else {
        setCheckedUnlock(true);
      }
    })();
  }, [wallet, navigate]);

  if (!checkedUnlock) return null;

  return (
    <Layout>
      <Content preset="middle">
        <Column fullX>
          <Row justifyCenter>
            <video
              autoPlay
              muted
              loop
              playsInline
              style={{
                width: '300px',
                height: '200px',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}
            >
              <source src="./images/logo/logointro.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </Row>
          <Row justifyCenter mt="lg">
            <Text
              text="Dojak"
              preset="title-bold"
              size="xxxl"
              style={{
                fontFamily: 'Satoshi',
                fontSize: '48px',
                fontWeight: '900',
                background: 'linear-gradient(135deg, #C9822A 0%, #E5A03A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                letterSpacing: '-0.02em'
              }}
            />
          </Row>
          <Column gap="xl" mt="xl">
            <Text
              text={t(
                'inscribe_and_store_your_inscriptions_in_the_worlds_first_open_source_chrome_wallet_for_doginals'
              )}
              preset="sub"
              textCenter
            />
            <Button
              text={t('create_new_wallet')}
              preset="primary"
              onClick={async () => {
                const isBooted = await wallet.isBooted();
                if (isBooted) {
                  navigate('CreateHDWalletScreen', { isImport: false });
                } else {
                  navigate('CreatePasswordScreen', { isNewAccount: true });
                }
              }}
            />
            <Button
              text={t('i_already_have_a_wallet')}
              preset="default"
              onClick={async () => {
                const isBooted = await wallet.isBooted();
                if (isBooted) {
                  navigate('CreateHDWalletScreen', { isImport: true });
                } else {
                  navigate('CreatePasswordScreen', { isNewAccount: false });
                }
              }}
            />
            {/* TODO: Hardware wallet support - hidden until fully implemented */}
          </Column>
        </Column>
      </Content>
    </Layout>
  );
}
