# Daywhisper 1.2.0 preparation report

Prepared on 2026-11-06. No publication, main-branch merge, tag, or Store submission is authorized or performed.

## Verified candidate
Production preparation commit: `817eeb9c5f35ab8262e671dd03f5056efeabd216`.
Windows run: https://github.com/johanbassewitz/my-tasks-enchanted-forest/actions/runs/42284435115
Artifacts: https://github.com/johanbassewitz/my-tasks-enchanted-forest/actions/runs/42284435115/artifacts/13536633017

- 123 unit tests passed on Windows and locally.
- Both native Electron UI scenarios passed: core navigation, task create/complete/restart persistence, keyboard search, two theme choices and cancellation, feedback preview, disabled purchases, Study generation/restart/idempotence, unsaved draft protection and invalid journal date handling.
- TypeScript and production compilation passed.
- Installer and Store configuration validation passed.
- Native .NET Store helper compiled; unpackaged license requests failed safely as expected.
- Windows NSIS installer and APPX preview built, with SHA-256 checksums.
- Dependency audit after updates reported zero known vulnerabilities. This is not a security certification.
- Windows screenshots were reviewed for both added themes and Study. They do not replace all scaling/accessibility/device testing.

Files: `Daywhisper-Setup-1.2.0-x64.exe` and `Daywhisper-PREVIEW-1.2.0-x64.appx`.
GitHub test artifacts are retained for 30 days; the committed workflow can rebuild them.

The generated APPX was inspected: version 1.2.0.0, x64, test identity Daywhisper.Preview, full-trust desktop capability, DaywhisperStartup disabled by default, and the complete native Store helper output present. The production and Store branches have the same application code; the Store branch adds its channel note.

## Deliberately inactive
Store identity/product IDs are blank; commerce is in preview mode. Purchases are disabled and preview features are unlocked for testing. No advertiser is configured. Feedback delivery is disabled until the private service is deployed. No credentials are embedded in the client.

## Required before launch
This is a verified testing candidate, not a submission-ready commercial package. Complete PUBLISHING-CHECKLIST.md: reserve/configure Partner Center identity and products/prices; deploy and test feedback; publish the finalized privacy/support documents; verify artwork rights; test Store flight purchases, refunds, subscription expiry and offline licenses; test installation, notifications, startup, sleep/resume and scaling on Windows devices; run WACK against the final package. Direct installer signing remains unconfigured.

The submission configuration check intentionally fails on the missing real Store identity. After account setup, rebuild and repeat the relevant tests. Reminders require the app to run (including tray mode); they cannot fire while fully quit or the PC is off. Data and local backups are not encrypted by the application.

Vite's nonblocking module-format and bundle-size warnings remain. No automatic updater is claimed for the direct installer; Store updates are handled by Store distribution after acceptance.

## 1.3.0 supersedes earlier Store-commerce verification

Paddle now replaces the Microsoft billing/license implementation described in the historical 1.2.0 notes above. The native helper supports Windows startup only. New payment/AI services remain disabled until deployed and configured; no live checkout, email or model call has been verified. Use services/cloud/README.md and PUBLISHING-CHECKLIST.md for current setup and validation.
