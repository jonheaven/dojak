import { TREATS_RESERVED_TICKERS, type TreatsOpKind } from './constants';

function normalizeTicker(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length > 4) return null;
  if (!/^[a-zA-Z0-9]+$/.test(t)) return null;
  const lower = t.toLowerCase();
  if (TREATS_RESERVED_TICKERS.has(lower)) return null;
  return lower;
}

function positiveIntString(v: string): string | null {
  const s = v.trim();
  if (!s || !/^[0-9]+$/.test(s)) return null;
  if (s.length > 1 && s.startsWith('0')) return null;
  if (s === '0') return null;
  return s;
}

export function buildTreatsDeployJson(tick: string, max: string, lim?: string): string | null {
  const t = normalizeTicker(tick);
  const x = positiveIntString(max);
  if (!t || !x) return null;
  const obj: Record<string, string> = { p: 'dt', op: 'd', t, x };
  if (lim?.trim()) {
    const l = positiveIntString(lim);
    if (!l) return null;
    obj.l = l;
  }
  return JSON.stringify(obj);
}

export function buildTreatsMintJson(tick: string, amt: string): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  if (!t || !a) return null;
  return JSON.stringify({ p: 'dt', op: 'm', t, a });
}

export type TreatsMintPowFields = {
  challengeId: string;
  nonce: string;
  difficulty: number;
};

export function buildTreatsMintPowJson(
  tick: string,
  amt: string,
  pow: TreatsMintPowFields,
): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  if (!t || !a) return null;
  const c = pow.challengeId.trim().toLowerCase();
  const n = pow.nonce.trim();
  const d = pow.difficulty;
  if (!/^[0-9a-f]{16}$/.test(c)) return null;
  if (!/^[0-9]{1,12}$/.test(n) || (n.length > 1 && n.startsWith('0'))) return null;
  if (!Number.isInteger(d) || d < 1 || d > 7) return null;
  return JSON.stringify({ p: 'dt', op: 'm', t, a, d: String(d), c, n });
}

export function buildTreatsTransferJson(tick: string, amt: string): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  if (!t || !a) return null;
  return JSON.stringify({ p: 'dt', op: 't', t, a });
}

export function buildTreatsBurnJson(tick: string, amt: string): string | null {
  const t = normalizeTicker(tick);
  const a = positiveIntString(amt);
  if (!t || !a) return null;
  return JSON.stringify({ p: 'dt', op: 'b', t, a });
}

export function treatsPayloadBytes(op: TreatsOpKind, fields: Record<string, string>): Buffer | null {
  let json: string | null = null;
  switch (op) {
    case 'deploy':
      json = buildTreatsDeployJson(fields.tick ?? '', fields.max ?? '', fields.lim);
      break;
    case 'mint':
      if (fields.powChallengeId && fields.powNonce && fields.powDifficulty) {
        json = buildTreatsMintPowJson(fields.tick ?? '', fields.amt ?? '', {
          challengeId: fields.powChallengeId,
          nonce: fields.powNonce,
          difficulty: Number(fields.powDifficulty),
        });
      } else {
        json = buildTreatsMintJson(fields.tick ?? '', fields.amt ?? '');
      }
      break;
    case 'transfer':
      json = buildTreatsTransferJson(fields.tick ?? '', fields.amt ?? '');
      break;
    case 'burn':
      json = buildTreatsBurnJson(fields.tick ?? '', fields.amt ?? '');
      break;
  }
  return json ? Buffer.from(json, 'utf8') : null;
}
