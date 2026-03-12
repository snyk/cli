$ErrorActionPreference = 'Stop'

Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-Expression "& {$(Invoke-RestMethod get.scoop.sh )} -RunAsAdmin"

Write-Host "Verifying Scoop installation..."
scoop --version
