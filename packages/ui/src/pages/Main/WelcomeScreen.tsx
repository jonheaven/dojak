import { useEffect, useState } from 'react';

import { Button, Column, Content, Layout } from '@dojak/ui/components';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useWallet } from '@dojak/ui/utils';

import { useNavigate } from '../MainRoute';
import '../wallet-surfaces.css';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const { t } = useI18n();
  const [checkedUnlock, setCheckedUnlock] = useState(false);

  useEffect(() => {
    (async () => {
      const hasVault = await wallet.hasVault();
      if (!hasVault) {
        setCheckedUnlock(true);
        return;
      }
      const isUnlocked = await wallet.isUnlocked();
      if (!isUnlocked) {
        navigate('UnlockScreen');
      } else {
        navigate('MainScreen');
      }
    })();
  }, [wallet, navigate]);

  if (!checkedUnlock) return null;

  return (
    <Layout style={{ background: 'transparent' }}>
      <Content preset="middle">
        <div className="dj-welcome">
          <div className="dj-mark" aria-hidden>
            Ð
          </div>
          <div>
            <h1>Dojak</h1>
            <p style={{ marginTop: 10 }}>
              {t('inscribe_and_store_your_inscriptions_in_the_worlds_first_open_source_chrome_wallet_for_doginals')}
            </p>
          </div>
          <Column gap="md" fullX>
            <div className="dj-welcome-actions">
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
            </div>
          </Column>
        </div>
      </Content>
    </Layout>
  );
}
