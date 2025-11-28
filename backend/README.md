# Dojak API Server

Official backend API server for Dojak Wallet, providing secure blockchain services including faucet functionality.

## Features

- 🔗 **Faucet Service**: Claim testnet DOGE with rate limiting
- 🛡️ **Security**: CORS protection, rate limiting, input validation
- 📊 **Health Monitoring**: API health checks and status endpoints
- 🚀 **Production Ready**: TypeScript, error handling, logging

## Setup

### Prerequisites

1. **Dogecoin Core** running with RPC enabled
2. **Node.js** 18+ and npm

### Installation

```bash
cd backend
npm install
```

### Configuration

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=3001

# Dogecoin Core RPC (required for faucet)
# Default ports from Dogecoin Core source:
# - Mainnet: 33873, Testnet: 44873, Regtest: 18332
DOGECOIN_RPC_URL=http://localhost:44873
DOGECOIN_RPC_USER=dogecoinrpc
DOGECOIN_RPC_PASS=your_actual_rpc_password

# Environment
NODE_ENV=development
```

### Dogecoin Core Setup

**⚠️ IMPORTANT**: You need a **separate testnet node** for the faucet!

1. **Create separate data directory** for testnet:
```bash
mkdir -p ~/.dogecoin/testnet3
```

2. **Create `dogecoin.conf`** in testnet directory:
```ini
# Testnet Configuration
testnet=1

# RPC Configuration
rpcuser=dogecoinrpc
rpcpassword=your_secure_password_here
rpcallowip=127.0.0.1
rpcport=44873

# Wallet
wallet=1
```

3. **Start testnet node**:
```bash
# From Dogecoin Core build directory
./dogecoind -testnet -conf=~/.dogecoin/testnet3/dogecoin.conf
```

4. **Verify testnet connection**:
```bash
./dogecoin-cli -testnet getblockchaininfo
# Should show: "chain": "test"
```

5. **Fund your faucet wallet** with testnet DOGE:
   - Get testnet DOGE from [Dogecoin Testnet Faucet](https://testnet-faucet.dogecoin.org)
   - Or mine testnet blocks
   - Or ask community for testnet coins

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Health Check
```
GET /health
```

### Faucet Status
```
GET /api/v1/faucet/status
```

### Claim Faucet
```
POST /api/v1/faucet/claim
Content-Type: application/json

{
  "address": "Pxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "amount": 0.01
}
```

## Rate Limiting

- **3 requests per minute** per IP address
- Applied to all faucet endpoints
- Returns `429 Too Many Requests` when exceeded

## Security Features

- CORS protection
- Input validation
- RPC authentication
- Error sanitization
- Rate limiting

## Integration with Dojak Wallet

The frontend will automatically connect to this API for faucet claims. Make sure the backend server is running when using faucet functionality.

## Troubleshooting

### RPC Connection Issues
- Verify `dogecoind` is running: `dogecoin-cli getblockcount`
- Check RPC credentials in `.env`
- Ensure firewall allows local connections to port 33889

### Faucet Claims Failing
- Check faucet wallet has sufficient funds
- Verify recipient address is valid P-address
- Check RPC logs for detailed error messages

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Clean build
npm run clean
```

## License

MIT
