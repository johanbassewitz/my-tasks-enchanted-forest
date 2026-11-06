# Daywhisper

A calm Windows planner with local tasks, calendar events, recurring schedules, subtasks, project phases, reminders, focus sessions, search and recoverable trash. Formerly My Tasks — Enchanted Forest.

This branch prepares version 1.2.0 for testing. It is not a published or certified Microsoft Store release. See [release gates](docs/store/PUBLISHING-CHECKLIST.md).

## What's included

- Local planning with no Google account or calendar synchronization.
- Enchanted Forest plus Midnight Observatory and Amber Hearth themes.
- Study planning: subjects, chapters, exam dates, daily availability, revision tasks and recorded focus time.
- Creator pipeline, freelancer project tracker, habit history and private journal packs.
- Automatic rolling local backups, a safety snapshot before restore, and manual export/import.
- In-app feedback form with optional reply email; no planner data attached.
- Store purchase/restore integration and optional labeled sponsorship placement.

Commercial services are disabled until configured. Preview mode unlocks the themes and packs for testing; purchases are unavailable and nobody is charged. The feedback button cannot send until its HTTPS service is deployed. No advertiser or advertising network is connected. Supporter subscriptions are designed to remove sponsorship and unlock themes; packs are separate purchases. Prices remain unset.

## Notifications and storage

Reminders work independently of Google while Daywhisper is open or running in the tray. They cannot fire when the app is fully quit or the computer is off. Windows startup is optional and subject to Windows/user policy.

Existing installations keep their data directory: `%APPDATA%\My Tasks\my-tasks.sqlite`. Settings shows the actual location. Store application-data virtualization can change that location; use export/import when moving between direct and Store installations. Data is not encrypted by the app. Backups on the same disk do not protect against disk loss; export a copy elsewhere.

The scheduler checks deadlines without rewriting unchanged application state every second. Rolling backups run at startup and every six hours while open, retaining fourteen automatic snapshots. Restore first writes a safety copy and validates imported data transactionally.

Google service code and sign-in were removed. Migration clears old remote links and credentials while preserving local tasks and events. Existing events in Google itself are untouched.

## Build and verify

Use Node 24 or newer. Windows Store packaging also requires .NET 8 SDK on Windows.

```sh
npm ci
npm test
npm run build
npm run test:ui
npm run check:release
npm run check:store
npm run dev:desktop
```

```sh
npm run build:store-helper
npm run dist:installer
npm run dist:store
```

The candidate workflow builds an unsigned NSIS desktop installer and a Store APPX preview, plus UI screenshots. A PREVIEW package uses test identity and is not for submission. Configure the reserved Store identity and products, then pass `npm run check:store -- --submission` before building a submission candidate. Store purchases, packaged startup and certification need testing with the real account.

The renderer-only `npm run dev` preview cannot save. Native Electron tests use isolated data directories. Legacy PowerShell launch scripts remain for development compatibility; use the packaged installer for distribution.

## Release documentation

- [Publishing checklist](docs/store/PUBLISHING-CHECKLIST.md)
- [Store listing draft](docs/store/LISTING.md)
- [Privacy draft](docs/store/PRIVACY.md)
- [Feedback deployment](services/feedback/README.md)
- [Project state](docs/my-tasks-project-control.md)

Direct installers require certificate/service setup for signing and currently update by installing a new version. Store distribution provides Store-managed signing and updates after acceptance. Artwork rights, Windows device checks and owner approval remain release gates.
