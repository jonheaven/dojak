'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMyDogeWallet } from './useMyDogeWallet';
import { useBrowserWallet } from './BrowserWalletContext';
import { BrowserWallet } from '../lib/browser-wallet';
import { LedgerWallet } from '../lib/ledger-wallet';
import { DogewatchWallet } from '../lib/dogewatch-wallet';
import {
  broadcastTx,
  getAddressUtxos,
  normalizeSignedPsdtToBase64,
  preparePsdtForExtensionSign,
  preparePsdtForMyDogeSign,
  signPartialPsdtWithWifToHex,
  signPsdtWithWifToTxHex,
} from '../lib/doginal-psdt';
import {
  signDMPIntent as signDMPIntentService,
  warnIfUnexpectedSigningHostname,
} from '../services/dmp';
import { walletDataApi } from '../utils/api';
import { getInjectedMyDogeProvider } from '../utils/mydoge-provider';
import type {
  DmpIntentParams,
  DmpIntentType,
  SignedDmpIntent,
  UnifiedWalletContextValue,
  WalletType,
  WalletData,
} from '../types/wallet';
import { UnifiedWalletContext } from './unifiedWalletInternals';
import { requestWalletApproval } from '../stores/walletApprovalStore';

interface DojakState {
  connected: boolean;
  address: string | null;
  balance: number;
  connecting: boolean;
}

interface SpookyState {
  connected: boolean;
  address: string | null;
  balance: number;
  connecting: boolean;
}

interface LedgerState {
  connected: boolean;
  address: string | null;
  balance: number;
  connecting: boolean;
  balanceRefreshing: boolean;
  balanceVerified: boolean;
  balanceError: string | null;
  accountIndex: number | null;
  derivationPath: string | null;
}

interface DogewatchState {
  connected: boolean;
  address: string | null;
  balance: number;
  connecting: boolean;
  balanceRefreshing: boolean;
  balanceVerified: boolean;
  balanceError: string | null;
  walletId: string | null;
}

const DOJAK_INITIAL_STATE: DojakState = {
  connected: false,
  address: null,
  balance: 0,
  connecting: false,
};

const SPOOKY_INITIAL_STATE: SpookyState = {
  connected: false,
  address: null,
  balance: 0,
  connecting: false,
};

const LEDGER_INITIAL_STATE: LedgerState = {
  connected: false,
  address: null,
  balance: 0,
  connecting: false,
  balanceRefreshing: false,
  balanceVerified: false,
  balanceError: null,
  accountIndex: null,
  derivationPath: null,
};

const DOGEWATCH_INITIAL_STATE: DogewatchState = {
  connected: false,
  address: null,
  balance: 0,
  connecting: false,
  balanceRefreshing: false,
  balanceVerified: false,
  balanceError: null,
  walletId: null,
};

const getSpookyHint = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean((window as any).isSpookyWallet || (window as any).__DOJAKWEB_FLAGS?.isSpookyWallet);
};

const getSpookyProvider = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const provider = window.dogecoin as any;
  if (!provider) {
    return null;
  }
  if (provider.isSpookyWallet === true || getSpookyHint()) {
    return provider;
  }
  return null;
};

const getDojakProvider = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.dojak ?? null;
};

const pickDojakSignedPayload = (response: unknown): string => {
  if (typeof response === 'string') {
    return response;
  }
  if (!response || typeof response !== 'object') {
    throw new Error('Dojak signing returned an empty response');
  }
  const r = response as Record<string, unknown>;
  const out = r.signedTx ?? r.signedRawTx ?? r.signedPsbt ?? r.txHex ?? r.signature;
  if (typeof out !== 'string' || !out.trim()) {
    throw new Error('Dojak signing returned no signed transaction or PSDT');
  }
  return out.trim();
};

const extractAccounts = (response: any): string[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.accounts)) return response.accounts;
  if (Array.isArray(response?.addresses)) return response.addresses;
  if (response?.address) return [response.address];
  return [];
};

const normalizeSpookyBalance = (balanceLike: any): number => {
  const raw = Number(balanceLike?.total ?? balanceLike?.confirmed ?? balanceLike?.balance ?? 0);
  if (!Number.isFinite(raw)) {
    return 0;
  }
  return raw > 1_000_000 ? raw / 100000000 : raw;
};

function normalizeLedgerError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('No device selected')) {
    return 'Ledger connection cancelled before a device was selected.';
  }

  if (message.includes('authorize WebUSB access') || message.includes('requestDevice')) {
    return 'Connect and unlock your Ledger, open the Dogecoin app, then approve WebUSB access.';
  }

  return message;
}

function getWalletTypeLabel(type: WalletType, browserNickname?: string | null): string {
  switch (type) {
    case 'browser':
      return browserNickname?.trim() || 'Local Browser Wallet';
    case 'mydoge':
      return 'MyDoge';
    case 'spookydoge':
      return 'Spooky Doge';
    case 'dojak':
      return 'Dojak';
    case 'ledger':
      return 'Ledger';
    case 'dogewatch':
      return 'Dogewatch';
    default:
      return 'Wallet';
  }
}

async function fetchBalance(address: string): Promise<number> {
  try {
    return await walletDataApi.fetchBalance(address);
  } catch (error: any) {
    console.warn('[UNIFIED WALLET] Balance fetch unavailable:', error?.message || error);
    throw error;
  }
}

export function UnifiedWalletProvider({ children }: { children: React.ReactNode }) {
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [spookyState, setSpookyState] = useState<SpookyState>(SPOOKY_INITIAL_STATE);
  const [dojakState, setDojakState] = useState<DojakState>(DOJAK_INITIAL_STATE);
  const [ledgerState, setLedgerState] = useState<LedgerState>(LEDGER_INITIAL_STATE);
  const [dogewatchState, setDogewatchState] = useState<DogewatchState>(DOGEWATCH_INITIAL_STATE);

  const myDoge = useMyDogeWallet();

  const browser = useBrowserWallet();
  const spookyListenersRef = useRef(false);
  const dojakListenersRef = useRef(false);
  const ledgerWalletRef = useRef(new LedgerWallet());
  const dogewatchWalletRef = useRef(new DogewatchWallet());

  useEffect(() => {
    if (myDoge && browser) {
      setIsInitialized(true);
    }
  }, [myDoge, browser]);

  useEffect(() => {
    const provider = getSpookyProvider();
    if (!provider || spookyListenersRef.current) {
      return;
    }

    spookyListenersRef.current = true;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts?.length) {
        setSpookyState((prev) => ({ ...prev, connected: true, address: accounts[0] }));
        return;
      }

      setSpookyState(SPOOKY_INITIAL_STATE);
      if (walletType === 'spookydoge') {
        setWalletType(null);
        localStorage.removeItem('wallet_type');
      }
    };

    provider?.on?.('accountsChanged', handleAccountsChanged);
    return () => {
      provider?.removeListener?.('accountsChanged', handleAccountsChanged);
      spookyListenersRef.current = false;
    };
  }, [walletType]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // Some injected wallets initialize asynchronously and may emit one of these custom events.
    const onSpookyInit = () => {
      if (getSpookyProvider()) {
        setSpookyState((prev) => ({ ...prev }));
      }
    };
    window.addEventListener('dogecoin#initialized', onSpookyInit as EventListener);
    window.addEventListener('spookydoge#initialized', onSpookyInit as EventListener);
    return () => {
      window.removeEventListener('dogecoin#initialized', onSpookyInit as EventListener);
      window.removeEventListener('spookydoge#initialized', onSpookyInit as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.dojak || dojakListenersRef.current) {
      return;
    }

    dojakListenersRef.current = true;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts?.length) {
        setDojakState((prev) => ({ ...prev, connected: true, address: accounts[0] }));
        return;
      }

      setDojakState(DOJAK_INITIAL_STATE);
      if (walletType === 'dojak') {
        setWalletType(null);
        localStorage.removeItem('wallet_type');
      }
    };

    (window.dojak as any)?.on?.('accountsChanged', handleAccountsChanged);
    return () => {
      (window.dojak as any)?.removeListener?.('accountsChanged', handleAccountsChanged);
      dojakListenersRef.current = false;
    };
  }, [walletType]);

  const connected =
    walletType === 'mydoge'
      ? (myDoge?.connected ?? false)
      : walletType === 'browser'
        ? (browser?.connected ?? false)
        : walletType === 'spookydoge'
          ? spookyState.connected
          : walletType === 'dojak'
          ? dojakState.connected
          : walletType === 'ledger'
            ? ledgerState.connected
            : walletType === 'dogewatch'
              ? dogewatchState.connected
              : false;

  const address =
    walletType === 'mydoge'
      ? (myDoge?.address ?? null)
      : walletType === 'browser'
        ? (browser?.address ?? null)
        : walletType === 'spookydoge'
          ? spookyState.address
          : walletType === 'dojak'
            ? dojakState.address
            : walletType === 'ledger'
              ? ledgerState.address
              : walletType === 'dogewatch'
                ? dogewatchState.address
                : null;

  const balance =
    walletType === 'mydoge'
      ? (myDoge?.balance ?? 0)
      : walletType === 'browser'
        ? (browser?.balance ?? 0)
        : walletType === 'spookydoge'
          ? spookyState.balance
          : walletType === 'dojak'
          ? dojakState.balance
          : walletType === 'ledger'
            ? ledgerState.balance
            : walletType === 'dogewatch'
              ? dogewatchState.balance
              : 0;

  const accountIndex =
    walletType === 'browser'
      ? (browser.wallet?.accountIndex ?? null)
      : walletType === 'ledger'
        ? ledgerState.accountIndex
        : null;

  const derivationPath =
    walletType === 'browser'
      ? (browser.wallet?.derivationPath ?? null)
      : walletType === 'ledger'
        ? ledgerState.derivationPath
        : null;

  const balanceVerified =
    connected &&
    ((walletType === 'mydoge' && myDoge?.balance !== undefined) ||
      (walletType === 'browser' && browser?.balanceVerified) ||
      (walletType === 'spookydoge' && spookyState.connected) ||
      (walletType === 'dojak' && dojakState.connected) ||
      (walletType === 'ledger' && ledgerState.balanceVerified) ||
      (walletType === 'dogewatch' && dogewatchState.balanceVerified));

  const balanceRefreshing =
    walletType === 'browser'
      ? browser.balanceRefreshing
      : walletType === 'ledger'
        ? ledgerState.balanceRefreshing
        : walletType === 'dogewatch'
          ? dogewatchState.balanceRefreshing
          : false;

  const balanceError =
    walletType === 'browser'
      ? browser.balanceError
      : walletType === 'ledger'
        ? ledgerState.balanceError
        : walletType === 'dogewatch'
          ? dogewatchState.balanceError
          : null;

  const connecting =
    walletType === 'mydoge'
      ? (myDoge?.connecting ?? false)
      : walletType === 'browser'
        ? (browser?.connecting ?? false)
        : walletType === 'spookydoge'
          ? spookyState.connecting
          : walletType === 'dojak'
          ? dojakState.connecting
          : walletType === 'ledger'
            ? ledgerState.connecting
            : walletType === 'dogewatch'
              ? dogewatchState.connecting
              : false;

  const browserConnected = browser?.connected ?? false;
  const myDogeConnected = myDoge?.connected ?? false;
  const spookyConnected = spookyState.connected;
  const dojakConnected = dojakState.connected;
  const ledgerConnected = ledgerState.connected;
  const dogewatchConnected = dogewatchState.connected;

  const availableWallets = useMemo(() => {
    const wallets = [
      {
        type: 'browser' as const,
        label: getWalletTypeLabel('browser', browser.wallet?.nickname ?? null),
        connected: browserConnected,
        address: browser.address ?? null,
        balance: browser.balance ?? 0,
        balanceVerified: browser.balanceVerified,
        balanceRefreshing: browser.balanceRefreshing,
        connecting: browser.connecting,
        accountIndex: browser.wallet?.accountIndex ?? null,
        derivationPath: browser.wallet?.derivationPath ?? null,
        isActive: walletType === 'browser',
      },
      {
        type: 'mydoge' as const,
        label: getWalletTypeLabel('mydoge'),
        connected: myDogeConnected,
        address: myDoge?.address ?? null,
        balance: myDoge?.balance ?? 0,
        balanceVerified: myDoge?.balance !== undefined,
        balanceRefreshing: false,
        connecting: myDoge?.connecting ?? false,
        accountIndex: null,
        derivationPath: null,
        isActive: walletType === 'mydoge',
      },
      {
        type: 'spookydoge' as const,
        label: getWalletTypeLabel('spookydoge'),
        connected: spookyConnected,
        address: spookyState.address,
        balance: spookyState.balance,
        balanceVerified: spookyState.connected,
        balanceRefreshing: false,
        connecting: spookyState.connecting,
        accountIndex: null,
        derivationPath: null,
        isActive: walletType === 'spookydoge',
      },
      {
        type: 'dojak' as const,
        label: getWalletTypeLabel('dojak'),
        connected: dojakConnected,
        address: dojakState.address,
        balance: dojakState.balance,
        balanceVerified: dojakState.connected,
        balanceRefreshing: false,
        connecting: dojakState.connecting,
        accountIndex: null,
        derivationPath: null,
        isActive: walletType === 'dojak',
      },
      {
        type: 'ledger' as const,
        label: getWalletTypeLabel('ledger'),
        connected: ledgerConnected,
        address: ledgerState.address,
        balance: ledgerState.balance,
        balanceVerified: ledgerState.balanceVerified,
        balanceRefreshing: ledgerState.balanceRefreshing,
        connecting: ledgerState.connecting,
        accountIndex: ledgerState.accountIndex,
        derivationPath: ledgerState.derivationPath,
        isActive: walletType === 'ledger',
      },
      {
        type: 'dogewatch' as const,
        label: getWalletTypeLabel('dogewatch'),
        connected: dogewatchConnected,
        address: dogewatchState.address,
        balance: dogewatchState.balance,
        balanceVerified: dogewatchState.balanceVerified,
        balanceRefreshing: dogewatchState.balanceRefreshing,
        connecting: dogewatchState.connecting,
        accountIndex: null,
        derivationPath: null,
        isActive: walletType === 'dogewatch',
      },
    ];

    return wallets.filter((wallet) => wallet.connected);
  }, [
    browser.address,
    browser.balance,
    browser.balanceRefreshing,
    browser.balanceVerified,
    browser.connecting,
    browser.wallet?.accountIndex,
    browser.wallet?.derivationPath,
    browser.wallet?.nickname,
    browserConnected,
    dojakConnected,
    dojakState.address,
    dojakState.balance,
    dojakState.connecting,
    ledgerConnected,
    ledgerState.accountIndex,
    ledgerState.address,
    ledgerState.balance,
    ledgerState.balanceRefreshing,
    ledgerState.balanceVerified,
    ledgerState.connecting,
    ledgerState.derivationPath,
    dogewatchConnected,
    dogewatchState.address,
    dogewatchState.balance,
    dogewatchState.balanceRefreshing,
    dogewatchState.balanceVerified,
    dogewatchState.connecting,
    myDoge?.address,
    myDoge?.balance,
    myDoge?.connected,
    myDoge?.connecting,
    myDogeConnected,
    spookyConnected,
    spookyState.address,
    spookyState.balance,
    spookyState.connecting,
    walletType,
  ]);

  const setActiveWallet = useCallback((type: WalletType) => {
    const isConnected =
      (type === 'browser' && browserConnected) ||
      (type === 'mydoge' && myDogeConnected) ||
      (type === 'spookydoge' && spookyConnected) ||
      (type === 'dojak' && dojakConnected) ||
      (type === 'ledger' && ledgerConnected) ||
      (type === 'dogewatch' && dogewatchConnected);

    if (!isConnected) {
      throw new Error(`Wallet ${type} is not connected`);
    }

    setWalletType(type);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wallet_type', type);
    }
  }, [browserConnected, dojakConnected, dogewatchConnected, ledgerConnected, myDogeConnected, spookyConnected]);

  const disconnectCurrentWallet = useCallback(
    async () => {
      if (walletType === 'mydoge' && myDoge.connected) {
        await myDoge.disconnect();
      }
      if (walletType === 'browser' && browser.connected) {
        await browser.disconnect();
      }
      if (walletType === 'spookydoge' && spookyState.connected) {
        try {
          await getSpookyProvider()?.disconnect?.();
        } catch {
          // Ignore disconnect failures from injected providers.
        }
        setSpookyState(SPOOKY_INITIAL_STATE);
      }
      if (walletType === 'dojak' && dojakState.connected) {
        try {
          await (window.dojak as any)?.disconnect?.();
        } catch {
          // Ignore Dojak disconnect failures.
        }
        setDojakState(DOJAK_INITIAL_STATE);
      }
      if (walletType === 'ledger' && ledgerState.connected) {
        await ledgerWalletRef.current.disconnect();
        setLedgerState(LEDGER_INITIAL_STATE);
      }
      if (walletType === 'dogewatch' && dogewatchState.connected) {
        await dogewatchWalletRef.current.disconnect();
        setDogewatchState(DOGEWATCH_INITIAL_STATE);
      }
    },
    [
      browser.connected,
      browser.disconnect,
      dojakState.connected,
      spookyState.connected,
      ledgerState.connected,
      dogewatchState.connected,
      myDoge.connected,
      myDoge.disconnect,
      walletType,
    ]
  );

  const connectWallet = useCallback(
    async (
      type: WalletType,
      options?: {
        ledgerPrompt?: boolean;
        ledgerVerify?: boolean;
      }
    ) => {
      if (!isInitialized) {
        throw new Error('Wallet system not initialized yet');
      }

      try {
        if (type === 'mydoge') {
          await myDoge.connect();
          setWalletType(type);
          localStorage.setItem('wallet_type', type);
          return;
        }

        if (type === 'spookydoge') {
          const provider = getSpookyProvider();
          if (!provider) {
            throw new Error('Spooky Doge wallet not found');
          }

          setSpookyState((prev) => ({ ...prev, connecting: true }));
          // Spooky Doge injects window.dogecoin and should expose isSpookyWallet=true.
          // Prefer connect()/dedicated methods for best UX; request() remains fallback.
          const response = typeof provider.connect === 'function'
            ? await provider.connect()
            : await provider.request?.({ method: 'doge_requestAccounts' });

          const accounts = extractAccounts(response);
          if (!accounts?.length) {
            throw new Error('No accounts returned from Spooky Doge');
          }

          setSpookyState({
            connected: true,
            address: accounts[0],
            balance: 0,
            connecting: false,
          });
          setWalletType(type);
          localStorage.setItem('wallet_type', type);
          return;
        }

        if (type === 'dojak') {
          if (!(window.dojak as any)?.isDojak) {
            throw new Error('Dojak wallet not found');
          }

          setDojakState((prev) => ({ ...prev, connecting: true }));
          const accounts = await (window.dojak as any).requestAccounts();
          if (!accounts?.length) {
            throw new Error('No accounts returned from Dojak');
          }

          let bal = 0;
          try {
            const result = await (window.dojak as any).getBalance();
            bal = (result?.total || result?.confirmed || 0) / 100000000;
          } catch {
            // Ignore balance fetch failures for Dojak.
          }

          setDojakState({
            connected: true,
            address: accounts[0],
            balance: bal,
            connecting: false,
          });
          setWalletType(type);
          localStorage.setItem('wallet_type', type);
          return;
        }

        if (type === 'ledger') {
          setLedgerState((prev) => ({ ...prev, connecting: true, balanceRefreshing: false, balanceVerified: false, balanceError: null }));
          const account = await ledgerWalletRef.current.connect({
            accountIndex: LedgerWallet.getPersistedAccountIndex(),
            promptUser: options?.ledgerPrompt ?? true,
            verify: options?.ledgerVerify ?? true,
          });
          setLedgerState({
            connected: true,
            address: account.address,
            balance: 0,
            connecting: false,
            balanceRefreshing: false,
            balanceVerified: false,
            balanceError: null,
            accountIndex: account.accountIndex,
            derivationPath: account.derivationPath,
          });
          setWalletType(type);
          localStorage.setItem('wallet_type', type);
          return;
        }

        if (type === 'dogewatch') {
          setDogewatchState((prev) => ({
            ...prev,
            connecting: true,
            balanceRefreshing: false,
            balanceVerified: false,
            balanceError: null,
          }));
          const account = await dogewatchWalletRef.current.connect({
            promptUser: options?.ledgerPrompt ?? true,
          });
          setDogewatchState({
            connected: true,
            address: account.address,
            balance: 0,
            connecting: false,
            balanceRefreshing: false,
            balanceVerified: false,
            balanceError: null,
            walletId: account.walletId,
          });
          setWalletType(type);
          localStorage.setItem('wallet_type', type);
          return;
        }

        const hasStoredWallet = await browser.hasWallet();
        if (!hasStoredWallet) {
          return;
        }

        try {
          const loaded = await browser.loadWallet();
          if (loaded) {
            await browser.connect(loaded);
            setWalletType(type);
            localStorage.setItem('wallet_type', type);
          }
        } catch (error: any) {
          if (
            error?.message?.includes('encrypted') ||
            error?.message?.includes('Password required')
          ) {
            return;
          }
          throw error;
        }
      } catch (error) {
        if (type === 'spookydoge') {
          setSpookyState(SPOOKY_INITIAL_STATE);
        }
        if (type === 'dojak') {
          setDojakState(DOJAK_INITIAL_STATE);
        }
        if (type === 'ledger') {
          setLedgerState(LEDGER_INITIAL_STATE);
          throw new Error(normalizeLedgerError(error));
        }
        if (type === 'dogewatch') {
          setDogewatchState(DOGEWATCH_INITIAL_STATE);
          throw error instanceof Error
            ? error
            : new Error('Failed to connect Dogewatch');
        }
        throw error;
      }
    },
    [browser, isInitialized, myDoge]
  );

  const connectWalletRef = useRef(connectWallet);
  connectWalletRef.current = connectWallet;

  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') {
      return;
    }

    const stored = localStorage.getItem('wallet_type') as WalletType | null;
    if (!stored) {
      return;
    }

    let cancelled = false;

    const timeout = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        try {
          const waitForMyDogeProvider = async (): Promise<boolean> => {
            // MyDoge can inject after app startup; wait briefly before declaring unavailable.
            const deadline = Date.now() + 4000;
            while (!cancelled && Date.now() < deadline) {
              if (getInjectedMyDogeProvider()) return true;
              await new Promise((resolve) => window.setTimeout(resolve, 150));
            }
            return !!getInjectedMyDogeProvider();
          };

          const isAvailable =
            stored === 'mydoge'
              ? await waitForMyDogeProvider()
              : stored === 'spookydoge'
                ? !!getSpookyProvider()
                : stored === 'dojak'
                  ? !!(window.dojak as any)?.isDojak
                : stored === 'ledger'
                  ? false
                  : stored === 'dogewatch'
                    ? false
                  : true;

          if (!isAvailable) {
            if (stored === 'mydoge') {
              // Keep preference; provider may still be initializing.
              console.info('[UNIFIED WALLET] MyDoge provider not ready yet; skipping auto-reconnect this cycle.');
              return;
            }
            localStorage.removeItem('wallet_type');
            setWalletType(null);
            return;
          }

          if (stored === 'mydoge') {
            // MyDoge restore must be passive. Calling connect() on page load can
            // pop the extension approval UI even when the user just refreshed.
            // MyDogeWalletProvider will adopt the session if the extension can
            // report a verified current address without prompting.
            return;
          }

          if (stored === 'ledger' || stored === 'dogewatch') {
            localStorage.removeItem('wallet_type');
            setWalletType(null);
            return;
          }

          await connectWalletRef.current(stored, {
            ledgerPrompt: false,
            ledgerVerify: false,
          });
        } catch (error) {
          if (
            stored === 'mydoge' &&
            error instanceof Error &&
            /not installed|provider not ready/i.test(error.message)
          ) {
            console.info('[UNIFIED WALLET] MyDoge auto-reconnect deferred:', error.message);
            return;
          }
          console.warn('[UNIFIED WALLET] Auto-reconnect failed:', error);
          localStorage.removeItem('wallet_type');
          setWalletType(null);
        }
      })();
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isInitialized]);

  /**
   * If MyDoge restored its connection but unified `walletType` is still null,
   * adopt `mydoge` so connected UI state is consistent after refresh.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !isInitialized || walletType !== null || !myDogeConnected) {
      return;
    }
    const stored = localStorage.getItem('wallet_type') as WalletType | null;
    if (stored && stored !== 'mydoge') {
      return;
    }
    setWalletType('mydoge');
    try {
      localStorage.setItem('wallet_type', 'mydoge');
    } catch {
      // Ignore localStorage sync errors.
    }
  }, [isInitialized, myDogeConnected, walletType]);

  /**
   * If the browser wallet restored itself but unified `walletType` is still null, adopt `browser`.
   * Do not run while localStorage asks for another connector (auto-reconnect is in flight).
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !isInitialized || walletType !== null || !browser.connected) {
      return;
    }
    const stored = localStorage.getItem('wallet_type') as WalletType | null;
    if (stored && stored !== 'browser') {
      return;
    }
    setWalletType('browser');
    try {
      localStorage.setItem('wallet_type', 'browser');
    } catch {
      // Ignore localStorage sync errors.
    }
  }, [browser.connected, isInitialized, walletType]);

  /** After unlock/connect, align unified wallet type when localStorage says browser. */
  useEffect(() => {
    if (typeof window === 'undefined' || !isInitialized || !browser.connected) {
      return;
    }
    const stored = localStorage.getItem('wallet_type');
    if (stored === 'browser' && walletType !== 'browser') {
      setWalletType('browser');
    }
  }, [browser.connected, isInitialized, walletType]);

  const connect = useCallback(
    async (
      type: WalletType,
      options?: { ledgerPrompt?: boolean; ledgerVerify?: boolean }
    ) => {
      await connectWallet(type, options);
    },
    [connectWallet]
  );

  const switchAccount = useCallback(
    async (nextAccountIndex: number, password?: string) => {
      if (!isInitialized) {
        throw new Error('Wallet system not initialized');
      }

      if (walletType === 'browser') {
        await browser.switchAccount(nextAccountIndex, password);
        return;
      }

      if (walletType === 'ledger') {
        setLedgerState((prev) => ({ ...prev, connecting: true }));
        try {
          const account = await ledgerWalletRef.current.switchAccount(nextAccountIndex);
          setLedgerState({
            connected: true,
            address: account.address,
            balance: 0,
            connecting: false,
            balanceRefreshing: false,
            balanceVerified: false,
            balanceError: null,
            accountIndex: account.accountIndex,
            derivationPath: account.derivationPath,
          });
          return;
        } catch (error) {
          setLedgerState((prev) => ({ ...prev, connecting: false }));
          throw error;
        }
      }

      throw new Error('Account switching is only supported for browser and Ledger wallets');
    },
    [browser, isInitialized, walletType]
  );

  const disconnect = useCallback(async () => {
    try {
      await disconnectCurrentWallet();
    } finally {
      setWalletType(null);
      setSpookyState(SPOOKY_INITIAL_STATE);
      setDojakState(DOJAK_INITIAL_STATE);
      setLedgerState(LEDGER_INITIAL_STATE);
      setDogewatchState(DOGEWATCH_INITIAL_STATE);
      localStorage.removeItem('wallet_type');
    }
  }, [disconnectCurrentWallet]);

  const sendTransaction = useCallback(
    async (
      recipientAddress: string,
      amount: number,
      sendOptions?: { opReturnMessage?: string },
    ): Promise<string> => {
      if (!isInitialized) {
        throw new Error('Wallet system not initialized');
      }

      const opReturnMessage = sendOptions?.opReturnMessage?.trim();

      if (walletType === 'mydoge') {
        return myDoge.sendTransaction(recipientAddress, amount);
      }

      if (walletType === 'spookydoge') {
        const provider = getSpookyProvider();
        if (!provider) {
          throw new Error('Spooky Doge wallet not available');
        }
        const result = typeof provider.sendTransaction === 'function'
          ? await provider.sendTransaction({ recipientAddress, dogeAmount: amount })
          : await provider.request?.({
              method: 'doge_sendTransaction',
              params: { recipientAddress, dogeAmount: amount },
            });
        return result?.txId || result?.txid || result;
      }

      if (walletType === 'dojak') {
        if (!window.dojak) {
          throw new Error('Dojak wallet not available');
        }
        return (window.dojak as any).sendBitcoin(
          recipientAddress,
          Math.round(amount * 100000000)
        );
      }

      const useBrowserSend =
        walletType === 'browser' ||
        ((walletType === null || walletType === undefined) &&
          browser.connected &&
          !!browser.address);

      if (useBrowserSend) {
        if (!browser.connected || !browser.address) {
          throw new Error('Browser wallet not connected');
        }
        // Extension-style: open drawer and require explicit Approve before signing.
        const txid = (await requestWalletApproval({
          title: 'Send DOGE',
          description: 'Approve to sign and broadcast this transfer from your Local Browser Wallet.',
          details: [
            { label: 'To', value: recipientAddress },
            { label: 'Amount', value: `${amount} DOGE` },
            ...(opReturnMessage ? [{ label: 'Memo', value: opReturnMessage }] : []),
          ],
          approveLabel: 'Approve send',
          onApprove: async ({ privateKeyWif, address }) => {
            const utxosRaw = await getAddressUtxos(address);
            if (utxosRaw.length === 0) {
              throw new Error('No spendable UTXOs for this address. Wait for a deposit to confirm.');
            }
            const utxos = utxosRaw.map((u) => ({
              txid: u.txid,
              vout: u.vout,
              value: u.value,
              scriptPubKey: u.scriptPubKey,
            }));
            const storage = new BrowserWallet();
            return storage.sendTransaction(recipientAddress, amount, {
              wallet: {
                ...(browser.wallet || { address, network: 'mainnet' as const }),
                privateKey: privateKeyWif,
                address,
              },
              address,
              utxos,
              broadcastTx,
              minConfirmations: 0,
              includeInscribedUtxos: false,
              opReturnMessage,
            });
          },
        })) as string;
        return txid;
      }

      if (walletType === 'ledger') {
        throw new Error(
          'Sending DOGE from Ledger is not wired for simple transfers yet. Use Local browser wallet or an extension for this action.'
        );
      }

      throw new Error('Transaction sending is not supported for the current wallet');
    },
    [browser.address, browser.connected, isInitialized, myDoge, walletType]
  );

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!isInitialized) {
        throw new Error('Wallet system not initialized');
      }

      warnIfUnexpectedSigningHostname('Message signing');

      if (walletType === 'mydoge') {
        return myDoge.signMessage(message);
      }

      if (walletType === 'spookydoge') {
        const provider = getSpookyProvider();
        if (!provider) {
          throw new Error('Spooky Doge wallet not available');
        }
        const response = typeof provider.signMessage === 'function'
          ? await provider.signMessage(message)
          : await provider.request?.({ method: 'doge_signMessage', params: { message } });
        return response?.signature || response?.signedMessage || response;
      }

      if (walletType === 'dojak') {
        if (!window.dojak) {
          throw new Error('Dojak wallet not available');
        }
        return (window.dojak as any).signMessage(message, 'ecdsa');
      }
      if (walletType === 'ledger') {
        return ledgerWalletRef.current.signMessage(message);
      }
      if (walletType === 'dogewatch') {
        const signature = await dogewatchWalletRef.current.signMessage(message);
        console.log('[UnifiedWallet] signMessage:dogewatch:result', {
          length: signature.length,
        });
        return signature;
      }

      throw new Error('Message signing is not supported for the current wallet');
    },
    [isInitialized, myDoge, walletType]
  );

  const signPSBT = useCallback(
    async (psbtHex: string): Promise<string> => {
      console.log('[UnifiedWallet] signPSBT:start', {
        walletType,
        length: psbtHex.length,
        prefix: psbtHex.slice(0, 32),
      });
      if (walletType === 'mydoge') {
        const result = await myDoge.signPSBT(psbtHex);
        console.log('[UnifiedWallet] signPSBT:mydoge:result', {
          length: result.length,
          prefix: result.slice(0, 32),
        });
        return result;
      }

      if (walletType === 'spookydoge') {
        const provider = getSpookyProvider();
        if (!provider) {
          throw new Error('Spooky Doge wallet not available');
        }
        const response = typeof provider.signPsbt === 'function'
          ? await provider.signPsbt({ rawTx: psbtHex, indexes: [], signOnly: false, partial: false })
          : await provider.request?.({
              method: 'doge_signPsbt',
              params: { rawTx: psbtHex, indexes: [], signOnly: false, partial: false },
            });
        console.log('[UnifiedWallet] signPSBT:spookydoge:response', response);
        return response?.signedTx || response?.signedRawTx || response?.signedPsbt || response?.txHex || response;
      }

      if (walletType === 'dojak') {
        const dojak = getDojakProvider();
        if (!dojak) {
          throw new Error('Dojak wallet not available');
        }
        if (typeof dojak.signPsbt === 'function') {
          const response = await dojak.signPsbt(psbtHex);
          return pickDojakSignedPayload(response);
        }
        if (typeof dojak.signRequest === 'function') {
          const response = await dojak.signRequest({
            rawTx: psbtHex,
            psbtHex,
            psbtBase64: psbtHex,
            indexes: [],
            signOnly: false,
            partial: false,
          });
          return pickDojakSignedPayload(response);
        }
        if (typeof dojak.request === 'function') {
          const response = await dojak.request({
            method: 'dojak_signPsbt',
            params: { rawTx: psbtHex, indexes: [], signOnly: false, partial: false },
          });
          return pickDojakSignedPayload(response);
        }
        throw new Error('Dojak wallet does not expose a PSDT signing method');
      }

      if (walletType === 'browser') {
        const session = browser.wallet;
        if (session?.privateKey && address && session.address === address) {
          warnIfUnexpectedSigningHostname('PSDT signing');
          return await signPsdtWithWifToTxHex(psbtHex, session.privateKey);
        }
        const w = await browser.loadWallet();
        if (!w) {
          throw new Error('Unlock your browser wallet to sign PSBTs.');
        }
        const local = new BrowserWallet();
        return local.signPSBT(psbtHex, undefined, undefined, w.address);
      }

      if (walletType === 'ledger') {
        throw new Error(
          'Ledger’s Dogecoin app uses the legacy Ledger interface: it cannot sign PSBTs from web apps (only older “build transaction” flows). ' +
            'doggy.market-style buys need PSDT signing. Use MyDoge, Dojak, SpookyDoge, or Dojakweb’s in-browser wallet for this step.',
        );
      }

      if (walletType === 'dogewatch') {
        const { psbtHex: preparedHex } = preparePsdtForMyDogeSign(psbtHex);
        const signed = await dogewatchWalletRef.current.signPsbt(preparedHex);
        console.log('[UnifiedWallet] signPSBT:dogewatch:result', {
          length: signed.length,
          prefix: signed.slice(0, 32),
        });
        return signed;
      }

      throw new Error('PSDT signing is not supported for the current wallet');
    },
    [address, browser, myDoge, walletType]
  );

  const signPSBTOnly = useCallback(
    async (psbtInput: string): Promise<string> => {
      console.log('[UnifiedWallet] signPSBTOnly:start', {
        walletType,
        length: psbtInput.length,
        prefix: psbtInput.slice(0, 32),
      });

      if (walletType === 'mydoge') {
        const { psbtHex, indexes, sighashType } = preparePsdtForMyDogeSign(psbtInput);
        const result = await myDoge.signPSBTOnly(psbtHex);
        // MyDoge returns a raw transaction instead of a signed PSBT
        // Since coerceSignedPsdtToRawTxHex can handle raw transactions,
        // we return the result as-is without trying to normalize it to base64
        console.log('[UnifiedWallet] signPSBTOnly:mydoge:result', {
          length: result.length,
          prefix: result.slice(0, 32),
          indexes,
          sighashType,
        });
        return result;
      }

      if (walletType === 'spookydoge') {
        const provider = getSpookyProvider();
        if (!provider) {
          throw new Error('Spooky Doge wallet not available');
        }
        const { psbtBase64, indexes } = preparePsdtForExtensionSign(psbtInput);
        // SpookyDoge doge_signPsbt expects psbtHex (hex-encoded PSBT), not base64.
        // We send both psbtHex and rawTx so older/newer builds both find what they need.
        const psbtHex = Buffer.from(psbtBase64, 'base64').toString('hex');
        const spookyParams = {
          psbtHex,              // canonical field per doge_signPsbt spec (sus.market / SpookyDoge v2)
          rawTx: psbtBase64,    // legacy alias accepted by some builds
          indexes,
          signInputs: indexes,  // alias used by some SpookyDoge builds
          signOnly: true,
          partial: true,
          message: '',
          imageUrl: '',
        };
        const response = typeof provider.signPsbt === 'function'
          ? await provider.signPsbt(spookyParams)
          : await provider.request?.({
              method: 'doge_signPsbt',
              params: spookyParams,
            });
        console.log('[UnifiedWallet] signPSBTOnly:spookydoge:response', response);
        const signed = response?.signedPsbt || response?.signedRawTx || response?.signedTx || response?.txHex || response;
        return normalizeSignedPsdtToBase64(typeof signed === 'string' ? signed : String(signed));
      }

      if (walletType === 'dojak') {
        const dojak = getDojakProvider();
        if (!dojak) {
          throw new Error('Dojak wallet not available');
        }
        const { psbtBase64, indexes } = preparePsdtForExtensionSign(psbtInput);
        let signed: any;
        if (typeof dojak.signPsbt === 'function') {
          signed = await dojak.signPsbt(psbtBase64, { autoFinalized: false });
        } else if (typeof dojak.signRequest === 'function') {
          signed = await dojak.signRequest({
            rawTx: psbtBase64,
            psbtBase64,
            indexes,
            signOnly: true,
            partial: true,
          });
        } else if (typeof dojak.request === 'function') {
          signed = await dojak.request({
            method: 'dojak_signPsbt',
            params: { rawTx: psbtBase64, indexes, signOnly: true, partial: true },
          });
        } else {
          throw new Error('Dojak wallet does not expose a PSDT signing method');
        }
        return normalizeSignedPsdtToBase64(pickDojakSignedPayload(signed));
      }

      if (walletType === 'browser') {
        const session = browser.wallet;
        let signed: string;
        if (session?.privateKey && address && session.address === address) {
          warnIfUnexpectedSigningHostname('partial PSDT signing');
          // signPartialPsdtWithWifToHex: signs buyer inputs only, returns PSBT hex (NOT finalized)
          signed = await signPartialPsdtWithWifToHex(psbtInput, session.privateKey);
        } else {
          const w = await browser.loadWallet();
          if (!w) {
            throw new Error('Unlock your browser wallet to sign PSBTs.');
          }
          const local = new BrowserWallet();
          // signPSBTOnly: partial sign → signed PSBT hex (not finalized raw tx)
          signed = await local.signPSBTOnly(psbtInput, undefined, undefined, w.address);
        }
        console.log('[UnifiedWallet] signPSBTOnly:browser:result', {
          length: signed.length,
          prefix: signed.slice(0, 32),
        });
        return signed;
      }

      if (walletType === 'ledger') {
        throw new Error(
          'Ledger’s Dogecoin app uses the legacy Ledger interface: it cannot sign PSBTs from web apps (only older “build transaction” flows). ' +
            'doggy.market-style buys need PSDT signing. Use MyDoge, Dojak, SpookyDoge, or Dojakweb’s in-browser wallet for this step.',
        );
      }

      if (walletType === 'dogewatch') {
        const { psbtHex } = preparePsdtForMyDogeSign(psbtInput);
        const signedHex = await dogewatchWalletRef.current.signPsbt(psbtHex);
        console.log('[UnifiedWallet] signPSBTOnly:dogewatch:result', {
          length: signedHex.length,
          prefix: signedHex.slice(0, 32),
        });
        return normalizeSignedPsdtToBase64(signedHex);
      }

      throw new Error('PSDT signing is not supported for the current wallet');
    },
    [address, browser, myDoge, walletType]
  );

  const signDMPIntent = useCallback(
    async <T extends DmpIntentType>(
      intentType: T,
      params: DmpIntentParams<T>
    ): Promise<SignedDmpIntent<T>> => {
      if (!address) {
        throw new Error('Connect a wallet before signing ÐMP intents');
      }

      if (walletType === 'browser') {
        const browserWallet = new BrowserWallet();
        return signDMPIntentService(intentType, {
          ...params,
          activeAddress: address,
          signMessage: (message) => browserWallet.signMessage(message, undefined, address),
        });
      }

      if (walletType === 'mydoge') {
        return signDMPIntentService(intentType, {
          ...params,
          activeAddress: address,
          signMessage: (message) => myDoge.signMessage(message),
        });
      }

      if (walletType === 'spookydoge') {
        const provider = getSpookyProvider();
        if (!provider) {
          throw new Error('Spooky Doge wallet not available');
        }
        return signDMPIntentService(intentType, {
          ...params,
          activeAddress: address,
          signMessage: async (message) => {
            const response = typeof provider.signMessage === 'function'
              ? await provider.signMessage(message)
              : await provider.request?.({ method: 'doge_signMessage', params: { message } });
            return response?.signature || response?.signedMessage || response;
          },
        });
      }

      if (walletType === 'dojak') {
        if (!window.dojak) {
          throw new Error('Dojak wallet not available');
        }
        return signDMPIntentService(intentType, {
          ...params,
          activeAddress: address,
          signMessage: (message) => (window.dojak as any).signMessage(message, 'ecdsa'),
        });
      }

      if (walletType === 'ledger') {
        return signDMPIntentService(intentType, {
          ...params,
          activeAddress: address,
          signMessage: (message) => ledgerWalletRef.current.signMessage(message),
        });
      }

      if (walletType === 'dogewatch') {
        return signDMPIntentService(intentType, {
          ...params,
          activeAddress: address,
          signMessage: (message) => dogewatchWalletRef.current.signMessage(message),
        });
      }

      throw new Error('ÐMP signing is not supported for the current wallet');
    },
    [address, myDoge, walletType]
  );

  const sendInscription = useCallback(
    async (recipientAddress: string, location: string): Promise<string> => {
      if (walletType === 'mydoge') {
        return myDoge.sendInscription(recipientAddress, location);
      }
      if (walletType === 'spookydoge') {
        const provider = getSpookyProvider();
        if (!provider) {
          throw new Error('Spooky Doge wallet not available');
        }
        const response = typeof provider.sendDoginal === 'function'
          ? await provider.sendDoginal({ recipientAddress, location })
          : await provider.request?.({
              method: 'doge_sendDoginal',
              params: { recipientAddress, location },
            });
        return response?.txId || response?.txid || response;
      }
      if (walletType === 'dojak') {
        if (!window.dojak) {
          throw new Error('Dojak wallet not available');
        }
        return (window.dojak as any).sendInscription(recipientAddress, location);
      }

      throw new Error('Inscription sending is not supported for this wallet type');
    },
    [myDoge, walletType]
  );

  const getTransactionStatus = useCallback(
    async (txId: string) => {
      if (walletType === 'mydoge') {
        return myDoge.getTransactionStatus(txId);
      }
      if (walletType === 'spookydoge') {
        const provider = getSpookyProvider();
        if (!provider) {
          throw new Error('Spooky Doge wallet not available');
        }
        const response = typeof provider.getTransactionStatus === 'function'
          ? await provider.getTransactionStatus({ txId })
          : await provider.request?.({ method: 'dogecoin_getTransactionStatus', params: { txId } });
        return { status: response?.status || 'unknown', confirmations: Number(response?.confirmations || 0) };
      }
      throw new Error('Transaction status is not supported for this wallet type');
    },
    [myDoge, walletType]
  );


  const refreshBalance = useCallback(async () => {
    if (!address) {
      return;
    }

    if (walletType === 'browser') {
      await browser.refreshBalance();
      return;
    }

    if (walletType === 'spookydoge') {
      const provider = getSpookyProvider();
      try {
        const result = typeof provider?.getBalance === 'function'
          ? await provider.getBalance()
          : await provider?.request?.({ method: 'doge_getBalance' });
        setSpookyState((prev) => ({ ...prev, balance: normalizeSpookyBalance(result) }));
      } catch {
        // Ignore transient extension/API failures.
      }
      return;
    }

    if (walletType === 'ledger') {
      setLedgerState((prev) => ({ ...prev, balanceRefreshing: true, balanceError: null }));
      try {
        const nextBalance = await fetchBalance(address);
        setLedgerState((prev) => ({
          ...prev,
          balance: nextBalance,
          balanceRefreshing: false,
          balanceVerified: true,
          balanceError: null,
        }));
      } catch (error: any) {
        setLedgerState((prev) => ({
          ...prev,
          balanceRefreshing: false,
          balanceVerified: false,
          balanceError: error?.message || 'Unable to refresh balance right now.',
        }));
      }
      return;
    }

    if (walletType === 'dogewatch') {
      setDogewatchState((prev) => ({ ...prev, balanceRefreshing: true, balanceError: null }));
      try {
        const nextBalance = await fetchBalance(address);
        setDogewatchState((prev) => ({
          ...prev,
          balance: nextBalance,
          balanceRefreshing: false,
          balanceVerified: true,
          balanceError: null,
        }));
      } catch (error: any) {
        setDogewatchState((prev) => ({
          ...prev,
          balanceRefreshing: false,
          balanceVerified: false,
          balanceError: error?.message || 'Unable to refresh balance right now.',
        }));
      }
    }
  }, [address, browser.refreshBalance, walletType]);

  useEffect(() => {
    if (walletType !== 'ledger' || !ledgerState.connected || !ledgerState.address || typeof window === 'undefined') {
      return;
    }

    const timeout = window.setTimeout(() => {
      void refreshBalance();
    }, 0);

    const interval = window.setInterval(() => {
      void refreshBalance();
    }, 60000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [ledgerState.address, ledgerState.connected, refreshBalance, walletType]);

  useEffect(() => {
    if (walletType !== 'dogewatch' || !dogewatchState.connected || !dogewatchState.address || typeof window === 'undefined') {
      return;
    }

    const timeout = window.setTimeout(() => {
      void refreshBalance();
    }, 0);

    const interval = window.setInterval(() => {
      void refreshBalance();
    }, 60000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [dogewatchState.address, dogewatchState.connected, refreshBalance, walletType]);

  const value: UnifiedWalletContextValue = {
    walletType,
    connected,
    address,
    balance,
    balanceVerified,
    connecting,
    accountIndex,
    derivationPath,
    availableWallets,
    connect,
    setActiveWallet,
    refreshBalance,
    balanceRefreshing,
    balanceError,
    switchAccount,
    disconnect,
    sendTransaction,
    signMessage,
    signPSBT,
    signPSBTOnly,
    signDMPIntent,
    sendInscription,
    getTransactionStatus,
    createBrowserWallet: () => browser.createWallet(),
    importBrowserWallet: (privateKey: string) => browser.importWallet(privateKey),
    importBrowserWalletFromMnemonic: (mnemonic: string, passphrase?: string) =>
      browser.importWalletFromMnemonic(mnemonic, passphrase),
    saveBrowserWallet: (
      wallet: WalletData,
      password?: string,
      options?: { seedMaterial?: { mnemonic: string; passphrase?: string } | null }
    ) => browser.saveWallet(wallet, password, options),
    loadBrowserWallet: (password?: string) => browser.loadWallet(password),
    loadBrowserSeedMaterial: (password?: string) => browser.loadSeedMaterial(password),
    hasBrowserWallet: () => browser.hasWallet(),
    removeBrowserWallet: () => browser.removeWallet(),
  };

  return (
    <UnifiedWalletContext.Provider value={value}>
      {/* @ts-ignore - Next.js type checking issue with React.ReactNode */}
      {children}
    </UnifiedWalletContext.Provider>
  );
}

export { useUnifiedWallet } from './useUnifiedWallet';
