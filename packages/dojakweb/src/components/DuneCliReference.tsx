import React from 'react';
import { CommandLineIcon } from '@heroicons/react/24/outline';

const mono = 'font-mono text-xs text-text-primary break-all';

export const DuneCliReference: React.FC = () => {
  return (
    <details className="rounded-xl border border-border-primary bg-bg-secondary open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-text-primary [&::-webkit-details-marker]:hidden">
        <CommandLineIcon className="h-4 w-4 shrink-0 text-text-secondary" />
        <span>Indexer and CLI parity</span>
        <span className="ml-auto text-xs font-normal text-text-secondary">dog / wonky-dogeord</span>
      </summary>
      <div className="space-y-4 border-t border-border-primary px-4 py-4 text-sm text-text-secondary">
        <p>
          Dojakweb builds the same Dunestone <code className="rounded bg-bg-tertiary px-1 py-0.5 text-text-primary">OP_RETURN</code>{' '}
          payloads as the <strong className="font-medium text-text-primary">dog</strong> wallet. The buttons below mirror{' '}
          <span className={mono}>dog wallet</span> flows; holdings come from your configured wallet data provider (same
          fields an indexer would expose).
        </p>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-primary">Deploy (etch)</h3>
          <p>
            UI: <strong className="text-text-primary">Deploy New Ðune</strong> — supply, divisibility, symbol, optional mint
            terms, fee rate.
          </p>
          <p className={mono}>
            dog wallet batch …
          </p>
          <p className="text-xs">
            Etching is submitted through <code className="rounded bg-bg-tertiary px-1">dog wallet batch</code> with a batch
            file that includes an <code className="rounded bg-bg-tertiary px-1">etching</code> entry. The modal fields map to
            that JSON structure.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-primary">Mint</h3>
          <p>
            UI: <strong className="text-text-primary">Mint</strong> — dune name, fee rate, postage (sats), optional destination
            address.
          </p>
          <p className={mono}>
            dog wallet mint --fee-rate &lt;koinu/vB&gt; --dune &lt;NAME&gt; [--postage &lt;sat&gt;] [--destination &lt;ADDR&gt;]
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-primary">Send</h3>
          <p>
            UI: <strong className="text-text-primary">Send</strong> on a holding — amount and recipient.
          </p>
          <p className="text-xs">
            Use your wallet or indexer-backed tools to move balances; Dojakweb signs a transfer using the same Dunestone
            encoding as <span className={mono}>dog</span>.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-primary">Read / list (indexer)</h3>
          <ul className="list-inside list-disc space-y-1 text-xs">
            <li>
              <span className={mono}>dog dunes</span> — full dune set from a <code className="rounded bg-bg-tertiary px-1">--index-dunes</code> index (JSON shape aligned with wonky&apos;s dunes listing).
            </li>
            <li>
              <span className={mono}>dog dune list</span> / <span className={mono}>dog dune info &lt;NAME&gt;</span> — catalog and metadata for one dune.
            </li>
            <li>
              <span className={mono}>dog dune balance &lt;ADDRESS&gt;</span> — per-address balances (requires{' '}
              <code className="rounded bg-bg-tertiary px-1">--index-addresses</code> as well as dunes indexing).
            </li>
            <li>
              <span className={mono}>ord dunes</span> (wonky-dogeord) — same class of output as <span className={mono}>dog dunes</span>; use whichever binary your stack ships.
            </li>
          </ul>
        </div>
      </div>
    </details>
  );
};
