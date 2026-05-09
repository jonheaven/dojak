const STORAGE_KEY = 'dojakweb:inscription-config';

export type InscriptionMarker = 'ord' | 'dog';

export interface InscriptionConfig {
  marker: InscriptionMarker;
}

const DEFAULT_CONFIG: InscriptionConfig = {
  marker: 'ord',
};

export function getInscriptionConfig(): InscriptionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InscriptionConfig;
      if (typeof parsed.marker === 'string' && (parsed.marker === 'ord' || parsed.marker === 'dog')) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export const INSCRIPTION_CONFIG_CHANGED_EVENT = 'dojakweb:inscription-config-changed';

export function setInscriptionConfig(config: InscriptionConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(INSCRIPTION_CONFIG_CHANGED_EVENT));
  } catch (error) {
    console.error('Failed to save inscription config:', error);
  }
}

export function getInscriptionMarker(): InscriptionMarker {
  return getInscriptionConfig().marker;
}