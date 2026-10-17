'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useUnifiedWallet } from '../contexts/useUnifiedWallet';
import { useSoundEffects } from '../hooks/useSoundEffects';
import {
  classifyDnsInscription,
  extractInscriptionTexts,
  extractOpReturnTexts,
  incomingTxAlertsEnabled,
  loadSeenIncomingTxids,
  parseDnsOfferMemo,
  saveSeenIncomingTxids,
} from '../lib/incoming-tx-alerts';
import { getIndexerFetchBases, walletDataApi, type DogeTransaction } from '../utils/api';

const POLL_MS = 25_000;

async function fetchRawTxHex(txid: string): Promise<string | null> {
  const tid = txid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(tid)) return null;
  for (const base of getIndexerFetchBases()) {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer =
        ctrl && typeof window !== 'undefined' ? window.setTimeout(() => ctrl.abort(), 6_000) : null;
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/tx/${encodeURIComponent(tid)}/raw`, {
        cache: 'no-store',
        headers: { Accept: 'application/json,text/plain' },
        signal: ctrl?.signal,
      });
      if (timer != null) window.clearTimeout(timer);
      if (!res.ok) continue;
      const body = await res.text();
      let hex = body.trim().toLowerCase().replace(/^0x/, '');
      try {
        const json = JSON.parse(body) as { hex?: string; raw?: string; result?: string };
        hex = String(json.hex ?? json.raw ?? json.result ?? hex)
          .trim()
          .toLowerCase()
          .replace(/^0x/, '');
      } catch {
        /* plain hex */
      }
      if (/^[0-9a-f]{100,}$/.test(hex)) return hex;
    } catch {
      /* try next base */
    }
  }
  return null;
}

async function classifyIncoming(tx: DogeTransaction): Promise<{
  title: string;
  description: string;
}> {
  const hex = await fetchRawTxHex(tx.txid);
  const pending = tx.pending ? ' · mempool' : '';
  if (hex) {
    let giftNote: string | undefined;
    let dnsPing: string | undefined;
    for (const text of extractOpReturnTexts(hex)) {
      const offer = parseDnsOfferMemo(text);
      if (offer) {
        return {
          title: `ÐNS offer · ${offer.name}`,
          description: `Someone is willing to pay ${offer.amountDoge} Ð${
            offer.note ? ` — ${offer.note}` : ''
          }. Micro ping ${tx.amount} Ð received.`,
        };
      }
      const gift = text.match(/^dns\s+gift\s+(.+)$/i);
      if (gift?.[1]) giftNote = gift[1].trim().slice(0, 80);
      else if (/^dns\s+/i.test(text)) dnsPing = text.slice(0, 120);
    }
    for (const body of extractInscriptionTexts(hex)) {
      const dns = classifyDnsInscription(body.text, body.contentType);
      if (!dns) continue;
      const arriving =
        dns.kind === 'config'
          ? 'Records arriving'
          : dns.kind === 'primary'
            ? 'Wallet name arriving'
            : 'Name arriving';
      return {
        title: `ÐNS · ${dns.name}`,
        description: giftNote ? `Gift arriving${pending} — ${giftNote}` : `${arriving}${pending}`,
      };
    }
    if (dnsPing) {
      return { title: 'ÐNS on-chain ping', description: dnsPing };
    }
  }
  const amt = Number.isFinite(tx.amount) ? tx.amount : 0;
  const from = tx.address ? `${tx.address.slice(0, 6)}…${tx.address.slice(-4)}` : 'unknown';
  return {
    title: 'Incoming DOGE',
    description: `+${amt} Ð from ${from}${tx.pending ? ' · mempool' : ''}`,
  };
}

/**
 * Background watcher for Local / unified wallet: ping + toast on new received txs.
 * Mount inside `UnifiedWalletProvider`. First poll seeds history (no spam).
 */
export function IncomingTxAlerts() {
  const wallet = useUnifiedWallet();
  const { playSound } = useSoundEffects();
  const address = wallet.connected ? wallet.address : null;
  const seededRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!address || typeof window === 'undefined') return;

    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      if (cancelled || busyRef.current) return;
      if (document.visibilityState === 'hidden') return;
      if (!incomingTxAlertsEnabled()) return;

      busyRef.current = true;
      try {
        const page = await walletDataApi.fetchTransactions(address, 1, 20);
        if (cancelled) return;
        const received = (page.transactions || []).filter(
          (t) => t.type === 'received' && t.txid && /^[0-9a-f]{64}$/i.test(t.txid),
        );

        const seen = loadSeenIncomingTxids(address);
        const isSeed = seededRef.current !== address;

        if (isSeed) {
          for (const t of received) seen.add(t.txid.toLowerCase());
          saveSeenIncomingTxids(address, seen);
          seededRef.current = address;
          return;
        }

        const fresh = received.filter((t) => !seen.has(t.txid.toLowerCase()));
        for (const t of fresh) {
          seen.add(t.txid.toLowerCase());
          const info = await classifyIncoming(t);
          if (cancelled) return;
          void playSound('incoming');
          toast.message(info.title, {
            description: info.description,
            duration: 8_000,
          });
        }
        if (fresh.length) saveSeenIncomingTxids(address, seen);
      } catch {
        /* quiet — indexer/provider lag is normal */
      } finally {
        busyRef.current = false;
      }
    };

    void tick();
    timer = window.setInterval(() => void tick(), POLL_MS);

    const onVis = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVis);

    const onPref = () => {
      /* next tick honors localStorage */
    };
    window.addEventListener('storage', onPref);

    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onPref);
    };
  }, [address, playSound]);

  return null;
}
