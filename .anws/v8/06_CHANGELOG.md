# 06_CHANGELOG.md — v8 变更日志

> 版本: v8
> 最后更新: 2026-06-11

---

## v8 Genesis — 2026-05-30

- 初始化 v8 架构版本。
- 完成 `/design-system`、`/challenge` Round 1 + Round 2。
- 产出：PRD, Architecture, ADRs, System Designs, 05A_TASKS, 05B_VERIFICATION_PLAN。

## Wave 91-107 — v8 Living Perception Loop Implementation

详见 `.anws/v8/05A_TASKS.md` 逐波记录。

## INT-R2 Complete — Wave 107 Closure — 2026-06-10

- **Implemented**: INT-R2 Proof Truth and Memory Feedback Gate. All Wave 107 tasks verified together.
- **Artifacts generated**:
  - `tests/integration/v8/proof-memory-closure.test.ts` — 6 integration tests covering all Wave 107 fixes
  - `reports/int-r2-v8-proof-memory-closure.md` — INT-R2 verification report
- **Test Results**:
  - `proof-memory-closure` 6/6 PASS
  - `int-r1-runtime-activation-repair` 3/3 PASS
  - `loop-status-real-run-gate` 3/3 PASS
  - `heartbeat-digest-real-run-gate` 3/3 PASS
  - `perception-contract-drift` 4/4 PASS
  - `accepted-projection-feedback` 3/3 PASS
  - `quiet-daily-review-builder` 2/2 PASS
  - `real-runtime-living-loop` 2/2 PASS
  - `pnpm typecheck` ✅, `pnpm build` ✅
- **Status**: Wave 107 complete. All proof-truth and memory-feedback gaps closed.

## Post-Release Findings Fix — 2026-06-10

Following user review, 5 findings + 1 test evidence issue were identified and fixed:

### F1-High: Migration Self-Collision on Fresh DB
- **Fix**: Removed `relevance_class` and `closure_refs_json` from `STATE_SCHEMA_SQL` bootstrap schema in `src/storage/db/index.ts`
- **Rationale**: Migrations v8-002/v8-003 now exclusively own these columns; fresh DB runs bootstrap → migrations without duplicate column errors
- **Files**: `src/storage/db/index.ts`

### F2-High: Health Gate Missing Impulse Context + Projection Feedback
- **Fix**: Extended `RealRunHealthGate` with `hasFreshImpulseContext` and `hasProjectionFeedback`; `checkRealRunHealth` now checks impulse artifact freshness (≤24h) and accepted/active projections
- **Files**: `src/observability/living-loop-health-gate.ts`, `src/observability/loop-status.ts`, `src/observability/services/heartbeat-digest-assembler.ts`

### F3-High: Seeded-State Defense Bypassable
- **Fix**: `checkRealRunHealth` now requires: (a) closure's `cycleId` exists in `heartbeat_cycle_trace`, (b) matching `loop_stage_event(stage="closure", status="completed")`, (c) non-empty `sourceRefs`
- **Files**: `src/observability/living-loop-health-gate.ts`

### F4-Medium: PerceptionCard Store Layer Unprotected
- **Fix**: `writePerceptionCard` now validates canonical `noveltyClass`, `relevanceScore` [0,1], and `relevanceClass` before insert; returns `perception_contract_drift` degraded result on mismatch
- **Files**: `src/storage/v8-state-stores.ts`, `src/shared/types/v8-contracts.ts` (added reason code)

### F5-Medium: Projection Retire/Reject Insert-Only PK Conflict
- **Fix**: `rejectMemoryProjection` and `retireMemoryProjection` now use `updateLongTermMemoryProjectionStatus()` instead of `writeLongTermMemoryProjection()`
- **Files**: `src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts`

### F6: Heartbeat Digest Test Manually Injected Health
- **Fix**: `generateHeartbeatDigest` now auto-evaluates `checkRealRunHealth` when `deps.db` is provided; tests verify auto-injection instead of manual assignment
- **Files**: `src/observability/services/heartbeat-digest-assembler.ts`, `tests/integration/runtime-ops/heartbeat-digest-real-run-gate.test.ts`

### Test Updates
- Updated `living-loop-health-gate.test.ts`, `int-r1-runtime-activation-repair.test.ts`, `proof-memory-closure.test.ts`, `loop-status-real-run-gate.test.ts` to seed impulse context + projection where full gate pass is expected
- **Test Results**: 51/51 targeted tests PASS (0 fail); `pnpm typecheck` ✅; `pnpm build` ✅

## Wave 108 Completed — Runtime Recovery Closure — 2026-06-12

- **Change source**: User SN v0.2.0 diagnostic report identified real-run stall at Quiet, opaque connector failures, repeated connector replay, and over-aggregated `decision_denied` counters.
- **Classification**: `/change` controlled extension inside v8; no PRD/ADR premise change.
- **Tasks completed**:
  - `T-CP.R.3` — wire daily rhythm advancement into real heartbeat and ops runtime.
  - `T-DQ.R.5` — close Quiet/Dream runtime chain from daily rhythm state.
  - `T-CS.R.2` — restore connector failure truth for read availability.
  - `T-CS.R.3` — add connector terminal-failure cooldown to prevent infinite replay.
  - `T-OBS.R.4` — attribute heartbeat denial and connector replay root causes.
  - `INT-R3` — Runtime Recovery Closure Gate.
- **Verification plan updated**: Added task-by-task entries, contract coverage, testing coverage, and traceability rows for Wave 108; all Wave 108 gates checked.
- **Guardrails**: No `05A` checkbox backfill, no `[REQ-*]` binding changes, no PRD or ADR premise edits.
- **Code review**: `.anws/v8/wave-reviews/wave-108-review.md` — H-1 fixed during review, final verdict Pass.
- **Test Results**: 57/57 Wave 108 targeted tests PASS (0 fail); `pnpm typecheck` ✅; `pnpm build` ✅.
