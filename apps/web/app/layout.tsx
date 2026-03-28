import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dojak.app'),
  title: 'Dojak — The Dogecoin Wallet | Chrome Extension + Android + iOS',
  description:
    'Dojak is a secure, self-custodial Dogecoin wallet with identical 402 px experience across Chrome/Brave extension, Android, and iOS.',
  openGraph: {
    title: 'Dojak — The Dogecoin Wallet | Chrome Extension + Android + iOS',
    description:
      'Your keys, your DOGE. Open source UniSat fork with lightning-fast, cross-platform wallet UX.',
    url: 'https://dojak.app',
    siteName: 'Dojak',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dojak — The Dogecoin Wallet That Just Works',
    description: 'Self-custodial DOGE wallet for Chrome/Brave, Android, and iOS.'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
