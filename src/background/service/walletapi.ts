import axios, { AxiosInstance } from 'axios';
import {
  isMyDogeClient,
  myDogeGetAddressBalance,
  myDogeGetAddressBalanceV2,
  myDogeGetAddressUtxo,
  myDogeGetMarketBalance
} from './providers/mydoge';
import { isNintondoMainClient, nintondoGetAddressBalance, nintondoGetAddressBalanceV2 } from './providers/nintondo';
import {
  isLocalRpcClient,
  localRpcGetBalance,
  localRpcGetBalanceV2,
  localRpcGetUtxo,
  localRpcGetAddressInscriptions,
  localRpcPushTx,
  localRpcGetTransaction
} from './providers/localRpc';
import {
  isTatumClient,
  tatumGetAddressBalance,
  tatumGetAddressBalanceV2,
  tatumGetAddressUtxo,
  tatumGetAddressInscriptions,
  tatumGetTransaction
} from './providers/tatum';
import randomstring from 'randomstring';

import { createPersistStore } from '@/background/utils';
import { CHAINS_MAP, CHANNEL, VERSION } from '@/shared/constant';
import { NetworkType } from '@unisat/wallet-types';

import preferenceService from './preference';

interface WalletApiStore {
  deviceId: string;
}

interface ProviderConfig {
  name: string;
  endpoint: string;
  priority: number; // Lower number = higher priority
  supports: string[]; // What chains this provider supports
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

const getProviderConfigs = (): ProviderConfig[] => {
  const configs: ProviderConfig[] = [
    // Local development providers (highest priority when available)
    {
      name: 'dojaker',
      endpoint: 'http://localhost:3000',
      priority: 0, // Highest priority for local indexer
      supports: ['dogecoin']
    },
    // MyDoge API - Primary public provider for balance, UTXOs, inscriptions, DRC20
    {
      name: 'mydoge',
      endpoint: 'https://api.mydoge.com',
      priority: 1, // Will be adjusted if local-rpc is added
      supports: ['dogecoin'],
      rateLimit: {
        requests: 60,
        windowMs: 60000 // 1 minute
      }
    },
    // Nintondo APIs - Secondary providers
    {
      name: 'nintondo',
      endpoint: 'https://doge-mainnet-api.nintondo.io',
      priority: 2, // Will be adjusted if local-rpc is added
      supports: ['dogecoin', 'bellscoin'],
      rateLimit: {
        requests: 100,
        windowMs: 60000 // 1 minute
      }
    },
    {
      name: 'nintondo-tokens',
      endpoint: 'https://doge-mainnet-tokens.nintondo.io',
      priority: 3, // Will be adjusted if local-rpc is added
      supports: ['dogecoin'],
      rateLimit: {
        requests: 100,
        windowMs: 60000 // 1 minute
      }
    },
    {
      name: 'nintondo-search',
      endpoint: 'https://doge-mainnet-search.nintondo.io',
      priority: 3, // Will be adjusted if local-rpc is added
      supports: ['dogecoin'],
      rateLimit: {
        requests: 100,
        windowMs: 60000 // 1 minute
      }
    },
    // Tatum API - Testnet provider
    {
      name: 'tatum-testnet',
      endpoint: 'https://dogecoin-testnet.gateway.tatum.io',
      priority: 1, // High priority for testnet
      supports: ['dogecoin-testnet']
    }
  ];

  return configs;
};

const getTatumApiKey = (): string | null => {
  const key = process.env.TATUM_API_KEY;
  return key && key.trim().length > 0 ? key : null;
};

class ProviderManager {
  private providers: Map<string, AxiosInstance> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private lastHealthCheck: Map<string, number> = new Map();

  constructor() {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[ProviderManager] Initializing providers...');
    }
    // Initialize providers
    getProviderConfigs().forEach((config) => {
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[ProviderManager] Creating client for ${config.name} at ${config.endpoint}`);
        }
        const headers: any = {
          'Content-Type': 'application/json'
        };

        // Add Tatum API key for testnet provider
        if (config.name === 'tatum-testnet') {
          const tatumApiKey = getTatumApiKey();
          if (tatumApiKey) {
            headers['x-api-key'] = tatumApiKey;
          } else {
            console.warn('[ProviderManager] TATUM_API_KEY is not configured; tatum-testnet requests may fail.');
          }
        }

        const client = axios.create({
          baseURL: config.endpoint,
          timeout: 10000, // Shorter timeout for faster failover
          headers
        });
        this.providers.set(config.name, client);
        this.healthStatus.set(config.name, true); // Assume healthy initially
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[ProviderManager] Successfully initialized provider ${config.name}`);
        }
      } catch (error) {
        console.warn(`[ProviderManager] Failed to initialize provider ${config.name}:`, error);
        this.healthStatus.set(config.name, false);
      }
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('[ProviderManager] Provider initialization complete');
    }
  }

  private async checkHealth(providerName: string): Promise<boolean> {
    const lastCheck = this.lastHealthCheck.get(providerName) || 0;
    const now = Date.now();

    // Only check health every 30 seconds
    if (now - lastCheck < 30000) {
      return this.healthStatus.get(providerName) || false;
    }

    // For some public providers (like MyDoge), we don't want health checks to
    // aggressively mark them as unhealthy due to transient/network issues.
    // Instead, we optimistically treat them as healthy and let the actual
    // operation failure drive any fallback logic.
    if (providerName === 'mydoge') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[WalletAPI] Skipping network health check for public provider mydoge; assuming healthy');
      }
      this.healthStatus.set(providerName, true);
      this.lastHealthCheck.set(providerName, now);
      return true;
    }

    try {
      const client = this.providers.get(providerName);
      if (!client) {
        console.warn(`[WalletAPI] Provider ${providerName} client not found`);
        return false;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[WalletAPI] Checking health for ${providerName} at ${client.defaults.baseURL}`);
      }

      // Try a simple health check based on provider type
      if (providerName === 'local-rpc') {
        // For local RPC, try a basic RPC call
        const config = preferenceService.getLocalRpcConfig();
        if (config) {
          // Set up basic auth for RPC calls
          client.defaults.auth = {
            username: config.username,
            password: config.password
          };
        }
        await client.post('/', {
          jsonrpc: '2.0',
          id: 1,
          method: 'getblockcount',
          params: []
        });
      } else if (providerName === 'mydoge') {
        // For MyDoge, try a simple wallet info endpoint
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WalletAPI] Trying ${providerName} health check`);
        }
        // MyDoge uses /wallet/info?route=... format, but we can check if the API responds
        await client.get('/').catch(async () => {
          // If root fails, the API might still work for specific endpoints
          console.log(`[WalletAPI] MyDoge root check failed, assuming healthy for now`);
        });
      } else if (providerName === 'nintondo') {
        // For Nintondo, try a known working endpoint
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WalletAPI] Trying ${providerName} /blocks/tip/height endpoint`);
        }
        await client.get('/blocks/tip/height').catch(async (blocksError) => {
          console.log(
            `[WalletAPI] /blocks/tip/height failed, trying /address/test/stats for ${providerName}`,
            blocksError.message
          );
          await client.get('/address/test/stats');
        });
      } else if (providerName === 'dojak') {
        // For future Dojak API, try the health endpoint
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WalletAPI] Trying ${providerName} /health endpoint`);
        }
        await client.get('/health').catch(async () => {
          console.log(`[WalletAPI] Dojak health check failed, trying root /`);
          await client.get('/');
        });
      } else if (providerName === 'dojaker' || providerName === 'local-rpc') {
        // For local services, assume they're not running and mark as unhealthy
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WalletAPI] Skipping health check for local provider ${providerName}`);
        }
        return false;
      } else if (providerName === 'nintondo-tokens' || providerName === 'nintondo-search') {
        // For Nintondo sub-services, try a simple endpoint
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WalletAPI] Trying root / endpoint for ${providerName}`);
        }
        await client.get('/');
      } else {
        // For other API providers, try the root endpoint
        console.log(`[WalletAPI] Trying root / endpoint for ${providerName}`);
        await client.get('/');
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[WalletAPI] Provider ${providerName} health check passed`);
      }
      this.healthStatus.set(providerName, true);
      this.lastHealthCheck.set(providerName, now);
      return true;
    } catch (error: any) {
      console.warn(`[WalletAPI] Provider ${providerName} health check failed:`, error?.message || error);
      this.healthStatus.set(providerName, false);
      this.lastHealthCheck.set(providerName, now);
      return false;
    }
  }

  // Update local RPC provider configuration
  updateLocalRpcProvider(config?: { host: string; port: string; username: string; password: string; testnet: boolean }) {
    if (config) {
      // Add or update local RPC provider
      const endpoint = `http://${config.host}:${config.port}`;
      const client = axios.create({
        baseURL: endpoint,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        },
        auth: {
          username: config.username,
          password: config.password
        }
      });
      this.providers.set('local-rpc', client);
      this.healthStatus.set('local-rpc', true); // Assume healthy initially

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ProviderManager] Added local RPC provider at ${endpoint}`);
      }
    } else {
      // Remove local RPC provider
      this.providers.delete('local-rpc');
      this.healthStatus.delete('local-rpc');
      this.lastHealthCheck.delete('local-rpc');

      if (process.env.NODE_ENV !== 'production') {
        console.log('[ProviderManager] Removed local RPC provider');
      }
    }
  }

  async executeWithFailover<T>(
    operation: (client: AxiosInstance) => Promise<T>,
    supportedChains: string[] = ['dogecoin']
  ): Promise<T> {
    const sortedProviders = getProviderConfigs().filter((config) =>
      config.supports.some((chain) => supportedChains.includes(chain))
    ).sort((a, b) => a.priority - b.priority);

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[ProviderManager] Trying providers in order:`,
        sortedProviders.map((p) => p.name)
      );
    }

    for (const config of sortedProviders) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ProviderManager] Checking health for ${config.name}...`);
      }
      const isHealthy = await this.checkHealth(config.name);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ProviderManager] Provider ${config.name} health status:`, isHealthy);
      }

      if (isHealthy) {
        try {
          const client = this.providers.get(config.name);
          if (client) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[ProviderManager] Executing operation with ${config.name}`);
            }
            return await operation(client);
          } else {
            console.warn(`[ProviderManager] No client found for ${config.name}`);
          }
        } catch (error) {
          console.warn(`[ProviderManager] Provider ${config.name} operation failed:`, error);
          this.healthStatus.set(config.name, false);
        }
      } else if (process.env.NODE_ENV !== 'production') {
        console.log(`[ProviderManager] Skipping unhealthy provider ${config.name}`);
      }
    }

    console.error(`[WalletAPI] All providers are currently unavailable`);
    throw new Error('All providers are currently unavailable');
  }
}

export class WalletApiService {
  store!: WalletApiStore;
  private client: AxiosInstance;
  private clientAddress = '';
  private addressFlag = 0;
  private currentEndpoint = '';
  private providerManager: ProviderManager;

  // Add getVersionDetail stub for extension update/version checking
  async getVersionDetail(
    version: string
  ): Promise<{ latestVersion: string; isUpdateAvailable: boolean; detail?: string }> {
    // TODO: Replace with real version check (API, Google extension site, etc.)
    // For now, always return current version as latest
    return {
      latestVersion: version,
      isUpdateAvailable: false,
      detail: 'You are running the latest version.'
    };
  }

  constructor() {
    // Initialize with MyDoge as default public API
    this.client = axios.create({
      baseURL: 'https://api.mydoge.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    this.currentEndpoint = 'https://api.mydoge.com';
    this.providerManager = new ProviderManager();
  }

  setEndpoints = async (endpoints: string[]) => {
    // Use the first endpoint from the list
    if (endpoints.length > 0) {
      this.currentEndpoint = endpoints[0];
      this.client.defaults.baseURL = this.currentEndpoint;
      this.updateHeaders();
    }
  };

  init = async () => {
    this.store = await createPersistStore({
      name: 'openapi', // migrated from openapi
      template: {
        deviceId: this.generateDeviceId()
      }
    });

    const chainType = preferenceService.getChainType();
    const chain = CHAINS_MAP[chainType];
    this.currentEndpoint = chain.endpoints[0];

    // Update client configuration
    this.client.defaults.baseURL = this.currentEndpoint;

    // Set common headers
    this.updateHeaders();

    if (!this.store.deviceId) {
      this.store.deviceId = this.generateDeviceId();
    }

    // Initialize local RPC provider if configured
    const localRpcConfig = preferenceService.getLocalRpcConfig();
    if (localRpcConfig) {
      this.providerManager.updateLocalRpcProvider(localRpcConfig);
    }
  };

  updateLocalRpcProvider = (config?: { host: string; port: string; username: string; password: string; testnet: boolean }) => {
    this.providerManager.updateLocalRpcProvider(config);
  };

  setClientAddress = async (address: string, flag: number) => {
    this.clientAddress = address;
    this.addressFlag = flag;
    this.updateHeaders();
  };

  updateHeaders = () => {
    const headers: Record<string, string> = {
      'x-client': 'Dojak Wallet',
      'x-version': VERSION,
      'x-channel': CHANNEL
    };

    if (this.store?.deviceId) {
      headers['x-udid'] = this.store.deviceId;
    }

    if (this.clientAddress) {
      headers['x-address'] = this.clientAddress;
    }

    Object.assign(this.client.defaults.headers, headers);
  };

  private generateDeviceId = (): string => {
    return randomstring.generate(12);
  };

  // Expose the client for direct access to all API methods
  getClient = (): AxiosInstance => {
    return this.client;
  };

  // Proxy common methods for convenience with provider failover
  get bitcoin() {
    return {
      /**
       * Aggregated address summary used for UI stats.
       * NOTE: Field names keep the historical "btc*" naming but values are DOGE satoshis.
       */
      getAddressSummary: (address: string) =>
        this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          const summary = {
            address,
            totalSatoshis: 0,
            btcSatoshis: 0,
            assetSatoshis: 0,
            inscriptionCount: 0,
            drc20Count: 0,
            drc20Count5Byte: 0,
            drc20Count6Byte: 0,
            dunesCount: 0,
            loading: false
          };

          // MyDoge API
          if (isMyDogeClient(client)) {
            // Balance from wallet/info
            const encodedRoute = encodeURIComponent(`/address/${address}?page=1&pageSize=10`);
            const infoRes = await client.get(`/wallet/info?route=${encodedRoute}`);
            const balanceSatoshis = infoRes.data?.balance || 0;

            summary.totalSatoshis = balanceSatoshis;
            summary.btcSatoshis = balanceSatoshis;

            // DRC-20 count
            try {
              const drcRes = await client.get(`/DRC20/${address}`);
              const tokens = Array.isArray(drcRes.data) ? drcRes.data : [];
              summary.drc20Count = tokens.length;
            } catch {
              // Ignore DRC20 errors in summary; counts stay 0
            }

            // Inscription count
            try {
              const insRes = await client.get(`/inscriptions/${address}`);
              const list = Array.isArray(insRes.data?.inscriptions)
                ? insRes.data.inscriptions
                : Array.isArray(insRes.data)
                ? insRes.data
                : [];
              summary.inscriptionCount = list.length;
            } catch {
              // Ignore inscription errors in summary; counts stay 0
            }

            return summary;
          }

          // Nintondo main API
          if (isNintondoMainClient(client)) {
            const res = await client.get(`/address/${address}/stats`);
            const balanceSatoshis = res.data?.balance || 0;

            summary.totalSatoshis = balanceSatoshis;
            summary.btcSatoshis = balanceSatoshis;

            // We don't currently derive token/inscription counts from Nintondo here.
            return summary;
          }

          // Future: Dojak API
          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/address/${address}/summary`);
            return {
              ...summary,
              ...res.data
            };
          }

          // If we reach here, the provider doesn't support a known summary API
          throw new Error(`[WalletAPI] Unsupported address summary endpoint for provider: ${baseURL}`);
        }),
      getAddressBalance: (address: string) =>
        this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          if (isMyDogeClient(client)) {
            return myDogeGetAddressBalance(client, address);
          }

          if (isNintondoMainClient(client)) {
            return nintondoGetAddressBalance(client, address);
          }

          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/address/${address}/balance`);
            return res.data;
          }

          // If we reach here, the provider doesn't support a known balance API
          throw new Error(`[WalletAPI] Unsupported balance endpoint for provider: ${baseURL}`);
        }),
      getAddressBalanceV2: (address: string) =>
        this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          if (isMyDogeClient(client)) {
            return myDogeGetAddressBalanceV2(client, address);
          }

          if (isNintondoMainClient(client)) {
            return nintondoGetAddressBalanceV2(client, address);
          }

          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/address/${address}/balance`);
            const confirmedBalance = res.data?.confirmed || 0;
            const unconfirmedBalance = res.data?.unconfirmed || 0;

            return {
              availableBalance: confirmedBalance,
              unavailableBalance: unconfirmedBalance,
              totalBalance: confirmedBalance + unconfirmedBalance
            };
          }

          // If we reach here, the provider doesn't support a known balance API
          throw new Error(`[WalletAPI] Unsupported balance endpoint for provider: ${baseURL}`);
        }),
      getAddressUtxo: (address: string) =>
        this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          // Local RPC provider
          if (isLocalRpcClient(client)) {
            return localRpcGetUtxo(client, address);
          }

          if (isMyDogeClient(client)) {
            return myDogeGetAddressUtxo(client, address);
          }

          // Nintondo API
          if (baseURL.includes('doge-mainnet-api.nintondo.io')) {
            const res = await client.get(`/address/${address}/utxo`);
            return res.data || [];
          }

          // Tatum testnet provider
          if (isTatumClient(client)) {
            return tatumGetAddressUtxo(client, address);
          }

          // Future: Dojak API
          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/address/${address}/utxos`);
            return res.data || [];
          }

          // Generic fallback
          const res = await client.get(`/api/v1/address/${address}/utxo`);
          return res.data || [];
        }),
      getTx: (txid: string) =>
        this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          // MyDoge - may need to use wallet/info route
          if (baseURL.includes('api.mydoge.com')) {
            const encodedRoute = encodeURIComponent(`/tx/${txid}`);
            const res = await client.get(`/wallet/info?route=${encodedRoute}`);
            return res.data;
          }

          // Nintondo API
          if (baseURL.includes('doge-mainnet-api.nintondo.io')) {
            const res = await client.get(`/tx/${txid}`);
            return res.data;
          }

          // Future: Dojak API
          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/tx/${txid}`);
            return res.data;
          }

          // Generic fallback
          const res = await client.get(`/api/v1/tx/${txid}`);
          return res.data;
        }),
      pushTx: (rawtx: string) =>
        this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          // MyDoge - may need different endpoint for pushing tx
          if (baseURL.includes('api.mydoge.com')) {
            // MyDoge might use a broadcast endpoint
            const res = await client.post('/broadcast', { rawtx });
            return res.data;
          }

          // Nintondo API
          if (baseURL.includes('doge-mainnet-api.nintondo.io')) {
            const res = await client.post('/tx', rawtx, {
              headers: { 'Content-Type': 'text/plain' }
            });
            return res.data;
          }

          // Future: Dojak API
          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.post('/api/v1/tx', { rawtx });
            return res.data;
          }

          // Generic fallback
          const res = await client.post('/api/v1/tx', { rawtx });
          return res.data;
        })
    };
  }

  get inscriptions() {
    return {
      getAddressInscriptions: async (address: string, cursor?: string, size = 20) => {
        return this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          // MyDoge API - GET /inscriptions/{address}
          if (baseURL.includes('api.mydoge.com')) {
            const res = await client.get(`/inscriptions/${address}`);
            // Transform MyDoge response to standard format
            const inscriptions = res.data || [];
            return {
              list: inscriptions
                .map((insc: any) => ({
                  inscriptionId: insc.inscriptionId || insc.id,
                  inscriptionNumber: insc.inscriptionNumber || insc.number,
                  contentType: insc.contentType,
                  contentBody: insc.contentBody || insc.body,
                  genesisTxid: insc.genesisTxid || insc.genesisTransaction,
                  location: insc.location,
                  outputValue: insc.outputValue,
                  timestamp: insc.timestamp,
                  blockHeight: insc.blockHeight
                }))
                .slice(0, size),
              total: inscriptions.length
            };
          }

          // Nintondo Search API
          if (baseURL.includes('doge-mainnet-search.nintondo.io')) {
            const res = await client.get(`/pub/collections/${address}`);
            return {
              list: (res.data?.inscriptions || []).slice(0, size),
              total: res.data?.total || 0
            };
          }

          // Future: Dojak API
          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/address/${address}/inscriptions?cursor=${cursor || 0}&size=${size}`);
            return res.data;
          }

          // Generic fallback
          const res = await client.get(`/api/v1/address/${address}/inscriptions?cursor=${cursor || 0}&size=${size}`);
          return res.data;
        });
      },
      getDoginalsInscriptions: async (address: string, cursor = 0, size = 20) => {
        return this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          // MyDoge API - GET /inscriptions/{address}
          if (baseURL.includes('api.mydoge.com')) {
            const res = await client.get(`/inscriptions/${address}`);
            // Transform MyDoge response to standard format
            const inscriptions = res.data || [];
            const startIndex = cursor;
            const endIndex = startIndex + size;
            return {
              list: inscriptions
                .slice(startIndex, endIndex)
                .map((insc: any) => ({
                  inscriptionId: insc.inscriptionId || insc.id,
                  inscriptionNumber: insc.inscriptionNumber || insc.number,
                  contentType: insc.contentType,
                  contentBody: insc.contentBody || insc.body,
                  genesisTxid: insc.genesisTxid || insc.genesisTransaction,
                  location: insc.location,
                  outputValue: insc.outputValue,
                  timestamp: insc.timestamp,
                  blockHeight: insc.blockHeight
                })),
              total: inscriptions.length
            };
          }

          // Nintondo Search API
          if (baseURL.includes('doge-mainnet-search.nintondo.io')) {
            const res = await client.get(`/pub/collections/${address}`);
            const inscriptions = res.data?.inscriptions || [];
            const startIndex = cursor;
            const endIndex = startIndex + size;
            return {
              list: inscriptions.slice(startIndex, endIndex),
              total: res.data?.total || inscriptions.length
            };
          }

          // Future: Dojak API
          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/address/${address}/doginals?cursor=${cursor}&size=${size}`);
            return res.data;
          }

          // Generic fallback
          const res = await client.get(`/api/v1/address/${address}/doginals?cursor=${cursor}&size=${size}`);
          return res.data;
        });
      },
      getInscriptionInfo: async (inscriptionId: string) => {
        return this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          // MyDoge doesn't have a direct inscription info endpoint, skip to fallback
          if (baseURL.includes('api.mydoge.com')) {
            throw new Error('MyDoge: Use alternate provider for inscription info');
          }

          // Nintondo Search API
          if (baseURL.includes('doge-mainnet-search.nintondo.io')) {
            const res = await client.get(`/pub/${inscriptionId}/info`);
            return res.data;
          }

          // Nintondo API
          if (baseURL.includes('doge-mainnet-api.nintondo.io')) {
            const res = await client.get(`/location/${inscriptionId}`);
            return res.data;
          }

          // Future: Dojak API
          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/inscription/${inscriptionId}`);
            return res.data;
          }

          // Generic fallback
          const res = await client.get(`/api/v1/inscription/${inscriptionId}`);
          return res.data;
        });
      }
    };
  }

  get drc20() {
    return {
      getAddressTokenSummary: (address: string, cursor?: string, size = 20) =>
        this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          // MyDoge API - GET /DRC20/{address}
          if (baseURL.includes('api.mydoge.com')) {
            const res = await client.get(`/DRC20/${address}`);
            // Transform MyDoge response to standard format
            const tokens = res.data || [];
            return {
              list: tokens.map((token: any) => ({
                ticker: token.ticker,
                available: token.available || token.availableBalance || 0,
                transferable: token.transferable || token.transferableBalance || 0,
                balance: token.balance || token.overallBalance || 0
              })),
              total: tokens.length
            };
          }

          // Nintondo Tokens API
          if (baseURL.includes('doge-mainnet-tokens.nintondo.io')) {
            const res = await client.get(`/address/${address}/tokens?limit=${size || 20}`);
            return {
              list: res.data || [],
              total: res.data?.length || 0
            };
          }

          // Future: Dojak API
          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/address/${address}/drc20?cursor=${cursor || 0}&size=${size || 20}`);
            return res.data;
          }

          // Generic fallback
          const res = await client.get(`/api/v1/address/${address}/drc20?cursor=${cursor || 0}&size=${size || 20}`);
          return res.data;
        }),
      getTokenInfo: (ticker: string) =>
        this.providerManager.executeWithFailover(async (client) => {
          const baseURL = client.defaults.baseURL || '';

          // MyDoge doesn't have a token info endpoint, use fallback
          if (baseURL.includes('doge-mainnet-tokens.nintondo.io')) {
            const res = await client.get(`/token/${ticker}`);
            return res.data;
          }

          // Future: Dojak API
          if (baseURL.includes('api.dojak.dog')) {
            const res = await client.get(`/api/v1/drc20/${ticker}`);
            return res.data;
          }

          // Generic fallback
          const res = await client.get(`/api/v1/drc20/${ticker}`);
          return res.data;
        })
    };
  }
  get Charms() {
    return {
      getAddressCharms: async (address: string) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker Charms API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  // Get charms stats and collections for this address
                  const [statsRes, collectionsRes] = await Promise.all([
                    client.get('/charms/stats'),
                    client.get(`/charms/collections/${address}`)
                  ]);
                  return {
                    list: collectionsRes.data?.collections || [],
                    total: collectionsRes.data?.total || 0,
                    stats: statsRes.data
                  };
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker Charms API failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback - charms not available
              console.log('[WalletAPI] Charms not available in fallback provider');
              return { list: [], total: 0 };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Charms API error:', error);
          return { list: [], total: 0 };
        }
      },

      getCharmInfo: async (charmsId: string) => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker Charms API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/charms/${charmsId}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker Charm info API failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback - charm info not available
              console.log('[WalletAPI] Charm info not available in fallback provider');
              return null;
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Charm info API error:', error);
          return null;
        }
      },

      getCharmCollectionList: async (address: string) => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker Charms API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/charms/collections/${address}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker Charm collections API failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback - charm collections not available
              console.log('[WalletAPI] Charm collections not available in fallback provider');
              return { list: [], total: 0 };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Charm collections API error:', error);
          return { list: [], total: 0 };
        }
      },

      getCharmCollectionItems: async (address: string, collectionId: string) => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker Charms API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/charms/collection/${collectionId}/items/${address}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker Charm collection items API failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback - charm collection items not available
              console.log('[WalletAPI] Charm collection items not available in fallback provider');
              return { list: [], total: 0 };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Charm collection items API error:', error);
          return { list: [], total: 0 };
        }
      },

      getCharmsByUtxo: async (utxo: string) => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker Charms API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/charms/utxo/${utxo}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker Charms by UTXO API failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback - charms by UTXO not available
              console.log('[WalletAPI] Charms by UTXO not available in fallback provider');
              return { list: [], total: 0 };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Charms by UTXO API error:', error);
          return { list: [], total: 0 };
        }
      },

      getCharmsByApp: async (app: string, limit = 100) => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker Charms API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/charms/app/${app}?limit=${limit}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker Charms by app API failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback - charms by app not available
              console.log('[WalletAPI] Charms by app not available in fallback provider');
              return { list: [], total: 0 };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Charms by app API error:', error);
          return { list: [], total: 0 };
        }
      },

      getCharmsStats: async () => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker Charms API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get('/charms/stats');
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker Charms stats API failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback - charms stats not available
              console.log('[WalletAPI] Charms stats not available in fallback provider');
              return { total_charms: 0, charms_by_app: {}, charms_by_collection: {} };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Charms stats API error:', error);
          return { total_charms: 0, charms_by_app: {}, charms_by_collection: {} };
        }
      }
    };
  }
  get cat() {
    // TODO: Implement Dogecoin CAT service
    throw new Error('CAT service not implemented for Dogecoin');
  }
  get market() {
    // TODO: Implement Dogecoin marketplace service
    return {
      getBalance: async (address: string) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              const baseURL = client.defaults.baseURL || '';

              // MyDoge API - Primary public provider
              if (baseURL.includes('api.mydoge.com')) {
                const encodedRoute = encodeURIComponent(`/address/${address}?page=1&pageSize=10`);
                const res = await client.get(`/wallet/info?route=${encodedRoute}`);
                const balanceSatoshis = res.data?.balance || 0;
                return {
                  confirmed: balanceSatoshis / 100000000,
                  unconfirmed: 0
                };
              }

              // Nintondo API
              if (baseURL.includes('doge-mainnet-api.nintondo.io')) {
                const res = await client.get(`/address/${address}/stats`);
                const balance = (res.data?.balance || 0) / 100000000;
                return {
                  confirmed: balance,
                  unconfirmed: 0
                };
              }

              // Future: Dojak API
              if (baseURL.includes('api.dojak.dog')) {
                const res = await client.get(`/api/v1/address/${address}/balance`);
                return res.data;
              }

              // Generic fallback
              const res = await client.get(`/api/v1/address/${address}/balance`);
              return res.data;
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Market getBalance error:', error);
          // Note: Toast notifications are handled at the UI level
          return {
            confirmed: 0,
            unconfirmed: 0
          };
        }
      },
      getRecentListings: async () => {
        return this.providerManager.executeWithFailover((client) =>
          client.get('/api/v1/marketplace/listings?limit=10').then((res) => res.data?.list || [])
        );
      }
    };
  }
  get domain() {
    // TODO: Implement Dogecoin domain service
    throw new Error('Domain service not implemented for Dogecoin');
  }

  get dns() {
    return {
      resolve: async (name: string) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/dns/resolve/${name}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker DNS resolve failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback to other providers - this might not be implemented
              console.log('[WalletAPI] DNS resolve - using fallback provider');
              return null;
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] DNS resolve error:', error);
          return null;
        }
      },

      reverseResolve: async (address: string) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/dns/reverse/${address}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker DNS reverse resolve failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback to other providers - this might not be implemented
              console.log('[WalletAPI] DNS reverse resolve - using fallback provider');
              return { domains: [] };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] DNS reverse resolve error:', error);
          return { domains: [] };
        }
      },

      getAvatar: async (name: string) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/dns/avatar/${name}`);
                  return response.data?.avatar;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker DNS avatar failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback to other providers
              console.log('[WalletAPI] DNS avatar - using fallback provider');
              return null;
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] DNS avatar error:', error);
          return null;
        }
      },

      getConfig: async (name: string) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/dns/config/${name}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker DNS config failed, falling back:', indexerError);
                  throw indexerError;
                }
              }

              // Fallback to other providers
              console.log('[WalletAPI] DNS config - using fallback provider');
              return null;
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] DNS config error:', error);
          return null;
        }
      }
    };
  }
  get utility() {
    return {
      getAppSummary: async () => {
        // Return basic app summary for Dogecoin wallet
        return {
          apps: [],
          totalCount: 0
        };
      },
      checkWebsite: async (website: string) => {
        // Basic website check - for now just return safe
        return {
          isSafe: true,
          riskLevel: 'low'
        };
      },
      getAppList: async () => {
        // Return empty app list for Dogecoin - structured as { tab: string; items: AppInfo[] }[]
        return [] as { tab: string; items: any[] }[];
      },
      getBannerList: async () => {
        // Return empty banner list for Dogecoin - structured as { id: string; img: string; link: string }[]
        return [] as { id: string; img: string; link: string }[];
      },
      getBlockActiveInfo: () => {
        // Return basic block info for Dogecoin
        return {
          active: true,
          network: 'dogecoin'
        };
      },
      getBuyCoinChannelList: async (coin: string) => {
        // Return empty buy channels for Dogecoin (not implemented yet)
        return [];
      },
      createBuyCoinPaymentUrl: (coin: string, address: string, channel: string) => {
        // Return null for Dogecoin buy functionality (not implemented yet)
        return null;
      }
    };
  }
  get config() {
    // TODO: Implement Dogecoin config service
    return {
      getWalletConfig: async () => {
        // Return basic wallet config for Dogecoin
        return {
          network: 'dogecoin',
          version: '1.0.0'
        };
      }
    };
  }

  // Charms beaming functionality for cross-chain Charms token movement
  get beam() {
    return {
      prepareBeam: async (params: {
        asset: string; // Charms token identifier
        fromChain: 'dogecoin';
        toChain: 'bitcoin' | 'dogecoin' | 'litecoin';
        amount: string;
        sourceAddress: string;
        destAddress: string;
      }) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // For now, return a placeholder implementation
              // In production, this would integrate with Charms libraries
              console.log('[WalletAPI] Charms beam preparation requested:', params);

              // Placeholder response structure - would be replaced with actual Charms integration
              return {
                beamId: `beam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                status: 'prepared',
                sourceChain: params.fromChain,
                destChain: params.toChain,
                asset: params.asset, // Charms token ID
                amount: params.amount,
                sourceAddress: params.sourceAddress,
                destAddress: params.destAddress,
                lockTxHex: null, // Would contain the transaction to lock Charms token on Dogecoin
                proofBundle: null, // Would contain zkVM proof for verification
                estimatedCompletion: Date.now() + 300000, // 5 minutes
                canRetry: true
              };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Charms beam preparation error:', error);
          return {
            error: 'Beam preparation failed',
            details: error instanceof Error ? error.message : String(error)
          };
        }
      },

      executeBeam: async (beamId: string, signedTxHex: string) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              console.log('[WalletAPI] Beam execution requested:', { beamId, signedTxHex });

              // Placeholder response - would broadcast the beam transaction
              return {
                beamId,
                status: 'executing',
                txid: `beam_tx_${beamId}`,
                estimatedCompletion: Date.now() + 600000 // 10 minutes
              };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Beam execution error:', error);
          return {
            error: 'Beam execution failed',
            details: error instanceof Error ? error.message : String(error)
          };
        }
      },

      getBeamStatus: async (beamId: string) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              console.log('[WalletAPI] Beam status requested:', beamId);

              // Placeholder response - would check beam status
              return {
                beamId,
                status: 'completed',
                lockTxid: `lock_${beamId}`,
                beamTxid: `beam_${beamId}`,
                completedAt: Date.now()
              };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Beam status error:', error);
          return {
            error: 'Beam status check failed',
            details: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }

  // Custom Dojak methods for dojaker integration
  get doginals() {
    return {
      getAddressDoginals: async (address: string, cursor?: string, size = 20) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker API first (highest priority)
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(
                    `/address/${address}/inscriptions?limit=${size}${cursor ? `&cursor=${cursor}` : ''}`
                  );
                  // Transform indexer response to expected format with rich Doginal data
                  const doginals = (response.data?.inscriptions || []).map((inscription: any) => ({
                    id: inscription.id,
                    inscriptionId: inscription.id,
                    content: inscription.content || '',
                    contentType: inscription.content_type,
                    timestamp: inscription.timestamp,
                    block: inscription.block,
                    rarity: this.calculateRarity(inscription.block),
                    rarityScore: this.calculateRarityScore(inscription.block),
                    owner: address,
                    mediaType: inscription.media_type,
                    contentLength: inscription.content_length,
                    genesisTx: inscription.genesis_tx,
                    output: inscription.output,
                    offset: inscription.offset,
                    collection: 'doginals'
                  }));

                  return {
                    list: doginals,
                    total: response.data?.count || 0,
                    cursor: response.data?.cursor || null
                  };
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker Doginals API failed, falling back:', indexerError);
                  throw indexerError; // Let provider manager try next provider
                }
              }

              // Fallback to other providers - use inscriptions method on this object
              const result = await this.inscriptions.getAddressInscriptions(address, cursor, size);
              console.log('[WalletAPI] Doginals API - using fallback provider');
              return result;
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Doginals API error:', error);
          return { list: [], total: 0 };
        }
      },

      getDoginal: async (id: string) => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  const response = await client.get(`/doginal/${id}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker Doginal API failed, falling back:', indexerError);
                  throw indexerError; // Let provider manager try next provider
                }
              }

              // Fallback to other providers - use inscriptions method on this object
              return await this.inscriptions.getInscriptionInfo(id);
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Doginal info API error:', error);
          return null;
        }
      },

      createDoginalInscription: async (content: string, feeRate: number) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              const baseURL = client.defaults.baseURL || '';

              // Only dojaker supports inscription creation
              if (baseURL.includes('localhost:3000')) {
                const res = await client.post('/inscriptions/create', { content, feeRate });
                return res.data;
              }

              // Future: Dojak API
              if (baseURL.includes('api.dojak.dog')) {
                const res = await client.post('/api/v1/inscriptions/create', { content, feeRate });
                return res.data;
              }

              throw new Error('Inscription creation not available on this provider');
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Create doginal API error:', error);
          throw error;
        }
      }
    };
  }

  get dunes() {
    return {
      getAddressDunes: async (address: string) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              const baseURL = client.defaults.baseURL || '';

              // For Dogecoin, dunes (dunes) may not be implemented yet
              // Try the DRC-20 API first as dunes might be implemented there
              try {
                let endpoint: string;

                // MyDoge API - use DRC20 endpoint as fallback for dunes
                if (baseURL.includes('api.mydoge.com')) {
                  const res = await client.get(`/DRC20/${address}`);
                  return { list: res.data || [], total: (res.data || []).length };
                }

                if (baseURL.includes('doge-mainnet-tokens.nintondo.io')) {
                  endpoint = `/address/${address}/tokens`;
                } else if (baseURL.includes('api.dojak.dog')) {
                  endpoint = `/api/v1/address/${address}/drc20`;
                } else {
                  endpoint = `/api/v1/address/${address}/drc20`;
                }
                const response = await client.get(endpoint);
                return response.data;
              } catch (error) {
                // DRC20 not supported by this provider
                return { list: [], total: 0 };
              }
              console.log('[WalletAPI] Dunes not yet implemented for Dogecoin');
              return { list: [], total: 0 };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Dunes API error:', error);
          return { list: [], total: 0 };
        }
      },

      getDuneInfo: async (duneId: string) => {
        try {
          // For Dogecoin, dune info may not be implemented yet
          console.log('[WalletAPI] Dune info not yet implemented for Dogecoin');
          return null;
        } catch (error) {
          console.error('[WalletAPI] Dune info API error:', error);
          return null;
        }
      },

      createDuneEtching: async (params: any) => {
        throw new Error('Dune etching not yet implemented for Dogecoin');
      }
    };
  }

  get faucet() {
    return {
      claim: async (address: string, amount?: number) => {
        try {
          console.log(`[WalletAPI] Claiming ${amount || 0.01} testnet DOGE for ${address}`);

          // Call the Dojak API backend server
          const apiUrl = process.env.NODE_ENV === 'production' ? 'https://api.dojak.dog' : 'http://localhost:3001';

          const response = await axios.post(
            `${apiUrl}/api/v1/faucet/claim`,
            {
              address: address,
              amount: amount || 0.01
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Client': 'Dojak Wallet'
              },
              timeout: 30000
            }
          );

          if (response.data && response.data.success) {
            console.log(`[WalletAPI] Faucet claim successful, txid: ${response.data.txid}`);

            return {
              success: true,
              txid: response.data.txid,
              amount: response.data.amount,
              address: response.data.address,
              message: response.data.message
            };
          } else {
            throw new Error(response.data?.error || 'Faucet claim failed');
          }
        } catch (error: any) {
          console.error('[WalletAPI] Faucet claim error:', error);

          // Handle different error types
          if (error.code === 'ECONNREFUSED') {
            return {
              success: false,
              error: 'Cannot connect to Dojak API server. Make sure the backend is running.',
              details: 'Backend server not available'
            };
          }

          if (error.response?.data?.error) {
            return {
              success: false,
              error: error.response.data.error,
              details: error.response.data.error
            };
          }

          return {
            success: false,
            error: error.message || 'Faucet claim failed',
            details: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }

  get marketplace() {
    return {
      getListings: async (cursor?: string, size = 20, filters?: any) => {
        try {
          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              // Try the dojaker marketplace API first
              if (this.currentEndpoint === 'http://localhost:3000') {
                try {
                  let url = `/listings?limit=${size}`;
                  if (cursor) url += `&cursor=${cursor}`;
                  if (filters?.collection) url += `&collection=${filters.collection}`;
                  if (filters?.rarity) url += `&rarity=${filters.rarity}`;

                  const response = await client.get(url);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker marketplace listings API failed:', indexerError);
                  // Don't throw here, let provider manager try next provider
                }
              }

              // Fallback - no marketplace listings available
              console.log('[WalletAPI] Marketplace listings - using fallback (empty)');
              return {
                list: [],
                total: 0,
                cursor: null
              };
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Marketplace listings API error:', error);
          return {
            list: [],
            total: 0,
            cursor: null
          };
        }
      },

      getListing: async (listingId: string) => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              if (this.currentEndpoint === 'http://localhost:3000') {
                const response = await client.get(`/listings/${listingId}`);
                return response;
              }
              throw new Error('Listing details not available');
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Get listing API error:', error);
          return null;
        }
      },

      createListing: async (doginalId: string, price: number, sellerAddress: string) => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              if (this.currentEndpoint === 'http://localhost:3000') {
                const response = await client.post('/list', {
                  doginal_id: doginalId,
                  price_doge: price,
                  seller_addr: sellerAddress
                });
                return response;
              }
              throw new Error('Marketplace listing creation not available');
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Create listing API error:', error);
          throw error;
        }
      },

      buyListing: async (listingId: string, buyerAddress: string) => {
        try {
          return await this.providerManager.executeWithFailover(
            async (client) => {
              if (this.currentEndpoint === 'http://localhost:3000') {
                const response = await client.post('/buy', {
                  listing_id: listingId,
                  buyer_addr: buyerAddress
                });
                return response;
              }
              throw new Error('Marketplace purchase not available');
            },
            ['dogecoin']
          );
        } catch (error) {
          console.error('[WalletAPI] Buy listing API error:', error);
          throw error;
        }
      },

      getBalance: async (address: string) => {
        try {
          const chainType = preferenceService.getChainType();
          const isTestnet = CHAINS_MAP[chainType].networkType === NetworkType.TESTNET;
          const supportedChains = isTestnet ? ['dogecoin-testnet', 'dogecoin'] : ['dogecoin'];

          // Use provider manager for failover support
          return await this.providerManager.executeWithFailover(
            async (client) => {
              const baseURL = client.defaults.baseURL || '';

              // Try the dojaker API first (highest priority)
              if (baseURL.includes('localhost:3000')) {
                try {
                  const response = await client.get(`/balance/${address}`);
                  return response;
                } catch (indexerError) {
                  console.warn('[WalletAPI] Dojaker balance API failed, falling back:', indexerError);
                  throw indexerError; // Let provider manager try next provider
                }
              }

              // Tatum testnet provider (highest priority for testnet)
              if (isTatumClient(client) && isTestnet) {
                return await tatumGetAddressBalance(client, address);
              }

              // Local RPC provider (highest priority when configured)
              if (isLocalRpcClient(client)) {
                return await localRpcGetBalance(client, address);
              }

              // MyDoge API - Primary public provider
              if (baseURL.includes('api.mydoge.com')) {
                try {
                  // MyDoge uses /wallet/info?route={encodedRoute} format
                  const encodedRoute = encodeURIComponent(`/address/${address}?page=1&pageSize=10`);
                  const res = await client.get(`/wallet/info?route=${encodedRoute}`);
                  const balanceSatoshis = res.data?.balance || 0;
                  return {
                    confirmed: balanceSatoshis / 100000000, // Convert satoshis to DOGE
                    unconfirmed: 0,
                    total: balanceSatoshis / 100000000
                  };
                } catch (mydogeError: any) {
                  console.warn('[WalletAPI] MyDoge balance API failed:', mydogeError.message);
                  throw mydogeError;
                }
              }

              // Nintondo API
              if (baseURL.includes('doge-mainnet-api.nintondo.io')) {
                const res = await client.get(`/address/${address}/stats`);
                const balance = (res.data?.balance || 0) / 100000000;
                return {
                  confirmed: balance,
                  unconfirmed: 0,
                  total: balance
                };
              }

              // Future: Dojak API
              if (baseURL.includes('api.dojak.dog')) {
                const res = await client.get(`/api/v1/address/${address}/balance`);
                return res.data;
              }

              // Generic fallback
              const res = await client.get(`/api/v1/address/${address}/balance`);
              return res.data;
            },
            supportedChains
          );
        } catch (error) {
          console.error('[WalletAPI] Balance API error:', error);
          // Note: Toast notifications are handled at the UI level
          return {
            doge: 0,
            drc20: {},
            dogemaps: [],
            dns: { legacy_domains: [], protocol_domains: [] },
            dunes: {},
            charms: { rarity: [], royalty: [] },
            totals: {
              dogemaps: 0,
              dns_legacy: 0,
              dns_protocol: 0,
              dunes: 0
            }
          };
        }
      }
    };
  }

  // Helper methods for Doginal rarity calculation
  private calculateRarity(block: number): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' {
    // Doginal Theory rarity based on block height and halving periods
    if (block <= 791886 + 5040) return 'legendary'; // First ~1 week
    if (block <= 791886 + 21000) return 'epic'; // First ~1 month
    if (block <= 791886 + 210000) return 'rare'; // First ~1 year
    if (block <= 791886 + 2100000) return 'uncommon'; // First ~10 years
    return 'common';
  }

  private calculateRarityScore(block: number): number {
    // Higher score for rarer Doginals (lower block numbers)
    const baseBlock = 791886; // First Doginal block
    const blocksSinceGenesis = block - baseBlock;

    // Exponential decay for rarity score
    return Math.max(0, Math.floor(10000 * Math.pow(0.999, blocksSinceGenesis)));
  }

  // Real-time updates using indexer's event streaming
  get realtime() {
    return {
      subscribeToAddressEvents: (address: string, onEvent: (event: any) => void, onError?: (error: any) => void) => {
        // For now, implement polling-based updates
        // In production, this would connect to WebSocket/SSE
        const pollInterval = 30000; // 30 seconds
        let isSubscribed = true;

        const pollForUpdates = async () => {
          if (!isSubscribed) return;

          try {
            // Poll for new balance data
            const balance = await this.providerManager
              .executeWithFailover(async (client) => {
                const baseURL = client.defaults.baseURL || '';
                const defaultResponse = {
                  doge: 0,
                  drc20: {},
                  dogemaps: [],
                  dns: { legacy_domains: [], protocol_domains: [] },
                  dunes: {},
                  charms: { rarity: [], royalty: [] },
                  totals: { dogemaps: 0, dns_legacy: 0, dns_protocol: 0, dunes: 0 }
                };

                // MyDoge API
                if (baseURL.includes('api.mydoge.com')) {
                  const encodedRoute = encodeURIComponent(`/address/${address}?page=1&pageSize=10`);
                  const res = await client.get(`/wallet/info?route=${encodedRoute}`);
                  return {
                    ...defaultResponse,
                    doge: (res.data?.balance || 0) / 100000000
                  };
                }

                // Nintondo API
                if (baseURL.includes('doge-mainnet-api.nintondo.io')) {
                  const res = await client.get(`/address/${address}/stats`);
                  return {
                    ...defaultResponse,
                    doge: (res.data?.balance || 0) / 100000000
                  };
                }

                // Future: Dojak API
                if (baseURL.includes('api.dojak.dog')) {
                  const res = await client.get(`/api/v1/address/${address}/balance`);
                  return res.data;
                }

                // Generic fallback
                const res = await client.get(`/api/v1/address/${address}/balance`);
                return res.data;
              })
              .catch(() => ({
                doge: 0,
                drc20: {},
                dogemaps: [],
                dns: { legacy_domains: [], protocol_domains: [] },
                dunes: {},
                charms: { rarity: [], royalty: [] },
                totals: { dogemaps: 0, dns_legacy: 0, dns_protocol: 0, dunes: 0 }
              }));

            // Poll for new inscriptions
            const inscriptions = await this.providerManager
              .executeWithFailover(async (client) => {
                const baseURL = client.defaults.baseURL || '';

                // MyDoge API
                if (baseURL.includes('api.mydoge.com')) {
                  const res = await client.get(`/inscriptions/${address}`);
                  // MyDoge returns a structured object; inscriptions are under `inscriptions`
                  const list = Array.isArray(res.data?.inscriptions) ? res.data.inscriptions : [];
                  return { list: list.slice(0, 20) };
                }

                // Nintondo search API
                if (baseURL.includes('doge-mainnet-search.nintondo.io')) {
                  const res = await client.get(`/pub/collections/${address}`);
                  const list = Array.isArray(res.data?.inscriptions) ? res.data.inscriptions : [];
                  return { list: list.slice(0, 20) };
                }

                // Future: Dojak API
                if (baseURL.includes('api.dojak.dog')) {
                  const res = await client.get(`/api/v1/address/${address}/doginals`);
                  return res.data;
                }

                // Generic fallback
                const res = await client.get(`/api/v1/address/${address}/doginals`);
                return res.data;
              })
              .catch(() => ({ list: [] }));

            // Create a synthetic event
            const event = {
              type: 'address_update',
              address,
              balance,
              inscriptions: inscriptions.list,
              timestamp: Date.now()
            };

            if (onEvent) onEvent(event);
          } catch (error) {
            console.error('[WalletAPI] Real-time poll error:', error);
            if (onError) onError(error);
          }

          // Schedule next poll
          if (isSubscribed) {
            setTimeout(pollForUpdates, pollInterval);
          }
        };

        // Start polling
        setTimeout(pollForUpdates, 1000); // Start after 1 second

        // Return unsubscribe function
        return () => {
          isSubscribed = false;
        };
      },

      subscribeToMarketplaceEvents: (onEvent: (event: any) => void, onError?: (error: any) => void) => {
        // Marketplace event polling
        const pollInterval = 60000; // 1 minute
        let isSubscribed = true;

        const pollForMarketplaceUpdates = async () => {
          if (!isSubscribed) return;

          try {
            // Poll for new marketplace listings
            const listings = await this.providerManager
              .executeWithFailover(async (client) => {
                const baseURL = client.defaults.baseURL || '';

                // MyDoge doesn't have marketplace API
                if (baseURL.includes('api.mydoge.com')) {
                  return [];
                }

                // Nintondo or dojaker might have marketplace
                if (baseURL.includes('localhost:3000')) {
                  const res = await client.get('/marketplace/listings?limit=10');
                  return res.data?.list || [];
                }

                // Future: Dojak API
                if (baseURL.includes('api.dojak.dog')) {
                  const res = await client.get('/api/v1/marketplace/listings?limit=10');
                  return res.data?.list || [];
                }

                // Generic fallback
                const res = await client.get('/api/v1/marketplace/listings?limit=10');
                return res.data?.list || [];
              })
              .catch(() => []);

            if (listings && listings.length > 0) {
              const event = {
                type: 'marketplace_update',
                listings,
                timestamp: Date.now()
              };

              if (onEvent) onEvent(event);
            }
          } catch (error) {
            console.error('[WalletAPI] Marketplace polling error:', error);
            if (onError) onError(error);
          }

          // Schedule next poll
          if (isSubscribed) {
            setTimeout(pollForMarketplaceUpdates, pollInterval);
          }
        };

        // Start polling
        setTimeout(pollForMarketplaceUpdates, 2000); // Start after 2 seconds

        // Return unsubscribe function
        return () => {
          isSubscribed = false;
        };
      },

      subscribeToNewBlocks: (onEvent: (event: any) => void, onError?: (error: any) => void) => {
        // New blocks polling
        const pollInterval = 60000; // 1 minute
        let isSubscribed = true;
        let lastBlockHeight = 0;

        const pollForNewBlocks = async () => {
          if (!isSubscribed) return;

          try {
            // Poll for new block height
            const blockInfo = await this.providerManager
              .executeWithFailover(async (client) => {
                const baseURL = client.defaults.baseURL || '';

                // MyDoge - may not have block height API directly
                if (baseURL.includes('api.mydoge.com')) {
                  // MyDoge doesn't expose block height, skip to fallback
                  throw new Error('MyDoge: Use alternate provider for block height');
                }

                // Nintondo API for block info
                if (baseURL.includes('doge-mainnet-api.nintondo.io')) {
                  const res = await client.get('/blocks/tip/height');
                  return {
                    height: res.data?.height || res.data || 0,
                    hash: res.data?.hash || ''
                  };
                }

                // Future: Dojak API
                if (baseURL.includes('api.dojak.dog')) {
                  const res = await client.get('/api/v1/blocks/tip');
                  return res.data;
                }

                // Generic fallback
                const res = await client.get('/api/v1/blocks/tip');
                return res.data;
              })
              .catch(() => ({ height: 0, hash: '' }));

            if (blockInfo.height > lastBlockHeight && lastBlockHeight > 0) {
              const event = {
                type: 'new_block',
                blockHeight: blockInfo.height,
                blockHash: blockInfo.hash,
                timestamp: Date.now()
              };

              if (onEvent) onEvent(event);
            }

            lastBlockHeight = Math.max(lastBlockHeight, blockInfo.height);
          } catch (error) {
            console.error('[WalletAPI] New blocks polling error:', error);
            if (onError) onError(error);
          }

          // Schedule next poll
          if (isSubscribed) {
            setTimeout(pollForNewBlocks, pollInterval);
          }
        };

        // Start polling
        setTimeout(pollForNewBlocks, 3000); // Start after 3 seconds

        // Return unsubscribe function
        return () => {
          isSubscribed = false;
        };
      }
    };
  }
}

// Create and export singleton instance
const walletApiService = new WalletApiService();

export { walletApiService };
export default walletApiService;
