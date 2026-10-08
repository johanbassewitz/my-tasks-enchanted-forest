$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$portable = Join-Path $PSScriptRoot 'release\My Tasks Portable\My Tasks.exe'
$unpacked = Join-Path $PSScriptRoot 'release\win-unpacked\My Tasks.exe'
if (Test-Path -LiteralPath $portable) {
    Start-Process -FilePath $portable
} elseif (Test-Path -LiteralPath $unpacked) {
    Start-Process -FilePath $unpacked
} elseif (Test-Path -LiteralPath '.\node_modules\electron\dist\electron.exe') {
    if (!(Test-Path -LiteralPath '.\dist-electron\electron\main.js')) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'The application build failed.' }
    }
    Start-Process -FilePath (Join-Path $PSScriptRoot 'node_modules\electron\dist\electron.exe') -ArgumentList @("`"$PSScriptRoot`"")
} else {
    Write-Host 'Install Node.js 24 LTS, then run Build-Windows.ps1.'
    exit 1
}
