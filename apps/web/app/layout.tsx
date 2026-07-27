import type { Metadata, Viewport } from 'next';
import { Newsreader, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const sans = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-dojak-sans',
  display: 'swap'
});

const display = Newsreader({
  subsets: ['latin'],
  variable: '--font-dojak-serif',
  style: ['normal', 'italic'],
  display: 'swap'
});

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1
};

export const metadata: Metadata = {
  metadataBase: new URL('https://dojak.app'),
  title: 'Dojak — Add it. Own it. Browse free.',
  description:
    'Self-custodial Dogecoin + Dogenals wallet. Install the extension, keep keys on-device, approve every send. Protocol-aware UTXO protection for Doginals. Built on open standards at dogenals.org.',
  keywords: [
    'Dojak wallet',
    'Dogecoin wallet',
    'Dogenals',
    'Doginals wallet',
    'self-custodial wallet',
    'DRC-20',
    'window.dojak',
    'DOGE wallet'
  ],
  icons: {
    icon: [
      { url: '/icons/favicon.ico' },
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-48.png', sizes: '48x48', type: 'image/png' }
    ],
    apple: [{ url: '/icons/icon-256.png', sizes: '256x256' }]
  },
  openGraph: {
    title: 'Dojak — The Wallet Doge Deserves',
    description:
      'Add it. Own it. Browse free. Protocol-aware Dogecoin wallet for Doginals — keys stay with you.',
    url: 'https://dojak.app',
    siteName: 'Dojak',
    images: [
      {
        url: '/brand/dojak.png',
        width: 1200,
        height: 1200,
        alt: 'Dojak Dogecoin Wallet'
      }
    ],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Add it. Own it. Browse free. — Dojak',
    description: 'Self-custodial Dogecoin + Dogenals wallet. Protocol-aware UTXO safety.',
    images: ['/brand/dojak.png']
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
    logo: 'https://dojak.app/icons/icon-256.png',
    sameAs: ['https://github.com/jonheaven/dogenals', 'https://github.com/jonheaven/dojak', 'https://x.com/jontype']
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
      'Self-custodial Dogecoin wallet with protocol-aware UTXO protection for Doginals / Dogenals. Extension, mobile, and local web wallet.'
  };

  return (
    <html lang="en" className={`scroll-smooth ${sans.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
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
