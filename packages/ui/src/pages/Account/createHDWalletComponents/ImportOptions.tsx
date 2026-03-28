import { getRestoreWallets } from '@dojak/core/constant';
import { Button, Column, Text } from '@dojak/ui/components';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { ContextData, TabType, UpdateContextDataParams } from '@dojak/ui/pages/Account/createHDWalletComponents/types';
import { useNavigate } from '@dojak/ui/pages/MainRoute';

export function ImportOptions({
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Column gap="lg">
      <Text text="Import Dogecoin Wallet" preset="title-bold" textCenter mt="xl" />
      <Text text="Choose how you want to import your Dogecoin wallet" preset="regular" textCenter mb="md" />
      {getRestoreWallets().map((item, index) => {
        return (
          <Button
            key={index}
            preset="default"
            style={{
              background: 'rgba(20, 20, 20, 0.9)',
              color: '#E5A03A',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
            onClick={() => {
              // Check if this is the private key import option
              if (item.name === 'Private Key (Hex or WIF)') {
                // Navigate to private key import screen
                navigate('CreateSimpleWalletScreen');
                return;
              }

              // Check if this is the QR scan option
              if (item.value === 'qr-scan') {
                // Navigate to dedicated QR scan screen with import context
                navigate('QRScanScreen', { context: 'import' });
                return;
              }

              // For mnemonic options, switch to import screen directly
              updateContextData({
                tabType: TabType.STEP2,
                restoreWalletType: item.value
              });
            }}
          >
            <Text text={item.name} />
          </Button>
        );
      })}
    </Column>
  );
}
