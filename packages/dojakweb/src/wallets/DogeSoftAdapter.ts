import { WalletAdapter, WalletConnection, DRC20Token, WalletInscription } from './types';
import { walletDataApi } from '../utils/api';
import {
  dogeSoftRequest,
  getInjectedDogeSoftProvider,
  normalizeDogeSoftBalance,
  pickDogeSoftSignature,
  pickDogeSoftSignedPayload,
  pickDogeSoftTxid,
  type DogeSoftProvider,
} from '../utils/dogesoft-provider';

const SESSION_KEY = 'dogesoft_session';

const extractAccounts = (response: unknown): string[] => {
  if (Array.isArray(response)) return response.filter((x): x is string => typeof x === 'string');
  if (!response || typeof response !== 'object') return [];
  const r = response as { accounts?: unknown; addresses?: unknown; address?: unknown };
  if (Array.isArray(r.accounts)) return r.accounts.filter((x): x is string => typeof x === 'string');
  if (Array.isArray(r.addresses)) return r.addresses.filter((x): x is string => typeof x === 'string');
  if (typeof r.address === 'string' && r.address) return [r.address];
  return [];
};

/**
 * Doge Soft (`window.dogesoft`) — phone-paired browser extension.
 * https://docs.dogesoft.io/wallet/quickstart/
 */
export class DogeSoftAdapter implements WalletAdapter {
  readonly id = 'dogesoft';
  readonly name = 'Doge Soft';
  readonly icon = '☾🐕';
  readonly supportedChains = ['DOGE'];

  private eventHandlers: { [event: string]: ((data?: any) => void)[] } = {};
  private currentAddress: string | null = null;

  constructor() {
    this.setupEventListeners();
  }

  private provider(): DogeSoftProvider | null {
    return getInjectedDogeSoftProvider();
  }

  private isAvailable(): boolean {
    return !!this.provider();
  }

  async connect(): Promise<WalletConnection> {
    const provider = this.provider();
    if (!provider) {
      throw new Error('Doge Soft wallet extension not found. Please install and pair it first.');
    }

    const response =
      typeof provider.connect === 'function'
        ? await provider.connect()
        : await dogeSoftRequest(provider, 'connect');

    const accounts = extractAccounts(response);
    this.currentAddress = accounts[0] ?? (await this.getAddress());

    if (!this.currentAddress) {
      throw new Error('Failed to connect to Doge Soft — no address returned');
    }

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ address: this.currentAddress, connectedAt: Date.now() }),
    );
    this.emit('connect', { address: this.currentAddress });

    return { address: this.currentAddress, connected: true };
  }

  async disconnect(): Promise<void> {
    const provider = this.provider();
    if (provider?.disconnect) {
      await provider.disconnect().catch(() => undefined);
    } else if (provider) {
      await dogeSoftRequest(provider, 'disconnect').catch(() => undefined);
    }
    this.currentAddress = null;
    localStorage.removeItem(SESSION_KEY);
    this.emit('disconnect');
  }

  async isConnected(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    const provider = this.provider();
    try {
      if (typeof provider?.isConnected === 'function') {
        return Boolean(await provider.isConnected());
      }
      const address = await this.getAddress();
      return !!address;
    } catch {
      return false;
    }
  }

  async signMessage(message: string): Promise<string> {
    const provider = this.provider();
    if (!provider) {
      throw new Error('Doge Soft wallet extension not found');
    }
    const address = this.currentAddress ?? (await this.getAddress().catch(() => undefined));
    const response =
      typeof provider.signMessage === 'function'
        ? await provider.signMessage(message, address)
        : await dogeSoftRequest(provider, 'signMessage', { message, address });
    return pickDogeSoftSignature(response);
  }

  async signTransaction(tx: any): Promise<string> {
    const provider = this.provider();
    if (!provider) {
      throw new Error('Doge Soft wallet extension not found');
    }
    const psbt = typeof tx === 'string' ? tx : tx?.psbt ?? tx?.psbtHex ?? tx?.rawTx;
    if (typeof psbt !== 'string' || !psbt.trim()) {
      throw new Error('Doge Soft signTransaction expected a PSBT string');
    }
    const response =
      typeof provider.signPsbt === 'function'
        ? await provider.signPsbt(psbt, { finalize: true })
        : await dogeSoftRequest(provider, 'signPsbt', { psbt, finalize: true });
    return pickDogeSoftSignedPayload(response);
  }

  async signPSBT(psbtHex: string): Promise<string> {
    return this.signTransaction(psbtHex);
  }

  async getAddress(): Promise<string> {
    if (this.currentAddress) {
      return this.currentAddress;
    }
    const provider = this.provider();
    if (!provider) {
      throw new Error('Doge Soft not available');
    }
    if (typeof provider.getAddress === 'function') {
      const direct = await provider.getAddress();
      if (direct) {
        this.currentAddress = direct;
        return direct;
      }
    }
    const accounts =
      typeof provider.getAccounts === 'function'
        ? await provider.getAccounts()
        : extractAccounts(await dogeSoftRequest(provider, 'getAccounts'));
    if (Array.isArray(accounts) && accounts[0]) {
      this.currentAddress = accounts[0];
      return accounts[0];
    }
    throw new Error('No Doge Soft account available');
  }

  async getBalance(): Promise<string> {
    try {
      const provider = this.provider();
      if (provider && typeof provider.getBalance === 'function') {
        const direct = await provider.getBalance();
        return String(normalizeDogeSoftBalance(direct));
      }
    } catch {
      // Fall through to indexer.
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
    const address = await this.getAddress();
    return walletDataApi.fetchInscriptions(address);
  }

  async sendDoge(params: { to: string; amount: number; feeRate?: number }): Promise<string> {
    const provider = this.provider();
    if (!provider) {
      throw new Error('Doge Soft wallet extension not found');
    }
    const response =
      typeof provider.sendDoge === 'function'
        ? await provider.sendDoge(params)
        : await dogeSoftRequest(provider, 'sendDoge', params);
    return pickDogeSoftTxid(response);
  }

  async sendInscription(params: { inscriptionId: string; to: string }): Promise<string> {
    const provider = this.provider();
    if (!provider) {
      throw new Error('Doge Soft wallet extension not found');
    }
    const response =
      typeof provider.sendInscription === 'function'
        ? await provider.sendInscription(params)
        : await dogeSoftRequest(provider, 'sendInscription', params);
    return pickDogeSoftTxid(response);
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
        console.error(`Error in Doge Soft ${event} listener:`, error);
      }
    });
  }

  private setupEventListeners() {
    const provider = this.provider();
    if (!provider?.on) {
      return;
    }

    provider.on('accountsChanged', (accounts?: string[]) => {
      const nextAddress = Array.isArray(accounts) ? accounts[0] ?? null : null;
      this.currentAddress = nextAddress;
      if (nextAddress) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ address: nextAddress, connectedAt: Date.now() }),
        );
        this.emit('accountChanged', { address: nextAddress });
      } else {
        localStorage.removeItem(SESSION_KEY);
        this.emit('disconnect');
      }
    });

    provider.on('disconnect', () => {
      this.currentAddress = null;
      localStorage.removeItem(SESSION_KEY);
      this.emit('disconnect');
    });
  }
}
