Param()

$ErrorActionPreference = 'Stop'

try {
  $makeVersion = '4.4.1'
  $cacheDir = 'C:\tools-cache'
  $makeZip = Join-Path $cacheDir "make-$makeVersion-without-guile-w32-bin.zip"
  $makeDir = 'C:\tools\make'
  $expectedSha256 = 'fb66a02b530f7466f6222ce53c0b602c5288e601547a034e4156a512dd895ee7'

  if (Get-Command make -ErrorAction SilentlyContinue) {
    Write-Host 'make already available on PATH, skipping install.'
    return
  }

  if (-not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir | Out-Null
  }

  if (-not (Test-Path $makeDir)) {
    New-Item -ItemType Directory -Path $makeDir | Out-Null
  }

  if (-not (Test-Path $makeZip)) {
    Write-Host "Downloading GNU Make $makeVersion for Windows..."
    $url = 'https://sourceforge.net/projects/ezwinports/files/make-4.4.1-without-guile-w32-bin.zip/download'
    curl.exe -L $url -o $makeZip
  }

  # Verify SHA256 checksum of the downloaded archive
  Write-Host 'Verifying GNU Make archive checksum...'
  $hash = Get-FileHash -Path $makeZip -Algorithm SHA256
  if ($hash.Hash.ToLower() -ne $expectedSha256.ToLower()) {
    throw "Checksum verification failed for $makeZip. Expected $expectedSha256 but got $($hash.Hash.ToLower())."
  }

  Write-Host 'Extracting GNU Make...'
  if (Test-Path $makeDir) {
    Write-Host "Cleaning existing make directory at $makeDir ..."
    Remove-Item -Recurse -Force $makeDir
  }

  New-Item -ItemType Directory -Path $makeDir | Out-Null

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($makeZip, $makeDir)

  $binPath = Join-Path $makeDir 'bin'
  if (-not (Test-Path $binPath)) {
    New-Item -ItemType Directory -Path $binPath | Out-Null
  }

  # Ensure make.exe is available under C:\tools\make\bin for later steps
  $targetMake = Join-Path $binPath 'make.exe'
  $existingMake = Get-ChildItem -Path $makeDir -Recurse -Include 'make.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingMake) {
    if (-not (Test-Path $targetMake) -or $existingMake.FullName -ne $targetMake) {
      Copy-Item $existingMake.FullName -Destination $targetMake -Force
    }
  }
  elseif (-not (Test-Path $targetMake)) {
    throw "make.exe was not found after extraction in $makeDir"
  }

  Write-Host "Adding $binPath to PATH for current session..."
  $Env:Path = "$binPath;" + $Env:Path

  # Persist PATH change for subsequent PowerShell sessions (CircleCI steps)
  try {
    New-Item -Path $profile -ItemType File -Force | Out-Null
    '$Env:Path = "C:\tools\make\bin;" + $Env:Path' | Out-File -FilePath $profile -Append -Encoding UTF8
  }
  catch {
    Write-Host "Warning: failed to persist make PATH update to profile: $($_.Exception.Message)"
  }

}
catch {
  Write-Error "Failed to install GNU Make: $($_.Exception.Message)"
  exit 1
}

