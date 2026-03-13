Param()

$ErrorActionPreference = 'Stop'

try {
  $expectedNodeVersion = '20.11.1'
  $expectedSha256 = 'c54f5f7e2416e826fd84e878f28e3b53363ae9c3f60a140af4434b2453b5ae89'

  # Resolve repo root from script location (script is in .circleci/windows)
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
  $nvmrcPath = Join-Path $repoRoot '.nvmrc'

  if (-not (Test-Path $nvmrcPath)) {
    throw ".nvmrc not found at $nvmrcPath"
  }

  $nvmVersion = (Get-Content $nvmrcPath -Raw).Trim()
  if ([string]::IsNullOrWhiteSpace($nvmVersion)) {
    throw ".nvmrc is empty at $nvmrcPath"
  }

  if ($nvmVersion -ne $expectedNodeVersion) {
    throw ".nvmrc version '$nvmVersion' does not match expected Node.js version '$expectedNodeVersion' used by Windows CI."
  }

  $nodeVersion = $expectedNodeVersion

  $cacheDir = 'C:\tools-cache'
  $msiPath = Join-Path $cacheDir "node-v$nodeVersion-x64.msi"

  if (-not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir | Out-Null
  }

  if (-not (Test-Path $msiPath)) {
    Write-Host "Downloading Node.js v$nodeVersion (x64 MSI)..."
    $url = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-x64.msi"
    curl.exe -L $url -o $msiPath
  }

  Write-Host 'Verifying Node.js installer checksum...'
  $hash = Get-FileHash -Path $msiPath -Algorithm SHA256
  if ($hash.Hash.ToLower() -ne $expectedSha256.ToLower()) {
    throw "Checksum verification failed for $msiPath. Expected $expectedSha256 but got $($hash.Hash.ToLower())."
  }

  Write-Host "Installing Node.js v$nodeVersion..."
  & msiexec.exe /i $msiPath /qn /norestart | Out-Null

  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "node.exe not found on PATH after installation."
  }

  $reportedVersion = & node -v
  if ($reportedVersion.Trim() -ne "v$nodeVersion") {
    throw "Installed Node.js version '$reportedVersion' does not match expected 'v$nodeVersion'."
  }

  Write-Host "Node.js $reportedVersion installed successfully at $($node.Path)"
}
catch {
  Write-Error "Failed to install Node.js: $($_.Exception.Message)"
  exit 1
}

