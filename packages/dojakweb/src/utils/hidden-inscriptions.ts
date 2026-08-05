/**
 * Client-only hide list for wallet inscription grids.
 * Does not affect chain ownership — localStorage per address.
 */

const PREFIX = 'dojakweb-hidden-inscriptions:';

function key(address: string): string {
  return `${PREFIX}${address.trim().toLowerCase()}`;
}

export function loadHiddenInscriptionIds(address: string | null | undefined): Set<string> {
  if (!address || typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key(address));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function saveHiddenInscriptionIds(address: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(address), JSON.stringify([...ids]));
    window.dispatchEvent(
      new CustomEvent('dojakweb-hidden-inscriptions-changed', { detail: { address } }),
    );
  } catch {
    /* quota */
  }
}

export function hideInscription(address: string, inscriptionId: string): Set<string> {
  const next = loadHiddenInscriptionIds(address);
  next.add(inscriptionId);
  saveHiddenInscriptionIds(address, next);
  return next;
}

export function unhideInscription(address: string, inscriptionId: string): Set<string> {
  const next = loadHiddenInscriptionIds(address);
  next.delete(inscriptionId);
  saveHiddenInscriptionIds(address, next);
  return next;
}

export function isInscriptionHidden(address: string | null | undefined, inscriptionId: string): boolean {
  return loadHiddenInscriptionIds(address).has(inscriptionId);
}

export function filterVisibleInscriptions<T extends { inscriptionId?: string; id?: string }>(
  address: string | null | undefined,
  rows: T[],
): T[] {
  const hidden = loadHiddenInscriptionIds(address);
  if (!hidden.size) return rows;
  return rows.filter((r) => {
    const id = r.inscriptionId || r.id || '';
    return id ? !hidden.has(id) : true;
  });
}
