Param()

$ErrorActionPreference = 'Stop'

try {
  $python = Get-Command python -ErrorAction SilentlyContinue
  if (-not $python) {
    $python = Get-Command python3 -ErrorAction SilentlyContinue
  }

  if (-not $python) {
    throw "Python is expected to be preinstalled on the CircleCI Windows image, but was not found."
  }

  Write-Host "Using Python at $($python.Path)"

  try {
    & $python.Path -m pip install --upgrade pip
  }
  catch {
    Write-Host "Failed to upgrade pip, continuing: $($_.Exception.Message)"
  }

  & $python.Path -m pip install uv
}
catch {
  Write-Error "Failed to ensure Python/uv: $($_.Exception.Message)"
  exit 1
}

