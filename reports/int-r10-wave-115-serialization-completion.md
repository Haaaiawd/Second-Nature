# INT-R10 — Wave 115 Shared Serialization Completion Gate

Date: 2026-06-16

## Scope

Wave 115 completes the CH-16 SourceRef JSON serialization cleanup by migrating all v8-relevant `sourceRefsJson` parse/stringify call sites to the shared serializer in `src/shared/serialization.ts`.

## Implementation Evidence

- `src/core/second-nature/action/policy-bound-dispatch.ts` — replaced `JSON.stringify` of canonical v8 `SourceRef[]` with `serializeSourceRefs`.
- `src/core/second-nature/action/action-proposal-builder.ts` — replaced local `parseVerdictSourceRefs` with shared `parseSourceRefs`.
- `src/observability/living-loop-health-gate.ts` — replaced ad-hoc `JSON.parse` of `ActionClosureRecord.sourceRefsJson` with `parseSourceRefs`.
- `src/core/second-nature/perception/judgment-engine.ts` — replaced local `parseCardSourceRefs` with shared `parseSourceRefs`.
- `src/core/second-nature/control-plane/accepted-projection-loader.ts` — removed local `parseSourceRefs`, imports shared helper.
- `src/core/second-nature/perception/perception-builder.ts` — removed local `parseSourceRefs`, imports shared helper.
- `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts` — removed local `parseSourceRefs`, imports shared helper.
- `src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts` — removed local `parseSourceRefs` and unused import.
- `logs/wave-115-source-refs-search.log` — documents remaining v7/non-canonical ad-hoc handling and confirms no v8 ad-hoc handling remains.

## Verification

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm build:plugin` | PASS |
| `node --test dist/tests/unit/action/policy-bound-dispatch.test.js dist/tests/unit/action/action-proposal-builder.test.js dist/tests/unit/observability/living-loop-health-gate.test.js dist/tests/unit/control-plane/accepted-projection-loader.test.js dist/tests/unit/perception/perception-builder.test.js dist/tests/unit/perception/perception-content-bearing.test.js dist/tests/unit/perception/judgment-engine.test.js dist/tests/unit/quiet/quiet-daily-review-builder.test.js dist/tests/unit/dream/memory-projection-lifecycle.test.js dist/tests/unit/shared/source-ref-serialization.test.js` | PASS, 36/36 |
| `node --test dist/tests/integration/v8/proof-memory-closure.test.js dist/tests/integration/v8/int-r1-runtime-activation-repair.test.js dist/tests/api/runtime-ops/loop-status-real-run-gate.test.js dist/tests/integration/storage/v8-schema-shape.test.js` | PASS, 14/14 |

## Result

INT-R10 passes. Wave 115 has no blocking failures.
