const STORAGE_KEY = 'dojakweb:quantum-config';

export type QuantumAlgorithmPreference = 'falcon512' | 'dilithium2';

export interface QuantumConfig {
  defaultAlgorithm: QuantumAlgorithmPreference;
  suggestQuantumByDefault: boolean;
}

const DEFAULT_CONFIG: QuantumConfig = {
  defaultAlgorithm: 'falcon512',
  suggestQuantumByDefault: false,
};

export function getQuantumConfig(): QuantumConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuantumConfig;
      if (typeof parsed.defaultAlgorithm === 'string' &&
          typeof parsed.suggestQuantumByDefault === 'boolean') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export const QUANTUM_CONFIG_CHANGED_EVENT = 'dojakweb:quantum-config-changed';

export function setQuantumConfig(config: QuantumConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(QUANTUM_CONFIG_CHANGED_EVENT));
  } catch (error) {
    console.error('Failed to save quantum config:', error);
  }
}