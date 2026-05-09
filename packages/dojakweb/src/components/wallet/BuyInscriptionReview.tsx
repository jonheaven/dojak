'use client';

import React from 'react';
import { shibesToDoge } from '../../lib/doginal-psdt';
import type { BuyPsbtReview, SignedBuyTxSummary } from '../../lib/buy-inscription-preview';

function Row({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-white/10 py-2 last:border-0 sm:grid-cols-[minmax(0,7rem)_1fr] sm:items-start sm:gap-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{label}</div>
      <div className={mono ? 'break-all font-mono text-[11px] text-white/90' : 'text-xs text-white/85'}>
        {children}
      </div>
    </div>
  );
}

export function BuyInscriptionPsbtReview({ review }: { review: BuyPsbtReview }) {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-4">
      <div className="text-sm font-bold text-sky-100">Transaction preview (from built PSDT)</div>
      <p className="mt-1 text-[11px] leading-relaxed text-sky-100/75">
        Input 0 is the seller&apos;s inscription (already signed). Inputs 1+ are your dummy and payment UTXOs — your
        wallet will sign those only.
      </p>

      <div className="mt-4">
        <div className="text-xs font-semibold text-white/70">Inputs</div>
        <div className="mt-1 rounded-lg border border-white/10 bg-black/30">
          {review.inputs.map((inp) => (
            <Row key={inp.index} label={`#${inp.index}`} mono>
              <span className="text-emerald-200/90">{inp.role}</span>
              <br />
              {inp.outpoint}
              {inp.valueShibes != null ? (
                <>
                  <br />
                  <span className="text-[#FCD34D]">{shibesToDoge(inp.valueShibes).toFixed(8)} DOGE</span>
                </>
              ) : (
                <span className="text-white/40"> — value unknown</span>
              )}
            </Row>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-white/70">Outputs</div>
        <div className="mt-1 rounded-lg border border-white/10 bg-black/30">
          {review.outputs.map((o) => (
            <Row key={o.index} label={`#${o.index}`} mono>
              <span className="text-emerald-200/90">{o.role}</span>
              <br />
              {o.address}
              <br />
              <span className="text-[#FCD34D]">{shibesToDoge(o.valueShibes).toFixed(8)} DOGE</span>
            </Row>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/60">
        {review.totalInShibes != null ? (
          <span>
            In total: <span className="text-white/85">{shibesToDoge(review.totalInShibes).toFixed(8)} DOGE</span>
          </span>
        ) : null}
        <span>
          Out total: <span className="text-white/85">{shibesToDoge(review.totalOutShibes).toFixed(8)} DOGE</span>
        </span>
        {review.impliedFeeShibes != null ? (
          <span>
            Implied fee: <span className="text-amber-200/90">{shibesToDoge(review.impliedFeeShibes).toFixed(8)} DOGE</span>
          </span>
        ) : (
          <span className="text-white/45">Fee: (input values incomplete in PSDT)</span>
        )}
      </div>
    </div>
  );
}

export function BuyInscriptionSignedReview({
  psbtReview,
  signed,
}: {
  psbtReview: BuyPsbtReview | null;
  signed: SignedBuyTxSummary;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="text-sm font-bold text-amber-100">Signed transaction — review before broadcast</div>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-100/80">
        Tx id (hash): <span className="break-all font-mono text-amber-50">{signed.txid}</span>
      </p>

      <div className="mt-4">
        <div className="text-xs font-semibold text-white/70">Inputs (same order as above)</div>
        <div className="mt-1 rounded-lg border border-white/10 bg-black/30">
          {signed.inputOutpoints.map((op, i) => {
            const pin = psbtReview?.inputs[i];
            return (
              <Row key={`${op}-${i}`} label={`#${i}`} mono>
                {pin?.role ? <span className="text-emerald-200/90">{pin.role}</span> : null}
                {pin?.role ? <br /> : null}
                {op}
                {pin?.valueShibes != null ? (
                  <>
                    <br />
                    <span className="text-[#FCD34D]">{shibesToDoge(pin.valueShibes).toFixed(8)} DOGE</span>
                  </>
                ) : null}
              </Row>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-white/70">Outputs</div>
        <div className="mt-1 rounded-lg border border-white/10 bg-black/30">
          {signed.outputs.map((o) => (
            <Row key={o.index} label={`#${o.index}`} mono>
              <span className="text-emerald-200/90">{o.role}</span>
              <br />
              {o.address}
              <br />
              <span className="text-[#FCD34D]">{shibesToDoge(o.valueShibes).toFixed(8)} DOGE</span>
            </Row>
          ))}
        </div>
      </div>

      {psbtReview?.impliedFeeShibes != null ? (
        <p className="mt-3 text-[11px] text-white/55">
          Expected fee (from PSDT): {shibesToDoge(psbtReview.impliedFeeShibes).toFixed(8)} DOGE
        </p>
      ) : null}
    </div>
  );
}
