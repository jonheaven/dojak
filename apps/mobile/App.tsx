import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createBiometricFacade,
  createNativeAdapters,
  createNativeSessionSecretStore
} from '@dojak/biometrics/mobile';
import { dogecoinKeyrings } from '@dojak/core';
import { DojakWallet, WalletCoreProvider, WalletTransaction } from '@dojak/ui';

import './global.css';

const BALANCE_KEY = 'dojak.balance';
const ADDRESS_KEY = 'dojak.address';
const TXS_KEY = 'dojak.txs';
const MNEMONIC_KEY = 'dojak.mnemonic';
const MOBILE_LOCK_PASSWORD_KEY = 'dojak.mobile.lock.password';
const MOBILE_BIOMETRIC_ENABLED_KEY = 'dojak.mobile.biometric.enabled';
const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

const fallbackAddress = 'D8n4gQ8S4aQszM4xTq3w9fF6xR9H1skGgT';
const fallbackMnemonic = 'test test test test test test test test test test test junk';

export default function App() {
  const [lockPassword, setLockPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSettingUpPassword, setIsSettingUpPassword] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [lockError, setLockError] = useState('');
  const sessionMnemonicRef = useRef<string | null>(null);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const biometricFacade = useMemo(
    () => createBiometricFacade(createNativeAdapters(), createNativeSessionSecretStore()),
    []
  );

  const lockSession = async () => {
    sessionMnemonicRef.current = null;
    setIsUnlocked(false);
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
  };

  const resetAutoLockTimer = () => {
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
    }
    autoLockTimerRef.current = setTimeout(() => {
      void lockSession();
    }, AUTO_LOCK_TIMEOUT_MS);
  };

  const unlockWithPassword = async (password: string) => {
    if (!password || password !== lockPassword) {
      setLockError('Invalid password.');
      return false;
    }
    const mnemonic = await SecureStore.getItemAsync(MNEMONIC_KEY);
    sessionMnemonicRef.current = mnemonic ?? fallbackMnemonic;
    setIsUnlocked(true);
    setLockError('');
    resetAutoLockTimer();
    return true;
  };

  useEffect(() => {
    const initLock = async () => {
      const [storedPassword, enabledFlag] = await Promise.all([
        SecureStore.getItemAsync(MOBILE_LOCK_PASSWORD_KEY),
        SecureStore.getItemAsync(MOBILE_BIOMETRIC_ENABLED_KEY)
      ]);
      if (storedPassword) {
        setLockPassword(storedPassword);
        setIsSettingUpPassword(false);
      } else {
        setIsSettingUpPassword(true);
      }
      setBiometricEnabled(enabledFlag === 'true');
    };
    void initLock();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void lockSession();
      }
    });
    return () => sub.remove();
  }, []);

  const adapter = useMemo(() => {
    const memoryStore = new dogecoinKeyrings.MemoryStorageAdapter();
    void memoryStore;

    return {
      getBalance: async () => {
        const stored = await SecureStore.getItemAsync(BALANCE_KEY);
        return {
          amount: Number(stored ?? '0'),
          btc_amount: '0',
          inscription_amount: 0,
          inscription_btc_amount: '0',
          pending_amount: 0,
          pending_btc_amount: '0',
          transferable_inscription_amount: 0,
          transferable_inscription_btc_amount: '0',
          satoshidoge: { amount: '0' },
          satoshidoge_pending: { amount: '0' }
        } as any;
      },
      getAddress: async () => (await SecureStore.getItemAsync(ADDRESS_KEY)) ?? fallbackAddress,
      getUsdRate: async () => 0.12,
      getTransactions: async () => {
        const raw = await SecureStore.getItemAsync(TXS_KEY);
        return raw ? (JSON.parse(raw) as WalletTransaction[]) : [];
      },
      getConnectedAccounts: async () => [((await SecureStore.getItemAsync(ADDRESS_KEY)) as string) ?? fallbackAddress],
      validateAddress: (address: string) => /^D[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address.trim()),
      copyText: async (value: string) => {
        await Clipboard.setStringAsync(value);
      },
      sendDogecoin: async ({ amount, to }: { amount: number; to: string }) => {
        const current = Number((await SecureStore.getItemAsync(BALANCE_KEY)) ?? '0');
        const next = Math.max(0, current - amount);
        await SecureStore.setItemAsync(BALANCE_KEY, String(next));

        const tx = {
          txid: `mobile-l1-${Date.now()}`,
          amount,
          direction: 'sent' as const,
          timestamp: Date.now(),
          to,
          status: 'confirmed' as const
        };
        const raw = await SecureStore.getItemAsync(TXS_KEY);
        const txs = raw ? (JSON.parse(raw) as WalletTransaction[]) : [];
        await SecureStore.setItemAsync(TXS_KEY, JSON.stringify([tx, ...txs].slice(0, 20)));

        return { txid: tx.txid };
      },
      logout: async () => {
        await lockSession();
        await Promise.all([
          SecureStore.setItemAsync(BALANCE_KEY, '0'),
          SecureStore.setItemAsync(TXS_KEY, JSON.stringify([]))
        ]);
      },
      getVersion: async () => '0.2.0-l1'
    };
  }, [isUnlocked]);

  if (isSettingUpPassword) {
    return (
      <SafeAreaProvider>
        <View style={styles.lockContainer}>
          <Text style={styles.title}>Set mobile lock password</Text>
          <TextInput
            secureTextEntry
            placeholder="Create password"
            placeholderTextColor="#8b8b8b"
            style={styles.input}
            value={passwordInput}
            onChangeText={setPasswordInput}
          />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={async () => {
              if (passwordInput.length < 6) {
                setLockError('Use at least 6 characters.');
                return;
              }
              await SecureStore.setItemAsync(MOBILE_LOCK_PASSWORD_KEY, passwordInput);
              setLockPassword(passwordInput);
              setPasswordInput('');
              setIsSettingUpPassword(false);
              setLockError('');
            }}>
            <Text style={styles.primaryButtonText}>Save Password</Text>
          </TouchableOpacity>
          {lockError ? <Text style={styles.errorText}>{lockError}</Text> : null}
        </View>
      </SafeAreaProvider>
    );
  }

  if (!isUnlocked) {
    return (
      <SafeAreaProvider>
        <View style={styles.lockContainer}>
          <Text style={styles.title}>Unlock Dojak Wallet</Text>
          <TextInput
            secureTextEntry
            placeholder="Enter password"
            placeholderTextColor="#8b8b8b"
            style={styles.input}
            value={passwordInput}
            onChangeText={setPasswordInput}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void unlockWithPassword(passwordInput)}>
            <Text style={styles.primaryButtonText}>Unlock with Password</Text>
          </TouchableOpacity>
          {biometricEnabled ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={async () => {
                const result = await biometricFacade.unlockWalletWithBiometric(async (secret) => {
                  await unlockWithPassword(secret);
                }, 'Unlock Dojak Wallet');
                if (!result.ok) {
                  setLockError(result.errorMessage || 'Biometric unlock failed.');
                }
              }}>
              <Text style={styles.secondaryButtonText}>Unlock with Biometrics</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={async () => {
              const ok = await unlockWithPassword(passwordInput);
              if (!ok) return;
              await createNativeSessionSecretStore().saveSecret(passwordInput);
              await SecureStore.setItemAsync(MOBILE_BIOMETRIC_ENABLED_KEY, 'true');
              setBiometricEnabled(true);
              setPasswordInput('');
            }}>
            <Text style={styles.secondaryButtonText}>
              {biometricEnabled ? 'Biometric enabled' : 'Enable biometric unlock'}
            </Text>
          </TouchableOpacity>
          {lockError ? <Text style={styles.errorText}>{lockError}</Text> : null}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <WalletCoreProvider adapter={adapter}>
        <DojakWallet />
        <StatusBar style="light" />
      </WalletCoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  lockContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 24,
    justifyContent: 'center'
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderColor: '#2b2b2b',
    borderRadius: 10,
    color: '#fff',
    padding: 12,
    marginBottom: 12
  },
  primaryButton: {
    backgroundColor: '#3f7cff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700'
  },
  secondaryButton: {
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10
  },
  secondaryButtonText: {
    color: '#fff'
  },
  errorText: {
    color: '#ff7b7b',
    marginTop: 6
  }
});
