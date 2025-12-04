# Dojak Wallet

Dojak Wallet - the best browser extension wallet for Doginals on Dogecoin.

- Website: https://dojak.dog/
- Twitter: https://x.com/dojak_wallet

## How to build

- Install [Node.js](https://nodejs.org) version 16 (LTS recommended)
- Install dependencies: `yarn` (or `npm ci` to respect `package-lock.json`)
- Build the project to the `./dist/` folder with `yarn build:firefox` for Firefox
- Build the project to the `./dist/` folder with `yarn build:chrome` for Chrome
- Develop: `yarn build:chrome:dev`

## Developer reference

- See `docs/DEVELOPMENT.md` for a day-to-day workflow, Dogecoin parameter sanity checks, and release hygiene.
- Audit for unused surface area with:
  - `npm run analyze:deps` (reports unused or missing dependencies)
  - `npm run analyze:exports` (flags unused TypeScript exports)

## Special Thanks

Thanks to the MetaMask team for their contributions to the browser extension wallet community, Dojak Wallet relies heavily on their contributions.
