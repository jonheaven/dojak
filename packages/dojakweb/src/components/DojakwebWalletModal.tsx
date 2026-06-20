'use client';

import React, { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Dialog, Menu, Transition } from '@headlessui/react';
import {
  ArrowPathIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
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
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  CpuChipIcon,
  PhotoIcon,
  MusicalNoteIcon,
} from '@heroicons/react/24/outline';
import { Usb } from 'lucide-react';
import { WalletMenuItems } from './wallet/WalletMenuItems';
import { walletCredentialInputProps, walletSecretInputProps } from '../lib/wallet-secret-input';
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
import { findSeedGroupIndexForAddress, groupBrowserWalletsBySeed } from '../lib/wallet-seed-groups';
import { ConfirmationReadSourcesBar } from './chain/ConfirmationReadSourcesBar';
import { decryptText, encryptText, pbkdf2IterationsForSecretStrength } from '../lib/secureStorage';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { toast } from 'sonner';
import type { SeedMaterial, WalletData, WalletType } from '../types/wallet';
import { walletDataApi, getWalletDataProviderConfig, setWalletDataProviderConfig } from '../utils/api';
import { browserRpcProxyAbsoluteUrl, fetchRpcDetailedHealth } from '../lib/rpc-proxy-client';
import {
  testAllBroadcastRelayHealths,
  testBroadcastRelayHealth,
} from '../lib/broadcast/relayHealth';
import type { MyDogeInscription, DRC20Token, WalletDataProviderType, DogeTransaction } from '../utils/api';
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
  type DogeTxExplorerId,
} from '../utils/dogeTxExplorer';
import { DogeCurrencyIcon } from './DogeCurrencyIcon';
import { QuantumToggle } from './QuantumToggle';
import {
  broadcastQuantumCommitmentTx,
  type QuantumTxResult,
} from '../lib/dogetag/broadcastQuantumTx';
import { getQuantumConfig } from '../utils/quantum-settings';
import type { PQCAlgorithm } from '../lib/quantum';
import { useGlobalStore } from '../stores/globalStore';
import { useWalletStore } from '../stores/walletStore';
import {
  buildDxRegisterPayload,
  buildDxSigningMessage,
  normalizeDxXHandle,
  parseTweetIdFromInput,
  type DxRegisterPayload,
} from '../lib/dx/protocol';
import {
  dxConfirm,
  dxInitiate,
  dxResolvedBadgeImageUrl,
  dxVisualStatusMessage,
  isCommandDogDxConfigured,
} from '../lib/dx/commandDogApi';
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
import { NetworkChainBadge } from './dogeos/NetworkChainBadge';
import { ChainTxBanner } from './dogeos/ChainTxBanner';
import { NetworkSwitcher } from './dogeos/NetworkSwitcher';
import { DogecoinL1BalanceCard } from './dogeos/DogecoinL1BalanceCard';
import { DogeOSBalanceCard } from './dogeos/DogeOSBalanceCard';
import { DogeosSeedSync } from './dogeos/DogeosSeedSync';
import { DogeosEcosystemSettings } from './dogeos/DogeosEcosystemSettings';
import { useDojakwebFeatures } from '@/contexts/DojakwebFeaturesContext';

const DogeosBalanceHydratorLazy = lazy(async () => {
  const m = await import('./dogeos/DogeosBalanceHydrator');
  return { default: m.DogeosBalanceHydrator };
});
import { AddressBookModal } from './AddressBookModal';
import { DogePFPAvatar } from './DogePFPAvatar';
import { DogePFAHeaderControl } from './DogePFAHeaderControl';
import { useDogePFP } from '../hooks/useDogePFP';
import { useDogePFA } from '../hooks/useDogePFA';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';
import { TechDetails } from './ui/tech-details';

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
}

type WalletStep =
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
  | 'set_name'
  | 'send_inscription'
  | 'list_inscription';

type SettingsTab = 'data' | 'network' | 'display' | 'ecosystem';
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

type DisplayDogeTransaction = DogeTransaction & {
  quantumProtected?: boolean;
  quantumCommitment?: {
    algorithm: string;
    tag: string;
    commitmentHex: string;
  };
  localOnly?: boolean;
};

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
  if (cfg.walletDataProvider === 'wzrd') return { label: t('modal.dataProvider.wzrd') };
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
const SEND_MAX_FEE_RESERVE_DOGE = 0.5;

function formatDogeAmountForInput(doge: number): string {
  if (!Number.isFinite(doge) || doge <= 0) return '';
  const satFloored = Math.floor(doge * 1e8) / 1e8;
  const s = satFloored.toFixed(8);
  const trimmed = s.replace(/\.?0+$/, '');
  return trimmed === '' ? '0' : trimmed;
}

const PRIMARY_BUTTON = 'bg-neutral-200 hover:bg-white text-black font-bold py-2 px-4 rounded-none shadow-md transition';
const SECONDARY_BUTTON = 'bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-none shadow-md transition border border-zinc-700';
const DANGER_BUTTON = 'bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-none shadow-md transition';
const MODAL_SURFACE = 'bg-[#0A0A0A]/95 text-text-primary rounded-none p-6 shadow-doge border border-border-primary';
/** Full-bleed phone dock: opaque app chrome, single inner edge toward the page (largest common flagship width ≈ 430 CSS px). */
const DRAWER_SURFACE_PHONE_RIGHT =
  'bg-[#0A0A0A] text-text-primary border-l border-border-primary shadow-2xl';
const DRAWER_SURFACE_PHONE_LEFT =
  'bg-[#0A0A0A] text-text-primary border-r border-border-primary shadow-2xl';
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
        'min-h-9 rounded-none px-3 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}

export function DojakwebWalletModal({
  isOpen,
  onClose,
  isDark = true,
  initialStep = 'entry',
  initialSettingsTab = 'data',
  openNonce = 0,
  mode = 'drawer',
  drawerSide = 'right',
  onThemeChange,
}: DojakwebWalletModalProps) {
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
  } = useUnifiedWallet();
  const { t, locale: stashLocale, setLocale: setStashLocale } = useDojakwebI18n();
  const fiatPrefs = useDojakwebFiatOptional();
  const { pfpInscriptionId, setDogePFP, clearDogePFP } = useDogePFP();
  const { pfaInscriptionId, setDogePFA, clearDogePFA } = useDogePFA();

  const [step, setStep] = useState<WalletStep>('entry');
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
  const [savedLocalWallets, setSavedLocalWallets] = useState<WalletData[]>([]);
  const [selectedLocalWalletAddress, setSelectedLocalWalletAddress] = useState<string | null>(null);
  const [walletNameDraft, setWalletNameDraft] = useState('');
  const [isSavingWalletName, setIsSavingWalletName] = useState(false);
  const [assetType, setAssetType] = useState<'nft' | 'drc20' | 'treats'>('nft');
  const [revealPassword, setRevealPassword] = useState('');
  const [inscriptions, setInscriptions] = useState<MyDogeInscription[]>([]);
  const [drc20Tokens, setDrc20Tokens] = useState<DRC20Token[]>([]);
  const [treatsTokens, setTreatsTokens] = useState<Array<{ tick: string; balance: string }>>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendTxid, setSendTxid] = useState<string | null>(null);
  const [sendQuantumResult, setSendQuantumResult] = useState<QuantumTxResult | null>(null);
  const [quantumEnabled, setQuantumEnabled] = useState(() => getQuantumConfig().suggestQuantumByDefault);
  const [quantumAlgorithm, setQuantumAlgorithm] = useState<PQCAlgorithm>(() => getQuantumConfig().defaultAlgorithm);
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
  const [dxFeeRate, setDxFeeRate] = useState(100_000);
  const [dxRegisterInscriptionId, setDxRegisterInscriptionId] = useState<string | null>(null);
  const [dxCardInscriptionId, setDxCardInscriptionId] = useState<string | null>(null);
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
  const activeAddress = activeWalletSummary?.address ?? pendingWallet?.address ?? null;
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

  const dogeosEnabled = useWalletStore((s) => s.dogeosEnabled);
  const pureDogeosMode = useWalletStore((s) => s.pureDogeosMode);
  const currentNetwork = useWalletStore((s) => s.currentNetwork);
  const dogeosAddress = useWalletStore((s) => s.dogeosAddress);
  const dogeosBalance = useWalletStore((s) => s.dogeosBalance);
  const setDogecoinBalance = useWalletStore((s) => s.setDogecoinBalance);
  const resetEvmSession = useWalletStore((s) => s.resetEvmSession);
  const { dogeosEvm: dogeosFeatureOn } = useDojakwebFeatures();
  const dogeosUi = dogeosFeatureOn && dogeosEnabled;

  useEffect(() => {
    if (!connected) {
      setDogecoinBalance('');
      return;
    }
    setDogecoinBalance(
      Number.isFinite(balance) ? balance.toLocaleString(undefined, { maximumFractionDigits: 8 }) : String(balance)
    );
  }, [balance, connected, setDogecoinBalance]);

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

  const handleDxInscribeRegisterJson = useCallback(async () => {
    if (!dxPayload || !activeAddress) return;
    if (walletType === 'dogewatch') {
      toast.info(
        'Register JSON is ready. Inscription PSBTs are built by command.dog — copy the payload or complete inscribe via the API; sign each PSBT on Dogewatch when prompted.',
      );
      return;
    }
    if (walletType !== 'browser' || !browser.wallet?.privateKey) {
      toast.error(t('modal.verification.dxInscribeNeedBrowser'));
      return;
    }
    setDxInscribeBusy(true);
    try {
      const json = JSON.stringify(dxPayload);
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
        privateKeyWIF: browser.wallet.privateKey,
        feeRate: fee,
        excludedOutpoints: extractProtectedOutpoints(inscriptions),
      });
      await broadcastSignedDoginalChain(plan);
      setDxRegisterInscriptionId(plan.inscriptionId);
      toast.success(t('modal.verification.dxInscribeRegisterOk', { id: plan.inscriptionId }));
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

  const handleSendMax = useCallback(() => {
    if (!connected) {
      toast.info(t('modal.send.maxNeedWallet'));
      return;
    }
    const maxSpendable = balance - SEND_MAX_FEE_RESERVE_DOGE;
    if (!Number.isFinite(maxSpendable) || maxSpendable <= 0) {
      toast.info(t('modal.send.maxInsufficient', { reserve: SEND_MAX_FEE_RESERVE_DOGE }));
      setSendAmount('');
      return;
    }
    setSendAmount(formatDogeAmountForInput(maxSpendable));
  }, [balance, connected, t, toast]);



  const describeSendError = useCallback((rawError: unknown, quantum: boolean): string => {
    const message = rawError instanceof Error ? rawError.message : String(rawError ?? 'Unknown error');
    if (/insufficient funds/i.test(message)) {
      return quantum
        ? 'Insufficient funds for this send. The optional PQC attachment adds a small extra output fee on top of the DOGE amount.'
        : 'Insufficient funds for this send.';
    }
    if (/wallet.*locked/i.test(message) || /private key/i.test(message)) {
      return quantum
        ? 'PQC attachment requires your local Dojakweb browser wallet unlocked so it can generate the commitment locally.'
        : 'Unlock your wallet and try again.';
    }
    if (/address/i.test(message)) {
      return 'Enter a valid Dogecoin recipient address.';
    }
    return message;
  }, []);

  const pushLocalTransaction = useCallback((tx: DisplayDogeTransaction) => {
    setLocalRecentTransactions((prev) => {
      const next = [tx, ...prev.filter((item) => item.txid !== tx.txid)];
      return next.slice(0, 12);
    });
  }, []);

  const handleSendDoge = useCallback(async () => {
    if (!connected || !activeAddress) {
      setSendError('Connect a wallet before sending DOGE.');
      return;
    }

    const trimmedRecipient = recipientAddress.trim();
    const amount = Number(sendAmount);
    if (!trimmedRecipient) {
      setSendError('Enter a recipient address.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setSendError('Enter a valid DOGE amount.');
      return;
    }

    setSendBusy(true);
    setSendStatus(quantumEnabled ? 'Preparing PQC attachment…' : 'Broadcasting transaction…');
    setSendError(null);
    setSendTxid(null);
    setSendQuantumResult(null);

    try {
      let txid = '';
      let quantumResult: QuantumTxResult | null = null;

      if (quantumEnabled) {
        if (!isBrowserWallet) {
          throw new Error('Optional PQC attachment currently requires the local Dojakweb browser wallet.');
        }
        const wallet = browser.wallet ?? await browser.loadWallet(activePassword);
        if (!wallet?.privateKey) {
          throw new Error('Local browser wallet is locked.');
        }
        setSendStatus('Generating PQC attachment and signing…');
        quantumResult = await broadcastQuantumCommitmentTx({
          toAddress: trimmedRecipient,
          amountSatoshis: Math.round(amount * 100_000_000),
          fromAddress: activeAddress,
          privateKeyWIF: wallet.privateKey,
          algorithm: quantumAlgorithm,
          includeCarrier: false,
          feeRate: 1000,
        });
        txid = quantumResult.txid;
        setSendQuantumResult(quantumResult);
      } else {
        txid = await sendTransaction(trimmedRecipient, amount);
      }

      setSendTxid(txid);
      pushLocalTransaction({
        txid,
        type: 'sent',
        amount,
        address: trimmedRecipient,
        confirmations: 0,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        pending: true,
        quantumProtected: quantumEnabled,
        quantumCommitment: quantumEnabled && quantumResult ? {
          algorithm: quantumAlgorithm,
          tag: quantumAlgorithm === 'falcon512' ? 'FLC1' : 'DIL2',
          commitmentHex: [...quantumResult.commitment.commitment]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
        } : undefined,
        localOnly: true,
      });
      void refreshBalance().catch(() => {});
      toast.success(
        quantumEnabled
          ? `Transaction sent (${txid.slice(0, 12)}…) — OP_RETURN PQC R&D tag included`
          : `Transaction broadcast: ${txid.slice(0, 12)}…`,
      );
    } catch (err) {
      setSendError(describeSendError(err, quantumEnabled));
    } finally {
      setSendBusy(false);
      setSendStatus(null);
    }
  }, [
    activeAddress,
    activePassword,
    browser,
    connected,
    describeSendError,
    isBrowserWallet,
    pushLocalTransaction,
    quantumAlgorithm,
    quantumEnabled,
    recipientAddress,
    refreshBalance,
    sendAmount,
    sendTransaction,
    toast,
  ]);

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
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [trueCancelBusy, setTrueCancelBusy] = useState(false);
  const [trueCancelError, setTrueCancelError] = useState<string | null>(null);

  // ── Settings state ──
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('data');
  const [settingsProvider, setSettingsProvider] = useState<WalletDataProviderType>('mydoge');
  const [settingsCustomUrl, setSettingsCustomUrl] = useState('');
  const [settingsMergeInuBits, setSettingsMergeInuBits] = useState(true);
  const [settingsBroadcast, setSettingsBroadcast] = useState<BroadcastConfig>({
    broadcastProvider: 'auto', broadcastPriority: DEFAULT_BROADCAST_PRIORITY, rpcUrl: 'http://127.0.0.1:22555', rpcUser: '', rpcPass: '', tatumApiKey: '',
  });
  const [draggedBroadcastProvider, setDraggedBroadcastProvider] = useState<BroadcastRelayProvider | null>(null);
  const [disabledBroadcastProviders, setDisabledBroadcastProviders] = useState<BroadcastRelayProvider[]>([]);
  const [showBroadcastInfo, setShowBroadcastInfo] = useState<BroadcastRelayProvider | null>(null);
  const [showPriceInfo, setShowPriceInfo] = useState<string | null>(null);
  const [settingsChainExplorer, setSettingsChainExplorer] = useState<DogeTxExplorerId>('sochain');
  const [settingsPriceSources, setSettingsPriceSources] = useState<DogePriceSourceId[]>(
    () => getDogePriceSourceConfig().sources
  );
  const [draggedPriceSourceId, setDraggedPriceSourceId] = useState<DogePriceSourceId | null>(null);
  const [walletSwitcherModalOpen, setWalletSwitcherModalOpen] = useState(false);
  const [isAddressBookModalOpen, setIsAddressBookModalOpen] = useState(false);

  useEffect(() => {
    if (!dogeosFeatureOn && settingsTab === 'ecosystem') {
      setSettingsTab('data');
    }
  }, [dogeosFeatureOn, settingsTab]);
  const [walletDrawerHostEl, setWalletDrawerHostEl] = useState<HTMLDivElement | null>(null);
  const walletDrawerHostRef = useCallback((node: HTMLDivElement | null) => {
    setWalletDrawerHostEl(node);
  }, []);
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
  const mergedTransactions: DisplayDogeTransaction[] = [
    ...localRecentTransactions,
    ...transactions.filter((tx) => !localRecentTransactions.some((localTx) => localTx.txid === tx.txid)),
  ];

  const resetSendState = useCallback(() => {
    setSendBusy(false);
    setSendStatus(null);
    setSendError(null);
    setSendTxid(null);
    setSendQuantumResult(null);
  }, []);

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
    const key = getBackupFlag(activeAddress);
    setNeedsBackup(key ? localStorage.getItem(key) !== 'true' : false);
  }, [activeAddress, step, connected]);

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
      setPassword('');
      setConfirmPassword('');
      setUnlockPassword('');
      setImportValue('');
      setRecipientAddress('');
      setSendAmount('');
      setShowSecretPhrase(false);
      await refreshSavedLocalWallets();

      if (!connected && localStorage.getItem(BROWSER_WALLET_RESTORE_BLOCK_KEY) === 'true') {
        setStep('entry');
        return;
      }

      if (connected && address) {
        const bannerKey = getTemporaryBannerFlag(address);
        setShowTemporaryBanner(bannerKey ? localStorage.getItem(bannerKey) === 'true' : false);
        setStep('dashboard');
        return;
      }

      const hasWallet = await browser.hasWallet();
      if (!hasWallet) {
        setStep('entry');
        return;
      }

      // Guard: hasWallet() true but listWallets() empty (stale localStorage).
      const walletList = await new BrowserWallet().listWallets();
      if (!walletList.length) {
        setStep('entry');
        return;
      }

      const current = localStorage.getItem('dojakweb_wallet_current');
      const encrypted = await new BrowserWallet().isEncrypted(current ?? undefined);
      setIsEncryptedWallet(encrypted);

      if (encrypted) {
        setStep('unlock');
        return;
      }

      try {
        const loaded = await browser.loadWallet();
        if (loaded) {
          await browser.connect(loaded);
          const bannerKey = getTemporaryBannerFlag(loaded.address);
          setShowTemporaryBanner(bannerKey ? localStorage.getItem(bannerKey) === 'true' : false);
          setStep('dashboard');
          return;
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : t('modal.errors.loadWallet'));
      }

      setStep('entry');
    };

    void syncState();
  }, [address, browser.connect, browser.hasWallet, browser.loadWallet, connected, isOpen, refreshSavedLocalWallets]);

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
      setPendingWallet(created);
      setPendingSeed({ mnemonic: created.mnemonic, passphrase: '' });
      setShowSecretPhrase(true);
      setStep('reveal');
      toast.success(t('modal.toast.newWalletBackupPhrase'), { duration: 5000 });
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
    saveOpts?: { pbkdf2Iterations?: number }
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
    const passwordKey = getStoredPasswordFlag(walletToPersist.address);
    const bannerKey = getTemporaryBannerFlag(walletToPersist.address);
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
    setPendingWallet(walletToPersist);
    await refreshSavedLocalWallets();
    setStep('dashboard');
    toast.success(persistPassword ? t('modal.toast.walletSecured') : t('modal.toast.walletReadyNoPw'), {
      duration: 5000,
    });

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
      const loaded = await browser.loadWallet(secret);
      if (!loaded) {
        throw new Error(t('modal.throws.unlockWrong'));
      }
      await browser.connect(loaded);
      setWalletNameDraft(loaded.nickname?.trim() || '');
      setActivePassword(secret);
      setUnlockPassword('');
      setShowTemporaryBanner(false);
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
    if (password !== confirmPassword) {
      setError(t('modal.errors.passwordsNoMatch'));
      return;
    }
    if (!password.trim()) {
      setError(t('modal.errors.enterPassword'));
      return;
    }
    if (newPrimarySecret === 'pin') {
      if (!/^\d{6,}$/.test(password.trim())) {
        setError(t('modal.errors.pinInvalid'));
        return;
      }
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

  const handleConnectSavedLocalWallet = async (targetAddress: string) => {
    setIsBusy(true);
    setError(null);
    try {
      localStorage.removeItem(BROWSER_WALLET_RESTORE_BLOCK_KEY);
      const storage = new BrowserWallet();
      await storage.selectWallet(targetAddress);
      setSelectedLocalWalletAddress(targetAddress);
      const encrypted = await storage.isEncrypted(targetAddress);
      setIsEncryptedWallet(encrypted);
      if (encrypted) {
        setStep('unlock');
        return;
      }
      const loaded = await browser.loadWallet();
      if (!loaded) {
        throw new Error(t('modal.throws.loadSelectedWallet'));
      }
      await browser.connect(loaded);
      setWalletNameDraft(loaded.nickname?.trim() || '');
      setStep('dashboard');
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

  const handleSwitchBrowserSeedWallet = async (delta: -1 | 1) => {
    if (!isBrowserWallet) return;
    const groups = localSeedWalletGroups;
    if (groups.length <= 1) return;
    const addr = browser.wallet?.address ?? activeAddress ?? undefined;
    const gi = findSeedGroupIndexForAddress(groups, addr);
    const nextGi = (gi + delta + groups.length) % groups.length;
    const target = groups[nextGi]?.accounts[0];
    if (!target?.address) return;
    setIsBusy(true);
    setError(null);
    try {
      await createDojakwebSessionSecretStore().clearSecret();
      await browser.selectWallet(target.address);
      setSelectedLocalWalletAddress(target.address);
      const enc = await new BrowserWallet().isEncrypted(target.address);
      setIsEncryptedWallet(enc);
      if (enc) {
        setActivePassword(undefined);
        setUnlockPassword('');
        setStep('unlock');
      } else {
        const loaded = await browser.loadWallet();
        if (!loaded) {
          throw new Error(t('modal.throws.loadSelectedWallet'));
        }
        await browser.connect(loaded);
        setWalletNameDraft(loaded.nickname?.trim() || '');
        setStep('dashboard');
        await browser.refreshBalance({ silent: true });
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.connectWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSwitchBrowserAccount = async (delta: -1 | 1) => {
    if (!isBrowserWallet || !activePassword) {
      toast.error(t('modal.toast.reunlockForAccountSwitch'));
      return;
    }
    const currentIdx = browser.wallet?.accountIndex ?? 0;
    const nextIdx = currentIdx + delta;
    if (nextIdx < 0) return;
    setIsBusy(true);
    setError(null);
    try {
      const switched = await browser.switchAccount(nextIdx, activePassword);
      await browser.connect(switched);
      setWalletNameDraft(switched.nickname?.trim() || '');
      await refreshSavedLocalWallets();
      await browser.refreshBalance({ silent: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('modal.errors.connectWallet'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnectWallet = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await createDojakwebSessionSecretStore().clearSecret();
      await disconnect();
      resetEvmSession();
      localStorage.setItem(BROWSER_WALLET_RESTORE_BLOCK_KEY, 'true');
      setPendingWallet(null);
      setPendingSeed(null);
      setShowTemporaryBanner(false);
      setNeedsBackup(false);
      setIsEncryptedWallet(false);
      setStep('entry');
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
   * - If it is already password-protected, close the modal and disconnect the unlocked
   *   in-browser wallet so the next action forces the unlock flow again.
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
      const key = getBackupFlag(activeAddress);
      if (key) localStorage.setItem(key, 'true');
    }
    toast.success(t('modal.toast.backupConfirmed'), { duration: 5000 });
    if (connected) {
      setStep('dashboard');
      return;
    }
    setStep('password');
  };

  const handleRemoveWallet = async () => {
    setIsBusy(true);
    try {
      await browser.removeWallet();
      await disconnect();
      localStorage.removeItem(BROWSER_WALLET_RESTORE_BLOCK_KEY);
      setPendingWallet(null);
      setPendingSeed(null);
      setStep('entry');
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
      const [nfts, tokens, treats] = await Promise.all([
        walletDataApi.fetchInscriptions(address),
        walletDataApi.fetchDRC20Tokens(address),
        walletDataApi.fetchTreatsBalances(address),
      ]);
      setInscriptions(nfts);
      setDrc20Tokens(tokens);
      setTreatsTokens(treats);
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

  const openSettings = () => {
    const dp = getWalletDataProviderConfig();
    setSettingsProvider(dp.walletDataProvider);
    setSettingsCustomUrl(dp.walletDataProviderUrl || '');
    setSettingsMergeInuBits(dp.mergeInuBitsInscriptions !== false);
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
    setWalletDataProviderConfig({
      walletDataProvider: settingsProvider,
      walletDataProviderUrl: settingsCustomUrl || undefined,
      mergeInuBitsInscriptions: settingsMergeInuBits,
    });
    saveBroadcastConfig(
      migrateBroadcastToAuto({
        ...settingsBroadcast,
        broadcastPriority: normalizeBroadcastPriority(settingsBroadcast.broadcastPriority),
      })
    );
    saveDogeTxExplorerPreference(settingsChainExplorer);
    setDogePriceSourceConfig({ sources: settingsPriceSources });
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
      setStep(initialStep);
      setSettingsTab(initialSettingsTab);
    }
  }, [isOpen, initialStep, initialSettingsTab, openNonce]);

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

  useEffect(() => {
    if (step !== 'send') return;
    setSendError(null);
  }, [step]);

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
      const w = await browser.loadWallet(activePassword);
      if (!w) throw new Error(t('modal.throws.walletLocked'));

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
        const w = await browser.loadWallet(activePassword);
        if (!w) throw new Error(t('modal.throws.walletLocked'));
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
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wzrd.dog';
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
      const w = await browser.loadWallet(activePassword);
      if (!w) throw new Error(t('modal.throws.walletLockedShort'));

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

  useEffect(() => {
    if (mode !== 'drawer' || !walletSwitcherModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setWalletSwitcherModalOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [mode, walletSwitcherModalOpen]);

  const renderWalletSwitcherGroups = () => {
    const allGroups = [
      {
        key: 'local' as const,
        label: t('modal.walletSwitcher.tab.local'),
        hint: t('modal.walletSwitcher.group.localHint'),
        items: localWallets,
        HeaderIcon: CpuChipIcon,
      },
      {
        key: 'ext' as const,
        label: t('modal.walletSwitcher.tab.ext'),
        hint: t('modal.walletSwitcher.group.extHint'),
        items: extensionWallets,
        HeaderIcon: WalletIcon,
      },
      {
        key: 'hw' as const,
        label: t('modal.walletSwitcher.tab.hw'),
        hint: t('modal.walletSwitcher.group.hwHint'),
        items: hardwareWallets,
        HeaderIcon: Usb,
      },
    ].filter((g) => g.items.length > 0);

    return (
      <div className="space-y-5">
        {allGroups.map((group) => {
          const GroupHeaderIcon = group.HeaderIcon;
          return (
            <div key={group.key} className="space-y-2" title={group.hint}>
              <div className="flex items-center gap-2 px-0.5">
                <GroupHeaderIcon className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  {group.label}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map((wallet) => (
                  <button
                    key={wallet.type}
                    type="button"
                    onClick={() => {
                      if (!wallet.isActive) {
                        setActiveWallet(wallet.type);
                        setWalletSwitcherModalOpen(false);
                      }
                    }}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                      wallet.isActive
                        ? 'border-[#FCD34D] bg-[#FCD34D]/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                    aria-pressed={wallet.isActive}
                    title={t('modal.walletSwitcher.useAsActive', { label: wallet.label })}
                  >
                    {(() => {
                      const src = getWalletSourceIndicator(wallet.type, t);
                      return (
                        <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', wallet.isActive ? 'bg-[#FCD34D]' : src.dot)} />
                      );
                    })()}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{wallet.label}</span>
                      <span className="block text-xs text-white/50">
                        {wallet.address ? truncateAddress(wallet.address) : t('modal.walletSwitcher.connected')}
                      </span>
                    </span>
                    {wallet.isActive ? (
                      <span className="shrink-0 rounded border border-[#FCD34D]/30 bg-[#FCD34D]/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[#FCD34D]">
                        {t('modal.walletSwitcher.active')}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-white/30 transition group-hover:text-white/60">
                        Switch →
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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
          style={{ zIndex: 9999 }}
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
                  ref={walletDrawerHostRef}
                  className={cx(
                    'ds-wallet-dashboard relative flex flex-col overflow-hidden',
                    isDrawerMode
                      ? cx(
                          'pointer-events-auto fixed top-0 z-[10001] flex h-[100dvh] max-h-[100dvh] min-h-0 w-[min(100dvw,430px)] max-w-[min(100dvw,430px)] flex-col overflow-hidden',
                          isDrawerLeft ? 'left-0' : 'right-0',
                        )
                      : 'w-full max-h-[92vh] max-w-lg',
                    isDrawerMode
                      ? isDrawerLeft
                        ? DRAWER_SURFACE_PHONE_LEFT
                        : DRAWER_SURFACE_PHONE_RIGHT
                      : MODAL_SURFACE,
                  )}
                >
                  <div className="shrink-0 border-b border-white/10 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {step !== 'dashboard' && step !== 'unlock' && (
                            <button
                              type="button"
                              onClick={() => setStep('dashboard')}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                              aria-label={t('modal.aria.backToWallet')}
                              title={t('modal.aria.backToWallet')}
                            >
                              <ArrowLeftIcon className="h-4 w-4" />
                            </button>
                          )}
                          <Dialog.Title className="text-xl font-bold text-white">
                          {step === 'import'
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
                                      : step === 'unlock'
                                          ? t('modal.title.myWallet')
                                          : step === 'dashboard'
                                          ? (
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span>{t('modal.title.myWallet')}</span>
                                                {dogeosUi && connected ? (
                                                  <NetworkChainBadge network={pureDogeosMode ? 'dogeos' : currentNetwork} />
                                                ) : null}
                                                {connected && (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={() => setIsAddressBookModalOpen(true)}
                                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                                                      aria-label="Address Book"
                                                      title="Address Book"
                                                    >
                                                      <TagIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setWalletSwitcherModalOpen(true);
                                                      }}
                                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                                                      aria-label={t('modal.aria.switchWallet')}
                                                      title="Switch Connected Wallet"
                                                    >
                                                      <WalletIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={openSettings}
                                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                                                      aria-label={t('modal.aria.settings')}
                                                      title={t('modal.aria.walletSettingsTitle')}
                                                    >
                                                      <Cog6ToothIcon className="h-4 w-4" />
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            )
                                          : step === 'settings'
                                          ? t('modal.title.walletSettings')
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
                          {(step === 'unlock' || step === 'dashboard') && isBrowserWallet && showTemporaryBanner ? (
                            <button
                              type="button"
                              onClick={() => toast.warning(t('modal.toast.setPasswordBanner'))}
                              className="inline-flex h-6 w-6 items-center justify-center rounded border border-amber-400/40 bg-amber-500/15 text-amber-300 transition hover:bg-amber-500/25"
                              aria-label={t('modal.aria.checkWalletStatus')}
                              title={t('modal.aria.setPasswordSecureTitle')}
                            >
                              <ExclamationTriangleIcon className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        {step === 'entry' && (
                          <p className="mt-3 text-center text-sm leading-6 text-[#D4D4D4] sm:pr-8">
                            {t('modal.tagline.builtIn')}
                          </p>
                        )}
                        {step === 'unlock' && (
                          <p className="mt-3 text-sm leading-6 text-[#D4D4D4]">
                            {t('modal.tagline.builtIn')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onClose}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                          aria-label={t('modal.aria.closeWallet')}
                          title="Close"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-x-visible overflow-y-auto overscroll-contain px-4 py-4">
                    {error ? (
                      <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                      </div>
                    ) : null}

                    {(step === 'dashboard' || (step === 'settings' && settingsTab === 'ecosystem')) && dogeosFeatureOn && (
                      <DogeosSeedSync
                        dogecoinAddress={activeAddress}
                        isBrowserWallet={isBrowserWallet}
                        dogeosEnabled={dogeosEnabled}
                        unlockPassword={activePassword}
                        pendingMnemonic={pendingSeed?.mnemonic ?? null}
                        pendingPassphrase={pendingSeed?.passphrase}
                      />
                    )}

                    {step === 'entry' && (
                      <div className="space-y-4">
                        {savedLocalWallets.length > 0 ? (
                          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                              {t('modal.savedWallets.heading')}
                            </div>
                            <div className="space-y-2">
                              {savedLocalWallets.map((item) => (
                                <button
                                  key={item.address}
                                  type="button"
                                  onClick={() => handleConnectSavedLocalWallet(item.address)}
                                  className={cx(
                                    'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition',
                                    selectedLocalWalletAddress === item.address
                                      ? 'border-yellow-400/50 bg-yellow-400/10'
                                      : 'border-white/10 bg-white/5 hover:border-white/25'
                                  )}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="shrink-0 relative">
                                      <KeyIcon className={cx('h-5 w-5', (item as any).encrypted ? 'text-white/80' : 'text-white/25')} />
                                      {(item as any).encrypted && (
                                        <LockClosedIcon className="absolute -bottom-1 -right-1.5 h-3 w-3 text-yellow-400/90" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-white truncate">
                                        {item.nickname?.trim() || `${item.address.slice(0, 8)}...${item.address.slice(-6)}`}
                                      </div>
                                      <div className="text-[11px] text-white/55">
                                        {(item as any).encrypted ? t('modal.savedWallets.encrypted') : t('modal.savedWallets.passwordless')}
                                        {typeof item.accountIndex === 'number'
                                          ? ` · ${t('modal.savedWallets.account', { index: String(item.accountIndex) })}`
                                          : ''}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="shrink-0 rounded-full border border-[#C8A84B]/40 bg-[#C8A84B]/15 px-3 py-1 text-xs font-semibold text-[#D4A84B] transition hover:bg-[#C8A84B]/25">
                                    {t('modal.savedWallets.connect')}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <Button onClick={handleCreateWallet} disabled={isBusy} className={cx('w-full', PRIMARY_BUTTON)}>
                          {t('modal.entry.createNew')}
                        </Button>
                        <Button onClick={() => setStep('import')} disabled={isBusy} className={cx('w-full', SECONDARY_BUTTON)}>
                          {t('modal.entry.import')}
                        </Button>
                      </div>
                    )}

                    {step === 'unlock' && (
                      <div className="space-y-4">
                        <div className="flex rounded-xl border border-white/10 bg-[#0A0A0A] p-1">
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
                            className="space-y-4"
                            autoComplete="off"
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (!isBusy) {
                                void handleUnlockWallet();
                              }
                            }}
                          >
                            <label className="block text-sm text-[#E5E5E5]">
                              <span className="mb-2 block">
                                {unlockMode === 'pin' ? t('modal.unlock.enterPin') : t('modal.unlock.enterPassword')}
                              </span>
                              {unlockMode === 'pin' ? (
                                <input
                                  type="password"
                                  value={unlockPassword}
                                  onChange={(event) => setUnlockPassword(event.target.value.replace(/\D/g, ''))}
                                  autoFocus
                                  className={INPUT_CLASS}
                                  {...walletSecretInputProps('dojakweb-unlock-pin', { pin: true })}
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
                            </label>
                            <div className="flex gap-3">
                              <Button type="button" onClick={() => setStep('entry')} className={cx('flex-1', SECONDARY_BUTTON)}>
                                {t('modal.unlock.goBack')}
                              </Button>
                              <Button
                                type="submit"
                                disabled={
                                  isBusy ||
                                  (unlockMode === 'pin' ? !/^\d{6,}$/.test(unlockPassword.trim()) : !unlockPassword.trim())
                                }
                                className={cx('flex-1', PRIMARY_BUTTON)}
                              >
                                {isBusy ? t('modal.unlock.unlocking') : t('modal.unlock.submit')}
                              </Button>
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
                          <Button onClick={() => (connected ? setStep("dashboard") : setStep("entry"))} className={cx("flex-1", SECONDARY_BUTTON)}>
                            {t('modal.reveal.goBack')}
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
                        className="space-y-4"
                        autoComplete="off"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!isBusy) {
                            void handleSetPassword();
                          }
                        }}
                      >
                        <div>
                          <span className="mb-2 block text-sm text-[#E5E5E5]">{t('modal.password.primaryLabel')}</span>
                          <div className="flex rounded-xl border border-white/10 bg-[#0A0A0A] p-1">
                            <button
                              type="button"
                              onClick={() => setNewPrimarySecret('password')}
                              className={cx(
                                'min-w-0 flex-1 rounded-lg py-2 px-1 text-center text-[11px] font-semibold leading-tight sm:text-xs transition',
                                newPrimarySecret === 'password' ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'
                              )}
                            >
                              {t('modal.password.primaryPassword')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewPrimarySecret('pin')}
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

                        <label className="block text-sm text-[#E5E5E5]">
                          <span className="mb-2 block">{t('modal.password.enter')}</span>
                          {newPrimarySecret === 'pin' ? (
                            <input
                              type="password"
                              value={password}
                              onChange={(event) => setPassword(event.target.value.replace(/\D/g, ''))}
                              className={INPUT_CLASS}
                              {...walletSecretInputProps('dojakweb-new-pin', { pin: true })}
                            />
                          ) : (
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
                          )}
                        </label>

                        <label className="block text-sm text-[#E5E5E5]">
                          <span className="mb-2 block">{t('modal.password.confirm')}</span>
                          {newPrimarySecret === 'pin' ? (
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(event) => setConfirmPassword(event.target.value.replace(/\D/g, ''))}
                              className={INPUT_CLASS}
                              {...walletSecretInputProps('dojakweb-confirm-pin', { pin: true })}
                            />
                          ) : (
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
                                aria-label={showConfirmPassword ? t('modal.aria.hidePassword') : t('modal.aria.showPassword')}
                              >
                                {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                              </button>
                            </div>
                          )}
                        </label>

                        <div className="flex items-center justify-between gap-3">
                          <Button type="button" onClick={handleSkipPassword} className={cx('min-w-32', SECONDARY_BUTTON)}>
                            {t('modal.password.skip')}
                          </Button>
                          <Button type="submit" disabled={isBusy || !password || !confirmPassword} className={cx('min-w-40', PRIMARY_BUTTON)}>
                            {t('modal.password.set')}
                          </Button>
                        </div>
                      </form>
                    )}

                    {step === 'dashboard' && (
                      <div className="space-y-3">
                        {connected && isBrowserWallet && savedLocalWallets.length > 0 ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="hidden shrink-0 text-[10px] uppercase tracking-wide text-white/40 sm:inline">
                                {t('modal.localNav.hdWallet')}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleSwitchBrowserSeedWallet(-1)}
                                disabled={isBusy || localSeedWalletGroups.length <= 1}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
                                aria-label={t('modal.localNav.prevSeed')}
                                title={t('modal.localNav.prevSeed')}
                              >
                                <ChevronLeftIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSwitchBrowserSeedWallet(1)}
                                disabled={isBusy || localSeedWalletGroups.length <= 1}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
                                aria-label={t('modal.localNav.nextSeed')}
                                title={t('modal.localNav.nextSeed')}
                              >
                                <ChevronRightIcon className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 border-l border-white/10 pl-3 sm:pl-4">
                              <span className="hidden shrink-0 text-[10px] uppercase tracking-wide text-white/40 sm:inline">
                                {t('modal.localNav.account')}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleSwitchBrowserAccount(-1)}
                                disabled={isBusy || (browser.wallet?.accountIndex ?? 0) <= 0}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
                                aria-label={t('modal.localNav.prevAccount')}
                                title={t('modal.localNav.prevAccount')}
                              >
                                <ChevronUpIcon className="h-4 w-4" />
                              </button>
                              <span className="min-w-[2.5rem] text-center text-xs font-semibold tabular-nums text-white/80">
                                #{browser.wallet?.accountIndex ?? 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleSwitchBrowserAccount(1)}
                                disabled={isBusy}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
                                aria-label={t('modal.localNav.nextAccount')}
                                title={t('modal.localNav.nextAccount')}
                              >
                                <ChevronDownIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {dogeosFeatureOn ? (
                          <Suspense fallback={null}>
                            <DogeosBalanceHydratorLazy
                              enabled={dogeosEnabled && isBrowserWallet && Boolean(activeAddress)}
                            />
                          </Suspense>
                        ) : null}
                        {/* ── Broadcast provider indicator ───────── */}
                        <div className="flex flex-wrap items-center gap-2 self-start">
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3">
                          {availableWallets.length > 1 && (() => {
                            const activeIdx = availableWallets.findIndex((w) => w.isActive);
                            const prevIdx = (activeIdx - 1 + availableWallets.length) % availableWallets.length;
                            const nextIdx = (activeIdx + 1) % availableWallets.length;
                            return (
                              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveWallet(availableWallets[prevIdx].type)}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                                  aria-label="Previous wallet"
                                  title={`Switch to ${availableWallets[prevIdx].label}`}
                                >
                                  <ChevronLeftIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWalletSwitcherModalOpen(true);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                                  title="Switch Connected Wallet"
                                >
                                  {(() => {
                                    const src = getWalletSourceIndicator(activeWalletSummary?.type ?? walletType ?? null, t);
                                    return (
                                      <>
                                        <span className={cx('h-2 w-2 shrink-0 rounded-full', src.dot)} />
                                        <span className="font-medium truncate">{activeWalletSummary?.label || src.label}</span>
                                        <span className="text-white/35 shrink-0">{activeIdx + 1}/{availableWallets.length}</span>
                                      </>
                                    );
                                  })()}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveWallet(availableWallets[nextIdx].type)}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                                  aria-label="Next wallet"
                                  title={`Switch to ${availableWallets[nextIdx].label}`}
                                >
                                  <ChevronRightIcon className="h-4 w-4" />
                                </button>
                              </div>
                            );
                          })()}
                          {/*
                            Grid: row 1 = balance | send/disconnect/menu (narrow col).
                            Row 2 = full-width address + copy/QR/lock so the address isn’t squeezed beside the action column.
                          */}
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
                            {activeWalletName ? (
                              <div className="col-span-2 flex items-center gap-1.5">
                                <span className="max-w-[180px] truncate text-sm text-white/80">{activeWalletName}</span>
                                {availableWallets.length <= 1 && (() => {
                                  const src = getWalletSourceIndicator(activeWalletSummary?.type ?? walletType ?? null, t);
                                  return (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5">
                                      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', src.dot)} />
                                      <span className={cx('text-[9px] font-semibold tracking-wide', src.text)}>{src.label}</span>
                                    </span>
                                  );
                                })()}
                              </div>
                            ) : null}

                            {dogeosUi && isBrowserWallet ? (
                              <>
                                <div className="col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <NetworkChainBadge network={pureDogeosMode ? 'dogeos' : currentNetwork} />
                                  {!pureDogeosMode ? <NetworkSwitcher className="sm:ml-auto" /> : null}
                                </div>
                                {connected ? (
                                  <div className="col-span-2 flex min-w-0 items-center gap-2">
                                    <Menu as="div" className="relative shrink-0">
                                      <Menu.Button
                                        type="button"
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                                        aria-label={t('modal.profileDpfp.avatarMenuAria')}
                                        title={t('modal.profileDpfp.avatarMenuAria')}
                                      >
                                        <DogePFPAvatar size="md" />
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
                                              {({ active }) => (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    clearDogePFP();
                                                    toast.message(t('modal.toast.dpfpCleared'));
                                                  }}
                                                  className={cx(
                                                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                    active ? 'bg-gray-700' : 'hover:bg-gray-800',
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
                                              {({ active }) => (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    clearDogePFA();
                                                    toast.message(t('modal.toast.dpfaCleared'));
                                                  }}
                                                  className={cx(
                                                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                    active ? 'bg-gray-700' : 'hover:bg-gray-800',
                                                  )}
                                                >
                                                  <MusicalNoteIcon className="h-4 w-4 shrink-0 text-amber-200/80" aria-hidden />
                                                  <span className="leading-tight">{t('modal.profileDpfa.clearPfa')}</span>
                                                </button>
                                              )}
                                            </Menu.Item>
                                          ) : null}
                                      </WalletMenuItems>
                                    </Menu>
                                    <DogePFAHeaderControl />
                                  </div>
                                ) : null}
                                {!pureDogeosMode ? (
                                  <div className="col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <DogecoinL1BalanceCard
                                      balanceDisplay={`${hideBalance ? '••••••' : balance.toLocaleString(undefined, { maximumFractionDigits: 8 })} DOGE`}
                                    />
                                    <DogeOSBalanceCard
                                      balanceDisplay={`${dogeosBalance || '…'} DOGE`}
                                      addressShort={
                                        dogeosAddress ? `${dogeosAddress.slice(0, 6)}…${dogeosAddress.slice(-4)}` : undefined
                                      }
                                    />
                                  </div>
                                ) : (
                                  <div className="col-span-2">
                                    <DogeOSBalanceCard
                                      balanceDisplay={`${dogeosBalance || '…'} DOGE`}
                                      addressShort={
                                        dogeosAddress ? `${dogeosAddress.slice(0, 6)}…${dogeosAddress.slice(-4)}` : undefined
                                      }
                                    />
                                    <p className="mt-2 text-xs text-indigo-200/80">{t('modal.dogeos.pureDashboardHint')}</p>
                                  </div>
                                )}
                              </>
                            ) : (
                            <div className="flex min-w-0 items-start gap-3">
                              {connected ? (
                                <div className="flex shrink-0 items-center gap-2 self-center pt-0.5">
                                  <Menu as="div" className="relative shrink-0">
                                    <Menu.Button
                                      type="button"
                                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                                      aria-label={t('modal.profileDpfp.avatarMenuAria')}
                                      title={t('modal.profileDpfp.avatarMenuAria')}
                                    >
                                      <DogePFPAvatar size="md" />
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
                                            {({ active }) => (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  clearDogePFP();
                                                  toast.message(t('modal.toast.dpfpCleared'));
                                                }}
                                                className={cx(
                                                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                  active ? 'bg-gray-700' : 'hover:bg-gray-800',
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
                                            {({ active }) => (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  clearDogePFA();
                                                  toast.message(t('modal.toast.dpfaCleared'));
                                                }}
                                                className={cx(
                                                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                  active ? 'bg-gray-700' : 'hover:bg-gray-800',
                                                )}
                                              >
                                                <MusicalNoteIcon className="h-4 w-4 shrink-0 text-amber-200/80" aria-hidden />
                                                <span className="leading-tight">{t('modal.profileDpfa.clearPfa')}</span>
                                              </button>
                                            )}
                                          </Menu.Item>
                                        ) : null}
                                    </WalletMenuItems>
                                  </Menu>
                                  <DogePFAHeaderControl />
                                </div>
                              ) : null}
                              <div className="min-w-0 flex flex-1 flex-wrap items-center gap-2 text-xl font-bold text-white">
                              {balanceRefreshing
                                ? <span className="opacity-60">{t('modal.dashboard.refreshingBalance')}</span>
                                : (
                                    (!balanceVerified && balance === 0)
                                      ? <span>–</span>
                                      : (
                                        <span className="inline-flex items-center gap-1.5">
                                          <DogeCurrencyIcon size="md" className="opacity-90" />
                                          {hideBalance ? '••••••' : balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                        </span>
                                      )
                                  )
                              }
                              <button
                                type="button"
                                onClick={() => setHideBalance((v) => !v)}
                                aria-label={hideBalance ? t('modal.aria.showBalance') : t('modal.aria.hideBalance')}
                                className="flex h-6 w-6 items-center justify-center rounded-none transition hover:bg-white/5"
                                title={hideBalance ? t('modal.aria.showBalance') : t('modal.aria.hideBalance')}
                              >
                                {hideBalance ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await refreshBalance();
                                  toast.success(t('modal.toast.balanceRefreshed'));
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded-none transition hover:bg-white/5"
                                aria-label={t('modal.aria.refreshBalance')}
                              >
                                <ArrowPathIcon className="h-5 w-5" />
                              </button>
                            </div>
                            </div>
                            )}

                            <div className="flex shrink-0 items-center gap-1.5 self-center">
                              {!(dogeosUi && isBrowserWallet && pureDogeosMode) ? (
                              <button
                                type="button"
                                onClick={() => setStep('send')}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                                aria-label={t('modal.aria.sendDoge')}
                                title={t('modal.aria.sendDoge')}
                              >
                                <PaperAirplaneIcon className="h-4 w-4" />
                              </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={handleDisconnectWallet}
                                disabled={isBusy}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                                aria-label={t('modal.aria.disconnectWallet')}
                                title={t('modal.aria.disconnectWallet')}
                              >
                                <PowerIcon className="h-4 w-4" />
                              </button>
                              <Menu as="div" className="relative">
                                <Menu.Button className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label={t('modal.aria.moreActions')}>
                                  <EllipsisHorizontalIcon className="h-4 w-4" />
                                </Menu.Button>
                                    <WalletMenuItems theme={isDark ? 'dark' : 'light'} className="w-52 max-w-[min(18rem,calc(100vw-2rem))]">
                                      {[
                                        ...(dogeosUi && isBrowserWallet && pureDogeosMode
                                          ? []
                                          : ([
                                              { key: 'send', label: t('modal.dashboard.menu.send'), Icon: PaperAirplaneIcon, action: () => setStep('send') },
                                              { key: 'receive', label: t('modal.dashboard.menu.receive'), Icon: QrCodeIcon, action: () => setStep('receive') },
                                            ] as const)),
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
                                            ] as const)
                                          : []),
                                        { key: 'xVerify', label: t('modal.dashboard.menu.xVerify'), Icon: CheckBadgeIcon, action: () => setStep('verification') },
                                        { key: 'settings', label: t('modal.dashboard.menu.settings'), Icon: Cog6ToothIcon, action: openSettings },
                                        { key: 'disconnect', label: t('modal.dashboard.menu.disconnect'), Icon: PowerIcon, action: handleDisconnectWallet },
                                      ].map(({ key, label, Icon, action }) => (
                                        <Menu.Item key={key}>
                                          {({ active }) => (
                                            <button
                                              type="button"
                                              onClick={action}
                                              className={cx(
                                                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-white transition',
                                                active ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                                              )}
                                            >
                                              <Icon className="h-5 w-5 shrink-0 text-white/90" aria-hidden />
                                              <span className="leading-tight">{label}</span>
                                            </button>
                                          )}
                                        </Menu.Item>
                                      ))}
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          type="button"
                                          onClick={() => setStep('remove')}
                                          className={cx(
                                            'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-300 transition',
                                            active ? 'bg-red-500/20' : 'hover:bg-red-500/10'
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

                            <div className="col-span-2 flex min-w-0 items-center gap-1.5 border-t border-white/5 pt-2 text-[#D4D4D4]">
                              {/* Reserve space for address utilities; avoids flex-grow dead space before icons */}
                              <div
                                className={cx(
                                  'min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                                  isBrowserWallet ? 'max-w-[calc(100%-8.5rem)]' : 'max-w-[calc(100%-5.75rem)]',
                                )}
                              >
                                <span
                                  className="inline-block whitespace-nowrap font-mono text-sm leading-snug tracking-tight"
                                  title={activeAddress ?? undefined}
                                >
                                  {activeAddress ?? truncateAddress(activeAddress)}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <button type="button" onClick={handleCopyAddress} className="flex h-7 w-7 items-center justify-center rounded-none transition hover:bg-white/5" aria-label={t('modal.aria.copyAddress')}>
                                  <ClipboardDocumentIcon className="h-5 w-5" />
                                </button>
                                {!(dogeosUi && isBrowserWallet && pureDogeosMode) ? (
                                <button type="button" onClick={() => setStep('receive')} className="flex h-7 w-7 items-center justify-center rounded-none transition hover:bg-white/5" aria-label={t('modal.aria.receiveQr')}>
                                  <QrCodeIcon className="h-5 w-5" />
                                </button>
                                ) : null}
                                {isBrowserWallet ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleLockWallet()}
                                    className="flex h-7 w-7 items-center justify-center rounded-none transition hover:bg-white/5"
                                    aria-label={isEncryptedWallet ? 'Lock local wallet' : 'Set password and lock wallet'}
                                    title={isEncryptedWallet ? 'Lock local wallet' : 'Set password and lock wallet'}
                                    disabled={isBusy}
                                  >
                                    <LockClosedIcon className="h-5 w-5" />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>

                        {isBrowserWallet && needsBackup ? (
                          <div className="flex flex-col gap-4 rounded-none border border-zinc-700 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="font-semibold text-zinc-100">{t('modal.backup.title')}</div>
                              <div className="mt-1 text-sm text-zinc-300">{t('modal.backup.subtitle')}</div>
                            </div>
                            <Button onClick={() => handleBackupNow()} className={PRIMARY_BUTTON}>{t('modal.backup.now')}</Button>
                          </div>
                        ) : null}

                        <div>
                          <div className="flex gap-2 border-b border-zinc-700">
                            {(['assets', 'transactions', 'listings'] as DashboardTab[]).map((item) => (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setTab(item)}
                                className={cx(
                                  'relative -mb-px border border-b-0 px-4 py-2 text-sm font-semibold capitalize tracking-wide transition',
                                  tab === item
                                    ? 'z-10 border-zinc-600 bg-zinc-800 text-white shadow-[inset_0_2px_0_#D4A017]'
                                    : 'border-zinc-700 bg-zinc-950 text-white/40 hover:bg-white/5 hover:text-white/70'
                                )}
                              >
                                {item === 'assets' ? t('modal.tabs.assets') : item === 'transactions' ? t('modal.tabs.transactions') : t('modal.tabs.listings')}
                              </button>
                            ))}
                          </div>

                          <div className="overflow-visible border border-zinc-700 bg-zinc-950">
                            {tab === 'assets' ? (
                              <div className="overflow-visible">
                                {/* NFT / DRC-20 sub-selector */}
                                <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
                                  <select
                                    value={assetType}
                                    onChange={(e) => setAssetType(e.target.value as 'nft' | 'drc20' | 'treats')}
                                    aria-label={t('modal.aria.assetType')}
                                    className="rounded-none border border-border-primary bg-bg-secondary px-3 py-1 text-sm font-semibold text-text-primary outline-none focus:border-primary-500"
                                  >
                                    <option value="nft">{t('modal.assets.nftOption')}</option>
                                    <option value="treats">{t('modal.assets.treatsOption')}</option>
                                    <option value="drc20">{t('modal.assets.drc20Option')}</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => activeAddress && fetchAssets(activeAddress)}
                                    className="p-1 text-white/50 transition hover:text-white"
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
                                ) : assetType === 'nft' ? (
                                  inscriptions.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                      <WalletIcon className="h-8 w-8 text-white/30" />
                                      <div className="text-sm font-semibold text-white">{t('modal.assets.noDoginalsTitle')}</div>
                                      <div className="text-xs text-white/45">{t('modal.assets.noDoginalsHint')}</div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-3.5 p-4 sm:grid-cols-3">
                                      {inscriptions.map((item) => (
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
                                                  {item.contentType?.startsWith('image/') ? (
                                                    <Menu.Item>
                                                      {({ active }) => (
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            const u = inscriptionMediaUrlForProfile(item);
                                                            setDogePFP(item.inscriptionId, u ? { contentUrl: u } : undefined);
                                                            toast.success(t('modal.toast.dpfpSet'));
                                                          }}
                                                          className={cx(
                                                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                            active ? 'bg-gray-700' : 'hover:bg-gray-800',
                                                          )}
                                                        >
                                                          <PhotoIcon className="h-4 w-4 shrink-0 text-yellow-200/90" aria-hidden />
                                                          <span className="leading-tight">{t('modal.assets.setAsDpfp')}</span>
                                                        </button>
                                                      )}
                                                    </Menu.Item>
                                                  ) : null}
                                                  {item.contentType?.startsWith('audio/') ? (
                                                    <Menu.Item>
                                                      {({ active }) => (
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
                                                            active ? 'bg-gray-700' : 'hover:bg-gray-800',
                                                          )}
                                                        >
                                                          <MusicalNoteIcon className="h-4 w-4 shrink-0 text-amber-200/90" aria-hidden />
                                                          <span className="leading-tight">{t('modal.assets.setAsDpfa')}</span>
                                                        </button>
                                                      )}
                                                    </Menu.Item>
                                                  ) : null}
                                                  <Menu.Item>
                                                    {({ active }) => (
                                                      <button
                                                        type="button"
                                                        onClick={() => openSendInscription(item)}
                                                        className={cx(
                                                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                          active ? 'bg-gray-700' : 'hover:bg-gray-800',
                                                        )}
                                                      >
                                                        <PaperAirplaneIcon className="h-4 w-4 shrink-0 text-white/90" aria-hidden />
                                                        <span className="leading-tight">{t('modal.assets.send')}</span>
                                                      </button>
                                                    )}
                                                  </Menu.Item>
                                                  <Menu.Item>
                                                    {({ active }) => (
                                                      <button
                                                        type="button"
                                                        onClick={() => openListInscription(item)}
                                                        className={cx(
                                                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition',
                                                          active ? 'bg-yellow-500/20' : 'hover:bg-yellow-500/10',
                                                        )}
                                                      >
                                                        <TagIcon className="h-4 w-4 shrink-0 text-yellow-200/90" aria-hidden />
                                                        <span className="leading-tight">{t('modal.assets.listForSale')}</span>
                                                      </button>
                                                    )}
                                                  </Menu.Item>
                                              </WalletMenuItems>
                                            </Menu>
                                          </div>
                                        </div>
                                      ))}
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
                                {selectedTx && (
                                  <div
                                    className={cx(
                                      'flex items-center justify-center p-4',
                                      isDrawerMode ? 'absolute inset-0 z-[100]' : 'fixed inset-0 z-[9999]'
                                    )}
                                    onClick={() => setSelectedTx(null)}
                                  >
                                    <div className="absolute inset-0 bg-black/60" />
                                    <div
                                      className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setSelectedTx(null)}
                                        className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-700 transition"
                                        aria-label="Close transaction details"
                                      >
                                        <XMarkIcon className="h-5 w-5" />
                                      </button>
                                      <div className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">
                                        {selectedTx.type === 'sent' ? t('modal.tx.to') : t('modal.tx.from')}
                                      </div>
                                      <div className="mb-1 flex items-center justify-center gap-2">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-white">
                                          {selectedTx.address.slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className="font-mono text-sm font-semibold text-zinc-800 truncate max-w-[200px]">
                                          {selectedTx.address
                                            ? `${selectedTx.address.slice(0, 10)}…${selectedTx.address.slice(-4)}`
                                            : '—'}
                                        </span>
                                        {selectedTx.address && (
                                          <button
                                            type="button"
                                            className="text-zinc-400 hover:text-zinc-600 transition"
                                            onClick={() => { void navigator.clipboard.writeText(selectedTx.address); }}
                                            title="Copy address"
                                          >
                                            <ClipboardDocumentIcon className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                      {selectedTx.quantumProtected && (
                                        <div
                                          className="mb-2 inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                                          title={t('modal.tx.opReturnBadgeTitle')}
                                        >
                                          <TagIcon className="h-3 w-3 shrink-0" aria-hidden />
                                          OP_RETURN · PQC R&amp;D tag
                                        </div>
                                      )}
                                      {selectedTx.quantumCommitment && (
                                        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-left">
                                          <TechDetails
                                            summary={t('modal.tx.opReturnPayloadSummary')}
                                            className="text-[11px] text-emerald-900"
                                            summaryClassName="text-emerald-900 font-medium"
                                            contentClassName="border-emerald-200 text-emerald-800"
                                          >
                                            <div>
                                              <strong>{t('modal.tx.opReturnAlgo')}:</strong>{' '}
                                              {selectedTx.quantumCommitment.algorithm === 'falcon512' ? 'Falcon-512' : 'ML-DSA-44'}
                                            </div>
                                            <div>
                                              <strong>{t('modal.tx.opReturnTag')}:</strong> {selectedTx.quantumCommitment.tag}
                                            </div>
                                            <div>
                                              <strong>{t('modal.tx.opReturnCommitment')}:</strong>{' '}
                                              <span className="font-mono">{selectedTx.quantumCommitment.commitmentHex.slice(0, 16)}…</span>
                                            </div>
                                          </TechDetails>
                                        </div>
                                      )}
                                      <div className="my-4 text-4xl font-bold text-zinc-900">
                                        Ð{selectedTx.amount % 1 === 0 ? selectedTx.amount.toLocaleString() : selectedTx.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                      </div>
                                      {selectedTx.pending && (
                                        <div className="mb-3 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700 inline-block">
                                          {t('modal.tx.pending')}
                                        </div>
                                      )}
                                      <div className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-left text-sm">
                                        <div className="flex items-center justify-between px-4 py-2">
                                          <span className="text-zinc-500">{t('modal.tx.confirmations')}</span>
                                          <span className="font-semibold text-zinc-800">{selectedTx.confirmations}</span>
                                        </div>
                                        {selectedTx.timestamp && (
                                          <div className="flex items-center justify-between px-4 py-2">
                                            <span className="text-zinc-500">{t('modal.tx.timestamp')}</span>
                                            <span className="font-semibold text-zinc-800">{selectedTx.timestamp}</span>
                                          </div>
                                        )}
                                      </div>
                                      {selectedTx.txid && (
                                        <a
                                          href={dogeTxExplorerUrl(selectedTx.txid)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                                        >
                                          {t('modal.tx.viewOnSoChain')}
                                          <ArrowDownTrayIcon className="h-4 w-4 rotate-[-90deg]" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* List */}
                                {txError ? (
                                  <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                                    <div className="text-sm text-red-300">{txError}</div>
                                    <button
                                      type="button"
                                      onClick={() => activeAddress && void fetchTransactions(activeAddress, 1)}
                                      className="text-xs text-yellow-400 underline"
                                    >
                                      {t('modal.tx.retry')}
                                    </button>
                                  </div>
                                ) : txLoading && mergedTransactions.length === 0 ? (
                                  <div className="px-4 py-8 text-center text-sm text-white/50">{t('modal.tx.loading')}</div>
                                ) : mergedTransactions.length === 0 ? (
                                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                    <ArrowPathIcon className="h-8 w-8 text-white/30" />
                                    <div className="text-sm font-semibold text-white">{t('modal.tx.emptyTitle')}</div>
                                    <div className="text-xs text-white/45">{t('modal.tx.emptyHint')}</div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="divide-y divide-zinc-800">
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
                                        const addrShort = tx.address
                                          ? `${tx.address.slice(0, 10)}…${tx.address.slice(-4)}`
                                          : '—';
                                        const initials = tx.address ? tx.address.slice(0, 2).toUpperCase() : '??';
                                        return (
                                          <button
                                            key={`${tx.txid}-${i}`}
                                            type="button"
                                            onClick={() => setSelectedTx(tx)}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                                          >
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-white">
                                              {initials}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-2">
                                                <div className="truncate text-sm font-semibold text-white">{addrShort}</div>
                                                {tx.quantumProtected && (
                                                  <span className="shrink-0 text-white/40" title={t('modal.tx.opReturnListHint')}>
                                                    <CpuChipIcon className="h-3.5 w-3.5" aria-label={t('modal.tx.opReturnListHint')} />
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-xs text-white/40">{timeAgo || (tx.pending ? t('modal.tx.pending') : '')}</div>
                                            </div>
                                            <div className={cx(
                                              'shrink-0 rounded-full px-3 py-1 text-sm font-semibold',
                                              tx.type === 'received'
                                                ? 'bg-green-500/20 text-green-300'
                                                : 'bg-zinc-700/60 text-zinc-300'
                                            )}>
                                              {tx.type === 'received' ? '+' : '-'}{tx.amount % 1 === 0 ? tx.amount : tx.amount.toFixed(tx.amount < 0.01 ? 8 : 3)}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {transactions.length < txTotal && (
                                      <div className="border-t border-zinc-800 px-4 py-3">
                                        <button
                                          type="button"
                                          disabled={txLoading}
                                          onClick={() => {
                                            if (!activeAddress) return;
                                            const nextPage = txPage + 1;
                                            setTxPage(nextPage);
                                            void fetchTransactions(activeAddress, nextPage, true);
                                          }}
                                          className="w-full text-center text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50 transition"
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
                            <img src={selectedInscription.content} alt="" className="h-14 w-14 rounded-lg object-cover" />
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
                        {dogeosUi && isBrowserWallet ? (
                          <ChainTxBanner chain="dogecoin">{t('modal.dogeos.txBannerListing')}</ChainTxBanner>
                        ) : null}
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                          {selectedInscription.contentType?.startsWith('image/') ? (
                            <img src={selectedInscription.content} alt="" className="h-14 w-14 rounded-lg object-cover" />
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
                            {dogeosUi && isBrowserWallet ? (
                              <ChainTxBanner chain="dogecoin">{t('modal.dogeos.txBannerDxSign')}</ChainTxBanner>
                            ) : null}
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
                              {buildDxSigningMessage(dxNonce || '…', activeAddress)}
                            </div>
                            <Button
                              type="button"
                              className="w-full border border-white/15 bg-transparent text-[#FCD34D] hover:bg-white/5"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(buildDxSigningMessage(dxNonce, activeAddress));
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
                                const challenge = buildDxSigningMessage(dxNonce, activeAddress);
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
                            {dogeosUi && isBrowserWallet ? (
                              <ChainTxBanner chain="dogecoin">{t('modal.dogeos.txBannerDxInscribe')}</ChainTxBanner>
                            ) : null}
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
                            <label className="block text-sm text-white">
                              <span className="mb-2 block">{t('modal.verification.dxFeeLabel')}</span>
                              <input
                                type="number"
                                min={1000}
                                step={1000}
                                value={dxFeeRate}
                                onChange={(e) => setDxFeeRate(Math.max(1000, Number(e.target.value) || 1000))}
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
                                {dxInscribeBusy ? t('modal.verification.dxInscribing') : t('modal.verification.dxInscribeRegisterBtn')}
                              </Button>
                              <Button
                                type="button"
                                className={cx('w-full', SECONDARY_BUTTON)}
                                disabled={dxInscribeBusy || !dxBadgeInscriptionIdFromEnv()}
                                onClick={() => void handleDxInscribeWalletCard()}
                              >
                                {dxInscribeBusy ? t('modal.verification.dxInscribing') : t('modal.verification.dxInscribeCardBtn')}
                              </Button>
                            </div>
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
                      </div>
                    )}

                    {step === 'send' && (
                      <div className="space-y-4">
                        {!sendTxid ? (
                          <>
                            {dogeosUi && isBrowserWallet ? (
                              <ChainTxBanner chain="dogecoin">{t('modal.dogeos.txBannerSend')}</ChainTxBanner>
                            ) : null}
                            <div className="text-sm text-[#D4D4D4]">{t('modal.send.introShort')}</div>
                            <label className="block text-sm text-white">
                              <span className="mb-2 block">{t('modal.send.recipientLabel')}</span>
                              <input
                                value={recipientAddress}
                                onChange={(event) => setRecipientAddress(event.target.value)}
                                placeholder={t('modal.send.recipientPlaceholder')}
                                className={INPUT_CLASS}
                                disabled={sendBusy}
                              />
                            </label>
                            <label className="block text-sm text-white">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <span>{t('modal.send.amount')}</span>
                                <button
                                  type="button"
                                  onClick={handleSendMax}
                                  className="text-sm font-medium text-[#FCD34D] hover:opacity-85"
                                  disabled={sendBusy}
                                >
                                  {t('modal.send.max')}
                                </button>
                              </div>
                              <input
                                value={sendAmount}
                                onChange={(event) => setSendAmount(event.target.value)}
                                className={INPUT_CLASS}
                                disabled={sendBusy}
                              />
                            </label>

                            <details className="group rounded-xl border border-white/10 bg-[#0A0A0A] text-left">
                              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs text-white/55 [&::-webkit-details-marker]:hidden">
                                <TagIcon className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
                                <span className="min-w-0 flex-1 leading-snug">{t('modal.send.opReturnSectionTitle')}</span>
                                <ChevronDownIcon className="h-4 w-4 shrink-0 text-white/35 transition group-open:-rotate-180" aria-hidden />
                              </summary>
                              <div className="space-y-3 border-t border-white/10 px-3 pb-3 pt-2">
                                <TechDetails
                                  summary={t('modal.wallet.geekDetails')}
                                  className="text-[11px] text-white/45"
                                  summaryClassName="text-white/55"
                                  contentClassName="border-white/15"
                                >
                                  <p className="leading-relaxed">{t('modal.send.opReturnHelp')}</p>
                                </TechDetails>
                                <QuantumToggle
                                  variant="subtle"
                                  enabled={quantumEnabled}
                                  algorithm={quantumAlgorithm}
                                  onChange={setQuantumEnabled}
                                  onAlgorithmChange={setQuantumAlgorithm}
                                  showAlgorithmSelector={quantumEnabled}
                                />
                              </div>
                            </details>

                            {/* Fee Transparency */}
                            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3">
                              <div className="mb-2 text-sm font-semibold text-white/80">{t('modal.send.feeHeading')}</div>
                              <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60">{t('modal.send.feeNetwork')}</span>
                                  <span className="font-mono text-white">~0.002 DOGE</span>
                                </div>
                                {platformFeeTip > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-white/60">{t('modal.send.feePlatform')}</span>
                                    <span className="font-mono text-white">{platformFeeTip.toFixed(2)} DOGE</span>
                                  </div>
                                )}
                                <div className="mt-2 border-t border-white/10 pt-2">
                                  <div className="flex items-center justify-between font-semibold">
                                    <span className="text-white">{t('modal.send.feeTotal')}</span>
                                    <span className="font-mono text-white">~{(0.002 + platformFeeTip).toFixed(3)} DOGE</span>
                                  </div>
                                </div>
                              </div>
                              <TechDetails
                                summary={t('modal.wallet.geekDetails')}
                                className="mt-2 text-[10px] text-white/40"
                                summaryClassName="text-white/50"
                                contentClassName="border-white/15 text-white/45"
                              >
                                <p>{t('modal.send.feeExplain')}</p>
                              </TechDetails>
                            </div>

                            {sendError && (
                              <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {sendError}
                              </div>
                            )}

                            <Button
                              onClick={() => void handleSendDoge()}
                              disabled={sendBusy}
                              className={cx('w-full', PRIMARY_BUTTON, sendBusy && 'cursor-wait')}
                              aria-busy={sendBusy}
                            >
                              {sendBusy ? (sendStatus ?? 'Sending…') : t('modal.send.continue')}
                            </Button>
                          </>
                        ) : (
                          <div className="space-y-4">
                            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4">
                              <div className="flex items-center gap-2 text-emerald-300">
                                <CheckCircleIcon className="h-5 w-5" />
                                <div className="font-semibold">
                                  {quantumEnabled ? t('modal.send.successWithTag') : t('modal.send.successPlain')}
                                </div>
                              </div>
                              <div className="mt-3 space-y-2 text-sm text-white/75">
                                <div>
                                  <span className="text-white/45">{t('modal.send.successTxid')}</span>{' '}
                                  <span className="font-mono break-all">{sendTxid}</span>
                                </div>
                                {sendQuantumResult && (
                                  <TechDetails
                                    summary={t('modal.wallet.geekDetails')}
                                    className="text-xs text-white/50"
                                    summaryClassName="text-white/55"
                                    contentClassName="border-white/15"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <TagIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" aria-hidden />
                                      <span>
                                        {t('modal.send.successTagLine', {
                                          algo:
                                            sendQuantumResult.commitment.algorithm === 'falcon512' ? 'Falcon-512' : 'ML-DSA-44',
                                          commitment: sendQuantumResult.proof.commitment.slice(0, 18),
                                        })}
                                      </span>
                                    </div>
                                  </TechDetails>
                                )}
                              </div>
                            </div>

                            <a
                              href={dogeTxExplorerUrl(sendTxid)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex w-full items-center justify-center gap-2 rounded-full bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                            >
                              {t('modal.send.viewExplorer')}
                              <ArrowDownTrayIcon className="h-4 w-4 rotate-[-90deg]" />
                            </a>

                            <Button
                              onClick={() => {
                                resetSendState();
                                setRecipientAddress('');
                                setSendAmount('');
                              }}
                              className={cx('w-full', SECONDARY_BUTTON)}
                            >
                              {t('modal.send.sendAnother')}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {step === 'receive' && (
                      <div className="space-y-4">
                        {dogeosUi && isBrowserWallet ? (
                          <ChainTxBanner chain="dogecoin">{t('modal.dogeos.txBannerReceive')}</ChainTxBanner>
                        ) : null}
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
                          {(['data', 'network', 'display', 'ecosystem'] as SettingsTab[])
                            .filter((tabId) => tabId !== 'ecosystem' || dogeosFeatureOn)
                            .map((tabId) => (
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
                                  : tabId === 'display'
                                    ? 'Display'
                                    : t('modal.settings.tabEcosystem')}
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
                                  { id: 'wzrd' as const, label: 'WZRD', hint: 'api.wzrd.dog' },
                                  {
                                    id: 'commanddog' as const,
                                    label: 'Command.dog',
                                    hint: 'api.command.dog',
                                  },
                                ] as { id: WalletDataProviderType; label: string; hint: string }[]).map(opt => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setSettingsProvider(opt.id)}
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
                                placeholder="Custom API URL (optional)"
                                className={cx(INPUT_CLASS, 'mt-2 text-xs')}
                              />
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

                        {settingsTab === 'ecosystem' && dogeosFeatureOn ? (
                          <div className="space-y-3">
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                              {t('modal.dogeos.ecosystemSection')}
                            </div>
                            <DogeosEcosystemSettings t={t} canUseDogeosFromSeed={isBrowserWallet} />
                          </div>
                        ) : null}

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
                  </div>

                    {isDrawerMode && walletSwitcherModalOpen ? (
                      <div
                        className="absolute inset-0 z-[130] flex min-h-0 flex-col overflow-hidden bg-[var(--ds-bg,#0A0A0A)]"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="wallet-switcher-drawer-title"
                      >
                        <div className="shrink-0 border-b border-white/10 px-4 py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h2 id="wallet-switcher-drawer-title" className="text-lg font-bold text-white">
                                {t('modal.walletSwitcher.title')}
                              </h2>
                              <p className="mt-1 text-xs text-white/50">{t('modal.walletSwitcher.subtitle')}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setWalletSwitcherModalOpen(false)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                              aria-label={t('modal.walletSwitcher.closeAria')}
                              title="Close"
                            >
                              <XMarkIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{renderWalletSwitcherGroups()}</div>
                      </div>
                    ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Address Book Modal */}
      <AddressBookModal
        isOpen={isAddressBookModalOpen}
        onClose={() => setIsAddressBookModalOpen(false)}
        nestInWalletDrawer={mode === 'drawer'}
        walletDrawerHost={walletDrawerHostEl}
      />

      {/* Wallet Switcher Modal (centered only; drawer mode uses in-panel stack above) */}
      <Transition appear show={!isDrawerMode && walletSwitcherModalOpen} as={Fragment}>
        <Dialog as="div" className="relative" data-ds-theme={isDark ? 'dark' : 'light'} style={{ zIndex: 10000 }} onClose={() => setWalletSwitcherModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className={cx('w-full max-w-md', MODAL_SURFACE)}>
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Dialog.Title className="text-lg font-bold text-white">
                          {t('modal.walletSwitcher.title')}
                        </Dialog.Title>
                        <p className="mt-1 text-sm text-white/70">
                          {t('modal.walletSwitcher.subtitle')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWalletSwitcherModalOpen(false)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label={t('modal.walletSwitcher.closeAria')}
                        title="Close"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-4">{renderWalletSwitcherGroups()}</div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

    </>
  );
}

export default DojakwebWalletModal;
