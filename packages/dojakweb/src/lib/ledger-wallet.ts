import { getP2PKHAddressFromPublicKey } from 'doge-sdk';

import type { NetworkType } from '../types/wallet';

const LEDGER_ACCOUNT_INDEX_STORAGE_KEY = 'dojakweb_ledger_account_index';
const DOGECOIN_APP_NAME_RE = /doge/i;

export interface LedgerWalletAccount {
  address: string;
  publicKey: string;
  network: NetworkType;
  accountIndex: number;
  derivationPath: string;
}

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
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function normalizeAccountIndex(accountIndex: number): number {
  if (!Number.isInteger(accountIndex) || accountIndex < 0) {
    throw new Error('Account index must be a non-negative integer');
  }
  return accountIndex;
}

function signatureToBase64(signature: { v: number; r: string; s: string }): string {
  const bytes = new Uint8Array(65);
  bytes[0] = signature.v + 31;
  bytes.set(hexToBytes(signature.r), 1);
  bytes.set(hexToBytes(signature.s), 33);
  return bytesToBase64(bytes);
}

export class LedgerWallet {
  private transport: unknown | null = null;
  private app: {
    getWalletPublicKey: (
      path: string,
      opts?: { verify?: boolean; format?: 'legacy' | 'p2sh' | 'bech32' | 'bech32m' | 'cashaddr' }
    ) => Promise<{ publicKey: string; bitcoinAddress: string; chainCode: string }>;
    signMessage: (
      path: string,
      messageHex: string
    ) => Promise<{ v: number; r: string; s: string }>;
  } | null = null;
  private account: LedgerWalletAccount | null = null;

  static getRelativeDerivationPath(accountIndex = 0): string {
    return `44'/3'/${normalizeAccountIndex(accountIndex)}'/0/0`;
  }

  static getDerivationPath(accountIndex = 0): string {
    return `m/${LedgerWallet.getRelativeDerivationPath(accountIndex)}`;
  }

  static getPersistedAccountIndex(): number {
    if (typeof localStorage === 'undefined') {
      return 0;
    }

    const raw = localStorage.getItem(LEDGER_ACCOUNT_INDEX_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  static async isSupported(): Promise<boolean> {
    if (typeof navigator === 'undefined' || typeof window === 'undefined' || !('usb' in navigator)) {
      return false;
    }

    const { default: TransportWebUSB } = await import('@ledgerhq/hw-transport-webusb');
    return TransportWebUSB.isSupported();
  }

  getAccount(): LedgerWalletAccount | null {
    return this.account;
  }

  async connect(options?: {
    accountIndex?: number;
    verify?: boolean;
    promptUser?: boolean;
  }): Promise<LedgerWalletAccount> {
    const accountIndex = normalizeAccountIndex(
      options?.accountIndex ?? LedgerWallet.getPersistedAccountIndex()
    );
    const promptUser = options?.promptUser ?? true;
    const verify = options?.verify ?? promptUser;

    try {
      const transport = await this.ensureTransport(promptUser);
      await this.assertDogecoinAppOpen(transport);
      const app = await this.ensureApp(transport);
      const result = await app.getWalletPublicKey(
        LedgerWallet.getRelativeDerivationPath(accountIndex),
        {
          verify,
          format: 'legacy',
        }
      );

      const publicKey = result.publicKey;
      const address = getP2PKHAddressFromPublicKey(hexToBytes(publicKey), 'doge');

      const account: LedgerWalletAccount = {
        address,
        publicKey,
        network: 'mainnet',
        accountIndex,
        derivationPath: LedgerWallet.getDerivationPath(accountIndex),
      };

      this.account = account;
      this.persistAccountIndex(accountIndex);
      return account;
    } catch (error) {
      if (!promptUser) {
        await this.disconnect();
      }
      const message = error instanceof Error ? error.message : 'Unknown Ledger connection error';
      throw new Error(`Failed to connect Ledger wallet: ${message}`);
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!message) {
      throw new Error('Message is required');
    }

    const account =
      this.account ??
      (await this.connect({
        accountIndex: LedgerWallet.getPersistedAccountIndex(),
        verify: false,
        promptUser: false,
      }));

    const app = await this.ensureApp(await this.ensureTransport(false));
    const signature = await app.signMessage(
      LedgerWallet.getRelativeDerivationPath(account.accountIndex),
      bytesToHex(new TextEncoder().encode(message))
    );

    return signatureToBase64(signature);
  }

  async switchAccount(accountIndex: number): Promise<LedgerWalletAccount> {
    return this.connect({
      accountIndex,
      verify: true,
      promptUser: this.transport === null,
    });
  }

  async disconnect(): Promise<void> {
    const transport = this.transport as { close?: () => Promise<void> } | null;
    this.transport = null;
    this.app = null;
    this.account = null;

    if (transport?.close) {
      try {
        await transport.close();
      } catch {
        // Ignore transport close failures during disconnect cleanup.
      }
    }
  }

  private async ensureTransport(promptUser: boolean): Promise<unknown> {
    if (this.transport) {
      return this.transport;
    }

    const { default: TransportWebUSB } = await import('@ledgerhq/hw-transport-webusb');
    const transport = promptUser
      ? await TransportWebUSB.request()
      : await TransportWebUSB.openConnected();

    if (!transport) {
      throw new Error('Connect your Ledger device and authorize WebUSB access');
    }

    this.transport = transport;
    return transport;
  }

  private async ensureApp(transport: unknown): Promise<NonNullable<LedgerWallet['app']>> {
    if (this.app) {
      return this.app;
    }

    const { default: Btc } = await import('@ledgerhq/hw-app-btc');
    this.app = new Btc({
      transport: transport as ConstructorParameters<typeof Btc>[0]['transport'],
      currency: 'dogecoin',
    });
    return this.app;
  }

  private async assertDogecoinAppOpen(transport: unknown): Promise<void> {
    try {
      const { getAppAndVersion } = await import('@ledgerhq/hw-app-btc/lib/getAppAndVersion.js');
      const app = await getAppAndVersion(
        transport as Parameters<typeof getAppAndVersion>[0]
      );
      if (!DOGECOIN_APP_NAME_RE.test(app.name)) {
        throw new Error(
          `Open the Ledger Dogecoin app before connecting (detected "${app.name}")`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Open the Ledger Dogecoin app')) {
        throw error;
      }
      // Older app versions may not expose app metadata cleanly over WebUSB.
    }
  }

  private persistAccountIndex(accountIndex: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(LEDGER_ACCOUNT_INDEX_STORAGE_KEY, String(accountIndex));
  }
}
