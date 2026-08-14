/** ÐogeTreats wire marker — see dogenals/spec/protocols/treats */
export const TREATS_PROTOCOL_ID = 'dt';

/** Paired dust output for deploy / mint / transfer (0.01 DOGE). */
export const TREATS_DUST_KOINU = 1_000_000;

/** Full OP_RETURN script cap — Dogecoin Core `MAX_OP_RETURN_RELAY`. */
export const TREATS_MAX_OPRETURN_SCRIPT_BYTES = 83;

export const TREATS_TICKER_MIN = 1;
export const TREATS_TICKER_MAX = 8;

export type TreatsOpKind = 'deploy' | 'mint' | 'transfer' | 'burn';

/** Soft cap per Treats airdrop tx (paired OP_RETURN + 0.01 dust). Size packer may use fewer. */
export const TREATS_AIRDROP_MAX_PER_TX = 250;

/** Leave headroom under Dogecoin's ~100kb standard tx. */
export const TREATS_AIRDROP_MAX_TX_VBYTES = 90_000;
