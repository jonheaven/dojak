/**
 * Charms Protocol Constants and Configuration
 * Layer 1 metaprotocol for programmable tokens on UTXO blockchains
 */

import { getCommandDogApiBaseUrl } from '../../utils/api';

/**
 * Charms-supported chain identifiers
 */
export type CharmsChainId = 'btc' | 'ltc' | 'doge' | 'ada';

/**
 * Charms protocol version
 */
export const CHARMS_PROTOCOL_VERSION = '1.0.0';

/**
 * Charms magic bytes for spell identification
 * Used in OP_RETURN outputs
 */
export const CHARMS_MAGIC = new Uint8Array([67, 72, 65, 82, 77, 83]); // 'CHARMS'

/**
 * Charms application tags
 */
export enum CharmsAppTag {
  TOKEN = 't',          // Fungible tokens
  NFT = 'n',            // Non-fungible tokens
  APP = 'a',            // Custom applications
  COLLECTION = 'c',    // NFT collections
}

/**
 * Charms operation types
 */
export enum CharmsOperationType {
  MINT = 'mint',
  TRANSFER = 'transfer',
  BURN = 'burn',
  BEAM_OUT = 'beam_out',
  BEAM_IN = 'beam_in',
  UPDATE = 'update',
}

/**
 * Chain-specific Charms configuration
 */
export const CHARMS_CHAIN_CONFIG: Record<CharmsChainId, {
  name: string;
  coinType: number;
  addressPrefix: string;
  scriptPrefix: string;
  witnessVersion?: number;
  maxOpReturnSize: number;
  dustThreshold: number;
  supportsSegwit: boolean;
  supportsTaproot: boolean;
  supportsEutxo: boolean;
}> = {
  btc: {
    name: 'Bitcoin',
    coinType: 0,
    addressPrefix: 'bc1',
    scriptPrefix: '0020',
    witnessVersion: 1,
    maxOpReturnSize: 80,
    dustThreshold: 546,
    supportsSegwit: true,
    supportsTaproot: true,
    supportsEutxo: false,
  },
  ltc: {
    name: 'Litecoin',
    coinType: 2,
    addressPrefix: 'ltc1',
    scriptPrefix: '0020',
    witnessVersion: 1,
    maxOpReturnSize: 80,
    dustThreshold: 546,
    supportsSegwit: true,
    supportsTaproot: true,
    supportsEutxo: false,
  },
  doge: {
    name: 'Dogecoin',
    coinType: 3,
    addressPrefix: 'D',
    scriptPrefix: '',
    maxOpReturnSize: 80,
    dustThreshold: 100000000, // 1 DOGE
    supportsSegwit: false,
    supportsTaproot: false,
    supportsEutxo: false,
  },
  ada: {
    name: 'Cardano',
    coinType: 1815,
    addressPrefix: 'addr',
    scriptPrefix: '',
    maxOpReturnSize: 16384,
    dustThreshold: 1000000, // 1 ADA
    supportsSegwit: false,
    supportsTaproot: false,
    supportsEutxo: true,
  },
};

/**
 * Default token configuration template
 */
export const DEFAULT_TOKEN_CONFIG = {
  tag: CharmsAppTag.TOKEN,
  decimals: 8,
  description: 'Charms protocol token',
} as const;

/**
 * Charms HTTP API base (paths like `/balance`, `/utxos/{txid}/{vout}` are appended by {@link ../services/charmsService}).
 * Production and dev default: **command.dog** `{VITE_COMMAND_DOG_API_URL or https://api.command.dog}/v1/charms`.
 * Optional override: `VITE_CHARMS_API_BASE_URL` or `CHARMS_API_BASE_URL` (full base including `/v1/charms`, no trailing slash).
 */
function resolveCharmsApiBase(): string {
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env?.CHARMS_API_BASE_URL === 'string'
      ? process.env.CHARMS_API_BASE_URL.trim()
      : '';
  const fromVite =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CHARMS_API_BASE_URL
      ? String(import.meta.env.VITE_CHARMS_API_BASE_URL).trim()
      : '';
  const explicit = fromProcess || fromVite;
  if (explicit) return explicit.replace(/\/$/, '');

  const cmd = getCommandDogApiBaseUrl().replace(/\/$/, '');
  return `${cmd}/v1/charms`;
}

export const CHARMS_API_BASE = resolveCharmsApiBase();
