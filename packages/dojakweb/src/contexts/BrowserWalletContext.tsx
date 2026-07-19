'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserWallet, type BrowserWalletSaveOptions } from '../lib/browser-wallet';
import type { SeedMaterial, WalletData } from '../types/wallet';
import { walletDataApi } from '../utils/api';
import { createDojakwebSessionSecretStore } from '../lib/dojakweb-biometric';

export interface UseBrowserWalletReturn {
  connected: boolean;
  address: string | null;
  balance: number;
  wallet: WalletData | null;
  connecting: boolean;
  connect: (wallet: WalletData) => Promise<void>;
  disconnect: () => Promise<void>;
  createWallet: () => Promise<WalletData & { mnemonic?: string }>;
  importWallet: (privateKey: string) => Promise<WalletData>;
  importWalletFromMnemonic: (mnemonic: string, passphrase?: string) => Promise<WalletData>;
  saveWallet: (
    wallet: WalletData,
    password?: string,
    options?: BrowserWalletSaveOptions
  ) => Promise<void>;
  loadWallet: (password?: string, address?: string) => Promise<WalletData | null>;
  loadSeedMaterial: (password?: string, address?: string) => Promise<SeedMaterial | null>;
  hasSeedMaterial: (address?: string) => Promise<boolean>;
  hasWallet: () => Promise<boolean>;
  removeWallet: () => Promise<void>;
  refreshBalance: (options?: { silent?: boolean }) => Promise<void>;
  balanceError: string | null;
  balanceRefreshing: boolean;
  balanceVerified: boolean;
  listWallets: () => Promise<WalletData[]>;
  selectWallet: (address: string) => Promise<WalletData | null>;
  switchAccount: (accountIndex: number, password?: string) => Promise<WalletData>;
  updateNickname: (address: string, nickname?: string) => Promise<void>;
}

const BrowserWalletContext = createContext<UseBrowserWalletReturn | null>(null);
const RESTORE_BLOCK_KEY = 'dojakweb_wallet_restore_blocked';

interface BrowserWalletProviderProps {
  children: React.ReactNode;
}

async function fetchBalanceForAddress(address: string, options?: { silent?: boolean }): Promise<number> {
  try {
    return await walletDataApi.fetchBalance(address);
  } catch (error: any) {
    if (!options?.silent) {
      console.warn('[BROWSER WALLET] Balance fetch unavailable:', error?.message || error);
    }
    throw error;
  }
}

export function BrowserWalletProvider({ children }: BrowserWalletProviderProps) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);
  const [balanceVerified, setBalanceVerified] = useState(false);
  const balanceIntervalRef = useRef<number | null>(null);
  const balanceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const restoreWallet = async () => {
      try {
        if (localStorage.getItem(RESTORE_BLOCK_KEY) === 'true') {
          return;
        }
        const storage = new BrowserWallet();
        const current = localStorage.getItem('dojakweb_wallet_current');

        // Encrypted wallets: stay unlocked for this browser tab/session after first unlock.
        // Password is held in sessionStorage (or chrome.storage.session) — not localStorage.
        if (current && (await storage.isEncrypted(current))) {
          let sessionSecret: string | null = null;
          try {
            sessionSecret = await createDojakwebSessionSecretStore().getSecret();
          } catch {
            sessionSecret = null;
          }
          if (!sessionSecret) {
            return;
          }
          try {
            const loaded = await storage.loadWallet(sessionSecret, current);
            if (!loaded?.privateKey) {
              return;
            }
            setWallet(loaded);
            setAddress(loaded.address);
            setConnected(true);
            setBalance(0);
            setBalanceVerified(false);
            setBalanceError(null);
            localStorage.removeItem(RESTORE_BLOCK_KEY);
            try {
              localStorage.setItem('wallet_type', 'browser');
            } catch {
              /* ignore */
            }
          } catch {
            // Wrong/expired session secret — clear so we don't loop on a bad secret.
            try {
              await createDojakwebSessionSecretStore().clearSecret();
            } catch {
              /* ignore */
            }
          }
          return;
        }

        const loaded = await storage.loadWallet();
        if (!loaded) {
          return;
        }

        setWallet(loaded);
        setAddress(loaded.address);
        setConnected(true);
        setBalance(0);
        setBalanceVerified(false);
        setBalanceError(null);
        localStorage.removeItem(RESTORE_BLOCK_KEY);
        try {
          localStorage.setItem('wallet_type', 'browser');
        } catch {
          // Ignore localStorage failures during restore.
        }
      } catch (error: any) {
        if (!error?.message?.includes('encrypted')) {
          console.error('[BROWSER WALLET] Restore error:', error);
        }
      }
    };

    void restoreWallet();
  }, []);

  const refreshBalance = useCallback(async (options?: { silent?: boolean }) => {
    if (!address) {
      return;
    }

    setBalanceRefreshing(true);
    try {
      const nextBalance = await fetchBalanceForAddress(address, options);
      setBalance(nextBalance);
      setBalanceVerified(true);
      setBalanceError(null);
    } catch (error: any) {
      setBalanceVerified(false);
      setBalanceError(error?.message || 'Unable to refresh balance right now.');
    } finally {
      setBalanceRefreshing(false);
    }
  }, [address]);

  const connect = useCallback(async (walletData: WalletData) => {
    setConnecting(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(RESTORE_BLOCK_KEY);
      }
      setWallet(walletData);
      setAddress(walletData.address);
      setConnected(true);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('wallet_type', 'browser');
        } catch {
          // Ignore localStorage failures during connect.
        }
      }
      // Only reset balance state when switching to a different address.
      // Re-connecting the same address (e.g. the UnifiedWalletContext auto-
      // reconnect that fires 100ms after mount) must not discard a balance
      // that was already successfully fetched by restoreWallet.
      setBalance((prev) => (walletData.address === address ? prev : 0));
      setBalanceVerified((prev) => (walletData.address === address ? prev : false));
      setBalanceError(null);
    } finally {
      setConnecting(false);
    }
  }, [address]);

  const disconnect = useCallback(async () => {
    setConnected(false);
    setAddress(null);
    setBalance(0);
    setWallet(null);
    setBalanceVerified(false);
    setBalanceError(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem(RESTORE_BLOCK_KEY, 'true');
      // Explicit disconnect ends the unlock session (must re-enter password next time).
      try {
        await createDojakwebSessionSecretStore().clearSecret();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!connected || !address || typeof window === 'undefined') {
      if (balanceTimeoutRef.current) {
        window.clearTimeout(balanceTimeoutRef.current);
        balanceTimeoutRef.current = null;
      }
      if (balanceIntervalRef.current) {
        window.clearInterval(balanceIntervalRef.current);
        balanceIntervalRef.current = null;
      }
      return;
    }

    balanceTimeoutRef.current = window.setTimeout(() => {
      void refreshBalance({ silent: true });
    }, 0);

    balanceIntervalRef.current = window.setInterval(() => {
      void refreshBalance({ silent: true });
    }, 60000);

    return () => {
      if (balanceTimeoutRef.current) {
        window.clearTimeout(balanceTimeoutRef.current);
        balanceTimeoutRef.current = null;
      }
      if (balanceIntervalRef.current) {
        window.clearInterval(balanceIntervalRef.current);
        balanceIntervalRef.current = null;
      }
    };
  }, [address, connected, refreshBalance]);

  const createWallet = useCallback(async () => BrowserWallet.generateWallet('mainnet'), []);

  const importWallet = useCallback(
    async (privateKey: string) => BrowserWallet.importFromPrivateKey(privateKey, 'mainnet'),
    []
  );

  const importWalletFromMnemonic = useCallback(
    async (mnemonic: string, passphrase?: string) =>
      BrowserWallet.importFromMnemonic(mnemonic, passphrase, 'mainnet'),
    []
  );

  const saveWallet = useCallback(
    async (walletData: WalletData, password?: string, options?: BrowserWalletSaveOptions) => {
      const storage = new BrowserWallet();
      await storage.saveWallet(walletData, password, options);
    },
    []
  );

  const loadWallet = useCallback(async (password?: string, targetAddress?: string) => {
    const storage = new BrowserWallet();
    return storage.loadWallet(password, targetAddress);
  }, []);

  const loadSeedMaterial = useCallback(async (password?: string, targetAddress?: string) => {
    const storage = new BrowserWallet();
    return storage.loadSeedMaterial(password, targetAddress);
  }, []);

  const hasSeedMaterial = useCallback(async (targetAddress?: string) => {
    const storage = new BrowserWallet();
    return storage.hasSeedMaterial(targetAddress);
  }, []);

  const hasWallet = useCallback(async () => {
    const storage = new BrowserWallet();
    return storage.hasWallet();
  }, []);

  const removeWallet = useCallback(async () => {
    const storage = new BrowserWallet();
    try {
      await storage.removeWallet(address || undefined);
    } catch {
      await storage.removeWallet();
    }

    if (typeof window !== 'undefined' && localStorage.getItem('wallet_type') === 'browser') {
      localStorage.removeItem('wallet_type');
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(RESTORE_BLOCK_KEY);
    }

    await disconnect();
  }, [address, disconnect]);

  const listWallets = useCallback(async () => {
    const storage = new BrowserWallet();
    return storage.listWallets();
  }, []);

  const selectWallet = useCallback(
    async (targetAddress: string) => {
      const storage = new BrowserWallet();
      await storage.selectWallet(targetAddress);

      // Prefer full wallet with private key. Metadata-only list entries would
      // wipe an unlocked session if we connected them as-is.
      if (await storage.isEncrypted(targetAddress)) {
        try {
          const sessionSecret = await createDojakwebSessionSecretStore().getSecret();
          if (sessionSecret) {
            const loaded = await storage.loadWallet(sessionSecret, targetAddress);
            if (loaded?.privateKey) {
              await connect(loaded);
              return loaded;
            }
          }
        } catch {
          /* need unlock UI */
        }
        // Stay on current session if already unlocked for this address.
        if (wallet?.address === targetAddress && wallet.privateKey) {
          return wallet;
        }
        return null;
      }

      const loaded = await storage.loadWallet(undefined, targetAddress);
      if (loaded) {
        await connect(loaded);
        return loaded;
      }
      return null;
    },
    [connect, wallet]
  );

  const switchAccount = useCallback(
    async (accountIndex: number, password?: string) => {
      const storage = new BrowserWallet();
      const switched = await storage.switchAccount(accountIndex, password, address || undefined);
      await connect(switched);
      return switched;
    },
    [address, connect]
  );

  const updateNickname = useCallback(
    async (targetAddress: string, nickname?: string) => {
      const storage = new BrowserWallet();
      await storage.updateNickname(targetAddress, nickname);
      if (wallet?.address === targetAddress) {
        setWallet({ ...wallet, nickname });
      }
    },
    [wallet]
  );

  const value = useMemo<UseBrowserWalletReturn>(
    () => ({
      connected,
      address,
      balance,
      wallet,
      connecting,
      connect,
      disconnect,
      createWallet,
      importWallet,
      importWalletFromMnemonic,
      saveWallet,
      loadWallet,
      loadSeedMaterial,
      hasSeedMaterial,
      hasWallet,
      removeWallet,
      refreshBalance,
      balanceError,
      balanceRefreshing,
      balanceVerified,
      listWallets,
      selectWallet,
      switchAccount,
      updateNickname,
    }),
    [
      connected,
      address,
      balance,
      wallet,
      connecting,
      connect,
      disconnect,
      createWallet,
      importWallet,
      importWalletFromMnemonic,
      saveWallet,
      loadWallet,
      loadSeedMaterial,
      hasSeedMaterial,
      hasWallet,
      removeWallet,
      refreshBalance,
      balanceError,
      balanceRefreshing,
      balanceVerified,
      listWallets,
      selectWallet,
      switchAccount,
      updateNickname,
    ]
  );

  return (
    <BrowserWalletContext.Provider value={value}>
      {/* @ts-ignore - Next.js type checking issue with React.ReactNode */}
      {children}
    </BrowserWalletContext.Provider>
  );
}

const noop = async () => { throw new Error('Wallet not connected'); };
const NULL_BROWSER_WALLET: UseBrowserWalletReturn = {
  connected: false,
  address: null,
  balance: 0,
  wallet: null,
  connecting: false,
  balanceError: null,
  balanceRefreshing: false,
  balanceVerified: false,
  connect: noop,
  disconnect: noop,
  createWallet: noop as any,
  importWallet: noop as any,
  importWalletFromMnemonic: noop as any,
  saveWallet: noop,
  loadWallet: noop as any,
  loadSeedMaterial: noop as any,
  hasSeedMaterial: noop as any,
  hasWallet: noop as any,
  removeWallet: noop,
  refreshBalance: noop,
  listWallets: async () => [],
  selectWallet: async () => null,
  switchAccount: noop as any,
  updateNickname: noop,
};

export function useBrowserWallet(): UseBrowserWalletReturn {
  return useContext(BrowserWalletContext) ?? NULL_BROWSER_WALLET;
}
