# Project: My Tasks — Microsoft Store release

## Goal and scope
Prepare a reliable Windows planner for Microsoft Store review. Submission/publication
requires final owner approval. Current work is on release/local-only-store-prep.

## Decisions
- Free core; optional themes, add-ons (Study first), and subscription are the product direction.
- Google Calendar removed at owner's request, including service code and interface.
- Native reminders remain independent and work while app runs, including tray mode.
- Feedback sends inside app; recipient and subject not shown. Recipient configured privately on the server;
  subject is the app name. Optional reply email and message only; no planner attachment.
- Naming pending. Keep existing app identity/data directory until a name is approved.
- Source audit/COMMERCIAL-AUDIT.md is absent; use source inspection and pasted audit.

## Workstreams
Core reliability; Store packaging/compliance; feedback delivery; naming/monetization.

## Tasks
- [x] task-001 — Remove Google integration and preserve local data (step: 1, owner: master, status: done)
- [ ] task-002 — Feedback UI/client/server implementation and deployment (step: 1, owner: master, status: review)
- [ ] task-003 — Stop scheduler's full-state writes each second (step: 2, owner: master, status: pending)
- [ ] task-004 — Automatic backup/recovery and native Windows regression checks (step: 2, owner: master, status: pending)
- [ ] task-005 — Store package, identity, privacy/listing, licensing/assets review (step: 3, owner: master, status: pending)
- [ ] task-006 — Define and validate first-release monetization scope (step: 3, owner: master, status: pending)

## Reports
### task-001
Schema 4 clears legacy remote links, metadata credentials and outbox, preserving local
items. Legacy serialized fields remain inert for old backup compatibility. Sync/OAuth
commands rejected. Removed service/setup modules and UI. Clean build removes stale JS.

### task-002
Small feedback button, message and optional reply email form; trusted IPC to fixed HTTPS
endpoint; Worker sets recipient/subject and validates inputs with rate limiting. No live
service deployed or mail sent. Requires Cloudflare/Resend setup, verified sender, endpoint
configuration, privacy notice and live verification. Disabled in unconfigured builds.

## Current focus
Verify and save step 1 as a draft PR. Complete delivery setup when account access exists.
Next independent work: scheduler and backup hardening; investigate Store-managed MSIX
packaging. Partner Center identity/access and final name will be required for submission.

## Store research
https://learn.microsoft.com/en-us/windows/apps/publish/get-started
https://learn.microsoft.com/en-us/windows/apps/distribute-through-store/how-to-distribute-your-win32-app-through-microsoft-store
MSIX is the candidate route for Store-managed signing and updates. Packaging and native
compatibility have not yet been validated. Existing installer is NSIS, not Store-ready.

## Verification — 2026-11-05
- npm test: 62 passed across 7 files.
- npm run build: TypeScript and production bundle passed.
- npm run check:release: existing NSIS configuration checks passed; not Store certification.
- git diff --check: passed.
- Browser interaction checks blocked: bundled Playwright browser unavailable; system Chromium
  fails to create its process singleton socket (Operation not permitted). No visual/native
  UI success is claimed. Native Windows installation, reminders and Store packaging untested.
- Existing non-blocking Vite module-format and bundle-size warnings remain.
- Naming suggestions: Axiant Nook, Axiant Bloom, Daywhisper. Availability not cleared.
