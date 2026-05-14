/** Primary relay — most reliable for arbitrary event kinds */
export const NOSTR_RELAY_URL = 'wss://relay.primal.net';

/**
 * All known relays, including the primary.
 * fetchNostrListings fans out to ALL of these simultaneously.
 */
export const NOSTR_ALL_RELAYS = [
  'wss://relay.command.dog',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.damus.io',
  'wss://relay.snort.social',
];

/** Kept for backwards compat — same list minus primary */
export const NOSTR_BACKUP_RELAYS = NOSTR_ALL_RELAYS.filter(r => r !== NOSTR_RELAY_URL);

export const NOSTR_ORDER_KIND  = 802;
export const NOSTR_CANCEL_KIND = 803; // New: for cancelling listings
export const DOGE_NETWORK_NAME = 'dogecoin-mainnet';
export const EXCHANGE_NAME     = 'wzrd.dog';
