# 07_CHALLENGE_REPORT — v6 Code Review Recheck

**Workflow**: `/challenge`  
**Review type**: CODE / static contract review  
**Date**: 2026-05-18  
**Scope**: re-check CR8 fixes against `.anws/v6` contracts, implementation, tests, and milestone reports.  

## Verdict

**Partial Pass**.

The previous Critical/High implementation defects are fixed in the current tree:

- `second_nature_ops` / plugin bridge now exposes the v6 ops command set.
- `status` now returns the v6 aggregate instead of hiding it behind `status:v6`.
- policy-accepted `agent_proposed` goals now influence priority.
- NarrativeTrace now reads `selectedIntent.goalInfluenceRefs`.
- `05A_TASKS.md` checkboxes for `T2.3.1`, `T5.1.2`, and `INT-S1` are closed.

No new Critical or High implementation issue was found in this recheck. Remaining findings are verification/report fidelity gaps: the code path is improved, but some acceptance evidence still points at stale command names or lacks direct assertions.

## Issue Overview

| ID | Severity | Status | Summary |
| --- | --- | --- | --- |
| CR8-01 | Critical | Resolved | Plugin bridge v6 ops commands are now in the workspace allowlist, host-safe router, and CLI parser. |
| CR8-02 | High | Resolved in code | `status` now calls `loadV6Status`; source/tests no longer expose `status:v6`, but INT-S4 report still has stale references. |
| CR8-03 | High | Resolved in code | `policy_allowlist` agent-proposed goals are included in priority; NarrativeTrace uses `selectedIntent.goalInfluenceRefs`. |
| CR8-04 | Medium | Resolved | `05A_TASKS.md` now marks `T2.3.1`, `T5.1.2`, and `INT-S1` complete. |
| CR9-01 | Medium | Resolved | INT-S4 report updated: `sn status:v6` → `sn status`. |
| CR9-02 | Medium | Resolved | Plugin bridge tests now directly exercise `narrative`, `goal`, `dream:recent`, `connector_status`, `cycle:recent` in full-runtime and carrier-only modes. |
| CR9-03 | Low | Resolved | NarrativeTrace test now asserts `goalInfluenceRefs` deep-equals the injected accepted goal id. |

---

## Resolved Findings

### CR8-01 — Plugin v6 ops surface no longer missing

**Status**: Resolved.

Evidence:

- `plugin/index.ts:198-204` adds `narrative`, `goal`, `dream:recent`, `connector_status`, `connector_test`, and `cycle:recent` to `WORKSPACE_BRIDGE_COMMANDS`.
- `plugin/index.ts:889-956` registers host-safe unavailable responses for those workspace-only commands.
- `plugin/index.ts:1147-1174` parses those commands for the plugin command interface.

This closes the original OpenClaw tool-surface implementation gap.

### CR8-02 — `status` command now maps to v6 aggregate

**Status**: Resolved in code.

Evidence:

- `src/cli/commands/index.ts:56-62` registers `name: "status"` and calls `readModels.loadV6Status(scope)`.
- `tests/integration/cli/t1-2-6-status-aggregate.test.ts:72` verifies `status returns full v6 aggregate`.
- `rg -F "status:v6" src tests plugin --glob "!plugin/runtime/**"` found no remaining implementation/test command.

Residual documentation issue is tracked separately as CR9-01.

### CR8-03 — Goal priority and trace propagation fixed

**Status**: Resolved in code.

Evidence:

- `src/core/second-nature/orchestrator/goal-priority.ts:56` admits `agent_proposed` goals when `acceptedBy === "policy_allowlist"`.
- `tests/unit/control-plane/t2-1-4-goal-priority.test.ts:147-160` covers policy-accepted `agent_proposed` inclusion.
- `src/core/second-nature/heartbeat/heartbeat-loop.ts:236` records `selectedIntent?.goalInfluenceRefs ?? []` into NarrativeTrace.

Residual trace assertion strength is tracked separately as CR9-03.

### CR8-04 — Task ledger mismatch fixed

**Status**: Resolved.

Evidence:

- `.anws/v6/05A_TASKS.md:312` marks `T2.3.1` complete.
- `.anws/v6/05A_TASKS.md:539` marks `T5.1.2` complete.
- `.anws/v6/05A_TASKS.md:722` marks `INT-S1` complete.

---

## Open Findings

### CR9-01 — INT-S4 report still claims obsolete `sn status:v6`

**Severity**: Medium  
**Layer**: L5 Verification Evidence / L7 Handoff  
**Evidence**:

- `reports/int-s4-v6-ops-host-readiness.md:16` lists ``sn status:v6`` as the T1.2.6 pass criterion.
- `reports/int-s4-v6-ops-host-readiness.md:34` repeats ``sn status:v6`` in the Given/When/Then table.
- Current implementation uses `status`: `src/cli/commands/index.ts:56-62`.

**Impact**:

The report now points reviewers/operators at a stale command name. If someone follows the milestone report literally, they will validate the wrong surface or hit an unknown command. This is not a runtime implementation failure anymore; it is an acceptance-evidence fidelity failure.

**Required fix**:

Update INT-S4 report references from `sn status:v6` to `sn status`, and keep the evidence mapped to `tests/integration/cli/t1-2-6-status-aggregate.test.ts`.

### CR9-02 — Plugin bridge v6 command reachability lacks direct tests

**Severity**: Medium  
**Layer**: L5 Verification Evidence / L6 Integration Surface  
**Evidence**:

- `.anws/v6/05B_VERIFICATION_PLAN.md:373-376` requires INT-S4 coverage for `narrative/dream/connector/goal/cycle/status commands`.
- `reports/int-s4-v6-ops-host-readiness.md:37` claims plugin bridge `second_nature_ops` JSON-first surface pass, but describes coverage for `explain/fallback/audit` reachability rather than the new v6 command set.
- Implementation is present at `plugin/index.ts:198-204`, `plugin/index.ts:889-956`, and `plugin/index.ts:1147-1174`, but the bridge test evidence does not directly exercise `second_nature_ops({ command: "narrative" })`, `goal`, `dream:recent`, `connector_status`, `connector_test`, or `cycle:recent`.

**Impact**:

The original CR8-01 implementation gap is fixed, but INT-S4 still cannot prove the v6 tool commands are routable through the actual plugin bridge interface. A later refactor could break the bridge command table while CLI tests stay green.

**Required fix**:

Add plugin bridge tests for at least:

- known workspace root routes `second_nature_ops` v6 read commands through `openWorkspaceOpsBridge`;
- unknown workspace root returns honest host-safe unavailable envelopes for workspace-only v6 commands;
- `status` returns the v6 aggregate through the bridge path.

### CR9-03 — NarrativeTrace goal refs test is too weak

**Severity**: Low  
**Layer**: L5 Verification Evidence  
**Evidence**:

- Implementation now records the selected intent refs at `src/core/second-nature/heartbeat/heartbeat-loop.ts:236`.
- `tests/integration/observability/heartbeat-narrative-trace.test.ts:66` only asserts `Array.isArray(trace.goalInfluenceRefs)`.

**Impact**:

The current code is correct by static inspection, but the regression test would still pass if `goalInfluenceRefs` silently became `[]` again. Given this was part of the previous High issue, the test should lock the actual value.

**Required fix**:

Create a heartbeat fixture where selected intent contains `goalInfluenceRefs: ["g1"]`, then assert `trace.goalInfluenceRefs` deep-equals `["g1"]`.

---

## Static Review Notes

- Tests were not executed during this recheck; this is a static code-review pass.
- Real OpenClaw host E2E is still outside this static review boundary.
- No destructive commands were run.

