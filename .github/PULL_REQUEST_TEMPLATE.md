## Description

<!-- Describe the change and why it is needed -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Performance
- [ ] Documentation
- [ ] Build/CI
- [ ] Security
- [ ] Other

## Related issues

<!-- Closes #123, Refs #456 -->

## Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build:renderer`
- [ ] Manual verification steps (if UI/main-process changes): <!-- describe -->

## Architecture checklist

- [ ] `core/` has no Electron imports
- [ ] New IPC channels added to `src/shared/ipc.cjs`, handler in `src/main/ipc/register.cjs`, typed wrapper in `src/renderer/lib/api.ts`
- [ ] Adblock changes do not cancel main-frame requests
- [ ] Untrusted content redacted before AI use
- [ ] No secrets, models, runtime binaries, or user data committed
- [ ] Tests/docs/changelog updated if behavior changes

## Screenshots (optional)

<!-- Add screenshots for UI changes -->
