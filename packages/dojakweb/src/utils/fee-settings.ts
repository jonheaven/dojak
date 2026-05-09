export interface FeeSettings {
  defaultFeeRate: number; // koinu per byte
  platformFeeEnabled: boolean;
  platformFeeAmount: number; // DOGE
}

const FEE_SETTINGS_KEY = 'dojakweb:fee-settings';

const DEFAULT_FEE_SETTINGS: FeeSettings = {
  defaultFeeRate: 1000, // 1 sat/byte
  platformFeeEnabled: false,
  platformFeeAmount: 0.05,
};

export function getFeeSettings(): FeeSettings {
  try {
    const stored = localStorage.getItem(FEE_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_FEE_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load fee settings from localStorage:', error);
  }
  return DEFAULT_FEE_SETTINGS;
}

export function setFeeSettings(settings: Partial<FeeSettings>): void {
  try {
    const current = getFeeSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(FEE_SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save fee settings to localStorage:', error);
  }
}

export function resetFeeSettings(): void {
  try {
    localStorage.removeItem(FEE_SETTINGS_KEY);
  } catch (error) {
    console.warn('Failed to reset fee settings:', error);
  }
}