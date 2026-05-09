import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { toast } from 'sonner';
import {
  getDefaultWalletDataProviderUrl,
  getWalletDataProviderConfig,
  setWalletDataProviderConfig,
  WalletDataProviderType,
} from '../api';

export type ProviderType = 'local' | 'mydoge' | 'custom';

export interface ProviderConfig {
  type: ProviderType;
  url?: string;
  username?: string;
  password?: string;
  encryptedCreds?: string;
  iv?: string;
  walletDataProvider?: WalletDataProviderType;
  walletDataProviderUrl?: string;
}

interface ConfigContextType {
  config: ProviderConfig;
  setConfig: (newConfig: ProviderConfig) => Promise<void>;
  testConnection: (type?: ProviderType) => Promise<{ status: 'green' | 'red'; message: string }>;
  status: { [key in ProviderType]: 'green' | 'red' | 'unknown' };
  isLoading: boolean;
}

const STORAGE_KEY = 'bork-provider-config';
const ConfigContext = createContext<ConfigContextType | null>(null);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToArrayBuffer = (base64: string): Uint8Array => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

const isCryptoAvailable = (): boolean => {
  return !!window.crypto?.subtle;
};

const generateEncryptionKey = async (): Promise<CryptoKey> => {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('dojakweb-provider-key-v1'),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('dojakweb-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const walletProviderDefaults = getWalletDataProviderConfig();
  const [config, setConfigState] = useState<ProviderConfig>({
    type: 'local',
    walletDataProvider: walletProviderDefaults.walletDataProvider,
    walletDataProviderUrl: walletProviderDefaults.walletDataProviderUrl,
  });
  const [status, setStatus] = useState<{ [key in ProviderType]: 'green' | 'red' | 'unknown' }>({
    local: 'unknown',
    mydoge: 'unknown',
    custom: 'unknown'
  });
  const [isLoading, setIsLoading] = useState(false);

  const encryptCredentials = async (creds: { username: string; password: string }) => {
    const key = await generateEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(creds));
    const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    return { encryptedCreds: arrayBufferToBase64(encrypted), iv: arrayBufferToBase64(iv.buffer as ArrayBuffer) };
  };

  const decryptCredentials = async (encryptedCreds: string, iv: string) => {
    const key = await generateEncryptionKey();
    const encryptedData = base64ToArrayBuffer(encryptedCreds);
    const ivData = base64ToArrayBuffer(iv);
    const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivData as any }, key, encryptedData as any);
    return JSON.parse(new TextDecoder().decode(decrypted));
  };

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const walletProvider = getWalletDataProviderConfig();
        if (stored) {
          const parsed = JSON.parse(stored) as ProviderConfig;
          if (parsed.type === 'custom' && parsed.encryptedCreds && parsed.iv) {
            if (isCryptoAvailable()) {
              try {
                const decrypted = await decryptCredentials(parsed.encryptedCreds, parsed.iv);
                parsed.username = decrypted.username;
                parsed.password = decrypted.password;
              } catch (error) {
                console.error('Failed to decrypt credentials:', error);
                toast.error('Failed to load saved credentials. Please reconfigure.');
                localStorage.removeItem(STORAGE_KEY);
                return;
              }
            } else {
              console.warn('Crypto not available, skipping credential decryption');
              toast.error('Web Crypto API unavailable. Custom RPC credentials cannot be loaded.');
              localStorage.removeItem(STORAGE_KEY);
              return;
            }
          }

          const merged = {
            ...parsed,
            walletDataProvider: walletProvider.walletDataProvider,
            walletDataProviderUrl: walletProvider.walletDataProviderUrl,
          };
          setConfigState(merged);
          await testConnection(merged.type, merged);
        } else {
          setConfigState({
            type: 'local',
            walletDataProvider: walletProvider.walletDataProvider,
            walletDataProviderUrl: walletProvider.walletDataProviderUrl,
          });
        }
      } catch (error) {
        console.error('Failed to load config:', error);
        toast.error('Failed to load provider configuration');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  const persistConfig = async (newConfig: ProviderConfig) => {
    let toSave = { ...newConfig };
    if (newConfig.type === 'custom' && newConfig.username && newConfig.password) {
      if (isCryptoAvailable()) {
        const encrypted = await encryptCredentials({ username: newConfig.username, password: newConfig.password });
        toSave = {
          ...toSave,
          encryptedCreds: encrypted.encryptedCreds,
          iv: encrypted.iv,
          username: undefined,
          password: undefined,
        };
      } else {
        console.warn('Crypto not available, saving credentials unencrypted');
        // Save unencrypted for now, but this is insecure
        // In a real app, you might want to disable custom providers without crypto
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  };

  const setConfig = async (newConfig: ProviderConfig) => {
    setIsLoading(true);
    try {
      const walletDataProvider = newConfig.walletDataProvider ?? config.walletDataProvider ?? 'mydoge';
      const walletDataProviderUrl = newConfig.walletDataProviderUrl
        || config.walletDataProviderUrl
        || getDefaultWalletDataProviderUrl(walletDataProvider);
      const mergedConfig = { ...newConfig, walletDataProvider, walletDataProviderUrl };

      await persistConfig(mergedConfig);
      const curWallet = getWalletDataProviderConfig();
      setWalletDataProviderConfig({
        walletDataProvider,
        walletDataProviderUrl,
        mergeInuBitsInscriptions: curWallet.mergeInuBitsInscriptions,
      });
      setConfigState(mergedConfig);
      await testConnection(mergedConfig.type, mergedConfig);
      toast.success('Provider configuration saved and tested');
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save provider configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = useCallback(async (type?: ProviderType, overrideConfig?: ProviderConfig) => {
    const activeConfig = overrideConfig ?? config;
    const providerToTest = type || activeConfig.type;

    try {
      setStatus(prev => ({ ...prev, [providerToTest]: 'unknown' }));
      let testUrl = '';
      let testMethod = 'GET';
      let testBody: any = undefined;
      let headers: Record<string, string> = {};

      switch (providerToTest) {
        case 'local':
          testUrl = 'http://localhost:22555';
          testMethod = 'POST';
          testBody = JSON.stringify({ jsonrpc: '1.0', id: 'connection_test', method: 'getblockcount', params: [] });
          headers = { 'Content-Type': 'application/json' };
          break;
        case 'mydoge': {
          const base =
            activeConfig.walletDataProviderUrl ||
            getDefaultWalletDataProviderUrl(activeConfig.walletDataProvider || 'mydoge');
          testUrl =
            activeConfig.walletDataProvider === 'commanddog'
              ? `${base.replace(/\/$/, '')}/health`
              : `${base}/wallet/info?route=/address/DPkK4rNL8S7bxdh1fNkvd1GVYqenVKCdfX`;
          break;
        }
        case 'custom':
          if (!activeConfig.url) throw new Error('Custom RPC URL not configured');
          testUrl = activeConfig.url.replace(/\/$/, '');
          testMethod = 'POST';
          testBody = JSON.stringify({ jsonrpc: '1.0', id: 'connection_test', method: 'getblockcount', params: [] });
          headers = { 'Content-Type': 'application/json' };
          if (activeConfig.username && activeConfig.password) {
            headers.Authorization = `Basic ${btoa(`${activeConfig.username}:${activeConfig.password}`)}`;
          }
          break;
      }

      const response = await fetch(testUrl, {
        method: testMethod,
        headers,
        body: testBody,
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) throw new Error(`Provider responded with ${response.status}`);
      if (testMethod === 'POST') {
        const jsonResponse = await response.json();
        if (jsonResponse.result === undefined) throw new Error('Provider did not return a valid JSON-RPC result');
      }
      setStatus(prev => ({ ...prev, [providerToTest]: 'green' }));
      return { status: 'green' as const, message: 'Connection successful' };
    } catch (error: any) {
      setStatus(prev => ({ ...prev, [providerToTest]: 'red' }));
      return { status: 'red' as const, message: error?.message || 'Connection failed' };
    }
  }, [config]);

  return <ConfigContext.Provider value={{ config, setConfig, testConnection, status, isLoading }}>{children}</ConfigContext.Provider>;
};
