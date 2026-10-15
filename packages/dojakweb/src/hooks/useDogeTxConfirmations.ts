'use client';

import { useEffect, useRef, useState } from 'react';
import { pollTxForConfirmation } from '../lib/broadcast/dogecoinTxBroadcast';

export type DogeTxConfirmPhase = 'idle' | 'polling' | 'confirmed' | 'timeout' | 'error';

export type UseDogeTxConfirmationsOptions = {
  /** Stop when confirmations reach this (default 1). */
  targetConfirmations?: number;
  /** When false, do not poll (default true when txid is set). */
  enabled?: boolean;
  /** Fired once when the target is first reached. */
  onConfirmed?: (confirmations: number) => void;
};

/**
 * Live confirmation tracker for a just-broadcast (or restored) Dogecoin txid.
 * Uses {@link pollTxForConfirmation} → command.dog / Core RPC + explorer merge.
 */
export function useDogeTxConfirmations(
  txid: string | null | undefined,
  options: UseDogeTxConfirmationsOptions = {},
): {
  confirmations: number | null;
  phase: DogeTxConfirmPhase;
  confirmed: boolean;
} {
  const target = options.targetConfirmations ?? 1;
  const enabled = options.enabled !== false;
  const id = typeof txid === 'string' ? txid.trim().toLowerCase() : '';
  const valid = /^[0-9a-f]{64}$/.test(id);
  const onConfirmedRef = useRef(options.onConfirmed);
  onConfirmedRef.current = options.onConfirmed;

  const [confirmations, setConfirmations] = useState<number | null>(null);
  const [phase, setPhase] = useState<DogeTxConfirmPhase>('idle');

  useEffect(() => {
    if (!enabled || !valid) {
      setConfirmations(null);
      setPhase('idle');
      return;
    }

    const ac = new AbortController();
    let fired = false;
    setConfirmations(null);
    setPhase('polling');

    void (async () => {
      try {
        await pollTxForConfirmation(
          id,
          (c) => {
            setConfirmations(c);
            if (c >= target && !fired) {
              fired = true;
              setPhase('confirmed');
              onConfirmedRef.current?.(c);
            }
          },
          { signal: ac.signal, targetConfirmations: target },
        );
        if (!ac.signal.aborted) {
          setPhase('confirmed');
          if (!fired) {
            fired = true;
            onConfirmedRef.current?.(target);
          }
        }
      } catch (err) {
        if (ac.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : String(err);
        setPhase(/timed out/i.test(msg) ? 'timeout' : 'error');
      }
    })();

    return () => ac.abort();
  }, [enabled, valid, id, target]);

  const confirmed = phase === 'confirmed' || (confirmations != null && confirmations >= target);

  return { confirmations, phase, confirmed };
}
