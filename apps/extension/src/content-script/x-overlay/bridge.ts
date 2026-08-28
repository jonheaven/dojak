import { DX_MESSAGE, dxHandleKey, parseTweetIdFromInput, tryParsePayHandle, type DxLookupResult } from '@dojak/core/dx';

export function dxRuntime<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && typeof response === 'object' && 'error' in response && (response as { error?: string }).error) {
          reject(new Error(String((response as { error: string }).error)));
          return;
        }
        resolve(response as T);
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Extension messaging failed'));
    }
  });
}

export async function lookupHandle(handle: string): Promise<DxLookupResult> {
  return dxRuntime<DxLookupResult>({ type: DX_MESSAGE.LOOKUP_HANDLE, handle });
}

export async function lookupBatch(handles: string[]): Promise<Record<string, DxLookupResult>> {
  const res = await dxRuntime<{ byHandle?: Record<string, DxLookupResult> }>({
    type: DX_MESSAGE.LOOKUP_BATCH,
    handles
  });
  return res.byHandle || {};
}

export async function openDxAction(opts: {
  actionType: 'tip' | 'link';
  handle: string;
  postId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<void> {
  const handle = tryParsePayHandle(opts.handle);
  if (!handle) throw new Error('Invalid handle');
  await dxRuntime({
    type: DX_MESSAGE.OPEN_ACTION,
    actionType: opts.actionType,
    handle,
    postId: opts.postId || null,
    displayName: opts.displayName || null,
    avatarUrl: opts.avatarUrl || null
  });
}

export function cacheKey(handle: string): string {
  return dxHandleKey(handle);
}

export function tweetIdFromArticle(article: Element): string | null {
  const links = article.querySelectorAll('a[href*="/status/"]');
  for (const a of Array.from(links)) {
    const href = (a as HTMLAnchorElement).href || a.getAttribute('href') || '';
    const id = parseTweetIdFromInput(href);
    if (id) return id;
  }
  return null;
}

export function handleFromArticle(article: Element): string | null {
  const userName = article.querySelector('[data-testid="User-Name"]');
  const anchors = userName
    ? userName.querySelectorAll('a[href^="/"]')
    : article.querySelectorAll('a[href^="/"][role="link"]');
  for (const a of Array.from(anchors)) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/^\/([A-Za-z0-9_]{1,15})(?:\/|$|\?)/);
    if (!m) continue;
    const parsed = tryParsePayHandle(m[1]);
    if (parsed) return parsed;
  }
  const status = article.querySelector('a[href*="/status/"]');
  const href = status?.getAttribute('href') || '';
  const m = href.match(/\/([A-Za-z0-9_]{1,15})\/status\//);
  return m ? tryParsePayHandle(m[1]) : null;
}

export function displayNameFromArticle(article: Element): string | null {
  const el = article.querySelector('[data-testid="User-Name"] span');
  const text = el?.textContent?.trim();
  return text || null;
}

export function avatarFromArticle(article: Element): string | null {
  const img = article.querySelector('[data-testid="Tweet-User-Avatar"] img, a[href^="/"] img[src]') as HTMLImageElement | null;
  return img?.src || null;
}

export function actionGroup(article: Element): HTMLElement | null {
  const reply = article.querySelector('[data-testid="reply"]');
  const group = reply?.closest('[role="group"]');
  if (group instanceof HTMLElement) return group;
  const groups = article.querySelectorAll('[role="group"]');
  const last = groups[groups.length - 1];
  return last instanceof HTMLElement ? last : null;
}

export function profileHandleFromHeader(): string | null {
  const name = document.querySelector('[data-testid="UserName"]');
  if (!name) return null;
  const text = name.textContent || '';
  const m = text.match(/@([A-Za-z0-9_]{1,15})/);
  return m ? tryParsePayHandle(m[1]) : null;
}

export function profileActionsRow(): HTMLElement | null {
  const actions = document.querySelector('[data-testid="userActions"]');
  if (actions?.parentElement instanceof HTMLElement) return actions.parentElement;
  const follow = document.querySelector('[data-testid="placementTracking"]');
  return follow instanceof HTMLElement ? follow.parentElement : null;
}
