"""Create an explicit, clean upload bundle without local data or dependencies."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
output = root / "release" / "My-Tasks-GitHub-Source.zip"
folders = [".github", "docs", "electron", "shared", "src", "tests", "e2e", "public", "reference"]
files = [".gitignore", ".gitattributes", "package.json", "package-lock.json", "electron-builder.yml", "index.html", "tsconfig.json", "tsconfig.electron.json", "vite.config.ts", "playwright.config.ts", "README.md", "CONTRIBUTING.md", "CHANGELOG.md", "My-Tasks.html", "Build-Windows.ps1", "Launch-My-Tasks.ps1", "Install-My-Tasks.ps1", "Create-Desktop-Shortcut.ps1", "build/icon.png", "build/icon.ico", "scripts/prepare-local.cjs", "scripts/package-portable.cjs", "scripts/archive-portable.py", "scripts/create-source-bundle.py", "scripts/verify-release.cjs", "scripts/checksums.cjs"]

def allowed(file):
    parts = file.relative_to(root).parts
    name = file.name.lower()
    return not any(part in {"node_modules", "__pycache__", ".git"} for part in parts) and not (name.startswith(("client_secret", ".env", "token")) or name == "credentials.json" or file.suffix.lower() in {".sqlite", ".db", ".pfx", ".p12", ".pem", ".lnk", ".log"})

selected = {root / name for name in files}
for folder in folders:
    selected.update(file for file in (root / folder).rglob("*") if file.is_file() and allowed(file))
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
    for file in sorted(selected):
        if not file.is_file():
            raise SystemExit(f"Required source file missing: {file.relative_to(root)}")
        archive.write(file, file.relative_to(root))
with zipfile.ZipFile(output) as archive:
    if archive.testzip():
        raise SystemExit("Source ZIP integrity check failed")
    names = archive.namelist()
    if ".github/workflows/windows-release.yml" not in names:
        raise SystemExit("Workflow missing from bundle")
    if any(name.startswith(("node_modules/", "release/", ".browser-test-data/", ".desktop-check/")) for name in names):
        raise SystemExit("Local data leaked into source bundle")
print(f"Clean GitHub source: {output} ({len(names)} files, {output.stat().st_size:,} bytes)")
