/**
 * HD seed derivation for Dogecoin L1 (reference path) and DogeOS / EVM (BIP-44 ETH path).
 * Uses the same BIP-39 mnemonic as the in-browser wallet stack.
 */
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { bytesToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/** BIP-44 Dogecoin coin type 3 — first receive address (account 0). Matches BrowserWallet default account index 0. */
export const DOGECOIN_L1_REFERENCE_PATH = "m/44'/3'/0'/0/0" as const;

/** Standard Ethereum account #0 — used for DogeOS (EVM-compatible) addresses from the same seed. */
export const DOGEOS_EVM_DEFAULT_PATH = "m/44'/60'/0'/0/0" as const;

function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().replace(/\s+/g, ' ');
}

/**
 * Derive a secp256k1 private key at a BIP-32 path from a BIP-39 mnemonic.
 */
export function derivePrivateKeyAtPath(
  mnemonic: string,
  path: string,
  passphrase: string | undefined
): Uint8Array {
  const normalized = normalizeMnemonic(mnemonic);
  const seed = mnemonicToSeedSync(normalized, passphrase ?? '');
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(path);
  if (!child.privateKey) {
    throw new Error('Failed to derive private key at path');
  }
  return child.privateKey;
}

/**
 * Ethereum-style checksummed address for DogeOS (same derivation as MetaMask account #0).
 */
export function deriveDogeosAddressFromMnemonic(
  mnemonic: string,
  passphrase?: string,
  path: string = DOGEOS_EVM_DEFAULT_PATH
): `0x${string}` {
  const pk = derivePrivateKeyAtPath(mnemonic, path, passphrase);
  const hex = bytesToHex(pk) as `0x${string}`;
  return privateKeyToAccount(hex).address;
}
