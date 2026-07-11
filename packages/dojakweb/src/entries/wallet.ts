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
export { default as WalletDrawer } from '../components/WalletDrawer';
export {
  WalletPawDrawer,
  type WalletPawDrawerProps,
} from '../components/WalletPawDrawer';
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
  DojakwebFeaturesProvider,
  useDojakwebFeatures,
  type DojakwebFeatures,
} from '../contexts/DojakwebFeaturesContext';

export { toast } from 'sonner';
