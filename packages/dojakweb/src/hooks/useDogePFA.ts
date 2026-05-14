import { useState, useEffect, useCallback } from 'react';

const DOGE_PFA_STORAGE_KEY = 'dojakweb_doge_pfa';

type DogePfaRecord = {
  inscriptionId: string;
  setAt: string;
  contentUrl?: string;
};

export const useDogePFA = () => {
  const [pfaInscriptionId, setPfaInscriptionId] = useState<string | null>(null);
  const [pfaContentUrl, setPfaContentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(DOGE_PFA_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<DogePfaRecord>;
        if (parsed.inscriptionId) {
          setPfaInscriptionId(parsed.inscriptionId);
          setPfaContentUrl(typeof parsed.contentUrl === 'string' ? parsed.contentUrl : null);
        }
      } catch (err) {
        console.warn('Failed to parse stored ÐPFA:', err);
        localStorage.removeItem(DOGE_PFA_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const setDogePFA = useCallback((inscriptionId: string | null, meta?: { contentUrl?: string }) => {
    if (inscriptionId) {
      const url = meta?.contentUrl?.trim() || undefined;
      setPfaInscriptionId(inscriptionId);
      setPfaContentUrl(url ?? null);
      const rec: DogePfaRecord = {
        inscriptionId,
        setAt: new Date().toISOString(),
      };
      if (url) rec.contentUrl = url;
      localStorage.setItem(DOGE_PFA_STORAGE_KEY, JSON.stringify(rec));
    } else {
      setPfaInscriptionId(null);
      setPfaContentUrl(null);
      localStorage.removeItem(DOGE_PFA_STORAGE_KEY);
    }
  }, []);

  const clearDogePFA = useCallback(() => {
    setDogePFA(null);
  }, [setDogePFA]);

  return {
    pfaInscriptionId,
    pfaContentUrl,
    loading,
    setDogePFA,
    clearDogePFA,
  };
};
