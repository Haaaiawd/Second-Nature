# control-plane-system Research

| Field | Value |
| --- | --- |
| System ID | `control-plane-system` |
| Target Version | `.anws/v7` |
| Output Path | `.anws/v7/04_SYSTEM_DESIGN/_research/control-plane-system-research.md` |
| Date | 2026-05-21 |
| Method | Repository-only `/explore`; no external web lookup used |

## 1. Problem & Scope

### Core Question

How should v7 `control-plane-system` assemble bounded embodied context, govern goals and idle curiosity, and orchestrate downstream intents without taking ownership of state persistence, connector execution, Dream/Quiet internals, guidance delivery, or observability storage?

### Subquestions

| Subquestion | Direction | Expected Output |
| --- | --- | --- |
| SQ1. What is the v7 contract for heartbeat and `EmbodiedContext`? | Outward to repository facts | Required context slices, limits, degraded behavior, source anchors |
| SQ2. What boundary changes from v6 control-plane? | Mixed | Reused components, removed assumptions, new v7 gaps |
| SQ3. How should `GoalLifecyclePolicy` and `IdleCuriosityPolicy` be bounded? | Mixed | Policy responsibilities and non-responsibilities |
| SQ4. How should downstream orchestration be modeled? | Mixed | Intent request contracts for connector, Quiet/Dream, guidance, delivery feedback |
| SQ5. What verification should `/blueprint` inherit? | Inward synthesis | Contract Verification Matrix candidates |

### Scope Boundaries

- Included: heartbeat entry, context assembly, policy evaluation, candidate intent planning, guard evaluation, downstream request emission, decision trace payload shape.
- Excluded: canonical state writes, connector adapter execution, credential handling, guidance copy generation, delivery proof storage, Dream pipeline internals, digest publishing, restore implementation.
- Source hierarchy: v7 PRD and Architecture first, v7 ADRs second, concept model third, v6 designs and current TypeScript code as implementation evidence.

## 2. Core Insights

1. `control-plane-system` must become a context and policy orchestrator, not a larger executor; v7 Architecture explicitly says it is not a state writer or platform executor.
2. `EmbodiedContextAssembler` is the critical new seam: it must load identity, recent interaction, accepted goals, accepted Dream projection, ToolExperience, ToolAffordance/CircuitBreaker, SelfHealth, and life evidence under hard limits.
3. Goal lifecycle belongs to state-memory as durable truth, but control-plane owns the runtime policy that treats expired/completed/replaced goals as non-active and emits transition requests with reasons.
4. Idle curiosity is not "no goal fallback polling"; it is a bounded policy that may select at most one healthy read-only capability and must explain `idle_policy_no_eligible_connector` when blocked.
5. Downstream orchestration must emit typed requests and record decisions; connector execution, Quiet/Dream writing, guidance drafting, delivery proof, and relationship mutation stay outside control-plane.

## 3. Detailed Findings

### SQ1. v7 Heartbeat and EmbodiedContext Contract

v7 PRD makes heartbeat context a P0 requirement: each heartbeat must read bounded `EmbodiedContext` with IdentityProfile, accepted goals, recent interactions, Quiet/Dream projection, ToolExperience, SelfHealthSnapshot, and life evidence. It also fixes hard limits: at most 20 source refs, 10 recent interaction summaries, and 10 ToolExperience summaries in the heartbeat context.

Evidence:
- `.anws/v7/01_PRD.md:42` defines bounded `EmbodiedContext` as a top-level goal.
- `.anws/v7/01_PRD.md:77` requires context to include IdentityProfile, recent interactions, accepted Dream projection, ToolExperience, and SelfHealthSnapshot.
- `.anws/v7/01_PRD.md:80` sets the source ref, recent interaction, and ToolExperience bounds.
- `.anws/v7/01_PRD.md:287` sets heartbeat P95 < 2s and context assembly P95 < 400ms.
- `.anws/v7/03_ADR/ADR_002_EMBODIED_AGENT_LOOP.md:33` states that the system provides context, affordance, guards, and feedback without replacing the agent mind.

Implication: the assembler must return loaded/degraded status per slice and preserve source refs. A missing slice cannot fail the cycle unless it removes a safety precondition.

### SQ2. v6 Control-Plane Baseline and Gaps

v6 already has a rhythm path that loads snapshot inputs, builds a runtime snapshot, plans candidates, applies accepted goal priority, evaluates hard guards, resolves allowed effects, and records traces. This should be extended, not replaced.

Evidence:
- `.anws/v6/04_SYSTEM_DESIGN/control-plane-system.md` defines the v6 chain as snapshot -> scope -> rhythm/goal priority -> candidate -> guard -> effect/fallback -> trace.
- `src/core/second-nature/heartbeat/run-heartbeat-cycle.ts:20` gates unavailable runtime and routes user task/user reply away from the rhythm planner.
- `src/core/second-nature/heartbeat/heartbeat-loop.ts:325` passes accepted goals, registry, narrative, and relationship into `planCandidateIntents`.
- `src/core/second-nature/orchestrator/intent-planner.ts:270` builds candidates from rhythm window, goals, evidence, narrative, relationship, and optional registry.
- `src/core/second-nature/orchestrator/guard-layer.ts:42` applies source, dedupe, cooldown, quiet, budget, user-awaiting, and risk guards.

The v7 concept model names a gap: current heartbeat reads life evidence, accepted goals, narrative, relationship, and registry, but not recent conversation, Quiet claims, or accepted Dream projection.

Evidence:
- `.anws/v7/concept_model.json:463` records the gap explicitly.

Implication: v7 should preserve the v6 deterministic guard loop but insert `EmbodiedContextAssembler` before planning and replace ad hoc snapshot fields with bounded context slices.

### SQ3. GoalLifecyclePolicy and IdleCuriosityPolicy

PRD and ADR-004 separate durable goal state from runtime policy. State-memory persists `AgentGoal`; control-plane interprets active eligibility and emits lifecycle transition requests. Same kind/scope replacement, expiry, completion evidence, and pause are lifecycle semantics, but persistence is out of scope for control-plane.

Evidence:
- `.anws/v7/01_PRD.md:115` places REQ-004 across state-memory, control-plane, runtime-ops, connector, and body-tool.
- `.anws/v7/01_PRD.md:118` requires no-active-goal heartbeat to use IdleCuriosity only with allowlisted read-only capability.
- `.anws/v7/03_ADR/ADR_004_GOAL_LIFECYCLE_AND_IDLE_CURIOSITY.md:33` chooses `GoalLifecycle + IdleCuriosityPolicy`.
- `src/storage/goal/agent-goal-store.ts` already has proposal/accepted/rejected/completed/paused status fields in v6.
- `src/core/second-nature/orchestrator/goal-priority.ts:65` filters to accepted goals only and blocks unaccepted agent-proposed goals.

Implication: control-plane should own `evaluateGoalLifecycle()` and `selectIdleCuriosityIntent()` as policy operations. It should not own `upsertAgentGoal()` or goal row mutation.

### SQ4. Downstream Intent Orchestration Boundary

The v7 Architecture says control-plane outputs decision, intent, reason, and downstream execution request. It depends on state, body, dream, guidance, and observability. It must coordinate outreach, Quiet, and connector intents without taking ownership of the downstream systems.

Evidence:
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md:99` through `.anws/v7/02_ARCHITECTURE_OVERVIEW.md:112` defines control-plane responsibilities, inputs, outputs, dependencies, and associated requirements.
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md:406` states that control-plane is rhythm and orchestration center and does not directly persist or execute platform actions.
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md:492` warns that control-plane can become a big ball of mud and must split `EmbodiedContextAssembler`, `GoalLifecyclePolicy`, and `IdleCuriosityPolicy`.
- `src/core/second-nature/heartbeat/heartbeat-executor.ts` documents that guidance is only requested after allow and does not cross into connector execution.
- `src/core/second-nature/orchestrator/effect-dispatcher.ts` shows a dispatch boundary where external effects go through connector executor and commit ports.

Implication: L0 should define typed downstream requests: `ConnectorIntentRequest`, `QuietRunRequest`, `DreamScheduleRequest`, `GuidanceDraftRequest`, and `DeliveryFeedbackIngestionRequest`, but state their owners as connector, dream-quiet, guidance-voice, runtime-ops, state-memory, or observability.

### SQ5. Verification Responsibilities

The strongest verification axis is contract-level, not snapshot-only testing. Control-plane must prove bounded context assembly, degraded slice handling, active goal filtering, idle curiosity safety, candidate/accepted Dream separation, circuit breaker posture respect, delivery truthfulness routing, and source-backed trace emission.

Evidence:
- `.anws/v7/01_PRD.md:308` through `.anws/v7/01_PRD.md:314` list success metrics for EmbodiedContext, ToolExperience, IdleCuriosity, and Identity continuity.
- `.anws/v7/01_PRD.md:327` requires v7 tests for EmbodiedContext, IdentityProfile, ToolAffordance, ToolExperience, GoalLifecycle, IdleCuriosity, QuietClaim, Dream auto-schedule, ChannelFeedback, SelfHealth, HeartbeatDigest, NarrativeTimeline, and RestoreSnapshot.
- `.codex/skills/system-designer/SKILL.md:85` requires public contracts to have a Contract Verification Matrix.

Implication: L0 §11 must include both normal and degraded cases; failure reasons are as important as selected intents.

## 4. Ideas / Options

| Option | Decision | Why It Is Defensible | Rejected Risk |
| --- | --- | --- | --- |
| Expand v6 `SnapshotInputs` with all v7 fields | Reject | It is easy but keeps the old flat snapshot shape and hides slice degradation. | Recreates big-ball control-plane and makes context limits hard to audit. |
| Add `EmbodiedContextAssembler` as a first-class component | Select | It gives each context slice a loaded/degraded status, source refs, and limits. | Slightly more interface work, but the boundary is real complexity. |
| Let `IdleCuriosityPolicy` call connector executor directly | Reject | It would make policy equal execution. | Violates architecture boundary and makes safe read-only checks harder to test. |
| Emit `ConnectorIntentRequest` and let body/connector layers execute | Select | Keeps control-plane as orchestrator and lets body-tool enforce affordance and breaker truth. | Requires clear unavailable/error reason codes. |
| Let Dream candidate projection enter heartbeat | Reject | It makes unaccepted sleep output active behavior input. | Violates ADR-005 candidate/accepted separation. |

## 5. Action Recommendations

- Define `EmbodiedContextAssembler` as the only heartbeat entry for v7 context slices, with per-slice `loaded`, `degraded`, or `blocked` status.
- Model `GoalLifecyclePolicy` as runtime evaluation plus transition-request emission; do not put canonical goal mutation inside control-plane.
- Model `IdleCuriosityPolicy` as a selector over `ToolAffordanceMap` and SelfHealth, with a one-capability read-only limit per cycle.
- Treat downstream orchestration as typed request emission plus trace, not direct implementation of connector, guidance, Quiet, Dream, delivery, state, or observability internals.
- Make decision traces record loaded context slices, degradation reasons, policy reasons, selected intent, downstream request id, and source ref count.

## 6. Limitations & Open Questions

- [OPEN: exact v7 state-memory field names for IdentityProfile, RecentInteractionSnapshot, AcceptedDreamProjection, ToolExperience, and SelfHealthSnapshot are being designed by the parallel state-memory worker; owner/next step: parent session must reconcile final field names after all L0 docs land]
- [OPEN: exact body-tool `ToolAffordanceMap` and `ConnectorCircuitBreaker` shape is owned by body-tool-system design; owner/next step: control-plane contract should be checked against body-tool L0 before `/blueprint`]
- [OPEN: runtime-ops current channel and manual run isolation contract is being written by another worker; owner/next step: parent session should verify delivery/channel request fields after runtime-ops L0 lands]

## 7. References

- `.anws/v7/01_PRD.md`
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v7/concept_model.json`
- `.anws/v7/03_ADR/ADR_001_TECH_STACK.md`
- `.anws/v7/03_ADR/ADR_002_EMBODIED_AGENT_LOOP.md`
- `.anws/v7/03_ADR/ADR_003_TOOL_AFFORDANCE_AND_EXPERIENCE.md`
- `.anws/v7/03_ADR/ADR_004_GOAL_LIFECYCLE_AND_IDLE_CURIOSITY.md`
- `.anws/v7/03_ADR/ADR_005_DREAM_QUIET_PROJECTION.md`
- `.anws/v7/03_ADR/ADR_006_CHANNEL_FEEDBACK_AND_SELF_HEALTH.md`
- `.anws/v7/03_ADR/ADR_007_IDENTITY_DIGEST_AND_RECOVERY.md`
- `.anws/v7/03_ADR/ADR_008_CONNECTOR_PROBE_CIRCUIT_BREAKER_AND_ROLLBACK.md`
- `.anws/v6/04_SYSTEM_DESIGN/control-plane-system.md`
- `.anws/v6/04_SYSTEM_DESIGN/dream-system.md`
- `.anws/v6/04_SYSTEM_DESIGN/behavioral-guidance-system.md`
- `.anws/v6/04_SYSTEM_DESIGN/state-system.md`
- `src/core/second-nature/heartbeat/run-heartbeat-cycle.ts`
- `src/core/second-nature/heartbeat/heartbeat-loop.ts`
- `src/core/second-nature/heartbeat/runtime-snapshot.ts`
- `src/core/second-nature/heartbeat/snapshot-builder.ts`
- `src/core/second-nature/orchestrator/intent-planner.ts`
- `src/core/second-nature/orchestrator/goal-priority.ts`
- `src/core/second-nature/orchestrator/guard-layer.ts`
- `src/core/second-nature/orchestrator/platform-capability-router.ts`
- `src/core/second-nature/orchestrator/effect-dispatcher.ts`
- `src/core/second-nature/feedback/owner-reply-feedback.ts`
- `src/dream/dream-scheduler.ts`
- `src/dream/dream-engine.ts`
- `.windsurf/workflows/explore.md`
- `.codex/skills/system-designer/SKILL.md`
- `.codex/skills/output-contract/SKILL.md`
