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

## Verification outcome — 2026-11-06
The full Windows pipeline passed on production-preparation commit 817eeb9: 123 unit tests, two native UI tests, .NET helper, NSIS and APPX builds. Both release-preparation branches are saved. See docs/store/VERIFICATION.md for evidence and remaining account/device gates. The owner reiterated preparation only: do not publish, merge main, tag or submit. No live commercial service was activated.

## 1.3.0 Paddle and AI change (10 November 2026)
User completed 1.2.1 testing and requested Paddle-only payments and optional AI credits.
Microsoft commerce has been removed; Store packaging and Windows startup remain.
Desktop cloud session is protected separately from planner backup data. Paddle checkout
uses backend-created transactions and verified entitlements. AI goal/notes-to-tasks
requires consent and reviewed local import. Pilot allowance: five/month; paid pack:
50 bounded successful actions. Prices/model are operator configuration, not finalized.
Cloudflare Worker + D1 source is prepared; no hosting, email, Paddle or OpenRouter
credentials have been supplied or deployed. No live charge, email or AI call is authorized
by merely running the tests. Core local planning and explicit preview packs stay usable.
Live services, sandbox end-to-end validation and final privacy/operator details remain
release gates. Do not publish. Record Windows run evidence separately.
