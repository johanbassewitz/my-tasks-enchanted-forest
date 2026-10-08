# My Tasks — Enchanted Forest

A personal Windows desktop task and calendar app, built with Electron, React, TypeScript and Vite. The supplied `My-Tasks.html` is preserved; its illustrated forest, transparent ivy and visual styling are reused. All eight sections have working local features. No app account or hosting is required.

## Install from GitHub

1. Open this repository's **Releases** page.
2. Under **Assets**, download **My-Tasks-Setup-…-x64.exe**.
3. Run the installer. It installs for your Windows user, creates the **My Tasks** desktop/Start menu icon, and opens the app.

Afterward, open **My Tasks** from its icon. No Node.js, source files or launch scripts are required. The app's supporting files live in the installation folder, and your tasks stay in your Windows application-data folder. Use Windows Settings → Apps to uninstall; your task data is retained.

The installer release must first be built and published by the repository owner. The included GitHub workflow prepares a draft release for review. See [publishing instructions](docs/GITHUB-RELEASE.md).

## Run the existing local portable build

Double-click **`release\My Tasks Portable\My Tasks.exe`**. Keep the entire portable folder together. Node.js is not required to run this build.

Alternatively, from this folder run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Launch-My-Tasks.ps1
```

To install this portable build for your Windows user and create desktop/Start menu shortcuts:

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-My-Tasks.ps1
```

This installation requires no administrator privileges. `Create-Desktop-Shortcut.ps1` also creates a shortcut without installing. These scripts have been supplied, but installation and shortcut creation were not executed in the restricted build environment.

## Use

Home shows real daily completion, the mini calendar, upcoming items and a focus shortcut. Use the contextual editor to create tasks or events. Expand More task options for priority, recurrence, timezone and event details. Tasks can be undated or date-only. Events require a date and valid start/end times; overnight events are prevented with a validation message.

Use **Ctrl+N** for Quick Add and **Ctrl+K** to search titles, notes, categories and locations. Quick Add shows a review before saving. Right-click or use an item's three-dot menu for actions. Deleted items are recoverable in Tasks → Trash. Drag task rows or category cards to reorder; category cards also have keyboard-accessible arrow controls.

Calendar defaults to Week and also offers Day and Month. Click a time slot to create an event. Drag events to move them while preserving duration. Drag their lower edge to resize, or focus the resize handle and use arrow keys; times snap to 15 minutes. Day includes anytime tasks. Recurring items support independent task completion, local occurrence exceptions and series editing. Read the Google limitations below before syncing advanced exceptions.

Focus uses persisted deadlines rather than counting renderer ticks. Pause, resume, restart and sleep recovery use real elapsed time. Completed sessions, focused minutes and streaks derive from session history.

Reminders run in the main process while the app is open, minimized or in the tray. They **cannot run while fully quit or while the computer is off**. Recent missed reminders are summarized, rather than delivered as a flood. The Reminders page provides actual scheduled/snoozed times and working actions. Native Windows notifications open the app; snooze and task actions are available in the app, not native toast action buttons.

Settings persist start page, time format, week start, timezone, Windows startup, start minimized, close to tray, text scale, reduced motion, notification options and Google preferences. Use Quit application or tray → Quit to fully exit.

## Google Calendar

Follow [Google setup](docs/GOOGLE-CALENDAR.md). Create a Google Cloud **Desktop app** OAuth client and enable Calendar API. In Settings click **Sign in with Google** and choose the downloaded client JSON once; Google login opens automatically. Later clicks go directly to login. Tokens and imported client secrets stay in the main process and are encrypted with Windows secure storage; connection fails explicitly if secure storage is unavailable.

For guided help, use **Settings → Google Calendar → Setup guide**. Six short steps provide buttons to Google's project, API, Branding, Audience and Clients pages, explain which JSON file to download, and finish with import/sign-in. Troubleshooting is included.

Two-way synchronization is the default after connecting. Existing unrelated calendar events are imported only when opted in. Offline edits remain in a durable queue; conflicts show local and Google versions for review. Scheduled tasks map to Calendar events, not Google Tasks. Date-only tasks map to all-day events. Phone alerts depend on Google's Calendar application and your phone's notification permissions.

Live Google sign-in has **not** been tested here. OAuth and synchronization request/response behavior passed automated HTTP mocks. Google-linked occurrence field editing, remote recurring instance exceptions, advanced RRULE imports and multi-day remote events are deliberately limited; the app reports these instead of silently flattening them. Supported recurring series and exclusion dates synchronize. Individual task occurrence completion is local state because Calendar has no task-completion field.

## Storage and privacy

Data lives in `%APPDATA%\My Tasks\my-tasks.sqlite`, separate from the executable. Settings shows the exact data location and can open it. SQLite migrations are versioned and mutations are transactional. The driver is Electron's bundled `node:sqlite`, avoiding a separate native module.

Settings → Data exports/imports JSON backups including items, categories, recurrence exceptions, reminder configuration, focus history and nonsecret preferences. Imports validate before replacing data, preserve a safety snapshot and reset remote links to avoid accidental Google overwrites. Original prototype JSON exports are also accepted. OAuth tokens and client secrets are never exported. Only items you enable for Google synchronization are uploaded; optional calendar import retrieves the calendar you select.

## Build and test

Install **Node.js 24 or newer** and run:

```powershell
npm ci
npm test
npm run build
npm run dev:desktop
```

`npm run dev` opens a renderer-only visual preview; it explicitly cannot save without the desktop bridge. Real storage and notifications require Electron. For browser interaction testing against an isolated real SQLite database, run `npm run build`, then `node tests/browser-harness.cjs` and visit `http://127.0.0.1:5175`. This transport is test-only and is never packaged.

```powershell
# NSIS installer and single-file portable (network access for packaging tools)
powershell -ExecutionPolicy Bypass -File .\Build-Windows.ps1

# Folder portable using the installed Electron distribution
powershell -ExecutionPolicy Bypass -File .\Build-Windows.ps1 -PortableFolderOnly

# Native Electron smoke test after building, outside a restricted sandbox
npm run test:ui
```

Electron-builder is configured for per-user installation and installer-created shortcuts. The folder portable is built in `release\My Tasks Portable`; ZIP distribution and checksums are alongside it. No NSIS installer or single-file portable was produced in this environment because packaging helper process creation was denied. The binaries are unsigned.

The [Windows release workflow](.github/workflows/windows-release.yml) runs a clean dependency install, tests, configuration checks and installer build on GitHub's Windows runner. Matching version tags create a draft containing one setup executable and its checksum. The maintainer publishes the draft after checking native installation; users download the installer rather than the source ZIP. See [GitHub release guide](docs/GITHUB-RELEASE.md).

`release\win-unpacked`, if present, is an incomplete earlier packaging attempt; use the named portable folder or ZIP. Cleanup of that incomplete folder was blocked by the managed environment's approval policy.

See [verification report](docs/VERIFICATION.md) for checks actually performed, environment restrictions and remaining limitations.
