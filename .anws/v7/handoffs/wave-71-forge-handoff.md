# Wave 71 Forge Handoff — v7 Living Loop Wiring

**Date**: 2026-05-25
**Workflow**: `/forge`
**Mode**: ordinary; user approval required before coding
**Target Dir**: `.anws/v7`
**Recommended Wave**: Wave 71

## Scope

Wave 71 should execute:

1. `T-V7C.C.1R` — Runtime Data Closure Release Hygiene
2. `T-V7C.C.2` — Evidence + Body Feedback Closure

Do not start `T-V7C.C.3` until `T-V7C.C.2` is complete. `T-V7C.C.3` depends on C2, and `T-V7C.C.4` depends on C3.

## Why This Wave Exists

Claw latest E2E shows a real breakthrough:

- `restore_snapshot`: `0 -> 1 row`
- `narrative_timeline`: `0 -> 1 row`
- `capability_probe_result`: `0 -> 1 row`
- `restore` restored `agent_goal` and `narrative_timeline`, wrote audit, and captured a fresh restore snapshot.

Remaining issues are no longer broad lifecycle emptiness. They are:

- `narrative:diff` reports a missing version as generic failure when timeline has only one row.
- `connector_test wet` may still show duplicate probe key in Claw if host is using stale runtime or a non-upsert path.
- heartbeat connector path writes life evidence on success but does not yet write ToolExperience.
- body feedback and CircuitBreaker are implemented as modules but not fully wired into heartbeat enforcement.

## Required Contract Anchors

- PRD: `.anws/v7/01_PRD.md`
  - REQ-003 / US-003: connector attempts write ToolExperience.
  - REQ-009: connector truth, actual capability state, and feedback.
  - REQ-011: NarrativeTimeline / RestoreSnapshot history semantics.
- Tasks:
  - `.anws/v7/05A_TASKS.md#T-V7C.C.1R`
  - `.anws/v7/05A_TASKS.md#T-V7C.C.2`
- Verification:
  - `.anws/v7/05B_VERIFICATION_PLAN.md#t-v7c-c-1r`
  - `.anws/v7/05B_VERIFICATION_PLAN.md#t-v7c-c-2`

## Expected Implementation Hotspots

- `src/cli/ops/ops-router.ts`
  - Map `NarrativeVersionNotFoundError` to structured missing-version error.
  - Keep `connector_test dryRun:false` routed through wet probe and upsert persistence.
- `src/storage/services/tool-experience-store.ts`
  - Preserve `ON CONFLICT(probe_result_id) DO UPDATE`.
- `src/core/second-nature/heartbeat/heartbeat-loop.ts`
  - After connector execution attempt, record ToolExperience for success and failures.
  - Preserve existing life evidence append for successful results.
  - Respect CircuitBreaker posture before repeating an open capability.
- `src/core/second-nature/body/tool-experience/experience-writer.ts`
  - Reuse existing writer instead of duplicating ToolExperience construction.
- `src/core/second-nature/body/probe-signal-adapter.ts`
  - Reuse existing probe/pain-signal semantics where possible.
- `src/core/second-nature/body/circuit-breaker/`
  - Reuse existing manager state transitions for open/half-open/closed.
- `src/cli/ops/manual-run-dispatcher.ts`
  - Keep manual run `triggerSource = "manual_run"` and isolated from heartbeat cadence.

## Acceptance Checklist

- `narrative:diff` missing version returns structured missing-version reason, not only generic `NARRATIVE_DIFF_FAILED`.
- repeated wet re-probe does not crash on `capability_probe_result.probe_result_id`.
- heartbeat connector success writes both `life_evidence_index` and ToolExperience with `triggerSource = "heartbeat"`.
- manual connector success/failure writes ToolExperience with `triggerSource = "manual_run"`.
- wet probe result is available as probe/body feedback or explicit unavailable reason, not as fake connector execution success.
- repeated connector failures open CircuitBreaker.
- open breaker prevents heartbeat from executing the same capability and returns structured reason.
- half-open success closes breaker; half-open failure remains open/cooldown.
- package/plugin/runtime version is coherent if runtime output is rebuilt.

## Verification Checklist

Run the smallest sufficient set first:

- `pnpm exec tsc --noEmit`
- `pnpm build`
- `node --test dist/tests/integration/runtime-ops/commands.test.js`
- `node --test dist/tests/unit/storage/tool-experience-store.test.js`
- `node --test dist/tests/integration/control-plane/v7c-evidence-body-feedback.test.js`

If plugin/runtime files are rebuilt:

- `pnpm build:plugin`
- `cd plugin && npm pack --dry-run`
- relevant plugin bridge/registration regression tests

## Non-Scope

- Do not implement Quiet -> Dream auto trigger here; that is `T-V7C.C.3`.
- Do not implement daily digest auto delivery here; that is `T-V7C.C.3`.
- Do not implement IdentityProfile / Goal hygiene here; that is `T-V7C.C.4`.
- Do not mark `T-V7C.C.2` complete unless all body feedback and breaker enforcement acceptance criteria pass.

## Wave-End Requirements

Before settlement:

- update `05A_TASKS.md` checkboxes only for tasks actually completed and verified.
- run code-reviewer and write `.anws/v7/wave-reviews/wave-71-review.md`.
- update `AGENTS.md` Wave 71 block.
- if package version changes, document the exact version and publish path.
