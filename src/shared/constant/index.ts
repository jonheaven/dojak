/* eslint-disable quotes */

/* constants pool */
import { t } from '@unisat/i18n';
import { KeyringType } from '@unisat/keyring-service/types';
import { AddressType, ChainType, NetworkType } from '@unisat/wallet-types';

import { RestoreWalletType } from '../types';

export { ChainType } from '@unisat/wallet-types';

export const KEYRING_CLASS = {
  PRIVATE_KEY: 'Simple Key Pair',
  MNEMONIC: 'HD Key Tree',
  KEYSTONE: 'Keystone'
};

export const KEYRING_TYPE_TEXT = {
  [KeyringType.HdKeyring]: 'Created by Mnemonic',
  [KeyringType.SimpleKeyring]: 'Imported by Private Key',
  [KeyringType.KeystoneKeyring]: 'Import from Keystone',
  [KeyringType.ColdWalletKeyring]: 'Cold Wallet'
};
export const BRAND_ALIAN_TYPE_TEXT = {
  [KeyringType.HdKeyring]: 'Account',
  [KeyringType.SimpleKeyring]: 'Private Key',
  [KeyringType.KeystoneKeyring]: 'Account',
  [KeyringType.ColdWalletKeyring]: 'Account'
};

export const KEYRING_TYPES: {
  [key: string]: {
    name: string;
    tag: string;
    alianName: string;
  };
} = {
  'HD Key Tree': {
    name: 'HD Key Tree',
    tag: 'HD',
    alianName: 'HD Wallet'
  },
  'Simple Key Pair': {
    name: 'Simple Key Pair',
    tag: 'IMPORT',
    alianName: 'Single Wallet'
  },
  Keystone: {
    name: 'Keystone',
    tag: 'KEYSTONE',
    alianName: 'Keystone'
  },
  'Cold Wallet': {
    name: 'Cold Wallet',
    tag: 'COLD',
    alianName: 'Cold Wallet'
  }
};

export const IS_CHROME = /Chrome\//i.test(navigator.userAgent);

export const IS_FIREFOX = /Firefox\//i.test(navigator.userAgent);

export const IS_LINUX = /linux/i.test(navigator.userAgent);

let chromeVersion: number | null = null;

if (IS_CHROME) {
  const matches = navigator.userAgent.match(/Chrome\/(\d+[^.\s])/);
  if (matches && matches.length >= 2) {
    chromeVersion = Number(matches[1]);
  }
}

export const IS_AFTER_CHROME91 = IS_CHROME ? chromeVersion && chromeVersion >= 91 : false;

export const GAS_LEVEL_TEXT = {
  slow: 'Standard',
  normal: 'Fast',
  fast: 'Instant',
  custom: 'Custom'
};

export const IS_WINDOWS = /windows/i.test(navigator.userAgent);

export const LANGS = [
  {
    value: 'en',
    label: 'English'
  },
  {
    value: 'zh_CN',
    label: 'Chinese'
  },
  {
    value: 'ja',
    label: 'Japanese'
  },
  {
    value: 'es',
    label: 'Spanish'
  }
];

export const ADDRESS_TYPES: {
  value: AddressType;
  label: string;
  name: string;
  hdPath: string;
  displayIndex: number;
  isdojakLegacy?: boolean;
}[] = [
  {
    value: AddressType.P2PKH,
    label: 'P2PKH',
    name: 'Legacy (P2PKH)',
    hdPath: "m/44'/3'/0'/0/0", // Dogecoin coin type 3
    displayIndex: 0,
    isdojakLegacy: false
  }
];

export const OW_HD_PATH = "m/44'/3'/0'"; // Dogecoin coin type 3

export const getRestoreWallets = (): { value: RestoreWalletType; name: string; addressTypes: AddressType[]; recommended?: boolean }[] => [
  {
    value: RestoreWalletType.dojak,
    name: 'Mnemonic Phrase (12/24 words)',
    addressTypes: [AddressType.P2PKH],
    recommended: true
  },
  {
    value: RestoreWalletType.OTHERS,
    name: 'Private Key (Hex or WIF)',
    addressTypes: [AddressType.P2PKH]
  },
  {
    value: RestoreWalletType.OW,
    name: 'Hardware Wallet',
    addressTypes: [AddressType.P2PKH]
  }
];

export const NETWORK_TYPES = [
  { value: NetworkType.MAINNET, label: 'LIVENET', name: 'livenet', validNames: [0, 'livenet', 'mainnet'] },
  { value: NetworkType.TESTNET, label: 'TESTNET', name: 'testnet', validNames: ['testnet'] }
];

export type TypeChain = {
  enum: ChainType;
  label: string;
  iconLabel: string;
  icon: string;
  unit: string;
  networkType: NetworkType;
  endpoints: string[];
  mempoolSpaceUrl: string;
  dojakUrl: string;
  doginalsUrl: string;
  dojakExplorerUrl: string;
  okxExplorerUrl: string;
  isViewTxHistoryInternally?: boolean;
  disable?: boolean;
  isFractal?: boolean;
  showPrice: boolean;
  defaultExplorer: 'mempool-space' | 'dojak-explorer';
  enableDrc20SingleStep?: boolean;
  enableDrc20Prog?: boolean;
};

export const CHAINS_MAP: { [key: string]: TypeChain } = {
  [ChainType.BITCOIN_MAINNET]: {
    enum: ChainType.BITCOIN_MAINNET,
    label: 'Dogecoin',
    iconLabel: 'Dogecoin',
    icon: './images/logo/logo@128x.png',
    unit: 'DOGE',
    networkType: NetworkType.MAINNET,
    endpoints: [
      'https://dogecoin-mainnet-rpc.allthatnode.com', // Dogecoin mainnet RPC (AllThatNode)
      'https://dogecoin-rpc.publicnode.com', // PublicNode (free tier)
      'https://doge.getblock.io/mainnet/' // GetBlock.io (alternative)
    ],
    mempoolSpaceUrl: 'https://dogecoin.network', // Dogecoin explorer
    dojakUrl: 'https://dojak.dog',
    doginalsUrl: 'https://doginals.com',
    dojakExplorerUrl: 'https://dogecoin.network', // Dogecoin explorer
    okxExplorerUrl: '',
    showPrice: true,
    defaultExplorer: 'dojak-explorer',
    enableDrc20Prog: true
  },
  [ChainType.BITCOIN_TESTNET]: {
    enum: ChainType.BITCOIN_TESTNET,
    label: 'Dogecoin Testnet',
    iconLabel: 'Dogecoin',
    icon: './images/logo/logo@128x.png',
    unit: 'tDOGE',
    networkType: NetworkType.TESTNET,
    endpoints: ['https://dogecoin-testnet-rpc.allthatnode.com'], // Dogecoin testnet RPC (AllThatNode)
    mempoolSpaceUrl: 'https://testnet.dogecoin.network', // Dogecoin testnet explorer
    dojakUrl: 'https://testnet.dojak.dog',
    doginalsUrl: 'https://testnet.doginals.com',
    dojakExplorerUrl: '',
    okxExplorerUrl: '',
    showPrice: false,
    defaultExplorer: 'mempool-space'
  },
  [ChainType.BITCOIN_TESTNET4]: {
    enum: ChainType.BITCOIN_TESTNET4,
    label: 'Dogecoin Testnet4 (Beta)',
    iconLabel: 'Dogecoin',
    icon: './images/logo/logo@128x.png',
    unit: 'tDOGE',
    networkType: NetworkType.TESTNET,
    endpoints: ['https://dogecoin-testnet4-rpc.allthatnode.com'], // Dogecoin testnet4 RPC
    mempoolSpaceUrl: 'https://testnet4.dogecoin.network', // Dogecoin testnet4 explorer
    dojakUrl: 'https://testnet4.dojak.dog',
    doginalsUrl: 'https://testnet4.doginals.com',
    dojakExplorerUrl: '',
    okxExplorerUrl: '',
    showPrice: false,
    defaultExplorer: 'mempool-space'
  },
};

export const CHAINS = Object.values(CHAINS_MAP);

export type TypeChainGroup = {
  type: 'single' | 'list';
  chain?: TypeChain;
  label?: string;
  icon?: string;
  items?: TypeChain[];
};

export const CHAIN_GROUPS: TypeChainGroup[] = [
  {
    type: 'single',
    chain: CHAINS_MAP[ChainType.BITCOIN_MAINNET]
  },
  {
    type: 'list',
    label: 'Dogecoin Testnet',
    icon: './images/logo/logo@128x.png',
    items: [
      CHAINS_MAP[ChainType.BITCOIN_TESTNET],
      CHAINS_MAP[ChainType.BITCOIN_TESTNET4]
    ]
  }
];

export const MINIMUM_GAS_LIMIT = 21000;

export enum WATCH_ADDRESS_CONNECT_TYPE {
  WalletConnect = 'WalletConnect'
}

export const WALLETCONNECT_STATUS_MAP = {
  PENDING: 1,
  CONNECTED: 2,
  WAITING: 3,
  SIBMITTED: 4,
  REJECTED: 5,
  FAILD: 6
};

export const INTERNAL_REQUEST_ORIGIN = 'https://dojak.dog';

export const INTERNAL_REQUEST_SESSION = {
  name: 'Dojak Wallet',
  origin: INTERNAL_REQUEST_ORIGIN,
  icon: './images/logo/logo@128x.png'
};

export const EVENTS = {
  broadcastToUI: 'broadcastToUI',
  broadcastToBackground: 'broadcastToBackground',
  SIGN_FINISHED: 'SIGN_FINISHED',
  WALLETCONNECT: {
    STATUS_CHANGED: 'WALLETCONNECT_STATUS_CHANGED',
    INIT: 'WALLETCONNECT_INIT',
    INITED: 'WALLETCONNECT_INITED'
  }
};

export const COIN_NAME = 'DOGE';
export const COIN_SYMBOL = 'DOGE';

export const COIN_DUST = 1000;

export const TO_LOCALE_STRING_CONFIG = {
  minimumFractionDigits: 8
};

export const SAFE_DOMAIN_CONFIRMATION = 3;

export const GITHUB_URL = 'https://github.com/dojak-wallet/extension';
export const DISCORD_URL = 'https://discord.com/invite/dojak-wallet';
export const TWITTER_URL = 'https://twitter.com/dojak_wallet';
export const TELEGRAM_URL = 'https://t.me/dojak_wallet';
export const WEBSITE_URL = 'https://dojak.dog';
export const FEEDBACK_URL = 'https://feedback.dojak.dog';
export const EMAIL_URL = 'contact@dojak.dog';
export const DOCS_URL = ' https://docs.dojak.dog/dev/dojak-developer-center ';
export const MEDIUM_URL = 'https://dojak-wallet.medium.com/';
export const UPDATE_URL = 'https://chromewebstore.google.com/detail/dojak-wallet/dojak-wallet-id';
export const REVIEW_URL =
  'https://chromewebstore.google.com/detail/dojak-wallet/dojak-wallet-id/reviews';
export const TERMS_OF_SERVICE_URL = 'https://dojak.dog/terms-of-service.html';
export const PRIVACY_POLICY_URL = 'https://dojak.dog/privacy-policy.html';

export const CHANNEL = process.env.channel!;
export const VERSION = process.env.release!;
export const MANIFEST_VERSION = process.env.manifest!;

export enum AddressFlagType {
  Is_Enable_Atomicals = 0b1, // deprecated
  CONFIRMED_UTXO_MODE = 0b10,
  DISABLE_AUTO_SWITCH_CONFIRMED = 0b100,
  DISABLE_ARC20 = 0b1000
}

export const UNCONFIRMED_HEIGHT = 4194303;

export enum PaymentChannelType {
  MoonPay = 'moonpay',
  AlchemyPay = 'alchemypay',
  Transak = 'transak'
}

export const PAYMENT_CHANNELS = {
  moonpay: {
    name: 'MoonPay',
    img: './images/artifacts/moonpay.png'
  },
  alchemypay: {
    name: 'Alchemy Pay',
    img: './images/artifacts/alchemypay.png'
  },

  transak: {
    name: 'Transak',
    img: './images/artifacts/transak.png'
  }
};

export enum HardwareWalletType {
  Keystone = 'keystone',
  Ledger = 'ledger',
  Trezor = 'trezor'
}

export const HARDWARE_WALLETS = {
  [HardwareWalletType.Keystone]: {
    name: 'Keystone',
    img: './images/artifacts/keystone.png'
  },
  [HardwareWalletType.Ledger]: {
    name: 'Ledger',
    img: './images/artifacts/ledger.png'
  },
  [HardwareWalletType.Trezor]: {
    name: 'Trezor',
    img: './images/artifacts/trezor.png'
  }
};

export const AUTO_LOCK_TIMES = [
  { id: 0, time: 30000 },
  { id: 1, time: 60000 },
  { id: 2, time: 180000 },
  { id: 3, time: 300000 },
  { id: 4, time: 600000 },
  { id: 5, time: 1800000 },
  { id: 6, time: 3600000 },
  { id: 7, time: 14400000 }
];

export const getAutoLockTimes = () => [
  { id: 0, time: 30000, label: `30${t('seconds')}` },
  { id: 1, time: 60000, label: `1${t('minute')}` },
  { id: 2, time: 180000, label: `3${t('minutes')}` },
  { id: 3, time: 300000, label: `5${t('minutes')}` },
  { id: 4, time: 600000, label: `10${t('minutes')}` },
  { id: 5, time: 1800000, label: `30${t('minutes')}` },
  { id: 6, time: 3600000, label: `1${t('hour')}` },
  { id: 7, time: 14400000, label: `4${t('hours')}` }
];

export const DEFAULT_LOCKTIME_ID = 5;


