$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$target = Join-Path $PSScriptRoot 'release\My Tasks Portable\My Tasks.exe'
if (!(Test-Path -LiteralPath $target)) { throw 'Build the portable application first.' }
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $desktopDirectory 'My Tasks.lnk'))
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = Split-Path -Parent $target
$shortcut.IconLocation = (Join-Path $PSScriptRoot 'build\icon.ico')
$shortcut.Save()
Write-Host 'Created My Tasks on your desktop.'
