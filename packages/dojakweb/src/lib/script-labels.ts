import * as bitcoin from 'bitcoinjs-lib';

export type ScriptLabel =
  | 'op_return'
  | 'p2pkh'
  | 'p2sh'
  | 'p2wpkh'
  | 'p2wsh'
  | 'p2tr'
  | 'multisig'
  | 'unknown';

export function classifyScript(script: Buffer | Uint8Array | null | undefined): ScriptLabel {
  if (!script?.length) return 'unknown';
  const buf = Buffer.from(script);

  if (buf[0] === bitcoin.opcodes.OP_RETURN) return 'op_return';
  if (
    buf.length === 25 &&
    buf[0] === bitcoin.opcodes.OP_DUP &&
    buf[1] === bitcoin.opcodes.OP_HASH160 &&
    buf[2] === 0x14 &&
    buf[23] === bitcoin.opcodes.OP_EQUALVERIFY &&
    buf[24] === bitcoin.opcodes.OP_CHECKSIG
  ) {
    return 'p2pkh';
  }
  if (buf.length === 23 && buf[0] === bitcoin.opcodes.OP_HASH160 && buf[1] === 0x14 && buf[22] === bitcoin.opcodes.OP_EQUAL) {
    return 'p2sh';
  }
  if (buf.length === 22 && buf[0] === 0x00 && buf[1] === 0x14) return 'p2wpkh';
  if (buf.length === 34 && buf[0] === 0x00 && buf[1] === 0x20) return 'p2wsh';
  if (buf.length === 34 && buf[0] === bitcoin.opcodes.OP_1 && buf[1] === 0x20) return 'p2tr';

  try {
    const decompiled = bitcoin.script.decompile(buf) ?? [];
    if (decompiled.length > 0) {
      const hasOpCheckMultiSig = decompiled.includes(bitcoin.opcodes.OP_CHECKMULTISIG);
      const pubkeys = decompiled.filter((item) => Buffer.isBuffer(item));
      if (hasOpCheckMultiSig && pubkeys.length >= 2) return 'multisig';
    }
  } catch {
    /* ignore */
  }

  return 'unknown';
}

export function describeScriptLabel(label: ScriptLabel): string {
  switch (label) {
    case 'op_return':
      return 'OP_RETURN';
    case 'p2pkh':
      return 'P2PKH';
    case 'p2sh':
      return 'P2SH';
    case 'p2wpkh':
      return 'P2WPKH';
    case 'p2wsh':
      return 'P2WSH';
    case 'p2tr':
      return 'P2TR';
    case 'multisig':
      return 'Multisig';
    default:
      return 'Unknown';
  }
}
