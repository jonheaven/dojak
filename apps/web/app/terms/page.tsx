import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteShell } from '../../components/SiteShell';
import { PageHeader } from '../../components/site-ui';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for Dojak Wallet, a non-custodial Dogecoin Chrome extension. You control your keys. Transactions are irreversible.',
  alternates: { canonical: 'https://dojak.app/terms' }
};

const updated = 'August 28, 2026';

export default function TermsPage() {
  return (
    <SiteShell>
      <div className="relative mx-auto max-w-3xl px-4 py-14">
        <PageHeader
          eyebrow="Legal"
          title="Terms of Service"
          description={
            <>
              By installing or using Dojak Wallet you agree to these terms. Last updated {updated}. If you do not agree,
              do not use the wallet.
            </>
          }
        />

        <article className="site-card mt-6 space-y-8 p-6 text-sm leading-6 text-zinc-600 md:p-8">
          <section>
            <h2 className="text-lg font-bold text-zinc-950">1. What Dojak is</h2>
            <p className="mt-2">
              Dojak Wallet is a non-custodial software wallet for Dogecoin and related L1 assets (including Doginals,
              DRC-20, Dunes, and related Dogenals protocols). You hold the keys. We are not a bank, exchange, custodian,
              or broker.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">2. Your responsibilities</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Keep your seed phrase and private keys secret. We will never ask for them.</li>
              <li>Verify addresses, fees, and dApp prompts before you approve.</li>
              <li>Maintain device security. Anyone with your unlocked browser can use the vault.</li>
              <li>You are solely responsible for transactions you sign.</li>
              <li>You must be at least 18 years old.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">3. Irreversible chain activity</h2>
            <p className="mt-2">
              Dogecoin transactions cannot be undone. Lost seeds cannot be recovered. Protocol-aware spend guards reduce
              accidental inscription burns; they do not eliminate user error, malware, or phishing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">4. Third-party networks</h2>
            <p className="mt-2">
              The wallet talks to indexers, broadcast APIs, explorers, and sites you choose to connect. Their uptime,
              accuracy, and policies are not under our control.{' '}
              <Link className="site-link" href="/privacy">
                Privacy Policy
              </Link>{' '}
              lists typical endpoints.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">5. Prohibited use</h2>
            <p className="mt-2">
              Do not use Dojak to violate law, steal, defraud, or infringe others’ rights. We may refuse support for
              abuse of the software.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">6. No warranty</h2>
            <p className="mt-2">
              Software is provided “as is” without warranties of any kind, including uninterrupted or error-free
              operation. Open standards at dogenals.org are independent of this product.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">7. Limitation of liability</h2>
            <p className="mt-2">
              To the maximum extent allowed by law, the Dojak team is not liable for lost funds, missed transactions,
              indexer errors, dApp bugs, or device compromise arising from use of the wallet.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">8. Changes</h2>
            <p className="mt-2">
              We may update these terms. The date above will change. Continued use is acceptance. Live copy:{' '}
              <a className="site-link" href="https://dojak.app/terms">
                dojak.app/terms
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">9. Contact</h2>
            <p className="mt-2">
              <a className="site-link" href="https://github.com/jonheaven/dojak/issues">
                GitHub issues
              </a>{' '}
              ·{' '}
              <Link className="site-link" href="/faq">
                FAQ
              </Link>
            </p>
          </section>
        </article>
      </div>
    </SiteShell>
  );
}
