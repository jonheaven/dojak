'use client';

import React, { useEffect, useState } from 'react';
import { fetchTreatsTokens, type TreatsTokenRow } from '../../lib/treats';
import { TreatsMintPanel } from './TreatsMintPanel';

export function TreatsPage() {
  const [tokens, setTokens] = useState<TreatsTokenRow[] | null>(null);
  const [tab, setTab] = useState<'mint' | 'directory'>('mint');

  useEffect(() => {
    let cancelled = false;
    void fetchTreatsTokens(0, 100).then(({ tokens: rows }) => {
      if (!cancelled) setTokens(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FCD34D]/30 bg-[#FCD34D]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#FCD34D]">
          ÐogeTokens
        </div>
        <h1 className="text-3xl font-bold text-white">ÐogeTreats</h1>
        <p className="mt-2 text-sm text-zinc-400">
          OP_RETURN meme/launch lane (<code className="text-zinc-200">p:&quot;dt&quot;</code>) — companion to{' '}
          <strong className="text-zinc-300">Ðunes</strong> (hero fungible). Swap and pool via{' '}
          <strong className="text-zinc-300">ÐSwap Core</strong> on dogenals.com (DOGE/TREATS). Classic inscription DRC-20 is legacy read-only.
        </p>
      </div>

      <div className="flex gap-1 border-b border-zinc-800">
        {(['mint', 'directory'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? 'border-[#FCD34D] text-[#FCD34D]' : 'border-transparent text-zinc-500 hover:text-white'
            }`}
          >
            {t === 'mint' ? 'Deploy / Mint' : 'Token directory'}
          </button>
        ))}
      </div>

      {tab === 'mint' && <TreatsMintPanel />}

      {tab === 'directory' && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800/80">
          {tokens === null ? (
            <div className="animate-pulse p-8 text-center text-sm text-zinc-500">Loading indexer…</div>
          ) : tokens.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">No ÐogeTreats indexed yet — deploy the first treat.</div>
          ) : (
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950/80 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Ticker</th>
                  <th className="px-4 py-2">Minted</th>
                  <th className="px-4 py-2">Max</th>
                  <th className="px-4 py-2">Block</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.ticker_lower} className="border-b border-zinc-800/60">
                    <td className="px-4 py-2 font-mono font-semibold text-[#FCD34D]">{t.ticker}</td>
                    <td className="px-4 py-2 font-mono text-zinc-300">{t.minted}</td>
                    <td className="px-4 py-2 font-mono text-zinc-400">{t.max}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-500">{t.deploy_height.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
