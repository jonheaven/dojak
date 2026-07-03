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

type DialKey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0' | 'back' | 'go';

const DIAL_ROWS: DialKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['back', '0', 'go'],
];

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

  const handleKey = (key: DialKey) => {
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
    <div className="ds-pin-numpad" aria-label={ariaLabel}>
      <div className="ds-pin-numpad__dots" aria-live="polite" aria-atomic="true">
        {Array.from({ length: slotCount }, (_, index) => {
          const filled = index < value.length;
          return (
            <span
              key={index}
              className={cx('ds-pin-numpad__dot', filled && 'ds-pin-numpad__dot--filled')}
              aria-hidden
            />
          );
        })}
        <span className="sr-only">
          {value.length} of at least {minLength} digits entered
        </span>
      </div>

      <div className="ds-pin-numpad__grid" role="group" aria-label="PIN keypad">
        {DIAL_ROWS.flatMap((row) =>
          row.map((key) => {
            if (key === 'back') {
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled || value.length === 0}
                  onClick={() => handleKey(key)}
                  className="ds-pin-numpad__key ds-pin-numpad__key--back"
                  aria-label="Delete last digit"
                >
                  <BackspaceIcon className="ds-pin-numpad__icon" aria-hidden />
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
                  className="ds-pin-numpad__key ds-pin-numpad__key--go"
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
                className="ds-pin-numpad__key ds-pin-numpad__key--digit"
              >
                {key}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
