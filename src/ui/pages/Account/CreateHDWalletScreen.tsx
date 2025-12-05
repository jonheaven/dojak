import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { AddressType, RestoreWalletType } from '@/shared/types';
import { Content, Header, Layout, Row } from '@/ui/components';
import { TabBar } from '@/ui/components/TabBar';
import { useI18n } from '@/ui/hooks/useI18n';
import { MnemonicDisplay } from '@/ui/pages/Account/createHDWalletComponents/MnemonicDisplay';
import { Step0 } from '@/ui/pages/Account/createHDWalletComponents/Step0';
import { Step1_Import } from '@/ui/pages/Account/createHDWalletComponents/Step1_Import';
import {
  ContextData,
  TabType,
  UpdateContextDataParams,
  WordsType
} from '@/ui/pages/Account/createHDWalletComponents/types';
import { useWallet } from '@/ui/utils';

import { useNavigate } from '../MainRoute';

export default function CreateHDWalletScreen() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const wallet = useWallet();
  const { state } = useLocation();
  const { isImport, fromUnlock } = state as {
    isImport: boolean;
    fromUnlock: boolean;
  };

  // Check if wallet is booted but not unlocked (interrupted flow)
  useEffect(() => {
    const checkUnlockStatus = async () => {
      const isBooted = await wallet.isBooted();
      const isUnlocked = await wallet.isUnlocked();
      const hasVault = await wallet.hasVault();

      console.log('[CreateHDWalletScreen] Status check:', { isBooted, isUnlocked, hasVault, fromUnlock });

      // If booted but not unlocked and we're not coming from unlock screen, need to unlock first
      if (isBooted && !isUnlocked && !fromUnlock && !hasVault) {
        console.log('[CreateHDWalletScreen] Redirecting to unlock screen');
        navigate('UnlockScreen');
      }
    };

    checkUnlockStatus();
  }, [wallet, fromUnlock, navigate]);

  const [contextData, setContextData] = useState<ContextData>({
    mnemonics: '',
    hdPath: '',
    passphrase: '',
    addressType: AddressType.P2WPKH,
    mnemonicConfirmed: false,
    tabType: TabType.MNEMONIC,
    restoreWalletType: RestoreWalletType.dojak,
    isRestore: isImport,
    isCustom: false,
    customHdPath: '',
    addressTypeIndex: 0,
    wordsType: WordsType.WORDS_12
  });

  const updateContextData = useCallback(
    (params: UpdateContextDataParams) => {
      setContextData(Object.assign({}, contextData, params));
    },
    [contextData, setContextData]
  );

  const items = useMemo(() => {
    if (contextData.isRestore) {
      return [
        {
          key: TabType.MNEMONIC,
          label: t('secret_recovery_phrase'),
          children: <Step0 contextData={contextData} updateContextData={updateContextData} />
        },
        {
          key: TabType.STEP2,
          label: t('step_2'),
          children: <Step1_Import contextData={contextData} updateContextData={updateContextData} />
        }
      ];
    } else {
      return [
        {
          key: TabType.MNEMONIC,
          label: t('secret_recovery_phrase'),
          children: <MnemonicDisplay contextData={contextData} updateContextData={updateContextData} />
        }
      ];
    }
  }, [contextData, updateContextData]);

  const currentChildren = useMemo(() => {
    const item = items.find((v) => v.key === contextData.tabType);
    return item?.children;
  }, [items, contextData.tabType]);

  const activeTabIndex = useMemo(() => {
    const index = items.findIndex((v) => v.key === contextData.tabType);
    if (index === -1) {
      return 0;
    } else {
      return index;
    }
  }, [items, contextData.tabType]);
  return (
    <Layout>
      <Header
        onBack={() => {
          if (fromUnlock) {
            navigate('WelcomeScreen');
          } else {
            window.history.go(-1);
          }
        }}
        title={contextData.isRestore ? t('restore_from_mnemonics') : t('create_a_new_hd_wallet')}
      />
      <Content>
        <Row justifyCenter>
          <TabBar
            progressEnabled
            defaultActiveKey={contextData.tabType}
            activeKey={contextData.tabType}
            items={items.map((v) => ({
              key: v.key,
              label: v.label
            }))}
            onTabClick={(key) => {
              const toTabType = key as TabType;
              // Only one step now, so no need to check for step completion
              updateContextData({ tabType: toTabType });
            }}
          />
        </Row>

        {currentChildren}
      </Content>
    </Layout>
  );
}
