/**
 * @dojak/web/wallet — embeddable Dojak / MyDoge / SpookyDoge drawer for host dApps.
 * Import from `@dojak/web/wallet` (not `.`) to avoid pulling Treats/Dunes/Charms/Nostr/etc.
 */
export {
  DojakWalletProvider,
  DojakwebProvider,
  type DojakWalletProviderProps,
  type DojakwebProviderProps,
} from '../providers/DojakWalletProvider';

export { ConnectWalletButton, type ConnectWalletButtonProps } from '../components/ConnectWalletButton';
export {
  default as WalletDrawer,
  type WalletDrawerProps,
} from '../components/WalletDrawer';
export { default as WalletSelectionModal } from '../components/WalletSelectionModal';
export { default as SimpleWalletConnect } from '../components/SimpleWalletConnect';
export { default as DojakwebWalletModal } from '../components/DojakwebWalletModal';

export { useUnifiedWallet } from '../contexts/useUnifiedWallet';
export { useMyDogeWallet } from '../contexts/useMyDogeWallet';
export type { UseMyDogeWalletReturn } from '../contexts/MyDogeWalletContext';
export { useBrowserWallet, type UseBrowserWalletReturn } from '../contexts/BrowserWalletContext';

/** Host apps: open drawer + dynamic signing approval (MetaMask-style). */
export {
  requestWalletApproval,
  openWalletDrawer,
  WalletApprovalCancelledError,
  isWalletApprovalCancelled,
  isWalletApprovalWorking,
  type WalletApprovalRequest,
  type WalletApprovalDetail,
  type WalletApprovalSession,
  type WalletOpenFocus,
} from '../stores/walletApprovalStore';

/** DOTC v1 — generic OTC deal OP_RETURN helpers (any host dApp, not doge.cam-specific). */
export {
  generateDealId,
  buildDotcPayload,
  parseDotc,
  validateDotcPayload,
  compactInscriptionRef,
  compactAddress,
  parseInscriptionRef,
  planDotcPsbtOutputs,
  buildDotcOpReturnScript,
  formatDotcConfirmation,
  dogeToKoinu,
  buildDotcExamples,
  DOTC_MARKER,
  DOTC_VERSION,
  DOTC_MAX_DATA_BYTES,
  DOTC_NOTE_MAX_CHARS,
  DOTC_PSBT_OUTPUT_ORDER,
  DOTC_CONFIRMATION_COPY,
  DOTC_EXAMPLE_INPUTS,
} from '../lib/dotc';
export type {
  DotcDeal,
  DotcDealFields,
  DotcValidation,
  BuildDotcPayloadInput,
  DotcPsbtPlan,
  DotcPsbtOutputRole,
} from '../lib/dotc';

/** Ðclaims — host apps sign deploy/claim via browser wallet. */
export {
  createDclaim,
  createDclaimDeploy,
  buildClaimPayload,
  buildDeployPayload,
  quoteDclaimMint,
  protocolFeeAmount,
  DCLAIMS_P,
  DCLAIMS_V,
  DEFAULT_PROTOCOL_FEE_BPS,
} from '../lib/dclaims';
export type {
  CreateDclaimParams,
  CreateDclaimDeployParams,
  DclaimFeeQuote,
  DclaimInscribeOptions,
} from '../lib/dclaims';

export {
  setWalletDataProviderConfig,
  getWalletDataProviderConfig,
  getFactoryWalletDataProviderConfig,
  getDefaultWalletDataProviderUrl,
  isDefaultWalletDataProviderUrl,
  ensureDefaultWalletDataProvider,
  getIndexerApiBase,
  getWonkyOrdApiBase,
  getDogexCdnBase,
  dogexCdnContentUrl,
  WALLET_DATA_PROVIDER_CHANGED_EVENT,
  walletDataApi,
  type WalletDataProviderConfig,
  type WalletDataProviderType,
} from '../utils/api';

export {
  loadHiddenInscriptionIds,
  saveHiddenInscriptionIds,
  hideInscription,
  unhideInscription,
  isInscriptionHidden,
  filterVisibleInscriptions,
} from '../utils/hidden-inscriptions';

/** Featured defaults: MyDoge bag + command.dog ops + explorer.dogenals.com (overrides still allowed). */
export { ensureDojakwebEcosystemDefaults } from '../lib/ecosystemDefaults';

/** Host apps: push signed hex via wallet broadcast relay order (not host /api/tx-broadcast). */
export {
  broadcastSignedTransaction,
  ensureDefaultBroadcastConfig,
  loadBroadcastConfig,
} from '../lib/broadcast/dogecoinTxBroadcast';

export {
  dogeTxExplorerUrl,
  dogeAddressExplorerUrl,
  ensureDefaultChainExplorer,
  loadDogeTxExplorerPreference,
  saveDogeTxExplorerPreference,
  useDogeTxExplorerPreference,
  DOGENALS_EXPLORER_ORIGIN,
  type DogeTxExplorerId,
} from '../utils/dogeTxExplorer';

export {
  useDojakwebTheme,
  DojakwebThemeProvider,
  type DojakwebTheme,
} from '../contexts/DojakwebThemeContext';

export {
  DojakwebLocaleProvider,
  useDojakwebI18n,
  normalizeDojakwebLocale,
  type DojakwebBundleLocale,
} from '../contexts/DojakwebLocaleContext';

export {
  DojakwebFiatProvider,
  useDojakwebFiat,
  useDojakwebFiatOptional,
  type DojakwebFiatCurrency,
} from '../contexts/DojakwebFiatContext';

export {
  DOJAKWEB_PREFERRED_LOCALE_KEY,
  DOJAKWEB_PREFERRED_FIAT_KEY,
  DOJAKWEB_SHOW_FIAT_AMOUNTS_KEY,
  DOJAKWEB_PREFERRED_LOCALE_CHANGED_EVENT,
  DOJAKWEB_PREFERRED_FIAT_CHANGED_EVENT,
  DOJAKWEB_SHOW_FIAT_AMOUNTS_CHANGED_EVENT,
  readPreferredLocale,
  readPreferredFiat,
  writePreferredLocale,
  writePreferredFiat,
  readShowFiatAmountsPreference,
  writeShowFiatAmountsPreference,
  subscribePreferredLocale,
  subscribePreferredFiat,
  subscribeShowFiatAmounts,
} from '../lib/host-preferences-sync';

export { toast } from 'sonner';
