# INT-S2 Validation Report — Decision Spine

Date: 2026-03-26
Scope: `INT-S2` only (`.anws/v2/05_TASKS.md`)

## Validation Summary

- Overall status: PASS
- Goal: verify synthetic decision cycle can produce decision/evidence/proposal-governance chain on top of S2 spine

## Acceptance Mapping

| Acceptance Item | Command(s) | Evidence Summary | Status |
| --- | --- | --- | --- |
| Rhythm + intent/guard spine available | `pnpm build && node --test dist/tests/integration/control-plane/rhythm-intent-guard.test.js` | `rhythm-intent-guard` passed; covers `planIntent`, `evaluateGuards`, decision basis stratification and stable window selection | PASS |
| Synthetic tick forms allow/deny decisions | `node --test dist/tests/integration/control-plane/decision-loop-validation.test.js` | whole-loop test passed; `allow`/`deny`/interrupt/outreach paths produced auditable decision records | PASS |
| Evidence query returns stable evidence bundle | `node --test dist/tests/integration/observability/evidence-query-engine.test.js` | query by `decisionId`/`proposalId`/`assetId` passed with expected resolution plan behavior and stable bundle shape | PASS |
| Proposal/governance chain remains queryable | `node --test dist/tests/integration/observability/observability-services.test.js dist/tests/integration/cli/cli-ops-surface.test.js` | governance audit + explain paths passed; anchor/proposal-governance evidence remains retrievable through observability/CLI explain surfaces | PASS |

## Command Output Highlights

### 1) S2-focused cycle checks

- Command:

```bash
pnpm build && node --test \
  dist/tests/integration/control-plane/rhythm-intent-guard.test.js \
  dist/tests/integration/control-plane/decision-loop-validation.test.js \
  dist/tests/integration/observability/evidence-query-engine.test.js
```

- Result: PASS (`9 passed, 0 failed`)

### 2) Governance/evidence closure checks

- Command:

```bash
node --test \
  dist/tests/integration/observability/observability-services.test.js \
  dist/tests/integration/cli/cli-ops-surface.test.js
```

- Result: PASS (`6 passed, 0 failed`)

## Notes

- This report follows the conservative route boundary: no retro changes to Wave 14/15/M2 implementation and no plugin warning remediation.
