/**
 * Outpoints that hold inscription UTXOs — exclude when picking coins for new inscriptions.
 */

export function extractProtectedOutpoints(inscriptions: unknown[] | null | undefined): string[] {
  if (!Array.isArray(inscriptions) || inscriptions.length === 0) return [];
  const protectedSet = new Set<string>();
  const addOutpoint = (candidate: string | undefined) => {
    if (!candidate) return;
    const parts = candidate.split(':');
    if (parts.length < 2) return;
    const txid = parts[0]?.trim().toLowerCase();
    const vout = Number(parts[1]);
    if (!txid || txid.length !== 64 || !Number.isInteger(vout) || vout < 0) return;
    protectedSet.add(`${txid}:${vout}`);
  };
  for (const ins of inscriptions) {
    if (!ins || typeof ins !== 'object') continue;
    const row = ins as Record<string, unknown>;
    addOutpoint(typeof row.output === 'string' ? row.output : undefined);
    addOutpoint(typeof row.location === 'string' ? row.location : undefined);
  }
  return Array.from(protectedSet);
}
