import { useState, useEffect, useCallback } from 'react';

const DOGE_PFP_STORAGE_KEY = 'dojakweb_doge_pfp';

type DogePfpRecord = {
  inscriptionId: string;
  setAt: string;
  contentUrl?: string;
};

export const useDogePFP = () => {
  const [pfpInscriptionId, setPfpInscriptionId] = useState<string | null>(null);
  const [pfpContentUrl, setPfpContentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(DOGE_PFP_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<DogePfpRecord>;
        if (parsed.inscriptionId) {
          setPfpInscriptionId(parsed.inscriptionId);
          setPfpContentUrl(typeof parsed.contentUrl === 'string' ? parsed.contentUrl : null);
        }
      } catch (err) {
        console.warn('Failed to parse stored ÐPFP:', err);
        localStorage.removeItem(DOGE_PFP_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const setDogePFP = useCallback((inscriptionId: string | null, meta?: { contentUrl?: string }) => {
    if (inscriptionId) {
      const url = meta?.contentUrl?.trim() || undefined;
      setPfpInscriptionId(inscriptionId);
      setPfpContentUrl(url ?? null);
      const rec: DogePfpRecord = {
        inscriptionId,
        setAt: new Date().toISOString(),
      };
      if (url) rec.contentUrl = url;
      localStorage.setItem(DOGE_PFP_STORAGE_KEY, JSON.stringify(rec));
    } else {
      setPfpInscriptionId(null);
      setPfpContentUrl(null);
      localStorage.removeItem(DOGE_PFP_STORAGE_KEY);
    }
  }, []);

  const clearDogePFP = useCallback(() => {
    setDogePFP(null);
  }, [setDogePFP]);

  return {
    pfpInscriptionId,
    pfpContentUrl,
    loading,
    setDogePFP,
    clearDogePFP,
  };
};
