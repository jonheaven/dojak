import { createContext, ReactNode, useContext } from 'react';

import { AccountAsset } from '@/background/controller/wallet';
import { ContactBookItem } from '@/background/service/contactBook';
import { ConnectedSite } from '@/background/service/permission';
import { AddressFlagType, ChainType } from '@/shared/constant';
import {
  Account,
  AddressCAT721CollectionSummary,
  AddressCharmsTokenSummary,
  AddressDunesTokenSummary,
  AddressSummary,
  AddressTokenSummary,
  AppInfo,
  AppSummary,
  BitcoinBalance,
  BitcoinBalanceV2,
  CAT721Balance,
  CharmsBalance,
  CharmsCollection,
  CharmsInfo,
  CoinPrice,
  CosmosSignDataType,
  DecodedPsbt,
  DogeChannelItem,
  DRC20HistoryItem,
  DuneBalance,
  FeeSummary,
  InscribeOrder,
  Inscription,
  InscriptionSummary,
  NetworkType,
  SignPsbtOptions,
  TickPriceItem,
  TokenBalance,
  TokenTransfer,
  TxHistoryItem,
  UserToSignInput,
  UTXO,
  UTXO_Detail,
  VersionDetail,
  WalletConfig,
  WalletKeyring,
  WebsiteResult
} from '@/shared/types';
import { ContactBookStore } from '@unisat/contact-book';
import { ToSignInput } from '@unisat/keyring-service/types';
import { UnspentOutput } from '@unisat/tx-helpers/types';
import { AddressType } from '@unisat/wallet-types';

export interface WalletController {
  openapi: {
    [key: string]: (...params: unknown[]) => Promise<unknown>;
  };

  boot(password: string): Promise<void>;
  isBooted(): Promise<boolean>;

  getApproval(): Promise<unknown>;
  resolveApproval(data?: unknown, data2?: unknown): Promise<void>;
  rejectApproval(data?: unknown, data2?: unknown, data3?: unknown): Promise<void>;

  hasVault(): Promise<boolean>;

  verifyPassword(password: string): Promise<void>;
  changePassword: (password: string, newPassword: string) => Promise<void>;

  unlock(password: string): Promise<void>;
  isUnlocked(): Promise<boolean>;

  lockWallet(): Promise<void>;
  setPopupOpen(isOpen: boolean): void;
  isReady(): Promise<boolean>;

  getIsFirstOpen(): Promise<boolean>;
  updateIsFirstOpen(): Promise<void>;

  getAddressBalanceV2(address: string): Promise<BitcoinBalanceV2>;
  getAddressBalance(address: string): Promise<BitcoinBalance>;
  getAddressCacheBalance(address: string): Promise<BitcoinBalance>;
  getMultiAddressAssets(addresses: string): Promise<AddressSummary[]>;
  findGroupAssets(
    groups: { type: number; address_arr: string[]; pubkey_arr: string[] }[]
  ): Promise<{ type: number; address_arr: string[]; pubkey_arr: string[]; satoshis_arr: number[] }[]>;

  getAddressInscriptions(
    address: string,
    cursor: number,
    size: number
  ): Promise<{ list: Inscription[]; total: number }>;

  getAddressHistory: (params: {
    address: string;
    start: number;
    limit: number;
  }) => Promise<{ start: number; total: number; detail: TxHistoryItem[] }>;
  getAddressCacheHistory: (address: string) => Promise<TxHistoryItem[]>;

  listChainAssets: (address: string) => Promise<AccountAsset[]>;

  getLocale(): Promise<string>;
  setLocale(locale: string): Promise<void>;

  getCurrency(): Promise<string>;
  setCurrency(currency: string): Promise<void>;

  clearKeyrings(): Promise<void>;
  getPrivateKey(password: string, account: { address: string; type: string }): Promise<{ hex: string; wif: string }>;
  getMnemonics(
    password: string,
    keyring: WalletKeyring
  ): Promise<{
    hdPath: string;
    mnemonic: string;
    passphrase: string;
  }>;
  createKeyringWithPrivateKey(data: string, addressType: AddressType, alianName?: string): Promise<Account[]>;
  getPreMnemonics(): Promise<any>;
  generatePreMnemonic(): Promise<string>;
  removePreMnemonics(): void;
  createKeyringWithMnemonics(
    mnemonic: string,
    hdPath: string,
    passphrase: string,
    addressType: AddressType,
    accountCount: number
  ): Promise<{ address: string; type: string }[]>;
  createKeyringWithKeystone(
    urType: string,
    urCbor: string,
    addressType: AddressType,
    hdPath: string,
    accountCount: number,
    filterPubkey?: string[],
    connectionType?: 'USB' | 'QR'
  ): Promise<{ address: string; type: string }[]>;
  createTmpKeyringWithPrivateKey(privateKey: string, addressType: AddressType): Promise<WalletKeyring>;
  createTmpKeyringWithKeystone(
    urType: string,
    urCbor: string,
    addressType: AddressType,
    hdPath: string,
    accountCount?: number
  ): Promise<WalletKeyring>;

  createKeyringWithColdWallet(
    xpub: string,
    addressType: AddressType,
    alianName?: string,
    hdPath?: string,
    accountCount?: number
  ): Promise<WalletKeyring>;

  deriveAccountsFromXpub(
    xpub: string,
    addressType: AddressType,
    hdPath?: string,
    accountCount?: number
  ): Promise<{ pubkey: string; address: string }[]>;

  createTmpKeyringWithMnemonics(
    mnemonic: string,
    hdPath: string,
    passphrase: string,
    addressType: AddressType,
    accountCount?: number
  ): Promise<WalletKeyring>;
  removeKeyring(keyring: WalletKeyring): Promise<WalletKeyring>;
  deriveNewAccountFromMnemonic(keyring: WalletKeyring, alianName?: string): Promise<string[]>;
  getAccountsCount(): Promise<number>;
  getAllAlianName: () => (ContactBookItem | undefined)[];
  getContactsByMap: () => ContactBookStore;

  getCurrentAccount(): Promise<Account>;
  getAccounts(): Promise<Account[]>;
  getNextAlianName: (keyring: WalletKeyring) => Promise<string>;

  getCurrentKeyringAccounts(): Promise<Account[]>;

  signPsbtWithHex(psbtHex: string, toSignInputs: ToSignInput[], autoFinalized: boolean): Promise<string>;

  sendPEP(data: {
    to: string;
    amount: number;
    btcUtxos: UnspentOutput[];
    feeRate: number;
    enableRBF: boolean;
    memo?: string;
    memos?: string[];
  }): Promise<{
    psbtHex: string;
    rawtx: string;
    fee: number;
  }>;

  sendAllPEP(data: { to: string; btcUtxos: UnspentOutput[]; feeRate: number; enableRBF: boolean }): Promise<{
    psbtHex: string;
    rawtx: string;
    fee: number;
  }>;

  sendDoginalsInscription(data: {
    to: string;
    inscriptionId: string;
    feeRate: number;
    outputValue?: number;
    enableRBF: boolean;
    btcUtxos: UnspentOutput[];
  }): Promise<{
    psbtHex: string;
    rawtx: string;
    fee: number;
  }>;

  sendDoginalsInscriptions(data: {
    to: string;
    inscriptionIds: string[];
    feeRate: number;
    enableRBF: boolean;
    btcUtxos: UnspentOutput[];
  }): Promise<{
    psbtHex: string;
    rawtx: string;
    fee: number;
  }>;

  splitDoginalsInscription(data: {
    inscriptionId: string;
    feeRate: number;
    outputValue: number;
    enableRBF: boolean;
    btcUtxos: UnspentOutput[];
  }): Promise<{
    psbtHex: string;
    rawtx: string;
    fee: number;
    splitedCount: number;
  }>;

  pushTx(rawtx: string): Promise<string>;

  queryDomainInfo(domain: string): Promise<Inscription>;

  getInscriptionSummary(): Promise<InscriptionSummary>;
  getAppSummary(): Promise<AppSummary>;
  getPEPUtxos(): Promise<UnspentOutput[]>;
  getAssetUtxosInscriptions(inscriptionId: string): Promise<UnspentOutput[]>;

  getNetworkType(): Promise<NetworkType>;
  setNetworkType(type: NetworkType): Promise<void>;

  getChainType(): Promise<ChainType>;
  setChainType(type: ChainType): Promise<void>;

  getConnectedSites(): Promise<ConnectedSite[]>;
  removeConnectedSite(origin: string): Promise<void>;
  getCurrentConnectedSite(id: string): Promise<ConnectedSite>;

  getCurrentKeyring(): Promise<WalletKeyring>;
  getKeyrings(): Promise<WalletKeyring[]>;
  changeKeyring(keyring: WalletKeyring, accountIndex?: number): Promise<void>;
  getAllAddresses(keyring: WalletKeyring, index: number): Promise<string[]>;

  setKeyringAlianName(keyring: WalletKeyring, name: string): Promise<WalletKeyring>;
  changeAddressType(addressType: AddressType): Promise<void>;

  setAccountAlianName(account: Account, name: string): Promise<Account>;
  getFeeSummary(): Promise<FeeSummary>;
  getCoinPrice(): Promise<CoinPrice>;
  getDrc20sPrice(ticks: string[]): Promise<{ [tick: string]: TickPriceItem }>;
  getDunesPrice(ticks: string[]): Promise<{ [tick: string]: TickPriceItem }>;
  getCharmsPrice(charmsid: string[]): Promise<{ [tick: string]: TickPriceItem }>;

  setEditingKeyring(keyringIndex: number): Promise<void>;
  getEditingKeyring(): Promise<WalletKeyring>;

  setEditingAccount(account: Account): Promise<void>;
  getEditingAccount(): Promise<Account>;

  inscribeDRC20Transfer(
    address: string,
    tick: string,
    amount: string,
    feeRate: number,
    outputValue: number
  ): Promise<InscribeOrder>;
  getInscribeResult(orderId: string): Promise<TokenTransfer>;

  createDoginalInscription(
    content: string,
    feeRate: number
  ): Promise<InscribeOrder>;

  decodePsbt(psbtHex: string, website: string): Promise<DecodedPsbt>;

  decodeContracts(contracts: any[], account: any): Promise<any[]>;

  getAllInscriptionList(
    address: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ currentPage: number; pageSize: number; total: number; list: Inscription[] }>;

  getDRC20List(
    address: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ currentPage: number; pageSize: number; total: number; list: TokenBalance[] }>;

  getDRC20ProgList(
    address: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ currentPage: number; pageSize: number; total: number; list: TokenBalance[] }>;

  getDRC20TransferableList(
    address: string,
    ticker: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ currentPage: number; pageSize: number; total: number; list: TokenTransfer[] }>;

  getDoginalsInscriptions(
    address: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ currentPage: number; pageSize: number; total: number; list: Inscription[] }>;

  getDoginals(
    address: string,
    cursor?: string,
    size?: number
  ): Promise<{ list: any[]; total: number }>;

  getDRC20Summary(address: string, ticker: string): Promise<AddressTokenSummary>;

  expireUICachedData(address: string): Promise<void>;

  getWalletConfig(): Promise<WalletConfig>;

  getSkippedVersion(): Promise<string>;
  setSkippedVersion(version: string): Promise<void>;

  getInscriptionUtxoDetail(inscriptionId: string): Promise<UTXO_Detail>;
  getUtxoByInscriptionId(inscriptionId: string): Promise<UTXO>;
  getInscriptionInfo(inscriptionId: string): Promise<Inscription>;

  checkWebsite(website: string): Promise<WebsiteResult>;

  readTab(tabName: string): Promise<void>;
  readApp(appid: number): Promise<void>;

  formatOptionsToSignInputs(psbtHex: string, options?: SignPsbtOptions): Promise<ToSignInput[]>;

  getAddressSummary(address: string): Promise<AddressSummary>;

  getShowSafeNotice(): Promise<boolean>;
  setShowSafeNotice(show: boolean): Promise<void>;

  // address flag
  addAddressFlag(account: Account, flag: AddressFlagType): Promise<Account>;
  removeAddressFlag(account: Account, flag: AddressFlagType): Promise<Account>;

  getVersionDetail(version: string): Promise<VersionDetail>;

  genSignPsbtUr(psbtHex: string): Promise<{ type: string; cbor: string }>;
  parseSignPsbtUr(type: string, cbor: string, isFinalize?: boolean): Promise<{ psbtHex: string; rawtx?: string }>;
  genSignMsgUr(text: string, msgType?: string): Promise<{ type: string; cbor: string; requestId: string }>;
  parseSignMsgUr(type: string, cbor: string, msgType: string): Promise<{ signature: string }>;
  getKeystoneConnectionType(): Promise<'USB' | 'QR'>;
  genSignCosmosUr(cosmosSignRequest: {
    requestId?: string;
    signData: string;
    dataType: CosmosSignDataType;
    path: string;
    chainId?: string;
    accountNumber?: string;
    address?: string;
  }): Promise<{ type: string; cbor: string; requestId: string }>;
  parseCosmosSignUr(type: string, cbor: string): Promise<any>;

  cosmosSignData(
    chainId: string,
    signBytesHex: string
  ): Promise<{
    publicKey: string;
    signature: string;
  }>;

  getEnableSignData(): Promise<boolean>;
  setEnableSignData(enable: boolean): Promise<void>;

  getDunesList(
    address: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ currentPage: number; pageSize: number; total: number; list: DuneBalance[] }>;

  getAssetUtxosDunes(dune: string): Promise<UnspentOutput[]>;

  getAddressDunesTokenSummary(address: string, runeid: string): Promise<AddressDunesTokenSummary>;

  sendDunes(data: {
    to: string;
    runeid: string;
    runeAmount: string;
    feeRate: number;
    enableRBF: boolean;
    btcUtxos?: UnspentOutput[];
    assetUtxos?: UnspentOutput[];
    outputValue?: number;
  }): Promise<{
    psbtHex: string;
    rawtx: string;
    fee: number;
  }>;

  setAutoLockTimeId(timeId: number): Promise<void>;
  getAutoLockTimeId(): Promise<number>;

  getDeveloperMode(): Promise<boolean>;
  setDeveloperMode(developerMode: boolean): Promise<void>;

  getTheme(): Promise<'light' | 'dark'>;
  setTheme(theme: 'light' | 'dark'): Promise<void>;






  getAppList(): Promise<{ tab: string; items: AppInfo[] }[]>;
  getBannerList(): Promise<{ id: string; img: string; link: string }[]>;
  getBlockActiveInfo(): Promise<{ allTransactions: number; allAddrs: number }>;

  getCAT721List(
    version: 'v1' | 'v2',
    address: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ currentPage: number; pageSize: number; total: number; list: CAT721Balance[] }>;

  getAddressCAT721CollectionSummary(
    version: 'v1' | 'v2',
    address: string,
    collectionId: string
  ): Promise<AddressCAT721CollectionSummary>;

  transferCAT721Step1(
    version: 'v1' | 'v2',
    to: string,
    collectionId: string,
    localId: string,
    feeRate: number
  ): Promise<{ id: string; commitTx: string; toSignInputs: UserToSignInput[]; feeRate: number }>;
  transferCAT721Step2(
    version: 'v1' | 'v2',
    transferId: string,
    commitTx: string,
    toSignInputs: UserToSignInput[]
  ): Promise<{ revealTx: string; toSignInputs: UserToSignInput[] }>;
  transferCAT721Step3(
    version: 'v1' | 'v2',
    transferId: string,
    revealTx: string,
    toSignInputs: UserToSignInput[]
  ): Promise<{ txid: string }>;

  getBuyCoinChannelList(coin: string): Promise<DogeChannelItem[]>;
  createBuyCoinPaymentUrl(coin: string, address: string, channel: string): Promise<string>;


  getContactByAddress(address: string): Promise<ContactBookItem | undefined>;
  getContactByAddressAndChain(address: string, chain: ChainType): Promise<ContactBookItem | undefined>;
  updateContact(data: ContactBookItem): Promise<void>;
  removeContact(address: string, chain?: ChainType): Promise<void>;
  listContacts(): Promise<ContactBookItem[]>;
  saveContactsOrder(contacts: ContactBookItem[]): Promise<void>;

  singleStepTransferDRC20Step1(params: {
    userAddress: string;
    userPubkey: string;
    receiver: string;
    ticker: string;
    amount: string;
    feeRate: number;
  }): Promise<{
    orderId: string;
    psbtHex: string;
    toSignInputs: UserToSignInput[];
  }>;

  singleStepTransferDRC20Step2(params: {
    orderId: string;
    commitTx: string;
    toSignInputs: UserToSignInput[];
  }): Promise<{
    psbtHex: string;
    toSignInputs: UserToSignInput[];
  }>;

  singleStepTransferDRC20Step3(params: {
    orderId: string;
    revealTx: string;
    toSignInputs: UserToSignInput[];
  }): Promise<{ txid: string }>;

  setLastActiveTime(): void;

  getOpenInSidePanel(): Promise<boolean>;
  setOpenInSidePanel(openInSidePanel: boolean): Promise<void>;

  sendCoinBypassHeadOffsets(
    tos: { address: string; satoshis: number }[],
    feeRate: number
  ): Promise<{
    psbtHex: string;
    rawtx: string;
    fee: number;
  }>;

  getCharmsList(
    address: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ currentPage: number; pageSize: number; total: number; list: CharmsBalance[] }>;

  getAssetUtxosCharms(dune: string): Promise<UnspentOutput[]>;

  getAddressCharmsTokenSummary(
    address: string,
    charmsid: string,
    fetchAvailable: boolean
  ): Promise<AddressCharmsTokenSummary>;

  createCharmsSendTx(params: {
    userAddress: string;
    userPubkey: string;
    receiver: string;
    charmsid: string;
    amount: string;
    feeRate: number;
  }): Promise<{
    psbtHex: string;
    toSignInputs: UserToSignInput[];
  }>;

  signCharmsSendTx(params: { commitTx: string; toSignInputs: ToSignInput[] }): Promise<{ txid: string }>;

  sendCharms(params: {
    to: string;
    charmsid: string;
    amount: string;
    feeRate: number;
    enableRBF: boolean;
  }): Promise<string>;

  getCharmsCollectionList(
    address: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ list: CharmsCollection[]; total: number }>;
  getCharmsCollectionItems(
    address: string,
    collectionId: string,
    currentPage: number,
    pageSize: number
  ): Promise<{ currentPage: number; pageSize: number; list: CharmsInfo[]; total: number }>;

  getCharmsStats(): Promise<any>;
  getCharmsByUtxo(utxo: string): Promise<any>;
  getCharmsByApp(app: string, limit?: number): Promise<any>;

  subscribeToAddressEvents(address: string, onEvent: (event: any) => void, onError?: (error: any) => void): () => void;
  subscribeToMarketplaceEvents(onEvent: (event: any) => void, onError?: (error: any) => void): () => void;
  subscribeToNewBlocks(onEvent: (event: any) => void, onError?: (error: any) => void): () => void;

  searchDoginals(filters: any): Promise<any>;
  searchTokens(filters: any): Promise<any>;
  searchByContent(searchTerm: string, contentType?: string, limit?: number): Promise<any>;

  getDRC20RecentHistory(address: string, ticker: string): Promise<DRC20HistoryItem[]>;

  getMultiAssetBalance(address: string): Promise<any>;

  resolveDNS(name: string): Promise<any>;
  reverseResolveDNS(address: string): Promise<any>;
  getDNSAvatar(name: string): Promise<any>;
  getDNSConfig(name: string): Promise<any>;

  getMarketplaceListings(cursor?: string, size?: number, filters?: any): Promise<any>;
  getMarketplaceListing(listingId: string): Promise<any>;
  createMarketplaceListing(pepinalId: string, price: number, sellerAddress: string): Promise<any>;
  buyMarketplaceListing(listingId: string, buyerAddress: string): Promise<any>;
}

const WalletContext = createContext<{
  wallet: WalletController;
} | null>(null);

const WalletProvider = ({ children, wallet }: { children?: ReactNode; wallet: WalletController }) => (
  <WalletContext.Provider value={{ wallet }}>{children}</WalletContext.Provider>
);

const useWallet = () => {
  const { wallet } = useContext(WalletContext) as {
    wallet: WalletController;
  };

  return wallet;
};

export { useWallet, WalletProvider };



