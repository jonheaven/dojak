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

export {
  setWalletDataProviderConfig,
  getWalletDataProviderConfig,
  walletDataApi,
  type WalletDataProviderConfig,
  type WalletDataProviderType,
} from '../utils/api';

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
