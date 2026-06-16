#!/usr/bin/env sh
set -eu

PACKAGE="${CCSWITCH_PACKAGE:-claudecode-switch-helper@latest}"
RUN_INIT="${CCSWITCH_RUN_INIT:-1}"
INSTALL_SHELL="${CCSWITCH_INSTALL_SHELL:-0}"
NPM_PREFIX="${CCSWITCH_NPM_PREFIX:-$HOME/.local/share/ccswitch/npm-global}"
BIN_DIR="${CCSWITCH_BIN_DIR:-$HOME/.local/bin}"
NODE_HOME="${CCSWITCH_NODE_HOME:-$HOME/.local/share/ccswitch/node}"
NODE_VERSION="${CCSWITCH_NODE_VERSION:-lts}"

log() {
  printf '%s\n' "ccswitch-install: $*"
}

fail() {
  printf '%s\n' "ccswitch-install: $*" >&2
  exit 1
}

download() {
  url="$1"
  output="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$output"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$output" "$url"
  else
    fail "curl or wget is required to download Node.js"
  fi
}

node_is_usable() {
  command -v node >/dev/null 2>&1 \
    && command -v npm >/dev/null 2>&1 \
    && node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" >/dev/null 2>&1
}

detect_node_platform() {
  os="$(uname -s 2>/dev/null || true)"
  arch="$(uname -m 2>/dev/null || true)"

  case "$os" in
    Linux) node_os="linux" ;;
    Darwin) node_os="darwin" ;;
    *) fail "unsupported OS: $os. Install Node.js 18+ and run npm install -g $PACKAGE" ;;
  esac

  case "$arch" in
    x86_64|amd64) node_arch="x64" ;;
    arm64|aarch64) node_arch="arm64" ;;
    armv7l) node_arch="armv7l" ;;
    *) fail "unsupported CPU architecture: $arch" ;;
  esac

  printf '%s-%s' "$node_os" "$node_arch"
}

resolve_node_version() {
  if [ "$NODE_VERSION" != "lts" ]; then
    case "$NODE_VERSION" in
      v*) printf '%s' "$NODE_VERSION" ;;
      *) printf 'v%s' "$NODE_VERSION" ;;
    esac
    return
  fi

  tmp_index="$(mktemp)"
  download "https://nodejs.org/dist/index.json" "$tmp_index"
  version="$(sed -n 's/.*"version":"\(v[^"]*\)".*"lts":[^f][^,]*.*/\1/p' "$tmp_index" | head -n 1)"
  rm -f "$tmp_index"
  [ -n "$version" ] || fail "could not resolve latest Node.js LTS version"
  printf '%s' "$version"
}

install_portable_node() {
  platform="$(detect_node_platform)"
  version="$(resolve_node_version)"
  archive="node-$version-$platform.tar.xz"
  url="https://nodejs.org/dist/$version/$archive"
  tmp_dir="$(mktemp -d)"
  archive_path="$tmp_dir/$archive"

  log "installing portable Node.js $version for $platform"
  download "$url" "$archive_path"

  rm -rf "$NODE_HOME.tmp" "$NODE_HOME"
  mkdir -p "$(dirname "$NODE_HOME")" "$NODE_HOME.tmp"
  tar -xJf "$archive_path" -C "$NODE_HOME.tmp"
  mv "$NODE_HOME.tmp/node-$version-$platform" "$NODE_HOME"
  rm -rf "$tmp_dir" "$NODE_HOME.tmp"
  export PATH="$NODE_HOME/bin:$PATH"
}

ensure_node() {
  if node_is_usable; then
    log "using existing Node.js $(node --version)"
    return
  fi
  install_portable_node
  node_is_usable || fail "Node.js installation failed"
}

install_package() {
  mkdir -p "$NPM_PREFIX" "$BIN_DIR"
  log "installing $PACKAGE"
  npm install -g --prefix "$NPM_PREFIX" "$PACKAGE"

  node_bin="$(dirname "$(command -v node)")"
  npm_bin="$NPM_PREFIX/bin"
  wrapper="$BIN_DIR/ccswitch"
  cat > "$wrapper" <<EOF
#!/usr/bin/env sh
export PATH="$node_bin:$npm_bin:\$PATH"
exec "$npm_bin/ccswitch" "\$@"
EOF
  chmod +x "$wrapper"
  "$wrapper" --help >/dev/null

  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) log "add this to your shell profile if ccswitch is not found later: export PATH=\"$BIN_DIR:\$PATH\"" ;;
  esac
}

install_shell_integration() {
  if [ "$INSTALL_SHELL" = "1" ]; then
    "$BIN_DIR/ccswitch" install-shell --yes || true
  fi
}

run_init() {
  if [ "$RUN_INIT" = "1" ]; then
    log "starting ccswitch init"
    if [ -r /dev/tty ]; then
      "$BIN_DIR/ccswitch" init < /dev/tty
    else
      "$BIN_DIR/ccswitch" init
    fi
  else
    log "installed. Run: ccswitch init"
  fi
}

ensure_node
install_package
install_shell_integration
run_init
