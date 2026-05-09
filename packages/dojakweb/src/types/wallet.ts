declare global {
  interface Window {
    doge?: {
      isMyDoge: boolean;
      connect: () => Promise<{ approved: boolean; address: string }>;
      disconnect: () => Promise<{ disconnected: boolean }>;
      getConnectionStatus: () => Promise<{ connected: boolean }>;
      getCurrentAddress?: () => Promise<{ address: string }>;
      getBalance: () => Promise<{ balance: string }>;
      requestTransaction: (params: { recipientAddress: string; dogeAmount: number }) => Promise<{ txId: string }>;
      getTransactionStatus: (params: { txId: string }) => Promise<{ status: string; confirmations: number }>;
      requestSignedMessage: (params: { message: string }) => Promise<{ signature: string }>;
      requestPsbt?: (params: {
        rawTx: string;
        indexes: number[];
        signOnly?: boolean;
        partial?: boolean;
        sighashType?: number;
      }) => Promise<{ signedTx?: string; signedRawTx?: string; signedPsbt?: string; txHex?: string }>;
      signRequest?: (params: {
        message?: string;
        rawTx?: string;
        psbtHex?: string;
        psbtBase64?: string;
        indexes?: number[];
        signOnly?: boolean;
        partial?: boolean;
        sighashType?: number;
      }) => Promise<{ signedTx?: string; signedRawTx?: string; signedPsbt?: string; txHex?: string } | string>;
      requestInscriptionTransaction: (params: { recipientAddress: string; location: string }) => Promise<{ txId: string }>;
      signPSBT?: (params: { psbtHex: string; indexes: number[] }) => Promise<{
        signedRawTx?: string;
        signedPsbt?: string;
      }>;
    };
    mydoge?: {
      isMyDoge: boolean;
      connect: () => Promise<{ approved: boolean; address: string }>;
      disconnect: () => Promise<{ disconnected: boolean }>;
      getConnectionStatus: () => Promise<{ connected: boolean }>;
      getCurrentAddress?: () => Promise<{ address: string }>;
      getAddress?: () => Promise<string>;
      getBalance: () => Promise<{ balance: string }>;
      requestTransaction: (params: { recipientAddress: string; dogeAmount: number }) => Promise<{ txId: string }>;
      getTransactionStatus: (params: { txId: string }) => Promise<{ status: string; confirmations: number }>;
      requestSignedMessage: (params: { message: string }) => Promise<{ signature: string }>;
      requestPsbt?: (params: {
        rawTx: string;
        indexes: number[];
        signOnly?: boolean;
        partial?: boolean;
        sighashType?: number;
      }) => Promise<{ signedTx?: string; signedRawTx?: string; signedPsbt?: string; txHex?: string }>;
      signRequest?: (params: {
        message?: string;
        rawTx?: string;
        psbtHex?: string;
        psbtBase64?: string;
        indexes?: number[];
        signOnly?: boolean;
        partial?: boolean;
        sighashType?: number;
      }) => Promise<{ signedTx?: string; signedRawTx?: string; signedPsbt?: string; txHex?: string } | string>;
      signPsbt?: (tx: any) => Promise<any>;
      requestInscriptionTransaction: (params: { recipientAddress: string; location: string }) => Promise<{ txId: string }>;
      signPSBT?: (params: { psbtHex: string; indexes: number[] }) => Promise<{
        signedRawTx?: string;
        signedPsbt?: string;
        signedTx?: string;
        txHex?: string;
      }>;
    };

    dogecoin?: {
      isSpookyWallet?: boolean;
      isConnected?: () => boolean;
      connect?: () => Promise<{ approved?: boolean; connected?: boolean; address?: string; accounts?: string[] }>;
      disconnect?: () => Promise<{ disconnected?: boolean }>;
      getAccounts?: () => Promise<string[]>;
      request?: (args: { method: string; params?: any }) => Promise<any>;
      getAddress?: () => Promise<string>;
      getBalance?: () => Promise<{ balance?: string; confirmed?: number; total?: number }>;
      sendTransaction?: (params: { recipientAddress: string; dogeAmount: number }) => Promise<{ txId?: string; txid?: string }>;
      getTransactionStatus?: (params: { txId: string }) => Promise<{ status: string; confirmations: number }>;
      signMessage?: (message: string) => Promise<string>;
      signPsbt?: (params: {
        rawTx: string;
        indexes: number[];
        signOnly?: boolean;
        partial?: boolean;
      }) => Promise<{ signedTx?: string; signedRawTx?: string; signedPsbt?: string }>;
      signRequest?: (params: {
        rawTx?: string;
        psbtHex?: string;
        psbtBase64?: string;
        indexes?: number[];
        signOnly?: boolean;
        partial?: boolean;
      }) => Promise<{ signedTx?: string; signedRawTx?: string; signedPsbt?: string } | string>;
      signPsbts?: (params: { psbts: string[]; [key: string]: unknown }) => Promise<{ signedPsbts?: string[] } | string[]>;
      sendDoginal?: (params: Record<string, unknown>) => Promise<any>;
      sendDrc20?: (params: Record<string, unknown>) => Promise<any>;
      batchSendDrc20?: (params: Record<string, unknown>) => Promise<any>;
      sendDune?: (params: Record<string, unknown>) => Promise<any>;
      sendDuneMulti?: (params: Record<string, unknown>) => Promise<any>;
      batchSendDune?: (params: Record<string, unknown>) => Promise<any>;
      getDoginals?: (params?: Record<string, unknown>) => Promise<any>;
      getDrc20Balances?: () => Promise<any>;
      getDunesBalances?: () => Promise<any>;
      getCharmsBalances?: () => Promise<any>;
      sendCharms?: (params: Record<string, unknown>) => Promise<any>;
      signCharmsTransaction?: (params: Record<string, unknown>) => Promise<any>;
      signPSBT?: (params: { psbtHex: string; indexes: number[] }) => Promise<{
        signedRawTx?: string;
        signedPsbt?: string;
        signedTx?: string;
        txHex?: string;
      }>;
      on?: (event: string, callback: (data?: any) => void) => void;
      removeListener?: (event: string, callback: (data?: any) => void) => void;
    };

    dojak?: {
      isDojak: boolean;
      request: (args: { method: string; params?: any }) => Promise<any>;
      requestAccounts: () => Promise<string[]>;
      getAccounts: () => Promise<string[]>;
      disconnect: () => Promise<void>;
      getBalance: () => Promise<{ confirmed: number; unconfirmed: number; total: number }>;
      signMessage: (text: string, type?: string) => Promise<string>;
      signPsbt: (psbtHex: string, options?: any) => Promise<string>;
      signRequest?: (params: {
        rawTx?: string;
        psbtHex?: string;
        psbtBase64?: string;
        indexes?: number[];
        signOnly?: boolean;
        partial?: boolean;
      }) => Promise<string>;
      sendBitcoin: (toAddress: string, satoshis: number, options?: any) => Promise<string>;
      sendInscription: (toAddress: string, inscriptionId: string, options?: any) => Promise<string>;
      getInscriptions: (cursor?: number, size?: number) => Promise<any>;
      on: (event: string, callback: (data?: any) => void) => void;
      removeListener: (event: string, callback: (data?: any) => void) => void;
    };
  }
}

export type WalletType = 'browser' | 'mydoge' | 'spookydoge' | 'dojak' | 'ledger';
export type WalletMode = 'dojak' | 'local_browser_wallet';
export type NetworkType = 'mainnet' | 'testnet' | 'regtest';
export type WalletSource = 'generated' | 'mnemonic' | 'privateKey' | 'ledger';

export interface WalletConnectionSummary {
  type: WalletType;
  label: string;
  connected: boolean;
  address: string | null;
  balance: number;
  balanceVerified: boolean;
  balanceRefreshing: boolean;
  connecting: boolean;
  accountIndex: number | null;
  derivationPath: string | null;
  isActive: boolean;
}

export interface SeedMaterial {
  mnemonic: string;
  passphrase?: string;
}

export interface WalletData {
  address: string;
  privateKey: string;
  network: NetworkType;
  nickname?: string;
  createdAt?: number;
  accountIndex?: number;
  derivationPath?: string;
  seedFingerprint?: string;
  mnemonicWordCount?: number;
  walletSource?: WalletSource;
  publicKey?: string;
}

export type MarketplaceIntentType =
  | 'listing_buy'
  | 'offer_create'
  | 'offer_cancel'
  | 'bid_place'
  | 'bid_cancel'
  | 'auction_settle';

export interface IntentPayload {
  intentType: MarketplaceIntentType;
  nonce: string;
  expiresAt: string;
  network: NetworkType;
  chainId: string;
  address: string;
  [key: string]: unknown;
}

export interface SignedIntent {
  signature: string;
  signingAddress: string;
  signedAt: string;
  payloadHash: string;
}

export type DmpIntentType = 'listing' | 'bid' | 'settle' | 'cancel';

export interface DmpIntentCommonParams {
  address?: string;
  nonce?: number;
}

export interface DmpListingIntentParams extends DmpIntentCommonParams {
  price_koinu: number;
  psbt_cid: string;
  expiry_height: number;
}

export interface DmpBidIntentParams extends DmpIntentCommonParams {
  listing_id: string;
  price_koinu: number;
  psbt_cid: string;
  expiry_height: number;
}

export interface DmpSettleIntentParams extends DmpIntentCommonParams {
  listing_id: string;
  psbt_cid: string;
  bid_id?: string;
}

export interface DmpCancelIntentParams extends DmpIntentCommonParams {
  listing_id: string;
}

export interface DmpIntentParamsMap {
  listing: DmpListingIntentParams;
  bid: DmpBidIntentParams;
  settle: DmpSettleIntentParams;
  cancel: DmpCancelIntentParams;
}

export type DmpIntentParams<T extends DmpIntentType = DmpIntentType> = DmpIntentParamsMap[T];

export interface SignedDmpIntentBase {
  protocol: 'DMP';
  version: '1.0';
  seller: string;
  nonce: number;
  signature: string;
}

export interface SignedDmpListingIntent extends SignedDmpIntentBase {
  op: 'listing';
  price_koinu: number;
  psbt_cid: string;
  expiry_height: number;
}

export interface SignedDmpBidIntent extends SignedDmpIntentBase {
  op: 'bid';
  listing_id: string;
  price_koinu: number;
  psbt_cid: string;
  expiry_height: number;
}

export interface SignedDmpSettleIntent extends SignedDmpIntentBase {
  op: 'settle';
  listing_id: string;
  psbt_cid: string;
  bid_id?: string;
}

export interface SignedDmpCancelIntent extends SignedDmpIntentBase {
  op: 'cancel';
  listing_id: string;
}

export interface SignedDmpIntentMap {
  listing: SignedDmpListingIntent;
  bid: SignedDmpBidIntent;
  settle: SignedDmpSettleIntent;
  cancel: SignedDmpCancelIntent;
}

export type SignedDmpIntent<T extends DmpIntentType = DmpIntentType> = SignedDmpIntentMap[T];

export type DmpIntentSigner = <T extends DmpIntentType>(
  intentType: T,
  params: DmpIntentParams<T>
) => Promise<SignedDmpIntent<T>>;

export interface MarketplaceSigner {
  mode: WalletMode;
  connect(): Promise<{ address: string }>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string | null>;
  signMessage(message: string): Promise<string>;
  signPSBT(psbtBase64: string): Promise<string>;
  signIntent<T extends Record<string, unknown>>(intent: T): Promise<string>;
}

export interface UnifiedWalletContextValue {
  walletType: WalletType | null;
  connected: boolean;
  address: string | null;
  balance: number;
  balanceVerified: boolean; // Track if balance has been verified from API
  connecting: boolean;
  accountIndex: number | null;
  derivationPath: string | null;
  availableWallets: WalletConnectionSummary[];
  connect: (type: WalletType) => Promise<void>;
  setActiveWallet: (type: WalletType) => void;
  refreshBalance: () => Promise<void>;
  balanceRefreshing: boolean;
  balanceError: string | null;
  switchAccount: (accountIndex: number, password?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (recipientAddress: string, amount: number) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  signPSBT: (psbtHex: string) => Promise<string>;
  signPSBTOnly: (psbtHex: string) => Promise<string>;
  signDMPIntent: DmpIntentSigner;
  sendInscription: (recipientAddress: string, location: string) => Promise<string>;
  getTransactionStatus: (txId: string) => Promise<{ status: string; confirmations: number }>;
  // Browser wallet specific
  createBrowserWallet: () => Promise<WalletData>;
  importBrowserWallet: (privateKey: string) => Promise<WalletData>;
  importBrowserWalletFromMnemonic: (mnemonic: string, passphrase?: string) => Promise<WalletData>;
  saveBrowserWallet: (wallet: WalletData, password?: string, options?: { seedMaterial?: SeedMaterial | null }) => Promise<void>;
  loadBrowserWallet: (password?: string) => Promise<WalletData | null>;
  loadBrowserSeedMaterial: (password?: string) => Promise<SeedMaterial | null>;
  hasBrowserWallet: () => Promise<boolean>;
  removeBrowserWallet: () => Promise<void>;
}

export {};
