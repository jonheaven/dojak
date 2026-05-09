/**
 * Core Charms Protocol Types and Interfaces
 */

import type { CharmsChainId, CharmsAppTag, CharmsOperationType } from './constants';

/**
 * Base Charms entity interface
 */
export interface CharmsEntity {
  id: string;
  chainId: CharmsChainId;
  txid: string;
  vout: number;
  blockHeight?: number;
  timestamp?: number;
  confirmed: boolean;
}

/**
 * Charms spell structure
 * Core data structure for all Charms operations
 */
export interface CharmsSpell {
  // Protocol metadata
  version: string;
  tag: CharmsAppTag;
  op: CharmsOperationType;

  // Spell identification
  id: string;
  chainId: CharmsChainId;

  // Token/asset information
  ticker?: string;
  name?: string;

  // Operation data
  amount?: bigint;
  decimals?: number;
  to?: string;
  from?: string;

  // Cross-chain beaming
  beamTo?: CharmsChainId;
  beamProof?: string;

  // NFT/Collection data
  collection?: string;
  tokenId?: string;
  metadata?: Record<string, unknown>;

  // Application data
  appData?: Uint8Array;

  // Validation
  signature?: string;
  proof?: CharmsProof;

  // Transaction context
  txid: string;
  vout: number;
  blockHeight?: number;
  timestamp?: number;
}

/**
 * Charms proof structure for validation
 */
export interface CharmsProof {
  version: string;
  type: 'utxo' | 'eutxo' | 'witness';
  chainId: CharmsChainId;

  // UTXO proof data
  txid: string;
  vout: number;
  scriptPubKey: string;
  amount: bigint;

  // Witness/signature data
  witness?: string[];
  signature?: string;
  publicKey?: string;

  // Merkle proof for SPV
  merkleProof?: string[];
  blockHash?: string;
  blockHeight?: number;

  // Validation status
  verified: boolean;
  error?: string;
}

/**
 * Charms token instance
 */
export interface CharmsToken extends CharmsEntity {
  ticker: string;
  name: string;
  balance: bigint;
  decimals: number;

  // Ownership
  address: string;
  scriptPubKey: string;

  // Token metadata
  description?: string;
  icon?: string;
  website?: string;

  // Token history
  mintTxid?: string;
  transferHistory: TokenTransfer[];

  // Cross-chain state
  totalSupply?: bigint;
  chainSupply: Record<CharmsChainId, bigint>;
  beamHistory: TokenBeam[];
}

/**
 * Token transfer record
 */
export interface TokenTransfer {
  txid: string;
  ticker: string;
  from: string;
  to: string;
  amount: bigint;
  timestamp: number;
  blockHeight: number;
  chainId: CharmsChainId;
  spell: CharmsSpell;
}

/**
 * Token beam (cross-chain transfer) record
 */
export interface TokenBeam {
  beamId: string;
  ticker: string;
  fromChain: CharmsChainId;
  toChain: CharmsChainId;
  amount: bigint;

  // Source transaction
  sourceTxid: string;
  sourceVout: number;
  sourceAddress: string;

  // Destination transaction
  destTxid?: string;
  destVout?: number;
  destAddress: string;

  // Beam state
  status: BeamStatus;
  proof?: CharmsProof;
  timestamp: number;

  // Error handling
  error?: string;
  retryCount: number;
}

/**
 * Beam status enumeration
 */
export enum BeamStatus {
  INITIATED = 'initiated',
  LOCKED = 'locked',
  PROOF_GENERATED = 'proof_generated',
  BEAMING = 'beaming',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Charms transaction structure
 */
export interface CharmsTransaction {
  txid: string;
  chainId: CharmsChainId;
  blockHeight?: number;
  timestamp?: number;
  confirmed: boolean;

  // Transaction details
  inputs: CharmsInput[];
  outputs: CharmsOutput[];
  fee: bigint;

  // Charms-specific data
  spells: CharmsSpell[];

  // Status
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
}

/**
 * Charms input structure
 */
export interface CharmsInput {
  txid: string;
  vout: number;
  scriptSig: string;
  witness?: string[];
  sequence: number;

  // Value and script
  value: bigint;
  scriptPubKey: string;
  address?: string;

  // Charms data
  enchantment?: CharmsSpell;
}

/**
 * Charms output structure
 */
export interface CharmsOutput {
  vout: number;
  value: bigint;
  scriptPubKey: string;
  address?: string;

  // Charms data
  enchantment?: CharmsSpell;
  opReturn?: Uint8Array;
}

/**
 * Spell validation result
 */
export interface SpellValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];

  // Validation details
  syntaxValid: boolean;
  semanticsValid: boolean;
  proofValid: boolean;

  // Gas/fee estimation
  estimatedFee: bigint;
  complexity: 'simple' | 'medium' | 'complex';
}

/**
 * API Response types
 */
export interface TokenBalanceResponse {
  ticker: string;
  balance: string;
  chainId: CharmsChainId;
  address: string;
  charms: unknown[];
  lastUpdated: string;
}

export interface MintParams {
  ticker: string;
  tag: 't' | 'n';
  supply: bigint;
  decimals: number;
  metadata?: Record<string, unknown>;
}

export interface PrepareMintResponse {
  unsignedTxHex: string;
  feeEstimate: number;
  changeOutput: {
    address: string;
    amount: string;
  };
  spell: {
    ticker: string;
    supply: string;
    decimals: number;
    chainId: CharmsChainId;
  };
  network: string;
  tokenomics?: {
    allocations: Array<{
      category: string;
      percent: number;
      amount: string;
      address?: string;
    }>;
    reserveAmount: string;
    metadata?: Record<string, unknown>;
  };
}

export interface BroadcastResponse {
  txid: string;
  status?: string;
}

export interface PrepareTransferResponse {
  unsignedTxHex: string;
  feeEstimate: number;
  changeOutput: {
    address: string;
    amount: string;
  };
  transfer: {
    ticker: string;
    amount: string;
    from: string;
    to: string;
  };
  network: string;
}

export interface TransferTokenParams {
  ticker: string;
  fromAddress: string;
  fromUtxo: string;
  toAddress: string;
  amount: bigint;
  chainId: CharmsChainId;
  network?: string;
  changeAddress?: string;
  identityOverride?: string;
  verificationKeyOverride?: string;
}

export interface BeamAssetParams {
  ticker: string;
  assetUtxo: string;
  fromChain: CharmsChainId;
  toChain: CharmsChainId;
  destAddress: string;
  amount: bigint;
  network?: string;
  identityOverride?: string;
  verificationKeyOverride?: string;
}

export interface BeamAssetResult {
  placeholderTxid: string;
  sourceTxid: string;
  fromChain: CharmsChainId;
  toChain: CharmsChainId;
  ticker: string;
  amount: bigint;
  destAddress: string;
}

export interface ProofBundle {
  spell_hash?: string;
  proof?: {
    pi_a?: string[];
    pi_b?: string[][];
    pi_c?: string[];
  };
  public_inputs?: Record<string, unknown>;
  status?: string;
}

export interface TransferPreparePayload {
  unsignedTxHex: string;
  spellJson: string;
  vk: string;
  proofBundle: ProofBundle;
  network?: string;
}

export interface BeamPreparePayload {
  placeholder_tx_hex: string | null;
  source_spell_json: string;
  vk: string;
  proofBundle: ProofBundle;
  network?: string;
}
