# Dojak Submission Guide

This guide provides step-by-step instructions for submitting Dojak builds to the respective app stores and extension marketplaces. Dojak is a monorepo supporting browser extension, mobile (Android/iOS), and web platforms. Follow the build commands in the main README.md before submitting.

## Prerequisites
- Ensure your builds are tested and comply with each store's policies (e.g., no crypto mining, provide privacy policies for wallet features).
- Have developer accounts ready for each platform.
- Prepare assets: Icons, screenshots, descriptions, privacy policies.

## Apple App Store (iOS)
Dojak's iOS app is built using Expo and submitted as an IPA.

1. **Enroll in Apple Developer Program**:
   - Visit [developer.apple.com/programs](https://developer.apple.com/programs).
   - Pay the $99/year fee and create an account.

2. **Build the iOS App**:
   - From repo root: `pnpm --filter @dojak/mobile build` (uses EAS).
   - Download the IPA from EAS dashboard.

3. **Submit via App Store Connect**:
   - Log in to [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
   - Create a new app: Provide name, bundle ID, category (Finance or Utilities).
   - Upload the IPA: Use Transporter app or Xcode.
   - Add metadata: Screenshots (iPhone/iPad), description, keywords (include "Dogecoin wallet").
   - Set pricing (free), and configure in-app purchases if applicable.
   - Submit for review: Include notes explaining crypto features.

4. **Review Process**:
   - Typically 1-2 weeks.
   - Common issues: Financial regulations; provide compliance docs.
   - Once approved, the app is live.

## Google Play Store (Android)
Dojak's Android app is built using Expo and submitted as an AAB/APK.

1. **Sign Up for Google Play Console**:
   - Visit [play.google.com/console](https://play.google.com/console).
   - Pay $25 one-time fee and create an account.

2. **Build the Android App**:
   - From repo root: `pnpm --filter @dojak/mobile build` (uses EAS).
   - Download the AAB from EAS dashboard.

3. **Submit to Play Console**:
   - Create a new app: Choose app type (app), provide title, category (Finance).
   - Upload the AAB: Go to Release > Production > Create new release.
   - Add store listing: Description, screenshots (phone/tablet), feature graphic.
   - Declare data safety: Specify wallet data handling (e.g., financial info).
   - Set content rating (high maturity for crypto).
   - Publish: Submit for review.

4. **Review Process**:
   - Typically 3-7 days.
   - Focus on privacy policy and avoiding scam flags.
   - Once approved, publish to production.

## Chrome Web Store (Browser Extension)
Dojak's extension is built for Chrome and compatible with Chromium-based browsers like Brave.

1. **Create Chrome Web Store Developer Account**:
   - Visit [chrome.google.com/webstore/developer/dashboard](https://chrome.google.com/webstore/developer/dashboard).
   - Pay $5 one-time fee.

2. **Build the Extension**:
   - From repo root: `pnpm --filter @dojak/extension exec gulp build --env=pro --browser=chrome --manifest=mv3 --channel=github`.
   - Output: `apps/extension/dist/dojak-chrome-mv3-v<version>.zip`.

3. **Submit to Chrome Web Store**:
   - Upload the ZIP file to the dashboard.
   - Paste listing copy from [chrome-web-store-listing.md](chrome-web-store-listing.md) (name, summary, description, category Finance).
   - Icons: 128x128 PNG (already in the package).
   - Set visibility: Public.
   - Provide privacy policy URL: **https://dojak.app/privacy** (must be live before you click Submit).
   - Submit for review.

4. **Review Process**:
   - Typically 1-7 days.
   - Extensions with wallet features may need security reviews.
   - Once approved, it's available in the store.

## Brave Browser (Extensions)
Brave uses the Chrome Web Store for extensions, as it's Chromium-based. No separate submission needed.

1. **Follow Chrome Web Store Steps Above**:
   - Submit to Chrome Web Store as described.
   - Test compatibility: Load the extension in Brave to ensure no Chrome-specific issues.

2. **Additional Notes**:
   - Brave may have its own policies; check [brave.com/brave-rewards/extension-developers](https://brave.com/brave-rewards/extension-developers) for rewards integration if applicable.
   - Once approved in Chrome, users can install it in Brave.

## General Tips
- **Compliance**: Wallets often face scrutiny for AML/KYC. Include clear privacy policies and avoid features that could be seen as gambling.
- **Updates**: Use each platform's dashboard to submit updates after changes.
- **Testing**: Test builds on emulators/devices before submission.
- **Support**: If rejected, appeal with detailed explanations.
- **Monorepo Advantage**: Build once in the monorepo, then submit artifacts to each store.

For more details, refer to official docs: [Apple](https://developer.apple.com/support/app-store/), [Google](https://developer.android.com/distribute), [Chrome](https://developer.chrome.com/docs/webstore/).