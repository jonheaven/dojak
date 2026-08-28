import { parseXPathContext, type DxLookupResult } from '@dojak/core/dx';
import { DOGE_COIN_SVG, OVERLAY_CSS } from './assets';
import {
  actionGroup,
  avatarFromArticle,
  cacheKey,
  displayNameFromArticle,
  handleFromArticle,
  lookupBatch,
  lookupHandle,
  openDxAction,
  profileActionsRow,
  profileHandleFromHeader,
  tweetIdFromArticle
} from './bridge';

const ATTR_TIP = 'data-dojak-dx-tip';
const ATTR_CHIP = 'data-dojak-dx-chip';
const MAX_BATCH = 16;

function surfaceColor(): string {
  const bg = getComputedStyle(document.body).backgroundColor || '#15202b';
  return bg;
}

function makeShadowHost(tag: string): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement(tag);
  host.style.display = 'inline-flex';
  host.style.alignItems = 'center';
  host.style.verticalAlign = 'middle';
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = OVERLAY_CSS;
  root.appendChild(style);
  return { host, root };
}

function setTooltip(btn: HTMLElement, text: string) {
  let tip = btn.querySelector('.dj-tip') as HTMLElement | null;
  if (!tip) {
    tip = document.createElement('span');
    tip.className = 'dj-tip';
    tip.setAttribute('role', 'tooltip');
    btn.appendChild(tip);
  }
  tip.textContent = text;
}

function applyState(btn: HTMLElement, lookup: DxLookupResult | undefined, handle: string, kind: 'tip' | 'link') {
  const state = lookup?.kind || 'idle';
  btn.dataset.state = state;
  const label =
    kind === 'link'
      ? state === 'linked'
        ? `Pay @${handle.replace(/^@/, '')} with Ð`
        : `Link @${handle.replace(/^@/, '')} with Ð𝕏`
      : state === 'linked'
        ? `Tip @${handle.replace(/^@/, '')} Ð`
        : state === 'unlinked'
          ? `Invite @${handle.replace(/^@/, '')} to link Ð𝕏`
          : `Ð𝕏 · @${handle.replace(/^@/, '')}`;
  btn.setAttribute('aria-label', label);
  setTooltip(btn, label);
}

function bindClick(
  el: HTMLElement,
  opts: () => {
    actionType: 'tip' | 'link';
    handle: string;
    postId?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  }
) {
  el.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const payload = opts();
      el.dataset.state = 'busy';
      void openDxAction(payload).catch(() => {
        el.dataset.state = 'unreachable';
      });
    },
    true
  );
  el.addEventListener(
    'mousedown',
    (event) => {
      event.stopPropagation();
    },
    true
  );
}

function createTipButton(handle: string, postId: string | null, displayName: string | null, avatarUrl: string | null) {
  const { host, root } = makeShadowHost('span');
  host.setAttribute(ATTR_TIP, handle);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dj-btn';
  btn.dataset.state = 'idle';
  btn.style.setProperty('--dj-surface', surfaceColor());
  btn.dataset.handle = handle;
  btn.innerHTML = `<span class="dj-icon">${DOGE_COIN_SVG}</span><span class="dj-dot"></span>`;
  applyState(btn, undefined, handle, 'tip');
  bindClick(btn, () => ({ actionType: 'tip', handle, postId, displayName, avatarUrl }));
  root.appendChild(btn);
  return { host, btn };
}

function createProfileChip(handle: string) {
  const { host, root } = makeShadowHost('span');
  host.setAttribute(ATTR_CHIP, handle);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dj-chip';
  btn.dataset.state = 'idle';
  btn.dataset.handle = handle;
  btn.innerHTML = `<span class="dj-icon">${DOGE_COIN_SVG}</span><span class="dj-label">Ð𝕏</span>`;
  applyState(btn, undefined, handle, 'link');
  bindClick(btn, () => ({
    actionType: btn.dataset.state === 'linked' ? 'tip' : 'link',
    handle,
    postId: null,
    displayName: null,
    avatarUrl: null
  }));
  root.appendChild(btn);
  return { host, btn };
}

const pendingLookups = new Map<string, HTMLElement[]>();

function queueLookup(handle: string, btn: HTMLElement, kind: 'tip' | 'link') {
  const key = cacheKey(handle);
  const list = pendingLookups.get(key) || [];
  list.push(btn);
  pendingLookups.set(key, list);
  applyState(btn, undefined, handle, kind);
}

async function flushLookups() {
  const keys = [...pendingLookups.keys()].slice(0, MAX_BATCH);
  if (!keys.length) return;
  const snapshot = new Map<string, HTMLElement[]>();
  for (const key of keys) {
    snapshot.set(key, pendingLookups.get(key) || []);
    pendingLookups.delete(key);
  }
  try {
    const byHandle = await lookupBatch(keys);
    for (const [key, buttons] of snapshot) {
      const lookup = byHandle[key];
      for (const btn of buttons) {
        const handle = lookup?.handle || btn.dataset.handle || `@${key}`;
        const kind: 'tip' | 'link' = btn.classList.contains('dj-chip') ? 'link' : 'tip';
        applyState(btn, lookup, handle, kind);
        if (btn.classList.contains('dj-chip')) {
          const label = btn.querySelector('.dj-label');
          if (label) label.textContent = lookup?.kind === 'linked' ? 'Pay Ð' : 'Link Ð𝕏';
        }
      }
    }
  } catch {
    for (const [, buttons] of snapshot) {
      for (const btn of buttons) btn.dataset.state = 'unreachable';
    }
  }
}

function injectTweet(article: Element) {
  if (!(article instanceof HTMLElement)) return;
  if (article.querySelector(`[${ATTR_TIP}]`)) return;
  const handle = handleFromArticle(article);
  if (!handle) return;
  const group = actionGroup(article);
  if (!group) return;
  const postId = tweetIdFromArticle(article);
  const { host, btn } = createTipButton(handle, postId, displayNameFromArticle(article), avatarFromArticle(article));
  group.appendChild(host);
  queueLookup(handle, btn, 'tip');
}

function injectProfile() {
  const existing = document.querySelector(`[${ATTR_CHIP}]`);
  const ctx = parseXPathContext(location.pathname);
  const handle = profileHandleFromHeader() || ctx.handle;
  if (!handle || ctx.postId) {
    existing?.remove();
    return;
  }
  if (existing?.getAttribute(ATTR_CHIP) === handle) return;
  existing?.remove();
  const row = profileActionsRow();
  if (!row) return;
  const { host, btn } = createProfileChip(handle);
  row.insertBefore(host, row.firstChild);
  queueLookup(handle, btn, 'link');
  void lookupHandle(handle).then((lookup) => {
    applyState(btn, lookup, handle, 'link');
    const label = btn.querySelector('.dj-label');
    if (label) label.textContent = lookup.kind === 'linked' ? 'Pay Ð' : 'Link Ð𝕏';
  });
}

function scan() {
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  articles.forEach(injectTweet);
  injectProfile();
  void flushLookups();
}

let scanTimer: number | null = null;
function scheduleScan() {
  if (scanTimer != null) return;
  scanTimer = window.setTimeout(() => {
    scanTimer = null;
    scan();
  }, 90);
}

export function startXOverlay() {
  if (window.top !== window) return;
  const host = location.hostname.replace(/^www\./, '');
  if (host !== 'x.com' && host !== 'twitter.com' && host !== 'mobile.twitter.com') return;

  scan();

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let lastPath = location.pathname;
  window.setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      scheduleScan();
    }
  }, 400);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleScan();
  });
}
