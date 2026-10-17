'use client';

import { useEffect, useState } from 'react';
import { useDojakwebI18n } from '../../contexts/DojakwebLocaleContext';
import { dojakwebUnlockPersistsForTab } from '../../lib/dojakweb-biometric';
import {
  msUntilUnlockExpiry,
  UNLOCK_WINDOW_CHANGED_EVENT,
  unlockWindowDurationMs,
} from '../../lib/unlock-window';

function formatRemain(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    const sec = total % 60;
    return sec ? `${minutes}m ${sec}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin ? `${hours}h ${remMin}m` : `${hours}h`;
}

/** Quiet-period left before the local browser wallet locks itself. */
export function UnlockLockCountdown() {
  const { t } = useDojakwebI18n();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      if (dojakwebUnlockPersistsForTab() || unlockWindowDurationMs() == null) {
        setLabel(t('modal.dataLabel.locksOnClose'));
        return;
      }
      const ms = msUntilUnlockExpiry();
      // No stamp means the session clock is gone. Do not invent "locks in 8h".
      if (ms == null) {
        setLabel(null);
        return;
      }
      setLabel(t('modal.dataLabel.locksIn', { time: formatRemain(ms) }));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    window.addEventListener(UNLOCK_WINDOW_CHANGED_EVENT, tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(UNLOCK_WINDOW_CHANGED_EVENT, tick);
    };
  }, [t]);

  if (!label) return null;
  return <span className="text-white/35">· {label}</span>;
}
