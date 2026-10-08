# GitHub release implementation plan

Use the existing desktop application and preserve references and local user data.

- [x] Make source checkout reproducible: verify the lockfile with a clean installation and fix cache-specific paths.
- [x] Configure a branded per-user one-click NSIS installer with desktop/Start menu shortcuts and normal app-data storage.
- [x] Add Windows CI and tag-triggered release automation; only build jobs receive read access, release upload receives write access.
- [x] Add maintainer release instructions and user-facing installation instructions. Exclude local databases, tokens, caches, dependencies and generated binaries from source uploads.
- [x] Validate configuration, build/test source, attempt installer packaging, and produce a clean GitHub source ZIP. Report unexecuted remote workflow/native installer checks honestly.

No repository destination has been supplied, so this prepares local files and automation without publishing externally.
