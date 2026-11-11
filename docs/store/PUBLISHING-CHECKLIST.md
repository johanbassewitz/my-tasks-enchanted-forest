# Daywhisper release gates

This is a release candidate, not certification or permission to publish.

## Account and commercial setup
- [ ] Reserve Daywhisper in the owner's existing Microsoft Partner Center account.
- [ ] Copy exact Identity Name, Publisher (CN=...), Publisher Display Name into config/store.json.
- [ ] Configure Paddle products/prices for themes, packs, supporter subscriptions and 50-action AI credits.
- [ ] Deploy services/cloud with D1, verified email sender and secret keys. Start in Paddle sandbox.
- [ ] Configure config/cloud.json HTTPS API, approved checkout origins and offline-license public key.
- [ ] Test verified sign-in, checkout cancel/complete, restore, refunds, disputes and subscription expiry.
- [ ] Test duplicate/out-of-order webhooks, concurrent AI quota use, errors and free allowance reset.
- [ ] Set a capped OpenRouter key, selected model and server-wide request budget; measure real costs.
- [ ] Confirm final prices and allowance. Preview uses five free successful actions/month as a configurable pilot default.
- [ ] Disable preview, enable configured services only after sandbox validation. Disclose Paddle in Partner Center.
- [ ] Configure private feedback server secrets/verified sender, deploy HTTPS endpoint, verify inbox receipt.
- [ ] Finalize privacy retention/private contact details and publish the privacy notice.
- [ ] Arrange an advertiser/provider before enabling sponsorship; never embed network ad scripts in renderer.

## Technical and content acceptance
- [ ] Build candidate workflow on both release branches with all tests and screenshots green.
- [ ] Inspect all screenshots, all three themes at 100%, 125%, 150% text sizes.
- [ ] Install/uninstall/reinstall on a clean Windows 10/11 PC; test direct-to-Store data transfer using export/import.
- [ ] Run Windows App Certification Kit against the exact final Store package.
- [ ] Verify tray close/quit, notification permissions, sleep/resume, missed reminders, startup disabled by Windows.
- [ ] Verify Store updates preserve data and use a valid increasing four-part package version with final segment zero.
- [ ] Verify restoring malformed backups never loses live data; export independent backup before uninstall.
- [ ] Verify packaged startup helper, Paddle browser checkout, signed offline-license expiry and purchase-disable setting.
- [ ] Check third-party dependency licenses and prove rights to original forest artwork/icon/fonts before sale.
- [ ] Review all Store description claims against actual enabled features.
- [ ] Run npm run check:store -- --submission. This intentionally fails while identity/services are missing.
- [ ] Obtain owner approval for actual Store submission/publication.

## Build
Windows, Node 24, .NET 8 SDK:
```
npm ci
npm test
npm run build
npm run test:ui
npm run build:store-helper
npm run dist:installer
npm run dist:store
```
The Store target is APPX, supported by Microsoft Store for packaged desktop apps and
by the pinned stable electron-builder 26.15.3. Do not adopt unreleased v27 MSIX config.
Files named PREVIEW use test identity and cannot be submitted as the reserved app.
The workflow builds artifacts only; it does not publish a release or submit to the Store.
The direct installer is unsigned until a signing certificate/service is configured.
Store distribution signs the accepted package and manages Store updates. Direct builds
currently update by installing a new release; no automatic updater is claimed.

References:
https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements
https://learn.microsoft.com/en-us/windows/uwp/monetize/in-app-purchases-and-trials
