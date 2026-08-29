# Chrome Web Store — submit today

Do these in order. Skipping the privacy URL or answering “no user data” while we inject on all sites is an instant reject.

## 0. Wait for Vercel (privacy URL)

After this commit lands on `main`, confirm these load over HTTPS:

- https://dojak.app/privacy
- https://dojak.app/terms

Do **not** submit until `/privacy` is live. Chrome checks the URL.

## 1. Build the zip (operator)

From `dojak/` repo root:

```text
pnpm --filter @dojak/extension exec gulp build --env=pro --browser=chrome --manifest=mv3 --channel=github
```

Upload: `apps/extension/dist/dojak-chrome-mv3-v0.1.2.0.zip`

Load unpacked `apps/extension/dist/chrome` once and click through create-wallet / home / send / assets so screenshots are real UI.

## 2. Screenshots (required — 1280×800 PNG or JPEG, no alpha)

Chrome rejects promo banners with giant slogans. Shoot the **actual extension**:

1. Home — DOGE balance (side panel)
2. Send flow
3. Doginals / assets list
4. Connect / approve prompt (`window.dojak`)
5. x.com with the Ð𝕏 tip control (optional but strong)

Store icon: `apps/extension/bin/icons/icon-128.png`

## 3. Listing fields

**Name**

```
Dojak Wallet
```

**Summary** (132 max)

```
Non-custodial Dogecoin wallet: DOGE, DRC-20, Doginals, Dunes, native X tipping, and one-click dApp connect.
```

**Category:** Finance (Productivity if Finance is blocked)

**Language:** English (United States)

**Visibility:** Public

**Homepage:** `https://dojak.app`

**Support:** `https://dojak.app/faq`

**Privacy policy:** `https://dojak.app/privacy`

**Description** (plain text)

```
Overview
Non-custodial Dogecoin wallet: DOGE, DRC-20, Doginals, Dunes, native tipping on X, and one-click dApp connect.

Dojak is the self-custody Chrome extension for the full Dogecoin stack — DOGE, Doginals, DRC-20, Dunes, Treats, Charms, Alkanes, and real on-chain value on X.

Send and receive DOGE. Manage DRC-20 tokens. Collect and transfer Doginals. Hold Dunes and the rest of the Dogenals stack. Tip creators and link your 𝕏 profile with Ð𝕏. Connect any Dogecoin dApp in one click. Your keys stay encrypted on your device — never on our servers.

WHY PEOPLE INSTALL DOJAK
• Non-custodial Dogecoin wallet built for daily use
• Native DOGE sends with clear fees — no custodial shortcuts
• Protocol-aware UTXO protection — inscriptions and listings are not spent by accident
• DRC-20: balances, transfers, and inscription-aware sends
• Doginals / inscription viewing, transfers, and inscribe
• Dunes, Treats, Charms, and Alkanes in one vault
• Tip in Ð on posts and profiles — pay by @handle when they are linked
• Ð𝕏 identity: bind your 𝕏 profile on-chain, right in the extension
• Multi-wallet: create, import (seed or WIF), and switch
• Real on-chain signing with explicit approval every time
• window.dojak — connect Dogecoin dApps in one click
• Side panel + popup so you can sign without leaving the page

BUILT FOR THE DOGECOIN ECOSYSTEM
Whether you tip on 𝕏, collect Doginals, hold DRC-20, or ship a dApp — Dojak keeps you in control. No accounts to freeze. No seed phrase leaving your browser. Protocol-aware coin selection so a normal send cannot eat an inscription. Just Dogecoin self-custody that understands the chain.

Open a Dogecoin site, click Connect, approve in the extension — you’re in.

Ð𝕏 ON 𝕏
• Tip button on posts and a Ð𝕏 chip on profiles
• Pay a linked @handle — we never hold coins for an unbound user
• Link your profile in-extension (tweet proof + on-chain bind)
• Invite-to-compose when someone is not linked yet
• On-chain memos for post tips

FOR BUILDERS
Sites detect window.dojak / isDojak, then requestAccounts, signPsbt, sendBitcoin, and sendInscription. Same Dogecoin-native provider across dogenals.com, dogecoin.games, and the rest of the orbit.

Open standards live at dogenals.org. Dojak is the wallet on top.

Learn more: https://dojak.app
Privacy: https://dojak.app/privacy
Terms: https://dojak.app/terms
Docs: https://dogenals.org
FAQ: https://dojak.app/faq
```

## 4. Single purpose (paste)

```
Provide a self-custodial Dogecoin wallet: send and receive DOGE, manage Doginals/DRC-20/Dunes, tip on X via Ð𝕏, and let sites connect through window.dojak with an explicit user approval for every signature. Keys stay encrypted on-device.
```

## 5. Permission justifications (paste each)

**storage**
Store the encrypted vault, account labels, connected-site permissions, and preferences locally. Keys never leave the device.

**tabs**
Know the active tab so dApp Connect and the X.com Ð𝕏 overlay can open the correct approval UI.

**notifications**
Optional transaction / approval alerts while the wallet is in the background.

**scripting**
Inject the page provider (`window.dojak`) on the active site after the user installs a wallet, same as other browser wallets.

**windows**
Open the approval / side-panel UI for connect, send, and sign prompts.

**sidePanel**
Primary wallet UI in Chrome’s side panel so the user can sign without leaving the page.

**host_permissions: `<all_urls>`**
(1) Inject `window.dojak` on whichever dApp the user opens so Connect works without an allowlist of every Dogecoin site. (2) User-configurable indexer/RPC endpoints. (3) x.com/twitter.com overlay for Ð𝕏 tips. We do not scrape the web for ads or sell browsing history. Details: https://dojak.app/privacy

## 6. Privacy practices form — answers that match the code

Say **Yes, this extension collects or uses user data.** (Content scripts on sites + chain API calls. Saying No here is a reject.)

| Category | Answer |
| --- | --- |
| Personally identifiable information | Not collected (no accounts, names, or emails) |
| Health | No |
| Financial and payment | Yes — cryptocurrency addresses and tx data handled locally; broadcasts go to Dogecoin via command.dog. No bank/card data collected by Dojak |
| Authentication | No (unlock password encrypts local vault only; never sent to us) |
| Personal communications | No |
| Location | No |
| Web history | Disclose: provider inject on visited sites for Connect; no history sold or used for ads |
| User activity | Local preferences / connected sites only |
| Website content | Yes — used only to offer Connect / Ð𝕏 tip UI and approval prompts the user starts |

**Why is data used?** To provide the wallet’s primary features (balances, send, dApp connect, Ð𝕏).

**Sold to third parties?** No

**Used for creditworthiness?** No

**Remote code?** No. All JS is bundled in the zip. Minification only.

## 7. Review notes (optional box)

```
Dojak Wallet is a non-custodial Dogecoin wallet (MV3). Seed/keys are encrypted in chrome.storage and never sent to our servers.

<all_urls> + a content script are required to inject window.dojak on dApps the user visits (industry-standard wallet provider) and to add Ð𝕏 tip UI on x.com / twitter.com. We do not monetize browsing data.

Broadcast and index traffic goes to command.dog / dogex (Dogecoin L1). Privacy policy: https://dojak.app/privacy
Terms: https://dojak.app/terms
Support: https://dojak.app/faq
Source/product: https://github.com/jonheaven/dojak
```

## Do not

- Claim the product is open source (Dogenals spec is; Dojak is not)
- Put competitor names in the listing
- Answer “no user data” on the privacy form
- Submit before https://dojak.app/privacy returns 200
