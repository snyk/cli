param (
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
  [String[]]$Paths
)

# Find the latest version of signtool.exe and use it to verify the executables
$SIGNTOOL = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\" -Recurse -Include 'signtool.exe' | Where-Object { $_.FullName -like "*x64*" } | Sort-Object LastWriteTime | Select-Object -Last 1 -ExpandProperty FullName

$exitCode = 0
foreach ($path in $Paths) {
  & $SIGNTOOL verify /pa $path
  if ($LASTEXITCODE -ne 0) {
    $exitCode = $LASTEXITCODE
  }
}

exit $exitCode
