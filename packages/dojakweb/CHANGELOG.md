# @dojak/web

## Unreleased

- Browser wallet requires a password to persist generated or imported seeds. Legacy plaintext `wallet_mnemonic_*` / `dojakweb_wallet_unencrypted_*` copies are migrated to WebCrypto AES-GCM on unlock, then wiped. Unlock password is never written to `sessionStorage`.
