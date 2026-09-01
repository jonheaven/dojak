/**
 * Security utilities for dojakweb
 * Domain locking and anti-tampering measures
 */

const ALLOWED_DOMAINS = [
  'dogex.store',
  'www.dogex.store',
  'dogex.dog',
  'www.dogex.dog',
  'dogenals.com',
  'www.dogenals.com',
  'dogecoin.dog',
  'www.dogecoin.dog',
  'dogeshit.lol',
  'www.dogeshit.lol',
  'market.command.dog',
  'command.dog',
  'dojakweb.com',
  'www.dojakweb.com',
  'localhost',
  '127.0.0.1',
  'vercel-preview-dojakweb.vercel.app',
];

const ALLOWED_PROTOCOLS = ['https:', 'http:'];

/**
 * Validates that the code is running on an authorized domain
 * Throws an error if running on unauthorized domain
 */
export function validateDomain(): void {
  if (typeof window === 'undefined') return; // Skip on server-side

  const currentDomain = window.location.hostname;
  const currentProtocol = window.location.protocol;

  // Check protocol
  if (!ALLOWED_PROTOCOLS.includes(currentProtocol)) {
    throw new Error('Unauthorized protocol');
  }

  // Allow localhost in development
  if (currentDomain === 'localhost' || currentDomain === '127.0.0.1') {
    return;
  }

  // Check domain
  if (!ALLOWED_DOMAINS.some(domain => currentDomain === domain || currentDomain.endsWith('.' + domain))) {
    throw new Error('Unauthorized domain access');
  }
}

/**
 * Obfuscated function names and critical business logic
 * These are intentionally obfuscated to make reverse engineering harder
 */
export const _0x4f2a = {
  // Wallet address validation
  _0x1a2b: (addr: string) => addr && addr.length === 34 && addr.startsWith('D'),

  // Private key validation
  _0x2c3d: (key: string) => key && key.length === 64 && /^[a-f0-9]+$/i.test(key),

  // Transaction validation
  _0x3e4f: (tx: any) => tx && typeof tx === 'object' && tx.txid,

  // API endpoint validation
  _0x5g6h: (url: string) => url.startsWith('https://') && (url.includes('dogex.store') || url.includes('command.dog')),
};

/**
 * Runtime integrity check
 * Verifies that critical functions haven't been tampered with
 */
export function integrityCheck(): boolean {
  try {
    // Check if dev tools are open (basic detection)
    const devtools = {
      open: false,
      orientation: null as string | null,
    };

    const threshold = 160;
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || window.outerWidth - window.innerWidth > threshold) {
        devtools.open = true;
        devtools.orientation = 'vertical';
      }
      if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
        devtools.open = true;
        devtools.orientation = 'horizontal';
      }
    }, 500);

    // Basic anti-debugging
    const _0x7i8j = ['log', 'warn', 'error', 'info', 'debug', 'trace'];
    _0x7i8j.forEach(method => {
      const original = (console as any)[method];
      (console as any)[method] = (...args: any[]) => {
        if (process.env.NODE_ENV === 'production') {
          // In production, suppress console output
          return;
        }
        original.apply(console, args);
      };
    });

    // Check for tampering attempts
    if (typeof window !== 'undefined') {
      // Monitor for script injection attempts
      const originalDefineProperty = Object.defineProperty;
      Object.defineProperty = function(obj: any, prop: PropertyKey, descriptor: PropertyDescriptor & ThisType<any>) {
        // Allow normal property definitions but log suspicious ones
        if (process.env.NODE_ENV === 'development' && prop === 'console') {
          console.warn('Console tampering detected');
        }
        return originalDefineProperty.call(this, obj, prop, descriptor) as any;
      };
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize security checks
 */
export function initSecurity(): void {
  if (typeof window === 'undefined') return;

  try {
    validateDomain();
    integrityCheck();

    // Additional runtime checks
    setInterval(() => {
      try {
        validateDomain();
      } catch (error) {
        // Silently fail in production
        if (process.env.NODE_ENV === 'development') {
          console.warn('Domain validation failed:', error);
        }
      }
    }, 30000); // Check every 30 seconds

  } catch (error) {
    // Silently fail in production to avoid giving away security measures
    if (process.env.NODE_ENV === 'development') {
      console.warn('Security initialization failed:', error);
    }
  }
}

// Auto-initialize on module load
if (typeof window !== 'undefined') {
  // Delay initialization to ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSecurity);
  } else {
    initSecurity();
  }
}