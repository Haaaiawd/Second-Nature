# v9 Changelog — Self Continuity, Character & Procedural Evolution

## 2026-06-21 — Genesis Start

v9 is opened as a major architecture evolution from `.anws/v8`.

### Why

- v8 proves the body can run, but runtime health is not enough for a context-reset AI.
- Tool execution success does not yet become body intuition.
- Repeated evidence can still look like new life instead of stale exposure.
- Workspace connector scaffolds can be counted as hands before they are real.
- Dream forms long-term memory but does not yet improve how the body acts next time.

### Direction

- Add `Continuity Projection` as the new post-Dream output family.
- Replace over-heavy real-time judgment ownership with `AttentionSignal` where the body prompts the Claw Agent rather than becoming the brain.
- Add procedural memory as verified routines derived from closure and ToolExperience.
- Allow Dream/Agent to automatically evolve workspace connectors only inside workspace connector boundaries.
- Inject `SelfContinuityCard` and contestable `CharacterFrame` into the next EmbodiedContext so Claw Agent wakes with body intuition, relationship posture, active routines, current prohibitions, and emergent character/habit projection.

### Explicit Deletions / Simplifications

- No preconfigured personality score table.
- Character continuity is allowed as bounded emergent personality/habit projection, not a hard controller or emotion oracle.
- No prompt wording that treats programmatic constraints as authoritative Agent emotion.
- No standalone agent-formation system.
- No automatic core runtime self-modification.
- No infinite duplicate evidence artifact growth as acceptable behavior.
- No scaffold connector counted as a real affordance.

### Git / Workflow Note

The `/genesis` branch switch was not performed because the working tree is dirty with pre-existing implementation and package changes. This changelog records the architecture start without touching those changes.

## 2026-06-21 — Genesis Complete

v9 genesis documents are complete and ready for `/design-system`.

### Produced

- `00_MANIFEST.md`
- `00_TECH_EVALUATION.md`
- `01_PRD.md`
- `02_ARCHITECTURE_OVERVIEW.md`
- `03_ADR/ADR_001_CONTINUE_TYPESCRIPT_NODE_OPENCLAW_SQLITE.md`
- `03_ADR/ADR_002_ATTENTION_NOT_AGENT_MIND.md`
- `03_ADR/ADR_003_CONTINUITY_PROJECTION_AFTER_DREAM.md`
- `03_ADR/ADR_004_WORKSPACE_ONLY_CONNECTOR_EVOLUTION.md`
- `03_ADR/ADR_005_PROCEDURAL_MEMORY_AS_VERIFIED_ROUTINE.md`
- `03_ADR/ADR_006_CHARACTER_CONTINUITY_AS_EMERGENT_PROJECTION.md`
- `04_SYSTEM_DESIGN/README.md`
- `concept_model.json`

### Next

Run `/design-system` for the eight v9 systems, then `/challenge`, then `/blueprint`.

## 2026-06-22 — Challenge Closure Change

v9 design/tasks challenge findings CH-01 through CH-04 were closed through a bounded `/change` pass before `/forge`.

### Closed

- Added canonical `CharacterRefreshInput` / `CharacterSignal` input contracts and normalization rules for CharacterFrame refresh.
- Added bilingual Agent-facing safety constraints for emotion assertions, personality labels and hard-control wording.
- Clarified `newlyProposed` first-injection semantics so auto-accepted CharacterFrame projection remains explicitly contestable.
- Replaced mutable old challenge DR references in 05A/05B with stable design/shared-contract anchors.

### Next

Run `/forge` Wave 119 S1 only after confirming the updated `05A_TASKS.md` and `05B_VERIFICATION_PLAN.md` remain the active execution/verification contracts.

## 2026-06-22 — ActivityThread Continuation Change

v9 heartbeat semantics were extended from isolated one-step reflection into bounded multi-heartbeat activity continuity.

### Added

- Canonical `ActivityThread` and `ActivityStep` contracts.
- Optional `activityThreadId` / `threadSuggestion` fields on `AttentionSignal`.
- `EmbodiedContext.activityThreads` context slice.
- `ActivityThreadCoordinator` contract: create/continue/pause/complete with at most one bounded step per heartbeat.
- Activity health requirements for stale, overlong, blocked and missing-closure threads.
- 05A task `T2.2.4` plus 05B verification coverage for continuation, runaway prevention and policy handoff.

### Boundary

- This does not turn heartbeat into an unbounded internal loop.
- Side-effecting activity steps still enter `ActionPolicyDecision` and `ActionClosureRecord`.
- Activity threads are continuity scaffolds for attention and association, not Agent mind.

## 2026-06-22 — ActivityThread Challenge Closure Change

Follow-up `/challenge` review found localized L1 contract gaps after the ActivityThread continuation change. They were closed before `/forge`.

### Closed

- Added `appendActivityThreadProgress()` L1 persistence algorithm and contract matrix coverage.
- Added attention L1 `threadSuggestion` selection rules and `activityThreadId` validation requirements.
- Clarified routine-denied behavior across action-policy and body-connector docs: no dispatch, but denied/no-action closure is still required.
- Synchronized observability `activity` stage kind and activity health terminal-state visibility.
- Clarified that public activity health is surfaced through `loop_status.read` unless a dedicated `activity_status` surface is later added.

## 2026-06-22 — Agent Boundary Guardrail Documentation Change

v9 docs were tightened to make the anti-programming boundary explicit before `/forge`.

### Added

- PRD-level `Agent-boundary guardrails`: continuity, activity, routine, character and health outputs must not become Agent mind, emotion oracle, identity lock or hard controller.
- Architecture and shared-contract rendering invariants for `AttentionSignal`, `ActivityThread`, `SelfContinuityCard`, `ToolRoutine`, `CharacterFrame` and `LoopHealth`.
- Context serializer rules requiring separate labels for body hints, activity threads, routine pointers, contestable projections and runtime health.
- 05A/05B verification coverage for forbidden Agent-facing wording, identity-lock patterns and health-not-psychology assertions.

## 2026-06-22 — Agent Boundary Challenge Follow-up Change

A dedicated read-only challenge pass found two remaining anti-programming seams. They were closed before `/forge`.

### Closed

- Removed the attention-authored action seam: `AttentionSignal` refs can ground source/risk/rationale, but attention-only paths now produce no-action / ask-agent closure unless an Agent-authored intent, policy-bound ActivityStep intent, or verified RoutineInvocation exists.
- Updated action proposal tasks and verification so attention refs-only never author a proposal.
- Replaced broad forbidden wording bans with scoped rule IDs (`emotion_claim`, `identity_lock`, `hard_control`, `personality_score`) plus required safe counterexamples to prevent over-blocking normal text.

## 2026-06-26 — Dependency Cycle Repair Change

A `/forge` readiness check found a circular dependency in `05A_TASKS.md` that blocked S2/S3 task ordering.

### Problem

The task dependency graph contained a cycle:

`T5.2.2 → T6.2.2 → T4.2.2 → T4.2.1 → T2.2.4 → T2.2.1 → T5.2.2`

This made `T2.2.1`, `T5.2.2`, `T6.2.2` and downstream milestones impossible to schedule.

### Root Cause

`T2.2.1 EmbodiedContext assembler` was declared to depend on `T5.2.2 SelfContinuityCard assembly` and `T7.2.2 CharacterFrame lifecycle`. Per `02_ARCHITECTURE_OVERVIEW.md §3` and `control-context-system.md §4.1`, `control-context-system` only **reads** accepted projections / card / frame through narrow SQLite read ports; it does not own the assembly or lifecycle logic. The real prerequisites are the storage schema and canonical contract shapes, not the full downstream implementations.

### Fixed

- `T2.2.1` dependencies changed from `T5.2.2, T7.2.2, T6.2.1` to `T5.1.2, T5.2.1, T6.2.1, T7.2.1`.
- Dependency graph mermaid updated to show `T5.1.2`, `T5.2.1`, `T6.2.1`, `T7.2.1` feeding `T2.2.1`, and `T7.2.1` feeding `T7.2.2`.
- The graph is now acyclic: `T5.2.2` still depends on `T6.2.2` and `T7.2.2`, but `T2.2.1` no longer waits for `T5.2.2`.

### Boundary Preserved

- `control-context-system` remains a reader of `memory-continuity-system` / `character-continuity-system` projections.
- No implementation detail was added or removed; only task ordering and interface-level dependencies were corrected.

### Next

Resume `/forge` Wave 123 with `T7.2.1` and `T8.1.1`, then continue in dependency order through `T7.2.2`, `T6.2.2`, `T5.2.2`, `T2.2.1`, `T2.2.4`, `T4.2.1`, `T4.2.2`.
