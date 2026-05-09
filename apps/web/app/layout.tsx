import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dojak.app'),
  title: 'Dojak — The Wallet Doge Deserves',
  description:
    'Dojak is a premium self-custodial Dogecoin wallet across extension, iOS, Android, and web wallet. Built on the open standards in ../dogenals/spec with first-party proprietary product UX.',
  keywords: [
    'Dojak wallet',
    'Dogecoin wallet',
    'Dogenals',
    'self-custodial wallet',
    'Dogecoin inscriptions',
    'web3 wallet',
    'DOGE wallet'
  ],
  openGraph: {
    title: 'Dojak — Dogenals. Powered by Dojak.',
    description:
      'The Dogecoin + Dogenals wallet for shibes: self-custodial, multi-platform, and built on open standards from ../dogenals/spec.',
    url: 'https://dojak.app',
    siteName: 'Dojak',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Dojak Dogecoin Wallet'
      }
    ],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Wallet Doge Deserves',
    description: 'Dogenals-native wallet UX for extension, mobile, and web wallet.',
    images: ['/og-image.svg']
  },
  alternates: {
    canonical: 'https://dojak.app'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Dojak',
    url: 'https://dojak.app',
    logo: 'https://dojak.app/og-image.svg',
    sameAs: ['https://github.com/jonheaven/dogenals', 'https://x.com/jontype']
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Dojak Wallet',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web, Android, iOS, Browser Extension',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    },
    url: 'https://dojak.app',
    description:
      'Self-custodial Dogecoin wallet product built on open Dogenals standards with extension, mobile, and web wallet experiences.'
  };

  return (
    <html lang="en" className="scroll-smooth">
      <body>
        <Script
          id="dojak-org-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <Script
          id="dojak-software-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
