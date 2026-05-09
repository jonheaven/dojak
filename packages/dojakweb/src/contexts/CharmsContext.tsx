/**
 * Charms Context
 * 
 * Manages Charms state (balances, tokens, beaming status)
 * Provides balance tracking and token operations.
 */

import type { CharmsChainId, CharmsToken, TokenBeam } from '../lib/charms/types';
import { createContext, useCallback, useState, useContext, ReactNode, useMemo } from 'react';
import { useUnifiedWallet } from './UnifiedWalletContext';
import { charmsService } from '../services/charmsService';
import { walletDataApi } from '../utils/api';
import { toast } from 'sonner';

export interface CharmsContextType {
  // Charms token balances
  charmsTokens: Map<string, CharmsToken> | null;
  isLoadingCharms: boolean;
  charmsError: string | null;

  // Beam operations
  activeBeams: TokenBeam[];
  isBeamingInProgress: boolean;

  // Operations
  refreshCharmsBalances: () => Promise<void>;
  initiateBeam: (params: {
    ticker: string;
    fromChain: CharmsChainId;
    toChain: CharmsChainId;
    amount: bigint;
    destAddress: string;
  }) => Promise<void>;
  cancelBeam: (beamId: string) => Promise<void>;
}

const CharmContext = createContext<CharmsContextType | undefined>(undefined);

export function useCharms(): CharmsContextType {
  const context = useContext(CharmContext);
  if (!context) {
    throw new Error('useCharms must be used within a CharmsProvider');
  }
  return context;
}

interface CharmsProviderProps {
  children: ReactNode;
}

export function CharmsProvider({ children }: CharmsProviderProps) {
  const { address, connected } = useUnifiedWallet();
  const [charmsTokens, setCharmsTokens] = useState<Map<string, CharmsToken> | null>(null);
  const [isLoadingCharms, setIsLoadingCharms] = useState(false);
  const [charmsError, setCharmsError] = useState<string | null>(null);
  const [activeBeams, setActiveBeams] = useState<TokenBeam[]>([]);
  const [isBeamingInProgress, setIsBeamingInProgress] = useState(false);

  const refreshCharmsBalances = useCallback(async () => {
    if (!connected || !address) {
      setCharmsTokens(new Map());
      return;
    }
    try {
      setIsLoadingCharms(true);
      setCharmsError(null);
      const response = await walletDataApi.fetchUtxos(address);
      const utxos = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.utxos)
          ? (response as any).utxos
          : [];
      const charmResults = await Promise.allSettled(
        utxos
          .filter((utxo: any) => typeof utxo.txid === 'string' && Number.isFinite(Number(utxo.vout)))
          .map((utxo: any) => charmsService.getCharmsByUtxo(utxo.txid, Number(utxo.vout))),
      );
      const indexed = charmResults.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      const nextTokens = new Map<string, CharmsToken>();
      for (const charm of indexed) {
        if (charm.spent_by_txid) continue;
        const key = `${charm.txid}:${charm.vout}:${charm.app_id}`;
        const rawBalance = charm.charm_data?.balance ?? charm.charm_data?.amount ?? charm.charm_data?.value ?? '1';
        const balance = BigInt(String(rawBalance));
        nextTokens.set(key, {
          id: key,
          chainId: 'doge',
          txid: charm.txid,
          vout: charm.vout,
          confirmed: true,
          ticker: charm.app_id,
          name: charm.app_id,
          balance,
          decimals: 0,
          address,
          scriptPubKey: '',
          transferHistory: [],
          chainSupply: { btc: 0n, ltc: 0n, doge: balance, ada: 0n },
          beamHistory: [],
          metadata: charm.charm_data,
        } as CharmsToken);
      }
      setCharmsTokens(nextTokens);
    } catch (error) {
      console.error('Failed to refresh Charms balances:', error);
      setCharmsError('Unable to retrieve Charms tokens');
      toast.error('Failed to load Charms tokens');
    } finally {
      setIsLoadingCharms(false);
    }
  }, [address, connected]);

  const initiateBeam = useCallback(
    async (params: {
      ticker: string;
      fromChain: CharmsChainId;
      toChain: CharmsChainId;
      amount: bigint;
      destAddress: string;
    }) => {
      try {
        setIsBeamingInProgress(true);
        // TODO: Call charmsService.beamAsset()
        console.log('Initiating beam:', params);
      } catch (error) {
        console.error('Beam failed:', error);
        setCharmsError(`Beam failed: ${error}`);
        toast.error('Beam operation failed');
      } finally {
        setIsBeamingInProgress(false);
      }
    },
    [],
  );

  const cancelBeam = useCallback(async (beamId: string) => {
    try {
      // TODO: Cancel beam operation
      console.log('Cancelling beam:', beamId);
      setActiveBeams((beams) => beams.filter((b) => b.beamId !== beamId));
    } catch (error) {
      console.error('Failed to cancel beam:', error);
      setCharmsError(`Failed to cancel beam: ${error}`);
      toast.error('Failed to cancel beam');
    }
  }, []);

  const value = useMemo<CharmsContextType>(
    () => ({
      charmsTokens,
      isLoadingCharms,
      charmsError,
      activeBeams,
      isBeamingInProgress,
      refreshCharmsBalances,
      initiateBeam,
      cancelBeam,
    }),
    [charmsTokens, isLoadingCharms, charmsError, activeBeams, isBeamingInProgress, refreshCharmsBalances, initiateBeam, cancelBeam],
  );

  return <CharmContext.Provider value={value}>{children}</CharmContext.Provider>;
}
