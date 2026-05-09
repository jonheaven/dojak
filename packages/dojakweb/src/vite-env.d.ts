/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** HTTPS RPC endpoint for DogeOS (EVM) */
  readonly VITE_DOGEOS_RPC?: string;
  /** Numeric chain id for DogeOS */
  readonly VITE_DOGEOS_CHAIN_ID?: string;
  /** Inscription id (e.g. txid + i0) of the shared Doge𝕏 Check image — required for HTML wallet-card inscriptions. */
  readonly VITE_DX_BADGE_INSCRIPTION_ID?: string;
  /** Base URL for recursive image fetch (no trailing slash). Default https://api.mydoge.com */
  readonly VITE_DX_CONTENT_API_BASE?: string;
  /** command.dog/api origin for Ð𝕏 orchestration (`/v1/dx/*`). No trailing slash. */
  readonly VITE_COMMAND_DOG_API_URL?: string;
  /**
   * Optional full Charms API base (e.g. `https://api.command.dog/v1/charms`). If unset, Charms uses
   * `VITE_COMMAND_DOG_API_URL` + `/v1/charms` (same host as the rest of command.dog).
   */
  readonly VITE_CHARMS_API_BASE_URL?: string;
  /** Same value as server `INSCRIBE_JOBS_API_KEY` — enables `/v1/inscribe-jobs` from the inscribe page. */
  readonly VITE_INSCRIBE_JOBS_API_KEY?: string;
  /** InuBits API base (absolute URL or path like `/__inubits`). See `getInubitsWalletInscriptionsBase` in utils/api.ts. */
  readonly VITE_INUBITS_API_BASE?: string;
  /** Companion wallet backend base for axios (`src/utils/api.ts`). */
  readonly VITE_WALLET_DATA_API_BASE_URL?: string;
  /** Dogex HTTP origin for `dogex_json_rpc` when embedded (see rpc-proxy-client.ts). */
  readonly VITE_DOGEX_HTTP_BASE?: string;
  /** When `"true"`, enables live-activity / Sentinel connector (App.tsx). */
  readonly VITE_ENABLE_LIVE_ACTIVITY?: string;
  /** Production: set to `"false"` to disable obfuscation (blocked in protected CI builds). */
  readonly VITE_OBFUSCATE?: string;
  /** Build-time (vite.config): `1` / `true` = aggressive two-pass obfuscation (slow; use for major production releases). */
  readonly VITE_OBFUSCATE_FULL?: string;
  /** Production hardening: set to `"false"` to disable anti-debug checks. */
  readonly VITE_ANTI_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
