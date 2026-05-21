# Wave 26 Delivery Index

## Tasks Closed

| Task | PRD/Design Ref | Impl Files | Test Files | Evidence |
| --- | --- | --- | --- | --- |
| **T2.1.4** | `04_SYSTEM_DESIGN/control-plane-system.md` §4.2, §5.1 | `src/core/second-nature/orchestrator/goal-priority.ts`, `src/core/second-nature/heartbeat/heartbeat-loop.ts` | `tests/unit/control-plane/t2-1-4-goal-priority.test.ts` | 7 tests pass |
| **T6.1.1** | `04_SYSTEM_DESIGN/behavioral-guidance-system.md` §source-backed outreach | `src/guidance/draft-narrative-outreach.ts`, `src/guidance/index.ts` | `tests/unit/guidance/t6-1-1-narrative-outreach.test.ts` | 5 tests pass |
| **T2.1.5** | `04_SYSTEM_DESIGN/control-plane-system.md` §5.1, §6.1 | `src/core/second-nature/orchestrator/narrative-update.ts`, `src/core/second-nature/heartbeat/heartbeat-loop.ts`, `src/cli/ops/workspace-heartbeat-runner.ts` | `tests/unit/control-plane/t2-1-5-narrative-update.test.ts` | 9 tests pass |

## Changes Summary

### New Files (4)

- `src/core/second-nature/orchestrator/goal-priority.ts` — `applyGoalPriority`, accepted goal keyword heuristic, priority boost
- `src/guidance/draft-narrative-outreach.ts` — `draftNarrativeOutreach`, grounding validation, tone classification, source-ref coverage
- `src/core/second-nature/orchestrator/narrative-update.ts` — `updateNarrativeAfterEffect`, source-backed revision or honest `awaiting_sources`
- `tests/unit/control-plane/t2-1-4-goal-priority.test.ts` — 7 tests
- `tests/unit/guidance/t6-1-1-narrative-outreach.test.ts` — 5 tests
- `tests/unit/control-plane/t2-1-5-narrative-update.test.ts` — 9 tests
- `wave-reviews/wave-26-delivery-index.md` — this index

### Modified Files (4)

- `src/core/second-nature/types.ts` — `CandidateIntent` extended with `goalInfluenceRefs`, `priorityReasons`
- `src/core/second-nature/heartbeat/heartbeat-loop.ts` — `HeartbeatDeps.narrativeStateStore`, `maybeUpdateNarrativeState` integration in all return branches
- `src/core/second-nature/orchestrator/intent-planner.ts` — all factories populate `goalInfluenceRefs: []`
- `src/cli/ops/workspace-heartbeat-runner.ts` — inject `narrativeStateStore` when `state` DB is wired; load accepted goals for T2.1.4

## Verification

- `pnpm run build` — clean
- Unit tests — 21/21 pass (T2.1.4: 7, T6.1.1: 5, T2.1.5: 9)
- No regression in existing test suites

## Outstanding Items

- `tests/integration/control-plane/t2-1-5-narrative-update.test.ts` — 05B 要求的集成/E2E 证据路径，待后续补充（需要真实 DB + heartbeat cycle fixture）
- `NarrativeTrace` 审计层（T5.1.2）待 T2.1.5 稳定后接入 observability-system
