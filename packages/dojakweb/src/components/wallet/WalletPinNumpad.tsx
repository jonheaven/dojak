'use client';

import { useEffect, useRef } from 'react';
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

function digitFromKeyboardEvent(e: KeyboardEvent): DialKey | null {
  // Top-row digits and Numpad digits
  if (/^[0-9]$/.test(e.key)) return e.key as DialKey;
  if (e.code.startsWith('Numpad') && /^[0-9]$/.test(e.code.slice(6))) {
    return e.code.slice(6) as DialKey;
  }
  return null;
}

function isTypingInOtherField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('.ds-pin-numpad')) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
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

  const valueRef = useRef(value);
  const disabledRef = useRef(disabled);
  const maxLengthRef = useRef(maxLength);
  const minLengthRef = useRef(minLength);
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);

  useEffect(() => {
    valueRef.current = value;
    disabledRef.current = disabled;
    maxLengthRef.current = maxLength;
    minLengthRef.current = minLength;
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;
  }, [value, disabled, maxLength, minLength, onChange, onSubmit]);

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

  // Hardware keyboard + numpad (not only on-screen button clicks).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (disabledRef.current) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingInOtherField(e.target)) return;

      const digit = digitFromKeyboardEvent(e);
      if (digit) {
        e.preventDefault();
        const cur = valueRef.current;
        if (cur.length >= maxLengthRef.current) return;
        onChangeRef.current(`${cur}${digit}`);
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        onChangeRef.current(valueRef.current.slice(0, -1));
        return;
      }

      if (e.key === 'Enter' || e.code === 'NumpadEnter') {
        if (valueRef.current.length < minLengthRef.current) return;
        e.preventDefault();
        onSubmitRef.current?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="ds-pin-numpad" aria-label={ariaLabel} role="group">
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
          {value.length} of at least {minLength} digits entered. Use number keys or numpad.
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
