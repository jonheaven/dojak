import React, { useCallback, useEffect, useState } from 'react';

import { AddressType } from '@/shared/types';
import { Button, Column, Content, Header, Input, Layout, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { FooterButtonContainer } from '@/ui/components/FooterButtonContainer';
import { useI18n } from '@/ui/hooks/useI18n';
import { useWallet } from '@/ui/utils';

import { useNavigate } from '../MainRoute';

function Step1({
  contextData,
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  const [wif, setWif] = useState('');
  const [disabled, setDisabled] = useState(true);
  const wallet = useWallet();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    setDisabled(true);

    if (!wif) {
      return;
    }

    setDisabled(false);
  }, [wif]);

  const onChange = (e) => {
    const val = e.target.value;
    setWif(val);
    updateContextData({ step1Completed: val });
  };

  const tools = useTools();

  const btnClick = async () => {
    try {
      const _res = await wallet.createTmpKeyringWithPrivateKey(wif, AddressType.P2PKH);
      if (_res.accounts.length == 0) {
        throw new Error(t('invalid_privatekey'));
      }
    } catch (e) {
      tools.toastError((e as Error).message);
      return;
    }

    // Skip address type selection and go directly to wallet creation
    try {
      await wallet.createKeyringWithPrivateKey(wif, AddressType.P2PKH);
      navigate('MainScreen');
    } catch (e) {
      console.error('Failed to create keyring:', e);
      tools.toastError((e as any).message);
    }
  };

  return (
    <Column gap="lg">
      <Text text={t('private_key')} textCenter preset="bold" />

      <Input
        placeholder={t('wif_private_key_or_hex_private_key')}
        onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if ('Enter' == e.key) {
            btnClick();
          }
        }}
        onChange={onChange}
        autoFocus={true}
      />
      <FooterButtonContainer>
        <Button disabled={disabled} text={t('continue')} preset="primary" onClick={btnClick} />
      </FooterButtonContainer>
    </Column>
  );
}

interface ContextData {
  wif: string;
  step1Completed: boolean;
}

interface UpdateContextDataParams {
  wif?: string;
  step1Completed?: boolean;
}

export default function CreateSimpleWalletScreen() {
  const [contextData, setContextData] = useState<ContextData>({
    wif: '',
    step1Completed: false
  });
  const { t } = useI18n();
  const updateContextData = useCallback(
    (params: UpdateContextDataParams) => {
      setContextData(Object.assign({}, contextData, params));
    },
    [contextData, setContextData]
  );

  const renderChildren = <Step1 contextData={contextData} updateContextData={updateContextData} />;

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('create_single_wallet')}
      />
      <Content>
        {renderChildren}
      </Content>
    </Layout>
  );
}


