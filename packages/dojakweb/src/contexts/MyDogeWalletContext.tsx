'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MyDogeWalletContext } from './mydogeWalletInternals';
import { Transaction } from 'bitcoinjs-lib';
import { preparePsdtForMyDogeSign, tryParsePsdt } from '../lib/doginal-psdt';
import { getInjectedMyDogeProvider } from '../utils/mydoge-provider';

/**
 * Base64 or hex PSBT → canonical PSBT hex + indexes (skip inputs that already have partialSig).
 * Always runs preparePsdtForMyDogeSign: the old guard skipped all-hex strings that were not
 * detected as PSBT, so base64/hex PSBT was passed to requestPsbt as "raw tx" → Invalid PSBT.
 */
function normalizeMyDogePsbtInput(psbtInput: string): {
  normalizedHex: string;
  canonicalBase64: string | null;
  signIndexes: number[];
  isPSBT: boolean;
  sighashType: number;
} {
  console.log('[MyDoge] normalizeMyDogePsbtInput:start', {
    inputLength: psbtInput.length,
    inputPrefix: psbtInput.slice(0, 24),
  });
  const prep = preparePsdtForMyDogeSign(psbtInput.trim());
  const normalizedHex = prep.psbtHex;
  const signIndexes = prep.indexes;
  const sighashType = prep.sighashType;
  const isPSBT = normalizedHex.toLowerCase().startsWith('70736274');
  const canonicalBase64 = tryParsePsdt(psbtInput.trim())?.toBase64() ?? null;
  console.log('[MyDoge] normalizeMyDogePsbtInput:done', {
    normalizedLength: normalizedHex.length,
    normalizedPrefix: normalizedHex.slice(0, 24),
    canonicalBase64Length: canonicalBase64?.length ?? 0,
    signIndexes,
    isPSBT,
    sighashType,
  });
  return { normalizedHex, canonicalBase64, signIndexes, isPSBT, sighashType };
}

/**
 * Extract the signed payload from a MyDoge signing response.
 * @param preferPsbt - When true (signPSBTOnly / doggy.market buy flow), prefer the PSBT
 *   over the finalized raw transaction so doggy.market receives a signed PSBT, not a raw tx.
 */
function pickMyDogeSignedPayload(res: unknown, preferPsbt = false): string {
  if (!res || typeof res !== 'object') {
    throw new Error('MyDoge signing returned an empty response');
  }
  const r = res as Record<string, unknown>;
  // When a signed PSBT is preferred (partial-sign for doggy.market), try PSBT fields first.
  const out = preferPsbt
    ? (r.signedPsbt ?? r.psbtHex ?? r.signedPsbtHex ?? r.signedTx ?? r.signedRawTx ?? r.signed_tx)
    : (r.signedTx ?? r.signedRawTx ?? r.signedPsbt ?? r.signed_tx ?? r.psbtHex ?? r.signedPsbtHex);
  console.log('[MyDoge] pickMyDogeSignedPayload:keys', Object.keys(r), { preferPsbt });
  if (typeof out !== 'string' || !out.trim()) {
    throw new Error('MyDoge signing returned no signed transaction or PSDT');
  }
  console.log('[MyDoge] pickMyDogeSignedPayload:selected', {
    outputLength: out.trim().length,
    outputPrefix: out.trim().slice(0, 24),
  });
  return out.trim();
}

type RequestPsbtProbeResult = {
  label: string;
  params: Record<string, unknown>;
  ok: boolean;
  response?: unknown;
  error?: string;
};

interface MyDogeWallet {
  isMyDoge: boolean;
  connect: () => Promise<{ approved: boolean; address: string }>;
  disconnect: () => Promise<{ disconnected: boolean }>;
  getConnectionStatus: () => Promise<{ connected: boolean }>;
  getCurrentAddress?: () => Promise<{ address: string }>;
  getBalance: () => Promise<{ balance: string }>;
  requestTransaction: (params: { recipientAddress: string; dogeAmount: number }) => Promise<{ txId: string }>;
  getTransactionStatus: (params: { txId: string }) => Promise<{ status: string; confirmations: number }>;
  requestSignedMessage: (params: { message: string }) => Promise<{ signature: string }>;
  requestPsbt?: (params: {
    rawTx: string;
    indexes: number[];
    signOnly?: boolean;
    partial?: boolean;
    /** Required for partial sign when PSBT inputs use non-default sighash (e.g. listing = SINGLE|ACP). */
    sighashType?: number;
  }) => Promise<{ txId?: string; signedRawTx?: string; signedPsbt?: string }>;
  signRequest?: (params: {
    message?: string;
    rawTx?: string;
    psbtHex?: string;
    psbtBase64?: string;
    indexes?: number[];
    signOnly?: boolean;
    partial?: boolean;
    sighashType?: number;
  }) => Promise<{ txId?: string; signedRawTx?: string; signedPsbt?: string } | string>;
  requestInscriptionTransaction: (params: { recipientAddress: string; location: string }) => Promise<{ txId: string }>;
  signPSBT?: (params: { psbtHex: string; indexes: number[] }) => Promise<{
    signedRawTx?: string;
    signedPsbt?: string;
  }>;
}

function normalizeMyDogeSignedMessageResponse(response: unknown): string {
  if (typeof response === 'string') {
    return response;
  }

  if (!response || typeof response !== 'object') {
    throw new Error('MyDoge wallet returned an empty signature response');
  }

  const candidate = response as Record<string, unknown>;
  const signature =
    candidate.signature ??
    candidate.signedMessage ??
    candidate.signed_message ??
    candidate.messageSignature ??
    candidate.message_signature;

  if (typeof signature !== 'string' || signature.trim().length === 0) {
    throw new Error('MyDoge wallet returned a signature response without a usable signature field');
  }

  return signature;
}

async function invokeMyDogePsbtSigner(
  myDoge: MyDogeWallet,
  normalizedHex: string,
  canonicalBase64: string | null,
  signIndexes: number[],
  signOnly: boolean,
  isPSBT: boolean,
  sighashType: number,
  preferPsbt = false,
): Promise<string> {
  const attempts: Array<{ label: string; run: () => Promise<unknown> }> = [];

  // MyDoge signPSBT does not pass sighashType; skip when PSBT needs a non-ALL sighash (e.g. listings).
  if (isPSBT && myDoge.signPSBT && sighashType === Transaction.SIGHASH_ALL) {
    attempts.push({
      label: 'signPSBT',
      run: () => myDoge.signPSBT!({ psbtHex: normalizedHex, indexes: signIndexes }),
    });
  }

  if (myDoge.requestPsbt) {
    attempts.push({
      label: 'requestPsbt',
      run: () =>
        myDoge.requestPsbt!({
          rawTx: normalizedHex,
          indexes: signIndexes,
          signOnly,
          partial: true,
          sighashType,
        }),
    });
  }

  if (myDoge.signRequest) {
    attempts.push(
      {
        label: 'signRequest:rawTx',
        run: () =>
          myDoge.signRequest!({
            rawTx: normalizedHex,
            indexes: signIndexes,
            signOnly,
            partial: true,
            sighashType,
          }),
      },
      {
        label: 'signRequest:psbtHex',
        run: () =>
          myDoge.signRequest!({
            psbtHex: normalizedHex,
            indexes: signIndexes,
            signOnly,
            partial: true,
            sighashType,
          }),
      },
    );
    if (canonicalBase64) {
      attempts.push({
        label: 'signRequest:psbtBase64',
        run: () =>
          myDoge.signRequest!({
            psbtBase64: canonicalBase64,
            indexes: signIndexes,
            signOnly,
            partial: true,
            sighashType,
          }),
      });
    }
  }

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      console.log('[MyDoge] PSBT signer attempt:start', {
        label: attempt.label,
        signOnly,
        indexes: signIndexes,
        sighashType,
      });
      const response = await attempt.run();
      console.log('[MyDoge] PSBT signer attempt:response', {
        label: attempt.label,
        responseType: typeof response,
      });
      return pickMyDogeSignedPayload(response, preferPsbt);
    } catch (error) {
      lastError = error;
      console.warn('[MyDoge] PSBT signer attempt:failed', {
        label: attempt.label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('MyDoge PSDT signing failed with all available methods.');
}

export interface UseMyDogeWalletReturn {
  myDoge: MyDogeWallet | null;
  connected: boolean;
  address: string | null;
  balance: number;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (recipientAddress: string, amount: number) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  signPSBT: (psbtHex: string) => Promise<string>; // Returns raw transaction hex
  signPSBTOnly: (psbtHex: string) => Promise<string>; // Returns signed PSBT only (no broadcast)
  sendInscription: (recipientAddress: string, location: string) => Promise<string>;
  getTransactionStatus: (txId: string) => Promise<{ status: string; confirmations: number }>;
  debugProbeRequestPsbt: (psbtInput: string) => Promise<RequestPsbtProbeResult[]>;
}

const getInjectedMyDoge = (): MyDogeWallet | null => {
  return getInjectedMyDogeProvider() as MyDogeWallet | null;
};

export function MyDogeWalletProvider({ children }: { children: React.ReactNode }) {
  const [myDoge, setMyDoge] = useState<MyDogeWallet | null>(null);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('🚀 [WALLET] Initializing MyDoge wallet provider...');

    // Enhanced wallet availability check with error handling
    const checkWallet = () => {
      try {
        const injected = getInjectedMyDoge();
        if (injected) {
          console.log('✅ [WALLET] MyDoge wallet found');
          setMyDoge((prev) => (prev === injected ? prev : injected));
          return true;
        }
        return false;
      } catch (error) {
        console.warn('⚠️ [WALLET] Error checking wallet availability:', error);
        return false;
      }
    };

    // Enhanced event listener for wallet initialization
    const onInit = () => {
      console.log('🎉 [WALLET] MyDoge wallet initialized event received');
      // Check immediately when event fires
      setTimeout(() => {
        checkWallet();
      }, 100);
    };

    // Add error handling for connection issues
    const onError = (event: any) => {
      // Silently handle "not connected" errors - these are expected
      if (event?.message?.includes('not connected') ||
          event?.message?.includes('MyDoge is not connected')) {
        console.log('[WALLET] MyDoge not connected - this is expected');
        return;
      }
      console.warn('⚠️ [WALLET] MyDoge connection error:', event);
    };

    // Check if page is already loaded
    const handleLoad = () => {
      setTimeout(() => {
        checkWallet();
      }, 200);
    };

    // Initial check - check immediately
    if (checkWallet()) {
      // Still set up listener in case wallet reinitializes
      window.addEventListener('doge#initialized', onInit);
      window.addEventListener('doge#error', onError);
      return () => {
        window.removeEventListener('doge#initialized', onInit);
        window.removeEventListener('doge#error', onError);
      };
    }

    // MyDoge wallet sets window.doge in a 'load' event listener
    // So we need to check after load event or if it already fired
    if (document.readyState === 'complete') {
      // Page already loaded, check immediately
      handleLoad();
    } else {
      // Page still loading, wait for load event
      window.addEventListener('load', handleLoad);
    }

    // Check periodically for wallets that load after page load
    const intervalId = setInterval(() => {
      if (checkWallet()) {
        clearInterval(intervalId);
      }
    }, 1000);

    // Stop checking after 10 seconds
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
    }, 10000);

    // Set up event listeners
    window.addEventListener('doge#initialized', onInit);
    window.addEventListener('doge#error', onError);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      window.removeEventListener('load', handleLoad);
      window.removeEventListener('doge#initialized', onInit);
      window.removeEventListener('doge#error', onError);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreConnection = async () => {
      console.log('[WALLET] Starting connection restore...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for extension init
      if (cancelled) return;
      const provider = getInjectedMyDoge();
      if (!provider) {
        console.log('[WALLET] MyDoge extension not detected');
        return;
      }
      try {
        console.log('[WALLET] Checking connection status...');
        let status;
        try {
          status = await provider.getConnectionStatus();
        } catch (statusErr: any) {
          // Handle "not connected" error from getConnectionStatus
          if (statusErr?.message?.includes('not connected') ||
              statusErr?.message?.includes('MyDoge is not connected')) {
            console.log('[WALLET] Not connected to website - this is expected');
            return;
          }
          throw statusErr;
        }
        console.log('[WALLET] Status:', status);
        if (status.connected) {
          console.log('[WALLET] Extension connected, fetching address...');
          if (provider.getCurrentAddress) {
            console.log('[WALLET] getCurrentAddress available, fetching...');
            try {
              const addrRes = await provider.getCurrentAddress();
              setAddress(addrRes.address);
              setConnected(true);
              localStorage.setItem('mydoge_address', addrRes.address);
              // Balance fetch...
            } catch (addrErr: any) {
              // Handle "not connected" error gracefully
              if (addrErr?.message?.includes('not connected') ||
                  addrErr?.message?.includes('MyDoge is not connected')) {
                console.log('[WALLET] Not connected yet, will connect on user action');
                return;
              }
              throw addrErr;
            }
          } else {
            console.log('[WALLET] getCurrentAddress not available, falling back to stored');
            const storedAddr = localStorage.getItem('mydoge_address');
            if (storedAddr) {
              console.log('[WALLET] Ignoring stored MyDoge address until the extension can confirm the active account.');
              setAddress(null);
              setConnected(false);
              setBalance(0);
              return;
              setAddress(storedAddr);
              setConnected(true);
              // Optional: Try to fetch balance anyway if possible
              try {
                const bal = await provider.getBalance();
                console.log('📊 [WALLET] Raw balance response (restore):', bal);

                let balanceNum = 0;
                try {
                  const rawBalance = parseFloat(bal.balance);
                  console.log('🔢 [WALLET] Raw balance number (restore):', rawBalance);

                  // Always convert satoshis to DOGE (1 DOGE = 100,000,000 satoshis)
                  balanceNum = rawBalance / 100000000;
                  console.log('💱 [WALLET] Converted satoshis to DOGE (restore):', balanceNum);

                } catch (parseError) {
                  console.error('❌ [WALLET] Balance parsing error (restore):', parseError);
                  balanceNum = 0;
                }

                setBalance(balanceNum);
                console.log('[WALLET] Balance fetched (restore):', balanceNum);
              } catch (balErr: any) {
                // Handle "not connected" error gracefully
                if (balErr?.message?.includes('not connected') ||
                    balErr?.message?.includes('MyDoge is not connected')) {
                  console.log('[WALLET] Not connected, balance fetch skipped');
                  setBalance(0);
                } else {
                  console.error('[WALLET] Balance fetch failed:', balErr);
                  setBalance(0);
                }
              }
            } else {
              console.log('[WALLET] No stored address, prompting reconnect');
              // Optional: set a state to show reconnect button or auto-call connect()
            }
          }
        } else {
          console.log('[WALLET] Not connected, checking localStorage...');
          const storedAddr = localStorage.getItem('mydoge_address');
          if (storedAddr) {
            console.log('[WALLET] Found stored address, but not connected. User needs to reconnect.');
            // Don't auto-connect - let user click "Connect Wallet"
          }
        }
      } catch (err: any) {
        // Handle "not connected" errors gracefully
        if (err?.message?.includes('not connected') ||
            err?.message?.includes('MyDoge is not connected')) {
          console.log('[WALLET] Not connected to website - this is expected until user connects');
          return;
        }
        console.error('[WALLET] Restore error:', err);
        // Optional: setError('Failed to restore connection - please reconnect manually');
      }
    };
    restoreConnection();
    return () => { cancelled = true; };
  }, []);

  // Remove the problematic connection checking effect
  // useEffect(() => {
  //   if (!myDoge) return;
  //   ... REMOVED
  // }, [myDoge, connectionInProgress, connected]);

  const connect = useCallback(async () => {
    console.log('🔗 [WALLET] Connect function called...');

    if (!myDoge?.isMyDoge) {
      console.log('❌ [WALLET] MyDoge wallet not installed!');
      throw new Error('MyDoge wallet not installed! Please install the MyDoge browser extension.');
    }

    if (connected) {
      console.log('ℹ️ [WALLET] Already connected, skipping connection');
      return;
    }

    if (connecting) {
      console.log('⏳ [WALLET] Connection already in progress, skipping...');
      return;
    }

    console.log('🔄 [WALLET] Starting connection process...');
    setConnecting(true);

    try {
      console.log('📞 [WALLET] Calling wallet.connect()...');
      const connectRes = await myDoge.connect();
      console.log('📋 [WALLET] Connect response received:', connectRes);

      // Check for installHook errors that might occur after connection
      if (connectRes && typeof connectRes === 'object') {
        // The connection succeeded, but let's check if there were any extension hook errors
        setTimeout(() => {
          // Check if installHook.js errors occurred after connection
          const recentErrors = (console as any)._errors || [];
          const hookErrors = recentErrors.filter((err: any) =>
            err?.message?.includes('installHook') ||
            err?.stack?.includes('installHook')
          );
          if (hookErrors.length > 0) {
            console.warn('⚠️ [WALLET] MyDoge extension hook errors detected after connection');
            console.warn('💡 [WALLET] These errors may not affect functionality but indicate extension issues');
          }
        }, 1000);
      }

      if (connectRes.approved) {
        console.log('✅ [WALLET] Connection approved by user!');
        setConnected(true);
        setAddress(connectRes.address);
        console.log('📍 [WALLET] Address set:', connectRes.address);
        localStorage.setItem('mydoge_address', connectRes.address);

        console.log('💰 [WALLET] Fetching balance...');
        const balanceRes = await myDoge.getBalance();
        console.log('📊 [WALLET] Raw balance response:', balanceRes);

        // Parse balance with better error handling
        let balanceInDoge = 0;
        try {
          const rawBalance = parseFloat(balanceRes.balance);
          console.log('🔢 [WALLET] Raw balance number:', rawBalance);

          // Always convert satoshis to DOGE (1 DOGE = 100,000,000 satoshis)
          balanceInDoge = rawBalance / 100000000;
          console.log('💱 [WALLET] Converted satoshis to DOGE:', balanceInDoge);

        } catch (parseError) {
          console.error('❌ [WALLET] Balance parsing error:', parseError);
          balanceInDoge = 0;
        }

        console.log('💎 [WALLET] Final balance set:', balanceInDoge, 'DOGE');
        setBalance(balanceInDoge);
      } else {
        console.log('❌ [WALLET] Connection rejected by user');
        throw new Error('Connection was rejected by user');
      }
    } catch (error) {
      console.error('💥 [WALLET] Connection error:', error);
      throw error;
    } finally {
      console.log('🏁 [WALLET] Connection process completed');
      setConnecting(false);
    }
  }, [connected, myDoge, connecting]);

  const disconnect = useCallback(async () => {
    console.log('🔌 [WALLET] Disconnect function called...');

    if (!myDoge?.isMyDoge) {
      console.log('❌ [WALLET] MyDoge wallet not installed!');
      throw new Error('MyDoge wallet not installed!');
    }

    try {
      console.log('📞 [WALLET] Calling wallet.disconnect()...');
      const disconnectRes = await myDoge.disconnect();
      console.log('📋 [WALLET] Disconnect response:', disconnectRes);

      if (disconnectRes.disconnected) {
        console.log('✅ [WALLET] Successfully disconnected');
        setConnected(false);
        setAddress(null);
        setBalance(0);
        localStorage.removeItem('mydoge_address');
      }
    } catch (error) {
      console.error('💥 [WALLET] Disconnect error:', error);
      throw error;
    }
  }, [myDoge]);

  const sendTransaction = useCallback(async (recipientAddress: string, amount: number): Promise<string> => {
    console.log('💸 [WALLET] Send transaction called...');
    console.log('📍 [WALLET] Recipient:', recipientAddress);
    console.log('💰 [WALLET] Amount:', amount, 'DOGE');

    if (!myDoge?.isMyDoge) {
      console.log('❌ [WALLET] MyDoge wallet not installed!');
      throw new Error('MyDoge wallet not installed!');
    }

    if (!connected) {
      console.log('❌ [WALLET] Wallet not connected!');
      throw new Error('MyDoge wallet not connected!');
    }

    try {
      console.log('📞 [WALLET] Requesting transaction from wallet...');
      const txReqRes = await myDoge.requestTransaction({
        recipientAddress,
        dogeAmount: amount,
      });
      console.log('✅ [WALLET] Transaction successful! TXID:', txReqRes.txId);
      return txReqRes.txId;
    } catch (error) {
      console.error('💥 [WALLET] Transaction error:', error);
      throw error;
    }
  }, [connected, myDoge]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    console.log('✍️ [WALLET] Sign message called...');
    console.log('📝 [WALLET] Message:', message);

    if (!myDoge?.isMyDoge) {
      console.log('❌ [WALLET] MyDoge wallet not installed!');
      throw new Error('MyDoge wallet not installed!');
    }

    if (!connected) {
      console.log('❌ [WALLET] Wallet not connected!');
      throw new Error('MyDoge wallet not connected!');
    }

    try {
      console.log('📞 [WALLET] Requesting message signature...');
      const signMsgRes = typeof myDoge.requestSignedMessage === 'function'
        ? await myDoge.requestSignedMessage({ message })
        : myDoge.signRequest
          ? await myDoge.signRequest({ message })
          : (() => { throw new Error('MyDoge wallet does not expose a message signing method'); })();
      console.log('✅ [WALLET] Message signed successfully!');
      return normalizeMyDogeSignedMessageResponse(signMsgRes);
    } catch (error) {
      console.error('💥 [WALLET] Message signing error:', error);
      throw error;
    }
  }, [connected, myDoge]);

  const signPSBT = useCallback(async (psbtHex: string): Promise<string> => {
    console.log('🔧 [WALLET] Sign PSBT called...');
    console.log('📄 [WALLET] Input hex size:', psbtHex.length, 'characters');

    if (!myDoge?.isMyDoge) {
      console.log('❌ [WALLET] MyDoge wallet not installed!');
      throw new Error('MyDoge wallet not installed!');
    }

    if (!connected) {
      console.log('❌ [WALLET] Wallet not connected!');
      throw new Error('MyDoge wallet not connected!');
    }

    // Check if the wallet supports PSBT signing through any known API.
    if (!myDoge.requestPsbt && !myDoge.signPSBT && !myDoge.signRequest) {
      console.log('⚠️ [WALLET] PSBT signing not supported by this wallet version');
      throw new Error('PSDT signing not supported by MyDoge wallet');
    }

    try {
      console.log('📞 [WALLET] Requesting signature from wallet...');

      const { normalizedHex, canonicalBase64, signIndexes, isPSBT, sighashType } =
        normalizeMyDogePsbtInput(psbtHex);
      console.log('📄 [WALLET] Input format:', isPSBT ? 'PSBT' : 'Raw Transaction');
      console.log('📄 [WALLET] Sign input indexes:', signIndexes.join(','));
      console.log('[MyDoge] signPSBT:requestPsbt params', {
        rawTxLength: normalizedHex.length,
        rawTxPrefix: normalizedHex.slice(0, 32),
        signIndexes,
        signOnly: true,
        partial: true,
        sighashType,
      });

      if (isPSBT) {
        if (myDoge.signPSBT) {
          console.log('🔧 [WALLET] Using signPSBT method for PSBT hex...');
        } else if (myDoge.requestPsbt) {
          console.log('🔧 [WALLET] signPSBT unavailable — using requestPsbt with PSBT hex (partial sign)...');
        } else if (myDoge.signRequest) {
          console.log('🔧 [WALLET] signPSBT/requestPsbt unavailable — trying signRequest fallbacks...');
        }
      } else {
        console.log('🔧 [WALLET] Using MyDoge signer chain for legacy raw transaction hex...');
      }

      const signPsbtRes = await invokeMyDogePsbtSigner(
        myDoge,
        normalizedHex,
        canonicalBase64,
        signIndexes,
        true,
        isPSBT,
        sighashType,
      );
      console.log('✅ [WALLET] PSBT signing completed via MyDoge signer chain');
      console.log('📄 [WALLET] MyDoge response:', signPsbtRes);
      return signPsbtRes;
    } catch (error) {
      console.error('💥 [WALLET] PSBT signing error:', error);
      throw error;
    }
  }, [connected, myDoge]);

  const signPSBTOnly = useCallback(async (psbtHex: string): Promise<string> => {
    console.log('🔧 [WALLET] Sign PSBT Only called...');
    console.log('📄 [WALLET] Input hex size:', psbtHex.length, 'characters');

    if (!myDoge?.isMyDoge) {
      console.log('❌ [WALLET] MyDoge wallet not installed!');
      throw new Error('MyDoge wallet not installed!');
    }

    if (!connected) {
      console.log('❌ [WALLET] Wallet not connected!');
      throw new Error('MyDoge wallet not connected!');
    }

    // Check if the wallet supports PSBT signing through any known API.
    if (!myDoge.requestPsbt && !myDoge.signPSBT && !myDoge.signRequest) {
      console.log('⚠️ [WALLET] PSBT signing not supported by this wallet version');
      throw new Error('PSDT signing not supported by MyDoge wallet');
    }

    try {
      console.log('📞 [WALLET] Requesting PSBT signature from wallet...');

      const { normalizedHex, canonicalBase64, signIndexes, isPSBT, sighashType } =
        normalizeMyDogePsbtInput(psbtHex);
      console.log('📄 [WALLET] Input format:', isPSBT ? 'PSBT' : 'Raw Transaction');
      console.log('📄 [WALLET] Sign input indexes:', signIndexes.join(','));
      console.log('[MyDoge] signPSBTOnly:requestPsbt params', {
        rawTxLength: normalizedHex.length,
        rawTxPrefix: normalizedHex.slice(0, 32),
        signIndexes,
        signOnly: true,
        partial: true,
        sighashType,
      });

      if (isPSBT) {
        console.log('🔧 [WALLET] Using MyDoge signer chain for PSBT hex (sign only)...');
      } else {
        console.log('🔧 [WALLET] Using MyDoge signer chain for legacy raw tx (sign only)...');
      }

      // preferPsbt: true — doggy.market needs the signed PSBT, not a finalized raw tx.
      // If MyDoge returns both signedRawTx and signedPsbt, we want the PSBT.
      const signPsbtRes = await invokeMyDogePsbtSigner(
        myDoge,
        normalizedHex,
        canonicalBase64,
        signIndexes,
        true,
        isPSBT,
        sighashType,
        true, // preferPsbt
      );
      console.log('✅ [WALLET] Signing completed via MyDoge signer chain', signPsbtRes);
      console.log('📄 [WALLET] MyDoge response:', signPsbtRes);
      return signPsbtRes;
    } catch (error) {
      console.error('💥 [WALLET] PSBT signing error:', error);
      throw error;
    }
  }, [connected, myDoge]);

  const debugProbeRequestPsbt = useCallback(async (psbtInput: string): Promise<RequestPsbtProbeResult[]> => {
  console.log('[MyDoge][Probe] start', {
    connected,
    hasRequestPsbt: !!myDoge?.requestPsbt,
    hasSignPSBT: !!myDoge?.signPSBT,
    hasSignRequest: !!myDoge?.signRequest,
    inputLength: psbtInput.length,
    inputPrefix: psbtInput.slice(0, 32),
  });

    if (!myDoge?.requestPsbt && !myDoge?.signPSBT && !myDoge?.signRequest) {
      throw new Error('MyDoge PSDT signing is not available.');
    }

    const { normalizedHex, canonicalBase64, signIndexes, isPSBT, sighashType } =
      normalizeMyDogePsbtInput(psbtInput);
    const attempts: Array<{ label: string; params: Record<string, unknown> }> = [
      {
        label: 'partial-sign-only',
        params: {
          rawTx: normalizedHex,
          indexes: signIndexes,
          signOnly: true,
          partial: true,
          sighashType,
        },
      },
      {
        label: 'full-sign-default',
        params: {
          rawTx: normalizedHex,
          indexes: signIndexes,
          signOnly: false,
          partial: false,
        },
      },
      {
        label: 'minimal-indexed',
        params: {
          rawTx: normalizedHex,
          indexes: signIndexes,
        },
      },
    ];
    if (myDoge?.signRequest) {
      attempts.push(
        {
          label: 'sign-request-raw',
          params: {
            rawTx: normalizedHex,
            indexes: signIndexes,
            signOnly: true,
            partial: true,
            sighashType,
          },
        },
        {
          label: 'sign-request-psbt-hex',
          params: {
            psbtHex: normalizedHex,
            indexes: signIndexes,
            signOnly: true,
            partial: true,
            sighashType,
          },
        },
      );
      if (canonicalBase64) {
        attempts.push({
          label: 'sign-request-psbt-base64',
          params: {
            psbtBase64: canonicalBase64,
            indexes: signIndexes,
            signOnly: true,
            partial: true,
            sighashType,
          },
        });
      }
    }

    console.log('[MyDoge][Probe] normalized input', {
      normalizedLength: normalizedHex.length,
      normalizedPrefix: normalizedHex.slice(0, 32),
      signIndexes,
      isPSBT,
      sighashType,
      attempts: attempts.map((attempt) => attempt.label),
    });

    const results: RequestPsbtProbeResult[] = [];
    for (const attempt of attempts) {
      try {
        console.log('[MyDoge][Probe] attempt:start', {
          label: attempt.label,
          params: attempt.params,
        });
        const useSignRequest = attempt.label.startsWith('sign-request');
        const invoke = useSignRequest ? myDoge.signRequest : myDoge.requestPsbt;
        if (!invoke) {
          throw new Error(useSignRequest ? 'signRequest not available' : 'requestPsbt not available');
        }
        const response = await invoke(attempt.params as any);
        console.log('[MyDoge][Probe] attempt:response', {
          label: attempt.label,
          response,
        });
        results.push({
          label: attempt.label,
          params: attempt.params,
          ok: true,
          response,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[MyDoge][Probe] attempt:error', {
          label: attempt.label,
          error: message,
        });
        results.push({
          label: attempt.label,
          params: attempt.params,
          ok: false,
          error: message,
        });
      }
    }

    console.log('[MyDoge][Probe] done', results);
    return results;
  }, [connected, myDoge]);

  const sendInscription = useCallback(async (recipientAddress: string, location: string): Promise<string> => {
    console.log('📤 [WALLET] Send inscription called...');
    console.log('📍 [WALLET] Recipient address:', recipientAddress);
    console.log('🎯 [WALLET] Inscription location:', location);

    if (!myDoge?.isMyDoge) {
      console.log('❌ [WALLET] MyDoge wallet not installed!');
      throw new Error('MyDoge wallet not installed!');
    }

    if (!connected) {
      console.log('❌ [WALLET] Wallet not connected!');
      throw new Error('MyDoge wallet not connected!');
    }

    try {
      console.log('📞 [WALLET] Requesting inscription transfer from wallet...');
      const transferRes = await myDoge.requestInscriptionTransaction({
        recipientAddress,
        location,
      });
      console.log('✅ [WALLET] Inscription transfer successful! TXID:', transferRes.txId);
      return transferRes.txId;
    } catch (error) {
      console.error('💥 [WALLET] Inscription transfer error:', error);
      throw error;
    }
  }, [connected, myDoge]);

  const getTransactionStatus = useCallback(async (txId: string) => {
    console.log('🔍 [WALLET] Get transaction status called...');
    console.log('🆔 [WALLET] TXID:', txId);

    if (!myDoge?.isMyDoge) {
      console.log('❌ [WALLET] MyDoge wallet not installed!');
      throw new Error('MyDoge wallet not installed!');
    }

    try {
      console.log('📞 [WALLET] Requesting transaction status...');
      const txStatusRes = await myDoge.getTransactionStatus({ txId });
      console.log('📊 [WALLET] Transaction status:', txStatusRes);
      return txStatusRes;
    } catch (error) {
      console.error('💥 [WALLET] Get transaction status error:', error);
      throw error;
    }
  }, [myDoge]);

  const value: UseMyDogeWalletReturn = {
    myDoge,
    connected,
    address,
    balance,
    connecting,
    connect,
    disconnect,
    sendTransaction,
    signMessage,
    signPSBT,
    signPSBTOnly,
    sendInscription,
    getTransactionStatus,
    debugProbeRequestPsbt,
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__DOJAKWEB_DEBUG__ = {
      ...(window as any).__DOJAKWEB_DEBUG__,
      myDoge: {
        probeRequestPsbt: debugProbeRequestPsbt,
      },
    };
    console.log('[MyDoge] debug probe attached to window.__DOJAKWEB_DEBUG__.myDoge.probeRequestPsbt');
  }, [debugProbeRequestPsbt]);

  return (
    <MyDogeWalletContext.Provider value={value}>
      {/* @ts-ignore - Next.js type checking issue with React.ReactNode */}
      {children}
    </MyDogeWalletContext.Provider>
  );
}
