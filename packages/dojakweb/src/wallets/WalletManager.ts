import { WalletAdapter, WalletConfig, type WalletConnection } from './types';
import { MyDogeAdapter } from './MyDogeAdapter';
import { DojakAdapter } from './DojakAdapter';
import { SpookyDogeAdapter } from './SpookyDogeAdapter';


export class WalletManager {
  private adapters: Map<string, WalletAdapter> = new Map();
  private configs: WalletConfig[] = [];
  private currentWallet: WalletAdapter | null = null;

  constructor() {
    this.registerWallet({
      id: 'spookydoge',
      name: 'Spooky Doge',
      adapter: SpookyDogeAdapter,
      enabled: true,
      priority: 11
    });

    this.registerWallet({
      id: 'mydoge',
      name: 'MyDoge',
      adapter: MyDogeAdapter,
      enabled: true,
      priority: 10
    });

    this.registerWallet({
      id: 'dojak',
      name: 'Dojak',
      adapter: DojakAdapter,
      enabled: true,
      priority: 9
    });
  }

  /**
   * Register a new wallet adapter
   */
  registerWallet(config: WalletConfig): void {
    if (!config.enabled) return;

    const adapter = new config.adapter();
    this.adapters.set(config.id, adapter);
    this.configs = this.configs.filter((existing) => existing.id !== config.id);
    this.configs.push(config);

    // Sort by priority (highest first)
    this.configs.sort((a, b) => b.priority - a.priority);

    console.log(`✅ Registered wallet: ${config.name} (${config.id})`);
  }

  /**
   * Get all available wallet adapters
   */
  getAvailableWallets(): WalletAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get wallet adapter by ID
   */
  getWallet(id: string): WalletAdapter | null {
    return this.adapters.get(id) || null;
  }

  /**
   * Get the preferred/default wallet
   */
  getPreferredWallet(): WalletAdapter | null {
    const preferredConfig = this.configs.find(config => config.enabled);
    return preferredConfig ? this.adapters.get(preferredConfig.id) || null : null;
  }

  /**
   * Set the currently active wallet
   */
  setCurrentWallet(wallet: WalletAdapter | null): void {
    this.currentWallet = wallet;
  }

  /**
   * Get the currently active wallet
   */
  getCurrentWallet(): WalletAdapter | null {
    return this.currentWallet;
  }

  /**
   * Check if any wallet is connected
   */
  async isAnyWalletConnected(): Promise<boolean> {
    for (const adapter of this.adapters.values()) {
      if (await adapter.isConnected()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the first connected wallet
   */
  async getConnectedWallet(): Promise<WalletAdapter | null> {
    for (const adapter of this.adapters.values()) {
      if (await adapter.isConnected()) {
        return adapter;
      }
    }
    return null;
  }

  /** Connect by registered wallet id (e.g. `mydoge`, `dojak`, `spookydoge`). */
  async connect(walletId: string): Promise<WalletConnection> {
    const adapter = this.getWallet(walletId);
    if (!adapter) {
      throw new Error(`Unknown wallet: ${walletId}`);
    }
    const result = await adapter.connect();
    this.setCurrentWallet(adapter);
    return result;
  }

  /**
   * Restore session for all wallets
   */
  async restoreSessions(): Promise<void> {
    const sessionPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        const connected = await adapter.isConnected();
        if (connected) {
          const address = await adapter.getAddress();
          console.log(`✅ Restored ${adapter.name} session: ${address}`);
          this.setCurrentWallet(adapter);
        }
      } catch (error) {
        console.warn(`Failed to restore ${adapter.name} session:`, error);
      }
    });

    await Promise.allSettled(sessionPromises);
  }
}

// Singleton instance
export const walletManager = new WalletManager();
