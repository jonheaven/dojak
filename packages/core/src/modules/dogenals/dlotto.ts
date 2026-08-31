/**
 * ÐLotto envelope helpers — dogenals/spec/protocols/dlotto/spec.md
 * Ticket mint UX is dogecoin.games; the wallet detects and protects carriers.
 */

export const DLOTTO_MARKER = 'Ð:LOTTO';
export const DLOTTO_OPS = ['launch', 'ticket', 'draw', 'claim', 'burn'] as const;
export type DlottoOp = (typeof DLOTTO_OPS)[number];

export function isDlottoMarker(p: string | undefined | null): boolean {
  const s = (p || '').trim();
  return s === DLOTTO_MARKER || /lotto/i.test(s);
}

export function buildDlottoEnvelope(op: DlottoOp, fields: Record<string, unknown>): string {
  if (!DLOTTO_OPS.includes(op)) throw new Error(`ÐLotto op must be one of ${DLOTTO_OPS.join(', ')}`);
  return JSON.stringify({
    p: DLOTTO_MARKER,
    op,
    ...fields,
  });
}
