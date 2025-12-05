/**
 * Type declarations for external packages without TypeScript definitions
 */

declare module 'hdkey' {
  interface HDKey {
    publicKey: Buffer;
    privateKey: Buffer | null;
    chainCode: Buffer;
    derive(path: string): HDKey;
    deriveChild(index: number): HDKey;
    toJSON(): { xpriv: string; xpub: string };
  }

  interface HDKeyStatic {
    fromMasterSeed(seed: Buffer): HDKey;
    fromExtendedKey(key: string): HDKey;
    fromJSON(obj: { xpriv?: string; xpub?: string }): HDKey;
  }

  const hdkey: HDKeyStatic;
  export = hdkey;
}

declare module 'bitcore-lib-doge' {
  export const Networks: {
    mainnet: any;
    testnet: any;
    defaultNetwork: any;
    get(name: string): any;
    add(network: any): any;
  };

  export class PrivateKey {
    constructor(data?: string | Buffer, network?: any);
    static fromWIF(wif: string): PrivateKey;
    static fromString(str: string): PrivateKey;
    static fromBuffer(buf: Buffer): PrivateKey;
    toWIF(): string;
    toAddress(): Address;
    toPublicKey(): PublicKey;
    toString(): string;
    toBuffer(): Buffer;
    readonly publicKey: PublicKey;
    readonly network: any;
  }

  export class PublicKey {
    constructor(data?: string | Buffer | PrivateKey);
    static fromPrivateKey(privateKey: PrivateKey): PublicKey;
    static fromBuffer(buf: Buffer): PublicKey;
    static fromString(str: string): PublicKey;
    toAddress(network?: any): Address;
    toString(): string;
    toBuffer(): Buffer;
    toDER(): Buffer;
  }

  export class Address {
    constructor(data?: string | Buffer | PublicKey | any, network?: any, type?: string);
    static fromPublicKey(publicKey: PublicKey, network?: any): Address;
    static fromString(str: string): Address;
    static fromBuffer(buf: Buffer): Address;
    toString(): string;
    toBuffer(): Buffer;
    readonly network: any;
    readonly type: string;
  }

  export class HDPrivateKey {
    constructor(data?: string | Buffer | any);
    static fromSeed(seed: Buffer, network?: any): HDPrivateKey;
    static fromString(str: string): HDPrivateKey;
    derive(path: string | number): HDPrivateKey;
    deriveChild(index: number): HDPrivateKey;
    readonly privateKey: PrivateKey;
    readonly publicKey: PublicKey;
    readonly xprivkey: string;
    readonly xpubkey: string;
    readonly network: any;
  }

  export class HDPublicKey {
    constructor(data?: string | any);
    static fromString(str: string): HDPublicKey;
    derive(path: string | number): HDPublicKey;
    deriveChild(index: number): HDPublicKey;
    readonly publicKey: PublicKey;
    readonly xpubkey: string;
    readonly network: any;
  }

  export class Message {
    constructor(message: string);
    sign(privateKey: PrivateKey): string;
    verify(address: string | Address, signature: string): boolean;
    static sign(message: string, privateKey: PrivateKey): string;
    static verify(message: string, address: string | Address, signature: string): boolean;
  }

  export class Transaction {
    constructor(serialized?: string | Buffer | any);
    from(utxo: any | any[]): Transaction;
    to(address: string | Address, amount: number): Transaction;
    change(address: string | Address): Transaction;
    fee(amount: number): Transaction;
    feePerKb(amount: number): Transaction;
    sign(privateKey: PrivateKey | PrivateKey[] | string | string[]): Transaction;
    serialize(): string;
    toBuffer(): Buffer;
    readonly inputs: any[];
    readonly outputs: any[];
    readonly id: string;
    readonly hash: string;
  }

  export class Script {
    constructor(data?: string | Buffer | any);
    static buildPublicKeyHashOut(address: string | Address): Script;
    static fromAddress(address: string | Address): Script;
    toBuffer(): Buffer;
    toString(): string;
    toHex(): string;
  }

  export const crypto: {
    Hash: {
      sha256(data: Buffer): Buffer;
      sha256sha256(data: Buffer): Buffer;
      sha256ripemd160(data: Buffer): Buffer;
      ripemd160(data: Buffer): Buffer;
    };
    Signature: any;
  };

  export const encoding: {
    Base58: any;
    Base58Check: any;
  };

  export const util: {
    buffer: any;
    preconditions: any;
  };
}
