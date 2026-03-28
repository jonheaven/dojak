export type WalletTab = 'home' | 'receive' | 'send' | 'settings';

export type FeePreset = 'low' | 'medium' | 'high' | 'custom';

export const WALLET_TABS: { key: WalletTab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'receive', label: 'Receive' },
  { key: 'send', label: 'Send' },
  { key: 'settings', label: 'Settings' }
];

export const FEE_OPTIONS: { key: Exclude<FeePreset, 'custom'>; label: string; feeRate: number }[] = [
  { key: 'low', label: 'Low', feeRate: 1 },
  { key: 'medium', label: 'Medium', feeRate: 2 },
  { key: 'high', label: 'High', feeRate: 5 }
];
