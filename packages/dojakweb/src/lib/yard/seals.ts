/**
 * YARD seal registry — locks stamped UTXOs so ordinary sends cannot knock the sticky off.
 */

import { lockUtxo, unlockUtxo, loadLockedUtxos } from '../utxo-tools';
import type { OpenNote } from './consignment';
import { encodeConsignmentJson, type YardConsignment } from './consignment';

const SEALS_KEY = (address: string) => `dojakweb-yard-seals-${address}`;
const CONS_KEY = (address: string) => `dojakweb-yard-consignments-${address}`;

export type StoredYardSeal = {
  sealKey: string; // txid:vout rpc
  contractLabel: string;
  amount: string; // bigint decimal
  pubkeyHex: string;
  tick: string;
  updatedAt: number;
};

function readSeals(address: string): StoredYardSeal[] {
  try {
    const raw = localStorage.getItem(SEALS_KEY(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredYardSeal[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSeals(address: string, seals: StoredYardSeal[]) {
  localStorage.setItem(SEALS_KEY(address), JSON.stringify(seals));
}

export function listYardSeals(address: string): StoredYardSeal[] {
  return readSeals(address);
}

export function yardSealOutpointKeys(address: string): string[] {
  return readSeals(address).map((s) => s.sealKey.toLowerCase());
}

/** Protect open notes that belong to `ourPubkeyHex` (lock + registry + consignment backup). */
export function protectOpenNotes(opts: {
  address: string;
  ourPubkeyHex: string;
  notes: OpenNote[];
  consignment: YardConsignment;
}): { protectedCount: number; sealKeys: string[] } {
  const ours = opts.notes.filter(
    (n) => n.pubkeyHex.toLowerCase() === opts.ourPubkeyHex.toLowerCase(),
  );
  const existing = readSeals(opts.address);
  const byKey = new Map(existing.map((s) => [s.sealKey.toLowerCase(), s]));
  for (const n of ours) {
    const [txid, voutStr] = n.sealKey.split(':');
    lockUtxo(opts.address, txid.toLowerCase(), Number(voutStr));
    byKey.set(n.sealKey.toLowerCase(), {
      sealKey: n.sealKey,
      contractLabel: n.contractLabel,
      amount: n.amount.toString(),
      pubkeyHex: n.pubkeyHex,
      tick: n.tick,
      updatedAt: Date.now(),
    });
  }
  writeSeals(opts.address, [...byKey.values()]);
  // Backup consignment JSON for this address
  try {
    const bag = JSON.parse(localStorage.getItem(CONS_KEY(opts.address)) || '{}') as Record<
      string,
      string
    >;
    for (const n of ours) {
      bag[n.sealKey.toLowerCase()] = encodeConsignmentJson(opts.consignment);
    }
    localStorage.setItem(CONS_KEY(opts.address), JSON.stringify(bag));
  } catch {
    /* non-fatal */
  }
  return { protectedCount: ours.length, sealKeys: ours.map((n) => n.sealKey) };
}

export function loadConsignmentJsonForSeal(address: string, sealKey: string): string | null {
  try {
    const bag = JSON.parse(localStorage.getItem(CONS_KEY(address)) || '{}') as Record<
      string,
      string
    >;
    return bag[sealKey.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

export function releaseYardSeal(address: string, sealKey: string) {
  const [txid, voutStr] = sealKey.split(':');
  unlockUtxo(address, txid, Number(voutStr));
  writeSeals(
    address,
    readSeals(address).filter((s) => s.sealKey.toLowerCase() !== sealKey.toLowerCase()),
  );
}

export function isYardSealLocked(address: string, txid: string, vout: number): boolean {
  const key = `${txid.toLowerCase()}:${vout}`;
  if (yardSealOutpointKeys(address).includes(key)) return true;
  const locked = loadLockedUtxos(address);
  return locked.has(key);
}
