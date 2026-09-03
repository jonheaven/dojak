/**
 * Canonical Dogenals protocol table for the wallet.
 * Markers MUST match dogenals/spec (studio copy: ../dogenals/spec).
 *
 * Wallet job = encode/sign/display. Indexing stays in dogex.
 */

export type DogenalsWalletRole =
  | 'encode'
  | 'display'
  | 'sign'
  | 'legacy'
  | 'labs'
  | 'deferred';

export type DogenalsProtocolEntry = {
  id: string;
  name: string;
  /** Inscription JSON `"p"` and/or OP_RETURN magic. */
  marker: string;
  spec: string;
  role: DogenalsWalletRole;
  notes: string;
};

export const DOGENALS_PROTOCOLS: readonly DogenalsProtocolEntry[] = [
  {
    id: 'dunes',
    name: 'Ðunes',
    marker: '0xD0',
    spec: 'protocols/dunes/spec.md',
    role: 'encode',
    notes: 'Hero fungible. Wallet: dunestone.ts (0xD0 v2/v3 etch, mint, edicts).',
  },
  {
    id: 'treats',
    name: 'ÐogeTreats',
    marker: 'dt',
    spec: 'protocols/treats/spec.md',
    role: 'encode',
    notes: 'OP_RETURN companion. Wallet: treats/buildJson.ts p:"dt".',
  },
  {
    id: 'dmp',
    name: 'ÐMP',
    marker: 'Ð:MP',
    spec: 'protocols/dmp/spec.md',
    role: 'encode',
    notes:
      'Marketplace intents. Durable envelopes p:"Ð:MP". Write budget: psdt_hash / off-band PSDT when fat; DogeTag for chatty bids; sale tx is money truth. PSDT fill is the contract.',
  },
  {
    id: 'dsocial',
    name: 'Ðocial',
    marker: 'Ð:SOC',
    spec: 'protocols/dsocial/spec.md',
    role: 'encode',
    notes: 'Public social OS. 30-byte binary OP_RETURN + inscription JSON.',
  },
  {
    id: 'dignal',
    name: 'Ðignal',
    marker: 'Ð:DIG',
    spec: 'protocols/dignal/spec.md',
    role: 'encode',
    notes: 'Encrypted DMs. 50-byte binary OP_RETURN + p:"Ð:DIG" ciphertext JSON.',
  },
  {
    id: 'dlotto',
    name: 'ÐLotto',
    marker: 'Ð:LOTTO',
    spec: 'protocols/dlotto/spec.md',
    role: 'display',
    notes: 'Detect/hold tickets. Mint/draw/burn UX lives on dogecoin.games.',
  },
  {
    id: 'dxd',
    name: 'ÐSwap Core / DXD',
    marker: 'dxd',
    spec: 'protocols/dswap/CORE_LITE.md',
    role: 'sign',
    notes: 'Storefront pools/swaps. Wallet signs/broadcasts; dogex is chain truth.',
  },
  {
    id: 'dotc',
    name: 'DOTC',
    marker: 'dotc',
    spec: 'protocols/dotc/spec.md',
    role: 'encode',
    notes: 'OTC receipt OP_RETURN. Wallet: lib/dotc.ts.',
  },
  {
    id: 'dx',
    name: 'Ð𝕏',
    marker: 'DX',
    spec: 'protocols/dx/spec.md',
    role: 'encode',
    notes: 'Compact OP_RETURN DX register/revoke + pay-by-handle.',
  },
  {
    id: 'dns',
    name: 'DNS',
    marker: 'dns',
    spec: 'protocols/dns/spec.md',
    role: 'encode',
    notes: '.doge names as inscriptions. Wallet: dnsPublish.ts.',
  },
  {
    id: 'dn05',
    name: 'ÐN05',
    marker: 'Ð:N05',
    spec: 'protocols/dn05/spec.md',
    role: 'encode',
    notes: 'NIP-05 names. Wallet: dn05.ts compact N05 OP_RETURN.',
  },
  {
    id: 'dpfp',
    name: 'ÐPFP / ÐPFA',
    marker: 'Ð:PFP',
    spec: 'protocols/dpfp/spec.md',
    role: 'encode',
    notes: 'Profile image/audio binds. Wallet: dpfpPublish.ts.',
  },
  {
    id: 'dclaims',
    name: 'Ðclaims',
    marker: 'dclaims',
    spec: 'dclaims.md',
    role: 'encode',
    notes: 'Fractional claims. Wallet: lib/dclaims.',
  },
  {
    id: 'wow',
    name: 'Ð:WOW',
    marker: 'Ð:WOW',
    spec: 'protocols/wow/spec.md',
    role: 'encode',
    notes: 'Guestbook JSON. Product UI is wow-signal; wallet can inscribe envelopes.',
  },
  {
    id: 'dlocker',
    name: 'ÐLocker',
    marker: 'CLTV',
    spec: 'docs/DLOCKER.md',
    role: 'encode',
    notes: 'BIP65 CLTV product (not ÐLock metaprotocol). Wallet: cltv-tools.ts.',
  },
  {
    id: 'incinerator',
    name: 'BurneÐ',
    marker: 'ÐI',
    spec: 'docs/INCINERATOR.md',
    role: 'encode',
    notes: 'Valued OP_RETURN carrier burn. Wallet: incinerator-tools.ts.',
  },
  {
    id: 'dlaunch',
    name: 'ÐLaunch',
    marker: '0xD0/0x03',
    spec: 'protocols/dlaunch/spec.md',
    role: 'encode',
    notes: 'Native Ðunes curve tags in dunestone + duneLaunchService.',
  },
  {
    id: 'charms',
    name: 'Charms',
    marker: 'charm',
    spec: 'protocols/charms/spec.md',
    role: 'labs',
    notes: 'Optional ZK UTXOs. Wallet: charms/.',
  },
  {
    id: 'alkanes',
    name: 'Ðalkanes',
    marker: '0xD1',
    spec: 'protocols/alkanes/spec.md',
    role: 'labs',
    notes: 'WASM contracts. Wallet: alkanes/.',
  },
  {
    id: 'dwatch',
    name: 'ÐWatch',
    marker: 'Ð:WATCH',
    spec: 'protocols/dwatch/spec.md',
    role: 'labs',
    notes: 'USB diagnostics in wallet; PoP UX is hardware + dogecoin.games.',
  },
  {
    id: 'dogetokens',
    name: 'DRC-20 (legacy)',
    marker: 'drc-20',
    spec: 'protocols/dogetokens/spec.md',
    role: 'legacy',
    notes: 'Read-only balances. No new deploys. Migrate to Ðunes.',
  },
  {
    id: 'damm',
    name: 'ÐAMM',
    marker: 'Ð:AMM',
    spec: 'protocols/damm/spec.md',
    role: 'deferred',
    notes: 'Phase 2 concentrated liquidity. Do not surface as production.',
  },
  {
    id: 'dlend',
    name: 'ÐLend',
    marker: 'Ð:LEND',
    spec: 'protocols/dlend/spec.md',
    role: 'deferred',
    notes: 'Phase 2 lending. Do not surface as production.',
  },
] as const;

export const DOGENALS_INSCRIPTION_MARKERS = [
  'Ð:SOC',
  'Ð:DIG',
  'Ð:MP',
  'Ð:LOTTO',
  'Ð:WOW',
  'Ð:N05',
  'Ð:PFP',
  'Ð:PFA',
  'dns',
  'dt',
  'drc-20',
] as const;

export function findDogenalsProtocol(markerOrId: string): DogenalsProtocolEntry | undefined {
  const key = markerOrId.trim();
  return DOGENALS_PROTOCOLS.find(
    (p) => p.id === key || p.marker === key || p.name === key || p.marker.toLowerCase() === key.toLowerCase(),
  );
}

export function isLegacyDrc20Marker(p: string | undefined | null): boolean {
  return (p || '').trim().toLowerCase() === 'drc-20';
}
