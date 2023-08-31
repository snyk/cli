param (
    [Parameter(Mandatory = $true, Position = 0)]
    [String]$FilePath,

    [Parameter(Position = 1)]
    [String]$Algorithm = "256",

    [Switch]$Check,
    [Switch]$Binary,
    [Switch]$Quiet
)

function Get-Checksum {
    param (
        [String]$FilePath,
        [String]$Algorithm
    )

    $hash = Get-FileHash -Path $FilePath -Algorithm "sha$Algorithm"
    return $hash.Hash
}

if ($Algorithm -eq "md5") {
    Write-Output "MD5 algorithm is not supported. Please choose from: sha1, sha256, sha384, sha512."
    exit 1
}

if ($Check) {
    if (-not (Test-Path $FilePath)) {
        Write-Output "Checksum file not found: $FilePath"
        exit 1
    }

    $content = Get-Content $FilePath
    $expectedHash = $content.Split(' ')[0].Trim()
    $fileName = $content.Split(' ')[2].Trim()

    if (-not (Test-Path $fileName)) {
        Write-Output "File not found: $fileName"
        exit 1
    }

    $actualHash = Get-Checksum -FilePath $fileName -Algorithm $Algorithm

    if ($expectedHash -eq $actualHash) {
        Write-Output "$fileName : OK"
    } else {
        Write-Output "$fileName : FAILED"
    }
} else {
    $hash = Get-Checksum -FilePath $FilePath -Algorithm $Algorithm
    $hash = $hash.toLower()
    Write-Output "$hash  $FilePath"
}
