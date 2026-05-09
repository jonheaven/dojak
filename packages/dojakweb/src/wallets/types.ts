// Wallet adapter interface for extensible wallet support

export interface WalletAdapter {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly supportedChains: string[];

  // Connection methods
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;

  // Transaction methods
  signMessage(message: string): Promise<string>;
  signTransaction(tx: any): Promise<string>;

  // Balance/Token methods
  getAddress(): Promise<string>;
  getBalance(): Promise<string>;
  getDRC20Tokens(): Promise<DRC20Token[]>;
  getInscriptions(): Promise<WalletInscription[]>;

  // Events
  on(event: 'connect' | 'disconnect' | 'accountChanged', handler: (data?: any) => void): void;
  off(event: 'connect' | 'disconnect' | 'accountChanged', handler: (data?: any) => void): void;
}

export interface WalletConnection {
  address: string;
  publicKey?: string;
  connected: boolean;
}

export interface DRC20Token {
  ticker: string;
  balance: string;
  transferable: string;
  available: string;
  inscriptionId?: string;
}

export interface WalletInscription {
  inscriptionId: string;
  inscriptionNumber: number;
  content: string;
  contentType: string;
  timestamp: number;
  outputValue: string;
  address: string;
}

export interface WalletConfig {
  id: string;
  name: string;
  adapter: new () => WalletAdapter;
  enabled: boolean;
  priority: number; // Higher priority = preferred default
}
