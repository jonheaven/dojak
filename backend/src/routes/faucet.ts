import axios from 'axios';
import { Hono } from 'hono';
import { rateLimit } from '../middleware/rateLimit.js';

export const faucetRouter = new Hono();

// Apply rate limiting to faucet routes
faucetRouter.use('*', rateLimit);

// Dogecoin RPC client configuration
const createRpcClient = () => {
  // Use correct default ports based on Dogecoin Core source code:
  // Mainnet: 33873, Testnet: 44873, Regtest: 18332
  const rpcUrl = process.env.DOGECOIN_RPC_URL || 'http://localhost:33873';
  const rpcUser = process.env.DOGECOIN_RPC_USER || 'dogecoinrpc';
  const rpcPass = process.env.DOGECOIN_RPC_PASS || '';

  if (!rpcPass) {
    throw new Error('DOGECOIN_RPC_PASS environment variable is required');
  }

  return axios.create({
    baseURL: rpcUrl,
    auth: {
      username: rpcUser,
      password: rpcPass
    },
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
};

// Validate Dogecoin address (basic validation)
const isValidDogecoinAddress = (address: string): boolean => {
  // P addresses start with 'P' and are 34 characters long
  return /^P[A-Za-z0-9]{33}$/.test(address);
};

// Check if connected to testnet
const isTestnet = async (rpcClient: any): Promise<boolean> => {
  try {
    const response = await rpcClient.post('/', {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'getblockchaininfo',
      params: []
    });

    const network = response.data?.result?.chain;
    console.log(`🔗 Connected to Dogecoin network: ${network}`);
    return network === 'test';
  } catch (error) {
    console.error('❌ Failed to check network:', error.message);
    return false;
  }
};

// Claim faucet endpoint
faucetRouter.post('/claim', async (c) => {
  try {
    const body = await c.req.json();
    const { address, amount = 0.01 } = body;

    // Validate input
    if (!address) {
      return c.json({
        success: false,
        error: 'Address is required'
      }, 400);
    }

    if (!isValidDogecoinAddress(address)) {
      return c.json({
        success: false,
        error: 'Invalid Dogecoin address format'
      }, 400);
    }

    if (amount <= 0 || amount > 1) {
      return c.json({
        success: false,
        error: 'Amount must be between 0.00000001 and 1 DOGE'
      }, 400);
    }

    console.log(`🎰 Faucet claim requested: ${amount} DOGE to ${address}`);

    const rpcClient = createRpcClient();

    // CRITICAL: Verify we're connected to TESTNET before sending funds!
    const connectedToTestnet = await isTestnet(rpcClient);
    if (!connectedToTestnet) {
      return c.json({
        success: false,
        error: 'Faucet is not connected to Dogecoin testnet. Please ensure dogecoind is running with testnet=1'
      }, 500);
    }

    console.log('✅ Confirmed: Connected to Dogecoin testnet - safe to send faucet funds');

    // RPC call to send coins
    const rpcPayload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'sendtoaddress',
      params: [
        address,           // recipient address
        amount,            // amount in DOGE
        'Dojak Faucet',    // comment
        'Dojak Faucet',    // comment_to
        false              // subtract fee from amount
      ]
    };

    console.log('📡 Sending RPC request to Dogecoin Core...');

    const response = await rpcClient.post('/', rpcPayload);

    if (response.data && response.data.result) {
      const txid = response.data.result;

      console.log(`✅ Faucet claim successful! TXID: ${txid}`);

      return c.json({
        success: true,
        txid: txid,
        amount: amount,
        address: address,
        message: 'Testnet DOGE claimed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      const error = response.data?.error?.message || 'Unknown RPC error';
      console.error('❌ RPC Error:', error);

      return c.json({
        success: false,
        error: `Transaction failed: ${error}`
      }, 500);
    }

  } catch (error: any) {
    console.error('💥 Faucet claim error:', error);

    // Handle specific error types
    if (error.code === 'ECONNREFUSED') {
      return c.json({
        success: false,
        error: 'Cannot connect to Dogecoin Core RPC. Make sure dogecoind is running.'
      }, 503);
    }

    if (error.response?.data?.error) {
      return c.json({
        success: false,
        error: error.response.data.error.message
      }, 500);
    }

    return c.json({
      success: false,
      error: error.message || 'Internal server error'
    }, 500);
  }
});

// Get faucet status
faucetRouter.get('/status', async (c) => {
  try {
    const rpcClient = createRpcClient();

    // Check if RPC is accessible and get network info
    const response = await rpcClient.post('/', {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'getblockchaininfo',
      params: []
    });

    const network = response.data?.result?.chain;
    const isTestnet = network === 'test';

    return c.json({
      success: true,
      status: 'online',
      network: network,
      isTestnet: isTestnet,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 3
      },
      maxAmount: 1.0,
      message: isTestnet
        ? 'Faucet is operational on testnet'
        : '⚠️ WARNING: Connected to mainnet! Faucet claims will be blocked.'
    });

  } catch (error) {
    return c.json({
      success: false,
      status: 'offline',
      error: 'Cannot connect to Dogecoin Core RPC'
    }, 503);
  }
});
