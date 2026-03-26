# INT-S1 Validation Report — Substrate

Date: 2026-03-26
Scope: `INT-S1` only (`.anws/v2/05_TASKS.md`)

## Validation Summary

- Overall status: PASS
- Non-blocking warnings observed: yes (plugin id mismatch warning; explicitly non-blocking in current conservative route)

## Acceptance Mapping

| Acceptance Item | Command(s) | Evidence Summary | Status |
| --- | --- | --- | --- |
| plugin load check | `node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins install file:./plugin` + `plugins enable second-nature` + `plugins list` + `plugins info second-nature` + `plugins doctor` | `install`: success (`Installed plugin: second-nature`); `list`: `second-nature` status `loaded`; `info`: tool/cli/services visible; `doctor`: `No plugin issues detected.` | PASS |
| SQLite initialization check | `pnpm typecheck`, `pnpm test` | Build and test pipeline initializes and uses state/observability SQLite-backed paths without schema/runtime failure; all checks passed. | PASS |
| shared contracts import check | `pnpm typecheck`, `pnpm test` | Cross-system shared types compile and run through integration suites (decision/evidence/control-plane/cli paths) with no contract import conflict. | PASS |
| redaction smoke check | `pnpm test` | Redaction-related tests pass, including `quality gate: redaction security prevents sensitive plaintext from landing`. | PASS |

## Command Output Highlights

### 1) Typecheck baseline

- Command: `pnpm typecheck`
- Result: PASS (`tsc --noEmit` completed successfully)

### 2) Test baseline

- Command: `pnpm test`
- Result: PASS (`51 passed, 0 failed`)

### 3) Host plugin lifecycle (QClaw/OpenClaw)

- Commands executed with profile `qclaw-plugin-test`:
  - `plugins uninstall second-nature --force`
  - `plugins install file:./plugin`
  - `plugins enable second-nature`
  - `plugins list`
  - `plugins info second-nature`
  - `plugins doctor`
- Result:
  - install succeeded
  - plugin present and loaded in list
  - plugin info shows:
    - tool: `second_nature_ops`
    - command: `second-nature`
    - services: `second-nature-runtime`, `second-nature-lifecycle`
  - doctor reports no plugin issues

## Notes

- Non-blocking warning persisted during host commands:
  - `plugin id mismatch (manifest uses "second-nature", entry hints "openclaw-plugin")`
- Per conservative-route boundary, warning is recorded only and not remediated in INT-S1.
