/**
 * Doge Soft browser extension — `window.dogesoft`.
 *
 * Docs: https://docs.dogesoft.io/wallet/quickstart/
 * Pairing (phone signs, extension relays): https://docs.dogesoft.io/extension/pairing/
 *
 * The extension never holds a key. After a one-time QR pair, every
 * connect/sign/send is relay-polled to the phone (≈60s request timeout).
 */

export type DogeSoftSignPsbtOptions = {
  finalize?: boolean;
  feeRate?: number;
};

export type DogeSoftSendDogeParams = {
  to: string;
  amount: number;
  feeRate?: number;
  protocol?: string;
};

export type DogeSoftProvider = {
  version?: string;
  network?: string;
  connect?: () => Promise<{ accounts?: string[]; address?: string } | string[]>;
  disconnect?: () => Promise<void>;
  isConnected?: () => Promise<boolean> | boolean;
  getAccounts?: () => Promise<string[]>;
  getAddress?: () => Promise<string>;
  getPublicKey?: () => Promise<string>;
  getBalance?: () => Promise<number | { balance?: number | string; confirmed?: number; total?: number }>;
  signMessage?: (message: string, address?: string) => Promise<string | { signature?: string }>;
  signPsbt?: (
    psbt: string,
    options?: DogeSoftSignPsbtOptions,
  ) => Promise<string | { hex?: string; signedPsbt?: string; txid?: string }>;
  pushPsbt?: (hex: string) => Promise<{ txid?: string } | string>;
  sendDoge?: (params: DogeSoftSendDogeParams) => Promise<{ txid?: string; txId?: string } | string>;
  sendDrc20?: (params: { tick: string; amount: string; to: string }) => Promise<unknown>;
  sendInscription?: (params: {
    inscriptionId: string;
    to: string;
  }) => Promise<{ txid?: string; txId?: string } | string>;
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  off?: (event: string, handler: (...args: any[]) => void) => void;
};

export const getInjectedDogeSoftProvider = (): DogeSoftProvider | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const candidate = (window as Window & { dogesoft?: DogeSoftProvider }).dogesoft;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  return candidate;
};

/** Sync check plus `dogesoft#initialized` for scripts that race injection. */
export function waitForDogeSoftProvider(timeoutMs = 4000): Promise<DogeSoftProvider | null> {
  const existing = getInjectedDogeSoftProvider();
  if (existing) {
    return Promise.resolve(existing);
  }
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (provider: DogeSoftProvider | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('dogesoft#initialized', onInit);
      resolve(provider);
    };
    const onInit = () => finish(getInjectedDogeSoftProvider());
    const timer = window.setTimeout(() => finish(getInjectedDogeSoftProvider()), timeoutMs);
    window.addEventListener('dogesoft#initialized', onInit, { once: true });
  });
}

export function pickDogeSoftSignedPayload(response: unknown): string {
  if (typeof response === 'string' && response.trim()) {
    return response.trim();
  }
  if (!response || typeof response !== 'object') {
    throw new Error('Doge Soft signing returned an empty response');
  }
  const r = response as Record<string, unknown>;
  const out = r.hex ?? r.signedPsbt ?? r.signedTx ?? r.signedRawTx ?? r.txHex ?? r.signature;
  if (typeof out !== 'string' || !out.trim()) {
    throw new Error('Doge Soft signing returned no signed transaction or PSBT');
  }
  return out.trim();
}

export function pickDogeSoftTxid(response: unknown): string {
  if (typeof response === 'string' && response.trim()) {
    return response.trim();
  }
  if (!response || typeof response !== 'object') {
    throw new Error('Doge Soft send returned no txid');
  }
  const r = response as Record<string, unknown>;
  const out = r.txid ?? r.txId ?? r.hash;
  if (typeof out !== 'string' || !out.trim()) {
    throw new Error('Doge Soft send returned no txid');
  }
  return out.trim();
}

export function normalizeDogeSoftBalance(balanceLike: unknown): number {
  if (typeof balanceLike === 'number' && Number.isFinite(balanceLike)) {
    return balanceLike > 1_000_000 ? balanceLike / 100_000_000 : balanceLike;
  }
  if (!balanceLike || typeof balanceLike !== 'object') {
    return 0;
  }
  const raw = Number(
    (balanceLike as { total?: unknown; confirmed?: unknown; balance?: unknown }).total ??
      (balanceLike as { confirmed?: unknown }).confirmed ??
      (balanceLike as { balance?: unknown }).balance ??
      0,
  );
  if (!Number.isFinite(raw)) {
    return 0;
  }
  return raw > 1_000_000 ? raw / 100_000_000 : raw;
}

export function pickDogeSoftSignature(response: unknown): string {
  if (typeof response === 'string' && response.trim()) {
    return response.trim();
  }
  if (!response || typeof response !== 'object') {
    throw new Error('Doge Soft returned an empty signature');
  }
  const r = response as Record<string, unknown>;
  const out = r.signature ?? r.signedMessage ?? r.result;
  if (typeof out !== 'string' || !out.trim()) {
    throw new Error('Doge Soft returned no signature');
  }
  return out.trim();
}

export async function dogeSoftRequest(
  provider: DogeSoftProvider,
  method: string,
  params?: unknown,
): Promise<unknown> {
  if (typeof provider.request !== 'function') {
    throw new Error(`Doge Soft provider does not expose method: ${method}`);
  }
  return provider.request({ method, params });
}
