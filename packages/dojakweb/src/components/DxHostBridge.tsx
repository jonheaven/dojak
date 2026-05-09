'use client';

import React, { useEffect } from 'react';
import { useDojakwebDxTrustedOrigins } from '../contexts/DojakwebDxContext';
import { DOJAKWEB_DX_PM_PROTOCOL, isDxPostMessageRequest } from '../lib/dx/postMessage';
import { normalizeDxXHandle } from '../lib/dx/protocol';
import { useDxHostStore } from '../stores/dxHostStore';

const CUSTOM_REQ = 'dojakweb-dx-verify';

function isAllowedOrigin(evOrigin: string, trusted: readonly string[]): boolean {
  if (typeof window === 'undefined') return false;
  if (evOrigin === window.location.origin) return true;
  return trusted.includes(evOrigin);
}

/**
 * Listens for `postMessage` and `dojakweb-dx-verify` CustomEvent so third-party embedders
 * can open Ð𝕏 verification with a prefilled handle.
 */
export function DxHostBridge() {
  const trusted = useDojakwebDxTrustedOrigins();
  const setPending = useDxHostStore((s) => s.setPending);
  const signalOpenWallet = useDxHostStore((s) => s.signalOpenWallet);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (!isDxPostMessageRequest(ev.data)) return;
      if (!isAllowedOrigin(ev.origin, trusted)) return;
      let handle: string;
      try {
        handle = normalizeDxXHandle(ev.data.xHandle);
      } catch {
        return;
      }
      setPending({
        requestId: ev.data.requestId,
        xHandle: handle,
        origin: ev.origin,
        source: ev.source instanceof Window ? ev.source : null,
      });
      signalOpenWallet();
    }

    function onCustom(ev: Event) {
      const ce = ev as CustomEvent<{ requestId?: string; xHandle?: string }>;
      const xHandle = ce.detail?.xHandle;
      if (!xHandle || typeof xHandle !== 'string') return;
      let handle: string;
      try {
        handle = normalizeDxXHandle(xHandle);
      } catch {
        return;
      }
      const requestId =
        typeof ce.detail?.requestId === 'string' && ce.detail.requestId.length > 0
          ? ce.detail.requestId
          : crypto.randomUUID();
      setPending({
        requestId,
        xHandle: handle,
        origin: typeof window !== 'undefined' ? window.location.origin : '',
        source: null,
      });
      signalOpenWallet();
    }

    window.addEventListener('message', onMessage);
    window.addEventListener(CUSTOM_REQ, onCustom as EventListener);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener(CUSTOM_REQ, onCustom as EventListener);
    };
  }, [trusted, setPending, signalOpenWallet]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as { __DOJAKWEB_DX__?: string }).__DOJAKWEB_DX__ = DOJAKWEB_DX_PM_PROTOCOL;
    return () => {
      delete (window as unknown as { __DOJAKWEB_DX__?: string }).__DOJAKWEB_DX__;
    };
  }, []);

  return null;
}
