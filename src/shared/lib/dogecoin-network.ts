import * as bitcoin from 'bitcoinjs-lib';

/**
 * Dogecoin Mainnet Network Configuration
 * Based on Dogecoin Core specifications
 */
export const dogecoinMainnet: bitcoin.Network = {
  messagePrefix: '\x18Dogecoin Signed Message:\n',
  bech32: 'doge', // Bech32 HRP for native SegWit addresses (doge1...)
  bip32: {
    public: 0x02facafd, // Dogecoin mainnet public key: [0x02, 0xfa, 0xca, 0xfd]
    private: 0x02fac398, // Dogecoin mainnet private key: [0x02, 0xfa, 0xc3, 0x98]
  },
  pubKeyHash: 0x1e, // Dogecoin mainnet P2PKH addresses starting with 'D' (30 decimal)
  scriptHash: 0x16, // Dogecoin mainnet P2SH addresses (22 decimal)
  wif: 0x9e, // Dogecoin WIF private key prefix (158 decimal)
};

/**
 * Dogecoin Testnet Network Configuration
 * Based on Dogecoin Core specifications
 */
export const dogecoinTestnet: bitcoin.Network = {
  messagePrefix: '\x18Dogecoin Signed Message:\n',
  bech32: 'tdoge', // Testnet Bech32 HRP
  bip32: {
    public: 0x043587cf, // Dogecoin testnet public key (standard testnet values)
    private: 0x04358394, // Dogecoin testnet private key (standard testnet values)
  },
  pubKeyHash: 0x71, // Dogecoin testnet P2PKH addresses starting with 'n' or 'm'
  scriptHash: 0xc4, // Dogecoin testnet P2SH addresses
  wif: 0xf1, // Dogecoin testnet WIF private key prefix
};

/**
 * Dogecoin network constants (not part of bitcoinjs-lib Network interface)
 */
export const DOGECOIN_CONSTANTS = {
  mainnet: {
    magicBytes: [0xc0, 0xc0, 0xc0, 0xc0], // Message start for mainnet
    port: 22556, // Default P2P port
  },
  testnet: {
    magicBytes: [0xfc, 0xc1, 0xb7, 0xdc], // Message start for testnet
    port: 44556, // Default testnet P2P port
  }
};

/**
 * Convert NetworkType to Dogecoin PSBT Network
 * @param networkType The network type (MAINNET/TESTNET)
 * @returns The corresponding bitcoinjs-lib Network
 */
export function toDogecoinPsbtNetwork(networkType: number): bitcoin.Network {
  switch (networkType) {
    case 0: // MAINNET
      return dogecoinMainnet;
    case 1: // TESTNET
      return dogecoinTestnet;
    default:
      throw new Error(`Unsupported network type: ${networkType}`);
  }
}

/**
 * Get Dogecoin network by chain type
 * @param chainType The chain type enum
 * @returns The corresponding bitcoinjs-lib Network
 */
export function getDogecoinNetwork(chainType: number): bitcoin.Network {
  // For now, map all to mainnet - we'll expand this based on chain type
  switch (chainType) {
    case 0: // BITCOIN_MAINNET
      return dogecoinMainnet;
    case 1: // BITCOIN_TESTNET
    case 2: // BITCOIN_TESTNET4
      return dogecoinTestnet;
    default:
      return dogecoinMainnet;
  }
}

/**
 * Get the correct BIP-44 coin type for Dogecoin networks
 * @param chainType The chain type enum
 * @returns The coin type number for BIP-44 derivation
 */
export function getDogecoinCoinType(chainType: number): number {
  // Dogecoin uses coin type 3 (0x03) for BIP44 derivation
  return 3;
}

/**
 * Get the correct HD derivation path for Dogecoin
 * @param chainType The chain type enum
 * @returns The BIP-44 derivation path
 */
export function getDogecoinHDPath(chainType: number): string {
  const coinType = getDogecoinCoinType(chainType);
  return `m/44'/${coinType}'/0'/0/0`;
}


