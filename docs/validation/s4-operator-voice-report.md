# INT-S4 Validation Report — Operator Voice

Date: 2026-03-26
Scope: `INT-S4` only (`.anws/v2/05_TASKS.md`)

## Validation Summary

- Overall status: PASS
- Goal: verify end-to-end operator loop `configure -> autonomous behavior -> Quiet reflection -> explain -> plugin load` is executable and auditable

## Acceptance Mapping

| Acceptance Item | Command(s) | Evidence Summary | Status |
| --- | --- | --- | --- |
| Config + recovery + status/explain CLI paths are stable | `pnpm build && node --test dist/tests/integration/cli/cli-ops-surface.test.js` | `status/report/quiet/session/credential` aggregated read models pass; `policy set` / `credential verify` return non-interactive `requiredUserInput`; explain routes produce structured payloads | PASS |
| Plugin packaging walkthrough and install-spec fallback paths are valid | `node --test dist/tests/integration/cli/plugin-packaging-walkthrough.test.js && node dist/scripts/plugin-smoke-check.js local-path && node dist/scripts/plugin-smoke-check.js clawhub && node dist/scripts/plugin-smoke-check.js npm` | Packaging/integration tests pass; smoke checks report `ok: true`; fallback orders match walkthrough (`clawhub->npm`, `npm->file`) | PASS |
| Autonomous loop (active/quiet/outreach/interrupt/resume/deny) remains replayable and explainable | `node --test dist/tests/integration/control-plane/decision-loop-validation.test.js dist/tests/integration/control-plane/quiet-reflection.test.js dist/tests/integration/control-plane/outreach-resume.test.js` | Whole-loop tests pass with durability+explainability assertions; quiet/reflection and resume branches remain contract-compliant | PASS |
| Evidence and governance quality gates remain queryable and safe | `node --test dist/tests/integration/observability/evidence-query-engine.test.js dist/tests/integration/observability/observability-gates.test.js` | decision/proposal/asset evidence query paths pass; deny/anchor/credential/redaction quality gates pass with no sensitive plaintext persistence | PASS |
| Host plugin load chain is operational in QClaw profile | `openclaw.mjs --profile qclaw-plugin-test plugins install/enable/list/info/doctor` | Plugin `second-nature` installed and loaded; command/tool/services visible; `plugins doctor` reports no plugin issues | PASS |

## Command Output Highlights

### 1) INT-S4 integrated test bundle

- Command:

```bash
pnpm build && node --test \
  dist/tests/integration/cli/cli-ops-surface.test.js \
  dist/tests/integration/cli/plugin-packaging-walkthrough.test.js \
  dist/tests/integration/control-plane/decision-loop-validation.test.js \
  dist/tests/integration/control-plane/quiet-reflection.test.js \
  dist/tests/integration/control-plane/outreach-resume.test.js \
  dist/tests/integration/observability/evidence-query-engine.test.js \
  dist/tests/integration/observability/observability-gates.test.js
```

- Result: PASS (`22 passed, 0 failed`)

### 2) Packaging smoke checks

- Commands:

```bash
node dist/scripts/plugin-smoke-check.js local-path
node dist/scripts/plugin-smoke-check.js clawhub
node dist/scripts/plugin-smoke-check.js npm
```

- Result: PASS (`ok: true` in all modes)

### 3) Host lifecycle checks (QClaw/OpenClaw)

- Commands:

```bash
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins install file:./plugin
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins enable second-nature
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins list
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins info second-nature
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins doctor
```

- Result: PASS (`second-nature` loaded; tool/cli/services discovered; doctor clean)

## Notes

- Non-blocking host warnings observed and recorded only (per conservative route):
  - plugin id mismatch warning
  - plugins.allow empty warning
- No remediation applied in this milestone.
