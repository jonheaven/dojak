import { useState } from 'react';
import { useDojakwebI18n } from '../../contexts/DojakwebLocaleContext';

type BoostResult = { childTxid: string };

/**
 * Spend the unconfirmed change of a stuck parent (CPFP).
 * Parent hex comes from command.dog → Core, not electrs.
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
  const [error, setError] = useState<string | null>(null);
  const [childTxid, setChildTxid] = useState<string | null>(null);

  const shownDefault = defaultTxid?.trim() ?? '';
  const value = txid || shownDefault;

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
      {childTxid ? (
        <p className="mt-2 break-all font-mono text-[11px] text-emerald-700 dark:text-emerald-200">
          {t('modal.cpfp.done', { tx: childTxid })}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy || !/^[0-9a-fA-F]{64}$/.test(value)}
        onClick={() => {
          setBusy(true);
          setError(null);
          void onBoost(value)
            .then((res) => setChildTxid(res.childTxid))
            .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => setBusy(false));
        }}
        className="mt-2 w-full rounded-lg bg-amber-300 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
      >
        {busy ? t('modal.cpfp.busy') : t('modal.cpfp.action')}
      </button>
    </div>
  );
}
