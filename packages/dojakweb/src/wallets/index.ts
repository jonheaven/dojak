// Wallet system exports for extensible wallet support

export * from './types';
export * from './WalletManager';
export * from './MyDogeAdapter';
export * from './DojakAdapter';
export * from './SpookyDogeAdapter';


// Re-export the singleton instance for convenience
export { walletManager } from './WalletManager';
