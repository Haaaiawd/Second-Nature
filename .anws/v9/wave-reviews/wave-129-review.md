# Wave 129 Code Review — 2026-06-27

## 1. Summary verdict

**Partial Pass**

Wave 129 delivers the v9 attention-to-closure heartbeat spine and the v9 closure recorder with the promised linkage columns. The exactly-one closure invariant is implemented, `AttentionSignal` is not treated as the action author, and routine/activity identifiers are persisted to the `action_closure_record` schema columns. No Critical or High issues were found. The verdict is Partial Pass because three Medium contract/observability gaps remain: the orchestrator does not feed evidence items into the `AttentionPort`, the default `ActionClosurePort` intentionally ignores the real affordance map, and the canonical `ActionClosureRecord` read-model type does not surface `routineInvocationId`/`routineVersion` even though they are stored.

## 2. Review scope and static boundary

**Files read (static only, no execution)**:

- Implementation
  - `src/core/second-nature/action/v9-action-closure-recorder.ts`
  - `src/core/second-nature/control-plane/v9-heartbeat-orchestrator.ts`
  - `src/shared/types/v9-contracts.ts` (reason-code additions only)
  - `src/storage/db/schema/v8-entities.ts` (to verify closure schema columns)
- Tests
  - `tests/unit/action/v9-action-closure-recorder.test.ts`
  - `tests/unit/control-plane/v9-attention-cycle.test.ts`
  - `tests/integration/v9/attention-to-closure-chain.test.ts`
  - `tests/integration/v9/exactly-one-closure.test.ts`
- Design / task / ADR
  - `.anws/v9/01_PRD.md` §3 (REQ-003, REQ-004, REQ-007, US-003, US-004)
  - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md` and `.detail.md`
  - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.md` and `.detail.md`
  - `.anws/v9/03_ADR/ADR_002_ATTENTION_NOT_AGENT_MIND.md`
  - `.anws/v9/03_ADR/ADR_005_PROCEDURAL_MEMORY_AS_VERIFIED_ROUTINE.md`
  - `.anws/v9/05A_TASKS.md` (T2.2.2, T4.2.3)
  - `.anws/v9/05B_VERIFICATION_PLAN.md` (T2.2.2, T4.2.3)

**Not read / not verified statically**:

- Runtime execution of tests or services.
- `v9-action-proposal-builder.ts` and `v9-autonomy-policy-evaluator.ts` beyond their signatures and the default port call sites in the orchestrator.
- Full `v9-embodied-context-assembler.ts` / `activity-thread-coordinator.ts` internals beyond the call sites and port shapes used by the orchestrator.
- Plugin/CLI wiring for `heartbeat_check` (T1.2.1 is out of scope for this wave).

## 3. Contract → code mapping summary

| Design promise | Anchor | Implementation location |
| -------------- | ------ | ----------------------- |
| `AttentionSignal` is a hint, not the final action author | ADR-002; `control-context-system.md` §8.1 | `v9-heartbeat-orchestrator.ts:614-620` resolves `AgentActionIntent` from attention/activity/context; attention alone records no-action closure at `:622-657` |
| Heartbeat main path consumes `AttentionSignal`, not `JudgmentVerdict` | `control-context-system.detail.md` §3.1; `05A_TASKS.md` T2.2.2 | `v9-heartbeat-orchestrator.ts:477-514` builds attention and branches on `attention.status` |
| Missing source refs block attention from write-side action | `action-closure-policy-system.detail.md` §4.1; PRD US-003 | `:516-548` records no-action closure with reason `attention_blocked_missing_sources` and does not call proposal builder |
| Exactly-one terminal closure per cycle | `action-closure-policy-system.md` G2; `05A_TASKS.md` T4.2.3 | `v9-action-closure-recorder.ts:170-177` checks existing closures before insert; `:766-782` final safety net |
| `routineInvocationId`/`routineVersion` persisted | `action-closure-policy-system.detail.md` §2.3/§3.5; ADR-005 | `v9-action-closure-recorder.ts:197` writes `routineId`; `:732-733` passes routine id/version from intent; `v8-entities.ts:116-118` defines the columns |
| `activityThreadId`/`activityStepId` persisted | `control-context-system.detail.md` §3.1/§3.9; `05A_TASKS.md` T4.2.3 | `v9-action-closure-recorder.ts:198-199` writes the columns; `:729-731` passes them from activity |
| Routine invocation must pass policy, not bypass it | ADR-005; `action-closure-policy-system.md` §1.3 | `v9-heartbeat-orchestrator.ts:670` dispatches intent through `actionClosurePort.evaluateAndDispatch`; routine linkage is carried but policy outcome is still recorded |

## 4. Lens results summary

| Lens | Verdict | Evidence |
| ---- | ------- | -------- |
| L1 Contract Fidelity | Mostly faithful; 3 Medium drifts noted below | `:480` empty `evidenceItems`; `:342-355` hardcoded posture; `v9-contracts.ts:508-523` missing routine fields on read model |
| L2 Task Fulfillment | T2.2.2 and T4.2.3 outputs match `05A_TASKS.md`; tests exist for all claimed paths | `tests/unit/control-plane/v9-attention-cycle.test.ts`; `tests/integration/v9/attention-to-closure-chain.test.ts`; `tests/integration/v9/exactly-one-closure.test.ts`; `tests/unit/action/v9-action-closure-recorder.test.ts` |
| L3 Architecture Fit | Clean port injection; orchestrator owns sequencing, not semantics; closure recorder is append-only | `v9-heartbeat-orchestrator.ts:118-125` deps interface; `v9-action-closure-recorder.ts:156-209` write path |
| L4 Static Runtime Risk / Security | No credential leakage in closure paths; source-ref gate present; conservative default policy | `v9-action-closure-recorder.ts:162-168` source-ref gate; `:179-200` payload never includes raw credential from intent |
| L5 Verification Evidence | Coverage is sufficient for the wave's scope; one weak assertion noted | `:182-217` unit test for routine linkage asserts closure count but not routine id/version in row |
| L6 Backflow / Handoff | Design authority comments and test coverage are present; task checkboxes in `05A_TASKS.md` already marked for T2.2.2/T4.2.3 per AGENTS.md | File headers cite ADR-002/ADR-005 and design docs; no README/CLI changes required within this wave's scope |

## 5. Issues

### Medium

**M-1 | L1 | Contract Drift: orchestrator passes empty `evidenceItems` to `AttentionPort`**

- **Evidence**: `v9-heartbeat-orchestrator.ts:480` passes `evidenceItems: []` to `deps.attentionPort.buildAttentionSignal`.
- **Impact**: The `AttentionInput` contract in `control-context-system.detail.md` §2 includes `evidenceItems: EvidenceItem[]`. A real `AttentionPort` implementation that expects populated evidence will be unable to ground the signal in actual evidence, weakening the attention-to-evidence traceability required by PRD US-002/US-003.
- **Minimum fix**: Populate `evidenceItems` from the latest evidence snapshot (e.g., via a read port or from `context` if the assembler is extended to carry recent evidence refs), or change the `AttentionPort` contract to make evidence loading the port's responsibility and document the empty-array convention.
- **Anchor**: `control-context-system.detail.md` §2 `AttentionInput`; PRD US-002/US-003.

**M-2 | L1+L3 | Temporary Scaffolding: default `ActionClosurePort` ignores real affordance posture**

- **Evidence**: `v9-heartbeat-orchestrator.ts:341-355` constructs a hardcoded conservative posture (`accessLevel: "none"`, `platformPermissionDeclared: false`, `ownerPreference: false`) and the comment explicitly says "For Wave 129 we do not yet have a real affordance map". `inferAffordancePosture` at `:289-311` is dead code in the default path.
- **Impact**: Any `external_write` or `capability_declared` intent will be denied/downgraded regardless of the true affordance state. This is safe but not truthful; it blocks legitimate auto-allowed actions until a later wave wires the real map.
- **Minimum fix**: Document this as a residual in `05A_TASKS.md`/wave notes and ensure the next affordance-integration wave removes the hardcoded posture.
- **Anchor**: `action-closure-policy-system.detail.md` §1.1/§4.2 policy table; ADR-005.

**M-3 | L1+L2 | `ActionClosureRecord` read-model type omits `routineInvocationId`/`routineVersion`**

- **Evidence**: `src/shared/types/v9-contracts.ts:508-523` defines `ActionClosureRecord` without `routineInvocationId` or `routineVersion`. `v9-action-closure-recorder.ts:106-123` `mapRowToV9Closure` does not extract the `routineId` column or the routine fields from `payloadJson`.
- **Impact**: Downstream observability/ledger consumers must parse `payloadJson` to recover routine linkage, undermining the canonical read model and the `05A_TASKS.md` T4.2.3 acceptance criterion that closure records routine execution trace.
- **Minimum fix**: Add `routineInvocationId?: string` and `routineVersion?: string` to `ActionClosureRecord` and populate them in `mapRowToV9Closure` from the `routineId` column / `payloadJson`.
- **Anchor**: `action-closure-policy-system.detail.md` §2.2/§3.5; `05A_TASKS.md` T4.2.3.

### Low

**L-1 | L4 | Race window in exactly-one closure invariant**

- **Evidence**: `v9-action-closure-recorder.ts:171-177` reads closures, then inserts if none; no transaction wraps the read+write.
- **Impact**: Two concurrent `recordV9ActionClosure` calls for the same `cycleId` could both observe zero rows and both insert. Risk is low in a single Node.js event loop but non-zero if multiple workers/hosts share a DB.
- **Minimum fix**: Use a SQLite unique constraint on `(cycle_id)` or wrap read+insert in a transaction with `BEGIN IMMEDIATE`.
- **Anchor**: `action-closure-policy-system.detail.md` §3.4; `05B_VERIFICATION_PLAN.md` T4.2.3.

**L-2 | L5 | Weak assertion in routine-linkage unit test**

- **Evidence**: `tests/unit/control-plane/v9-attention-cycle.test.ts:182-217` verifies a routine intent produces exactly one closure but never asserts the closure carries `routineId`/`routineVersion` or `activityThreadId`/`activityStepId`.
- **Impact**: The test would pass even if routine linkage were dropped in a future refactor.
- **Minimum fix**: Add assertions on the raw `action_closure_record` row (as done in `v9-action-closure-recorder.test.ts:127-149`) or on the read model after M-3 is fixed.
- **Anchor**: `05B_VERIFICATION_PLAN.md` T4.2.3.

**L-3 | L2+L5 | Some degraded paths omit a `closure` stage event**

- **Evidence**: `v9-heartbeat-orchestrator.ts:433-442` (context assembly failure) and `:528-537` (attention blocked) record `continuity`/`attention` stage events but do not record a `closure` stage event. Only the "no intent" path at `:636-645` records one.
- **Impact**: Observability consumers counting `closure` stage events may under-report terminal closures in degraded paths.
- **Minimum fix**: Record a `closure` stage event in every path that writes a terminal closure.
- **Anchor**: `control-context-system.detail.md` §3.8 `ensureTerminalClosure`; `05B_VERIFICATION_PLAN.md` T2.2.2.

**L-4 | L1 | `mapRowToV9Closure` loses decision nuance and cycle sequence**

- **Evidence**: `v9-action-closure-recorder.ts:109` hardcodes `cycleSequence: 0`; `:112` maps any non-`policy_allowed` reason to `decision: "deny"`, losing `defer`/`downgrade`.
- **Impact**: The read model is a lossy projection of the persisted row. Consumers that need accurate decision or sequence must re-derive from the DB.
- **Minimum fix**: Store `cycleSequence` in the row or resolve it from the cycle trace on read; parse `status`/`reason` to recover `defer`/`downgrade`.
- **Anchor**: `v9-contracts.ts:508-523`; `action-closure-policy-system.detail.md` §2.2.

**L-5 | L4 | `recordV9PolicyOutcomeClosure` closure id uses `Date.now()`**

- **Evidence**: `v9-action-closure-recorder.ts:272` builds `closureId` with `Date.now()`.
- **Impact**: Two calls within the same millisecond could collide, but the exactly-one read-before-write prevents a second write for the same cycle.
- **Minimum fix**: Use a deterministic id (e.g., `cls_v9_${actionKind}_${cycleId}`) or include a random suffix.
- **Anchor**: `v9-action-closure-recorder.ts:156-209`.

## 6. Security / test coverage supplement

**Security**:

- No raw credential or private content is written to `action_closure_record`. The only payload fields written are `downgradedActionKind`, `routineInvocationId`, and `routineVersion` (`v9-heartbeat-orchestrator.ts:722-726`), none of which carry secrets.
- The source-ref gate at `v9-action-closure-recorder.ts:162-168` blocks closure writes with empty `sourceRefs`, satisfying the source-grounding requirement for non-`none` side-effect classes.
- The default `ActionClosurePort` is conservative (`accessLevel: "none"`, all permissions false), so no unintended external write can slip through in Wave 129.

**Test coverage**:

- `v9-action-closure-recorder.test.ts` covers: routine linkage, exactly-one invariant, no-action closure, missing-source blocking, activity/thread/routine id persistence, and v9 source-ref serialization. Good coverage for T4.2.3.
- `v9-attention-cycle.test.ts` covers: runtime unavailable, attention blocked, no intent, agent intent, routine linkage, and degraded context assembly. Good coverage for T2.2.2.
- `attention-to-closure-chain.test.ts` covers the full happy path and blocked-attention path with a real `ActivityThreadPort`.
- `exactly-one-closure.test.ts` covers denied policy, blocked attention, and sequential idempotency. It does **not** cover concurrent closure attempts (the race noted in L-1).
- No Critical or High security gaps were identified.

## 7. Re-review — 2026-06-27

### 7.1 Fix verification summary

| ID | Status | Evidence |
| -- | ------ | ---------- |
| **M-1** | Resolved | `v9-heartbeat-orchestrator.ts:99-103` introduces optional `EvidenceReadPort`; `:472-480` loads recent evidence when the port is present and `:493-498` passes `evidenceItems` to `AttentionPort`. |
| **M-2** | Resolved | Default `ActionClosurePort` now receives `EmbodiedContext` and calls `inferAffordancePosture(context, intent)` (`:328-355`); the previously hardcoded posture is gone. |
| **M-3** | Resolved | `ActionClosureRecord` now exposes `routineInvocationId`, `routineVersion`, `activityThreadId`, `activityStepId` (`src/shared/types/v9-contracts.ts:522-525`); `mapRowToV9Closure` populates them from the `routineId` column / payload and activity columns (`v9-action-closure-recorder.ts:113-135`). |
| **L-1** | Unchanged | Exactly-one closure still reads then inserts without a transaction or unique constraint (`v9-action-closure-recorder.ts:194-200`); risk remains Low. |
| **L-2** | Resolved | `tests/unit/control-plane/v9-attention-cycle.test.ts:217-218` now asserts `closure.routineInvocationId` and `closure.routineVersion`. |
| **L-3** | Partially resolved | Closure stage events added in context-assembly failure path (`v9-heartbeat-orchestrator.ts:437-446`) and attention-degraded path (`:517-526`). The `attention_blocked_missing_sources` path (`:542-573`) still omits a `closure` stage event. |
| **L-4** | Resolved | `mapRowToV9Closure` now infers `decision` from `reason` via `inferDecisionFromReason` (`v9-action-closure-recorder.ts:106-111`) and reads `cycleSequence` from payload (`:117`). |
| **L-5** | Resolved | `recordV9PolicyOutcomeClosure` uses deterministic `cls_v9_${actionKind}_${cycleId}` (`v9-action-closure-recorder.ts:299`). |

### 7.2 Updated verdict

**Partial Pass**

All three Medium issues (M-1, M-2, M-3) are resolved. No new Critical or High issues were introduced. Two Low issues remain: the unchanged race window (L-1) and the residual missing `closure` stage event on the `attention_blocked_missing_sources` path (L-3).

### 7.3 Remaining issues

**L-1 | L4 | Race window in exactly-one closure invariant**

- **Evidence**: `v9-action-closure-recorder.ts:194-200` reads closures, then inserts if none; no transaction or unique constraint protects the read+write gap.
- **Impact**: Concurrent closure writes for the same `cycleId` could both observe zero rows and both insert.
- **Minimum fix**: Add a SQLite unique constraint on `(cycle_id)` or wrap the read+insert in `BEGIN IMMEDIATE`.
- **Anchor**: `action-closure-policy-system.detail.md` §3.4; `05B_VERIFICATION_PLAN.md` T4.2.3.

**L-3 residual | L2+L5 | `attention_blocked_missing_sources` path omits `closure` stage event**

- **Evidence**: `v9-heartbeat-orchestrator.ts:542-573` records a `no_action` closure but does not emit a `closure` stage event (compare `:437-446` and `:517-526`).
- **Impact**: Observability consumers counting `closure` stage events under-report terminal closures when attention is blocked for missing sources.
- **Minimum fix**: Add `recordV9LoopStageEvent({ stage: "closure", ... })` in the `attention_blocked_missing_sources` return path, mirroring the attention-degraded path.
- **Anchor**: `control-context-system.detail.md` §3.8 `ensureTerminalClosure`; `05B_VERIFICATION_PLAN.md` T2.2.2.

## 8. Final re-review — 2026-06-27

### 8.1 Fix verification summary

| ID | Status | Evidence |
| -- | ------ | ---------- |
| **L-3** | Resolved | `v9-heartbeat-orchestrator.ts:553-563` now emits a `closure` stage event immediately after the `attention` stage event in the `attention_blocked_missing_sources` path. |
| **L-1** | Accepted residual | Schema-level unique constraint on `action_closure_record(cycle_id)` was attempted but reverted because `action_closure_record` is shared with v8, which legitimately writes multiple closures per `cycleId` (e.g., `tests/api/runtime-ops/loop-status-denial-attribution.test.ts`). A v9-only transaction wrapper was considered but abandoned due to sql.js/better-sqlite3 sync-driver complexity vs. the Low severity of the race. The exactly-one invariant remains enforced by the read-before-write gate at `v9-action-closure-recorder.ts:194-200`, which is sufficient for the single-event-loop, sequential-cycle architecture. |

### 8.2 Final verdict

**Partial Pass**

All Medium issues (M-1, M-2, M-3) and Low issue L-3 are resolved. Low issue L-1 (race window in exactly-one closure invariant) is accepted as a residual risk with documented rationale. No Critical or High issues remain.

### 8.3 Verification evidence

- `pnpm typecheck` ✅
- `pnpm build` ✅
- `pnpm build:plugin` ✅
- `pnpm test` — 1920 tests, 1911 pass, 0 fail, 9 skipped

