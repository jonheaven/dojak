/** Canonical store / orbit links for the marketing site. */

export const LINKS = {
  chromeStore: 'https://chromewebstore.google.com/detail/dojak-wallet/dojak-wallet-id',
  firefox: '/download#firefox',
  brave: 'https://chromewebstore.google.com/detail/dojak-wallet/dojak-wallet-id',
  edge: 'https://chromewebstore.google.com/detail/dojak-wallet/dojak-wallet-id',
  webWallet: 'https://dojakweb-demo.vercel.app',
  android: 'https://play.google.com/store/apps',
  ios: '/download#ios',
  dogenals: 'https://dogenals.org',
  dogenalsCom: 'https://dogenals.com',
  drok: 'https://drok.lol',
  games: 'https://dogecoin.games',
  explorer: 'https://explorer.dogenals.com',
  githubSpec: 'https://github.com/jonheaven/dogenals',
  githubWallet: 'https://github.com/jonheaven/dojak',
  x: 'https://x.com/jontype',
  download: '/download',
  security: '/security',
  developers: '/developers',
  mobileWaitlist: '/download#mobile'
} as const;

export const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/download', label: 'Download' },
  { href: '/security', label: 'Security' },
  { href: '/developers', label: 'Developers' },
  { href: '/faq', label: 'FAQ' }
] as const;

export const PROTOCOL_TAGS = [
  'DOGE',
  'Doginals',
  'DRC-20',
  'Dunes',
  'Treats',
  'Charms',
  'Alkanes',
  'ÐMP',
  'Ð𝕏',
  'Ðignal',
  'window.dojak'
] as const;

export const HOME_FAQS = [
  {
    question: 'Is Dojak open source?',
    answer:
      'Dogenals standards at dogenals.org are open and MIT-licensed. Dojak wallet apps are proprietary products implementing those standards — polished UX on an open protocol layer.'
  },
  {
    question: 'Where do my keys live?',
    answer:
      'On your device. The extension vault is encrypted locally. Mobile pairing (when live) keeps signing on the phone. We never escrow seeds and cannot recover funds.'
  },
  {
    question: 'How is this safer for Doginals than a generic wallet?',
    answer:
      'Non-protocol-aware wallets can treat inscription carriers as ordinary coins and spend them by accident. Dojak tags protocol-linked UTXOs, excludes them from default coin selection, and requires explicit confirmation with clear warnings.'
  },
  {
    question: 'What can I hold and send?',
    answer:
      'DOGE, Doginals, DRC-20, Dunes, Treats, Charms, Alkanes — the Dogenals L1 stack in one vault. Tip on 𝕏 via Ð𝕏 when handles are linked.'
  },
  {
    question: 'What is window.dojak?',
    answer:
      'The browser provider injected by the extension. Detect isDojak, then requestAccounts, signPsbt, sendBitcoin, sendInscription, and more — Dogecoin-native for dApps.'
  },
  {
    question: 'Why genesis block 6,142,069?',
    answer:
      'That marks the Dogenals era activation context on Dogecoin L1. Dojak is built for that standards reboot — not bridge detours.'
  }
] as const;
