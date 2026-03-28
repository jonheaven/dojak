/**
 * Dunestone encoding library for Dogecoin Dunes protocol
 * 
 * Based on the dog indexer implementation:
 * https://github.com/jonheaven/dog
 * 
 * Dunestone structure:
 * - OP_RETURN OP_13 <payload>
 * - Payload uses varint encoding with tags
 * - For minting: only need to encode the mint tag with DuneId
 */

import * as bitcoin from 'bitcoinjs-lib';

// Dunestone protocol constants
export const MAGIC_NUMBER = bitcoin.opcodes.OP_13; // OP_PUSHNUM_13
export const MAX_STANDARD_OP_RETURN_SIZE = 80; // Dogecoin standard

// Tags for dunestone protocol
enum Tag {
  Body = 0,
  Flags = 2,
  Dune = 4,
  Premine = 6,
  Cap = 8,
  Amount = 10,
  HeightStart = 12,
  HeightEnd = 14,
  OffsetStart = 16,
  OffsetEnd = 18,
  Mint = 20, // For minting existing dunes
  Pointer = 22,
  Cenotaph = 126,
  
  Divisibility = 1,
  Spacers = 3,
  Symbol = 5,
  Nop = 127,
}

/**
 * Encode a number as varint (LEB128)
 * This is the same variable-length integer encoding used in Bitcoin
 */
function encodeVarint(n: bigint): Buffer {
  const bytes: number[] = [];
  
  const threshold = BigInt(0x80);
  const mask = BigInt(0x7f);
  const shift = BigInt(7);
  
  while (n >= threshold) {
    bytes.push(Number(n & mask) | 0x80);
    n >>= shift;
  }
  
  bytes.push(Number(n));
  return Buffer.from(bytes);
}

/**
 * Encode a tag and its values into the payload
 */
function encodeTag(tag: Tag, values: bigint[], payload: number[]): void {
  payload.push(...encodeVarint(BigInt(tag)));
  for (const value of values) {
    payload.push(...encodeVarint(value));
  }
}

/**
 * Encode a tag with optional value
 */
function encodeTagOption(tag: Tag, value: bigint | undefined, payload: number[]): void {
  if (value !== undefined) {
    encodeTag(tag, [value], payload);
  }
}

/**
 * DuneId represents a unique dune identifier
 */
export interface DuneId {
  block: number;  // Block height where dune was etched
  tx: number;     // Transaction index in that block
}

/**
 * Dunestone structure for protocol operations
 */
export interface Dunestone {
  mint?: DuneId;      // Mint an existing dune
  pointer?: number;   // Output index to receive dunes
  edicts?: Edict[];   // Transfer edicts
  etching?: Etching;  // Create new dune
}

/**
 * Edict for transferring dunes
 */
export interface Edict {
  id: DuneId;
  amount: bigint;
  output: number;
}

/**
 * Etching creates a new dune
 */
export interface Etching {
  dune?: bigint;
  divisibility?: number;
  premine?: bigint;
  symbol?: string;
  spacers?: number;
  terms?: Terms;
  turbo?: boolean;
}

/**
 * Terms define minting parameters
 */
export interface Terms {
  cap?: bigint;
  amount?: bigint;
  height?: [number | undefined, number | undefined];
  offset?: [number | undefined, number | undefined];
}

/**
 * Encode a Dunestone into a script (OP_RETURN output)
 * 
 * @param dunestone The dunestone to encode
 * @returns Buffer containing the complete dunestone script
 */
export function encipher(dunestone: Dunestone): Buffer {
  const payload: number[] = [];

  // Encode etching if present
  if (dunestone.etching) {
    const etching = dunestone.etching;
    let flags = BigInt(0);
    
    // Set etching flag (bit 0)
    flags |= BigInt(1);
    
    // Set terms flag (bit 1) if terms present
    if (etching.terms) {
      flags |= BigInt(2);
    }
    
    // Set turbo flag (bit 2) if turbo
    if (etching.turbo) {
      flags |= BigInt(4);
    }
    
    encodeTag(Tag.Flags, [flags], payload);
    
    encodeTagOption(Tag.Dune, etching.dune, payload);
    if (etching.divisibility !== undefined) {
      encodeTagOption(Tag.Divisibility, BigInt(etching.divisibility), payload);
    }
    if (etching.spacers !== undefined) {
      encodeTagOption(Tag.Spacers, BigInt(etching.spacers), payload);
    }
    if (etching.symbol) {
      encodeTagOption(Tag.Symbol, BigInt(etching.symbol.charCodeAt(0)), payload);
    }
    encodeTagOption(Tag.Premine, etching.premine, payload);
    
    if (etching.terms) {
      const terms = etching.terms;
      encodeTagOption(Tag.Amount, terms.amount, payload);
      encodeTagOption(Tag.Cap, terms.cap, payload);
      if (terms.height) {
        if (terms.height[0] !== undefined) {
          encodeTagOption(Tag.HeightStart, BigInt(terms.height[0]), payload);
        }
        if (terms.height[1] !== undefined) {
          encodeTagOption(Tag.HeightEnd, BigInt(terms.height[1]), payload);
        }
      }
      if (terms.offset) {
        if (terms.offset[0] !== undefined) {
          encodeTagOption(Tag.OffsetStart, BigInt(terms.offset[0]), payload);
        }
        if (terms.offset[1] !== undefined) {
          encodeTagOption(Tag.OffsetEnd, BigInt(terms.offset[1]), payload);
        }
      }
    }
  }

  // Encode mint if present
  if (dunestone.mint) {
    encodeTag(Tag.Mint, [BigInt(dunestone.mint.block), BigInt(dunestone.mint.tx)], payload);
  }

  // Encode pointer if present
  if (dunestone.pointer !== undefined) {
    encodeTagOption(Tag.Pointer, BigInt(dunestone.pointer), payload);
  }

  // Encode edicts if present
  if (dunestone.edicts && dunestone.edicts.length > 0) {
    payload.push(...encodeVarint(BigInt(Tag.Body)));
    
    // Sort edicts by id
    const sortedEdicts = [...dunestone.edicts].sort((a, b) => {
      if (a.id.block !== b.id.block) return a.id.block - b.id.block;
      return a.id.tx - b.id.tx;
    });
    
    let previousBlock = 0;
    let previousTx = 0;
    
    for (const edict of sortedEdicts) {
      // Encode delta from previous id
      const blockDelta = edict.id.block - previousBlock;
      const txDelta = edict.id.tx - (blockDelta === 0 ? previousTx : 0);
      
      payload.push(...encodeVarint(BigInt(blockDelta)));
      payload.push(...encodeVarint(BigInt(txDelta)));
      payload.push(...encodeVarint(edict.amount));
      payload.push(...encodeVarint(BigInt(edict.output)));
      
      previousBlock = edict.id.block;
      previousTx = edict.id.tx;
    }
  }

  // Build the script: OP_RETURN OP_13 <payload>
  const script = bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    MAGIC_NUMBER,
    Uint8Array.from(payload)
  ]);

  return Buffer.from(script);
}

/**
 * Create a simple mint dunestone
 * This is the most common operation - minting an existing dune
 * 
 * @param duneId The DuneId to mint (block and tx index)
 * @param outputIndex Optional output index to receive minted dunes (default: 1)
 * @returns Encoded dunestone script
 */
export function createMintDunestone(duneId: DuneId, outputIndex: number = 1): Buffer {
  const dunestone: Dunestone = {
    mint: duneId,
    pointer: outputIndex
  };
  
  return encipher(dunestone);
}

/**
 * Parse a DuneId from string format "block:tx"
 * 
 * @param duneIdString String in format "123456:7" (block:tx)
 * @returns DuneId object
 */
export function parseDuneId(duneIdString: string): DuneId {
  const parts = duneIdString.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid DuneId format: ${duneIdString}. Expected "block:tx"`);
  }
  
  const block = parseInt(parts[0], 10);
  const tx = parseInt(parts[1], 10);
  
  if (isNaN(block) || isNaN(tx)) {
    throw new Error(`Invalid DuneId format: ${duneIdString}. Block and tx must be numbers`);
  }
  
  return { block, tx };
}

/**
 * Format a DuneId as string "block:tx"
 */
export function formatDuneId(duneId: DuneId): string {
  return `${duneId.block}:${duneId.tx}`;
}

export const dunestone = {
  encipher,
  createMintDunestone,
  parseDuneId,
  formatDuneId,
  MAGIC_NUMBER,
  MAX_STANDARD_OP_RETURN_SIZE
};
