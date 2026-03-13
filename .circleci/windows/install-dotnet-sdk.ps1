Param()

$ErrorActionPreference = 'Stop'

try {
  $dotnetVersion = '8.0.100'
  $cacheDir = 'C:\tools-cache'
  $installDir = 'C:\dotnet'
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

  $dotnetPath = $installDir

  if (-not (Get-Command dotnet -ErrorAction SilentlyContinue) -and -not (Test-Path (Join-Path $dotnetPath 'dotnet.exe'))) {
    throw ".NET SDK $dotnetVersion did not install correctly; dotnet.exe not found on PATH or in $dotnetPath"
  }

  Write-Host "Adding $dotnetPath to PATH for current session..."
  $Env:Path = "$dotnetPath;" + $Env:Path
  try {
    New-Item -Path $profile -ItemType File -Force | Out-Null
    '$Env:Path = "C:\dotnet;" + $Env:Path' | Out-File -FilePath $profile -Append -Encoding UTF8
  }
  catch {
    Write-Host "Warning: failed to persist .NET PATH update to profile: $($_.Exception.Message)"
  }

  # Append PATH update to shared environment script for CircleCI steps
  try {
    $envScript = 'C:\tools-cache\snyk-env.ps1'
    New-Item -Path $envScript -ItemType File -Force | Out-Null
    '$Env:Path = "C:\dotnet;" + $Env:Path' | Out-File -FilePath $envScript -Append -Encoding UTF8
  }
  catch {
    Write-Host "Warning: failed to persist .NET PATH update to env script: $($_.Exception.Message)"
  }
}
catch {
  Write-Error "Failed to install .NET SDK: $($_.Exception.Message)"
  exit 1
}

