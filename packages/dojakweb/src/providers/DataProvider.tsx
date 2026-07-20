import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { walletDataApi, DRC20Token, DuneHolding, MyDogeInscription, WalletInfo } from '../utils/api';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { toast } from 'sonner';
import { charmsService } from '../services/charmsService';
import type { CharmsToken } from '../lib/charms/types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface DataProviderContextType {
  // DRC-20 Tokens
  drc20Tokens: DRC20Token[] | null;
  isLoadingDrc20Tokens: boolean;
  drc20TokensError: string | null;
  lastDrc20TokensUpdate: number | null;
  refreshDrc20Tokens: () => Promise<void>;
  canRefreshDrc20Tokens: boolean;
  timeUntilDrc20TokensRefresh: number;

  // Inscriptions
  inscriptions: MyDogeInscription[] | null;
  isLoadingInscriptions: boolean;
  inscriptionsError: string | null;
  lastInscriptionsUpdate: number | null;
  refreshInscriptions: () => Promise<void>;
  canRefreshInscriptions: boolean;
  timeUntilInscriptionsRefresh: number;

  // Dunes
  dunes: DuneHolding[] | null;
  isLoadingDunes: boolean;
  dunesError: string | null;

  // Charms
  charmsTokens: Map<string, CharmsToken> | null;
  isLoadingCharms: boolean;
  charmsError: string | null;
  refreshCharms: () => Promise<void>;

  // Wallet info
  walletInfo: WalletInfo | null;
  isLoadingWalletInfo: boolean;
  walletInfoError: string | null;

  // UTXOs
  utxos: any[] | null;
  isLoadingUtxos: boolean;
  utxosError: string | null;

  // Wallet data (both tokens and inscriptions)
  refreshWalletData: () => Promise<void>;
  canRefreshWallet: boolean;
  timeUntilWalletRefresh: number;
}

const DataProviderContext = createContext<DataProviderContextType | undefined>(undefined);

interface DataProviderProps {
  children: ReactNode;
}

// Cache configuration
const CACHE_CONFIG = {
  DRC20_TOKENS: {
    ttl: 30 * 60 * 1000, // 30 minutes (tokens don't change often)
    forceRefreshCooldown: 5 * 60 * 1000, // 5 minutes between forced refreshes
  },
  INSCRIPTIONS: {
    ttl: 15 * 60 * 1000, // 15 minutes (inscriptions change more frequently)
    forceRefreshCooldown: 5 * 60 * 1000, // 5 minutes between forced refreshes
  },
  WALLET_DATA: {
    forceRefreshCooldown: 5 * 60 * 1000, // 5 minutes between full wallet refreshes
  }
};

// Helper function to get wallet-specific cache key
const getWalletCacheKey = (baseKey: string, walletAddress: string) => {
  return `bork_${baseKey}_${walletAddress}`;
};

const normalizeUtxos = (response: any): any[] => {
  if (Array.isArray(response?.utxos)) return response.utxos;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.result)) return response.result;
  if (Array.isArray(response?.list)) return response.list;
  if (Array.isArray(response)) return response;
  return [];
};

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { address: walletAddress, connected: walletConnected } = useUnifiedWallet();
  const toastRef = React.useRef(toast);
  toastRef.current = toast;
  const prevWalletAddressRef = React.useRef<string | null>(null);

  // Stable reference for dependents (inline `{ getAddress }` changes every render and breaks useCallback deps).
  const wallet = useMemo(
    () =>
      walletConnected && walletAddress
        ? {
            getAddress: () => walletAddress,
          }
        : null,
    [walletConnected, walletAddress]
  );

  // Safely get wallet address
  const getWalletAddress = React.useCallback(() => {
    try {
      return walletAddress || null;
    } catch (error) {
      console.warn('Failed to get wallet address:', error);
      return null;
    }
  }, [walletAddress]);

  // DRC-20 Tokens state
  const [drc20Tokens, setDrc20Tokens] = useState<DRC20Token[] | null>(null);
  const [isLoadingDrc20Tokens, setIsLoadingDrc20Tokens] = useState(false);
  const [drc20TokensError, setDrc20TokensError] = useState<string | null>(null);
  const [lastDrc20TokensUpdate, setLastDrc20TokensUpdate] = useState<number | null>(null);
  const [lastDrc20TokensForceRefresh, setLastDrc20TokensForceRefresh] = useState<number | null>(null);

  // Inscriptions state
  const [inscriptions, setInscriptions] = useState<MyDogeInscription[] | null>(null);
  const [isLoadingInscriptions, setIsLoadingInscriptions] = useState(false);
  const [inscriptionsError, setInscriptionsError] = useState<string | null>(null);
  const [lastInscriptionsUpdate, setLastInscriptionsUpdate] = useState<number | null>(null);
  const [lastInscriptionsForceRefresh, setLastInscriptionsForceRefresh] = useState<number | null>(null);

  const [dunes, setDunes] = useState<DuneHolding[] | null>(null);
  const [isLoadingDunes, setIsLoadingDunes] = useState(false);
  const [dunesError, setDunesError] = useState<string | null>(null);
  const [charmsTokens, setCharmsTokens] = useState<Map<string, CharmsToken> | null>(null);
  const [isLoadingCharms, setIsLoadingCharms] = useState(false);
  const [charmsError, setCharmsError] = useState<string | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoadingWalletInfo, setIsLoadingWalletInfo] = useState(false);
  const [walletInfoError, setWalletInfoError] = useState<string | null>(null);
  const [utxos, setUtxos] = useState<any[] | null>(null);
  const [isLoadingUtxos, setIsLoadingUtxos] = useState(false);
  const [utxosError, setUtxosError] = useState<string | null>(null);

  // Combined wallet refresh state
  const [lastWalletForceRefresh, setLastWalletForceRefresh] = useState<number | null>(null);

  // Cache utilities
  const getCacheEntry = <T,>(key: string): CacheEntry<T> | null => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - entry.timestamp > entry.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      return entry;
    } catch (error) {
      console.warn(`Failed to read cache for ${key}:`, error);
      localStorage.removeItem(key);
      return null;
    }
  };

  const setCacheEntry = <T,>(key: string, data: T, ttl: number) => {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.warn(`Failed to write cache for ${key}:`, error);
    }
  };

  // Check if wallet is too new to warrant API calls
  const isWalletTooNew = useCallback((address: string) => {
    try {
      const createdAtStr = localStorage.getItem(`wallet_created_${address}`);
      if (!createdAtStr) return false; // Not a browser wallet or no creation time tracked

      const createdAt = parseInt(createdAtStr);
      const now = Date.now();
      const ageInMinutes = (now - createdAt) / (1000 * 60);

      // Consider wallet too new if less than 5 minutes old
      return ageInMinutes < 5;
    } catch (error) {
      console.warn('Error checking wallet age:', error);
      return false;
    }
  }, []);

  // DRC-20 Tokens functions
  const refreshDrc20Tokens = useCallback(async (force = false) => {
    if (!walletConnected || !walletAddress) {
      console.log('No wallet connected for DRC-20 tokens refresh');
      return;
    }

    // Skip API calls for very new wallets (likely empty)
    if (!force && walletAddress && isWalletTooNew(walletAddress)) {
      console.log('Skipping DRC-20 tokens refresh for new wallet');
      setDrc20Tokens([]); // Set empty array instead of null
      setLastDrc20TokensUpdate(Date.now());
      return;
    }

    // Check cooldown for forced refreshes
    if (force) {
      const now = Date.now();
      const lastForce = lastDrc20TokensForceRefresh;
      if (lastForce && now - lastForce < CACHE_CONFIG.DRC20_TOKENS.forceRefreshCooldown) {
        const remaining = Math.ceil((CACHE_CONFIG.DRC20_TOKENS.forceRefreshCooldown - (now - lastForce)) / 1000);
        toastRef.current?.error(`Please wait ${remaining} seconds before forcing another refresh`);
        return;
      }
      setLastDrc20TokensForceRefresh(now);
    }

    // Check cache unless forcing refresh
    if (!force) {
      if (walletAddress) {
        const cacheKey = getWalletCacheKey('drc20_tokens', walletAddress);
        const cached = getCacheEntry<DRC20Token[]>(cacheKey);
        if (cached) {
          console.log('Using cached DRC-20 tokens');
          setDrc20Tokens(cached.data);
          setLastDrc20TokensUpdate(cached.timestamp);
          return;
        }
      }
    }

    setIsLoadingDrc20Tokens(true);
    setDrc20TokensError(null); // Clear previous error
    try {
      console.log('Fetching fresh DRC-20 tokens');
      const tokens = await walletDataApi.fetchDRC20Tokens(walletAddress!);

      setDrc20Tokens(tokens);
      setLastDrc20TokensUpdate(Date.now());
      if (walletAddress) {
        const cacheKey = getWalletCacheKey('drc20_tokens', walletAddress);
        setCacheEntry(cacheKey, tokens, CACHE_CONFIG.DRC20_TOKENS.ttl);
      }

      if (force) {
        // Don't show individual success toasts when force refreshing from main refresh function
        // The main refresh function will show a single "Wallet data refreshed" toast
      }
    } catch (error: any) {
      console.error('Failed to refresh DRC-20 tokens:', error);
      setDrc20TokensError('Unable to retrieve DRC-20 tokens');
      toastRef.current?.error('Failed to refresh DRC-20 tokens');
    } finally {
      setIsLoadingDrc20Tokens(false);
    }
  }, [lastDrc20TokensForceRefresh, walletConnected, walletAddress, isWalletTooNew]);

  // Inscriptions functions
  const refreshInscriptions = useCallback(async (force = false) => {
    if (!walletConnected || !walletAddress) {
      console.log('No wallet connected for inscriptions refresh');
      return;
    }

    // Skip API calls for very new wallets (likely empty)
    if (!force && walletAddress && isWalletTooNew(walletAddress)) {
      console.log('Skipping inscriptions refresh for new wallet');
      setInscriptions([]); // Set empty array instead of null
      setLastInscriptionsUpdate(Date.now());
      return;
    }

    // Check cooldown for forced refreshes
    if (force) {
      const now = Date.now();
      const lastForce = lastInscriptionsForceRefresh;
      if (lastForce && now - lastForce < CACHE_CONFIG.INSCRIPTIONS.forceRefreshCooldown) {
        const remaining = Math.ceil((CACHE_CONFIG.INSCRIPTIONS.forceRefreshCooldown - (now - lastForce)) / 1000);
        toastRef.current?.error(`Please wait ${remaining} seconds before forcing another refresh`);
        return;
      }
      setLastInscriptionsForceRefresh(now);
    }

    // Check cache unless forcing refresh
    if (!force) {
      const addr = getWalletAddress();
      if (addr) {
        const cacheKey = getWalletCacheKey('inscriptions', addr);
        const cached = getCacheEntry<MyDogeInscription[]>(cacheKey);
        if (cached) {
          console.log('Using cached inscriptions');
          setInscriptions(cached.data);
          setLastInscriptionsUpdate(cached.timestamp);
          return;
        }
      }
    }

    setIsLoadingInscriptions(true);
    setInscriptionsError(null); // Clear previous error
    try {
      console.log('Fetching fresh inscriptions');
      const walletInscriptions = await walletDataApi.fetchInscriptions(walletAddress);

      setInscriptions(walletInscriptions);
      setLastInscriptionsUpdate(Date.now());
      if (walletAddress) {
        const cacheKey = getWalletCacheKey('inscriptions', walletAddress);
        setCacheEntry(cacheKey, walletInscriptions, CACHE_CONFIG.INSCRIPTIONS.ttl);
      }

      if (force) {
        // Don't show individual success toasts when force refreshing from main refresh function
        // The main refresh function will show a single "Wallet data refreshed" toast
      }
    } catch (error: any) {
      console.error('Failed to refresh inscriptions:', error);
      setInscriptionsError('Unable to retrieve Inscriptions');
      toastRef.current?.error('Failed to refresh inscriptions');
    } finally {
      setIsLoadingInscriptions(false);
    }
  }, [lastInscriptionsForceRefresh, walletConnected, walletAddress, isWalletTooNew, getWalletAddress]);

  const refreshDunes = useCallback(async () => {
    if (!walletConnected || !walletAddress) return;
    setIsLoadingDunes(true);
    setDunesError(null);
    try {
      const nextDunes = await walletDataApi.fetchDunes(walletAddress);
      setDunes(nextDunes);
    } catch (error) {
      console.error('Failed to refresh dunes:', error);
      setDunesError('Unable to retrieve Ðunes');
    } finally {
      setIsLoadingDunes(false);
    }
  }, [walletConnected, walletAddress]);

  const refreshCharms = useCallback(async () => {
    if (!walletConnected || !walletAddress) return;
    setIsLoadingCharms(true);
    setCharmsError(null);
    try {
      const utxoResponse = await walletDataApi.fetchUtxos(walletAddress);
      const walletUtxos = normalizeUtxos(utxoResponse);
      const charmResults = await Promise.allSettled(
        walletUtxos
          .filter((utxo) => typeof utxo.txid === 'string' && Number.isFinite(Number(utxo.vout)))
          .map((utxo) => charmsService.getCharmsByUtxo(utxo.txid, Number(utxo.vout))),
      );
      const indexed = charmResults.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      charmResults.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.debug('[charms] UTXO lookup failed', i, r.reason);
        }
      });
      const nextTokens = new Map<string, CharmsToken>();
      for (const charm of indexed) {
        if (charm.spent_by_txid) continue;
        const key = `${charm.txid}:${charm.vout}:${charm.app_id}`;
        const rawBalance = charm.charm_data?.balance ?? charm.charm_data?.amount ?? charm.charm_data?.value ?? '1';
        const balance = BigInt(String(rawBalance));
        nextTokens.set(key, {
          id: key,
          chainId: 'doge',
          txid: charm.txid,
          vout: charm.vout,
          confirmed: true,
          ticker: charm.app_id,
          name: charm.app_id,
          balance,
          decimals: 0,
          address: walletAddress,
          scriptPubKey: '',
          transferHistory: [],
          chainSupply: { btc: 0n, ltc: 0n, doge: balance, ada: 0n },
          beamHistory: [],
        });
      }
      setCharmsTokens(nextTokens);
    } catch (error) {
      console.error('Failed to refresh Charms:', error);
      setCharmsError('Unable to retrieve Charms tokens');
    } finally {
      setIsLoadingCharms(false);
    }
  }, [walletConnected, walletAddress]);

  const refreshWalletInfo = useCallback(async () => {
    if (!walletConnected || !walletAddress) return;
    setIsLoadingWalletInfo(true);
    setWalletInfoError(null);
    try {
      const [nextWalletInfo, nextUtxoResponse] = await Promise.all([
        walletDataApi.fetchWalletInfo(walletAddress),
        walletDataApi.fetchUtxos(walletAddress),
      ]);
      const nextUtxos = normalizeUtxos(nextUtxoResponse);

      setUtxos(nextUtxos);
      setUtxosError(null);
      setWalletInfo({
        ...nextWalletInfo,
        totalUtxos: nextUtxos.length,
      });
    } catch (error) {
      console.error('Failed to refresh wallet info:', error);
      setWalletInfoError('Unable to retrieve wallet balance');
      setUtxosError('Unable to retrieve UTXOs');
    } finally {
      setIsLoadingWalletInfo(false);
    }
  }, [walletConnected, walletAddress]);

  const refreshUtxos = useCallback(async () => {
    if (!walletConnected || !walletAddress) return;
    setIsLoadingUtxos(true);
    setUtxosError(null);
    try {
      const nextUtxoResponse = await walletDataApi.fetchUtxos(walletAddress);
      const nextUtxos = normalizeUtxos(nextUtxoResponse);
      setUtxos(nextUtxos);
      setWalletInfo((current) => current ? { ...current, totalUtxos: nextUtxos.length } : current);
    } catch (error) {
      console.error('Failed to refresh UTXOs:', error);
      setUtxosError('Unable to retrieve UTXOs');
    } finally {
      setIsLoadingUtxos(false);
    }
  }, [walletConnected, walletAddress]);

  // Combined wallet data refresh
  const refreshWalletData = useCallback(async (force = false) => {
    if (!walletConnected || !walletAddress) return;

    // Check cooldown for forced refreshes
    if (force) {
      const now = Date.now();
      const lastForce = lastWalletForceRefresh;
      if (lastForce && now - lastForce < CACHE_CONFIG.WALLET_DATA.forceRefreshCooldown) {
        const remaining = Math.ceil((CACHE_CONFIG.WALLET_DATA.forceRefreshCooldown - (now - lastForce)) / 1000);
        toastRef.current?.error(`Please wait ${remaining} seconds before forcing another wallet refresh`);
        return;
      }
      setLastWalletForceRefresh(now);
    }

    await Promise.all([
      refreshWalletInfo(),
      refreshDrc20Tokens(force),
      refreshInscriptions(force),
      refreshDunes(),
      refreshCharms(),
      refreshUtxos(),
    ]);

    if (force) {
      toastRef.current?.success('Wallet data refreshed');
    }
  }, [
    walletConnected,
    walletAddress,
    lastWalletForceRefresh,
    refreshDrc20Tokens,
    refreshInscriptions,
    refreshDunes,
    refreshCharms,
    refreshUtxos,
    refreshWalletInfo,
  ]);

  // Auto-refresh when wallet changes
  React.useEffect(() => {
    const currentAddress = getWalletAddress();

    // Only refresh if the wallet address actually changed
    if (currentAddress !== prevWalletAddressRef.current) {
      prevWalletAddressRef.current = currentAddress;

      if (walletConnected && currentAddress) {
        // Wallet connected/changed - refresh data
        refreshWalletInfo();
        refreshDrc20Tokens(false);
        refreshInscriptions(false);
        refreshDunes();
        refreshCharms();
      } else {
        // Clear data when wallet disconnects
        setWalletInfo(null);
        setDrc20Tokens(null);
        setInscriptions(null);
        setDunes(null);
        setCharmsTokens(null);
        setUtxos(null);
        setLastDrc20TokensUpdate(null);
        setLastInscriptionsUpdate(null);
      }
    }
  }, [walletConnected, getWalletAddress, refreshWalletInfo, refreshDrc20Tokens, refreshInscriptions, refreshDunes]);

  React.useEffect(() => {
    const handleProviderChange = () => {
      if (walletConnected && walletAddress) {
        refreshWalletInfo();
        refreshDrc20Tokens(false);
        refreshInscriptions(false);
        refreshDunes();
      }
    };

    window.addEventListener('dojakweb:wallet-provider-updated', handleProviderChange);
    return () => window.removeEventListener('dojakweb:wallet-provider-updated', handleProviderChange);
  }, [walletConnected, walletAddress, refreshWalletInfo, refreshDrc20Tokens, refreshInscriptions, refreshDunes, refreshCharms]);

  // Calculate refresh availability
  const now = Date.now();
  const canRefreshDrc20Tokens = !lastDrc20TokensForceRefresh ||
    now - lastDrc20TokensForceRefresh >= CACHE_CONFIG.DRC20_TOKENS.forceRefreshCooldown;
  const canRefreshInscriptions = !lastInscriptionsForceRefresh ||
    now - lastInscriptionsForceRefresh >= CACHE_CONFIG.INSCRIPTIONS.forceRefreshCooldown;
  const canRefreshWallet = !lastWalletForceRefresh ||
    now - lastWalletForceRefresh >= CACHE_CONFIG.WALLET_DATA.forceRefreshCooldown;

  const timeUntilDrc20TokensRefresh = canRefreshDrc20Tokens ? 0 :
    CACHE_CONFIG.DRC20_TOKENS.forceRefreshCooldown - (now - (lastDrc20TokensForceRefresh || 0));
  const timeUntilInscriptionsRefresh = canRefreshInscriptions ? 0 :
    CACHE_CONFIG.INSCRIPTIONS.forceRefreshCooldown - (now - (lastInscriptionsForceRefresh || 0));
  const timeUntilWalletRefresh = canRefreshWallet ? 0 :
    CACHE_CONFIG.WALLET_DATA.forceRefreshCooldown - (now - (lastWalletForceRefresh || 0));

  const contextValue: DataProviderContextType = {
    // DRC-20 Tokens
    drc20Tokens,
    isLoadingDrc20Tokens,
    drc20TokensError,
    lastDrc20TokensUpdate,
    refreshDrc20Tokens: () => refreshDrc20Tokens(true),
    canRefreshDrc20Tokens,
    timeUntilDrc20TokensRefresh,

    // Inscriptions
    inscriptions,
    isLoadingInscriptions,
    inscriptionsError,
    lastInscriptionsUpdate,
    refreshInscriptions: () => refreshInscriptions(true),
    canRefreshInscriptions,
    timeUntilInscriptionsRefresh,

    // Dunes
    dunes,
    isLoadingDunes,
    dunesError,
    // Charms
    charmsTokens,
    isLoadingCharms,
    charmsError,
    refreshCharms,
    // Wallet info
    walletInfo,
    isLoadingWalletInfo,
    walletInfoError,

    // UTXOs
    utxos,
    isLoadingUtxos,
    utxosError,

    // Wallet data
    refreshWalletData: () => refreshWalletData(true),
    canRefreshWallet,
    timeUntilWalletRefresh,
  };

  return (
    <DataProviderContext.Provider value={contextValue}>
      {children}
    </DataProviderContext.Provider>
  );
};

export const useDataProviderOptional = () => useContext(DataProviderContext);

export const useDataProvider = () => {
  const context = useContext(DataProviderContext);
  if (!context) {
    throw new Error('useDataProvider must be used within a DataProvider');
  }
  return context;
};
