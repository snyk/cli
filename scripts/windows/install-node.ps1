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
  # MSI fallback only: SHA256 of node-v{version}-x64.msi from nodejs.org — update when .nvmrc changes.
  $expectedSha256 = 'feffb8e5cb5ac47f793666636d496ef3e975be82c84c4da5d20e6aa8fa4eb806'

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

  # Prefer nvm-windows if available — it manages C:\Program Files\nodejs as a junction.
  # Using the MSI on an NVM-managed machine leaves stale npm internals from the old version.
  $nvmExe = Get-Command nvm -ErrorAction SilentlyContinue
  if ($nvmExe) {
    Write-Host "nvm-windows detected; using nvm to install and activate Node.js v$nodeVersion..."

    $nvmList = & nvm list 2>&1 | Out-String
    if ($nvmList -notmatch [regex]::Escape($nodeVersion)) {
      Write-Host "Installing Node.js v$nodeVersion via nvm..."
      & nvm install $nodeVersion
    } else {
      Write-Host "Node.js v$nodeVersion already installed in nvm."
    }

    Write-Host "Activating Node.js v$nodeVersion via nvm..."
    & nvm use $nodeVersion
  } else {
    Write-Host "nvm-windows not found; falling back to MSI installer..."

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

  Write-Host "Node.js $reportedVersion installed and active at $nodeExe"

  $nodeDir = Split-Path $nodeExe -Parent

  # Persist Node PATH for PowerShell steps
  try {
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

  # Persist Node PATH for bash/Make steps
  try {
    $bashEnvScript = Join-Path $cacheDir $bashCacheFileName
    if (-not (Test-Path $bashEnvScript)) {
      New-Item -Path $bashEnvScript -ItemType File -Force | Out-Null
    }
    $bashPath = $nodeDir.Replace('\', '/').Replace('C:', '/c')
    $bashUpdateLine = 'export PATH="' + $bashPath + ':$PATH"'
    $bashExisting = Get-Content -Path $bashEnvScript -ErrorAction SilentlyContinue
    if (-not $bashExisting -or -not ($bashExisting -contains $bashUpdateLine)) {
      [System.IO.File]::AppendAllText($bashEnvScript, $bashUpdateLine + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
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
