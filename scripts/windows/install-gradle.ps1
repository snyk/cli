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
  $gradleVersion = '8.1.1'
  $installDir = Join-Path $cacheDir "gradle"
  $zipPath = Join-Path $cacheDir "gradle-$gradleVersion-bin.zip"
  $expectedSha256 = 'e111cb9948407e26351227dabce49822fb88c37ee72f1d1582a69c68af2e702f'

  if (-not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir | Out-Null
  }

  if (-not (Test-Path $zipPath)) {
    Write-Host "Downloading Gradle $gradleVersion..."
    $url = "https://services.gradle.org/distributions/gradle-$gradleVersion-bin.zip"
    curl.exe -L $url -o $zipPath
  }

  Write-Host 'Verifying Gradle archive checksum...'
  $hash = Get-FileHash -Path $zipPath -Algorithm SHA256
  if ($hash.Hash.ToLower() -ne $expectedSha256.ToLower()) {
    throw "Checksum verification failed for $zipPath. Expected $expectedSha256 but got $($hash.Hash.ToLower())."
  }

  if (Test-Path $installDir) {
    Write-Host "Cleaning existing Gradle directory at $installDir ..."
    Remove-Item -Recurse -Force $installDir
  }

  New-Item -ItemType Directory -Path $installDir | Out-Null

  Write-Host "Extracting Gradle $gradleVersion..."
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $installDir)

  $gradleRoot = Get-ChildItem -Path $installDir -Directory -Filter "gradle-$gradleVersion" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $gradleRoot) {
    $gradleRoot = Get-ChildItem -Path $installDir -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  }

  if (-not $gradleRoot) {
    throw "Failed to locate Gradle root directory under $installDir"
  }

  $binPath = Join-Path $gradleRoot.FullName 'bin'
  if (-not (Test-Path (Join-Path $binPath 'gradle.bat'))) {
    throw "gradle.bat not found in $binPath after extraction"
  }

  Write-Host "Adding $binPath to PATH for current session..."
  $Env:Path = "$binPath;" + $Env:Path
  try {
    if (-not (Test-Path $profile)) {
      New-Item -Path $profile -ItemType File -Force | Out-Null
    }
    $pathUpdateLine = '$Env:Path = "' + $binPath + ';" + $Env:Path'
    $profileContent = Get-Content -Path $profile -ErrorAction SilentlyContinue
    if (-not $profileContent -or -not ($profileContent -contains $pathUpdateLine)) {
      $pathUpdateLine | Out-File -FilePath $profile -Append -Encoding UTF8
    }
  }
  catch {
    Write-Host "Warning: failed to persist Gradle PATH update to profile: $($_.Exception.Message)"
  }

  # Append PATH update to shared environment script for CircleCI steps
  try {
    $envScript = Join-Path $cacheDir $cacheFileName
    if (-not (Test-Path $envScript)) {
      New-Item -Path $envScript -ItemType File -Force | Out-Null
    }
    $pathUpdateLine = '$Env:Path = "' + $binPath + ';" + $Env:Path'
    $existing = Get-Content -Path $envScript -ErrorAction SilentlyContinue
    if (-not $existing -or -not ($existing -contains $pathUpdateLine)) {
      $pathUpdateLine | Out-File -FilePath $envScript -Append -Encoding UTF8
    }
  }
  catch {
    Write-Host "Warning: failed to persist Gradle PATH update to env script: $($_.Exception.Message)"
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
    Write-Host "Warning: failed to persist Gradle PATH update to bash env script: $($_.Exception.Message)"
  }
}
catch {
  Write-Error "Failed to install Gradle: $($_.Exception.Message)"
  exit 1
}

