/**
 * Dojak Wallet - Dogecoin Native Keyring Service
 * 
 * A complete keyring service built for Dogecoin, not patched Bitcoin code.
 * Provides the same interface as @unisat/keyring-service but with native
 * Dogecoin support using bitcore-lib-doge.
 */

import { EventEmitter } from 'events';
import * as bip39 from 'bip39';
import { ObservableStore } from '@metamask/obs-store';
import * as bitcoin from 'bitcoinjs-lib';
import { AddressType } from '@unisat/wallet-types';

import { DogecoinHdKeyring } from './dogecoin-hd-keyring';
import { DogecoinSimpleKeyring } from './dogecoin-simple-keyring';
import {
  KeyringInterface,
  SerializedKeyring,
  ToSignInput,
  DogecoinNetworkType,
  KEYRING_TYPE,
} from './types';
import { dogecoinMainnet, dogecoinTestnet } from '@/shared/lib/dogecoin-network';

// Storage adapter interface
export interface StorageAdapter {
  init(): Promise<void>;
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Memory storage adapter for development/testing
export class MemoryStorageAdapter implements StorageAdapter {
  private store: Map<string, any> = new Map();

  async init(): Promise<void> {}
  async get(key: string): Promise<any> {
    return this.store.get(key);
  }
  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
  async clear(): Promise<void> {
    this.store.clear();
  }
}

// Memory store state
interface MemStoreState {
  isUnlocked: boolean;
  keyringTypes: string[];
  keyrings: DisplayedKeyring[];
  preMnemonics: string;
  addressTypes: AddressType[];
}

// Displayed keyring interface
export interface DisplayedKeyring {
  type: string;
  accounts: {
    pubkey: string;
    brandName: string;
    type?: string;
    keyring?: any;
    alianName?: string;
  }[];
  keyring: {
    accounts: string[];
    type: string;
    hdPath?: string;
  };
  addressType: AddressType;
  index: number;
}

// Encryptor interface
interface Encryptor {
  encrypt(password: string, data: any): Promise<string>;
  decrypt(password: string, encryptedData: string): Promise<any>;
}

// Default browser encryptor using Web Crypto API
class BrowserEncryptor implements Encryptor {
  async encrypt(password: string, data: any): Promise<string> {
    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const dataBuffer = encoder.encode(dataStr);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );

    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(password: string, encryptedData: string): Promise<any> {
    const encoder = new TextEncoder();
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }
}

// Configuration interface
export interface DogecoinKeyringServiceConfig {
  storage: StorageAdapter;
  logger?: any;
  encryptor?: Encryptor;
  t?: (key: string) => string;
  eventBus?: any;
  network?: DogecoinNetworkType;
}

/**
 * DogecoinKeyringService - Native Dogecoin keyring management
 * 
 * Provides complete wallet management for Dogecoin with proper
 * address derivation, WIF encoding, and message signing.
 */
export class DogecoinKeyringService extends EventEmitter {
  private storage: StorageAdapter;
  private logger: any;
  private encryptor: Encryptor;
  private t: (key: string) => string;
  private eventBus: any;
  private networkType: DogecoinNetworkType;

  // Core state
  public keyrings: KeyringInterface[] = [];
  public addressTypes: AddressType[] = [];
  public password: string | null = null;
  private isUnlocking = false;

  // Observable stores
  public store!: ObservableStore<any>;
  public memStore: ObservableStore<MemStoreState>;

  // Cache
  private cachedDisplayedKeyring: DisplayedKeyring[] | null = null;

  constructor(config: DogecoinKeyringServiceConfig) {
    super();

    this.storage = config.storage;
    this.logger = config.logger || console;
    this.encryptor = config.encryptor || new BrowserEncryptor();
    this.t = config.t || ((key: string) => key);
    this.eventBus = config.eventBus;
    this.networkType = config.network || 'mainnet';

    // Initialize memory store
    this.memStore = new ObservableStore<MemStoreState>({
      isUnlocked: false,
      keyringTypes: [KEYRING_TYPE.HdKeyring, KEYRING_TYPE.SimpleKeyring],
      keyrings: [],
      preMnemonics: '',
      addressTypes: [],
    });

    this.keyrings = [];
    this.addressTypes = [];
  }

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    await this.storage.init();

    if (!this.store) {
      const persistedState = await this.storage.get('keyring') || {};
      this.store = new ObservableStore(persistedState);
    }

    this.logger.debug('[DogecoinKeyringService] Initialized');
  }

  /**
   * Get the Dogecoin network configuration
   */
  getNetwork(): bitcoin.Network {
    return this.networkType === 'testnet' ? dogecoinTestnet : dogecoinMainnet;
  }

  /**
   * Set network type
   */
  setNetworkType(network: DogecoinNetworkType): void {
    this.networkType = network;
    // Update all keyrings
    for (const keyring of this.keyrings) {
      keyring.setNetwork(network);
    }
  }

  /**
   * Boot the wallet with a password
   */
  async boot(password: string): Promise<void> {
    this.password = password;
    const encryptBooted = await this.encryptor.encrypt(password, 'true');

    if (!this.store) {
      this.store = new ObservableStore({
        isUnlocked: false,
        keyrings: [],
        keyringTypes: [],
        preMnemonics: '',
        addressTypes: [],
      });
    }

    this.store.updateState({ booted: encryptBooted });
    await this.storage.set('keyring', this.store.getState());
    this.setUnlocked();
    this.fullUpdate();
  }

  isBooted(): boolean {
    return !!this.store?.getState()?.booted;
  }

  hasVault(): boolean {
    return !!this.store?.getState()?.vault;
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string): Promise<boolean> {
    const encryptedBooted = this.store.getState().booted;
    if (!encryptedBooted) {
      throw new Error(this.t('cannot_unlock_without_a_previous_vault'));
    }
    try {
      await this.encryptor.decrypt(password, encryptedBooted);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Submit password to unlock
   */
  async submitPassword(password: string): Promise<MemStoreState> {
    if (this.isUnlocking) {
      throw new Error(this.t('unlock_already_in_progress'));
    }

    this.isUnlocking = true;

    try {
      const isValid = await this.verifyPassword(password);
      if (!isValid) {
        throw new Error(this.t('invalid_password'));
      }

      this.password = password;
      await this.unlockKeyrings(password);
      this.setUnlocked();
      return this.fullUpdate();
    } finally {
      this.isUnlocking = false;
    }
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (this.isUnlocking) {
      throw new Error(this.t('change_password_already_in_progress'));
    }

    this.isUnlocking = true;

    try {
      const isValid = await this.verifyPassword(oldPassword);
      if (!isValid) {
        throw new Error(this.t('invalid_password'));
      }

      await this.unlockKeyrings(oldPassword);
      this.password = newPassword;

      const encryptBooted = await this.encryptor.encrypt(newPassword, 'true');
      this.store.updateState({ booted: encryptBooted });

      // Re-encrypt pre-mnemonics if present
      if (this.memStore.getState().preMnemonics) {
        const mnemonic = await this.encryptor.decrypt(
          oldPassword,
          this.memStore.getState().preMnemonics
        );
        const preMnemonics = await this.encryptor.encrypt(newPassword, mnemonic);
        this.memStore.updateState({ preMnemonics });
      }

      await this.persistAllKeyrings();
      await this._updateMemStoreKeyrings();
      await this.fullUpdate();
    } finally {
      this.isUnlocking = false;
    }
  }

  /**
   * Lock the wallet
   */
  async setLocked(): Promise<MemStoreState> {
    this.password = null;
    this.memStore.updateState({ isUnlocked: false });

    this.keyrings = [];
    this.addressTypes = [];
    this.cachedDisplayedKeyring = null;

    await this._updateMemStoreKeyrings();
    this.emit('lock');
    return this.fullUpdate();
  }

  /**
   * Generate a new mnemonic
   */
  generateMnemonic(): string {
    return bip39.generateMnemonic(128);
  }

  /**
   * Generate and encrypt pre-mnemonic for wallet creation flow
   */
  async generatePreMnemonic(): Promise<string> {
    if (!this.password) {
      throw new Error(this.t('you_need_to_unlock_wallet_first'));
    }

    const mnemonic = this.generateMnemonic();
    const preMnemonics = await this.encryptor.encrypt(this.password, mnemonic);
    this.memStore.updateState({ preMnemonics });

    return mnemonic;
  }

  /**
   * Get pre-mnemonic
   */
  async getPreMnemonics(): Promise<string> {
    const preMnemonics = this.memStore.getState().preMnemonics;
    if (!preMnemonics) return '';

    if (!this.password) {
      throw new Error(this.t('you_need_to_unlock_wallet_first'));
    }

    return await this.encryptor.decrypt(this.password, preMnemonics);
  }

  /**
   * Remove pre-mnemonic
   */
  removePreMnemonics(): void {
    this.memStore.updateState({ preMnemonics: '' });
  }

  /**
   * Create a keyring from mnemonic
   */
  async createKeyringWithMnemonics(
    mnemonic: string,
    hdPath: string,
    passphrase: string,
    addressType: AddressType,
    accountCount: number
  ): Promise<KeyringInterface> {
    if (accountCount < 1) {
      throw new Error(this.t('account_count_must_be_greater_than_0'));
    }

    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error(this.t('mnemonic_phrase_is_invalid'));
    }

    const activeIndexes: number[] = [];
    for (let i = 0; i < accountCount; i++) {
      activeIndexes.push(i);
    }

    const keyring = new DogecoinHdKeyring({
      type: KEYRING_TYPE.HdKeyring,
      mnemonic,
      hdPath,
      passphrase,
      activeIndexes,
    });
    keyring.setNetwork(this.networkType);

    return this.addKeyring(keyring, addressType);
  }

  /**
   * Create a temporary keyring (not persisted)
   */
  createTmpKeyring(type: string, opts: any): KeyringInterface {
    let keyring: KeyringInterface;

    if (type === KEYRING_TYPE.HdKeyring || type === 'HD Key Tree') {
      keyring = new DogecoinHdKeyring(opts);
    } else if (type === KEYRING_TYPE.SimpleKeyring || type === 'Simple Key Pair') {
      const privateKeys = Array.isArray(opts) ? opts : opts?.privateKeys || [];
      keyring = new DogecoinSimpleKeyring(privateKeys);
    } else {
      throw new Error(`Unknown keyring type: ${type}`);
    }

    keyring.setNetwork(this.networkType);
    return keyring;
  }

  /**
   * Import a private key
   */
  async importPrivateKey(privateKey: string, addressType: AddressType): Promise<KeyringInterface> {
    const keyring = new DogecoinSimpleKeyring([privateKey]);
    keyring.setNetwork(this.networkType);
    return this.addKeyring(keyring, addressType);
  }

  /**
   * Add a keyring to the service
   */
  async addKeyring(keyring: KeyringInterface, addressType: AddressType): Promise<KeyringInterface> {
    const accounts = await keyring.getAccounts();
    await this.checkForDuplicate(keyring.type, accounts);

    this.keyrings.push(keyring);
    this.addressTypes.push(addressType);
    this.cachedDisplayedKeyring = null;

    await this.persistAllKeyrings();
    await this._updateMemStoreKeyrings();
    await this.fullUpdate();

    return keyring;
  }

  /**
   * Remove a keyring
   */
  async removeKeyring(keyringIndex: number): Promise<void> {
    // Create an empty placeholder keyring
    const emptyKeyring: KeyringInterface = {
      type: KEYRING_TYPE.Empty,
      serialize: async () => ({ type: 'Empty' as any, mnemonic: '', hdPath: '', passphrase: '', activeIndexes: [] }),
      deserialize: async () => {},
      getAccounts: async () => [],
      addAccounts: async () => [],
      signTransaction: async (psbt) => psbt,
      signMessage: async () => '',
      verifyMessage: async () => false,
      exportAccount: async () => '',
      setNetwork: () => {},
    };

    this.keyrings[keyringIndex] = emptyKeyring;
    this.cachedDisplayedKeyring = null;

    await this.persistAllKeyrings();
    await this._updateMemStoreKeyrings();
    await this.fullUpdate();
  }

  /**
   * Add a new account to a keyring
   */
  async addNewAccount(keyring: KeyringInterface): Promise<string[]> {
    const accounts = await keyring.addAccounts(1);
    this.cachedDisplayedKeyring = null;

    accounts.forEach(account => {
      this.emit('newAccount', account);
    });

    await this.persistAllKeyrings();
    await this._updateMemStoreKeyrings();
    await this.fullUpdate();

    return accounts;
  }

  /**
   * Change address type for a keyring
   */
  async changeAddressType(keyringIndex: number, addressType: AddressType): Promise<KeyringInterface> {
    const keyring = this.keyrings[keyringIndex];
    if (!keyring) {
      throw new Error('Keyring not found');
    }

    this.addressTypes[keyringIndex] = addressType;
    this.cachedDisplayedKeyring = null;

    await this.persistAllKeyrings();
    await this._updateMemStoreKeyrings();
    await this.fullUpdate();

    return keyring;
  }

  /**
   * Get keyring for a specific account
   */
  async getKeyringForAccount(publicKey: string, type?: string): Promise<KeyringInterface> {
    const keyrings = type 
      ? this.keyrings.filter(k => k.type === type)
      : this.keyrings;

    for (const keyring of keyrings) {
      const accounts = await keyring.getAccounts();
      if (accounts.includes(publicKey)) {
        return keyring;
      }
    }

    throw new Error(this.t('no_keyring_found_for_the_requested_account'));
  }

  /**
   * Get keyring by type
   */
  getKeyringByType(type: string): KeyringInterface | undefined {
    return this.keyrings.find(k => k.type === type);
  }

  /**
   * Get all accounts
   */
  async getAccounts(): Promise<string[]> {
    let accounts: string[] = [];

    for (const keyring of this.keyrings) {
      const keyringAccounts = await keyring.getAccounts();
      accounts = accounts.concat(keyringAccounts);
    }

    return accounts;
  }

  /**
   * Export account private key
   */
  async exportAccount(publicKey: string): Promise<string> {
    const keyring = await this.getKeyringForAccount(publicKey);
    return keyring.exportAccount(publicKey);
  }

  /**
   * Sign a transaction
   */
  async signTransaction(keyring: KeyringInterface, psbt: bitcoin.Psbt, inputs: ToSignInput[]): Promise<bitcoin.Psbt> {
    return keyring.signTransaction(psbt, inputs);
  }

  /**
   * Sign a message
   */
  async signMessage(publicKey: string, type: string, message: string): Promise<string> {
    const keyring = await this.getKeyringForAccount(publicKey, type);
    return keyring.signMessage(publicKey, message);
  }

  /**
   * Verify a message
   */
  async verifyMessage(address: string, message: string, signature: string): Promise<boolean> {
    // Try each keyring until one succeeds
    for (const keyring of this.keyrings) {
      try {
        const result = await keyring.verifyMessage(address, message, signature);
        if (result) return true;
      } catch {
        // Continue to next keyring
      }
    }
    return false;
  }

  /**
   * Display a keyring for UI
   */
  async displayForKeyring(
    keyring: KeyringInterface,
    addressType: AddressType,
    index: number
  ): Promise<DisplayedKeyring> {
    const accounts = await keyring.getAccounts();
    const allAccounts = accounts.map(pubkey => ({
      pubkey,
      brandName: keyring.type,
    }));

    const serialized = await keyring.serialize();

    return {
      type: keyring.type,
      accounts: allAccounts,
      keyring: {
        accounts,
        type: keyring.type,
        hdPath: (serialized as any).hdPath,
      },
      addressType,
      index,
    };
  }

  /**
   * Get all displayed keyrings
   */
  async getAllDisplayedKeyrings(resetCache?: boolean): Promise<DisplayedKeyring[]> {
    if (resetCache || !this.cachedDisplayedKeyring) {
      this.cachedDisplayedKeyring = await Promise.all(
        this.keyrings.map((keyring, index) =>
          this.displayForKeyring(keyring, this.addressTypes[index] || AddressType.P2PKH, index)
        )
      );
    }
    return this.cachedDisplayedKeyring;
  }

  /**
   * Clear all keyrings
   */
  async clearKeyrings(): Promise<void> {
    this.keyrings = [];
    this.addressTypes = [];
    this.cachedDisplayedKeyring = null;
    this.memStore.updateState({ keyrings: [] });
  }

  /**
   * Check for duplicate accounts
   */
  private async checkForDuplicate(type: string, newAccounts: string[]): Promise<string[]> {
    const keyrings = this.keyrings.filter(k => k.type === type);
    const existingAccounts: string[] = [];

    for (const keyring of keyrings) {
      const accounts = await keyring.getAccounts();
      existingAccounts.push(...accounts);
    }

    const isDuplicate = newAccounts.some(account => existingAccounts.includes(account));

    if (isDuplicate) {
      throw new Error(this.t('wallet_existed'));
    }

    return newAccounts;
  }

  /**
   * Persist all keyrings to storage
   */
  private async persistAllKeyrings(): Promise<boolean> {
    if (!this.password) {
      throw new Error(this.t('password_is_not_set'));
    }

    const serializedKeyrings = await Promise.all(
      this.keyrings.map(async (keyring, index) => ({
        type: keyring.type,
        data: await keyring.serialize(),
        addressType: this.addressTypes[index],
      }))
    );

    const encryptedVault = await this.encryptor.encrypt(this.password, serializedKeyrings);
    this.store.updateState({ vault: encryptedVault });
    await this.storage.set('keyring', this.store.getState());

    return true;
  }

  /**
   * Unlock keyrings from encrypted storage
   */
  private async unlockKeyrings(password: string): Promise<KeyringInterface[]> {
    const encryptedVault = this.store.getState().vault;
    if (!encryptedVault) {
      return [];
    }

    await this.clearKeyrings();
    const vault = await this.encryptor.decrypt(password, encryptedVault);

    for (const serialized of vault) {
      const keyring = await this.restoreKeyring(serialized);
      this.keyrings.push(keyring);
      this.addressTypes.push(serialized.addressType || AddressType.P2PKH);
    }

    this.cachedDisplayedKeyring = null;
    await this._updateMemStoreKeyrings();

    return this.keyrings;
  }

  /**
   * Restore a keyring from serialized data
   */
  private async restoreKeyring(serialized: { type: string; data: any }): Promise<KeyringInterface> {
    const { type, data } = serialized;

    let keyring: KeyringInterface;

    if (type === KEYRING_TYPE.HdKeyring || type === 'HD Key Tree') {
      keyring = new DogecoinHdKeyring();
      await keyring.deserialize(data);
    } else if (type === KEYRING_TYPE.SimpleKeyring || type === 'Simple Key Pair') {
      keyring = new DogecoinSimpleKeyring();
      await keyring.deserialize(data);
    } else if (type === KEYRING_TYPE.Empty || type === 'Empty') {
      // Empty keyring placeholder
      keyring = {
        type: KEYRING_TYPE.Empty,
        serialize: async () => ({ type: 'Empty' as any, mnemonic: '', hdPath: '', passphrase: '', activeIndexes: [] }),
        deserialize: async () => {},
        getAccounts: async () => [],
        addAccounts: async () => [],
        signTransaction: async (psbt) => psbt,
        signMessage: async () => '',
        verifyMessage: async () => false,
        exportAccount: async () => '',
        setNetwork: () => {},
      };
    } else {
      throw new Error(`Unknown keyring type: ${type}`);
    }

    keyring.setNetwork(this.networkType);
    return keyring;
  }

  /**
   * Update memory store keyrings
   */
  private async _updateMemStoreKeyrings(): Promise<void> {
    const keyrings = await Promise.all(
      this.keyrings.map((keyring, index) =>
        this.displayForKeyring(keyring, this.addressTypes[index] || AddressType.P2PKH, index)
      )
    );
    this.memStore.updateState({ keyrings });
  }

  /**
   * Set unlocked state
   */
  private setUnlocked(): void {
    this.memStore.updateState({ isUnlocked: true });
    this.emit('unlock');
    if (this.eventBus) {
      this.eventBus.emit('broadcastToUI', {
        method: 'unlock',
        params: {},
      });
    }
  }

  /**
   * Full update - emit update event
   */
  fullUpdate(): MemStoreState {
    this.emit('update', this.memStore.getState());
    return this.memStore.getState();
  }
}

export default DogecoinKeyringService;

