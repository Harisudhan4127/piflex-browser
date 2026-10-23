# PiFlex Browser 2.0.0 — QA Code Review & Issue Report

**Review type:** Static code review + targeted runtime probes (QA tester)
**Repository:** `/run/media/harisudhan/Data/Git file/piflex-browser`
**Commit state:** working tree clean at review time (no source changes made)
**Review date:** 2026-10-23
**Reviewer:** QA / code review pass

---

## 1. Executive summary

The codebase is well structured and has a solid security baseline (sandboxed web content, `contextIsolation`, no `nodeIntegration`, parameterised SQLite queries, CSP, URL scheme classification). However, the current 2.0.0 build is **not release-ready**:

- **2 P0 defects** break core browsing/privacy promises.
- **7 P1 defects** break major advertised features (AI providers, find-in-page, multi-window, session restore, private mode protections, data clearing).
- **15 P2 defects** are functional/security gaps that will generate user-visible bugs or undermine trust.
- **~12 P3 defects** are UX, dead-code, and documentation/CI mismatches.

The most serious issue is that **“New private window” does not create a private tab**. The first tab is created with the normal persistent profile, all new tabs from that window are normal, and no private indicator is shown. A user who relies on private browsing for sensitive activity is silently exposed.

The second P0 is a **blank-page bug when switching back to a previously viewed tab**, caused by `WindowManager.attachView` never re-adding a view that is still recorded in its internal `views` set.

### Release recommendation

**BLOCK release.** Fix QA-001 through QA-007 before shipping. Add main-process and renderer tests to CI before calling the build verified.

---

## 2. Scope and method

Reviewed:

- Electron main process: `src/main/**`
- Preload bridge: `src/preload/index.cjs`
- IPC contract: `src/shared/ipc.cjs`, `src/main/ipc/register.cjs`
- Renderer: `src/renderer/**` (store, hooks, browser components, internal pages)
- Core logic: `core/**`
- Tests and CI: `tests/unit.test.js`, `.github/workflows/ci.yml`
- Docs: `README.md`, `CHANGELOG.md`, `SECURITY.md`, `docs/ARCHITECTURE.md`

Methods:

- Full read of the above files.
- Targeted Node.js probes against `core/settings-schema.js`, `src/main/db/*`, `src/main/services/ai-service.cjs`, and `src/main/services/window-manager.cjs` (Electron stubbed).
- `npm test`, `npm run typecheck`, `node --check` on every `.js`/`.cjs`.
- Attempted `npm run build:renderer` and smoke test (blocked by local environment, see §3).

Out of scope / not verified at runtime: real Electron window behaviour, real Chromium rendering, real AI provider endpoints, real extension loading, OS keyring, packaging/installers.

---

## 3. Test execution results

| Check | Result | Notes |
|---|---|---|
| `npm test` | **PASS** — 57 passed, 0 failed | Core-only suite; does not exercise main/renderer/IPC. |
| `npm run typecheck` | **PASS** | But it checks **0 `.cjs` files** (see QA-013). |
| `node --check` (all `.js`/`.cjs`) | **PASS** | No syntax errors. |
| `npm run build:renderer` | **FAIL (environmental)** | `Cannot find module '@rollup/rollup-linux-x64-gnu'` — local `node_modules` was installed on Windows. Lockfile does include the Linux optional dependency, so this is not a repository defect. |
| `npm run smoke` | **NOT RUN** | `node_modules/electron/dist` contains only the Windows `electron.exe`; no Linux Electron binary and no display in this environment. |

**Environment limitation:** Electron UI, packaging, and real navigation could not be exercised here. Findings below marked **Runtime probe** were executed in Node; findings marked **Code inspection** are deterministic from the source and should still be re-confirmed in a Linux/macOS/Windows CI runner with Xvfb or a desktop session.

---

## 4. Severity legend

| Severity | Definition |
|---|---|
| **P0** | Data loss, privacy breach, or core browsing completely broken; no acceptable workaround. |
| **P1** | Major advertised feature broken, or a significant privacy/security promise violated. |
| **P2** | Notable functional defect, security hardening gap, or reliability issue with a workaround. |
| **P3** | Minor UX defect, dead code, documentation/CI mismatch. |

---

## 5. P0 — Critical

### QA-001 — “New private window” is not private

**Severity:** P0 (privacy breach)
**Area:** Main process / window + tab lifecycle
**Files:**
- `src/main/main.cjs:262-271` (`openWindow`)
- `src/main/services/window-manager.cjs:32-55` (`create`, hard-coded `partition: 'persist:piflex'`)
- `src/main/services/tab-manager.cjs:191-233` (`create`, default `private = false`)
- `src/renderer/components/browser/MainMenu.tsx:85-90`, `src/renderer/lib/useShortcuts.ts:31-36`

**Reproduction**

1. Launch the app.
2. Open the main menu → **New private window** (or press `Ctrl+Shift+N`).
3. Navigate to any site and sign in.
4. Close the private window.
5. Reopen a normal window and visit the same site, or inspect `piflex.sqlite` / history.

**Expected**

- The new window and its first tab use the isolated `piflex-private` session.
- No history, cookies, cache, or credentials are written to the persistent profile.
- A clear private-mode indicator is shown.

**Actual**

- `openWindow({ private: true })` calls:
  ```js
  this.services.tabs.create({ url: DEFAULT_URL, active: true, background: true });
  ```
  with **no `private: true`**. `TabManager.create` defaults `isPrivate = false`, so the tab uses `persist:piflex`.
- The window shell itself is also created with `partition: 'persist:piflex'`.
- The tab is `private: false`, so `NewTabPage` does not render the “Private window” badge.
- History is recorded on `did-finish-load` because `tab.private` is false.
- Additional tabs created from that window (`Ctrl+T`, `+`, top sites, bookmarks) also default to non-private.
- Popups from a private tab (`window.open` / `target=_blank`) call `this.create({ url, active: true })` at `src/main/services/tab-manager.cjs:322-325`, again without `private: tab.private`, so a private tab can spawn a persistent normal tab.

**Evidence:** Code inspection; the call site omits the flag, and there is no window-level privacy state anywhere in `WindowManager` or `TabManager`.

**Suggested fix**

- Add a window-level `private` flag (or a per-window context object) and pass it through every tab creation path: first tab, `Ctrl+T`, `+`, `window.open`, `duplicate`, bookmarks/top-sites shortcuts.
- Create the shell window with a private partition or keep the shell on `persist:piflex` but ensure internal pages do not write sensitive data; the web-content tab must use `piflex-private`.
- Add a visible private indicator at window level, not only in the new-tab page.
- Add a regression test: open private window → navigate → assert no `history` row and `session.fromPartition('piflex-private')` is used.

---

### QA-002 — Switching back to a previously viewed web tab shows a blank page

**Severity:** P0 (core browsing broken)
**Area:** Window/view management
**Files:**
- `src/main/services/window-manager.cjs:115-130` (`attachView`)
- `src/main/services/tab-manager.cjs:418-435` (`activate`)

**Reproduction**

1. Open two web tabs (e.g., `https://example.com` and `https://example.org`).
2. View tab A, then click tab B, then click tab A again.
3. Tab A’s content area is blank (the React shell is visible, but no page).

**Expected:** Tab A’s page is shown again.

**Actual:** `attachView(A)` does:

```js
if (this.attachedView && this.attachedView !== view) {
  container.removeChildView(this.attachedView);   // removes B from the container
}
if (!this.views.has(view)) {                      // A is still in `this.views`
  container.addChildView(view);                   // therefore skipped
  this.views.add(view);
}
this.attachedView = view;
```

`attachView(B)` removed A from the native container but **never removed A from `this.views`**. When switching back, the `views.has(A)` check is true, so A is never re-added. The container is left with zero children.

**Evidence (runtime probe with Electron stubbed):**

```
after attach A -> children: A
after attach B -> children: B
after re-attach A -> children:  (EXPECTED A visible)
```

**Workaround:** Focus the address bar (which calls `setViewVisible(false)` → `detachView`, deleting A from the set) and blur it; or close/reopen the tab.

**Suggested fix**

- In `attachView`, always add the view when it is not the currently attached view:
  ```js
  if (this.attachedView !== view) {
    if (this.attachedView) container.removeChildView(this.attachedView);
    container.addChildView(view);
  }
  this.views.add(view);
  this.attachedView = view;
  ```
- Or delete the old view from `this.views` when removing it from the container.
- Add a unit test for `attachView(A) → attachView(B) → attachView(A)`.

---

## 6. P1 — Major

### QA-003 — AI assistant crashes for Ollama and OpenAI-compatible providers

**Severity:** P1 (feature completely broken)
**Area:** AI service
**File:** `src/main/services/ai-service.cjs:318-331`

**Reproduction**

1. Settings → AI → set Provider to **Ollama** (or **OpenAI-compatible**), configure the endpoint.
2. Open the assistant and send any prompt.

**Expected:** The prompt is sent to the configured endpoint and the response streams back.

**Actual:** The IPC handler returns `{ ok: false, error: "base is not defined" }`.

```js
if (config.provider === 'ollama') {
  return this._streamOllama(requestId, base + '/api/chat', payload, config);   // line 324
}
if (config.provider === 'openai-compatible') {
  return this._streamOpenAi(requestId, base + '/v1/chat/completions', payload, config, true); // line 327
}
```

There is no `base` variable in scope. The class has `baseUrl()`.

**Evidence (runtime probe):**

```
provider=ollama            -> ReferenceError: base is not defined
provider=openai-compatible -> ReferenceError: base is not defined
```

**Suggested fix:** Replace `base` with `this.baseUrl()` in both branches. Add a unit test that calls `chat()` for each provider with `net.request` stubbed.

---

### QA-004 — Find-in-page is unusable

**Severity:** P1 (feature completely broken)
**Area:** Renderer find bar + main `findInPage`
**Files:**
- `src/renderer/components/browser/FindBar.tsx:14-18` (hides the page while open)
- `src/renderer/components/browser/FindBar.tsx:40-58` (prev/next identical, match count never updates)
- `src/main/services/tab-manager.cjs:548-558` (no `found-in-page` listener)

**Reproduction**

1. Open any long page.
2. Press `Ctrl+F`, type a word that exists on the page.

**Expected:** The page stays visible, matches are highlighted, the counter shows `1/N`, and the up/down buttons move between matches.

**Actual**

- `FindBar` calls `win.setViewVisible(false)` while open, which **detaches the native web view**. The page disappears, so highlighted matches cannot be seen.
- `TabManager.find()` calls `webContents.findInPage()` but never subscribes to `found-in-page`; nothing sends `IPC.findResult`. The renderer’s `find.matches` therefore stays `0`, and the UI always shows “No results”.
- Both “Previous” and “Next” call `tabsApi.find(activeTabId, find.query)` with identical arguments (`FindBar.tsx:46` and `:54`); neither calls `findNext`.
- `findResult` is declared in `src/shared/ipc.cjs:49` and handled in `browser-store.ts:203-208`, but no main-process code emits it (`grep found-in-page` returns nothing).

**Suggested fix**

- Do not detach the page for the find bar. Use a non-overlapping layout (shrink the view bounds, or render the bar in a separate always-on-top window/overlay view).
- Subscribe to `wc.on('found-in-page', (_e, result) => send(IPC.findResult, { ... }))`.
- Add `findNext`/`findPrevious` IPC actions (`webContents.findInPage(text, { findNext: true, forward: false })`).
- Add an E2E test that types a query and asserts the match count and highlight navigation.

---

### QA-005 — Multi-window support is broken

**Severity:** P1 (major feature broken / wrong-window actions)
**Area:** Window + tab lifecycle
**Files:**
- `src/main/services/window-manager.cjs:20-24`, `:32-65` (single `this.window`, single `views` set)
- `src/main/main.cjs:199-212` (single global `TabManager`)
- `src/main/ipc/register.cjs:38-43` (window controls ignore the sender)

**Reproduction**

1. Open a window, then press `Ctrl+N` (or menu → New window).
2. In the first window, click Minimize / Maximize / Close.
3. Switch tabs in either window.

**Expected:** Each window has its own chrome, tab strip, active tab, and view bounds.

**Actual**

- `WindowManager.create()` overwrites `this.window` with the newest `BrowserWindow`. `send()`, `minimize()`, `toggleMaximize()`, `close()`, `isMaximized()` all operate on `this.window`.
- `ipcMain.on(IPC.windowClose, () => services.windows.close())` ignores `event.sender`; the close button in the **first** window closes the **second** window.
- A single `TabManager` is shared by all windows. Opening a tab in either window mutates the one global tab list, but `windows.send()` only pushes state to the newest window, so the other window’s tab strip goes stale. Switching tabs detaches/attaches the shared `WebContentsView` against whichever `contentView` the single `WindowManager` currently points at.
- `WindowManager`’s `closed` handler unconditionally sets `this.window = null` and clears `views`. Closing the older window nulls the reference to the newer window, so subsequent IPC silently no-ops.
- `ready-to-show` also calls `this.window.show()` on the newest window, so the first window may never show or may show the wrong one.

**Suggested fix**

- Make window state per-instance: `WindowManager` should map `BrowserWindow.id → { window, views, attachedView, tabManager }`, or create one `WindowManager`/`TabManager` pair per window.
- Resolve the target window from `event.sender` in every window/tab/layout IPC handler.
- Do not clear global state from a window’s `closed` handler unless it is the current window.
- Until then, hide/disable “New window” and `Ctrl+N` to avoid shipping a broken control.

---

### QA-006 — “Session restore” is a stub, despite being on by default and documented

**Severity:** P1 (advertised feature missing)
**Area:** Startup / session persistence
**Files:** `src/main/main.cjs:273-277`, `core/settings-schema.js:19`, `README.md:13`

**Reproduction**

1. Open several tabs.
2. Quit and relaunch the app.

**Expected:** The previous tabs are restored (setting `startup.restoreSession` defaults to `true`; README highlights “session restore”).

**Actual**

```js
_restoreSessionTabs(isPrivate) {
  const settings = this.services.settings.get();
  if (isPrivate || !settings.startup.restoreSession) return false;
  return false; // session persistence of open tabs is a follow-up; never fabricate state
}
```

The method always returns `false`. Every launch opens a single `piflex://newtab`. The setting and the README claim are misleading.

**Suggested fix:** Persist the tab list (URL, order, pinned, group) on change/quit and recreate tabs on startup; or remove the setting/README claim and mark it “coming soon” in the UI.

---

### QA-007 — “Clear browsing data” leaves history-derived data behind

**Severity:** P1 (privacy promise violated)
**Area:** History / trust
**Files:**
- `src/main/db/history-service.cjs:135-141` (`clear`)
- `src/main/db/history-service.cjs:175-186` (`recordClosed`)
- `src/main/services/trust-service.cjs:27-29`
- `src/renderer/pages/SettingsPage.tsx:1024-1035` (“Everything”)
- `src/renderer/pages/HistoryPage.tsx:53-55` (“Clear all”)

**Reproduction A — clear**

1. Browse `https://normal.example/a` and close a tab.
2. Settings → Privacy → Clear data → **Everything** (or History → **Clear all**).
3. Open a new tab and look at Top Sites / recently closed data.

**Expected:** History, top sites, and recently closed entries are all removed.

**Actual:** `HistoryService.clear()` only runs `DELETE FROM history`. `top_sites` and `sessions_closed` are untouched, so Top Sites still shows the visited host and the recently-closed list still contains the URL. The “Everything” button does not call `topSites.remove` or clear `sessions_closed`.

**Reproduction B — history disabled**

1. Settings → Privacy → disable “Save browsing history”.
2. Open and close a tab on a sensitive site.
3. Inspect the DB.

**Expected:** No URL is persisted anywhere.

**Actual:** `record()` correctly returns early when `enabled === false`, but `recordClosed()` has no `enabled` check:

```js
recordClosed(url, title) {
  ...
  INSERT INTO sessions_closed (url, title, closed_at) ...
}
```

**Evidence (runtime probe against the real SQLite schema):**

```
enabled=false -> history rows: 0 | closed rows: 1
after clear() -> history: 0 | top_sites: 1 | closed: 2
```

(The probe called `recordClosed()` twice; the point is that neither `top_sites` nor `sessions_closed` is cleared.)

**Suggested fix**

- In `clear()`, also `DELETE FROM top_sites` (or preserve pinned entries by explicit policy) and `DELETE FROM sessions_closed`.
- Gate `recordClosed()` on `this.enabled`.
- Skip `piflex://` internal pages in `recordClosed`.
- Add regression tests for both cases.

---

### QA-008 — `clearDataOnExit` is exposed but never implemented

**Severity:** P1 (privacy promise violated)
**Area:** Privacy settings / shutdown
**Files:** `core/settings-schema.js:32`, `src/renderer/pages/SettingsPage.tsx:400-404`, `src/main/main.cjs:337-359`

**Reproduction**

1. Enable Settings → Privacy → “Clear data when PiFlex closes”.
2. Browse, quit, relaunch.
3. Inspect cookies/cache/history.

**Expected:** The selected data is cleared on exit.

**Actual:** `privacy.clearDataOnExit` is only read by the settings schema and the toggle. `grep -rn clearDataOnExit src core` finds no main-process consumer. `before-quit` only calls `shutdown()` (destroys tabs, stops AI, closes the DB); it does not call `TrustService.clear()`.

**Suggested fix:** On `before-quit`, if `clearDataOnExit` is true, await `trust.clear({ cookies: true, cache: true, history: true, downloads: true, credentials: true })` before quitting (use `event.preventDefault()` + `app.quit()` after the promise resolves). Or remove the toggle until implemented.

---

### QA-009 — Private tabs receive no ad/tracker blocking and no session cleanup

**Severity:** P1 (privacy feature gap)
**Area:** Adblock / private session
**Files:**
- `src/main/main.cjs:81-91` (adblock attached only to `persist:piflex`)
- `src/main/services/adblock-service.cjs:171-187`
- `src/main/main.cjs:107-108` (permissions attached to both sessions, but not adblock)
- No `clearStorageData` call for `piflex-private` on window close

**Reproduction**

1. (After QA-001 is fixed) open a private tab and visit an ad-heavy page.
2. Compare blocked-request counts with a normal tab.

**Expected:** The same network-level blocking applies to private tabs.

**Actual:** `AdblockService` is constructed with `session.fromPartition('persist:piflex')` only. Private tabs use `piflex-private`, which has no `onBeforeRequest` listener. In addition, the private session is in-memory but is never cleared when the last private window closes; private cookies/localStorage persist for the lifetime of the app and are shared by later private tabs.

**Suggested fix**

- Attach the adblock listener to both sessions (or a shared `webRequest` helper per session).
- Track private window count and call `clearStorageData()` + `clearCache()` when the last private window closes.
- Add a test that asserts both sessions have a `onBeforeRequest` listener.

---

## 7. P2 — Notable defects and hardening gaps

### QA-010 — Window resize throws a renderer exception

**Files:** `src/main/services/window-manager.cjs:176-180`, `src/renderer/store/browser-store.ts:171-182`

`_relayout()` sends `window:state` with `{ resized: true }` on every resize. The renderer’s `onState` expects a full `WindowState` and does `state.tabOrder.map(...)`; `state.tabOrder` is `undefined`, so every resize logs:

```
TypeError: Cannot read properties of undefined (reading 'map')
```

The renderer already re-measures via `ResizeObserver` + `window.addEventListener('resize')` in `src/renderer/lib/useContentBounds.ts`, so the nudge is unnecessary. **Fix:** remove the `_relayout` send, or use a dedicated `window:relayout` event with a payload the renderer handles explicitly.

**Evidence (runtime probe of the handler expression):** `ERROR: TypeError: Cannot read properties of undefined (reading 'map')`.

---

### QA-011 — New tab can appear twice (race between `tabs:created` push and `createTab` response)

**Files:** `src/renderer/store/browser-store.ts:191-196` (`onCreated` dedupes), `:254-264` (`createTab` appends unconditionally)

`TabManager.create()` emits `tabs:created` and then a full `window:state` broadcast before the `ipcMain.handle` response resolves. If the renderer processes the push first, `onCreated` adds the tab, `onState` replaces the list, and then `createTab` appends the returned tab again. The tab strip then contains a duplicate id/key until the next full-state broadcast.

**Fix:** In `createTab`, merge by id (same guard as `onCreated`) instead of `[...s.tabs, tab]`. Add a renderer test for the push-before-response ordering.

---

### QA-012 — TypeScript does not check the main process or preload

**Files:** `tsconfig.json` (no `allowJs`/`checkJs`), `package.json:27`

`tsconfig.json` includes `src/main` and `src/preload`, but both are `.cjs`. `tsc --noEmit --listFiles` returns **0 `.cjs` files**, so `npm run typecheck` only checks the renderer/shared `.ts`. This is exactly why QA-003 (`base is not defined`) escaped.

**Fix:** Add `"allowJs": true, "checkJs": true` (with targeted `// @ts-nocheck` only where unavoidable), or run ESLint with `no-undef`/`no-unused-vars` over `src/main` and `src/preload` in CI.

---

### QA-013 — Tests exercise parallel JSON stores, not the production SQLite services

**Files:** `tests/unit.test.js:11-27`, `src/main/main.cjs:66-67`

The tests import `core/stores/history`, `core/stores/bookmarks`, `core/stores/downloads`, etc. Production uses `src/main/db/history-service.cjs`, `bookmark-service.cjs`, and `download-service.cjs` (SQLite). The two implementations have different APIs and behaviour; the `clear()` / `recordClosed()` bugs in QA-007 are invisible to the suite. There are no tests for `TabManager`, `WindowManager`, IPC handlers, preload, or renderer components.

**Fix:** Add integration tests for the SQLite services (in-memory DB) and at least smoke-level tests for `TabManager`/`WindowManager` with mocked Electron. Add a renderer test harness (Vitest + Testing Library) for the store and find bar.

---

### QA-014 — Preload `invoke` is not allow-listed; IPC handlers do not validate the sender

**Files:** `src/preload/index.cjs:13-21`, `src/main/ipc/register.cjs:14-24`

`send()` and `on()` enforce `SEND_CHANNELS`/`PUSH_CHANNELS`, but `invoke()` accepts any string and forwards it to `ipcRenderer.invoke`. The “strict allow-listed channel contract” claim in `CHANGELOG.md` is therefore only true for two of the three bridge methods. Separately, no handler checks `event.senderFrame`/`event.sender`; any renderer that obtains the bridge can invoke privileged channels (including `credentialsReveal`, `privacyClearData`, `settingsUpdate`). Web content is sandboxed with no preload, so this requires shell XSS or a compromised renderer, but it is still unnecessary blast radius.

**Fix:** Add an `INVOKE_CHANNELS` set and reject anything else in `invoke()`. In `handle()`, validate `event.senderFrame.url` against the expected shell URL/dev-server origin and reject cross-origin senders. Do not expose `channels` as a mutable map.

---

### QA-015 — Private downloads are not tracked; `shell.openPath` failures are swallowed

**Files:** `src/main/main.cjs:101` (downloads attached only to `persist:piflex`), `src/main/services/download-service.cjs:195-204`

- `DownloadService.attach()` is called only with the shared session. Downloads started from `piflex-private` never reach `will-download`, so they are not listed, not persisted, and not subject to the filename/danger checks.
- `open(id)` calls `this.shell.openPath(record.savePath)` without awaiting it. `shell.openPath` returns a `Promise<string>` that resolves to an error message; a failure is reported to the UI as `{ ok: true }`, and the rejected promise can become an unhandled rejection.

**Fix:** Attach the download handler to both sessions; `await shell.openPath(...)` and return `{ ok: false, error }` when the resolved string is non-empty.

---

### QA-016 — Navigation failures leave a blank page (no error UI)

**Files:** `src/main/services/tab-manager.cjs:258-281` (sets `crashed: true`), `src/shared/types.ts:146`, renderer (no `crashed` consumer)

`did-fail-load` retries `ERR_FAILED` once, then patches the tab with `crashed: true` and the error description. The renderer never reads `tab.crashed` (grep finds only the type declaration), so the user sees a blank content area with no error message, no retry button, and no indication of what happened.

**Fix:** Render an error page in the shell when the active tab is `crashed` (title/description + Retry + “Back to safety”), or load a `piflex://error` internal page. Add a test for `did-fail-load`.

---

### QA-017 — Private new-tab page exposes history-derived widgets

**Files:** `src/renderer/pages/NewTabPage.tsx:42-44`, `src/renderer/components/newtab/TopSitesGrid.tsx`, `RecentWidget.tsx`

`NewTabPage` computes `isPrivate` but still renders `TopSitesGrid` and `RecentWidget` unconditionally. Once QA-001 is fixed, a private tab’s new-tab page will show the user’s top sites and recent history, which is a privacy leak (and a common private-browsing expectation violation).

**Fix:** When `isPrivate`, hide `topSites` and `recent` (and any history-derived widget), or replace them with a private-mode explanation.

---

### QA-018 — OpenAI-compatible provider cannot send an API key

**File:** `src/main/services/ai-service.cjs:345-358`

`_streamOpenAi(requestId, url, messages, config, needsKey)` accepts `needsKey` but never uses it. The request headers are only `Content-Type: application/json`; there is no `Authorization: Bearer ...` header, and the settings schema has no `ai.apiKey` field. Even after fixing QA-003, any hosted OpenAI-compatible endpoint will return 401.

**Fix:** Add an `ai.apiKey` setting (stored via `safeStorage`), send `Authorization` when `needsKey` is true, and never log the key. Add a test that asserts the header for `openai-compatible` and its absence for `llamacpp`.

---

### QA-019 — The last enabled filter list cannot be disabled

**Files:** `core/settings-schema.js:175-180`, `:224`

```js
filterListIds: filterListIds.length ? filterListIds : ['easylist', 'easyprivacy'],
```

If the user turns off both lists (`filterListIds: []`), normalization silently restores both. Turning off the last remaining list therefore re-enables both. This makes “disable ad blocking lists” impossible via the API/settings file (there is no filter-list UI in `SettingsPage` at all).

**Fix:** Distinguish “not provided” from “explicitly empty”: only fall back to defaults when the key is absent, not when it is `[]`. Add a test for `filterListIds: []`.

---

### QA-020 — AI runtime and model downloads have no integrity verification

**Files:** `src/main/services/runtime-service.cjs:130-154`, `src/main/services/model-service.cjs:52-82`, `core/ai/catalog.js`

- The llama.cpp runtime is fetched from the **latest** GitHub release and extracted; there is no checksum or signature check before `chmod 0755` and `spawn`.
- Model downloads compute a SHA-256 but only report it in progress events; it is never compared to an expected digest, and the catalog contains no `sha256` fields.
- `runtime-service._extract` shells out to `tar`/PowerShell without path-traversal hardening.

**Fix:** Pin runtime versions and verify a published SHA-256 (or minisign) before extraction; add `sha256` to each catalog entry and compare after download; reject archives containing `..` or absolute paths.

---

### QA-021 — Dev mode is likely blocked by CSP

**Files:** `src/renderer/index.html` (CSP `script-src 'self'`), `vite.config.ts` (`@vitejs/plugin-react`), `package.json:22`

`@vitejs/plugin-react` injects an **inline** `<script type="module">` preamble in dev (`transformIndexHtml`). The CSP has `script-src 'self'` with no nonce/hash/`'unsafe-inline'`, so Chromium blocks the preamble. The plugin then reports “can't detect preamble” and React Fast Refresh (and possibly module initialisation) fails. This was not runtime-verified here because Electron cannot launch in this environment.

**Fix:** Use a dev-only CSP (e.g., inject a nonce or relax `script-src` when `PIFLEX_DEV_SERVER` is set), or serve the dev shell without the production CSP meta tag. Keep the strict CSP for production builds.

---

### QA-022 — Several settings are UI-only / inert

**Files:** `core/settings-schema.js`, `src/renderer/pages/SettingsPage.tsx`, main/renderer consumers

The following settings are persisted and shown in the UI but have no consumer (or only a partial one):

| Setting | Reality |
|---|---|
| `privacy.clearDataOnExit` | Never read (QA-008) |
| `privacy.cosmeticFiltering` | Only the hard-coded YouTube script checks `adblock`, not this flag |
| `tabs.suspendAfterMinutes`, `tabs.suspendOnMemoryPressure`, `tabs.maxTabs` | `TabManager.suspend()` exists but is never called and has no IPC handler |
| `advanced.hardwareAcceleration` | `app.disableHardwareAcceleration()` is never called |
| `advanced.devTools` | No consumer; `navigateAction('devtools')` is unreachable |
| `extensions.enabled` | Only per-extension `enabled` is checked |
| `autofill.enabled`, `savePasswords`, `saveAddresses`, `savePayments` | No autofill injection or capture flow |
| `appearance.compactToolbar`, `showHomeButton`, `toolbarOrder` | No renderer consumers |
| `accessibility.*` | No renderer consumers |
| `startup.openHomeOnStart` | No consumer |
| `ai.autoUnloadMinutes` | `_scheduleUnload()` is defined but never called |
| `newTab.feeds` | Not in the schema; `NewsFeed` can never receive a feed |

**Fix:** Either implement the behaviour or remove/disable the controls with a “coming soon” note. Shipping no-op privacy/security toggles erodes trust more than not showing them.

---

### QA-023 — Declared IPC channels have no handler

**Files:** `src/shared/ipc.cjs`, `src/main/ipc/register.cjs`

- `IPC.setTheme` (`shell:set-theme`) is in `SEND_CHANNELS` and `preload.setTheme()` sends it, but no `ipcMain.on('shell:set-theme')` exists. Any future caller silently does nothing.
- `IPC.tabSuspend` (`tabs:suspend`) is declared but has neither a handler nor a caller.
- `IPC.extensionsPickDir` (`extensions:pick-dir`) and `IPC.showItemInFolder` (`shell:show-item`) are declared but unused.

**Fix:** Add handlers or remove the channels; add a CI check that every `IPC` key is either handled or explicitly marked unused.

---

## 8. P3 — UX, dead code, docs

### QA-024 — Main menu actions are misleading

**File:** `src/renderer/components/browser/MainMenu.tsx`

- **Print** (`:116`) calls `window.print()` on the shell renderer. It prints the browser chrome, not the page; and there is no print IPC.
- **Import bookmarks and settings** (`:118`) navigates to `piflex://settings/import`. `App.tsx:85-88` extracts only the first path segment (`settings`), so it opens the General settings page. There is no import page; the only import UI is on the Bookmarks page.
- **Reading list** (`:99`) opens `piflex://bookmarks?tab=reading`; `BookmarksPage` ignores the query and there is no reading-list feature.

**Fix:** Wire Print to `webContents.print()`, point Import at the Bookmarks import flow (or a real import page), and remove Reading list until implemented.

### QA-025 — Advertised keyboard shortcuts are not implemented

**File:** `src/renderer/lib/useShortcuts.ts`

The menu labels show `Ctrl+P` (Print), `Ctrl+Q` (Exit), `Ctrl+Plus/Minus/0` (Zoom), but `useShortcuts` handles none of them. Zoom is only reachable from the menu; `Ctrl+Q` does nothing; `Ctrl+P` does nothing (and the menu’s Print is broken anyway).

**Fix:** Add handlers (`webContents.print`, `app.quit`, `setZoomFactor`) or remove the shortcut labels.

### QA-026 — News widget is dead code

**Files:** `src/renderer/components/newtab/NewsFeed.tsx:30-37`, `core/settings-schema.js:66-77`

`NewsFeed` reads `settingsData.newTab.feeds`, but `feeds` is not in the defaults or `normalizeSettings`; `mergeKnown` drops unknown keys, so it is always `undefined`. With no feeds, the widget shows the “Add an RSS feed” empty state; its button opens Settings, which has no feed UI. The “Fetching feeds…” branch is unreachable.

**Fix:** Add `newTab.feeds` to the schema and a feed-management UI, plus a main-process fetch proxy; or remove the widget.

### QA-027 — `countersFor()` is dead and keyed by the wrong id

**File:** `src/main/services/adblock-service.cjs:216`, `:260-262`

`_byTab` is populated with `details.webContentsId`, but `countersFor(tabId)` expects a `TabManager` tab id. No caller exists. Per-tab blocking stats are therefore never surfaced (and would be wrong if they were).

**Fix:** Map `webContents.id → tab.id` in `TabManager` and use that when incrementing; expose the count in `TabState` or remove the dead API.

### QA-028 — `file://` shell URL is built by string concatenation

**File:** `src/main/services/window-manager.cjs:26-30`

```js
return 'file://' + this.shellFile.replace(/\\/g, '/');
```

Paths containing `#`, `?`, or other URL-significant characters will be misparsed (the current repo path contains a space, which is usually tolerated but not guaranteed). Use `require('url').pathToFileURL(this.shellFile).href`.

### QA-029 — Closing the active tab selects the last tab, not the adjacent one

**File:** `src/main/services/tab-manager.cjs:467-470`

`const next = this.order[this.order.length - 1]` always activates the last tab. Standard browser behaviour is the next tab to the right (or left if none). Minor UX inconsistency.

### QA-030 — `addressFocused` is never reset on blur

**Files:** `src/renderer/components/browser/AddressBar.tsx:147`, `src/renderer/store/browser-store.ts:132`, `:179-189`, `:251`

Focusing the address bar sets `addressFocused: true`. Blur only closes the suggestions (`setTimeout(() => setOpen(false), 120)`) and does not reset the flag. Only `commitAddress` resets it. If the user focuses the bar and clicks elsewhere without navigating, the address bar stops updating on tab switches/navigations until the next commit.

**Fix:** Call `setAddress(undefined, false)` on blur (or a dedicated `blurAddress()` action), while keeping the current value.

### QA-031 — Recently closed tabs are stored but unreachable

**Files:** `src/main/db/history-service.cjs:175-200`, `src/renderer/lib/api.ts:160`

`history.recentlyClosed()` is exposed in the renderer API but no UI uses it. The DB keeps up to 30 closed URLs (including when history is disabled — QA-007), so the data is collected without user value. Either add “Recently closed” to the History page/menu or stop persisting it.

### QA-032 — CI and docs disagree; no release workflow

**Files:** `.github/workflows/ci.yml:25-32`, `docs/ARCHITECTURE.md:171`, `README.md:107`

- `docs/ARCHITECTURE.md` says CI runs `typecheck && test && build:renderer && smoke`; `ci.yml` runs only the first three. There is no Xvfb/smoke job.
- `README.md` says releases are “built by the release workflow”, but `.github/workflows/` contains only `ci.yml`.

**Fix:** Add an `xvfb-run` smoke step (and packaging matrix) to CI, or correct the docs. Add a release workflow or remove the claim.

### QA-033 — Address bar / permission prompt hide the page while open

**Files:** `src/renderer/components/browser/AddressBar.tsx:75-76`, `src/renderer/components/browser/PermissionPrompt.tsx:38-39`

Because native `WebContentsView`s paint above the shell, the address suggestions and permission prompt detach the page. Focusing the address bar makes the current page disappear; the permission prompt hides the page it is asking about. This is an architectural UX compromise, but it is surprising and should be documented or fixed with a proper overlay view/shrunk bounds.

### QA-034 — FTP bookmarks cannot be opened

**Files:** `src/main/db/bookmark-service.cjs:9` (allows `ftp:`), `core/url.js:7-9` (address bar only allows http/https/file/piflex)

A bookmark imported with an `ftp://` URL is accepted by the bookmark service, but clicking it goes through `classifyInput`, which classifies `ftp:` as an unknown external scheme and returns `{ kind: 'blocked' }`. The tab then shows the crashed/blank state (QA-016). Either allow `ftp:` consistently or reject it at bookmark creation/import time.

---

## 9. Documentation vs implementation

| Claim | Source | Reality |
|---|---|---|
| “session restore” | `README.md:13` | Stub, always returns false (QA-006) |
| “isolated private-tab session” | `README.md:11`, `CHANGELOG.md` | Private window creates a normal tab (QA-001) |
| “strict allow-listed channel contract” | `CHANGELOG.md` | `invoke` is not allow-listed; no sender validation (QA-014) |
| “Web view visibility is managed correctly … find bar is open” | `CHANGELOG.md` | Find bar hides the page, making find-in-page unusable (QA-004) |
| “CI: typecheck && test && build && smoke” | `docs/ARCHITECTURE.md:171` | CI has no smoke step (QA-032) |
| “Releases are built by the release workflow” | `README.md:107` | No release workflow exists (QA-032) |
| “First-run auto-provision downloads the runtime and a small model” | `README.md`, `CHANGELOG.md` | True, but silent, large, and unverified (QA-020); no consent prompt |

---

## 10. Positive observations

- Web content uses `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true` (`tab-manager.cjs:196-207`).
- URL scheme classification blocks `javascript:`, `data:`, `vbscript:`, `file:` is explicitly handled, and unknown external schemes are not auto-navigated (`core/url.js`).
- SQLite access is parameterised; no string-concatenated SQL was found.
- `safeStorage` is used for credential encryption (`credential-service.cjs`).
- The preload does not expose `ipcRenderer` directly; `send`/`on` enforce channel sets.
- Permission handling is per-origin with an explicit user decision, and the private session is included.
- Adblock explicitly avoids cancelling main-frame navigations (prevents `ERR_FAILED` on normal browsing).
- The core test suite is meaningful for the modules it covers (URL/search/settings/adblock/AI prompt/catalog/runtime asset selection).

---

## 11. Recommended fix order

1. **QA-001** (private window) and **QA-002** (blank tab) — release blockers.
2. **QA-003** (AI `base`), **QA-004** (find-in-page), **QA-005** (multi-window).
3. **QA-007** (clear data / history-disabled leak), **QA-008** (clear on exit), **QA-009** (private protections).
4. **QA-006** (session restore) — implement or remove the claim.
5. **QA-010–QA-023** — reliability, test/typecheck gates, security hardening.
6. **QA-024–QA-034** — UX and documentation cleanup.

Before re-testing, add:

- A Linux CI smoke job (`xvfb-run npm run smoke`).
- Main-process tests for `WindowManager`/`TabManager`/IPC (mock Electron).
- Renderer tests for the store and `FindBar`.
- A `checkJs`/ESLint `no-undef` gate for `src/main`/`src/preload`.

---

## 12. Appendix — commands and probes

```bash
npm test
# 57 passed, 0 failed

npm run typecheck
# exits 0

npx tsc --noEmit --listFiles | grep -c '\.cjs'
# 0

node --check <every .js/.cjs under src, core, tests>
# all OK

npm run build:renderer
# FAIL: Cannot find module '@rollup/rollup-linux-x64-gnu' (local Windows node_modules)

node -e "require('./core/settings-schema').normalizeSettings({privacy:{filterListIds:[]}})"
# privacy.filterListIds -> ["easylist","easyprivacy"]

node -e "<HistoryService probe with real SQLite schema>"
# enabled=false -> history 0, closed 1
# after clear() -> history 0, top_sites 1, closed 2

node -e "<AiService.chat probe, provider=ollama>"
# ReferenceError: base is not defined

node -e "<AiService.chat probe, provider=openai-compatible>"
# ReferenceError: base is not defined

node -e "<WindowManager.attachView probe with stubbed Electron>"
# attach A -> [A]; attach B -> [B]; re-attach A -> []  (bug)
```

No source files were modified during this review. This report is the only added file.
