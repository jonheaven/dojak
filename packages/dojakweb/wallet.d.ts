/** Public types for `@dojak/web/wallet` consumers. */
export {
  DojakWalletProvider,
  DojakwebProvider,
  type DojakWalletProviderProps,
  type DojakwebProviderProps,
} from './src/providers/DojakWalletProvider';
export { ConnectWalletButton, type ConnectWalletButtonProps } from './src/components/ConnectWalletButton';
export {
  default as WalletDrawer,
  type WalletDrawerProps,
} from './src/components/WalletDrawer';
export { default as WalletSelectionModal } from './src/components/WalletSelectionModal';
export { default as SimpleWalletConnect } from './src/components/SimpleWalletConnect';
export { default as DojakwebWalletModal } from './src/components/DojakwebWalletModal';
export { useUnifiedWallet } from './src/contexts/useUnifiedWallet';
export { useMyDogeWallet } from './src/contexts/useMyDogeWallet';
export type { UseMyDogeWalletReturn } from './src/contexts/MyDogeWalletContext';
export { useBrowserWallet, type UseBrowserWalletReturn } from './src/contexts/BrowserWalletContext';
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
} from './src/utils/api';
export {
  loadHiddenInscriptionIds,
  saveHiddenInscriptionIds,
  hideInscription,
  unhideInscription,
  isInscriptionHidden,
  filterVisibleInscriptions,
} from './src/utils/hidden-inscriptions';
export { ensureDojakwebEcosystemDefaults } from './src/lib/ecosystemDefaults';
export {
  broadcastSignedTransaction,
  ensureDefaultBroadcastConfig,
  loadBroadcastConfig,
  filterPaymentSpendableUtxos,
} from './src/lib/broadcast/dogecoinTxBroadcast';
export { invalidateMydogeUtxoCaches, gatedMydogeGetJson } from './src/lib/mydoge/httpGate';
export { excludeDogexDuneBearingUtxos } from './src/lib/duneOutpointGuard';
export {
  dogeTxExplorerUrl,
  dogeAddressExplorerUrl,
  ensureDefaultChainExplorer,
  loadDogeTxExplorerPreference,
  saveDogeTxExplorerPreference,
  useDogeTxExplorerPreference,
  DOGENALS_EXPLORER_ORIGIN,
  type DogeTxExplorerId,
} from './src/utils/dogeTxExplorer';
export {
  useDojakwebTheme,
  DojakwebThemeProvider,
  type DojakwebTheme,
} from './src/contexts/DojakwebThemeContext';
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
} from './src/lib/dotc';
export type {
  DotcDeal,
  DotcDealFields,
  DotcValidation,
  BuildDotcPayloadInput,
  DotcPsbtPlan,
  DotcPsbtOutputRole,
} from './src/lib/dotc';
export { toast } from 'sonner';
export {
  DOJAKWEB_TX_FEE_PREF_KEY,
  DOJAKWEB_TX_FEE_PREF_EVENT,
  DOJAKWEB_FEE_PRESET_RATES,
  DOJAKWEB_FEE_MIN_KOINU_PER_BYTE,
  DOJAKWEB_FEE_MAX_KOINU_PER_BYTE,
  clampDojakwebFeeRateKoinuPerByte,
  koinuPerByteToKoinuPerKb,
  readDojakwebTxFeePreference,
  writeDojakwebTxFeePreference,
  dojakwebFeeRateKoinuPerByteFromPreference,
  dojakwebFeeRateKoinuPerKbFromPreference,
  resolveDojakwebFeeRateKoinuPerByte,
  resolveDojakwebFeeRateKoinuPerKb,
  resolveRequestedOrPreferredFeeRateKoinuPerByte,
  formatDojakwebFeeRate,
  estimateP2pkhFeeDoge,
  type DojakwebTxFeePreset,
  type DojakwebTxFeePreference,
} from './src/lib/fees/txFeePreference';
export {
  enforceBroadcastFeeRateKoinuPerByte,
  enforceBroadcastFeeRateKoinuPerKb,
} from './src/lib/fees/dogecoinFeePolicy';
export {
  NetworkFeeControl,
  type NetworkFeeControlProps,
} from './src/components/fees/NetworkFeeControl';
export {
  NetworkFeeFuelButton,
  type NetworkFeeFuelButtonProps,
} from './src/components/fees/NetworkFeeFuelButton';

