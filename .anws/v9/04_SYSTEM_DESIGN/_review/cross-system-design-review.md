# v9 System Design Cross-System Review Report

**Review Scope**: All `.anws/v9/04_SYSTEM_DESIGN/*.md` files + constraint sources (`01_PRD.md`, `02_ARCHITECTURE_OVERVIEW.md`, `03_ADR/ADR_002`–`ADR_006`).
**Review Date**: 2026-06-21
**Reviewer Role**: System Design Reviewer
**Output Rule**: Read-only review; no reviewed files modified.

---

## 1. Executive Summary

**Highest Severity**: **Critical**

**Total Findings**: 23

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 9 |
| Medium | 6 |
| Low | 3 |
| Note | 1 |

**Compatibility Verdict**: **Do NOT proceed to `/challenge` yet.** Four Critical findings create direct cross-system contract conflicts that will produce incompatible implementations and untestable acceptance criteria. At minimum, the `AutonomousChangeLedger` ownership/schema conflict, `SelfContinuityCard`/`CharacterFrame` status enum mismatches, and `ConnectorEvolutionPlan` planning boundary must be resolved before `/challenge`.

---

## 2. Findings by Severity

### Critical

#### CR-01: `AutonomousChangeLedger` schema, ownership, and write location are inconsistent across all systems
- **Description**: Every system that touches the ledger defines a different shape, status set, change-kind set, and writer.
  - `runtime-ops-system.md` §6.1: `changeKind ∈ {routine_install, connector_evolution, rollback}`, `status ∈ {committed, rolled_back, rollback_failed}`.
  - `observability-recovery-system.md` §6.1: `changeKind ∈ {routine_install, routine_supersede, routine_retire, connector_manifest_delta, connector_recipe_delta, connector_adapter_delta}`, `status ∈ {proposed, gated, activated, rolled_back, blocked}`.
  - `body-connector-system.md` §6.1 / L1: `change_type ∈ {routine_install, connector_evolution, rollback}`.
  - `memory-continuity-system.md` §6.1: `changeType ∈ {routine_install, connector_evolution, rollback}`.
  - `action-closure-policy-system.md` OPEN-03 explicitly asks who writes the ledger.
- **Involved Systems/Files**: `runtime-ops-system.md`, `observability-recovery-system.md`, `body-connector-system.md`, `memory-continuity-system.md`, `action-closure-policy-system.md`.
- **Violated Constraints**: PRD [REQ-007] requires one auditable ledger with rollback refs; ADR-004/005 require every routine install / connector activation to be recorded.
- **Recommended Fix**: Pick a single system as the ledger owner. Given the redaction and append-only audit requirements, `observability-recovery-system` is the natural owner; it should expose a `writeLedgerEntry` port consumed by `memory-continuity-system` (routine install) and `body-connector-system` (connector activation/rollback). Canonicalize one `changeKind` enum and one `status` enum across all documents.

#### CR-02: `SelfContinuityCard` data model is split between structured fields and an opaque `cardText`
- **Description**: `control-context-system.md` §6.1 / L1 defines `SelfContinuityCard` as a structured object with `summary`, `bodyIntuition`, `relationshipPosture`, `valuePosture`, `behaviorHabits[]`, `sourceRefs`, `acceptedAt`, `status`. `memory-continuity-system.detail.md` §2 defines it as `{ id, cardText (≤1200 UTF-8), sectionRefsJson, sourceRefsJson, characterFramePointer, status, payloadJson }`. The two schemas cannot round-trip without an unwritten mapping layer, and the PRD's required sections are not guaranteed to survive storage.
- **Involved Systems/Files**: `control-context-system.md`, `control-context-system.detail.md`, `memory-continuity-system.md`, `memory-continuity-system.detail.md`.
- **Violated Constraints**: PRD US-001 AC requires the card to contain body intuition, relationship posture, value posture, behavior habits and source refs; PRD §6.2 / NG4 forbid raw content injection.
- **Recommended Fix**: Adopt one canonical schema. The structured `control-context-system` shape should be the runtime/read model; `memory-continuity-system` should persist it as `cardText` *plus* a typed `sectionsJson` that preserves each PRD-mandated section and source refs. Document the serialization contract and round-trip validation in both L1 files.

#### CR-03: `CharacterFrame` / `CharacterFramePointer` status enums contradict each other
- **Description**: Three different status enumerations are used for the same conceptual object:
  - `control-context-system.detail.md` §2 `CharacterFramePointer.status`: `active | deferred | contested | superseded`.
  - `character-continuity-system.md` §6.1 `CharacterFrame.status`: `candidate | accepted | rejected | retired | superseded`.
  - `observability-recovery-system.detail.md` §2.3 `CharacterFrameObservabilityEvent.projectionState`: `active | deferred | contested | superseded | retired` (a mix of the first two).
  A pointer cannot be `candidate`; a frame cannot be `active` directly. The `contested` state exists only in the pointer, not in the frame lifecycle.
- **Involved Systems/Files**: `control-context-system.md`, `control-context-system.detail.md`, `character-continuity-system.md`, `observability-recovery-system.detail.md`.
- **Violated Constraints**: PRD US-008 requires accept/reject/revise/retire/supersede lifecycle; ADR-006 requires contestability.
- **Recommended Fix**: Separate the two models clearly:
  - `CharacterFrame` (owned by `character-continuity-system`): `candidate | accepted | rejected | retired | superseded`.
  - `CharacterFramePointer` (owned by `control-context-system`, read from `character-continuity-system`): mirrors whether the *latest accepted* frame is `active | deferred | contested | superseded`. `contested` is a runtime/Agent action state, not a frame state. Update observability event to use the frame-state enum.

#### CR-04: `ConnectorEvolutionPlan` planning boundary is ambiguous—two systems claim plan generation
- **Description**: `memory-continuity-system.md` §1.2/§4 says Quiet/Dream produces `ConnectorEvolutionPlan` candidates. `body-connector-system.md` §5.1 lists `planConnectorEvolution(scaffold, fixture, history)` as a body-connector operation. ADR-003 says Dream produces the plan; ADR-004 says body-connector executes gates. The current design leaves it unclear whether `body-connector-system` only plans or also plans, and whether `memory-continuity-system` Dream code calls into body-connector planning.
- **Involved Systems/Files**: `memory-continuity-system.md`, `body-connector-system.md`, `body-connector-system.detail.md`.
- **Violated Constraints**: ADR-003 "Dream produces MemoryProjection, ProceduralProjection, SelfContinuityCard, CharacterFrame candidate, and ConnectorEvolutionPlan"; ADR-004 "workspace-only automatic evolution" executed by body after gates.
- **Recommended Fix**: Assign plan generation to `memory-continuity-system` Dream/consolidation (per ADR-003). `body-connector-system` should own `applyConnectorEvolution(plan)` and gate execution only. Remove `planConnectorEvolution` from body-connector's public contract or rename it to an internal helper consumed by memory-continuity's Dream runner.

---

### High

#### HI-01: `ToolRoutine` lifecycle/status enum is inconsistent across systems
- **Description**:
  - `control-context-system.md` §6.1 `RoutineListItem.status`: `installed | disabled | rollback`.
  - `memory-continuity-system.md` §6.1 `ToolRoutine.status`: `candidate | installed | retired`.
  - `body-connector-system.md` §6.1 / L1 `RoutineLifecycle`: `candidate | validated | active | retired`.
  - `observability-recovery-system.detail.md` §3.5 `RoutineHealth` filters by `pending_validation` and `denied`, neither of which is defined in any routine status enum.
- **Involved Systems/Files**: `control-context-system.md`, `memory-continuity-system.md`, `body-connector-system.md`, `body-connector-system.detail.md`, `observability-recovery-system.detail.md`.
- **Violated Constraints**: PRD [REQ-004] / ADR-005 require a single, versioned, auditable routine lifecycle.
- **Recommended Fix**: Canonicalize on one enum. Suggest `candidate | validated | active | retired` for the internal registry, and map `active → installed`, `retired → rollback` only at the ops/read-model boundary. Define `pending_validation` and `denied` as routine *health* states, not registry lifecycle states, or merge them into `candidate` with health reasons.

#### HI-02: `AttentionSignal` persistence model conflicts with attention-system runtime model
- **Description**: `attention-system.md` / L1 defines `AttentionSignal` with `novelty: float [0,1]`, `repetition: RepetitionKind {new, changed, duplicate, identity_unstable}`, `status: {attentive, attention_blocked_missing_sources, degraded}`. `memory-continuity-system.detail.md` §2 `AttentionSignal` table stores `novelty` as text (`new/changed/duplicate`), `repetition` as text (`first/repeat/escalating`), and `status` as `active/blocked/degraded`. The same logical object uses different types and different categorical values.
- **Involved Systems/Files**: `attention-system.md`, `attention-system.detail.md`, `memory-continuity-system.detail.md`.
- **Violated Constraints**: PRD [REQ-003] requires a bounded, source-backed `AttentionSignal`; PRD [REQ-002] requires stable identity / repetition semantics.
- **Recommended Fix**: Align storage with runtime. Store `novelty` as a real, `repetition` using the attention-system enum, and `status` using the attention-system enum. Remove the storage-only `first/repeat/escalating` vocabulary or map it explicitly to the runtime enum.

#### HI-03: Stable evidence identity logic is owned by three systems simultaneously
- **Description**: `attention-system.md` §4.2 says `RepetitionDetector` resolves stable identity and writes `seenCount` via `memory-continuity-system`. `body-connector-system.md` §4.2 says `EvidenceNormalizer` produces `EvidenceItem` with stable identity and hands it off to `memory-continuity-system`. `memory-continuity-system.md` §5.1 lists `normalizeEvidenceIdentity(item)` as its own operation. There is no single source of truth for the stable identity algorithm, key derivation, or dedup write.
- **Involved Systems/Files**: `attention-system.md`, `body-connector-system.md`, `memory-continuity-system.md`, `memory-continuity-system.detail.md`.
- **Violated Constraints**: PRD US-002 AC requires same externalId/contentHash to update `seenCount` and not create new rows.
- **Recommended Fix**: Make `memory-continuity-system` the canonical owner of `normalizeEvidenceIdentity` and the `EvidenceItem` table. `attention-system` and `body-connector-system` should call this port; they may cache/local-compute identity keys, but the durable upsert must be centralized.

#### HI-04: `SourceRef` canonical structure and URI scheme are not unified
- **Description**: `body-connector-system.detail.md` defines `SourceRef = { family: string, id: string }`. `attention-system.detail.md` defines `AttentionSourceRefFamily = SourceRefFamily | "attention" | "stable_identity"` and URI conventions such as `evidence:{platformId}:{logicalId}`, `attention:{signalId}`, `stable_identity:{logicalId}`. `control-context-system` and `action-closure-policy-system` use `SourceRef[]` without defining the shape. `memory-continuity-system` serializes `sourceRefsJson` but does not state the schema.
- **Involved Systems/Files**: All system designs; `body-connector-system.detail.md`, `attention-system.detail.md`, `memory-continuity-system.detail.md`.
- **Violated Constraints**: PRD §6.2 / NG4 require source-backed, redacted outputs; v8 contracts already define `SourceRef` in `src/shared/types/v8-contracts.ts`.
- **Recommended Fix**: Adopt and extend the v8 canonical `SourceRef` object shape. Create a shared `v9-contracts` reference (already noted in `runtime-ops-system.md` §7.2 as "planning") and remove URI-string conventions in favor of the structured object. If URI strings are needed for compactness, document the parser and ensure all systems use the same parser.

#### HI-05: `ConnectorVersion` / `ConnectorEvolutionPlan` status enums are inconsistent
- **Description**:
  - `runtime-ops-system.md` `ConnectorEvolutionStatus.status`: `proposed | gating | activated | canary_failed | rolled_back`.
  - `memory-continuity-system.md` `ConnectorEvolutionPlan.status`: `candidate | gating | activated | rollback`.
  - `body-connector-system.md` `PlanStatus`: `proposed | approved | rejected | rolled_back`; `VersionLifecycle`: `candidate | staged | active | rolled_back`.
- **Involved Systems/Files**: `runtime-ops-system.md`, `memory-continuity-system.md`, `body-connector-system.md`, `body-connector-system.detail.md`.
- **Violated Constraints**: PRD [REQ-005]/[REQ-007] require a deterministic, auditable evolution lifecycle with rollback.
- **Recommended Fix**: Use a single lifecycle:
  - `ConnectorEvolutionPlan`: `proposed | gating | activated | rolled_back | blocked`.
  - `ConnectorVersion`: `candidate | staged | active | rolled_back`.
  - `canary_failed` should be a reason code on `blocked`, not a status.

#### HI-06: `action-closure-policy-system` has no L1 and three blocking OPEN items
- **Description**: The system sits at the safety boundary between Agent intent, attention, routine, and external execution, yet it has no L1 detail file and unresolved OPEN items for (1) `AttentionSignal` → `ActionProposal` exact schema, (2) `ToolRoutine` registry read model, and (3) `AutonomousChangeLedger` write interface location.
- **Involved Systems/Files**: `action-closure-policy-system.md`.
- **Violated Constraints**: PRD [REQ-003]/[REQ-004]/[REQ-007] require policy-bound closure; ADR-005 requires routine re-evaluation.
- **Recommended Fix**: Produce `action-closure-policy-system.detail.md` before `/challenge`. Resolve the three OPEN items and define the `AgentActionIntent`, `ActionProposal`, and routine-invocation schemas explicitly.

#### HI-07: `character-continuity-system` contest/re-authoring flow and `Frame Source Validator` are undefined
- **Description**: The L0 lists `applyCharacterContest`, `supersedeFrame`, `validateFrameSources` as operations but provides no algorithm, state machine, or forbidden-pattern list. Four OPEN items remain: section ordering/minimum sources, contest prompt wording, supersede/revise triggers, and validator违禁词清单.
- **Involved Systems/Files**: `character-continuity-system.md`.
- **Violated Constraints**: PRD US-008 requires bounded, contestable, source-backed `CharacterFrame`; ADR-006 requires validation against personality scores, emotion claims, and hard-control rules.
- **Recommended Fix**: Create `character-continuity-system.detail.md` before `/challenge`. Define the contest state machine, prompt templates, and a concrete `Frame Source Validator` rule set with test fixtures.

#### HI-08: `body-connector-system` sandbox policy is still OPEN
- **Description**: ADR-004 lists "Implement recipe/adapter sandbox policy" as a required follow-up. `body-connector-system.md` §9.3 explicitly marks sandbox constraints as OPEN. Without it, the `sandbox` gate cannot be designed or tested, and workspace adapter escape is unmitigated.
- **Involved Systems/Files**: `body-connector-system.md`, `body-connector-system.detail.md`, `02_ARCHITECTURE_OVERVIEW.md` §8.
- **Violated Constraints**: PRD [REQ-005]/[REQ-007]; ADR-004 workspace-only evolution gate.
- **Recommended Fix**: Define sandbox policy in `body-connector-system.detail.md`: allowed globals, module whitelist, fs/network boundaries, timeout, memory limit, and worker isolation strategy. Keep `vm2` forbidden; commit to `node:vm` + `worker_threads` or a deterministic alternative.

#### HI-09: `ConnectorEvolutionPlan` → `ConnectorVersion` activation flow and rollback command hint are not traced end-to-end
- **Description**: `memory-continuity-system.md` says `applyConnectorEvolutionPlan(plan, gateResults)` activates version; `body-connector-system.md` says `applyConnectorEvolution(plan)` runs the 7 gates; `observability-recovery-system.md` says it records gate results. It is unclear which system calls which, where the `previousStableRef` is stored, and who emits the `rollbackCommandHint` consumed by `runtime-ops-system`.
- **Involved Systems/Files**: `memory-continuity-system.md`, `body-connector-system.md`, `observability-recovery-system.md`, `runtime-ops-system.md`.
- **Violated Constraints**: PRD [REQ-005]/[REQ-007] require automatic activation and rollback.
- **Recommended Fix**: Document a single sequence: Dream (memory-continuity) creates plan → body-connector runs gates → on pass, body-connector writes version and calls observability ledger → memory-continuity updates plan status → runtime-ops reads version + ledger. `rollbackCommandHint` should be generated by body-connector at activation time.

---

### Medium

#### ME-01: `AttentionActionKind` expands beyond PRD-suggested actions
- **Description**: PRD US-003 says attention signals may suggest `notify_owner / watch / remember`. `attention-system.detail.md` §2.1 defines `AttentionActionKind` as `notify_owner | watch | remember | connector_read | defer`. `connector_read` is a new action not mentioned in the PRD.
- **Involved Systems/Files**: `attention-system.md`, `attention-system.detail.md`.
- **Violated Constraints**: PRD US-003 boundary list.
- **Recommended Fix**: Either align with PRD by removing `connector_read` or update the PRD to explicitly include it. If kept, define its policy evaluation path (it is not a final action but a suggestion that still requires `action-closure-policy-system` approval).

#### ME-02: `observability-recovery-system.detail.md` `assembleDigest` hardcodes placeholder health sections
- **Description**: L1 §3.7 sets `continuityHealth`, `routineHealth`, and `evolutionHealth` to empty default objects and does not call the actual aggregation functions defined in §3.4–§3.6. This creates a misleading contract: the L0 promises a five-dimensional digest, but the L1 implementation returns only `loopHealth` plus placeholders.
- **Involved Systems/Files**: `observability-recovery-system.md`, `observability-recovery-system.detail.md` §3.7.
- **Violated Constraints**: PRD [REQ-001]/[REQ-008] require digest/timeline to expose continuity, routine, and evolution health.
- **Recommended Fix**: Update the L1 algorithm to invoke `aggregateContinuityHealth`, `aggregateRoutineHealth`, and `aggregateConnectorEvolutionHealth` using read models from `memory-continuity-system` and `body-connector-system`.

#### ME-03: `ContinuityReadPort` interface shape differs between consumers
- **Description**:
  - `runtime-ops-system.md` §5.2: `ContinuityReadPort.readSelfContinuityCard(workspaceRoot: string)`.
  - `control-context-system.md` §5.2 / L1 §2: `ContinuityReadPort.loadSelfContinuityCard(now: string)` plus `loadActiveMemoryProjections`, `loadActiveProceduralProjections`, `loadRoutineList`.
  - `memory-continuity-system.md` §5.2: `assembleSelfContinuityCard(scope: ContinuityScope)`.
- **Involved Systems/Files**: `runtime-ops-system.md`, `control-context-system.md`, `memory-continuity-system.md`.
- **Violated Constraints**: PRD §5.2 requires OpenClaw plugin and CLI to expose the same continuity read models.
- **Recommended Fix**: Unify under `memory-continuity-system` as the owner: expose `loadSelfContinuityCard(scope)` and `loadRoutineList(filters)` ports. `control-context-system` and `runtime-ops-system` consume the same port with their own wrapper parameters.

#### ME-04: `CharacterFrame` persistence responsibility is described inconsistently
- **Description**: `control-context-system.md` says it reads a `CharacterFramePointer` / projection from `character-continuity-system`. `memory-continuity-system.md` says it "only persists and references its pointer." Yet `character-continuity-system.md` §5.2 defines `CharacterFrameStorePort` with `writeCandidateFrame` and `updateFrameLifecycle` to be implemented by `memory-continuity-system`. The result is that `memory-continuity-system` is expected to persist the full frame, not just a pointer.
- **Involved Systems/Files**: `character-continuity-system.md`, `memory-continuity-system.md`, `control-context-system.md`.
- **Violated Constraints**: ADR-006 requires `SelfContinuityCard` to carry only a short pointer/summary.
- **Recommended Fix**: Clarify terminology: `memory-continuity-system` persists the full `CharacterFrame` artifact; `control-context-system` receives a `CharacterFramePointer` (id + summary + contest prompt). The pointer itself may also be persisted by `memory-continuity-system` for indexing. Update all three documents to use this language consistently.

#### ME-05: v8 `JudgmentVerdict` migration path has no owner
- **Description**: `02_ARCHITECTURE_OVERVIEW.md` §8 and `control-context-system.md` §3.4 both list the migration of existing v8 `JudgmentVerdict` tests after `AttentionSignal` introduction as OPEN, with owner "blueprint owner." However, this is a design decision (how to wrap or replace `JudgmentVerdict`) that should be settled before `/blueprint`, not during blueprint.
- **Involved Systems/Files**: `02_ARCHITECTURE_OVERVIEW.md`, `control-context-system.md`.
- **Violated Constraints**: ADR-002 requires migration from `JudgmentVerdict` to `AttentionSignal`.
- **Recommended Fix**: Assign owner to `/design-system` or `/challenge`. Decide whether v8 `JudgmentVerdict` rows are read-only legacy, mapped to `AttentionSignal` on read, or migrated on schema upgrade.

#### ME-06: `EvidenceItem.identityStatus` semantics differ between systems
- **Description**: `memory-continuity-system.detail.md` uses `identityStatus ∈ {stable, unstable, duplicate}` to describe the durable row state. `attention-system.detail.md` uses `RepetitionKind ∈ {new, changed, duplicate, identity_unstable}` to describe the per-assembly classification. The word "duplicate" means "this row is a duplicate entry" in storage but "this evidence is a repeat exposure" in attention. `identity_unstable` vs `unstable` are also not aligned.
- **Involved Systems/Files**: `memory-continuity-system.detail.md`, `attention-system.detail.md`.
- **Violated Constraints**: PRD US-002 requires clear stable identity semantics.
- **Recommended Fix**: Rename storage status to avoid confusion: `rowIdentityStatus ∈ {stable, unstable, duplicate_row}` and keep `RepetitionKind` for attention output. Map `identity_unstable` attention input to `unstable` storage status.

---

### Low

#### LO-01: `README.md` in `04_SYSTEM_DESIGN` claims designs are pending
- **Description**: `04_SYSTEM_DESIGN/README.md` says "Detailed system designs are pending `/design-system`." In fact, all eight system L0 files and four L1 detail files exist.
- **Involved Systems/Files**: `04_SYSTEM_DESIGN/README.md`.
- **Recommended Fix**: Update the index to list existing files and their L1 status (created / not created).

#### LO-02: `attention-system.detail.md` §5.6 "Empty Evidence Content" is an L1 island
- **Description**: The edge case marks `status = degraded` with `reason = "empty_evidence_content"`. This reason code and edge case are not referenced in the L0 navigation file (`attention-system.md`).
- **Involved Systems/Files**: `attention-system.detail.md` §5.6, `attention-system.md`.
- **Recommended Fix**: Add the empty-content edge case to L0 §9.3 Security Risks or §5.1 Operation Contracts, or remove it from L1 if it is not a committed behavior.

#### LO-03: `SelfContinuityCard` character pointer field name varies
- **Description**: `control-context-system.md` uses `characterFramePointer`; `memory-continuity-system.detail.md` uses `characterFramePointer` as a text column; no structural issue, but `runtime-ops-system.md` `ContinuityReadResult` only exposes `card?: SelfContinuityCardPointer` and does not expose the separate `CharacterFrame` projection.
- **Involved Systems/Files**: `runtime-ops-system.md`, `control-context-system.md`.
- **Recommended Fix**: `continuity.read` envelope should expose both the `SelfContinuityCard` and a separate `characterFrame` projection or pointer, matching the architecture diagram where `CharacterFrame` is an independent EmbodiedContext projection.

---

### Note

#### NO-01: Overall cross-system dependency graph in `02_ARCHITECTURE_OVERVIEW.md` is consistent with individual system diagrams
- **Description**: The system dependency graph, responsibilities, and data-flow directions in the architecture overview align with the L0 files. No major architectural direction conflicts were found at the C4-L1 level.
- **Involved Systems/Files**: `02_ARCHITECTURE_OVERVIEW.md`.
- **Status**: No action required.

---

## 3. OPEN Items Summary

| # | OPEN Item | Source System | Owner (as documented) | Blocks `/design-system` completion? | Blocks `/challenge`? |
|---|-----------|---------------|----------------------|-------------------------------------|----------------------|
| 1 | `SelfContinuityCard` exact fields / section ordering / failure semantics | `memory-continuity-system` | `memory-continuity-system L1` | Yes | Yes |
| 2 | `CharacterFrame` section ordering, source requirements, conflict handling, contest/re-authoring flow, prompt wording, supersession | `character-continuity-system` | `character-continuity-system L1` | Yes | Yes |
| 3 | Sandbox constraints for scriptable workspace adapters | `body-connector-system` | `body-connector-system L1` | Yes | Yes |
| 4 | Migration path for v8 `JudgmentVerdict` tests | `control-context-system` / Architecture | `blueprint owner` | Yes | Yes |
| 5 | `AttentionSignal` → `ActionProposal` exact input format | `action-closure-policy-system` | `control-context + attention L0` | Yes | Yes |
| 6 | `ToolRoutine` registry read model / `RoutineInvocation` payload schema | `action-closure-policy-system` | `memory-continuity + body-connector L1` | Yes | Yes |
| 7 | `AutonomousChangeLedger` write interface location | `action-closure-policy-system` | `observability-recovery-system L0` | Yes | Yes |
| 8 | `CharacterFramePointer` summary length / contest prompt / supersession ref | `control-context-system` | `character-continuity-system L1` | Yes | Yes |

---

## 4. Compatibility & Next-Step Recommendation

**Verdict**: **Conditional Block on `/challenge`.**

The eight systems are architecturally coherent at the high level, and the ADR set correctly captures the v9 boundaries (attention not mind, continuity as projection, workspace-only evolution, verified routines, emergent character). However, the current L0/L1 documents contain enough naming, schema, and ownership conflicts that proceeding directly to `/challenge` would produce unactionable challenge reports and likely force a redesign mid-`/forge`.

**Minimum gating actions before `/challenge`:**

1. Resolve CR-01 (ledger canonical schema/owner) and update all four affected system designs.
2. Resolve CR-02 (`SelfContinuityCard` canonical schema) and reconcile `control-context-system` with `memory-continuity-system`.
3. Resolve CR-03 (`CharacterFrame` vs `CharacterFramePointer` status enums).
4. Resolve CR-04 (`ConnectorEvolutionPlan` planning boundary).
5. Produce L1 detail files for `action-closure-policy-system` and `character-continuity-system`.
6. Close HI-03 (stable identity owner), HI-04 (`SourceRef` canonical shape), and HI-08 (sandbox policy).
7. Re-run this cross-system review after the above fixes.

Once these are closed, `/challenge` can proceed with confidence that the design documents are internally consistent and traceable to PRD/ADR constraints.

---

**Report Path**: `.anws/v9/04_SYSTEM_DESIGN/_review/cross-system-design-review.md`
