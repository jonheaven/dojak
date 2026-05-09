import * as bitcoin from 'bitcoinjs-lib';

/** Dogecoin mainnet — used for WIF, addresses, and script building. */
export const DOGE_NETWORK: bitcoin.Network = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dc',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

export class DogecoinAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DogecoinAddressError';
  }
}

/**
 * Decode a Dogecoin payment address to scriptPubKey (P2PKH, P2SH, or bech32 per network).
 * Matches `Transaction#to(address, …)` in bitcore-based doginals.js.
 */
export function dogecoinAddressToOutputScript(address: string): Buffer {
  const trimmed = address.trim();
  if (!trimmed) throw new DogecoinAddressError('Address is empty.');
  try {
    return Buffer.from(bitcoin.address.toOutputScript(trimmed, DOGE_NETWORK));
  } catch {
    throw new DogecoinAddressError(
      'Not a valid Dogecoin mainnet address. Check for typos and use an address from a Dogecoin wallet.',
    );
  }
}

export function parseDogecoinReceiveAddress(address: string): { scriptPubKey: Buffer; display: string } {
  const display = address.trim();
  const scriptPubKey = dogecoinAddressToOutputScript(display);
  return { scriptPubKey, display };
}

/** Serialized tx output size (value + varint length + script) — legacy non-witness vbyte count. */
export function legacyOutputVbytes(scriptPubKey: Buffer): number {
  const n = scriptPubKey.length;
  const varint = n < 0xfd ? 1 : n <= 0xffff ? 3 : 5;
  return 8 + varint + n;
}
