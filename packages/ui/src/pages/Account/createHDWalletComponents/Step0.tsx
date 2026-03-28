import { getRestoreWallets } from '@dojak/core/constant';
import { Button, Column, Text } from '@dojak/ui/components';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { ContextData, TabType, UpdateContextDataParams } from '@dojak/ui/pages/Account/createHDWalletComponents/types';
import { useNavigate } from '@dojak/ui/pages/MainRoute';

export function Step0({
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Column gap="lg">
      <Text text="Restore Dojak Wallet" preset="title-bold" textCenter mt="xl" />
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

              // For mnemonic options, continue to import step (now STEP2 is removed, so go to STEP1_Import or next relevant step)
              updateContextData({
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
