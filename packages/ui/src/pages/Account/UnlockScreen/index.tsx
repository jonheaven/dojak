import React, { useEffect, useState } from 'react';

import { Column, Content, Layout, Row } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import { Button } from '@dojak/ui/components/Button';
import { Input } from '@dojak/ui/components/Input';
import { Logo } from '@dojak/ui/components/Logo';
import { Text } from '@dojak/ui/components/Text';
import { BiometricSetupPrompt, BiometricStatusBadge, BiometricUnlockButton, useBiometricUnlock } from '@dojak/ui/features/biometric';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { useIsUnlocked, useUnlockCallback } from '@dojak/ui/state/global/hooks';
import { getUiType, useWallet } from '@dojak/ui/utils';

import { useNavigate } from '../../MainRoute';

export default function UnlockScreen() {
  const { t } = useI18n();
  const wallet = useWallet();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [disabled, setDisabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricMethod, setBiometricMethod] = useState('');
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);
  const UIType = getUiType();
  const isInNotification = UIType.isNotification;
  const unlock = useUnlockCallback();
  const tools = useTools();
  const isUnlocked = useIsUnlocked();
  const { getConfig, enableBiometric, disableBiometric, unlockWithBiometric } = useBiometricUnlock();

  useEffect(() => {
    if (isUnlocked) {
      navigate('MainScreen');
    }
  }, [isUnlocked, navigate]);

  useEffect(() => {
    let mounted = true;
    const loadBiometricConfig = async () => {
      const config = await getConfig();
      if (mounted) {
        setBiometricEnabled(config.enabled);
        setBiometricMethod(config.method);
      }
    };
    void loadBiometricConfig();
    return () => {
      mounted = false;
    };
  }, [getConfig]);

  const [loading, setLoading] = useState(false);

  const btnClick = async () => {
    try {
      if (loading) {
        return;
      }
      setLoading(true);
      await unlock(password);
      if (!biometricEnabled) {
        setShowSetupPrompt(true);
      }

      if (!isInNotification) {
        const hasVault = await wallet.hasVault();
        if (!hasVault) {
          // Password was set but wallet creation was interrupted
          // Continue to wallet creation with fromUnlock flag
          console.log('[UnlockScreen] No vault found, redirecting to wallet creation');
          navigate('CreateHDWalletScreen', { isImport: false, fromUnlock: true });
          return;
        } else {
          navigate('MainScreen');
          return;
        }
      }
    } catch (e) {
      console.log(e);
      tools.toastError(t('password_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    try {
      if (!password) {
        tools.toastError('Enter password first to enable biometrics.');
        return;
      }
      await enableBiometric(password);
      setBiometricEnabled(true);
      setBiometricMethod('webauthn-platform');
      setShowSetupPrompt(false);
      tools.toastSuccess('Biometric unlock enabled.');
    } catch (error) {
      tools.toastError(error instanceof Error ? error.message : 'Failed to enable biometric unlock');
    }
  };

  const handleBiometricUnlock = async () => {
    const result = await unlockWithBiometric();
    if (!result.ok) {
      tools.toastError(result.errorMessage || 'Biometric unlock failed. Use password fallback.');
    }
  };

  const handleOnKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!disabled && 'Enter' == e.key) {
      btnClick();
    }
  };

  useEffect(() => {
    if (password && loading === false) {
      setDisabled(false);
    } else {
      setDisabled(true);
    }
  }, [password]);
  return (
    <Layout>
      <Content preset="middle">
        <Column fullX>
          <Row justifyCenter>
            <Logo preset="intrinsic" />
          </Row>

          <Column gap="xl" mt="xxl">
            <Text preset="title-bold" text={t('enter_your_password')} textCenter />
            <Input
              preset="password"
              placeholder={t('password')}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => handleOnKeyUp(e as any)}
              autoFocus={true}
            />
            <Button disabled={disabled} text={t('unlock')} preset="primary" onClick={btnClick} />
            {biometricEnabled ? (
              <BiometricUnlockButton onClick={handleBiometricUnlock} text="Unlock with Fingerprint / Windows Hello" />
            ) : null}
            <BiometricStatusBadge enabled={biometricEnabled} method={biometricMethod} />
            {biometricEnabled ? (
              <Button
                text="Disable biometric unlock"
                preset="default"
                onClick={async () => {
                  await disableBiometric();
                  setBiometricEnabled(false);
                  setBiometricMethod('');
                }}
              />
            ) : null}
            {showSetupPrompt ? <BiometricSetupPrompt onEnable={handleEnableBiometric} onSkip={() => setShowSetupPrompt(false)} /> : null}
          </Column>
        </Column>
      </Content>
    </Layout>
  );
}
