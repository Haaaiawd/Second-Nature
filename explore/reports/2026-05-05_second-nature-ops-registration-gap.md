# Explore Report: `second_nature_ops` Registration Gap (Host Runtime)

**Date**: 2026-05-05  
**Explorer**: AI Explorer  
**Scope**: Why OpenClaw host sessions cannot see `second_nature_ops` even though plugin files declare it.

---

## 1) Core Question

Why does the host runtime report no `second_nature_ops` in a fresh session while repository/plugin artifacts clearly define this tool?

---

## 2) Key Findings

1. **Declaration layer is correct**
  Plugin manifest and entry both declare/register `second_nature_ops`:
  - `plugin/openclaw.plugin.json` includes tool capability `"second_nature_ops"`.
  - `plugin/index.ts` calls `api.registerTool({ name: "second_nature_ops", ... })`.
2. **Packaging layer appears correct**
  - `plugin/package.json` version `0.1.12`, `main: "./index.js"`, and includes `index.js`, `openclaw.plugin.json`, `runtime/`.
  - Integration tests explicitly assert tool registration + smoke fallback paths.
3. **Host runtime/session layer is failing to surface the tool**
  In a brand-new dashboard session (`dashboard:560b2dbc-b48e-4e42-8839-9a8e954c743a`), runtime introspection returned:
  - `NO_SECOND_NATURE_OPS`
  - tools list contains built-ins (`cron/edit/exec/...`) but not `second_nature_ops`.
4. **This is not a stale-session-only problem**
  The miss reproduces in new sessions after gateway restart, so the break is likely before/at runtime extension loading, not chat history contamination.

---

## 3) Evidence Map

### 3.1 Repo/Artifact Evidence (Declaration + Packaging)

- `plugin/openclaw.plugin.json`
  - `id: "second-nature"`
  - `entry: "./index.js"`
  - `capabilities.tools: ["second_nature_ops"]`
- `plugin/index.ts`
  - synchronous `register(api)` path
  - `api.registerTool({ name: "second_nature_ops", ... })`
- `plugin/package.json`
  - package/version/runtime files consistent with plugin shipping requirements
- `tests/integration/cli/plugin-runtime-registration.test.ts`
  - asserts one tool is registered during `plugin.register(...)`
- `tests/integration/cli/plugin-packaging-walkthrough.test.ts`
  - validates manifest/package discoverability and restart-required smoke assumptions

### 3.2 Host Runtime Evidence (Execution Layer)

- Fresh session tool probe returns `NO_SECOND_NATURE_OPS`.
- Reported tools are generic host tools only; no second-nature namespace tool, no fuzzy matches.

---

## 4) Synthesis

The defect boundary is **between packaged plugin artifacts and host runtime extension activation**:

- Not a TypeScript/source declaration issue.
- Not a manifest capability declaration issue.
- Not a “only old session cache” issue.
- Most likely one of:
  1. wrong runtime instance/profile loads (different gateway target than expected),
  2. plugin installed but not activated for current host instance,
  3. extension load failure at runtime (entry/loader error) with silent fallback to built-in tools,
  4. plugin registry refresh not applied to active instance despite restart.

---

## 5) Recommended Next Actions (Shortest Path)

### P0

1. **Verify active host instance extension set**
  - Confirm the currently connected gateway instance has `second-nature` enabled (not just installed globally).
2. **Collect extension load logs**
  - From OpenClaw debug/log view, locate plugin load lines for `id=second-nature`, `entry=./index.js`, and any registration errors.
3. **Hard refresh runtime registration**
  - disable/enable plugin (or uninstall/install), restart gateway instance, create a brand-new session, then re-probe tools.

### P1

1. **Instance/profile consistency check**
  - Ensure dashboard token/session points to the same profile where plugin was installed.
2. **Version pin check**
  - Confirm running extension version equals expected `0.1.12` (or latest built one) and not an older cached release.

---

## 6) Decision

Current status: **Host runtime registration gap confirmed**.  
Do not continue INT-S4 `J-HOST-01..04` acceptance until `second_nature_ops` is visible in a fresh session tool list.