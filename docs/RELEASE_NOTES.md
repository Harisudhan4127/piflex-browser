# Release Notes — PiFlex Browser v2.0.0

## Release Overview

- Project: PiFlex Browser
- Version: 2.0.0
- Release type: Feature release (unreleased draft; tag `v2.0.0` pushed)
- Repository: https://github.com/Harisudhan4127/piflex-browser

## Executive Summary

PiFlex Browser 2.0.0 is a privacy-focused Electron desktop browser with a hardened Chromium view, network-level ad/tracker blocker, and optional on-device AI assistant. This release consolidates the browser shell, IPC contract, data layer, adblock, AI runtime provisioning, and documentation.

## Highlights

- Change: Network-level ad/tracker blocking via `session.webRequest`. Reason: reduce tracking without TLS interception. Impact: all browsing sessions. Availability: implemented.
- Change: On-device AI via managed llama.cpp + GGUF models. Reason: privacy-preserving assistance. Impact: optional feature. Availability: implemented.
- Change: Allow-listed preload IPC bridge with `{ ok, data } | { ok, error }` envelope. Reason: least privilege. Impact: security boundary.

## Detailed Changelog

### Added
- Internal pages: newtab, bookmarks, history, downloads, passwords, extensions, settings, help, diagnostics, about.
- SQLite persistence (`piflex.sqlite`) for bookmarks, history, credentials, autofill.
- Ad/tracker filter caching under `filters/`.
- AI runtime/model provisioning with progress.

### Changed
- Web content isolated: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.

### Fixed
- IPC window/tab errors and QA defects (per commit 765cdb0).
- Adblock crash safety and runtime win detection (per commit 6b2b01f).

### Security
- Page/selection text redacted before AI model input.
- No cloud by default for AI.

## Compatibility Matrix

| Platform | Architecture | Package Format | Status |
| --- | --- | --- | --- |
| Windows | x64 | NSIS, portable | Configured |
| Linux | x64 | AppImage, deb | Configured |
| macOS | x64/arm64 | dmg, zip | Configured |

## Testing

| Check | Result | Evidence |
| --- | --- | --- |
| Unit tests (`npm test`) | 58 passed, 0 failed | Executed |
| Type check (`npm run typecheck`) | Pass | Executed |
| Renderer build (`npm run build:renderer`) | Not run in this session | — |

## Known Issues

- None verified beyond repository; further QA pending.

## Installation & Upgrade

See README.md. No migration required for fresh install. Existing user data lives in Electron `userData/data`.

## Dependencies

Runtime: Electron, React, better-sqlite3, zustand, Radix UI. Dev: Vite, TypeScript, Tailwind, electron-builder.

## Developer Notes

- IPC handlers in `src/main/ipc/register.cjs`.
- Services in `src/main/services/`.
- Core logic in `core/`.

## Historical Index

- v2.0.0 — current.

## Verification Summary

Commands run: `npm test` (pass), `npm run typecheck` (pass). Pushed to `main`.
