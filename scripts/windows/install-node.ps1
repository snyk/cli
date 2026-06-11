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
  # Resolve repo root from script location (script is in scripts/windows)
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
  $nvmrcPath = Join-Path $repoRoot '.nvmrc'

  if (-not (Test-Path $nvmrcPath)) {
    throw ".nvmrc not found at $nvmrcPath"
  }

  $nodeVersion = (Get-Content $nvmrcPath -Raw).Trim().TrimStart('v')
  if ([string]::IsNullOrWhiteSpace($nodeVersion)) {
    throw ".nvmrc is empty at $nvmrcPath"
  }

  # nvm-windows is the only supported installer here. It manages
  # C:\Program Files\nodejs as a junction; using a parallel MSI install on the
  # same machine leaves stale npm internals.
  $nvmExe = Get-Command nvm -ErrorAction SilentlyContinue
  if (-not $nvmExe) {
    throw "nvm-windows is required but was not found on PATH. Ensure the runner image provides nvm-windows."
  }

  Write-Host "nvm-windows: $($nvmExe.Source)"
  Write-Host "NVM_HOME: $env:NVM_HOME"
  Write-Host "NVM_SYMLINK: $env:NVM_SYMLINK"

  $nvmList = & nvm list 2>&1 | Out-String
  if ($nvmList -notmatch ('\b' + [regex]::Escape($nodeVersion) + '\b')) {
    Write-Host "[nvm-cache] MISS: Node.js v$nodeVersion not present; installing via nvm..."
    & nvm install $nodeVersion
  } else {
    Write-Host "[nvm-cache] HIT: Node.js v$nodeVersion already installed in nvm; skipping download."
  }

  Write-Host "Activating Node.js v$nodeVersion via nvm..."
  & nvm use $nodeVersion

  # Verify installation using the known default installation path
  $nodeExe = "C:\Program Files\nodejs\node.exe"
  if (-not (Test-Path $nodeExe)) {
    throw "node.exe not found at expected path '$nodeExe' after installation."
  }

  $reportedVersion = & $nodeExe -v
  if ($reportedVersion.Trim() -ne "v$nodeVersion") {
    throw "Installed Node.js version '$reportedVersion' does not match expected 'v$nodeVersion'."
  }

  Write-Host "Node.js $reportedVersion installed and active at $nodeExe"

  # Node 22 bundles npm ~10.9, below package.json "engines" (>=11.10). Upgrade the
  # active Node's npm so engine-strict (.npmrc) doesn't fail the build.
  $npmCmd = "C:\Program Files\nodejs\npm.cmd"
  Write-Host "Upgrading npm to npm@^11.10 ..."
  & $npmCmd install -g "npm@^11.10"
  if ($LASTEXITCODE -ne 0) { throw "npm upgrade failed with exit code $LASTEXITCODE" }
  Write-Host "npm $((& $npmCmd -v).Trim()) active"

}
catch {
  Write-Error "Failed to install Node.js: $($_.Exception.Message)"
  exit 1
}
