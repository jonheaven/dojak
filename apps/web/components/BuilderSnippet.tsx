'use client';

import { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';

const SNIPPET = `if (window.dojak?.isDojak) {
  const accounts = await window.dojak.requestAccounts();
  // or: await window.dojak.request({ method: "doge_requestAccounts" })

  await window.dojak.signPsbt(psbtHex);
  await window.dojak.sendBitcoin(toAddress, satoshis);
}`;

export function BuilderSnippet() {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          window.dojak
        </p>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-zinc-200 transition hover:border-[#D4A017] hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#D4A017]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] leading-6 sm:text-[13px]">
        <code>{SNIPPET}</code>
      </pre>
    </div>
  );
}
