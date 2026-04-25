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
  $pythonVersion = '3.12.8'
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

  # Persist a single primary installation location for this Python so it is preferred in subsequent steps.
  # We rely on the checksum for integrity and PATH ordering for preference, instead of failing hard on version mismatches.
  try {
    $candidateDirs = @(
      "C:\Program Files\Python312",
      "C:\Python312",
      (Join-Path $Env:LOCALAPPDATA 'Programs\Python\Python312')
    )

    $envScript = Join-Path $cacheDir $cacheFileName
    if (-not (Test-Path $envScript)) {
      New-Item -Path $envScript -ItemType File -Force | Out-Null
    }

    $existing = Get-Content -Path $envScript -ErrorAction SilentlyContinue

    # Pick the first existing candidate as the primary Python installation directory
    $selectedDir = $null
    foreach ($dir in $candidateDirs) {
      if ($null -ne $dir -and (Test-Path $dir)) {
        $selectedDir = $dir
        break
      }
    }

    if ($selectedDir) {
      $scriptsDir = Join-Path $selectedDir 'Scripts'
      $lineBase   = '$Env:Path = "' + $selectedDir + ';" + $Env:Path'

      if (-not $existing -or -not ($existing -contains $lineBase)) {
        $lineBase | Out-File -FilePath $envScript -Append -Encoding UTF8
      }

      if (Test-Path $scriptsDir) {
        $lineScripts = '$Env:Path = "' + $scriptsDir + ';" + $Env:Path'
        if (-not $existing -or -not ($existing -contains $lineScripts)) {
          $lineScripts | Out-File -FilePath $envScript -Append -Encoding UTF8
        }
      }

      # Move the Bash logic inside the if ($selectedDir) block
      $bashEnvScript = Join-Path $cacheDir $bashCacheFileName
      if (-not (Test-Path $bashEnvScript)) {
        New-Item -Path $bashEnvScript -ItemType File -Force | Out-Null
      }
      $bashExisting = Get-Content -Path $bashEnvScript -ErrorAction SilentlyContinue
      
      $bashDir = $selectedDir.Replace('\', '/').Replace('C:', '/c')
      $bashLineBase = 'export PATH="' + $bashDir + ':$PATH"'
      if (-not $bashExisting -or -not ($bashExisting -contains $bashLineBase)) {
        $bashLineBase | Out-File -FilePath $bashEnvScript -Append -Encoding UTF8
      }

      if (Test-Path $scriptsDir) {
        $bashScriptsDir = $scriptsDir.Replace('\', '/').Replace('C:', '/c')
        $bashLineScripts = 'export PATH="' + $bashScriptsDir + ':$PATH"'
        if (-not $bashExisting -or -not ($bashExisting -contains $bashLineScripts)) {
          $bashLineScripts | Out-File -FilePath $bashEnvScript -Append -Encoding UTF8
        }
      }
    }
  }
  catch {
    Write-Host "Warning: failed to persist Python PATH update to env script: $($_.Exception.Message)"
  }
}
catch {
  Write-Error "Failed to install Python: $($_.Exception.Message)"
  exit 1
}

