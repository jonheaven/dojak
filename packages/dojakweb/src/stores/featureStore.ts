import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FeatureId =
  | 'wallet'
  | 'inscription-hub'
  | 'dogetags'
  | 'inscribe'
  | 'quantum'
  | 'utxo-manager'
  | 'time-locks'
  | 'dogenal-locker'
  | 'soft-staking'
  | 'locked-assets'
  | 'dmp'
  | 'demo'
  | 'address-book'
  | 'tools'
  | 'nostr'
  | 'settings'
  | 'support'
  | 'drc20'
  | 'dunes'
  | 'universal-drc20'
  | 'charms';

interface FeatureVisibilityState {
  // Feature visibility flags
  features: Record<FeatureId, boolean>;

  // Toggle individual feature visibility
  toggleFeature: (featureId: FeatureId) => void;

  // Enable/disable multiple features
  setFeatures: (features: Partial<Record<FeatureId, boolean>>) => void;

  // Check if feature is visible
  isFeatureVisible: (featureId: FeatureId) => boolean;

  // Reset to defaults
  resetToDefaults: () => void;
}

// Default feature visibility - all enabled by default
const DEFAULT_FEATURES: Record<FeatureId, boolean> = {
  wallet: true,
  'inscription-hub': true,
  dogetags: true,
  inscribe: true,
  quantum: true,
  'utxo-manager': true,
  'time-locks': true,
  'dogenal-locker': true,
  'soft-staking': true,
  'locked-assets': true,
  dmp: true,
  demo: true,
  'address-book': true,
  tools: true,
  nostr: true,
  settings: true,
  support: true,
  drc20: true,
  dunes: true,
  'universal-drc20': true,
  charms: true,
};

export const useFeatureStore = create<FeatureVisibilityState>()(
  persist(
    (set, get) => ({
      features: { ...DEFAULT_FEATURES },

      toggleFeature: (featureId: FeatureId) => {
        set((state) => ({
          features: {
            ...state.features,
            [featureId]: !state.features[featureId],
          },
        }));
      },

      setFeatures: (newFeatures) => {
        set((state) => ({
          features: {
            ...state.features,
            ...newFeatures,
          },
        }));
      },

      isFeatureVisible: (featureId: FeatureId) => {
        return get().features[featureId] ?? true;
      },

      resetToDefaults: () => {
        set({ features: { ...DEFAULT_FEATURES } });
      },
    }),
    {
      name: 'dojakweb-feature-visibility',
      version: 2,
      migrate: (persistedState, fromVersion) => {
        if (
          fromVersion < 2 &&
          persistedState &&
          typeof persistedState === 'object' &&
          'features' in persistedState
        ) {
          const f = (persistedState as { features: Record<string, boolean> }).features;
          if (f && typeof f === 'object') {
            if (f.chainmarks !== undefined && f['inscription-hub'] === undefined) {
              f['inscription-hub'] = f.chainmarks;
            }
            delete f.chainmarks;
          }
        }
        return persistedState as FeatureVisibilityState;
      },
    }
  )
);

// Helper hook for checking feature visibility
export const useFeatureVisibility = (featureId: FeatureId): boolean => {
  return useFeatureStore((state) => state.isFeatureVisible(featureId));
};