Param(
  [string]$cacheDir = 'C:\tools-cache',
  [string]$cacheFileName = 'snyk-env.ps1',
  [string]$bashCacheFileName = 'snyk-env.sh'
)

$ErrorActionPreference = 'Stop'

# Load previously persisted tool PATH entries if present
$envScript = Join-Path $cacheDir $cacheFileName
if (Test-Path $envScript) {
  . $envScript
}

try {
  $makeVersion = '4.4.1'
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

  # Resolve make.exe from the extracted archive in a deterministic and validated way.
  # First, try the expected layout: make-<version>-without-guile-w32-bin\bin\make.exe
  $expectedRoot = Join-Path $makeDir "make-$makeVersion-without-guile-w32-bin"
  $candidates = @()
  if (Test-Path (Join-Path $expectedRoot 'bin\make.exe')) {
    $candidates += Get-Item (Join-Path $expectedRoot 'bin\make.exe')
  }

  # Fallback: search for make.exe under $makeDir but require a unique match
  if ($candidates.Count -eq 0) {
    $searchResults = Get-ChildItem -Path $makeDir -Recurse -Filter 'make.exe' -File -ErrorAction SilentlyContinue
    if ($searchResults) {
      $candidates += $searchResults
    }
  }

  if (-not $candidates -or $candidates.Count -eq 0) {
    throw "Failed to locate make.exe under $makeDir after extraction"
  }
  if ($candidates.Count -gt 1) {
    $paths = ($candidates | Select-Object -ExpandProperty FullName) -join ', '
    throw "Ambiguous make.exe location after extraction; found multiple candidates: $paths"
  }

  $sourceMake = $candidates[0].FullName
  $sourceBinPath = Split-Path $sourceMake -Parent

  # Ensure make.exe is available under C:\tools\make\bin for later steps
  $binPath = Join-Path $makeDir 'bin'
  if (-not (Test-Path $binPath)) {
    New-Item -ItemType Directory -Path $binPath | Out-Null
  }

  $targetMake = Join-Path $binPath 'make.exe'
  if (-not (Test-Path $targetMake) -or $sourceMake -ne $targetMake) {
    Copy-Item $sourceMake -Destination $targetMake -Force
  }

  Write-Host "Adding $binPath to PATH for current session..."
  $Env:Path = "$binPath;" + $Env:Path
  # Line to persist make on PATH for future sessions
  $pathUpdateLine = '$Env:Path = "' + $binPath + ';" + $Env:Path'

  # Persist PATH change for subsequent PowerShell sessions (CircleCI steps)
  try {
    if (-not (Test-Path $profile)) {
      New-Item -Path $profile -ItemType File -Force | Out-Null
    }
    $pathUpdateLine | Out-File -FilePath $profile -Append -Encoding UTF8
  }
  catch {
    Write-Host "Warning: failed to persist make PATH update to profile: $($_.Exception.Message)"
  }

  # Append PATH update to shared environment script for CircleCI steps
  try {
    $envScript = Join-Path $cacheDir $cacheFileName
    if (-not (Test-Path $envScript)) {
      New-Item -Path $envScript -ItemType File -Force | Out-Null
    }
    $pathUpdateLine | Out-File -FilePath $envScript -Append -Encoding UTF8
  }
  catch {
    Write-Host "Warning: failed to persist make PATH update to env script: $($_.Exception.Message)"
  }

  # Also create a bash-compatible version for non-PowerShell envs
  try {
    $bashEnvScript = Join-Path $cacheDir $bashCacheFileName
    if (-not (Test-Path $bashEnvScript)) {
      New-Item -Path $bashEnvScript -ItemType File -Force | Out-Null
    }
    $bashPath = $binPath.Replace('\', '/').Replace('C:', '/c') # Swap $binPath for the relevant tool path
    $bashUpdateLine = 'export PATH="' + $bashPath + ':$PATH"'
    $bashExisting = Get-Content -Path $bashEnvScript -ErrorAction SilentlyContinue
    if (-not $bashExisting -or -not ($bashExisting -contains $bashUpdateLine)) {
      $bashUpdateLine | Out-File -FilePath $bashEnvScript -Append -Encoding UTF8
    }
  }
  catch {
    Write-Host "Warning: failed to persist make PATH update to bash env script: $($_.Exception.Message)"
  }

}
catch {
  Write-Error "Failed to install GNU Make: $($_.Exception.Message)"
  exit 1
}

