#!/bin/sh
set -e

REPO="sevk-io/sevk-cli"
INSTALL_DIR="${SEVK_INSTALL:-$HOME/.sevk}/bin"

get_arch() {
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
  esac
}

get_os() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$os" in
    linux) echo "linux" ;;
    darwin) echo "darwin" ;;
    *) echo "Unsupported OS: $os" >&2; exit 1 ;;
  esac
}

check_node_version() {
  node_version=$(node --version 2>/dev/null || true)
  node_version=${node_version#v}
  old_ifs=$IFS
  IFS=.
  set -- $node_version
  IFS=$old_ifs
  node_major=${1:-}
  node_minor=${2:-}
  node_patch=${3:-}
  node_patch=${node_patch%%[-+]*}

  node_supported=true
  for part in "$node_major" "$node_minor" "$node_patch"; do
    case "$part" in
      ''|*[!0-9]*) node_supported=false ;;
    esac
  done

  if [ "$node_supported" != true ] ||
     [ "$node_major" -lt 20 ] ||
     { [ "$node_major" -eq 20 ] && [ "$node_minor" -lt 12 ]; }; then
    echo "Error: sevk requires Node.js >=20.12.0; found ${node_version:-unknown}." >&2
    exit 1
  fi
}

main() {
  os=$(get_os)
  arch=$(get_arch)

  if ! command -v node >/dev/null 2>&1; then
    echo "Error: sevk requires Node.js >=20.12.0. Install Node.js first." >&2
    exit 1
  fi
  check_node_version
  if [ "${SEVK_INSTALLER_PREFLIGHT_ONLY:-}" = "1" ]; then
    exit 0
  fi
  if [ "$os" = "darwin" ] && [ "$arch" = "x64" ]; then
    echo "Error: the macOS x64 release artifact is not published; use npm installation instead." >&2
    exit 1
  fi

  if [ -n "$1" ]; then
    version="$1"
  else
    version=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed 's/.*"v\(.*\)".*/\1/')
  fi

  if [ -z "$version" ]; then
    echo "Error: Could not determine latest version" >&2
    exit 1
  fi

  artifact="sevk-${os}-${arch}"
  url="https://github.com/${REPO}/releases/download/v${version}/${artifact}.tar.gz"
  checksum_url="https://github.com/${REPO}/releases/download/v${version}/SHA256SUMS"

  echo "Installing sevk v${version} (${os}-${arch})..."

  tmp_dir=$(mktemp -d)
  trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM
  archive="$tmp_dir/${artifact}.tar.gz"
  checksums="$tmp_dir/SHA256SUMS"
  curl -fsSL "$url" -o "$archive"
  curl -fsSL "$checksum_url" -o "$checksums"
  expected=$(awk -v name="${artifact}.tar.gz" '$2 == name { print $1 }' "$checksums")
  if [ -z "$expected" ]; then
    echo "Error: checksum entry is missing for ${artifact}.tar.gz" >&2
    exit 1
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$archive" | awk '{ print $1 }')
  else
    actual=$(shasum -a 256 "$archive" | awk '{ print $1 }')
  fi
  if [ "$actual" != "$expected" ]; then
    echo "Error: checksum verification failed for ${artifact}.tar.gz" >&2
    exit 1
  fi

  mkdir -p "$INSTALL_DIR"
  tar -xzf "$archive" -C "$INSTALL_DIR"
  chmod +x "$INSTALL_DIR/sevk"

  echo ""
  echo "Installed sevk to ${INSTALL_DIR}/sevk"

  # Add to PATH if not already there
  case ":$PATH:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      shell_name=$(basename "$SHELL")
      case "$shell_name" in
        zsh)  rc="$HOME/.zshrc" ;;
        bash)
          if [ "$os" = "darwin" ]; then
            rc="$HOME/.bash_profile"
          else
            rc="$HOME/.bashrc"
          fi
          ;;
        fish) rc="$HOME/.config/fish/config.fish" ;;
        *)    rc="" ;;
      esac

      if [ -n "$rc" ]; then
        if [ "$shell_name" = "fish" ]; then
          path_entry="set -gx PATH \"${INSTALL_DIR}\" \$PATH"
        else
          path_entry="export PATH=\"${INSTALL_DIR}:\$PATH\""
        fi
        mkdir -p "$(dirname "$rc")"
        if ! grep -Fqx "$path_entry" "$rc" 2>/dev/null; then
          printf '%s\n' "$path_entry" >> "$rc"
          echo "Added ${INSTALL_DIR} to PATH in ${rc}"
        fi
        echo "Run 'source ${rc}' or open a new terminal to use sevk."
      else
        echo "Add ${INSTALL_DIR} to your PATH manually."
      fi
      ;;
  esac

  echo ""
  echo "Run 'sevk login' to get started."
}

main "$@"
