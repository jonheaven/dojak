/**
 * Browser wallet implementation using doge-sdk (browser-compatible Dogecoin library).
 * No crypto polyfills needed - doge-sdk is designed for browser use.
 *
 * Dogecoin BIP-44 default path remains unchanged:
 * m/44'/3'/0'/0/0
 */

import {
  DogeMemoryWallet,
  coinSelectP2PKH,
  createP2PKHTransaction,
  getP2PKHAddressFromPublicKey,
  decodePrivateKeyFromWIF,
} from 'doge-sdk';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import * as secp from '@noble/secp256k1';

import { decryptJSON, encryptJSON } from './secureStorage';
import { warnIfUnexpectedSigningHostname } from '../services/dmp';
import { buildOpReturnLockingScript, estimateOpReturnOutputsTxWeight } from './tx/opReturn';
import { assertValidDogecoinAddress } from './dogecoinAddressValidate';
import { fixCoinSelectP2PKHFee } from './fixCoinSelectP2PKHFee';
import {
  signPartialPsdtWithWifToHex,
  signPsdtWithWifToTxHex,
} from './doginal-psdt';
import type {
  WalletData,
  NetworkType,
  IntentPayload,
  SignedIntent,
  SeedMaterial,
} from '../types/wallet';

export interface BrowserWalletSaveOptions {
  seedMaterial?: SeedMaterial | null;
  /** PBKDF2 iterations for new encrypted payloads (wallet JSON + seed envelope). */
  pbkdf2Iterations?: number;
}

interface EncryptedWalletRecord {
  encrypted: string;
  network: NetworkType;
}

interface StoredWalletEntry extends Partial<WalletData> {
  address: string;
  network: NetworkType;
  encrypted?: boolean;
}

export interface BrowserWalletSpendableUtxo {
  txid: string;
  vout: number;
  value: number;
  confirmations?: number;
  address?: string;
  scriptPubKey?: string;
  inscriptions?: Array<Record<string, unknown>>;
}

export interface BrowserWalletBuiltTransaction {
  txHex: string;
  fee: number;
  inputCount: number;
  outputCount: number;
  inputTotal: number;
  outputTotal: number;
  change: number;
  /** Selected inputs (for mempool overlay / spent-input retry). */
  inputs: Array<{ txid: string; vout: number; value: number }>;
  /** Change output index among payment outputs (excludes OP_RETURN), or null. */
  changeVout: number | null;
}

export interface BrowserWalletSendTransactionOptions {
  wallet?: WalletData;
  password?: string;
  address?: string;
  utxos: BrowserWalletSpendableUtxo[];
  broadcastTx?: (txHex: string) => Promise<string>;
  feeRate?: number;
  minConfirmations?: number;
  includeInscribedUtxos?: boolean;
  /** UTF-8 stake / attestation line (≤80 bytes) embedded as OP_RETURN in the same tx. */
  opReturnMessage?: string;
}

const DEFAULT_DOGE_FEE_RATE = 1_000;
const DEFAULT_MIN_CONFIRMATIONS = 1;

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return new Uint8Array(digest);
}

async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as any,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message as any);
  return new Uint8Array(signature);
}

async function doubleSha256(data: Uint8Array): Promise<Uint8Array> {
  const first = await sha256(data);
  return sha256(first);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const output: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      output[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return output;
  }
  return value;
}

function isInscribedUtxo(utxo: BrowserWalletSpendableUtxo): boolean {
  return Array.isArray(utxo.inscriptions) && utxo.inscriptions.length > 0;
}

function normalizeDogeAmountToKoinu(amountDoge: number): number {
  if (!Number.isFinite(amountDoge) || amountDoge <= 0) {
    throw new Error('Amount must be a positive DOGE value');
  }

  const koinu = Math.round(amountDoge * 100_000_000);
  if (koinu <= 0) {
    throw new Error('Amount is too small');
  }

  return koinu;
}

function getNetworkId(network: NetworkType): 'doge' | 'dogeTestnet' {
  return network === 'mainnet' ? 'doge' : 'dogeTestnet';
}

function normalizeSeedMaterial(seedMaterial: SeedMaterial): SeedMaterial {
  return {
    mnemonic: seedMaterial.mnemonic.trim().replace(/\s+/g, ' '),
    passphrase: seedMaterial.passphrase ?? '',
  };
}

function getDogecoinDerivationPath(accountIndex = 0): string {
  if (!Number.isInteger(accountIndex) || accountIndex < 0) {
    throw new Error('Account index must be a non-negative integer');
  }
  return `m/44'/3'/${accountIndex}'/0/0`;
}

secp.hashes.hmacSha256Async = hmacSha256 as any;
secp.hashes.sha256Async = sha256 as any;

function encodeVarInt(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid variable integer value');
  }

  if (value < 0xfd) {
    return Uint8Array.of(value);
  }

  if (value <= 0xffff) {
    return Uint8Array.of(0xfd, value & 0xff, (value >> 8) & 0xff);
  }

  if (value <= 0xffffffff) {
    return Uint8Array.of(
      0xfe,
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >> 24) & 0xff
    );
  }

  const bigValue = BigInt(value);
  return Uint8Array.of(
    0xff,
    Number(bigValue & 0xffn),
    Number((bigValue >> 8n) & 0xffn),
    Number((bigValue >> 16n) & 0xffn),
    Number((bigValue >> 24n) & 0xffn),
    Number((bigValue >> 32n) & 0xffn),
    Number((bigValue >> 40n) & 0xffn),
    Number((bigValue >> 48n) & 0xffn),
    Number((bigValue >> 56n) & 0xffn)
  );
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, bytes) => sum + bytes.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const bytes of arrays) {
    output.set(bytes, offset);
    offset += bytes.length;
  }

  return output;
}

async function hashDogecoinSignedMessage(message: string): Promise<Uint8Array> {
  const prefixBytes = new TextEncoder().encode('Dogecoin Signed Message:\n');
  const messageBytes = new TextEncoder().encode(message);
  const payload = concatBytes(
    encodeVarInt(prefixBytes.length),
    prefixBytes,
    encodeVarInt(messageBytes.length),
    messageBytes
  );
  return doubleSha256(payload);
}

function toBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  const bufferCtor = (globalThis as {
    Buffer?: { from(input: Uint8Array): { toString(encoding: string): string } };
  }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(bytes).toString('base64');
  }

  throw new Error('No base64 encoder available in this environment');
}

async function signDogecoinMessage(privateKeyWif: string, message: string): Promise<string> {
  const privateKeyBytes = decodePrivateKeyFromWIF(privateKeyWif);
  const messageHash = await hashDogecoinSignedMessage(message);
  const signature = await secp.signAsync(messageHash, privateKeyBytes, {
    format: 'recovered',
    prehash: false,
  });

  const header = 27 + 4 + signature[0];
  const compactSignature = Uint8Array.of(header, ...signature.slice(1));
  return toBase64(compactSignature);
}

async function buildWalletDataFromPrivateKey(
  privateKeyBytes: Uint8Array,
  network: NetworkType,
  metadata?: Partial<WalletData>
): Promise<WalletData> {
  const networkId = getNetworkId(network);
  const wallet = new DogeMemoryWallet(privateKeyBytes, networkId);
  const publicKeyRaw = await wallet.getCompressedPublicKey();
  const publicKey =
    typeof publicKeyRaw === 'string' ? hexToBytes(publicKeyRaw) : publicKeyRaw;
  const address = getP2PKHAddressFromPublicKey(publicKey, networkId);
  const privateKeyWIF = await wallet.getPrivateKeyWIF();

  return {
    address,
    privateKey: privateKeyWIF,
    network,
    publicKey: bytesToHex(publicKey),
    ...metadata,
  };
}

export class BrowserWallet {
  private static readonly STORAGE_KEY = 'dojakweb_wallet';
  private static readonly STORAGE_ENCRYPTED_KEY = 'dojakweb_wallet_encrypted';
  private static readonly STORAGE_WALLETS = 'dojakweb_wallets';
  private static readonly STORAGE_CURRENT = 'dojakweb_wallet_current';
  private static readonly STORAGE_ENCRYPTED_PREFIX = 'dojakweb_wallet_encrypted_';
  private static readonly STORAGE_UNENCRYPTED_PREFIX = 'dojakweb_wallet_unencrypted_';
  private static readonly STORAGE_SEED_PREFIX = 'dojakweb_wallet_seed_';

  private static encryptedKey(address: string): string {
    return `${BrowserWallet.STORAGE_ENCRYPTED_PREFIX}${address}`;
  }

  private static unencryptedKey(address: string): string {
    return `${BrowserWallet.STORAGE_UNENCRYPTED_PREFIX}${address}`;
  }

  private static seedKey(seedFingerprint: string): string {
    return `${BrowserWallet.STORAGE_SEED_PREFIX}${seedFingerprint}`;
  }

  private static legacyMnemonicKey(address: string): string {
    return `wallet_mnemonic_${address}`;
  }

  static getDerivationPath(accountIndex = 0): string {
    return getDogecoinDerivationPath(accountIndex);
  }

  static async computeSeedFingerprint(seedMaterial: SeedMaterial): Promise<string> {
    const normalized = normalizeSeedMaterial(seedMaterial);
    const material = new TextEncoder().encode(
      `${normalized.mnemonic}\u0000${normalized.passphrase ?? ''}`
    );
    return bytesToHex(await sha256(material));
  }

  static async generateWallet(
    network: NetworkType = 'mainnet'
  ): Promise<WalletData & { mnemonic?: string }> {

    const mnemonic = generateMnemonic(englishWordlist, 128);
    const seedMaterial: SeedMaterial = { mnemonic, passphrase: '' };
    const seed = mnemonicToSeedSync(mnemonic);
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(getDogecoinDerivationPath(0));
    if (!child.privateKey) {
      throw new Error('Failed to derive private key from mnemonic');
    }

    const createdAt = Date.now();
    const wallet = await buildWalletDataFromPrivateKey(child.privateKey, network, {
      createdAt,
      accountIndex: 0,
      derivationPath: getDogecoinDerivationPath(0),
      walletSource: 'generated',
      mnemonicWordCount: 12,
      seedFingerprint: await BrowserWallet.computeSeedFingerprint(seedMaterial),
    });

    localStorage.setItem(`wallet_created_${wallet.address}`, String(createdAt));

    return {
      ...wallet,
      mnemonic,
    };
  }

  static async importFromPrivateKey(
    privateKeyInput: string,
    network: NetworkType = 'mainnet'
  ): Promise<WalletData> {
    const normalized = privateKeyInput.trim();
    const privateKeyBytes = /^(0x)?[0-9a-fA-F]{64}$/.test(normalized)
      ? hexToBytes(normalized)
      : decodePrivateKeyFromWIF(normalized);

    const createdAt = Date.now();
    const wallet = await buildWalletDataFromPrivateKey(
      privateKeyBytes,
      network,
      {
        createdAt,
        walletSource: 'privateKey',
      }
    );

    localStorage.setItem(`wallet_created_${wallet.address}`, String(createdAt));
    return wallet;
  }

  static async importFromMnemonic(
    mnemonic: string,
    passphrase?: string,
    network: NetworkType = 'mainnet',
    accountIndex = 0
  ): Promise<WalletData> {

    const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
    if (!validateMnemonic(normalizedMnemonic, englishWordlist)) {
      throw new Error('Invalid BIP-39 mnemonic phrase');
    }

    const seedMaterial = normalizeSeedMaterial({
      mnemonic: normalizedMnemonic,
      passphrase,
    });
    const seed = mnemonicToSeedSync(seedMaterial.mnemonic, seedMaterial.passphrase);
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(getDogecoinDerivationPath(accountIndex));
    if (!child.privateKey) {
      throw new Error('Failed to derive private key from mnemonic');
    }

    const createdAt = Date.now();
    const wallet = await buildWalletDataFromPrivateKey(child.privateKey, network, {
      createdAt,
      accountIndex,
      derivationPath: getDogecoinDerivationPath(accountIndex),
      walletSource: 'mnemonic',
      mnemonicWordCount: normalizedMnemonic.split(/\s+/).length,
      seedFingerprint: await BrowserWallet.computeSeedFingerprint(seedMaterial),
    });

    localStorage.setItem(`wallet_created_${wallet.address}`, String(createdAt));
    return wallet;
  }

  async saveWallet(
    wallet: WalletData,
    password?: string,
    options?: BrowserWalletSaveOptions
  ): Promise<void> {

    try {
      const seedMaterial = options?.seedMaterial
        ? normalizeSeedMaterial(options.seedMaterial)
        : null;
      const seedFingerprint =
        seedMaterial
          ? await BrowserWallet.computeSeedFingerprint(seedMaterial)
          : wallet.seedFingerprint;
      const walletToPersist: WalletData = {
        ...wallet,
        seedFingerprint,
      };

      const encryptedKey = BrowserWallet.encryptedKey(wallet.address);
      const unencryptedKey = BrowserWallet.unencryptedKey(wallet.address);

      if (password) {
        const encOpts = options?.pbkdf2Iterations ? { pbkdf2Iterations: options.pbkdf2Iterations } : undefined;
        const encrypted = await encryptJSON(walletToPersist, password, encOpts);
        localStorage.setItem(
          encryptedKey,
          JSON.stringify({ encrypted, network: wallet.network } satisfies EncryptedWalletRecord)
        );
        localStorage.removeItem(unencryptedKey);
        localStorage.removeItem(BrowserWallet.STORAGE_KEY);
        localStorage.removeItem(BrowserWallet.STORAGE_ENCRYPTED_KEY);
      } else {
        localStorage.setItem(unencryptedKey, JSON.stringify(walletToPersist));
        localStorage.removeItem(encryptedKey);
        localStorage.setItem(BrowserWallet.STORAGE_KEY, JSON.stringify(walletToPersist));
        localStorage.removeItem(BrowserWallet.STORAGE_ENCRYPTED_KEY);
      }

      if (seedMaterial) {
        if (password) {
          await this.saveSeedMaterial(seedMaterial, seedFingerprint!, password, options?.pbkdf2Iterations);
          localStorage.removeItem(BrowserWallet.legacyMnemonicKey(wallet.address));
        } else {
          localStorage.setItem(BrowserWallet.legacyMnemonicKey(wallet.address), seedMaterial.mnemonic);
        }
      }

      const list = await this.readWalletList();
      const idx = list.findIndex((entry) => entry.address === wallet.address);
      const listEntry: StoredWalletEntry = password
        ? {
            address: wallet.address,
            network: wallet.network,
            nickname: walletToPersist.nickname,
            createdAt: walletToPersist.createdAt,
            accountIndex: walletToPersist.accountIndex,
            derivationPath: walletToPersist.derivationPath,
            seedFingerprint: walletToPersist.seedFingerprint,
            mnemonicWordCount: walletToPersist.mnemonicWordCount,
            walletSource: walletToPersist.walletSource,
            publicKey: walletToPersist.publicKey,
            encrypted: true,
          }
        : {
            ...walletToPersist,
            encrypted: false,
          };

      if (idx >= 0) {
        list[idx] = listEntry;
      } else {
        list.push(listEntry);
      }

      localStorage.setItem(BrowserWallet.STORAGE_WALLETS, JSON.stringify(list));
      localStorage.setItem(BrowserWallet.STORAGE_CURRENT, wallet.address);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save wallet: ${message}`);
    }
  }

  async loadWallet(password?: string, address?: string): Promise<WalletData | null> {

    try {
      const targetAddress = address || localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
      if (!targetAddress) {
        const encryptedData = localStorage.getItem(BrowserWallet.STORAGE_ENCRYPTED_KEY);
        if (encryptedData) {
          if (!password) {
            throw new Error('Wallet is encrypted. Password required.');
          }
          const record = JSON.parse(encryptedData) as EncryptedWalletRecord;
          const decrypted = await decryptJSON<WalletData>(record.encrypted, password);
          const wallet = await this.finalizeLoadedWallet(
            { ...decrypted.value, network: record.network },
            password
          );
          await this.saveWallet(wallet, password);
          return wallet;
        }

        const walletData = localStorage.getItem(BrowserWallet.STORAGE_KEY);
        if (!walletData) {
          return null;
        }

        const parsed = JSON.parse(walletData) as WalletData;
        const wallet = await this.finalizeLoadedWallet(parsed);
        await this.saveWallet(wallet);
        return wallet;
      }

      const encryptedRecord = localStorage.getItem(BrowserWallet.encryptedKey(targetAddress));
      if (encryptedRecord) {
        if (!password) {
          throw new Error('Wallet is encrypted. Password required.');
        }

        const record = JSON.parse(encryptedRecord) as EncryptedWalletRecord;
        const decrypted = await decryptJSON<WalletData>(record.encrypted, password);
        const wallet = await this.finalizeLoadedWallet(
          { ...decrypted.value, network: record.network },
          password,
          targetAddress
        );
        if (decrypted.migrated) {
          await this.saveWallet(wallet, password);
        }
        return this.applyStoredMetadata(wallet, targetAddress);
      }

      const unencryptedRecord = localStorage.getItem(BrowserWallet.unencryptedKey(targetAddress));
      if (unencryptedRecord) {
        const parsed = JSON.parse(unencryptedRecord) as WalletData;
        const wallet = await this.finalizeLoadedWallet(parsed, undefined, targetAddress);
        return this.applyStoredMetadata(wallet, targetAddress);
      }

      const list = await this.readWalletList();
      const found = list.find((entry) => entry.address === targetAddress);
      if (found && found.privateKey && !found.encrypted) {
        return found as WalletData;
      }

      const legacyData = localStorage.getItem(BrowserWallet.STORAGE_KEY);
      if (!legacyData) {
        return null;
      }

      const wallet = await this.finalizeLoadedWallet(
        JSON.parse(legacyData) as WalletData,
        password,
        targetAddress
      );
      await this.saveWallet(wallet, password);
      return wallet;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load wallet: ${message}`);
    }
  }

  async loadSeedMaterial(
    password?: string,
    address?: string
  ): Promise<SeedMaterial | null> {

    const targetAddress = address || localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
    if (!targetAddress) {
      return null;
    }

    const listEntry = await this.getStoredWalletEntry(targetAddress);
    const seedFingerprint = listEntry?.seedFingerprint;
    if (seedFingerprint) {
      const seedRecord = localStorage.getItem(BrowserWallet.seedKey(seedFingerprint));
      if (seedRecord) {
        if (!password) {
          throw new Error('Wallet seed is encrypted. Password required.');
        }

        const decrypted = await decryptJSON<SeedMaterial>(seedRecord, password);
        if (decrypted.migrated) {
          await this.saveSeedMaterial(decrypted.value, seedFingerprint, password);
        }
        return normalizeSeedMaterial(decrypted.value);
      }
    }

    const legacyMnemonic = localStorage.getItem(BrowserWallet.legacyMnemonicKey(targetAddress));
    if (!legacyMnemonic) {
      return null;
    }

    const seedMaterial = normalizeSeedMaterial({
      mnemonic: legacyMnemonic,
      passphrase: '',
    });
    const fingerprint =
      seedFingerprint ?? (await BrowserWallet.computeSeedFingerprint(seedMaterial));
    await this.updateStoredWalletMetadata(targetAddress, {
      seedFingerprint: fingerprint,
      accountIndex: listEntry?.accountIndex ?? 0,
      derivationPath: listEntry?.derivationPath ?? getDogecoinDerivationPath(0),
      mnemonicWordCount: seedMaterial.mnemonic.split(/\s+/).length,
      walletSource: listEntry?.walletSource ?? 'mnemonic',
    });

    if (password) {
      await this.saveSeedMaterial(seedMaterial, fingerprint, password);
      localStorage.removeItem(BrowserWallet.legacyMnemonicKey(targetAddress));
    }

    return seedMaterial;
  }

  async hasSeedMaterial(address?: string): Promise<boolean> {

    const targetAddress = address || localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
    if (!targetAddress) {
      return false;
    }

    const entry = await this.getStoredWalletEntry(targetAddress);
    if (entry?.seedFingerprint && localStorage.getItem(BrowserWallet.seedKey(entry.seedFingerprint))) {
      return true;
    }

    return localStorage.getItem(BrowserWallet.legacyMnemonicKey(targetAddress)) !== null;
  }

  async switchAccount(
    accountIndex: number,
    password?: string,
    address?: string
  ): Promise<WalletData> {

    if (!Number.isInteger(accountIndex) || accountIndex < 0) {
      throw new Error('Account index must be a non-negative integer');
    }

    const currentAddress = address || localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
    if (!currentAddress) {
      throw new Error('No active browser wallet is available');
    }

    const currentWallet = await this.loadWallet(password, currentAddress);
    if (!currentWallet) {
      throw new Error('No active browser wallet is available');
    }

    const seedMaterial = await this.loadSeedMaterial(password, currentAddress);
    if (!seedMaterial) {
      throw new Error('Recovery phrase is unavailable. Set a wallet password to enable HD accounts.');
    }

    const existingAccounts = await this.readWalletList();
    const matchingEntry = existingAccounts.find(
      (entry) =>
        entry.seedFingerprint === currentWallet.seedFingerprint &&
        entry.accountIndex === accountIndex
    );

    const derived = await BrowserWallet.importFromMnemonic(
      seedMaterial.mnemonic,
      seedMaterial.passphrase,
      currentWallet.network,
      accountIndex
    );

    const walletToPersist: WalletData = {
      ...derived,
      nickname: matchingEntry?.nickname,
      walletSource:
        currentWallet.walletSource === 'generated' ? 'generated' : 'mnemonic',
    };

    await this.saveWallet(walletToPersist, password, { seedMaterial });
    await this.selectWallet(walletToPersist.address);
    return walletToPersist;
  }

  async hasWallet(): Promise<boolean> {

    const list = await this.readWalletList();
    if (list.length > 0) {
      return true;
    }

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith(BrowserWallet.STORAGE_ENCRYPTED_PREFIX) ||
        key.startsWith(BrowserWallet.STORAGE_UNENCRYPTED_PREFIX)
      ) {
        return true;
      }
    }

    return (
      localStorage.getItem(BrowserWallet.STORAGE_KEY) !== null ||
      localStorage.getItem(BrowserWallet.STORAGE_ENCRYPTED_KEY) !== null
    );
  }

  async isEncrypted(address?: string): Promise<boolean> {

    const targetAddress = address || localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
    if (targetAddress && localStorage.getItem(BrowserWallet.encryptedKey(targetAddress))) {
      return true;
    }

    if (localStorage.getItem(BrowserWallet.STORAGE_ENCRYPTED_KEY)) {
      return true;
    }

    const current = localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
    if (!current) {
      return false;
    }

    const entry = await this.getStoredWalletEntry(address || current);
    return !!entry?.encrypted;
  }

  async removeWallet(address?: string): Promise<void> {

    let walletAddress = address ?? localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
    if (!walletAddress) {
      try {
        const loaded = await this.loadWallet();
        if (loaded) {
          walletAddress = loaded.address;
        }
      } catch {
        walletAddress = null;
      }
    }

    const list = await this.readWalletList();
    const removedEntry = walletAddress
      ? list.find((entry) => entry.address === walletAddress) ?? null
      : null;

    if (walletAddress) {
      localStorage.removeItem(BrowserWallet.encryptedKey(walletAddress));
      localStorage.removeItem(BrowserWallet.unencryptedKey(walletAddress));
      localStorage.removeItem(BrowserWallet.legacyMnemonicKey(walletAddress));
      localStorage.removeItem(`wallet_backed_up_${walletAddress}`);
      localStorage.removeItem(`wallet_created_${walletAddress}`);
    }

    localStorage.removeItem(BrowserWallet.STORAGE_KEY);
    localStorage.removeItem(BrowserWallet.STORAGE_ENCRYPTED_KEY);

    const filtered = walletAddress
      ? list.filter((entry) => entry.address !== walletAddress)
      : list;
    localStorage.setItem(BrowserWallet.STORAGE_WALLETS, JSON.stringify(filtered));

    const current = localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
    if (current && walletAddress && current === walletAddress) {
      localStorage.removeItem(BrowserWallet.STORAGE_CURRENT);
      if (filtered.length > 0) {
        localStorage.setItem(BrowserWallet.STORAGE_CURRENT, filtered[0].address);
      }
    }

    if (
      removedEntry?.seedFingerprint &&
      !filtered.some((entry) => entry.seedFingerprint === removedEntry.seedFingerprint)
    ) {
      localStorage.removeItem(BrowserWallet.seedKey(removedEntry.seedFingerprint));
    }
  }

  async listWallets(): Promise<WalletData[]> {
    return (await this.readWalletList()) as WalletData[];
  }

  async selectWallet(address: string): Promise<WalletData | null> {

    const list = await this.readWalletList();
    const found = list.find((entry) => entry.address === address) || null;
    if (found) {
      localStorage.setItem(BrowserWallet.STORAGE_CURRENT, found.address);
    }
    return found as WalletData | null;
  }

  async clearAllWallets(): Promise<void> {

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith(BrowserWallet.STORAGE_ENCRYPTED_PREFIX) ||
        key.startsWith(BrowserWallet.STORAGE_UNENCRYPTED_PREFIX) ||
        key.startsWith(BrowserWallet.STORAGE_SEED_PREFIX) ||
        key.startsWith('wallet_mnemonic_') ||
        key.startsWith('wallet_backed_up_') ||
        key.startsWith('wallet_created_')
      ) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    localStorage.removeItem(BrowserWallet.STORAGE_WALLETS);
    localStorage.removeItem(BrowserWallet.STORAGE_CURRENT);
    localStorage.removeItem(BrowserWallet.STORAGE_KEY);
    localStorage.removeItem(BrowserWallet.STORAGE_ENCRYPTED_KEY);
  }

  async updateNickname(address: string, nickname?: string): Promise<void> {

    const list = await this.readWalletList();
    const idx = list.findIndex((entry) => entry.address === address);
    if (idx >= 0) {
      list[idx] = { ...list[idx], nickname };
      localStorage.setItem(BrowserWallet.STORAGE_WALLETS, JSON.stringify(list));
    }

    const raw = localStorage.getItem(BrowserWallet.unencryptedKey(address));
    if (raw) {
      try {
        const wallet = JSON.parse(raw) as WalletData;
        wallet.nickname = nickname;
        localStorage.setItem(BrowserWallet.unencryptedKey(address), JSON.stringify(wallet));
        const current = localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
        if (current === address) {
          localStorage.setItem(BrowserWallet.STORAGE_KEY, JSON.stringify(wallet));
        }
      } catch {
        // Ignore malformed unencrypted cache entries.
      }
    }
  }

  private async saveSeedMaterial(
    seedMaterial: SeedMaterial,
    seedFingerprint: string,
    password: string,
    pbkdf2Iterations?: number
  ): Promise<void> {
    const normalized = normalizeSeedMaterial(seedMaterial);
    const encOpts = pbkdf2Iterations ? { pbkdf2Iterations } : undefined;
    const encrypted = await encryptJSON(normalized, password, encOpts);
    localStorage.setItem(BrowserWallet.seedKey(seedFingerprint), encrypted);
  }

  private async readWalletList(): Promise<StoredWalletEntry[]> {
    const listRaw = localStorage.getItem(BrowserWallet.STORAGE_WALLETS);
    if (!listRaw) {
      return [];
    }

    try {
      return JSON.parse(listRaw) as StoredWalletEntry[];
    } catch {
      return [];
    }
  }

  private async getStoredWalletEntry(address: string): Promise<StoredWalletEntry | null> {
    const list = await this.readWalletList();
    return list.find((entry) => entry.address === address) ?? null;
  }

  private applyStoredMetadata(wallet: WalletData, address: string): WalletData {
    const listRaw = localStorage.getItem(BrowserWallet.STORAGE_WALLETS);
    if (!listRaw) {
      return wallet;
    }

    try {
      const list = JSON.parse(listRaw) as StoredWalletEntry[];
      const entry = list.find((item) => item.address === address);
      if (!entry) {
        return wallet;
      }

      return {
        ...wallet,
        nickname: entry.nickname ?? wallet.nickname,
        createdAt: entry.createdAt ?? wallet.createdAt,
        accountIndex: entry.accountIndex ?? wallet.accountIndex,
        derivationPath: entry.derivationPath ?? wallet.derivationPath,
        seedFingerprint: entry.seedFingerprint ?? wallet.seedFingerprint,
        mnemonicWordCount: entry.mnemonicWordCount ?? wallet.mnemonicWordCount,
        walletSource: entry.walletSource ?? wallet.walletSource,
        publicKey: entry.publicKey ?? wallet.publicKey,
      };
    } catch {
      return wallet;
    }
  }

  private async updateStoredWalletMetadata(
    address: string,
    updates: Partial<WalletData>
  ): Promise<void> {
    const list = await this.readWalletList();
    const idx = list.findIndex((entry) => entry.address === address);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates };
      localStorage.setItem(BrowserWallet.STORAGE_WALLETS, JSON.stringify(list));
    }

    const unencryptedRaw = localStorage.getItem(BrowserWallet.unencryptedKey(address));
    if (unencryptedRaw) {
      try {
        const wallet = JSON.parse(unencryptedRaw) as WalletData;
        localStorage.setItem(
          BrowserWallet.unencryptedKey(address),
          JSON.stringify({ ...wallet, ...updates })
        );
      } catch {
        // Ignore malformed cache entry.
      }
    }

    const current = localStorage.getItem(BrowserWallet.STORAGE_CURRENT);
    if (current === address) {
      const currentRaw = localStorage.getItem(BrowserWallet.STORAGE_KEY);
      if (currentRaw) {
        try {
          const wallet = JSON.parse(currentRaw) as WalletData;
          localStorage.setItem(BrowserWallet.STORAGE_KEY, JSON.stringify({ ...wallet, ...updates }));
        } catch {
          // Ignore malformed current cache entry.
        }
      }
    }
  }

  private async finalizeLoadedWallet(
    wallet: WalletData,
    password?: string,
    addressHint?: string
  ): Promise<WalletData> {
    const address = addressHint || wallet.address;
    let hydrated = this.applyStoredMetadata(wallet, address);

    const legacyMnemonic = localStorage.getItem(BrowserWallet.legacyMnemonicKey(address));
    if (!legacyMnemonic) {
      return hydrated;
    }

    const seedMaterial = normalizeSeedMaterial({
      mnemonic: legacyMnemonic,
      passphrase: '',
    });
    const fingerprint = hydrated.seedFingerprint ?? (await BrowserWallet.computeSeedFingerprint(seedMaterial));

    const metadataUpdates: Partial<WalletData> = {
      seedFingerprint: fingerprint,
      accountIndex: hydrated.accountIndex ?? 0,
      derivationPath: hydrated.derivationPath ?? getDogecoinDerivationPath(0),
      mnemonicWordCount: hydrated.mnemonicWordCount ?? seedMaterial.mnemonic.split(/\s+/).length,
      walletSource: hydrated.walletSource ?? 'mnemonic',
    };

    hydrated = { ...hydrated, ...metadataUpdates };
    await this.updateStoredWalletMetadata(address, metadataUpdates);

    if (password) {
      await this.saveSeedMaterial(seedMaterial, fingerprint, password);
      localStorage.removeItem(BrowserWallet.legacyMnemonicKey(address));
    }

    return hydrated;
  }

  private async resolveWalletForSend(options: {
    wallet?: WalletData;
    password?: string;
    address?: string;
  }): Promise<WalletData> {
    if (options.wallet) {
      return options.wallet;
    }

    const loaded = await this.loadWallet(options.password, options.address);
    if (!loaded) {
      throw new Error('No browser wallet is available for sending');
    }

    return loaded;
  }

  async buildTransaction(
    recipientAddress: string,
    amountDoge: number,
    options: BrowserWalletSendTransactionOptions
  ): Promise<BrowserWalletBuiltTransaction> {

    if (!recipientAddress || !recipientAddress.trim()) {
      throw new Error('Recipient address is required');
    }

    // Checksum + network version — catch off-by-one typos before coin select.
    const normalizedRecipient = assertValidDogecoinAddress(recipientAddress);

    if (!Array.isArray(options.utxos) || options.utxos.length === 0) {
      throw new Error('Spendable UTXOs are required');
    }

    const wallet = await this.resolveWalletForSend(options);
    const feeRate = Math.max(1, Math.floor(options.feeRate ?? DEFAULT_DOGE_FEE_RATE));
    const minConfirmations = Math.max(
      0,
      Math.floor(options.minConfirmations ?? DEFAULT_MIN_CONFIRMATIONS)
    );
    const sendValue = normalizeDogeAmountToKoinu(amountDoge);

    let opReturnPayload: Buffer | undefined;
    const opReturnMessage = options.opReturnMessage?.trim();
    if (opReturnMessage) {
      opReturnPayload = Buffer.from(opReturnMessage, 'utf8');
      if (opReturnPayload.length > 80) {
        throw new Error('OP_RETURN message exceeds 80 bytes');
      }
    }

    const spendableUtxos = options.utxos
      .filter((utxo) => Number.isFinite(utxo.value) && utxo.value > 0)
      .filter((utxo) => (utxo.confirmations ?? 0) >= minConfirmations)
      .filter((utxo) => options.includeInscribedUtxos || !isInscribedUtxo(utxo));

    if (spendableUtxos.length === 0) {
      throw new Error(
        options.includeInscribedUtxos
          ? 'No spendable UTXOs are available'
          : 'No spendable plain DOGE UTXOs are available'
      );
    }

    const opReturnWeight = opReturnPayload ? estimateOpReturnOutputsTxWeight([opReturnPayload]) : 0;
    const effectiveFeeRate =
      opReturnWeight > 0 ? feeRate + Math.ceil((opReturnWeight * feeRate) / 1000) : feeRate;

    const selected = coinSelectP2PKH(
      wallet.address,
      effectiveFeeRate,
      spendableUtxos.map((utxo) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
      })),
      [{ address: normalizedRecipient, value: sendValue }]
    );

    // doge-sdk coinSelectP2PKH underpays (change ≈ marginal output cost only).
    const fixed = fixCoinSelectP2PKHFee({
      changeAddress: wallet.address,
      feeRateKoinuPerByte: effectiveFeeRate,
      inputs: selected.inputs,
      payments: [{ address: normalizedRecipient, value: sendValue }],
    });

    const signer = DogeMemoryWallet.fromWIF(wallet.privateKey, getNetworkId(wallet.network));

    const outputs = opReturnPayload
      ? [
          { value: 0, script: new Uint8Array(buildOpReturnLockingScript(opReturnPayload, 80)) },
          ...fixed.outputs,
        ]
      : fixed.outputs;

    const finalizedTx = await createP2PKHTransaction(signer, {
      address: wallet.address,
      inputs: fixed.inputs,
      outputs,
    }).finalizeAndSign();

    const inputTotal = fixed.inputs.reduce((sum, utxo) => sum + utxo.value, 0);
    const outputTotal = fixed.outputs.reduce((sum, output) => sum + output.value, 0);
    const change = fixed.change;
    // Payment outputs: [OP_RETURN?] payment [change?]
    const paymentOutputs = fixed.outputs;
    const changeVout =
      change > 0 && paymentOutputs.length >= 2
        ? (opReturnPayload ? 1 : 0) + (paymentOutputs.length - 1)
        : null;

    return {
      txHex: finalizedTx.toHex(),
      fee: fixed.fee,
      inputCount: fixed.inputs.length,
      outputCount: fixed.outputs.length + (opReturnPayload ? 1 : 0),
      inputTotal,
      outputTotal,
      change,
      inputs: fixed.inputs.map((u) => ({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
      })),
      changeVout,
    };
  }

  async sendTransaction(
    recipientAddress: string,
    amountDoge: number,
    options: BrowserWalletSendTransactionOptions
  ): Promise<string> {

    if (typeof options.broadcastTx !== 'function') {
      throw new Error('A broadcastTx callback is required to send a transaction');
    }

    const built = await this.buildTransaction(recipientAddress, amountDoge, options);
    return options.broadcastTx(built.txHex);
  }

  async signMessage(message: string, password?: string, address?: string): Promise<string> {

    if (!message) {
      throw new Error('Message is required');
    }

    warnIfUnexpectedSigningHostname('Message signing');

    const wallet = await this.loadWallet(password, address);
    if (!wallet) {
      throw new Error('No browser wallet is available for signing');
    }

    return signDogecoinMessage(wallet.privateKey, message);
  }

  async signPSBT(
    psbt: string,
    inputIndexes?: number[],
    password?: string,
    address?: string
  ): Promise<string> {

    if (!psbt || !psbt.trim()) {
      throw new Error('PSDT is required');
    }

    warnIfUnexpectedSigningHostname('PSDT signing');

    const wallet = await this.loadWallet(password, address);
    if (!wallet) {
      throw new Error('No browser wallet is available for signing');
    }

    return signPsdtWithWifToTxHex(psbt, wallet.privateKey, inputIndexes);
  }

  /** Partially sign PSBT (hex); does not finalize or extract a raw transaction. */
  async signPSBTOnly(
    psbt: string,
    inputIndexes?: number[],
    password?: string,
    address?: string
  ): Promise<string> {

    if (!psbt || !psbt.trim()) {
      throw new Error('PSDT is required');
    }

    warnIfUnexpectedSigningHostname('PSDT signing');

    const wallet = await this.loadWallet(password, address);
    if (!wallet) {
      throw new Error('No browser wallet is available for signing');
    }

    return signPartialPsdtWithWifToHex(psbt, wallet.privateKey, inputIndexes);
  }

  async signIntent(
    payload: IntentPayload,
    password?: string,
    address?: string
  ): Promise<SignedIntent> {

    if (!payload || typeof payload !== 'object') {
      throw new Error('Intent payload is required');
    }

    const allowedIntents = new Set([
      'listing_buy',
      'offer_create',
      'offer_cancel',
      'bid_place',
      'bid_cancel',
      'auction_settle',
    ]);

    if (!allowedIntents.has(payload.intentType)) {
      throw new Error(`Unsupported intentType: ${payload.intentType}`);
    }

    const expiresAtMs = Date.parse(payload.expiresAt);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw new Error('Intent has expired');
    }

    const wallet = await this.loadWallet(password, address);
    if (!wallet) {
      throw new Error('No browser wallet is available for intent signing');
    }

    if (payload.network !== wallet.network) {
      throw new Error(`Intent network mismatch: expected ${wallet.network}, got ${payload.network}`);
    }

    if (payload.address !== wallet.address) {
      throw new Error('Intent address does not match the active wallet');
    }

    const canonicalPayload = canonicalize(payload) as Record<string, unknown>;
    const canonicalJson = JSON.stringify(canonicalPayload);
    const payloadHash = bytesToHex(await doubleSha256(new TextEncoder().encode(canonicalJson)));
    const signature = await this.signMessage(canonicalJson, password, wallet.address);

    return {
      signature,
      signingAddress: wallet.address,
      signedAt: new Date().toISOString(),
      payloadHash,
    };
  }
}

export const generateWallet = BrowserWallet.generateWallet;
export const importFromPrivateKey = BrowserWallet.importFromPrivateKey;
export const importFromMnemonic = BrowserWallet.importFromMnemonic;
