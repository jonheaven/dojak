'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
 * In-wallet signing modal (extension-style Approve / Reject).
 *
 * Always position:absolute over the wallet chassis via host CSS (.ds-wallet-approval).
 * Never enters document flow / never pushes the main wallet scroll view.
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
  /** Sync guard — React state alone can miss a double-tap before re-render. */
  const approveLockRef = useRef(false);

  const sessionReady = Boolean(browser.wallet?.privateKey?.trim() && browser.address);

  // Mark chassis so host CSS can lock scroll under the overlay.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const chassis = document.querySelector('.ds-wallet-dashboard');
    if (!chassis) return;
    if (pending) {
      chassis.classList.add('ds-wallet-approval-open');
    } else {
      chassis.classList.remove('ds-wallet-approval-open');
    }
    return () => {
      chassis.classList.remove('ds-wallet-approval-open');
    };
  }, [pending]);

  // Reset lock when a new approval request appears.
  useEffect(() => {
    approveLockRef.current = false;
  }, [pending?.id]);

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
    // Allow Cancel even while Working… — UTXO/indexer waits can stick for a long time
    // after a rapid re-bet; users must be able to bail without refreshing the tab.
    if (!pending) return;
    if (pending.status === 'working') {
      approveLockRef.current = false;
      rejectWalletApproval('Cancelled while signing');
      return;
    }
    if (approveLockRef.current) return;
    rejectWalletApproval('User rejected the request');
  }, [pending]);

  const onApprove = useCallback(async () => {
    if (!pending) return;
    if (approveLockRef.current || pending.status === 'working') return;
    const wif = browser.wallet?.privateKey?.trim();
    const address = browser.wallet?.address || browser.address;
    if (!wif || !address) {
      setUnlockError('Unlock your Local Browser Wallet first');
      return;
    }
    approveLockRef.current = true;
    setWalletApprovalWorking(true);
    try {
      const session: WalletApprovalSession = { privateKeyWif: wif, address };
      const result = await pending.onApprove(session);
      resolveWalletApproval(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed';
      approveLockRef.current = false;
      setWalletApprovalWorking(false, msg);
    }
  }, [pending, browser.wallet, browser.address]);

  if (!pending) return null;

  const working = pending.status === 'working' || approveLockRef.current;
  const busy = working || unlockBusy;

  return (
    <div
      className="ds-wallet-approval"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-approval-title"
    >
      <div className="ds-wallet-approval__header">
        <p className="ds-wallet-approval__eyebrow">Signature request</p>
        <h2 id="wallet-approval-title" className="ds-wallet-approval__title">
          {pending.title}
        </h2>
        {pending.description ? (
          <p className="ds-wallet-approval__desc">{pending.description}</p>
        ) : null}
      </div>

      <div className="ds-wallet-approval__body">
        {pending.details && pending.details.length > 0 ? (
          <dl className="ds-wallet-approval__details">
            {pending.details.map((row) => (
              <div key={`${row.label}:${row.value}`} className="ds-wallet-approval__detail-row">
                <dt className="ds-wallet-approval__detail-label">{row.label}</dt>
                <dd className="ds-wallet-approval__detail-value">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {!sessionReady ? (
          <div className="ds-wallet-approval__unlock">
            <p className="ds-wallet-approval__unlock-title">
              Unlock Local Browser Wallet to approve
            </p>
            <input
              type="password"
              className="ds-wallet-approval__input"
              placeholder="Wallet password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void unlock();
              }}
              disabled={busy}
              {...walletSecretInputProps('dojakweb-approval-unlock')}
            />
            {unlockError ? <p className="ds-wallet-approval__error">{unlockError}</p> : null}
            <button
              type="button"
              className="ds-wallet-approval__btn-unlock"
              disabled={busy}
              onClick={() => void unlock()}
            >
              {unlockBusy ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        ) : (
          <p className="ds-wallet-approval__session">
            Unlocked · {browser.address?.slice(0, 8)}…{browser.address?.slice(-6)}
          </p>
        )}

        {pending.status === 'error' && pending.error ? (
          <p className="ds-wallet-approval__tx-error">{pending.error}</p>
        ) : null}

        <p className="ds-wallet-approval__hint">
          Only approve if you trust this site. Approving signs and may broadcast a Dogecoin
          transaction from your Local Browser Wallet.
        </p>
      </div>

      <div className="ds-wallet-approval__footer">
        <button
          type="button"
          className="ds-wallet-approval__btn-reject"
          disabled={unlockBusy}
          onClick={onReject}
        >
          {working ? 'Cancel' : pending.rejectLabel || 'Reject'}
        </button>
        <button
          type="button"
          className="ds-wallet-approval__btn-approve"
          disabled={busy || !sessionReady}
          aria-busy={pending.status === 'working'}
          onClick={() => void onApprove()}
        >
          {pending.status === 'working' ? 'Working…' : pending.approveLabel || 'Approve'}
        </button>
      </div>
    </div>
  );
}
