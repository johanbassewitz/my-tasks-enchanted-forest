param([switch]$PortableFolderOnly)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (!(Test-Path -LiteralPath '.\node_modules\typescript')) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'TypeScript or renderer build failed.' }
if ($PortableFolderOnly) {
    & node .\scripts\package-portable.cjs
} else {
    & npm.cmd exec -- electron-builder --win nsis portable --x64 --publish never
}
if ($LASTEXITCODE -ne 0) { throw 'Windows packaging failed. Try -PortableFolderOnly for an offline portable folder.' }
