// CSV Template Generator for Dojakweb wallet suite templates
// Creates downloadable sample CSV files with valid Dogecoin addresses

export interface TemplateOptions {
  size: number;
  tokenAmount?: number;
  filename?: string;
}

/**
 * Generate a valid Dogecoin address for sample data
 * Uses a deterministic approach to create valid-looking addresses
 */
function generateSampleDogecoinAddress(index: number = 0): string {
  // Base58 characters used in Dogecoin addresses
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  // Dogecoin addresses start with 'D' and are 34 characters long
  let address = 'D';

  // Create a pseudo-random but deterministic address based on index
  const seed = index * 997; // Prime multiplier for variety
  let random = seed;

  for (let i = 0; i < 33; i++) {
    random = (random * 1103515245 + 12345) & 0x7fffffff; // Linear congruential generator
    const charIndex = random % base58Chars.length;
    address += base58Chars[charIndex];
  }

  return address;
}

/**
 * Generate CSV content for a wallet suite template
 */
export function generateCSVTemplate(options: TemplateOptions): string {
  const { size, tokenAmount = 100 } = options;

  let csvContent = 'Address,Amount\n'; // CSV header

  for (let i = 0; i < size; i++) {
    const sampleAddress = generateSampleDogecoinAddress(i);
    const amount = tokenAmount;
    csvContent += `${sampleAddress},${amount}\n`;
  }

  return csvContent;
}

/**
 * Download a CSV template file
 */
export function downloadCSVTemplate(options: TemplateOptions): void {
  const { size, tokenAmount = 100, filename } = options;

  const csvContent = generateCSVTemplate({ size, tokenAmount });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `dojakweb-wallet-template-${size}-wallets.csv`;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);

  // Calculate total tokens for logging
  const totalTokens = size * tokenAmount;
  console.log(`🐕 Dojakweb template spawned: ${size} wallets @ ${tokenAmount} each – total ${totalTokens} tokens`);
}

/**
 * Get template statistics
 */
export function getTemplateStats(options: TemplateOptions): {
  walletCount: number;
  tokenAmount: number;
  totalTokens: number;
  estimatedCost: number;
} {
  const { size, tokenAmount = 100 } = options;

  return {
    walletCount: size,
    tokenAmount,
    totalTokens: size * tokenAmount,
    estimatedCost: Math.ceil(size / 100) * 0.05 + size * 0.025 // Rough fee estimate
  };
}

/**
 * Predefined template configurations
 */
export const templatePresets = {
  small: { size: 5, tokenAmount: 100, label: 'Small Test (5 wallets)' },
  medium: { size: 50, tokenAmount: 100, label: 'Medium Drop (50 wallets)' },
  large: { size: 100, tokenAmount: 50, label: 'Large Drop (100 wallets)' },
  max: { size: 500, tokenAmount: 20, label: 'Max Blast (500 wallets)' }
} as const;
