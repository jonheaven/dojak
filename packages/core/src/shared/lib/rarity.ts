/**
 * Doginals Rarity Tier System
 * Based on the first koinu (Dogecoin satoshi equivalent) index of each block
 * 
 * Koinu is the smallest unit of Dogecoin (1 DOGE = 100,000,000 koinu)
 * 
 * Rarity tiers from highest to lowest:
 * - MYTHIC: First koinu of the genesis block (block 0)
 * - LEGENDARY: First koinu of any block
 * - EPIC: Last koinu of any block
 * - RARE: First koinu after 10% of total subsidy reached
 * - UNCOMMON: First koinu after 50% of total subsidy reached
 * - COMMON: Everything else
 */

import { RarityTier } from '../types';

export { RarityTier };

export interface RarityInfo {
  tier: RarityTier;
  koinu_start: number;
  koinu_end: number;
  block: number;
  subsidy: number;
  percentage_of_supply: number;
}

/**
 * Bitcoin block subsidy schedule
 * Halves every 210,000 blocks (approximately 4 years)
 * Dogecoin has 1 minute block intervals (vs 10 min for Bitcoin)
 */
export const DOGECOIN_SUBSIDY_SCHEDULE = [
  { blocks: 100000, subsidy: 500000000 },    // First 100k blocks: 500 DOGE per block
  { blocks: 200000, subsidy: 250000000 },    // 100k-200k: 250 DOGE
  { blocks: 300000, subsidy: 125000000 },    // 200k-300k: 125 DOGE
  { blocks: 400000, subsidy: 62500000 },     // 300k-400k: 62.5 DOGE
  // Continue halving indefinitely
];

/**
 * Get block subsidy for a given block height
 * Each block produces koinu (satoshis) based on the block reward
 * Dogecoin subsidy halves approximately every 105,120,000 DOGE (not time-based)
 */
export function getBlockSubsidy(blockHeight: number): number {
  // Dogecoin simple subsidy schedule
  if (blockHeight < 100000) {
    return 500000000; // 500 DOGE = 500,000,000 koinu
  } else if (blockHeight < 200000) {
    return 250000000;
  } else if (blockHeight < 300000) {
    return 125000000;
  } else if (blockHeight < 400000) {
    return 62500000;
  } else if (blockHeight < 500000) {
    return 31250000;
  } else if (blockHeight < 600000) {
    return 15625000;
  } else if (blockHeight < 700000) {
    return 10000000; // Capped at 10 DOGE per block after this
  } else {
    return 10000000; // Fixed 10 DOGE per block
  }
}

/**
 * Calculate the total koinuage (total sats) up to and including a block
 * Used to determine percentile for RARE/UNCOMMON tiers
 */
export function calculateCumulativeKoinuage(upToBlockHeight: number): number {
  let total = 0;
  
  // Break into ranges for efficiency
  const ranges = [
    { end: 100000, subsidy: 500000000 },
    { end: 200000, subsidy: 250000000 },
    { end: 300000, subsidy: 125000000 },
    { end: 400000, subsidy: 62500000 },
    { end: 500000, subsidy: 31250000 },
    { end: 600000, subsidy: 15625000 },
    { end: 700000, subsidy: 10000000 },
  ];

  let currentBlock = 0;

  for (const range of ranges) {
    if (currentBlock >= upToBlockHeight) break;

    const rangeEnd = Math.min(range.end, upToBlockHeight);
    const blockCount = rangeEnd - currentBlock;
    total += blockCount * range.subsidy;
    currentBlock = rangeEnd;
  }

  // Handle blocks beyond 700000
  if (upToBlockHeight > 700000) {
    total += (upToBlockHeight - 700000) * 10000000;
  }

  return total;
}

/**
 * Get the starting koinu for a given block
 * This is the cumulative total koinu up to that block
 */
export function getBlockStartingKoinu(blockHeight: number): number {
  return calculateCumulativeKoinuage(blockHeight);
}

/**
 * Calculate rarity tier for an inscription based on its koinu position
 * 
 * @param blockHeight Block where inscription was created
 * @param offsetInBlock Position within block (0-based from first koinu)
 * @returns RarityInfo with tier and metadata
 */
export function calculateRarityTier(
  blockHeight: number,
  offsetInBlock: number = 0
): RarityInfo {
  const startingKoinu = getBlockStartingKoinu(blockHeight);
  const blockSubsidy = getBlockSubsidy(blockHeight);
  const koinuIndex = startingKoinu + offsetInBlock;

  // Mythic: First koinu of genesis block
  if (blockHeight === 0 && offsetInBlock === 0) {
    return {
      tier: RarityTier.MYTHIC,
      koinu_start: koinuIndex,
      koinu_end: koinuIndex + 1,
      block: blockHeight,
      subsidy: blockSubsidy,
      percentage_of_supply: 0.0001 // First satoshi
    };
  }

  // Legendary: First koinu of any block
  if (offsetInBlock === 0) {
    return {
      tier: RarityTier.LEGENDARY,
      koinu_start: koinuIndex,
      koinu_end: koinuIndex + 1,
      block: blockHeight,
      subsidy: blockSubsidy,
      percentage_of_supply: (koinuIndex / getTotalKoinuage()) * 100
    };
  }

  // Epic: Last koinu of any block
  if (offsetInBlock === blockSubsidy - 1) {
    return {
      tier: RarityTier.EPIC,
      koinu_start: koinuIndex,
      koinu_end: koinuIndex + 1,
      block: blockHeight,
      subsidy: blockSubsidy,
      percentage_of_supply: (koinuIndex / getTotalKoinuage()) * 100
    };
  }

  const totalKoinuage = getTotalKoinuage();
  const percentageReached = (koinuIndex / totalKoinuage) * 100;

  // Rare: First koinu after 10% mark
  if (offsetInBlock === 0 && percentageReached <= 10) {
    return {
      tier: RarityTier.RARE,
      koinu_start: koinuIndex,
      koinu_end: koinuIndex + 1,
      block: blockHeight,
      subsidy: blockSubsidy,
      percentage_of_supply: percentageReached
    };
  }

  // Uncommon: First koinu after 50% mark
  if (offsetInBlock === 0 && percentageReached <= 50) {
    return {
      tier: RarityTier.UNCOMMON,
      koinu_start: koinuIndex,
      koinu_end: koinuIndex + 1,
      block: blockHeight,
      subsidy: blockSubsidy,
      percentage_of_supply: percentageReached
    };
  }

  // Common: Everything else
  return {
    tier: RarityTier.COMMON,
    koinu_start: koinuIndex,
    koinu_end: koinuIndex + 1,
    block: blockHeight,
    subsidy: blockSubsidy,
    percentage_of_supply: percentageReached
  };
}

/**
 * Get total koinuage (approximate, based on halving schedule)
 * Dogecoin total supply is capped at ~131.8 billion DOGE
 * = ~131,800,000,000,000,000 koinu (131.8 quadrillion koinu)
 */
export function getTotalKoinuage(): number {
  // This is an approximation - actual total is ~131,800,000,000 DOGE
  // = 131,800,000,000,000,000 koinu
  return 131800000000000000;
}

/**
 * Get human-readable description of rarity tier
 */
export function getRarityTierLabel(tier: RarityTier): string {
  const labels: Record<RarityTier, string> = {
    [RarityTier.MYTHIC]: 'Mythic',
    [RarityTier.LEGENDARY]: 'Legendary',
    [RarityTier.EPIC]: 'Epic',
    [RarityTier.RARE]: 'Rare',
    [RarityTier.UNCOMMON]: 'Uncommon',
    [RarityTier.COMMON]: 'Common'
  };
  return labels[tier];
}

/**
 * Get color for rarity tier (for UI display)
 */
export function getRarityTierColor(tier: RarityTier): string {
  const colors: Record<RarityTier, string> = {
    [RarityTier.MYTHIC]: '#FFD700', // Gold
    [RarityTier.LEGENDARY]: '#FF69B4', // Hot pink
    [RarityTier.EPIC]: '#9370DB', // Purple
    [RarityTier.RARE]: '#00BFFF', // Deep Sky Blue
    [RarityTier.UNCOMMON]: '#32CD32', // Lime green
    [RarityTier.COMMON]: '#A9A9A9' // Dark gray
  };
  return colors[tier];
}
