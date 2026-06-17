# Wave 114 Code Review — 2026-06-16

## 1. 总结结论

**Verdict: Pass (static).**

No Critical, High, Medium, or Low issues found. The Wave 114 implementation is statically consistent with T-SMS.R.4 and INT-R9: the five target v8 tables keep one semantic `status` column, target `lifecycleStatus`/`lifecycle_status` writes are removed from production write paths, and non-target lifecycle-only tables remain intentionally unchanged.

## 2. 审查范围与静态边界

Read anchors:

- `.anws/v8/05A_TASKS.md` Wave 114 T-SMS.R.4 and INT-R9: target tables and acceptance require exactly one semantic status column per v8 table row, with evidence in schema test and migration file (**.anws/v8/05A_TASKS.md:1827-1861**).
- `.anws/v8/05B_VERIFICATION_PLAN.md` T-SMS.R.4 and INT-R9: risks are migration data loss and wrong query filtering column; verification evidence is `tests/integration/storage/v8-schema-shape.test.ts` plus INT-R9 regression report (**.anws/v8/05B_VERIFICATION_PLAN.md:920-962**).
- Verification overlay and traceability matrix: Wave 114 schema cleanup and INT-R9 are marked covered by integration/migration and regression evidence (**.anws/v8/05B_VERIFICATION_PLAN.md:1036-1037**, **.anws/v8/05B_VERIFICATION_PLAN.md:1075-1076**).
- INT-R9 report: target and non-target table lists, implementation evidence, and submitted command evidence (**reports/int-r9-wave-114-single-status-schema.md:7-32**, **reports/int-r9-wave-114-single-status-schema.md:36-47**).
- Relevant implementation and test files listed in the user scope.

Static boundary:

- No tests, build, typecheck, or SQLite runtime execution were run in this review.
- SQLite `ALTER TABLE ... DROP COLUMN` compatibility and real upgrade execution are not re-proven here; they are treated as submitted verification evidence in INT-R9, while this review only inspects the code path and test shape.
- Wave 115 SourceRef serialization cleanup is explicitly out of scope except where it intersects target status writes.

## 3. 契约 → 代码映射摘要

| Contract / task promise | Static implementation evidence |
| --- | --- |
| Target tables are `action_closure_record`, `dream_consolidation_run`, `long_term_memory_projection`, `heartbeat_cycle_trace`, `loop_stage_event` | Task and INT-R9 define the same target list (**.anws/v8/05A_TASKS.md:1832-1844**, **reports/int-r9-wave-114-single-status-schema.md:9-15**). |
| Target Drizzle schemas keep `status` and remove `lifecycleStatus` | Target table definitions expose `status` and no `lifecycleStatus` in schema (**src/storage/db/schema/v8-entities.ts:92-106**, **src/storage/db/schema/v8-entities.ts:135-144**, **src/storage/db/schema/v8-entities.ts:153-162**, **src/storage/db/schema/v8-entities.ts:171-183**, **src/storage/db/schema/v8-entities.ts:192-204**). |
| Fresh bootstrap SQL no longer creates target `lifecycle_status` | Bootstrap SQL creates target tables with `status` only (**src/storage/db/index.ts:227-241**, **src/storage/db/index.ts:254-263**, **src/storage/db/index.ts:264-273**, **src/storage/db/index.ts:274-286**, **src/storage/db/index.ts:287-299**). |
| Existing DB startup upgrade removes target duplicate columns | `bootstrapStateSchema` runs defensive state schema migrations before versioned migrations, and the defensive list drops each target `lifecycle_status` column (**src/storage/db/index.ts:372-375**, **src/storage/db/index.ts:378-402**). |
| v8-005 marker follows the v8-004 defensive-migration pattern | v8-004 documents that column-level fixes live in `applyStateSchemaMigrations` (**src/storage/db/migrations/v8-004-schema-closure.ts:11-16**); v8-005 records the version after that defensive pass with `SELECT 1` marker SQL (**src/storage/db/migrations/v8-005-single-status-schema.ts:1-19**) and is ordered after v8-004 (**src/storage/db/migrations/index.ts:13-25**). |
| Production writes no longer send target `lifecycleStatus` | Target store writers serialize source refs and write row records without adding `lifecycleStatus` (**src/storage/v8-state-stores.ts:483-505**, **src/storage/v8-state-stores.ts:631-653**, **src/storage/v8-state-stores.ts:759-781**, **src/storage/v8-state-stores.ts:881-899**, **src/storage/v8-state-stores.ts:928-951**). |
| Non-target lifecycle-only tables are not unnecessarily changed | `evidence_item`, `perception_card`, `judgment_verdict`, `quiet_daily_review`, and `impulse_context_artifact` still retain `lifecycleStatus` in schema (**src/storage/db/schema/v8-entities.ts:22-35**, **src/storage/db/schema/v8-entities.ts:44-61**, **src/storage/db/schema/v8-entities.ts:70-83**, **src/storage/db/schema/v8-entities.ts:115-126**, **src/storage/db/schema/v8-entities.ts:213-231**). |

## 4. Lens 结果摘要

- **Lens 1 — Contract Fidelity: Pass.** The implementation aligns with the Wave 114 contract to remove target dual-status ambiguity and preserve non-target lifecycle-only tables (**.anws/v8/05A_TASKS.md:1827-1844**, **src/storage/db/schema/v8-entities.ts:92-204**).
- **Lens 2 — Task Fulfillment: Pass.** T-SMS.R.4 requested schema, migration, and read/write updates; those surfaces are present in schema, bootstrap/upgrade, migration registry, stores, and schema-shape tests (**src/storage/db/index.ts:227-299**, **src/storage/db/index.ts:372-402**, **src/storage/db/migrations/index.ts:13-25**, **tests/integration/storage/v8-schema-shape.test.ts:20-82**).
- **Lens 3 — Architecture Fit: Pass.** State-memory remains the bounded persistence/read-model layer and does not move semantic decisions into storage; target status transitions remain owned by action, Dream, projection, heartbeat, and observability callers (**.anws/v8/04_SYSTEM_DESIGN/state-memory-system.md:14-26**, **src/core/second-nature/action/action-closure-recorder.ts:96-135**, **src/core/second-nature/quiet-dream/dream-scheduler.ts:82-133**, **src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts:81-120**, **src/observability/loop-stage-event-sink.ts:132-175**).
- **Lens 4 — Runtime Risk From Static Evidence: Pass with static caveat.** Defensive startup migration isolates each drop statement and ignores already-migrated/missing-column errors, matching the prior v8-004 approach; actual SQLite execution is not statically confirmed and is covered by submitted INT-R9 tests (**src/storage/db/index.ts:378-402**, **src/storage/db/migrations/v8-004-schema-closure.ts:11-16**, **src/storage/db/migrations/v8-005-single-status-schema.ts:1-19**, **reports/int-r9-wave-114-single-status-schema.md:36-47**).
- **Lens 5 — Verification Evidence: Pass (submitted evidence sufficient for scope).** The integration test asserts fresh bootstrap and startup upgrade shape for all target and lifecycle-only non-target tables (**tests/integration/storage/v8-schema-shape.test.ts:20-82**), and INT-R9 reports typecheck/build/plugin build plus targeted regression evidence (**reports/int-r9-wave-114-single-status-schema.md:36-47**).
- **Lens 6 — Backflow & Handoff: Pass.** 05A, 05B, and INT-R9 are updated with Wave 114 status, target evidence, and regression gate traceability (**.anws/v8/05A_TASKS.md:1832-1861**, **.anws/v8/05B_VERIFICATION_PLAN.md:1036-1037**, **reports/int-r9-wave-114-single-status-schema.md:25-32**).

## 5. Issues

No Critical issues.

No High issues.

No Medium issues.

No Low issues.

## 6. 安全 / 测试覆盖补充

- Migration caveat: static review confirms the intended ordering `applyStateSchemaMigrations` before `runMigrations` and the v8-005 marker pattern (**src/storage/db/index.ts:372-375**, **src/storage/db/migrations/v8-005-single-status-schema.ts:13-19**), but actual SQLite `DROP COLUMN` behavior across deployed sql.js versions remains a runtime/test matter.
- Test shape is appropriate for Wave 114: it checks the five target tables for `status` without `lifecycle_status`, and checks the five non-target lifecycle-only tables still include `lifecycle_status` (**tests/integration/storage/v8-schema-shape.test.ts:20-51**).
- Production writer coverage is statically adequate: action closure, Dream run, memory projection, heartbeat trace, and loop stage event write paths all write `status` and not `lifecycleStatus` (**src/core/second-nature/action/action-closure-recorder.ts:110-129**, **src/core/second-nature/action/action-closure-recorder.ts:219-238**, **src/core/second-nature/action/action-closure-recorder.ts:281-301**, **src/core/second-nature/quiet-dream/dream-scheduler.ts:84-101**, **src/core/second-nature/quiet-dream/dream-scheduler.ts:117-133**, **src/core/second-nature/control-plane/heartbeat-orchestrator.ts:176-185**, **src/observability/loop-stage-event-sink.ts:154-168**).
