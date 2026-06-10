# v8 Wave 107 Change Spec — Proof Truth and Memory Feedback Closure

**Date**: 2026-06-09  
**Workflow**: `/change`  
**Scope**: v8 controlled repair backlog; no PRD/ADR premise change.

---

## 1. Why This Change Exists

The current v8 implementation has the right high-level loop, but the latest audit shows several places where the system can still look alive without proving it is alive:

- INT-R1 is marked complete, but required proof artifacts are absent and the integration test seeds closure state instead of proving a real runtime heartbeat wrote it.
- The real-run health gate exists as a helper, but `loop_status` and digest surfaces do not consume it as an operator-facing truth gate.
- `PerceptionCard` semantics drifted between design and code.
- Long-term memory projection lifecycle has a supersession bug risk, and accepted memory is not clearly fed back into the next heartbeat context.
- Quiet review source closure references are implicit, making downstream self-dialogue weaker than the design promises.

This change adds Wave 107 as a proof-and-memory repair wave. It does not reopen v8 requirements. It narrows the next implementation step to the missing wiring and verification contracts.

---

## 2. Non-Goals

- No external platform write by default.
- No fake OpenClaw context-engine registration.
- No new PRD requirement or ADR decision.
- No unchecked rewrite of completed task history.
- No broad refactor of the heartbeat loop unless required by the listed contracts.

---

## 3. Task Plan

### T-VERIFY.R.1 — Repair Wave 106 Proof Truth

Make INT-R1 evidence honest. The gate must fail if it relies on manually seeded closure/projection state, and it must produce the missing report/log/review artifacts.

Required proof:

- `reports/int-r1-v8-runtime-activation-repair.md`
- `logs/int-r1-loop-status.json`
- `.anws/v8/wave-reviews/wave-106-review.md`
- A repaired integration test that proves runtime-produced closure/no-action output.

### T-OBS.R.3 — Wire Real-Run Health Into Operator Surfaces

Make `loop_status` and `heartbeat_digest` consume the real-run health gate instead of only the generic causal snapshot. Missing closure, stale impulse context, missing Quiet/Dream cadence, and missing projection feedback must surface as explicit next actions.

### T-PJ.R.1 — Canonicalize PerceptionCard Contract

Resolve novelty/relevance drift with a single canonical contract:

- `noveltyClass`: `new | changed | duplicate | stale`
- `relevanceScore`: number in `[0, 1]`
- `relevanceClass`: `low | medium | high`

Legacy fields may be read as compatibility input during migration, but new writes should use the canonical shape.

### T-DQ.R.3 — Fix Projection Lifecycle and Memory Feedback

Fix projection supersession with a real update/status-transition path instead of insert-only overwrite behavior. Then prove accepted active projections are loaded into the next heartbeat context.

### T-DQ.R.4 — Make Quiet ClosureRefs First-Class

Add explicit `closureRefs` to QuietDailyReview output/read models so daily review is not forced to reconstruct closure provenance from generic source refs and payload JSON.

### INT-R2 — Proof Truth and Memory Feedback Gate

Close Wave 107 only when the repaired INT-R1 proof, real-run health surfaces, perception contract, projection feedback, and Quiet closureRefs all pass together.

---

## 4. Verification Gates

The repair is not accepted unless these are true:

- `loop_status` reports non-healthy when runtime proof artifacts are missing.
- `heartbeat_digest` reflects the same real-run gate outcome as `loop_status`.
- Perception contract tests reject or normalize legacy drift instead of silently persisting ambiguous fields.
- Projection supersession updates the old active row and activates the new row without primary-key conflict.
- A heartbeat after accepted projection creation receives that memory through context assembly.
- QuietDailyReview contains explicit closure refs for the day slice it reviewed.
- INT-R2 report lists every required artifact and explains any skipped host/manual check.

---

## 5. Implementation Order

1. T-VERIFY.R.1
2. T-OBS.R.3
3. T-PJ.R.1
4. T-DQ.R.3
5. T-DQ.R.4
6. INT-R2

Reasoning: proof truth comes first because it prevents another false-green wave. Operator health then becomes the runtime alarm. Contract alignment and memory feedback follow because they change system semantics and need clear verification before the integration gate.
