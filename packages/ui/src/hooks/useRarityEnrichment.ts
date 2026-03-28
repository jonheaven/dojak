import { useCallback } from 'react';
import { Inscription } from '@dojak/core/types';
import { calculateRarityTier, RarityTier } from '@dojak/core/lib/rarity';

/**
 * Hook for enriching inscriptions with rarity tier data
 * 
 * This can work in two ways:
 * 1. Locally: Calculate rarity based on block height and offset (if available)
 * 2. From backend: Use rarity data returned from indexer API
 */
export function useRarityEnrichment() {
  /**
   * Enrich a single inscription with rarity data
   * Attempts to use backend rarity data first, falls back to local calculation
   */
  const enrichInscription = useCallback((inscription: Inscription): Inscription => {
    // If rarity is already provided by backend, use it
    if (inscription.rarity) {
      return inscription;
    }

    // Try to calculate rarity locally if we have block height and offset
    if (inscription.utxoHeight !== undefined && inscription.offset !== undefined) {
      try {
        const rarityInfo = calculateRarityTier(inscription.utxoHeight, inscription.offset);
        return {
          ...inscription,
          rarity: {
            tier: rarityInfo.tier,
            blockHeight: rarityInfo.block,
            koinuStart: rarityInfo.koinu_start,
            percentageOfSupply: rarityInfo.percentage_of_supply
          }
        };
      } catch (error) {
        // If calculation fails, return inscription without rarity
        console.warn(`Failed to calculate rarity for inscription ${inscription.inscriptionId}:`, error);
        return inscription;
      }
    }

    return inscription;
  }, []);

  /**
   * Enrich multiple inscriptions with rarity data
   */
  const enrichInscriptions = useCallback((inscriptions: Inscription[]): Inscription[] => {
    return inscriptions.map(enrichInscription);
  }, [enrichInscription]);

  return { enrichInscription, enrichInscriptions };
}
