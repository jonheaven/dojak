import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dojak.app'),
  title: 'Dojak — The Dogecoin Wallet | Chrome Extension + Android + iOS',
  description:
    'Dojak is the modern self-custodial Dogecoin wallet with an identical 402 px experience across Chrome/Brave extension, Android, and iOS. Built from UniSat, open source, and made for shibes.',
  keywords: [
    'Dojak wallet',
    'Dogecoin wallet',
    'self-custodial wallet',
    'UniSat fork',
    'Chrome extension wallet',
    'DOGE wallet'
  ],
  openGraph: {
    title: 'Dojak — The Dogecoin Wallet | Chrome Extension + Android + iOS',
    description:
      'Your keys, your DOGE. Secure, open source, and consistent 402 px UX across browser extension + mobile.',
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
    title: 'Dojak — The Dogecoin Wallet That Just Works',
    description: 'Secure self-custodial DOGE wallet for Chrome/Brave, Android, and iOS.',
    images: ['/og-image.svg']
  },
  alternates: {
    canonical: 'https://dojak.app'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
