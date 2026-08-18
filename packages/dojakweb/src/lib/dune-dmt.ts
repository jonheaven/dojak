/**
 * Ðunes-native DMT helpers. Claims are inscriptions that credit ordinary
 * Ðune UTXOs. Regular etch/mint/send encoding is unchanged.
 */

export function normalizeDuneTick(tick: string): string {
  const letters = tick.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters;
}

export function buildDmtBindPayload(params: {
  tick: string;
  elemInscriptionId: string;
}): Record<string, unknown> {
  const tick = normalizeDuneTick(params.tick);
  if (!tick) throw new Error('tick must contain A–Z letters');
  const elem = params.elemInscriptionId.trim().toLowerCase();
  if (!/^[0-9a-f]{64}i\d+$/i.test(elem)) {
    throw new Error('elem must look like <txid>i0');
  }
  return {
    p: 'dunes',
    op: 'deploy',
    tick,
    max: '0',
    dec: '0',
    dmt: true,
    elem,
    dt: 'n',
  };
}

export function buildDmtClaimPayload(params: {
  tick: string;
  blk: number | string;
  elemInscriptionId?: string;
}): Record<string, unknown> {
  const tick = normalizeDuneTick(params.tick);
  if (!tick) throw new Error('tick must contain A–Z letters');
  const blk = String(params.blk).trim();
  if (!/^\d+$/.test(blk)) throw new Error('blk must be a decimal height');
  const out: Record<string, unknown> = {
    p: 'dunes',
    op: 'dmt-claim',
    tick,
    blk,
  };
  const elem = (params.elemInscriptionId || '').trim().toLowerCase();
  if (elem) {
    if (!/^[0-9a-f]{64}i\d+$/i.test(elem)) {
      throw new Error('elem must look like <txid>i0');
    }
    out.dep = elem;
  }
  return out;
}
