Param()

$ErrorActionPreference = 'Stop'

try {
  $mavenVersion = '3.8.2'
  $cacheDir = 'C:\tools-cache'
  $installDir = 'C:\tools\maven'
  $zipPath = Join-Path $cacheDir "apache-maven-$mavenVersion-bin.zip"
  $expectedSha256 = '065895606bb1622104b0078b527c3da7b7acfbdd8edd9c619da0626628425d6c'

  if (-not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir | Out-Null
  }

  if (-not (Test-Path $zipPath)) {
    Write-Host "Downloading Apache Maven $mavenVersion..."
    $url = "https://archive.apache.org/dist/maven/maven-3/$mavenVersion/binaries/apache-maven-$mavenVersion-bin.zip"
    curl.exe -L $url -o $zipPath
  }

  Write-Host 'Verifying Maven archive checksum...'
  $hash = Get-FileHash -Path $zipPath -Algorithm SHA256
  if ($hash.Hash.ToLower() -ne $expectedSha256.ToLower()) {
    throw "Checksum verification failed for $zipPath. Expected $expectedSha256 but got $($hash.Hash.ToLower())."
  }

  if (Test-Path $installDir) {
    Write-Host "Cleaning existing Maven directory at $installDir ..."
    Remove-Item -Recurse -Force $installDir
  }

  New-Item -ItemType Directory -Path $installDir | Out-Null

  Write-Host "Extracting Apache Maven $mavenVersion..."
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $installDir)

  # Many Maven zips extract to apache-maven-<version>; ensure bin on PATH
  $mavenRoot = Get-ChildItem -Path $installDir -Directory -Filter "apache-maven-$mavenVersion" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $mavenRoot) {
    $mavenRoot = Get-ChildItem -Path $installDir -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  }

  if (-not $mavenRoot) {
    throw "Failed to locate Maven root directory under $installDir"
  }

  $binPath = Join-Path $mavenRoot.FullName 'bin'
  if (-not (Test-Path (Join-Path $binPath 'mvn.cmd'))) {
    throw "mvn.cmd not found in $binPath after extraction"
  }

  Write-Host "Adding $binPath to PATH for current session..."
  $Env:Path = "$binPath;" + $Env:Path
  try {
    New-Item -Path $profile -ItemType File -Force | Out-Null
    '$Env:Path = "C:\tools\maven\apache-maven-3.8.2\bin;" + $Env:Path' | Out-File -FilePath $profile -Append -Encoding UTF8
  }
  catch {
    Write-Host "Warning: failed to persist Maven PATH update to profile: $($_.Exception.Message)"
  }

  # Append PATH update to shared environment script for CircleCI steps
  try {
    $envScript = 'C:\tools-cache\snyk-env.ps1'
    New-Item -Path $envScript -ItemType File -Force | Out-Null
    '$Env:Path = "C:\tools\maven\apache-maven-3.8.2\bin;" + $Env:Path' | Out-File -FilePath $envScript -Append -Encoding UTF8
  }
  catch {
    Write-Host "Warning: failed to persist Maven PATH update to env script: $($_.Exception.Message)"
  }
}
catch {
  Write-Error "Failed to install Apache Maven: $($_.Exception.Message)"
  exit 1
}

