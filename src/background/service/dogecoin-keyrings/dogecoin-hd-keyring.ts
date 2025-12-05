/**
 * Dojak Wallet - Dogecoin HD Keyring
 * Native Dogecoin HD wallet implementation
 *
 * Uses bitcoinjs-lib for address derivation (service worker compatible)
 * and bitcore-lib-doge only for message signing/WIF export (loaded lazily when needed)
 */
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import { EventEmitter } from 'events';
import * as ecc from 'tiny-secp256k1';

import { dogecoinMainnet, dogecoinTestnet } from '@/shared/lib/dogecoin-network';

import { KeyringInterface, SerializedHdKeyring, ToSignInput, DogecoinNetworkType, KEYRING_TYPE } from './types';

// Initialize bitcoinjs-lib with the ECC library (required for v6+)
// This must happen before any payments functions are used
bitcoin.initEccLib(ecc);

// Initialize ECPair with secp256k1
const ECPair = ECPairFactory(ecc);

// Lazy load hdkey (CommonJS module needs special handling)
let hdkeyModule: any = null;

async function getHdKey(): Promise<any> {
  if (!hdkeyModule) {
    const mod = await import('hdkey');
    // Handle both ESM default export and CommonJS module.exports
    // Match the exact pattern from dogemarketplace
    hdkeyModule = (mod as any).default || (mod as any);

    // Verify the module loaded correctly
    if (!hdkeyModule || typeof hdkeyModule.fromMasterSeed !== 'function') {
      console.error('[DogecoinHdKeyring] hdkey module structure:', mod);
      throw new Error('Failed to load hdkey module correctly');
    }
  }
  return hdkeyModule;
}

// Lazy load bitcore-lib-doge ONLY for message signing and WIF export
// (it requires DOM access so can't be used for address derivation in service workers)
let bitcoreLibDoge: any = null;

async function getBitcoreLibDoge() {
  if (!bitcoreLibDoge) {
    bitcoreLibDoge = await import('bitcore-lib-doge');
    bitcoreLibDoge = bitcoreLibDoge.default || bitcoreLibDoge;
  }
  return bitcoreLibDoge;
}

// Default Dogecoin HD path (BIP44 coin type 3)
const DEFAULT_HD_PATH = "m/44'/3'/0'/0";

export class DogecoinHdKeyring extends EventEmitter implements KeyringInterface {
  static type = KEYRING_TYPE.HdKeyring;
  type = KEYRING_TYPE.HdKeyring;

  // State
  private mnemonic: string = '';
  private passphrase: string = '';
  private hdPath: string = DEFAULT_HD_PATH;
  private hdWallet: any = null;
  private root: any = null;
  private activeIndexes: number[] = [];
  private networkType: DogecoinNetworkType = 'mainnet';

  // Cache: index -> [publicKeyHex, ECPair, address]
  private _indexCache: Map<number, { publicKey: string; keyPair: ECPairInterface; address: string }> = new Map();

  constructor() {
    super();
    // Note: Don't deserialize in constructor - it's async!
    // Caller must explicitly call: await keyring.deserialize(opts)
  }

  /**
   * Set the network type (mainnet or testnet)
   */
  setNetwork(network: DogecoinNetworkType): void {
    this.networkType = network;
    // Clear cache when network changes
    this._indexCache.clear();
  }

  /**
   * Get the current Dogecoin network configuration
   */
  private getNetwork(): bitcoin.Network {
    return this.networkType === 'testnet' ? dogecoinTestnet : dogecoinMainnet;
  }

  /**
   * Serialize the keyring for storage
   */
  async serialize(): Promise<SerializedHdKeyring> {
    return {
      type: KEYRING_TYPE.HdKeyring,
      mnemonic: this.mnemonic,
      hdPath: this.hdPath,
      passphrase: this.passphrase,
      activeIndexes: [...this.activeIndexes]
    };
  }

  /**
   * Deserialize and restore the keyring from storage
   */
  async deserialize(opts: Partial<SerializedHdKeyring>): Promise<void> {
    console.log('[DogecoinHdKeyring] deserialize called, opts:', {
      hasMnemonic: !!opts.mnemonic,
      hdPath: opts.hdPath,
      activeIndexes: opts.activeIndexes
    });

    if (this.root) {
      throw new Error('Dogecoin HD Keyring: Already initialized');
    }

    this._indexCache.clear();
    this.activeIndexes = [];
    this.mnemonic = '';
    this.hdPath = opts.hdPath || DEFAULT_HD_PATH;
    this.passphrase = opts.passphrase || '';

    if (opts.mnemonic) {
      console.log('[DogecoinHdKeyring] calling initFromMnemonic...');
      await this.initFromMnemonic(opts.mnemonic);
      console.log('[DogecoinHdKeyring] initFromMnemonic completed');
    }

    if (opts.activeIndexes && opts.activeIndexes.length > 0) {
      console.log('[DogecoinHdKeyring] calling activeAccounts with indexes:', opts.activeIndexes);
      await this.activeAccounts(opts.activeIndexes);
      console.log('[DogecoinHdKeyring] activeAccounts completed');
    }

    console.log('[DogecoinHdKeyring] deserialize completed');
  }

  /**
   * Initialize the keyring from a mnemonic phrase
   */
  async initFromMnemonic(mnemonic: string): Promise<void> {
    console.log('[DogecoinHdKeyring] initFromMnemonic called');

    if (this.root) {
      throw new Error('Dogecoin HD Keyring: Already initialized');
    }

    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Dogecoin HD Keyring: Invalid mnemonic phrase');
    }

    this.mnemonic = mnemonic;
    this._indexCache.clear();

    // Generate seed from mnemonic
    const seed = bip39.mnemonicToSeedSync(mnemonic, this.passphrase);
    console.log('[DogecoinHdKeyring] seed generated, length:', seed.length);

    // Create HD wallet from seed (lazy load hdkey for CommonJS compatibility)
    const HDKey = await getHdKey();
    console.log(
      '[DogecoinHdKeyring] HDKey loaded:',
      typeof HDKey,
      HDKey ? 'has fromMasterSeed: ' + typeof HDKey.fromMasterSeed : 'null'
    );

    this.hdWallet = HDKey.fromMasterSeed(seed);
    console.log('[DogecoinHdKeyring] hdWallet created:', this.hdWallet ? 'OK' : 'null');

    // Derive to the HD path (account level)
    console.log('[DogecoinHdKeyring] deriving path:', this.hdPath);
    this.root = this.hdWallet.derive(this.hdPath);
    console.log('[DogecoinHdKeyring] root derived:', this.root ? 'OK' : 'null');
  }

  /**
   * Change the HD derivation path
   */
  async changeHdPath(hdPath: string): Promise<void> {
    if (!this.mnemonic) {
      throw new Error('Dogecoin HD Keyring: Cannot change path without mnemonic');
    }

    this.hdPath = hdPath;
    this.root = this.hdWallet.derive(this.hdPath);

    // Re-derive accounts with new path
    const indexes = [...this.activeIndexes];
    this._indexCache.clear();
    this.activeIndexes = [];
    await this.activeAccounts(indexes);
  }

  /**
   * Add new accounts to the keyring
   */
  async addAccounts(numberOfAccounts: number = 1): Promise<string[]> {
    const newAccounts: string[] = [];
    let currentIdx = 0;
    let count = numberOfAccounts;

    while (count > 0) {
      if (!this.activeIndexes.includes(currentIdx)) {
        const { publicKey } = await this._deriveAccount(currentIdx);
        this.activeIndexes.push(currentIdx);
        newAccounts.push(publicKey);
        count--;
      }
      currentIdx++;
    }

    return newAccounts;
  }

  /**
   * Activate specific account indexes
   */
  async activeAccounts(indexes: number[]): Promise<string[]> {
    console.log('[DogecoinHdKeyring] activeAccounts called with indexes:', indexes);
    const accounts: string[] = [];

    for (const index of indexes) {
      console.log('[DogecoinHdKeyring] activeAccounts: processing index', index);
      const { publicKey } = await this._deriveAccount(index);
      console.log('[DogecoinHdKeyring] activeAccounts: got publicKey for index', index);
      if (!this.activeIndexes.includes(index)) {
        this.activeIndexes.push(index);
      }
      accounts.push(publicKey);
    }

    console.log('[DogecoinHdKeyring] activeAccounts completed, accounts:', accounts.length);
    return accounts;
  }

  /**
   * Get all active account public keys
   */
  async getAccounts(): Promise<string[]> {
    const accounts: string[] = [];

    for (const index of this.activeIndexes) {
      const { publicKey } = await this._deriveAccount(index);
      accounts.push(publicKey);
    }

    return accounts;
  }

  /**
   * Get the Dogecoin address for a public key
   */
  getAddressFromPublicKey(publicKeyHex: string): string {
    // Check cache first - all derived addresses should be cached
    for (const entry of this._indexCache.values()) {
      if (entry.publicKey === publicKeyHex) {
        return entry.address;
      }
    }

    // Fallback to bitcoinjs-lib for non-cached lookups (with ECC initialized)
    const network = this.getNetwork();
    const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');

    const { address } = bitcoin.payments.p2pkh({
      pubkey: publicKeyBuffer,
      network
    });

    if (!address) {
      throw new Error('Failed to derive address from public key');
    }

    return address;
  }

  /**
   * Get account by HD path and index (for custom derivation)
   */
  async getAccountByHdPath(hdPath: string, index: number): Promise<string> {
    if (!this.mnemonic) {
      throw new Error('Dogecoin HD Keyring: Not initialized');
    }

    const root = this.hdWallet.derive(hdPath);
    const child = root.deriveChild(index);

    const keyPair = ECPair.fromPrivateKey(child.privateKey, {
      network: this.getNetwork()
    });

    return keyPair.publicKey.toString('hex');
  }

  /**
   * Export private key for an account (as WIF)
   */
  async exportAccount(publicKeyHex: string): Promise<string> {
    const entry = this._findByPublicKey(publicKeyHex);
    if (!entry) {
      throw new Error('Dogecoin HD Keyring: Account not found');
    }

    // Use bitcore-lib-doge for correct WIF encoding
    const bitcore = await getBitcoreLibDoge();
    const { PrivateKey, Networks } = bitcore;

    Networks.defaultNetwork = this.networkType === 'testnet' ? Networks.testnet : Networks.mainnet;

    const privKey = new PrivateKey(entry.keyPair.privateKey!.toString('hex'));
    return privKey.toWIF();
  }

  /**
   * Sign a PSBT transaction
   */
  async signTransaction(psbt: bitcoin.Psbt, inputs: ToSignInput[]): Promise<bitcoin.Psbt> {
    for (const input of inputs) {
      const entry = this._findByPublicKey(input.publicKey);
      if (!entry) {
        throw new Error(`Dogecoin HD Keyring: No key for input ${input.index}`);
      }

      psbt.signInput(input.index, entry.keyPair, input.sighashTypes);
    }

    return psbt;
  }

  /**
   * Sign a message with a specific account
   */
  async signMessage(publicKeyHex: string, message: string): Promise<string> {
    const entry = this._findByPublicKey(publicKeyHex);
    if (!entry) {
      throw new Error('Dogecoin HD Keyring: Account not found');
    }

    // Use bitcore-lib-doge for correct message signing
    const bitcore = await getBitcoreLibDoge();
    const { PrivateKey, Message, Networks } = bitcore;

    Networks.defaultNetwork = this.networkType === 'testnet' ? Networks.testnet : Networks.mainnet;

    const privKey = new PrivateKey(entry.keyPair.privateKey!.toString('hex'));
    const messageObj = new Message(message);

    return messageObj.sign(privKey);
  }

  /**
   * Verify a signed message
   */
  async verifyMessage(address: string, message: string, signature: string): Promise<boolean> {
    try {
      const bitcore = await getBitcoreLibDoge();
      const { Message, Networks } = bitcore;

      Networks.defaultNetwork = this.networkType === 'testnet' ? Networks.testnet : Networks.mainnet;

      const messageObj = new Message(message);
      return messageObj.verify(address, signature);
    } catch {
      return false;
    }
  }

  /**
   * Get index for a public key
   */
  getIndexByPublicKey(publicKeyHex: string): number | null {
    for (const [index, entry] of this._indexCache.entries()) {
      if (entry.publicKey === publicKeyHex) {
        return index;
      }
    }
    return null;
  }

  /**
   * Derive an account at a specific index
   * Uses bitcoinjs-lib for address derivation (service worker compatible)
   */
  private async _deriveAccount(
    index: number
  ): Promise<{ publicKey: string; keyPair: ECPairInterface; address: string }> {
    console.log('[DogecoinHdKeyring] _deriveAccount called, index:', index);

    // Check cache first
    const cached = this._indexCache.get(index);
    if (cached) {
      console.log('[DogecoinHdKeyring] returning cached entry');
      return cached;
    }

    if (!this.root) {
      throw new Error('Dogecoin HD Keyring: Not initialized');
    }

    // Derive child key at index
    console.log('[DogecoinHdKeyring] deriving child at index:', index);
    const child = this.root.deriveChild(index);
    console.log('[DogecoinHdKeyring] child derived:', child ? 'OK' : 'null');

    if (!child.privateKey) {
      throw new Error('Failed to derive private key at index ' + index);
    }
    console.log('[DogecoinHdKeyring] privateKey length:', child.privateKey.length);

    const network = this.getNetwork();
    console.log('[DogecoinHdKeyring] network:', network.pubKeyHash);

    // Create ECPair from derived private key
    console.log('[DogecoinHdKeyring] creating ECPair...');
    const keyPair = ECPair.fromPrivateKey(child.privateKey, { network });
    console.log('[DogecoinHdKeyring] ECPair created, publicKey length:', keyPair.publicKey.length);
    const publicKey = keyPair.publicKey.toString('hex');

    // Use bitcoinjs-lib for address derivation (service worker compatible)
    // The ECC library is already initialized at module load time
    console.log('[DogecoinHdKeyring] deriving address with p2pkh...');
    const { address } = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network
    });
    console.log('[DogecoinHdKeyring] address derived:', address);

    if (!address || typeof address !== 'string') {
      throw new Error('Failed to derive address: address is undefined or not a string');
    }

    // Cache the result
    const entry = { publicKey, keyPair, address };
    this._indexCache.set(index, entry);
    console.log('[DogecoinHdKeyring] _deriveAccount completed successfully');

    return entry;
  }

  /**
   * Find cached entry by public key
   */
  private _findByPublicKey(
    publicKeyHex: string
  ): { publicKey: string; keyPair: ECPairInterface; address: string } | null {
    for (const entry of this._indexCache.values()) {
      if (entry.publicKey === publicKeyHex) {
        return entry;
      }
    }
    return null;
  }
}

export default DogecoinHdKeyring;
