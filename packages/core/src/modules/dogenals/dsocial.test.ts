import { bytesToHex, hexToBytes } from './hash16';
import {
  encodeDsocialSignal,
  DSOCIAL_FLAG,
  DSOCIAL_MIN_LIKE_KOINU,
  parseDsocialSignal,
  planDsocialRevealPayments,
  buildDsocialPostJson,
} from './dsocial';

describe('Ðocial OP_RETURN vectors (spec/protocols/dsocial/vectors/op-return-vectors.json)', () => {
  it('SOC-OR-001 engage like', () => {
    const payload = encodeDsocialSignal({
      kind: 'engage',
      flags: DSOCIAL_FLAG.sound,
      reaction: 'like',
      targetHash16: '00112233445566778899aabbccddeeff',
      nonce: 1,
    });
    expect(bytesToHex(payload)).toBe('c3903a534f430102010100112233445566778899aabbccddeeff01000000');
    expect(payload.length).toBe(30);
    const parsed = parseDsocialSignal(payload);
    expect(parsed?.kind).toBe(0x02);
    expect(parsed?.reaction).toBe(0x01);
  });

  it('SOC-OR-002 follow', () => {
    const payload = encodeDsocialSignal({
      kind: 'follow',
      flags: 0,
      reaction: 'none',
      targetHash16: hexToBytes('ffffffffffffffffffffffffffffffff'),
      nonce: 0,
    });
    expect(bytesToHex(payload)).toBe('c3903a534f4301030000ffffffffffffffffffffffffffffffff00000000');
  });

  it('SOC-OR-003 free fire react', () => {
    const payload = encodeDsocialSignal({
      kind: 'engage',
      flags: 0,
      reaction: 'fire',
      targetHash16: '00112233445566778899aabbccddeeff',
      nonce: 7,
    });
    expect(bytesToHex(payload)).toBe('c3903a534f430102000300112233445566778899aabbccddeeff07000000');
  });
});

describe('Ðocial UTXO tip outputs (spec §6.7)', () => {
  it('plans attribution then mention, skips self and dupes', () => {
    const planned = planDsocialRevealPayments({
      senderAddress: 'DSender',
      quotePayTo: 'DQuoted',
      parentPayTo: 'DQuoted',
      mentionPayTos: ['DQuoted', 'DMention', 'DSender'],
    });
    expect(planned).toEqual([
      { address: 'DQuoted', satoshis: DSOCIAL_MIN_LIKE_KOINU, kind: 'attribution' },
      { address: 'DMention', satoshis: DSOCIAL_MIN_LIKE_KOINU, kind: 'mention' },
    ]);
    const json = JSON.parse(
      buildDsocialPostJson({
        content: 'hi',
        payTo: 'DMe',
        quote: 'aa'.repeat(32) + 'i0',
        mentions: ['DMention'],
      }),
    );
    expect(json.op).toBe('quote');
    expect(json.mentions).toEqual(['DMention']);
  });
});
