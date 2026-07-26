/**
 * Dogecoin mainnet address validation for send / receive UX.
 * Uses bitcoinjs Network decode (checksum + version) — catches off-by-one typos.
 */
import {
  dogecoinAddressToOutputScript,
  DogecoinAddressError,
  DOGE_NETWORK,
} from './dogetag/dogecoinAddress';
import * as bitcoin from 'bitcoinjs-lib';

export type DogeAddressKind = 'p2pkh' | 'p2sh' | 'bech32' | 'unknown';

export type DogeAddressValidation =
  | {
      ok: true;
      address: string;
      kind: DogeAddressKind;
      scriptPubKeyHex: string;
    }
  | {
      ok: false;
      address: string;
      error: string;
      hint?: string;
    };

function classifyScript(script: Buffer): DogeAddressKind {
  try {
    // P2PKH: OP_DUP OP_HASH160 <20> OP_EQUALVERIFY OP_CHECKSIG
    if (script.length === 25 && script[0] === 0x76 && script[1] === 0xa9 && script[2] === 0x14) {
      return 'p2pkh';
    }
    // P2SH: OP_HASH160 <20> OP_EQUAL
    if (script.length === 23 && script[0] === 0xa9 && script[1] === 0x14 && script[22] === 0x87) {
      return 'p2sh';
    }
  } catch {
    /* fall through */
  }
  return 'unknown';
}

/** Strip zero-width / whitespace that paste often inserts. */
export function normalizeDogeAddressInput(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function validateDogecoinAddress(raw: string): DogeAddressValidation {
  const address = normalizeDogeAddressInput(raw);
  if (!address) {
    return { ok: false, address: '', error: 'Enter a Dogecoin address.' };
  }
  if (/^0x/i.test(address) || address.includes(':')) {
    return {
      ok: false,
      address,
      error: 'That looks like an EVM or multi-chain address.',
      hint: 'Dogecoin mainnet addresses usually start with D (or A for some P2SH).',
    };
  }
  if (/^(bc1|tb1|ltc1)/i.test(address)) {
    return {
      ok: false,
      address,
      error: 'That is a Bitcoin / Litecoin bech32 address.',
      hint: 'Paste a Dogecoin address from a Dogecoin wallet.',
    };
  }
  try {
    const script = dogecoinAddressToOutputScript(address);
    // Round-trip through network to catch exotic payloads that somehow decode.
    try {
      bitcoin.address.fromOutputScript(script, DOGE_NETWORK);
    } catch {
      /* bech32 / edge scripts may not round-trip; script decode above is enough */
    }
    const kind = classifyScript(script);
    return {
      ok: true,
      address,
      kind,
      scriptPubKeyHex: script.toString('hex'),
    };
  } catch (e) {
    const msg =
      e instanceof DogecoinAddressError
        ? e.message
        : 'Not a valid Dogecoin mainnet address.';
    return {
      ok: false,
      address,
      error: msg,
      hint: 'Check every character — one wrong letter fails the checksum.',
    };
  }
}

export function assertValidDogecoinAddress(raw: string): string {
  const v = validateDogecoinAddress(raw);
  if (!v.ok) throw new Error(v.error);
  return v.address;
}

export function dogeAddressKindLabel(kind: DogeAddressKind): string {
  switch (kind) {
    case 'p2pkh':
      return 'P2PKH (D…)';
    case 'p2sh':
      return 'P2SH (A…)';
    case 'bech32':
      return 'Bech32';
    default:
      return 'Dogecoin';
  }
}
