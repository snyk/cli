param (
    [string]$EXPORT_PATH = "./bin",     # Default export path for the signed executable
    [string]$PRODUCT_NAME = "snyk_windows_amd64.exe"   # Default name of the product (executable)
)

# expected environment variables
# $env:SM_CODE_SIGNING_CERT_SHA1_HASH="EEE...."      # thumbprint of certificate


# Define file paths and names
$APP_PATH = Join-Path $EXPORT_PATH $PRODUCT_NAME
$APP_PATH_UNSIGNED = "$APP_PATH.unsigned"
$SIGNING_SECRETS_B64 = "secrets.b64"

# Prefix for log messages
$LOG_PREFIX = "--- $(Split-Path $MyInvocation.MyCommand.Path -Leaf):"

# if the required secrets are not available we skip signing completely without an error to enable local builds on windows. A later issigned check will catch this error in the build pipeline
if (-Not (Test-Path env:SM_CODE_SIGNING_CERT_SHA1_HASH)) {
    Write-Host "$LOG_PREFIX Skipping signing, since the required secrets are not available."
    exit
}

Write-Host "$LOG_PREFIX Signing ""$APP_PATH"""

# create files as needed
Write-Host "$LOG_PREFIX Creating p12 file"
# Save the Base64-encoded PKCS#12 certificate data to a file
$env:SM_CLIENT_CERT_FILE_B64 | Set-Content -Path $SIGNING_SECRETS_B64
# Decode the Base64-encoded PKCS#12 certificate data to a binary file
certutil -f -decode $SIGNING_SECRETS_B64 $env:SM_CLIENT_CERT_FILE

Write-Host "$LOG_PREFIX Signing binary $APP_PATH_UNSIGNED"

# Move the original executable to the .unsigned version (as expected by signtool)
Move-Item -Path $APP_PATH -Destination $APP_PATH_UNSIGNED

# Find the latest version of signtool.exe and use it to sign the executable
$SIGNTOOL = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\" -Recurse -Include 'signtool.exe' | Where-Object { $_.FullName -like "*x64*" } | Sort-Object LastWriteTime | Select-Object -Last 1 -ExpandProperty FullName
& $SIGNTOOL sign /sha1 $env:SM_CODE_SIGNING_CERT_SHA1_HASH /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 /d "Snyk CLI" /du "https://snyk.io" /v $APP_PATH_UNSIGNED
if ($LASTEXITCODE) {
    exit $LASTEXITCODE
}

# Move the signed executable back to its original location
Move-Item -Path $APP_PATH_UNSIGNED -Destination $APP_PATH

# Remove temporary files (the .unsigned version and the p12 certificate)
Write-Host "$LOG_PREFIX Cleaning up $env:SM_CLIENT_CERT_FILE"
Remove-Item -Path $env:SM_CLIENT_CERT_FILE
Write-Host "$LOG_PREFIX Cleaning up $SIGNING_SECRETS_B64"
Remove-Item -Path $SIGNING_SECRETS_B64

Write-Host "$LOG_PREFIX Done"
