/**
 * DogeOS network configuration.
 *
 * Mainnet switch instructions:
 * - Replace `rpcUrl`, `chainId`, `blockExplorerUrl`, and `name` in `DOGEOS_NETWORKS.mainnet`
 *   once official DogeOS mainnet values are published.
 * - Then set `ACTIVE_DOGEOS_NETWORK` to `'mainnet'`.
 * - No other file changes should be required.
 */
export type DogeOsNetworkConfig = {
  key: 'testnet' | 'mainnet';
  name: string;
  rpcUrl: string;
  chainId: number;
  currencySymbol: 'DOGE';
  blockExplorerUrl: string;
  poweredByLabel: string;
  bridgeContractAddress: string;
};

export const DOGEOS_NETWORKS: Record<'testnet' | 'mainnet', DogeOsNetworkConfig> = {
  testnet: {
    key: 'testnet',
    name: 'DogeOS Chikyū Testnet',
    rpcUrl: 'https://rpc.testnet.dogeos.com/',
    chainId: 6281971,
    currencySymbol: 'DOGE',
    blockExplorerUrl: 'https://blockscout.testnet.dogeos.com',
    poweredByLabel: 'Powered by DogeOS',
    bridgeContractAddress: '0x0000000000000000000000000000000000000000'
  },
  mainnet: {
    key: 'mainnet',
    name: 'DogeOS Mainnet (TBD)',
    rpcUrl: 'https://rpc.mainnet.dogeos.com/',
    chainId: 0,
    currencySymbol: 'DOGE',
    blockExplorerUrl: 'https://blockscout.dogeos.com',
    poweredByLabel: 'Powered by DogeOS',
    bridgeContractAddress: '0x0000000000000000000000000000000000000000'
  }
};

export const ACTIVE_DOGEOS_NETWORK: 'testnet' | 'mainnet' = 'testnet';

export const DOGEOS_ACTIVE_CONFIG = DOGEOS_NETWORKS[ACTIVE_DOGEOS_NETWORK];
export const DOGEOS_DERIVATION_PATH = "m/44'/60'/0'/0/0";
