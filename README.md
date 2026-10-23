# PiFlex Browser

[![CI](https://github.com/Harisudhan4127/piflex-browser/actions/workflows/ci.yml/badge.svg)](https://github.com/Harisudhan4127/piflex-browser/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-informational.svg)](CHANGELOG.md)

PiFlex is a lightweight, privacy-focused desktop browser built on Electron, React, and TypeScript. It pairs a hardened Chromium view with a fast, native-feeling shell, a network-level ad/tracker blocker, and an optional on-device AI assistant.

## Highlights

- **Privacy first** — tracker/ad blocking at the network layer, per-site exemptions, Do Not Track / Global Privacy Control, and an isolated private-tab session.
- **Local AI assistant** — curated GGUF models and a managed llama.cpp runtime. First-run setup happens automatically in the background; nothing is sent to a cloud service by default.
- **Real browser chrome** — tabs, bookmarks bar, history, downloads, passwords, extensions, find-in-page, permissions, and session restore.
- **Fast internal pages** — rendered in the trusted React shell (`piflex://newtab`, `bookmarks`, `history`, `downloads`, `passwords`, `extensions`, `settings`, `help`, `diagnostics`, `about`).
- **Cross-platform** — Windows, Linux, and macOS builds via electron-builder. Android is not supported.

## Quick Start

### Requirements

- Node.js **24** (see `.nvmrc`) and npm 11+
- Git
- Platform toolchain needed by Electron / `better-sqlite3` (prebuilt binaries are used where available)

### Install and run

```bash
git clone https://github.com/Harisudhan4127/piflex-browser.git
cd piflex-browser
npm ci
npm run dev
```

`npm run dev` starts Vite on port 5123 and launches Electron against the dev server. To run a production-style build locally:

```bash
npm run start
```

### Verify your change

```bash
npm run typecheck
npm test
npm run build:renderer
npm run smoke
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server + Electron with live reload |
| `npm run start` | Build the renderer and launch Electron |
| `npm run build` / `build:renderer` | Production renderer build (`dist/renderer`) |
| `npm test` | Core unit/regression suite (`tests/unit.test.js`) |
| `npm run typecheck` | TypeScript project check (`tsc --noEmit`) |
| `npm run smoke` | Launch with the smoke-test flags and verify an internal page |
| `npm run dist:win` | Windows NSIS + portable installers |
| `npm run dist:linux` | Linux AppImage + deb packages |
| `npm run dist:mac` | macOS dmg + zip packages |
| `npm run dist` | Package for the current platform |

Packaged artifacts are written to `release/`.

## Project Layout

```text
core/          Browser-independent logic: URL/search, settings schema, stores, adblock, AI
src/main/      Electron main process: windows, tabs/views, services, SQLite, IPC handlers
src/preload/   Allow-listed contextBridge API (`window.piflex`)
src/renderer/  React 19 shell, browser chrome, and internal pages
src/shared/    IPC channel map and shared TypeScript types
tests/         Core unit and regression tests
docs/          Architecture and development documentation
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full process model, IPC contract, security boundaries, and subsystem details.

## Configuration and Data

PiFlex keeps user data in Electron's `userData/data` directory:

- `piflex.sqlite` — bookmarks, history, credentials, autofill
- `settings.json` — user preferences
- `filters/` — cached ad/tracker lists
- `models/` and `runtime/` — local AI assets
- `extensions/`, `vault.bin`, `logs/`

These files are never committed to the repository.

## Security

- Web content runs isolated from Node (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`).
- The preload bridge exposes only allow-listed IPC channels.
- Ad blocking is network-level only; PiFlex does not perform TLS interception or claim cosmetic filtering.
- Page and selection text are treated as untrusted and redacted before being sent to an AI model.

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Do not open a public issue for a security report.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, architecture rules, commit conventions, and the pull-request checklist. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Versioning

This project follows [Semantic Versioning](https://semver.org/). Notable changes are documented in [CHANGELOG.md](CHANGELOG.md). Releases are tagged `vX.Y.Z` and built by the release workflow.

## License

[MIT](LICENSE) © PiFlex Browser contributors.
