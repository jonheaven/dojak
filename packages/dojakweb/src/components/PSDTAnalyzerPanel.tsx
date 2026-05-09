'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { analyzePsdtLike, type PsdtAnalysisResult } from '../lib/psdt-analyzer';
import { classifyScript, describeScriptLabel } from '../lib/script-labels';
import { DogeAmount } from './DogeAmount';

function DogeValue({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || Number.isNaN(value)) return <>n/a</>;
  return <DogeAmount doge={value} decimals={8} />;
}

function shortHex(value: string | null | undefined, max = 40) {
  if (!value) return 'n/a';
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.focus();
  helper.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(helper);
  return copied;
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-[#A3A3A3]">{label}</div>
      <div className="mt-1 break-words text-sm text-white">{value}</div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/20 p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A3A3A3]">{label}</div>
      <div className="max-w-full break-all text-sm text-white sm:text-right">{value}</div>
    </div>
  );
}

export function PSDTAnalyzerPanel() {
  const [value, setValue] = useState('');
  const [analysis, setAnalysis] = useState<PsdtAnalysisResult | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = ((window as any).__DOJAKWEB_DEBUG__ ??= {});
    root.psbtAnalyzer = {
      analyze: (input: string) => {
        console.log('[PSDT Analyzer] debug.analyze invoked', {
          length: input?.length ?? 0,
          prefix: input?.slice?.(0, 24) ?? '',
        });
        return analyzePsdtLike(input);
      },
    };

    console.log('[PSDT Analyzer] debug hook registered at window.__DOJAKWEB_DEBUG__.psdtAnalyzer');
    return () => {
      const debugRoot = (window as any).__DOJAKWEB_DEBUG__;
      if (debugRoot?.psbtAnalyzer) {
        delete debugRoot.psbtAnalyzer;
      }
    };
  }, []);

  const runAnalysis = () => {
    console.log('[PSDT Analyzer] ui.analyze click', {
      length: value.trim().length,
      prefix: value.trim().slice(0, 24),
    });
    setIsAnalyzing(true);
    try {
      const result = analyzePsdtLike(value);
      setAnalysis(result);
      setLastAnalyzedAt(Date.now());
      console.log('[PSDT Analyzer] ui.analyze result', result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clear = () => {
    console.log('[PSDT Analyzer] ui.clear click');
    setValue('');
    setAnalysis(null);
    setLastAnalyzedAt(null);
    setCopyState('idle');
  };

  const copyJson = async () => {
    if (!analysis) return;
    console.log('[PSDT Analyzer] ui.copyJson click');
    try {
      await copyToClipboard(JSON.stringify(analysis, null, 2));
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch (error) {
      console.error('[PSDT Analyzer] ui.copyJson error', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 1500);
    }
  };

  const exportJson = () => {
    if (!analysis || typeof document === 'undefined') return;
    console.log('[PSDT Analyzer] ui.exportJson click');
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'psbt-analysis.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sample = () => {
    console.log('[PSDT Analyzer] ui.sample click');
    setValue(
      'cHNidP8BAP16AQIAAAAEnqmfPMzSGP/H8mBWNA2QzF72jg1IL8I7Svfr9CRW0KkAAAAAAP////+eqZ88zNIY/8fyYFY0DZDMXvaODUgvwjtK9+v0JFbQqQQAAAAA/////2wpYKH0Sgw49Q5wBW7JuZtcV86FfOb5y+ofpgCxNXNQAAAAAAD/////2u+c8Mqjox5FrEDNdcsCV8+S/JTFwK7bj+xzVL0N/fwAAAAAAP////8G45MEAAAAAAAZdqkU4MyUwDY/4yMlY5Rc4e8N4djrP2eIrKCGAQAAAAAAGXapFODMlMA2P+MjJWOUXOHvDeHY6z9niKzgCuIFAAAAABl2qRRBzOrVnSP+rd7ohR3FjkN8YbGKboisQBZAAAAAAAAZdqkUlDy9SaIRMGOAf1nfXQ9SeUUzzquIrKGGAQAAAAAAGXapFODMlMA2P+MjJWOUXOHvDeHY6z9niKxfTcUyAAAAABl2qRTgzJTANj/jIyVjlFzh7w3h2Os/Z4isAAAAAAABAP0kAwIAAAAEDeGofoXltSES4rpdAMmSHJZf6dIq8Ot17aZNktMk4oAAAAAAa0gwRQIhANFzC/3/WXCZR9a4z8DzKXb0eHP3TCdb4BLBgqKrWsi7AiBj7I6iWtSO2bPRQpgEwuYNnrREMGWdWutBAy3rzuik9wEhA/Dn65cZXq8w7o/1s/ZotgsnVkYDU/KKtJXWdTsJQ4In/////w3hqH6F5bUhEuK6XQDJkhyWX+nSKvDrde2mTZLTJOKAAQAAAGtIMEUCIQDi95R34VTdegGJ8qp9U7UoPR+C0x1og07rNM9Sh1aoVwIgHziATfst9GBPeBE8dzWjUUFXP8XhyrA/1ax6zh1vKsIBIQPw5+uXGV6vMO6P9bP2aLYLJ1ZGA1PyirSV1nU7CUOCJ/////+ZuUq5D6cQSGmpMia3oHepl0pdlADlV8SZlhGsabuShgMAAABqRzBEAiBPvp15APP1aEv9gHESPCdwGr/J6CTwgNK6rGoKko8U9wIgDxkT8qJlmY3jIy7i0E8XUeAtr1Osxk0vwReJXf3fQciDIQIFZ9sJThmiNYiPkyc4r2k7AWOTN5JfP2piFpyU1xmQpf////8N4ah+heW1IRLiul0AyZIcll/p0irw63Xtpk2S0yTigAIAAABqRzBEAiBuL3Rit2NPbXYTcfAYRnTDW5EcE1lzD6PtrIYlbjFwcwIgdaBwQQtX+n2lF/xh6O1wI2878DrzpeN0leMcyy4ob20BIQPw5+uXGV6vMO6P9bP2aLYLJ1ZGA1PyirSV1nU7CUOCJ/////8GQg0DAAAAAAAZdqkU4MyUwDY/4yMlY5Rc4e8N4djrP2eIrKCGAQAAAAAAGXapFODMlMA2P+MjJWOUXOHvDeHY6z9niKwg8g4HAAAAABl2qRSGkD4RiTAEnKWcAWBdfsLWl8wzqIisgOdMAAAAAAAZdqkUlDy9SaIRMGOAf1nfXQ9SeUUzzquIrKGGAQAAAAAAGXapFODMlMA2P+MjJWOUXOHvDeHY6z9niKzdwKYwAAAAABl2qRTgzJTANj/jIyVjlFzh7w3h2Os/Z4isAAAAAAABAP0kAwIAAAAEDeGofoXltSES4rpdAMmSHJZf6dIq8Ot17aZNktMk4oAAAAAAa0gwRQIhANFzC/3/WXCZR9a4z8DzKXb0eHP3TCdb4BLBgqKrWsi7AiBj7I6iWtSO2bPRQpgEwuYNnrREMGWdWutBAy3rzuik9wEhA/Dn65cZXq8w7o/1s/ZotgsnVkYDU/KKtJXWdTsJQ4In/////w3hqH6F5bUhEuK6XQDJkhyWX+nSKvDrde2mTZLTJOKAAQAAAGtIMEUCIQDi95R34VTdegGJ8qp9U7UoPR+C0x1og07rNM9Sh1aoVwIgHziATfst9GBPeBE8dzWjUUFXP8XhyrA/1ax6zh1vKsIBIQPw5+uXGV6vMO6P9bP2aLYLJ1ZGA1PyirSV1nU7CUOCJ/////+ZuUq5D6cQSGmpMia3oHepl0pdlADlV8SZlhGsabuShgMAAABqRzBEAiBPvp15APP1aEv9gHESPCdwGr/J6CTwgNK6rGoKko8U9wIgDxkT8qJlmY3jIy7i0E8XUeAtr1Osxk0vwReJXf3fQciDIQIFZ9sJThmiNYiPkyc4r2k7AWOTN5JfP2piFpyU1xmQpf////8N4ah+heW1IRLiul0AyZIcll/p0irw63Xtpk2S0yTigAIAAABqRzBEAiBuL3Rit2NPbXYTcfAYRnTDW5EcE1lzD6PtrIYlbjFwcwIgdaBwQQtX+n2lF/xh6O1wI2878DrzpeN0leMcyy4ob20BIQPw5+uXGV6vMO6P9bP2aLYLJ1ZGA1PyirSV1nU7CUOCJ/////8GQg0DAAAAAAAZdqkU4MyUwDY/4yMlY5Rc4e8N4djrP2eIrKCGAQAAAAAAGXapFODMlMA2P+MjJWOUXOHvDeHY6z9niKwg8g4HAAAAABl2qRSGkD4RiTAEnKWcAWBdfsLWl8wzqIisgOdMAAAAAAAZdqkUlDy9SaIRMGOAf1nfXQ9SeUUzzquIrKGGAQAAAAAAGXapFODMlMA2P+MjJWOUXOHvDeHY6z9niKzdwKYwAAAAABl2qRTgzJTANj/jIyVjlFzh7w3h2Os/Z4isAAAAAAABAP2rAQEAAAACBIXBo4D4cFphI9Wcy2gigg/I7mjLxey1NcdBuV0LmU0AAAAAoANvcmRRGHRleHQvcGxhaW47Y2hhcnNldD11dGYtOAAOMjcyMDYzLmRvZ2VtYXBHMEQCIE9B6jxQ5/vlQwyTOaMd/NVK3GyBOCnf5q82eDqiVn0fAiBGsqgAtrOrBnTBmwpiwjiLOMhMPjHSHjPHBqIk6CFFrwEpIQPFVINHS2fvWb2TbWA62UR7E1sh/xsBiluTGrQVGprwaa11dXV1dVH/////BIXBo4D4cFphI9Wcy2gigg/I7mjLxey1NcdBuV0LmU0BAAAAa0gwRQIhANUBV5EHwPH/RSFaNXqFssgjrJP5zIqPEcNGLWhUZlsRAiBxgswVPsEl59X1eySpSPm2Zvl+cNLUI9dtPMkf63A5PgEhA8VUg0dLZ+9ZvZNtYDrZRHsTWyH/GwGKW5MatBUamvBp/////wKghgEAAAAAABl2qRRBzOrVnSP+rd7ohR3FjkN8YbGKboisgBnkHQAAAAAZdqkU8s5+fE7UuXtG+stGkIJ+ynCmRZqIrAAAAAAAAQD9BAEBAAAAAYl2MfWL15QF7MFIyc5TaX2qgH/xgCluEQMaMvsEQZWqAQAAAGtIMEUCIQDrBBUnaEHI6cu+z1fT+3mLk8lOktuvA6lihIpBv11RhQIgZLKb+BUcOqAsz1jz/6332qw5t7VVaftNQ77zYRo6+zkBIQOzOw64dcSHOiWdouhx1siQo3Y4KRJBLpqURWXCLBMXo/////8DAMqaOwAAAAAZdqkU4MyUwDY/4yMlY5Rc4e8N4djrP2eIrBCDJTsAAAAAGXapFIuGqFOiSlYn8bIbcH6301WNbIW6iKwQgyU7AAAAABl2qRSLhqhTokpWJ/GyG3B+t9NVjWyFuoisAAAAAAAAAAAAAAA=',
    );
  };

  const activeErrors = analysis?.errors ?? [];
  const activeWarnings = analysis?.warnings ?? [];

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0A0A0A] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FCD34D]">PSDT Analyzer</div>
          <p className="mt-1 text-xs leading-5 text-[#D4D4D4]">
            Paste a PSDT or raw transaction and inspect the inputs, outputs, scripts, and signing metadata.
          </p>
        </div>
        <div className="flex gap-2">
          {analysis && (
            <>
              <button
                type="button"
                onClick={copyJson}
                className="rounded-full border border-border-primary bg-bg-tertiary px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-secondary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy JSON'}
              </button>
              <button
                type="button"
                onClick={exportJson}
                className="inline-flex items-center gap-2 rounded-full border border-border-primary bg-bg-tertiary px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-secondary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden />
                Export
              </button>
            </>
          )}
          <button
            type="button"
            onClick={sample}
            className="rounded-full border border-border-primary bg-bg-tertiary px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-secondary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
          >
            Load sample
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-full border border-border-primary bg-bg-tertiary px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-primary/40 hover:bg-bg-secondary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/10"
          >
            Clear
          </button>
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#D4D4D4]">
          PSDT / transaction data
        </span>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste base64 PSDT, hex PSDT, or raw transaction hex here..."
          className="min-h-[180px] w-full rounded-xl border border-border-primary bg-bg-secondary px-4 py-3 font-mono text-xs leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runAnalysis}
          disabled={isAnalyzing || !value.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-[#FCD34D] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#fde68a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
          {isAnalyzing ? 'Analyzing...' : 'Analyze'}
        </button>
        {lastAnalyzedAt && (
          <div className="text-xs text-[#A3A3A3]">
            Last analyzed {new Date(lastAnalyzedAt).toLocaleString()}
          </div>
        )}
      </div>

      {analysis && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryRow label="Format" value={analysis.format.toUpperCase()} />
            <SummaryRow label="Encoding" value={analysis.inputEncoding} />
            <SummaryRow label="Network hint" value={analysis.networkHint} />
            <SummaryRow label="PSDT version" value={analysis.psbtVersion ?? 'n/a'} />
            <SummaryRow label="Tx version" value={analysis.txVersion ?? 'n/a'} />
            <SummaryRow label="Locktime" value={analysis.locktime ?? 'n/a'} />
            <SummaryRow label="Inputs" value={analysis.inputCount} />
            <SummaryRow label="Outputs" value={analysis.outputCount} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryRow label="TXID" value={analysis.txid ?? 'n/a'} />
            <SummaryRow label="Raw prefix" value={<span className="font-mono text-xs">{analysis.rawPrefix || 'n/a'}</span>} />
            <SummaryRow label="Total output" value={<DogeValue value={analysis.totalOutputDoge} />} />
            <SummaryRow label="Global unknown keys" value={analysis.globalUnknownKeyCount} />
          </div>

          {analysis.note && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[#E5E5E5]">
              {analysis.note}
            </div>
          )}

          {activeWarnings.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <ExclamationTriangleIcon className="h-5 w-5" aria-hidden />
                Warnings
              </div>
              <ul className="space-y-1 text-sm text-amber-100/90">
                {activeWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {activeErrors.length > 0 && (
            <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                <ExclamationTriangleIcon className="h-5 w-5" aria-hidden />
                Errors
              </div>
              <ul className="space-y-1 text-sm text-red-100/90">
                {activeErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.format === 'psbt' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4D4D4]">
                Inputs
              </div>
              <div className="space-y-3">
                {analysis.inputs.map((input) => (
                  <details key={input.index} className="rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/20 p-3" open={input.index < 2}>
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-text-primary dark:text-white">
                          Input {input.index} {input.partialSigCount > 0 ? '(signed)' : '(unsigned)'}
                        </div>
                        <div className="text-xs text-[#A3A3A3]">
                          {input.txid}:{input.vout}
                        </div>
                      </div>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <DetailLine label="Prevout value" value={<DogeValue value={input.prevoutValueDoge} />} />
                        <DetailLine label="Sequence" value={input.sequence} />
                        <DetailLine label="Has nonWitnessUtxo" value={String(input.hasNonWitnessUtxo)} />
                        <DetailLine label="Has witnessUtxo" value={String(input.hasWitnessUtxo)} />
                        <DetailLine label="Partial signatures" value={input.partialSigCount} />
                        <DetailLine label="BIP32 derivations" value={input.bip32DerivationCount} />
                        <DetailLine label="Sighash" value={input.sighashType === null ? 'n/a' : `0x${input.sighashType.toString(16)}`} />
                        <DetailLine label="Unknown keys" value={input.unknownKeyCount} />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <DetailLine label="Prevout DOGE address" value={input.prevoutAddressDoge ?? 'n/a'} />
                        <DetailLine label="Prevout BTC address" value={input.prevoutAddressBtc ?? 'n/a'} />
                        <DetailLine label="Prevout script type" value={describeScriptLabel(classifyScript(Buffer.from(input.scriptHex ?? '', 'hex')))} />
                        <DetailLine label="Prevout script" value={<span className="font-mono text-xs">{shortHex(input.scriptHex)}</span>} />
                        <DetailLine label="Redeem script" value={<span className="font-mono text-xs">{shortHex(input.redeemScriptHex)}</span>} />
                        <DetailLine label="Witness script" value={<span className="font-mono text-xs">{shortHex(input.witnessScriptHex)}</span>} />
                        <DetailLine label="Partial signer keys" value={input.partialSigners.length > 0 ? input.partialSigners.join(', ') : 'n/a'} />
                        <DetailLine label="BIP32 paths" value={input.bip32Paths.length > 0 ? input.bip32Paths.join(', ') : 'n/a'} />
                      </div>
                    </div>
                  </details>
                ))}
              </div>

              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4D4D4]">
                Outputs
              </div>
              <div className="space-y-3">
                {analysis.outputs.map((output) => (
                  <details key={output.index} className="rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/20 p-3" open={output.index < 2}>
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-text-primary dark:text-white">Output {output.index}</div>
                        <div className="text-xs text-[#A3A3A3]">{<DogeValue value={output.valueDoge} />}</div>
                      </div>
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <DetailLine label="DOGE address" value={output.addressDoge ?? 'n/a'} />
                      <DetailLine label="BTC address" value={output.addressBtc ?? 'n/a'} />
                      <DetailLine label="Script type" value={describeScriptLabel(classifyScript(Buffer.from(output.scriptHex ?? '', 'hex')))} />
                      <DetailLine label="Script" value={<span className="font-mono text-xs">{shortHex(output.scriptHex)}</span>} />
                      <DetailLine label="Value" value={<DogeValue value={output.valueDoge} />} />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {analysis.format === 'raw-tx' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <CheckCircleIcon className="h-5 w-5" aria-hidden />
                Raw transaction decoded successfully.
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4D4D4]">Outputs</div>
              <div className="space-y-3">
                {analysis.outputs.map((output) => (
                  <details key={output.index} className="rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/20 p-3" open={output.index < 2}>
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-text-primary dark:text-white">Output {output.index}</div>
                        <div className="text-xs text-[#A3A3A3]">{<DogeValue value={output.valueDoge} />}</div>
                      </div>
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <DetailLine label="DOGE address" value={output.addressDoge ?? 'n/a'} />
                      <DetailLine label="BTC address" value={output.addressBtc ?? 'n/a'} />
                      <DetailLine label="Script type" value={describeScriptLabel(classifyScript(Buffer.from(output.scriptHex ?? '', 'hex')))} />
                      <DetailLine label="Script" value={<span className="font-mono text-xs">{shortHex(output.scriptHex)}</span>} />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border-primary bg-bg-secondary dark:border-white/10 dark:bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary dark:text-white">
              <ClipboardDocumentIcon className="h-5 w-5 text-[#FCD34D]" aria-hidden />
              Console access
            </div>
            <p className="mt-2 text-xs leading-5 text-[#D4D4D4]">
              Use <code className="rounded bg-black/40 px-1 py-0.5 text-[#FCD34D]">window.__DOJAKWEB_DEBUG__.psdtAnalyzer.analyze(...)</code>
              to inspect a payload from the browser console.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PSDTAnalyzerPanel;
