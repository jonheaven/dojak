/**
 * Dojak Wallet - Dogecoin Native Keyring Types
 * Purpose-built for Dogecoin, not patched Bitcoin code
 */
import { Network } from 'bitcoinjs-lib';

export interface DogecoinAccount {
  address: string;
  publicKey: string;
  index?: number;
}

export interface SerializedHdKeyring {
  type: 'HD Key Tree';
  mnemonic: string;
  hdPath: string;
  passphrase: string;
  activeIndexes: number[];
}

export interface SerializedSimpleKeyring {
  type: 'Simple Key Pair';
  privateKeys: string[];
}

export type SerializedKeyring = SerializedHdKeyring | SerializedSimpleKeyring;

export interface KeyringInterface {
  type: string;

  // Serialization
  serialize(): Promise<SerializedKeyring>;
  deserialize(opts: any): Promise<void>;

  // Account management
  getAccounts(): Promise<string[]>;
  addAccounts(count: number): Promise<string[]>;
  removeAccount?(address: string): void;

  // Address derivation
  getAddressFromPublicKey(publicKeyHex: string): string;

  // Signing
  signTransaction(psbt: any, inputs: ToSignInput[]): Promise<any>;
  signMessage(address: string, message: string): Promise<string>;
  verifyMessage(address: string, message: string, signature: string): Promise<boolean>;

  // Export
  exportAccount(address: string): Promise<string>;

  // Network
  setNetwork(network: DogecoinNetworkType): void;
}

export interface ToSignInput {
  index: number;
  publicKey: string;
  sighashTypes?: number[];
  disableTweakSigner?: boolean;
}

export type DogecoinNetworkType = 'mainnet' | 'testnet';

export interface DogecoinNetworkConfig {
  messagePrefix: string;
  bech32: string;
  bip32: {
    public: number;
    private: number;
  };
  pubKeyHash: number;
  scriptHash: number;
  wif: number;
}

export const KEYRING_TYPE = {
  HdKeyring: 'HD Key Tree',
  SimpleKeyring: 'Simple Key Pair',
  KeystoneKeyring: 'Keystone',
  ColdWalletKeyring: 'Cold Wallet',
  Empty: 'Empty'
} as const;

export type KeyringType = (typeof KEYRING_TYPE)[keyof typeof KEYRING_TYPE];
