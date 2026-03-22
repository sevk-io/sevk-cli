<p align="center">
  <img src="https://sevk.io/logo.png" alt="Sevk" width="120" />
</p>

<h1 align="center">Sevk CLI</h1>

<p align="center">
  Manage your email infrastructure from the terminal.
</p>

<p align="center">
  <a href="https://docs.sevk.io/cli/overview">Documentation</a> •
  <a href="https://sevk.io">Website</a>
</p>

## Install

```bash
# macOS / Linux
curl -fsSL https://sevk.io/install.sh | bash

# Windows (PowerShell)
irm https://sevk.io/install.ps1 | iex

# Homebrew
brew install sevk-io/tap/sevk

# npm
npm install -g sevk-cli

# bun
bun install -g sevk-cli
```

## Quick Start

```bash
# Authenticate
sevk login

# Send an email
sevk emails send \
  --from "you@yourdomain.com" \
  --to recipient@example.com \
  --subject "Hello from Sevk" \
  --text "Sent from my terminal."

# Check your environment
sevk doctor
```

## Authentication

The CLI resolves your API key in this order:

| Priority | Source | Usage |
|----------|--------|-------|
| 1 | `--api-key` flag | `sevk --api-key sevk_xxx emails send ...` |
| 2 | `SEVK_API_KEY` env | `export SEVK_API_KEY=sevk_xxx` |
| 3 | Config file | `sevk login` |

## CI/CD

```yaml
env:
  SEVK_API_KEY: ${{ secrets.SEVK_API_KEY }}
steps:
  - run: sevk emails send --from "deploy@yourdomain.com" --to "team@yourdomain.com" --subject "Deployed" --text "Done."
```

## Documentation

For full documentation, visit [docs.sevk.io/cli](https://docs.sevk.io/cli/overview)

## License

MIT
