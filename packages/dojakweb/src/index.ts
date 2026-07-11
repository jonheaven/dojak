export * from './lib/browser-wallet';
export type * from './types/wallet';

export * from './contexts/BrowserWalletContext';
export { UnifiedWalletProvider } from './contexts/UnifiedWalletContext';
export { useUnifiedWallet } from './contexts/useUnifiedWallet';
export { useMyDogeWallet } from './contexts/useMyDogeWallet';
export type { UseMyDogeWalletReturn } from './contexts/MyDogeWalletContext';
export { toast } from 'sonner';

export { default as WalletSelectionModal } from './components/WalletSelectionModal';
export { ConnectWalletButton } from './components/ConnectWalletButton';
export { default as SimpleWalletConnect } from './components/SimpleWalletConnect';
export { default as WalletDrawer } from './components/WalletDrawer';
export {
  WalletPawDrawer,
  type WalletPawDrawerProps,
} from './components/WalletPawDrawer';
export { default as DoginalDrawer } from './components/DoginalDrawer';
export { DoginalDrawerProvider, useDoginalDrawer } from './contexts/DoginalDrawerContext';
export type { DrawerData } from './contexts/DoginalDrawerContext';
export { DojakwebProvider } from './providers/DojakwebProvider';
export type { DojakwebProviderProps } from './providers/DojakwebProvider';
export {
  DojakWalletProvider,
  type DojakWalletProviderProps,
} from './providers/DojakWalletProvider';
export {
  DojakwebFeaturesProvider,
  useDojakwebFeatures,
  type DojakwebFeatures,
} from './contexts/DojakwebFeaturesContext';

export { useDojakwebTheme, DojakwebThemeProvider } from './contexts/DojakwebThemeContext';
export type { DojakwebTheme } from './contexts/DojakwebThemeContext';

export { useZKVerification } from './hooks/useZKVerification';

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
} from './lib/host-preferences-sync';

export {
  DojakwebLocaleProvider,
  useDojakwebI18n,
  normalizeDojakwebLocale,
  type DojakwebBundleLocale,
} from './contexts/DojakwebLocaleContext';

export {
  DojakwebFiatProvider,
  useDojakwebFiat,
  useDojakwebFiatOptional,
} from './contexts/DojakwebFiatContext';
export type { DojakwebFiatCurrency } from './contexts/DojakwebFiatContext';

export { DogePriceProvider, useDogePriceContext } from './contexts/DogePriceContext';
export { useDataProvider } from './providers/DataProvider';
export type { DRC20Token, DuneHolding, MyDogeInscription, WalletInfo, InscriptionLookupResult } from './utils/api';
export { BrowserWalletSigner } from './adapters/BrowserWalletSigner';

export {
  browserRpcProxyAbsoluteUrl,
  fetchRpcChainTipHeight,
  fetchRpcDetailedHealth,
  fetchRpcSmartFeeKoinuPerKb,
  rpcViaProxy,
  rpcViaProxyDetailed,
} from './lib/rpc-proxy-client';
export type {
  RpcCredentials,
  RpcChainTipResult,
  RpcDetailedHealthResult,
  RpcProxyResult,
  RpcSmartFeeResult,
  RpcViaProxyOptions,
} from './lib/rpc-proxy-client';

export * from './wallet/getConnectedWalletAddress';

export { DojakwebWalletModal } from './components/DojakwebWalletModal';

export { useWalletStore } from './stores/walletStore';
export type { WalletState, DogeNetworkId } from './stores/walletStore';
export {
  deriveDogeosAddressFromMnemonic,
  derivePrivateKeyAtPath,
  DOGEOS_EVM_DEFAULT_PATH,
  DOGECOIN_L1_REFERENCE_PATH,
} from './lib/seedDerivation';
export { dogeosChain, getDogeosRpcUrl, getDogeosChainId } from './lib/dogeos-chain';
export { dogeosWagmiConfig } from './lib/dogeos-wagmi-config';
export { createDogeosPublicClient, fetchDogeosNativeBalance } from './lib/dogeos';
export { NetworkChainBadge } from './components/dogeos/NetworkChainBadge';
export { NetworkSwitcher } from './components/dogeos/NetworkSwitcher';
export { ChainTxBanner } from './components/dogeos/ChainTxBanner';
export {
  createDogeosEip1193Provider,
  getDogeosChainIdHex,
  type DogeosEip1193Provider,
  type DogeosEip1193ProviderOptions,
  type Eip1193RequestArguments,
} from './lib/evm/dogeosEip1193Provider';

export {
  signAndBroadcastOpReturnDogetag,
  estimateOpReturnFee,
  loadBroadcastConfig,
  signOpReturnTransaction,
  broadcastSignedTransaction,
  buildOpReturnPSDT,
  preflightDogecoinRpcMempoolAccept,
  resolveCanonicalDogeTxidFromRelay,
  txidFromRawHex,
  waitForBroadcastPropagationVerified,
} from './lib/broadcast/dogecoinTxBroadcast';
export type {
  BroadcastConfig,
  BroadcastOpReturnParams,
  OpReturnFeeEstimate,
  SignedOpReturnTx,
  DogetagTip,
  BuiltOpReturnPSDT,
} from './lib/broadcast/dogecoinTxBroadcast';

export {
  buildDogetagOpReturnScript,
  buildOpReturnLockingScript,
  DOGETAG_MESSAGE_MAX_BYTES,
  estimateOpReturnOutputsTxWeight,
  MAX_SCRIPT_ELEMENT_BYTES,
  OP_RETURN_DATA_SOFT_CAP_BYTES,
  planPaymentOutputsWithOptionalOpReturns,
  utf8PayloadForDogetagMessage,
} from './lib/tx';
export type { DogeSdkLikeOutput, PlanPaymentOutputsParams } from './lib/tx';

export {
  encodeDogenalsEra2AsciiModule,
  encodeDogenalsEra2Dxd,
  encodeDogenalsEra2Line,
  ERA2_DXD_WIRE_BYTE_THRESHOLD,
  ERA2_MARKER_UTF8,
  era2WirePrefixBytesDxdAscii,
  era2WirePrefixBytesDxdStylized,
  type DogenalsEra2ModuleKey,
} from './lib/dogenals';

export {
  broadcastHexViaCommandDog,
  COMMAND_DOG_FEE_ESTIMATE_PATH,
  COMMAND_DOG_TX_BROADCAST_PATH,
  commandDogTxStatusPath,
  fetchCommandDogTxMempoolEntry,
  fetchCommandDogTxStatus,
  commandDogTxMempoolPath,
  getCommandDogApiBaseUrl,
  getIndexerApiBase,
  getWalletDataProviderConfig,
  setWalletDataProviderConfig,
  walletDataApi,
  WALLET_DATA_PROVIDER_CHANGED_EVENT,
  normalizeDoginalInscriptionId,
} from './utils/api';

export {
  TREATS_PROTOCOL_ID,
  TREATS_DUST_KOINU,
  TREATS_MAX_OPRETURN_SCRIPT_BYTES,
  buildTreatsDeployJson,
  buildTreatsMintJson,
  buildTreatsTransferJson,
  buildTreatsBurnJson,
  treatsPayloadBytes,
  planTreatsOperationOutputs,
  signTreatsTransaction,
  signAndBroadcastTreats,
  fetchTreatsTokens,
  fetchTreatsBalances,
  fetchTreatsHolders,
  fetchTreatsToken,
} from './lib/treats';
export type {
  TreatsOpKind,
  SignTreatsParams,
  SignedTreatsTx,
  TreatsTokenRow,
  TreatsBalanceRow,
  TreatsHolderRow,
} from './lib/treats';

export { TreatsMintPanel, TreatsTransferPanel } from './components/treats/TreatsMintPanel';
export type { TreatsMintPanelProps, TreatsUiOp } from './components/treats/TreatsMintPanel';
export { TreatsPage } from './components/treats/TreatsPage';

export { DunesToolsPanel } from './components/dunes/DunesToolsPanel';
export type { DunesToolsPanelProps, DunesUiOp } from './components/dunes/DunesToolsPanel';
export { DuneDeployModal } from './components/DuneDeployModal';
export { DuneMintModal } from './components/DuneMintModal';
export { DuneSendModal } from './components/DuneSendModal';

export { CharmsToolsPanel } from './components/charms/CharmsToolsPanel';
export type { CharmsToolsPanelProps, CharmsUiOp } from './components/charms/CharmsToolsPanel';
export { CharmsCreateModal } from './components/CharmsCreateModal';
export { CharmsTransferModal } from './components/CharmsTransferModal';
export type { CharmsToken } from './lib/charms/types';
export type {
  CommandDogTxMempoolBody,
  CommandDogTxStatusBody,
  WalletDataProviderConfig,
  WalletDataProviderType,
} from './utils/api';

// PSDT validator
export { validateListingPSDT, quickCheckPsdtNetwork, decodePsdtOutputAddress } from './lib/psdt-validator';
export type { PSDTValidationResult } from './lib/psdt-validator';

// Ordinal PSDT utilities
export {
  buildListingPSDT,
  signListingPSDT,
  buildBuyPSDT,
  buildBuyPSDTSimple,
  signAndFinalizeBuyPSDT,
  buildAndSignSendInscription,
  buildSendInscriptionDraft,
  validateSellerPSDT,
  getInscriptionValueFromPsdt,
  getInscriptionData,
  type InscriptionHint,
  getAddressUtxos,
  getTxHex,
  preparePsdtForMyDogeSign,
  sighashTypeForMyDogePsdtSign,
  tryParsePsdt,
  getUnsignedPsdtInputIndexes,
  parsePsdtForLocalSign,
  signPsdtWithWifToTxHex,
  signPartialPsdtWithWifToHex,
  coerceSignedPsdtToRawTxHex,
  broadcastTx,
  sochainDogeTxUrl,
  waitForTxOnBlockcypher,
  shibesToDoge,
  dogeToShibes,
  selectUtxos,
  calculateFee,
  resolveBuyFeeRateKoinuPerByte,
  DEFAULT_FEE_RATE,
  DUMMY_UTXO_VALUE,
  DOGE_NETWORK,
} from './lib/doginal-psdt';
export type { SendInscriptionPsbtDraft } from './lib/doginal-psdt';

// Nostr order-book client
export {
  publishListingToNostr,
  fetchNostrListings,
  fetchBestListingForUtxo,
  subscribeNostrOrderBook,
  NOSTR_RELAY_URL,
  NOSTR_BACKUP_RELAYS,
  NOSTR_ALL_RELAYS,
  NOSTR_ORDER_KIND,
} from './services/nostr';
export type { NostrEvent, NostrOrderInfo, RelayInfo } from './services/nostr';

// UTXO management tools
export { UtxoManagement } from './components/wallet/UtxoManagement';
export type { UtxoManagementProps } from './components/wallet/UtxoManagement';
export {
  fetchAllAddressUtxos,
  fetchAllAddressUtxosWithMeta,
  loadLockedUtxos,
  saveLockedUtxos,
  toggleUtxoLock,
  lockUtxo,
  unlockUtxo,
  autoLockInscriptionUtxos,
  estimateMergeFee,
  estimateSplitFee,
  buildMergeFeeEstimate,
  buildSplitFeeEstimate,
  calcEqualSplitOutputs,
  buildAndSignMergeTx,
  buildAndSignSplitTx,
  broadcastUtxoTx,
  DUST_LIMIT,
  INSCRIPTION_LIKELY_UTXO_KOINU,
} from './lib/utxo-tools';
export type {
  ManagedUtxo,
  MergeFeeEstimate,
  SplitFeeEstimate,
  UtxoListSource,
} from './lib/utxo-tools';

// PSDT URI codec
export {
  encodePsdtBytesToDogePsdtUri,
  encodeBase64PsdtToDogePsdtUri,
  decodeDogePsdtUriToBytes,
  decodeDogePsdtUriToBase64,
  isDogePsdtUri,
} from './lib/psdt';

// ── Quantum / Post-Quantum Commitment Protocol ───────────────────────────────
// Phase 1 OP_RETURN commitment scheme per Dogecoin Foundation BIP draft
// (libdogecoin 0.1.5-dev, Ed Tubbs / Michi Lumin / Timothy Stebbing, April 2026).
// See src/lib/quantum.ts for full protocol documentation.
export {
  // Algorithm constants
  PQC_ALGORITHM_INFO,
  PQC_TAGS,
  PQC_COMMITMENT_PAYLOAD_BYTES,
  QUANTUM_OPRETURN_OUTPUT_BYTES,
  QUANTUM_CARRIER_OUTPUT_BYTES,
  QUANTUM_CARRIER_VALUE_KOINU,
  // Commitment generation
  generateQuantumCommitment,
  generateFalconCommitment,
  generateDilithiumCommitment,
  // OP_RETURN builders
  buildQuantumCommitmentScript,
  buildQuantumRevealReferenceScript,
  // Off-chain verification
  verifyQuantumCommitment,
  // OP_RETURN parser (for indexers / explorers / SPV)
  parseQuantumCommitmentScript,
  parseQuantumRevealReferenceScript,
  // Proof serialization
  exportProofAsJson,
  importProofFromJson,
  // Preload helper
  preloadQuantumModules,
} from './lib/quantum';
export type {
  PQCAlgorithm,
  QuantumKeyPair,
  QuantumCommitment,
  QuantumProofExport,
} from './lib/quantum';

// Quantum broadcast flow (TX_C + TX_R)
export {
  estimateQuantumTxFee,
  signQuantumCommitmentTx,
  broadcastQuantumCommitmentTx,
  signQuantumRevealTx,
  broadcastQuantumRevealTx,
} from './lib/dogetag/broadcastQuantumTx';
export type {
  BroadcastQuantumParams,
  QuantumTxResult,
  BroadcastQuantumRevealParams,
  QuantumRevealResult,
  QuantumFeeEstimate,
} from './lib/dogetag/broadcastQuantumTx';

// Quantum UI components
export { QuantumToggle } from './components/QuantumToggle';
export type { QuantumToggleProps } from './components/QuantumToggle';
export { QuantumDemoPage } from './components/QuantumDemoPage';

// Quantum settings
export {
  getQuantumConfig,
  setQuantumConfig,
  QUANTUM_CONFIG_CHANGED_EVENT,
} from './utils/quantum-settings';
export type { QuantumAlgorithmPreference, QuantumConfig } from './utils/quantum-settings';

// Local listing store
export {
  saveListing,
  getActiveListings,
  removeListing,
  updateListingStatus,
  setListingNostrEventId,
  buildShareUrl,
  pollListingStatuses,
} from './services/listing-store';
export type { ActiveListing, ListingProtocol } from './services/listing-store';

// Ð𝕏 (Dogenals dx v1) — identity verification helpers & embedder messaging
export {
  buildDxRegisterPayload,
  buildDxSigningMessage,
  normalizeDxXHandle,
  parseTweetIdFromInput,
  DX_PROTOCOL_MARKER,
  DX_PROTOCOL_VERSION,
  type DxRegisterPayload,
} from './lib/dx/protocol';
export {
  DOJAKWEB_DX_PM_PROTOCOL,
  DOJAKWEB_DX_REQUEST,
  DOJAKWEB_DX_RESPONSE,
  DOJAKWEB_DX_CANCEL,
  postDxVerifyRequest,
  isDxPostMessageRequest,
  type DxPostMessageRequest,
  type DxPostMessageResponse,
} from './lib/dx/postMessage';
export { useDxHostStore } from './stores/dxHostStore';
export { DojakwebDxTrustedOriginsProvider, useDojakwebDxTrustedOrigins } from './contexts/DojakwebDxContext';
export {
  buildDxWalletCardHtml,
  defaultDxContentApiBase,
  dxBadgeInscriptionIdFromEnv,
  escapeHtmlForDxCard,
  normalizeDxInscriptionIdForUrl,
} from './lib/dx/displayHtml';
export {
  dxInitiate,
  dxConfirm,
  dxPromptPreview,
  dxBadgeStatus,
  dxBadgeImageUrlFromVisual,
  dxResolvedBadgeImageUrl,
  dxVisualStatusMessage,
  isCommandDogDxConfigured,
  type DxInitiateRequest,
  type DxInitiateResponse,
  type DxConfirmRequest,
  type DxConfirmResponse,
  type DxTweetProof,
  type DxPromptPreviewResponse,
} from './lib/dx/commandDogApi';

/** Demo app shell — host with `RouterProvider` + routes. */
export { AppProvider } from './providers/AppProvider';
export { ErrorBoundary } from './components/ErrorBoundary';

/** command.dog server-side inscription job API */
export {
  isInscribeJobsClientConfigured,
  createInscribeJob,
  uploadInscribeJobItemContent,
  runInscribeJob,
  getInscribeJob,
  type CreateInscribeJobBody,
  type InscribeJobResponse,
  type InscribeJobItemInput,
  type InscribeJobItemResponse,
} from './lib/inscribeJobs/commandDogInscribeJobs';
