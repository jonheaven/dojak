import { useState } from 'react';

import { Card, Column, Content, Header, Layout, Text } from '@dojak/ui/components';
import { useExtensionIsInTab } from '@dojak/ui/features/browser/tabs';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useDeveloperMode } from '@dojak/ui/state/settings/hooks';
import { useWallet } from '@dojak/ui/utils';

import { useNavigate } from '../MainRoute';

export default function AddKeyringScreen() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const isInTab = useExtensionIsInTab();
  const { t } = useI18n();
  const developerMode = useDeveloperMode();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('create_a_new_wallet')}
      />
      <Content>
        <Column>
          <Text text={t('create_wallet')} preset="regular-bold" />

          <Card
            justifyCenter
            onClick={(e) => {
              navigate('CreateHDWalletScreen', { isImport: false });
            }}
            onMouseEnter={() => setHoveredCard('create')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              border: hoveredCard === 'create' ? '3px solid #C9822A' : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: hoveredCard === 'create' ? '0 0 8px rgba(201, 130, 42, 0.3)' : 'none',
              transition: 'all 0.2s ease',
              backgroundColor: hoveredCard === 'create' ? 'rgba(20, 20, 20, 0.9)' : undefined
            }}
          >
            <Column full justifyCenter>
              <Text text={t('create_with_mnemonics_12words')} size="sm" />
            </Column>
          </Card>

          <Text text={t('restore_wallet')} preset="regular-bold" mt="lg" />

          <Card
            justifyCenter
            onClick={(e) => {
              navigate('CreateHDWalletScreen', { isImport: true });
            }}
            onMouseEnter={() => setHoveredCard('restore-mnemonic')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              border: hoveredCard === 'restore-mnemonic' ? '3px solid #C9822A' : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: hoveredCard === 'restore-mnemonic' ? '0 0 8px rgba(201, 130, 42, 0.3)' : 'none',
              transition: 'all 0.2s ease',
              backgroundColor: hoveredCard === 'restore-mnemonic' ? 'rgba(20, 20, 20, 0.9)' : undefined
            }}
          >
            <Column full justifyCenter>
              <Text text={t('restore_from_mnemonics_12words24words')} size="sm" />
            </Column>
          </Card>

          <Card
            justifyCenter
            onClick={(e) => {
              navigate('CreateSimpleWalletScreen');
            }}
            onMouseEnter={() => setHoveredCard('restore-private')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              border: hoveredCard === 'restore-private' ? '3px solid #C9822A' : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: hoveredCard === 'restore-private' ? '0 0 8px rgba(201, 130, 42, 0.3)' : 'none',
              transition: 'all 0.2s ease',
              backgroundColor: hoveredCard === 'restore-private' ? 'rgba(20, 20, 20, 0.9)' : undefined
            }}
          >
            <Column full justifyCenter>
              <Text text={t('restore_from_single_private_key')} size="sm" />
            </Column>
          </Card>

          <Card
            justifyCenter
            onClick={(e) => {
              navigate('QRScanScreen', { context: 'import' });
            }}
            onMouseEnter={() => setHoveredCard('restore-qr')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              border: hoveredCard === 'restore-qr' ? '3px solid #C9822A' : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: hoveredCard === 'restore-qr' ? '0 0 8px rgba(201, 130, 42, 0.3)' : 'none',
              transition: 'all 0.2s ease',
              backgroundColor: hoveredCard === 'restore-qr' ? 'rgba(20, 20, 20, 0.9)' : undefined
            }}
          >
            <Column full justifyCenter>
              <Text text="Restore via QR" size="sm" />
            </Column>
          </Card>

          <Text text={t('connect_to_hardware_wallet')} preset="regular-bold" mt="lg" />

          <Card
            justifyCenter
            onClick={async () => {
              const isBooted = await wallet.isBooted();
              if (!isInTab) {
                if (isBooted) {
                  window.open('#/account/create-keystone-wallet');
                } else {
                  window.open('#/account/create-password?isKeystone=true');
                }
                return;
              }
              if (isBooted) {
                navigate('CreateKeystoneWalletScreen');
              } else {
                navigate('CreatePasswordScreen', { isKeystone: true });
              }
            }}
            onMouseEnter={() => setHoveredCard('keystone')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              border: hoveredCard === 'keystone' ? '3px solid #C9822A' : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: hoveredCard === 'keystone' ? '0 0 8px rgba(201, 130, 42, 0.3)' : 'none',
              transition: 'all 0.2s ease',
              backgroundColor: hoveredCard === 'keystone' ? 'rgba(20, 20, 20, 0.9)' : undefined
            }}
          >
            <Column full justifyCenter>
              <Text text={t('keystone_wallet')} size="sm" />
            </Column>
          </Card>

          {developerMode && (
            <>
              <Text text={t('cold_wallet')} preset="regular-bold" mt="lg" />

              <Card
                justifyCenter
                onClick={() => {
                  navigate('CreateColdWalletScreen');
                }}
                onMouseEnter={() => setHoveredCard('cold')}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  border: hoveredCard === 'cold' ? '3px solid #C9822A' : '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: hoveredCard === 'cold' ? '0 0 8px rgba(201, 130, 42, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                  backgroundColor: hoveredCard === 'cold' ? 'rgba(20, 20, 20, 0.9)' : undefined
                }}
              >
                <Column full justifyCenter>
                  <Text text={t('create_cold_wallet')} size="sm" />
                </Column>
              </Card>
            </>
          )}
        </Column>
      </Content>
    </Layout>
  );
}
