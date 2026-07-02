'use client';

import { BackspaceIcon } from '@heroicons/react/24/outline';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
  onSubmit?: () => void;
  submitLabel?: string;
  ariaLabel?: string;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'go'] as const;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function WalletPinNumpad({
  value,
  onChange,
  disabled = false,
  minLength = 6,
  maxLength = 12,
  onSubmit,
  submitLabel = 'Unlock',
  ariaLabel = 'PIN entry',
}: Props) {
  const slotCount = Math.max(minLength, Math.min(value.length + 1, maxLength));
  const canSubmit = value.length >= minLength && !disabled;

  const handleKey = (key: (typeof KEYS)[number]) => {
    if (disabled) return;
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === 'go') {
      if (canSubmit) onSubmit?.();
      return;
    }
    if (value.length >= maxLength) return;
    onChange(`${value}${key}`);
  };

  return (
    <div className="ds-pin-numpad space-y-4" aria-label={ariaLabel}>
      <div
        className="flex items-center justify-center gap-2.5 py-1"
        aria-live="polite"
        aria-atomic="true"
      >
        {Array.from({ length: slotCount }, (_, index) => {
          const filled = index < value.length;
          return (
            <span
              key={index}
              className={cx(
                'h-3 w-3 rounded-full border transition',
                filled
                  ? 'border-[#FCD34D] bg-[#FCD34D] shadow-[0_0_10px_rgba(252,211,77,0.35)]'
                  : 'border-white/25 bg-transparent',
              )}
              aria-hidden
            />
          );
        })}
        <span className="sr-only">
          {value.length} of at least {minLength} digits entered
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => {
          if (key === 'back') {
            return (
              <button
                key={key}
                type="button"
                disabled={disabled || value.length === 0}
                onClick={() => handleKey(key)}
                className="ds-pin-numpad__key flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Delete last digit"
              >
                <BackspaceIcon className="h-5 w-5" aria-hidden />
              </button>
            );
          }
          if (key === 'go') {
            return (
              <button
                key={key}
                type="button"
                disabled={!canSubmit}
                onClick={() => handleKey(key)}
                className="ds-pin-numpad__key flex h-12 items-center justify-center rounded-xl border border-[#FCD34D]/35 bg-[#FCD34D]/15 text-xs font-bold uppercase tracking-wide text-[#FCD34D] transition hover:bg-[#FCD34D]/25 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {submitLabel}
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              disabled={disabled || value.length >= maxLength}
              onClick={() => handleKey(key)}
              className="ds-pin-numpad__key flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-semibold tabular-nums text-white transition hover:border-[#FCD34D]/30 hover:bg-[#FCD34D]/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
