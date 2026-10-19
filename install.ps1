$ErrorActionPreference = "Stop"

$Repo = "sevk-io/sevk-cli"
$InstallDir = if ($env:SEVK_INSTALL) { "$env:SEVK_INSTALL\bin" } else { "$env:USERPROFILE\.sevk\bin" }

function Get-Arch {
    $envArch = $env:PROCESSOR_ARCHITECTURE
    switch ($envArch) {
        "AMD64" { return "x64" }
        "ARM64" { Write-Error "The Windows ARM64 release artifact is not published; use npm installation instead."; exit 1 }
        "x86"   { return "x64" }
        default { Write-Error "Unsupported architecture: $envArch"; exit 1 }
    }
}

function Main {
    param([string]$Version)

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "sevk requires Node.js >=20.12.0. Install Node.js first."
        exit 1
    }
    try {
        $nodeVersionText = (& node --version).Trim().TrimStart('v')
        $nodeVersion = [version]$nodeVersionText
    }
    catch {
        Write-Error "Could not determine the installed Node.js version. sevk requires Node.js >=20.12.0."
        exit 1
    }
    if ($nodeVersion -lt [version]"20.12.0") {
        Write-Error "sevk requires Node.js >=20.12.0; found $nodeVersionText."
        exit 1
    }
    if ($env:SEVK_INSTALLER_PREFLIGHT_ONLY -eq "1") {
        exit 0
    }

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
    $checksumFile = Join-Path $env:TEMP "sevk-$Version-SHA256SUMS"

    Write-Host "Installing sevk v$Version (win32-$arch)..."

    # Download
    Invoke-WebRequest -Uri $url -OutFile $tempZip -UseBasicParsing
    Invoke-WebRequest -Uri "https://github.com/$Repo/releases/download/v$Version/SHA256SUMS" -OutFile $checksumFile -UseBasicParsing
    $artifactPattern = [regex]::Escape($artifact)
    $checksumLine = Get-Content $checksumFile | Where-Object { $_ -match "^[a-fA-F0-9]{64}\s+$artifactPattern$" } | Select-Object -First 1
    if (-not $checksumLine) {
        Remove-Item $tempZip, $checksumFile -Force -ErrorAction SilentlyContinue
        Write-Error "Checksum entry is missing for $artifact"
        exit 1
    }
    $expected = ($checksumLine -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash -Path $tempZip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        Remove-Item $tempZip, $checksumFile -Force -ErrorAction SilentlyContinue
        Write-Error "Checksum verification failed for $artifact"
        exit 1
    }

    # Extract
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    Expand-Archive -Path $tempZip -DestinationPath $InstallDir -Force
    Remove-Item $tempZip, $checksumFile -Force

    Write-Host ""
    Write-Host "Installed sevk to $InstallDir\sevk.cmd"

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
