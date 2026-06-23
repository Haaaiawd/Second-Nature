# INT-R11 Wave 117 — v8 Runtime Integration Failure Triage and Repair

> **Gate**: `INT-R11` Host Reality and Ideal Loop Hemostasis  
> **Scope**: Repair the 21 pre-existing v8 runtime integration failures surfaced by the Wave 116 INT-R11 gate, without regressing Wave 108–115.  
> **Result**: ✅ Full `pnpm test` regression passes — 1693 tests, 1684 pass, 0 fail, 9 skipped.

---

## 1. Summary

After Wave 116D completed the host-reality and bridge-repair objectives, the INT-R11 gate revealed **21 failing tests** concentrated in v8 runtime integration suites from Waves 106–109. A baseline check confirmed these failures were **pre-existing** relative to Wave 116 source changes.

Wave 117 triaged the failures to **four root causes**:

1. Missing `proof_refs_json` / `trace_refs_json` columns in the `loop_stage_event` bootstrap schema.
2. Systemic `...row` spread in `src/storage/v8-state-stores.ts` writers passing array/object fields to Drizzle.
3. T-DQ.R.9 Quiet placeholder rejection invalidating closure-only / ID-only test expectations.
4. INT-V8 guidance-consumption test asserting merged `sourceRefs`/`proofRefs`, contrary to provenance-tier design.

All four have been repaired and the full regression gate is now green.

---

## 2. Root-cause analysis

### 2.1 `loop_stage_event` bootstrap schema missing proof/trace columns

`src/storage/db/index.ts` created `loop_stage_event` without `proof_refs_json` and `trace_refs_json`.

- **Impact**: `writeLoopStageEvent` failed silently on fresh `:memory:` databases; stage events disappeared. `loop_status`, `living-loop-health-gate`, and real-run gate tests broke.
- **Fix**:
  - Added both columns to the bootstrap `CREATE TABLE` in `src/storage/db/index.ts`.
  - Added defensive `ALTER TABLE ... ADD COLUMN` statements in `applyStateSchemaMigrations` so existing databases also receive the columns.

### 2.2 Systemic `...row` spread in v8 state writers

Multiple writers in `src/storage/v8-state-stores.ts` built insert records with `...row`, copying caller-supplied fields such as `sourceRefs`, `proofRefs`, `traceRefs`, `closureRefs`, and `payload` directly into the Drizzle insert object. While current table definitions do not define columns with those exact names, any future schema addition would silently fail or drift.

- **Impact**: Latent schema-drift risk; extra array/object values being passed to SQLite.
- **Fix**: Destructured non-column fields before building each insert record for:
  - `writeEvidenceItem`
  - `writePerceptionCard`
  - `writeJudgmentVerdict`
  - `writeActionClosureRecord`
  - `writeQuietDailyReview`
  - `writeDreamConsolidationRun`
  - `writeLongTermMemoryProjection`
  - `writeHeartbeatCycleTrace`
  - `writeLoopStageEvent` (already fixed during 2.1)
  - `writeImpulseContextArtifact`
  - `writeDailyRhythmState`
  - `writeConnectorCooldownState`

### 2.3 T-DQ.R.9 placeholder rejection changed test contract

T-DQ.R.9 (Quiet placeholder rejection) correctly blocks Dream when a daily review has only closure-only or ID-only evidence. Several earlier tests expected `dream completed` after writing only an action closure or heartbeat no-action closure.

- **Impact**: 14 failures across daily-rhythm-scheduler, dream-runner-lifecycle, quiet-dream-runtime-chain, INT-R1, INT-R2, real-runtime-quiet-dream-advance, runtime-recovery-closure, and loop-status-real-run-gate.
- **Fix**:
  - Created `tests/shared/content-evidence-fixture.ts` with `seedContentEvidence()` to inject content-bearing evidence (`payloadJson.contentStatus === "content_present"`).
  - Updated tests that intend a full Quiet → Dream completion to call `seedContentEvidence()` before the heartbeat or closure write.
  - Updated tests that explicitly validate the no-content path to expect `dreamStatus === "blocked"` with `dreamReason === "dream_blocked_no_content"`.

### 2.4 INT-V8 guidance source/proof tier assertion

`tests/integration/v8/living-perception-loop.test.ts` asserted `output.sourceRefs.length >= 2` after passing one proposal source ref and one decision proof ref. The provenance-tier design keeps `sourceRefs` and `proofRefs` separate.

- **Impact**: 1 failure in INT-V8 guidance consumption contract.
- **Fix**: Assert `sourceRefs.length >= 1` and `proofRefs.length >= 1` separately.

---

## 3. Changed files

### Production code

- `src/storage/db/index.ts` — `loop_stage_event` bootstrap + defensive column migration.
- `src/storage/v8-state-stores.ts` — removed non-column field spreads from all v8 writers.

### Test code / fixtures

- `tests/shared/content-evidence-fixture.ts` — new content-bearing evidence helper.
- `tests/api/runtime-ops/loop-status-real-run-gate.test.ts`
- `tests/api/dream/quiet-dream-runtime-chain.test.ts`
- `tests/integration/v8/int-r1-runtime-activation-repair.test.ts`
- `tests/integration/v8/living-perception-loop.test.ts`
- `tests/integration/v8/proof-memory-closure.test.ts`
- `tests/integration/v8/real-runtime-quiet-dream-advance.test.ts`
- `tests/integration/v8/runtime-recovery-closure.test.ts`
- `tests/unit/dream/daily-rhythm-scheduler.test.ts`
- `tests/unit/dream/dream-runner-lifecycle.test.ts`

### Architecture / tracking

- `.anws/v8/05A_TASKS.md` — `INT-R11` checked, updated acceptance criteria.
- `.anws/v8/05B_VERIFICATION_PLAN.md` — Wave 116/INT-R11 verification statuses updated to ✅.
- `AGENTS.md` — Wave 117 state recorded.
- `reports/int-r11-wave-117-runtime-integration-repair.md` — this report.

---

## 4. Verification

### Targeted previously-failing suites

Ran the 9 suites that contained failures:

```text
# tests 48
# suites 14
# pass 48
# fail 0
# skipped 0
```

Suites:

1. `tests/api/runtime-ops/loop-status-real-run-gate.test.ts`
2. `tests/api/dream/quiet-dream-runtime-chain.test.ts`
3. `tests/integration/v8/int-r1-runtime-activation-repair.test.ts`
4. `tests/integration/v8/living-perception-loop.test.ts`
5. `tests/integration/v8/proof-memory-closure.test.ts`
6. `tests/integration/v8/real-runtime-quiet-dream-advance.test.ts`
7. `tests/integration/v8/runtime-recovery-closure.test.ts`
8. `tests/unit/dream/daily-rhythm-scheduler.test.ts`
9. `tests/unit/dream/dream-runner-lifecycle.test.ts`

### Full regression gate

```text
pnpm test
# tests 1693
# pass 1684
# fail 0
# skipped 9
```

The 9 skipped tests are historical justified skips unrelated to Wave 117.

### Build / type checks

- `pnpm build` ✅
- `pnpm build:plugin` ✅
- `pnpm typecheck` (`tsc --noEmit`) ✅

---

## 5. Sign-off

- **Wave 117 objective**: Repair pre-existing v8 runtime integration failures from INT-R11 — **met**.
- **INT-R11 gate**: Full regression green — **passes**.
- **Code review**: Not required for a `/change` triage wave; changes are test-alignment and defensive schema hygiene only.
- **Recommendation**: Close Wave 117. Optionally open Wave 118 for host E2E / manual smoke backfill or release packaging.
