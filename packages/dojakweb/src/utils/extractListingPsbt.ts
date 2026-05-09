/**
 * Extract a seller listing PSDT (base64) from pasted text: dogepsdt URI, share URL hash,
 * raw base64, or hex PSDT.
 */

import { decodeDogePsdtUriToBase64, isDogePsdtUri } from '../lib/psdt/codec';
import { tryParsePsdt } from '../lib/doginal-psdt';

export interface ExtractListingPsdtResult {
  psbtBase64: string;
  /** From `?inscription=` when the paste is a full share URL */
  claimedInscriptionId?: string;
}

function tryClaimedInscriptionFromUrl(urlLike: string): string | undefined {
  try {
    const u = new URL(urlLike.trim().split(/\s/)[0]);
    const ins = u.searchParams.get('inscription');
    return ins?.trim() || undefined;
  } catch {
    const m = urlLike.match(/[?&]inscription=([^&\s#]+)/i);
    if (m) {
      try {
        return decodeURIComponent(m[1].trim());
      } catch {
        return m[1].trim();
      }
    }
    return undefined;
  }
}

/** Pull `dogepsdt:...` payload from freeform text (QR decode, messengers, etc.). */
function findDogePsbtUriInText(s: string): string | null {
  const compact = s.match(/dogepsdt:1:zlib:b64url:[A-Za-z0-9_-]+/);
  if (compact) return compact[0];
  const loose = s.indexOf('dogepsdt:');
  if (loose < 0) return null;
  const rest = s.slice(loose);
  const end = rest.search(/\s|"|'|<|>|\)|]/);
  const uri = (end < 0 ? rest : rest.slice(0, end)).trim();
  return isDogePsdtUri(uri) ? uri : null;
}

function dogepsdtFromUrlHashOrQuery(s: string): string | null {
  const hash = s.match(/[#&?]dogepsdt=([^&\s]+)/);
  if (!hash) return null;
  try {
    return decodeURIComponent(hash[1]);
  } catch {
    return hash[1];
  }
}

/**
 * @throws Error if no valid listing PSDT can be recovered
 */
export function extractListingPsdtFromPaste(raw: string): ExtractListingPsdtResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Paste is empty.');
  }

  let claimedInscriptionId: string | undefined;
  if (trimmed.includes('inscription=') || trimmed.includes('://')) {
    claimedInscriptionId = tryClaimedInscriptionFromUrl(trimmed);
  }

  let candidate = trimmed;

  const fromParam = dogepsdtFromUrlHashOrQuery(trimmed);
  if (fromParam && isDogePsdtUri(fromParam)) {
    return {
      psbtBase64: decodeDogePsdtUriToBase64(fromParam),
      claimedInscriptionId,
    };
  }

  const uriInText = findDogePsbtUriInText(trimmed);
  if (uriInText) {
    return {
      psbtBase64: decodeDogePsdtUriToBase64(uriInText),
      claimedInscriptionId,
    };
  }

  if (isDogePsdtUri(candidate)) {
    return {
      psbtBase64: decodeDogePsdtUriToBase64(candidate),
      claimedInscriptionId,
    };
  }

  const psbt = tryParsePsdt(candidate.replace(/\s+/g, ''));
  if (psbt) {
    return { psbtBase64: psbt.toBase64(), claimedInscriptionId };
  }

  throw new Error(
    'Could not read a listing PSDT. Paste a dogepsdt: URI, a link whose hash contains dogepsdt=…, or base64 / hex PSDT.',
  );
}
