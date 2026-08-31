/**
 * Ð:WOW guestbook envelope — dogenals/spec/protocols/wow/spec.md
 */

export const WOW_MARKER = 'Ð:WOW';
export const WOW_DESTINATIONS = ['earth', 'moon', 'mars', 'humanity'] as const;
export type WowDestination = (typeof WOW_DESTINATIONS)[number];

export type BuildWowSendOpts = {
  to: WowDestination;
  msg: string;
  x?: string;
  ts?: number;
  vow?: string;
};

export function buildWowSendJson(opts: BuildWowSendOpts): string {
  if (!WOW_DESTINATIONS.includes(opts.to)) throw new Error('Ð:WOW destination must be earth|moon|mars|humanity');
  const body: Record<string, unknown> = {
    p: WOW_MARKER,
    op: 'send',
    to: opts.to,
    msg: opts.msg.slice(0, 280),
  };
  if (opts.x) body.x = opts.x;
  if (opts.ts !== undefined) body.ts = opts.ts;
  if (opts.vow) body.vow = opts.vow;
  return JSON.stringify(body);
}

export function buildWowReactJson(targetInscriptionId: string, x?: string): string {
  const body: Record<string, unknown> = {
    p: WOW_MARKER,
    op: 'wow',
    id: targetInscriptionId.trim().toLowerCase(),
  };
  if (x) body.x = x;
  return JSON.stringify(body);
}
