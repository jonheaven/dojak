import { WalletAdapter, WalletConnection, DRC20Token, WalletInscription } from './types';
import { walletDataApi } from '../utils/api';

declare global {
  interface Window {
    dojak?: {
      isDojak: boolean;
      request: (args: { method: string; params?: any }) => Promise<any>;
      on: (event: string, callback: (data?: any) => void) => void;
      removeListener: (event: string, callback: (data?: any) => void) => void;
      signPsbt?: (psbtHex: string, options?: any) => Promise<any>;
      signRequest?: (params: Record<string, unknown>) => Promise<any>;
    };
  }
}

export class DojakAdapter implements WalletAdapter {
  readonly id = 'dojak';
  readonly name = 'Dojak';
  readonly icon = '🎩🐕'; // Shiba in wizard hat
  readonly supportedChains = ['DOGE'];

  private eventHandlers: { [event: string]: ((data?: any) => void)[] } = {};
  private currentAddress: string | null = null;
  private currentChainId: string = 'dogecoin-mainnet';

  constructor() {
    this.setupEventListeners();
  }

  async connect(): Promise<WalletConnection> {
    try {
      // Check if Dojak extension is available
      if (!this.isAvailable()) {
        throw new Error('Dojak wallet extension not found. Please install it first.');
      }

      // Request accounts
      const response = await window.dojak!.request({
        method: 'dojak_requestAccounts'
      });

      if (!response.accounts || response.accounts.length === 0) {
        throw new Error('Failed to connect to Dojak wallet - no accounts returned');
      }

      const address = response.accounts[0];
      this.currentAddress = address;

      // Check network and switch to Dogecoin mainnet if needed
      if (response.chainId !== 'dogecoin-mainnet') {
        await this.switchChain('dogecoin-mainnet');
      }

      // Store session data to enable connection restoration
      localStorage.setItem('dojak_session', JSON.stringify({
        address,
        chainId: this.currentChainId,
        connectedAt: Date.now()
      }));

      // Emit connect event
      this.emit('connect', { address, chainId: this.currentChainId });

      return {
        address,
        connected: true
      };
    } catch (error) {
      console.error('Dojak connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.currentAddress = null;
      localStorage.removeItem('dojak_session');

      this.emit('disconnect');
    } catch (error) {
      console.error('Dojak disconnect failed:', error);
      throw error;
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      // Check for stored session data first to avoid triggering popup
      const sessionData = localStorage.getItem('dojak_session');
      if (!sessionData) {
        return false;
      }

      // Only call the extension API if we have session data (user previously connected)
      const accounts = await window.dojak!.request({ method: 'dojak_getAccounts' });
      return accounts && accounts.length > 0;
    } catch (error) {
      console.error('Dojak connection check failed:', error);
      return false;
    }
  }

  async signMessage(message: string): Promise<string> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Dojak not available');
      }

      const response = await window.dojak!.request({
        method: 'dojak_signMessage',
        params: { message }
      });

      return response.signature || response.signedMessage;
    } catch (error) {
      console.error('Dojak sign message failed:', error);
      throw error;
    }
  }

  async signTransaction(tx: any): Promise<string> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Dojak not available');
      }

      const response = typeof window.dojak!.signPsbt === 'function'
        ? await window.dojak!.signPsbt(tx)
        : window.dojak!.signRequest
          ? await window.dojak!.signRequest({
              rawTx: tx,
              psbtHex: tx,
              psbtBase64: tx,
              signOnly: false,
              partial: false,
            })
          : await window.dojak!.request({
              method: 'dojak_signTransaction',
              params: { tx }
            });

      if (typeof response === 'string') {
        return response;
      }
      return response.signedTx || response.signedPsbt || response.signedRawTx || response.txHex || response.signature;
    } catch (error) {
      console.error('Dojak sign transaction failed:', error);
      throw error;
    }
  }

  async getAddress(): Promise<string> {
    try {
      if (this.currentAddress) {
        return this.currentAddress;
      }

      if (!this.isAvailable()) {
        throw new Error('Dojak not available');
      }

      const accounts = await window.dojak!.request({ method: 'dojak_getAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      this.currentAddress = accounts[0];
      return accounts[0];
    } catch (error) {
      console.error('Dojak get address failed:', error);
      throw error;
    }
  }

  async getBalance(): Promise<string> {
    try {
      const address = await this.getAddress();
      return await walletDataApi.fetchBalance(address);
    } catch (error) {
      console.error('Dojak get balance failed:', error);
      return '0';
    }
  }

  async getDRC20Tokens(): Promise<DRC20Token[]> {
    try {
      const address = await this.getAddress();

      return await walletDataApi.fetchDRC20Tokens({ getAddress: () => address });
    } catch (error) {
      console.error('Dojak get DRC20 tokens failed:', error);
      throw error;
    }
  }

  async getInscriptions(): Promise<WalletInscription[]> {
    try {
      const address = await this.getAddress();
      return await walletDataApi.fetchInscriptions(address);
    } catch (error) {
      console.error('Dojak get inscriptions failed:', error);
      throw error;
    }
  }

  // Dojak-specific methods
  async switchChain(chainId: 'dogecoin-mainnet' | 'dogecoin-testnet'): Promise<void> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Dojak not available');
      }

      await window.dojak!.request({
        method: 'dojak_switchChain',
        params: { chainId }
      });

      this.currentChainId = chainId;
    } catch (error) {
      console.error('Dojak switch chain failed:', error);
      throw error;
    }
  }

  async getDRC20Balance(ticker: string): Promise<{ balance: string; transferable: string }> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Dojak not available');
      }

      const response = await window.dojak!.request({
        method: 'dojak_getDRC20Balance',
        params: { ticker }
      });

      return {
        balance: response.balance || '0',
        transferable: response.transferable || '0'
      };
    } catch (error) {
      console.error('Dojak get DRC20 balance failed:', error);
      return { balance: '0', transferable: '0' };
    }
  }

  async drc20Transfer(params: { ticker: string; amount: string; to: string }): Promise<{ txid: string }> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Dojak not available');
      }

      const response = await window.dojak!.request({
        method: 'dojak_drc20Transfer',
        params
      });

      return { txid: response.txid || response.hash };
    } catch (error) {
      console.error('Dojak DRC-20 transfer failed:', error);
      throw error;
    }
  }

  async inscribe(content: string | File): Promise<{ inscriptionId: string }> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Dojak not available');
      }

      const response = await window.dojak!.request({
        method: 'dojak_inscribe',
        params: { content }
      });

      return { inscriptionId: response.inscriptionId };
    } catch (error) {
      console.error('Dojak inscribe failed:', error);
      throw error;
    }
  }

  async getDoginals(): Promise<WalletInscription[]> {
    try {
      if (!this.isAvailable()) {
        throw new Error('Dojak not available');
      }

      const response = await window.dojak!.request({
        method: 'dojak_getInscriptions'
      });

      return response.inscriptions || [];
    } catch (error) {
      console.error('Dojak get inscriptions failed:', error);
      return [];
    }
  }

  private isAvailable(): boolean {
    return typeof window !== 'undefined' &&
           window.dojak &&
           window.dojak.isDojak === true;
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined' || !window.dojak) {
      return;
    }

    // Listen for account changes
    window.dojak.on('accountsChanged', (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        this.currentAddress = accounts[0];
        this.emit('accountChanged', { address: accounts[0] });
      } else {
        this.currentAddress = null;
        this.emit('disconnect');
      }
    });

    // Listen for chain changes
    window.dojak.on('chainChanged', (chainId: string) => {
      this.currentChainId = chainId;
      console.log('Dojak chain changed:', chainId);
    });
  }

  on(event: 'connect' | 'disconnect' | 'accountChanged', handler: (data?: any) => void): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  off(event: 'connect' | 'disconnect' | 'accountChanged', handler: (data?: any) => void): void {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }

  private emit(event: string, data?: any): void {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }
}
