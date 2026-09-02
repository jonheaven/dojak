# @dojak/web

## Unreleased

- Browser wallet requires a password to persist generated or imported seeds. Legacy plaintext `wallet_mnemonic_*` / `dojakweb_wallet_unencrypted_*` copies are migrated to WebCrypto AES-GCM on unlock, then wiped. Unlock password is never written to `sessionStorage` (extension: `chrome.storage.session`; public site: in-memory only; legacy storage keys wiped).
- PSBT approval distinguishes **verified** / **decoded** / **unverified** intent — missing host claims is no longer presented as a green “ok” security guarantee.
- `validateSellerPSDT` requires `SIGHASH_SINGLE|ANYONECANPAY` (0x83) so marketplace fills cannot use a dangerous listing sighash.
- `buildMarketplaceBuyClaims` helps hosts pass destination allowlists into Local Browser Wallet approval.
- HTML inscription iframes no longer combine `allow-scripts` with `allow-same-origin`.
