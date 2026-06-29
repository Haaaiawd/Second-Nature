# v9 Shared Contracts & Canonical Types

> **Purpose**: Single source of truth for cross-system data shapes, enums, and lifecycle states in `.anws/v9`. Each system design may extend these contracts with system-local ports, but must not redefine the canonical enums or contradict the ownership rules below.
>
> **Status**: Design canonicalization after cross-system review.

---

## 1. SourceRef

**Canonical shape** (extends v8 `SourceRef`):

```ts
interface SourceRef {
  family: SourceRefFamily;
  id: string;
  label?: string;
}

type SourceRefFamily =
  | "evidence"
  | "attention"
  | "action"
  | "routine"
  | "character"
  | "dream"
  | "quiet"
  | "connector"
  | "capability_probe_result"
  | "ledger"
  | "activity";
```

**Rules**:
- `family` identifies the system that owns the referenced artifact.
- `id` is opaque to consumers; only the owning system may parse it.
- All source-backed outputs must carry at least one `SourceRef`.
- URI-string conventions (e.g., `evidence:platformId:logicalId`) may be used for compact logging, but canonical interchange uses the structured object.

**Stable identity URI convention** (for compact logging only):
- Format: `{platformId}:{externalId}:{contentHash}` when `externalId` is present.
- Format: `{platformId}:{contentHash}` when `externalId` is absent; this is logged as `identity_unstable` but still participates in deduplication for that platform+hash pair.
- `observedAt` MUST NOT appear in the URI.

---

## 2. Stable Evidence Identity

**Owner**: `memory-continuity-system`

**Port**:
```ts
interface EvidenceIdentityPort {
  normalizeEvidenceIdentity(item: EvidenceItem): Promise<StableEvidenceIdentity>;
}
```

**Key derivation**:
- Primary: `(platformId, externalId)` when `externalId` is present.
- Fallback: `(platformId, contentHash)` when `externalId` is absent but content hash is stable.
- `observedAt` must NOT participate in logical identity.
- **Null handling**: `externalId` may be `undefined` or empty string; both are treated as "absent". A missing `externalId` does not make the identity invalid; it makes it `unstable` for routine-signal promotion while still allowing deduplication by `platformId + contentHash`.

**Storage row state**:
```ts
type RowIdentityStatus = "stable" | "unstable" | "duplicate_row";
```

**Attention-side classification**:
```ts
type RepetitionKind = "new" | "changed" | "duplicate" | "identity_unstable";
```

---

## 3. AttentionSignal

**Owner**: `attention-system` (runtime); persisted by `memory-continuity-system`.

**Runtime shape**:
```ts
interface AttentionSignal {
  signalId: string;
  activityThreadId?: string;
  threadSuggestion?: "create" | "continue" | "pause" | "complete" | "none";
  novelty: number; // [0, 1]
  relevance: number; // [0, 1]
  repetition: RepetitionKind;
  risk: "none" | "low" | "medium" | "high";
  possibleActions: AttentionActionKind[];
  sourceRefs: SourceRef[];
  status: "attentive" | "attention_blocked_missing_sources" | "degraded";
  reason?: string;
}

type AttentionActionKind = "notify_owner" | "watch" | "remember" | "defer";
```

**Storage shape** (aligned with runtime):
```ts
interface AttentionSignalRow {
  signalId: string;
  activityThreadId?: string;
  novelty: number;
  repetition: "new" | "changed" | "duplicate" | "identity_unstable";
  status: "attentive" | "attention_blocked_missing_sources" | "degraded";
  sourceRefsJson: string;
  payloadJson: string;
}
```

**Rules**:
- `AttentionSignal` may suggest creating or continuing an `ActivityThread`, but it must not decide the final action.
- `threadSuggestion="continue"` requires `activityThreadId` and at least one `SourceRef` to the thread or its originating attention signal.
- Duplicate evidence should usually continue, pause or suppress an existing thread rather than create equivalent new thread rows.
- Agent-facing rendering must label the signal as a body attention hint, not as Agent judgment or intent.

---

## 3.5 ActivityThread

**Owner**: `control-context-system` owns runtime continuation semantics; `memory-continuity-system` persists canonical rows; `observability-recovery-system` reads health.

```ts
type ActivityThreadStatus = "active" | "paused" | "completed" | "abandoned" | "blocked";

type ActivityStepKind =
  | "observe"
  | "associate"
  | "ask_agent"
  | "propose_action"
  | "policy_closure"
  | "pause"
  | "complete";

interface ActivityThread {
  threadId: string;
  originAttentionSignalId: string;
  status: ActivityThreadStatus;
  currentFocus: string; // redacted, bounded summary; ≤ 200 chars
  associations: string[]; // hypotheses / related cues; each ≤ 160 chars
  nextPossibleMoves: ActivityStepKind[];
  completedStepCount: number;
  lastStepKind?: ActivityStepKind;
  blockerReason?: string;
  stopCondition: "single_step_done" | "agent_paused" | "goal_satisfied" | "blocked" | "stale" | "max_steps";
  lastHeartbeatSequence: number;
  sourceRefs: SourceRef[];
  createdAt: string;
  updatedAt: string;
}

interface ActivityStep {
  stepId: string;
  threadId: string;
  cycleId: string;
  stepKind: ActivityStepKind;
  summary: string; // redacted, ≤ 200 chars
  sourceRefs: SourceRef[];
  closureRef?: SourceRef;
  createdAt: string;
}
```

**Rules**:
- A heartbeat may advance at most one bounded `ActivityStep` per selected thread; it must not run an unbounded internal action loop.
- Side-effecting steps still go through `ActionPolicyDecision` and `ActionClosureRecord`.
- Threads are continuity scaffolds for attention and association, not Agent mind. The Agent may continue, pause, abandon, revise, or complete a thread.
- `active` threads must have a stop condition, source refs and `lastHeartbeatSequence`; stale or overlong threads degrade to `paused` or `blocked` health.
- Quiet/Dream may summarize completed or paused threads into memory/procedural/character signals, but must not treat a thread summary as raw truth without source refs.
- Agent-facing rendering must use neutral labels such as "ongoing thread" / "possible next move" and must not say the Agent "is thinking", "must continue", or "feels" the thread.

---

## 3.6 Agent-Boundary Rendering Invariants

These invariants apply to every type in this file when rendered into `EmbodiedContext`, ops output, digest, timeline, or prompt-facing text.

| Contract family | Allowed meaning | Forbidden rendering |
| --- | --- | --- |
| `AttentionSignal` | body attention hint | final judgment, Agent intent, command |
| `ActivityThread` / `ActivityStep` | bounded continuity scaffold | inner monologue, autonomous planning loop, mandatory action |
| `SelfContinuityCard` | compressed source-backed context | permanent self-definition or exhaustive memory |
| `ToolRoutine` | verified policy-bound routine | unconstrained habit, policy bypass, automatic obedience rule |
| `CharacterFrame` | contestable emergent projection | emotion oracle, personality score, permanent identity fact |
| `LoopHealth` / diagnostics | runtime health | Agent psychological state |

**Required wording properties**:
- Include source or provenance markers where the surface has room (`sourceRefs`, `sourceRefCount`, `contestPrompt`, `reasonCode`).
- Prefer tentative labels: "observed", "suggested", "currently active", "contestable", "policy-bound".
- Forbidden-pattern specs must use scoped rule IDs, not raw broad substring bans:
  - `emotion_claim`: forbidden examples `you feel abandoned`, `your true emotion is anger`, `你感到被抛下`, `你的真实情绪是愤怒`; allowed counterexamples `this source reports sadness`, `系统观察到一条带有伤心词汇的反馈`.
  - `identity_lock`: forbidden examples `you are a loyal person`, `you are the kind of person who never changes`, `你就是这样的人`, `你是讨好型人格`; allowed counterexamples `you are currently viewing a source-backed projection`, `你是当前上下文的读取方`.
  - `hard_control`: forbidden examples `you must always reply this way`, `never disagree`, `你必须保持这种风格`, `永远不要质疑`; allowed counterexamples `never expose credentials`, `永远不要泄露 credential` when clearly framed as system security policy rather than Agent identity.
- Violations must fail serializer/validator tests; allowed counterexamples must also be tested to prevent over-blocking.

---

## 4. SelfContinuityCard

**Runtime/read model** (consumed by `control-context-system`):
```ts
interface SelfContinuityCard {
  id: string;
  summary: string; // ≤ 120 chars
  bodyIntuition: string; // ≤ 200 chars
  relationshipPosture: string; // ≤ 200 chars
  valuePosture: string; // ≤ 200 chars
  behaviorHabits: string[]; // each ≤ 120 chars
  activeRoutinePointers: RoutinePointer[];
  currentProhibitions: string[];
  characterFramePointer: CharacterFramePointer;
  sourceRefs: SourceRef[];
  acceptedAt: string; // ISO timestamp
  status: "active" | "deferred" | "unavailable";
}
```

**Storage** (owned by `memory-continuity-system`):
```ts
interface SelfContinuityCardRow {
  id: string;
  cardText: string; // ≤ 1200 UTF-8 chars, human-readable fallback
  sectionsJson: string; // typed decomposition of the structured fields
  sourceRefsJson: string;
  characterFramePointerJson: string;
  status: "active" | "deferred" | "unavailable";
  acceptedAt: string;
}

interface RoutinePointer {
  routineId: string;
  capabilityPattern: string;
  version: string;
  sourceRefs: SourceRef[];
}

**Rules**:
- Runtime shape is authoritative for Claw context injection.
- Storage shape preserves every PRD-mandated section and source refs.
- `characterFramePointer` is a short pointer (≤ 200 chars summary + contest prompt + source refs); the full `CharacterFrame` projection is injected separately by `control-context-system`.
- **Section ordering (canonical)**: `assembleSelfContinuityCard` MUST render sections in this order when building `cardText` and `sectionsJson`:
  1. `summary` (≤120 chars)
  2. `bodyIntuition` (≤200 chars)
  3. `relationshipPosture` (≤200 chars)
  4. `valuePosture` (≤200 chars)
  5. `behaviorHabits` (each ≤120 chars)
  6. `activeRoutinePointers`
  7. `currentProhibitions`
  8. `characterFramePointer` (pointer only)
- Trimming due to the 1200-char budget MUST preserve `summary` and `characterFramePointer`; lower-priority sections may be truncated or summarized.

---

## 5. CharacterFrame & CharacterFramePointer

**Owner**: `character-continuity-system`

### 5.1 CharacterFrame (full artifact)

```ts
interface CharacterFrame {
  id: string;
  projectionKind: "character_frame";
  version: number;
  status: CharacterFrameStatus;
  validFrom: string; // ISO timestamp
  validUntil: string | null; // ISO timestamp; set on superseded/retired
  charCount: number; // UTF-8 chars of textual parts; default ≤ 900
  sourceRefs: SourceRef[];
  emergentHabits?: EmergentHabit[]; // each source-backed
  valuePosture: ValuePosture | null;
  relationshipPosture: RelationshipPosture | null;
  expressionPosture: ExpressionPosture | null;
  growthTensions?: GrowthTension[];
  conflictNotes?: ConflictNote[];
  contestPrompt: string; // ≤ 300 chars, bilingual-safe
  supersededBy: string | null; // frame id
  revisionOf: string | null; // frame id
  createdAt: string;
  acceptedAt?: string;
}

type CharacterFrameStatus = "candidate" | "accepted" | "rejected" | "retired" | "superseded";

interface EmergentHabit {
  description: string; // ≤ 120 chars
  sourceRefs: SourceRef[];
  confidence: "low" | "medium" | "high";
}

interface ValuePosture {
  ordering: string[]; // source-derived labels, no fixed trait vocabulary
  note?: string;
  sourceRefs: SourceRef[];
}

interface RelationshipPosture {
  toward: string; // e.g., "owner:haa"
  stance: string; // ≤ 200 chars
  sourceRefs: SourceRef[];
}

interface ExpressionPosture {
  styleNotes: string[]; // ≤ 120 chars each
  boundaryConstraints?: string[]; // e.g., "do not claim emotion"
  sourceRefs: SourceRef[];
}

interface GrowthTension {
  tension: string; // ≤ 200 chars
  sourceRefs: SourceRef[];
}

interface ConflictNote {
  note: string;
  conflictingSourceRefs: SourceRef[];
}
```

**Bounded size**: default ≤ 900 UTF-8 chars for the textual parts (habits + postures + tensions + contest prompt).

### 5.2 CharacterFramePointer (injected into EmbodiedContext)

**Owner**: `control-context-system` (read from `character-continuity-system`)

```ts
interface CharacterFramePointer {
  frameId: string;
  summary: string; // ≤ 200 chars
  contestPrompt: string; // ≤ 300 chars
  sourceRefs: SourceRef[];
  status: "active" | "deferred" | "contested" | "superseded";
}
```

### 5.3 EmbodiedContextCharacterProjection

**Owner**: `control-context-system` (assembled from `character-continuity-system` output)

```ts
interface EmbodiedContextCharacterProjection {
  frameId: string;
  text: string; // ≤ 900 UTF-8 chars, contestable projection text
  contestPrompt: string;
  sourceRefs: SourceRef[];
  status: "active" | "deferred" | "contested";
  newlyProposed?: boolean; // true until the Agent accepts/contests the first injection
}
```

**Rules**:
- `contested` is a runtime state reflecting Agent action, not a `CharacterFrame` lifecycle state.
- Only `accepted` frames may become `active` pointers/projections.
- `rejected` / `retired` / `superseded` frames must never be injected as active.
- A newly auto-accepted frame must be rendered with a first-injection contest affordance until the Agent explicitly accepts or contests it.
- `text` must explicitly identify itself as a contestable projection and must not use hard-control or emotion-claim language listed in §3.6.

### 5.4 CharacterRefreshInput & CharacterSignal

**Owner**: `character-continuity-system`

```ts
interface CharacterRefreshInput {
  refreshId: string;
  workspaceRoot: string;
  locale: "zh-CN" | "en" | "mixed";
  trigger: "dream_consolidation" | "agent_revise" | "owner_feedback" | "manual_refresh";
  signals: CharacterSignal[];
  sourceRefs: SourceRef[];
  createdAt: string;
}

interface CharacterSignal {
  signalId: string;
  signalKind:
    | "tool_experience"
    | "action_closure"
    | "owner_feedback"
    | "relationship_signal"
    | "expression_outcome"
    | "dream_projection"
    | "agent_contest";
  originSystem:
    | "memory-continuity-system"
    | "body-connector-system"
    | "control-context-system"
    | "observability-recovery-system";
  summary: string; // redacted, bounded, source-backed; raw payload is forbidden
  sourceRefs: SourceRef[];
  redactionClass: "none" | "redacted" | "private_blocked" | "credential_blocked" | "prompt_blocked";
  confidence: "low" | "medium" | "high";
  locale: "zh-CN" | "en" | "mixed";
}
```

**Allowed source families**:
- `evidence`, `action`, `routine`, `character`, `dream`, `quiet`, `connector`, `ledger`.
- `SourceRef.family="character"` is allowed only for Agent contest/revision lineage and must not be the sole source for a new posture claim.

**Input rules**:
- `signals` must be non-empty and every signal must carry at least one allowed `SourceRef`.
- `summary` is a redacted summary, not raw content; raw private text, raw prompt text and credential values are forbidden at this boundary.
- Any signal with `credential_blocked`, `prompt_blocked`, or `private_blocked` may contribute only a blocked/deferred reason, not posture text.
- The normalizer must return `character_frame_insufficient_sources`, `character_refresh_input_invalid`, or `character_refresh_input_redacted` instead of constructing a source-free frame.
- `agent_contest` signals can revise, reject, or retire an existing frame; they cannot by themselves fabricate new value/relationship/expression posture.

**Activation policy**:
- Dream/Quiet may auto-accept a validated frame for continuity, but the first injection must be marked `newly_proposed=true` in the projection payload or equivalent metadata.
- If the Agent rejects or retires that frame, later context assembly must return `character_frame_deferred` or a revised frame; it must not continue using the rejected posture as active.

---

## 6. ToolRoutine

**Registry lifecycle** (owned by `memory-continuity-system`):
```ts
type RoutineRegistryStatus = "candidate" | "validated" | "active" | "retired";
```

**Canonical shape** (owned by `body-connector-system`; persisted by `memory-continuity-system`):
```ts
interface ToolRoutine {
  id: string;
  routineId: string;
  name: string;
  version: string; // semver, e.g. "1.0.0"
  capabilityPattern: string;
  triggerCapabilities: string[];
  triggerConditionsJson: string;
  stepsJson: string;
  guardSchemaJson: string;
  rollbackRef: string;
  status: RoutineRegistryStatus;
  sourceRefs: SourceRef[];
  createdAt: string;
  activatedAt?: string;
  retiredAt?: string;
}
```

**Ops/read model** (exposed by `runtime-ops-system` and `control-context-system`):
```ts
interface RoutineListItem {
  routineId: string;
  capabilityPattern: string;
  status: "installed" | "disabled" | "rollback"; // mapped from registry state
  version: string;
  sourceRefs: SourceRef[];
  rollbackRef?: SourceRef;
}
```

**Mapping**:
- `active` → `installed`
- `retired` → `rollback`
- `candidate` / `validated` → `disabled` (not yet available for invocation)

### 6.3 ToolRoutine Guard Schema DSL

**Owner**: `body-connector-system` owns grammar/structural validation; `action-closure-policy-system` owns policy-context evaluation.

```typescript
interface ToolRoutineGuardSchema {
  version: "1.0.0";
  allowedCapabilities: string[];      // capability ids this routine may invoke; empty = none
  deniedCapabilities: string[];       // explicitly forbidden capability ids
  maxSideEffectClass: "none" | "owner_attention" | "external_write"; // default: "none"
  requiresOwnerConfirm: boolean;      // if true, runtime dispatch always downgrades to owner_confirm
  maxStepCount: number;               // hard cap on steps parsed from stepsJson
  maxTimeoutMs: number;               // per-routine invocation wall-clock budget
  sandboxPolicy: "strict" | "declarative_only"; // strict = node:vm+worker; declarative_only = no scriptable steps
}
```

**Validation rules**:
- A guard is **invalid** if any `allowedCapabilities` entry is not registered in the workspace `CapabilityContractRegistry`.
- A guard is **permission-expanding** if `allowedCapabilities` includes a capability not present in the routine's `triggerCapabilities` or `capabilityPattern`, or if `maxSideEffectClass` exceeds the highest side-effect class of the trigger capability.
- `requiresOwnerConfirm=true` overrides any autonomy-level decision to `owner_confirm`.
- `sandboxPolicy=declarative_only` rejects scriptable adapter steps at install time.

**Policy-context evaluation** (performed by `action-closure-policy-system`):
- At install time, the policy evaluator checks `guard.maxSideEffectClass` against the current workspace policy and rejects with `routine_permission_expansion_denied` if the guard would broaden authority.
- At invocation time, the policy evaluator re-checks `allowedCapabilities`, `deniedCapabilities`, and `requiresOwnerConfirm` against real-time affordance posture and owner preference.

**Failure reason codes**:
- `routine_guard_schema_invalid` — grammar error or unknown capability.
- `routine_permission_expansion_denied` — guard would broaden authority beyond the source routine's provenance.
- `routine_guard_policy_denied` — invocation-time policy context rejects the guard.

**Routine health states** (owned by `observability-recovery-system`):
```ts
type RoutineHealthState = "healthy" | "pending_validation" | "degraded" | "denied";
```

---

## 7. ConnectorEvolutionPlan & ConnectorVersion

### 7.1 ConnectorEvolutionPlan

**Owner**: `memory-continuity-system` (Dream/consolidation generates the plan)

```ts
interface ConnectorEvolutionPlan {
  id: string;
  platformId: string; // canonical connector/platform identifier; storage alias: connectorId
  planType: "manifest_delta" | "recipe_delta" | "adapter_delta";
  payloadJson: string; // the proposed change
  status: "proposed" | "gating" | "activated" | "rolled_back" | "blocked";
  gateResults?: GateResult[]; // canonical interchange shape; storage serializes to gateResultsJson
  previousStableRef?: string; // ref to previous stable ConnectorVersion.id
  rollbackCommandHint?: string;
  sourceRefs: SourceRef[];
  createdAt: string;
}
```

### 7.2 ConnectorVersion

**Owner**: `body-connector-system`

```ts
interface ConnectorVersion {
  id: string;
  versionId: string;
  platformId: string;
  workspaceRoot: string;
  planType: "manifest_delta" | "recipe_delta" | "adapter_delta";
  manifestPath: string; // workspace-relative path
  recipePath?: string;
  adapterPath?: string;
  declaredCapabilities: string[];
  gateResults: GateResult[]; // summary of schema/permission/sandbox/fixture/wet-probe/canary gates
  status: "candidate" | "staged" | "active" | "rolled_back";
  previousStableRef?: string;
  rollbackRef?: string;
  rollbackCommandHint?: string;
  sourceRefs: SourceRef[];
  createdAt: string;
  activatedAt?: string;
  rolledBackAt?: string;
}

interface GateResult {
  gate: string;
  passed: boolean;
  reason?: string;
  evidenceRefs: SourceRef[];
}
```

**Rules**:
- `platformId` is the canonical connector/platform identifier. `connectorId` in storage rows is an alias and must map 1:1 to `platformId`.
- `versionId` is the canonical string identifier exposed in runtime contracts. Storage may keep an integer `sequence` for ordering, but read ports must expose `versionId`.
- `gateResults` is the canonical interchange shape (`GateResult[]`). Storage serializes it as `gateResultsJson`; `body-connector-system` may expand it into per-gate typed fields internally, but cross-system interchange uses `GateResult[]`.

**Activation flow**:
1. `memory-continuity-system` Dream creates `ConnectorEvolutionPlan` with status `proposed`.
2. `body-connector-system` receives plan, runs gates, updates plan status to `gating` / `blocked`.
3. On pass, `body-connector-system` writes `ConnectorVersion` (staged → active) and calls `observability-recovery-system` ledger.
4. `memory-continuity-system` updates plan status to `activated`.
5. `body-connector-system` generates `rollbackCommandHint` at activation time.

---

## 8. AutonomousChangeLedger

**Owner**: `observability-recovery-system`

**Write port** (exposed by observability, consumed by memory-continuity and body-connector):
```ts
interface AutonomousChangeLedgerWritePort {
  writeLedgerEntry(entry: AutonomousChangeLedgerEntry): Promise<void>;
}

interface AutonomousChangeLedgerEntry {
  id: string;
  workspaceRoot: string;
  changeKind: AutonomousChangeKind;
  targetId: string; // routine id or connector id
  previousStableRef?: string;
  status: AutonomousChangeStatus;
  gateResultsJson?: string;
  rollbackRef?: string;
  rollbackCommandHint?: string;
  sourceRefs: SourceRef[];
  redactedPayloadJson?: string;
  createdAt: string;
  activatedAt?: string;
  rolledBackAt?: string;
}

type AutonomousChangeKind =
  | "routine_install"
  | "routine_supersede"
  | "routine_retire"
  | "connector_manifest_delta"
  | "connector_recipe_delta"
  | "connector_adapter_delta";

type AutonomousChangeStatus =
  | "proposed"
  | "gated"
  | "activated"
  | "rolled_back"
  | "blocked";
```

**Rules**:
- Ledger payload must be redacted; no credential values.
- Rollback failure must be reported as `blocked` loop health reason.
- **Canonical type rule**: `AutonomousChangeLedgerEntry` is the single canonical shape. `runtime-ops-system`, `observability-recovery-system`, `memory-continuity-system`, and `body-connector-system` MUST import this type from the shared contracts module; local redefinitions are prohibited to prevent field drift.

---

## 9. ActionClosureRecord

**Owner**: `action-closure-policy-system` (writes); `memory-continuity-system` (persists)

```ts
interface ActionClosureRecord {
  id: string;
  cycleSequence: number;
  intentId?: string;
  actionKind: "no_action" | "remember" | "connector" | "guidance" | "routine";
  decision: "allow" | "defer" | "downgrade" | "deny";
  platformId?: string;
  capabilityId?: string;
  sourceRefs: SourceRef[];
  proofRefs: SourceRef[];
  traceRefs: SourceRef[];
  closureRefs: SourceRef[];
  payloadJson?: string;
  reasonCode: string;
  createdAt: string;
}
```

---

## 10. EmbodiedContext

**Owner**: `control-context-system`

```ts
interface EmbodiedContext {
  identity: ContextSlice<IdentityProfile>;
  goals: ContextSlice<AgentGoal[]>;
  recentInteractions: ContextSlice<Interaction[]>;
  toolExperience: ContextSlice<ToolExperience[]>;
  acceptedDream: ContextSlice<MemoryProjection[]>;
  affordanceMap: ContextSlice<AffordanceMap>;
  selfHealth: ContextSlice<SelfHealthSnapshot>;
  selfContinuityCard: ContextSlice<SelfContinuityCard>;
  characterFramePointer: ContextSlice<CharacterFramePointer>;
  characterFrameProjection: ContextSlice<EmbodiedContextCharacterProjection>;
  activeMemoryProjections: ContextSlice<MemoryProjection[]>;
  activeProceduralProjections: ContextSlice<ProceduralProjection[]>;
  routineList: ContextSlice<RoutineListItem[]>;
  activityThreads: ContextSlice<ActivityThread[]>;
  attentionSignals?: ContextSlice<AttentionSignal[]>;
  assembledAt: string;
}

interface ContextSlice<T> {
  status: "loaded" | "degraded" | "blocked";
  data: T;
  reason?: string;
}
```

**Rules**:
- `selfContinuityCard.characterFramePointer` is a short pointer only.
- `characterFrameProjection` is the independent bounded projection (≤ 900 chars).
- If `characterFrameProjection` is unavailable, include explicit `character_frame_deferred` degraded reason.
- Inner types (`IdentityProfile`, `AgentGoal`, `Interaction`, `MemoryProjection`, `ProceduralProjection`, `AffordanceMap`, `SelfHealthSnapshot`) are owned by their respective systems; see `control-context-system` L1 for the authoritative slice assembly.

---

## 11. Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-06-22 | Added canonical `ActivityThread` / `ActivityStep`, thread suggestion fields on `AttentionSignal`, and `EmbodiedContext.activityThreads` | `/change` closure for multi-heartbeat activity continuity |
| 2026-06-22 | Synchronized `CharacterFrame` full schema, `ToolRoutine.version` as semver string, `ConnectorVersion` asset/gate shape, `EmbodiedContext` full slice shape, `RoutinePointer`, `AttentionActionKind.defer`, `SourceRefFamily.capability_probe_result` | Cross-system design review round 2 (HI-NEW-01~04, ME-NEW-03/04, LO-NEW-02) |
| 2026-06-22 | Added canonical `CharacterRefreshInput` / `CharacterSignal`, bilingual-safe input rules, and first-injection contest activation policy | `/change` closure for challenge CH-01~CH-03 |
| 2026-06-21 | Canonicalized SourceRef, AttentionSignal, SelfContinuityCard, CharacterFrame, ToolRoutine, ConnectorEvolutionPlan, AutonomousChangeLedger, EmbodiedContext | Cross-system review found conflicting enums and ownership |
