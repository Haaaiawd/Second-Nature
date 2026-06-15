# 06_CHANGELOG.md — v8 变更日志

> 版本: v8
> 最后更新: 2026-06-13

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

## v0.2.6 Patch Release — CLI State Flush + narrative:diff UX + Setup Parity — 2026-06-13

- **Change source**: E2E test report found `loop_status stages=0` after `heartbeat_check` in CLI bridge, `narrative:diff` returning `MISSING_VERSIONS` on empty timeline, and `setup_hint/setup_ack` missing from CLI surface.
- **Fixes**:
  - Added `StateDatabase.flush()` / `ObservabilityDatabase.flush()` for sql.js in-memory persistence without closing connection.
  - Auto-flush after all mutating CLI ops (`heartbeat_check`, `connector:run`, `policy set`, `goal`, `snapshot:capture`, `restore`, `setup_ack`, etc.) so cross-command reads see persisted state.
  - `narrative:diff` now auto-resolves the two most recent narrative timeline versions when `from`/`to` are omitted; returns `NARRATIVE_DIFF_REQUIRES_TWO_VERSIONS` with clear `nextStep` when fewer than two versions exist.
  - Added `setup_hint` / `setup_ack` commands to CLI surface, achieving parity with OpenClaw plugin onboarding.
- **Verification**:
  - `pnpm typecheck` / `pnpm build` / `pnpm build:plugin` pass.
  - New integration tests: CLI state flush regression, setup CLI parity, narrative:diff auto-resolve, narrative:diff empty-timeline friendly error.
  - Wave 108 targeted tests + v8 integration regression: all PASS.
- **Artifacts**: `.anws/v8/v8-e2e-verification-guide.md`, `.anws/v8/wave-reviews/wave-108-e2e.md`.

---

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

## Wave 109 — Content-Bearing Evidence and Memory Activation Repair — 2026-06-14

- **Change source**: Deep diagnostic report (2026-06-14) found SN heartbeat stable but producing ref-only evidence, v8 `evidence_item` table empty, Quiet artifacts filled with template text, Dream runs stuck at `scheduled/pending`, sensitivity scan killing UUIDs, and 83.8% duplicate sourceRef entries.
- **External reference**: MiMo Code Dream/Distill workflows (`https://zread.ai/XiaomiMiMo/MiMo-Code/11-dream-and-distill-workflows`, accessed 2026-06-14) informed Dream periodicity and raw-history-as-source-of-truth constraints.
- **Classification**: `/change` controlled extension inside v8; no PRD/ADR premise change. Design docs updated to reflect the new evidence envelope and Dream lifecycle invariants.
- **Tasks completed**:
  - `T-CS.R.4` — Added generic `NormalizedEvidenceContent` envelope and platform-agnostic extractor in `src/connectors/base/normalized-evidence-content.ts`.
  - `T-CS.R.5` — Real heartbeat now double-writes content-bearing v8 `EvidenceItem` (v7 `LifeEvidence` preserved); dedupe by `(platformId, capabilityId, externalId)` then `contentHash`; idempotent upsert refreshes `observedAt`/`seenCount`.
  - `T-PJ.R.2` — `perception-builder.ts` reads `payloadJson.summary/title/entities`, marks `contentMissing`, lowers confidence to 0.3 for missing content, advances `EvidenceItem.lifecycleStatus` to `perceived`.
  - `T-DQ.R.6` — `quiet-daily-review-builder.ts` loads daily `EvidenceItem`/`PerceptionCard` rows and produces readable sections (`headline`, `completed`, `deferred`, `failed`, `memory_candidates`, `notable_signals`).
  - `T-DQ.R.7` — `daily-rhythm-scheduler.ts` executes Dream immediately after scheduling, enforces 7-day minimum interval, repairs stale scheduled runs after 5 minutes, adds `dream_scheduled_stalled` reason code.
  - `T-OBS.R.5` — `write-validation-gate.ts` exempts UUIDs and identifier/URI fields; failures now report offending `field` + `pattern`.
  - `INT-R4` — Content-Bearing Living Loop Gate passed.
- **Additional fixes discovered during regression**:
  - `connector_status` CLI command was registered in ops-router but missing from `src/cli/commands/index.ts`; added so the v6 ops surface works through the plugin bridge.
  - Tests updated to expect immediate Dream `completed` status (T-DQ.R.7): `quiet-dream-runtime-chain.test.ts`, `heartbeat-rhythm-advance.test.ts`, `real-runtime-quiet-dream-advance.test.ts`.
  - `narrative:diff` test aligned with v0.2.6 auto-resolve behavior.
  - `v8-003-quiet-closure-refs` migration made a no-op because bootstrap schema already includes `closure_refs_json`.
- **Design doc updates**:
  - `04_SYSTEM_DESIGN/connector-system.md` — added `NormalizedEvidenceContent` envelope, dedupe rules, rawContentRef policy.
  - `04_SYSTEM_DESIGN/state-memory-system.md` — added UUID/sourceRef exemption and content-bearing payload guidance.
  - `04_SYSTEM_DESIGN/perception-judgment-system.md` — added content-bearing evidence consumption, duplicate/stale novelty, `contentMissing` flag.
  - `04_SYSTEM_DESIGN/dream-quiet-memory-system.md` — added `QuietReviewPayload`, Dream 7-day periodicity, stale scheduled repair.
  - `04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md` — updated constants, reason codes, lifecycle invariants, test fixtures.
- **Verification plan updated**: Added Wave 109 task entries, `INT-R4` integration gate, and contract coverage rows; all Wave 109 gates checked.
- **Test results**:
  - `INT-R4` 4/4 PASS
  - `runtime-recovery-closure` 9/9 PASS (Wave 108 regression)
  - Wave 109 targeted unit tests 24/24 PASS
  - `quiet-dream-runtime-chain` 4/4 PASS
  - `heartbeat-rhythm-advance` 2/2 PASS
  - `plugin-workspace-ops-bridge` (v6 ops) 17/17 PASS
  - `proof-memory-closure` 6/6 PASS
  - `real-runtime-quiet-dream-advance` 3/3 PASS
  - `commands.test.ts` narrative:diff 5/5 PASS
  - `pnpm typecheck` ✅; `pnpm build` ✅; `pnpm build:plugin` ✅
- **Artifacts**:
  - `reports/int-r4-v8-content-bearing-loop.md` — INT-R4 verification report.
  - `.anws/v8/wave-reviews/wave-109-review.md` — code review verdict Pass.
- **Guardrails**: No `[REQ-*]` binding changes, no ADR premise edits, no destructive v7 migration.

---
