import { HARDWARE_WALLETS, HardwareWalletType } from '@dojak/core/constant';
import { Card, Column, Image, Row, Text } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import { BottomModal } from '@dojak/ui/components/BottomModal';
import { useExtensionIsInTab } from '@dojak/ui/features/browser/tabs';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { colors } from '@dojak/ui/theme/colors';
import { useWallet } from '@dojak/ui/utils';
import { CloseOutlined } from '@ant-design/icons';

import { useNavigate } from '../MainRoute';

function WalletItem(props: { walletType: HardwareWalletType; onClick?: () => void; disabled?: boolean }) {
  const walletInfo = HARDWARE_WALLETS[props.walletType];
  const tools = useTools();
  const { t } = useI18n();

  return (
    <Card
      style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, opacity: props.disabled ? 0.4 : 1 }}
      mt="lg"
      onClick={() => {
        if (props.disabled) {
          tools.toast(t('coming_soon'));
        } else {
          props.onClick && props.onClick();
        }
      }}
    >
      <Row fullX>
        <Row itemsCenter>
          <Image src={walletInfo.img} size={30} />
          <Text text={walletInfo.name} />
        </Row>
      </Row>
    </Card>
  );
}

export const ConnectHardwareModal = ({ onClose }: { onClose: () => void }) => {
  const wallet = useWallet();

  const isInTab = useExtensionIsInTab();
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <BottomModal onClose={onClose}>
      <Column justifyCenter itemsCenter>
        <Row justifyBetween itemsCenter style={{ height: 20 }} fullX>
          <Row />
          <Text text={t('connect_to_hardware_wallet')} textCenter size="md" />
          <Row
            onClick={() => {
              onClose();
            }}
          >
            <CloseOutlined />
          </Row>
        </Row>

        <Row fullX style={{ borderTopWidth: 1, borderColor: colors.border }} my="md" />

        <Column gap="zero" mt="sm" mb="lg">
          <Text
            size="sm"
            color="textDim"
            text={t('hardware_wallet_feature_is_experimental_use_it_with_caution_as_potential_issues_may_arise')}
          />

          <WalletItem
            walletType={HardwareWalletType.Keystone}
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
          />

          <WalletItem walletType={HardwareWalletType.Ledger} disabled />
          <WalletItem walletType={HardwareWalletType.Trezor} disabled />
        </Column>
      </Column>
    </BottomModal>
  );
};
