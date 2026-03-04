import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Button, Column, Content, Input, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useI18n } from '@/ui/hooks/useI18n';
import { useWallet, useWalletRequest } from '@/ui/utils';
import { getPasswordStrengthWord, MIN_PASSWORD_LENGTH } from '@/ui/utils/password-utils';

import { useNavigate } from '../MainRoute';

type Status = '' | 'error' | 'warning' | undefined;

export default function CreatePasswordScreen() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  let state = {};
  if (loc.state) {
    state = loc.state;
  }
  if ((params as any).size > 0) {
    params.forEach((value, key) => {
      state[key] = value;
    });
  }
  const { isNewAccount, isKeystone, fromColdWallet } = state as {
    isNewAccount: boolean;
    isKeystone: boolean;
    fromColdWallet: boolean;
  };
  const [newPassword, setNewPassword] = useState('');
  const { t } = useI18n();

  const [confirmPassword, setConfirmPassword] = useState('');

  const [disabled, setDisabled] = useState(true);

  const tools = useTools();
  const [run, loading] = useWalletRequest(wallet.boot, {
    onSuccess() {
      if (fromColdWallet) {
        navigate('CreateColdWalletScreen', { fromUnlock: true });
      } else if (isKeystone) {
        navigate('CreateKeystoneWalletScreen', { fromUnlock: true });
      } else if (isNewAccount) {
        navigate('CreateHDWalletScreen', { isImport: false, fromUnlock: true });
      } else {
        navigate('CreateHDWalletScreen', { isImport: true, fromUnlock: true });
      }
    },
    onError(err) {
      tools.toastError(err);
    }
  });

  const btnClick = () => {
    run(newPassword.trim());
  };

  useEffect(() => {
    setDisabled(true);

    if (newPassword && newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword) {
      setDisabled(false);
      return;
    }
  }, [newPassword, confirmPassword]);

  const strongText = useMemo(() => {
    if (!newPassword) {
      return;
    }
    const { text, color, tip } = getPasswordStrengthWord(newPassword);

    return (
      <Column>
        <Row>
          <Text size="s" text={t('password_strength')} />
          <Text size="s" text={text} style={{ color: color }} />
        </Row>
        {tip ? <Text size="s" preset="sub" text={tip} /> : null}
      </Column>
    );
  }, [newPassword]);

  const matchText = useMemo(() => {
    if (!confirmPassword) {
      return;
    }

    if (newPassword !== confirmPassword) {
      return (
        <Row>
          <Text size="s" text={t('passwords_dont_match')} color="red" />
        </Row>
      );
    } else {
      return;
    }
  }, [newPassword, confirmPassword]);

  const handleOnKeyUp = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!disabled && 'Enter' == e.key) {
      btnClick();
    }
  };

  return (
    <Layout>
      <Content preset="middle">
        <Column fullX justifyCenter itemsCenter style={{ minHeight: '100%', padding: '20px 0' }}>
          <Column gap="xl" style={{ width: '100%', maxWidth: '400px' }}>
            <Text text={t('create_a_password')} preset="title-bold" size="xxxl" textCenter />
            <Text text={t('you_will_use_this_to_unlock_your_wallet')} preset="sub" size="lg" textCenter />
            <Column>
              <Input
                preset="password"
                onChange={(e) => {
                  setNewPassword(e.target.value);
                }}
                autoFocus={true}
              />
              {strongText}
            </Column>

            <Column>
              <Input
                preset="password"
                placeholder={t('confirm_password')}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                }}
                onKeyUp={(e) => handleOnKeyUp(e as any)}
              />
              {matchText}
            </Column>

            <Button disabled={disabled} text={t('continue')} preset="primary" onClick={btnClick} />
          </Column>
        </Column>
      </Content>
    </Layout>
  );
}
