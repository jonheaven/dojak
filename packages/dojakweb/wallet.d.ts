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
  useDojakwebTheme,
  DojakwebThemeProvider,
  type DojakwebTheme,
} from './src/contexts/DojakwebThemeContext';
export { toast } from 'sonner';
