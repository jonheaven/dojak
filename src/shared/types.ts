import { AddressType, ChainType } from '@unisat/wallet-types';

import { PaymentChannelType } from './constant';

export { AddressType } from '@unisat/wallet-types';

export enum NetworkType {
  MAINNET,
  TESTNET
}

export enum RestoreWalletType {
  dojak,
  SPARROW,
  XVERSE,
  OW,
  OTHERS
}

/**
 * Sign data type
 * @enum {number}
 * @readonly
 * @enum {number}
 * @readonly
 */
export enum CosmosSignDataType {
  COSMOS_AMINO = 1,
  COSMOS_DIRECT = 2
}

export interface Chain {
  name: string;
  logo: string;
  enum: ChainType;
  network: string;
}

export interface BitcoinBalance {
  confirm_amount: string;
  pending_amount: string;
  amount: string;
  confirm_btc_amount: string;
  pending_btc_amount: string;
  btc_amount: string;
  confirm_inscription_amount: string;
  pending_inscription_amount: string;
  inscription_amount: string;
  usd_value: string;
}

export interface AddressAssets {
  total_btc: string;
  satoshis?: number;
  total_inscription: number;
}

export interface TxHistoryInOutItem {
  address: string;
  value: number;
  inscriptions: { inscriptionId: string }[];
  dunes: { spacedDune: string; symbol: string; divisibility: number; amount: string }[];
  drc20: { ticker: string; amount: string }[];
}

export interface TxHistoryItem {
  txid: string;
  confirmations: number;
  height: number;
  timestamp: number;
  size: number;
  feeRate: number;
  fee: number;
  outputValue: number;
  vin: TxHistoryInOutItem[];
  vout: TxHistoryInOutItem[];
  types: string[];
  methods: string[];
}

export interface Inscription {
  inscriptionId: string;
  inscriptionNumber: number;
  address: string;
  outputValue: number;
  preview: string;
  content: string;
  contentType: string;
  contentLength: number;
  timestamp: number;
  genesisTransaction: string;
  location: string;
  output: string;
  offset: number;
  contentBody: string;
  utxoHeight: number;
  utxoConfirmation: number;
  drc20?: {
    op: string;
    tick: string;
    lim: string;
    amt: string;
    decimal: string;
  };
  multipleNFT?: boolean;
  sameOffset?: boolean;
  children?: string[];
  parents?: string[];
}

export interface Atomical {
  atomicalId: string;
  atomicalNumber: number;
  type: 'FT' | 'NFT';
  ticker?: string;
  atomicalValue: number;

  // mint info
  address: string;
  outputValue: number;
  preview: string;
  content: string;
  contentType: string;
  contentLength: number;
  timestamp: number;
  genesisTransaction: string;
  location: string;
  output: string;
  offset: number;
  contentBody: string;
  utxoHeight: number;
  utxoConfirmation: number;
}

export interface InscriptionMintedItem {
  title: string;
  desc: string;
  inscriptions: Inscription[];
}

export interface InscriptionSummary {
  mintedList: InscriptionMintedItem[];
}

export interface AppInfo {
  logo: string;
  title: string;
  desc: string;
  route?: string;
  url: string;
  time: number;
  id: number;
  tag?: string;
  readtime?: number;
  new?: boolean;
  tagColor?: string;
}

export interface AppSummary {
  apps: AppInfo[];
  readTabTime?: number;
}

export interface FeeSummary {
  list: {
    title: string;
    desc: string;
    feeRate: number;
  }[];
}

export interface CoinPrice {
  btc: number;
  fb: number;
}

export interface UTXO {
  txid: string;
  vout: number;
  satoshis: number;
  scriptPk: string;
  addressType: AddressType;
  inscriptions: {
    inscriptionId: string;
    inscriptionNumber?: number;
    offset: number;
  }[];
  atomicals: {
    // deprecated
    atomicalId: string;
    atomicalNumber: number;
    type: 'NFT' | 'FT';
    ticker?: string;
    atomicalValue?: number;
  }[];

  dunes: {
    runeid: string;
    rune: string;
    amount: string;
  }[];
}

export interface UTXO_Detail {
  txId: string;
  outputIndex: number;
  satoshis: number;
  scriptPk: string;
  addressType: AddressType;
  inscriptions: Inscription[];
}

export enum TxType {
  SIGN_TX,
  SEND_BITCOIN,
  SEND_doginals_INSCRIPTION,
  SEND_ATOMICALS_INSCRIPTION, // deprecated
  SEND_DUNES,
  SEND_Charms
}

interface BaseUserToSignInput {
  index: number;
  sighashTypes: number[] | undefined;
  useTweakedSigner?: boolean;
  disableTweakSigner?: boolean;
  tapLeafHashToSign?: string;
}

export interface AddressUserToSignInput extends BaseUserToSignInput {
  address: string;
}

export interface PublicKeyUserToSignInput extends BaseUserToSignInput {
  publicKey: string;
}

export type UserToSignInput = AddressUserToSignInput | PublicKeyUserToSignInput;

export interface SignPsbtOptions {
  autoFinalized: boolean;
  toSignInputs?: UserToSignInput[];
  contracts?: any[];
}

export interface ToSignInput {
  index: number;
  publicKey: string;
  sighashTypes?: number[];
  tapLeafHashToSign?: Buffer;
}

export type WalletKeyring = {
  key: string;
  index: number;
  type: string;
  addressType: AddressType;
  accounts: Account[];
  alianName: string;
  hdPath: string;
};

export interface Account {
  type: string;
  pubkey: string;
  address: string;
  brandName?: string;
  alianName?: string;
  displayBrandName?: string;
  index?: number;
  balance?: number;
  key: string;
  flag: number;
}

export interface InscribeOrder {
  orderId: string;
  payAddress: string;
  totalFee: number;
  minerFee: number;
  originServiceFee: number;
  serviceFee: number;
  outputValue: number;
}

export interface TokenBalance {
  availableBalance: string;
  overallBalance: string;
  ticker: string;
  transferableBalance: string;
  availableBalanceSafe: string;
  availableBalanceUnSafe: string;
  selfMint: boolean;
  displayName?: string;
  tag?: string;
  swapBalance?: string;
  progBalance?: string;
}

export interface Arc20Balance {
  ticker: string;
  balance: number;
  confirmedBalance: number;
  unconfirmedBalance: number;
}

export interface TokenInfo {
  totalSupply: string;
  totalMinted: string;
  decimal: number;
  holder: string;
  inscriptionId: string;
  selfMint?: boolean;
  holdersCount: number;
  historyCount: number;
  logo: string;
}

export enum TokenInscriptionType {
  INSCRIBE_TRANSFER,
  INSCRIBE_MINT
}

export interface TokenTransfer {
  ticker: string;
  amount: string;
  inscriptionId: string;
  inscriptionNumber: number;
  timestamp: number;
  confirmations: number;
  satoshi: number;
}

export interface AddressTokenSummary {
  tokenInfo: TokenInfo;
  tokenBalance: TokenBalance;
  historyList: TokenTransfer[];
  transferableList: TokenTransfer[];
}

export enum RiskType {
  SIGHASH_NONE,
  SCAMMER_ADDRESS,
  NETWORK_NOT_MATCHED,
  INSCRIPTION_BURNING,
  ATOMICALS_DISABLE, // deprecated
  ATOMICALS_NFT_BURNING, // deprecated
  ATOMICALS_FT_BURNING, // deprecated
  MULTIPLE_ASSETS,
  LOW_FEE_RATE,
  HIGH_FEE_RATE,
  SPLITTING_INSCRIPTIONS,
  MERGING_INSCRIPTIONS,
  CHANGING_INSCRIPTION,
  DUNES_BURNING,
  DUNES_MULTIPLE_ASSETS,
  INDEXER_API_DOWN,
  ATOMICALS_API_DOWN, // deprecated
  DUNES_API_DOWN,
  Charms_BURNING,
  Charms_MULTIPLE_ASSETS,
  UTXO_INDEXING
}

export interface Risk {
  type: RiskType;
  level: 'danger' | 'warning' | 'critical';
  title: string;
  desc: string;
}

export interface DecodedPsbt {
  inputInfos: {
    txid: string;
    vout: number;
    address: string;
    value: number;
    inscriptions: Inscription[];
    sighashType: number;
    dunes: DuneBalance[];
    Charms: CharmsBalance[];
    contract?: ContractResult;
  }[];
  outputInfos: {
    address: string;
    value: number;
    inscriptions: Inscription[];
    dunes: DuneBalance[];
    Charms: CharmsBalance[];
    contract?: ContractResult;
  }[];
  inscriptions: { [key: string]: Inscription };
  feeRate: number;
  fee: number;
  features: {
    rbf: boolean;
  };
  risks: Risk[];
  isScammer: boolean;
  recommendedFeeRate: number;
  shouldWarnFeeRate: boolean;
}

export interface ToAddressInfo {
  address: string;
  domain?: string;
  inscription?: Inscription;
}

export interface RawTxInfo {
  psbtHex: string;
  rawtx: string;
  toAddressInfo?: ToAddressInfo;
  fee?: number;
}

export interface WalletConfig {
  version: string;
  moonPayEnabled: boolean;
  statusMessage: string;
  endpoint: string;
  chainTip: string;
  disableUtxoTools: boolean;
}

export enum WebsiteState {
  CHECKING,
  SCAMMER,
  SAFE
}

export interface AddressSummary {
  address: string;
  totalSatoshis: number;
  btcSatoshis: number;
  assetSatoshis: number;
  inscriptionCount: number;
  drc20Count: number;
  drc20Count5Byte: number;
  drc20Count6Byte: number;
  dunesCount: number;
  loading?: boolean;
}

export interface VersionDetail {
  version: string;
  title: string;
  changelogs: string[];
  notice: string;
}

export interface DuneBalance {
  amount: string;
  duneid: string;
  dune: string;
  spacedDune: string;
  symbol: string;
  divisibility: number;
}

export interface DuneInfo {
  duneid: string;
  dune: string;
  spacedDune: string;
  number: number;
  height: number;
  txidx: number;
  timestamp: number;
  divisibility: number;
  symbol: string;
  etching: string;
  premine: string;
  terms: {
    amount: string;
    cap: string;
    heightStart: number;
    heightEnd: number;
    offsetStart: number;
    offsetEnd: number;
  };
  mints: string;
  burned: string;
  holders: number;
  transactions: number;
  mintable: boolean;
  remaining: string;
  start: number;
  end: number;
  supply: string;
  parent?: string;
  logo?: string;
}

export interface AddressDunesTokenSummary {
  duneInfo: DuneInfo;
  duneBalance: DuneBalance;
  duneLogo?: Inscription;
}

export interface DogeChannelItem {
  channel: PaymentChannelType;
  quote: number;
  payType: string[];
}

export type TickPriceItem = {
  curPrice: number;
  changePercent: number;
};

export interface WebsiteResult {
  isScammer: boolean;
  warning: string;
  allowQuickMultiSign: boolean;
}

export interface CAT721Balance {
  collectionId: string;
  name: string;
  count: number;
  previewLocalIds: string[];
  contentType: string;
}

export interface CharmsBalance {
  charmsid: string;
  amount: string;
  name: string;
  symbol: string;
  divisibility: number;
  available: string;
}

export interface CharmsInfo {
  charmsid: string;
  name: string;
  symbol: string;
  spacers?: number;
  divisibility?: number;
  height?: number;
  totalSupply: string;
  cap: number;
  minted: number;
  mintable: boolean;
  perMint: string;
  holders: number;
  timestamp?: number;
  type?: string;
  maxSupply?: string;
  premine?: string;
  aligned?: boolean;
  nftData?: {
    collectionId: string;
    attributes?: any;
    contentType?: string;
    image?: string;
    contentUrl?: string;
  };
  logo?: string;
  collectionData?: {
    holders: number;
  };
}

export interface AddressCharmsTokenSummary {
  tokenInfo: CharmsInfo;
  tokenBalance: CharmsBalance;
  tradeUrl?: string;
  mintUrl?: string;
}

export interface CharmsCollection {
  charmsid: string;
  name: string;
  count: number;
  image: string;
}

export interface CAT721CollectionInfo {
  collectionId: string;
  name: string;
  symbol: string;
  max: string;
  premine: string;
  description: string;
  contentType: string;
}

export interface AddressCAT721CollectionSummary {
  collectionInfo: CAT721CollectionInfo;
  localIds: string[];
}

export interface BitcoinBalanceV2 {
  availableBalance: number;
  unavailableBalance: number;
  totalBalance: number;
}

export interface SteakAddressSummary {
  address: string;
  stakedBalance: number; // Amount of DOGE staked
  rewardBalance: number; // Accumulated rewards
  lockTimeRemaining: number; // Seconds until unlock
  apy: number; // Current APY percentage
  stakeTier: 'bronze' | 'silver' | 'gold' | 'diamond'; // Based on amount/time
}

export interface SteakTxInfo {
  toAddress: string; // Multisig staking address
  amount: number; // DOGE amount to stake
  lockPeriod: number; // Lock period in days
  expectedApy: number; // Expected APY
}

export interface ContractResult {
  id: string;
  name: string;
  description: string;
  address: string;
  script: string;
  isOwned: boolean;
}

export interface RequestMethodSendBitcoinParams {
  sendBitcoinParams: {
    toAddress: string;
    satoshis: number;
    feeRate?: number;
    memo?: string;
    memos?: string[];
  };
  type: TxType;
}

export interface RequestMethodSendInscriptionParams {
  sendInscriptionParams: {
    toAddress: string;
    inscriptionId: string;
    feeRate: number | undefined;
  };
  type: TxType;
}

export interface RequestMethodSignPsbtParams {
  sendInscriptionParams: {
    toAddress: string;
    inscriptionId: string;
    feeRate: number | undefined;
  };
  type: TxType;
}

export interface RequestMethodSendDunesParams {
  sendDunesParams: {
    toAddress: string;
    duneid: string;
    amount: string;
    feeRate: number | undefined;
  };
  type: TxType;
}

export interface RequestMethodSignMessageParams {
  text: string;
  type: string;
}

export interface RequestMethodSignMessagesParams {
  messages: {
    text: string;
    type: string;
  }[];
}

export interface RequestMethodGetInscriptionsParams {
  cursor: number;
  size: number;
}

export interface RequestMethodSignPsbtParams {
  psbtHex: string;
  type: TxType;
  options?: any;
}

export interface RequestMethodSignPsbtsParams {
  psbtHexs: string[];
  options?: any;
}

export interface RequestMethodInscribeTransferParams {
  ticker: string;
  amount: string;
}

export interface RequestMethodGetBitcoinUtxosParams {
  cursor: number;
  size: number;
}

export interface RequestMethodGetAvailableUtxosParams {
  cursor: number;
  size: number;
}

export interface DRC20HistoryItem {
  type: string;
  from: string;
  to: string;
  amount: string;
  txid: string;
  blocktime: number;
}
