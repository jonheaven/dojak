import { getRestoreWallets } from '@/shared/constant';
import { Button, Column, Text } from '@/ui/components';
import { useI18n } from '@/ui/hooks/useI18n';
import { ContextData, TabType, UpdateContextDataParams } from '@/ui/pages/Account/createHDWalletComponents/types';
import { useNavigate } from '@/ui/pages/MainRoute';

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
        const isRecommended = item.recommended;
        return (
          <Button
            key={index}
            preset={isRecommended ? "primary" : "default"}
            style={isRecommended ? {
              background: 'linear-gradient(90deg, #00DD66, #00AA44)',
              border: '2px solid #00FF88',
              boxShadow: '0 0 20px rgba(0, 255, 136, 0.6)',
              color: '#000000',
              fontWeight: 800
            } : {
              background: 'rgba(10, 31, 21, 0.9)',
              color: '#00FF88',
              border: '1px solid #004422'
            }}
            onClick={() => {
              // Check if this is the private key import option
              if (item.name === 'Private Key (Hex or WIF)') {
                // Navigate to private key import screen
                navigate('CreateSimpleWalletScreen');
                return;
              }

              // For mnemonic options, continue to STEP2
              updateContextData({
                tabType: TabType.STEP2,
                restoreWalletType: item.value
              });
            }}>
            <Text text={item.name} />
            {isRecommended && <Text text=" (Recommended)" preset="regular" style={{ fontSize: '12px', color: '#000', fontWeight: 'bold' }} />}
          </Button>
        );
      })}
    </Column>
  );
}


