/**
 * Local browser storage for the user's active ordinal listings.
 *
 * Persists signed PSBTs + metadata in localStorage so that:
 *  - The wallet Listings tab can show the seller's own active listings
 *  - We can detect when a listing has been purchased (tx confirmed on-chain)
 *  - The listing QR code can be regenerated / reshared at any time
 */

import { encodeBase64PsdtToDogePsdtUri } from '../lib/psdt/codec';

const STORE_KEY = 'dojakweb_active_listings';

export type ListingProtocol = 'nostr' | 'dmp' | 'qr_only';

export interface ActiveListing {
  /** Unique: inscriptionId is the key */
  inscriptionId: string;
  inscriptionNumber: number | string;
  /** txid:vout of the inscription UTXO at the time of listing */
  inscriptionUtxo: string;
  inscriptionContentType: string;
  inscriptionPreview: string;   // URL for display
  sellerAddress: string;
  priceKoinu: number;
  /** Signed seller PSBT (base64) */
  signedPsbtBase64: string;
  protocol: ListingProtocol;
  /** ISO timestamp */
  listedAt: string;
  /** nostr event id, if published */
  nostrEventId?: string;
  /** Ephemeral private key for nostr operations (hex) */
  nostrPrivateKey?: string;
  /** Whether to show in QR sharing */
  shareableQR: boolean;
  /** URL with the PSBT embedded in the hash (for QR sharing) */
  shareUrl?: string;
  /** Status — updated by polling */
  status: 'active' | 'sold' | 'cancelled';
  /** txid when sold */
  soldTxid?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadAll(): ActiveListing[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as ActiveListing[]) : [];
  } catch {
    return [];
  }
}

function saveAll(listings: ActiveListing[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify(listings));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return all listings for a specific seller address (or all if no address given). */
export function getActiveListings(sellerAddress?: string): ActiveListing[] {
  const all = loadAll();
  if (!sellerAddress) return all;
  return all.filter(l => l.sellerAddress === sellerAddress);
}

/** Save (or update) a listing. Key = inscriptionId. */
export function saveListing(listing: ActiveListing): void {
  const all     = loadAll();
  const idx     = all.findIndex(l => l.inscriptionId === listing.inscriptionId);
  if (idx >= 0) all[idx] = listing;
  else          all.push(listing);
  saveAll(all);
}

/** Update just the status (active / sold / cancelled) of a listing. */
export function updateListingStatus(
  inscriptionId: string,
  status: ActiveListing['status'],
  soldTxid?: string,
): void {
  const all = loadAll();
  const idx = all.findIndex(l => l.inscriptionId === inscriptionId);
  if (idx < 0) return;
  all[idx].status    = status;
  if (soldTxid)      all[idx].soldTxid = soldTxid;
  saveAll(all);
}

/** Mark nostrEventId and private key after a successful nostr publish. */
export function setListingNostrEventId(inscriptionId: string, eventId: string, privateKey?: string): void {
  const all = loadAll();
  const idx = all.findIndex(l => l.inscriptionId === inscriptionId);
  if (idx < 0) return;
  all[idx].nostrEventId = eventId;
  if (privateKey) all[idx].nostrPrivateKey = privateKey;
  saveAll(all);
}

/** Remove (cancel) a listing entirely. */
export function removeListing(inscriptionId: string): void {
  const all = loadAll().filter(l => l.inscriptionId !== inscriptionId);
  saveAll(all);
}

/** Build the shareable URL (dogepsdt URI embedded in hash, points to /validate). */
export function buildShareUrl(
  baseUrl: string,
  inscriptionId: string,
  psbtBase64: string,
): string {
  try {
    const dogepsdtUri = encodeBase64PsdtToDogePsdtUri(psbtBase64);
    return `${baseUrl}/marketplace/validate?inscription=${inscriptionId}#dogepsdt=${encodeURIComponent(dogepsdtUri)}`;
  } catch {
    // Fallback to legacy raw-PSBT format
    const encoded = encodeURIComponent(psbtBase64);
    return `${baseUrl}/marketplace/validate?inscription=${inscriptionId}#sellerSignedPsbt=${encoded}`;
  }
}

/**
 * Poll MyDoge API to detect whether a listing has been purchased.
 * If the inscription's UTXO has changed from when it was listed, mark it sold.
 *
 * Call this on wallet open or periodically.
 *
 * TODO: Also check for Nostr cancel events to mark listings as cancelled.
 */
export async function pollListingStatuses(
  sellerAddress: string,
): Promise<void> {
  const listings = getActiveListings(sellerAddress).filter(l => l.status === 'active');
  if (listings.length === 0) return;

  // Fetch the seller's current inscription list — this returns output/location data
  try {
    const res = await fetch(`https://api.mydoge.com/inscriptions/${sellerAddress}`);
    if (!res.ok) return;
    const data = await res.json();
    const list: any[] = data?.list ?? data?.items ?? (Array.isArray(data) ? data : []);

    // Build a map of inscriptionId → current output
    const currentOutputs = new Map<string, string>();
    for (const ins of list) {
      if (ins.inscriptionId && ins.output) {
        currentOutputs.set(ins.inscriptionId, ins.output);
      }
    }

    for (const l of listings) {
      const currentOutput = currentOutputs.get(l.inscriptionId);
      if (currentOutput === undefined) {
        // Not in seller's wallet at all — sold or transferred
        updateListingStatus(l.inscriptionId, 'sold');
      } else if (currentOutput !== l.inscriptionUtxo) {
        // UTXO moved — sold or transferred
        updateListingStatus(l.inscriptionId, 'sold');
      }
    }
  } catch { /* ignore transient errors */ }
}
