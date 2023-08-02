param (
  [Parameter(Mandatory = $true, Position = 0)]
  [String]$FilePath
)

# Find the latest version of signtool.exe and use it to sign the executable
$SIGNTOOL = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\" -Recurse -Include 'signtool.exe' | Where-Object { $_.FullName -like "*x64*" } | Sort-Object LastWriteTime | Select-Object -Last 1 -ExpandProperty FullName
& $SIGNTOOL verify /pa $FilePath
exit $LASTEXITCODE

