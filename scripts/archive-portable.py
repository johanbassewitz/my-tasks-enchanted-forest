"""Optional ZIP distribution after Build-Windows.ps1 -PortableFolderOnly."""
from pathlib import Path
import hashlib
import zipfile

root = Path(__file__).resolve().parent.parent
folder = root / "release" / "My Tasks Portable"
archive = folder.parent / "My-Tasks-Portable-1.0.0-win-x64.zip"
if not (folder / "My Tasks.exe").is_file():
    raise SystemExit("Build the portable folder first.")
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=5) as output:
    for file in sorted(folder.rglob("*")):
        if file.is_file():
            output.write(file, file.relative_to(folder.parent))
with zipfile.ZipFile(archive) as output:
    bad = output.testzip()
    if bad:
        raise SystemExit(f"ZIP verification failed: {bad}")
lines = []
for file in [archive, folder / "My Tasks.exe"]:
    digest = hashlib.file_digest(file.open("rb"), "sha256").hexdigest()
    lines.append(f"{digest}  {file.relative_to(folder.parent).as_posix()}")
(folder.parent / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Verified ZIP: {archive} ({archive.stat().st_size:,} bytes)")
