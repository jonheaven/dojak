import { useEffect, useMemo, useState } from 'react';

import { VersionDetail } from '@/shared/types';
import { Card, Column, Content, Footer, Header, Layout, Row, Text } from '@/ui/components';
import AccountSelect from '@/ui/components/AccountSelect';
import { FeeRateIcon } from '@/ui/components/FeeRateIcon';
import LoadingPage from '@/ui/components/LoadingPage';
import { NavTabBar } from '@/ui/components/NavTabBar';
import { NoticePopover } from '@/ui/components/NoticePopover';
import { SwitchNetworkBar } from '@/ui/components/SwitchNetworkBar';
import { Tabs } from '@/ui/components/Tabs';
import { UpgradePopover } from '@/ui/components/UpgradePopover';
import { VersionNotice } from '@/ui/components/VersionNotice';
import { getCurrentTab } from '@/ui/features/browser/tabs';
import { useI18n } from '@/ui/hooks/useI18n';
import { useAccountBalance, useAddressSummary, useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useIsUnlocked } from '@/ui/state/global/hooks';
import { useAppDispatch } from '@/ui/state/hooks';
import { useCurrentKeyring } from '@/ui/state/keyrings/hooks';
import {
  useAddressTips,
  useChain,
  useSkipVersionCallback,
  useVersionInfo,
  useWalletConfig
} from '@/ui/state/settings/hooks';
import { useAssetTabKey, useSupportedAssets } from '@/ui/state/ui/hooks';
import { AssetTabKey, uiActions } from '@/ui/state/ui/reducer';
import { getUiType, useWallet } from '@/ui/utils';
import { KeyringType } from '@unisat/keyring-service/types';

import { useNavigate } from '../../MainRoute';
import { SwitchChainModal } from '../../Settings/SwitchChainModal';
import { CollectiblesTab } from './CollectiblesTab';
import { TokensTab } from './TokensTab';
import { WoofTab } from './WoofTab';
import { SidePanelExpand } from './SidePanelExpand';
import { SteakTab } from './SteakTab';
import { BalanceCard } from './components/BalanceCard';
import { WalletActions } from './components/WalletActions';

const STORAGE_VERSION_KEY = 'version_detail';

export default function WalletTabScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const accountBalance = useAccountBalance();

  const chain = useChain();

  const addressTips = useAddressTips();

  const currentKeyring = useCurrentKeyring();
  const currentAccount = useCurrentAccount();

  const wallet = useWallet();
  const [connected, setConnected] = useState(false);
  const dispatch = useAppDispatch();
  const assetTabKey = useAssetTabKey();

  const skipVersion = useSkipVersionCallback();

  const walletConfig = useWalletConfig();
  const versionInfo = useVersionInfo();

  const [showSafeNotice, setShowSafeNotice] = useState(false);
  const [showVersionNotice, setShowVersionNotice] = useState<VersionDetail | null>(null);

  const addressSummary = useAddressSummary();

  const isUnlocked = useIsUnlocked();

  const { isSidePanel } = getUiType();

  useEffect(() => {
    if (!isUnlocked) {
      navigate('UnlockScreen');
    }
  }, [isUnlocked]);

  useEffect(() => {
    const run = async () => {
      const show = await wallet.getShowSafeNotice();
      setShowSafeNotice(show);

      const activeTab = await getCurrentTab();
      if (!activeTab) return;
      const site = await wallet.getCurrentConnectedSite(activeTab.id);
      if (site) {
        setConnected(site.isConnected);
      }
    };
    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        let needFetchVersionDetail = false;
        const item = localStorage.getItem(STORAGE_VERSION_KEY);
        let versionDetail: VersionDetail | undefined = undefined;
        if (!item) {
          needFetchVersionDetail = true;
        } else {
          versionDetail = JSON.parse(item || '{}');
          if (versionDetail && versionDetail.version !== versionInfo.currentVesion) {
            needFetchVersionDetail = true;
          }
        }
        if (needFetchVersionDetail) {
          versionDetail = await wallet.getVersionDetail(versionInfo.currentVesion);
          localStorage.setItem(STORAGE_VERSION_KEY, JSON.stringify(versionDetail));

          if (versionDetail && versionDetail.notice) {
            setShowVersionNotice(versionDetail);
          }
        }
      } catch (e) {
        console.log(e);
      }
    };
    run();
  }, []);

  const supportedAssets = useSupportedAssets();

  const tabItems = useMemo(() => {
    const items: {
      key: AssetTabKey;
      label: string;
      children: JSX.Element;
    }[] = [];

    // Collectibles tab - inscription collectibles (DNS, Dogemaps, NFTs)
    if (supportedAssets.assets.inscriptions) {
      items.push({
        key: AssetTabKey.COLLECTIBLES,
        label: t('Collectibles'),
        children: <CollectiblesTab key={AssetTabKey.COLLECTIBLES} />
      });
    }

    // Tokens tab - token types (DRC-20, Dunes, Charms)
    if (supportedAssets.assets.inscriptions) {
      items.push({
        key: AssetTabKey.TOKENS,
        label: t('Tokens'),
        children: <TokensTab key={AssetTabKey.TOKENS} />
      });
    }

    // Steak tab
    if (supportedAssets.assets.steak) {
      items.push({
        key: AssetTabKey.STEAK,
        label: 'Steak',
        children: <SteakTab key={AssetTabKey.STEAK} />
      });
    }

    // Woof tab
    if (supportedAssets.assets.woof) {
      items.push({
        key: AssetTabKey.WOOF,
        label: 'Woof',
        children: <WoofTab key={AssetTabKey.WOOF} />
      });
    }

    return items;
  }, [supportedAssets.assets.inscriptions, supportedAssets.assets.steak, supportedAssets.assets.woof, t]);

  const finalAssetTabKey = useMemo(() => {
    if (!supportedAssets.tabKeys.includes(assetTabKey)) {
      return AssetTabKey.COLLECTIBLES;
    }
    return assetTabKey;
  }, [assetTabKey, supportedAssets.key]);

  const [switchChainModalVisible, setSwitchChainModalVisible] = useState(false);

  if (!currentAccount.address) {
    return <LoadingPage />;
  }
  return (
    <Layout>
      <Header
        type="home"
        LeftComponent={
          <Card
            preset="style2"
            style={{ height: 28 }}
            onClick={() => {
              navigate('SwitchKeyringScreen');
            }}
          >
            <Text
              text={
                currentKeyring.type === KeyringType.ColdWalletKeyring
                  ? `❄️  ${currentKeyring.alianName}`
                  : currentKeyring.alianName
              }
              size="xxs"
              ellipsis
              style={{ maxWidth: 100 }}
            />
          </Card>
        }
        RightComponent={
          <Row>
            <FeeRateIcon />
            <SwitchNetworkBar />
            <SidePanelExpand />
          </Row>
        }
      />

      <Content style={{ overflowY: 'auto' }}>
        <Row
          full
          gap="lg"
          style={{
            alignItems: 'flex-start',
            // Stack columns vertically in side panel / narrow views
            flexDirection: isSidePanel ? 'column' : 'row'
          }}
        >
          {/* Left column: asset tabs and lists */}
          <Column
            gap="lg2"
            mt="md"
            style={{
              flex: 1,
              minWidth: 0
            }}
          >
            <Tabs
              defaultActiveKey={finalAssetTabKey as unknown as string}
              activeKey={finalAssetTabKey as unknown as string}
              items={tabItems as unknown as any[]}
              onTabClick={(key) => {
                dispatch(uiActions.updateAssetTabScreen({ assetTabKey: key as unknown as AssetTabKey }));
              }}
            />
          </Column>

          {/* Right column: account selector, warnings, balance, actions */}
          <Column
            gap="lg2"
            mt="md"
            style={{
              width: isSidePanel ? '100%' : 320,
              maxWidth: isSidePanel ? '100%' : 360,
              alignSelf: 'stretch'
            }}
          >
            <AccountSelect />

            {(walletConfig.chainTip || walletConfig.statusMessage || addressTips.homeTip) && (
              <Column
                py={'lg'}
                px={'md'}
                gap={'lg'}
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(245, 84, 84, 0.35)',
                  background: 'rgba(245, 84, 84, 0.08)'
                }}
              >
                {walletConfig.chainTip && <Text text={walletConfig.chainTip} color="text" textCenter />}
                {walletConfig.statusMessage && <Text text={walletConfig.statusMessage} color="danger" textCenter />}
                {addressTips.homeTip && <Text text={addressTips.homeTip} color="warning" textCenter />}
              </Column>
            )}

            <BalanceCard
              accountBalance={accountBalance}
              disableUtxoTools={walletConfig.disableUtxoTools}
              enableRefresh={isSidePanel}
              address={currentAccount?.address}
            />

            <WalletActions address={currentAccount?.address} chain={chain} />
          </Column>
        </Row>
        {showSafeNotice && (
          <NoticePopover
            onClose={() => {
              wallet.setShowSafeNotice(false);
              setShowSafeNotice(false);
            }}
          />
        )}
        {!versionInfo.skipped && (
          <UpgradePopover
            onClose={() => {
              skipVersion(versionInfo.newVersion);
            }}
          />
        )}

        {switchChainModalVisible && (
          <SwitchChainModal
            onClose={() => {
              setSwitchChainModalVisible(false);
            }}
          />
        )}

        {showVersionNotice && (
          <VersionNotice
            notice={showVersionNotice}
            onClose={() => {
              setShowVersionNotice(null);
            }}
          />
        )}
      </Content>
      <Footer px="zero" py="zero">
        <NavTabBar tab="home" />
      </Footer>
    </Layout>
  );
}
