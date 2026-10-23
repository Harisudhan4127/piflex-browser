# Changelog

All notable changes to PiFlex Browser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-23

### Added
- **Architecture**: Complete rewrite to Electron 45 with a React 19 + TypeScript shell and Vite build system.
- **Chromium integration**: Per-tab `WebContentsView` instances with hardened `webPreferences` (`contextIsolation`, `nodeIntegration: false`, `sandbox: true`).
- **Trusted internal pages**: `piflex://` routes for New Tab, Bookmarks, History, Downloads, Passwords, Extensions, Settings, Help, Diagnostics, and About.
- **Privacy**: Network-level ad/tracker blocking, per-site adblock exemptions, DNT/GPC support, and an isolated private browsing session with a clear UI indicator.
- **AI assistant**: On-device inference via curated GGUF models and a managed llama.cpp runtime. First-run auto-provision downloads the runtime and a small model in the background; all processing stays local.
- **Downloads**: Sanitized filenames, risky-extension warnings, destination deduplication, and a unified downloads manager.
- **Permissions**: Per-origin permission controls integrated with Chromium APIs.
- **Bookmarks**: Bookmarks bar with right-click context menus, inline editing, and folder support. Full bookmarks manager available.
- **Window chrome**: Frameless window with custom titlebar, draggable regions, and top-right window controls on Windows/Linux.
- **Search**: Support for multiple search engines with custom engine validation (HTTPS, placeholder requirement).
- **Extensions**: Controlled loading of unpacked extensions with explicit enablement.
- **Tests**: Core unit/regression suite (`tests/unit.test.js`) covering adblock, AI catalogs/runtimes, settings, and navigation fixes.

### Changed
- **IPC**: Strict allow-listed channel contract with `{ ok: true, data } | { ok: false, error }` envelope enforced by the preload bridge.
- **Navigation**: URL classification and top-level navigation policy with safe scheme handling.
- **Settings**: Schema-driven defaults, normalization, and validation.

### Fixed
- **Ad blocking**: Avoided cancelling main-frame requests (prevents `ERR_FAILED` on navigation), improved match context (`documentUrl`/resource type), and added built-in YouTube endpoint filtering with an in-page ad cleanup script.
- **Windowing**: Fixed titlebar drag regions so empty areas drag the window while interactive elements remain clickable.
- **AI**: Hardened prompt redaction, runtime asset selection for the target platform/architecture, and progress reporting for downloads/provisioning.
- **Overlays**: Web view visibility is managed correctly when menus, address suggestions, permission prompts, or the find bar are open.

### Security
- **Sandboxing**: Web content isolated from Node; privileged access only via preload allow-list.
- **Untrusted content**: Page and selection text treated as untrusted and redacted before model input.
- **No TLS MITM**: Network-level filtering only; no certificate interception.
- **Data minimization**: All personal data, models, and logs stay local and are git-ignored.

## [1.0.0] - 2025-10-01

### Added
- Initial prototype browser optimized for Raspberry Pi with a simple tabbed interface, ad blocking, and AI panel.
