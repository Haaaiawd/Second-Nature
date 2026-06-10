# v8 Current System Mechanism Audit - 2026-06-09

## Conclusion

**Result: Partial Pass / Medium-High risk.**

Wave 106 repaired the most important missing wire: the v8 heartbeat path now reaches action proposal, policy, dispatch envelope, and closure/no-action records. That is real progress.

But the project is not yet under full control. The remaining risk is not "missing code everywhere"; it is contract drift and false proof. Some new mechanisms exist as isolated modules, but the operator-facing health gates and milestone evidence do not prove the PRD-level living loop.

## Current Mechanism Map

| System | Current mechanism | Static status |
| --- | --- | --- |
| Plugin / runtime entry | OpenClaw plugin registers command/tool surfaces and explicitly does not pretend to be a context-engine. | Honest boundary; still tool-driven. |
| Heartbeat | `heartbeat_check` runs the legacy workspace heartbeat, then optionally runs v8 real runtime spine when state and workspace root exist. | Wired, but v7/v8 dual-path remains. |
| v8 control plane | `runHeartbeatCycle` writes cycle trace, perception, judgment, policy/execution/closure stage events, and closure/no-action. | Main spine exists. |
| Perception/Judgment | Evidence becomes `PerceptionCard`, then `JudgmentVerdict`. | Works, but PerceptionCard contract drifts from design. |
| Action/Policy/Closure | Proposal -> conservative policy -> dispatch envelope -> closure/no-action. | Safe by default; conservative hardcoded posture remains. |
| Impulse | `guidance_payload` reads/writes persisted impulse context artifact; heartbeat surface exposes pointer/result. | Better than passive API; not true automatic host context injection. |
| MoltBook write | Client supports publish/reply; policy-bound write dispatch gates dry-run/owner-confirm. | Safe shell exists; not fully integrated into real autonomous execution. |
| Quiet/Dream rhythm | Daily rhythm state runs/schedules Quiet/Dream independent of heartbeat intent. | Exists; closure refs are not first-class in schema. |
| Memory projection | Projection lifecycle and accepted projection loader exist. | Feedback into heartbeat context is not connected; supersession write is flawed. |
| Observability | `loop_status` reads causal-loop status; `living-loop-health-gate` detects real-run artifacts. | Split: real-run gate is not consumed by `loop_status`/digest. |

## Findings

### High 1 - INT-R1 is not a real runtime activation proof

**Evidence**: INT-R1 requires `reports/int-r1-v8-runtime-activation-repair.md` and `logs/int-r1-loop-status.json`, but those files are absent while the task is checked complete (`.anws/v8/05A_TASKS.md:805`, `.anws/v8/05A_TASKS.md:816`). The integration test imports `runHeartbeatCycle` but seeds `ActionClosureRecord` manually instead of invoking the heartbeat in the full repair chain (`tests/integration/v8/int-r1-runtime-activation-repair.test.ts:12`, `tests/integration/v8/int-r1-runtime-activation-repair.test.ts:18`, `tests/integration/v8/int-r1-runtime-activation-repair.test.ts:60`).

**Impact**: The milestone can pass while not proving "real workspace runtime activity" end to end. This is exactly the false-green pattern v8 repair was supposed to kill.

**Minimum fix**: Rewrite INT-R1 so the full chain uses `runHeartbeatCycle` or `heartbeat_check` to create the closure, then runs impulse context, policy-bound write dry-run, daily rhythm, `loop_status`, and `checkRealRunHealth`; generate the missing report/log.

### High 2 - Real-run health gate is not wired into operator health

**Evidence**: T-OBS.R.2 requires `loop_status` and `heartbeat_digest` to distinguish real-run activation and impulse freshness (`.anws/v8/05A_TASKS.md:221`, `.anws/v8/05A_TASKS.md:224`, `.anws/v8/05B_VERIFICATION_PLAN.md:336`, `.anws/v8/05B_VERIFICATION_PLAN.md:339`). Implementation exposes `checkRealRunHealth` as a separate read-only function (`src/observability/living-loop-health-gate.ts:53`), but `readLoopStatus` only calls `assembleLoopStatus` (`src/observability/loop-status.ts:90`, `src/observability/loop-status.ts:93`). The gate checks closure/Quiet/Dream only, not impulse context freshness (`src/observability/living-loop-health-gate.ts:53`, `src/observability/living-loop-health-gate.ts:78`).

**Impact**: Operators may still see causal-loop health without the repair gate's real-run truth. Missing impulse context is not part of the health result.

**Minimum fix**: Add real-run gate fields to `loop_status` and digest output: `contractSmokeOnly`, `missingRealRunStage`, `missingImpulseContext`, `quietDreamAbsenceReason`, and `nextAction`.

### High 3 - PerceptionCard contract drift is real

**Evidence**: Design defines `novelty: "new" | "changed" | "duplicate" | "stale"` and `relevance: "low" | "medium" | "high"` (`.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.md:170`, `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.md:171`). Detail doc repeats `NoveltyClass` and `RelevanceClass` enums (`.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.detail.md:44`, `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.detail.md:45`). Code emits `novelty: "new" | "recurring" | "update"` and numeric `relevance` (`src/core/second-nature/perception/perception-builder.ts:62`, `src/core/second-nature/perception/perception-builder.ts:63`); schema stores `relevance` as REAL (`src/storage/db/schema/v8-entities.ts:48`, `src/storage/db/schema/v8-entities.ts:49`).

**Impact**: Downstream judgment, tests, and docs are reasoning over different semantic domains. This is not cosmetic; it changes how "importance" can be calibrated.

**Minimum fix**: Decide one canonical contract. My recommendation: keep numeric `relevanceScore` plus derived `relevanceClass`, and update schema/docs/tests explicitly. Do not leave the same field with two meanings.

### High 4 - Memory projection lifecycle cannot reliably supersede

**Evidence**: Design requires duplicate fact/same-topic projection to supersede old projection (`.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md:284`, `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md:312`). Code tries to supersede by calling `writeLongTermMemoryProjection` with the existing projection id and `status: "superseded"` (`src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts:85`, `src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts:86`, `src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts:91`). But the store only does `insert(longTermMemoryProjection)` (`src/storage/v8-state-stores.ts:557`, `src/storage/v8-state-stores.ts:569`), so updating an existing primary key will fail.

**Impact**: Same-topic memory replacement can degrade instead of superseding. Long-term memory will either conflict or stop evolving.

**Minimum fix**: Add an explicit update/upsert port for projection status transitions, and test same-topic active -> superseded -> new active with a real state database.

### Medium 1 - Accepted projections are not fed back into heartbeat context

**Evidence**: Control-plane design requires accepted memory projection in the next EmbodiedContext (`.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md:19`), and Dream/Quiet design requires accepted projection loaded through state read model (`.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md:304`). `loadAcceptedProjections` exists (`src/core/second-nature/control-plane/accepted-projection-loader.ts:87`), but `runHeartbeatCycle` has no call to it (`src/core/second-nature/control-plane/heartbeat-orchestrator.ts:90`).

**Impact**: SN can form memory artifacts, but those memories do not shape the next perception/judgment cycle. That weakens the "和自己对话" / accumulated learning goal.

**Minimum fix**: Add a bounded memory slice to heartbeat context assembly and pass it to perception/judgment/action planning.

### Medium 2 - QuietDailyReview closure references are implicit, not first-class

**Evidence**: Design declares `closureRefs: string[]` / `SourceRef[]` as part of QuietDailyReview (`.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md:164`, `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md:89`). Schema only has `closure_count`, `memory_candidate_count`, `source_refs_json`, and `payload_json` (`src/storage/db/schema/v8-entities.ts:111`, `src/storage/db/schema/v8-entities.ts:115`, `src/storage/db/schema/v8-entities.ts:117`, `src/storage/db/schema/v8-entities.ts:119`). Builder maps closures into source refs and payload memory candidates (`src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:122`, `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:147`, `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:156`).

**Impact**: The data is mostly recoverable, but the contract is weaker than design. Auditing "which closures were reviewed" requires interpreting source refs/payload instead of reading a stable field.

**Minimum fix**: Add `closureRefsJson` or make `sourceRefsJson` explicitly defined as closureRefs in docs and tests.

### Medium 3 - Policy/action remains intentionally conservative, but it limits "hands/mouth"

**Evidence**: `heartbeat-orchestrator` evaluates policy with `platformPermissionDeclared: false`, `ownerPreferenceAllowAuto: false`, and `guidanceAvailable: false` (`src/core/second-nature/control-plane/heartbeat-orchestrator.ts:390`, `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:391`, `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:392`, `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:420`). MoltBook publish/reply methods exist (`src/connectors/social-community/moltbook/adapter.ts:58`, `src/connectors/social-community/moltbook/adapter.ts:59`), and write dispatch gates dry-run/owner-confirm (`src/connectors/base/policy-bound-write-dispatch.ts:93`, `src/connectors/base/policy-bound-write-dispatch.ts:139`, `src/connectors/base/policy-bound-write-dispatch.ts:153`).

**Impact**: This is safe, but not yet an expressive autonomous write path. It is acceptable for Wave 106, but not enough for the "我能碰/我能说" product feel.

**Minimum fix**: Next wave should inject real affordance, permission, owner preference, and guidance port into policy/dispatch, still defaulting to dry-run/owner-confirm.

### Low 1 - Migration registry and bootstrap schema are drifting

**Evidence**: `STATE_SCHEMA_SQL` creates `impulse_context_artifact` and `daily_rhythm_state` (`src/storage/db/index.ts:301`, `src/storage/db/index.ts:320`), but `v8-001-living-perception-loop` migration stops at the original 9 v8 tables and does not include those two tables (`src/storage/db/migrations/v8-001-living-perception-loop.ts:2`, `src/storage/db/migrations/index.ts:10`).

**Impact**: Current `createStateDatabase` bootstraps both tables, so normal runtime may work. But migration artifacts are no longer a complete schema history.

**Minimum fix**: Add a new migration version for Wave 106 tables or update migration policy to say v8 tables are bootstrap-only. I prefer a new migration.

### Low 2 - Wave 106 review artifact is missing

**Evidence**: AGENTS says code-reviewer was executed for Wave 106 (`AGENTS.md:218`), but `.anws/v8/wave-reviews/` contains only `wave-105-review.md`.

**Impact**: Handoff is weaker than stated; future audits cannot reconstruct the review basis.

**Minimum fix**: Add `.anws/v8/wave-reviews/wave-106-review.md` or mark it waived with reason.

## What Feels Missing For The PRD Vision

1. **A single truth-bearing runtime health surface**: `loop_status` should be the place that tells the owner whether SN is alive, stalled, or only contract-smoke healthy.
2. **Memory feedback into action**: accepted projections must affect later perception/judgment. Otherwise the system remembers on paper but does not change its behavior.
3. **First-class self-dialogue products**: Quiet/Dream should not just schedule; it should produce operator-visible "what changed in me today" summaries.
4. **Policy-backed expressive action**: MoltBook write exists safely, but the live heartbeat still cannot decide with real permissions/preferences/guidance. It has hands in a glove box.
5. **Release reproducibility**: tag `v0.2.3` is clean, but plugin/runtime build outputs are modified after the tag. Either commit build artifacts or keep them out of release truth.

## Recommended Next Repair Wave

1. **T-VERIFY.R.1 - Repair Wave 106 proof truth**: regenerate INT-R1 as real heartbeat-driven proof, write report/log, add wave review.
2. **T-OBS.R.3 - Wire real-run health into `loop_status`/digest**: no more separate unconsumed health gate.
3. **T-PJ.R.1 - Canonicalize PerceptionCard semantics**: split `relevanceScore` from `relevanceClass`, align novelty enum.
4. **T-DQ.R.3 - Fix projection lifecycle and memory feedback**: update/upsert projection status, then load accepted projection into heartbeat context.
5. **T-DQ.R.4 - Make Quiet review closure refs first-class**: schema/read model/docs/tests alignment.

