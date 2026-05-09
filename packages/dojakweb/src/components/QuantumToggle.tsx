/**
 * QuantumToggle.tsx
 *
 * Lazy-loading toggle component for Quantum Mode.
 * Triggers the PQC module preload the moment the user flips the switch,
 * so by the time they hit "Send" the modules are already warm.
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheckIcon, InformationCircleIcon, TagIcon } from '@heroicons/react/24/outline';
import { preloadQuantumModules, type PQCAlgorithm } from '../lib/quantum';

export interface QuantumToggleProps {
  enabled:         boolean;
  algorithm:       PQCAlgorithm;
  onChange:        (enabled: boolean) => void;
  onAlgorithmChange?: (algorithm: PQCAlgorithm) => void;
  onReady?:        () => void;
  showAlgorithmSelector?: boolean;
  /** `subtle` = wallet / non-demo: R&D wording, chip icon, no “quantum-proof” framing. */
  variant?:        'prominent' | 'subtle';
}

export const QuantumToggle: React.FC<QuantumToggleProps> = ({
  enabled,
  algorithm,
  onChange,
  onAlgorithmChange,
  onReady,
  showAlgorithmSelector = false,
  variant = 'prominent',
}) => {
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const subtle = variant === 'subtle';

  const handleToggle = async (checked: boolean) => {
    if (!checked) {
      onChange(false);
      return;
    }

    setLoading(true);
    try {
      await preloadQuantumModules(algorithm);
      onChange(true);
      onReady?.();
    } catch (err) {
      console.error('[quantum] Failed to load PQC module:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-200 ${
        subtle
          ? enabled
            ? 'border-zinc-600/50 bg-zinc-900/60'
            : 'border-zinc-800 bg-zinc-950'
          : enabled
            ? 'border-emerald-600/40 bg-emerald-950/20'
            : 'border-zinc-800 bg-zinc-950'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl transition-colors ${
              subtle
                ? enabled
                  ? 'bg-zinc-700/80'
                  : 'bg-zinc-800'
                : enabled
                  ? 'bg-emerald-600/20'
                  : 'bg-zinc-800'
            }`}
          >
            {subtle ? (
              <TagIcon className={`w-5 h-5 ${enabled ? 'text-zinc-200' : 'text-zinc-400'}`} />
            ) : (
              <ShieldCheckIcon className={`w-5 h-5 ${enabled ? 'text-emerald-400' : 'text-zinc-400'}`} />
            )}
          </div>
          <div className="relative">
            <div
              className={`font-semibold text-sm flex items-center gap-2 ${
                subtle
                  ? enabled
                    ? 'text-zinc-100'
                    : 'text-zinc-200'
                  : enabled
                    ? 'text-emerald-300'
                    : 'text-zinc-200'
              }`}
            >
              {subtle ? 'PQC R&D tag (OP_RETURN)' : 'Quantum-Proof Mode'}
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-zinc-400 hover:text-zinc-300 transition-colors"
                aria-label={subtle ? 'About PQC R&D OP_RETURN tag' : 'Quantum protection information'}
              >
                <InformationCircleIcon className="w-4 h-4" />
              </button>
            </div>
            {showTooltip && (
              <div className="absolute z-10 mt-1 p-2 bg-zinc-800 text-zinc-200 text-xs rounded-md shadow-lg max-w-xs">
                {subtle ? (
                  <>
                    One optional OP_RETURN tag type: a compact NIST PQC commitment for demo / R&amp;D. Not protocol-level
                    quantum resistance. See the Quantum page in the demo app for scope and limitations.
                  </>
                ) : (
                  <>
                    Quantum Protection adds a post-quantum cryptographic commitment to your transaction,
                    providing forward security against future quantum computer attacks on Dogecoin&apos;s ECDSA signatures.
                    This adds a small 38-byte OP_RETURN output to protect against &quot;harvest now, decrypt later&quot; threats.
                  </>
                )}
              </div>
            )}
            <div className="text-xs text-zinc-500 mt-0.5">
              {loading
                ? 'Loading PQC module…'
                : enabled
                  ? `${algorithm === 'falcon512' ? 'Falcon-512' : 'ML-DSA-44'} • OP_RETURN will be added`
                  : subtle
                    ? 'Adds a small OP_RETURN lab fingerprint (extra fee)'
                    : 'Adds a 38-byte PQC commitment to your transaction'}
            </div>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => void handleToggle(e.target.checked)}
            disabled={loading}
            className="sr-only peer"
            aria-label={subtle ? 'Add PQC R&D OP_RETURN tag to this send' : 'Enable quantum-proof mode'}
          />
          <div
            className={cn(
              "w-11 h-6 rounded-full transition-colors duration-200 bg-zinc-700 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5",
              loading && 'opacity-50 cursor-not-allowed',
              subtle ? 'peer-checked:bg-zinc-500' : 'peer-checked:bg-emerald-600',
            )}
          />
        </label>
      </div>

      {enabled && showAlgorithmSelector && onAlgorithmChange && (
        <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-3">
          <span className="text-xs text-zinc-400 flex-shrink-0">Algorithm:</span>
          <div className="flex gap-2">
            {(['falcon512', 'dilithium2'] as PQCAlgorithm[]).map(alg => (
              <button
                key={alg}
                type="button"
                onClick={() => onAlgorithmChange(alg)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  algorithm === alg
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {alg === 'falcon512' ? 'Falcon-512' : 'ML-DSA-44'}
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-600 ml-auto">
            {algorithm === 'falcon512' ? '~654 byte sig' : '~2420 byte sig'}
          </span>
        </div>
      )}
    </div>
  );
};
