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
  $dotnetVersion = '8.0.100'
  $dotnetExe = 'C:\Program Files\dotnet\dotnet.exe'
  $dotnetPath = $null

  if (Test-Path $dotnetExe) {
    # `dotnet --version` reports the SDK selected for the current dir (usually the
    # newest installed), so it can't confirm a specific version. `--list-sdks`
    # enumerates every installed SDK, which is what we need to detect 8.0.100.
    $installedSdks = & $dotnetExe --list-sdks 2>&1
    # `--list-sdks` prints "<version> [<path>]"; require the exact version to be
    # followed by whitespace or end-of-line so e.g. "8.0.100-preview" is not
    # treated as "8.0.100", while a bare version line still matches.
    if ($installedSdks | Where-Object { $_ -match ('^' + [regex]::Escape($dotnetVersion) + '(\s|$)') }) {
      Write-Host "[dotnet-cache] HIT: .NET SDK $dotnetVersion already installed; skipping installer."
      $dotnetPath = Split-Path $dotnetExe -Parent
    }
  }

  if (-not $dotnetPath) {
    $installerPath = Join-Path $cacheDir "dotnet-sdk-$dotnetVersion-win-x64.exe"
    $expectedSha256 = 'd77a87a78264fcfb1703a7064795ccb10938cdfaea64a03cb0f36b1cda379f82'

    if (-not (Test-Path $cacheDir)) {
      New-Item -ItemType Directory -Path $cacheDir | Out-Null
    }

    if (-not (Test-Path $installerPath)) {
      Write-Host "Downloading .NET SDK $dotnetVersion installer..."
      $url = "https://builds.dotnet.microsoft.com/dotnet/Sdk/$dotnetVersion/dotnet-sdk-$dotnetVersion-win-x64.exe"
      curl.exe -L $url -o $installerPath
    }

    Write-Host 'Verifying .NET SDK installer checksum...'
    $hash = Get-FileHash -Path $installerPath -Algorithm SHA256
    if ($hash.Hash.ToLower() -ne $expectedSha256.ToLower()) {
      throw "Checksum verification failed for $installerPath. Expected $expectedSha256 but got $($hash.Hash.ToLower())."
    }

    Write-Host "Installing .NET SDK $dotnetVersion..."
    & $installerPath /install /quiet /norestart /log "$cacheDir\dotnet-sdk-install.log"

    # Locate installed dotnet.exe using the known default installation path (%ProgramFiles%\dotnet)
    if (-not (Test-Path $dotnetExe)) {
      throw ".NET SDK $dotnetVersion did not install correctly; expected $dotnetExe to exist."
    }

    $dotnetPath = Split-Path $dotnetExe -Parent
  }

  Write-Host "Adding $dotnetPath to PATH for current session..."
  $Env:Path = "$dotnetPath;" + $Env:Path

  try {
    if (-not (Test-Path $profile)) {
      New-Item -Path $profile -ItemType File -Force | Out-Null
    }
    $pathUpdateLine = '$Env:Path = "' + $dotnetPath + ';" + $Env:Path'
    $profileContent = Get-Content -Path $profile -ErrorAction SilentlyContinue
    if (-not $profileContent -or -not ($profileContent -contains $pathUpdateLine)) {
      $pathUpdateLine | Out-File -FilePath $profile -Append -Encoding UTF8
    }
  }
  catch {
    Write-Host "Warning: failed to persist .NET PATH update to profile: $($_.Exception.Message)"
  }

  # Append PATH update to shared environment script for CircleCI steps
  try {
    $envScript = Join-Path $cacheDir $cacheFileName
    if (-not (Test-Path $envScript)) {
      New-Item -Path $envScript -ItemType File -Force | Out-Null
    }
    $pathUpdateLine = '$Env:Path = "' + $dotnetPath + ';" + $Env:Path'
    $existing = Get-Content -Path $envScript -ErrorAction SilentlyContinue
    if (-not $existing -or -not ($existing -contains $pathUpdateLine)) {
      $pathUpdateLine | Out-File -FilePath $envScript -Append -Encoding UTF8
    }
  }
  catch {
    Write-Host "Warning: failed to persist .NET PATH update to env script: $($_.Exception.Message)"
  }

  # Also create a bash-compatible version for non-PowerShell envs
  try {
    $bashEnvScript = Join-Path $cacheDir $bashCacheFileName
    if (-not (Test-Path $bashEnvScript)) {
      New-Item -Path $bashEnvScript -ItemType File -Force | Out-Null
    }
    $bashPath = $dotnetPath.Replace('\', '/').Replace('C:', '/c') # Swap $dotnetPath for the relevant tool path
    $bashUpdateLine = 'export PATH="' + $bashPath + ':$PATH"'
    $bashExisting = Get-Content -Path $bashEnvScript -ErrorAction SilentlyContinue
    if (-not $bashExisting -or -not ($bashExisting -contains $bashUpdateLine)) {
      [System.IO.File]::AppendAllText($bashEnvScript, $bashUpdateLine + "`n", (New-Object System.Text.UTF8Encoding $false))
    }
  }
  catch {
    Write-Host "Warning: failed to persist .NET PATH update to bash env script: $($_.Exception.Message)"
  }
}
catch {
  Write-Error "Failed to install .NET SDK: $($_.Exception.Message)"
  exit 1
}

