param(
  [string]$Package = $(if ($env:CCSWITCH_PACKAGE) { $env:CCSWITCH_PACKAGE } else { "https://github.com/JIUSAN3/cc_cli_switch/archive/refs/heads/main.tar.gz" }),
  [string]$NpmPrefix = $(if ($env:CCSWITCH_NPM_PREFIX) { $env:CCSWITCH_NPM_PREFIX } else { Join-Path $HOME ".local\share\ccswitch\npm-global" }),
  [string]$BinDir = $(if ($env:CCSWITCH_BIN_DIR) { $env:CCSWITCH_BIN_DIR } else { Join-Path $HOME ".local\bin" }),
  [string]$NodeHome = $(if ($env:CCSWITCH_NODE_HOME) { $env:CCSWITCH_NODE_HOME } else { Join-Path $HOME ".local\share\ccswitch\node" }),
  [string]$NodeVersion = $(if ($env:CCSWITCH_NODE_VERSION) { $env:CCSWITCH_NODE_VERSION } else { "lts" }),
  [switch]$NoInit,
  [switch]$InstallShell
)

$ErrorActionPreference = "Stop"

function Write-InstallLog {
  param([string]$Message)
  Write-Host "ccswitch-install: $Message"
}

function Test-NodeUsable {
  $node = Get-Command node -ErrorAction SilentlyContinue
  $npm = Get-NpmCommand
  if (-not $node -or -not $npm) {
    return $false
  }

  & node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" | Out-Null
  return $LASTEXITCODE -eq 0
}

function Get-NpmCommand {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    return $npm.Source
  }
  return $null
}

function Resolve-NodePlatform {
  $arch = $env:PROCESSOR_ARCHITECTURE
  if ($arch -eq "AMD64") {
    return "win-x64"
  }
  if ($arch -eq "ARM64") {
    return "win-arm64"
  }
  throw "Unsupported CPU architecture: $arch"
}

function Resolve-NodeVersion {
  if ($NodeVersion -ne "lts") {
    if ($NodeVersion.StartsWith("v")) {
      return $NodeVersion
    }
    return "v$NodeVersion"
  }

  $index = Invoke-RestMethod "https://nodejs.org/dist/index.json"
  $latest = $index | Where-Object { $_.lts -ne $false } | Select-Object -First 1
  if (-not $latest) {
    throw "Could not resolve latest Node.js LTS version"
  }
  return $latest.version
}

function Install-PortableNode {
  $platform = Resolve-NodePlatform
  $version = Resolve-NodeVersion
  $archive = "node-$version-$platform.zip"
  $url = "https://nodejs.org/dist/$version/$archive"
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) "ccswitch-node-$([Guid]::NewGuid())"
  $zip = Join-Path $tmp $archive

  Write-InstallLog "installing portable Node.js $version for $platform"
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  Invoke-WebRequest -Uri $url -OutFile $zip

  Remove-Item -Recurse -Force $NodeHome -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path (Split-Path $NodeHome) | Out-Null
  Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
  Move-Item -LiteralPath (Join-Path $tmp "node-$version-$platform") -Destination $NodeHome
  Remove-Item -Recurse -Force $tmp
  $env:PATH = "$NodeHome;$env:PATH"
}

function Ensure-Node {
  if (Test-NodeUsable) {
    Write-InstallLog "using existing Node.js $(& node --version)"
    return
  }
  Install-PortableNode
  if (-not (Test-NodeUsable)) {
    throw "Node.js installation failed"
  }
}

function Install-Package {
  New-Item -ItemType Directory -Force -Path $NpmPrefix, $BinDir | Out-Null
  Write-InstallLog "installing $Package"
  $npm = Get-NpmCommand
  if (-not $npm) {
    throw "npm was not found"
  }
  & $npm install -g --prefix $NpmPrefix $Package
  if ($LASTEXITCODE -ne 0) {
    throw "npm install failed"
  }

  $nodeCommand = Get-Command node
  $nodeBin = Split-Path $nodeCommand.Source
  $npmBin = $NpmPrefix
  $wrapper = Join-Path $BinDir "ccswitch.cmd"
  $cmd = @"
@echo off
set "PATH=$nodeBin;$npmBin;%PATH%"
"$npmBin\ccswitch.cmd" %*
"@
  Set-Content -LiteralPath $wrapper -Value $cmd -Encoding ASCII

  & $wrapper --help | Out-Null
  $pathParts = $env:PATH -split ';'
  if ($pathParts -notcontains $BinDir) {
    Write-InstallLog "add this directory to PATH if ccswitch is not found later: $BinDir"
  }
}

function Install-ShellIntegration {
  if ($InstallShell) {
    & (Join-Path $BinDir "ccswitch.cmd") install-shell --shell powershell --yes
  }
}

function Start-Init {
  if (-not $NoInit) {
    Write-InstallLog "starting ccswitch init"
    & (Join-Path $BinDir "ccswitch.cmd") init
  } else {
    Write-InstallLog "installed. Run: ccswitch init"
  }
}

Ensure-Node
Install-Package
Install-ShellIntegration
Start-Init
