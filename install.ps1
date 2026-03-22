$ErrorActionPreference = "Stop"

$Repo = "sevk-io/sevk-cli"
$InstallDir = if ($env:SEVK_INSTALL) { "$env:SEVK_INSTALL\bin" } else { "$env:USERPROFILE\.sevk\bin" }

function Get-Arch {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    switch ($arch) {
        "X64"   { return "x64" }
        "Arm64" { return "arm64" }
        default { Write-Error "Unsupported architecture: $arch"; exit 1 }
    }
}

function Main {
    param([string]$Version)

    $arch = Get-Arch

    if (-not $Version) {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
        $Version = $release.tag_name -replace '^v', ''
    }

    if (-not $Version) {
        Write-Error "Could not determine latest version"
        exit 1
    }

    $artifact = "sevk-win32-$arch.zip"
    $url = "https://github.com/$Repo/releases/download/v$Version/$artifact"
    $tempZip = Join-Path $env:TEMP "sevk-$Version.zip"

    Write-Host "Installing sevk v$Version (win32-$arch)..."

    # Download
    Invoke-WebRequest -Uri $url -OutFile $tempZip -UseBasicParsing

    # Extract
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    Expand-Archive -Path $tempZip -DestinationPath $InstallDir -Force
    Remove-Item $tempZip -Force

    Write-Host ""
    Write-Host "Installed sevk to $InstallDir\sevk.exe"

    # Add to PATH if not already there
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$InstallDir;$userPath", "User")
        $env:Path = "$InstallDir;$env:Path"
        Write-Host "Added $InstallDir to your PATH."
    }

    Write-Host ""
    Write-Host "Run 'sevk login' to get started."
}

Main @args
