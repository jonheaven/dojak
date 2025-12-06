# Dojak Wallet Integration Guide for BorkStarter

This guide shows how to integrate BorkStarter with the Dojak wallet extension for Dogecoin dApps.

## Prerequisites

- Dojak wallet extension installed and set up
- BorkStarter dApp running on a web server (not localhost for production testing)

## Wallet Detection

First, check if the Dojak wallet is installed:

```javascript
// Check if Dojak wallet is available
const isDojakAvailable = () => {
  return typeof window !== 'undefined' && (window.dojak || window.dojak_wallet);
};

// Get the wallet provider
const getDojakProvider = () => {
  return window.dojak || window.dojak_wallet;
};
```

## Basic Connection Flow

Here's the complete wallet connection and verification flow:

```javascript
import React, { useState, useEffect } from 'react';

const BorkStarterWalletConnector = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);

  // Check if wallet is available
  const isWalletAvailable = () => {
    return typeof window !== 'undefined' && (window.dojak || window.dojak_wallet);
  };

  // Connect to wallet
  const connectWallet = async () => {
    if (!isWalletAvailable()) {
      setError('Dojak wallet extension not found. Please install it first.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const provider = getDojakProvider();

      // Request account access
      const accounts = await provider.request({
        method: 'requestAccounts'
      });

      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);
        setIsConnected(true);

        // Get balance
        await loadBalance(address);

        // Sign verification message
        await signVerificationMessage(address);
      }
    } catch (err) {
      console.error('Connection failed:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Load wallet balance
  const loadBalance = async (address) => {
    try {
      const provider = getDojakProvider();
      const balanceData = await provider.request({
        method: 'getBalanceV2'
      });

      setBalance(balanceData);
    } catch (err) {
      console.error('Failed to load balance:', err);
    }
  };

  // Sign message for wallet verification
  const signVerificationMessage = async (address) => {
    try {
      const provider = getDojakProvider();

      const message = `Verify wallet ownership for BorkStarter\\nTimestamp: ${Date.now()}\\nAddress: ${address}`;

      const signature = await provider.request({
        method: 'signMessage',
        params: {
          message: message,
          type: 'ecdsa' // or 'bip322-simple' for Bitcoin-style verification
        }
      });

      console.log('Verification signature:', signature);

      // Here you would typically send the signature to your backend
      // for verification along with the original message

      // Example API call:
      // await verifyWalletOwnership(address, message, signature);

    } catch (err) {
      console.error('Message signing failed:', err);
      setError('Failed to verify wallet ownership');
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      const provider = getDojakProvider();
      await provider.request({
        method: 'disconnect'
      });
    } catch (err) {
      console.error('Disconnect failed:', err);
    }

    setWalletAddress(null);
    setIsConnected(false);
    setBalance(null);
  };

  // Listen for wallet events
  useEffect(() => {
    if (!isWalletAvailable()) return;

    const provider = getDojakProvider();

    const handleAccountsChanged = (accounts) => {
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);
        loadBalance(accounts[0]);
      } else {
        setWalletAddress(null);
        setIsConnected(false);
        setBalance(null);
      }
    };

    const handleNetworkChanged = (network) => {
      console.log('Network changed:', network);
      // Handle network changes if needed
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('networkChanged', handleNetworkChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('networkChanged', handleNetworkChanged);
    };
  }, []);

  return (
    <div className="wallet-connector">
      {!isConnected ? (
        <button
          onClick={connectWallet}
          disabled={isConnecting || !isWalletAvailable()}
        >
          {isConnecting ? 'Connecting...' :
           !isWalletAvailable() ? 'Install Dojak Wallet' :
           'Connect Dojak Wallet'}
        </button>
      ) : (
        <div className="connected-wallet">
          <div>Connected: {walletAddress}</div>
          {balance && (
            <div>
              Balance: {(balance.availableBalance / 100000000).toFixed(8)} DOGE
            </div>
          )}
          <button onClick={disconnectWallet}>Disconnect</button>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default BorkStarterWalletConnector;
```

## Available API Methods

### Account Management
```javascript
// Request account access (shows approval popup)
const accounts = await provider.request({ method: 'requestAccounts' });

// Get connected accounts
const accounts = await provider.request({ method: 'getAccounts' });

// Disconnect wallet
await provider.request({ method: 'disconnect' });
```

### Message Signing
```javascript
// Sign a message (shows approval popup)
const signature = await provider.request({
  method: 'signMessage',
  params: {
    message: 'Your message here',
    type: 'ecdsa' // or 'bip322-simple'
  }
});

// Verify BIP322 signature
const isValid = await provider.verifyMessageOfBIP322Simple(
  address, message, signature
);
```

### Balance & Network Info
```javascript
// Get balance (v2 includes available/unavailable breakdown)
const balance = await provider.request({ method: 'getBalanceV2' });
// Returns: { availableBalance: number, unavailableBalance: number, totalBalance: number }

// Get network info
const network = await provider.request({ method: 'getNetwork' });
const chain = await provider.request({ method: 'getChain' });
```

### Transaction Methods
```javascript
// Send DOGE
const txid = await provider.request({
  method: 'sendBitcoin',
  params: {
    toAddress: 'P...',
    satoshis: 100000000, // 1 DOGE
    options: { feeRate: 10000 }
  }
});

// Send inscription
const txid = await provider.request({
  method: 'sendInscription',
  params: {
    toAddress: 'P...',
    inscriptionId: 'abc123...',
    options: { feeRate: 10000 }
  }
});

// Push raw transaction
const txid = await provider.request({
  method: 'pushTx',
  params: { rawtx: 'hex...' }
});
```

## Wallet Verification Pattern

For user authentication in your dApp:

```javascript
const verifyWalletOwnership = async (address, message, signature) => {
  // Create the message that was signed
  const verificationMessage = `Verify wallet ownership for BorkStarter\\nTimestamp: ${timestamp}\\nAddress: ${address}`;

  // Verify the signature matches the address
  const provider = getDojakProvider();
  const isValid = await provider.verifyMessageOfBIP322Simple(
    address,
    verificationMessage,
    signature
  );

  if (isValid) {
    // Store verification in your backend
    await authenticateUser(address, signature);
  }

  return isValid;
};
```

## Error Handling

Common errors and solutions:

```javascript
try {
  const result = await provider.request({ method: 'someMethod' });
} catch (error) {
  if (error.code === 4001) {
    // User rejected the request
    console.log('User cancelled');
  } else if (error.code === 4100) {
    // Unauthorized
    console.log('Not connected');
  } else {
    console.error('Wallet error:', error);
  }
}
```

## Testing Your Integration

1. **Install Dojak Extension**: Load the unpacked extension in Chrome
2. **Set up a wallet**: Create or import a wallet in Dojak
3. **Test on HTTPS**: Wallet APIs only work on HTTPS sites (localhost allowed for development)
4. **Check Console**: Monitor browser console for connection logs
5. **Test signing**: Verify message signing works correctly

## Event Listeners

Listen for wallet state changes:

```javascript
const provider = getDojakProvider();

provider.on('accountsChanged', (accounts) => {
  // Handle account changes
});

provider.on('networkChanged', (network) => {
  // Handle network changes
});

provider.on('connect', () => {
  // Wallet connected
});

provider.on('disconnect', () => {
  // Wallet disconnected
});
```

## Security Notes

1. **Always verify signatures** on your backend
2. **Never trust client-side verification alone**
3. **Use HTTPS** in production
4. **Handle connection failures gracefully**
5. **Store minimal user data** - prefer address-based identification

## Full Example Component

See the code example above for a complete React component that handles the entire wallet connection flow.
