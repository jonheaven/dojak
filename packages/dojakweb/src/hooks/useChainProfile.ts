/**
 * Resolve eco-wide ÐPFP/ÐPFA for any address via dogex.
 * Complements local-only useDogePFP / useDogePFA (connected user prefs).
 */
import { useCallback, useEffect, useState } from 'react';
import { DOGEX_PUBLIC_INDEXER_URL, getIndexerApiBase } from '../utils/api';
import {
  chainContentUrl,
  fetchChainProfile,
  type ChainProfile,
} from '../lib/dpfpPublish';

export function useChainProfile(address: string | null | undefined) {
  const [profile, setProfile] = useState<ChainProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const a = address?.trim();
    if (!a) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bases = [
        getIndexerApiBase(),
        DOGEX_PUBLIC_INDEXER_URL,
      ].filter((b, i, arr) => b && arr.indexOf(b) === i);
      let p: ChainProfile | null = null;
      for (const base of bases) {
        p = await fetchChainProfile(base, a);
        if (p) break;
      }
      setProfile(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'profile fetch failed');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const indexerBase = getIndexerApiBase();
  const pfpUrl = chainContentUrl(indexerBase, profile?.pfp?.inscriptionId);
  const pfaUrl = chainContentUrl(indexerBase, profile?.pfa?.inscriptionId);

  return {
    profile,
    loading,
    error,
    refresh,
    pfpInscriptionId: profile?.pfp?.inscriptionId ?? null,
    pfaInscriptionId: profile?.pfa?.inscriptionId ?? null,
    pfpContentUrl: pfpUrl,
    pfaContentUrl: pfaUrl,
    pfpNotHolding: profile?.pfp?.notHolding ?? null,
    pfaNotHolding: profile?.pfa?.notHolding ?? null,
  };
}
