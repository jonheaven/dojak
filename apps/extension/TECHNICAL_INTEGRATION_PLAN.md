# Technical Integration Points: Wallet ↔ Dog Indexer

---

## 1. DOGINALS PROTOCOL INTEGRATION

### Rarity Tier Calculation
The wallet needs access to subsidy schedule and starting_koinu mappings.

**Data needed from indexer:**
```json
{
  "inscription_id": "bdfeeeacab95d0a230e1124f0635ac9a47925fef4bb1d41a0a0c6e8d8232af7ai0",
  "rarity": "legendary",
  "koinu_start": 4830000000,
  "koinu_end": 4830100000,
  "block": 4609000,
  "contains_rarity": true
}
```

**Rarity tier logic (in wallet):**
```typescript
enum RarityTier {
  MYTHIC = "mythic",     // First koinu of genesis block
  LEGENDARY = "legendary", // First koinu of any block
  EPIC = "epic",         // Last koinu of any block  
  RARE = "rare",         // First koinu after 10% mark
  UNCOMMON = "uncommon", // First koinu after 50% mark
  COMMON = "common"      // Everything else
}

// Computation requires:
// - subsidy[height] = block reward amount
// - starting_koinu[height] = cumulative koinu before this block
// These should be cached in wallet or fetched from indexer
```

**Indexer API endpoint needed:**
```
GET /inscriptions/{inscription_id}/rarity
GET /address/{address}/inscriptions/by-rarity?tier=legendary,epic
```

**Files to create/update:**
- `src/ui/components/Inscriptions/RarityBadge.tsx` - Display tier
- `src/shared/lib/rarity.ts` - Calculation logic
- `src/ui/utils/coinsu-utils.ts` - Add rarity scorer

---

### Inscription Metadata Parsing
Extend existing inscription display to show field tags.

**Data structure:**
```typescript
interface EnhancedInscription {
  id: string;
  content_type: string;
  content: string;
  
  // Field tags from envelope
  pointer?: number;
  parent?: string;
  metadata?: Record<string, unknown>; // CBOR decoded
  metaprotocol?: string; // "drc-20", "dns", "dogemap"
  content_encoding?: "br" | "gzip" | "deflate";
  delegate?: string; // delegated to another inscription
}
```

**Indexer API endpoint needed:**
```
GET /inscriptions/{id}/metadata
GET /inscriptions/{id}/content/{format}
  ?encoding=raw|decoded
```

---

## 2. DRC-20 TOKEN PROTOCOL

### Token Deployment from Wallet

**Current gap:** Wallet cannot inscribe deploy operations.

**RPC transaction needed:**
```json
{
  "inputs": [{ "txid": "...", "vout": 0 }],
  "outputs": [
    {
      "script_sig": [
        "ord",
        "07",  // metaprotocol tag
        "drc-20",
        "",    // body separator
        JSON.stringify({
          "p": "drc-20",
          "op": "deploy",
          "tick": "DOGI",
          "max": "21000000",
          "lim": "1000",
          "dec": "8"
        })
      ],
      "address": "change_address"
    },
    {
      "address": "recipient_address",
      "amount": 0  // inscription output
    }
  ]
}
```

**UI wizard needed:** `src/ui/pages/DRC20/DeployTokenScreen.tsx`

### Token Info Display
Show deployer, deploy height, mint count, holders.

**Indexer API endpoint needed:**
```
GET /drc20/{tick}
-> {
     "tick": "DOGI",
     "max_supply": "21000000",
     "decimals": 8,
     "minted": "1000000",
     "mint_limit": "1000",
     "deploy_id": "bdfeeeac...",
     "deploy_height": 4609000,
     "deploy_timestamp": 1709500000,
     "deployer_address": "DHrqn6H6...",
     "mint_count": 523,
     "holders": 145
   }

GET /drc20/{tick}/holders
-> [
     { "address": "D12345...", "balance": "5000.00000000", "rank": 1 },
     ...
   ]
```

**Files to create:**
- `src/ui/pages/DRC20/DRC20InfoScreen.tsx` - Token detail page
- `src/shared/types/drc20.ts` - Extend TokenBalance interface

---

## 3. DUNES PROTOCOL

### Dunes Metadata Display

**Current gap:** No symbol, divisibility, premine, or mint cap shown.

**Indexer API endpoint needed:**
```
GET /dunes/{id}
-> {
     "id": "500:20",
     "name": "UNCOMMON•GOODS",
     "name_raw": "UNCOMMONGOODS",
     "symbol": "🧿",
     "divisibility": 2,
     "premine": "500",
     "supply": "1000000",
     "minted": "500000",
     "burnt": "0",
     "remaining": "500000",
     "holders": 234,
     "transactions": 1205,
     "mint_open": true,
     "mint_cap": "1000",
     "mint_amount": "100",
     "mint_count": 4500,
     "mint_start_height": 4609000,
     "mint_end_height": 4700000,
     "etch_height": 4609000,
     "etch_txid": "abc123..."
   }

GET /address/{address}/dunes?limit=50&offset=0
-> {
     "total": 234,
     "dunes": [
       {
         "id": "500:20",
         "name": "UNCOMMON•GOODS",
         "symbol": "🧿",
         "balance": "1234.56",
         "divisibility": 2
       }
     ]
   }
```

### Dunes Etch/Mint UI

**New screens needed:**
- `src/ui/pages/Dunes/EtchDuneScreen.tsx` - Create dune
- `src/ui/pages/Dunes/MintDuneScreen.tsx` - Mint dune
- `src/ui/pages/Dunes/TransferDuneScreen.tsx` - Advanced transfer with edicts

**Transaction structure for etch:**
```typescript
interface DuneEtchTransaction {
  inputs: UTXO[];
  outputs: [
    {
      script: "OP_RETURN OP_13 <dunestone_data>"
      // Dunestone encodes:
      // - name (26 bytes max)
      // - symbol (UTF-8)
      // - divisibility (u8)
      // - premine (u128)
      // - mint: { cap: u128, amount: u128, start: u32?, end: u32? }
    },
    {
      address: "change",
      amount: "dust"
    }
  ];
}
```

**Files to create:**
- `src/shared/lib/dunes-utils.ts` - Etch/mint encoding
- `src/ui/components/DunesBalanceCard/DunesMetadataDisplay.tsx`

---

## 4. DNS PROTOCOL INTEGRATION

### Name Resolution in Wallet

**Indexer API endpoint needed:**
```
GET /dns/resolve/{name}
-> {
     "name": "satoshi.doge",
     "namespace": "doge",
     "resolved_value": "DHrqn6H6ocgbRB1Szu7Q1sn1tVTfkpinnc",
     "config": {
       "address": "DHrqn6H6ocgbRB1Szu7Q1sn1tVTfkpinnc",
       "url": "https://example.com",
       "avatar": "inscription_id",
       "content": "User bio"
     },
     "owner_address": "DHrqn6H6...",
     "inscription_id": "abc123...",
     "updated_height": 4609000
   }

GET /dns/list?limit=100&offset=0
-> {
     "total": 1234,
     "names": [
       { "name": "satoshi.doge", "resolved": "DHrqn6...", "owner": "D1234..." },
       ...
     ]
   }
```

### Send to DNS Name

**Modify SendScreen:**
- Accept `.doge` names in recipient field
- Resolve to address before building transaction
- Show resolved address for confirmation

**Files to modify:**
- `src/ui/pages/Wallet/TxCreateScreen.tsx` - Add DNS resolution
- `src/ui/components/AddressInput/index.tsx` - Support `.doge` format

### DNS Name Registration

**New screen needed:** `src/ui/pages/DNS/RegisterNameScreen.tsx`

**Transaction structure:**
```typescript
interface DNSInscription {
  content_type: "application/json" | "text/plain";
  body: {
    address?: string;
    url?: string;
    avatar?: string;
    content?: string;
    // Custom fields allowed
  };
}
```

---

## 5. DOGEMAPS INTEGRATION

### Display Claimed Blocks

**Indexer API endpoint needed:**
```
GET /dogemap/{block}
-> {
     "block": 5056597,
     "claimed": true,
     "owner_address": "DHrqn6H6...",
     "claim_inscription_id": "abc123...",
     "claim_height": 4609000,
     "claim_timestamp": 1709500000,
     "svg_url": "/dogemap/5056597/svg",
     "block_data": {
       "hash": "...",
       "txid_count": 42,
       "timestamp": 1709400000
     }
   }

GET /dogemap?limit=50&offset=0&owner={address}
-> [
     { "block": 5056597, "owner": "DHrqn6...", "claimed_height": 4609000 },
     ...
   ]

GET /dogemap/5056597/svg
-> <svg><!-- procedurally generated from block data --></svg>
```

### Claim Block UI

**New screen needed:** `src/ui/pages/Dogemaps/ClaimBlockScreen.tsx`

**Transaction structure:**
```typescript
interface DogemapInscription {
  content_type: "text/plain";
  body: `{block}.dogemap`;  // e.g., "5056597.dogemap"
}
```

**Files needed:**
- `src/ui/components/DogemapViewer/index.tsx` - SVG display
- `src/ui/pages/Dogemaps/DogemapGalleryScreen.tsx` - Browse claims
- `src/ui/pages/Dogemaps/ClaimBlockScreen.tsx` - Claim wizard

---

## 6. BALANCE QUERIES & CACHING

### Unified Balance Query

**Current architecture limitation:** Wallet queries each asset type separately.

**Recommended unified endpoint:**
```
GET /address/{address}/balance?assets=doge,inscriptions,drc20,dunes,dns
-> {
     "doge": {
       "total": "100.00000000",
       "available": "95.00000000",
       "locked": "5.00000000",
       "unconfirmed": "0.00000000"
     },
     "inscriptions": {
       "total": 42,
       "by_type": {
         "doginals": 35,
         "drc20": 4,
         "dunes": 2,
         "dns": 1
       }
     },
     "drc20": {
       "DOGI": {
         "balance": "5000.00000000",
         "decimals": 8,
         "tick": "DOGI"
       },
       ...
     },
     "dunes": {
       "500:20": {
         "balance": "1234.56",
         "symbol": "🧿",
         "divisibility": 2
       },
       ...
     },
     "dns": {
       "count": 3,
       "owned_names": ["satoshi.doge", "jon.doge"]
     }
   }
```

### Caching Strategy

**Implement in WalletContext:**
```typescript
interface BalanceCache {
  address: string;
  timestamp: number;
  ttl: number; // 30 seconds default
  data: BalanceResponse;
}

// Avoid refetching same address within TTL
// Update on transaction broadcast
// Invalidate on block confirmation
```

---

## 7. TRANSACTION BUILDING IMPROVEMENTS

### Batch Operations

**Missing:** Multiple operations in single transaction.

**Example:** Send DRC-20 + claim Dogemap block in one tx

```typescript
interface BatchOperation {
  type: "drc20_transfer" | "dune_transfer" | "dns_register" | "dogemap_claim";
  inscription_data: InscriptionEnvelope;
  output_index: number;
  recipient?: string;
}

// Build transaction with multiple inscriptions
const buildBatchTx = (ops: BatchOperation[]) => {
  const inputs = selectUTXOs();
  const outputs = [];
  
  ops.forEach((op, index) => {
    outputs.push({
      script_sig: encodeEnvelope(op.inscription_data),
      address: op.recipient || change_address
    });
  });
  
  return buildTransaction(inputs, outputs);
};
```

---

## 8. INDEXER SYNC & FALLBACK

### Wallet Indexer Integration Layer

**Create:** `src/ui/services/indexer.ts`

```typescript
interface IndexerClient {
  // Query enriched data
  getInscriptionRarity(id: string): Promise<RarityInfo>;
  getDRC20Token(tick: string): Promise<TokenInfo>;
  getDuneInfo(id: string): Promise<DuneInfo>;
  resolveDNSName(name: string): Promise<string | null>;
  getDogemapStatus(block: number): Promise<DogemapInfo>;
  
  // Batch queries
  getAddressBalance(address: string): Promise<BalanceResponse>;
  getAddressAssets(address: string): Promise<AssetSummary>;
}

// Fallback logic:
// 1. Try indexer API
// 2. If timeout, use cached data
// 3. If no cache, show degraded UI (skip enrichment)
// 4. Warn user ("Explorer offline, some data unavailable")
```

---

## 9. MISSING COMPONENTS CHECKLIST

### High Priority
- [ ] `RarityBadge.tsx` - Display tier (common, uncommon, rare, epic, legendary, mythic)
- [ ] `DRC20TokenInfoScreen.tsx` - Show deployer, mint info, holders
- [ ] `DunesMetadataCard.tsx` - Display symbol, divisibility, premine
- [ ] `DNSResolutionService.ts` - Resolve `.doge` names
- [ ] `DogemapClaimScreen.tsx` - Inscribe block claim

### Medium Priority
- [ ] `DeployDRC20Screen.tsx` - Create token
- [ ] `MintDuneScreen.tsx` - Mint dune
- [ ] `RegisterDNSScreen.tsx` - Register name
- [ ] `BatchTxBuilder.ts` - Multi-operation transactions
- [ ] `IndexerClient.ts` - Unified indexer API

### Lower Priority  
- [ ] `KoinucardSweepScreen.tsx` - NFC hardware support
- [ ] `OfferProtocol.ts` - Inscribe/accept offers
- [ ] `ContentEncodingDecoder.ts` - Decompress brotli/gzip
- [ ] `KoinuTracking.ts` - Koinu-level ordinal theory

---

## Quick Implementation Path

1. **Week 1:** Rarity tier display + DNS resolution (biggest UX improvement)
2. **Week 2:** DRC-20 deployer info + Dunes metadata display
3. **Week 3:** Basic deployment screens (DRC-20, DNS)
4. **Week 4:** Dogemaps + batch operations
5. **Week 5+:** Advanced features (offers, hardware, etc.)

This sequencing hits highest ROI first and aligns with user expectations based on dog ecosystem capabilities.
