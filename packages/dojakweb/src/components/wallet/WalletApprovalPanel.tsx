'use client';

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useBrowserWallet } from '../../contexts/BrowserWalletContext';
import {
  rejectWalletApproval,
  resolveWalletApproval,
  setWalletApprovalWorking,
  walletApprovalStore,
  type WalletApprovalSession,
} from '../../stores/walletApprovalStore';
import { walletSecretInputProps } from '../../lib/wallet-secret-input';
import { createDojakwebSessionSecretStore } from '../../lib/dojakweb-biometric';

/**
 * Extension-style approval sheet for host-requested local-browser signing.
 * Mounted inside the wallet drawer/modal whenever a request is pending.
 * Unlock once per tab session — password is not re-prompted until disconnect or tab close.
 */
export function WalletApprovalPanel() {
  const pending = useSyncExternalStore(
    walletApprovalStore.subscribe,
    walletApprovalStore.getSnapshot,
    walletApprovalStore.getServerSnapshot,
  );
  const browser = useBrowserWallet();
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);

  const sessionReady = Boolean(browser.wallet?.privateKey?.trim() && browser.address);

  // If the tab session still has the unlock secret but memory was cleared, rehydrate silently.
  useEffect(() => {
    if (!pending || sessionReady || unlockBusy) return;
    let cancelled = false;
    (async () => {
      try {
        const secret = await createDojakwebSessionSecretStore().getSecret();
        if (!secret || cancelled) return;
        const loaded = await browser.loadWallet(secret, browser.address || undefined);
        if (!loaded?.privateKey || cancelled) return;
        await browser.connect(loaded);
      } catch {
        /* show unlock form */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, sessionReady, unlockBusy, browser]);

  const unlock = useCallback(async () => {
    if (!unlockPassword.trim()) {
      setUnlockError('Enter your wallet password');
      return;
    }
    setUnlockBusy(true);
    setUnlockError(null);
    try {
      const secret = unlockPassword.trim();
      const loaded = await browser.loadWallet(secret, browser.address || undefined);
      if (!loaded?.privateKey) {
        throw new Error('Could not unlock wallet');
      }
      await browser.connect(loaded);
      // Keep unlocked for this browser tab until disconnect or tab close.
      try {
        await createDojakwebSessionSecretStore().saveSecret(secret);
      } catch {
        /* best-effort session unlock */
      }
      setUnlockPassword('');
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : 'Unlock failed');
    } finally {
      setUnlockBusy(false);
    }
  }, [browser, unlockPassword]);

  const onReject = useCallback(() => {
    rejectWalletApproval('User rejected the request');
  }, []);

  const onApprove = useCallback(async () => {
    if (!pending) return;
    const wif = browser.wallet?.privateKey?.trim();
    const address = browser.wallet?.address || browser.address;
    if (!wif || !address) {
      setUnlockError('Unlock your Local Browser Wallet first');
      return;
    }
    setWalletApprovalWorking(true);
    try {
      const session: WalletApprovalSession = { privateKeyWif: wif, address };
      const result = await pending.onApprove(session);
      resolveWalletApproval(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed';
      setWalletApprovalWorking(false, msg);
    }
  }, [pending, browser.wallet, browser.address]);

  if (!pending) return null;

  const busy = pending.status === 'working' || unlockBusy;

  return (
    <div
      className="absolute inset-0 z-[120] flex flex-col bg-[color:var(--ds-surface,#0a0a0c)]/98 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-approval-title"
    >
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/90">
          Signature request
        </p>
        <h2 id="wallet-approval-title" className="mt-1 text-base font-semibold text-white">
          {pending.title}
        </h2>
        {pending.description ? (
          <p className="mt-1.5 text-xs leading-relaxed text-white/60">{pending.description}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {pending.details && pending.details.length > 0 ? (
          <dl className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            {pending.details.map((row) => (
              <div
                key={`${row.label}:${row.value}`}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <dt className="shrink-0 text-white/45">{row.label}</dt>
                <dd className="min-w-0 break-all text-right font-medium text-white/90">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {!sessionReady ? (
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs font-medium text-amber-100">
              Unlock Local Browser Wallet to approve
            </p>
            <input
              type="password"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              placeholder="Wallet password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void unlock();
              }}
              disabled={busy}
              {...walletSecretInputProps('dojakweb-approval-unlock')}
            />
            {unlockError ? <p className="text-[11px] text-red-400">{unlockError}</p> : null}
            <button
              type="button"
              className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              disabled={busy}
              onClick={() => void unlock()}
            >
              {unlockBusy ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200/90">
            Unlocked · {browser.address?.slice(0, 8)}…{browser.address?.slice(-6)}
          </div>
        )}

        {pending.status === 'error' && pending.error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {pending.error}
          </p>
        ) : null}

        <p className="text-[10px] leading-relaxed text-white/35">
          Only approve if you trust this site. Approving signs and may broadcast a Dogecoin
          transaction from your Local Browser Wallet.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-4">
        <button
          type="button"
          className="rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/90 disabled:opacity-50"
          disabled={busy}
          onClick={onReject}
        >
          {pending.rejectLabel || 'Reject'}
        </button>
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 py-3 text-sm font-bold text-black disabled:opacity-50"
          disabled={busy || !sessionReady}
          onClick={() => void onApprove()}
        >
          {pending.status === 'working'
            ? 'Signing…'
            : pending.approveLabel || 'Approve'}
        </button>
      </div>
    </div>
  );
}
