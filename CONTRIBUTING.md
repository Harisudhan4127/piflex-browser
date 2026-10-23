# Contributing to PiFlex Browser

Thanks for taking the time to improve PiFlex. This guide covers local setup, architecture rules, and the workflow we use to keep changes easy to review.

## Before you start

- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Search existing issues and pull requests before opening a new one.
- For security problems, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
- By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

```bash
git clone https://github.com/Harisudhan4127/piflex-browser.git
cd piflex-browser
npm ci
npm run dev
```

Requirements:

- Node.js 24 (`.nvmrc`) and npm 11+
- Git
- A desktop session capable of running Electron

If `better-sqlite3` cannot find a prebuilt binary on your platform, install the native build tools for your OS (Python 3, a C++ toolchain) and rerun `npm ci`.

## Required checks

Run these before opening a pull request:

```bash
npm run typecheck
npm test
npm run build:renderer
npm run smoke
```

CI runs type checking, tests, and the production renderer build on every push and pull request. The smoke test is available locally for full app startup validation.

## Architecture rules

1. **Keep `core/` free of Electron imports.** It must stay testable with plain Node.
2. **All privileged work stays in the main process.** Renderer code talks to it through the preload bridge.
3. **Add IPC channels through the contract.** Update `src/shared/ipc.cjs` (channel map and allow-lists), implement a handler in `src/main/ipc/register.cjs`, add a typed wrapper in `src/renderer/lib/api.ts`, and keep `src/shared/types.ts` in sync.
4. **Never cancel main-frame requests in `webRequest` handlers.** Return `false` and let navigation proceed; a thrown listener cancels requests.
5. **Treat web content as untrusted.** Redact page/selection text before model calls and validate every URL, path, and payload from the renderer.
6. **No secrets in the repository.** Do not commit tokens, signing keys, models, runtime binaries, user data, or logs.
7. **No cosmetic-adblock claims.** Filtering is network-level only and must be described that way.

## Coding standards

- TypeScript for the renderer and shared types; CommonJS (`.cjs`) in the main process.
- Follow existing naming, component structure, and styling (Tailwind v4 tokens).
- Keep modules focused; prefer pure functions in `core/` and thin Electron adapters in `src/main/services/`.
- Do not add comments that restate the code; document non-obvious decisions only.
- Avoid new runtime dependencies unless they are clearly necessary and maintained.
- Update tests, docs, and the changelog when behavior changes.

`tsconfig.json` enables `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedIndexedAccess`; unused imports or loose indexing will fail `npm run typecheck`.

## Tests

- Add a regression test in `tests/unit.test.js` for every bug fix in `core/`.
- Tests must not require network access, Electron, or user data.
- For UI/main-process behavior that cannot be unit-tested, describe manual verification steps in the pull request.

## Branch naming

Use short, descriptive branches:

```text
feature/<topic>
fix/<topic>
refactor/<area>
docs/<topic>
chore/<topic>
```

## Commit messages

We use Conventional Commits. Write subject lines in the imperative mood, keep them under ~72 characters, and explain *why* in the body when it is not obvious.

```text
<type>(<scope>): <subject>

<body>

<footer>
```

Common types:

| Type | Use for |
| --- | --- |
| `feat` | New user-visible behavior |
| `fix` | Bug fix |
| `refactor` | Internal change without behavior change |
| `perf` | Performance improvement |
| `test` | Tests only |
| `docs` | Documentation only |
| `build` | Build tooling, dependencies, packaging |
| `ci` | GitHub Actions and automation |
| `chore` | Maintenance |
| `security` | Hardening or vulnerability fixes |

Examples:

```text
fix(adblock): skip main-frame requests to prevent ERR_FAILED
feat(ai): auto-provision the local runtime on first run
docs: add architecture guide
```

Rules:

- One logical change per commit; do not mix unrelated refactors with fixes.
- Do not commit generated output (`dist/`, `release/`) or user data.
- Reference issues in the footer, e.g. `Refs: #123` or `Closes: #123`.
- Never rewrite published history unless the maintainers ask.

## Pull requests

A good pull request:

- Has a clear title following the commit convention.
- Describes the problem, the approach, and user-visible impact.
- Links related issues.
- Includes tests for logic changes and manual verification steps for UI changes.
- Updates documentation and `CHANGELOG.md` when needed.
- Is focused; split large changes into reviewable commits.

Use the pull-request template and make sure all checks are green.

## Releases

Maintainers:

1. Update `package.json` and `CHANGELOG.md`.
2. Run the required checks.
3. Commit with `chore(release): vX.Y.Z`.
4. Create an annotated tag: `git tag -a vX.Y.Z -m "PiFlex vX.Y.Z"`.
5. Push the tag. The release workflow builds Windows, Linux, and macOS artifacts and attaches them to the GitHub release.

## Questions

Open a discussion or issue for design questions. For anything that may be a vulnerability, use the private process in [SECURITY.md](SECURITY.md).
