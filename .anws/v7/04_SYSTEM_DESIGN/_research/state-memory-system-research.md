# State Memory System Research

**System ID**: `state-memory-system`  
**Target**: `.anws/v7`  
**Date**: 2026-05-21  
**Scope**: v7 persistent memory boundary for IdentityProfile, AgentGoal lifecycle, recent interaction summaries, ToolExperience, DailyDiary, DreamOutput, timelines, digest, probe result, restore snapshot, and secret anchor metadata.

---

## 1. Problem & Scope

| Sub-question | Direction | Expected Output |
| --- | --- | --- |
| How should v7 persist embodied context inputs without turning state into a raw event dump? | Mixed | Canonical state, append-only history, and bounded read-model split |
| Which v7 entities belong to state-memory and which are only produced by other systems? | Mixed | Ownership table for IdentityProfile, AgentGoal, ToolExperience, DailyDiary, DreamOutput, NarrativeTimeline, HeartbeatDigest, CapabilityProbeResult, RestoreSnapshot |
| How does v7 inherit v6 state and Dream contracts safely? | Inward | Compatibility notes for `SessionChronicle`, `NarrativeState`, `RelationshipMemory`, `MemoryStore`, and `DreamOutput` lifecycle |
| Where are privacy and recovery boundaries? | Mixed | Explicit exclusion of credential, token, raw private content, raw prompt; bounded restore and RuntimeSecretAnchor metadata |

**In scope**: TypeScript storage ports, SQLite/sql.js index, workspace JSON/Markdown artifacts, lifecycle states, read model limits, source refs, repair/restore boundaries.  
**Out of scope**: connector execution, heartbeat planning, guidance drafting, delivery, LLM Dream algorithms, and external web research.

---

## 2. Core Insights

1. `state-memory-system` should own durable memory facts and bounded projections; it should not own action decisions or raw connector payloads.
2. v7 expands v6 typed state, not replaces it: `AgentGoal`, `NarrativeState`, `RelationshipMemory`, `SessionChronicle`, and `MemoryStore` remain the compatibility spine.
3. `RecentInteractionSnapshot` must be a derived redacted read model, not a raw conversation archive, because PRD v7 [NG4] forbids full private text in ordinary state.
4. `ToolExperience`, `CapabilityProbeResult`, `HeartbeatDigest`, and `NarrativeTimeline` are cross-system records: state persists redacted rows, while body/connector/observability produce or interpret them.
5. Restore must be bounded and exclusion-aware; restoring credential plaintext or bypassing trust policy is explicitly outside the contract.

---

## 3. Detailed Findings

### Q1. v7 State Boundary

The architecture names `state-memory-system` as the owner of IdentityProfile, AgentGoal, RecentInteractionSnapshot, ToolExperience, QuietClaim, DailyDiary, DreamOutput, RelationshipMemory, NarrativeState, NarrativeTimeline, HeartbeatDigest, CapabilityProbeResult, and RestoreSnapshot. Source: `.anws/v7/02_ARCHITECTURE_OVERVIEW.md` §2 System 3.

The PRD requires heartbeat to read bounded `EmbodiedContext` containing IdentityProfile, accepted goals, recent interactions, accepted Dream projection, ToolExperience, SelfHealthSnapshot, and life evidence. Source: `.anws/v7/01_PRD.md` [REQ-001].

**Design conclusion**: state-memory should expose typed write ports and bounded read slices, not generic `saveMemory()` or unbounded artifact readers.

### Q2. v6 Compatibility Spine

v6 already implements typed stores for goals, narrative, relationship, chronicle, and memory lifecycle. Evidence: `src/storage/goal/agent-goal-store.ts`, `src/storage/narrative/narrative-state-store.ts`, `src/storage/relationship/relationship-memory-store.ts`, `src/storage/chronicle/session-chronicle-store.ts`, and `src/storage/memory-store/memory-store-lifecycle.ts`.

Dream also already models input immutability and candidate output. Evidence: `src/dream/types.ts` and `src/dream/dream-engine.ts`.

**Design conclusion**: v7 should extend existing table/store families with new lifecycle fields and new state domains, while preserving v6 ports where consumers still rely on them.

### Q3. Privacy Boundary

PRD v7 [NG4] and §6.2 prohibit credential, token, cookie, raw private message, and raw prompt from ordinary memory, ToolExperience, self health, and audit. The existing redaction gate blocks credential-like and sensitive inputs before model use. Evidence: `.anws/v7/01_PRD.md` §3.2 and §6.2; `src/dream/redaction-gate.ts`.

`CredentialVault` keeps encrypted credential values behind `SECOND_NATURE_ENCRYPTION_KEY` and exposes health diagnostics without leaking plaintext. Evidence: `src/storage/services/credential-vault.ts`.

**Design conclusion**: every new v7 entity must distinguish `summary`, `contentRef`, `sourceRefs`, and `sensitivity`; raw body fields are rejected before durable state write.

### Q4. AgentGoal Lifecycle

ADR-004 requires same `kind+scope` replacement, complete/expire/pause semantics, completion evidence, and safe IdleCuriosity when no active goal exists. Existing v6 goal schema lacks `scope`, `expiresAt`, `completedAt`, `completionEvidenceRefs`, and `replacedByGoalId`. Evidence: `.anws/v7/03_ADR/ADR_004_GOAL_LIFECYCLE_AND_IDLE_CURIOSITY.md`; `src/storage/db/schema/agent-goal.ts`.

**Design conclusion**: v7 goal persistence must add lifecycle hygiene fields and enforce active uniqueness by `kind+scope`.

### Q5. Cross-system Records

ToolExperience and CapabilityProbeResult are produced by body/connector systems, but their redacted summaries must be queryable by heartbeat, Dream, affordance, self health, and digest. Sources: `.anws/v7/01_PRD.md` [REQ-002], [REQ-003], [REQ-009]; `.anws/v7/03_ADR/ADR_003_TOOL_AFFORDANCE_AND_EXPERIENCE.md`.

HeartbeatDigest and NarrativeTimeline are owner/operator read surfaces but require durable state-backed summaries and source refs. Sources: `.anws/v7/01_PRD.md` [REQ-010], [REQ-011]; `.anws/v7/03_ADR/ADR_007_IDENTITY_DIGEST_AND_RECOVERY.md`; `.anws/v7/03_ADR/ADR_008_CONNECTOR_PROBE_CIRCUIT_BREAKER_AND_ROLLBACK.md`.

**Design conclusion**: state-memory persists normalized summary rows; observability-health owns explain, proof truthfulness, hash-chain verification, and public reporting.

---

## 4. Options

| Option | Verdict | Reason |
| --- | --- | --- |
| Store all embodied inputs as one large JSON blob | Reject | Fast to write, but source refs, lifecycle, redaction, and restore become caller discipline |
| Persist raw event payloads and summarize on read | Reject | Violates PRD privacy constraints and makes heartbeat context assembly too expensive |
| Extend v6 typed stores with v7 domains and bounded projections | Adopt | Keeps compatibility, makes contracts testable, and preserves source-backed repair |
| Full long-term version history for every state row | Reject | Too much storage and privacy surface for plugin-first runtime |
| Bounded RestoreSnapshot before mutable writes | Adopt | Meets REQ-011 without pretending credential/plaintext recovery is possible |

---

## 5. Action Recommendations

| Action | Design Carry-forward |
| --- | --- |
| Define canonical ownership and forbidden fields for every v7 memory entity | `state-memory-system.md` §1, §6, §9 |
| Keep `RecentInteractionSnapshot` as redacted derived context with content refs only | `state-memory-system.md` §5, §6 |
| Add v7 goal fields for `scope`, `expiresAt`, `completedAt`, `completionEvidenceRefs`, and replacement | `state-memory-system.md` §5, §6 |
| Persist ToolExperience and CapabilityProbeResult as redacted state rows with source refs | `state-memory-system.md` §5, §6 |
| Capture RestoreSnapshot before mutable writes and exclude credential/raw private/raw prompt payloads | `state-memory-system.md` §5, §9, §11 |
| Treat HeartbeatDigest as dashboard proof, not outreach | `state-memory-system.md` §6, §8, §11 |

---

## 6. Limits & Open Questions

| Item | Position |
| --- | --- |
| Full raw conversation replay | Out of scope; use `contentRef` and redacted summaries only |
| Vector memory search | Future option after source-backed canonical fields stabilize |
| Multi-agent/multi-owner tenancy | Keep optional `agentId` / `ownerId` fields, but v7 P0 remains single workspace |
| Restore conflict resolution UI | Runtime-ops may expose operator flow; state-memory only defines snapshot and restore preflight contracts |
| Challenge artifact | Public contracts normally require `/challenge`, but this worker's write scope excludes `07_CHALLENGE_REPORT.md`; parent session should run it after system documents merge |

---

## 7. Sources

- `.anws/v7/01_PRD.md` [REQ-001], [REQ-003], [REQ-004], [REQ-005], [REQ-006], [REQ-008], [REQ-010], [REQ-011], [REQ-012], §6.2
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md` §2 System 3, §3 Boundary Matrix, §4 Dependency Graph
- `.anws/v7/concept_model.json`
- `.anws/v7/03_ADR/ADR_001_TECH_STACK.md`
- `.anws/v7/03_ADR/ADR_002_EMBODIED_AGENT_LOOP.md`
- `.anws/v7/03_ADR/ADR_003_TOOL_AFFORDANCE_AND_EXPERIENCE.md`
- `.anws/v7/03_ADR/ADR_004_GOAL_LIFECYCLE_AND_IDLE_CURIOSITY.md`
- `.anws/v7/03_ADR/ADR_005_DREAM_QUIET_PROJECTION.md`
- `.anws/v7/03_ADR/ADR_006_CHANNEL_FEEDBACK_AND_SELF_HEALTH.md`
- `.anws/v7/03_ADR/ADR_007_IDENTITY_DIGEST_AND_RECOVERY.md`
- `.anws/v7/03_ADR/ADR_008_CONNECTOR_PROBE_CIRCUIT_BREAKER_AND_ROLLBACK.md`
- `.anws/v6/04_SYSTEM_DESIGN/state-system.md`
- `.anws/v6/04_SYSTEM_DESIGN/state-system.detail.md`
- `.anws/v6/04_SYSTEM_DESIGN/dream-system.md`
- `.anws/v6/04_SYSTEM_DESIGN/observability-system.md`
- `src/storage/goal/agent-goal-store.ts`
- `src/storage/db/schema/agent-goal.ts`
- `src/storage/narrative/narrative-state-store.ts`
- `src/storage/relationship/relationship-memory-store.ts`
- `src/storage/chronicle/session-chronicle-store.ts`
- `src/storage/memory-store/memory-store-lifecycle.ts`
- `src/storage/quiet/quiet-artifact-types.ts`
- `src/storage/life-evidence/types.ts`
- `src/storage/services/credential-vault.ts`
- `src/dream/types.ts`
- `src/dream/dream-engine.ts`
- `src/dream/redaction-gate.ts`
- `src/observability/services/lived-experience-audit.ts`
- `src/core/second-nature/feedback/owner-reply-feedback.ts`
