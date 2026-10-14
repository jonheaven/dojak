import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDojakwebI18n } from '../../contexts/DojakwebLocaleContext';
import { rememberCpfpChild, resolveStoredBoost } from '../../lib/mempoolSpendOverlay';

type BoostResult = { childTxid: string };

/**
 * Spend the unconfirmed change of a stuck parent (CPFP).
 * Parent hex comes from command.dog → Core, not electrs.
 * A finished boost replaces this form — the button must not stay pressable.
 */
export function PendingChangeBoost({
  defaultTxid,
  onBoost,
}: {
  defaultTxid?: string | null;
  onBoost: (parentTxid: string) => Promise<BoostResult>;
}) {
  const { t } = useDojakwebI18n();
  const [txid, setTxid] = useState(defaultTxid?.trim() ?? '');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [childTxid, setChildTxid] = useState<string | null>(null);

  const shownDefault = defaultTxid?.trim() ?? '';
  const value = (txid || shownDefault).trim();
  const stored = resolveStoredBoost(value);
  const doneChild = (childTxid || stored?.childTxid || '').trim().toLowerCase();
  const doneParent = (stored?.parentTxid || (childTxid ? value : '')).trim().toLowerCase();

  if (/^[0-9a-f]{64}$/.test(doneChild) && /^[0-9a-f]{64}$/.test(doneParent)) {
    return (
      <div
        className="rounded-xl border border-emerald-400/70 bg-[#052e1a] px-3 py-3 text-left text-emerald-50"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-emerald-200">{t('modal.cpfp.doneTitle')}</p>
        <p className="mt-1 text-xs leading-5 text-emerald-50/90">{t('modal.cpfp.doneBody')}</p>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/70">
          {t('modal.cpfp.doneChildLabel')}
        </p>
        <p className="mt-0.5 break-all font-mono text-xs text-emerald-50">{doneChild}</p>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/70">
          {t('modal.cpfp.doneParentLabel')}
        </p>
        <p className="mt-0.5 break-all font-mono text-[11px] text-emerald-50/75">{doneParent}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-left text-inherit">
      <p className="text-xs font-semibold">{t('modal.cpfp.title')}</p>
      <p className="mt-1 text-[11px] leading-5 opacity-80">{t('modal.cpfp.body')}</p>
      <label className="mt-2 block text-[11px] opacity-80">
        {t('modal.cpfp.txidLabel')}
        <input
          value={value}
          onChange={(e) => {
            setTxid(e.target.value.trim());
            setChildTxid(null);
            setError(null);
          }}
          spellCheck={false}
          placeholder="64-character txid"
          className="mt-1 w-full rounded-lg border border-current/20 bg-black/20 px-2 py-1.5 font-mono text-[11px] text-inherit"
          disabled={busy}
        />
      </label>
      {error ? <p className="mt-2 text-[11px] text-red-600 dark:text-red-200">{error}</p> : null}
      <button
        type="button"
        disabled={busy || !/^[0-9a-fA-F]{64}$/.test(value)}
        onClick={() => {
          if (busyRef.current) return;
          busyRef.current = true;
          setBusy(true);
          setError(null);
          const parent = value.toLowerCase();
          void onBoost(parent)
            .then((res) => {
              const child = res.childTxid.trim().toLowerCase();
              rememberCpfpChild(parent, child);
              setChildTxid(child);
              toast.success(t('modal.cpfp.doneTitle'));
            })
            .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => {
              busyRef.current = false;
              setBusy(false);
            });
        }}
        className="mt-2 w-full rounded-lg bg-amber-300 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
      >
        {busy ? t('modal.cpfp.busy') : t('modal.cpfp.action')}
      </button>
    </div>
  );
}
