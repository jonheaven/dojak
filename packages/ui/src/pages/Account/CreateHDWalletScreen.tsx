import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { AddressType, RestoreWalletType } from '@dojak/core/types';
import { Content, Header, Layout, Row } from '@dojak/ui/components';
import { TabBar } from '@dojak/ui/components/TabBar';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { ImportOptions } from '@dojak/ui/pages/Account/createHDWalletComponents/ImportOptions';
import { MnemonicDisplay } from '@dojak/ui/pages/Account/createHDWalletComponents/MnemonicDisplay';
import { Step0 } from '@dojak/ui/pages/Account/createHDWalletComponents/Step0';
import { Step1_Import } from '@dojak/ui/pages/Account/createHDWalletComponents/Step1_Import';
import { Step2 } from '@dojak/ui/pages/Account/createHDWalletComponents/Step2';
import {
  ContextData,
  TabType,
  UpdateContextDataParams,
  WordsType
} from '@dojak/ui/pages/Account/createHDWalletComponents/types';
import { useWallet } from '@dojak/ui/utils';

import { useNavigate } from '../MainRoute';

export default function CreateHDWalletScreen() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const wallet = useWallet();
  const { state } = useLocation();
  const { isImport, fromUnlock, scannedData, fromQRScan, directImport, walletType } = (state as {
    isImport: boolean;
    fromUnlock: boolean;
    scannedData?: string;
    fromQRScan?: boolean;
    directImport?: boolean;
    walletType?: string;
  }) || {};

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

  // Update contextData when location state changes or sessionStorage has QR scan results
  useEffect(() => {
    // Check location state first (for direct navigation)
    if (scannedData && fromQRScan) {
      console.log('[CreateHDWalletScreen] Updating contextData with QR scan result from location state:', scannedData);
      const words = scannedData.split(/\s+/);
      setContextData(prev => ({
        ...prev,
        mnemonics: scannedData,
        tabType: TabType.STEP2,
        wordsType: words.length === 12 ? WordsType.WORDS_12 : WordsType.WORDS_24
      }));
      return;
    }

    // Check sessionStorage for QR scan results (when using history.back())
    const qrResult = sessionStorage.getItem('qr_scan_result');
    if (qrResult) {
      try {
        const parsedResult = JSON.parse(qrResult);
        // Only use recent results (within last 30 seconds)
        if (Date.now() - parsedResult.timestamp < 30000) {
          console.log('[CreateHDWalletScreen] Updating contextData with QR scan result from sessionStorage:', parsedResult.scannedData);
          const words = parsedResult.scannedData.split(/\s+/);
          setContextData(prev => ({
            ...prev,
            mnemonics: parsedResult.scannedData,
            tabType: TabType.STEP2,
            wordsType: words.length === 12 ? WordsType.WORDS_12 : WordsType.WORDS_24
          }));
          // Clean up the sessionStorage
          sessionStorage.removeItem('qr_scan_result');
        }
      } catch (error) {
        console.error('Error parsing QR scan result from sessionStorage:', error);
        sessionStorage.removeItem('qr_scan_result');
      }
    }
  }, [scannedData, fromQRScan]);

  const [contextData, setContextData] = useState<ContextData>({
    mnemonics: scannedData || '',
    hdPath: "m/44'/3'/0'/0", // Default Dogecoin HD path
    passphrase: '',
    addressType: AddressType.P2PKH, // Use P2PKH for Dogecoin addresses starting with 'D'
    mnemonicConfirmed: false,
    step1Completed: false,
    tabType: directImport ? TabType.STEP2 : (fromQRScan ? TabType.STEP2 : TabType.MNEMONIC),
    restoreWalletType: walletType as RestoreWalletType || RestoreWalletType.dojak,
    isRestore: isImport,
    isCustom: false,
    customHdPath: '',
    addressTypeIndex: 0,
    wordsType: scannedData ? (scannedData.split(/\s+/).length === 12 ? WordsType.WORDS_12 : WordsType.WORDS_24) : WordsType.WORDS_12,
    qrMode: false
  });

  const updateContextData = useCallback(
    (params: UpdateContextDataParams) => {
      setContextData(Object.assign({}, contextData, params));
    },
    [contextData, setContextData]
  );

  const phraseStep = {
    key: TabType.STEP2,
    label: '',
    children: <Step1_Import contextData={contextData} updateContextData={updateContextData} />
  };
  const addressStep = {
    key: TabType.STEP3,
    label: '',
    children: <Step2 contextData={contextData} updateContextData={updateContextData} />
  };

  const items = useMemo(() => {
    if (directImport) {
      return [phraseStep, addressStep];
    }
    if (contextData.isRestore) {
      return [
        {
          key: TabType.MNEMONIC,
          label: '',
          children: <ImportOptions contextData={contextData} updateContextData={updateContextData} />
        },
        phraseStep,
        addressStep
      ];
    }
    return [
      {
        key: TabType.MNEMONIC,
        label: t('secret_recovery_phrase'),
        children: <MnemonicDisplay contextData={contextData} updateContextData={updateContextData} />
      }
    ];
  }, [contextData, updateContextData, directImport, t]);

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
  const title =
    contextData.tabType === TabType.STEP3
      ? 'Confirm address'
      : contextData.isRestore
        ? t('restore_wallet')
        : t('create_a_new_hd_wallet');

  return (
    <Layout>
      <Header
        onBack={() => {
          if (contextData.tabType === TabType.STEP3) {
            updateContextData({ tabType: TabType.STEP2 });
            return;
          }
          if (contextData.tabType === TabType.STEP2 && contextData.isRestore && !directImport) {
            updateContextData({ tabType: TabType.MNEMONIC });
            return;
          }
          if (fromUnlock) {
            navigate('WelcomeScreen');
          } else {
            window.history.go(-1);
          }
        }}
        title={title}
      />
      <Content>
        {!contextData.isRestore && !directImport && (
          <Row justifyCenter>
            <TabBar
              progressEnabled
              defaultActiveKey={contextData.tabType}
              activeKey={contextData.tabType}
              items={items.map((v, index) => ({
                key: v.key || index,
                label: v.label
              }))}
              onTabClick={(key) => {
                const toTabType = key as TabType;
                // Only one step now, so no need to check for step completion
                updateContextData({ tabType: toTabType });
              }}
            />
          </Row>
        )}

        {currentChildren ?? (
          <Column gap="lg" style={{ padding: 24 }}>
            <Text
              text={
                contextData.mnemonics
                  ? 'Confirm the address for this phrase, then open the wallet.'
                  : 'Go back and enter your recovery phrase again.'
              }
              textCenter
            />
            {contextData.mnemonics ? (
              <Step2 contextData={contextData} updateContextData={updateContextData} />
            ) : null}
          </Column>
        )}
      </Content>
    </Layout>
  );
}
