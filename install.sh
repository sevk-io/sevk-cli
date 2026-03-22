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

main() {
  os=$(get_os)
  arch=$(get_arch)

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

  echo "Installing sevk v${version} (${os}-${arch})..."

  mkdir -p "$INSTALL_DIR"

  curl -fsSL "$url" | tar -xz -C "$INSTALL_DIR"
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
        bash) rc="$HOME/.bashrc" ;;
        fish) rc="$HOME/.config/fish/config.fish" ;;
        *)    rc="" ;;
      esac

      if [ -n "$rc" ]; then
        if [ "$shell_name" = "fish" ]; then
          echo "set -gx PATH \"${INSTALL_DIR}\" \$PATH" >> "$rc"
        else
          echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "$rc"
        fi
        echo "Added ${INSTALL_DIR} to PATH in ${rc}"
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
