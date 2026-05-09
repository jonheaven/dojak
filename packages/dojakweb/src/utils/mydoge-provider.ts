export type MyDogeLikeProvider = {
  isMyDoge?: boolean;
  connect?: () => Promise<{ connected?: boolean; approved?: boolean; address?: string }>;
  getConnectionStatus?: () => Promise<{ connected: boolean }>;
  requestSignedMessage?: (params: { message: string }) => Promise<unknown>;
  requestPsbt?: (params: Record<string, unknown>) => Promise<unknown>;
  signRequest?: (params: Record<string, unknown>) => Promise<unknown>;
  signPsbt?: (tx: unknown) => Promise<unknown>;
  getAddress?: () => Promise<string>;
  getCurrentAddress?: () => Promise<{ address: string }>;
};

const hasCoreMyDogeMethods = (candidate: unknown): candidate is MyDogeLikeProvider => {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const provider = candidate as MyDogeLikeProvider;
  const hasSigner =
    typeof provider.requestSignedMessage === 'function' ||
    typeof provider.requestPsbt === 'function' ||
    typeof provider.signRequest === 'function' ||
    typeof provider.signPsbt === 'function';
  const hasAddressResolver =
    typeof provider.getAddress === 'function' ||
    typeof provider.getCurrentAddress === 'function';
  return (
    typeof provider.connect === 'function' &&
    (typeof provider.getConnectionStatus === 'function' || hasAddressResolver) &&
    hasSigner
  );
};

export const getInjectedMyDogeProvider = (): MyDogeLikeProvider | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const anyWindow = window as any;
  const candidate = anyWindow.doge ?? anyWindow.mydoge ?? anyWindow.myDoge;

  if (!candidate) {
    return null;
  }

  if (
    candidate.isMyDoge === true ||
    candidate.isMyDogeWallet === true ||
    hasCoreMyDogeMethods(candidate)
  ) {
    return candidate as MyDogeLikeProvider;
  }

  return null;
};
