import React from 'react';
import { useFeatureStore, type FeatureId } from '../../stores/featureStore';

interface FeatureVisibilitySettingsProps {
  className?: string;
}

const FEATURE_LABELS: Record<FeatureId, string> = {
  wallet: 'Wallet',
  'inscription-hub': 'Inscription hub',
  dogetags: 'ÐogeTags',
  inscribe: 'Inscribe',
  'utxo-manager': 'Coins (UTXO Manager)',
  'time-locks': 'Time Locks',
  'dogenal-locker': 'Ðogenal Locker',
  'soft-staking': 'Soft Staking',
  'locked-assets': 'Locked Assets',
  dmp: 'ÐMP',
  demo: 'Home',
  'address-book': 'Address Book',
  tools: 'Tools',
  nostr: 'Nostr relay',
  dogewatch: 'ÐWatch (Dogewatch USB)',
  settings: 'Settings',
  support: 'Support',
  treats: 'ÐogeTreats',
  drc20: 'Legacy ÐRC-20',
  dunes: 'Ðunes',
  'universal-drc20': 'Universal ÐRC-20 (legacy)',
  charms: 'Charms',
};

const FEATURE_DESCRIPTIONS: Record<FeatureId, string> = {
  wallet: 'Main wallet interface for managing DOGE and Dogenals',
  'inscription-hub': 'Overview at /inscription — ÐogeTags vs file inscription (reserved for future nav)',
  dogetags: 'Create and manage ÐogeTags',
  inscribe: 'Inscribe files and recursive HTML on Dogecoin',
  'utxo-manager': 'Advanced UTXO management and coin control',
  'time-locks': 'Time-locked assets and staking features',
  'dogenal-locker': 'Lock Doginals for extended periods',
  'soft-staking': 'Flexible staking with time-based rewards',
  'locked-assets': 'View and manage locked assets',
  dmp: 'ÐMP (Dogecoin Marketplace Protocol) — signed marketplace intents',
  demo: 'Home / landing page',
  'address-book': 'Import/export contacts for easy transaction management',
  tools: 'Developer tools — PSBT analyzer, UTXO inspector, validators, probes',
  nostr: 'Command.dog Nostr relay status (NIP-11) and WebSocket URL',
  dogewatch: 'Dogewatch USB diagnostics — Web Serial ping and signing tests',
  settings: 'Application settings',
  support: 'Help and support resources',
  treats: 'ÐogeTreats (under ÐogeTokens) — canonical OP_RETURN fungibles (`p:"dt"`)',
  drc20: 'Classic inscription DRC-20 — read-only balances; migrate to Ðunes for Era 2',
  dunes: 'Ðunes (under ÐogeTokens) — UTXO-native fungible token protocol',
  'universal-drc20': 'Legacy Universal ÐRC-20 nav — use ÐogeTreats instead',
  charms: 'Charms (under ÐogeTokens) — cross-chain token protocol',
};

export const FeatureVisibilitySettings: React.FC<FeatureVisibilitySettingsProps> = ({
  className = '',
}) => {
  const { features, toggleFeature, resetToDefaults } = useFeatureStore();

  const handleReset = () => {
    if (window.confirm('Reset all feature visibility settings to defaults?')) {
      resetToDefaults();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Feature Visibility</h3>
          <p className="text-sm text-white/60 mt-1">
            Control which features are visible in the sidebar navigation
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white border border-white/20 rounded hover:bg-white/5 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      <div className="space-y-3">
        {Object.entries(FEATURE_LABELS).map(([featureId, label]) => {
          const id = featureId as FeatureId;
          const isEnabled = features[id];

          return (
            <div
              key={id}
              className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleFeature(id)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors mt-0.5 ${
                  isEnabled
                    ? 'border-primary-400 bg-primary-400'
                    : 'border-white/30 bg-transparent'
                }`}
                aria-checked={isEnabled}
                role="checkbox"
                aria-label={`Toggle ${label} visibility`}
              >
                {isEnabled && (
                  <span className="text-xs font-bold text-black">✓</span>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isEnabled ? 'text-white' : 'text-white/50'}`}>
                    {label}
                  </span>
                  {!isEnabled && (
                    <span className="px-2 py-0.5 text-xs font-medium text-white/40 bg-white/10 rounded">
                      Hidden
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-1 ${isEnabled ? 'text-white/60' : 'text-white/30'}`}>
                  {FEATURE_DESCRIPTIONS[id]}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-400/20 flex items-center justify-center mt-0.5">
            <span className="text-xs text-amber-400">!</span>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-200">Note</p>
            <p className="text-xs text-amber-200/80 mt-1">
              Hidden features are still accessible via direct URLs and will remain functional.
              This setting only affects the sidebar navigation visibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};