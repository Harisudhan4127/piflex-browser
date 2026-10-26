# PiFlex Browser — Security

See root `SECURITY.md` for vulnerability reporting. This document describes the browser security model in detail.

## Web Content Isolation

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- Preload exposes only allow-listed IPC channels (`window.piflex`)
- IPC envelope `{ ok, data } | { ok, error }` enforced

## Navigation Policy

- URL scheme classification in `core/`
- Top-level navigation policy with exception lists
- Main-frame navigation never cancelled; transient failures retry once

## Ad Blocking

- Network-level only via `session.webRequest`
- No TLS interception, no cosmetic filtering claimed

## AI Safety

- Page/selection text treated as untrusted and redacted before model input
- No cloud by default; on-device inference
