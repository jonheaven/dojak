/**
 * Ð𝕏 background controller — resolve handles, verify tweets, open the popup.
 * Content scripts never talk to dogex/command.dog directly (CORS + key hygiene).
 */

import {
  COMMAND_DOG_API,
  DOGEX_API,
  DX_CACHE_STALE_MS,
  DX_CACHE_TTL_MS,
  DX_LOOKUP_TIMEOUT_MS,
  DX_MESSAGE,
  DX_PENDING_CHANGED,
  DX_PENDING_STORAGE_KEY,
  dxHandleKey,
  tryParsePayHandle,
  type DxLookupResult,
  type DxPendingAction,
  type DxRegistration,
  type DxVerifyTweetResult
} from '@dojak/core/dx';
import { preferenceService } from '@dojak/core/background/service';

const X_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);

type CacheHit = { at: number; result: DxLookupResult };

const handleCache = new Map<string, CacheHit>();
const addressCache = new Map<string, CacheHit>();
const inflight = new Map<string, Promise<DxLookupResult>>();

function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id && sender.id !== chrome.runtime.id) return false;
  const url = sender.url || sender.tab?.url || '';
  if (!url) return false;
  try {
    if (url.startsWith(chrome.runtime.getURL(''))) return true;
    const host = new URL(url).hostname.toLowerCase();
    return X_HOSTS.has(host);
  } catch {
    return false;
  }
}

function abortMs(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { error: text.slice(0, 180) || `HTTP ${res.status}` };
  }
}

function registrationFromBody(j: Record<string, unknown>, fallbackHandle: string): DxRegistration | null {
  const linked = j.linked === true;
  const nested = (j.registration && typeof j.registration === 'object' ? j.registration : null) as Record<
    string,
    unknown
  > | null;
  const addr =
    (typeof j.dogeAddress === 'string' && j.dogeAddress) ||
    (typeof nested?.dogeAddress === 'string' && nested.dogeAddress) ||
    '';
  if (!linked || !addr.trim()) return null;
  const handleRaw =
    (typeof j.handle === 'string' && j.handle) ||
    (typeof nested?.xHandle === 'string' && nested.xHandle) ||
    fallbackHandle;
  return {
    xHandle: handleRaw.startsWith('@') ? handleRaw : `@${handleRaw.replace(/^@/, '')}`,
    dogeAddress: addr.trim(),
    txid: (typeof j.txid === 'string' ? j.txid : (nested?.txid as string)) || null,
    tweetId: (typeof j.tweetId === 'string' ? j.tweetId : (nested?.tweetId as string)) || null,
    tweetVerified:
      typeof j.tweetVerified === 'boolean'
        ? j.tweetVerified
        : typeof nested?.tweetVerified === 'boolean'
          ? nested.tweetVerified
          : null,
    tweetUrl: typeof j.tweetUrl === 'string' ? j.tweetUrl : null,
    height: typeof nested?.height === 'number' ? nested.height : undefined,
    source: typeof j.source === 'string' ? j.source : 'dogex',
    linked: true
  };
}

function toLookup(handle: string, j: Record<string, unknown>, stale = false): DxLookupResult {
  const registration = registrationFromBody(j, handle);
  const kind: DxLookupResult['kind'] = registration ? 'linked' : 'unlinked';
  const inner = dxHandleKey(handle);
  return {
    kind,
    handle: registration?.xHandle || handle,
    registration,
    dogeAddress: registration?.dogeAddress || (typeof j.dogeAddress === 'string' ? j.dogeAddress : null),
    payUri: typeof j.payUri === 'string' ? j.payUri : registration ? `dogecoin:${registration.dogeAddress}` : null,
    avatarUrl: `${COMMAND_DOG_API}/v1/dx/avatar/${encodeURIComponent(inner)}`,
    explorerTx: typeof j.explorerTx === 'string' ? j.explorerTx : null,
    stale
  };
}

async function fetchResolve(handle: string): Promise<DxLookupResult> {
  const inner = dxHandleKey(handle);
  const cmdUrl = `${COMMAND_DOG_API}/v1/dx/resolve/${encodeURIComponent(inner)}`;
  try {
    const res = await fetch(cmdUrl, {
      headers: { Accept: 'application/json' },
      signal: abortMs(DX_LOOKUP_TIMEOUT_MS)
    });
    if (res.ok) {
      const j = await parseJson(res);
      if (j.ok === false && j.linked !== true && j.linked !== false) {
        throw new Error(typeof j.error === 'string' ? j.error : `HTTP ${res.status}`);
      }
      return toLookup(handle, j);
    }
    if (res.status === 400) {
      return { kind: 'unlinked', handle, registration: null, error: 'Invalid handle' };
    }
    if (res.status !== 502 && res.status !== 503 && res.status !== 504 && res.status !== 530) {
      const j = await parseJson(res);
      if (j.linked === false) return toLookup(handle, j);
    }
  } catch {
    /* fall through to dogex */
  }

  const dxUrl = `${DOGEX_API}/api/dx/handle/${encodeURIComponent(inner)}`;
  try {
    const res = await fetch(dxUrl, {
      headers: { Accept: 'application/json' },
      signal: abortMs(DX_LOOKUP_TIMEOUT_MS)
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`HTTP ${res.status}`);
    }
    const j = res.ok ? await parseJson(res) : { linked: false };
    return toLookup(handle, j);
  } catch (e) {
    const cached = handleCache.get(inner);
    if (cached && Date.now() - cached.at < DX_CACHE_STALE_MS) {
      return { ...cached.result, stale: true };
    }
    return {
      kind: 'unreachable',
      handle,
      registration: null,
      error: e instanceof Error ? e.message : 'Can’t reach indexer'
    };
  }
}

async function lookupHandle(raw: string): Promise<DxLookupResult> {
  const parsed = tryParsePayHandle(raw);
  if (!parsed) {
    return { kind: 'unlinked', handle: raw, registration: null, error: 'Invalid handle' };
  }
  const key = dxHandleKey(parsed);
  const cached = handleCache.get(key);
  if (cached && Date.now() - cached.at < DX_CACHE_TTL_MS) return cached.result;

  const pending = inflight.get(key);
  if (pending) return pending;

  const job = fetchResolve(parsed)
    .then((result) => {
      if (result.kind !== 'unreachable') {
        handleCache.set(key, { at: Date.now(), result });
      }
      inflight.delete(key);
      return result;
    })
    .catch((e) => {
      inflight.delete(key);
      const stale = handleCache.get(key);
      if (stale && Date.now() - stale.at < DX_CACHE_STALE_MS) return { ...stale.result, stale: true };
      return {
        kind: 'unreachable' as const,
        handle: parsed,
        registration: null,
        error: e instanceof Error ? e.message : 'Can’t reach indexer'
      };
    });
  inflight.set(key, job);
  return job;
}

async function lookupAddress(address: string): Promise<DxLookupResult> {
  const a = address.trim();
  if (!a) return { kind: 'unlinked', handle: '', registration: null };
  const key = a.toLowerCase();
  const cached = addressCache.get(key);
  if (cached && Date.now() - cached.at < DX_CACHE_TTL_MS) return cached.result;
  try {
    const res = await fetch(`${DOGEX_API}/api/dx/address/${encodeURIComponent(a)}`, {
      headers: { Accept: 'application/json' },
      signal: abortMs(DX_LOOKUP_TIMEOUT_MS)
    });
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    const j = res.ok ? await parseJson(res) : { linked: false };
    const result = toLookup('', j);
    addressCache.set(key, { at: Date.now(), result });
    return result;
  } catch (e) {
    const stale = addressCache.get(key);
    if (stale && Date.now() - stale.at < DX_CACHE_STALE_MS) return { ...stale.result, stale: true };
    return {
      kind: 'unreachable',
      handle: '',
      registration: null,
      error: e instanceof Error ? e.message : 'Can’t reach indexer'
    };
  }
}

async function verifyTweet(params: {
  tweetUrl: string;
  xHandle: string;
  dogeAddress: string;
}): Promise<DxVerifyTweetResult> {
  try {
    const res = await fetch(`${COMMAND_DOG_API}/v1/dx/verify-tweet`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tweet_url: params.tweetUrl,
        x_handle: params.xHandle,
        doge_address: params.dogeAddress
      }),
      signal: abortMs(12_000)
    });
    const j = await parseJson(res);
    if (!res.ok) {
      return { ok: false, error: typeof j.error === 'string' ? j.error : `HTTP ${res.status}` };
    }
    return {
      ok: j.ok === true,
      tweetId: typeof j.tweetId === 'string' ? j.tweetId : undefined,
      username: typeof j.username === 'string' ? j.username : undefined,
      via: typeof j.via === 'string' ? j.via : undefined,
      error: typeof j.error === 'string' ? j.error : undefined
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Tweet check failed' };
  }
}

async function recordTipIntent(handle: string, postId?: string | null): Promise<number | null> {
  try {
    const res = await fetch(`${COMMAND_DOG_API}/v1/dx/tip-intent`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ x_handle: handle, post_id: postId || undefined }),
      signal: abortMs(DX_LOOKUP_TIMEOUT_MS)
    });
    if (!res.ok) return null;
    const j = await parseJson(res);
    return typeof j.count === 'number' ? j.count : null;
  } catch {
    return null;
  }
}

function sessionStore(): chrome.storage.StorageArea {
  return chrome.storage.session ?? chrome.storage.local;
}

async function getPending(): Promise<DxPendingAction | null> {
  try {
    const bag = await sessionStore().get(DX_PENDING_STORAGE_KEY);
    const raw = bag[DX_PENDING_STORAGE_KEY] as DxPendingAction | undefined;
    if (!raw || typeof raw !== 'object') return null;
    if (Date.now() - (raw.createdAt || 0) > 30 * 60_000) {
      await sessionStore().remove(DX_PENDING_STORAGE_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

async function setPending(action: DxPendingAction): Promise<void> {
  await sessionStore().set({ [DX_PENDING_STORAGE_KEY]: action });
}

async function clearPending(): Promise<void> {
  await sessionStore().remove(DX_PENDING_STORAGE_KEY);
}

let lastPopupWindowId: number | null = null;

async function openDxPopup(windowId?: number): Promise<void> {
  const chromeWithSidePanel = chrome as {
    sidePanel?: {
      open: (options: { windowId?: number; tabId?: number }) => Promise<void>;
    };
  };
  const preferSidePanel = (() => {
    try {
      return preferenceService.getOpenInSidePanel();
    } catch {
      return true;
    }
  })();

  if (preferSidePanel && chromeWithSidePanel.sidePanel?.open) {
    try {
      let id = windowId;
      if (id == null) {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        id = tab?.windowId;
      }
      if (id != null) {
        await chromeWithSidePanel.sidePanel.open({ windowId: id });
        return;
      }
    } catch {
      /* no user gesture / API missing — fall through */
    }
  }

  try {
    if (chrome.action?.openPopup) {
      await chrome.action.openPopup();
      return;
    }
  } catch {
    /* Chrome < 127 or no user gesture — fall through to a popped-out window */
  }

  if (lastPopupWindowId != null) {
    try {
      const existing = await chrome.windows.get(lastPopupWindowId);
      if (existing?.id != null) {
        await chrome.windows.update(existing.id, { focused: true });
        return;
      }
    } catch {
      lastPopupWindowId = null;
    }
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 420,
    height: 680,
    focused: true
  });
  lastPopupWindowId = win.id ?? null;
}

async function openAction(
  partial: Omit<DxPendingAction, 'createdAt' | 'source'> & { source?: 'x.com'; windowId?: number }
): Promise<void> {
  const handle = tryParsePayHandle(partial.handle);
  if (!handle) throw new Error('Invalid handle');
  const action: DxPendingAction = {
    type: partial.type,
    handle,
    postId: partial.postId || null,
    displayName: partial.displayName || null,
    avatarUrl: partial.avatarUrl || null,
    createdAt: Date.now(),
    source: 'x.com'
  };
  await setPending(action);
  if (action.type === 'tip') {
    void recordTipIntent(handle, action.postId);
  }
  try {
    chrome.runtime.sendMessage({ type: DX_PENDING_CHANGED }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    /* popup may not be listening yet */
  }
  await openDxPopup(partial.windowId);
}

function reply(sendResponse: (r: unknown) => void, value: unknown): void {
  sendResponse(value);
}

class DxController {
  public init(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || typeof message.type !== 'string' || !(Object.values(DX_MESSAGE) as string[]).includes(message.type)) {
        return false;
      }
      if (!isTrustedSender(sender)) {
        sendResponse({ error: 'Untrusted sender' });
        return false;
      }

      const run = async () => {
        switch (message.type) {
          case DX_MESSAGE.LOOKUP_HANDLE: {
            return lookupHandle(String(message.handle || ''));
          }
          case DX_MESSAGE.LOOKUP_ADDRESS: {
            return lookupAddress(String(message.address || ''));
          }
          case DX_MESSAGE.LOOKUP_BATCH: {
            const handles = Array.isArray(message.handles) ? (message.handles as string[]) : [];
            const unique = [...new Set(handles.map((h) => tryParsePayHandle(h)).filter(Boolean) as string[])].slice(
              0,
              24
            );
            const rows = await Promise.all(unique.map((h) => lookupHandle(h)));
            const byHandle: Record<string, DxLookupResult> = {};
            for (const row of rows) byHandle[dxHandleKey(row.handle)] = row;
            return { byHandle };
          }
          case DX_MESSAGE.VERIFY_TWEET: {
            return verifyTweet({
              tweetUrl: String(message.tweetUrl || ''),
              xHandle: String(message.xHandle || ''),
              dogeAddress: String(message.dogeAddress || '')
            });
          }
          case DX_MESSAGE.OPEN_ACTION: {
            await openAction({
              type: message.actionType === 'link' ? 'link' : 'tip',
              handle: String(message.handle || ''),
              postId: message.postId || null,
              displayName: message.displayName || null,
              avatarUrl: message.avatarUrl || null,
              windowId: sender.tab?.windowId
            });
            return { ok: true };
          }
          case DX_MESSAGE.GET_PENDING: {
            return { action: await getPending() };
          }
          case DX_MESSAGE.CLEAR_PENDING: {
            await clearPending();
            return { ok: true };
          }
          case DX_MESSAGE.RECORD_TIP_INTENT: {
            const n = await recordTipIntent(String(message.handle || ''), message.postId || null);
            return { count: n };
          }
          default:
            return { error: 'Unknown DX message' };
        }
      };

      run()
        .then((value) => reply(sendResponse, value))
        .catch((e) => reply(sendResponse, { error: e instanceof Error ? e.message : 'DX request failed' }));
      return true;
    });
  }
}

export default new DxController();
