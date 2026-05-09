import { useState, useEffect } from 'react';

const DOGE_PFP_STORAGE_KEY = 'dojakweb_doge_pfp';

export const useDogePFP = () => {
  const [pfpInscriptionId, setPfpInscriptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load PFP from localStorage on mount
    const stored = localStorage.getItem(DOGE_PFP_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPfpInscriptionId(parsed.inscriptionId || null);
      } catch (err) {
        console.warn('Failed to parse stored DogePFP:', err);
        localStorage.removeItem(DOGE_PFP_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const setDogePFP = (inscriptionId: string | null) => {
    setPfpInscriptionId(inscriptionId);

    if (inscriptionId) {
      localStorage.setItem(DOGE_PFP_STORAGE_KEY, JSON.stringify({
        inscriptionId,
        setAt: new Date().toISOString()
      }));
    } else {
      localStorage.removeItem(DOGE_PFP_STORAGE_KEY);
    }
  };

  const clearDogePFP = () => {
    setPfpInscriptionId(null);
    localStorage.removeItem(DOGE_PFP_STORAGE_KEY);
  };

  return {
    pfpInscriptionId,
    loading,
    setDogePFP,
    clearDogePFP
  };
};