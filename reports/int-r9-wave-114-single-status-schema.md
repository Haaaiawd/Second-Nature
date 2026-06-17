# INT-R9 — Wave 114 Single-Status Schema Gate

Date: 2026-06-16

## Scope

Wave 114 closes the remaining CH-16 schema-status ambiguity for v8 tables that had both `status` and `lifecycle_status`.

Target tables:

- `action_closure_record`
- `dream_consolidation_run`
- `long_term_memory_projection`
- `heartbeat_cycle_trace`
- `loop_stage_event`

Non-target lifecycle-only tables remain unchanged:

- `evidence_item`
- `perception_card`
- `judgment_verdict`
- `quiet_daily_review`
- `impulse_context_artifact`

## Implementation Evidence

- `src/storage/db/schema/v8-entities.ts` removes `lifecycleStatus` from target Drizzle table definitions.
- `src/storage/db/index.ts` fresh bootstrap SQL no longer creates `lifecycle_status` for target tables.
- `src/storage/db/index.ts` defensively drops target `lifecycle_status` columns during startup for pre-Wave-114 DBs.
- `src/storage/db/migrations/v8-005-single-status-schema.ts` records the schema-version marker after the defensive pass.
- `src/storage/v8-state-stores.ts` and target runtime writers no longer write target-table `lifecycleStatus` fields.
- `tests/integration/storage/v8-schema-shape.test.ts` verifies fresh bootstrap and upgrade schema introspection.

## Verification

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm build:plugin` | PASS |
| `node --test dist/tests/integration/storage/v8-schema-shape.test.js dist/tests/integration/storage/schema-migration.test.js` | PASS, 5/5 + 3 historical skips |
| `node --test dist/tests/unit/dream/dream-runner-lifecycle.test.js dist/tests/unit/quiet/quiet-review-content.test.js dist/tests/unit/observability/living-loop-health-gate.test.js` | PASS, 9/9 |
| `node --test dist/tests/api/runtime-ops/loop-status-real-run-gate.test.js dist/tests/integration/v8/int-r1-runtime-activation-repair.test.js dist/tests/integration/v8/proof-memory-closure.test.js` | PASS, 12/12 |

## Result

INT-R9 passes. Wave 114 has no blocking failures.
