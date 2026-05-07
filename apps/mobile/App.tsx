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
} from '@dojak/biometrics';
import {
  DOGEOS_ACTIVE_CONFIG,
  createDogeOsPublicClient,
  deriveDogeOsAddressFromMnemonic,
  dogecoinKeyrings,
  DOGEOS_DERIVATION_PATH,
  getDogeOsBalance,
  getDogeOsTransactions,
  sendDogeOsTransaction
} from '@dojak/core';
import { HDNodeWallet, formatEther, parseEther } from 'ethers';
import { DojakWallet, WalletCoreProvider, WalletTransaction } from '@dojak/ui';

import './global.css';

const BALANCE_KEY = 'dojak.balance';
const ADDRESS_KEY = 'dojak.address';
const TXS_KEY = 'dojak.txs';
const DOGEOS_BALANCE_KEY = 'dojak.dogeos.balance';
const DOGEOS_TXS_KEY = 'dojak.dogeos.txs';
const MNEMONIC_KEY = 'dojak.mnemonic';
const MOBILE_LOCK_PASSWORD_KEY = 'dojak.mobile.lock.password';
const MOBILE_BIOMETRIC_ENABLED_KEY = 'dojak.mobile.biometric.enabled';
const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

const fallbackAddress = 'D8n4gQ8S4aQszM4xTq3w9fF6xR9H1skGgT';
const fallbackMnemonic = 'test test test test test test test test test test test junk';

const isHexAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address.trim());

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

    const getMnemonic = async () => {
      if (!isUnlocked || !sessionMnemonicRef.current) {
        throw new Error('Wallet is locked. Unlock with password or biometric first.');
      }
      return sessionMnemonicRef.current;
    };

    const getDogeOsAddress = async () => {
      const mnemonic = await getMnemonic();
      return deriveDogeOsAddressFromMnemonic(mnemonic) as `0x${string}`;
    };

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
      getDogeOsAddress,
      getDogeOsBalance: async () => {
        try {
          const address = await getDogeOsAddress();
          return await getDogeOsBalance(address);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown RPC error';
          throw new Error(`Unable to load DogeOS balance. Please try again in a moment. (${message})`);
        }
      },
      getUsdRate: async () => 0.12,
      getTransactions: async () => {
        const raw = await SecureStore.getItemAsync(TXS_KEY);
        return raw ? (JSON.parse(raw) as WalletTransaction[]) : [];
      },
      getDogeOsTransactions: async () => {
        try {
          const address = await getDogeOsAddress();
          return (await getDogeOsTransactions(address)) as WalletTransaction[];
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown explorer error';
          throw new Error(`Unable to load DogeOS transactions right now. (${message})`);
        }
      },
      getConnectedAccounts: async () => [((await SecureStore.getItemAsync(ADDRESS_KEY)) as string) ?? fallbackAddress],
      validateAddress: (address: string) => /^D[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address.trim()),
      validateDogeOsAddress: isHexAddress,
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
      sendDogeOs: async ({ amount, to }: { amount: string; to: `0x${string}` }) => {
        try {
          const mnemonic = await getMnemonic();
          const provider = createDogeOsPublicClient();
          const derivedAddress = deriveDogeOsAddressFromMnemonic(mnemonic, DOGEOS_DERIVATION_PATH).toLowerCase();
          const signer = HDNodeWallet.fromPhrase(mnemonic, undefined, DOGEOS_DERIVATION_PATH).connect(provider);
          const signerAddress = (await signer.getAddress()).toLowerCase();

          if (signerAddress !== derivedAddress) {
            throw new Error('Derived DogeOS signer address mismatch');
          }

          const tx = await sendDogeOsTransaction(signer, { to, amount });
          await tx.wait(1);

          const [balance, txs] = await Promise.all([getDogeOsBalance(await signer.getAddress()), getDogeOsTransactions(await signer.getAddress())]);
          await Promise.all([SecureStore.setItemAsync(DOGEOS_BALANCE_KEY, balance), SecureStore.setItemAsync(DOGEOS_TXS_KEY, JSON.stringify(txs))]);

          return { txid: tx.hash };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown signing error';
          throw new Error(`DogeOS send failed. Please confirm recipient, amount, and network status. (${message})`);
        }
      },
      estimateDogeOsGas: async ({ amount, to }: { amount: string; to: `0x${string}` }) => {
        try {
          const mnemonic = await getMnemonic();
          const provider = createDogeOsPublicClient();
          const signer = HDNodeWallet.fromPhrase(mnemonic, undefined, DOGEOS_DERIVATION_PATH).connect(provider);
          const [gasLimit, feeData] = await Promise.all([
            signer.estimateGas({ to, value: parseEther(amount || '0') }),
            provider.getFeeData()
          ]);
          const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
          const totalFeeWei = gasLimit * gasPrice;
          return { gasLimit: gasLimit.toString(), gasPriceWei: gasPrice.toString(), feeInDoge: formatEther(totalFeeWei) };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown gas estimation error';
          throw new Error(`Unable to estimate DogeOS gas right now. (${message})`);
        }
      },
      bridgeDogeOs: async ({ amount, direction }: { amount: string; direction: 'l1-to-dogeos' | 'dogeos-to-l1' }) => {
        try {
          const txid = `0xbridge-${direction}-${Date.now().toString(16)}`;
          // Placeholder bridge call. Replace with official DogeOS bridge contract address when published.
          void DOGEOS_ACTIVE_CONFIG.bridgeContractAddress;
          void amount;
          return { txid };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown bridge error';
          throw new Error(`Bridge request could not be created. Please try again. (${message})`);
        }
      },
      logout: async () => {
        await lockSession();
        await Promise.all([
          SecureStore.setItemAsync(BALANCE_KEY, '0'),
          SecureStore.setItemAsync(DOGEOS_BALANCE_KEY, '0'),
          SecureStore.setItemAsync(TXS_KEY, JSON.stringify([])),
          SecureStore.setItemAsync(DOGEOS_TXS_KEY, JSON.stringify([]))
        ]);
      },
      getSeedPhraseForDogeOsTesting: async () => getMnemonic(),
      getVersion: async () => '0.2.0-dogeos-testnet'
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
