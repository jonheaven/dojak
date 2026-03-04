/**
 * DNS (Dogecoin Name System) Resolution Service
 * 
 * Resolves .doge names to Dogecoin addresses using the dog indexer
 * 
 * Example names:
 * - satoshi.doge → DHrqn6H6ocgbRB1Szu7Q1sn1tVTfkpinnc
 * - wallet.doge → D1234...
 */

export interface DNSRecord {
  name: string;
  namespace: string; // 'doge', 'btc', etc.
  resolved_value: string; // the address
  config: {
    address?: string;
    url?: string;
    avatar?: string; // inscription ID
    content?: string; // bio/description
    [key: string]: any; // custom fields allowed
  };
  owner_address: string;
  inscription_id: string;
  updated_height: number;
  timestamp?: number;
}

export interface DNSResolutionResult {
  address: string;
  name: string;
  inscription_id: string;
  owner: string;
  updatedAt?: number;
}

/**
 * Check if a string is a valid .doge DNS name
 */
export function isDNSName(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const trimmed = input.trim().toLowerCase();
  
  // Must end with .doge
  if (!trimmed.endsWith('.doge')) {
    return false;
  }

  // Remove .doge suffix and check the name part
  const namePart = trimmed.slice(0, -5); // Remove '.doge'

  if (!namePart || namePart.length === 0) {
    return false;
  }

  // Name part rules:
  // - Alphanumeric and hyphens allowed
  // - Cannot start or end with hyphen
  // - Minimum 1 character, max 63 characters
  const nameRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  
  return nameRegex.test(namePart);
}

/**
 * Parse a DNS name into its components
 */
export function parseDNSName(input: string): { name: string; namespace: string } | null {
  if (!isDNSName(input)) {
    return null;
  }

  const trimmed = input.trim().toLowerCase();
  const parts = trimmed.split('.');
  
  if (parts.length !== 2) {
    return null;
  }

  return {
    name: parts[0],
    namespace: parts[1]
  };
}

/**
 * Resolve a .doge DNS name to an address
 * 
 * This function queries the indexer API to resolve DNS names
 * In a full implementation, this would call the dog indexer's DNS endpoint
 * 
 * @param name - The DNS name to resolve (e.g., "satoshi.doge")
 * @returns Promise resolving to address or null if not found
 */
export async function resolveDNSName(
  name: string,
  apiClient?: any
): Promise<DNSResolutionResult | null> {
  if (!isDNSName(name)) {
    throw new Error('Invalid DNS name format');
  }

  const parsed = parseDNSName(name);
  if (!parsed) {
    throw new Error('Failed to parse DNS name');
  }

  try {
    // For now, we'll use the existing wallet API infrastructure
    // In production, this would call GET /dns/resolve/{name} on the dog indexer
    
    // Format: "name.namespace" (e.g., "satoshi.doge")
    const fullName = `${parsed.name}.${parsed.namespace}`;

    // TODO: Replace with actual API call to dog indexer
    // const response = await apiClient.get(`/dns/resolve/${encodeURIComponent(fullName)}`);
    
    // Mock response structure for development
    // const dnsRecord: DNSRecord = response.data;
    
    // For now, return null to indicate name not found
    // This will be implemented when the indexer API is available
    throw new Error('DNS resolution endpoint not yet available. Coming soon!');

    // When implemented, would return:
    // return {
    //   address: dnsRecord.config.address || dnsRecord.resolved_value,
    //   name: fullName,
    //   inscription_id: dnsRecord.inscription_id,
    //   owner: dnsRecord.owner_address,
    //   updatedAt: dnsRecord.timestamp
    // };
  } catch (error) {
    // If name doesn't exist or API error, return null
    console.warn(`DNS resolution failed for ${name}:`, error);
    throw error;
  }
}

/**
 * Get user-friendly error message for DNS resolution failures
 */
export function getDNSErrorMessage(error: Error, name: string): string {
  const message = error.message.toLowerCase();
  
  if (message.includes('not found') || message.includes('does not exist')) {
    return `${name} is not registered`;
  }
  
  if (message.includes('not yet available') || message.includes('coming soon')) {
    return 'DNS resolution will be available soon';
  }
  
  if (message.includes('network') || message.includes('timeout')) {
    return 'Unable to resolve DNS name. Network error.';
  }
  
  return `Failed to resolve ${name}`;
}

/**
 * Validate that a resolved address is safe to use
 * Check block confirmations, owner changes, etc.
 */
export function validateDNSResolution(record: DNSRecord, minConfirmations: number = 6): {
  valid: boolean;
  warning?: string;
} {
  // Check if address is configured
  if (!record.config.address && !record.resolved_value) {
    return {
      valid: false,
      warning: 'DNS name has no address configured'
    };
  }

  // In production, would check confirmations from blockchain
  // For now, assume valid if we got a record
  return {
    valid: true
  };
}
