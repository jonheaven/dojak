import { bytesToHex, hexToBytes } from './hash16';
import { encodeDsocialSignal, DSOCIAL_FLAG, parseDsocialSignal } from './dsocial';

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
