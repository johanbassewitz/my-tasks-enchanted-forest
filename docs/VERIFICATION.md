# Verification report

## Actual results

- GitHub release preparation: a clean isolated `npm ci --ignore-scripts --offline` installed 366 packages from the repaired lockfile; the preparation script was then run explicitly. The clean source bundle passed its production build and all 63 tests. The NSIS schema, shortcut/icon settings, legacy/modern build-tool compatibility, fixed registry dependency paths, workflow YAML and release permissions were validated. Full Electron download/install scripts and the remote GitHub workflow remain unexecuted in this environment.

- Production renderer build and both TypeScript configurations passed.
- 63 automated tests in seven files passed on Windows using Vitest and real SQLite for repository/command/scheduler tests. The six Google setup tests cover direct login for configured clients, first-time import and immediate login, cancellation, secure-storage refusal, invalid client files and ignoring untrusted endpoint URLs. Two guide tests verify that setup actions accept only named destinations and use fixed official Google HTTPS URLs.
- The six-step in-app Google guide was checked in the browser: every step, Back/Next, numbered navigation, troubleshooting expansion, Escape closure and focus restoration passed, with no browser console errors. Google Cloud links are validated in automated tests; real account configuration and live sign-in still require the user.
- Domain coverage includes input validation, undated/date-only items, quick parsing, daily/weekday/weekly/monthly/yearly/custom recurrence, invalid monthly dates, leap dates, timezone/DST behavior, occurrence identity, overlapping-event lanes and timestamp-based focus completion/deduplication.
- Repository/command coverage includes create/edit/complete/trash/recovery, item ordering, category reassignment, persisted settings/focus state, transactions, outbox durability, migrations, backup round-trip, legacy prototype imports and invalid import rejection.
- Scheduler coverage includes multiple reminder offsets, actual future scheduling, snooze cancellation, delivery deduplication and summarized missed reminders. Clock-driven tests cover focus deadline recovery; physical sleep/resume was not exercised.
- Google HTTP mocks cover OAuth loopback/PKCE/state, refresh, unavailable secure storage, idempotent duplicate creation, bounded retries/rate limits, deletion/unlink behavior, ETag conflicts, incremental tokens, expired-token recovery, paging, selected-calendar import and revocation. No live Google account was connected.
- Browser checks loaded all eight sections against the production React bundle. A separate test-only HTTP bridge exercised production SQLite commands in an isolated profile. Task add/edit/complete, delete confirmation/trash restore, persisted completion after reload, keyboard search and Quick Add review were exercised. The supplied parsing example reviewed as Gym, tomorrow, 18:00, reminder 30 minutes before.
- Calendar Day, Week and Month rendered; month contained 42 date cells. Focus controls were exercised. Category/settings/reminder controls were inspected. Automated domain checks cover overlap geometry, recurrence and durable commands; browser drag/drop, calendar resize, every filter combination and full category CRUD were not exhaustively exercised.
- Original rendered HTML and application were compared visually. The original forest/ivy assets, emerald glass, gold edges, serif typography, left navigation, central list, right editor and scenic widgets are reused.
- Browser viewport checks at 1920×1080, 1600×900, 1440×900 and 1366×768 found no document horizontal overflow. Smaller logical viewports 1093×614 and 911×512 were also checked. These are responsive tests, **not actual Windows 125%/150% DPI verification**.
- A Windows x64 folder portable executable with the themed PE icon and version metadata was produced using the official installed Electron distribution. Source, lockfile, launch/build scripts, per-user install script and shortcut configuration are included.

## Environment limits

Native Electron was launched in the managed Windows environment but Chromium failed to create its Mojo IPC channel with Access denied; the network sandbox also reported access restrictions. A fresh `npm run test:ui` attempt was blocked before test execution when Playwright worker creation failed with `spawn EPERM`. Sandbox protection was kept enabled. Consequently native window behavior, tray behavior, Windows toast/sound delivery, installer execution, OS credential encryption on this machine, real display scaling and physical sleep/resume are **not verified**. The supplied native Playwright smoke test should be run with `npm run test:ui` on an unrestricted Windows desktop.

Electron-builder directory packaging failed when its dependency collector spawned npm (`EPERM`). NSIS tooling was unavailable offline. A pure JavaScript packaging path produced the folder portable instead. No NSIS installer or single-file portable is claimed. Per-user install/shortcut scripts were not run because they write outside the permitted workspace.

A later installer-build attempt with the GitHub release configuration passed compilation but was blocked downloading packaging/runtime resources (`ECONNREFUSED` at the managed network proxy). The GitHub Windows workflow will build a one-click per-user setup executable and create a draft release once the source is uploaded and a version tag is pushed. That remote build and native installer execution are not claimed as verified here.

## Deliberate functional limits

- Overnight local events are rejected; multi-day Google imports are not flattened.
- Google-linked individual occurrence field edits are blocked; edit the series here or the occurrence in Google Calendar. Local occurrence edits and completion work independently. Standard Google RRULE series and EXDATE exclusions are supported; advanced remote rules and recurring instance exceptions are reported and left unchanged.
- Moving an already linked item to a different Google calendar requires unlinking first. Unlink versus remote deletion follows the visible deletion setting.
- Native Windows toast action buttons are not provided. Click a toast to open the app and use real in-app snooze/done/open actions.
- Reminders run only while the process runs; no claim is made about fully quit/powered-off operation.
- Portable builds are unsigned. External Google configuration and browser sign-in are still required for live synchronization.

## Remaining external steps

1. Launch `release\My Tasks Portable\My Tasks.exe` on a normal Windows desktop; verify tray/window controls and use Settings → Test notification.
2. Follow `GOOGLE-CALENDAR.md` to configure your own Desktop OAuth client and sign in. Verify one synced test event and phone Calendar permissions.
3. If an NSIS installer is desired, run `Build-Windows.ps1` with normal network/process access. The provided per-user installation script can install the existing folder build immediately.
