param(
  [string]$AppUrl = $(if ($env:CCSWITCH_APP_URL) { $env:CCSWITCH_APP_URL } else { "https://github.com/JIUSAN3/cc_cli_switch/archive/refs/heads/main.zip" }),
  [string]$AppDir = $(if ($env:CCSWITCH_APP_DIR) { $env:CCSWITCH_APP_DIR } else { Join-Path $HOME ".local\share\ccswitch\app" }),
  [string]$BinDir = $(if ($env:CCSWITCH_BIN_DIR) { $env:CCSWITCH_BIN_DIR } else { Join-Path $HOME ".local\bin" }),
  [string]$NodeHome = $(if ($env:CCSWITCH_NODE_HOME) { $env:CCSWITCH_NODE_HOME } else { Join-Path $HOME ".local\share\ccswitch\node" }),
  [string]$NodeVersion = $(if ($env:CCSWITCH_NODE_VERSION) { $env:CCSWITCH_NODE_VERSION } else { "lts" }),
  [string]$GithubProxy = $(if ($env:CCSWITCH_GITHUB_PROXY) { $env:CCSWITCH_GITHUB_PROXY } else { "" }),
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
  if (-not $node) {
    return $false
  }

  & node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" | Out-Null
  return $LASTEXITCODE -eq 0
}

function Get-DownloadUrl {
  param([string]$Url)
  if ($GithubProxy) {
    return "$($GithubProxy.TrimEnd('/'))/$Url"
  }
  return $Url
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

function Install-App {
  New-Item -ItemType Directory -Force -Path $BinDir, (Split-Path $AppDir) | Out-Null
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) "ccswitch-app-$([Guid]::NewGuid())"
  $zip = Join-Path $tmp "ccswitch.zip"
  $extract = Join-Path $tmp "extract"

  Write-InstallLog "downloading ccswitch from $AppUrl"
  New-Item -ItemType Directory -Force -Path $tmp, $extract | Out-Null
  Invoke-WebRequest -Uri (Get-DownloadUrl $AppUrl) -OutFile $zip
  Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
  $srcDir = Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1
  if (-not $srcDir) {
    throw "downloaded archive did not contain a source directory"
  }

  Remove-Item -Recurse -Force $AppDir -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
  Copy-Item -Recurse -Force -Path (Join-Path $srcDir.FullName "*") -Destination $AppDir
  Remove-Item -Recurse -Force $tmp

  $nodeCommand = Get-Command node
  $nodeBin = Split-Path $nodeCommand.Source
  $wrapper = Join-Path $BinDir "ccswitch.cmd"
  $cmd = @"
@echo off
set "PATH=$nodeBin;%PATH%"
node "$AppDir\bin\ccswitch.js" %*
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
Install-App
Install-ShellIntegration
Start-Init
