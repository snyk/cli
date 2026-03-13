Param()

$ErrorActionPreference = 'Stop'

try {
  $pythonVersion = '3.12.8'
  $cacheDir = 'C:\tools-cache'
  $pythonInstaller = Join-Path $cacheDir "python-$pythonVersion-amd64.exe"
  $expectedSha256 = '71bd44e6b0e91c17558963557e4cdb80b483de9b0a0a9717f06cf896f95ab598'

  if (-not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir | Out-Null
  }

  if (-not (Test-Path $pythonInstaller)) {
    Write-Host "Downloading Python $pythonVersion (amd64) installer..."
    $url = "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-amd64.exe"
    curl.exe -L $url -o $pythonInstaller
  }

  Write-Host 'Verifying Python installer checksum...'
  $hash = Get-FileHash -Path $pythonInstaller -Algorithm SHA256
  if ($hash.Hash.ToLower() -ne $expectedSha256.ToLower()) {
    throw "Checksum verification failed for $pythonInstaller. Expected $expectedSha256 but got $($hash.Hash.ToLower())."
  }

  Write-Host "Installing Python $pythonVersion..."
  & $pythonInstaller /quiet InstallAllUsers=1 PrependPath=1 Include_test=0

  # Verify installation
  $python = Get-Command python -ErrorAction SilentlyContinue
  if (-not $python) {
    $python = Get-Command python3 -ErrorAction SilentlyContinue
  }
  if (-not $python) {
    throw "Python $pythonVersion did not appear on PATH after installation."
  }

  Write-Host "Python installed at $($python.Path)"
}
catch {
  Write-Error "Failed to install Python: $($_.Exception.Message)"
  exit 1
}

