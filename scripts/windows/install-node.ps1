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
  $msiArgs = "/i `"$msiPath`" /qn /norestart"
  $process = Start-Process -FilePath msiexec.exe -ArgumentList $msiArgs -PassThru
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    throw "Node.js MSI installer exited with code $($process.ExitCode)."
  }

  # Verify installation using the known default installation path
  $nodeExe = "C:\Program Files\nodejs\node.exe"
  if (-not (Test-Path $nodeExe)) {
    throw "node.exe not found at expected path '$nodeExe' after installation."
  }

  $reportedVersion = & $nodeExe -v
  if ($reportedVersion.Trim() -ne "v$nodeVersion") {
    throw "Installed Node.js version '$reportedVersion' does not match expected 'v$nodeVersion'."
  }

  Write-Host "Node.js $reportedVersion installed successfully at $nodeExe"

  try {
    $nodeDir = Split-Path $nodeExe -Parent
    $envScript = Join-Path $cacheDir $cacheFileName
    if (-not (Test-Path $envScript)) {
      New-Item -Path $envScript -ItemType File -Force | Out-Null
    }

    $pathUpdateLine = '$Env:Path = "' + $nodeDir + ';" + $Env:Path'
    $existing = Get-Content -Path $envScript -ErrorAction SilentlyContinue
    if (-not $existing -or -not ($existing -contains $pathUpdateLine)) {
      $pathUpdateLine | Out-File -FilePath $envScript -Append -Encoding UTF8
    }
  }
  catch {
    Write-Host "Warning: failed to persist Node.js PATH update to env script: $($_.Exception.Message)"
  }

  # Also create a bash-compatible version for non-PowerShell envs
  try {
    $bashEnvScript = Join-Path $cacheDir $bashCacheFileName
    if (-not (Test-Path $bashEnvScript)) {
      New-Item -Path $bashEnvScript -ItemType File -Force | Out-Null
    }
    $bashPath = $nodeDir.Replace('\', '/').Replace('C:', '/c')
    $bashUpdateLine = 'export PATH="' + $bashPath + ':$PATH"'
    $bashExisting = Get-Content -Path $bashEnvScript -ErrorAction SilentlyContinue
    if (-not $bashExisting -or -not ($bashExisting -contains $bashUpdateLine)) {
      $bashUpdateLine | Out-File -FilePath $bashEnvScript -Append -Encoding UTF8
    }
  }
  catch {
    Write-Host "Warning: failed to persist Node.js PATH update to bash env script: $($_.Exception.Message)"
  }
}
catch {
  Write-Error "Failed to install Node.js: $($_.Exception.Message)"
  exit 1
}

