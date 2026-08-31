/**
 * DMPPage.tsx
 *
 * Dogecoin Marketplace Protocol (ÐMP) documentation and demo page.
 *
 * =========================================================================
 * WHAT IS ÐMP?
 * =========================================================================
 *
 * ÐMP (Dogecoin Marketplace Protocol) is a standardized protocol for
 * Dogecoin marketplace transactions. It provides a secure, verifiable way
 * for buyers and sellers to interact in Dogecoin marketplaces.
 *
 * Key features:
 *   • Signed intent system for listings, bids, settlements, and cancellations
 *   • Canonical JSON signing with address validation
 *   • PSBT-based transaction construction
 *   • Cross-platform compatibility
 *
 * =========================================================================
 * PROTOCOL OVERVIEW
 * =========================================================================
 *
 * ÐMP uses on-chain JSON envelopes (`p: "Ð:MP"`) plus a seller-signed PSDT fill.
 * Spec: dogenals/spec/protocols/dmp/spec.md · public: github.com/jonheaven/dmp-spec
 * Wallet signing here produces that envelope (op: list | bid | settle | cancel).
 *
 * =========================================================================
 * INTEGRATION GUIDE
 * =========================================================================
 *
 * For marketplace developers:
 *   1. Use signDMPIntent() from the wallet context (emits p:"Ð:MP")
 *   2. Inscribe the envelope; attach seller-signed PSDT as `psdt`
 *   3. Buyers complete the PSDT and broadcast via command.dog → Core
 */

import React, { useState } from 'react';
import {
  ShoppingBagIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useUnifiedWallet } from '../contexts/UnifiedWalletContext';
import { toast } from 'sonner';

const SAMPLE_LISTING_ID = `${'a'.repeat(64)}i0`;
const SAMPLE_BID_ID = `${'b'.repeat(64)}i0`;
const SAMPLE_PSDT = 'cHNidP8BAH0CAAAAAdemoPSDT';

function parsePositiveInteger(rawValue: string, field: string): number {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function OperationExample({
  title,
  description,
  intentType,
  params,
  result,
  onExecute,
  isExecuting,
}: {
  title: string;
  description: string;
  intentType: string;
  params: Record<string, string | number>;
  result: string | null;
  onExecute: () => void;
  isExecuting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-900/30 border border-blue-700/30">
          <CodeBracketIcon className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        </div>
      </div>

      <div className="bg-black/50 rounded-lg p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Intent Parameters</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-xs text-zinc-600">Operation:</div>
          <div className="text-xs text-blue-400 font-mono">{intentType}</div>
          {Object.entries(params).map(([key, value]) => (
            <React.Fragment key={key}>
              <div className="text-xs text-zinc-600">{key}:</div>
              <div className="text-xs text-zinc-300 font-mono break-all">{String(value)}</div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onExecute}
        disabled={isExecuting}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-sm font-medium transition-colors"
      >
        {isExecuting ? 'Signing...' : 'Sign Intent'}
        <ArrowRightIcon className="w-4 h-4" />
      </button>

      {result && (
        <div className="bg-black/50 rounded-lg p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Signed Intent</div>
          <pre className="text-xs text-emerald-300 font-mono whitespace-pre-wrap break-all">{result}</pre>
        </div>
      )}
    </div>
  );
}

export function DMPPage() {
  const { connected, address, signDMPIntent, walletType } = useUnifiedWallet();

  const [priceKoinu, setPriceKoinu] = useState('4206900000');
  const [activeAction, setActiveAction] = useState<'list' | 'bid' | 'settle' | 'cancel' | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  const walletLabel =
    walletType === 'mydoge'
      ? 'MyDoge'
      : walletType === 'browser'
        ? 'Local'
        : walletType === 'dojak'
          ? 'Dojak'
          : walletType === 'spookydoge'
            ? 'Spooky Doge'
          : walletType === 'dogesoft'
            ? 'Doge Soft'
          : walletType === 'ledger'
            ? 'Ledger'
            : walletType === 'dogewatch'
              ? 'Dogewatch'
            : null;

  const handleSignIntent = async (intentType: 'list' | 'bid' | 'settle' | 'cancel') => {
    if (!connected || !address) {
      toast.error('Connect your wallet first');
      return;
    }

    setActiveAction(intentType);
    try {
      let signedIntent;

      switch (intentType) {
        case 'list':
          signedIntent = await signDMPIntent('list', {
            inscription_id: SAMPLE_LISTING_ID,
            price_koinu: parsePositiveInteger(priceKoinu, 'price'),
            psdt: SAMPLE_PSDT,
          });
          break;
        case 'bid':
          signedIntent = await signDMPIntent('bid', {
            listing_id: SAMPLE_LISTING_ID,
            price_koinu: parsePositiveInteger(priceKoinu, 'price'),
            psdt: SAMPLE_PSDT,
          });
          break;
        case 'settle':
          signedIntent = await signDMPIntent('settle', {
            listing_id: SAMPLE_LISTING_ID,
            bid_id: SAMPLE_BID_ID,
            psdt: SAMPLE_PSDT,
          });
          break;
        case 'cancel':
          signedIntent = await signDMPIntent('cancel', {
            listing_id: SAMPLE_LISTING_ID,
          });
          break;
      }

      const resultJson = JSON.stringify(signedIntent, null, 2);
      setResults(prev => ({ ...prev, [intentType]: resultJson }));
      toast.success(`${intentType} envelope signed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown signing error';
      toast.error(message);
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-purple-900/30 border border-purple-700/30">
            <ShoppingBagIcon className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary dark:text-white">ÐMP Marketplace Protocol</h1>
            <p className="mt-1 text-lg text-text-secondary dark:text-zinc-400">
              Standardized marketplace intents for Dogecoin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-900/30 text-purple-400 border border-purple-700/30">
            <DocumentTextIcon className="w-3.5 h-3.5" />
            Protocol v1.0
          </span>
          <span className="text-xs text-text-tertiary dark:text-zinc-600">
            Secure, verifiable marketplace transactions
          </span>
        </div>
      </div>

      {/* ── Protocol Overview ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <InformationCircleIcon className="w-6 h-6 text-blue-400 flex-shrink-0" />
          <h2 className="text-xl font-semibold text-white">What is ÐMP?</h2>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-zinc-300 leading-relaxed">
            ÐMP (Dogecoin Marketplace Protocol) is a standardized protocol for secure marketplace
            transactions on Dogecoin. It uses cryptographically signed JSON intents to ensure
            that marketplace operations are verifiable and tamper-proof.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Key Features</h3>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>Canonical JSON signing with ECDSA</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>PSBT-based transaction construction</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>Address validation and nonce protection</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>Cross-platform wallet compatibility</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Supported Operations</h3>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li className="flex items-start gap-2">
                  <ShoppingBagIcon className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span><strong>listing:</strong> Create marketplace listings</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShoppingBagIcon className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span><strong>bid:</strong> Place bids on listings</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShoppingBagIcon className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span><strong>settle:</strong> Complete transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShoppingBagIcon className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span><strong>cancel:</strong> Cancel listings or bids</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Connect Prompt ── */}
      {!connected && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <ShoppingBagIcon className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 text-sm mb-4">
            Connect your Dojakweb wallet to sign ÐMP marketplace intents.
          </p>
          <div className="text-xs text-zinc-600">
            ÐMP requires wallet signing for cryptographic verification.
          </div>
        </div>
      )}

      {/* ── Wallet Status ── */}
      {connected && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/50 border border-zinc-700">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-zinc-300">
              Connected: {address?.slice(0, 8)}…{address?.slice(-8)}
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            Wallet: {walletLabel ?? 'Unknown'}
          </span>
        </div>
      )}

      {/* ── Parameters ── */}
      {connected && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Demo Parameters</h3>
          <div className="grid md:grid-cols-1 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Price (koinu string on-chain)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={priceKoinu}
                onChange={(e) => setPriceKoinu(e.target.value)}
                placeholder="1000000"
                className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 font-mono text-sm text-zinc-200"
              />
            </div>
          </div>
          <div className="text-xs text-zinc-600 bg-black/30 rounded-lg p-3">
            These parameters are used in the demo intents below. In a real marketplace,
            these would come from your application logic.
          </div>
        </div>
      )}

      {/* ── Operation Examples ── */}
      {connected && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-text-primary dark:text-white">Operation Examples</h2>

          <div className="grid gap-6">
            <OperationExample
              title="Create Listing"
              description="Sign a spec list envelope (p: Ð:MP, op: list) with seller-signed PSDT."
              intentType="list"
              params={{
                inscription_id: SAMPLE_LISTING_ID,
                price: priceKoinu,
                psdt: SAMPLE_PSDT,
              }}
              result={results.list || null}
              onExecute={() => handleSignIntent('list')}
              isExecuting={activeAction === 'list'}
            />

            <OperationExample
              title="Place Bid"
              description="Sign a spec bid envelope against an existing list inscription."
              intentType="bid"
              params={{
                listing_id: SAMPLE_LISTING_ID,
                price: priceKoinu,
                psdt: SAMPLE_PSDT,
              }}
              result={results.bid || null}
              onExecute={() => handleSignIntent('bid')}
              isExecuting={activeAction === 'bid'}
            />

            <OperationExample
              title="Settle Transaction"
              description="Sign a spec settle envelope. Chain truth is the PSDT fill + inscription move."
              intentType="settle"
              params={{
                listing_id: SAMPLE_LISTING_ID,
                bid_id: SAMPLE_BID_ID,
                psdt: SAMPLE_PSDT,
              }}
              result={results.settle || null}
              onExecute={() => handleSignIntent('settle')}
              isExecuting={activeAction === 'settle'}
            />

            <OperationExample
              title="Cancel Listing"
              description="Sign an intent to cancel an existing marketplace listing."
              intentType="cancel"
              params={{
                listing_id: SAMPLE_LISTING_ID,
              }}
              result={results.cancel || null}
              onExecute={() => handleSignIntent('cancel')}
              isExecuting={activeAction === 'cancel'}
            />
          </div>
        </div>
      )}

      {/* ── Integration Guide ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CodeBracketIcon className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <h2 className="text-xl font-semibold text-white">Integration Guide</h2>
        </div>

        <div className="prose prose-invert max-w-none">
          <h3 className="text-lg font-semibold text-white">For Marketplace Developers</h3>

          <div className="space-y-4">
            <div className="bg-black/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-emerald-400 mb-2">1. Sign ÐMP Intents</h4>
              <pre className="text-xs text-zinc-300 font-mono bg-black/50 p-3 rounded">
{`const signed = await signDMPIntent('list', {
  inscription_id: 'txid…i0',
  price_koinu: 4206900000,  // emitted as price string
  psdt: sellerSignedPsdtBase64,
});
// Inscribe JSON with p:"Ð:MP"  — spec: dogenals.org / github.com/jonheaven/dmp-spec`}
              </pre>
            </div>

            <div className="bg-black/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-emerald-400 mb-2">2. Verify Signatures Server-Side</h4>
              <pre className="text-xs text-zinc-300 font-mono bg-black/50 p-3 rounded">
{`// Canonicalize JSON (sort keys, no whitespace)
const canonicalJson = JSON.stringify(canonicalize(intent));

// Verify ECDSA signature against seller address
const isValid = verifySignature(canonicalJson, signature, seller);`}
              </pre>
            </div>

            <div className="bg-black/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-emerald-400 mb-2">3. Construct PSBT Transactions</h4>
              <pre className="text-xs text-zinc-300 font-mono bg-black/50 p-3 rounded">
{`// PSDT is the fill contract (SIGHASH_SINGLE|ANYONECANPAY).
// Buyer adds payment inputs and broadcasts via command.dog → Core.
const completed = await completeListingPsdt(signed.psdt, buyerUtxos);`}
              </pre>
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-950/20 border border-amber-700/30 rounded-lg">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-300">Security Notes</h4>
                <ul className="text-xs text-amber-200 mt-2 space-y-1">
                  <li>• Always validate addresses match the signing address</li>
                  <li>• The listed dog MUST stay in the seller UTXO until settle</li>
                  <li>• Verify PSDT hash when both psdt and psdt_hash are present</li>
                  <li>• Broadcast through command.dog → Core, never public-relay phantoms</li>
                  <li>• Store signed envelopes for dispute resolution</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Protocol Specification ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="w-6 h-6 text-blue-400 flex-shrink-0" />
          <h2 className="text-xl font-semibold text-white">Protocol Specification</h2>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Intent Structure</h3>
            <div className="bg-black/50 rounded-lg p-4">
              <pre className="text-xs text-zinc-300 font-mono">
{`{
  "p": "Ð:MP",
  "op": "list",
  "inscription_id": "<txid>i0",
  "price": "4206900000",
  "seller": "D...",
  "psdt": "cHNidP8…",
  "ts": 1700001000
}`}
              </pre>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">list</h4>
              <div className="text-xs text-zinc-300 space-y-1">
                <div><strong>inscription_id:</strong> listed dog</div>
                <div><strong>price:</strong> koinu decimal string</div>
                <div><strong>psdt:</strong> seller-signed fill template</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-2">bid</h4>
              <div className="text-xs text-zinc-300 space-y-1">
                <div><strong>listing_id:</strong> list inscription</div>
                <div><strong>price:</strong> bid koinu string</div>
                <div><strong>psdt:</strong> optional bid template</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-2">settle</h4>
              <div className="text-xs text-zinc-300 space-y-1">
                <div><strong>listing_id:</strong> list inscription</div>
                <div><strong>bid_id:</strong> optional bid inscription</div>
                <div><strong>psdt:</strong> completed fill</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-2">cancel</h4>
              <div className="text-xs text-zinc-300 space-y-1">
                <div><strong>listing_id:</strong> list to cancel</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}