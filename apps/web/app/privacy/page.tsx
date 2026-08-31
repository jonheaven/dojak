import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteShell } from '../../components/SiteShell';
import { PageHeader } from '../../components/site-ui';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Dojak Wallet privacy policy: non-custodial Dogecoin wallet. Keys stay on your device. What data is handled locally, what third-party APIs see, and how content scripts work.',
  alternates: { canonical: 'https://dojak.app/privacy' }
};

const updated = 'August 28, 2026';

export default function PrivacyPage() {
  return (
    <SiteShell>
      <div className="relative mx-auto max-w-3xl px-4 py-14">
        <PageHeader
          eyebrow="Legal"
          title="Privacy Policy"
          description={
            <>
              Dojak Wallet is a non-custodial Chrome extension. Keys never leave your device. Last updated {updated}.
            </>
          }
        />

        <article className="site-card mt-6 space-y-8 p-6 text-sm leading-6 text-zinc-600 md:p-8">
          <section>
            <h2 className="text-lg font-bold text-zinc-950">1. Who we are</h2>
            <p className="mt-2">
              Dojak Wallet (“Dojak”, “we”) is a self-custodial Dogecoin wallet. This policy covers the browser
              extension and the marketing site at{' '}
              <a className="site-link" href="https://dojak.app">
                dojak.app
              </a>
              . Product issues:{' '}
              <a className="site-link" href="https://github.com/jonheaven/dojak">
                github.com/jonheaven/dojak
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">2. Non-custodial — what we never see</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Seed phrases, private keys, and WIFs are encrypted in Chrome extension storage on your device.</li>
              <li>We cannot access, freeze, export, or recover your funds.</li>
              <li>We do not run user accounts, KYC, or a custodial balance.</li>
              <li>Uninstalling the extension deletes local vault data. Back up your seed first — that cannot be undone.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">3. What is stored locally</h2>
            <p className="mt-2">
              Encrypted wallet material, account labels, connected-site approvals, preferences, and UI settings stay in
              the browser via the <code className="site-code">storage</code> permission. That data is not uploaded to
              Dojak servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">4. Website access (content scripts)</h2>
            <p className="mt-2">
              To connect Dogecoin dApps, the extension injects a page provider (<code className="site-code">window.dojak</code>
              ) on sites you visit. On x.com / twitter.com it also adds Ð𝕏 tip and profile-link controls. This is the
              same pattern as other browser wallets.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>We do not sell browsing history or scrape sites for advertising.</li>
              <li>Page context is used only to offer Connect / tip UI and to show approval prompts you trigger.</li>
              <li>
                Handle lookups and broadcasts happen only when you act (tip, link, send, connect) and go to the APIs
                listed below — not to a Dojak analytics pipeline.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">5. Network requests (third parties)</h2>
            <p className="mt-2">
              Using the wallet sends your IP address and the Dogecoin addresses you query to infrastructure that returns
              balances, inscriptions, and broadcasts transactions. Typical endpoints:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-zinc-800">indexer.command.dog / dogex.command.dog</strong> — balances, Doginals,
                DRC-20, Dunes, and related index data
              </li>
              <li>
                <strong className="text-zinc-800">api.command.dog</strong> — Ð𝕏 resolve/verify and transaction broadcast
                to Dogecoin Core
              </li>
              <li>
                <strong className="text-zinc-800">explorer.dogenals.com</strong> — optional transaction links you open
              </li>
              <li>
                <strong className="text-zinc-800">Dogecoin L1</strong> — confirmed transactions are public forever
              </li>
            </ul>
            <p className="mt-2">
              Those operators may log IPs and queried addresses under their own policies. Dojak does not receive a copy
              of your seed from these calls.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">6. What we do not collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>No names, emails, or government IDs for a Dojak account (there is no Dojak account).</li>
              <li>No analytics, crash telemetry, or advertising SDKs in the extension.</li>
              <li>No sale of personal information. No credit scoring.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">7. Children</h2>
            <p className="mt-2">
              Dojak Wallet is not intended for anyone under 18. We do not knowingly collect information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">8. Changes</h2>
            <p className="mt-2">
              We may update this policy. The date above will change. Continued use after an update means you accept the
              new policy. The live copy is always at{' '}
              <a className="site-link" href="https://dojak.app/privacy">
                dojak.app/privacy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-950">9. Contact</h2>
            <p className="mt-2">
              Privacy questions:{' '}
              <a className="site-link" href="https://github.com/jonheaven/dojak/issues">
                GitHub issues
              </a>{' '}
              or the{' '}
              <Link className="site-link" href="/faq">
                FAQ
              </Link>
              .
            </p>
          </section>
        </article>
      </div>
    </SiteShell>
  );
}
