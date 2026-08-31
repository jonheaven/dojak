/**
 * Dogenals Era-2 OP_RETURN namespace lines: `Ð:<module>:<kind>:<payload>`
 * @see dogenals/docs/era2-namespace.md
 */

/** UTF-8 prefix byte length for `Ð` (U+00D0). */
export const ERA2_MARKER_UTF8 = Buffer.from('Ð', 'utf8');

/** Practical policy target from spec: prefer `Ð:𝕏` unless full line exceeds 76 UTF-8 bytes. */
export const ERA2_DXD_WIRE_BYTE_THRESHOLD = 76;

const STYLIZED_X = '\uD835\uDD4F'; // 𝕏

function utf8ByteLength(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

/**
 * DXD exchange module: use `Ð:𝕏:` when the full `Ð:𝕏:${kind}:${payload}` fits in {@link ERA2_DXD_WIRE_BYTE_THRESHOLD}
 * UTF-8 bytes; otherwise silently use `Ð:X:`.
 */
export function encodeDogenalsEra2Dxd(kind: string, payload: string): Buffer {
  const withStylized = `Ð:${STYLIZED_X}:${kind}:${payload}`;
  const withAscii = `Ð:X:${kind}:${payload}`;
  const wire = utf8ByteLength(withStylized) <= ERA2_DXD_WIRE_BYTE_THRESHOLD ? withStylized : withAscii;
  return Buffer.from(wire, 'utf8');
}

/**
 * Legacy Era-2 ASCII modules (`Ð:W` / `Ð:M` / `Ð:T`).
 * Ðignal's current spec magic is `Ð:DIG` — use `encodeDignalSignal` in `@dojak/core`.
 */
export function encodeDogenalsEra2AsciiModule(
  module: 'W' | 'M' | 'T',
  kind: string,
  payload: string,
): Buffer {
  return Buffer.from(`Ð:${module}:${kind}:${payload}`, 'utf8');
}

export type DogenalsEra2ModuleKey = 'dxd' | 'W' | 'M' | 'T';

/**
 * Encode one Era-2 namespace line as UTF-8 bytes (ready for {@link buildOpReturnLockingScript}).
 */
export function encodeDogenalsEra2Line(opts: {
  module: DogenalsEra2ModuleKey;
  kind: string;
  payload: string;
}): Buffer {
  const { module, kind, payload } = opts;
  if (module === 'dxd') return encodeDogenalsEra2Dxd(kind, payload);
  return encodeDogenalsEra2AsciiModule(module, kind, payload);
}

/** Spec table spot-checks: marker and colon bytes. */
export function era2WirePrefixBytesDxdStylized(): Buffer {
  return Buffer.concat([ERA2_MARKER_UTF8, Buffer.from(':', 'utf8'), Buffer.from(STYLIZED_X, 'utf8')]);
}

export function era2WirePrefixBytesDxdAscii(): Buffer {
  return Buffer.concat([ERA2_MARKER_UTF8, Buffer.from(':X', 'utf8')]);
}
