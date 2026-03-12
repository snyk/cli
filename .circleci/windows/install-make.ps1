Param()

$ErrorActionPreference = 'Stop'

try {
  $makeVersion = '4.4.1'
  $cacheDir = 'C:\tools-cache'
  $makeZip = Join-Path $cacheDir "make-$makeVersion-without-guile-w32-bin.zip"
  $makeDir = 'C:\tools\make'

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

}
catch {
  Write-Error "Failed to install GNU Make: $($_.Exception.Message)"
  exit 1
}

