import { DX_MESSAGE, type DxLookupResult, type DxPendingAction, type DxVerifyTweetResult } from '@dojak/core/dx';

function send<T>(payload: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response && typeof response === 'object' && (response as { error?: string }).error) {
        reject(new Error(String((response as { error: string }).error)));
        return;
      }
      resolve(response as T);
    });
  });
}

export async function getPendingAction(): Promise<DxPendingAction | null> {
  const res = await send<{ action?: DxPendingAction | null }>({ type: DX_MESSAGE.GET_PENDING });
  return res.action ?? null;
}

export async function clearPendingAction(): Promise<void> {
  await send({ type: DX_MESSAGE.CLEAR_PENDING });
}

export async function lookupDxHandle(handle: string): Promise<DxLookupResult> {
  return send<DxLookupResult>({ type: DX_MESSAGE.LOOKUP_HANDLE, handle });
}

export async function lookupDxAddress(address: string): Promise<DxLookupResult> {
  return send<DxLookupResult>({ type: DX_MESSAGE.LOOKUP_ADDRESS, address });
}

export async function verifyDxTweet(params: {
  tweetUrl: string;
  xHandle: string;
  dogeAddress: string;
}): Promise<DxVerifyTweetResult> {
  return send<DxVerifyTweetResult>({ type: DX_MESSAGE.VERIFY_TWEET, ...params });
}

export function commandDogAvatar(handle: string): string {
  const inner = handle.trim().replace(/^@/, '').toLowerCase();
  return `https://api.command.dog/v1/dx/avatar/${encodeURIComponent(inner)}`;
}
