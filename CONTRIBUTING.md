# Development

Use Node.js 24+ on Windows. Run `npm ci`, `npm test` and `npm run build`. Start the real desktop app with `npm run dev:desktop`. `npm run dev` is only a visual renderer preview.

Keep renderer code in `src`, domain types/logic in `shared`, and database, OAuth, reminders and lifecycle code in `electron`. Validate new IPC commands in the main process. Never expose database paths, OAuth tokens, arbitrary shell commands or unrestricted filesystem methods to the renderer.

Run `npm run check:release` before packaging. Read `docs/VERIFICATION.md` for checks actually performed and known limits, and `docs/GITHUB-RELEASE.md` for release steps. The build preparation script adapts legacy minimatch consumers to the pinned modern brace-expansion API and guards Vite's optional mapped-drive lookup in restricted shells.

Preserve the supplied prototype and illustrated assets. Use an isolated profile with `MY_TASKS_DATA_DIR` for desktop tests. Never commit real personal tasks, tokens, OAuth client files or signing keys.
