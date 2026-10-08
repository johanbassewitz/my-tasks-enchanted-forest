# Publish My Tasks on GitHub

The repository is prepared locally. No GitHub repository or release has been created from this session.

## What people will install

Users open your repository's **Releases**, download **My-Tasks-Setup-1.0.0-x64.exe**, and run it. The one-click installer installs for their Windows user and creates **My Tasks** shortcuts on the Desktop and Start menu. The application opens after installation. Node.js, PowerShell launch scripts and source files are not part of the user's installation steps.

Supporting Electron files are placed in the normal installation folder; the desktop shows the app shortcut. This is ordinary desktop installation, not concealment or deletion of necessary runtime files. Task data stays separately in `%APPDATA%\My Tasks` and is preserved on uninstall.

## Upload the source

1. Create an empty GitHub repository named `my-tasks` (or your preferred name). Choose its visibility yourself.
2. Unzip `release/My-Tasks-GitHub-Source.zip`. Upload the **contents** of that ZIP to the repository, including `.github`, rather than uploading the ZIP as a single repository file. Use GitHub's Add file → Upload files, GitHub Desktop, or Git.
3. Keep the dependency lockfile. Do not upload `node_modules`, local databases, OAuth/client JSON files, `.env` files, caches or the entire working folder.

For Git users, run these commands from the extracted clean source directory:

```powershell
git init -b main
git add .
git commit -m "Prepare My Tasks desktop application"
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the remote URL with your own repository URL. No repository-specific URLs or account credentials are hardcoded into the workflow. The ZIP is created from an explicit source allowlist; the supplied mockup, artwork and reference code are retained, while machine-specific build caches and user data are excluded.

## Create the first downloadable installer

1. Open **Actions → Windows build and release**. The initial main-branch build runs tests and builds the installer on a Windows runner. You can also choose **Run workflow** to obtain a build artifact without creating a release.
2. When the build is green, push a tag matching `package.json`:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

3. The tag workflow builds and tests again, then creates a **draft release** containing the single Windows installer and its SHA-256 checksum file.
4. Download the installer from the draft and test installation, desktop shortcut, launch, quit/tray, notifications, restart persistence and uninstall on a normal Windows desktop. Edit the draft notes to record actual checks, then click **Publish release**.
5. Share the release page. Users should download the setup `.exe` under **Assets**, not GitHub's automatically generated “Source code” ZIP.

GitHub's built-in workflow token handles the draft upload. No personal access token needs to be pasted into source or configured for ordinary releases. The build job has read-only repository access; only the tag-release upload job receives `contents: write`.

## Local installer build

With Node.js 24+ and normal internet/process access:

```powershell
npm ci
npm test
npm run check:release
npm run dist:installer
```

Output: `release/My-Tasks-Setup-1.0.0-x64.exe`. `Build-Windows.ps1` also builds the installer and single-file portable option. The fallback folder portable remains available via `Build-Windows.ps1 -PortableFolderOnly`.

The installer could not be built or executed inside the managed environment used for initial development. GitHub Actions is configured but has not been run remotely yet; do not describe the first release as verified until the workflow and native install checks succeed. Binaries remain unsigned until you configure Windows code signing. No automatic updater is included; users install later release installers normally.

## Release another version

Use `npm version patch --no-git-tag-version` to update package and lockfile versions, review `CHANGELOG.md`, commit the changes and push a matching `vX.Y.Z` tag. Installer filenames and checksums use the package version. Keep the app ID stable so installed upgrades retain the same identity and data location.

## Google Calendar for other people

Every installation works locally without Google. The in-app Setup guide explains the current personal Desktop OAuth client setup. Packaging does not remove Google's OAuth registration requirement. Do not commit personal client files, user tokens or signing keys. A future shared Google app registration would require its own consent/verification work; it is not simulated or bundled here.
