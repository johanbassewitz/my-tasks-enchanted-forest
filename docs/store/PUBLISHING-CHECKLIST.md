# Daywhisper release gates

This is a release candidate, not certification or permission to publish.

## Account and commercial setup
- [ ] Reserve Daywhisper in the owner's existing Microsoft Partner Center account.
- [ ] Copy exact Identity Name, Publisher (CN=...), Publisher Display Name into config/store.json.
- [ ] Create durable add-ons for two themes and five packs; create monthly/yearly supporter subscriptions.
- [ ] Set unique Store product IDs, configure regional prices and cancellation disclosures.
- [ ] Test purchase/cancel/restore/subscription expiry with Store test accounts and private flight.
- [ ] Decide/approve final prices; earlier low prices were experiments, not finalized listing prices.
- [ ] Set config/store.json enabled=true only after configuring products and testing live licenses.
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
- [ ] Verify packaged helper identity, Store checkout owner window, offline OS license behavior and startup task.
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
