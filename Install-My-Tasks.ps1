$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'release\My Tasks Portable'
if (!(Test-Path -LiteralPath (Join-Path $source 'My Tasks.exe'))) {
    throw 'The portable build is missing. Run Build-Windows.ps1 -PortableFolderOnly first.'
}
$destination = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\My Tasks'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Get-ChildItem -LiteralPath $source | Copy-Item -Destination $destination -Recurse -Force
$shell = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
    $shortcut = $shell.CreateShortcut((Join-Path $folder 'My Tasks.lnk'))
    $shortcut.TargetPath = Join-Path $destination 'My Tasks.exe'
    $shortcut.WorkingDirectory = $destination
    $shortcut.IconLocation = Join-Path $destination 'resources\app\build\icon.ico'
    $shortcut.Save()
}
Write-Host "Installed My Tasks for your Windows user at $destination."
Write-Host 'Your tasks stay in AppData\Roaming\My Tasks, separately from installation files.'
Start-Process -FilePath (Join-Path $destination 'My Tasks.exe')
