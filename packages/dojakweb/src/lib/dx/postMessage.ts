/**
 * Cross-origin Ð𝕏 verification handoff: embedder posts a request; Dojakweb opens the wallet
 * and returns a `register` payload (JSON) for inscription. Hosts MUST use a specific targetOrigin.
 */

export const DOJAKWEB_DX_PM_PROTOCOL = 'dojakweb-dx-v1' as const;

export const DOJAKWEB_DX_REQUEST = 'DOJAKWEB_DX_V1_REQUEST' as const;
export const DOJAKWEB_DX_RESPONSE = 'DOJAKWEB_DX_V1_RESPONSE' as const;
export const DOJAKWEB_DX_CANCEL = 'DOJAKWEB_DX_V1_CANCEL' as const;

export interface DxPostMessageRequest {
  type: typeof DOJAKWEB_DX_REQUEST;
  protocol: typeof DOJAKWEB_DX_PM_PROTOCOL;
  requestId: string;
  xHandle: string;
}

export interface DxPostMessageResponseOk {
  type: typeof DOJAKWEB_DX_RESPONSE;
  protocol: typeof DOJAKWEB_DX_PM_PROTOCOL;
  requestId: string;
  ok: true;
  register: Record<string, unknown>;
}

export interface DxPostMessageResponseErr {
  type: typeof DOJAKWEB_DX_RESPONSE;
  protocol: typeof DOJAKWEB_DX_PM_PROTOCOL;
  requestId: string;
  ok: false;
  error: string;
}

export type DxPostMessageResponse = DxPostMessageResponseOk | DxPostMessageResponseErr;

export function isDxPostMessageRequest(data: unknown): data is DxPostMessageRequest {
  if (!data || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  return (
    o.type === DOJAKWEB_DX_REQUEST &&
    o.protocol === DOJAKWEB_DX_PM_PROTOCOL &&
    typeof o.requestId === 'string' &&
    o.requestId.length > 0 &&
    typeof o.xHandle === 'string' &&
    o.xHandle.length > 0
  );
}

/** Host helper: ask an embedded Dojakweb page to start Ð𝕏 verification. */
export function postDxVerifyRequest(targetWindow: Window, targetOrigin: string, params: { requestId: string; xHandle: string }): void {
  const msg: DxPostMessageRequest = {
    type: DOJAKWEB_DX_REQUEST,
    protocol: DOJAKWEB_DX_PM_PROTOCOL,
    requestId: params.requestId,
    xHandle: params.xHandle.startsWith('@') ? params.xHandle : `@${params.xHandle}`,
  };
  targetWindow.postMessage(msg, targetOrigin);
}
