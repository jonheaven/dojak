/**
 * Fail-closed recipient resolve for wallet sends (DOGE + inscriptions).
 * Accepts a Dogecoin address, Ð𝕏 @handle, or Doge Domain (`label.namespace`).
 */
import { validateDogecoinAddress } from './dogecoinAddressValidate';
import { looksLikeDxHandleInput, parseDxHandleInput } from './dx/pay';
import { fetchDnsResolve, fetchDxByHandle } from './identity/indexer';

const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export type SendRecipientKind = 'address' | 'dx' | 'dns';

export type ResolvedSendRecipient = {
  kind: SendRecipientKind;
  /** Checksum-valid Dogecoin address to send to */
  address: string;
  /** Original user input (handle / domain / address) for display */
  display: string;
  /** Canonical handle or domain when kind is dx/dns */
  label?: string;
};

export type SendRecipientResolveError = {
  ok: false;
  error: string;
  /** True while a remote lookup is still required (caller may show loading) */
  pending?: boolean;
};

export type SendRecipientResolveOk = { ok: true } & ResolvedSendRecipient;

export type SendRecipientClassify =
  | { kind: 'empty' }
  | { kind: 'dx'; handle: string | null; raw: string }
  | { kind: 'dns'; name: string }
  | { kind: 'address'; raw: string };

/** Same rules as core `isDNSName` — any open suffix (`.doge`, `.dogefeed`, …). */
export function isDogeDomainName(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const parts = input.trim().toLowerCase().split('.');
  if (parts.length !== 2) return false;
  const [label, namespace] = parts;
  if (!label || !namespace || !DNS_LABEL.test(label) || !DNS_LABEL.test(namespace)) return false;
  if (namespace === 'bitmap' || namespace === 'dogemap' || namespace.startsWith('dogemap')) return false;
  return true;
}

export function classifySendRecipient(raw: string): SendRecipientClassify {
  const t = raw.trim();
  if (!t) return { kind: 'empty' };
  if (looksLikeDxHandleInput(t)) {
    return { kind: 'dx', handle: parseDxHandleInput(t), raw: t };
  }
  if (isDogeDomainName(t)) {
    return { kind: 'dns', name: t.toLowerCase() };
  }
  return { kind: 'address', raw: t };
}

/**
 * Resolve recipient input to a validated Dogecoin address.
 * Throws never — returns `{ ok: false, error }` on failure (including API down).
 */
export async function resolveSendRecipient(raw: string): Promise<SendRecipientResolveOk | SendRecipientResolveError> {
  const classified = classifySendRecipient(raw);
  if (classified.kind === 'empty') {
    return { ok: false, error: 'Enter a Dogecoin address, @handle, or name.namespace.' };
  }

  if (classified.kind === 'dx') {
    if (!classified.handle) {
      return { ok: false, error: 'Invalid 𝕏 handle (use @username, max 15 characters).' };
    }
    try {
      const reg = await fetchDxByHandle(classified.handle);
      if (!reg?.dogeAddress) {
        return {
          ok: false,
          error: `No Ð𝕏 bind for ${classified.handle}. They need to link at /dx before you can send by handle.`,
        };
      }
      const v = validateDogecoinAddress(reg.dogeAddress);
      if (!v.ok) {
        return { ok: false, error: v.error || 'Ð𝕏 linked address is invalid.' };
      }
      return {
        ok: true,
        kind: 'dx',
        address: v.address,
        display: classified.raw.trim(),
        label: classified.handle,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Ð𝕏 lookup failed. Try again or paste a Dogecoin address.',
      };
    }
  }

  if (classified.kind === 'dns') {
    try {
      const dns = await fetchDnsResolve(classified.name);
      if (dns.status === 'available') {
        return { ok: false, error: `${classified.name} is not registered.` };
      }
      const v = validateDogecoinAddress(dns.payAddress);
      if (!v.ok) {
        return { ok: false, error: v.error || `${classified.name} has an invalid pay-to address.` };
      }
      return {
        ok: true,
        kind: 'dns',
        address: v.address,
        display: classified.name,
        label: dns.name,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Domain lookup failed. Try again or paste a Dogecoin address.',
      };
    }
  }

  const v = validateDogecoinAddress(classified.raw);
  if (!v.ok) {
    return { ok: false, error: v.error || 'Recipient address is invalid.' };
  }
  return { ok: true, kind: 'address', address: v.address, display: v.address };
}
