'use client';

import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Dialog, Listbox, ListboxButton, ListboxOption, ListboxOptions, Menu, Transition } from '@headlessui/react';
import clsx from 'clsx';
import {
  ArrowPathIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PowerIcon,
  PlusIcon,
  QrCodeIcon,
  ShareIcon,
  TagIcon,
  TrashIcon,
  WalletIcon,
  ArrowDownTrayIcon,
  FolderOpenIcon,
  Bars3Icon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  PhotoIcon,
  MusicalNoteIcon,
  DocumentTextIcon,
  CircleStackIcon,
  SparklesIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { Usb } from 'lucide-react';
import { WalletMenuItems } from './wallet/WalletMenuItems';
import { WalletAccountSwitcherPanel } from './wallet/WalletAccountSwitcherPanel';
import { WalletPinNumpad } from './wallet/WalletPinNumpad';
import { WalletProviderIcon } from './wallet/WalletProviderIcon';
import { WalletApprovalPanel } from './wallet/WalletApprovalPanel';
import { WalletSendFlow } from './wallet/WalletSendFlow';
import { UtxoManagement } from './wallet/UtxoManagement';
import { getSpendableBalanceBreakdown, type SpendableBalanceBreakdown } from '../lib/spendableBalance';
import { clearMempoolOverlayForAddress } from '../lib/mempoolSpendOverlay';
import {
  TextInscriptionCardMedia,
  WasmInscriptionCardMedia,
  InscriptionTextInspectModal,
  isTextishInscription,
  isWasmInscription,
} from './wallet/TextInscriptionPreview';
import {
  isDlottoInscriptionText,
  loadInscriptionTextBody,
} from '../utils/inscription-text';
import {
  hideInscription,
  unhideInscription,
  loadHiddenInscriptionIds,
} from '../utils/hidden-inscriptions';
import { WalletConnectChooser } from './WalletConnectChooser';
import { useDojakwebTheme } from '../contexts/DojakwebThemeContext';
import { walletCredentialInputProps, walletSecretDecoyFields, walletSecretInputProps } from '../lib/wallet-secret-input';
import {
  buildListingPSDT,
  signListingPSDT,
  getInscriptionData,
  getAddressUtxos,
  broadcastTx as broadcastOrdinalTx,
  buildAndSignSendInscription,
  buildSendInscriptionDraft,
  getInscriptionValueFromPsdt,
  type SendInscriptionPsbtDraft,
  shibesToDoge,
  dogeToShibes,
  DUMMY_UTXO_VALUE,
  selectUtxos,
  buildDummyUtxoPSDT,
  buildBuyPSDT,
  signAndFinalizeBuyPSDT,
  signAndFinalizeSimplePSDT,
  validateSellerPSDT,
} from '../lib/doginal-psdt';
import { publishListingToNostr, publishListingToNostrWithDiagnostics, publishListingCancelToNostr, type NostrPublishRelayResult } from '../services/nostr';
import {
  saveListing,
  getActiveListings,
  removeListing,
  updateListingStatus,
  setListingNostrEventId,
  buildShareUrl,
  pollListingStatuses,
  type ActiveListing,
} from '../services/listing-store';
import { encodeBase64PsdtToDogePsdtUri } from '../lib/psdt/codec';
import { QRCodeSVG } from 'qrcode.react';
import { WebAuthnAdapter } from '@dojak/biometrics';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { BrowserWallet } from '../lib/browser-wallet';
import { createDojakwebBiometricFacade, createDojakwebSessionSecretStore } from '../lib/dojakweb-biometric';
import {
  readWalletLockPreferences,
  writeWalletLockPreferences,
} from '../lib/browser-wallet-lock-prefs';
import { findSeedGroupIndexForAddress, groupBrowserWalletsBySeed, type BrowserWalletSeedGroup } from '../lib/wallet-seed-groups';
import { ConfirmationReadSourcesBar } from './chain/ConfirmationReadSourcesBar';
import { decryptText, encryptText, pbkdf2IterationsForSecretStrength } from '../lib/secureStorage';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { toast } from 'sonner';
import type { SeedMaterial, WalletData, WalletType } from '../types/wallet';
import {
  walletDataApi,
  getWalletDataProviderConfig,
  setWalletDataProviderConfig,
  getIndexerApiBase,
  getDefaultWalletDataProviderUrl,
  isDefaultWalletDataProviderUrl,
  dogexCdnContentUrl,
} from '../utils/api';
import { fetchDogexIndexerHealth } from '../lib/dogex-indexer-health';
import {
  readOneClickLocalSigningPolicy,
  writeOneClickLocalSigningPolicy,
} from '../lib/host-preferences-sync';
import { browserRpcProxyAbsoluteUrl, fetchRpcDetailedHealth } from '../lib/rpc-proxy-client';
import {
  testAllBroadcastRelayHealths,
  testBroadcastRelayHealth,
} from '../lib/broadcast/relayHealth';
import type {
  MyDogeInscription,
  DRC20Token,
  DuneHolding,
  WalletDataProviderType,
  DogeTransaction,
} from '../utils/api';
import { DuneSendModal } from './DuneSendModal';
import {
  DOGE_PRICE_SOURCE_LIST,
  getDogePriceSourceConfig,
  setDogePriceSourceConfig,
  type DogePriceSourceId,
} from '../utils/price-sources';
import { useDojakwebI18n, type DojakwebTranslate } from '../contexts/DojakwebLocaleContext';
import { useDojakwebFiatOptional, type DojakwebFiatCurrency } from '../contexts/DojakwebFiatContext';
import {
  loadDogeTxExplorerPreference,
  saveDogeTxExplorerPreference,
  dogeTxExplorerUrl,
  dogeTxExplorerDisplayName,
  useDogeTxExplorerPreference,
  type DogeTxExplorerId,
} from '../utils/dogeTxExplorer';
import { createPortal } from 'react-dom';
import {
  loadWalletTxJournal,
  mergeWalletTxJournalIntoList,
  subscribeWalletTxJournal,
  upsertWalletTxJournalEntry,
  type DojakwebWalletTxEntry,
  type WalletTxListRow,
} from '../lib/wallet-tx-journal';
import { enrichWalletTransactionsForAddress } from '../lib/wallet-tx-enrichment';
import { DogeCurrencyIcon } from './DogeCurrencyIcon';
import { useGlobalStore } from '../stores/globalStore';
import {
  buildDxRegisterPayload,
  buildDxRevokePayload,
  buildDxRevokeSigningMessage,
  buildDxSigningMessage,
  normalizeDxXHandle,
  parseTweetIdFromInput,
  type DxRegisterPayload,
  type DxRevokePayload,
} from '../lib/dx/protocol';
import {
  dxConfirm,
  dxInitiate,
  dxResolvedBadgeImageUrl,
  dxVisualStatusMessage,
  isCommandDogDxConfigured,
} from '../lib/dx/commandDogApi';
import {
  createEasyDxInscribeJob,
  isEasyDxInscribeConfigured,
  pollEasyDxInscribeJob,
} from '../lib/dx/easyInscribe';
import type { InscribeJobResponse } from '../lib/inscribeJobs/commandDogInscribeJobs';
import { DxPackRipReveal } from './dx/DxPackRipReveal';
import { DOJAKWEB_DX_PM_PROTOCOL, DOJAKWEB_DX_RESPONSE, type DxPostMessageResponse } from '../lib/dx/postMessage';
import { useDxHostStore } from '../stores/dxHostStore';
import {
  signDoginalInscriptionChain,
  countDoginalTransactionsForContent,
} from '../lib/dogetag/doginal-chain';
import { extractProtectedOutpoints } from '../lib/dogetag/protectedOutpoints';
import {
  broadcastSignedDoginalChain,
  isBroadcastInputRejected,
  isMempoolChainLimitError,
} from '../lib/dx/broadcastDoginalPlan';
import {
  buildDxWalletCardHtml,
  defaultDxContentApiBase,
  dxBadgeInscriptionIdFromEnv,
} from '../lib/dx/displayHtml';
import { AddressBookView } from './AddressBookModal';
import { DogePFPAvatar } from './DogePFPAvatar';
import { DogePFAHeaderControl } from './DogePFAHeaderControl';
import { useDogePFP } from '../hooks/useDogePFP';
import { useDogePFA } from '../hooks/useDogePFA';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';
import { TechDetails } from './ui/tech-details';
import { publishDpfpBindOnChain } from '../lib/dpfpPublish';

export interface DojakwebWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  initialStep?: WalletStep;
  initialSettingsTab?: SettingsTab;
  openNonce?: number;
  mode?: 'modal' | 'drawer';
  drawerSide?: 'left' | 'right';
  onThemeChange?: (theme: 'dark' | 'light') => void;
  /** Host open focus: Assets → NFT → ÐLotto filter */
  initialNftFilter?: 'all' | 'media' | 'dlotto';
  initialDashboardTab?: 'assets' | 'transactions' | 'listings';
  initialAssetType?: 'nft' | 'drc20' | 'treats' | 'dunes' | 'charms' | 'alkanes';
}

type WalletStep =
  | 'chooser'
  | 'entry'
  | 'import'
  | 'reveal'
  | 'password'
  | 'dashboard'
  | 'verification'
  | 'send'
  | 'receive'
  | 'remove'
  | 'unlock'
  | 'settings'
  | 'switch_wallet'
  | 'address_book'
  | 'set_name'
  | 'send_inscription'
  | 'list_inscription'
  | 'utxos';

type SettingsTab = 'data' | 'network' | 'display';
type BroadcastRelayProvider = 'blockchair' | 'blockcypher' | 'tatum' | 'rpc' | 'commanddog';
type BroadcastProvider = 'auto' | BroadcastRelayProvider;
const DEFAULT_BROADCAST_PRIORITY: BroadcastRelayProvider[] = [
  'rpc',
  'tatum',
  'blockcypher',
  'blockchair',
  'commanddog',
];

const BROADCAST_CONFIG_KEY = 'dojakweb-broadcast-config';
const BROADCAST_DISABLED_KEY = 'dojakweb-broadcast-disabled';
const BROWSER_WALLET_RESTORE_BLOCK_KEY = 'dojakweb_wallet_restore_blocked';

interface BroadcastConfig {
  broadcastProvider: BroadcastProvider;
  broadcastPriority: BroadcastRelayProvider[];
  rpcUrl: string;
  rpcUser: string;
  rpcPass: string;
  tatumApiKey: string;
}

type DisplayDogeTransaction = WalletTxListRow;

function normalizeBroadcastPriority(priority: unknown): BroadcastRelayProvider[] {
  /** Fill order matches DEFAULT_BROADCAST_PRIORITY (RPC first when credentials are set). */
  const allowed: BroadcastRelayProvider[] = ['rpc', 'tatum', 'blockcypher', 'blockchair', 'commanddog'];
  const input = Array.isArray(priority) ? priority : [];
  const picked = input.filter((item): item is BroadcastRelayProvider =>
    typeof item === 'string' && allowed.includes(item as BroadcastRelayProvider)
  );
  const unique = [...new Set(picked)];
  for (const item of allowed) {
    if (!unique.includes(item)) unique.push(item);
  }
  return unique;
}

/** Legacy configs used `broadcastProvider` for a single relay; UI uses ordered list only. */
function migrateBroadcastToAuto(cfg: BroadcastConfig): BroadcastConfig {
  const priority = normalizeBroadcastPriority(cfg.broadcastPriority);
  if (cfg.broadcastProvider === 'auto') {
    return { ...cfg, broadcastProvider: 'auto', broadcastPriority: priority };
  }
  const pinned = cfg.broadcastProvider as BroadcastRelayProvider;
  const rest = priority.filter((x) => x !== pinned);
  return { ...cfg, broadcastProvider: 'auto', broadcastPriority: [pinned, ...rest] };
}

function loadBroadcastConfig(): BroadcastConfig {
  if (typeof window === 'undefined') {
    return {
      broadcastProvider: 'auto',
      broadcastPriority: DEFAULT_BROADCAST_PRIORITY,
      rpcUrl: 'http://127.0.0.1:22555',
      rpcUser: '',
      rpcPass: '',
      tatumApiKey: '',
    };
  }
  try {
    const raw = window.localStorage.getItem(BROADCAST_CONFIG_KEY);
    if (!raw) throw new Error('no config');
    const parsed = JSON.parse(raw) as Partial<BroadcastConfig>;
    return {
      broadcastProvider: 'auto',
      rpcUrl: 'http://127.0.0.1:22555',
      rpcUser: '',
      rpcPass: '',
      tatumApiKey: '',
      ...parsed,
      broadcastPriority: normalizeBroadcastPriority(
        parsed.broadcastPriority ?? DEFAULT_BROADCAST_PRIORITY
      ),
    };
  } catch {
    return {
      broadcastProvider: 'auto',
      broadcastPriority: DEFAULT_BROADCAST_PRIORITY,
      rpcUrl: 'http://127.0.0.1:22555',
      rpcUser: '',
      rpcPass: '',
      tatumApiKey: '',
    };
  }
}

/** Returns the label for the active data provider. */
function getDataProviderInfo(t: DojakwebTranslate): { label: string } {
  const cfg = getWalletDataProviderConfig();
  if (cfg.walletDataProvider === 'dogex') return { label: t('modal.dataProvider.dogex') };
  if (cfg.walletDataProvider === 'commanddog') return { label: t('modal.dataProvider.commanddog') };
  return { label: t('modal.dataProvider.mydoge') };
}

/** Pill for which wallet is signing (matches broadcast chip styling). */
function getWalletSourceIndicator(
  walletType: WalletType | null,
  t: DojakwebTranslate
): {
  label: string;
  dot: string;
  text: string;
} {
  switch (walletType) {
    case 'browser':
      return { label: t('modal.walletSource.local'), dot: 'bg-emerald-400', text: 'text-emerald-300' };
    case 'mydoge':
      return { label: t('modal.walletSource.mydoge'), dot: 'bg-sky-400', text: 'text-sky-300' };
    case 'dojak':
      return { label: t('modal.walletSource.dojak'), dot: 'bg-cyan-400', text: 'text-cyan-300' };
    case 'spookydoge':
      return { label: t('modal.walletSource.spookydoge'), dot: 'bg-indigo-400', text: 'text-indigo-300' };
    case 'ledger':
      return { label: t('modal.walletSource.ledger'), dot: 'bg-violet-400', text: 'text-violet-300' };
    case 'dogewatch':
      return { label: t('modal.walletSource.dogewatch'), dot: 'bg-amber-400', text: 'text-amber-300' };
    default:
      return { label: t('modal.walletSource.generic'), dot: 'bg-white/40', text: 'text-white/55' };
  }
}

function saveBroadcastConfig(config: BroadcastConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BROADCAST_CONFIG_KEY, JSON.stringify(config));
}

function parseDogecoinConf(content: string): Partial<BroadcastConfig> {
  const lines = content.split(/\r?\n/);
  const result: Partial<BroadcastConfig> = {};
  let rpcPort = '22555';
  let rpcHost = '127.0.0.1';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    const val = rest.join('=').trim();
    if (key === 'rpcuser') result.rpcUser = val;
    if (key === 'rpcpassword') result.rpcPass = val;
    if (key === 'rpcport') rpcPort = val;
    if (key === 'rpcbind') rpcHost = val.split(':')[0] || rpcHost;
  }

  if (result.rpcUser !== undefined || result.rpcPass !== undefined) {
    result.rpcUrl = `http://${rpcHost}:${rpcPort}`;
  }
  return result;
}

type DashboardTab = 'assets' | 'transactions' | 'listings';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** Prefer `content` (direct media URL) then indexer `preview` for ÐPFP / ÐPFA storage. */
function inscriptionMediaUrlForProfile(item: MyDogeInscription): string {
  return String(item.content || item.preview || '').trim();
}

function truncateAddress(address: string | null | undefined) {
  if (!address) return 'D9yNBj...Z2rKQ';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

function looksLikeMnemonic(value: string) {
  return value.trim().split(/\s+/).length === 12 && value.trim().includes(' ');
}

function looksLikeHexPrivateKey(value: string) {
  return /^(0x)?[0-9a-fA-F]{64}$/.test(value.trim());
}

function extractImportableSecret(content: string): string | null {
  const normalized = content.trim();
  if (!normalized) return null;

  if (looksLikeMnemonic(normalized) || looksLikeHexPrivateKey(normalized)) {
    return normalized;
  }

  const compactMnemonic = normalized.replace(/\s+/g, ' ').trim();
  if (looksLikeMnemonic(compactMnemonic)) {
    return compactMnemonic;
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (looksLikeHexPrivateKey(line)) {
      return line;
    }
    if (looksLikeMnemonic(line)) {
      return line;
    }
  }

  const tokenized = normalized.match(/[A-Za-z0-9]+/g) ?? [];
  for (let index = 0; index <= tokenized.length - 12; index += 1) {
    const candidate = tokenized.slice(index, index + 12).join(' ');
    if (looksLikeMnemonic(candidate)) {
      return candidate;
    }
  }

  const wifMatch = normalized.match(/[5KLc][1-9A-HJ-NP-Za-km-z]{50,51}/);
  if (wifMatch) {
    return wifMatch[0];
  }

  return null;
}

function getBackupFlag(address: string | null | undefined) {
  return address ? `wallet_backed_up_${address}` : null;
}

function getStoredPasswordFlag(address: string | null | undefined) {
  return address ? `wallet_password_set_${address}` : null;
}

function getTemporaryBannerFlag(address: string | null | undefined) {
  return address ? `wallet_temporary_banner_${address}` : null;
}

function isSeedGroupBackedUp(group: BrowserWalletSeedGroup): boolean {
  return group.accounts.some((account) => {
    const key = getBackupFlag(account.address);
    return key ? localStorage.getItem(key) === 'true' : false;
  });
}

function markSeedGroupBackedUp(group: BrowserWalletSeedGroup) {
  for (const account of group.accounts) {
    const key = getBackupFlag(account.address);
    if (key) localStorage.setItem(key, 'true');
  }
}

function seedGroupHasPasswordSet(group: BrowserWalletSeedGroup): boolean {
  return group.accounts.some((account) => {
    const key = getStoredPasswordFlag(account.address);
    return key ? localStorage.getItem(key) === 'true' : false;
  });
}

function syncSeedGroupUiFlags(
  groups: BrowserWalletSeedGroup[],
  targetAddress: string,
): { needsBackup: boolean; showTemporaryBanner: boolean } {
  const groupIndex = findSeedGroupIndexForAddress(groups, targetAddress);
  const group = groups[groupIndex];
  if (!group) {
    const backupKey = getBackupFlag(targetAddress);
    const bannerKey = getTemporaryBannerFlag(targetAddress);
    return {
      needsBackup: backupKey ? localStorage.getItem(backupKey) !== 'true' : false,
      showTemporaryBanner: bannerKey ? localStorage.getItem(bannerKey) === 'true' : false,
    };
  }

  if (isSeedGroupBackedUp(group)) {
    markSeedGroupBackedUp(group);
  }

  if (seedGroupHasPasswordSet(group)) {
    for (const account of group.accounts) {
      const bannerKey = getTemporaryBannerFlag(account.address);
      if (bannerKey) localStorage.removeItem(bannerKey);
    }
  }

  const backupKey = getBackupFlag(targetAddress);
  const bannerKey = getTemporaryBannerFlag(targetAddress);
  return {
    needsBackup: isSeedGroupBackedUp(group) ? false : backupKey ? localStorage.getItem(backupKey) !== 'true' : false,
    showTemporaryBanner: seedGroupHasPasswordSet(group)
      ? false
      : bannerKey
        ? localStorage.getItem(bannerKey) === 'true'
        : false,
  };
}

async function copyTextWithFallback(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const helper = document.createElement('textarea');
  helper.value = value;
  helper.setAttribute('readonly', 'true');
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.focus();
  helper.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(helper);
  }

  return copied;
}

/** Conservative headroom for fees and dust; typical Dogecoin spends are cheaper but UTXO sets vary. */

const PRIMARY_BUTTON =
  'bg-[#FCD34D] hover:bg-[#FDE68A] text-[#161109] font-bold py-2.5 px-4 rounded-2xl shadow-[0_8px_24px_rgba(252,211,77,0.22)] transition';
const SECONDARY_BUTTON =
  'bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold py-2.5 px-4 rounded-2xl shadow-sm transition border border-white/10';
const DANGER_BUTTON =
  'bg-red-500/15 hover:bg-red-500/25 text-red-200 font-bold py-2.5 px-4 rounded-2xl shadow-sm transition border border-red-400/25';
const MODAL_SURFACE =
  'bg-[#0A0A0A] text-text-primary rounded-3xl p-5 shadow-doge border border-white/10';
const INPUT_CLASS = 'wallet-input';

function recommendedFeeRateForDxChain(baseFeeRateKoinuPerKb: number, stageCount: number): number {
  if (stageCount >= 30) return Math.ceil(baseFeeRateKoinuPerKb * 1.75);
  if (stageCount >= 20) return Math.ceil(baseFeeRateKoinuPerKb * 1.5);
  if (stageCount >= 10) return Math.ceil(baseFeeRateKoinuPerKb * 1.25);
  return Math.ceil(baseFeeRateKoinuPerKb);
}

function Button({ className, type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        'min-h-10 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}

export function DojakwebWalletModal({
  isOpen,
  onClose,
  isDark: isDarkProp,
  initialStep = 'chooser',
  initialSettingsTab = 'data',
  openNonce = 0,
  mode = 'drawer',
  drawerSide = 'right',
  onThemeChange,
  initialNftFilter = 'all',
  initialDashboardTab,
  initialAssetType,
}: DojakwebWalletModalProps) {
  const { theme: walletTheme } = useDojakwebTheme();
  const isDark = isDarkProp ?? walletTheme === 'dark';
  const txExplorerPref = useDogeTxExplorerPreference();
  const drawerSurfacePhoneRight = isDark
    ? 'bg-[#0c0c0e] text-text-primary border-l border-white/10 shadow-2xl'
    : 'bg-[#f7f5f0] text-zinc-950 border-l border-zinc-200 shadow-2xl';
  const drawerSurfacePhoneLeft = isDark
    ? 'bg-[#0c0c0e] text-text-primary border-r border-white/10 shadow-2xl'
    : 'bg-[#f7f5f0] text-zinc-950 border-r border-zinc-200 shadow-2xl';
  const {
    walletInterface: gsWalletInterface,
    setWalletInterface: gsSetWalletInterface,
    drawerSide: gsDrawerSide,
    setDrawerSide: gsSetDrawerSide,
  } = useGlobalStore();
  const browser = useBrowserWallet();
  const dojakwebBiometricFacade = useMemo(() => createDojakwebBiometricFacade(), []);
  const {
    connected,
    address,
    disconnect,
    balance,
    balanceVerified,
    balanceRefreshing,
    refreshBalance,
    walletType,
    sendTransaction,
    signPSBTOnly,
    signMessage,
    availableWallets,
    setActiveWallet,
    switchAccount,
    accountIndex: unifiedAccountIndex,
  } = useUnifiedWallet();
  const { t, locale: stashLocale, setLocale: setStashLocale } = useDojakwebI18n();
  const fiatPrefs = useDojakwebFiatOptional();
  const { pfpInscriptionId, setDogePFP, clearDogePFP } = useDogePFP();
  const { pfaInscriptionId, setDogePFA, clearDogePFA } = useDogePFA();

  const [step, setStep] = useState<WalletStep>('chooser');
  const [tab, setTab] = useState<DashboardTab>('assets');
  const [importValue, setImportValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockMode, setUnlockMode] = useState<'password' | 'pin' | 'biometric'>('password');
  const [newPrimarySecret, setNewPrimarySecret] = useState<'password' | 'pin'>('password');
  const [newSecretStrength, setNewSecretStrength] = useState<'standard' | 'high' | 'maximum'>('standard');
  const [enableWebAuthnQuickUnlock, setEnableWebAuthnQuickUnlock] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<WalletData | null>(null);
  const [pendingSeed, setPendingSeed] = useState<SeedMaterial | null>(null);
  const [showSecretPhrase, setShowSecretPhrase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEncryptedWallet, setIsEncryptedWallet] = useState(false);
  const [needsBackup, setNeedsBackup] = useState(false);
  const [showTemporaryBanner, setShowTemporaryBanner] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [activePassword, setActivePassword] = useState<string | undefined>();
  const lockAfterSetPasswordRef = React.useRef(false);
  const stepRef = React.useRef<WalletStep>(step);
  stepRef.current = step;
  const [savedLocalWallets, setSavedLocalWallets] = useState<WalletData[]>([]);
  const [selectedLocalWalletAddress, setSelectedLocalWalletAddress] = useState<string | null>(null);
  const [walletNameDraft, setWalletNameDraft] = useState('');
  const [isSavingWalletName, setIsSavingWalletName] = useState(false);
  const [assetType, setAssetType] = useState<'nft' | 'drc20' | 'treats' | 'dunes' | 'charms' | 'alkanes'>('nft');
  const [nftFilter, setNftFilter] = useState<'all' | 'media' | 'dlotto'>('all');
  /** inscriptionId → is ÐLotto (async classification cache) */
  const [dlottoFlags, setDlottoFlags] = useState<Record<string, boolean>>({});
  const [dlottoClassifying, setDlottoClassifying] = useState(false);
  const [revealPassword, setRevealPassword] = useState('');
  const [inscriptions, setInscriptions] = useState<MyDogeInscription[]>([]);
  const [spendableBreak, setSpendableBreak] = useState<SpendableBalanceBreakdown | null>(null);
  const [spendableBreakBusy, setSpendableBreakBusy] = useState(false);
  const [drc20Tokens, setDrc20Tokens] = useState<DRC20Token[]>([]);
  const [treatsTokens, setTreatsTokens] = useState<Array<{ tick: string; balance: string }>>([]);
  const [dunesHoldings, setDunesHoldings] = useState<DuneHolding[]>([]);
  const [duneSendHolding, setDuneSendHolding] = useState<DuneHolding | undefined>(undefined);
  const [duneSendOpen, setDuneSendOpen] = useState(false);
  const [charmsAssets, setCharmsAssets] = useState<Array<{ id: string; ticker: string; balance: string }>>([]);
  const [alkanesAssets, setAlkanesAssets] = useState<Array<{ id: string; code_hash: string; code_len: number }>>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [sendPrefillAddress, setSendPrefillAddress] = useState<string | null>(null);
  const [platformFeeTip, setPlatformFeeTip] = useState<number>(0);
  const [localRecentTransactions, setLocalRecentTransactions] = useState<DisplayDogeTransaction[]>([]);

  /** Ð𝕏 (Ðoge𝕏ID) flow — Dogenals dx v1.0 */
  const clearDxHostPending = useDxHostStore((s) => s.clearPending);
  const [dxNonce, setDxNonce] = useState('');
  const [dxHandleInput, setDxHandleInput] = useState('');
  const [dxTweetRaw, setDxTweetRaw] = useState('');
  const [dxPhase, setDxPhase] = useState<1 | 2 | 3>(1);
  const [dxPayload, setDxPayload] = useState<DxRegisterPayload | null>(null);
  const [dxBusy, setDxBusy] = useState(false);
  const [dxInscribeBusy, setDxInscribeBusy] = useState(false);
  const [dxFeeRate, setDxFeeRate] = useState(1_000_000);
  const [dxRegisterInscriptionId, setDxRegisterInscriptionId] = useState<string | null>(null);
  const [dxCardInscriptionId, setDxCardInscriptionId] = useState<string | null>(null);
  const [dxEasyJob, setDxEasyJob] = useState<InscribeJobResponse | null>(null);
  const [dxEasyStatus, setDxEasyStatus] = useState<string | null>(null);
  const [dxRevokePrevId, setDxRevokePrevId] = useState('');
  const [dxRevokePayload, setDxRevokePayload] = useState<DxRevokePayload | null>(null);
  const [dxErr, setDxErr] = useState<string | null>(null);
  /** command.dog `/v1/dx/initiate` session (when `VITE_COMMAND_DOG_API_URL` is set). */
  const [dxBackendSessionId, setDxBackendSessionId] = useState<string | null>(null);
  const [dxBackendChoice, setDxBackendChoice] = useState('grok');
  const [dxSessionBusy, setDxSessionBusy] = useState(false);
  const [dxStylePack, setDxStylePack] = useState('trading_card');
  const [dxAttestationVisual, setDxAttestationVisual] = useState<Record<string, unknown> | null>(null);
  const [dxSessionExpiresAtUnix, setDxSessionExpiresAtUnix] = useState<number | null>(null);
  /** Premium: Grok Imagine + rip-pack art. Off = canonical master badge inscription (shared flex tier). */
  const [dxPremiumGrokImagine, setDxPremiumGrokImagine] = useState(false);
  const [dxHostReply, setDxHostReply] = useState<{
    requestId: string;
    origin: string;
    source: Window | null;
  } | null>(null);

  // ── Active wallet derived state ──
  const activeWalletSummary = availableWallets.find((wallet) => wallet.isActive) ?? null;
  const activeWalletType = activeWalletSummary?.type ?? walletType ?? null;
  const activeAddress = activeWalletSummary?.address ?? pendingWallet?.address ?? null;

  const publishProfileBind = useCallback(
    async (role: 'pfp' | 'pfa', mediaInscriptionId: string) => {
      if (!activeAddress || walletType !== 'browser' || !browser.wallet?.privateKey) {
        toast.error(
          t('modal.toast.dpfpPublishNeedBrowser') ||
            'Unlock Local Browser Wallet to publish on-chain. Local profile was still set.',
        );
        return;
      }
      const toastId = toast.loading(
        role === 'pfp' ? 'Publishing ÐPFP on-chain…' : 'Publishing ÐPFA on-chain…',
      );
      try {
        const result = await publishDpfpBindOnChain({
          role,
          op: 'set',
          mediaInscriptionId,
          fromAddress: activeAddress,
          privateKeyWIF: browser.wallet.privateKey,
          feeRate: 1_000_000,
          excludedOutpoints: extractProtectedOutpoints(inscriptions),
          onProgress: (msg) => toast.loading(msg, { id: toastId }),
        });
        toast.success(
          (role === 'pfp'
            ? t('modal.toast.dpfpPublished', { id: result.bindInscriptionId })
            : t('modal.toast.dpfaPublished', { id: result.bindInscriptionId })) ||
            `Published bind ${result.bindInscriptionId}`,
          { id: toastId },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg, { id: toastId });
      }
    },
    [activeAddress, browser.wallet?.privateKey, inscriptions, t, walletType],
  );
  const activeWalletName =
    walletType === 'browser'
      ? (browser.wallet?.nickname?.trim() || pendingWallet?.nickname?.trim() || '')
      : activeWalletSummary?.label ?? '';
  const isBrowserWallet = activeWalletSummary?.type === 'browser' || walletType === 'browser';

  const unlockStepPrefs = useMemo(() => {
    if (step !== 'unlock' || !selectedLocalWalletAddress) return null;
    return readWalletLockPreferences(selectedLocalWalletAddress);
  }, [step, selectedLocalWalletAddress]);
  const showUnlockBiometricTab = Boolean(unlockStepPrefs?.biometricQuickUnlock);
  const localSeedWalletGroups = useMemo(
    () => groupBrowserWalletsBySeed(savedLocalWallets),
    [savedLocalWallets]
  );
  const activeBrowserSeedGroup = useMemo(() => {
    if (!isBrowserWallet || !activeAddress) return null;
    const groupIndex = findSeedGroupIndexForAddress(localSeedWalletGroups, activeAddress);
    return groupIndex >= 0 ? localSeedWalletGroups[groupIndex] : null;
  }, [isBrowserWallet, activeAddress, localSeedWalletGroups]);

  useEffect(() => {
    if (step !== 'verification') {
      setDxPhase(1);
      setDxTweetRaw('');
      setDxPayload(null);
      setDxErr(null);
      setDxBusy(false);
      setDxInscribeBusy(false);
      setDxRegisterInscriptionId(null);
      setDxCardInscriptionId(null);
      setDxHostReply(null);
      setDxBackendSessionId(null);
      setDxBackendChoice('grok');
      setDxSessionBusy(false);
      setDxStylePack('trading_card');
      setDxAttestationVisual(null);
      setDxSessionExpiresAtUnix(null);
      setDxNonce('');
      setDxHandleInput('');
      return;
    }
    const pending = useDxHostStore.getState().pending;
    if (pending) {
      setDxHostReply({
        requestId: pending.requestId,
        origin: pending.origin,
        source: pending.source,
      });
      setDxHandleInput(pending.xHandle.replace(/^@/, ''));
      clearDxHostPending();
    }
    setDxNonce((n) => (n ? n : crypto.randomUUID()));
  }, [step, clearDxHostPending]);

  const dxHostReplyRef = React.useRef(dxHostReply);
  dxHostReplyRef.current = dxHostReply;

  const pushDxResponseToHost = useCallback((payload: DxRegisterPayload | null, mode: 'success' | 'error', errorMessage?: string) => {
    const host = dxHostReplyRef.current;
    const rid = host?.requestId ?? null;
    if (mode === 'success' && payload) {
      const detailOk = { ok: true as const, requestId: rid, register: payload };
      window.dispatchEvent(new CustomEvent('dojakweb-dx-response', { detail: detailOk }));
      if (host?.source && host.origin) {
        const msg: DxPostMessageResponse = {
          type: DOJAKWEB_DX_RESPONSE,
          protocol: DOJAKWEB_DX_PM_PROTOCOL,
          requestId: host.requestId,
          ok: true,
          register: payload as unknown as Record<string, unknown>,
        };
        try {
          host.source.postMessage(msg, host.origin);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    const detailErr = { ok: false as const, requestId: rid, error: errorMessage ?? 'unknown' };
    window.dispatchEvent(new CustomEvent('dojakweb-dx-response', { detail: detailErr }));
    if (host?.source && host.origin) {
      try {
        host.source.postMessage(
          {
            type: DOJAKWEB_DX_RESPONSE,
            protocol: DOJAKWEB_DX_PM_PROTOCOL,
            requestId: host.requestId,
            ok: false,
            error: errorMessage ?? 'unknown',
          },
          host.origin,
        );
      } catch {
        /* ignore */
      }
    }
  }, []);

  /** Local browser: commit/reveal. Extension (MyDoge etc.): Easy inscribe job. */
  const handleDxInscribeRegisterJson = useCallback(async () => {
    if (!dxPayload || !activeAddress) return;
    if (walletType === 'dogewatch') {
      toast.info(
        'Register JSON is ready. Inscription PSBTs are built by command.dog — copy the payload or complete inscribe via the API; sign each PSBT on Dogewatch when prompted.',
      );
      return;
    }
    const json = JSON.stringify(dxPayload);
    const canBrowser = walletType === 'browser' && !!browser.wallet?.privateKey;

    setDxInscribeBusy(true);
    setDxEasyStatus(null);
    try {
      if (canBrowser) {
        const buf = Buffer.from(json, 'utf8');
        const ct = 'application/json';
        const txCount = countDoginalTransactionsForContent(buf, ct);
        const fee = Math.max(dxFeeRate, recommendedFeeRateForDxChain(dxFeeRate, txCount));
        if (fee > dxFeeRate) {
          setDxFeeRate(fee);
          toast.info(
            t('modal.verification.dxFeeRaised', {
              from: dxFeeRate.toLocaleString(),
              to: fee.toLocaleString(),
              txs: String(txCount),
            }),
          );
        }
        const plan = await signDoginalInscriptionChain({
          content: buf,
          contentType: ct,
          fromAddress: activeAddress,
          privateKeyWIF: browser.wallet!.privateKey!,
          feeRate: fee,
          excludedOutpoints: extractProtectedOutpoints(inscriptions),
        });
        await broadcastSignedDoginalChain(plan);
        setDxRegisterInscriptionId(plan.inscriptionId);
        setDxRevokePrevId(plan.inscriptionId);
        toast.success(t('modal.verification.dxInscribeRegisterOk', { id: plan.inscriptionId }));
        return;
      }

      // Easy path — MyDoge / Spooky / other extensions
      if (!isEasyDxInscribeConfigured()) {
        toast.error(t('modal.verification.dxInscribeNeedBrowser'));
        return;
      }
      const job = await createEasyDxInscribeJob({
        jsonBody: json,
        feeRate: dxFeeRate,
        displayName: `Ðoge𝕏ID ${dxPayload.x_handle}`,
      });
      setDxEasyJob(job);
      setDxEasyStatus(
        t('modal.verification.dxEasyCreated', { amount: job.amount_doge }) ||
          `Send ${job.amount_doge} Ð to deposit`,
      );
      toast.success(
        t('modal.verification.dxEasyCreated', { amount: job.amount_doge }) ||
          `Easy job: deposit ${job.amount_doge} Ð`,
      );

      const doge = Number(job.amount_doge) || job.required_sats / 1e8;
      try {
        await sendTransaction(job.deposit_address, doge);
        setDxEasyStatus(t('modal.verification.dxEasyDepositSent') || 'Deposit sent…');
      } catch {
        /* user can pay manually */
      }

      const final = await pollEasyDxInscribeJob(job.job_id, {
        onUpdate: (j) => {
          setDxEasyJob(j);
          setDxEasyStatus(`${j.status}${j.funding_complete ? ' · funded' : ''}`);
        },
      });
      setDxEasyJob(final);
      const id = final.items?.[0]?.inscription_id;
      if (final.status === 'complete' && id) {
        setDxRegisterInscriptionId(id);
        setDxRevokePrevId(id);
        toast.success(t('modal.verification.dxEasyDone', { id }) || `Inscribed ${id}`);
      } else {
        toast.error(
          t('modal.verification.dxEasyFailed', {
            err: final.last_error || final.status,
          }) || final.last_error || 'Easy inscribe failed',
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isBroadcastInputRejected(msg)) {
        toast.error(t('modal.verification.dxInscribeSpendRejected'));
      } else if (isMempoolChainLimitError(msg)) {
        toast.error(t('modal.verification.dxInscribeMempoolChain'));
      } else {
        toast.error(msg);
      }
    } finally {
      setDxInscribeBusy(false);
    }
  }, [
    activeAddress,
    browser.wallet?.privateKey,
    dxFeeRate,
    dxPayload,
    inscriptions,
    sendTransaction,
    t,
    toast,
    walletType,
  ]);

  const handleDxInscribeRevoke = useCallback(async () => {
    if (!activeAddress) return;
    let handle: string;
    try {
      handle = normalizeDxXHandle(dxHandleInput || dxPayload?.x_handle || '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return;
    }
    const prev = (dxRevokePrevId || dxRegisterInscriptionId || '').trim().toLowerCase();
    if (!prev.includes('i')) {
      toast.error(t('modal.verification.dxRevokePrevId') || 'Previous register inscription id required');
      return;
    }
    setDxInscribeBusy(true);
    setDxEasyStatus(null);
    try {
      const challenge = buildDxRevokeSigningMessage(handle, activeAddress, prev);
      const signatureBase64 = await signMessage(challenge);
      const payload = buildDxRevokePayload({
        xHandle: handle,
        dogeAddress: activeAddress,
        previousInscriptionId: prev,
        signatureBase64,
      });
      setDxRevokePayload(payload);
      const json = JSON.stringify(payload);
      const canBrowser = walletType === 'browser' && !!browser.wallet?.privateKey;

      if (canBrowser) {
        const buf = Buffer.from(json, 'utf8');
        const plan = await signDoginalInscriptionChain({
          content: buf,
          contentType: 'application/json',
          fromAddress: activeAddress,
          privateKeyWIF: browser.wallet!.privateKey!,
          feeRate: dxFeeRate,
          excludedOutpoints: extractProtectedOutpoints(inscriptions),
        });
        await broadcastSignedDoginalChain(plan);
        toast.success(t('modal.verification.dxRevokeOk', { id: plan.inscriptionId }));
        return;
      }

      if (!isEasyDxInscribeConfigured()) {
        toast.error(t('modal.verification.dxInscribeNeedBrowser'));
        return;
      }
      const job = await createEasyDxInscribeJob({
        jsonBody: json,
        feeRate: dxFeeRate,
        displayName: `Ðoge𝕏ID revoke ${handle}`,
      });
      setDxEasyJob(job);
      try {
        const doge = Number(job.amount_doge) || job.required_sats / 1e8;
        await sendTransaction(job.deposit_address, doge);
      } catch {
        /* manual pay */
      }
      const final = await pollEasyDxInscribeJob(job.job_id, {
        onUpdate: (j) => setDxEasyJob(j),
      });
      const id = final.items?.[0]?.inscription_id;
      if (final.status === 'complete' && id) {
        toast.success(t('modal.verification.dxRevokeOk', { id }));
      } else {
        toast.error(final.last_error || 'Revoke Easy inscribe failed');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDxInscribeBusy(false);
    }
  }, [
    activeAddress,
    browser.wallet?.privateKey,
    dxFeeRate,
    dxHandleInput,
    dxPayload?.x_handle,
    dxRegisterInscriptionId,
    dxRevokePrevId,
    inscriptions,
    sendTransaction,
    signMessage,
    t,
    toast,
    walletType,
  ]);

  const handleDxInscribeWalletCard = useCallback(async () => {
    if (!dxPayload || !activeAddress) return;
    const badgeId = dxBadgeInscriptionIdFromEnv();
    if (!badgeId) {
      toast.error(t('modal.verification.dxBadgeIdMissing'));
      return;
    }
    if (walletType === 'dogewatch') {
      toast.info(
        'Wallet card inscribe needs command.dog or the in-browser wallet. Dogewatch signs PSBTs once the API returns them.',
      );
      return;
    }
    if (walletType !== 'browser' || !browser.wallet?.privateKey) {
      toast.error(t('modal.verification.dxInscribeNeedBrowser'));
      return;
    }
    setDxInscribeBusy(true);
    try {
      const html = buildDxWalletCardHtml({
        badgeInscriptionId: badgeId,
        contentApiBaseUrl: defaultDxContentApiBase(),
        xHandle: dxPayload.x_handle,
        dogeAddress: dxPayload.doge_address,
        tweetId: dxPayload.proof.tweet_id,
        nonce: dxPayload.proof.nonce,
      });
      const buf = Buffer.from(html, 'utf8');
      const ct = 'text/html;charset=utf-8';
      const txCount = countDoginalTransactionsForContent(buf, ct);
      const fee = Math.max(dxFeeRate, recommendedFeeRateForDxChain(dxFeeRate, txCount));
      if (fee > dxFeeRate) {
        setDxFeeRate(fee);
        toast.info(
          t('modal.verification.dxFeeRaised', {
            from: dxFeeRate.toLocaleString(),
            to: fee.toLocaleString(),
            txs: String(txCount),
          }),
        );
      }
      const plan = await signDoginalInscriptionChain({
        content: buf,
        contentType: ct,
        fromAddress: activeAddress,
        privateKeyWIF: browser.wallet.privateKey,
        feeRate: fee,
        excludedOutpoints: extractProtectedOutpoints(inscriptions),
      });
      await broadcastSignedDoginalChain(plan);
      setDxCardInscriptionId(plan.inscriptionId);
      toast.success(t('modal.verification.dxInscribeCardOk', { id: plan.inscriptionId }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isBroadcastInputRejected(msg)) {
        toast.error(t('modal.verification.dxInscribeSpendRejected'));
      } else if (isMempoolChainLimitError(msg)) {
        toast.error(t('modal.verification.dxInscribeMempoolChain'));
      } else {
        toast.error(msg);
      }
    } finally {
      setDxInscribeBusy(false);
    }
  }, [activeAddress, browser.wallet?.privateKey, dxFeeRate, dxPayload, inscriptions, t, toast, walletType]);

  const pushLocalTransaction = useCallback((tx: DisplayDogeTransaction) => {
    setLocalRecentTransactions((prev) => {
      const next = [tx, ...prev.filter((item) => item.txid !== tx.txid)];
      return next.slice(0, 12);
    });
  }, []);

  const resolveInscriptionMediaUrl = useCallback((inscription: MyDogeInscription | null) => {
    if (!inscription) return '';
    const id = inscription.inscriptionId?.trim();
    const preview = inscription.preview?.trim();
    const content = inscription.content?.trim();
    if (id) return dogexCdnContentUrl(id);
    if (preview) return preview;
    if (content) return content;
    return '';
  }, []);

  // ── Inscription action state ──
  const [selectedInscription, setSelectedInscription] = useState<MyDogeInscription | null>(null);
  const [inscriptionSendRecipient, setInscriptionSendRecipient] = useState('');
  const [inscriptionSendBusy, setInscriptionSendBusy] = useState(false);
  const [inscriptionSendReviewBusy, setInscriptionSendReviewBusy] = useState(false);
  const [inscriptionSendDraft, setInscriptionSendDraft] = useState<SendInscriptionPsbtDraft | null>(null);
  const [inscriptionSendTxid, setInscriptionSendTxid] = useState<string | null>(null);
  const [inscriptionSendError, setInscriptionSendError] = useState<string | null>(null);

  // ── Listing state ──
  const [listingPriceDoge, setListingPriceDoge] = useState('');
  const [listingBusy, setListingBusy] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingReviewing, setListingReviewing] = useState(false);
  const [listingSignedPsbt, setListingSignedPsbt] = useState<string | null>(null);
  const [listingShareUrl, setListingShareUrl] = useState<string | null>(null);
  const [listingDogePsdtUri, setListingDogePsbtUri] = useState<string | null>(null);
  const [listingNostrPublished, setListingNostrPublished] = useState(false);
  const [listingPublishRelayResults, setListingPublishRelayResults] = useState<NostrPublishRelayResult[]>([]);
  const [showListingPublishDetails, setShowListingPublishDetails] = useState(false);
  const [activeListings, setActiveListings] = useState<ActiveListing[]>([]);
  const [qrListingId, setQrListingId] = useState<string | null>(null);

  // ── Transactions state ──
  const [transactions, setTransactions] = useState<DogeTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [selectedTx, setSelectedTx] = useState<DisplayDogeTransaction | null>(null);
  const [walletTxJournal, setWalletTxJournal] = useState<DojakwebWalletTxEntry[]>(() =>
    typeof window !== 'undefined' ? loadWalletTxJournal() : [],
  );
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [trueCancelBusy, setTrueCancelBusy] = useState(false);
  const [trueCancelError, setTrueCancelError] = useState<string | null>(null);

  // ── Settings state ──
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('data');
  const [settingsProvider, setSettingsProvider] = useState<WalletDataProviderType>('mydoge');
  const [settingsCustomUrl, setSettingsCustomUrl] = useState('');
  const [settingsMergeInuBits, setSettingsMergeInuBits] = useState(true);
  const [settingsHideTextJson, setSettingsHideTextJson] = useState(false);
  const [settingsOneClickLocalSigning, setSettingsOneClickLocalSigning] = useState(false);
  const [settingsOneClickLocalSigningMaxDoge, setSettingsOneClickLocalSigningMaxDoge] = useState('0.05');
  const [hideTextJsonInscriptions, setHideTextJsonInscriptions] = useState(
    () => getWalletDataProviderConfig().hideTextJsonInscriptions === true,
  );
  const [textInspectItem, setTextInspectItem] = useState<MyDogeInscription | null>(null);
  /** Local per-address hide list (does not affect chain ownership). */
  const [hiddenInscriptionIds, setHiddenInscriptionIds] = useState<Set<string>>(() => new Set());
  const [showHiddenInscriptions, setShowHiddenInscriptions] = useState(false);

  useEffect(() => {
    if (!activeAddress) {
      setHiddenInscriptionIds(new Set());
      return;
    }
    setHiddenInscriptionIds(loadHiddenInscriptionIds(activeAddress));
    const onChange = (ev: Event) => {
      const detail = (ev as CustomEvent<{ address?: string }>).detail;
      if (detail?.address && detail.address.toLowerCase() !== activeAddress.toLowerCase()) return;
      setHiddenInscriptionIds(loadHiddenInscriptionIds(activeAddress));
    };
    window.addEventListener('dojakweb-hidden-inscriptions-changed', onChange);
    return () => window.removeEventListener('dojakweb-hidden-inscriptions-changed', onChange);
  }, [activeAddress]);

  const uniqueInscriptions = useMemo(() => {
    const byId = new Map<string, MyDogeInscription>();
    for (const item of inscriptions) {
      const id = (item.inscriptionId || '').trim().toLowerCase();
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, item);
    }
    return Array.from(byId.values());
  }, [inscriptions]);

  const visibleInscriptions = useMemo(() => {
    let list = uniqueInscriptions;
    if (!showHiddenInscriptions && hiddenInscriptionIds.size > 0) {
      list = list.filter((item) => {
        const id = (item.inscriptionId || '').trim();
        return id ? !hiddenInscriptionIds.has(id) : true;
      });
    }
    if (nftFilter === 'media') {
      return list.filter((item) => !isTextishInscription(item.contentType));
    }
    if (nftFilter === 'dlotto') {
      return list.filter((item) => isTextishInscription(item.contentType));
    }
    if (hideTextJsonInscriptions) {
      list = list.filter((item) => !isTextishInscription(item.contentType));
    }
    return list;
  }, [
    uniqueInscriptions,
    hideTextJsonInscriptions,
    nftFilter,
    dlottoFlags,
    hiddenInscriptionIds,
    showHiddenInscriptions,
  ]);

  const textJsonInscriptionCount = useMemo(
    () => uniqueInscriptions.filter((item) => isTextishInscription(item.contentType)).length,
    [uniqueInscriptions],
  );

  // Classify text/JSON inscriptions for ÐLotto filter (best-effort content fetch).
  useEffect(() => {
    if (nftFilter !== 'dlotto' || !isOpen) return;
    const candidates = uniqueInscriptions.filter((item) => isTextishInscription(item.contentType));
    let cancelled = false;
    const ac = new AbortController();

    void (async () => {
      const seed: Record<string, boolean> = {};
      const toFetch: MyDogeInscription[] = [];
      for (const item of candidates) {
        const id = (item.inscriptionId || '').trim().toLowerCase();
        if (!id) continue;
        if (item.contentBody) {
          seed[id] = isDlottoInscriptionText(item.contentBody);
        } else {
          toFetch.push(item);
        }
      }
      if (Object.keys(seed).length) {
        setDlottoFlags((prev) => ({ ...prev, ...seed }));
      }

      setDlottoClassifying(true);
      const next: Record<string, boolean> = {};
      for (const item of toFetch.slice(0, 40)) {
        if (cancelled) break;
        const id = (item.inscriptionId || '').trim().toLowerCase();
        try {
          const body = await loadInscriptionTextBody({
            contentBody: item.contentBody,
            contentUrl: item.content || item.preview,
            inscriptionId: item.inscriptionId,
            signal: ac.signal,
          });
          next[id] = isDlottoInscriptionText(body);
        } catch {
          next[id] = false;
        }
      }
      if (!cancelled) {
        if (Object.keys(next).length) setDlottoFlags((prev) => ({ ...prev, ...next }));
        setDlottoClassifying(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      setDlottoClassifying(false);
    };
  }, [nftFilter, isOpen, uniqueInscriptions]);

  const gridInscriptions = useMemo(() => {
    if (nftFilter !== 'dlotto') return visibleInscriptions;
    return visibleInscriptions.filter((item) => {
      const id = (item.inscriptionId || '').trim().toLowerCase();
      if (item.contentBody && isDlottoInscriptionText(item.contentBody)) return true;
      if (id && dlottoFlags[id] === true) return true;
      if (id && dlottoFlags[id] === false) return false;
      return dlottoClassifying;
    });
  }, [nftFilter, visibleInscriptions, dlottoFlags, dlottoClassifying]);
  const [settingsIndexerApiBase, setSettingsIndexerApiBase] = useState('');
  const [settingsDogexCdnBase, setSettingsDogexCdnBase] = useState('');
  type IndexerHealthRow = {
    status: 'idle' | 'loading' | 'ok' | 'warn' | 'err';
    message?: string;
    latencyMs?: number;
    tipHeight?: number;
  };
  const [indexerHealth, setIndexerHealth] = useState<IndexerHealthRow>({ status: 'idle' });
  const [settingsBroadcast, setSettingsBroadcast] = useState<BroadcastConfig>({
    broadcastProvider: 'auto', broadcastPriority: DEFAULT_BROADCAST_PRIORITY, rpcUrl: 'http://127.0.0.1:22555', rpcUser: '', rpcPass: '', tatumApiKey: '',
  });
  const [draggedBroadcastProvider, setDraggedBroadcastProvider] = useState<BroadcastRelayProvider | null>(null);
  const [disabledBroadcastProviders, setDisabledBroadcastProviders] = useState<BroadcastRelayProvider[]>([]);
  const [showBroadcastInfo, setShowBroadcastInfo] = useState<BroadcastRelayProvider | null>(null);
  const [showPriceInfo, setShowPriceInfo] = useState<string | null>(null);
  const [settingsChainExplorer, setSettingsChainExplorer] = useState<DogeTxExplorerId>('dogenals');
  const [settingsPriceSources, setSettingsPriceSources] = useState<DogePriceSourceId[]>(
    () => getDogePriceSourceConfig().sources
  );
  const [draggedPriceSourceId, setDraggedPriceSourceId] = useState<DogePriceSourceId | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [rpcTestStatus, setRpcTestStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [rpcTestBlocks, setRpcTestBlocks] = useState<number | null>(null);
  const [rpcTestError, setRpcTestError] = useState<string | null>(null);
  const [rpcTestSubline, setRpcTestSubline] = useState<string | null>(null);
  const [rpcTestIbd, setRpcTestIbd] = useState(false);

  type RelayHealthRow = {
    status: 'idle' | 'loading' | 'ok' | 'err';
    message?: string;
    latencyMs?: number;
  };
  const [relayHealthByProvider, setRelayHealthByProvider] = useState<
    Partial<Record<BroadcastRelayProvider, RelayHealthRow>>
  >({});
  const [relayTestAllBusy, setRelayTestAllBusy] = useState(false);
  const dogeRpcProxyDisplayUrl = browserRpcProxyAbsoluteUrl();
  const hostedDeployLikely =
    typeof window !== 'undefined' &&
    !!dogeRpcProxyDisplayUrl &&
    !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  const localWallets = availableWallets.filter((wallet) => wallet.type === 'browser');
  const extensionWallets = availableWallets.filter((wallet) => wallet.type === 'mydoge' || wallet.type === 'spookydoge' || wallet.type === 'dojak');
  const hardwareWallets = availableWallets.filter(
    (wallet) => wallet.type === 'ledger' || wallet.type === 'dogewatch'
  );
  const mergedTransactions: DisplayDogeTransaction[] = useMemo(() => {
    const localFirst = [
      ...localRecentTransactions,
      ...transactions.filter((tx) => !localRecentTransactions.some((localTx) => localTx.txid === tx.txid)),
    ];
    return mergeWalletTxJournalIntoList(localFirst, walletTxJournal, { address: activeAddress });
  }, [localRecentTransactions, transactions, walletTxJournal, activeAddress]);

  useEffect(() => {
    setWalletTxJournal(loadWalletTxJournal());
    return subscribeWalletTxJournal(() => setWalletTxJournal(loadWalletTxJournal()));
  }, []);

  // When MyDoge (or other) history confirms a journaled tx, advance journal status.
  useEffect(() => {
    for (const tx of transactions) {
      const txid = tx.txid?.trim().toLowerCase();
      if (!txid) continue;
      const entry = walletTxJournal.find((row) => row.txid === txid);
      if (!entry) continue;
      if (tx.confirmations > 0 && (entry.status === 'broadcasted' || entry.status === 'seen')) {
        upsertWalletTxJournalEntry({
          txid,
          address: entry.address,
          protocol: entry.protocol,
          action: entry.action,
          title: entry.title,
          summary: entry.summary,
          status: 'confirmed',
          originHost: entry.originHost,
          originPath: entry.originPath,
          originLabel: entry.originLabel,
          metadata: entry.metadata,
        });
      } else if (!tx.pending && entry.status === 'broadcasted') {
        upsertWalletTxJournalEntry({
          txid,
          address: entry.address,
          protocol: entry.protocol,
          action: entry.action,
          title: entry.title,
          summary: entry.summary,
          status: 'seen',
          originHost: entry.originHost,
          originPath: entry.originPath,
          originLabel: entry.originLabel,
          metadata: entry.metadata,
        });
      }
    }
  }, [transactions, walletTxJournal]);

  const refreshSavedLocalWallets = useCallback(async () => {
    const storage = new BrowserWallet();
    const wallets = await storage.listWallets();
    setSavedLocalWallets(wallets);
    setSelectedLocalWalletAddress(localStorage.getItem('dojakweb_wallet_current'));
  }, []);

  const moveBroadcastProvider = useCallback((dragged: BroadcastRelayProvider, target: BroadcastRelayProvider) => {
    if (dragged === target) return;
    setSettingsBroadcast(prev => {
      const current = normalizeBroadcastPriority(prev.broadcastPriority);
      const withoutDragged = current.filter((item) => item !== dragged);
      const targetIndex = withoutDragged.indexOf(target);
      const next = [...withoutDragged];
      next.splice(targetIndex, 0, dragged);
      return { ...prev, broadcastPriority: next };
    });
  }, []);

  // Backup handler for exporting wallet as ZIP
  const handleBackupZip = async () => {
    const currentWallet = walletType === 'browser' ? (browser.wallet ?? pendingWallet) : null;
    if (!currentWallet) {
      toast.error(t('modal.toast.backupZipLocalOnly'));
      return;
    }
    // Determine encryption password
    let encryptPassword: string | undefined;
    const isEncrypted = await new BrowserWallet().isEncrypted(currentWallet.address);
    if (isEncrypted) {
      if (activePassword) {
        encryptPassword = activePassword;
      } else {
        toast.error(t('modal.toast.backupNeedSessionPw'));
        return;
      }
    } else {
      const hasPasswordFlag = getStoredPasswordFlag(currentWallet.address);
      const walletHasPassword = hasPasswordFlag ? localStorage.getItem(hasPasswordFlag) === 'true' : false;
      if (walletHasPassword && activePassword) {
        encryptPassword = activePassword;
      } else {
        toast.warning(t('modal.toast.backupZipUnencryptedWarn'));
        // Proceed without encryption (encryptPassword stays undefined)
      }
    }
    // Load seed material so the mnemonic is included in the backup
    let mnemonic: string | undefined;
    try {
      const seed = pendingSeed ?? await browser.loadSeedMaterial(encryptPassword, currentWallet.address);
      mnemonic = seed?.mnemonic ?? undefined;
    } catch {
      // Seed unavailable (e.g. wallet was originally imported without a mnemonic)
    }
    // Prepare wallet data JSON
    const walletJson = JSON.stringify({ ...currentWallet, ...(mnemonic ? { mnemonic } : {}) }, null, 2);
    let fileData = walletJson;
    let fileName = `dojakweb-wallet-${currentWallet.address}.json`;
    if (encryptPassword) {
      fileData = await encryptText(walletJson, encryptPassword);
      fileName = `dojakweb-wallet-${currentWallet.address}-encrypted.json`;
    }
    const zip = new JSZip();
    zip.file(fileName, fileData);
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dojakweb-wallet-backup-${currentWallet.address}.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    toast.success(encryptPassword ? t('modal.toast.backupZipEncrypted') : t('modal.toast.backupZipPlain'));
    // Downloading a recovery archive counts as backing up.
    if (currentWallet.address) {
      const groupIndex = findSeedGroupIndexForAddress(localSeedWalletGroups, currentWallet.address);
      const group = localSeedWalletGroups[groupIndex];
      if (group) {
        markSeedGroupBackedUp(group);
      } else {
        const key = getBackupFlag(currentWallet.address);
        if (key) localStorage.setItem(key, 'true');
      }
      setNeedsBackup(false);
    }
  };

  const importWalletFromRaw = async (rawInput: string) => {
    const raw = rawInput.trim();
    if (!raw) throw new Error(t('modal.throws.enterPhraseOrKey'));

    let imported: WalletData;
    let seedMaterial: SeedMaterial | null = null;
    if (looksLikeMnemonic(raw)) {
      imported = await browser.importWalletFromMnemonic(raw);
      seedMaterial = { mnemonic: raw.trim().replace(/\s+/g, ' '), passphrase: '' };
    } else {
      imported = await browser.importWallet(raw);
    }

    const backupKey = getBackupFlag(imported.address);
    if (backupKey) localStorage.setItem(backupKey, 'true');
    setPendingWallet(imported);
    setPendingSeed(seedMaterial);
    setStep('password');
    toast.success(t('modal.toast.walletImportedSetPw'), { duration: 5000 });
  };

  const importWalletFromZipFile = async (file: File) => {
    const zip = await JSZip.loadAsync(file);
    const jsonFile = Object.keys(zip.files).find((name) => name.endsWith('.json'));
    if (!jsonFile) throw new Error(t('modal.throws.zipNoJson'));
    const fileRef = zip.file(jsonFile);
    if (!fileRef) throw new Error(t('modal.throws.zipJsonMissing'));
    const fileData = await fileRef.async('string');
    let walletJson = fileData;
    let walletObj: any = null;
    let decryptPasswordUsed: string | undefined;
    try {
      walletObj = JSON.parse(walletJson);
    } catch {
      const password = prompt(t('modal.prompt.decryptBackup'));
      if (!password) throw new Error(t('modal.throws.zipPasswordRequired'));
      const result = await decryptText(walletJson, password);
      walletJson = result.value;
      walletObj = JSON.parse(walletJson);
      decryptPasswordUsed = password;
    }
    if (!walletObj.address || !walletObj.privateKey) {
      throw new Error(t('modal.throws.invalidBackup'));
    }
    const { mnemonic: importedMnemonic, ...walletData } = walletObj;
    const importedSeed = importedMnemonic ? { mnemonic: importedMnemonic, passphrase: '' } : null;
    setPendingWallet(walletData);
    setPendingSeed(importedSeed);

    // Encrypted ZIP import: user already entered a decrypt password.
    // Reuse it as the wallet password so the user isn't prompted twice in a row.
    if (decryptPasswordUsed?.trim()) {
      await finalizeWallet(decryptPasswordUsed, walletData, importedSeed);
      const backupKey = getBackupFlag(walletData.address);
      if (backupKey) localStorage.setItem(backupKey, 'true');
      toast.success(t('modal.toast.walletImportedZip'));
      return;
    }

    // Plain JSON ZIP import: require password setup as a separate step.
    await browser.saveWallet(
      walletData,
      undefined,
      importedSeed ? { seedMaterial: importedSeed } : undefined
    );
    const backupKey = getBackupFlag(walletData.address);
    if (backupKey) localStorage.setItem(backupKey, 'true');
    setStep('password');
    toast.success(t('modal.toast.walletImportedZip'));
  };

  const handleImportFile = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.txt,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const isZip = file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip');
        if (isZip) {
          await importWalletFromZipFile(file);
        } else {
          const text = await file.text();
          const extracted = extractImportableSecret(text);
          if (!extracted) {
            throw new Error(t('modal.throws.fileNoSecret'));
          }
          await importWalletFromRaw(extracted);
        }
      } catch (err) {
        toast.error(t('modal.toast.importFailedPrefix') + (err instanceof Error ? err.message : String(err)));
      }
    };
    input.click();
  };

  useEffect(() => {
    if (!activeAddress || typeof window === 'undefined') {
      setNeedsBackup(false);
      return;
    }
    const { needsBackup: nextNeedsBackup } = syncSeedGroupUiFlags(localSeedWalletGroups, activeAddress);
    setNeedsBackup(nextNeedsBackup);
  }, [activeAddress, step, connected, localSeedWalletGroups]);

  useEffect(() => {
    if (step !== 'reveal') {
      setShowSecretPhrase(false);
      setRevealPassword('');
    }
  }, [step]);

  useEffect(() => {
    if (!isOpen) return;

    const syncState = async () => {
      setError(null);

      // Fully unlocked = session holds private key (not just address/balance UI).
      const browserSessionActive = Boolean(
        browser.connected && browser.address && browser.wallet?.privateKey,
      );

      if (!browserSessionActive) {
        setPassword('');
        setConfirmPassword('');
        setUnlockPassword('');
      }
      setImportValue('');
      // Send form state lives in WalletSendFlow — do not reset setters removed from this modal.
      // Don't clobber an in-progress seed backup / password / import flow when
      // connect() flips browser.connected (turnkey create lands on reveal).
      const holdWizardStep = (
        [
          'reveal',
          'password',
          'import',
          'send',
          'receive',
          'send_inscription',
          'list_inscription',
          'utxos',
          'settings',
          'switch_wallet',
          'address_book',
          'remove',
          'set_name',
          'verification',
        ] as WalletStep[]
      ).includes(stepRef.current);
      if (!holdWizardStep) {
        setShowSecretPhrase(false);
      }
      await refreshSavedLocalWallets();

      // Local create/import flow — don't yank back to the all-wallets chooser.
      const keepLocalBrowserWizard = (
        ['chooser', 'entry', 'import', 'reveal', 'password'] as WalletStep[]
      ).includes(stepRef.current);

      if (!connected && !browserSessionActive && localStorage.getItem(BROWSER_WALLET_RESTORE_BLOCK_KEY) === 'true') {
        if (!holdWizardStep && !keepLocalBrowserWizard) setStep('chooser');
        return;
      }

      if (browserSessionActive && browser.address) {
        const uiFlags = syncSeedGroupUiFlags(localSeedWalletGroups, browser.address);
        setNeedsBackup(uiFlags.needsBackup);
        setShowTemporaryBanner(uiFlags.showTemporaryBanner);
        if (!holdWizardStep) {
          setStep('dashboard');
        }
        if (walletType !== 'browser') {
          try {
            setActiveWallet('browser');
          } catch {
            // Unified type will adopt browser on the next context tick.
          }
        }
        return;
      }

      if (connected && address) {
        const uiFlags = syncSeedGroupUiFlags(localSeedWalletGroups, address);
        setNeedsBackup(uiFlags.needsBackup);
        setShowTemporaryBanner(uiFlags.showTemporaryBanner);
        if (!holdWizardStep) {
          setStep('dashboard');
        }
        return;
      }

      const hasWallet = await browser.hasWallet();
      if (!hasWallet) {
        if (!keepLocalBrowserWizard) setStep('chooser');
        return;
      }

      // Guard: hasWallet() true but listWallets() empty (stale localStorage).
      const walletList = await new BrowserWallet().listWallets();
      if (!walletList.length) {
        if (!keepLocalBrowserWizard) setStep('chooser');
        return;
      }

      const current = localStorage.getItem('dojakweb_wallet_current');
      setSelectedLocalWalletAddress(current);
      const encrypted = await new BrowserWallet().isEncrypted(current ?? undefined);
      setIsEncryptedWallet(encrypted);

      if (encrypted) {
        // Tab session unlock: reuse password from sessionStorage without re-prompt.
        try {
          const sessionSecret = await createDojakwebSessionSecretStore().getSecret();
          if (sessionSecret) {
            const loaded = await browser.loadWallet(sessionSecret, current ?? undefined);
            if (loaded?.privateKey) {
              await browser.connect(loaded);
              setActivePassword(sessionSecret);
              const uiFlags = syncSeedGroupUiFlags(localSeedWalletGroups, loaded.address);
              setNeedsBackup(uiFlags.needsBackup);
              setShowTemporaryBanner(uiFlags.showTemporaryBanner);
              if (!holdWizardStep) setStep('dashboard');
              try {
                setActiveWallet('browser');
              } catch {
                /* ignore */
              }
              return;
            }
          }
        } catch {
          /* fall through to unlock UI */
        }
        setStep('unlock');
        return;
      }

      try {
        const loaded = await browser.loadWallet();
        if (loaded) {
          await browser.connect(loaded);
          const uiFlags = syncSeedGroupUiFlags(localSeedWalletGroups, loaded.address);
          setNeedsBackup(uiFlags.needsBackup);
          setShowTemporaryBanner(uiFlags.showTemporaryBanner);
          setStep('dashboard');
          if (walletType !== 'browser') {
            try {
              setActiveWallet('browser');
            } catch {
              // Ignore — connect succeeded in browser context.
            }
          }
          return;
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : t('modal.errors.loadWallet'));
      }

      if (!keepLocalBrowserWizard) setStep('chooser');
    };

    void syncState();
  }, [
    address,
    browser.address,
    browser.connected,
    // Re-run when private key lands (unlock / session restore) so we leave unlock UI.
    browser.wallet?.privateKey,
    browser.hasWallet,
    browser.loadWallet,
    browser.connect,
    connected,
    isOpen,
    refreshSavedLocalWallets,
    setActiveWallet,
    t,
    walletType,
  ]);

  useEffect(() => {
    setWalletNameDraft(activeWalletName);
  }, [activeWalletName, activeAddress]);

  const handleCreateWallet = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const created = await browser.createWallet();
      if (!created.mnemonic) {
        throw new Error(t('modal.throws.mnemonicUnavailableCreated'));
      }
      const seed: SeedMaterial = { mnemonic: created.mnemonic, passphrase: '' };
      setPendingWallet(created);
      setPendingSeed(seed);
      setShowSecretPhrase(true);

      // Persist + connect immediately so the dApp is usable without extra steps.
      // Recovery backup stays pending until phrase confirm, password/PIN, or ZIP.
      const saved = await finalizeWallet(undefined, created, seed, undefined, {
        afterStep: 'reveal',
        markNeedsBackup: true,
        toastKey: 'modal.toast.newWalletReady',
      });
      if (!saved) {
        throw new Error(t('modal.errors.createWallet'));
      }
      try {
        setActiveWallet('browser');
      } catch {
        try {
          localStorage.setItem('wallet_type', 'browser');
        } catch {
          // Ignore localStorage failures.
        }
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.createWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportWallet = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await importWalletFromRaw(importValue);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.importWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  const finalizeWallet = async (
    nextPassword?: string,
    walletOverride?: WalletData | null,
    seedOverride?: SeedMaterial | null,
    saveOpts?: { pbkdf2Iterations?: number },
    uiOpts?: {
      afterStep?: 'dashboard' | 'reveal' | 'password';
      markNeedsBackup?: boolean;
      toastKey?: string;
    },
  ): Promise<WalletData | null> => {
    const walletToPersist =
      walletOverride ??
      pendingWallet ??
      (walletType === 'browser' ? (browser.wallet ?? (activeAddress ? await browser.loadWallet() : null)) : null);
    if (!walletToPersist) return null;
    const persistPassword = nextPassword?.trim() || undefined;
    if (persistPassword) setActivePassword(persistPassword);
    localStorage.removeItem(BROWSER_WALLET_RESTORE_BLOCK_KEY);
    await browser.saveWallet(walletToPersist, persistPassword, {
      seedMaterial: seedOverride ?? pendingSeed ?? undefined,
      pbkdf2Iterations: saveOpts?.pbkdf2Iterations,
    });
    await browser.connect(walletToPersist);
    // Keep unlocked for this browser tab after setting a password (until disconnect/tab end).
    if (persistPassword) {
      try {
        await createDojakwebSessionSecretStore().saveSecret(persistPassword);
      } catch {
        /* best-effort session unlock */
      }
    }
    const passwordKey = getStoredPasswordFlag(walletToPersist.address);
    const bannerKey = getTemporaryBannerFlag(walletToPersist.address);
    const backupKey = getBackupFlag(walletToPersist.address);
    if (passwordKey) {
      if (persistPassword) {
        localStorage.setItem(passwordKey, 'true');
      } else {
        localStorage.removeItem(passwordKey);
      }
    }
    if (bannerKey) {
      if (persistPassword) {
        localStorage.removeItem(bannerKey);
        setShowTemporaryBanner(false);
      } else {
        localStorage.setItem(bannerKey, 'true');
        setShowTemporaryBanner(true);
      }
    }
    // Password/PIN encrypts seed on-device — counts as a recovery backup.
    if (persistPassword && backupKey) {
      localStorage.setItem(backupKey, 'true');
      setNeedsBackup(false);
    } else if (uiOpts?.markNeedsBackup && backupKey) {
      localStorage.removeItem(backupKey);
      setNeedsBackup(true);
    } else if (backupKey) {
      const uiFlags = syncSeedGroupUiFlags(localSeedWalletGroups, walletToPersist.address);
      setNeedsBackup(uiFlags.needsBackup);
    }
    setPendingWallet(walletToPersist);
    await refreshSavedLocalWallets();
    setStep(uiOpts?.afterStep ?? 'dashboard');
    if (uiOpts?.toastKey === 'modal.toast.newWalletReady') {
      toast.success(t('modal.toast.newWalletReady'), { duration: 5500 });
    } else {
      toast.success(persistPassword ? t('modal.toast.walletSecured') : t('modal.toast.walletReadyNoPw'), {
        duration: 5000,
      });
    }

    // If the user hit "lock" while no password existed yet, immediately lock again
    // after we persist the password (and close the modal).
    if (lockAfterSetPasswordRef.current) {
      lockAfterSetPasswordRef.current = false;
      await browser.disconnect();
      onClose();
    }
    return walletToPersist;
  };

  const handleUnlockWallet = async () => {
    setIsBusy(true);
    setError(null);
    try {
      if (unlockMode === 'biometric') {
        const unlockedRef: { current: WalletData | null } = { current: null };
        const result = await dojakwebBiometricFacade.unlockWalletWithBiometric(async (secret: string) => {
          const loaded = await browser.loadWallet(secret);
          if (!loaded) {
            throw new Error(t('modal.throws.unlockWrong'));
          }
          await browser.connect(loaded);
          unlockedRef.current = loaded;
        }, t('modal.unlock.biometricReason'));
        if (!result.ok) {
          throw new Error(result.errorMessage || t('modal.toast.unlockFailed'));
        }
        const unlocked = unlockedRef.current;
        if (!unlocked) {
          throw new Error(t('modal.throws.unlockWrong'));
        }
        setWalletNameDraft(unlocked.nickname?.trim() || '');
        const sessionSecret = await createDojakwebSessionSecretStore().getSecret();
        if (!sessionSecret) {
          throw new Error(t('modal.toast.unlockFailed'));
        }
        setActivePassword(sessionSecret);
        setUnlockPassword('');
        setShowTemporaryBanner(false);
        localStorage.removeItem(BROWSER_WALLET_RESTORE_BLOCK_KEY);
        try {
          setActiveWallet('browser');
        } catch {
          try {
            localStorage.setItem('wallet_type', 'browser');
          } catch {
            // Ignore localStorage failures.
          }
        }
        setStep('dashboard');
        toast.success(t('modal.toast.walletUnlocked'));
        return;
      }

      const secret = unlockPassword.trim();
      if (unlockMode === 'pin') {
        if (!secret) {
          throw new Error(t('modal.errors.enterPin'));
        }
        if (!/^\d{6,}$/.test(secret)) {
          throw new Error(t('modal.errors.pinInvalid'));
        }
      } else if (!secret) {
        throw new Error(t('modal.errors.enterPassword'));
      }
      const loaded = await browser.loadWallet(secret, selectedLocalWalletAddress ?? undefined);
      if (!loaded) {
        throw new Error(t('modal.throws.unlockWrong'));
      }
      await browser.connect(loaded);
      setWalletNameDraft(loaded.nickname?.trim() || '');
      setActivePassword(secret);
      setUnlockPassword('');
      try {
        await createDojakwebSessionSecretStore().saveSecret(secret);
      } catch {
        // Session store is best-effort; in-memory password still enables HD account switching.
      }
      const uiFlags = syncSeedGroupUiFlags(localSeedWalletGroups, loaded.address);
      setNeedsBackup(uiFlags.needsBackup);
      setShowTemporaryBanner(uiFlags.showTemporaryBanner);
      localStorage.removeItem(BROWSER_WALLET_RESTORE_BLOCK_KEY);
      try {
        setActiveWallet('browser');
      } catch {
        try {
          localStorage.setItem('wallet_type', 'browser');
        } catch {
          // Ignore localStorage failures.
        }
      }
      setStep('dashboard');
      toast.success(t('modal.toast.walletUnlocked'));
    } catch (nextError) {
      const msg = nextError instanceof Error ? nextError.message : '';
      // atob / base64 decode failure = wrong password
      const isWrongPassword = msg.includes('atob') || msg.includes('not correctly encoded') || msg.includes('decrypt') || msg.includes('decryption');
      toast.error(isWrongPassword ? t('modal.toast.wrongPassword') : (msg || t('modal.toast.unlockFailed')));
      setUnlockPassword('');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSetPassword = async () => {
    if (!password.trim()) {
      setError(
        newPrimarySecret === 'pin' ? t('modal.errors.pinInvalid') : t('modal.errors.enterPassword'),
      );
      return;
    }
    if (newPrimarySecret === 'pin') {
      // PIN is entered once on a single numpad — no confirm pad.
      if (!/^\d{6,}$/.test(password.trim())) {
        setError(t('modal.errors.pinInvalid'));
        return;
      }
    } else if (password !== confirmPassword) {
      setError(t('modal.errors.passwordsNoMatch'));
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const iterations = pbkdf2IterationsForSecretStrength(newSecretStrength);
      const saved = await finalizeWallet(password, undefined, undefined, { pbkdf2Iterations: iterations });
      const addr = saved?.address;
      if (password.trim() && addr) {
        writeWalletLockPreferences(addr, {
          primary: newPrimarySecret,
          strength: newSecretStrength,
          biometricQuickUnlock: enableWebAuthnQuickUnlock,
        });
      }
      if (enableWebAuthnQuickUnlock && password.trim()) {
        try {
          const webAuthn = new WebAuthnAdapter({
            credentialStorageKey: 'dojakweb.biometric.webauthn.credential-id',
            allowUsbSecurityKeys: true,
          });
          const registered = await webAuthn.registerIfNeeded('Dojak web wallet');
          if (registered) {
            await createDojakwebSessionSecretStore().saveSecret(password.trim());
            toast.success(t('modal.toast.biometricEnabled'));
          } else {
            toast.message(t('modal.toast.biometricSkipped'));
          }
        } catch (bioErr) {
          console.warn(bioErr);
          toast.message(t('modal.toast.biometricSkipped'));
        }
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.savePassword'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSkipPassword = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await finalizeWallet();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.continue'));
    } finally {
      setIsBusy(false);
    }
  };

  const resolveBrowserSessionPassword = useCallback(async (): Promise<string | undefined> => {
    if (activePassword) return activePassword;
    try {
      const session = await createDojakwebSessionSecretStore().getSecret();
      if (session) {
        setActivePassword(session);
        return session;
      }
    } catch {
      // Ignore session read failures.
    }
    return undefined;
  }, [activePassword]);

  /**
   * Listing / send / cancel must not call `loadWallet(undefined)` on an encrypted vault.
   * UI can look "unlocked" via in-memory `browser.wallet` or tab session secret while
   * React `activePassword` is still undefined (e.g. after refresh / vendor remount).
   */
  const loadUnlockedBrowserWallet = useCallback(async () => {
    const mem = browser.wallet;
    if (mem?.privateKey) return mem;
    const pw = await resolveBrowserSessionPassword();
    const loaded = await browser.loadWallet(pw, activeAddress ?? undefined);
    if (!loaded?.privateKey) {
      throw new Error(t('modal.throws.walletLocked'));
    }
    return loaded;
  }, [activeAddress, browser, resolveBrowserSessionPassword, t]);

  const connectSavedLocalWallet = async (targetAddress: string, sessionPassword?: string) => {
    const storage = new BrowserWallet();
    await storage.selectWallet(targetAddress);
    setSelectedLocalWalletAddress(targetAddress);
    const encrypted = await storage.isEncrypted(targetAddress);
    setIsEncryptedWallet(encrypted);

    if (encrypted) {
      if (!sessionPassword) {
        setStep('unlock');
        return false;
      }
      const loaded = await browser.loadWallet(sessionPassword, targetAddress);
      if (!loaded) {
        setStep('unlock');
        return false;
      }
      await browser.connect(loaded);
      setWalletNameDraft(loaded.nickname?.trim() || '');
    } else {
      const loaded = await browser.loadWallet(undefined, targetAddress);
      if (!loaded) {
        throw new Error(t('modal.throws.loadSelectedWallet'));
      }
      await browser.connect(loaded);
      setWalletNameDraft(loaded.nickname?.trim() || '');
    }

    const uiFlags = syncSeedGroupUiFlags(localSeedWalletGroups, targetAddress);
    setNeedsBackup(uiFlags.needsBackup);
    setShowTemporaryBanner(uiFlags.showTemporaryBanner);
    try {
      setActiveWallet('browser');
    } catch {
      try {
        localStorage.setItem('wallet_type', 'browser');
      } catch {
        // Ignore localStorage failures.
      }
    }
    setStep('dashboard');
    await browser.refreshBalance({ silent: true });
    return true;
  };

  const handleConnectSavedLocalWallet = async (targetAddress: string) => {
    const currentAddr = browser.wallet?.address ?? activeAddress;
    if (targetAddress === currentAddr && walletType === 'browser') {
      setStep('dashboard');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      localStorage.removeItem(BROWSER_WALLET_RESTORE_BLOCK_KEY);
      const sessionPassword = await resolveBrowserSessionPassword();
      await connectSavedLocalWallet(targetAddress, sessionPassword);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.connectWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 'unlock' || !selectedLocalWalletAddress) return;
    const prefs = readWalletLockPreferences(selectedLocalWalletAddress);
    setUnlockMode(prefs?.primary === 'pin' ? 'pin' : 'password');
  }, [step, selectedLocalWalletAddress]);

  const handleAddBrowserAccount = async () => {
    const sessionPassword = await resolveBrowserSessionPassword();
    if (!isBrowserWallet || !sessionPassword) {
      toast.error(t('modal.toast.reunlockForAccountSwitch'));
      return;
    }
    const groups = localSeedWalletGroups;
    const gi = findSeedGroupIndexForAddress(groups, browser.wallet?.address ?? activeAddress);
    const group = groups[gi];
    if (!group) return;
    const maxIdx = group.accounts.reduce((m, a) => Math.max(m, a.accountIndex ?? 0), 0);
    const nextIdx = maxIdx + 1;
    setIsBusy(true);
    setError(null);
    try {
      const switched = await browser.switchAccount(nextIdx, sessionPassword);
      await browser.connect(switched);
      setWalletNameDraft(switched.nickname?.trim() || '');
      const uiFlags = syncSeedGroupUiFlags(localSeedWalletGroups, switched.address);
      setNeedsBackup(uiFlags.needsBackup);
      setShowTemporaryBanner(uiFlags.showTemporaryBanner);
      await refreshSavedLocalWallets();
      await browser.refreshBalance({ silent: true });
      setStep('dashboard');
      toast.success(t('modal.toast.accountAdded', { index: String(nextIdx) }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.connectWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleLedgerAccountDelta = async (delta: -1 | 1) => {
    if (walletType !== 'ledger') return;
    const current = unifiedAccountIndex ?? 0;
    const nextIdx = current + delta;
    if (nextIdx < 0) return;
    setIsBusy(true);
    setError(null);
    try {
      await switchAccount(nextIdx);
      await refreshBalance();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.connectWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 'switch_wallet') return;
    void refreshSavedLocalWallets();
  }, [step, refreshSavedLocalWallets]);

  const handleDisconnectWallet = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await createDojakwebSessionSecretStore().clearSecret();
      await disconnect();
      localStorage.setItem(BROWSER_WALLET_RESTORE_BLOCK_KEY, 'true');
      setPendingWallet(null);
      setPendingSeed(null);
      setShowTemporaryBanner(false);
      setNeedsBackup(false);
      setIsEncryptedWallet(false);
      setStep('chooser');
      await refreshSavedLocalWallets();
      toast.success(t('modal.toast.walletDisconnected'));
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.disconnectWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  /**
   * Local browser-wallet "lock" UX:
   * - If the wallet has no password yet, send the user to the password setup step.
   * - If already password-protected: end the tab unlock session (clear session secret)
   *   and disconnect so the next action requires unlock again.
   * Normal use: unlock once per browser tab; lock is explicit.
   */
  const handleLockWallet = async () => {
    if (!activeAddress || !isBrowserWallet) return;
    setError(null);

    // If we don't have a password yet, require setup before locking.
    const encrypted = await new BrowserWallet().isEncrypted(activeAddress);
    if (!encrypted) {
      lockAfterSetPasswordRef.current = true;
      setPassword('');
      setConfirmPassword('');
      setStep('password');
      return;
    }

    setIsBusy(true);
    try {
      setHideBalance(false);
      setUnlockPassword('');
      setActivePassword(undefined);
      try {
        await createDojakwebSessionSecretStore().clearSecret();
      } catch {
        /* ignore */
      }
      await browser.disconnect();
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.lockWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveWalletName = async () => {
    if (!activeAddress || !isBrowserWallet) return;
    setIsSavingWalletName(true);
    setError(null);
    try {
      await browser.updateNickname(activeAddress, walletNameDraft.trim() || undefined);
      await refreshSavedLocalWallets();
      toast.success(t('modal.toast.walletNameUpdated'));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.saveWalletName'));
    } finally {
      setIsSavingWalletName(false);
    }
  };

  const handleCopyMnemonic = async () => {
    if (!pendingSeed?.mnemonic) {
      setError(t('modal.errors.mnemonicUnavailable'));
      return;
    }

    try {
      const copied = await copyTextWithFallback(pendingSeed.mnemonic);
      if (!copied) {
        throw new Error('clipboard_unavailable');
      }
      toast.success(t('modal.toast.mnemonicCopied'));
    } catch {
      setError(t('modal.errors.clipboardUnavailable'));
    }
  };

  const handleCopyAddress = async () => {
    if (!activeAddress) return;

    try {
      const copied = await copyTextWithFallback(activeAddress);
      if (!copied) {
        throw new Error('clipboard_unavailable');
      }
      toast.success(t('modal.toast.addressCopied'));
    } catch {
      setError(t('modal.errors.clipboardUnavailable'));
      toast.error(t('modal.toast.copyAddressFailed'));
    }
  };

  const handleBackupNow = async (pw?: string) => {
    if (!activeAddress) return;
    const passwordToUse = pw ?? activePassword;
    try {
      const seed = await browser.loadSeedMaterial(passwordToUse, activeAddress);
      if (!seed?.mnemonic) {
        throw new Error(t('modal.errors.mnemonicUnavailable'));
      }
      setPendingSeed(seed);
      setRevealPassword('');
      setError(null);
      setShowSecretPhrase(false);
      setStep('reveal');
    } catch {
      setPendingSeed(null);
      setError(null);
      setRevealPassword('');
      setStep('reveal');
    }
  };

  const handleRevealWithPassword = async () => {
    if (!revealPassword.trim()) return;
    setActivePassword(revealPassword);
    await handleBackupNow(revealPassword);
  };

  const handleSavedSecretPhrase = () => {
    if (activeAddress) {
      const groupIndex = findSeedGroupIndexForAddress(localSeedWalletGroups, activeAddress);
      const group = localSeedWalletGroups[groupIndex];
      if (group) {
        markSeedGroupBackedUp(group);
      } else {
        const key = getBackupFlag(activeAddress);
        if (key) localStorage.setItem(key, 'true');
      }
    }
    setNeedsBackup(false);
    toast.success(t('modal.toast.backupConfirmed'), { duration: 5000 });
    // Wallet is already live after turnkey create — never force password as a blocker.
    if (connected || browser.connected) {
      setStep('dashboard');
      return;
    }
    setStep('password');
  };

  const handleDismissBackupReveal = () => {
    if (connected || browser.connected) {
      setStep('dashboard');
      return;
    }
    setStep('chooser');
  };

  const handleRemoveWallet = async () => {
    setIsBusy(true);
    try {
      await browser.removeWallet();
      localStorage.removeItem(BROWSER_WALLET_RESTORE_BLOCK_KEY);
      setPendingWallet(null);
      setPendingSeed(null);
      // Only tear down the unified active session when it was the local wallet;
      // leave extension/hardware sessions intact.
      if (walletType === 'browser') {
        await disconnect();
      } else if (browser.connected) {
        await browser.disconnect();
      }
      setStep('chooser');
      await refreshSavedLocalWallets();
      toast.success(t('modal.toast.walletRemoved'));
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.removeWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  const fetchAssets = useCallback(async (address: string) => {
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      // allSettled so a MyDoge/DRC-20 failure cannot wipe a successful Ðunes (dogex) load
      const settled = await Promise.allSettled([
        walletDataApi.fetchInscriptions(address),
        walletDataApi.fetchDRC20Tokens(address),
        walletDataApi.fetchTreatsBalances(address),
        walletDataApi.fetchDunes(address),
      ]);
      const [nftsR, tokensR, treatsR, dunesR] = settled;
      setInscriptions(nftsR.status === 'fulfilled' ? nftsR.value : []);
      setDrc20Tokens(tokensR.status === 'fulfilled' ? tokensR.value : []);
      setTreatsTokens(treatsR.status === 'fulfilled' ? treatsR.value : []);
      setDunesHoldings(
        dunesR.status === 'fulfilled' && Array.isArray(dunesR.value) ? dunesR.value : [],
      );
      if (dunesR.status === 'rejected') {
        console.warn('[dojak:dunes] fetchAssets dunes rejected', dunesR.reason);
      }

      // Charms: UTXO scan (best-effort)
      try {
        const { charmsService } = await import('../services/charmsService');
        const utxoResponse = await walletDataApi.fetchUtxos(address);
        const raw = utxoResponse as { utxos?: Array<{ txid?: string; vout?: number }> };
        const utxos = Array.isArray(raw?.utxos) ? raw.utxos : [];
        const charmResults = await Promise.allSettled(
          utxos
            .filter((u) => typeof u.txid === 'string' && Number.isFinite(Number(u.vout)))
            .slice(0, 80)
            .map((u) => charmsService.getCharmsByUtxo(String(u.txid), Number(u.vout))),
        );
        const nextCharms: Array<{ id: string; ticker: string; balance: string }> = [];
        for (const r of charmResults) {
          if (r.status !== 'fulfilled') continue;
          for (const charm of r.value) {
            if (charm.spent_by_txid) continue;
            const bal = String(
              charm.charm_data?.balance ?? charm.charm_data?.amount ?? charm.charm_data?.value ?? '1',
            );
            nextCharms.push({
              id: `${charm.txid}:${charm.vout}:${charm.app_id}`,
              ticker: charm.app_id,
              balance: bal,
            });
          }
        }
        setCharmsAssets(nextCharms);
      } catch {
        setCharmsAssets([]);
      }

      // Ðalkanes: indexed contracts (global list; wallet deploys appear after index)
      try {
        const { fetchAlkanesList } = await import('../lib/alkanes');
        const base = getIndexerApiBase().replace(/\/+$/, '');
        const list = await fetchAlkanesList(base, 40);
        setAlkanesAssets(
          list.map((m) => ({ id: m.id, code_hash: m.code_hash, code_len: m.code_len })),
        );
      } catch {
        setAlkanesAssets([]);
      }
    } catch (err) {
      setAssetsError(t('modal.errors.assetsLoad'));
    } finally {
      setAssetsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (step === 'dashboard' && tab === 'assets' && activeAddress) {
      void fetchAssets(activeAddress);
    }
  }, [step, tab, activeAddress, fetchAssets]);

  useEffect(() => {
    if (step === 'verification' && activeAddress) {
      void fetchAssets(activeAddress);
    }
  }, [step, activeAddress, fetchAssets]);

  // Prefill revoke id from dogex when opening verification (if already linked).
  useEffect(() => {
    if (step !== 'verification' || !activeAddress) return;
    let cancelled = false;
    void (async () => {
      try {
        const base = getIndexerApiBase().replace(/\/+$/, '');
        const res = await fetch(`${base}/api/dx/address/${encodeURIComponent(activeAddress)}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as {
          linked?: boolean;
          registration?: { inscriptionId?: string; xHandle?: string };
        };
        if (j.linked && j.registration?.inscriptionId) {
          setDxRevokePrevId(j.registration.inscriptionId);
          if (j.registration.xHandle && !dxHandleInput.trim()) {
            setDxHandleInput(j.registration.xHandle);
          }
        }
      } catch {
        /* indexer offline */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when opening verification for address
  }, [step, activeAddress]);

  const openSettings = () => {
    const dp = getWalletDataProviderConfig();
    setSettingsProvider(dp.walletDataProvider);
    // Leave custom URL blank when using the built-in provider default (MyDoge etc.).
    setSettingsCustomUrl(
      isDefaultWalletDataProviderUrl(dp.walletDataProvider, dp.walletDataProviderUrl)
        ? ''
        : (dp.walletDataProviderUrl || ''),
    );
    setSettingsIndexerApiBase(dp.indexerApiBase || '');
    setSettingsDogexCdnBase(dp.dogexCdnBase || '');
    setSettingsMergeInuBits(dp.mergeInuBitsInscriptions !== false);
    setSettingsHideTextJson(dp.hideTextJsonInscriptions === true);
    const oneClick = readOneClickLocalSigningPolicy();
    setSettingsOneClickLocalSigning(oneClick.enabled);
    setSettingsOneClickLocalSigningMaxDoge(String(oneClick.maxDoge));
    setSettingsBroadcast(migrateBroadcastToAuto(loadBroadcastConfig()));
    setSettingsChainExplorer(loadDogeTxExplorerPreference());
    setSettingsPriceSources(getDogePriceSourceConfig().sources);
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(BROADCAST_DISABLED_KEY) : null;
      setDisabledBroadcastProviders(raw ? JSON.parse(raw) : []);
    } catch { setDisabledBroadcastProviders([]); }
    setSettingsSaved(false);
    setRpcTestStatus('idle');
    setRpcTestBlocks(null);
    setRpcTestError(null);
    setRpcTestSubline(null);
    setRpcTestIbd(false);
    setRelayHealthByProvider({});
    setRelayTestAllBusy(false);
    setIndexerHealth({ status: 'idle' });
    setSettingsTab('data');
    setStep('settings');
  };

  const broadcastHealthCfg = useCallback(
    () => ({
      rpcUrl: settingsBroadcast.rpcUrl,
      rpcUser: settingsBroadcast.rpcUser,
      rpcPass: settingsBroadcast.rpcPass,
      tatumApiKey: settingsBroadcast.tatumApiKey,
    }),
    [
      settingsBroadcast.rpcUrl,
      settingsBroadcast.rpcUser,
      settingsBroadcast.rpcPass,
      settingsBroadcast.tatumApiKey,
    ],
  );

  const handleTestOneRelay = useCallback(
    async (provider: BroadcastRelayProvider) => {
      setRelayHealthByProvider((prev) => ({
        ...prev,
        [provider]: { status: 'loading' },
      }));
      const r = await testBroadcastRelayHealth(provider, broadcastHealthCfg());
      setRelayHealthByProvider((prev) => ({
        ...prev,
        [provider]: {
          status: r.ok ? 'ok' : 'err',
          message: r.message,
          latencyMs: r.latencyMs,
        },
      }));
    },
    [broadcastHealthCfg],
  );

  const handleTestAllRelays = useCallback(async () => {
    setRelayTestAllBusy(true);
    setRelayHealthByProvider({});
    try {
      const results = await testAllBroadcastRelayHealths(broadcastHealthCfg());
      const next: Partial<Record<BroadcastRelayProvider, RelayHealthRow>> = {};
      for (const p of Object.keys(results) as BroadcastRelayProvider[]) {
        const r = results[p]!;
        next[p] = {
          status: r.ok ? 'ok' : 'err',
          message: r.message,
          latencyMs: r.latencyMs,
        };
      }
      setRelayHealthByProvider(next);
      const failed = (Object.keys(next) as BroadcastRelayProvider[]).filter((k) => next[k]?.status === 'err');
      if (failed.length === 0) {
        toast.success(t('modal.settings.relayTestAllOk'));
      } else {
        toast.warning(t('modal.settings.relayTestAllWarn', { count: String(failed.length) }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('modal.settings.relayTestAllErr'));
    } finally {
      setRelayTestAllBusy(false);
    }
  }, [broadcastHealthCfg, t]);

  const handleTestRpcConnection = useCallback(async () => {
    setRpcTestStatus('loading');
    setRpcTestBlocks(null);
    setRpcTestError(null);
    setRpcTestSubline(null);
    setRpcTestIbd(false);
    const url = settingsBroadcast.rpcUrl?.trim();
    const user = settingsBroadcast.rpcUser?.trim();
    const pass = settingsBroadcast.rpcPass;
    if (!url || !user || pass === undefined || pass === '') {
      setRpcTestStatus('err');
      setRpcTestError(t('modal.errors.rpcNeedFields'));
      return;
    }
    if (!dogeRpcProxyDisplayUrl) {
      setRpcTestStatus('err');
      setRpcTestError(t('modal.errors.rpcProxyMissing'));
      return;
    }
    const res = await fetchRpcDetailedHealth({ rpcUrl: url, rpcUser: user, rpcPass: pass });
    if (res.ok) {
      setRpcTestStatus('ok');
      setRpcTestBlocks(res.blocks);
      const parts: string[] = [];
      if (res.chain) parts.push(t('modal.settings.rpcPartChain', { chain: res.chain }));
      if (res.headers != null && res.headers > res.blocks) {
        parts.push(
          t('modal.settings.rpcPartCatchup', {
            tip: res.blocks.toLocaleString(),
            headers: res.headers.toLocaleString(),
          }),
        );
      }
      if (res.verificationProgressPercent != null) {
        parts.push(t('modal.settings.rpcPartVerified', { pct: res.verificationProgressPercent.toFixed(2) }));
      }
      setRpcTestSubline(parts.length ? parts.join(t('modal.settings.rpcSublineSep')) : null);
      setRpcTestIbd(res.initialBlockDownload === true);
    } else {
      setRpcTestStatus('err');
      setRpcTestError(res.error);
    }
  }, [dogeRpcProxyDisplayUrl, settingsBroadcast.rpcUrl, settingsBroadcast.rpcUser, settingsBroadcast.rpcPass, t]);

  const resolveSettingsIndexerBase = useCallback((): string => {
    const custom = settingsIndexerApiBase.trim();
    if (custom) {
      if (/^https?:\/\//i.test(custom)) return custom.replace(/\/+$/, '');
      if (typeof window !== 'undefined') {
        return new URL(custom.startsWith('/') ? custom : `/${custom}`, window.location.origin).href.replace(/\/+$/, '');
      }
      return custom.replace(/\/+$/, '');
    }
    return getIndexerApiBase();
  }, [settingsIndexerApiBase]);

  const handleTestIndexerHealth = useCallback(async () => {
    setIndexerHealth({ status: 'loading' });
    const base = resolveSettingsIndexerBase();
    const r = await fetchDogexIndexerHealth(base);
    if (!r.ok) {
      setIndexerHealth({
        status: 'err',
        latencyMs: r.latencyMs,
        message: r.error || t('modal.settings.indexerHealthErr'),
      });
      return;
    }
    const tip = r.tipHeight != null ? t('modal.settings.indexerHealthTip', { height: String(r.tipHeight) }) : '';
    const fp = r.fingerprintPreview ? ` · ${r.fingerprintPreview}…` : '';
    setIndexerHealth({
      status: r.healthy ? 'ok' : 'warn',
      latencyMs: r.latencyMs,
      tipHeight: r.tipHeight,
      message: `${r.healthy ? t('modal.settings.indexerHealthOk') : t('modal.settings.indexerHealthDegraded')}${tip}${fp}`,
    });
  }, [resolveSettingsIndexerBase, t]);

  const pinRpcFirstInBroadcastOrder = useCallback(() => {
    setSettingsBroadcast(prev => {
      const rest = normalizeBroadcastPriority(prev.broadcastPriority).filter((x) => x !== 'rpc');
      return { ...prev, broadcastPriority: ['rpc', ...rest] };
    });
    toast.success(t('modal.toast.rpcPinnedFirst'));
  }, [t]);

  /** Clears RPC URL/user/pass in state and writes broadcast config to localStorage immediately (no need to press Save). */
  const handleClearRpcCredentials = useCallback(() => {
    setSettingsBroadcast(prev => {
      const next = migrateBroadcastToAuto({
        ...prev,
        rpcUrl: 'http://127.0.0.1:22555',
        rpcUser: '',
        rpcPass: '',
        broadcastPriority: normalizeBroadcastPriority(prev.broadcastPriority),
      });
      saveBroadcastConfig(next);
      return next;
    });
    setRpcTestStatus('idle');
    setRpcTestBlocks(null);
    setRpcTestError(null);
    setRpcTestSubline(null);
    setRpcTestIbd(false);
    toast.success(t('modal.toast.rpcCleared'));
  }, [toast, t]);

  const handleSaveSettings = () => {
    // Empty custom URL → store no override (use MyDoge / provider built-in).
    const customUrl = settingsCustomUrl.trim();
    setWalletDataProviderConfig({
      walletDataProvider: settingsProvider,
      walletDataProviderUrl: customUrl || undefined,
      indexerApiBase: settingsIndexerApiBase.trim() || undefined,
      dogexCdnBase: settingsDogexCdnBase.trim() || undefined,
      mergeInuBitsInscriptions: settingsMergeInuBits,
      hideTextJsonInscriptions: settingsHideTextJson,
    });
    setHideTextJsonInscriptions(settingsHideTextJson);
    saveBroadcastConfig(
      migrateBroadcastToAuto({
        ...settingsBroadcast,
        broadcastPriority: normalizeBroadcastPriority(settingsBroadcast.broadcastPriority),
      })
    );
    saveDogeTxExplorerPreference(settingsChainExplorer);
    setDogePriceSourceConfig({ sources: settingsPriceSources });
    writeOneClickLocalSigningPolicy({
      enabled: settingsOneClickLocalSigning,
      maxDoge: Number(settingsOneClickLocalSigningMaxDoge) || 0.05,
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(BROADCAST_DISABLED_KEY, JSON.stringify(disabledBroadcastProviders));
    }
    setSettingsSaved(true);
    toast.success(t('modal.toast.settingsSaved'));
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const movePriceSource = useCallback((sourceId: DogePriceSourceId, targetId: DogePriceSourceId) => {
    setSettingsPriceSources((current) => {
      const fromIndex = current.indexOf(sourceId);
      const toIndex = current.indexOf(targetId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return current;
      }

      const next = [...current];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, sourceId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Prefer staying on dashboard when local browser session already holds the key.
      const unlocked = Boolean(browser.wallet?.privateKey && browser.address);
      const targetStep = initialStep === 'verification' ? 'verification' : unlocked ? 'dashboard' : initialStep;
      setStep(targetStep);
      setSettingsTab(initialSettingsTab);
      if (initialDashboardTab) setTab(initialDashboardTab);
      if (initialAssetType) setAssetType(initialAssetType);
      if (initialNftFilter) setNftFilter(initialNftFilter);
      if (initialNftFilter === 'dlotto') {
        setHideTextJsonInscriptions(false);
        setAssetType('nft');
        setTab('assets');
      }
      // Don't leave the UI on a scary unverified 0 — fetch when the drawer opens.
      if (connected) {
        void refreshBalance();
      }
    }
  }, [
    isOpen,
    initialStep,
    initialSettingsTab,
    openNonce,
    browser.wallet?.privateKey,
    browser.address,
    initialDashboardTab,
    initialAssetType,
    initialNftFilter,
    connected,
    refreshBalance,
  ]);

  const handleDogecoinConfDrop = async (file: File) => {
    const text = await file.text();
    const parsed = parseDogecoinConf(text);
    setSettingsBroadcast((prev) => {
      const merged = { ...prev, ...parsed };
      const rest = normalizeBroadcastPriority(merged.broadcastPriority).filter((x) => x !== 'rpc');
      return migrateBroadcastToAuto({
        ...merged,
        broadcastPriority: ['rpc', ...rest],
      });
    });
    setRpcTestStatus('idle');
    setRpcTestBlocks(null);
    setRpcTestError(null);
    setRpcTestSubline(null);
    setRpcTestIbd(false);
    toast.success(t('modal.toast.dogecoinConfImported'));
  };

  // ── Load active listings when dashboard tab switches to 'listings' ──
  useEffect(() => {
    if (step === 'dashboard' && tab === 'listings' && activeAddress) {
      setActiveListings(getActiveListings(activeAddress));
      // Poll for sold status in background (non-blocking)
      pollListingStatuses(activeAddress).catch(() => {});
    }
  }, [step, tab, activeAddress]);

  // ── Load transactions when tab switches to 'transactions' ──
  const fetchTransactions = useCallback(async (address: string, page: number, append = false) => {
    setTxLoading(true);
    if (!append) setTxError(null);
    try {
      const result = await walletDataApi.fetchTransactions(address, page);
      setTransactions(prev => append ? [...prev, ...result.transactions] : result.transactions);
      setTxTotal(result.total);
    } catch {
      setTxError(t('modal.tx.error'));
    } finally {
      setTxLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (step === 'dashboard' && tab === 'transactions' && activeAddress) {
      setTxPage(1);
      setTransactions([]);
      void fetchTransactions(activeAddress, 1);
    }
  }, [step, tab, activeAddress, fetchTransactions]);

  // Label ÐGames / ÐLotto / Ðalkanes (and friends) via dogex indexes.
  useEffect(() => {
    if (step !== 'dashboard' || tab !== 'transactions' || !activeAddress) return;
    const visible = [
      ...localRecentTransactions.map((t) => t.txid),
      ...transactions.map((t) => t.txid),
    ].filter(Boolean);
    let cancelled = false;
    void enrichWalletTransactionsForAddress(activeAddress, visible)
      .then(() => {
        if (!cancelled) setWalletTxJournal(loadWalletTxJournal());
      })
      .catch((err) => {
        console.warn('[dojakweb:tx] protocol enrichment failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [step, tab, activeAddress, transactions, localRecentTransactions]);


  useEffect(() => {
    if (step !== 'dashboard' || !activeAddress || !connected) {
      return;
    }
    let cancelled = false;
    setSpendableBreakBusy(true);
    void getSpendableBalanceBreakdown(activeAddress, balance)
      .then((b) => {
        if (!cancelled) setSpendableBreak(b);
      })
      .catch(() => {
        if (!cancelled) setSpendableBreak(null);
      })
      .finally(() => {
        if (!cancelled) setSpendableBreakBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, activeAddress, connected, balance, balanceVerified]);

  const openSendInscription = (inscription: MyDogeInscription) => {

    setSelectedInscription(inscription);
    setInscriptionSendRecipient('');
    setInscriptionSendTxid(null);
    setInscriptionSendError(null);
    setInscriptionSendDraft(null);
    setStep('send_inscription');
  };

  const openListInscription = (inscription: MyDogeInscription) => {
    setSelectedInscription(inscription);
    setListingPriceDoge('');
    setListingReviewing(false);
    setListingSignedPsbt(null);
    setListingShareUrl(null);
    setListingNostrPublished(false);
    setListingPublishRelayResults([]);
    setShowListingPublishDetails(false);
    setListingError(null);
    setStep('list_inscription');
  };

  const handleReviewSendInscription = async () => {
    if (!selectedInscription || !activeAddress || !inscriptionSendRecipient.trim()) return;
    setInscriptionSendReviewBusy(true);
    setInscriptionSendError(null);
    setInscriptionSendDraft(null);
    try {
      const insData = await getInscriptionData(selectedInscription.inscriptionId, selectedInscription);
      const payerUtxos = await getAddressUtxos(activeAddress);
      const paymentUtxos = payerUtxos
        .filter((u) => u.value > DUMMY_UTXO_VALUE)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      if (paymentUtxos.length === 0) throw new Error(t('modal.throws.noPaymentUtxos'));

      const draft = await buildSendInscriptionDraft({
        inscriptionOutput: insData.output,
        inscriptionOutputValue: insData.outputValue,
        recipientAddress: inscriptionSendRecipient.trim(),
        senderAddress: activeAddress,
        paymentUtxos,
      });
      setInscriptionSendDraft(draft);
    } catch (e: any) {
      setInscriptionSendError(e?.message ?? String(e));
    } finally {
      setInscriptionSendReviewBusy(false);
    }
  };

  const handleConfirmSendInscription = async () => {
    if (!inscriptionSendDraft || !selectedInscription) return;
    setInscriptionSendBusy(true);
    setInscriptionSendError(null);
    try {
      const w = await loadUnlockedBrowserWallet();

      const txHex = await signAndFinalizeSimplePSDT(inscriptionSendDraft.psbtBase64, w.privateKey);
      const txid = await broadcastOrdinalTx(txHex);
      setInscriptionSendTxid(txid);
      setInscriptionSendDraft(null);
      toast.success(t('modal.toast.inscriptionSent', { txShort: txid.slice(0, 12) }));
    } catch (e: any) {
      setInscriptionSendError(e?.message ?? String(e));
    } finally {
      setInscriptionSendBusy(false);
    }
  };

  // Build and sign a listing PSBT for the selected inscription
  const handleCreateListing = async (publishToNostr: boolean) => {
    if (!selectedInscription || !activeAddress) return;
    const priceKoinu = dogeToShibes(parseFloat(listingPriceDoge));
    if (!priceKoinu || priceKoinu <= 0) {
      setListingError(t('modal.errors.listingPrice'));
      return;
    }
    setListingBusy(true);
    setListingError(null);
    try {
      console.log('[Listing] handleCreateListing:start', {
        publishToNostr,
        walletType,
        activeAddress,
        inscriptionId: selectedInscription.inscriptionId,
        listingPriceDoge,
        priceKoinu,
      });
      const insData = await getInscriptionData(selectedInscription.inscriptionId, selectedInscription);
      console.log('[Listing] inscription data loaded', {
        id: insData.id,
        number: insData.number,
        output: insData.output,
        contentType: insData.contentType,
      });

      // Build unsigned listing PSBT
      const unsignedPsbt = await buildListingPSDT(insData.output, priceKoinu, activeAddress);
      console.log('[Listing] unsigned PSBT built', {
        length: unsignedPsbt.length,
        prefix: unsignedPsbt.slice(0, 24),
      });

      // Sign with SIGHASH_SINGLE | ANYONECANPAY — path depends on wallet type
      let signedPsbt: string;
      if (walletType === 'browser') {
        console.log('[Listing] signing with browser wallet');
        const w = await loadUnlockedBrowserWallet();
        signedPsbt = await signListingPSDT(unsignedPsbt, w.privateKey);
        console.log('[Listing] browser signed PSBT', {
          length: signedPsbt.length,
          prefix: signedPsbt.slice(0, 24),
        });
      } else if (walletType === 'mydoge' || walletType === 'dojak') {
        console.log('[Listing] signing with extension wallet', { walletType });
        // Extension wallets sign via their own API.
        // The PSBT already has sighashType=SIGHASH_SINGLE|ANYONECANPAY embedded,
        // so the extension should respect it.
        const signedPsbtBase64 = await signPSBTOnly(unsignedPsbt);
        console.log('[Listing] extension returned signed payload', {
          length: signedPsbtBase64.length,
          prefix: signedPsbtBase64.slice(0, 32),
        });
        signedPsbt = signedPsbtBase64;
        console.log('[Listing] normalized signed PSBT', {
          length: signedPsbt.length,
          prefix: signedPsbt.slice(0, 24),
        });
      } else {
        throw new Error(t('modal.throws.listingNotSupported'));
      }
      setListingReviewing(false);
      setListingSignedPsbt(signedPsbt);

      // Build dogepsdt URI (self-contained, for QR) and share URL (for copy/link)
      const dogePsdtUri = encodeBase64PsdtToDogePsdtUri(signedPsbt);
      setListingDogePsbtUri(dogePsdtUri);
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://dogenals.org';
      const shareUrl = buildShareUrl(baseUrl, insData.id, signedPsbt);
      setListingShareUrl(shareUrl);
      console.log('[Listing] share artifacts created', {
        dogePsdtUriLength: dogePsdtUri.length,
        dogePsdtUriPrefix: dogePsdtUri.slice(0, 32),
        shareUrl,
      });

      // Save to local store
      const listing: ActiveListing = {
        inscriptionId:           insData.id,
        inscriptionNumber:       insData.number,
        inscriptionUtxo:         insData.output,
        inscriptionContentType:  insData.contentType,
        inscriptionPreview:      selectedInscription.preview ?? selectedInscription.content ?? '',
        sellerAddress:           activeAddress,
        priceKoinu,
        signedPsbtBase64:        signedPsbt,
        protocol:                publishToNostr ? 'nostr' : 'qr_only',
        listedAt:                new Date().toISOString(),
        shareableQR:             true,
        shareUrl,
        status:                  'active',
      };
      console.log('[Listing] saving active listing', listing);
      saveListing(listing);

      if (publishToNostr) {
        console.log('[Listing] publishing to nostr');
        const publishResult = await publishListingToNostrWithDiagnostics(
          signedPsbt,
          insData.id,
          insData.number,
          insData.output,
          priceKoinu,
        );
        const nostrEventId = publishResult.eventId;
        const nostrPrivateKey = publishResult.privateKey;
        setListingPublishRelayResults(publishResult.relayResults);
        setShowListingPublishDetails(true);
        setListingNostrEventId(insData.id, nostrEventId, nostrPrivateKey);
        setListingNostrPublished(true);
        const okCount = publishResult.relayResults.filter(r => r.ok).length;
        console.log('[Listing] nostr publish complete', {
          eventId: nostrEventId,
          okCount,
          relayCount: publishResult.relayResults.length,
        });
        toast.success(
          t('modal.toast.listingCreatedNostr', { ok: okCount, total: publishResult.relayResults.length })
        );
      } else {
        console.log('[Listing] qr-only listing complete');
        toast.success(t('modal.toast.listingCreatedQr'));
      }
    } catch (e: any) {
      console.error('[Listing] handleCreateListing:error', e);
      setListingError(e.message ?? String(e));
    } finally {
      setListingBusy(false);
      console.log('[Listing] handleCreateListing:done');
    }
  };

  const handlePublishSignedListingToNostr = async () => {
    if (!selectedInscription || !listingSignedPsbt) {
      setListingError(t('modal.errors.publishNothing'));
      return;
    }
    const priceKoinu = dogeToShibes(Number(listingPriceDoge));
    if (!Number.isFinite(priceKoinu) || priceKoinu <= 0) {
      setListingError(t('modal.errors.publishPrice'));
      return;
    }

    setListingBusy(true);
    setListingError(null);
    setListingPublishRelayResults([]);
    setShowListingPublishDetails(false);
    toast.info(t('modal.toast.publishingNostr'));
    try {
      const publishResult = await publishListingToNostrWithDiagnostics(
        listingSignedPsbt,
        selectedInscription.inscriptionId,
        selectedInscription.inscriptionNumber,
        selectedInscription.output,
        priceKoinu,
      );
      const nostrEventId = publishResult.eventId;
      setListingPublishRelayResults(publishResult.relayResults);
      setShowListingPublishDetails(true);
      if (nostrEventId) setListingNostrEventId(selectedInscription.inscriptionId, nostrEventId);
      setListingNostrPublished(true);
      const okCount = publishResult.relayResults.filter(r => r.ok).length;
      toast.success(t('modal.toast.publishedNostr', { ok: okCount, total: publishResult.relayResults.length }));
    } catch (e: any) {
      setListingError(e?.message ?? t('modal.errors.publishFailed'));
      setShowListingPublishDetails(true);
    } finally {
      setListingBusy(false);
    }
  };

  /** Local-only remove — still valid on-chain for anyone who has the PSBT/URL. */
  const handleCancelListingLocalOnly = (inscriptionId: string) => {
    removeListing(inscriptionId);
    setActiveListings(getActiveListings(activeAddress ?? undefined));
    setCancelConfirmId(null);
    toast.success(t('modal.toast.listingRemovedLocal'));
  };

  /**
   * TRUE cancel: self-spend the inscription UTXO back to yourself.
   * This moves it to a new UTXO, permanently invalidating all copies of the signed PSBT.
   */
  const handleTrueCancelListing = async (listing: ActiveListing) => {
    if (!activeAddress) return;
    setTrueCancelBusy(true);
    setTrueCancelError(null);
    try {
      const w = await loadUnlockedBrowserWallet();

      // Extract inscription output value from the saved signed PSBT
      const inscriptionOutputValue = getInscriptionValueFromPsdt(listing.signedPsbtBase64);

      // Payment UTXOs for fee (non-inscription UTXOs)
      const payerUtxos = await getAddressUtxos(activeAddress);
      const paymentUtxos = payerUtxos
        .filter(u => u.value > DUMMY_UTXO_VALUE)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      if (paymentUtxos.length === 0) {
        throw new Error(t('modal.throws.cancelNeedFunds'));
      }

      // Self-spend: inscription → same address (moves it to a new UTXO, invalidates the PSBT)
      const txHex = await buildAndSignSendInscription({
        inscriptionOutput:      listing.inscriptionUtxo,
        inscriptionOutputValue,
        recipientAddress:       activeAddress,
        senderAddress:          activeAddress,
        paymentUtxos,
        privateKeyWif:          w.privateKey,
      });

      const txid = await broadcastOrdinalTx(txHex);

      // Mark cancelled in local store
      updateListingStatus(listing.inscriptionId, 'cancelled');
      setActiveListings(getActiveListings(activeAddress));
      setCancelConfirmId(null);
      toast.success(
        t('modal.toast.listingCancelledChain', { txShort: txid.slice(0, 12) })
      );
    } catch (e: any) {
      setTrueCancelError(e?.message ?? String(e));
    } finally {
      setTrueCancelBusy(false);
    }
  };

  const handleNostrCancelListing = async (listing: ActiveListing) => {
    if (!listing.nostrEventId || !listing.nostrPrivateKey) {
      setTrueCancelError('No Nostr event ID or private key available for cancellation');
      return;
    }
    setTrueCancelBusy(true);
    setTrueCancelError(null);
    try {
      await publishListingCancelToNostr(
        listing.nostrEventId,
        listing.inscriptionId,
        listing.inscriptionNumber,
        listing.inscriptionUtxo,
        listing.nostrPrivateKey,
      );

      // Mark cancelled in local store
      updateListingStatus(listing.inscriptionId, 'cancelled');
      setActiveListings(getActiveListings(activeAddress ?? undefined));
      setCancelConfirmId(null);
      toast.success(t('modal.toast.listingCancelledNostr'));
    } catch (e: any) {
      setTrueCancelError(e?.message ?? String(e));
    } finally {
      setTrueCancelBusy(false);
    }
  };

  const handleCopyListingUrl = async (url: string) => {
    await copyTextWithFallback(url);
    toast.success(t('modal.toast.listingUrlCopied'));
  };

  const renderWalletSwitcherGroups = () => (
    <WalletAccountSwitcherPanel
      localSeedGroups={localSeedWalletGroups}
      extensionWallets={extensionWallets}
      hardwareWallets={hardwareWallets}
      activeAddress={activeAddress}
      walletType={walletType}
      isBusy={isBusy}
      canAddHdAccount={isBrowserWallet && Boolean(activePassword && browser.wallet?.seedFingerprint)}
      ledgerAccountIndex={walletType === 'ledger' ? unifiedAccountIndex : null}
      onSelectLocalAddress={async (targetAddress) => {
        await handleConnectSavedLocalWallet(targetAddress);
        setStep('dashboard');
      }}
      onAddHdAccount={handleAddBrowserAccount}
      onSelectWalletType={(type) => {
        setActiveWallet(type);
        setStep('dashboard');
      }}
      onLedgerAccountDelta={handleLedgerAccountDelta}
      enableConnectAnother
      onSelectBrowserFlow={() => setStep('entry')}
      onConnectedAnother={() => setStep('dashboard')}
      t={t}
    />
  );

  const words = (pendingSeed?.mnemonic ?? '').split(/\s+/).filter(Boolean);
  const revealedWords = showSecretPhrase ? words : [];
  const isDrawerMode = mode === 'drawer';
  const isDrawerLeft = isDrawerMode && drawerSide === 'left';

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className={cx('relative', isDrawerMode && 'pointer-events-none')}
          data-ds-theme={isDark ? 'dark' : 'light'}
          style={{ zIndex: isDrawerMode ? 10050 : 9999 }}
          onClose={onClose}
          __demoMode={isDrawerMode}
        >
          {!isDrawerMode ? (
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/84 backdrop-blur-sm" />
            </Transition.Child>
          ) : null}

          <div
            className={cx(
              'fixed inset-0',
              isDrawerMode ? 'pointer-events-none overflow-visible' : 'overflow-y-auto',
            )}
          >
            <div
              className={cx(
                'flex min-h-full',
                isDrawerMode
                  ? cx('h-[100dvh] min-h-0 items-stretch p-0', isDrawerLeft ? 'justify-start' : 'justify-end')
                  : 'items-center justify-center px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-8',
              )}
            >
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom={
                  isDrawerMode
                    ? isDrawerLeft
                      ? '-translate-x-full opacity-0'
                      : 'translate-x-full opacity-0'
                    : 'opacity-0 scale-95'
                }
                enterTo={isDrawerMode ? 'translate-x-0 opacity-100' : 'opacity-100 scale-100'}
                leave="ease-in duration-200"
                leaveFrom={isDrawerMode ? 'translate-x-0 opacity-100' : 'opacity-100 scale-100'}
                leaveTo={
                  isDrawerMode
                    ? isDrawerLeft
                      ? '-translate-x-full opacity-0'
                      : 'translate-x-full opacity-0'
                    : 'opacity-0 scale-95'
                }
              >
                <Dialog.Panel
                  data-ds-theme={isDark ? 'dark' : 'light'}
                  className={cx(
                    'ds-wallet-dashboard relative flex flex-col overflow-hidden',
                    !isDark && 'ds-light',
                    isDrawerMode
                      ? cx(
                          'pointer-events-auto fixed top-0 z-[10001] flex h-[100dvh] max-h-[100dvh] min-h-0 w-[min(100dvw,430px)] max-w-[min(100dvw,430px)] flex-col overflow-hidden',
                          isDrawerLeft ? 'left-0' : 'right-0',
                        )
                      : 'w-full max-h-[92vh] max-w-lg',
                    isDrawerMode
                      ? isDrawerLeft
                        ? drawerSurfacePhoneLeft
                        : drawerSurfacePhoneRight
                      : MODAL_SURFACE,
                  )}
                >
                  {/*
                    Host dApp signing: in-wallet absolute modal (host CSS .ds-wallet-approval).
                    Must stay a direct child of .ds-wallet-dashboard so it covers the chassis
                    without entering the scrollable body or pushing dashboard layout.
                  */}
                  <WalletApprovalPanel />
                  <div className="shrink-0 border-b border-white/[0.08] px-4 pb-3 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {step === 'dashboard' && connected ? (
                          <Menu as="div" className="relative shrink-0">
                            <Menu.Button
                              type="button"
                              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-transparent p-0 transition hover:opacity-90"
                              aria-label={t('modal.profileDpfp.avatarMenuAria')}
                              title={t('modal.profileDpfp.avatarMenuAria')}
                            >
                              <DogePFPAvatar size="md" address={activeAddress} />
                            </Menu.Button>
                            <WalletMenuItems
                              theme={isDark ? 'dark' : 'light'}
                              anchor="bottom start"
                              className="min-w-[13rem] max-w-[16rem]"
                            >
                              <div className="px-3 py-2 text-[10px] leading-snug text-white/45">
                                {t('modal.profileDpfp.menuHint')}
                              </div>
                              {pfpInscriptionId ? (
                                <Menu.Item>
                                  {({ focus, active }) => (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        clearDogePFP();
                                        toast.message(t('modal.toast.dpfpCleared'));
                                      }}
                                      className={cx(
                                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                        (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                      )}
                                    >
                                      <PhotoIcon className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                                      <span className="leading-tight">{t('modal.profileDpfp.clearPfp')}</span>
                                    </button>
                                  )}
                                </Menu.Item>
                              ) : null}
                              {pfaInscriptionId ? (
                                <Menu.Item>
                                  {({ focus, active }) => (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        clearDogePFA();
                                        toast.message(t('modal.toast.dpfaCleared'));
                                      }}
                                      className={cx(
                                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                        (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                      )}
                                    >
                                      <MusicalNoteIcon className="h-4 w-4 shrink-0 text-amber-200/80" aria-hidden />
                                      <span className="leading-tight">{t('modal.profileDpfa.clearPfa')}</span>
                                    </button>
                                  )}
                                </Menu.Item>
                              ) : null}
                              <Menu.Item>
                                {({ focus, active }) => (
                                  <button
                                    type="button"
                                    onClick={() => setStep('switch_wallet')}
                                    className={cx(
                                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                      (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                    )}
                                  >
                                    <WalletIcon className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                                    <span className="leading-tight">{t('modal.walletSwitcher.title')}</span>
                                  </button>
                                )}
                              </Menu.Item>
                            </WalletMenuItems>
                          </Menu>
                        ) : null}
                        {step !== 'dashboard' &&
                          step !== 'unlock' &&
                          step !== 'chooser' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (step === 'entry' && !connected) {
                                setStep('chooser');
                                return;
                              }
                              setStep(connected ? 'dashboard' : 'chooser');
                            }}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/75 transition hover:bg-white/10 hover:text-white"
                            aria-label={t('modal.aria.backToWallet')}
                            title={t('modal.aria.backToWallet')}
                          >
                            <ArrowLeftIcon className="h-4 w-4" />
                          </button>
                        )}
                        <Dialog.Title
                          className={clsx(
                            'truncate text-[15px] font-semibold tracking-tight',
                            isDark ? 'text-white/95' : 'text-zinc-950'
                          )}
                        >
                          {step === 'chooser'
                            ? t('wallet.connectionModal.title')
                            : step === 'import'
                            ? t('modal.title.importWallet')
                            : step === 'reveal'
                              ? t('modal.title.revealPhrase')
                              : step === 'password'
                                ? t('modal.title.setPassword')
                                : step === 'verification'
                                  ? t('modal.title.linkX')
                                  : step === 'send'
                                    ? t('modal.title.sendDoge')
                                    : step === 'receive'
                                      ? t('modal.title.receiveDoge')
                                      : step === 'remove'
                                        ? t('modal.title.removeWallet')
                                        : step === 'settings'
                                          ? t('modal.title.walletSettings')
                                          : step === 'switch_wallet'
                                            ? t('modal.walletSwitcher.title')
                                            : step === 'address_book'
                                              ? t('modal.title.addressBook')
                                              : step === 'utxos'
                                                ? 'Coins & UTXOs'
                                              : step === 'send_inscription'
                                                ? t('modal.title.sendInscription', {
                                                    num: String(selectedInscription?.inscriptionNumber ?? ''),
                                                  })
                                                : step === 'list_inscription'
                                                  ? t('modal.title.listInscription', {
                                                      num: String(selectedInscription?.inscriptionNumber ?? ''),
                                                    })
                                                  : t('modal.title.myWallet')}
                        </Dialog.Title>
                        {step === 'dashboard' && connected ? (
                          <div className="ml-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setStep('address_book')}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 transition hover:bg-white/10 hover:text-white"
                              aria-label="Address Book"
                              title="Address Book"
                            >
                              <TagIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={openSettings}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 transition hover:bg-white/10 hover:text-white"
                              aria-label={t('modal.aria.settings')}
                              title={t('modal.aria.walletSettingsTitle')}
                            >
                              <Cog6ToothIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                        {(step === 'unlock' || step === 'dashboard') &&
                        isBrowserWallet &&
                        (needsBackup || showTemporaryBanner) ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (needsBackup) {
                                void handleBackupNow();
                                return;
                              }
                              toast.warning(t('modal.toast.setPasswordBanner'));
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-300 transition hover:bg-amber-500/25"
                            aria-label={
                              needsBackup ? t('modal.aria.backupNeeded') : t('modal.aria.checkWalletStatus')
                            }
                            title={
                              needsBackup
                                ? t('modal.aria.backupNeededTitle')
                                : t('modal.aria.setPasswordSecureTitle')
                            }
                          >
                            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label={t('modal.aria.closeWallet')}
                        title="Close"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                    {step === 'chooser' && (
                      <p className="mt-2 text-center text-sm leading-6 text-white/55">
                        {t('wallet.connectionModal.subtitle')}
                      </p>
                    )}
                    {step === 'entry' && (
                      <p className="mt-2 text-center text-sm leading-6 text-white/55">
                        {t('modal.tagline.builtIn')}
                      </p>
                    )}
                    {step === 'unlock' && (
                      <p className="mt-2 text-sm leading-6 text-white/55">
                        {t('modal.tagline.builtIn')}
                      </p>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 overflow-x-visible overflow-y-auto overscroll-contain px-4 py-4">
                    {error ? (
                      <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                      </div>
                    ) : null}

                    {step === 'chooser' && (
                      <WalletConnectChooser
                        onSelectBrowser={() => setStep('entry')}
                        onConnected={() => setStep('dashboard')}
                      />
                    )}

                    {step === 'entry' && (
                      <div className="space-y-4">
                        {savedLocalWallets.length > 0 ? (
                          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                                {t('modal.savedWallets.heading')}
                              </div>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/45">
                                {savedLocalWallets.length}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {localSeedWalletGroups.map((group) => (
                                <div key={group.id} className="space-y-2">
                                  {group.accounts.length > 1 ? (
                                    <div className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                                      {group.accounts[0]?.nickname?.trim() ||
                                        t('modal.walletSwitcher.seedGroup', {
                                          count: String(group.accounts.length),
                                        })}
                                    </div>
                                  ) : null}
                                  {group.accounts.map((item) => {
                                    const isEncrypted = Boolean((item as { encrypted?: boolean }).encrypted);
                                    const isSelected = selectedLocalWalletAddress === item.address;
                                    return (
                                      <button
                                        key={item.address}
                                        type="button"
                                        onClick={() => handleConnectSavedLocalWallet(item.address)}
                                        disabled={isBusy}
                                        className={cx(
                                          'group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
                                          isSelected
                                            ? 'border-[#FCD34D]/45 bg-[#FCD34D]/10'
                                            : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
                                          isBusy && 'cursor-wait opacity-70',
                                        )}
                                      >
                                        <div
                                          className={cx(
                                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                                            isEncrypted
                                              ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
                                              : 'border-white/10 bg-white/5 text-white/35',
                                          )}
                                        >
                                          {isEncrypted ? (
                                            <LockClosedIcon className="h-5 w-5" aria-hidden />
                                          ) : (
                                            <KeyIcon className="h-5 w-5" aria-hidden />
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-sm font-semibold text-white">
                                            {item.nickname?.trim() ||
                                              `${item.address.slice(0, 8)}…${item.address.slice(-6)}`}
                                          </div>
                                          <div className="mt-0.5 font-mono text-[11px] text-white/45">
                                            {item.address.slice(0, 10)}…{item.address.slice(-8)}
                                          </div>
                                          <div className="mt-1 text-[10px] text-white/40">
                                            {isEncrypted
                                              ? t('modal.savedWallets.encrypted')
                                              : t('modal.savedWallets.passwordless')}
                                            {typeof item.accountIndex === 'number'
                                              ? ` · ${t('modal.savedWallets.account', { index: String(item.accountIndex) })}`
                                              : ''}
                                          </div>
                                        </div>
                                        <span className="shrink-0 rounded-lg border border-[#C8A84B]/35 bg-[#C8A84B]/10 px-3 py-1.5 text-xs font-semibold text-[#D4A84B] transition group-hover:bg-[#C8A84B]/20">
                                          {t('modal.savedWallets.connect')}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="space-y-3">
                          <Button onClick={handleCreateWallet} disabled={isBusy} className={cx('w-full', PRIMARY_BUTTON)}>
                            {isBusy ? t('modal.entry.creating') : t('modal.entry.createNew')}
                          </Button>
                          <p className="text-center text-xs leading-5 text-white/45">{t('modal.entry.createHint')}</p>
                          <Button onClick={() => setStep('import')} disabled={isBusy} className={cx('w-full', SECONDARY_BUTTON)}>
                            {t('modal.entry.import')}
                          </Button>
                        </div>
                      </div>
                    )}

                    {step === 'unlock' && (
                      <div className="space-y-4">
                        {unlockStepPrefs?.primary !== 'pin' || showUnlockBiometricTab ? (
                          <div className="flex rounded-xl border border-white/10 bg-[#0A0A0A] p-1">
                            {unlockStepPrefs?.primary !== 'pin' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setUnlockMode('password');
                                  setUnlockPassword('');
                                }}
                                className={cx(
                                  'min-w-0 flex-1 rounded-lg py-2 text-center text-xs font-semibold transition',
                                  unlockMode === 'password' ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'
                                )}
                              >
                                {t('modal.unlock.modePassword')}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                setUnlockMode('pin');
                                setUnlockPassword('');
                              }}
                              className={cx(
                                'min-w-0 flex-1 rounded-lg py-2 text-center text-xs font-semibold transition',
                                unlockMode === 'pin' ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'
                              )}
                            >
                              {t('modal.unlock.modePin')}
                            </button>
                            {showUnlockBiometricTab ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setUnlockMode('biometric');
                                  setUnlockPassword('');
                                }}
                                className={cx(
                                  'min-w-0 flex-1 rounded-lg py-2 text-center text-xs font-semibold transition',
                                  unlockMode === 'biometric' ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'
                                )}
                              >
                                {t('modal.unlock.modeBiometric')}
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {unlockMode === 'biometric' ? (
                          <div className="space-y-3">
                            <p className="text-sm leading-6 text-white/60">{t('modal.unlock.biometricHint')}</p>
                            <Button
                              type="button"
                              onClick={() => void handleUnlockWallet()}
                              disabled={isBusy}
                              className={cx('w-full', PRIMARY_BUTTON)}
                            >
                              {isBusy ? t('modal.unlock.unlocking') : t('modal.unlock.biometricCta')}
                            </Button>
                          </div>
                        ) : (
                          <form
                            className="relative space-y-4"
                            autoComplete="off"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (!isBusy) {
                                void handleUnlockWallet();
                              }
                            }}
                          >
                            {walletSecretDecoyFields.map((decoy) => (
                              <input key={decoy.name} {...decoy} defaultValue="" />
                            ))}
                            <div className="block text-sm text-[#E5E5E5]">
                              <span className="mb-3 block text-center">
                                {unlockMode === 'pin' ? t('modal.unlock.enterPin') : t('modal.unlock.enterPassword')}
                              </span>
                              {unlockMode === 'pin' ? (
                                <WalletPinNumpad
                                  value={unlockPassword}
                                  onChange={setUnlockPassword}
                                  disabled={isBusy}
                                  minLength={6}
                                  maxLength={12}
                                  onSubmit={() => {
                                    if (!isBusy && /^\d{6,}$/.test(unlockPassword.trim())) {
                                      void handleUnlockWallet();
                                    }
                                  }}
                                  submitLabel={isBusy ? t('modal.unlock.unlocking') : t('modal.unlock.submit')}
                                  ariaLabel={t('modal.unlock.enterPin')}
                                />
                              ) : (
                                <div className="flex items-center rounded-xl border border-white/10 bg-[#0A0A0A] focus-within:border-[#FCD34D]">
                                  <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={unlockPassword}
                                    onChange={(event) => setUnlockPassword(event.target.value)}
                                    autoFocus
                                    className="w-full bg-transparent px-4 py-3 text-white outline-none placeholder:text-white/35"
                                    {...walletSecretInputProps('dojakweb-unlock-secret')}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword((value) => !value)}
                                    className="px-4 text-white/65 transition hover:text-white"
                                    aria-label={showPassword ? t('modal.aria.hidePassword') : t('modal.aria.showPassword')}
                                  >
                                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-3">
                              <Button type="button" onClick={() => setStep('entry')} className={cx('flex-1', SECONDARY_BUTTON)}>
                                {t('modal.unlock.goBack')}
                              </Button>
                              {unlockMode !== 'pin' ? (
                                <Button
                                  type="submit"
                                  disabled={isBusy || !unlockPassword.trim()}
                                  className={cx('flex-1', PRIMARY_BUTTON)}
                                >
                                  {isBusy ? t('modal.unlock.unlocking') : t('modal.unlock.submit')}
                                </Button>
                              ) : null}
                            </div>
                          </form>
                        )}

                        {unlockMode === 'biometric' ? (
                          <Button type="button" onClick={() => setStep('entry')} className={cx('w-full', SECONDARY_BUTTON)}>
                            {t('modal.unlock.goBack')}
                          </Button>
                        ) : null}
                      </div>
                    )}

                    {step === 'import' && (
                      <div className="space-y-4">
                        <div className="flex gap-2 mb-2">
                          <button
                            type="button"
                            onClick={handleImportFile}
                            className={cx('flex h-8 w-8 items-center justify-center rounded-none border border-zinc-700 bg-zinc-900 text-white transition hover:bg-zinc-800')}
                            aria-label={t('modal.aria.importWalletFile')}
                          >
                            <FolderOpenIcon className="h-5 w-5" />
                          </button>
                        </div>
                        <textarea
                          value={importValue}
                          onChange={(event) => setImportValue(event.target.value)}
                          rows={5}
                          placeholder={t('modal.import.placeholder')}
                          className={INPUT_CLASS}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button onClick={() => setStep('entry')} className={cx('flex-1', SECONDARY_BUTTON)}>
                            {t('modal.import.goBack')}
                          </Button>
                          <Button onClick={handleImportWallet} disabled={isBusy || !importValue.trim()} className={cx('flex-1', PRIMARY_BUTTON)}>
                            {t('modal.import.submit')}
                          </Button>
                        </div>
                      </div>
                    )}

                    {step === 'reveal' && (
                      <div className="space-y-5">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button
                            onClick={() => setShowSecretPhrase((value) => !value)}
                            disabled={!pendingSeed?.mnemonic}
                            className={cx(SECONDARY_BUTTON, 'inline-flex h-12 w-12 items-center justify-center px-0')}
                            aria-label={showSecretPhrase ? 'Hide secret phrase' : 'Show secret phrase'}
                          >
                            {showSecretPhrase ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                          </Button>
                          <Button
                            onClick={handleCopyMnemonic}
                            disabled={!pendingSeed?.mnemonic}
                            className={cx(SECONDARY_BUTTON, 'inline-flex h-12 w-12 items-center justify-center px-0')}
                            aria-label={t('modal.aria.copySecretPhrase')}
                          >
                            <ClipboardDocumentIcon className="h-5 w-5" />
                          </Button>
                          <button
                            type="button"
                            onClick={handleBackupZip}
                            title={t('modal.aria.backupZipTitle')}
                            className={cx('flex h-10 w-12 items-center justify-center rounded-none border border-zinc-700 bg-zinc-900 px-0 py-0 text-sm font-semibold text-white transition hover:bg-zinc-800', !pendingWallet && !browser.wallet && 'opacity-50 pointer-events-none')}
                            disabled={!pendingWallet && !browser.wallet}
                            aria-label={t('modal.aria.saveWalletZip')}
                          >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {Array.from({ length: 12 }).map((_, index) => (
                            <div key={index} className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-base text-white">
                              <span className="mr-2 text-white/45">{index + 1}.</span>
                              <span>{revealedWords[index] ?? t('modal.reveal.wordHidden')}</span>
                            </div>
                          ))}
                        </div>
                        {!pendingSeed?.mnemonic ? (
                          <div className="space-y-3">
                            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm leading-6 text-[#F8E7A1]">
                              {t('modal.reveal.passwordProtectedHint')}
                            </div>
                            <label className="block text-sm text-[#E5E5E5]">
                              <span className="mb-2 block">{t('modal.reveal.walletPasswordLabel')}</span>
                              <div className="flex items-center rounded-xl border border-white/10 bg-[#0A0A0A] focus-within:border-[#FCD34D]">
                                <input
                                  type={showPassword ? "text" : "password"}
                                  value={revealPassword}
                                  onChange={(e) => setRevealPassword(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") { void handleRevealWithPassword(); } }}
                                  placeholder={t('modal.reveal.walletPasswordPlaceholder')}
                                  className="w-full bg-transparent px-4 py-3 text-white outline-none placeholder:text-white/35"
                                  {...walletSecretInputProps('dojakweb-reveal-secret')}
                                />
                                <button type="button" onClick={() => setShowPassword((v) => !v)} className="px-4 text-white/65 transition hover:text-white">
                                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                </button>
                              </div>
                            </label>
                            <Button onClick={handleRevealWithPassword} disabled={!revealPassword.trim()} className={cx("w-full", PRIMARY_BUTTON)}>
                              {t('modal.reveal.unlockReveal')}
                            </Button>
                          </div>
                        ) : null}
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-[#FCA5A5]">
                          {t('modal.reveal.warningLine1')}<br />
                          {t('modal.reveal.warningLine2')}
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button onClick={handleDismissBackupReveal} className={cx("flex-1", SECONDARY_BUTTON)}>
                            {connected || browser.connected
                              ? t('modal.reveal.doLater')
                              : t('modal.reveal.goBack')}
                          </Button>
                          {pendingSeed?.mnemonic && (
                            <Button onClick={handleSavedSecretPhrase} className={cx("flex-1", PRIMARY_BUTTON)}>
                              {t('modal.reveal.savedWords')}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {step === 'password' && (
                      <form
                        className="relative space-y-4"
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!isBusy) {
                            void handleSetPassword();
                          }
                        }}
                      >
                        {walletSecretDecoyFields.map((decoy) => (
                          <input key={decoy.name} {...decoy} defaultValue="" />
                        ))}
                        <div>
                          <span className="mb-2 block text-sm text-[#E5E5E5]">{t('modal.password.primaryLabel')}</span>
                          <div className="flex rounded-xl border border-white/10 bg-[#0A0A0A] p-1">
                            <button
                              type="button"
                              onClick={() => {
                                setNewPrimarySecret('password');
                                setPassword('');
                                setConfirmPassword('');
                              }}
                              className={cx(
                                'min-w-0 flex-1 rounded-lg py-2 px-1 text-center text-[11px] font-semibold leading-tight sm:text-xs transition',
                                newPrimarySecret === 'password' ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'
                              )}
                            >
                              {t('modal.password.primaryPassword')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNewPrimarySecret('pin');
                                setPassword('');
                                setConfirmPassword('');
                              }}
                              className={cx(
                                'min-w-0 flex-1 rounded-lg py-2 px-1 text-center text-[11px] font-semibold leading-tight sm:text-xs transition',
                                newPrimarySecret === 'pin' ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'
                              )}
                            >
                              {t('modal.password.primaryPin')}
                            </button>
                          </div>
                        </div>

                        <label className="block text-sm text-[#E5E5E5]">
                          <span className="mb-2 block">{t('modal.password.strengthLabel')}</span>
                          <select
                            value={newSecretStrength}
                            onChange={(event) =>
                              setNewSecretStrength(event.target.value as 'standard' | 'high' | 'maximum')
                            }
                            className={INPUT_CLASS}
                          >
                            <option value="standard">{t('modal.password.strengthStandard')}</option>
                            <option value="high">{t('modal.password.strengthHigh')}</option>
                            <option value="maximum">{t('modal.password.strengthMaximum')}</option>
                          </select>
                        </label>

                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-sm text-white/75">
                          <input
                            type="checkbox"
                            checked={enableWebAuthnQuickUnlock}
                            onChange={(event) => setEnableWebAuthnQuickUnlock(event.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent"
                          />
                          <span>{t('modal.password.biometricHint')}</span>
                        </label>

                        {newPrimarySecret === 'pin' ? (
                          <div className="block text-sm text-[#E5E5E5]">
                            <span className="mb-3 block text-center">{t('modal.password.enterPin')}</span>
                            {/* Single pad only — never stack enter + confirm numpads. */}
                            <WalletPinNumpad
                              value={password}
                              onChange={setPassword}
                              disabled={isBusy}
                              minLength={6}
                              maxLength={12}
                              onSubmit={() => {
                                if (!isBusy && /^\d{6,}$/.test(password.trim())) {
                                  void handleSetPassword();
                                }
                              }}
                              submitLabel={isBusy ? t('modal.password.setting') : t('modal.password.setPin')}
                              ariaLabel={t('modal.password.enterPin')}
                            />
                          </div>
                        ) : (
                          <>
                            <div className="block text-sm text-[#E5E5E5]">
                              <span className="mb-2 block">{t('modal.password.enter')}</span>
                              <div className="flex items-center rounded-xl border border-white/10 bg-[#0A0A0A] focus-within:border-[#FCD34D]">
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  value={password}
                                  onChange={(event) => setPassword(event.target.value)}
                                  className="w-full bg-transparent px-4 py-3 text-white outline-none placeholder:text-white/35"
                                  {...walletSecretInputProps('dojakweb-new-secret')}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((value) => !value)}
                                  className="px-4 text-white/65 transition hover:text-white"
                                  aria-label={showPassword ? t('modal.aria.hidePassword') : t('modal.aria.showPassword')}
                                >
                                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                </button>
                              </div>
                            </div>

                            <div className="block text-sm text-[#E5E5E5]">
                              <span className="mb-2 block">{t('modal.password.confirm')}</span>
                              <div className="flex items-center rounded-xl border border-white/10 bg-[#0A0A0A] focus-within:border-[#FCD34D]">
                                <input
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  value={confirmPassword}
                                  onChange={(event) => setConfirmPassword(event.target.value)}
                                  className="w-full bg-transparent px-4 py-3 text-white outline-none placeholder:text-white/35"
                                  {...walletSecretInputProps('dojakweb-confirm-secret')}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword((value) => !value)}
                                  className="px-4 text-white/65 transition hover:text-white"
                                  aria-label={
                                    showConfirmPassword ? t('modal.aria.hidePassword') : t('modal.aria.showPassword')
                                  }
                                >
                                  {showConfirmPassword ? (
                                    <EyeSlashIcon className="h-5 w-5" />
                                  ) : (
                                    <EyeIcon className="h-5 w-5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        <div className="flex items-center justify-between gap-3">
                          <Button type="button" onClick={handleSkipPassword} className={cx('min-w-32', SECONDARY_BUTTON)}>
                            {t('modal.password.skip')}
                          </Button>
                          {newPrimarySecret === 'pin' ? null : (
                            <Button
                              type="submit"
                              disabled={isBusy || !password || !confirmPassword}
                              className={cx('min-w-40', PRIMARY_BUTTON)}
                            >
                              {t('modal.password.set')}
                            </Button>
                          )}
                        </div>
                      </form>
                    )}

                    {step === 'dashboard' && (
                      <div className="space-y-3">
                        <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-4 pb-4 pt-3">
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setStep('switch_wallet')}
                              disabled={isBusy}
                              className="min-w-0 flex-1 rounded-xl px-1 py-0.5 text-left transition hover:bg-white/[0.04] disabled:opacity-60"
                              aria-label={t('modal.walletSwitcher.title')}
                            >
                              <div className="flex items-center gap-1.5">
                                <WalletProviderIcon walletType={activeWalletType} size="xs" />
                                <span className="truncate text-sm font-medium text-white/90">
                                  {activeWalletName ||
                                    activeWalletSummary?.label ||
                                    getWalletSourceIndicator(activeWalletType, t).label}
                                </span>
                                <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
                              </div>
                              {activeAddress ? (
                                <span className="mt-0.5 block truncate font-mono text-[11px] text-white/40">
                                  {truncateAddress(activeAddress)}
                                </span>
                              ) : null}
                            </button>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <DogePFAHeaderControl />
                              <button
                                type="button"
                                onClick={() => setHideBalance((v) => !v)}
                                aria-label={hideBalance ? t('modal.aria.showBalance') : t('modal.aria.hideBalance')}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 transition hover:bg-white/5 hover:text-white"
                                title={hideBalance ? t('modal.aria.showBalance') : t('modal.aria.hideBalance')}
                              >
                                {hideBalance ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await refreshBalance();
                                  toast.success(t('modal.toast.balanceRefreshed'));
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 transition hover:bg-white/5 hover:text-white"
                                aria-label={t('modal.aria.refreshBalance')}
                              >
                                <ArrowPathIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {connected && isBrowserWallet && activeBrowserSeedGroup ? (
                            <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
                              {activeBrowserSeedGroup.accounts.map((acc) => {
                                const isActiveAccount = acc.address === activeAddress;
                                return (
                                  <button
                                    key={acc.address}
                                    type="button"
                                    onClick={() => {
                                      if (!isActiveAccount) void handleConnectSavedLocalWallet(acc.address);
                                    }}
                                    disabled={isBusy || isActiveAccount}
                                    title={acc.address}
                                    className={cx(
                                      'rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums transition',
                                      isActiveAccount
                                        ? 'border-[#FCD34D]/50 bg-[#FCD34D]/15 text-[#FCD34D]'
                                        : 'border-white/10 bg-white/5 text-white/65 hover:border-white/20 hover:bg-white/10 hover:text-white',
                                      isBusy && 'cursor-wait',
                                    )}
                                  >
                                    #{acc.accountIndex}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => void handleAddBrowserAccount()}
                                disabled={isBusy}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-white/15 text-white/45 transition hover:border-[#D4A017]/40 hover:text-[#FCD34D] disabled:opacity-40"
                                aria-label={t('modal.walletSwitcher.addAccount')}
                                title={t('modal.walletSwitcher.addAccount')}
                              >
                                <PlusIcon className="h-3 w-3" aria-hidden />
                              </button>
                            </div>
                          ) : null}

                          <div className="px-1 pb-1 pt-3 text-center">
                            {balanceRefreshing && !balanceVerified && balance <= 0 ? (
                              <div className="text-2xl font-semibold text-white/50 animate-pulse">
                                {t('modal.dashboard.refreshingBalance')}
                              </div>
                            ) : !balanceVerified && balance <= 0 ? (
                              <div className="space-y-1">
                                <div className="text-3xl font-semibold tracking-tight text-white/40">—</div>
                                <p className="text-[11px] text-white/40">
                                  Balance not loaded yet — tap refresh
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="text-4xl font-semibold leading-none tracking-tight text-white">
                                  {hideBalance ? (
                                    '••••••'
                                  ) : (
                                    <span className="inline-flex items-baseline gap-1.5">
                                      <span className="text-2xl font-semibold text-[#FCD34D]" aria-hidden>
                                        Ð
                                      </span>
                                      <span>
                                        {balance.toLocaleString(undefined, {
                                          maximumFractionDigits: balance >= 1000 ? 2 : 8,
                                        })}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                {fiatPrefs && !hideBalance && balanceVerified ? (
                                  <div className="mt-2 text-sm font-medium text-white/45">
                                    {fiatPrefs.formatFiat(fiatPrefs.convert(balance))}
                                  </div>
                                ) : !balanceVerified && balance > 0 ? (
                                  <div className="mt-2 text-[11px] text-amber-200/70">
                                    Provisional — confirming with indexer…
                                  </div>
                                ) : null}
                                {!hideBalance && balanceVerified ? (
                                  <div className="mt-3 space-y-1">
                                    <button
                                      type="button"
                                      onClick={() => setStep('utxos')}
                                      className="mx-auto block text-center text-[12px] font-medium text-white/70 transition hover:text-[#FCD34D]"
                                    >
                                      {spendableBreakBusy && !spendableBreak
                                        ? 'Checking spendable…'
                                        : spendableBreak
                                          ? `Spendable ${spendableBreak.spendableDoge.toLocaleString(undefined, { maximumFractionDigits: 4 })} Ð`
                                          : 'Check spendable coins'}
                                    </button>
                                    {spendableBreak && spendableBreak.unavailableDoge > 0.05 ? (
                                      <p className="text-[11px] leading-snug text-white/40">
                                        {spendableBreak.unavailableDoge.toLocaleString(undefined, { maximumFractionDigits: 2 })} Ð not sendable
                                        {spendableBreak.localHoldDoge > 0.001
                                          ? ` · ${spendableBreak.localHoldDoge.toLocaleString(undefined, { maximumFractionDigits: 2 })} Ð held after recent broadcast`
                                          : ''}
                                        {spendableBreak.dustCarrierCount > 0
                                          ? ` · ${spendableBreak.dustCarrierCount} inscription carrier${spendableBreak.dustCarrierCount === 1 ? '' : 's'}`
                                          : ''}
                                        {' · '}
                                        <button
                                          type="button"
                                          className="text-[#FCD34D]/80 underline-offset-2 hover:underline"
                                          onClick={() => setStep('utxos')}
                                        >
                                          Manage
                                        </button>
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>

                          <div className="mt-4 grid grid-cols-4 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSendPrefillAddress(null);
                                setStep('send');
                              }}
                              className="flex flex-col items-center gap-1.5"
                              aria-label={t('modal.aria.sendDoge')}
                            >
                              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#FCD34D]/45 bg-[#FCD34D] text-[#161109] shadow-[0_8px_20px_rgba(252,211,77,0.28)] transition hover:bg-[#FDE68A]">
                                <PaperAirplaneIcon className="h-5 w-5" />
                              </span>
                              <span className="text-[10px] font-medium text-white/55">{t('modal.dashboard.menu.send')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setStep('receive')}
                              className="flex flex-col items-center gap-1.5"
                              aria-label={t('modal.aria.receiveQr')}
                            >
                              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.1]">
                                <QrCodeIcon className="h-5 w-5" />
                              </span>
                              <span className="text-[10px] font-medium text-white/55">{t('modal.dashboard.menu.receive')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyAddress}
                              className="flex flex-col items-center gap-1.5"
                              aria-label={t('modal.aria.copyAddress')}
                            >
                              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.1]">
                                <ClipboardDocumentIcon className="h-5 w-5" />
                              </span>
                              <span className="text-[10px] font-medium text-white/55">Copy</span>
                            </button>
                            <Menu as="div" className="relative flex flex-col items-center gap-1.5">
                              <Menu.Button
                                type="button"
                                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.1]"
                                aria-label={t('modal.aria.moreActions')}
                              >
                                <EllipsisHorizontalIcon className="h-5 w-5" />
                              </Menu.Button>
                              <span className="text-[10px] font-medium text-white/55" aria-hidden>
                                More
                              </span>
                              <WalletMenuItems
                                theme={isDark ? 'dark' : 'light'}
                                anchor="bottom end"
                                className="w-52 max-w-[min(18rem,calc(100vw-2rem))]"
                              >
                                {[
                                  { key: 'send', label: t('modal.dashboard.menu.send'), Icon: PaperAirplaneIcon, action: () => { setSendPrefillAddress(null); setStep('send'); } },
                                  { key: 'receive', label: t('modal.dashboard.menu.receive'), Icon: QrCodeIcon, action: () => setStep('receive') },
                                  { key: 'setName', label: t('modal.dashboard.menu.setName'), Icon: TagIcon, action: () => setStep('set_name') },
                                  ...(isBrowserWallet
                                    ? ([
                                        {
                                          key: 'backupZip',
                                          label: t('modal.dashboard.menu.backupZip'),
                                          Icon: WalletIcon,
                                          action: () => void handleBackupZip(),
                                        },
                                        {
                                          key: 'showSecrets',
                                          label: t('modal.dashboard.menu.showSecrets'),
                                          Icon: EyeIcon,
                                          action: () => void handleBackupNow(),
                                        },
                                        {
                                          key: 'setPassword',
                                          label: t('modal.dashboard.menu.setPassword'),
                                          Icon: KeyIcon,
                                          action: () => setStep('password'),
                                        },
                                        {
                                          key: 'lock',
                                          label: isEncryptedWallet ? 'Lock wallet' : 'Set password and lock',
                                          Icon: LockClosedIcon,
                                          action: () => void handleLockWallet(),
                                        },
                                      ] as const)
                                    : []),
                                  { key: 'xVerify', label: t('modal.dashboard.menu.xVerify'), Icon: CheckBadgeIcon, action: () => setStep('verification') },
                                  { key: 'utxos', label: 'Coins & UTXOs', Icon: CircleStackIcon, action: () => setStep('utxos') },
                                  { key: 'settings', label: t('modal.dashboard.menu.settings'), Icon: Cog6ToothIcon, action: openSettings },
                                  { key: 'disconnect', label: t('modal.dashboard.menu.disconnect'), Icon: PowerIcon, action: handleDisconnectWallet },
                                ].map(({ key, label, Icon, action }) => (
                                  <Menu.Item key={key}>
                                    {({ focus, active }) => (
                                      <button
                                        type="button"
                                        onClick={action}
                                        className={cx(
                                          'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-white transition',
                                          'hover:bg-zinc-800 focus:bg-zinc-800 focus:outline-none',
                                          (focus || active) && 'bg-zinc-800',
                                        )}
                                      >
                                        <Icon className="h-5 w-5 shrink-0 text-white/90" aria-hidden />
                                        <span className="leading-tight">{label}</span>
                                      </button>
                                    )}
                                  </Menu.Item>
                                ))}
                                <Menu.Item>
                                  {({ focus, active }) => (
                                    <button
                                      type="button"
                                      onClick={() => setStep('remove')}
                                      className={cx(
                                        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-300 transition',
                                        'hover:bg-red-500/15 focus:bg-red-500/15 focus:outline-none',
                                        (focus || active) && 'bg-red-500/20',
                                      )}
                                    >
                                      <TrashIcon className="h-5 w-5 shrink-0 text-red-300/90" aria-hidden />
                                      <span className="leading-tight">{t('modal.dashboard.menu.remove')}</span>
                                    </button>
                                  )}
                                </Menu.Item>
                              </WalletMenuItems>
                            </Menu>
                          </div>
                        </div>

                        {isBrowserWallet && needsBackup ? (
                          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5">
                            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-zinc-100">{t('modal.backup.title')}</div>
                              <div className="mt-0.5 text-xs text-zinc-300">{t('modal.backup.subtitle')}</div>
                            </div>
                            <Button onClick={() => handleBackupNow()} className={cx(PRIMARY_BUTTON, 'shrink-0 !px-3 !py-2 text-xs')}>
                              {t('modal.backup.now')}
                            </Button>
                          </div>
                        ) : null}

                        <div>
                          <div className="flex gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
                            {(['assets', 'transactions', 'listings'] as DashboardTab[]).map((item) => (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setTab(item)}
                                className={cx(
                                  'flex-1 rounded-xl px-3 py-2 text-xs font-semibold capitalize tracking-wide transition',
                                  tab === item
                                    ? 'bg-[#FCD34D]/15 text-[#FCD34D] shadow-[inset_0_0_0_1px_rgba(252,211,77,0.35)]'
                                    : 'text-white/45 hover:bg-white/[0.04] hover:text-white/75'
                                )}
                              >
                                {item === 'assets' ? t('modal.tabs.assets') : item === 'transactions' ? t('modal.tabs.transactions') : t('modal.tabs.listings')}
                              </button>
                            ))}
                          </div>

                          <div className="mt-2 overflow-visible rounded-2xl border border-white/[0.08] bg-black/25">
                            {tab === 'assets' ? (
                              <div className="overflow-visible">
                                {/* NFT / DRC-20 sub-selector */}
                                <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
                                  <Listbox
                                    value={assetType}
                                    onChange={(v: 'nft' | 'drc20' | 'treats' | 'dunes' | 'charms' | 'alkanes') =>
                                      setAssetType(v)
                                    }
                                  >
                                    <div className="relative min-w-0">
                                      <ListboxButton
                                        aria-label={t('modal.aria.assetType')}
                                        className={cx(
                                          'inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-sm font-semibold outline-none transition',
                                          isDark
                                            ? 'border-white/10 bg-white/[0.06] text-white/90 hover:bg-white/[0.09] focus:border-[#FCD34D]/50'
                                            : 'border-black/10 bg-white text-zinc-900 hover:bg-zinc-50 focus:border-[#C9A84C]/70',
                                        )}
                                      >
                                        <span className="truncate">
                                          {assetType === 'nft'
                                            ? t('modal.assets.nftOption')
                                            : assetType === 'treats'
                                              ? t('modal.assets.treatsOption')
                                              : assetType === 'dunes'
                                                ? t('modal.assets.dunesOption')
                                                : assetType === 'charms'
                                                  ? t('modal.assets.charmsOption')
                                                  : assetType === 'alkanes'
                                                    ? t('modal.assets.alkanesOption')
                                                    : t('modal.assets.drc20Option')}
                                        </span>
                                        <ChevronDownIcon
                                          className={cx(
                                            'h-4 w-4 shrink-0',
                                            isDark ? 'text-white/45' : 'text-zinc-500',
                                          )}
                                          aria-hidden
                                        />
                                      </ListboxButton>
                                      <ListboxOptions
                                        portal
                                        anchor={{ to: 'bottom start', gap: 6, padding: 16 }}
                                        className={cx(
                                          // Must clear phone chassis / Dialog (z≈10050) or options look dead (no hover/click).
                                          'z-[10140] mt-1 max-h-60 w-[min(16rem,calc(100vw-3rem))] overflow-auto rounded-xl border py-1 shadow-2xl outline-none pointer-events-auto',
                                          isDark
                                            ? 'border-white/10 bg-zinc-900 text-white'
                                            : 'border-black/10 bg-white text-zinc-900',
                                        )}
                                      >
                                        {(
                                          [
                                            { id: 'nft' as const, label: t('modal.assets.nftOption') },
                                            { id: 'dunes' as const, label: t('modal.assets.dunesOption') },
                                            { id: 'treats' as const, label: t('modal.assets.treatsOption') },
                                            { id: 'drc20' as const, label: t('modal.assets.drc20Option') },
                                            { id: 'charms' as const, label: t('modal.assets.charmsOption') },
                                            { id: 'alkanes' as const, label: t('modal.assets.alkanesOption') },
                                          ] as const
                                        ).map((opt) => (
                                          <ListboxOption
                                            key={opt.id}
                                            value={opt.id}
                                            className={({ focus, selected }) =>
                                              cx(
                                                'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm outline-none transition-colors',
                                                focus && (isDark ? 'bg-white/10' : 'bg-zinc-100'),
                                                !focus && (isDark ? 'hover:bg-white/10' : 'hover:bg-zinc-100'),
                                                selected && (isDark ? 'text-[#FCD34D]' : 'text-amber-700'),
                                              )
                                            }
                                          >
                                            {({ selected }) => (
                                              <>
                                                <span className={cx('flex-1 truncate', selected && 'font-semibold')}>
                                                  {opt.label}
                                                </span>
                                                {selected ? (
                                                  <CheckIcon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                                                ) : (
                                                  <span className="h-4 w-4 shrink-0" aria-hidden />
                                                )}
                                              </>
                                            )}
                                          </ListboxOption>
                                        ))}
                                      </ListboxOptions>
                                    </div>
                                  </Listbox>
                                  <button
                                    type="button"
                                    onClick={() => activeAddress && fetchAssets(activeAddress)}
                                    className={cx(
                                      'rounded-lg p-1.5 transition',
                                      isDark
                                        ? 'text-white/50 hover:bg-white/5 hover:text-white'
                                        : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-800',
                                    )}
                                    aria-label={t('modal.aria.refreshAssets')}
                                  >
                                    <ArrowPathIcon className={cx('h-4 w-4', assetsLoading && 'animate-spin')} />
                                  </button>
                                </div>

                                {assetsError ? (
                                  <div className="px-4 py-6 text-center text-sm text-red-300">{assetsError}</div>
                                ) : assetsLoading ? (
                                  <div className="px-4 py-8 text-center text-sm text-white/50">{t('modal.assets.loading')}</div>
                                ) : assetType === 'treats' ? (
                                  treatsTokens.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                      <TagIcon className="h-8 w-8 text-white/30" />
                                      <div className="text-sm font-semibold text-white">{t('modal.assets.noTreatsTitle')}</div>
                                      <div className="text-xs text-white/45">{t('modal.assets.noTreatsHint')}</div>
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-white/5 px-1 py-1">
                                      {treatsTokens.map((token) => (
                                        <div key={token.tick} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-white/5">
                                          <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold uppercase text-amber-300">
                                              {token.tick.slice(0, 2)}
                                            </div>
                                            <span className="text-sm font-semibold uppercase text-white">{token.tick}</span>
                                          </div>
                                          <div className="text-sm font-semibold tabular-nums text-white">
                                            {Number(token.balance).toLocaleString()}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                ) : assetType === 'dunes' ? (
                                  dunesHoldings.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                      <CircleStackIcon className="h-8 w-8 text-white/30" />
                                      <div className="text-sm font-semibold text-white">{t('modal.assets.noDunesTitle')}</div>
                                      <div className="text-xs text-white/45">{t('modal.assets.noDunesHint')}</div>
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-white/5 px-1 py-1">
                                      {dunesHoldings.map((holding) => {
                                        const label = holding.dune || holding.ticker || 'Ðune';
                                        const bal = holding.balance || holding.amount || '0';
                                        return (
                                          <div
                                            key={`${label}-${bal}`}
                                            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition hover:bg-white/5"
                                          >
                                            <div className="flex min-w-0 items-center gap-2">
                                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FCD34D]/20 text-[10px] font-bold text-[#FCD34D]">
                                                ÐU
                                              </div>
                                              <div className="min-w-0">
                                                <div className="truncate font-mono text-sm font-semibold text-white">
                                                  {label}
                                                </div>
                                                {holding.symbol ? (
                                                  <div className="text-[10px] text-white/45">{holding.symbol}</div>
                                                ) : null}
                                              </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                              <div className="text-sm font-semibold tabular-nums text-white">
                                                {Number(bal).toLocaleString()}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setDuneSendHolding(holding);
                                                  setDuneSendOpen(true);
                                                }}
                                                className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-[#FCD34D] hover:bg-white/5"
                                              >
                                                {t('modal.assets.send')}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )
                                ) : assetType === 'charms' ? (
                                  charmsAssets.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                      <SparklesIcon className="h-8 w-8 text-white/30" />
                                      <div className="text-sm font-semibold text-white">{t('modal.assets.noCharmsTitle')}</div>
                                      <div className="text-xs text-white/45">{t('modal.assets.noCharmsHint')}</div>
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-white/5 px-1 py-1">
                                      {charmsAssets.map((c) => (
                                        <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-white/5">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-white">{c.ticker}</div>
                                            <div className="truncate font-mono text-[10px] text-white/40">{c.id}</div>
                                          </div>
                                          <div className="text-sm font-semibold tabular-nums text-white">{c.balance}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                ) : assetType === 'alkanes' ? (
                                  alkanesAssets.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                      <CpuChipIcon className="h-8 w-8 text-white/30" />
                                      <div className="text-sm font-semibold text-white">{t('modal.assets.noAlkanesTitle')}</div>
                                      <div className="text-xs text-white/45">{t('modal.assets.noAlkanesHint')}</div>
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-white/5 px-1 py-1">
                                      {alkanesAssets.map((a) => (
                                        <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-white/5">
                                          <div className="min-w-0">
                                            <div className="font-mono text-sm font-semibold text-cyan-200">{a.id}</div>
                                            <div className="truncate font-mono text-[10px] text-white/40">
                                              {a.code_len} B · {a.code_hash.slice(0, 16)}…
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                ) : assetType === 'nft' ? (
                                  gridInscriptions.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                      <WalletIcon className="h-8 w-8 text-white/30" />
                                      <div className="text-sm font-semibold text-white">
                                        {nftFilter === 'dlotto'
                                          ? t('modal.assets.noDlottoTitle')
                                          : t('modal.assets.noDoginalsTitle')}
                                      </div>
                                      <div className="text-xs text-white/45">
                                        {nftFilter === 'dlotto'
                                          ? t('modal.assets.noDlottoHint')
                                          : hideTextJsonInscriptions && textJsonInscriptionCount > 0
                                            ? t('modal.assets.noDoginalsHiddenTextHint', {
                                                count: String(textJsonInscriptionCount),
                                              })
                                            : t('modal.assets.noDoginalsHint')}
                                      </div>
                                      {nftFilter !== 'dlotto' &&
                                      hideTextJsonInscriptions &&
                                      textJsonInscriptionCount > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setHideTextJsonInscriptions(false);
                                            setSettingsHideTextJson(false);
                                            const dp = getWalletDataProviderConfig();
                                            setWalletDataProviderConfig({
                                              walletDataProvider: dp.walletDataProvider,
                                              hideTextJsonInscriptions: false,
                                            });
                                          }}
                                          className="mt-1 text-xs font-semibold text-[#FCD34D] underline"
                                        >
                                          {t('modal.assets.showTextJson')}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="space-y-2 p-4 pt-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                                        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                                          {(
                                            [
                                              { id: 'all' as const, label: t('modal.assets.filterAll') },
                                              { id: 'media' as const, label: t('modal.assets.filterMedia') },
                                              { id: 'dlotto' as const, label: t('modal.assets.filterDlotto') },
                                            ] as const
                                          ).map((opt) => (
                                            <button
                                              key={opt.id}
                                              type="button"
                                              onClick={() => {
                                                setNftFilter(opt.id);
                                                if (opt.id === 'dlotto') {
                                                  setHideTextJsonInscriptions(false);
                                                  setSettingsHideTextJson(false);
                                                  const dp = getWalletDataProviderConfig();
                                                  setWalletDataProviderConfig({
                                                    walletDataProvider: dp.walletDataProvider,
                                                    hideTextJsonInscriptions: false,
                                                  });
                                                }
                                              }}
                                              className={[
                                                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                                                nftFilter === opt.id
                                                  ? 'bg-[#D4A017]/25 text-[#FCD34D]'
                                                  : 'text-white/55 hover:text-white',
                                              ].join(' ')}
                                            >
                                              {opt.label}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                        {nftFilter === 'all' && textJsonInscriptionCount > 0 ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const next = !hideTextJsonInscriptions;
                                              setHideTextJsonInscriptions(next);
                                              setSettingsHideTextJson(next);
                                              const dp = getWalletDataProviderConfig();
                                              setWalletDataProviderConfig({
                                                walletDataProvider: dp.walletDataProvider,
                                                hideTextJsonInscriptions: next,
                                              });
                                            }}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70 transition hover:border-white/20 hover:text-white"
                                          >
                                            {hideTextJsonInscriptions ? (
                                              <EyeIcon className="h-3.5 w-3.5" aria-hidden />
                                            ) : (
                                              <EyeSlashIcon className="h-3.5 w-3.5" aria-hidden />
                                            )}
                                            {hideTextJsonInscriptions
                                              ? t('modal.assets.showTextJson')
                                              : t('modal.assets.hideTextJson')}
                                            <span className="tabular-nums text-white/40">
                                              ({textJsonInscriptionCount})
                                            </span>
                                          </button>
                                        ) : null}
                                        {hiddenInscriptionIds.size > 0 ? (
                                          <button
                                            type="button"
                                            onClick={() => setShowHiddenInscriptions((v) => !v)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70 transition hover:border-white/20 hover:text-white"
                                          >
                                            {showHiddenInscriptions ? (
                                              <EyeSlashIcon className="h-3.5 w-3.5" aria-hidden />
                                            ) : (
                                              <EyeIcon className="h-3.5 w-3.5" aria-hidden />
                                            )}
                                            {showHiddenInscriptions
                                              ? t('modal.assets.hideHiddenAgain') || 'Hide hidden'
                                              : t('modal.assets.showHidden') || 'Show hidden'}
                                            <span className="tabular-nums text-white/40">
                                              ({hiddenInscriptionIds.size})
                                            </span>
                                          </button>
                                        ) : null}
                                        {nftFilter === 'dlotto' && dlottoClassifying ? (
                                          <span className="text-[11px] text-white/45">
                                            {t('modal.assets.filterDlottoLoading')}
                                          </span>
                                        ) : null}
                                        </div>
                                      </div>
                                    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                                      {gridInscriptions.map((item) => (
                                        <div
                                          key={item.inscriptionId}
                                          className="group relative overflow-visible rounded-xl border border-white/10 bg-zinc-900 shadow-sm transition hover:border-[#D4A017]/55 hover:shadow-md hover:shadow-[#D4A017]/10"
                                        >
                                          {/* image — overflow-hidden scoped to media only */}
                                          <div className="overflow-hidden rounded-t-[0.65rem]">
                                            {item.contentType?.startsWith('image/') ? (
                                              <img
                                                src={item.content}
                                                alt={`#${item.inscriptionNumber}`}
                                                className="aspect-square w-full object-cover"
                                                loading="lazy"
                                              />
                                            ) : isWasmInscription(item.contentType) ? (
                                              <WasmInscriptionCardMedia
                                                item={item}
                                                onInspect={() => setTextInspectItem(item)}
                                              />
                                            ) : isTextishInscription(item.contentType) ? (
                                              <TextInscriptionCardMedia
                                                item={item}
                                                onInspect={() => setTextInspectItem(item)}
                                              />
                                            ) : (
                                              <div className="flex aspect-square w-full items-center justify-center bg-gray-800 text-xs text-white/40">
                                                {item.contentType ?? t('modal.assets.unknownType')}
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-center justify-between gap-1 border-t border-white/5 bg-zinc-950 px-2.5 py-2">
                                            <div className="min-w-0 truncate text-xs font-semibold tabular-nums text-white/90">
                                              #{item.inscriptionNumber}
                                            </div>
                                            {/* ··· more menu per inscription */}
                                            <Menu as="div" className="relative shrink-0">
                                              <Menu.Button
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#D4A017]/70"
                                                aria-label={t('modal.aria.moreActions')}
                                                title={t('modal.aria.moreActions')}
                                              >
                                                <EllipsisHorizontalIcon className="h-4 w-4" />
                                              </Menu.Button>
                                              <WalletMenuItems theme={isDark ? 'dark' : 'light'} anchor="bottom end" className="min-w-[12rem]">
                                                  {isTextishInscription(item.contentType) ? (
                                                    <Menu.Item>
                                                      {({ focus, active }) => (
                                                        <button
                                                          type="button"
                                                          onClick={() => setTextInspectItem(item)}
                                                          className={cx(
                                                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                            (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                                          )}
                                                        >
                                                          <DocumentTextIcon className="h-4 w-4 shrink-0 text-sky-200/90" aria-hidden />
                                                          <span className="leading-tight">{t('modal.assets.inspectText')}</span>
                                                        </button>
                                                      )}
                                                    </Menu.Item>
                                                  ) : null}
                                                  {item.contentType?.startsWith('image/') ? (
                                                    <>
                                                      <Menu.Item>
                                                        {({ focus, active }) => (
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const u = inscriptionMediaUrlForProfile(item);
                                                              setDogePFP(item.inscriptionId, u ? { contentUrl: u } : undefined);
                                                              toast.success(t('modal.toast.dpfpSet'));
                                                            }}
                                                            className={cx(
                                                              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                              (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                                            )}
                                                          >
                                                            <PhotoIcon className="h-4 w-4 shrink-0 text-yellow-200/90" aria-hidden />
                                                            <span className="leading-tight">{t('modal.assets.setAsDpfp')}</span>
                                                          </button>
                                                        )}
                                                      </Menu.Item>
                                                      <Menu.Item>
                                                        {({ focus, active }) => (
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const u = inscriptionMediaUrlForProfile(item);
                                                              setDogePFP(item.inscriptionId, u ? { contentUrl: u } : undefined);
                                                              void publishProfileBind('pfp', item.inscriptionId);
                                                            }}
                                                            className={cx(
                                                              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                              (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                                            )}
                                                          >
                                                            <PhotoIcon className="h-4 w-4 shrink-0 text-emerald-200/90" aria-hidden />
                                                            <span className="leading-tight">
                                                              {t('modal.assets.publishDpfp') || 'Publish ÐPFP on-chain'}
                                                            </span>
                                                          </button>
                                                        )}
                                                      </Menu.Item>
                                                    </>
                                                  ) : null}
                                                  {item.contentType?.startsWith('audio/') ? (
                                                    <>
                                                      <Menu.Item>
                                                        {({ focus, active }) => (
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const u = inscriptionMediaUrlForProfile(item);
                                                              if (!u) {
                                                                toast.error(t('modal.toast.dpfaNoUrl'));
                                                                return;
                                                              }
                                                              setDogePFA(item.inscriptionId, { contentUrl: u });
                                                              toast.success(t('modal.toast.dpfaSet'));
                                                            }}
                                                            className={cx(
                                                              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                              (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                                            )}
                                                          >
                                                            <MusicalNoteIcon className="h-4 w-4 shrink-0 text-amber-200/90" aria-hidden />
                                                            <span className="leading-tight">{t('modal.assets.setAsDpfa')}</span>
                                                          </button>
                                                        )}
                                                      </Menu.Item>
                                                      <Menu.Item>
                                                        {({ focus, active }) => (
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const u = inscriptionMediaUrlForProfile(item);
                                                              if (!u) {
                                                                toast.error(t('modal.toast.dpfaNoUrl'));
                                                                return;
                                                              }
                                                              setDogePFA(item.inscriptionId, { contentUrl: u });
                                                              void publishProfileBind('pfa', item.inscriptionId);
                                                            }}
                                                            className={cx(
                                                              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                              (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                                            )}
                                                          >
                                                            <MusicalNoteIcon className="h-4 w-4 shrink-0 text-emerald-200/90" aria-hidden />
                                                            <span className="leading-tight">
                                                              {t('modal.assets.publishDpfa') || 'Publish ÐPFA on-chain'}
                                                            </span>
                                                          </button>
                                                        )}
                                                      </Menu.Item>
                                                    </>
                                                  ) : null}
                                                  <Menu.Item>
                                                    {({ focus, active }) => (
                                                      <button
                                                        type="button"
                                                        onClick={() => openSendInscription(item)}
                                                        className={cx(
                                                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                          (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                                        )}
                                                      >
                                                        <PaperAirplaneIcon className="h-4 w-4 shrink-0 text-white/90" aria-hidden />
                                                        <span className="leading-tight">{t('modal.assets.send')}</span>
                                                      </button>
                                                    )}
                                                  </Menu.Item>
                                                  <Menu.Item>
                                                    {({ focus, active }) => (
                                                      <button
                                                        type="button"
                                                        onClick={() => openListInscription(item)}
                                                        className={cx(
                                                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                          (focus || active) ? 'bg-yellow-500/20' : 'hover:bg-yellow-500/10',
                                                        )}
                                                      >
                                                        <TagIcon className="h-4 w-4 shrink-0 text-yellow-200/90" aria-hidden />
                                                        <span className="leading-tight">{t('modal.assets.listForSale')}</span>
                                                      </button>
                                                    )}
                                                  </Menu.Item>
                                                  {activeAddress ? (
                                                    <Menu.Item>
                                                      {({ focus, active }) => {
                                                        const id = item.inscriptionId || '';
                                                        const isHidden = hiddenInscriptionIds.has(id);
                                                        return (
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              if (!activeAddress || !id) return;
                                                              const next = isHidden
                                                                ? unhideInscription(activeAddress, id)
                                                                : hideInscription(activeAddress, id);
                                                              setHiddenInscriptionIds(new Set(next));
                                                              toast.success(
                                                                isHidden
                                                                  ? (t('modal.toast.inscriptionUnhidden') || 'Inscription unhidden')
                                                                  : (t('modal.toast.inscriptionHidden') || 'Inscription hidden (this device)'),
                                                              );
                                                            }}
                                                            className={cx(
                                                              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                              (focus || active) ? 'bg-zinc-800' : 'hover:bg-zinc-800',
                                                            )}
                                                          >
                                                            {isHidden ? (
                                                              <EyeIcon className="h-4 w-4 shrink-0 text-sky-200/90" aria-hidden />
                                                            ) : (
                                                              <EyeSlashIcon className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                                                            )}
                                                            <span className="leading-tight">
                                                              {isHidden
                                                                ? (t('modal.assets.unhide') || 'Unhide')
                                                                : (t('modal.assets.hide') || 'Hide')}
                                                            </span>
                                                          </button>
                                                        );
                                                      }}
                                                    </Menu.Item>
                                                  ) : null}
                                              </WalletMenuItems>
                                            </Menu>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    </div>
                                  )
                                ) : (
                                  drc20Tokens.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                      <TagIcon className="h-8 w-8 text-white/30" />
                                      <div className="text-sm font-semibold text-white">{t('modal.assets.noDrc20Title')}</div>
                                      <div className="text-xs text-white/45">{t('modal.assets.noDrc20Hint')}</div>
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-white/5 px-1 py-1">
                                      {drc20Tokens.map((token) => (
                                        <div key={token.ticker} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-white/5">
                                          <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20 text-xs font-bold uppercase text-yellow-400">
                                              {token.ticker.slice(0, 2)}
                                            </div>
                                            <span className="text-sm font-semibold uppercase text-white">{token.ticker}</span>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-sm font-semibold text-white">
                                              {Number(token.balance).toLocaleString()}
                                            </div>
                                            {token.transferable !== token.balance && (
                                              <div className="text-xs text-white/45">
                                                {t('modal.assets.transferable', { n: Number(token.transferable).toLocaleString() })}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : tab === 'transactions' ? (
                              /* ── Transactions tab ── */
                              <div>
                                {/* Detail overlay */}
                                {selectedTx &&
                                  typeof document !== 'undefined' &&
                                  createPortal(
                                  <div
                                    className="fixed inset-0 z-[10060] flex items-center justify-center p-4"
                                    onClick={() => setSelectedTx(null)}
                                  >
                                    <div className={cx('absolute inset-0', isDark ? 'bg-black/70' : 'bg-zinc-900/40')} />
                                    <div
                                      className={cx(
                                        'relative w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center',
                                        isDark
                                          ? 'bg-zinc-950 text-white border-2 border-white/35 ring-1 ring-white/20'
                                          : 'bg-white text-zinc-900 border border-zinc-200 shadow-xl',
                                      )}
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setSelectedTx(null)}
                                        className={cx(
                                          'absolute right-4 top-4 transition',
                                          isDark ? 'text-white/40 hover:text-white' : 'text-zinc-400 hover:text-zinc-700',
                                        )}
                                        aria-label="Close transaction details"
                                      >
                                        <XMarkIcon className="h-5 w-5" />
                                      </button>
                                      <div className={cx(
                                        'mb-3 text-xs font-bold uppercase tracking-widest',
                                        isDark ? 'text-white/40' : 'text-zinc-400',
                                      )}>
                                        {selectedTx.title
                                          || (selectedTx.type === 'sent' ? t('modal.tx.to') : t('modal.tx.from'))}
                                      </div>
                                      {(selectedTx.protocolLabel || selectedTx.originLabel || selectedTx.actionLabel) && (
                                        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                                          {selectedTx.protocolLabel && (
                                            <span className={cx(
                                              'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                              isDark ? 'bg-amber-400/15 text-amber-200' : 'bg-amber-100 text-amber-800',
                                            )}>
                                              {selectedTx.protocolLabel}
                                            </span>
                                          )}
                                          {selectedTx.actionLabel && (
                                            <span className={cx(
                                              'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                              selectedTx.actionLabel === 'Payout' || selectedTx.actionLabel === 'Win'
                                                ? (isDark ? 'bg-green-400/15 text-green-200' : 'bg-green-100 text-green-800')
                                                : (isDark ? 'bg-fuchsia-400/15 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-800'),
                                            )}>
                                              {selectedTx.actionLabel}
                                            </span>
                                          )}
                                          {selectedTx.originLabel && (
                                            <span className={cx(
                                              'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                              isDark ? 'bg-sky-400/15 text-sky-200' : 'bg-sky-100 text-sky-800',
                                            )}>
                                              {selectedTx.originLabel}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      <div className="mb-3">
                                        <span className={cx(
                                          'rounded-full px-3 py-1 text-xs font-semibold inline-block',
                                          selectedTx.pending
                                            ? (isDark ? 'bg-yellow-400/20 text-yellow-200' : 'bg-yellow-100 text-yellow-700')
                                            : selectedTx.confirmations > 0 || selectedTx.journal?.status === 'indexed'
                                              ? (isDark ? 'bg-emerald-400/15 text-emerald-200' : 'bg-emerald-100 text-emerald-800')
                                              : (isDark ? 'bg-white/10 text-white/70' : 'bg-zinc-100 text-zinc-600'),
                                        )}>
                                          {selectedTx.pending
                                            ? 'Mempool'
                                            : selectedTx.journal?.status === 'indexed'
                                              ? 'Indexed'
                                              : selectedTx.confirmations > 0
                                                ? `Confirmed · ${selectedTx.confirmations}`
                                                : 'Seen'}
                                        </span>
                                      </div>
                                      {selectedTx.summary && (
                                        <div className={cx(
                                          'mb-3 text-xs leading-relaxed',
                                          isDark ? 'text-white/55' : 'text-zinc-500',
                                        )}>
                                          {selectedTx.summary}
                                        </div>
                                      )}
                                      <div className="mb-1 flex items-center justify-center gap-2">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-white">
                                          {(selectedTx.address || selectedTx.protocolLabel || 'TX').slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className={cx(
                                          'font-mono text-sm font-semibold truncate max-w-[200px]',
                                          isDark ? 'text-white' : 'text-zinc-800',
                                        )}>
                                          {selectedTx.address
                                            ? `${selectedTx.address.slice(0, 10)}…${selectedTx.address.slice(-4)}`
                                            : selectedTx.localOnly
                                              ? 'Local journal'
                                              : '—'}
                                        </span>
                                        {selectedTx.address && (
                                          <button
                                            type="button"
                                            className={cx(
                                              'transition',
                                              isDark ? 'text-white/40 hover:text-white' : 'text-zinc-400 hover:text-zinc-600',
                                            )}
                                            onClick={() => { void navigator.clipboard.writeText(selectedTx.address); }}
                                            title="Copy address"
                                          >
                                            <ClipboardDocumentIcon className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                      <div className={cx(
                                        'my-4 text-4xl font-bold',
                                        isDark ? 'text-white' : 'text-zinc-900',
                                      )}>
                                        Ð{selectedTx.amount % 1 === 0 ? selectedTx.amount.toLocaleString() : selectedTx.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                      </div>
                                      <div className={cx(
                                        'mt-2 divide-y rounded-xl border text-left text-sm',
                                        isDark ? 'divide-white/10 border-white/10' : 'divide-zinc-100 border-zinc-200',
                                      )}>
                                        <div className="flex items-center justify-between gap-3 px-4 py-2">
                                          <span className={isDark ? 'text-white/45' : 'text-zinc-500'}>TXID</span>
                                          <div className="flex min-w-0 items-center gap-2">
                                            <span className={cx(
                                              'font-mono text-[11px] font-semibold truncate max-w-[11rem]',
                                              isDark ? 'text-white' : 'text-zinc-800',
                                            )}>
                                              {selectedTx.txid
                                                ? `${selectedTx.txid.slice(0, 10)}…${selectedTx.txid.slice(-8)}`
                                                : '—'}
                                            </span>
                                            {selectedTx.txid && (
                                              <button
                                                type="button"
                                                className={cx(
                                                  'shrink-0 transition',
                                                  isDark ? 'text-white/40 hover:text-white' : 'text-zinc-400 hover:text-zinc-600',
                                                )}
                                                onClick={() => { void navigator.clipboard.writeText(selectedTx.txid); }}
                                                title="Copy txid"
                                              >
                                                <ClipboardDocumentIcon className="h-4 w-4" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between px-4 py-2">
                                          <span className={isDark ? 'text-white/45' : 'text-zinc-500'}>{t('modal.tx.confirmations')}</span>
                                          <span className={cx('font-semibold', isDark ? 'text-white' : 'text-zinc-800')}>
                                            {selectedTx.confirmations}
                                          </span>
                                        </div>
                                        {selectedTx.timestamp && (
                                          <div className="flex items-center justify-between px-4 py-2">
                                            <span className={isDark ? 'text-white/45' : 'text-zinc-500'}>{t('modal.tx.timestamp')}</span>
                                            <span className={cx('font-semibold', isDark ? 'text-white' : 'text-zinc-800')}>
                                              {selectedTx.timestamp}
                                            </span>
                                          </div>
                                        )}
                                        {selectedTx.journal?.status && (
                                          <div className="flex items-center justify-between px-4 py-2">
                                            <span className={isDark ? 'text-white/45' : 'text-zinc-500'}>Journal</span>
                                            <span className={cx('font-semibold capitalize', isDark ? 'text-white' : 'text-zinc-800')}>
                                              {selectedTx.journal.status}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      {selectedTx.txid && (
                                        <a
                                          href={dogeTxExplorerUrl(selectedTx.txid, txExplorerPref)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={cx(
                                            'mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition',
                                            isDark
                                              ? 'bg-white text-zinc-900 hover:bg-zinc-100'
                                              : 'bg-zinc-800 text-white hover:bg-zinc-700',
                                          )}
                                        >
                                          {t('modal.tx.viewOnExplorer', {
                                            name: dogeTxExplorerDisplayName(txExplorerPref),
                                          })}
                                          <ArrowDownTrayIcon className="h-4 w-4 rotate-[-90deg]" />
                                        </a>
                                      )}
                                    </div>
                                  </div>,
                                  document.body,
                                )}

                                {/* List */}
                                {txError ? (
                                  <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                                    <div className={cx('text-sm', isDark ? 'text-red-300' : 'text-red-600')}>{txError}</div>
                                    <button
                                      type="button"
                                      onClick={() => activeAddress && void fetchTransactions(activeAddress, 1)}
                                      className={cx('text-xs underline', isDark ? 'text-yellow-400' : 'text-amber-700')}
                                    >
                                      {t('modal.tx.retry')}
                                    </button>
                                  </div>
                                ) : txLoading && mergedTransactions.length === 0 ? (
                                  <div className={cx('px-4 py-8 text-center text-sm', isDark ? 'text-white/50' : 'text-zinc-500')}>
                                    {t('modal.tx.loading')}
                                  </div>
                                ) : mergedTransactions.length === 0 ? (
                                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                    <ArrowPathIcon className={cx('h-8 w-8', isDark ? 'text-white/30' : 'text-zinc-300')} />
                                    <div className={cx('text-sm font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                                      {t('modal.tx.emptyTitle')}
                                    </div>
                                    <div className={cx('text-xs', isDark ? 'text-white/45' : 'text-zinc-500')}>
                                      {t('modal.tx.emptyHint')}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className={cx('divide-y', isDark ? 'divide-zinc-800' : 'divide-zinc-200')}>
                                      {mergedTransactions.map((tx, i) => {
                                        const timeAgo = (() => {
                                          if (!tx.timestamp) return '';
                                          const d = new Date(tx.timestamp.includes('T') ? tx.timestamp : tx.timestamp.replace(' ', 'T') + 'Z');
                                          const diffMs = Date.now() - d.getTime();
                                          const mins = Math.floor(diffMs / 60000);
                                          const hrs = Math.floor(mins / 60);
                                          const days = Math.floor(hrs / 24);
                                          const weeks = Math.floor(days / 7);
                                          if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
                                          if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
                                          if (hrs > 0) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
                                          if (mins > 0) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
                                          return 'just now';
                                        })();
                                        const primary =
                                          tx.title ||
                                          (tx.address
                                            ? `${tx.address.slice(0, 10)}…${tx.address.slice(-4)}`
                                            : tx.txid
                                              ? `${tx.txid.slice(0, 10)}…${tx.txid.slice(-6)}`
                                              : '—');
                                        const initials = (tx.protocolLabel || tx.address || 'TX').slice(0, 2).toUpperCase();
                                        return (
                                          <button
                                            key={`${tx.txid}-${i}`}
                                            type="button"
                                            onClick={() => setSelectedTx(tx)}
                                            className={cx(
                                              'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                                              isDark ? 'hover:bg-white/5' : 'hover:bg-zinc-100/80',
                                            )}
                                          >
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-white">
                                              {initials}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div className={cx(
                                                'truncate text-sm font-semibold',
                                                isDark ? 'text-white' : 'text-zinc-900',
                                              )}>
                                                {primary}
                                              </div>
                                              <div className={cx(
                                                'mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]',
                                                isDark ? 'text-white/40' : 'text-zinc-500',
                                              )}>
                                                {tx.protocolLabel && tx.protocol !== 'dogecoin' && (
                                                  <span className={cx(
                                                    'rounded-full px-1.5 py-0.5 font-semibold',
                                                    isDark ? 'bg-amber-400/15 text-amber-200' : 'bg-amber-100 text-amber-800',
                                                  )}>
                                                    {tx.protocolLabel}
                                                  </span>
                                                )}
                                                {tx.actionLabel && (
                                                  <span className={cx(
                                                    'rounded-full px-1.5 py-0.5 font-semibold',
                                                    tx.actionLabel === 'Payout' || tx.actionLabel === 'Win'
                                                      ? (isDark ? 'bg-green-400/15 text-green-200' : 'bg-green-100 text-green-800')
                                                      : (isDark ? 'bg-fuchsia-400/15 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-800'),
                                                  )}>
                                                    {tx.actionLabel}
                                                  </span>
                                                )}
                                                {tx.originLabel && (
                                                  <span className={cx(
                                                    'rounded-full px-1.5 py-0.5 font-semibold',
                                                    isDark ? 'bg-sky-400/15 text-sky-200' : 'bg-sky-50 text-sky-800',
                                                  )}>
                                                    {tx.originLabel}
                                                  </span>
                                                )}
                                                <span className={cx(
                                                  'rounded-full px-1.5 py-0.5 font-semibold',
                                                  tx.pending
                                                    ? (isDark ? 'bg-yellow-400/15 text-yellow-200' : 'bg-yellow-100 text-yellow-700')
                                                    : (isDark ? 'bg-emerald-400/10 text-emerald-300/90' : 'bg-emerald-50 text-emerald-700'),
                                                )}>
                                                  {tx.pending ? 'Mempool' : tx.journal?.status === 'indexed' ? 'Indexed' : 'Confirmed'}
                                                </span>
                                                <span>{timeAgo}</span>
                                                {tx.localOnly && <span>· local</span>}
                                              </div>
                                              {tx.txid && (
                                                <div className={cx(
                                                  'mt-0.5 font-mono text-[10px] truncate',
                                                  isDark ? 'text-white/30' : 'text-zinc-400',
                                                )}>
                                                  {tx.txid.slice(0, 12)}…{tx.txid.slice(-8)}
                                                </div>
                                              )}
                                            </div>
                                            <div className={cx(
                                              'shrink-0 rounded-full px-3 py-1 text-sm font-semibold',
                                              tx.type === 'received'
                                                ? (isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700')
                                                : (isDark ? 'bg-zinc-700/60 text-zinc-300' : 'bg-zinc-100 text-zinc-700'),
                                            )}>
                                              {tx.type === 'received' ? '+' : '-'}{tx.amount % 1 === 0 ? tx.amount : tx.amount.toFixed(tx.amount < 0.01 ? 8 : 3)}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {transactions.length < txTotal && (
                                      <div className={cx('border-t px-4 py-3', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
                                        <button
                                          type="button"
                                          disabled={txLoading}
                                          onClick={() => {
                                            if (!activeAddress) return;
                                            const nextPage = txPage + 1;
                                            setTxPage(nextPage);
                                            void fetchTransactions(activeAddress, nextPage, true);
                                          }}
                                          className={cx(
                                            'w-full text-center text-xs disabled:opacity-50 transition',
                                            isDark ? 'text-yellow-400 hover:text-yellow-300' : 'text-amber-700 hover:text-amber-800',
                                          )}
                                        >
                                          {txLoading ? t('modal.tx.loading') : t('modal.tx.loadMore')}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                                <div className="divide-y divide-zinc-800 px-2 py-2">
                                {activeListings.length === 0 ? (
                                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                    <TagIcon className="h-8 w-8 text-white/30" />
                                    <div className="text-sm font-semibold text-white">{t('modal.listings.emptyTitle')}</div>
                                    <div className="text-xs text-white/45">
                                      {t('modal.listings.emptyHint')}
                                    </div>
                                  </div>
                                ) : (
                                  activeListings.map((listing) => {
                                    const listingStatus: ActiveListing['status'] =
                                      listing.status === 'active' || listing.status === 'sold' || listing.status === 'cancelled'
                                        ? listing.status
                                        : 'active';
                                    return (
                                    <div key={listing.inscriptionId} className="rounded-xl overflow-hidden">
                                      <div className="flex items-start gap-3 p-3 transition hover:bg-white/5">
                                        {listing.inscriptionPreview ? (
                                          <img
                                            src={listing.inscriptionPreview}
                                            alt={`#${listing.inscriptionNumber}`}
                                            className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-[10px] text-white/40">
                                            {listing.inscriptionContentType?.split('/')[1] ?? '?'}
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-white truncate">
                                              #{listing.inscriptionNumber}
                                            </span>
                                            <span className={cx(
                                              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                                              listingStatus === 'active' ? 'bg-green-500/20 text-green-300' :
                                              listingStatus === 'sold'   ? 'bg-yellow-500/20 text-yellow-300' :
                                              'bg-red-500/20 text-red-300'
                                            )}>
                                              {t(`modal.listings.status.${listingStatus}`)}
                                            </span>
                                            {typeof listing.nostrEventId === 'string' && listing.nostrEventId.length > 0 && (
                                              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                                                {t('modal.listings.nostrBadge')}
                                              </span>
                                            )}
                                          </div>
                                          <div className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-semibold text-[#FCD34D]">
                                            <span>{shibesToDoge(listing.priceKoinu).toFixed(2)}</span>
                                            <DogeCurrencyIcon size="xs" />
                                          </div>
                                          {listing.soldTxid && (
                                            <div className="mt-0.5 text-[10px] text-white/45 truncate">
                                              {t('modal.listings.soldTx', { txShort: listing.soldTxid.slice(0, 12) })}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex shrink-0 flex-col gap-1">
                                          {listing.shareUrl && listingStatus === 'active' && (
                                            <button
                                              type="button"
                                              onClick={() => setQrListingId(qrListingId === listing.inscriptionId ? null : listing.inscriptionId)}
                                              title={t('modal.aria.showListingQr')}
                                              className={cx(
                                                'flex h-7 w-7 items-center justify-center rounded-lg border transition',
                                                qrListingId === listing.inscriptionId
                                                  ? 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300'
                                                  : 'border-white/10 bg-gray-800 text-white/60 hover:text-white',
                                              )}
                                            >
                                              <QrCodeIcon className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                          {listing.shareUrl && listingStatus === 'active' && (
                                            <button
                                              type="button"
                                              onClick={() => handleCopyListingUrl(listing.shareUrl!)}
                                              title={t('modal.aria.copyShareLink')}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-gray-800 text-white/60 transition hover:text-white"
                                            >
                                              <ShareIcon className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                          {listingStatus === 'active' && (
                                            <button
                                              type="button"
                                              onClick={() => { setCancelConfirmId(listing.inscriptionId); setTrueCancelError(null); }}
                                              title={t('modal.aria.cancelListing')}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 transition hover:bg-red-500/20"
                                            >
                                              <TrashIcon className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      {/* Inline QR popup — encodes self-contained dogepsdt URI */}
                                      {qrListingId === listing.inscriptionId && listing.signedPsbtBase64 && (
                                        <div className="flex flex-col items-center gap-2 border-t border-white/10 bg-[#0A0A0A] px-4 py-3">
                                          <QRCodeSVG
                                            value={encodeBase64PsdtToDogePsdtUri(listing.signedPsbtBase64)}
                                            size={160}
                                            bgColor="#0A0A0A"
                                            fgColor="#FFFFFF"
                                            level="L"
                                          />
                                          <div className="text-[10px] text-white/40 text-center">
                                            Any Doginals wallet can scan this to sign the purchase — no server required
                                          </div>
                                          {listing.shareUrl && (
                                            <button
                                              type="button"
                                              onClick={() => handleCopyListingUrl(listing.shareUrl!)}
                                              className="text-[11px] text-white/60 underline hover:text-white"
                                            >
                                              {t('modal.listings.copyUrl')}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {/* Cancel confirmation panel */}
                                      {cancelConfirmId === listing.inscriptionId && (
                                        <div className="border-t border-red-500/20 bg-red-950/30 px-4 py-3 space-y-2">
                                          <div className="text-xs font-semibold text-red-300">{t('modal.listings.cancelTitle', { num: String(listing.inscriptionNumber) })}</div>
                                          <div className="text-[11px] text-white/50 leading-relaxed">
                                            <strong className="text-yellow-300">{t('modal.listings.cancelWarning')}</strong> {t('modal.listings.cancelBody')}
                                          </div>
                                          {trueCancelError && (
                                            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{trueCancelError}</div>
                                          )}
                                          <div className="flex gap-2 pt-1">
                                            {listing.nostrEventId && listing.nostrPrivateKey && (
                                              <button
                                                type="button"
                                                disabled={trueCancelBusy}
                                                onClick={() => handleNostrCancelListing(listing)}
                                                className="flex-1 rounded-lg bg-purple-500/20 px-3 py-1.5 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
                                              >
                                                {trueCancelBusy ? t('modal.listings.broadcasting') : t('modal.listings.nostrCancel')}
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              disabled={trueCancelBusy}
                                              onClick={() => handleTrueCancelListing(listing)}
                                              className="flex-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                                            >
                                              {trueCancelBusy ? t('modal.listings.broadcasting') : t('modal.listings.onChainCancel')}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={trueCancelBusy}
                                              onClick={() => handleCancelListingLocalOnly(listing.inscriptionId)}
                                              className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/50 hover:bg-white/10 disabled:opacity-50"
                                            >
                                              {t('modal.listings.localOnly')}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setCancelConfirmId(null)}
                                              className="rounded-lg bg-white/5 px-3 py-1.5 text-[11px] text-white/40 hover:bg-white/10"
                                            >
                                              {t('modal.listings.keep')}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Data provider indicator - bottom left, less flashy */}
                        <div className="mt-4 text-left">
                          <div className="inline-flex items-center gap-1 text-[10px] text-white/40">
                            <span>{t('modal.dataLabel.prefix')}</span>
                            <span className="font-medium">{getDataProviderInfo(t).label}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Send inscription ─────────────────────────────── */}
                    {step === 'send_inscription' && selectedInscription && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                          {selectedInscription.contentType?.startsWith('image/') ? (
                            <img
                              src={resolveInscriptionMediaUrl(selectedInscription)}
                              alt=""
                              className="h-14 w-14 rounded-lg object-cover"
                              onError={(e) => {
                                const fallback = selectedInscription.preview?.trim() || selectedInscription.content?.trim();
                                if (fallback && e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                  return;
                                }
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : isWasmInscription(selectedInscription.contentType) ? (
                            <button
                              type="button"
                              onClick={() => setTextInspectItem(selectedInscription)}
                              className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-400/25 bg-[#0a0f0c] text-[8px] font-bold uppercase tracking-wide text-emerald-200 transition hover:brightness-110"
                              title="Ðalkanes WASM"
                            >
                              <span className="font-mono text-sm leading-none" aria-hidden>
                                {'{ }'}
                              </span>
                              WASM
                            </button>
                          ) : isTextishInscription(selectedInscription.contentType) ? (
                            <button
                              type="button"
                              onClick={() => setTextInspectItem(selectedInscription)}
                              className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-950 text-[9px] font-bold uppercase tracking-wide text-sky-200/90 transition hover:brightness-110"
                            >
                              <DocumentTextIcon className="h-5 w-5" aria-hidden />
                              {t('modal.assets.inspectShort')}
                            </button>
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-800 text-xs text-white/40">
                              {selectedInscription.contentType?.split('/')[1] ?? '?'}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {t('modal.sendInscription.inscriptionHeading', { num: String(selectedInscription.inscriptionNumber) })}
                            </div>
                            <div className="text-xs text-white/50 font-mono truncate max-w-[200px]">
                              {selectedInscription.inscriptionId}
                            </div>
                          </div>
                        </div>

                        {inscriptionSendTxid ? (
                          <div className="space-y-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                            <div className="text-sm font-semibold text-green-300">{t('modal.sendInscription.sentTitle')}</div>
                            <div className="text-xs text-white/70 font-mono break-all">{inscriptionSendTxid}</div>
                            <a
                              href={`https://dogechain.info/tx/${inscriptionSendTxid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-yellow-400 underline"
                            >
                              {t('modal.sendInscription.viewExplorer')}
                            </a>
                          </div>
                        ) : inscriptionSendDraft ? (
                          <>
                            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-50/95">
                              <p className="font-semibold text-emerald-100">{t('modal.sendInscription.summaryTitle')}</p>
                              <p className="mt-2 text-xs text-emerald-50/90">{t('modal.sendInscription.summaryBodyShort')}</p>
                              <TechDetails
                                summary={t('modal.wallet.geekDetails')}
                                className="mt-2 text-emerald-50/85"
                                summaryClassName="text-emerald-100/90"
                                contentClassName="border-emerald-200/35 text-emerald-50/90"
                              >
                                <p>{t('modal.sendInscription.summaryBody')}</p>
                              </TechDetails>
                              <p className="mt-2 break-all font-mono text-[11px] text-white/80">
                                {t('modal.sendInscription.summaryRecipient')}{' '}
                                <span className="text-[#FCD34D]/90">{inscriptionSendRecipient.trim()}</span>
                              </p>
                              <p className="mt-1 text-xs text-white/70">
                                {t('modal.sendInscription.summaryFee', {
                                  fee: shibesToDoge(inscriptionSendDraft.feeShib).toLocaleString(undefined, {
                                    maximumFractionDigits: 8,
                                  }),
                                })}
                              </p>
                              {inscriptionSendDraft.outputs.some((o) => o.role === 'change') ? (
                                <p className="mt-1 text-xs text-white/60">
                                  {t('modal.sendInscription.summaryChange')}
                                </p>
                              ) : null}
                            </div>

                            <details className="group rounded-lg border border-white/10 bg-white/5">
                              <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-semibold text-white/80 hover:text-white">
                                <span>{t('modal.sendInscription.techDetails')}</span>
                                <span className="text-xs text-white/35 group-open:hidden">{t('modal.sendInscription.techShow')}</span>
                                <span className="hidden text-xs text-white/35 group-open:inline">{t('modal.sendInscription.techHide')}</span>
                              </summary>
                              <div className="space-y-3 border-t border-white/10 px-3 pb-3 pt-2.5 text-[11px] text-white/75">
                                <div>
                                  <div className="mb-1 font-semibold uppercase tracking-wide text-white/45">
                                    {t('modal.sendInscription.techInputs')}
                                  </div>
                                  <ul className="space-y-1.5 font-mono">
                                    {inscriptionSendDraft.inputs.map((row) => (
                                      <li key={row.outpoint} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                                        <span className="break-all text-white/70">{row.outpoint}</span>
                                        <span className="shrink-0 text-white/90">
                                          {shibesToDoge(row.valueShib).toLocaleString(undefined, { maximumFractionDigits: 8 })} DOGE
                                          <span className="ml-1 text-white/40">
                                            ({row.role === 'inscription' ? t('modal.sendInscription.roleInscription') : t('modal.sendInscription.roleFee')})
                                          </span>
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <div className="mb-1 font-semibold uppercase tracking-wide text-white/45">
                                    {t('modal.sendInscription.techOutputs')}
                                  </div>
                                  <ul className="space-y-1.5 font-mono">
                                    {inscriptionSendDraft.outputs.map((row, idx) => (
                                      <li key={`${row.address}-${idx}`} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                                        <span className="min-w-0 break-all text-white/70">{row.address}</span>
                                        <span className="shrink-0 text-white/90">
                                          {shibesToDoge(row.valueShib).toLocaleString(undefined, { maximumFractionDigits: 8 })} DOGE
                                          <span className="ml-1 text-white/40">
                                            (
                                            {row.role === 'change'
                                              ? t('modal.sendInscription.roleChange')
                                              : t('modal.sendInscription.roleToRecipient')}
                                            )
                                          </span>
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="border-t border-white/10 pt-2 font-mono text-white/80">
                                  {t('modal.sendInscription.techFee')}{' '}
                                  {shibesToDoge(inscriptionSendDraft.feeShib).toLocaleString(undefined, { maximumFractionDigits: 8 })} DOGE
                                </div>
                              </div>
                            </details>

                            {inscriptionSendError && (
                              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                                {inscriptionSendError}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <label className="block text-sm text-[#E5E5E5]">
                              <span className="mb-2 block">{t('modal.sendInscription.recipientLabel')}</span>
                              <input
                                value={inscriptionSendRecipient}
                                onChange={(e) => {
                                  setInscriptionSendRecipient(e.target.value);
                                  setInscriptionSendDraft(null);
                                }}
                                placeholder={t('modal.sendInscription.placeholderAddr')}
                                className={INPUT_CLASS}
                                disabled={inscriptionSendBusy || inscriptionSendReviewBusy}
                              />
                            </label>
                            <div className="space-y-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-xs leading-5 text-[#F8E7A1]">
                              <div className="flex items-start gap-2">
                                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
                                <p>{t('modal.sendInscription.warningShort')}</p>
                              </div>
                              <TechDetails
                                summary={t('modal.wallet.geekDetails')}
                                className="text-[#F8E7A1]/90"
                                summaryClassName="text-[#F8E7A1]"
                                contentClassName="border-[#F8E7A1]/30"
                              >
                                <p>{t('modal.sendInscription.warning')}</p>
                              </TechDetails>
                            </div>
                            {inscriptionSendError && (
                              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                                {inscriptionSendError}
                              </div>
                            )}
                          </>
                        )}

                        <div className="flex gap-3">
                          <Button
                            onClick={() => {
                              if (inscriptionSendTxid) {
                                setInscriptionSendDraft(null);
                                setInscriptionSendRecipient('');
                                setInscriptionSendTxid(null);
                                setInscriptionSendError(null);
                                setStep('dashboard');
                                return;
                              }
                              if (inscriptionSendDraft) {
                                setInscriptionSendDraft(null);
                                return;
                              }
                              setInscriptionSendDraft(null);
                              setInscriptionSendRecipient('');
                              setInscriptionSendTxid(null);
                              setInscriptionSendError(null);
                              setStep('dashboard');
                            }}
                            className={cx('flex-1', SECONDARY_BUTTON)}
                          >
                            {inscriptionSendTxid
                              ? t('modal.sendInscription.done')
                              : inscriptionSendDraft
                                ? t('modal.sendInscription.back')
                                : t('modal.sendInscription.cancel')}
                          </Button>
                          {!inscriptionSendTxid && !inscriptionSendDraft && (
                            <Button
                              type="button"
                              onClick={() => void handleReviewSendInscription()}
                              disabled={inscriptionSendReviewBusy || !inscriptionSendRecipient.trim()}
                              className={cx('flex-1', PRIMARY_BUTTON)}
                            >
                              {inscriptionSendReviewBusy
                                ? t('modal.sendInscription.reviewBusy')
                                : t('modal.sendInscription.review')}
                            </Button>
                          )}
                          {!inscriptionSendTxid && inscriptionSendDraft ? (
                            <Button
                              type="button"
                              onClick={() => void handleConfirmSendInscription()}
                              disabled={inscriptionSendBusy}
                              className={cx('flex-1', PRIMARY_BUTTON)}
                            >
                              {inscriptionSendBusy ? t('modal.sendInscription.sending') : t('modal.sendInscription.confirmSend')}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* ── List inscription ─────────────────────────────── */}
                    {step === 'list_inscription' && selectedInscription && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                          {selectedInscription.contentType?.startsWith('image/') ? (
                            <img
                              src={resolveInscriptionMediaUrl(selectedInscription)}
                              alt=""
                              className="h-14 w-14 rounded-lg object-cover"
                              onError={(e) => {
                                const fallback = selectedInscription.preview?.trim() || selectedInscription.content?.trim();
                                if (fallback && e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                  return;
                                }
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : isWasmInscription(selectedInscription.contentType) ? (
                            <button
                              type="button"
                              onClick={() => setTextInspectItem(selectedInscription)}
                              className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-400/25 bg-[#0a0f0c] text-[8px] font-bold uppercase tracking-wide text-emerald-200 transition hover:brightness-110"
                              title="Ðalkanes WASM"
                            >
                              <span className="font-mono text-sm leading-none" aria-hidden>
                                {'{ }'}
                              </span>
                              WASM
                            </button>
                          ) : isTextishInscription(selectedInscription.contentType) ? (
                            <button
                              type="button"
                              onClick={() => setTextInspectItem(selectedInscription)}
                              className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-950 text-[9px] font-bold uppercase tracking-wide text-sky-200/90 transition hover:brightness-110"
                            >
                              <DocumentTextIcon className="h-5 w-5" aria-hidden />
                              {t('modal.assets.inspectShort')}
                            </button>
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-800 text-xs text-white/40">
                              {selectedInscription.contentType?.split('/')[1] ?? '?'}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {t('modal.sendInscription.inscriptionHeading', { num: String(selectedInscription.inscriptionNumber) })}
                            </div>
                            <div className="text-xs text-white/50 font-mono truncate" style={{ maxWidth: 200 }}>
                              {selectedInscription.inscriptionId}
                            </div>
                          </div>
                        </div>

                        {listingSignedPsbt ? (
                          /* ── Post-signing: show QR + options ── */
                          <div className="space-y-4">
                            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                              <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                                <span>{t('modal.listing.signedBannerBeforePrice')}</span>
                                <span className="inline-flex items-center gap-0.5 font-semibold">
                                  {listingPriceDoge}
                                  <DogeCurrencyIcon size="sm" />
                                </span>
                                <span>{t('modal.listing.signedBannerAfterPrice')}</span>
                              </span>
                              {listingNostrPublished && t('modal.listing.signedNostrSuffix')}
                            </div>
                            {listingBusy && !listingNostrPublished && (
                              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                                {t('modal.listing.publishingRelays')}
                              </div>
                            )}
                            {listingError && (
                              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {listingError}
                              </div>
                            )}
                            {(showListingPublishDetails || listingPublishRelayResults.length > 0) && (
                              <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                                <button
                                  type="button"
                                  onClick={() => setShowListingPublishDetails(v => !v)}
                                  className="flex w-full items-center justify-between text-left"
                                >
                                  <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                                    {t('modal.listing.publishDetails')}
                                  </span>
                                  <span className="text-xs text-white/50">
                                    {showListingPublishDetails ? t('modal.listing.hide') : t('modal.listing.show')}
                                  </span>
                                </button>
                                {showListingPublishDetails && (
                                  <div className="mt-3 space-y-2">
                                    {listingPublishRelayResults.length > 0 ? (
                                      listingPublishRelayResults.map((r) => (
                                        <div key={r.url} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                                          <div className="min-w-0">
                                            <div className="truncate text-xs font-mono text-white/75">{r.url}</div>
                                            {!r.ok && r.error && (
                                              <div className="mt-1 text-[11px] text-red-300 break-words">{r.error}</div>
                                            )}
                                          </div>
                                          <div className={cx('shrink-0 text-xs font-semibold', r.ok ? 'text-green-300' : 'text-red-300')}>
                                            {r.ok ? t('modal.listing.relayOk') : t('modal.listing.relayFailed')}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-xs text-white/50">{t('modal.listing.noRelayDiag')}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* QR code — encodes the self-contained dogepsdt URI */}
                            {listingDogePsdtUri && listingShareUrl && (
                              <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
                                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t('modal.listing.shareToSell')}</div>
                                <QRCodeSVG
                                  value={listingDogePsdtUri}
                                  size={200}
                                  bgColor="#0A0A0A"
                                  fgColor="#FFFFFF"
                                  level="L"
                                />
                                <div className="text-[10px] text-white/40 text-center px-2">
                                  {t('modal.listing.qrHelp')}
                                </div>
                                <div className="flex gap-2 w-full">
                                  <Button
                                    onClick={() => handleCopyListingUrl(listingShareUrl)}
                                    className={cx('flex-1 text-xs', SECONDARY_BUTTON)}
                                  >
                                    <ClipboardDocumentIcon className="mr-1 h-3.5 w-3.5 inline" />
                                    {t('modal.listing.copyUrlBtn')}
                                  </Button>
                                  {!listingNostrPublished && (
                                    <Button
                                      onClick={handlePublishSignedListingToNostr}
                                      disabled={listingBusy}
                                      className={cx('flex-1 text-xs', PRIMARY_BUTTON, listingBusy && 'cursor-wait')}
                                      aria-busy={listingBusy}
                                    >
                                      {listingBusy ? (
                                        <>
                                          <ArrowPathIcon className="mr-1 h-3.5 w-3.5 inline animate-spin" />
                                          {t('modal.listing.publishingBtn')}
                                        </>
                                      ) : (
                                        t('modal.listing.publishNostr')
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}

                            <Button onClick={() => { setStep('dashboard'); setTab('listings'); }} className={cx('w-full', SECONDARY_BUTTON)}>
                              {t('modal.listing.viewMyListings')}
                            </Button>
                          </div>
                        ) : listingReviewing ? (
                          /* ── Review & confirm before signing ── */
                          <div className="space-y-4">
                            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/8 px-4 py-3 space-y-2">
                              <div className="text-xs font-bold text-yellow-300 uppercase tracking-wider">{t('modal.listing.reviewTitle')}</div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <span className="text-white/50">{t('modal.listing.reviewInscription')}</span>
                                <span className="text-white font-semibold">#{selectedInscription?.inscriptionNumber}</span>
                                <span className="text-white/50">{t('modal.listing.reviewId')}</span>
                                <span className="text-white/70 font-mono break-all">{selectedInscription?.inscriptionId}</span>
                                <span className="text-white/50">{t('modal.listing.reviewUtxo')}</span>
                                <span className="text-white/70 font-mono break-all">{selectedInscription?.output}</span>
                                <span className="text-white/50">{t('modal.listing.reviewPrice')}</span>
                                <span className="inline-flex items-center gap-0.5 text-sm font-bold text-[#FCD34D]">
                                  <span>{listingPriceDoge}</span>
                                  <DogeCurrencyIcon size="sm" />
                                </span>
                                <span className="text-white/50">{t('modal.listing.reviewSellerGets')}</span>
                                <span className="inline-flex flex-wrap items-center gap-0.5 text-white/80">
                                  <span>{listingPriceDoge}</span>
                                  <DogeCurrencyIcon size="sm" />
                                  {t('modal.listing.reviewSellerGetsArrow')}
                                </span>
                              </div>
                            </div>
                            <div className="rounded-xl border border-orange-500/20 bg-orange-500/8 px-4 py-3 text-[11px] leading-5 text-orange-200 space-y-1">
                              <div className="font-bold text-orange-300">{t('modal.listing.liveOfferTitle')}</div>
                              <ul className="list-disc pl-4 space-y-0.5 text-white/60">
                                <li>{t('modal.listing.liveOffer1')}</li>
                                <li>{t('modal.listing.liveOffer2')}</li>
                                <li>{t('modal.listing.liveOffer3')}</li>
                              </ul>
                            </div>
                            {listingError && (
                              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                                {listingError}
                              </div>
                            )}
                            <div className="flex gap-3">
                              <Button onClick={() => setListingReviewing(false)} disabled={listingBusy} className={cx('flex-1', SECONDARY_BUTTON)}>
                                {t('modal.listing.editPrice')}
                              </Button>
                              <Button
                                onClick={() => handleCreateListing(false)}
                                disabled={listingBusy}
                                className={cx('flex-1', PRIMARY_BUTTON)}
                              >
                                {listingBusy ? t('modal.listing.signing') : t('modal.listing.confirmSign')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ── Price entry form ── */
                          <>
                            <label className="block text-sm text-[#E5E5E5]">
                              <span className="mb-2 block">{t('modal.listing.priceLabel')}</span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={listingPriceDoge}
                                onChange={e => setListingPriceDoge(e.target.value)}
                                placeholder={t('modal.listing.pricePlaceholder')}
                                className={INPUT_CLASS}
                                disabled={listingBusy}
                              />
                            </label>
                            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-xs leading-5 text-white/60">
                              <div className="font-semibold text-white/80 mb-1">{t('modal.listing.howItWorksTitle')}</div>
                              {t('modal.listing.howItWorksBody')}
                              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                                <li>{t('modal.listing.howItWorksLi1')}</li>
                                <li>{t('modal.listing.howItWorksLi2')}</li>
                              </ul>
                            </div>
                            <div className="flex gap-3">
                              <Button onClick={() => setStep('dashboard')} className={cx('flex-1', SECONDARY_BUTTON)}>
                                {t('modal.listing.cancel')}
                              </Button>
                              <Button
                                onClick={() => setListingReviewing(true)}
                                disabled={!listingPriceDoge || parseFloat(listingPriceDoge) <= 0}
                                className={cx('flex-1', PRIMARY_BUTTON)}
                              >
                                {t('modal.listing.reviewNext')}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {step === 'verification' && (
                      <div className="space-y-5">
                        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-xs leading-5 text-white/70">
                          <span className="font-semibold text-white/90">{t('modal.verification.dxBadge')}</span>
                          {' · '}
                          <a
                            href="https://github.com/scribewiz/dogenals/blob/main/protocols/dx/spec.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FCD34D] underline-offset-2 hover:underline"
                          >
                            {t('modal.verification.dxSpecLink')}
                          </a>
                        </div>

                        {!connected || !activeAddress ? (
                          <p className="text-sm text-amber-200">{t('modal.verification.needWallet')}</p>
                        ) : dxPhase === 1 ? (
                          <>
                            <p className="text-sm leading-6 text-[#D4D4D4]">{t('modal.verification.dxIntro')}</p>
                            <label className="block text-sm text-white">
                              <span className="mb-2 block">{t('modal.verification.handleLabel')}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-white/50">@</span>
                                <input
                                  value={dxHandleInput}
                                  onChange={(e) => setDxHandleInput(e.target.value.replace(/^@+/, ''))}
                                  placeholder="yourhandle"
                                  className={INPUT_CLASS}
                                  autoCapitalize="none"
                                  autoCorrect="off"
                                  spellCheck={false}
                                />
                              </div>
                            </label>
                            {isCommandDogDxConfigured() ? (
                              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-[#D4D4D4]">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 shrink-0 rounded border-white/30 bg-[#0A0A0A] text-amber-500 focus:ring-amber-500/40"
                                  checked={dxPremiumGrokImagine}
                                  onChange={(e) => setDxPremiumGrokImagine(e.target.checked)}
                                  disabled={dxSessionBusy}
                                />
                                <span>
                                  <span className="font-medium text-white">{t('modal.verification.dxPremiumGrokLabel')}</span>
                                  <span className="mt-1 block text-xs text-white/55">{t('modal.verification.dxPremiumGrokHint')}</span>
                                </span>
                              </label>
                            ) : null}
                            <label className="block text-sm text-white">
                              <span className="mb-2 block">{t('modal.verification.dxStyleLabel')}</span>
                              <select
                                value={dxStylePack}
                                onChange={(e) => setDxStylePack(e.target.value)}
                                className={INPUT_CLASS}
                                disabled={dxSessionBusy || (isCommandDogDxConfigured() && !dxPremiumGrokImagine)}
                              >
                                <option value="trading_card">{t('modal.verification.dxStyleTradingCard')}</option>
                                <option value="cyber">{t('modal.verification.dxStyleCyber')}</option>
                                <option value="neon">{t('modal.verification.dxStyleNeon')}</option>
                                <option value="pixel">{t('modal.verification.dxStylePixel')}</option>
                                <option value="luxe">{t('modal.verification.dxStyleLuxe')}</option>
                                <option value="golden">{t('modal.verification.dxStyleGolden')}</option>
                                <option value="retro">{t('modal.verification.dxStyleRetro')}</option>
                              </select>
                              <span className="mt-1 block text-[11px] text-white/45">
                                {isCommandDogDxConfigured() && !dxPremiumGrokImagine
                                  ? t('modal.verification.dxStyleHintStandard')
                                  : t('modal.verification.dxStyleHint')}
                              </span>
                            </label>
                            <Button
                              type="button"
                              className={cx('w-full', PRIMARY_BUTTON)}
                              disabled={dxSessionBusy}
                              onClick={() => {
                                void (async () => {
                                  setDxErr(null);
                                  try {
                                    normalizeDxXHandle(dxHandleInput);
                                    if (!activeAddress) {
                                      setDxErr(t('modal.verification.needWallet'));
                                      return;
                                    }
                                    setDxBackendSessionId(null);
                                    setDxBackendChoice('grok');
                                    if (isCommandDogDxConfigured()) {
                                      setDxSessionBusy(true);
                                      try {
                                        const xh = normalizeDxXHandle(dxHandleInput);
                                        const started = await dxInitiate({
                                          user_address: activeAddress,
                                          x_handle: xh,
                                          choice: 'grok',
                                          style_pack: dxStylePack,
                                        });
                                        setDxBackendSessionId(started.session_id);
                                        setDxBackendChoice(started.choice || 'grok');
                                        setDxSessionExpiresAtUnix(
                                          typeof started.expires_at_unix === 'number'
                                            ? started.expires_at_unix
                                            : null,
                                        );
                                      } catch (e) {
                                        const msg = e instanceof Error ? e.message : String(e);
                                        setDxErr(msg);
                                        return;
                                      } finally {
                                        setDxSessionBusy(false);
                                      }
                                    } else {
                                      setDxSessionExpiresAtUnix(null);
                                    }
                                    setDxPhase(2);
                                  } catch (e) {
                                    setDxErr(e instanceof Error ? e.message : String(e));
                                  }
                                })();
                              }}
                            >
                              {dxSessionBusy ? t('modal.verification.dxSessionStarting') : t('modal.verification.continue')}
                            </Button>
                          </>
                        ) : dxPhase === 2 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setDxErr(null);
                                setDxBackendSessionId(null);
                                setDxBackendChoice('grok');
                                setDxSessionExpiresAtUnix(null);
                                setDxPhase(1);
                              }}
                              className="flex items-center gap-1 text-xs text-white/60 hover:text-white"
                            >
                              <ChevronLeftIcon className="h-4 w-4" />
                              {t('modal.verification.back')}
                            </button>
                            <p className="text-sm text-[#D4D4D4]">{t('modal.verification.dxStep2Intro')}</p>
                            {isCommandDogDxConfigured() && dxSessionExpiresAtUnix != null ? (
                              <p className="text-xs text-amber-200/90">
                                {t('modal.verification.dxSessionDeadline', {
                                  time: new Date(dxSessionExpiresAtUnix * 1000).toLocaleString(undefined, {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  }),
                                })}
                              </p>
                            ) : null}
                            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 font-mono text-xs leading-relaxed text-amber-50 break-all">
                              {buildDxSigningMessage(dxNonce || '…', activeAddress, dxHandleInput || undefined)}
                            </div>
                            <Button
                              type="button"
                              className="w-full border border-white/15 bg-transparent text-[#FCD34D] hover:bg-white/5"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    buildDxSigningMessage(dxNonce, activeAddress, dxHandleInput || undefined),
                                  );
                                  toast.success(t('modal.verification.copied'));
                                } catch {
                                  toast.error(t('modal.verification.copyFail'));
                                }
                              }}
                            >
                              {t('modal.verification.copyChallenge')}
                            </Button>
                            <p className="text-xs text-white/55">{t('modal.verification.dxTweetHint')}</p>
                            <label className="block text-sm text-white">
                              <span className="mb-2 block">{t('modal.verification.tweetUrlLabel')}</span>
                              <input
                                value={dxTweetRaw}
                                onChange={(e) => setDxTweetRaw(e.target.value)}
                                placeholder="https://x.com/you/status/123…"
                                className={INPUT_CLASS}
                              />
                            </label>
                            {dxErr ? <p className="text-sm text-red-300">{dxErr}</p> : null}
                            <Button
                              type="button"
                              className={cx('w-full', PRIMARY_BUTTON)}
                              disabled={dxBusy}
                              onClick={async () => {
                                setDxErr(null);
                                if (
                                  isCommandDogDxConfigured() &&
                                  dxSessionExpiresAtUnix != null &&
                                  Math.floor(Date.now() / 1000) > dxSessionExpiresAtUnix
                                ) {
                                  setDxErr(t('modal.verification.dxSessionExpiredClient'));
                                  return;
                                }
                                const tweetId = parseTweetIdFromInput(dxTweetRaw);
                                if (!tweetId) {
                                  setDxErr(t('modal.verification.errTweetId'));
                                  return;
                                }
                                let xHandle: string;
                                try {
                                  xHandle = normalizeDxXHandle(dxHandleInput);
                                } catch (e) {
                                  setDxErr(e instanceof Error ? e.message : String(e));
                                  return;
                                }
                                const challenge = buildDxSigningMessage(
                                  dxNonce,
                                  activeAddress,
                                  dxHandleInput || undefined,
                                );
                                setDxBusy(true);
                                setDxAttestationVisual(null);
                                try {
                                  const signatureBase64 = await signMessage(challenge);
                                  let payload = buildDxRegisterPayload({
                                    xHandle,
                                    dogeAddress: activeAddress,
                                    tweetId,
                                    signatureBase64,
                                    nonce: dxNonce,
                                  });
                                  if (isCommandDogDxConfigured()) {
                                    try {
                                      const confirmed = await dxConfirm({
                                        session_id: dxBackendSessionId ?? undefined,
                                        user_address: activeAddress,
                                        x_handle: xHandle,
                                        choice: dxBackendChoice,
                                        style_pack: dxStylePack,
                                        generate_imagine_badge: dxPremiumGrokImagine,
                                        payment_tx: {},
                                        tweet_proof: {
                                          tweet_id: tweetId,
                                          signature: signatureBase64,
                                          nonce: dxNonce,
                                        },
                                        visual_data: { client: 'dojakweb', ui_pack_rip: true },
                                      });
                                      const reg = confirmed.attestation?.register as unknown as
                                        | DxRegisterPayload
                                        | undefined;
                                      if (reg?.p === 'dx' && reg?.op === 'register') {
                                        payload = reg;
                                      }
                                      const rawVis = confirmed.attestation?.visual_data;
                                      if (
                                        rawVis &&
                                        typeof rawVis === 'object' &&
                                        !Array.isArray(rawVis)
                                      ) {
                                        setDxAttestationVisual(rawVis as Record<string, unknown>);
                                      }
                                    } catch (apiErr) {
                                      console.warn('[dx] command.dog confirm failed', apiErr);
                                      toast.error(
                                        `command.dog: ${apiErr instanceof Error ? apiErr.message : String(apiErr)}`,
                                      );
                                    }
                                  }
                                  setDxPayload(payload);
                                  setDxPhase(3);
                                  pushDxResponseToHost(payload, 'success');
                                  toast.success(t('modal.verification.signedToast'));
                                } catch (e) {
                                  const msg = e instanceof Error ? e.message : String(e);
                                  setDxErr(msg);
                                  pushDxResponseToHost(null, 'error', msg);
                                } finally {
                                  setDxBusy(false);
                                }
                              }}
                            >
                              {dxBusy ? t('modal.verification.signing') : t('modal.verification.signProof')}
                            </Button>
                          </>
                        ) : (
                          <>
                            {(() => {
                              let handleLabel = '@…';
                              try {
                                handleLabel = normalizeDxXHandle(dxHandleInput);
                              } catch {
                                /* empty */
                              }
                              const badgeUrl = dxResolvedBadgeImageUrl(dxAttestationVisual);
                              const visualHint = dxAttestationVisual
                                ? dxVisualStatusMessage(dxAttestationVisual)
                                : null;
                              const masterCard =
                                dxAttestationVisual &&
                                typeof dxAttestationVisual === 'object' &&
                                !Array.isArray(dxAttestationVisual) &&
                                dxAttestationVisual.badge_art_source === 'master_default';
                              return activeAddress ? (
                                <DxPackRipReveal
                                  xHandle={handleLabel}
                                  dogeAddress={activeAddress}
                                  badgeImageUrl={badgeUrl}
                                  statusHint={visualHint}
                                  packTitle={t('modal.verification.dxPackTitle')}
                                  ripCta={t('modal.verification.dxRipCta')}
                                  cardSubtitle={
                                    masterCard
                                      ? t('modal.verification.dxCardSubtitleMaster')
                                      : t('modal.verification.dxCardSubtitle')
                                  }
                                  verifiedBanner={t('modal.verification.dxVerifiedBanner')}
                                />
                              ) : null;
                            })()}
                            <p className="text-sm text-green-200">{t('modal.verification.dxDone')}</p>
                            <textarea
                              readOnly
                              value={dxPayload ? JSON.stringify(dxPayload, null, 2) : ''}
                              rows={12}
                              className={cx(INPUT_CLASS, 'font-mono text-xs')}
                            />
                            <Button
                              type="button"
                              className="w-full border border-white/15 bg-transparent text-[#FCD34D] hover:bg-white/5"
                              onClick={async () => {
                                if (!dxPayload) return;
                                try {
                                  await navigator.clipboard.writeText(JSON.stringify(dxPayload, null, 2));
                                  toast.success(t('modal.verification.copied'));
                                } catch {
                                  toast.error(t('modal.verification.copyFail'));
                                }
                              }}
                            >
                              {t('modal.verification.copyPayload')}
                            </Button>
                            <p className="text-xs leading-5 text-white/55">{t('modal.verification.dxInscribeHint')}</p>
                            {walletType !== 'browser' ? (
                              <p className="text-xs leading-5 text-amber-200/85">{t('modal.verification.dxEasyHint')}</p>
                            ) : null}
                            <label className="block text-sm text-white">
                              <span className="mb-2 block">{t('modal.verification.dxFeeLabel')}</span>
                              <input
                                type="number"
                                min={1000}
                                step={1000}
                                value={dxFeeRate}
                                onChange={(e) => setDxFeeRate(Math.max(1_000_000, Number(e.target.value) || 1_000_000))}
                                className={INPUT_CLASS}
                                disabled={dxInscribeBusy}
                              />
                              <span className="mt-1 block text-[11px] text-white/50">{t('modal.verification.dxFeeHint')}</span>
                            </label>
                            {!dxBadgeInscriptionIdFromEnv() ? (
                              <p className="text-[11px] leading-5 text-amber-200/90">{t('modal.verification.dxCardEnvHint')}</p>
                            ) : null}
                            <div className="flex flex-col gap-2">
                              <Button
                                type="button"
                                className={cx('w-full', PRIMARY_BUTTON)}
                                disabled={dxInscribeBusy}
                                onClick={() => void handleDxInscribeRegisterJson()}
                              >
                                {dxInscribeBusy
                                  ? t('modal.verification.dxInscribing')
                                  : walletType === 'browser'
                                    ? t('modal.verification.dxInscribeRegisterBtn')
                                    : t('modal.verification.dxEasyInscribeBtn')}
                              </Button>
                              <Button
                                type="button"
                                className={cx('w-full', SECONDARY_BUTTON)}
                                disabled={dxInscribeBusy || !dxBadgeInscriptionIdFromEnv() || walletType !== 'browser'}
                                onClick={() => void handleDxInscribeWalletCard()}
                              >
                                {dxInscribeBusy ? t('modal.verification.dxInscribing') : t('modal.verification.dxInscribeCardBtn')}
                              </Button>
                            </div>
                            {dxEasyJob ? (
                              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 space-y-1 text-[11px] text-amber-100/90">
                                <p className="font-semibold">Easy Ð𝕏 job · {dxEasyJob.status}</p>
                                <p className="font-mono break-all">Deposit: {dxEasyJob.deposit_address}</p>
                                <p>
                                  Amount: <strong>{dxEasyJob.amount_doge} Ð</strong>
                                </p>
                                {dxEasyStatus ? <p className="text-white/70">{dxEasyStatus}</p> : null}
                                {dxEasyJob.items?.[0]?.inscription_id ? (
                                  <p className="font-mono break-all">id {dxEasyJob.items[0].inscription_id}</p>
                                ) : null}
                              </div>
                            ) : null}
                            {dxRegisterInscriptionId ? (
                              <p className="text-[11px] text-white/70 break-all">
                                <span className="text-white/50">{t('modal.verification.dxLastRegisterId')}</span> {dxRegisterInscriptionId}
                              </p>
                            ) : null}
                            {dxCardInscriptionId ? (
                              <p className="text-[11px] text-white/70 break-all">
                                <span className="text-white/50">{t('modal.verification.dxLastCardId')}</span> {dxCardInscriptionId}
                              </p>
                            ) : null}

                            <Button type="button" className={cx('w-full', SECONDARY_BUTTON)} onClick={() => setStep('dashboard')}>
                              {t('modal.verification.backToWallet')}
                            </Button>
                          </>
                        )}

                        {/* Always available: revoke so MyDoge → browser re-link works without redoing phase 3 */}
                        {activeAddress ? (
                          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            <p className="text-sm font-semibold text-white/90">{t('modal.verification.dxRevokeTitle')}</p>
                            <p className="text-[11px] leading-5 text-white/50">{t('modal.verification.dxRevokeHint')}</p>
                            <label className="block text-sm text-white">
                              <span className="mb-1 block text-xs text-white/60">{t('modal.verification.dxRevokePrevId')}</span>
                              <input
                                value={dxRevokePrevId}
                                onChange={(e) => setDxRevokePrevId(e.target.value)}
                                placeholder="…i0"
                                className={cx(INPUT_CLASS, 'font-mono text-xs')}
                                disabled={dxInscribeBusy}
                              />
                            </label>
                            <Button
                              type="button"
                              className={cx('w-full', DANGER_BUTTON)}
                              disabled={dxInscribeBusy || !dxRevokePrevId.trim()}
                              onClick={() => void handleDxInscribeRevoke()}
                            >
                              {dxInscribeBusy ? t('modal.verification.dxInscribing') : t('modal.verification.dxRevokeBtn')}
                            </Button>
                            {dxEasyJob && dxRevokePayload ? (
                              <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-2 text-[10px] text-amber-100/90 space-y-0.5">
                                <p>Easy job · {dxEasyJob.status}</p>
                                <p className="font-mono break-all">{dxEasyJob.deposit_address}</p>
                                <p>{dxEasyJob.amount_doge} Ð</p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {step === 'utxos' && activeAddress && (
                      <div className="space-y-3">
                        <p className="text-[11px] leading-relaxed text-white/45">
                          Wallet total can look higher than Spendable. Inscription carriers (0.001 Ð), locked coins,
                          and inputs from a recent underfee / stuck mempool send stay unavailable until that tx
                          confirms or drops from the network (often 1–3 days). Local holds from this browser can be cleared below.
                        </p>
                        {spendableBreak && spendableBreak.localHoldCount > 0 ? (
                          <button
                            type="button"
                            className={cx(SECONDARY_BUTTON, 'w-full text-xs')}
                            onClick={() => {
                              clearMempoolOverlayForAddress(activeAddress);
                              setSpendableBreak(null);
                              toast.success('Cleared local spend holds — refresh if coins reappear as spendable');
                              void getSpendableBalanceBreakdown(activeAddress, balance).then(setSpendableBreak);
                            }}
                          >
                            Release local holds ({spendableBreak.localHoldCount} UTXO
                            {spendableBreak.localHoldCount === 1 ? '' : 's'}
                            {spendableBreak.localHoldDoge > 0
                              ? ` · ${spendableBreak.localHoldDoge.toLocaleString(undefined, { maximumFractionDigits: 4 })} Ð`
                              : ''}
                            )
                          </button>
                        ) : null}
                        <UtxoManagement
                          walletAddress={activeAddress}
                          showAddressBanner={false}
                        />
                        <Button type="button" className={cx('w-full', SECONDARY_BUTTON)} onClick={() => setStep('dashboard')}>
                          Back to wallet
                        </Button>
                      </div>
                    )}

                    {step === 'send' && (
                      <WalletSendFlow
                        key={sendPrefillAddress ?? 'send-default'}
                        connected={connected}
                        activeAddress={activeAddress}
                        balance={balance}
                        sendTransaction={async (to, amountDoge, opts) => {
                          const txid = await sendTransaction(to, amountDoge, opts);
                          pushLocalTransaction({
                            txid,
                            type: 'sent',
                            amount: amountDoge,
                            address: to,
                            confirmations: 0,
                            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                            pending: true,
                            localOnly: true,
                          });
                          return txid;
                        }}
                        refreshBalance={refreshBalance}
                        initialRecipient={sendPrefillAddress ?? undefined}
                        formatFiat={
                          fiatPrefs
                            ? (doge) => {
                                try {
                                  return fiatPrefs.formatFiat(fiatPrefs.convert(doge));
                                } catch {
                                  return null;
                                }
                              }
                            : undefined
                        }
                      />
                    )}

                    {step === 'receive' && (
                      <div className="space-y-4">
                        <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
                          <QRCodeSVG
                            value={activeAddress ?? ''}
                            size={180}
                            bgColor="#0A0A0A"
                            fgColor="#FFFFFF"
                            level="M"
                          />
                          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-[#D4D4D4]">
                            <span className="font-mono">{activeAddress}</span>
                            <button type="button" onClick={handleCopyAddress} className="shrink-0 transition hover:opacity-80" aria-label={t('modal.aria.copyAddress')}>
                              <ClipboardDocumentIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <Button onClick={() => setStep('dashboard')} className={cx('w-full', SECONDARY_BUTTON)}>
                          {t('modal.receive.back')}
                        </Button>
                      </div>
                    )}

                    {step === 'set_name' && (
                      <div className="space-y-4">
                        <label className="block text-sm text-[#E5E5E5]">
                          <span className="mb-2 block">{t('modal.setName.label')}</span>
                          <input
                            value={walletNameDraft}
                            onChange={(event) => setWalletNameDraft(event.target.value)}
                            placeholder={t('modal.setName.placeholder')}
                            className={INPUT_CLASS}
                            autoFocus
                          />
                        </label>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button onClick={() => setStep('dashboard')} className={cx('flex-1', SECONDARY_BUTTON)}>
                            {t('modal.setName.cancel')}
                          </Button>
                          <Button
                            onClick={async () => {
                              await handleSaveWalletName();
                              setStep('dashboard');
                            }}
                            disabled={isSavingWalletName || walletNameDraft.trim() === activeWalletName}
                            className={cx('flex-1', PRIMARY_BUTTON)}
                          >
                            {isSavingWalletName ? t('modal.setName.saving') : t('modal.setName.save')}
                          </Button>
                        </div>
                      </div>
                    )}

                    {step === 'remove' && (
                      <div className="space-y-5 text-center">
                        <div className="flex justify-center">
                          <TrashIcon className="h-12 w-12 text-red-300" />
                        </div>
                        <div className="whitespace-pre-line text-sm leading-6 text-[#FCA5A5]">
                          {t('modal.remove.warning')}
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button onClick={() => setStep('dashboard')} className={cx('flex-1', SECONDARY_BUTTON)}>{t('modal.remove.cancel')}</Button>
                          <Button onClick={handleRemoveWallet} disabled={isBusy} className={cx('flex-1', DANGER_BUTTON)}>{t('modal.remove.submit')}</Button>
                        </div>
                      </div>
                    )}

                    {step === 'settings' && (
                      <form className="space-y-3" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
                        {/* ── Settings tabs ── */}
                        <div className="flex border-b border-white/10">
                          {(['data', 'network', 'display'] as SettingsTab[]).map((tabId) => (
                            <button
                              key={tabId}
                              type="button"
                              onClick={() => setSettingsTab(tabId)}
                              className={cx(
                                'flex-1 border-b-2 py-2 text-xs font-semibold uppercase tracking-wide transition',
                                settingsTab === tabId
                                  ? 'border-[#D4A017] text-white'
                                  : 'border-transparent text-white/40 hover:text-white/70'
                              )}
                            >
                              {tabId === 'data'
                                ? 'Data'
                                : tabId === 'network'
                                  ? 'Network'
                                  : 'Display'}
                            </button>
                          ))}
                        </div>

                        {/* ══ DATA TAB ══ */}
                        {settingsTab === 'data' && (
                          <div className="space-y-3">
                            {/* Data provider */}
                            <div>
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">Wallet Data</div>
                              <div className="flex gap-2">
                                {([
                                  { id: 'mydoge' as const, label: 'MyDoge', hint: 'api.mydoge.com' },
                                  { id: 'dogex' as const, label: 'Dogex', hint: t('modal.dataProvider.dogexHint') },
                                  {
                                    id: 'commanddog' as const,
                                    label: 'Command.dog',
                                    hint: 'api.command.dog',
                                  },
                                ] as { id: WalletDataProviderType; label: string; hint: string }[]).map(opt => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                      setSettingsProvider(opt.id);
                                      // Switching provider clears custom URL → built-in default for that provider.
                                      setSettingsCustomUrl('');
                                    }}
                                    className={cx(
                                      'flex-1 rounded-lg border px-3 py-2 text-left transition',
                                      settingsProvider === opt.id
                                        ? 'border-[#D4A017]/60 bg-[#D4A017]/10'
                                        : 'border-white/10 bg-white/5 hover:border-white/20'
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={cx('h-2 w-2 shrink-0 rounded-full', settingsProvider === opt.id ? 'bg-[#D4A017]' : 'bg-white/20')} />
                                      <span className="text-sm font-semibold text-white">{opt.label}</span>
                                    </div>
                                    <div className="mt-0.5 pl-4 font-mono text-[10px] text-white/35">{opt.hint}</div>
                                  </button>
                                ))}
                              </div>
                              <input
                                value={settingsCustomUrl}
                                onChange={e => setSettingsCustomUrl(e.target.value)}
                                placeholder={`Custom API URL (optional) — default ${getDefaultWalletDataProviderUrl(settingsProvider)}`}
                                className={cx(INPUT_CLASS, 'mt-2 text-xs')}
                              />

                              <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                                  {t('modal.settings.sourceMapTitle')}
                                </div>
                                <p className="text-[10px] leading-relaxed text-white/40">
                                  {t('modal.settings.sourceMapHint')}
                                </p>
                                <div className="divide-y divide-white/[0.06] font-mono text-[10px]">
                                  {(
                                    [
                                      {
                                        label: t('modal.settings.sourceMap.doge'),
                                        source: t('modal.settings.sourceMap.fromWalletData'),
                                      },
                                      {
                                        label: t('modal.settings.sourceMap.era1'),
                                        source: t('modal.settings.sourceMap.fromWalletData'),
                                      },
                                      {
                                        label: t('modal.settings.sourceMap.dunes'),
                                        source: t('modal.settings.sourceMap.fromDogex'),
                                      },
                                      {
                                        label: t('modal.settings.sourceMap.treats'),
                                        source: t('modal.settings.sourceMap.fromDogex'),
                                      },
                                      {
                                        label: t('modal.settings.sourceMap.charms'),
                                        source: t('modal.settings.sourceMap.fromDogex'),
                                      },
                                    ] as const
                                  ).map((row) => (
                                    <div
                                      key={row.label}
                                      className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0"
                                    >
                                      <span className="text-white/70">{row.label}</span>
                                      <span className="shrink-0 text-right text-[#FCD34D]/80">{row.source}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                                  {t('modal.settings.indexerSectionTitle')}
                                </div>
                                <label className="block space-y-1">
                                  <span className="text-[11px] text-white/50">{t('modal.settings.indexerApiLabel')}</span>
                                  <input
                                    value={settingsIndexerApiBase}
                                    onChange={(e) => setSettingsIndexerApiBase(e.target.value)}
                                    placeholder={
                                      typeof window !== 'undefined'
                                        ? new URL('/__indexer', window.location.origin).href
                                        : '/__indexer'
                                    }
                                    className={cx(INPUT_CLASS, 'text-xs font-mono')}
                                  />
                                  <span className="block text-[10px] text-white/30">
                                    {t('modal.settings.indexerApiHint')}
                                  </span>
                                </label>
                                {settingsProvider === 'dogex' && (
                                  <label className="block space-y-1">
                                    <span className="text-[11px] text-white/50">{t('modal.settings.dogexCdnLabel')}</span>
                                    <input
                                      value={settingsDogexCdnBase}
                                      onChange={(e) => setSettingsDogexCdnBase(e.target.value)}
                                      placeholder={t('modal.settings.dogexCdnPlaceholder')}
                                      className={cx(INPUT_CLASS, 'text-xs font-mono')}
                                    />
                                    <span className="block text-[10px] text-white/30">
                                      {t('modal.settings.dogexCdnHint')}
                                    </span>
                                  </label>
                                )}
                                <div className="flex items-center gap-2 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => void handleTestIndexerHealth()}
                                    disabled={indexerHealth.status === 'loading'}
                                    className="rounded border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-white/55 transition hover:border-[#D4A017]/40 hover:text-white/85 disabled:opacity-40"
                                  >
                                    {indexerHealth.status === 'loading'
                                      ? t('modal.settings.indexerHealthTesting')
                                      : t('modal.settings.indexerHealthTest')}
                                  </button>
                                  {indexerHealth.status === 'ok' && (
                                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                                      <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                                      {indexerHealth.latencyMs != null ? `${indexerHealth.latencyMs}ms` : ''}
                                      {indexerHealth.message ? ` · ${indexerHealth.message}` : ''}
                                    </span>
                                  )}
                                  {indexerHealth.status === 'warn' && (
                                    <span
                                      className="flex items-center gap-1.5 text-[10px] font-medium text-amber-300"
                                      title={indexerHealth.message}
                                    >
                                      <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden />
                                      {indexerHealth.message}
                                    </span>
                                  )}
                                  {indexerHealth.status === 'err' && (
                                    <span
                                      className="flex items-center gap-1.5 text-[10px] font-medium text-red-300"
                                      title={indexerHealth.message}
                                    >
                                      <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden />
                                      {indexerHealth.message ?? '✗'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Price sources */}
                            <div>
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Price Sources</span>
                                <button
                                  type="button"
                                  onClick={() => setSettingsPriceSources(DOGE_PRICE_SOURCE_LIST.map((s) => s.id))}
                                  className="text-[10px] text-white/35 transition hover:text-white/60"
                                >
                                  Reset
                                </button>
                              </div>
                              <div className="space-y-1">
                                {DOGE_PRICE_SOURCE_LIST.map((source) => {
                                  const enabled = settingsPriceSources.includes(source.id);
                                  const isDragging = draggedPriceSourceId === source.id;
                                  const rank = enabled ? settingsPriceSources.indexOf(source.id) + 1 : null;
                                  return (
                                    <div
                                      key={source.id}
                                      draggable={enabled}
                                      onDragStart={() => { if (enabled) setDraggedPriceSourceId(source.id); }}
                                      onDragEnd={() => setDraggedPriceSourceId(null)}
                                      onDragOver={(e) => { if (enabled && draggedPriceSourceId && draggedPriceSourceId !== source.id) e.preventDefault(); }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        if (draggedPriceSourceId && draggedPriceSourceId !== source.id && enabled) movePriceSource(draggedPriceSourceId, source.id);
                                        setDraggedPriceSourceId(null);
                                      }}
                                      className={cx(
                                        'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition',
                                        enabled ? 'cursor-grab active:cursor-grabbing border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-50',
                                        isDragging && 'ring-1 ring-[#D4A017]/50'
                                      )}
                                    >
                                      {/* checkbox */}
                                      <button
                                        type="button"
                                        onClick={() => setSettingsPriceSources((cur) =>
                                          cur.includes(source.id) ? cur.filter((id) => id !== source.id) : [...cur, source.id]
                                        )}
                                        className={cx(
                                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition',
                                          enabled ? 'border-[#D4A017] bg-[#D4A017]/20' : 'border-white/25 bg-transparent'
                                        )}
                                        aria-checked={enabled}
                                        role="checkbox"
                                        aria-label={`${enabled ? 'Disable' : 'Enable'} ${t(`modal.priceSources.${source.id}.label`)}`}
                                      >
                                        {enabled && <span className="text-[9px] font-bold text-[#D4A017]">✓</span>}
                                      </button>
                                      {/* rank badge */}
                                      {rank !== null && (
                                        <span className="w-4 shrink-0 text-center text-[10px] font-bold text-[#D4A017]/70">{rank}</span>
                                      )}
                                      {/* label */}
                                      <span className="flex-1 text-sm font-medium text-white">
                                        {t(`modal.priceSources.${source.id}.label`)}
                                      </span>
                                      {/* info button */}
                                      <button
                                        type="button"
                                        onClick={() => setShowPriceInfo(showPriceInfo === source.id ? null : source.id)}
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] text-white/40 transition hover:border-white/30 hover:text-white/70"
                                        aria-label="Info"
                                      >
                                        i
                                      </button>
                                      {/* drag handle */}
                                      {enabled && <Bars3Icon className="h-4 w-4 shrink-0 text-white/30" aria-hidden />}
                                    </div>
                                  );
                                })}
                              </div>
                              {showPriceInfo && (
                                <div className="mt-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 leading-relaxed">
                                  <span className="font-semibold text-white/80">{t(`modal.priceSources.${showPriceInfo}.label`)}</span>
                                  {' — '}{t(`modal.priceSources.${showPriceInfo}.desc`)}
                                  {DOGE_PRICE_SOURCE_LIST.find((s) => s.id === showPriceInfo)?.url && (
                                    <div className="mt-1 font-mono text-[10px] text-white/30 break-all">
                                      {DOGE_PRICE_SOURCE_LIST.find((s) => s.id === showPriceInfo)?.url}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Merge InuBits */}
                            <button
                              type="button"
                              onClick={() => setSettingsMergeInuBits((v) => !v)}
                              className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/20"
                            >
                              <div className={cx('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition', settingsMergeInuBits ? 'border-[#D4A017] bg-[#D4A017]/20' : 'border-white/25')}>
                                {settingsMergeInuBits && <span className="text-[9px] font-bold text-[#D4A017]">✓</span>}
                              </div>
                              <span className="text-sm text-white">{t('modal.settings.mergeInuBitsTitle')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSettingsHideTextJson((v) => !v)}
                              className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/20"
                            >
                              <div className={cx('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition', settingsHideTextJson ? 'border-[#D4A017] bg-[#D4A017]/20' : 'border-white/25')}>
                                {settingsHideTextJson && <span className="text-[9px] font-bold text-[#D4A017]">✓</span>}
                              </div>
                              <div className="min-w-0">
                                <span className="text-sm text-white">{t('modal.settings.hideTextJsonTitle')}</span>
                                <p className="mt-0.5 text-[11px] leading-snug text-white/45">{t('modal.settings.hideTextJsonDesc')}</p>
                              </div>
                            </button>
                          </div>
                        )}

                        {/* ══ NETWORK TAB ══ */}
                        {settingsTab === 'network' && (
                          <div className="space-y-3">
                            {/* Broadcast relay priority */}
                            <div>
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">Broadcast Relays</div>
                              <p className="mb-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] leading-relaxed text-white/55">
                                {t('modal.settings.broadcastHardeningHint')}
                              </p>
                              <div className="space-y-1">
                                {normalizeBroadcastPriority(settingsBroadcast.broadcastPriority).map((provider, index) => {
                                  const disabled = disabledBroadcastProviders.includes(provider);
                                  const meta: Record<BroadcastRelayProvider, { label: string; desc: string }> = {
                                    rpc: { label: 'Local RPC', desc: t('modal.settings.bcMeta.rpcDesc') },
                                    blockchair: { label: 'Blockchair', desc: t('modal.settings.bcMeta.blockchairDesc') },
                                    blockcypher: { label: 'BlockCypher', desc: t('modal.settings.bcMeta.blockcypherDesc') },
                                    tatum: { label: 'Tatum', desc: t('modal.settings.bcMeta.tatumDesc') },
                                    commanddog: { label: 'Command.dog', desc: t('modal.settings.bcMeta.commanddogDesc') },
                                  };
                                  return (
                                    <div
                                      key={provider}
                                      draggable={!disabled}
                                      onDragStart={() => { if (!disabled) setDraggedBroadcastProvider(provider); }}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={() => {
                                        if (draggedBroadcastProvider) moveBroadcastProvider(draggedBroadcastProvider, provider);
                                        setDraggedBroadcastProvider(null);
                                      }}
                                      onDragEnd={() => setDraggedBroadcastProvider(null)}
                                      className={cx(
                                        'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition',
                                        disabled ? 'border-white/5 bg-white/[0.02] opacity-50' : 'cursor-grab active:cursor-grabbing border-white/10 bg-white/5 hover:border-white/15',
                                        draggedBroadcastProvider === provider && 'ring-1 ring-[#D4A017]/50'
                                      )}
                                    >
                                      {/* enable/disable checkbox */}
                                      <button
                                        type="button"
                                        onClick={() => setDisabledBroadcastProviders((cur) =>
                                          cur.includes(provider) ? cur.filter((p) => p !== provider) : [...cur, provider]
                                        )}
                                        className={cx(
                                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition',
                                          !disabled ? 'border-[#D4A017] bg-[#D4A017]/20' : 'border-white/25 bg-transparent'
                                        )}
                                        aria-checked={!disabled}
                                        role="checkbox"
                                        aria-label={`${disabled ? 'Enable' : 'Disable'} ${meta[provider].label}`}
                                      >
                                        {!disabled && <span className="text-[9px] font-bold text-[#D4A017]">✓</span>}
                                      </button>
                                      {/* priority rank */}
                                      <span className="w-4 shrink-0 text-center text-[10px] font-bold text-[#D4A017]/60">{index + 1}</span>
                                      {/* label */}
                                      <span className="flex-1 min-w-0 text-sm font-medium text-white">{meta[provider].label}</span>
                                      <div className="flex shrink-0 items-center gap-1">
                                        {relayHealthByProvider[provider]?.status === 'loading' ? (
                                          <span className="text-[10px] text-white/45">…</span>
                                        ) : null}
                                        {relayHealthByProvider[provider]?.status === 'ok' ? (
                                          <span
                                            className="max-w-[72px] truncate text-[10px] font-medium text-emerald-400"
                                            title={relayHealthByProvider[provider]?.message}
                                          >
                                            {relayHealthByProvider[provider]?.latencyMs}ms
                                          </span>
                                        ) : null}
                                        {relayHealthByProvider[provider]?.status === 'err' ? (
                                          <span
                                            className="max-w-[56px] truncate text-[10px] font-medium text-red-300"
                                            title={relayHealthByProvider[provider]?.message ?? 'Error'}
                                          >
                                            ✗
                                          </span>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => void handleTestOneRelay(provider)}
                                          disabled={relayHealthByProvider[provider]?.status === 'loading'}
                                          className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-white/55 transition hover:border-[#D4A017]/40 hover:text-white/85 disabled:opacity-40"
                                        >
                                          {t('modal.settings.relayTestOne')}
                                        </button>
                                      </div>
                                      {/* info */}
                                      <button
                                        type="button"
                                        onClick={() => setShowBroadcastInfo(showBroadcastInfo === provider ? null : provider)}
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] text-white/40 transition hover:border-white/30 hover:text-white/70"
                                        aria-label="Info"
                                      >
                                        i
                                      </button>
                                      {!disabled && <Bars3Icon className="h-4 w-4 shrink-0 text-white/30" aria-hidden />}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleTestAllRelays()}
                                  disabled={relayTestAllBusy}
                                  className="rounded-lg border border-[#D4A017]/35 bg-[#D4A017]/10 px-3 py-1.5 text-xs font-semibold text-[#FCD34D] transition hover:bg-[#D4A017]/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {relayTestAllBusy ? t('modal.settings.relayTestAllBusy') : t('modal.settings.relayTestAll')}
                                </button>
                                <p className="text-[10px] leading-snug text-white/40">{t('modal.settings.relayTestHint')}</p>
                              </div>
                              {showBroadcastInfo && (
                                <div className="mt-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 leading-relaxed">
                                  {{
                                    rpc: t('modal.settings.bcMeta.rpcDesc'),
                                    blockchair: t('modal.settings.bcMeta.blockchairDesc'),
                                    blockcypher: t('modal.settings.bcMeta.blockcypherDesc'),
                                    tatum: t('modal.settings.bcMeta.tatumDesc'),
                                    commanddog: t('modal.settings.bcMeta.commanddogDesc'),
                                  }[showBroadcastInfo]}
                                </div>
                              )}
                              {/* Tatum key (only if tatum enabled) */}
                              {!disabledBroadcastProviders.includes('tatum') && (
                                <input
                                  type="text"
                                  value={settingsBroadcast.tatumApiKey}
                                  onChange={e => setSettingsBroadcast(prev => ({ ...prev, tatumApiKey: e.target.value }))}
                                  placeholder="Tatum API key (optional)"
                                  className={cx(INPUT_CLASS, 'mt-2 text-xs [webkit-text-security:disc]')}
                                  {...walletCredentialInputProps('dojakweb-tatum-api-key')}
                                />
                              )}
                              <ConfirmationReadSourcesBar previewConfig={settingsBroadcast} dense className="mt-3" />
                            </div>

                            {/* TX Explorer */}
                            <div>
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">TX Explorer</div>
                              <div className="flex gap-2">
                                {([
                                  { id: 'dogenals' as const, label: 'ÐExplorer' },
                                  { id: 'sochain' as const, label: 'SoChain' },
                                  { id: 'dogechain' as const, label: 'DogeChain' },
                                  { id: 'blockchair' as const, label: 'Blockchair' },
                                ] as { id: DogeTxExplorerId; label: string }[]).map(opt => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setSettingsChainExplorer(opt.id)}
                                    className={cx(
                                      'flex-1 rounded-lg border px-2 py-1.5 text-center text-xs font-semibold transition',
                                      settingsChainExplorer === opt.id
                                        ? 'border-[#D4A017]/60 bg-[#D4A017]/10 text-white'
                                        : 'border-white/10 bg-white/5 text-white/50 hover:text-white'
                                    )}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Local RPC config */}
                            <details className="group rounded-lg border border-white/10 bg-white/5">
                              <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-semibold text-white/80 hover:text-white">
                                <span>Local Node RPC</span>
                                <span className="text-xs text-white/35 group-open:hidden">Configure</span>
                                <span className="hidden text-xs text-white/35 group-open:inline">Hide</span>
                              </summary>
                              <div className="space-y-2.5 border-t border-white/10 px-3 pb-3 pt-2.5">
                                {dogeRpcProxyDisplayUrl ? (
                                  <p className="rounded border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1.5 text-[11px] text-emerald-200/80">
                                    Proxy ready — {dogeRpcProxyDisplayUrl}
                                  </p>
                                ) : (
                                  <p className="rounded border border-amber-500/25 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-200/80">
                                    {t('modal.settings.rpcProxyUnset')}
                                  </p>
                                )}
                                <label className="block">
                                  <span className="mb-1 block text-[10px] text-white/40">URL</span>
                                  <input value={settingsBroadcast.rpcUrl} onChange={e => { setRpcTestStatus('idle'); setRpcTestBlocks(null); setRpcTestError(null); setRpcTestSubline(null); setRpcTestIbd(false); setSettingsBroadcast(prev => ({ ...prev, rpcUrl: e.target.value })); }} placeholder="http://127.0.0.1:22555" className={INPUT_CLASS} />
                                </label>
                                <div className="flex gap-2">
                                  <label className="flex-1 block">
                                    <span className="mb-1 block text-[10px] text-white/40">Username</span>
                                    <input value={settingsBroadcast.rpcUser} onChange={e => { setRpcTestStatus('idle'); setSettingsBroadcast(prev => ({ ...prev, rpcUser: e.target.value })); }} placeholder="rpcuser" className={INPUT_CLASS} {...walletCredentialInputProps('dojakweb-rpc-user')} />
                                  </label>
                                  <label className="flex-1 block">
                                    <span className="mb-1 block text-[10px] text-white/40">RPC pass</span>
                                    <input
                                      type="text"
                                      value={settingsBroadcast.rpcPass}
                                      onChange={e => { setRpcTestStatus('idle'); setSettingsBroadcast(prev => ({ ...prev, rpcPass: e.target.value })); }}
                                      placeholder="rpcpassword"
                                      className={cx(INPUT_CLASS, '[webkit-text-security:disc]')}
                                      {...walletCredentialInputProps('dojakweb-rpc-pass')}
                                    />
                                  </label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label
                                    className="cursor-pointer rounded border border-dashed border-white/15 px-2.5 py-1.5 text-[11px] text-white/40 transition hover:border-[#D4A017]/40 hover:text-[#D4A017]"
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={async e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) await handleDogecoinConfDrop(file); }}
                                  >
                                    <input type="file" accept=".conf" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (file) await handleDogecoinConfDrop(file); }} />
                                    Drop dogecoin.conf
                                  </label>
                                  <button type="button" onClick={pinRpcFirstInBroadcastOrder} className="rounded border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/60 transition hover:bg-white/10">
                                    Prioritize RPC
                                  </button>
                                  <button type="button" onClick={handleClearRpcCredentials} className="rounded border border-red-500/25 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-300/80 transition hover:bg-red-500/10">
                                    Clear
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 border-t border-white/10 pt-2">
                                  <button type="button" onClick={() => void handleTestRpcConnection()} disabled={rpcTestStatus === 'loading'} className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 disabled:opacity-50">
                                    {rpcTestStatus === 'loading' ? 'Testing…' : 'Test Connection'}
                                  </button>
                                  {rpcTestStatus === 'ok' && rpcTestBlocks != null && (
                                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                                      <CheckCircleIcon className="h-4 w-4 shrink-0" />
                                      Block #{rpcTestBlocks.toLocaleString()}
                                      {rpcTestIbd && <span className="text-amber-300/90"> · syncing</span>}
                                    </span>
                                  )}
                                  {rpcTestStatus === 'err' && rpcTestError && (
                                    <span className="flex items-center gap-1.5 text-xs text-red-300">
                                      <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                                      {rpcTestError}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </details>
                          </div>
                        )}

                        {/* ══ DISPLAY TAB ══ */}
                        {settingsTab === 'display' && (
                          <div className="space-y-4">
                            {/* Theme */}
                            <div>
                              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Theme</span>
                              <div className="flex gap-2">
                                {(['dark', 'light'] as const).map((th) => (
                                  <button
                                    key={th}
                                    type="button"
                                    onClick={() => onThemeChange?.(th)}
                                    className={cx(
                                      'flex flex-1 items-center justify-center gap-2 border py-2.5 text-xs font-semibold uppercase tracking-wide transition',
                                      (th === 'dark' ? isDark : !isDark)
                                        ? 'border-[#D4A017] bg-[#D4A017]/10 text-white'
                                        : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10',
                                    )}
                                  >
                                    {th === 'dark' ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
                                    {th === 'dark' ? 'Dark' : 'Light'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Wallet Interface */}
                            <div>
                              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Wallet Interface</span>
                              <div className="flex gap-2">
                                {(['drawer', 'modal'] as const).map((iface) => (
                                  <button
                                    key={iface}
                                    type="button"
                                    onClick={() => gsSetWalletInterface(iface)}
                                    className={cx(
                                      'flex flex-1 items-center justify-center gap-2 border py-2.5 text-xs font-semibold uppercase tracking-wide transition',
                                      gsWalletInterface === iface
                                        ? 'border-[#D4A017] bg-[#D4A017]/10 text-white'
                                        : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10',
                                    )}
                                  >
                                    {iface === 'drawer' ? 'Drawer' : 'Modal'}
                                  </button>
                                ))}
                              </div>
                              <p className="mt-1 text-[10px] text-white/30">Takes effect on next open</p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <button
                                type="button"
                                onClick={() => setSettingsOneClickLocalSigning((v) => !v)}
                                className="flex w-full items-start gap-2.5 text-left"
                              >
                                <div className={cx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition', settingsOneClickLocalSigning ? 'border-[#D4A017] bg-[#D4A017]/20' : 'border-white/25')}>
                                  {settingsOneClickLocalSigning && <span className="text-[9px] font-bold text-[#D4A017]">✓</span>}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-semibold text-white">Auto-approve tiny local transactions</span>
                                  <p className="mt-0.5 text-[11px] leading-snug text-white/45">
                                    Allows unlocked Local Browser Wallet flows to sign and broadcast without another prompt when the estimated spend is below your limit. Keep off for review-every-time.
                                  </p>
                                </div>
                              </button>
                              <label className="mt-3 block">
                                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Auto-approve limit (DOGE)</span>
                                <input
                                  className={INPUT_CLASS}
                                  type="number"
                                  min="0.0001"
                                  max="100"
                                  step="0.001"
                                  value={settingsOneClickLocalSigningMaxDoge}
                                  onChange={(e) => setSettingsOneClickLocalSigningMaxDoge(e.target.value)}
                                  disabled={!settingsOneClickLocalSigning}
                                />
                              </label>
                            </div>

                            {/* Drawer Side */}
                            {gsWalletInterface === 'drawer' && (
                              <div>
                                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Drawer Side</span>
                                <div className="flex gap-2">
                                  {(['right', 'left'] as const).map((side) => (
                                    <button
                                      key={side}
                                      type="button"
                                      onClick={() => gsSetDrawerSide(side)}
                                      className={cx(
                                        'flex flex-1 items-center justify-center gap-2 border py-2.5 text-xs font-semibold uppercase tracking-wide transition',
                                        gsDrawerSide === side
                                          ? 'border-[#D4A017] bg-[#D4A017]/10 text-white'
                                          : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10',
                                      )}
                                    >
                                      {side === 'right' ? '→ Right' : '← Left'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <label className="block">
                                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Language</span>
                                <select className={INPUT_CLASS} value={stashLocale} onChange={(e) => setStashLocale(e.target.value as 'en' | 'ja')}>
                                  <option value="en">English</option>
                                  <option value="ja">日本語</option>
                                </select>
                              </label>
                              {fiatPrefs && (
                                <label className="block">
                                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Currency</span>
                                  <select className={INPUT_CLASS} value={fiatPrefs.currency} onChange={(e) => fiatPrefs.setCurrency(e.target.value as DojakwebFiatCurrency)}>
                                    {(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'] as const).map((code) => (
                                      <option key={code} value={code}>{code}</option>
                                    ))}
                                  </select>
                                </label>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <button type="button" onClick={() => setStep('dashboard')} className={cx('flex-1', SECONDARY_BUTTON)}>
                            {t('modal.settings.back')}
                          </button>
                          <button type="button" onClick={handleSaveSettings} className={cx('flex-1', PRIMARY_BUTTON)}>
                            {settingsSaved ? t('modal.settings.saved') : t('modal.settings.save')}
                          </button>
                        </div>
                      </form>
                    )}

                    {step === 'switch_wallet' && (
                      <div className="space-y-3">
                        <p className="text-xs leading-relaxed text-white/50">{t('modal.walletSwitcher.subtitle')}</p>
                        {renderWalletSwitcherGroups()}
                      </div>
                    )}

                    {step === 'address_book' && (
                      <AddressBookView
                        onSelectAddress={(addr) => {
                          setSendPrefillAddress(addr);
                          setStep('send');
                        }}
                      />
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <InscriptionTextInspectModal
        item={textInspectItem}
        open={Boolean(textInspectItem)}
        onClose={() => setTextInspectItem(null)}
      />

      <DuneSendModal
        isOpen={duneSendOpen}
        holding={duneSendHolding}
        siblingAccounts={
          activeBrowserSeedGroup?.accounts.map((acc) => ({
            address: acc.address,
            accountIndex: acc.accountIndex ?? 0,
            nickname: acc.nickname,
          })) ?? []
        }
        onClose={() => {
          setDuneSendOpen(false);
          setDuneSendHolding(undefined);
        }}
        onSuccess={() => {
          if (activeAddress) void fetchAssets(activeAddress);
        }}
      />
    </>
  );
}

export default DojakwebWalletModal;
