/**
 * Dojak Wallet - Dogecoin Simple Keyring
 * Native Dogecoin simple keyring for direct private key management
 * 
 * This is a purpose-built Dogecoin keyring using bitcore-lib-doge
 * for correct WIF encoding and address derivation.
 */

import { EventEmitter } from 'events';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

import {
  KeyringInterface,
  SerializedSimpleKeyring,
  ToSignInput,
  DogecoinNetworkType,
  KEYRING_TYPE,
} from './types';
import { dogecoinMainnet, dogecoinTestnet } from '@/shared/lib/dogecoin-network';

// Initialize ECPair with secp256k1
const ECPair = ECPairFactory(ecc);

// Lazy load bitcore-lib-doge
let bitcoreLibDoge: any = null;

async function getBitcoreLibDoge() {
  if (!bitcoreLibDoge) {
    bitcoreLibDoge = await import('bitcore-lib-doge');
    bitcoreLibDoge = bitcoreLibDoge.default || bitcoreLibDoge;
  }
  return bitcoreLibDoge;
}

interface WalletEntry {
  publicKey: string;
  keyPair: ECPairInterface;
  address: string;
  privateKeyHex: string;
}

export class DogecoinSimpleKeyring extends EventEmitter implements KeyringInterface {
  static type = KEYRING_TYPE.SimpleKeyring;
  type = KEYRING_TYPE.SimpleKeyring;

  private wallets: WalletEntry[] = [];
  private networkType: DogecoinNetworkType = 'mainnet';

  constructor(privateKeys?: string[]) {
    super();
    if (privateKeys && privateKeys.length > 0) {
      this.deserialize({ type: KEYRING_TYPE.SimpleKeyring, privateKeys });
    }
  }

  /**
   * Set the network type (mainnet or testnet)
   */
  setNetwork(network: DogecoinNetworkType): void {
    if (this.networkType !== network) {
      this.networkType = network;
      // Re-derive addresses for new network
      this._refreshAddresses();
    }
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
  async serialize(): Promise<SerializedSimpleKeyring> {
    return {
      type: KEYRING_TYPE.SimpleKeyring,
      privateKeys: this.wallets.map(w => w.privateKeyHex),
    };
  }

  /**
   * Deserialize and restore the keyring from storage
   */
  async deserialize(opts: Partial<SerializedSimpleKeyring>): Promise<void> {
    this.wallets = [];

    if (opts.privateKeys && opts.privateKeys.length > 0) {
      for (const privateKey of opts.privateKeys) {
        await this._addPrivateKey(privateKey);
      }
    }
  }

  /**
   * Add a private key to the keyring
   * Supports: Dogecoin WIF, Bitcoin WIF (converted), or raw hex
   */
  private async _addPrivateKey(privateKey: string): Promise<WalletEntry> {
    const network = this.getNetwork();
    let keyPair: ECPairInterface;
    let privateKeyHex: string;

    // Detect format and parse
    if (this._isDogecoinWIF(privateKey)) {
      // Dogecoin WIF (starts with Q for compressed mainnet, c/9 for testnet)
      keyPair = ECPair.fromWIF(privateKey, network);
      privateKeyHex = keyPair.privateKey!.toString('hex');
    } else if (this._isBitcoinWIF(privateKey)) {
      // Bitcoin WIF - convert to Dogecoin
      const bitcoinNetwork = {
        wif: 0x80,
        bip32: { public: 0x0488b21e, private: 0x0488ade4 },
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        pubKeyHash: 0x00,
        scriptHash: 0x05,
        bech32: 'bc',
      };
      const tempKeyPair = ECPair.fromWIF(privateKey, bitcoinNetwork);
      privateKeyHex = tempKeyPair.privateKey!.toString('hex');
      keyPair = ECPair.fromPrivateKey(tempKeyPair.privateKey!, { network });
    } else if (this._isHexPrivateKey(privateKey)) {
      // Raw hex private key
      privateKeyHex = privateKey;
      const privateKeyBuffer = Buffer.from(privateKey, 'hex');
      keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network });
    } else {
      throw new Error(
        'Invalid private key format. Provide a Dogecoin WIF (starts with Q), ' +
        'Bitcoin WIF (starts with 5/K/L), or 64-character hex string.'
      );
    }

    // Derive Dogecoin address
    const { address } = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network,
    });

    if (!address) {
      throw new Error('Failed to derive Dogecoin address');
    }

    const entry: WalletEntry = {
      publicKey: keyPair.publicKey.toString('hex'),
      keyPair,
      address,
      privateKeyHex,
    };

    // Check for duplicates
    const existing = this.wallets.find(w => w.publicKey === entry.publicKey);
    if (existing) {
      return existing;
    }

    this.wallets.push(entry);
    return entry;
  }

  /**
   * Refresh addresses when network changes
   */
  private _refreshAddresses(): void {
    const network = this.getNetwork();
    
    for (const wallet of this.wallets) {
      // Re-create keyPair with new network
      const privateKeyBuffer = Buffer.from(wallet.privateKeyHex, 'hex');
      wallet.keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network });

      // Re-derive address
      const { address } = bitcoin.payments.p2pkh({
        pubkey: wallet.keyPair.publicKey,
        network,
      });

      if (address) {
        wallet.address = address;
      }
    }
  }

  /**
   * Check if string is a Dogecoin WIF
   */
  private _isDogecoinWIF(str: string): boolean {
    // Dogecoin mainnet WIF: starts with Q (compressed) or 6 (uncompressed)
    // Dogecoin testnet WIF: starts with c (compressed) or 9 (uncompressed)
    return /^[Q6][a-km-zA-HJ-NP-Z1-9]{50,51}$/.test(str) ||
           /^[c9][a-km-zA-HJ-NP-Z1-9]{50,51}$/.test(str);
  }

  /**
   * Check if string is a Bitcoin WIF
   */
  private _isBitcoinWIF(str: string): boolean {
    // Bitcoin mainnet WIF: starts with 5 (uncompressed) or K/L (compressed)
    return /^[5KL][a-km-zA-HJ-NP-Z1-9]{50,51}$/.test(str);
  }

  /**
   * Check if string is a hex private key
   */
  private _isHexPrivateKey(str: string): boolean {
    return /^[0-9a-fA-F]{64}$/.test(str);
  }

  /**
   * Add accounts (generates random keys - not typically used)
   */
  async addAccounts(numberOfAccounts: number = 1): Promise<string[]> {
    const network = this.getNetwork();
    const newAccounts: string[] = [];

    for (let i = 0; i < numberOfAccounts; i++) {
      const keyPair = ECPair.makeRandom({ network });
      const privateKeyHex = keyPair.privateKey!.toString('hex');

      const { address } = bitcoin.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network,
      });

      if (!address) {
        throw new Error('Failed to generate address');
      }

      const entry: WalletEntry = {
        publicKey: keyPair.publicKey.toString('hex'),
        keyPair,
        address,
        privateKeyHex,
      };

      this.wallets.push(entry);
      newAccounts.push(entry.publicKey);
    }

    return newAccounts;
  }

  /**
   * Get all account public keys
   */
  async getAccounts(): Promise<string[]> {
    return this.wallets.map(w => w.publicKey);
  }

  /**
   * Remove an account by address or public key
   */
  removeAccount(addressOrPubkey: string): void {
    const index = this.wallets.findIndex(
      w => w.address === addressOrPubkey || w.publicKey === addressOrPubkey
    );
    
    if (index !== -1) {
      this.wallets.splice(index, 1);
    }
  }

  /**
   * Export private key as WIF
   */
  async exportAccount(publicKeyHex: string): Promise<string> {
    const wallet = this.wallets.find(w => w.publicKey === publicKeyHex);
    if (!wallet) {
      throw new Error('Account not found');
    }

    // Use bitcore-lib-doge for correct WIF encoding
    const bitcore = await getBitcoreLibDoge();
    const { PrivateKey, Networks } = bitcore;
    
    Networks.defaultNetwork = this.networkType === 'testnet' 
      ? Networks.testnet 
      : Networks.mainnet;

    const privKey = new PrivateKey(wallet.privateKeyHex);
    return privKey.toWIF();
  }

  /**
   * Sign a PSBT transaction
   */
  async signTransaction(psbt: bitcoin.Psbt, inputs: ToSignInput[]): Promise<bitcoin.Psbt> {
    for (const input of inputs) {
      const wallet = this.wallets.find(w => w.publicKey === input.publicKey);
      if (!wallet) {
        throw new Error(`No key found for input ${input.index}`);
      }

      psbt.signInput(input.index, wallet.keyPair, input.sighashTypes);
    }

    return psbt;
  }

  /**
   * Sign a message
   */
  async signMessage(publicKeyHex: string, message: string): Promise<string> {
    const wallet = this.wallets.find(w => w.publicKey === publicKeyHex);
    if (!wallet) {
      throw new Error('Account not found');
    }

    const bitcore = await getBitcoreLibDoge();
    const { PrivateKey, Message, Networks } = bitcore;
    
    Networks.defaultNetwork = this.networkType === 'testnet' 
      ? Networks.testnet 
      : Networks.mainnet;

    const privKey = new PrivateKey(wallet.privateKeyHex);
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
      
      Networks.defaultNetwork = this.networkType === 'testnet' 
        ? Networks.testnet 
        : Networks.mainnet;

      const messageObj = new Message(message);
      return messageObj.verify(address, signature);
    } catch {
      return false;
    }
  }

  /**
   * Get address for a public key
   */
  getAddressFromPublicKey(publicKeyHex: string): string {
    const wallet = this.wallets.find(w => w.publicKey === publicKeyHex);
    if (wallet) {
      return wallet.address;
    }

    // Derive address from public key if not in wallet
    const network = this.getNetwork();
    const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
    
    const { address } = bitcoin.payments.p2pkh({
      pubkey: publicKeyBuffer,
      network,
    });

    if (!address) {
      throw new Error('Failed to derive address');
    }

    return address;
  }
}

export default DogecoinSimpleKeyring;

