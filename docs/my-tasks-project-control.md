# Daywhisper release control

## Authorized goal
Finish the local Windows planner, remove Google, rebrand as Daywhisper, add two themes and optional packs, prepare production and Microsoft Store branches and build candidates. Actual Store submission/publication needs final owner approval.

## Product decisions
Free core. Optional theme purchases, separate Study/Creator/Freelancer/Habits/Journal packs, and monthly/yearly supporter subscriptions. Supporter unlocks themes and removes sponsorship. Prices not finalized. Preview unlocks features without simulating purchases. Ads use a small labeled sponsorship placement; no live advertiser is configured.

Feedback is an in-app message plus optional reply email. Destination is a private server variable; subject is Daywhisper. No planner attachments. Never put private recipient/server credentials in this public repository.

Keep existing application ID and data-directory compatibility for direct upgrades. Google code/UI removed; old links/credentials cleared by migration. Reminders work while open/tray, not while fully quit or PC off.

## Implemented locally
- Local-only migration and feedback client/Worker (prior draft PR #4).
- Scheduler write suppression, rolling backups, safety-before-restore.
- Branding, fresh-install empty planner, two selectable themes.
- Study generation and four additional locally persisted packs.
- Server-side command entitlement checks, native Windows Store bridge and startup task.
- APPX manifest/config, Windows candidate workflow, screenshots and release gates.
- Listing/privacy drafts; disabled commercial configuration.

## Current verification phase
Review fixes cover Store license/catalog independence, startup policy truthfulness, unsaved drafts, journal dates, timezone consistency, backup reference integrity and moved study allocations. Run unit tests, TypeScript/build, package checks, and Windows UI/packaging CI before claiming a built candidate. Record exact remote runs in follow-up reports; do not infer Windows success from Linux compilation.

## Pending owner/account gates
Daywhisper reservation and exact Partner Center identity; product IDs/prices; private feedback service deployment and inbox verification; public finalized privacy URL; advertiser agreement if used; rights to bundled original art/icon/fonts; Windows installation/notification/sleep/scaling checks; Store flight purchase/restore/offline tests; WACK; final submission approval.

See docs/store/PUBLISHING-CHECKLIST.md. Preview packages are not submission packages. Source audit/COMMERCIAL-AUDIT.md was unavailable; findings used the supplied audit and code review.
