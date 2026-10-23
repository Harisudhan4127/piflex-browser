# PiFlex Browser — Expert-Level Architecture & Development Guide

> Version: 2.0.0 | Electron 45 | React 19 | TypeScript | Vite | Tailwind CSS v4 | better-sqlite3

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Repository Layout](#repository-layout)
4. [Process Architecture](#process-architecture)
5. [IPC Contract](#ipc-contract)
6. [Navigation & Input Classification](#navigation--input-classification)
7. [Tab & View Management](#tab--view-management)
8. [Windowing & Chrome](#windowing--chrome)
9. [Settings System](#settings-system)
10. [Data Layer](#data-layer)
11. [Ad Blocker (Network-Level)](#ad-blocker-network-level)
12. [Downloads](#downloads)
13. [Permissions](#permissions)
14. [Privacy, Trust & Sessions](#privacy-trust--sessions)
15. [Extensions](#extensions)
16. [Search](#search)
17. [AI Subsystem (On-Device)](#ai-subsystem-on-device)
18. [Bookmarks, History, Top Sites](#bookmarks-history-top-sites)
19. [New Tab & Wallpapers](#new-tab--wallpapers)
20. [Security Model](#security-model)
21. [Build, Dev, Test & Smoke](#build-dev-test--smoke)
22. [Runtime Data Paths](#runtime-data-paths)
23. [Common Tasks](#common-tasks)
24. [Troubleshooting](#troubleshooting)
25. [Changelog & Version Control](#changelog--version-control)
26. [Appendix](#appendix)

## Overview

PiFlex Browser is a Chromium-based browser built with Electron. The shell UI is a trusted React application; untrusted web content runs inside Electron `WebContentsView` instances with a hardened webPreferences configuration. All privileged operations flow through a strict, allow-listed IPC bridge.

## Design Principles

- **Least privilege**: renderer sandboxed where possible; Node access only through preload allow-list.
- **Network-level protection**: ad/tracker blocking via `session.webRequest` only. No cosmetic filtering claimed.
- **On-device by default**: AI inference, history, bookmarks, passwords, settings stay local.
- **Defense in depth**: URL scheme classification, top-level navigation policy, exception lists, request validation.
- **Fail-safe**: main-frame navigation cancellation is avoided; transient failures retry once.
- **Explicit consent**: models/runtimes downloaded only on user action or first-run auto-provision with progress surfaced.
- **Deterministic contracts**: IPC envelope `{ ok: true, data } | { ok: false, error }` enforced by preload.

## Repository Layout

```text
core/                    # Browser-independent logic (pure JS/TS-safe)
  ai/                    # Memory, prompt redaction/truncation, runtime args, catalog
  adblock/               # Filter engine, lists, validation
  stores/                # JSON stores (bookmarks/history/downloads/sessions/settings)
  url.js, search.js, ... # Classification, search, utils
src/
  main/                  # Electron main process (CommonJS .cjs)
    main.cjs             # App lifecycle, service wiring
    ipc/register.cjs     # IPC handlers
    services/            # Window/Tab/Adblock/AI/Downloads/Permissions/...
    db/                  # better-sqlite3 services
    paths.cjs, logger.cjs
  preload/               # Context bridge (index.cjs)
  renderer/              # React app (TSX)
    App.tsx              # Shell layout, titlebar/controls
    components/          # UI + browser chrome
    pages/               # Internal pages (newtab/bookmarks/history/...)
    lib/                 # API wrapper, utils, hooks
    store/               # Zustand store
    styles/              # Tailwind v4 styles
  shared/                # Cross-process types/IPCs
    ipc.cjs, types.ts
tests/unit.test.js       # Core unit/regression tests
```

## Process Architecture

| Process | Responsibility | Notes |
| --- | --- | --- |
| Main | Window/view lifecycle, sessions, webRequest, downloads, permissions, AI runtime, DB | CommonJS; single instance lock (disabled in smoke). |
| Preload | Allow-listed `contextBridge` exposing `window.piflex` | Enforces channel sets, unwraps IPC envelope. |
| Renderer (Shell) | Trusted chrome + internal pages | React 19, sandboxed from Node. |
| WebContentsView | Untrusted web content | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. |

## IPC Contract

- **Channels**: `src/shared/ipc.cjs` defines `IPC`, `SEND_CHANNELS`, `PUSH_CHANNELS`.
- **Invoke**: renderer calls `invoke(channel, payload)` → main `handle()` returns `{ok,data}` or `{ok:false,error}`; preload unwraps/rejects.
- **Send/Push**: fire-and-forget via allow-lists.
- **Adding a channel**: add to `IPC`, add to appropriate allow-list, implement handler in `src/main/ipc/register.cjs`, add typed wrapper in `src/renderer/lib/api.ts`.

## Navigation & Input Classification

`core/url.js` classifies bare domains as HTTPS, localhost/IP as HTTP, text as search, blocks dangerous schemes, and enforces external scheme policy. Main process blocks non-whitelisted top-level schemes and opens safe externals via OS handler.

## Tab & View Management

`src/main/services/tab-manager.cjs` manages `WebContentsView` per tab, partitions (`persist:piflex` / `piflex-private`), internal vs web tabs, bounds, visibility. Browser shortcuts are forwarded via `before-input-event` to shell. YouTube gets in-page ad cleanup; main-frame ERR_FAILED retries once.

## Windowing & Chrome

`src/main/services/window-manager.cjs` uses frameless window on Windows/Linux with custom controls; macOS uses hiddenInset. Renderer titlebar is draggable with `-webkit-app-region: drag` except interactive controls. Window controls positioned top-right.

## Settings System

`core/settings-schema.js` provides defaults, merge/normalize/clamp/sanitize. `src/main/services/settings-service.cjs` wraps store with change events. AI defaults: enabled + autoSetup true. New-tab wallpapers validated (4MB, image data URLs or gradients).

## Data Layer

`core/stores/*` use `JsonStore` with debounced saves, backups on corrupt JSON, caps/normalization. `src/main/db/*` uses better-sqlite3 for bookmarks/history/credentials/autofill.

## Ad Blocker (Network-Level)

`src/main/services/adblock-service.cjs` uses `AdBlockFilterEngine` (`core/adblock/engine.js`). Always compiles built-in fixes + fallback or cached lists. Matches on subresource types with `documentUrl`/referrer; skips main-frame; normalizes Electron types; exempts sites; safe error handling.

## Downloads

`src/main/services/download-service.cjs` sanitizes filenames, prevents traversal, flags risky extensions, deduplicates destinations, tracks state.

## Permissions

Per-origin permission overrides stored in settings; handlers in `permission-service.cjs` integrate with Chromium permission APIs.

## Privacy, Trust & Sessions

`privacy.*` flags, DNT/Sec-GPC on requests, per-site adblock exemption, session restoration policy, trust/service boundaries.

## Extensions

`ExtensionService` loads unpacked extensions in a controlled manner with explicit enablement.

## Search

`core/search.js` builds search URLs, validates custom engines (HTTPS + placeholder), deduplicates against builtins.

## AI Subsystem (On-Device)

- **Catalog**: `core/ai/catalog.js` curated GGUF models (downloaded on demand).
- **Runtime**: `src/main/services/runtime-service.cjs` fetches official llama.cpp release, scores platform/arch assets, extracts (tar/PowerShell), finds `llama-server`. Emits progress.
- **Service**: `src/main/services/ai-service.cjs` manages llama.cpp server or external endpoints, redacts/sanitizes prompts (`core/ai/prompt.js`), enforces `allowPageContext`, streams results.
- **Auto-provision**: first run downloads runtime + smallest model in background; configurable via `ai.autoSetup`.
- **UI**: `src/renderer/components/browser/AiPanel.tsx`, settings `AiSettings`.

## Bookmarks, History, Top Sites

Stores normalized/deduplicated with caps; UI supports add/edit/delete, context menus, bar integration.

## New Tab & Wallpapers

`src/renderer/pages/NewTabPage.tsx` applies wallpaper from `newTab.activeWallpaper` or legacy `appearance.backgroundImage`, defaults to gradient. Private badge shown when active tab is private.

## Security Model

- Schemes: http/https/file/piflex/about allowed; others blocked or external-opened safely
- Top-level navigation to non-allowed origins blocked
- Page content untrusted; redaction before inference
- No secrets logged; paths sanitized
- webRequest handlers defensive (try/catch)
- Main-frame not cancelled by adblock

## Build, Dev, Test & Smoke

Scripts (package.json):
- `dev` - Vite dev + Electron
- `build:renderer` - Vite build
- `start` - run Electron
- `test` - `node tests/unit.test.js`
- `typecheck` - `tsc --noEmit`
- `smoke` - `electron . --piflex-smoke-test --piflex-smoke-window`

CI/local: `npm run typecheck && npm test && npm run build:renderer && npm run smoke`

## Runtime Data Paths

`src/main/paths.cjs` uses userData `data/`:
- `piflex.sqlite` - structured data
- `settings.json`
- `filters/` - cached filter lists
- `models/` - GGUF models
- `runtime/` - llama.cpp server
- `extensions/`
- `vault.bin`
- `logs/`

## Common Tasks

**Add IPC channel**: IPC + allow-lists → register handler → preload/api wrapper → types.

**Add filter rule source**: update `core/adblock/lists.js`, ensure `loadRules()` compiles all sources.

**Tune AI**: adjust catalog/defaults in `core/ai/*`, auto-provision in `ai-service.cjs`.

## Troubleshooting

- **ERR_FAILED (-2)**: main-frame blocked by webRequest; fixed by skipping main-frame and retrying once.
- **YouTube ads**: network + in-page cleanup; ensure adblock enabled.
- **AI not ready**: check runtime/models, auto-provision logs, `ai.status`.
- **Overlay occlusion**: `layoutSetViewVisible` hides web view while menus open.
- **Type errors**: `npm run typecheck`.

## Changelog & Version Control

### Versioning
- Semantic Versioning: `MAJOR.MINOR.PATCH`
- Current: `2.0.0` (major restructure to Electron+React architecture)

### Git Workflow (Recommended)
1. **Branch**: `feature/<short-desc>`, `fix/<issue>`, `refactor/<area>`
2. **Atomic commits**: one logical change per commit
3. **Conventional-ish messages**: `<type>(<scope>): <subject>` e.g. `fix(adblock): skip main-frame requests`, `feat(ai): auto-provision runtime on first run`
4. **Pre-commit checks**: `npm run typecheck && npm test`
5. **Review**: inspect `git diff --stat`, run build/smoke
6. **Tags**: `git tag -a vX.Y.Z -m "..." && git push --tags`

### Commit Hygiene
- Never commit secrets/keys/models/binaries
- Update docs/tests with behavior changes
- Keep diffs focused

## Appendix

### Key Files Reference
- IPC: `src/shared/ipc.cjs`, `src/preload/index.cjs`, `src/main/ipc/register.cjs`
- Tabs/Views: `src/main/services/tab-manager.cjs`, `src/main/services/window-manager.cjs`
- Adblock: `core/adblock/engine.js`, `core/adblock/lists.js`, `src/main/services/adblock-service.cjs`
- AI: `core/ai/*`, `src/main/services/ai-service.cjs`, `src/main/services/runtime-service.cjs`, `src/main/services/model-service.cjs`
- Settings: `core/settings-schema.js`, `src/main/services/settings-service.cjs`
