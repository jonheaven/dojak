import { WalletAdapter, WalletConnection, DRC20Token, WalletInscription } from './types';
import { walletDataApi } from '../utils/api';
import { getInjectedMyDogeProvider } from '../utils/mydoge-provider';

type InjectedMyDogeProvider = {
  isMyDoge: boolean;
  connect: () => Promise<{ connected?: boolean; approved?: boolean; address?: string }>;
  disconnect?: () => Promise<void>;
  getConnectionStatus: () => Promise<{ connected: boolean }>;
  requestSignedMessage: (params: { message: string }) => Promise<any>;
  signPsbt: (tx: any) => Promise<any>;
  signRequest?: (params: Record<string, unknown>) => Promise<any>;
  getAddress?: () => Promise<string>;
  getCurrentAddress?: () => Promise<{ address: string }>;
};

const getInjectedMyDoge = (): InjectedMyDogeProvider | null => {
  return getInjectedMyDogeProvider() as InjectedMyDogeProvider | null;
};

export class MyDogeAdapter implements WalletAdapter {
  readonly id = 'mydoge';
  readonly name = 'MyDoge';
  readonly icon = '🐕';
  readonly supportedChains = ['DOGE'];

  private eventHandlers: { [event: string]: ((data?: any) => void)[] } = {};
  private currentAddress: string | null = null;

  async connect(): Promise<WalletConnection> {
    try {
      // Check if MyDoge extension is available
      const provider = getInjectedMyDoge();
      if (!provider) {
        throw new Error('MyDoge wallet extension not found. Please install it first.');
      }

      const result = await provider.connect();
      if (!(result.connected || result.approved)) {
        throw new Error('Failed to connect to MyDoge wallet');
      }

      const address = await this.getAddress();
      this.currentAddress = address;

      // Emit connect event
      this.emit('connect', { address });

      return {
        address,
        connected: true
      };
    } catch (error) {
      console.error('MyDoge connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const provider = getInjectedMyDoge();
      if (provider?.disconnect) {
        await provider.disconnect();
      }

      this.currentAddress = null;
      localStorage.removeItem('dogeDropSession');

      this.emit('disconnect');
    } catch (error) {
      console.error('MyDoge disconnect failed:', error);
      throw error;
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      const provider = getInjectedMyDoge();
      if (!provider) {
        return false;
      }

      const status = await provider.getConnectionStatus();
      return status?.connected || false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('not connected') ||
        message.includes('MyDoge is not connected') ||
        message.includes('not connected to this website')
      ) {
        return false;
      }
      console.error('MyDoge connection check failed:', error);
      return false;
    }
  }

  async signMessage(message: string): Promise<string> {
    try {
      const provider = getInjectedMyDoge();
      if (!provider) {
        throw new Error('MyDoge wallet extension not found');
      }

      const result = typeof provider.requestSignedMessage === 'function'
        ? await provider.requestSignedMessage({ message })
        : provider.signRequest
          ? await provider.signRequest({ message })
          : (() => { throw new Error('MyDoge wallet extension does not expose a message signing method'); })();
      return result.signature || result.signedMessage || result;
    } catch (error) {
      console.error('MyDoge sign message failed:', error);
      throw error;
    }
  }

  async signTransaction(tx: any): Promise<string> {
    try {
      const provider = getInjectedMyDoge();
      if (!provider) {
        throw new Error('MyDoge wallet extension not found');
      }

      const result = typeof provider.signPsbt === 'function'
        ? await provider.signPsbt(tx)
        : provider.signRequest
          ? await provider.signRequest(tx)
          : (() => { throw new Error('MyDoge wallet extension does not expose a PSDT signing method'); })();
      if (typeof result === 'string') {
        return result;
      }
      return result.signedPsbt || result.signedTx || result.signedRawTx || result.txHex || result;
    } catch (error) {
      console.error('MyDoge sign transaction failed:', error);
      throw error;
    }
  }

  async getAddress(): Promise<string> {
    try {
      if (this.currentAddress) {
        return this.currentAddress;
      }

      const provider = getInjectedMyDoge();
      if (!provider) {
        throw new Error('MyDoge wallet extension not found');
      }

      let address: string | null = null;
      if (provider.getAddress) {
        address = await provider.getAddress();
      } else if (provider.getCurrentAddress) {
        const current = await provider.getCurrentAddress();
        address = current.address;
      }

      // If provider methods didn't work, try localStorage fallback
      if (!address) {
        const storedAddress = localStorage.getItem('mydoge_address');
        if (storedAddress) {
          address = storedAddress;
        }
      }

      if (!address) {
        throw new Error('Unable to resolve MyDoge address');
      }
      this.currentAddress = address;
      return address;
    } catch (error) {
      console.error('MyDoge get address failed:', error);
      throw error;
    }
  }

  async getBalance(): Promise<string> {
    try {
      const address = await this.getAddress();
      // MyDoge doesn't have a direct balance API, we'd need to use external APIs
      // For now, return '0' as placeholder
      return '0';
    } catch (error) {
      console.error('MyDoge get balance failed:', error);
      throw error;
    }
  }

  async getDRC20Tokens(): Promise<DRC20Token[]> {
    try {
      const address = await this.getAddress();
      return await walletDataApi.fetchDRC20Tokens(address);
    } catch (error) {
      console.error('MyDoge get DRC20 tokens failed:', error);
      throw error;
    }
  }

  async getInscriptions(): Promise<WalletInscription[]> {
    try {
      const address = await this.getAddress();
      return await walletDataApi.fetchInscriptions(address);
    } catch (error) {
      console.error('MyDoge get inscriptions failed:', error);
      throw error;
    }
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
