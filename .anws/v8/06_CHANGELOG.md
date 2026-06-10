# v8 Changelog

**Version**: `.anws/v8`
**Status**: Genesis complete / design pending
**Date**: 2026-06-01

---

## Intent

v8 upgrades Second Nature from a connector-driven evidence collector into a living perception loop.

The main architectural correction is:

```text
heartbeat -> evidence -> perception -> judgment -> action closure
  -> Quiet daily review -> Dream consolidation -> long-term memory projection
```

This explicitly preserves the v7 idea that long-term memory is formed by Quiet/Dream reviewing a whole day, while adding the missing near-real-time layer that lets every heartbeat act naturally and close its loop.

---

## Changes From v7

- Adds `concept_model.json` for v8 Living Perception Loop terminology.
- Reframes memory: realtime perception/judgment may create action closure records, but long-term memory must come from Quiet/Dream consolidation.
- Adds `ActionClosureRecord` as the required output of heartbeat actions.
- Adds platform-neutral autonomy policy: Nyx may decide whether to reply, publish, notify, ignore, draft, or run a connector, under shared policy gates.
- Adds causal loop health across ingestion, perception, judgment, action policy, execution, closure, Quiet review, Dream consolidation, and projection.
- Records the sensitivity-scan distinction between Dream redaction and storage write validation.

---

## Not Yet Done

- `04_SYSTEM_DESIGN/*` is not generated.
- `05A_TASKS.md` and `05B_VERIFICATION_PLAN.md` are not generated.
- v8 has not passed `/challenge` or `/blueprint`.

---

## Repair Backlog — 2026-06-04

- Added `T-OBS.R.1` to close an implementation-level observability gap discovered after v8 forge completion: manual connector runs, heartbeat connector runs, and source-backed Quiet outcomes were not consistently writing audit truth consumed by `heartbeat_digest`.
- Scope is a controlled repair within v8 assumptions: no new requirement, no ADR change, no external dependency, and no completed task checkbox backfill.
- Implemented `T-OBS.R.1`: connector/Quiet audit recorders, shared CLI/runtime audit store wiring, digest audit fallback aggregation, targeted tests, code review, and plugin runtime sync are complete.

## Repair Backlog — 2026-06-05

- Added a controlled runtime-activation repair backlog from user feedback that Second Nature can collect evidence but cannot yet reliably act, speak, hear impulse context, keep multiple rhythms, or converse with its own accumulated evidence in the real workspace runtime.
- Added `T-CP.R.2`, `T-GVS.R.1`, `T-CS.R.1`, `T-DQ.R.2`, `T-OBS.R.2`, and `INT-R1` to `05A_TASKS.md` and `05B_VERIFICATION_PLAN.md`.
- Added `reports/v8-runtime-activation-repair-research.md` as the feasibility research artifact for the repair ordering and constraints.
- Scope remains within v8 assumptions: no new REQ, no ADR change, no fake OpenClaw context-engine registration, no external platform write by default, and no completed checkbox backfill.
- Research findings captured in tasks: `guidance_payload` is currently passive ops output; v8 runtime has a contract-smoke path separate from the workspace heartbeat; MoltBook write methods exist but need policy proof and closure; Quiet/Dream cadence needs independent due/absence states; `loop_status` must distinguish real runtime activity from contract-only proof.

## T-CP.R.2 Complete — 2026-06-05

- **Implemented**: Real workspace heartbeat wired into v8 action-closure spine.
- **Files changed**:
  - `src/core/second-nature/control-plane/heartbeat-orchestrator.ts` — extended `runHeartbeatCycle` with full action-closure spine after judgment stage: `buildActionProposal` → `evaluateActionPolicy` (conservative defaults) → `dispatchAllowedAction` → closure recorder. Early-return paths (empty evidence, perception degraded) now write `recordNoActionClosure` before returning. All stage events use valid `sourceRefs` (cycleRef) to pass store validation.
  - `src/core/second-nature/control-plane/real-runtime-spine.ts` — thin bridge wrapping `runHeartbeatCycle` for CLI/OpenClaw consumption.
  - `src/cli/ops/heartbeat-surface.ts` — merged v8 spine result into `HeartbeatSurfaceResult` with `v8Spine` field and diagnostic reasons.
  - `src/cli/ops/ops-router.ts` — auto-enables `v8SpineEnabled` when `state` DB is wired.
- **Tests**: `tests/unit/control-plane/real-runtime-spine.test.ts` (4/4), `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts` (3/3), `tests/integration/v8/real-runtime-living-loop.test.ts` (2/2). All 9 PASS with `pnpm build` + `pnpm build:plugin`.
- **Code review**: split-brain fixed (early returns write closures); exactly-once enforced (idempotent closure IDs + safety net); degraded observability preserved (all paths emit stage events); no real external writes (conservative policy defaults); state-backed persistence verified (not contract smoke).

## Repair Backlog — 2026-06-09

- Added a controlled Wave 107 repair backlog after the current-system audit found proof-truth and memory-feedback gaps: INT-R1 proof artifacts are absent, real-run health is not operator-facing, PerceptionCard semantics drifted, projection supersession/feed-back is incomplete, and Quiet closure provenance is implicit.
- Added `reports/v8-current-system-mechanism-audit-2026-06-09.md` as the mechanism audit artifact and `reports/v8-wave107-proof-memory-change-spec.md` as the change spec.
- Added `T-VERIFY.R.1`, `T-OBS.R.3`, `T-PJ.R.1`, `T-DQ.R.3`, `T-DQ.R.4`, and `INT-R2` to `05A_TASKS.md` and `05B_VERIFICATION_PLAN.md`.
- Scope remains within v8 assumptions: no new REQ, no ADR change, no external platform write by default, no fake context-engine registration, and no completed checkbox backfill.
- Recommended implementation order: T-VERIFY.R.1 -> T-OBS.R.3 -> T-PJ.R.1 -> T-DQ.R.3 -> T-DQ.R.4 -> INT-R2.

## T-VERIFY.R.1 Complete — 2026-06-09

- **Implemented**: Wave 106 proof truth repair. INT-R1 now requires runtime-produced closure/no-action backed by `HeartbeatCycleTrace` + stage events. Manually seeded `ActionClosureRecord` is rejected as invalid proof.
- **Files changed**:
  - `src/observability/living-loop-health-gate.ts` — enhanced `checkRealRunHealth` to verify each closure's `cycleId` maps to a persisted cycle trace. Added `seededStateDetected` and `gatePassed` fields. `gatePassed` is `true` only when closure is runtime-proven and Quiet/Dream artifacts exist.
  - `tests/unit/observability/living-loop-health-gate.test.ts` — updated `seedClosure` helper to optionally write cycle trace; added `seededStateDetected` and `gatePassed` assertions; added new test for seeded-state detection.
  - `tests/integration/v8/int-r1-runtime-activation-repair.test.ts` — completely rewritten. Test 1 runs `runHeartbeatCycle` to produce real closure, then validates impulse context, policy-bound write dry-run, daily rhythm, health gate, and loop_status. Test 2 asserts seeded-only closure fails. Test 3 asserts empty state fails.
- **Artifacts generated**:
  - `reports/int-r1-v8-runtime-activation-repair.md` — verification report with test results, proof summary, and remaining gaps
  - `logs/int-r1-loop-status.json` — structured JSON evidence of health gate and loop status outcomes
  - `.anws/v8/wave-reviews/wave-106-review.md` — retrospective review documenting the proof-truth gap and its closure
- **Tests**: `living-loop-health-gate` 5/5 PASS; `int-r1-runtime-activation-repair` 3/3 PASS; `real-runtime-living-loop` 2/2 PASS. `pnpm typecheck` ✅, `pnpm build` ✅.

## T-OBS.R.3 Complete — 2026-06-10

- **Implemented**: Wired `checkRealRunHealth` into `loop_status` and `heartbeat_digest` so real-run gaps surface as explicit operator-facing degraded states.
- **Files changed**:
  - `src/observability/loop-status.ts` — `readLoopStatus` now calls `checkRealRunHealth` after `assembleLoopStatus`. Added `RealRunHealthProjection` to `LoopStatusReadModel`. When `gatePassed` is `false`, `overallStatus` is overridden to `degraded` (or kept as `stalled` if already stalled). When `gatePassed` is `true`, `overallStatus` is promoted to `healthy` and `stalledAt` cleared. `nextAction` includes real-run missing stage reason.
  - `src/observability/services/heartbeat-digest-assembler.ts` — added `realRunHealth` field to `HeartbeatDigest` and `RealRunHealthDigestProjection` type. Default value indicates unevaluated state.
  - `src/cli/ops/ops-router.ts` — `heartbeat_digest` command now calls `checkRealRunHealth(deps.state, date)` after digest assembly and embeds the result into `digest.realRunHealth`.
  - `tests/api/runtime-ops/loop-status-real-run-gate.test.ts` — 3 API-style tests: empty state degraded, heartbeat-without-rhythm degraded, full path healthy.
  - `tests/integration/runtime-ops/heartbeat-digest-real-run-gate.test.ts` — 3 integration tests: digest default, digest parity with real-run health after full path, digest surfaces seeded state.
- **Artifacts generated**:
  - `logs/int-r2-loop-status.json` — structured JSON evidence of loop_status/digest real-run parity
- **Tests**: `loop-status-real-run-gate` 3/3 PASS; `heartbeat-digest-real-run-gate` 3/3 PASS; `loop-status` 2/2 PASS; `causal-loop-health` 1/1 PASS; `living-loop-health-gate` 5/5 PASS; `heartbeat-digest-assembler` 16/16 PASS. `pnpm typecheck` ✅, `pnpm build` ✅.

## T-PJ.R.1 Complete — 2026-06-10

- **Implemented**: Canonicalized PerceptionCard novelty/relevance contract. Resolved design/code drift.
- **Files changed**:
  - `src/storage/db/schema/v8-entities.ts` — added `relevanceClass: text("relevance_class")` to `perception_card`.
  - `src/storage/db/index.ts` — updated `STATE_SCHEMA_SQL` bootstrap SQL.
  - `src/storage/db/migrations/v8-002-perception-contract-alignment.ts` — new migration adding `relevance_class` column.
  - `src/storage/db/migrations/index.ts` — registered v8-002 migration.
  - `src/core/second-nature/perception/perception-builder.ts` — `PerceptionCardResult` now uses `noveltyClass` (canonical enum), `relevanceScore` (numeric), and `relevanceClass` (derived). `inferNoveltyClass` returns `new|changed|duplicate|stale`. `inferRelevanceScore` + `inferRelevanceClass` produce canonical pair.
  - `tests/unit/perception/perception-contract-alignment.test.ts` — 4 tests covering canonical novelty, canonical relevance, round-trip persistence, and score-to-class mapping consistency.
- **Artifacts generated**:
  - `reports/perception-contract-alignment.md` — contract alignment report
- **Tests**: `perception-contract-alignment` 4/4 PASS; `perception-builder` 4/4 PASS; `judgment-engine` 3/3 PASS; `sensitivity-classifier` 13/13 PASS; `v8-state-stores` 13/13 PASS. `pnpm typecheck` ✅, `pnpm build` ✅.

## T-DQ.R.3 Complete — 2026-06-10

- **Implemented**: Fixed projection supersession (UPDATE instead of INSERT) and wired accepted memory projections into heartbeat context.
- **Files changed**:
  - `src/storage/v8-state-stores.ts` — added `updateLongTermMemoryProjectionStatus(id, status, payloadJson?)` for status transitions without PK conflict. Added `readLongTermMemoryProjectionById`.
  - `src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts` — `acceptMemoryProjection` now uses `updateLongTermMemoryProjectionStatus` to supersede old active projections instead of insert-only overwrite. Added `parsePayloadJson` helper.
  - `src/core/second-nature/control-plane/heartbeat-orchestrator.ts` — `runHeartbeatCycle` now calls `loadAcceptedProjections` before judgment and passes them to `runAgentJudgments`.
  - `src/core/second-nature/perception/judgment-engine.ts` — `RunAgentJudgmentOptions` accepts `acceptedProjections`. `runAgentJudgment` boosts verdict confidence and promotes `ignore` → `remember` when topic matches an accepted projection. Added `"projection_topic_matched"` to `V8ReasonCode`.
  - `src/shared/types/v8-contracts.ts` — added `"projection_topic_matched"` to `V8ReasonCode`.
  - `tests/integration/control-plane/accepted-projection-feedback.test.ts` — 3 integration tests: supersession without PK conflict, heartbeat loads projections, judgment boosts verdict for matching topic.
- **Tests**: `accepted-projection-feedback` 3/3 PASS; `memory-projection-lifecycle` 4/4 PASS; `accepted-projection-loader` 1/1 PASS; `heartbeat-orchestrator` 2/2 PASS; `real-runtime-living-loop` 2/2 PASS; `int-r1` 3/3 PASS. `pnpm typecheck` ✅, `pnpm build` ✅.

## T-DQ.R.4 Complete — 2026-06-10

- **Implemented**: Made `QuietDailyReview.closureRefs` first-class by adding explicit `closureRefsJson` schema field and builder support.
- **Files changed**:
  - `src/storage/db/schema/v8-entities.ts` — added `closureRefsJson: text("closure_refs_json")` to `quiet_daily_review`.
  - `src/storage/db/index.ts` — updated `STATE_SCHEMA_SQL` bootstrap SQL.
  - `src/storage/db/migrations/v8-003-quiet-closure-refs.ts` — new migration adding `closure_refs_json` column.
  - `src/storage/db/migrations/index.ts` — registered v8-003 migration.
  - `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts` — `QuietDailyReviewResult` now includes `closureRefs: SourceRef[]`. Builder maps each closure to a `closureRef` explicitly.
  - `src/storage/v8-state-stores.ts` — `writeQuietDailyReview` accepts optional `closureRefs` and serializes to `closureRefsJson`.
- **Tests**: `quiet-daily-review-builder` 2/2 PASS; `daily-rhythm-scheduler` 4/4 PASS; `int-r1` 3/3 PASS; `real-runtime-living-loop` 2/2 PASS. `pnpm typecheck` ✅, `pnpm build` ✅.

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
  - `perception-contract-alignment` 4/4 PASS
  - `accepted-projection-feedback` 3/3 PASS
  - `quiet-daily-review-builder` 2/2 PASS
  - `real-runtime-living-loop` 2/2 PASS
  - `pnpm typecheck` ✅, `pnpm build` ✅
- **Status**: Wave 107 complete. All proof-truth and memory-feedback gaps closed.
