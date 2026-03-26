# INT-S3 Validation Report — World Contact

Date: 2026-03-26
Scope: `INT-S3` only (`.anws/v2/05_TASKS.md`)

## Validation Summary

- Overall status: PASS
- Goal: verify connector main paths, effect dispatcher, Quiet pipeline, and resume/reconcile continuity cooperate without replaying external side effects

## Acceptance Mapping

| Acceptance Item | Command(s) | Evidence Summary | Status |
| --- | --- | --- | --- |
| Connector main paths are runnable and normalized | `pnpm build && node --test dist/tests/integration/connectors/platform-adapters.test.js` | Moltbook/InStreet/EvoMap adapter tests passed; capability outcomes are normalized and platform channel boundaries are enforced (`api_rest` vs `a2a`) | PASS |
| Retry/cooldown/degraded constraints are effective | `node --test dist/tests/integration/connectors/policy-layer.test.js` | Policy layer tests passed; single-layer retry, cooldown block, degraded fallback guard, and platform-specific failure classification are active | PASS |
| Effect dispatcher + commit protocol + lease prevent duplicate external effects | `node --test dist/tests/integration/control-plane/effect-dispatcher.test.js` | Dispatcher tests passed; state-owned commit protocol and lease/checkpoint flow prevent duplicate dispatch in reentry/failure paths | PASS |
| Quiet pipeline + reflection guard cooperate with continuity flow | `node --test dist/tests/integration/control-plane/quiet-reflection.test.js dist/tests/integration/control-plane/outreach-resume.test.js` | Quiet/reflection and resume tests passed; claim-level source backing is enforced, compaction/pruning boundary is preserved, and resume branches by commit-state without blind replay | PASS |

## Command Output Highlights

### 1) Build + S3-focused integration checks

- Command:

```bash
pnpm build && node --test \
  dist/tests/integration/connectors/platform-adapters.test.js \
  dist/tests/integration/connectors/policy-layer.test.js \
  dist/tests/integration/control-plane/effect-dispatcher.test.js \
  dist/tests/integration/control-plane/quiet-reflection.test.js \
  dist/tests/integration/control-plane/outreach-resume.test.js
```

- Result: PASS (`18 passed, 0 failed`)

## Notes

- This report follows the conservative-route boundary:
  - no retro edits to settled waves
  - no plugin warning remediation in this milestone
  - no `workspace/` housekeeping
