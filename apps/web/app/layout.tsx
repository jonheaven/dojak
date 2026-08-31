import type { Metadata, Viewport } from 'next';
import { Newsreader, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { HOME_FAQS } from '../lib/site';

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
  title: {
    default: 'Dojak — The Dogecoin Wallet',
    template: '%s · Dojak'
  },
  description:
    'Self-custodial Dogecoin wallet for Chrome, Brave, Edge, Android, and iOS. DOGE, Doginals, DRC-20, Dunes, Alkanes, Ð𝕏 tips, and window.dojak dApp connect — with protocol-aware UTXO protection.',
  keywords: [
    'Dojak wallet',
    'Dogecoin wallet',
    'Dogecoin extension',
    'Doginals wallet',
    'DRC-20 wallet',
    'Dunes wallet',
    'self-custodial Dogecoin',
    'Dogenals',
    'window.dojak',
    'DOGE Chrome extension',
    'best Dogecoin wallet'
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
    title: 'Dojak — The Dogecoin Wallet Done Right',
    description:
      'Add it. Own it. Browse free. Self-custodial extension & apps for DOGE, Doginals, DRC-20, and the Dogenals stack.',
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
    title: 'Dojak — The Dogecoin Wallet',
    description: 'Self-custodial Dogecoin + Dogenals wallet. Protocol-aware UTXO safety. Extension · mobile · web.',
    images: ['/brand/dojak.png'],
    creator: '@jontype'
  },
  alternates: {
    canonical: 'https://dojak.app'
  },
  category: 'finance'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Dojak',
    url: 'https://dojak.app',
    logo: 'https://dojak.app/icons/icon-256.png',
    sameAs: [
      'https://github.com/jonheaven/dogenals',
      'https://github.com/jonheaven/dojak',
      'https://x.com/jontype'
    ]
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Dojak Wallet',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Chrome, Brave, Edge, Android, iOS, Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    },
    url: 'https://dojak.app',
    downloadUrl: 'https://dojak.app/download',
    description:
      'Self-custodial Dogecoin wallet with protocol-aware UTXO protection for Doginals / Dogenals. Extension, mobile, and local web wallet.'
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
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
        <Script
          id="dojak-faq-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
