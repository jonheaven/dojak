/**
 * Dojak Wallet - Keyring Service
 *
 * This is the main keyring service export. It uses our native Dogecoin
 * keyring implementation instead of the patched @unisat/keyring-service.
 *
 * Why native Dogecoin keyrings?
 * - The @unisat/keyring-service hardcodes Bitcoin network parameters
 * - It ignores the network config we pass to it
 * - This causes incorrect address derivation and WIF encoding
 * - Our native implementation uses bitcore-lib-doge for correct Dogecoin support
 */
import logger from 'loglevel';

import { t } from '@unisat/i18n';

import { DogecoinKeyringService, MemoryStorageAdapter } from './dogecoin-keyrings/dogecoin-keyring-service';
import type { StorageAdapter, DisplayedKeyring } from './dogecoin-keyrings/dogecoin-keyring-service';

// Re-export types for compatibility
export { DogecoinKeyringService, MemoryStorageAdapter };
export type { StorageAdapter, DisplayedKeyring };

/**
 * Chrome Extension Storage Adapter
 * Persists keyring data to Chrome's extension storage
 */
export class ExtensionStorageAdapter implements StorageAdapter {
  private cache: Map<string, any> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Load existing data from Chrome storage
    try {
      const result = await chrome.storage.local.get(['keyring']);
      if (result.keyring) {
        this.cache.set('keyring', result.keyring);
      }
      this.initialized = true;
    } catch (error) {
      // Fallback to memory storage if chrome.storage is not available
      logger.warn('[ExtensionStorageAdapter] Chrome storage not available, using memory');
      this.initialized = true;
    }
  }

  async get(key: string): Promise<any> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Try to get from Chrome storage
    try {
      const result = await chrome.storage.local.get([key]);
      const value = result[key];
      if (value !== undefined) {
        this.cache.set(key, value);
      }
      return value;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: any): Promise<void> {
    this.cache.set(key, value);

    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      logger.warn('[ExtensionStorageAdapter] Failed to persist to Chrome storage:', error);
    }
  }

  async remove(key: string): Promise<void> {
    this.cache.delete(key);

    try {
      await chrome.storage.local.remove(key);
    } catch {
      // Ignore errors
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();

    try {
      await chrome.storage.local.clear();
    } catch {
      // Ignore errors
    }
  }
}

/**
 * KeyringServiceWrapper
 *
 * Main keyring service instance for the Dojak wallet.
 * Uses native Dogecoin keyring implementation.
 */
export class KeyringServiceWrapper extends DogecoinKeyringService {
  constructor() {
    // Determine storage adapter based on environment
    let storage: StorageAdapter;

    try {
      // Check if we're in a Chrome extension environment
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        storage = new ExtensionStorageAdapter();
      } else {
        storage = new MemoryStorageAdapter();
      }
    } catch {
      storage = new MemoryStorageAdapter();
    }

    super({
      storage,
      logger,
      t,
      network: 'mainnet' // Default to Dogecoin mainnet
    });
  }

  /**
   * Override init for extension-specific initialization
   */
  async init(): Promise<void> {
    console.log('[DogecoinKeyringService] Starting initialization...');
    await super.init();
    console.log('[DogecoinKeyringService] Initialization complete');
  }
}

// Export singleton instance
export const keyringService = new KeyringServiceWrapper();
export default keyringService;
