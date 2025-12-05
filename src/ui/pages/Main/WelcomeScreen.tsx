/* eslint-disable quotes */
import { useEffect, useState } from 'react';

import { Button, Column, Content, Layout, Logo, Row, Text } from '@/ui/components';
import { useI18n } from '@/ui/hooks/useI18n';
import { useWallet } from '@/ui/utils';

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
            <Logo preset="intrinsic" />
          </Row>
          <Column gap="xl" mt="xxl">
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
