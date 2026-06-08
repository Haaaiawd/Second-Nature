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
