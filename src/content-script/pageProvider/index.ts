// this script is injected into webpage's context
import { ethErrors, serializeError } from 'eth-rpc-errors';
import { EventEmitter } from 'events';

import {
  IntentPayload,
  RequestMethodGetBitcoinUtxosParams,
  RequestMethodGetInscriptionsParams,
  RequestMethodInscribeTransferParams,
  RequestMethodSendDogeParams,
  RequestMethodSendDunesParams,
  RequestMethodSendInscriptionParams,
  RequestMethodSignIntentParams,
  RequestMethodSignMessageParams,
  RequestMethodSignMessagesParams,
  TxType
} from '@/shared/types';
import { objToUint8Array } from '@/shared/utils';
import BroadcastChannelMessage from '@/shared/utils/message/broadcastChannelMessage';
import { CosmosChainInfo } from '@unisat/Steak-service';

import PushEventHandlers from './pushEventHandlers';
import ReadyPromise from './readyPromise';
import { $, domReadyCall } from './utils';

const log = (event, ...args) => {
  if (process.env.NODE_ENV !== 'production') {
    // console.log(
    //   `%c [dojak] (${new Date().toTimeString().slice(0, 8)}) ${event}`,
    //   'font-weight: 600; background-color: #7d6ef9; color: white;',
    //   ...args
    // );
  }
};
const script = document.currentScript;
const channelName = script?.getAttribute('channel') || 'dojak';

export interface Interceptor {
  onRequest?: (data: any) => any;
  onResponse?: (res: any, data: any) => any;
}

interface StateProvider {
  accounts: string[] | null;
  isConnected: boolean;
  isUnlocked: boolean;
  initialized: boolean;
  isPermanentlyDisconnected: boolean;
}

const EXTENSION_CONTEXT_INVALIDATED_CHROMIUM_ERROR = 'Extension context invalidated.';

const _dojakPrividerPrivate: {
  _selectedAddress: string | null;
  _network: string | null;
  _isConnected: boolean;
  _initialized: boolean;
  _isUnlocked: boolean;

  _state: StateProvider;

  _pushEventHandlers: PushEventHandlers | null;
  _requestPromise: ReadyPromise;
  _bcm: BroadcastChannelMessage;
} = {
  _selectedAddress: null,
  _network: null,
  _isConnected: false,
  _initialized: false,
  _isUnlocked: false,

  _state: {
    accounts: null,
    isConnected: false,
    isUnlocked: false,
    initialized: false,
    isPermanentlyDisconnected: false
  },

  _pushEventHandlers: null,
  _requestPromise: new ReadyPromise(0),
  _bcm: new BroadcastChannelMessage(channelName)
};

let cache_origin = '';

// Create Symbol key for private methods
const requestMethodKey = Symbol('requestMethod');

export class dojakProvider extends EventEmitter {
  isDojak = true;
  mode = 'dojak' as const;

  constructor({ maxListeners = 100 } = {}) {
    super();
    this.setMaxListeners(maxListeners);
    this.initialize();
    _dojakPrividerPrivate._pushEventHandlers = new PushEventHandlers(this, _dojakPrividerPrivate);
  }

  private tryDetectTab = async () => {
    const origin = window.top?.location.origin;
    if (origin && cache_origin !== origin) {
      cache_origin = origin;
      const icon =
        ($('head > link[rel~="icon"]') as HTMLLinkElement)?.href ||
        ($('head > meta[itemprop="image"]') as HTMLMetaElement)?.content;

      const name = document.title || ($('head > meta[name="title"]') as HTMLMetaElement)?.content || origin;
      _dojakPrividerPrivate._bcm.request({
        method: 'tabCheckin',
        params: { icon, name }
      });
    }
  };

  initialize = async () => {
    document.addEventListener('visibilitychange', this._requestPromiseCheckVisibility);

    _dojakPrividerPrivate._bcm.connect().on('message', this._handleBackgroundMessage);

    this.tryDetectTab();
    domReadyCall(() => {
      this.tryDetectTab();
    });

    try {
      const { network, accounts, isUnlocked }: any = await this[requestMethodKey]({
        method: 'getProviderState'
      });
      if (isUnlocked) {
        _dojakPrividerPrivate._isUnlocked = true;
        _dojakPrividerPrivate._state.isUnlocked = true;
      }
      this.emit('connect', {});
      _dojakPrividerPrivate._pushEventHandlers?.networkChanged({
        network
      });

      _dojakPrividerPrivate._pushEventHandlers?.accountsChanged(accounts);
    } catch {
      //
    } finally {
      _dojakPrividerPrivate._initialized = true;
      _dojakPrividerPrivate._state.initialized = true;
      this.emit('_initialized');
    }

    this.keepAlive();
  };

  /**
   * @private
   * Sending a message to the extension to receive will keep the service worker alive.
   */
  private keepAlive = () => {
    this[requestMethodKey]({
      method: 'keepAlive',
      params: {}
    }).then((v) => {
      setTimeout(() => {
        this.keepAlive();
      }, 1000);
    });
  };

  private _requestPromiseCheckVisibility = () => {
    if (document.visibilityState === 'visible') {
      _dojakPrividerPrivate._requestPromise.check(1);
    } else {
      _dojakPrividerPrivate._requestPromise.uncheck(1);
    }
  };

  private _handleBackgroundMessage = ({ event, data }) => {
    log('[push event]', event, data);
    if (_dojakPrividerPrivate._pushEventHandlers?.[event]) {
      return _dojakPrividerPrivate._pushEventHandlers[event](data);
    }

    this.emit(event, data);
  };

  // Implement truly private method using Symbol
  private [requestMethodKey] = async (data) => {
    if (!data) {
      throw ethErrors.rpc.invalidRequest();
    }

    this._requestPromiseCheckVisibility();

    return _dojakPrividerPrivate._requestPromise.call(() => {
      log('[request]', JSON.stringify(data, null, 2));
      return _dojakPrividerPrivate._bcm
        .request(data)
        .then((res) => {
          log('[request: success]', data.method, res);
          return res;
        })
        .catch((err) => {
          log('[request: error]', data.method, serializeError(err));
          throw serializeError(err);
        });
    });
  };

  // Keep _request method as a compatibility layer, but show warning
  _request = async (data) => {
    console.warn(
      '[Dojak] Directly accessing _request method is deprecated and will be removed in future versions. Please use the public API instead.'
    );
    return this[requestMethodKey](data);
  };

  // Public request method for dApp compatibility (similar to MetaMask/EIP-1193 pattern)
  request = async (args: { method: string; params?: any }): Promise<any> => {
    const { method, params } = args;

    // Map dApp method names to native wallet methods
    switch (method) {
      // Account methods
      case 'dojak_requestAccounts':
      case 'requestAccounts':
        return this.requestAccounts();

      case 'dojak_getAccounts':
      case 'getAccounts':
        return this.getAccounts();

      case 'dojak_disconnect':
      case 'disconnect':
        return this.disconnect();

      // Network methods
      case 'dojak_getNetwork':
      case 'getNetwork':
        return this.getNetwork();

      case 'dojak_switchNetwork':
      case 'switchNetwork':
        return this.switchNetwork(params?.network);

      case 'dojak_getChain':
      case 'getChain':
        return this.getChain();

      case 'dojak_switchChain':
      case 'switchChain':
        return this.switchChain(params?.chain || params?.chainId);

      // Signing methods
      case 'dojak_signMessage':
      case 'signMessage':
        return this.signMessage(params?.message || params?.text, params?.type || 'ecdsa');

      case 'dojak_signIntent':
      case 'signIntent':
        return this[requestMethodKey]({
          method: 'signIntent',
          params
        });

      case 'dojak_signPsbt':
      case 'signPsbt':
        return this.signPsbt(params?.psbtHex || params?.psbt, params?.options);

      case 'dojak_signTransaction':
        return this.signPsbt(params?.tx?.psbtHex || params?.tx, params?.options);

      // Transaction methods
      case 'dojak_sendBitcoin':
      case 'dojak_sendDogecoin':
      case 'dojak_sendDoge':
      case 'sendBitcoin':
      case 'sendDogecoin':
      case 'sendDoge':
        return this.sendDoge(params?.toAddress, params?.koinu, params);

      case 'dojak_sendInscription':
      case 'sendInscription':
        return this.sendInscription(params?.toAddress, params?.inscriptionId, params);

      case 'dojak_pushTx':
      case 'pushTx':
        return this.pushTx(params?.rawtx);

      case 'dojak_pushPsbt':
      case 'pushPsbt':
        return this.pushPsbt(params?.psbtHex);

      // Query methods
      case 'dojak_getPublicKey':
      case 'getPublicKey':
        return this.getPublicKey();

      case 'dojak_getBalance':
      case 'getBalance':
        return this.getBalance();

      case 'dojak_getBalanceV2':
      case 'getBalanceV2':
        return this.getBalanceV2();

      case 'dojak_getInscriptions':
      case 'getInscriptions':
        return this.getInscriptions(params?.cursor, params?.size);

      case 'dojak_getBitcoinUtxos':
      case 'getBitcoinUtxos':
        return this.getBitcoinUtxos(params?.cursor, params?.size);

      case 'dojak_getVersion':
      case 'getVersion':
        return this.getVersion();

      // DRC-20 / Dunes methods
      case 'dojak_inscribeTransfer':
      case 'inscribeTransfer':
        return this.inscribeTransfer(params?.ticker, params?.amount);

      case 'dojak_sendDunes':
      case 'sendDunes':
        return this.sendDunes(params?.toAddress, params?.runeid, params?.amount, params);

      default:
        // For any unrecognized methods, pass through to the internal request
        return this[requestMethodKey]({ method, params });
    }
  };

  // Modify all public methods to use Symbol method
  requestAccounts = async () => {
    return this[requestMethodKey]({
      method: 'requestAccounts'
    });
  };

  connect = async () => {
    const accounts = await this.requestAccounts();
    if (!accounts?.[0]) {
      throw new Error('No account connected');
    }

    return {
      address: accounts[0]
    };
  };

  disconnect = async () => {
    return this[requestMethodKey]({
      method: 'disconnect'
    });
  };

  getNetwork = async () => {
    return this[requestMethodKey]({
      method: 'getNetwork'
    });
  };

  switchNetwork = async (network: string) => {
    return this[requestMethodKey]({
      method: 'switchNetwork',
      params: {
        network
      }
    });
  };

  getChain = async () => {
    return this[requestMethodKey]({
      method: 'getChain'
    });
  };

  switchChain = async (chain: string) => {
    return this[requestMethodKey]({
      method: 'switchChain',
      params: {
        chain
      }
    });
  };

  getAccounts = async () => {
    return this[requestMethodKey]({
      method: 'getAccounts'
    });
  };

  getAddress = async () => {
    const accounts = await this.getAccounts();
    return accounts?.[0] || null;
  };

  getPublicKey = async () => {
    return this[requestMethodKey]({
      method: 'getPublicKey'
    });
  };

  // deprecated
  getBalance = async () => {
    return this[requestMethodKey]({
      method: 'getBalance'
    });
  };

  getBalanceV2 = async () => {
    return this[requestMethodKey]({
      method: 'getBalanceV2'
    });
  };

  getInscriptions = async (cursor = 0, size = 20) => {
    const params: RequestMethodGetInscriptionsParams = {
      cursor,
      size
    };
    return this[requestMethodKey]({
      method: 'getInscriptions',
      params
    });
  };

  signMessage = async (text: string, type: string) => {
    const params: RequestMethodSignMessageParams = {
      text,
      type
    };
    return this[requestMethodKey]({
      method: 'signMessage',
      params
    });
  };

  signIntent = async (payload: IntentPayload) => {
    const params: RequestMethodSignIntentParams = {
      payload
    };
    const signed = await this[requestMethodKey]({
      method: 'signIntent',
      params
    });

    return signed.signature;
  };

  multiSignMessage = async (messages: { text: string; type: string }[]) => {
    const params: RequestMethodSignMessagesParams = {
      messages
    };
    return this[requestMethodKey]({
      method: 'multiSignMessage',
      params
    });
  };

  verifyMessageOfBIP322Simple = async (address: string, message: string, signature: string, network?: number) => {
    return this[requestMethodKey]({
      method: 'verifyMessageOfBIP322Simple',
      params: {
        address,
        message,
        signature,
        network
      }
    });
  };

  signPSBT = async (psbtBase64: string, options?: any) => {
    return this.signPsbt(psbtBase64, options);
  };

  signData = async (data: string, type: string) => {
    return this[requestMethodKey]({
      method: 'signData',
      params: {
        data,
        type
      }
    });
  };

  sendDoge = async (
    toAddress: string,
    koinu: number,
    options?: { feeRate: number; memo?: string; memos?: string[] }
  ) => {
    const params: RequestMethodSendDogeParams = {
      sendDogeParams: {
        toAddress,
        koinu,
        feeRate: options?.feeRate,
        memo: options?.memo,
        memos: options?.memos
      },
      type: TxType.SEND_BITCOIN
    };
    return this[requestMethodKey]({
      method: 'sendBitcoin',
      params
    });
  };

  // Aliases for compatibility
  sendDogecoin = async (
    toAddress: string,
    koinu: number,
    options?: { feeRate: number; memo?: string; memos?: string[] }
  ) => {
    return this.sendDoge(toAddress, koinu, options);
  };

  sendBitcoin = async (
    toAddress: string,
    koinu: number,
    options?: { feeRate: number; memo?: string; memos?: string[] }
  ) => {
    return this.sendDoge(toAddress, koinu, options);
  };

  sendInscription = async (toAddress: string, inscriptionId: string, options?: { feeRate: number }) => {
    const params: RequestMethodSendInscriptionParams = {
      sendInscriptionParams: {
        toAddress,
        inscriptionId,
        feeRate: options?.feeRate
      },
      type: TxType.SEND_doginals_INSCRIPTION
    };
    return this[requestMethodKey]({
      method: 'sendInscription',
      params
    });
  };

  sendDunes = async (toAddress: string, runeid: string, amount: string, options?: { feeRate: number }) => {
    const params: RequestMethodSendDunesParams = {
      sendDunesParams: {
        toAddress,
        runeid,
        amount,
        feeRate: options?.feeRate
      },
      type: TxType.SEND_DUNES
    };
    return this[requestMethodKey]({
      method: 'sendDunes',
      params
    });
  };

  /**
   * push transaction
   */
  pushTx = async (rawtx: string) => {
    return this[requestMethodKey]({
      method: 'pushTx',
      params: {
        rawtx
      }
    });
  };

  signPsbt = async (psbtHex: string, options?: any) => {
    return this[requestMethodKey]({
      method: 'signPsbt',
      params: {
        psbtHex,
        type: TxType.SIGN_TX,
        options
      }
    });
  };

  signPsbts = async (psbtHexs: string[], options?: any[]) => {
    return this[requestMethodKey]({
      method: 'multiSignPsbt',
      params: {
        psbtHexs,
        options
      }
    });
  };

  pushPsbt = async (psbtHex: string) => {
    return this[requestMethodKey]({
      method: 'pushPsbt',
      params: {
        psbtHex
      }
    });
  };

  inscribeTransfer = async (ticker: string, amount: string) => {
    const params: RequestMethodInscribeTransferParams = {
      ticker,
      amount
    };

    return this[requestMethodKey]({
      method: 'inscribeTransfer',
      params
    });
  };

  getVersion = async () => {
    return this[requestMethodKey]({
      method: 'getVersion'
    });
  };

  getBitcoinUtxos = async (cursor = 0, size = 20) => {
    const params: RequestMethodGetBitcoinUtxosParams = {
      cursor,
      size
    };
    return this[requestMethodKey]({
      method: 'getBitcoinUtxos',
      params
    });
  };

  // cosmos
  keplr = {
    enable: async (chainId: string) => {
      return this[requestMethodKey]({
        method: 'cosmos_enable',
        params: {
          chainId
        }
      });
    },

    experimentalSuggestChain: async (chainData: CosmosChainInfo) => {
      return this[requestMethodKey]({
        method: 'cosmos_experimentalSuggestChain',
        params: {
          chainData
        }
      });
    },

    getKey: async (chainId: string) => {
      const _key: any = await this[requestMethodKey]({
        method: 'cosmos_getKey',
        params: {
          chainId
        }
      });

      const key = Object.assign({}, _key, {
        address: Uint8Array.from(_key.address.split(',')),
        pubKey: Uint8Array.from(_key.pubKey.split(','))
      });

      return key;
    },

    getOfflineSigner: (chainId: string, signOptions?: any) => {
      return new CosmJSOfflineSigner(chainId, this, signOptions);
    },

    signArbitrary: async (chainId: string, signerAddress: string, data: string | Uint8Array) => {
      return this[requestMethodKey]({
        method: 'cosmos_signArbitrary',
        params: {
          chainId,
          signerAddress,
          type: typeof data === 'string' ? 'string' : 'Uint8Array',
          data: typeof data === 'string' ? data : Buffer.from(data).toString('base64'),
          origin: window.location.origin
        }
      });
    }
  };
}

class CosmJSOfflineSigner {
  constructor(
    protected readonly chainId: string,
    protected readonly provider: dojakProvider,
    protected readonly signOptions?: any
  ) {}

  async getAccounts() {
    const key: any = await this.provider.keplr.getKey(this.chainId);
    return [
      {
        address: key.bech32Address,
        algo: key.algo,
        pubkey: key.pubKey
      }
    ];
  }

  async signDirect(signerAddress: string, signDoc: any) {
    const response: any = await this.provider[requestMethodKey]({
      method: 'cosmos_signDirect',
      params: {
        signerAddress,
        signDoc: {
          bodyBytes: signDoc.bodyBytes,
          authInfoBytes: signDoc.authInfoBytes,
          chainId: signDoc.chainId,
          accountNumber: signDoc.accountNumber.toString()
        }
      }
    });
    return {
      signed: {
        bodyBytes: objToUint8Array(response.signed.bodyBytes),
        authInfoBytes: objToUint8Array(response.signed.authInfoBytes),
        chainId: response.signed.chainId.toString(),
        accountNumber: response.signed.accountNumber.toString()
      },
      signature: response.signature
    };
  }
}

declare global {
  interface Window {
    dojak: dojakProvider;
  }
}

function defineUnwritablePropertyIfPossible(o: any, p: string, value: any) {
  const descriptor = Object.getOwnPropertyDescriptor(o, p);
  if (!descriptor || descriptor.writable) {
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(o, p, {
        value,
        writable: false
      });
    } else {
      o[p] = value;
    }
  } else {
    console.warn(`Failed to inject ${p} from dojak. Probably, other wallet is trying to intercept Dojak Wallet`);
  }
}

const provider = new dojakProvider();
const providerProxy = new Proxy(provider, {
  deleteProperty: () => true,
  get: (target, prop) => {
    if (prop === '_events' || prop === '_eventsCount' || prop === '_maxListeners') {
      return target[prop];
    }

    // Block access to methods starting with underscore or Symbol methods
    if ((typeof prop === 'string' && prop.startsWith('_')) || prop === requestMethodKey) {
      console.warn(`[Dojak] Attempted access to private method: ${String(prop)} is not allowed for security reasons`);
      return undefined;
    }
    return target[prop];
  }
});

defineUnwritablePropertyIfPossible(window, 'dojak', providerProxy);

// Many wallets occupy the window.dojak namespace, so we need to use a different namespace to avoid conflicts.
defineUnwritablePropertyIfPossible(window, 'dojak_wallet', providerProxy);

// EIP-1193 Smart Bridge: Inject window.ethereum with P... address filtering
class DojakEthereumProvider extends dojakProvider {
  isMetaMask = true; // Compatible with MetaMask detection
  isDojak = true; // Also identify as Dojak

  async request(args: { method: string; params?: any[] }) {
    const { method, params = [] } = args;

    // Filter addresses to only allow P... (Dogecoin) addresses
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
      const result = await super.request({ method: 'requestAccounts' });
      if (result && Array.isArray(result)) {
        // Filter to only P... addresses (Dogecoin addresses)
        return result.filter((addr) => typeof addr === 'string' && addr.startsWith('P'));
      }
      return result;
    }

    // BorkStarter specific methods and enhanced EIP-1193 support
    switch (method) {
      // Standard EIP-1193 methods
      case 'eth_chainId':
        return await this.chainId();

      case 'net_version':
        return await this.net_version();

      // BorkStarter wallet connection methods
      case 'dojak_connect':
      case 'borkstarter_connect':
        return await super.request({ method: 'requestAccounts' });

      case 'dojak_disconnect':
      case 'borkstarter_disconnect':
        return await super.request({ method: 'disconnect' });

      // BorkStarter balance methods
      case 'dojak_getBalance':
      case 'borkstarter_getBalance':
        return await super.request({ method: 'getBalanceV2' });

      // BorkStarter signing methods
      case 'dojak_signMessage':
      case 'borkstarter_signMessage':
        return await super.request({
          method: 'signMessage',
          params: {
            message: params[0] || params.message,
            type: params[1] || params.type || 'ecdsa'
          }
        });

      case 'personal_sign':
        // Support MetaMask-style personal_sign
        return await super.request({
          method: 'signMessage',
          params: {
            message: params[0],
            type: 'ecdsa'
          }
        });

      // BorkStarter transaction methods
      case 'dojak_sendTransaction':
      case 'dojak_sendDogecoin':
      case 'borkstarter_sendTransaction':
      case 'borkstarter_sendDogecoin':
        const txParams = params[0] || params;
        return await super.request({
          method: 'sendBitcoin',
          params: {
            toAddress: txParams.to,
            koinu: Math.floor(parseFloat(txParams.value) * 100000000), // Convert DOGE to koinu
            options: {
              feeRate: txParams.gasPrice ? Math.floor(txParams.gasPrice / 1000) : undefined,
              memo: txParams.data
            }
          }
        });

      case 'eth_sendTransaction':
        // Basic eth_sendTransaction support for compatibility
        const ethTx = params[0];
        if (ethTx && ethTx.to && ethTx.value) {
          return await super.request({
            method: 'sendBitcoin',
            params: {
              toAddress: ethTx.to,
              koinu: Math.floor(parseFloat(ethTx.value) * 100000000),
              options: {
                feeRate: ethTx.gasPrice ? Math.floor(ethTx.gasPrice / 1000) : undefined
              }
            }
          });
        }
        throw new Error('Invalid transaction parameters');

      // BorkStarter utility methods
      case 'dojak_getNetwork':
      case 'borkstarter_getNetwork':
        return await super.request({ method: 'getNetwork' });

      case 'dojak_getInscriptions':
      case 'borkstarter_getInscriptions':
        return await super.request({
          method: 'getInscriptions',
          params: {
            cursor: params[0] || 0,
            size: params[1] || 20
          }
        });

      default:
        // For unsupported methods, try to pass through to the main provider
        try {
          return await super.request(args);
        } catch (error) {
          throw new Error(`Unsupported method: ${method}`);
        }
    }
  }

  // Enhanced chain ID to report Dogecoin mainnet
  async chainId() {
    return '0x1e240'; // Dogecoin mainnet chain ID (77160 in decimal)
  }

  // Override network version
  async net_version() {
    return '77160'; // Dogecoin mainnet
  }

  // BorkStarter specific methods
  async borkstarter_connect() {
    return this.request({ method: 'borkstarter_connect' });
  }

  async borkstarter_disconnect() {
    return this.request({ method: 'borkstarter_disconnect' });
  }

  async borkstarter_signVerification() {
    const message = `Verify wallet ownership for BorkStarter\\nTimestamp: ${Date.now()}`;
    return this.request({
      method: 'borkstarter_signMessage',
      params: [message, 'ecdsa']
    });
  }

  async borkstarter_getLaunchpadBalance() {
    return this.request({ method: 'borkstarter_getBalance' });
  }
}

const ethereumProvider = new DojakEthereumProvider();
const ethereumProxy = new Proxy(ethereumProvider, providerProxy);

// BorkStarter-specific provider with enhanced Dogecoin features
class BorkStarterProvider extends dojakProvider {
  isBorkStarter = true;
  isDojak = true;

  // Enhanced connection specifically for BorkStarter
  async connect() {
    const accounts = await this.requestAccounts();
    if (accounts && accounts.length > 0) {
      // Auto-sign verification message for BorkStarter
      const verification = await this.signVerificationMessage();
      return {
        accounts,
        verification
      };
    }
    throw new Error('Failed to connect wallet');
  }

  // BorkStarter verification message signing
  async signVerificationMessage(customMessage?: string) {
    const message =
      customMessage ||
      `Verify wallet ownership for BorkStarter\\nTimestamp: ${Date.now()}\\nPurpose: Launchpad participation`;
    const signature = await this.signMessage(message, 'ecdsa');
    const address = (await this.getAccounts())[0];

    return {
      address,
      message,
      signature,
      timestamp: Date.now(),
      purpose: 'launchpad'
    };
  }

  // Get balance formatted for BorkStarter UI
  async getLaunchpadBalance() {
    const balance = await this.getBalanceV2();
    return {
      address: (await this.getAccounts())[0],
      availableDoge: balance.availableBalance / 100000000,
      totalDoge: balance.totalBalance / 100000000,
      availableKoinu: balance.availableBalance,
      totalKoinu: balance.totalBalance,
      network: await this.getNetwork()
    };
  }

  // Enhanced DOGE sending for launchpad contributions
  async contributeToLaunchpad(projectId: string, amountDoge: number, memo?: string) {
    // This would be enhanced to include project-specific logic
    // For now, it's a wrapper around sendDoge
    const koinu = Math.floor(amountDoge * 100000000);

    // In a real implementation, you'd look up the project's contribution address
    // For now, this is a placeholder
    throw new Error('Project-specific contribution logic needs to be implemented');
  }
}

const borkStarterProvider = new BorkStarterProvider();
const borkStarterProxy = new Proxy(borkStarterProvider, {
  deleteProperty: () => true,
  get: (target, prop) => {
    if (prop === '_events' || prop === '_eventsCount' || prop === '_maxListeners') {
      return target[prop];
    }

    if ((typeof prop === 'string' && prop.startsWith('_')) || prop === requestMethodKey) {
      console.warn(`[BorkStarter] Attempted access to private method: ${String(prop)} is not allowed`);
      return undefined;
    }
    return target[prop];
  }
});

// Inject BorkStarter-specific provider
defineUnwritablePropertyIfPossible(window, 'borkStarter', borkStarterProxy);

// Only inject ethereum if it doesn't already exist (don't override existing wallets)
if (!window.ethereum) {
  defineUnwritablePropertyIfPossible(window, 'ethereum', ethereumProxy);
}

window.dispatchEvent(new Event('dojak#initialized'));
window.dispatchEvent(new Event('borkStarter#ready'));
