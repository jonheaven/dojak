import { WalletAdapter, WalletConnection, DRC20Token, WalletInscription } from './types';
import { walletDataApi } from '../utils/api';

/**
 * Spooky Doge provider injected by Spook Society's extension as `window.dogecoin`.
 *
 * Canonical signal:
 *   provider.isSpookyWallet === true
 *
 * The extension exposes dedicated methods for DOGE L1 + Doginals/DRC-20/Dunes,
 * plus a generic `request({ method, params })` fallback for forward compatibility.
 */
type SpookyDogeProvider = {
  isSpookyWallet?: boolean;
  isConnected?: () => boolean;
  connect?: () => Promise<any>;
  disconnect?: () => Promise<void>;
  getAddress?: () => Promise<string>;
  getAccounts?: () => Promise<string[]>;
  getBalance?: () => Promise<any>;
  signMessage?: (message: string) => Promise<string>;
  signPsbt?: (params: Record<string, unknown>) => Promise<any>;
  signPsbts?: (params: Record<string, unknown>) => Promise<any>;
  sendTransaction?: (params: Record<string, unknown>) => Promise<any>;
  getDoginals?: (params?: Record<string, unknown>) => Promise<any>;
  getDrc20Balances?: () => Promise<any>;
  getDunesBalances?: () => Promise<any>;
  sendDoginal?: (params: Record<string, unknown>) => Promise<any>;
  sendDrc20?: (params: Record<string, unknown>) => Promise<any>;
  batchSendDrc20?: (params: Record<string, unknown>) => Promise<any>;
  sendDune?: (params: Record<string, unknown>) => Promise<any>;
  sendDuneMulti?: (params: Record<string, unknown>) => Promise<any>;
  batchSendDune?: (params: Record<string, unknown>) => Promise<any>;
  request?: (args: { method: string; params?: any }) => Promise<any>;
  on?: (event: string, callback: (data?: any) => void) => void;
  removeListener?: (event: string, callback: (data?: any) => void) => void;
};

const getInjectedSpookyDoge = (): SpookyDogeProvider | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return ((window as any).dogecoin ?? null) as SpookyDogeProvider | null;
};

export class SpookyDogeAdapter implements WalletAdapter {
  readonly id = 'spookydoge';
  readonly name = 'Spooky Doge';
  readonly icon = '👻🐕';
  readonly supportedChains = ['DOGE'];

  private eventHandlers: { [event: string]: ((data?: any) => void)[] } = {};
  private currentAddress: string | null = null;

  constructor() {
    this.setupEventListeners();
  }

  private isAvailable(): boolean {
    const provider = getInjectedSpookyDoge();
    return !!provider && provider.isSpookyWallet === true;
  }

  /**
   * Prefer dedicated provider methods first, then use request({ method, params }).
   * This keeps UX optimal for wallets like Spooky on sus.dog while remaining future-proof.
   */
  private async callProvider(
    method: string,
    params?: any,
    directMethod?: keyof SpookyDogeProvider,
  ): Promise<any> {
    const provider = getInjectedSpookyDoge();
    if (!provider || provider.isSpookyWallet !== true) {
      throw new Error('Spooky Doge wallet extension not found. Please install and enable it first.');
    }

    console.log('[SpookyDoge] callProvider:start', {
      method,
      directMethod: directMethod ?? null,
      hasDirectMethod: directMethod ? typeof provider[directMethod] === 'function' : false,
      hasRequest: typeof provider.request === 'function',
      paramsPreview: params ? JSON.stringify(params).slice(0, 240) : null,
    });

    if (directMethod && typeof provider[directMethod] === 'function') {
      const callable = provider[directMethod] as (...args: any[]) => Promise<any>;
      const result = params === undefined ? await callable() : await callable(params);
      console.log('[SpookyDoge] callProvider:directMethod:result', {
        method,
        resultPreview: result ? JSON.stringify(result).slice(0, 240) : null,
      });
      return result;
    }

    if (typeof provider.request === 'function') {
      const result = await provider.request({ method, params });
      console.log('[SpookyDoge] callProvider:request:result', {
        method,
        resultPreview: result ? JSON.stringify(result).slice(0, 240) : null,
      });
      return result;
    }

    throw new Error(`Spooky Doge provider does not expose method: ${method}`);
  }

  async connect(): Promise<WalletConnection> {
    if (!this.isAvailable()) {
      throw new Error('Spooky Doge wallet extension not found. Please install it first.');
    }

    const provider = getInjectedSpookyDoge()!;
    const response = typeof provider.connect === 'function'
      ? await this.callProvider('doge_requestAccounts', undefined, 'connect')
      : await this.callProvider('doge_requestAccounts');

    const accounts = Array.isArray(response)
      ? response
      : response?.accounts ?? response?.addresses ?? response?.result ?? [];

    this.currentAddress =
      response?.address ??
      (Array.isArray(accounts) ? accounts[0] : null) ??
      (await this.getAddress());

    if (!this.currentAddress) {
      throw new Error('Failed to connect to Spooky Doge wallet - no address returned');
    }

    localStorage.setItem(
      'spookydoge_session',
      JSON.stringify({ address: this.currentAddress, connectedAt: Date.now() }),
    );
    this.emit('connect', { address: this.currentAddress });

    return { address: this.currentAddress, connected: true };
  }

  async disconnect(): Promise<void> {
    await this.callProvider('doge_disconnect', undefined, 'disconnect').catch(() => undefined);
    this.currentAddress = null;
    localStorage.removeItem('spookydoge_session');
    this.emit('disconnect');
  }

  async isConnected(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    const session = localStorage.getItem('spookydoge_session');
    if (!session) {
      return false;
    }

    try {
      const provider = getInjectedSpookyDoge();
      if (provider?.isSpookyWallet !== true) {
        return false;
      }
      if (typeof provider.isConnected === 'function') {
        return provider.isConnected();
      }

      const address = await this.getAddress();
      return !!address;
    } catch {
      return false;
    }
  }

  async signMessage(message: string): Promise<string> {
    console.log('[SpookyDoge] signMessage:start', { messageLength: message.length });
    const response = await this.callProvider('doge_signMessage', message, 'signMessage');
    console.log('[SpookyDoge] signMessage:response', response);
    return response?.signature ?? response?.signedMessage ?? response?.result ?? response;
  }

  async signTransaction(tx: any): Promise<string> {
    console.log('[SpookyDoge] signTransaction:start', {
      txType: typeof tx,
      txPreview: tx ? JSON.stringify(tx).slice(0, 240) : null,
    });
    const response = await this.callProvider('doge_signPsbt', tx, 'signPsbt');
    console.log('[SpookyDoge] signTransaction:response', response);
    return response?.signedTx ?? response?.signedPsbt ?? response?.signedRawTx ?? response?.txHex ?? response;
  }

  async getAddress(): Promise<string> {
    if (this.currentAddress) {
      return this.currentAddress;
    }

    const provider = getInjectedSpookyDoge();
    if (!provider) {
      throw new Error('Spooky Doge not available');
    }

    const directAddress = provider.getAddress ? await provider.getAddress() : null;
    if (directAddress) {
      this.currentAddress = directAddress;
      return directAddress;
    }

    const accounts = provider.getAccounts
      ? await provider.getAccounts()
      : await provider.request?.({ method: 'doge_requestAccounts' });
    if (Array.isArray(accounts) && accounts[0]) {
      this.currentAddress = accounts[0];
      return accounts[0];
    }

    throw new Error('No Spooky Doge account available');
  }

  async getBalance(): Promise<string> {
    try {
      const provider = getInjectedSpookyDoge();
      if (!provider) {
        throw new Error('Spooky Doge not available');
      }

      const direct = provider.getBalance
        ? await provider.getBalance()
        : await provider.request?.({ method: 'doge_getBalance' });
      const raw = direct?.balance ?? direct?.confirmed ?? direct?.total;
      if (raw !== undefined) {
        return String(raw);
      }
    } catch {
      // Fall through to indexer balance fallback.
    }

    const address = await this.getAddress();
    const balance = await walletDataApi.fetchBalance(address);
    return String(balance);
  }

  async getDRC20Tokens(): Promise<DRC20Token[]> {
    const address = await this.getAddress();
    return walletDataApi.fetchDRC20Tokens(address);
  }

  async getInscriptions(): Promise<WalletInscription[]> {
    try {
      const provider = getInjectedSpookyDoge();
      if (provider?.isSpookyWallet === true && typeof provider.getDoginals === 'function') {
        const response = await provider.getDoginals();
        const list = response?.items ?? response?.list ?? response?.doginals ?? response;
        if (Array.isArray(list)) {
          return list as WalletInscription[];
        }
      }
    } catch {
      // Fall back to indexer if provider helper fails.
    }

    const address = await this.getAddress();
    return walletDataApi.fetchInscriptions(address);
  }

  // Spooky-specific passthrough methods for advanced dApps (Doginals/DRC-20/Dunes).
  async signPsbts(params: Record<string, unknown>): Promise<any> {
    return this.callProvider('doge_signPsbts', params, 'signPsbts');
  }

  async sendTransaction(params: Record<string, unknown>): Promise<any> {
    return this.callProvider('doge_sendTransaction', params, 'sendTransaction');
  }

  async sendDoginal(params: Record<string, unknown>): Promise<any> {
    return this.callProvider('doge_sendDoginal', params, 'sendDoginal');
  }

  async sendDrc20(params: Record<string, unknown>): Promise<any> {
    return this.callProvider('doge_sendDrc20', params, 'sendDrc20');
  }

  async batchSendDrc20(params: Record<string, unknown>): Promise<any> {
    return this.callProvider('doge_batchSendDrc20', params, 'batchSendDrc20');
  }

  async sendDune(params: Record<string, unknown>): Promise<any> {
    return this.callProvider('doge_sendDune', params, 'sendDune');
  }

  async sendDuneMulti(params: Record<string, unknown>): Promise<any> {
    return this.callProvider('doge_sendDuneMulti', params, 'sendDuneMulti');
  }

  async batchSendDune(params: Record<string, unknown>): Promise<any> {
    return this.callProvider('doge_batchSendDune', params, 'batchSendDune');
  }

  on(event: 'connect' | 'disconnect' | 'accountChanged', handler: (data?: any) => void): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  off(event: 'connect' | 'disconnect' | 'accountChanged', handler: (data?: any) => void): void {
    if (!this.eventHandlers[event]) {
      return;
    }
    this.eventHandlers[event] = this.eventHandlers[event].filter((existing) => existing !== handler);
  }

  private emit(event: 'connect' | 'disconnect' | 'accountChanged', data?: any) {
    this.eventHandlers[event]?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in Spooky Doge ${event} listener:`, error);
      }
    });
  }

  private setupEventListeners() {
    const provider = getInjectedSpookyDoge();
    if (provider?.isSpookyWallet !== true || !provider.on) {
      return;
    }

    provider.on('accountsChanged', (accounts?: string[]) => {
      const nextAddress = Array.isArray(accounts) ? accounts[0] ?? null : null;
      this.currentAddress = nextAddress;
      if (nextAddress) {
        this.emit('accountChanged', { address: nextAddress });
      } else {
        this.emit('disconnect');
      }
    });

    provider.on('chainChanged', (chainId?: string) => {
      this.emit('accountChanged', { chainId });
    });

    provider.on('disconnect', () => {
      this.currentAddress = null;
      localStorage.removeItem('spookydoge_session');
      this.emit('disconnect');
    });
  }
}
