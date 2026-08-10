export * from './lib/browser-wallet';
export type * from './types/wallet';

export * from './contexts/BrowserWalletContext';
export { UnifiedWalletProvider } from './contexts/UnifiedWalletContext';
export { useUnifiedWallet } from './contexts/useUnifiedWallet';
export { useMyDogeWallet } from './contexts/useMyDogeWallet';
export type { UseMyDogeWalletReturn } from './contexts/MyDogeWalletContext';
export { toast } from 'sonner';

/** Client-only hide list (localStorage per address). Used by storefront holdings + drawer. */
export {
  loadHiddenInscriptionIds,
  saveHiddenInscriptionIds,
  hideInscription,
  unhideInscription,
  isInscriptionHidden,
  filterVisibleInscriptions,
} from './utils/hidden-inscriptions';

export { default as WalletSelectionModal } from './components/WalletSelectionModal';
export { ConnectWalletButton } from './components/ConnectWalletButton';
export { default as SimpleWalletConnect } from './components/SimpleWalletConnect';
export {
  default as WalletDrawer,
  type WalletDrawerProps,
} from './components/WalletDrawer';
/** Host apps (dogenals aliases `@dojak/web/wallet` → this bundle for shared context). */
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
} from './stores/walletApprovalStore';
export { default as DoginalDrawer } from './components/DoginalDrawer';
export { DoginalDrawerProvider, useDoginalDrawer } from './contexts/DoginalDrawerContext';
export type { DrawerData } from './contexts/DoginalDrawerContext';
export { DojakwebProvider } from './providers/DojakwebProvider';
export type { DojakwebProviderProps } from './providers/DojakwebProvider';
export {
  DojakWalletProvider,
  type DojakWalletProviderProps,
} from './providers/DojakWalletProvider';

export { useDojakwebTheme, DojakwebThemeProvider } from './contexts/DojakwebThemeContext';
export type { DojakwebTheme } from './contexts/DojakwebThemeContext';

export { useZKVerification } from './hooks/useZKVerification';
export {
  buildDpfpBindInscriptionJson,
  fetchChainProfile,
  chainContentUrl,
  publishDpfpBindOnChain,
} from './lib/dpfpPublish';
export type { DpfpRole, ChainProfile, PublishDpfpBindResult } from './lib/dpfpPublish';
export { useDogePFP } from './hooks/useDogePFP';
export { useDogePFA } from './hooks/useDogePFA';
export { useChainProfile } from './hooks/useChainProfile';
export { DogePFPAvatar, walletAvatarGradient } from './components/DogePFPAvatar';

export {
  DOJAKWEB_PREFERRED_LOCALE_KEY,
  DOJAKWEB_PREFERRED_FIAT_KEY,
  DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_KEY,
  DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE_KEY,
  DOJAKWEB_DEFAULT_ONE_CLICK_LOCAL_SIGNING_MAX_DOGE,
  DOJAKWEB_SHOW_FIAT_AMOUNTS_KEY,
  DOJAKWEB_PREFERRED_LOCALE_CHANGED_EVENT,
  DOJAKWEB_PREFERRED_FIAT_CHANGED_EVENT,
  DOJAKWEB_ONE_CLICK_LOCAL_SIGNING_CHANGED_EVENT,
  DOJAKWEB_SHOW_FIAT_AMOUNTS_CHANGED_EVENT,
  readPreferredLocale,
  readPreferredFiat,
  readOneClickLocalSigningPreference,
  readOneClickLocalSigningPolicy,
  writePreferredLocale,
  writePreferredFiat,
  writeOneClickLocalSigningPreference,
  writeOneClickLocalSigningPolicy,
  readShowFiatAmountsPreference,
  writeShowFiatAmountsPreference,
  subscribePreferredLocale,
  subscribePreferredFiat,
  subscribeOneClickLocalSigning,
  subscribeShowFiatAmounts,
  type OneClickLocalSigningPolicy,
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
export { useDataProvider, useDataProviderOptional } from './providers/DataProvider';
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

/** Ðclaims — fractional region claims on parent inscriptions. */
export {
  createDclaim,
  createDclaimDeploy,
  buildClaimPayload,
  buildClaimParcelHtml,
  buildDeployPayload,
  quoteDclaimMint,
  protocolFeeAmount,
  inscriptionIdToParentBytes,
  DCLAIMS_P,
  DCLAIMS_V,
  DCLAIMS_CONTENT_TYPE,
  DEFAULT_PROTOCOL_FEE_BPS,
} from './lib/dclaims';
export type {
  CreateDclaimParams,
  CreateDclaimDeployParams,
  DclaimFeeQuote,
  DclaimInscribeOptions,
  DclaimRect,
} from './lib/dclaims';
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

export {
  derivePrivateKeyAtPath,
  DOGECOIN_L1_REFERENCE_PATH,
} from './lib/seedDerivation';

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
  buildEtchScript,
  buildLaunchCurveBuyScript,
  buildLaunchCurveEtchScript,
  buildLaunchCurveGraduateScript,
  buildLaunchCurveSellScript,
  buildMintScript,
  buildSendScript,
  DUNE_V2_MAGIC,
  DUNE_V2_VERSION,
  duneNameToNumber,
  duneNumberToLetters,
  encodeDunestone,
  parseDuneId,
  parseSpacedDune,
  renderSpacedDune,
  type DuneEdict,
  type DuneLaunchCurve,
  type DuneTerms,
  type DunestoneEtching,
  type DunestoneMagic,
  type DunestoneParams,
  type LaunchCurveBuyScriptParams,
  type LaunchCurveEtchScriptParams,
  type LaunchCurveGraduateScriptParams,
  type LaunchCurveOp,
  type LaunchCurveSellScriptParams,
} from './lib/dunestone';

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
  DOJAKWEB_WALLET_TX_JOURNAL_CHANGED_EVENT,
  DOJAKWEB_WALLET_TX_JOURNAL_KEY,
  WALLET_TX_PROTOCOL_LABELS,
  clearWalletTxJournal,
  guessWalletTxOriginLabel,
  loadWalletTxJournal,
  mergeWalletTxJournalIntoList,
  removeWalletTxJournalEntry,
  saveWalletTxJournal,
  subscribeWalletTxJournal,
  upsertWalletTxJournalEntry,
  walletTxProtocolLabel,
  type DojakwebWalletTxEntry,
  type DojakwebWalletTxProtocol,
  type DojakwebWalletTxStatus,
  type WalletTxListRow,
} from './lib/wallet-tx-journal';

export {
  TREATS_PROTOCOL_ID,
  TREATS_DUST_KOINU,
  TREATS_MAX_OPRETURN_SCRIPT_BYTES,
  buildTreatsDeployJson,
  treatsPostPremineRemaining,
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
export type { DunesToolsPanelProps, DunesToolsTxSuccess, DunesUiOp } from './components/dunes/DunesToolsPanel';
export { DuneDeployModal } from './components/DuneDeployModal';
export { DuneMintModal } from './components/DuneMintModal';
export { DuneSendModal } from './components/DuneSendModal';
export { useDuneTxSigner } from './hooks/useDuneTxSigner';
export {
  etchDune,
  mintDune,
  sendDune,
  humanToSmallestUnits,
  smallestUnitsToHuman,
} from './services/duneService';
export type {
  EtchDuneParams,
  EtchResult,
  MintDuneParams,
  MintResult,
  SendDuneParams,
  SendResult,
} from './services/duneService';
export {
  launchDuneCurve,
  graduateDuneCurve,
  buildDuneCurveBuyCosignPlan,
  buildDuneCurveSellCosignPlan,
  buildDuneCurveGraduateCosignPlan,
} from './services/duneLaunchService';
export type {
  DuneLaunchCurveBuyPlanParams,
  DuneLaunchCurveGraduateParams,
  DuneLaunchCurveGraduatePlanParams,
  DuneLaunchCurveLaunchParams,
  DuneLaunchCurveOutputIndexes,
  DuneLaunchCurvePsbtPlan,
  DuneLaunchCurveSellPlanParams,
  DuneLaunchCurveSigner,
  DuneLaunchCurveTxResult,
} from './services/duneLaunchService';
export {
  resolveDuneTxSigner,
  assertDuneTxSigner,
  type DuneTxSigner,
  type DuneTxSignerResult,
} from './lib/dune-tx-signer';

export { CharmsToolsPanel } from './components/charms/CharmsToolsPanel';
export type { CharmsToolsPanelProps, CharmsUiOp } from './components/charms/CharmsToolsPanel';
export { CharmsCreateModal } from './components/CharmsCreateModal';
export { CharmsTransferModal } from './components/CharmsTransferModal';
export type { CharmsToken } from './lib/charms/types';
export { AlkanesToolsPanel } from './components/alkanes/AlkanesToolsPanel';
export type {
  AlkanesToolsPanelProps,
  AlkanesUiOp,
  AlkanesTemplateId,
} from './components/alkanes/AlkanesToolsPanel';
export {
  encodeCellpack,
  buildAlkanesCallScriptHex,
  buildAlkanesCallPayload,
  broadcastAlkanesCall,
  deployAlkaneWasm,
  fetchAlkaneTemplate,
  fetchAmmTemplate,
  fetchAlkanesTemplatesList,
  fetchAlkanesList,
  ALKANES_MAGIC,
} from './lib/alkanes';
export type { AlkaneMeta, AlkaneTemplate, AmmTemplate } from './lib/alkanes';
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

export {
  MIN_RELAY_KOINU_PER_KB,
  MIN_RELAY_KOINU_PER_BYTE,
  INCLUSION_FLOOR_KOINU_PER_KB,
  INCLUSION_FLOOR_KOINU_PER_BYTE,
  resolveInclusionFeeRateKoinuPerKb,
  resolveInclusionFeeRateKoinuPerByte,
  clampKoinuPerKb,
  clampKoinuPerByte,
} from './lib/fees/dogecoinFeePolicy';

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
  formatDojakwebFeeRate,
  estimateP2pkhFeeDoge,
  type DojakwebTxFeePreset,
  type DojakwebTxFeePreference,
} from './lib/fees/txFeePreference';

export {
  NetworkFeeControl,
  type NetworkFeeControlProps,
} from './components/fees/NetworkFeeControl';

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
  HARD_DUST_KOINU,
  SOFT_DUST_KOINU,
  INSCRIPTION_CARRIER_KOINU,
  MIN_PLAIN_PAYMENT_KOINU,
  INCLUSION_FEE_KOINU_PER_KB,
  softDustFeePenaltyKoinu,
  isSoftDustOutputKoinu,
  mineableFeeKoinu,
  discardSoftDustChangeKoinu,
  assertPlainPaymentKoinu,
  assertHardDustKoinu,
  explainUnderpaidSoftDust,
} from './lib/dogecoin/softDust';

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

// BIP65 CLTV time locks (ÐLocker / conviction custody)
export {
  buildCltvRedeemScript,
  buildCltvAnnouncePayload,
  buildCltvAnnounceScript,
  buildCltvP2shAddress,
  createTimeLockedTransaction,
  createTimeLockedInscriptionTransaction,
  createUnlockTransaction,
  loadCltvLocks,
  saveCltvLock,
  removeCltvLock,
  LOCK_PRESETS,
  locktimeFromDays,
  formatTimeRemaining,
  buildProofUrl,
} from './lib/cltv-tools';
export type {
  CltvLockRecord,
  UtxoInput,
  UnlockTxResult,
  TimeLockedTxResult,
} from './lib/cltv-tools';

// PSDT URI codec
export {
  encodePsdtBytesToDogePsdtUri,
  encodeBase64PsdtToDogePsdtUri,
  decodeDogePsdtUriToBytes,
  decodeDogePsdtUriToBase64,
  isDogePsdtUri,
} from './lib/psdt';

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
  buildDxRevokePayload,
  buildDxRevokeSigningMessage,
  buildDxSigningMessage,
  buildDxSigningMessageV2,
  buildDxSigningMessageLegacy,
  normalizeDxXHandle,
  parseTweetIdFromInput,
  DX_PROTOCOL_MARKER,
  DX_PROTOCOL_VERSION,
  type DxRegisterPayload,
  type DxRevokePayload,
} from './lib/dx/protocol';
export {
  createEasyDxInscribeJob,
  pollEasyDxInscribeJob,
  isEasyDxInscribeConfigured,
} from './lib/dx/easyInscribe';
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

/** Doginals P2SH commit–reveal (text/JSON) — ÐLaunch pay+inscribe uses this. */
export {
  signInscriptionTxs,
  signAndBroadcastInscription,
  estimateInscriptionFees,
  INSCRIPTION_MAX_CONTENT_BYTES,
  INSCRIPTION_CONTENT_TYPE,
  type SignInscriptionParams,
  type SignedInscriptionPair,
  type RevealPaymentOutput,
} from './lib/dogetag/inscribe';
