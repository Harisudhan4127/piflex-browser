# PiFlex Browser — Build and Release

## Dev

- `npm run dev` — Vite dev server (port 5123) + Electron
- `npm run start` — build renderer, launch Electron

## Build

- `npm run build` / `build:renderer` — production renderer build (`dist/renderer`)

## Release

- Packaged artifacts written to `release/`
- Releases tagged `vX.Y.Z`, built by release workflow
- Follows Semantic Versioning; see `CHANGELOG.md`
