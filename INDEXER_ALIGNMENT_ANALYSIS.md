# Wallet Extension vs Dog Indexer - Alignment Analysis

**Date:** March 4, 2026
**Comparison:** Dojak Wallet Extension vs Dog Indexer/CLI Ecosystem

---

## Executive Summary

The wallet extension is a **UI/UX frontend** for managing assets on Dogecoin. The "dog" indexer is a **backend data provider** (indexer, explorer, CLI wallet). They operate at different layers:

- **Dog** = Indexing, block exploration, data aggregation, authority source
- **Dojak Wallet** = Asset display, transaction construction, signing

Current state: **~70% alignment**. The wallet supports core asset types but is missing several data enrichment features and indexer integration points.

---

## 1. DOGINALS PROTOCOL & KOINU NUMBERING

### Dog Supports ✅
- **Koinu numbering** with canonical subsidy schedule (`starting_koinu.json`, `subsidies.json`)
- **Rarity tiers:** mythic, legendary, epic, rare, uncommon, common
- **Inscription ID format:** `<txid>i<index>` (immutable across all marketplaces)
- **Koinu tracking:** Individual koinu identification and provenance
- **Inscription envelope parsing:** Legacy pushdata format (Dogecoin-specific)
- **Field tags:** content_type, pointer, parent, metadata, metaprotocol, content_encoding, delegate
- **Multi-part inscriptions:** Reassembly of content split across transactions
- **Koinucard support:** Physical bearer card NFC protocol

### Wallet Extension Supports ✅
- Display inscriptions (Doginals)
- Transfer inscriptions
- View inscription balances
- Show inscription content (images, text)
- Import from QR codes

### **MISSING in Wallet** ⚠️

1. **Rarity tier calculation & display**
   - No "mythic", "legendary", "epic" badges/filters
   - No rarity-based sorting
   - `MnemonicDisplay.tsx` has inscription support but no rarity context

2. **Koinu-level tracking**
   - No way to track individual koinu ownership
   - No "find koinu" functionality
   - No koinu range display in wallet

3. **Inscription metadata parsing**
   - Field tags (pointer, parent, metadata, delegate) not displayed
   - CBOR metadata not decoded/shown
   - Metaprotocol information not surfaced

4. **Koinucard hardware support**
   - No NFC scanning UI
   - No physical card sweep interface
   - No card state verification (sealed/unsealed)

5. **Multi-part inscription reassembly feedback**
   - Large inscriptions not explicitly handled
   - No progress indicator for multi-part content

---

## 2. DRC-20 TOKEN PROTOCOL

### Dog Supports ✅
- **Deploy:** Create tokens with tick, max supply, mint limit, decimals
- **Mint:** Anyone can mint up to limit
- **Transfer:** Two-step inscription → send pattern
- **Indexing:** Full token lifecycle tracking
- **Balance queries:** Address-level balance computation
- **Token info:** Deployer, deploy height, mint count, holders

### Wallet Extension Supports ✅
- Display DRC-20 balances
- Send DRC-20 tokens
- View DRC-20 holdings per address
- Show token prices (via price feeds)
- Manage multiple tokens

### **MISSING in Wallet** ⚠️

1. **Token deployment**
   - Cannot create new DRC-20 tokens from wallet
   - No deploy dialog/wizard

2. **Mint operations**
   - Cannot mint existing DRC-20 tokens
   - No mint UI

3. **Transfer inscription creation**
   - Cannot create transfer inscriptions manually
   - Assumed to be auto-handled by wallet logic

4. **Token metadata display**
   - No deployer address shown
   - No deploy height/timestamp
   - No mint count tracking
   - No holder count

5. **Token discovery**
   - No "browse all DRC-20 tokens" feature
   - No token search/filter by properties

6. **Decimal handling edge cases**
   - No clear display of divisibility
   - Potential precision issues with very small amounts

---

## 3. DUNES PROTOCOL

### Dog Supports ✅
- **Etch:** Create dunes with name, divisibility, symbol, premine, terms
- **Mint:** Conditional minting based on start/end height, cap, amount
- **Transfer:** Edict-based allocation to outputs
- **Burn:** Transfer to OP_RETURN
- **Pointer:** Alternative default output routing
- **Cenotaph handling:** Malformed transaction recovery
- **Spacers:** Name formatting with bullets
- **Dune ID format:** `BLOCK:TX` (immutable)

### Wallet Extension Supports ✅
- Display Dunes balances
- Send/transfer Dunes
- View Dunes holdings
- Show Dunes prices

### **MISSING in Wallet** ⚠️

1. **Etch operations:**
   - Cannot create new Dunes from wallet
   - No etch wizard

2. **Mint operations:**
   - Cannot mint Dunes
   - No mint UI
   - No term validation

3. **Advanced transfer features:**
   - No edict UI for complex allocations
   - No pointer/default output configuration
   - No burn functionality (transfer to OP_RETURN)

4. **Dune metadata:**
   - No symbol display (e.g., 🧿, $, ⧉)
   - No divisibility indicator
   - No premine information
   - No mint cap/terms display
   - No mint remaining calculation

5. **Spacer parsing:**
   - Dune names not displayed with bullet separators
   - `UNCOMMON•GOODS` shown as `UNCOMMONGOODS`

6. **Dune discovery:**
   - No "browse all Dunes" feature
   - No index of available Dunes

---

## 4. DOGECOIN NAME SYSTEM (DNS)

### Dog Supports ✅
- Register `.doge` names as JSON inscriptions
- Resolve names → address/URL/config
- Store arbitrary key-value configurations
- List all registered names
- Query by namespace

### Wallet Extension Supports ⚠️
- **Partial:** Dogecoin name references may be stored but not actively used
- No native DNS integration in UI

### **MISSING in Wallet** ❌

1. **Name registration:**
   - Cannot register new `.doge` names from wallet
   - No name registration dialog

2. **Name resolution:**
   - Cannot look up addresses by `.doge` name
   - Send to `.doge` names not supported (must use full address)

3. **Name management:**
   - Cannot update existing name configurations
   - Cannot transfer name ownership

4. **Config storage:**
   - No UI to set avatar, website, profile data
   - Cannot edit key-value configuration

5. **Address book integration:**
   - No way to tag addresses with registered names
   - No reverse resolution (address → name lookup)

**Impact:** Users must use full addresses; no user-friendly naming system in wallet UI.

---

## 5. DOGEMAPS - BLOCK OWNERSHIP

### Dog Supports ✅
- Claim block numbers by inscribing `{block}.dogemap`
- Procedurally generate colored SVG from block data
- Query block ownership status
- List all claimed blocks
- API endpoint: `/dogemap/{block}` returns SVG + JSON

### Wallet Extension Supports ❌
- **None.** No Dogemaps functionality.

### **MISSING in Wallet** ❌

1. **Claim UI:**
   - Cannot inscribe block claims from wallet
   - No Dogemap wizard

2. **Claim management:**
   - Cannot view claimed blocks
   - Cannot transfer block ownership

3. **Block visualization:**
   - No procedural SVG rendering
   - No block data explorer

4. **Dogemap gallery:**
   - No way to browse claimed blocks
   - No marketplace view

**Impact:** Complete feature gap. Dogemaps are a major Doginals ecosystem component not exposed in wallet.

---

## 6. WALLET FEATURES & TRANSACTION CONSTRUCTION

### Dog CLI Wallet Supports ✅
- Create/restore from seed
- HD path management
- Address generation
- UTXO selection & batch operations
- Custom transaction building
- Batch commands (multiple operations in one tx)
- Offers (inscribe offers, accept, cancel)
- Send/sweep/split operations
- Inscribe operations (attach data)
- Mint operations
- Signature management (sign/verify)
- Cardinals balance (regular DOGE)
- Pending transaction tracking
- Transaction history

### Wallet Extension Supports ✅
- Create/restore wallets
- Send transactions
- Receive addresses
- Transaction history
- Fee management
- UTXO management (partial)

### **MISSING in Wallet** ⚠️

1. **Advanced transaction features:**
   - No batch operations (multiple sends in one tx)
   - No custom script construction
   - Limited UTXO control

2. **Offer protocol:**
   - No inscribe/send offer support
   - No offer acceptance
   - Cannot preview offers

3. **Inscribe operations:**
   - Limited to basic inscriptions
   - No batch inscribe
   - No content encoding options (compress, etc.)

4. **Sweep/consolidation:**
   - No wallet sweep tools
   - No UTXO consolidation
   - Cannot collect scattered funds

5. **Split operations:**
   - No split/divide functionality
   - Cannot break single UTXOs into pieces

---

## 7. INDEXER & DATA AGGREGATION

### Dog Provides ✅
- Full Dogecoin block indexing
- Inscription content storage (images, videos, text)
- DRC-20 balance computation per address
- Dunes balance computation per address
- DNS name resolution
- Dogemap block tracking
- Koinu rarity assignment
- Transaction history reconstruction
- JSON REST APIs
- Database (redb) with rollback support
- Fast .blk file reading (bypass JSON-RPC)
- Selective indexing (only index specific protocols)

### Wallet Extension ⚠️
- Queries indexer/RPC for data
- Relies on walletapi service
- No built-in indexing

### **INDEXER INTEGRATION GAPS** ⚠️

1. **Missing API endpoints in wallet:**
   - `/inscriptions/{id}` for metadata/rarity
   - `/address/{addr}/koinu` for koinu-level tracking
   - `/drc20/{tick}/holders` for holder info
   - `/dunes/{id}/info` for dune metadata
   - `/dns/{name}/resolve` for name resolution
   - `/dogemap/{block}` for block ownership
   - `/koinucard/{url}` for bearer card validation

2. **Data enrichment missing:**
   - No rarity tier fetching
   - No inscription metadata parsing
   - No holder count computation
   - No mint cap/remaining calculation

3. **Caching strategy:**
   - Wallet queries may not cache indexer results
   - No offline support for known assets

---

## 8. HARDWARE INTEGRATIONS

### Dog Supports ✅
- **Koinucard:** NFC physical bearer cards
  - URL parsing
  - Balance display
  - Sweep to wallet
  - Card state verification (sealed/unsealed)

### Wallet Extension ❌
- **None.** No hardware wallet integration beyond standard signing.

### **MISSING in Wallet** ❌

1. **Koinucard support:**
   - No NFC scanning UI
   - No QR parsing for Koinucard URLs
   - Cannot sweep physical cards
   - No card state display

2. **Hardware wallet protocols:**
   - No clear Ledger/Trezor integration for Dogecoin
   - Cold wallet support may be incomplete

---

## 9. CONTENT & MEDIA HANDLING

### Dog Supports ✅
- Stores full inscription content (images, video, audio, text)
- Content extraction with original file extension
- MIME type preservation
- Content encoding support (brotli, gzip, etc.)
- Large file handling (multi-part reassembly)

### Wallet Extension Supports ✅
- Display inscription images/text
- Basic media rendering

### **MISSING in Wallet** ⚠️

1. **Advanced content features:**
   - No content encoding decompression display
   - No multi-part preview/progress
   - Limited MIME type support

2. **Content cache:**
   - May not cache content locally
   - No offline access to inscriptions

3. **Content verification:**
   - No hash verification against on-chain data
   - Cannot verify authenticity

---

## 10. BALANCE & ACCOUNTING

### Dog Supports ✅
- Precise fixed-point arithmetic (no floating point)
- Dust handling (minimum koinu limits)
- Unconfirmed UTXO tracking
- Pending transaction accounting
- Cardinal (regular DOGE) balance separate from inscriptions
- Token-specific balance queries

### Wallet Extension Supports ✅
- Balance display (Doge, tokens, inscriptions)
- Fee calculation
- Available/locked balance distinction

### **MISSING in Wallet** ⚠️

1. **Precision issues:**
   - May not handle very small token amounts (divisibility > 8)
   - Potential rounding errors

2. **Dust management:**
   - No explicit dust limit warnings
   - Cannot manually set dust outputs

3. **Unconfirmed tracking:**
   - May not clearly show unconfirmed vs confirmed
   - No fee bump (RBF) for unconfirmed

---

## PRIORITY IMPLEMENTATION ROADMAP

### TIER 1: Core Ecosystem Alignment (HIGH IMPACT)
- [ ] **Rarity tier calculation & display** (Doginals)
- [ ] **DNS name resolution** (allow sending to `.doge` names)
- [ ] **Dunes metadata display** (symbol, divisibility, premine, mint cap)
- [ ] **DRC-20 deployer/mint info** (who deployed, mint count, holders)
- [ ] **Dogemaps display** (show claimed blocks in explorer view)

### TIER 2: Ecosystem Features (MEDIUM IMPACT)
- [ ] **DRC-20 token deployment** (from wallet)
- [ ] **Dunes etch/mint functionality** (from wallet)
- [ ] **DNS name registration** (from wallet)
- [ ] **Dogemaps block claiming** (from wallet)
- [ ] **Batch transaction support** (multiple ops in one tx)
- [ ] **Token discovery UI** (browse all DRC-20/Dunes)

### TIER 3: Advanced Features (NICE-TO-HAVE)
- [ ] **Koinucard hardware support** (NFC scanning, sweep)
- [ ] **Koinu-level tracking** (find koinu, view ranges)
- [ ] **Offer protocol** (inscribe/accept offers)
- [ ] **Content encoding decompression** (brotli/gzip)
- [ ] **Wallet sweep/consolidation tools**
- [ ] **Inscription batch operations**

### TIER 4: Polish & Robustness
- [ ] **Precision edge cases** (token divisibility > 8)
- [ ] **Content hash verification** (ensure on-chain authenticity)
- [ ] **Offline content caching**
- [ ] **RBF/fee bump for unconfirmed**
- [ ] **Multi-part reassembly progress**

---

## DATA FLOW IMPROVEMENTS

### Current Flow
```
User Action → Wallet UI → walletapi service → RPC/Indexer → Dogecoin
```

### Recommended Enhanced Flow
```
User Action → Wallet UI → walletapi service + Dog REST API → Indexer → Dogecoin
                                                    ↓
                                            (Rich metadata, rarity, 
                                             token info, DNS resolution)
```

### Missing Integration Points
1. **Indexer metadata endpoint** - Wallet queries for enriched data
2. **Subscribe model** - Wallet listens for new blocks/inscriptions
3. **Cache/sync** - Wallet stores local copies of key data
4. **Fallback logic** - Wallet handles offline/degraded indexer

---

## PROTOCOL COMPLIANCE CHECKLIST

| Protocol | Feature | Wallet | Status |
|----------|---------|--------|--------|
| **Doginals** | Inscription display | ✅ | Complete |
| **Doginals** | Rarity tiers | ❌ | MISSING |
| **Doginals** | Koinu tracking | ❌ | MISSING |
| **Doginals** | Metadata parsing | ❌ | MISSING |
| **Doginals** | Koinucard sweep | ❌ | MISSING |
| **DRC-20** | Display balances | ✅ | Complete |
| **DRC-20** | Send tokens | ✅ | Complete |
| **DRC-20** | Deploy tokens | ❌ | MISSING |
| **DRC-20** | Mint tokens | ❌ | MISSING |
| **DRC-20** | Token discovery | ❌ | MISSING |
| **Dunes** | Display balances | ✅ | Complete |
| **Dunes** | Send tokens | ✅ | Complete |
| **Dunes** | Etch new dunes | ❌ | MISSING |
| **Dunes** | Mint dunes | ❌ | MISSING |
| **Dunes** | Metadata display | ⚠️ | PARTIAL |
| **DNS** | Name resolution | ❌ | MISSING |
| **DNS** | Name registration | ❌ | MISSING |
| **Dogemaps** | Display blocks | ❌ | MISSING |
| **Dogemaps** | Claim blocks | ❌ | MISSING |

---

## CONCLUSION

**Alignment Score: ~70%**

The wallet extension handles **asset display and basic transfers** well but lacks **protocol-level features** and **indexer integration**.

### Top 3 Priorities:
1. **Rarity tier display** - Completes Doginals protocol support
2. **DNS name resolution** - Improves UX significantly  
3. **Token metadata enrichment** - Shows deployer, mint info, holders

### Quick Wins (Low effort, high value):
- Add rarity badge to inscriptions
- Fetch + display Dunes symbol/divisibility
- Resolve `.doge` names in address book
- Show DRC-20 deployer info

### Long-term (Feature parity with dog):
- Implement all deployments (DRC-20, Dunes, DNS, Dogemaps)
- Add batch transaction support
- Build hardware integration (Koinucard)
- Implement offer protocol
