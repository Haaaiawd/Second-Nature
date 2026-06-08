# Shared v8 Contracts

**Status**: Draft
**Date**: 2026-06-01
**Scope**: Shared contracts consumed by v8 system designs.

This file is the single source for cross-system value contracts that would otherwise be duplicated across L0/L1 documents.

---

## 1. Platform-Neutral Action Contract

### 1.1 Action Kind Registry

| kind | sideEffectClass | attentionClass | requiresPolicyDecision | allowedDowngrades | Notes |
| --- | --- | --- | :---: | --- | --- |
| `ignore` | `none` | `none` | no | none | Judgment says no action is needed. |
| `watch` | `local_state` | `none` | no | none | Track locally for later perception/judgment. |
| `remember` | `local_state` | `none` | yes | `watch` | Creates `remember_for_review`; never writes long-term memory directly. |
| `notify_owner` | `owner_attention` | `owner_visible` | yes | `watch` | Owner attention must be source-backed. |
| `draft_reply` | `local_state` | `owner_visible` | yes | `notify_owner`, `watch` | Produces draft only; no external platform write. |
| `auto_reply` | `external_write` | `external_visible` | yes | `draft_reply`, `notify_owner`, `watch` | Requires platform write permission and low risk. |
| `draft_publish` | `local_state` | `owner_visible` | yes | `notify_owner`, `watch` | Produces publish draft only. |
| `auto_publish` | `external_write` | `external_visible` | yes | `draft_publish`, `notify_owner`, `watch` | Requires platform write permission and low risk. |
| `run_connector` | `capability_declared` | `depends_on_capability` | yes | `notify_owner`, `watch` | Effective side effect is derived from connector capability metadata. |

### 1.2 Connector Capability Side Effect

`run_connector` is not inherently read or write. The action policy evaluator must derive the effective side effect from connector capability metadata:

| capabilitySideEffect | Policy posture |
| --- | --- |
| `external_read` | Requires trust, credential posture, rate limits, and source-backed reason. |
| `external_write` | Requires explicit write permission, idempotency key, low risk, and policy proof. |
| `local_state` | Requires state write validation and source refs. |
| `unknown` | Deny or downgrade to `notify_owner`. |

---

## 2. SourceRef Contract

`SourceRef` replaces unconstrained `string[]` in design contracts. Implementations may serialize it as URI strings only if the resolver can recover the same fields.

```ts
interface SourceRef {
  uri: string;
  family:
    | "evidence"
    | "perception"
    | "judgment"
    | "action_closure"
    | "quiet_review"
    | "dream_run"
    | "memory_projection"
    | "tool_experience"
    | "connector_result"
    | "audit";
  id: string;
  redactionClass: "none" | "redacted" | "blocked";
  sensitivityClass?: "public_technical" | "public_general" | "private_context" | "sensitive";
  resolveStatus?: "resolvable" | "missing" | "redacted" | "permission_denied";
  resolveFailureReason?: string;
}
```

### 2.1 URI Shape

```text
sn://{family}/{id}
```

Examples:

```text
sn://evidence/ev_20260601_001
sn://action_closure/ac_20260601_001
sn://memory_projection/mp_20260601_001
```

---

## 3. HeartbeatCycleTrace and LoopStageEvent

### 3.1 HeartbeatCycleTrace

`HeartbeatCycleTrace` is the ordered cycle truth used by `loop_status` to evaluate heartbeat-count SLAs.

```ts
interface HeartbeatCycleTrace {
  cycleId: string;
  cycleSequence: number;
  heartbeatStartedAt: string;
  heartbeatCompletedAt?: string;
  inputCount: number;
  outputCount: number;
  expectedDownstreamByCycle?: number;
  status: "started" | "completed" | "failed" | "degraded";
}
```

### 3.2 LoopStageEvent

```ts
interface LoopStageEvent {
  id: string;
  cycleId: string;
  cycleSequence: number;
  stage: LoopStage;
  status: "started" | "completed" | "skipped" | "blocked" | "failed";
  reason?: V8ReasonCode;
  sourceRefs: SourceRef[];
  redactionClass: "none" | "redacted" | "blocked";
  occurredAt: string;
  expectedDownstreamByCycle?: number;
}
```

`loop_status` must use `cycleSequence` for heartbeat-count requirements and wall-clock timestamps only for stale-duration diagnostics.

---

## 3.3 Heartbeat Rhythm Contract

Heartbeat-count SLAs and wall-clock freshness windows are separate contracts.

| Field / term | Meaning | Owner |
| --- | --- | --- |
| `cycleSequence` | Monotonic workspace-local heartbeat order. Used for "within N heartbeats" requirements. | `control-plane-system` |
| `heartbeatStartedAt` / `heartbeatCompletedAt` | Wall-clock diagnostics for stale-duration and operator display. Not used to infer missed cycles. | `control-plane-system` |
| `expectedDownstreamByCycle` | The latest cycle sequence by which downstream stage output or blocked reason must exist. | Producing stage |
| `heartbeatCadenceHintMs` | Optional configured or observed cadence hint for display only. Absence must not change heartbeat-count SLA evaluation. | `runtime-ops-system` / host |

Rules:

- Evidence-to-perception and perception-to-judgment SLAs are evaluated by `cycleSequence`.
- Quiet/Dream age windows are evaluated by wall-clock timestamps because they describe daily review freshness.
- `loop_status` may show wall-clock stale duration, but `stalledAt` for heartbeat-count stages must be derived from cycle order.

---

## 4. Memory Review Closure Contract

`remember` must close as review input, not as direct long-term memory.

```ts
interface MemoryReviewCandidateClosure {
  closureSubtype: "remember_for_review";
  perceptionRef: SourceRef;
  judgmentVerdictRef: SourceRef;
  topicKey: string;
  memoryIntentReason: string;
  reviewPriority: "low" | "medium" | "high";
  sourceRefs: [SourceRef, ...SourceRef[]];
}
```

Rules:

- `remember_for_review` may only be consumed by Quiet Daily Review.
- `remember_for_review` must not create `LongTermMemoryProjection` directly.
- Quiet may include or reject the candidate, but must preserve the reason.

---

## 4.1 Cross-System Degraded Response Contract

All systems must use the same minimum response shape when shared state, source resolution, or optional ports are unavailable.

```ts
interface DegradedOperationResult {
  status: "degraded" | "blocked";
  reason: V8ReasonCode;
  ownerStage: LoopStage;
  sourceRefs: SourceRef[];
  operatorNextAction: string;
  retryable: boolean;
}
```

| Failure family | Required reason | Minimum behavior |
| --- | --- | --- |
| state read unavailable | `state_unreadable` | Return degraded result, emit `LoopStageEvent(status=failed|blocked)`, do not claim healthy. |
| source refs unresolved | `source_refs_unresolved` | Block external write and return owner-stage diagnostic. |
| optional model unavailable | stage-specific rules-only reason | Continue with deterministic fallback where possible. |
| optional guidance unavailable | `guidance_unavailable` | Close downgraded action with `closure_downgraded_without_draft`; do not block heartbeat closure. |
| connector unavailable | `execution_unavailable` | No platform write; record closure failure or deferred retry posture. |

Each degraded result must preserve `ownerStage` so `loop_status` can attribute root cause instead of surfacing unrelated downstream symptoms.

---

## 5. Reason-Code Registry

### 5.1 Dream / Quiet / Projection

| code | owner stage | Meaning |
| --- | --- | --- |
| `quiet_completed` | quiet | Quiet review completed. |
| `quiet_empty_input` | quiet | No eligible review input existed. |
| `quiet_state_unreadable` | quiet | State read failed. |
| `quiet_validation_failed` | quiet | Review failed source or redaction validation. |
| `dream_scheduled` | dream | Dream run scheduled after Quiet. |
| `dream_scheduler_unavailable` | dream | Scheduler port was missing or unavailable. |
| `dream_started` | dream | Dream run started. |
| `dream_completed` | dream | Dream run completed. |
| `dream_failed` | dream | Dream execution failed. |
| `dream_blocked_redaction` | dream | Redaction blocked model/raw exposure. |
| `projection_candidate_created` | projection | Candidate memory created. |
| `projection_accepted` | projection | Candidate accepted into active projection. |
| `projection_rejected` | projection | Candidate rejected. |
| `projection_superseded` | projection | Active projection replaced by newer accepted memory. |

### 5.2 Action / Policy / Closure

| code | owner stage | Meaning |
| --- | --- | --- |
| `proposal_created` | policy | Action proposal created. |
| `proposal_no_action` | closure | Cycle has no actionable proposal. |
| `policy_allowed` | policy | Action allowed. |
| `policy_deferred_owner_confirmation` | policy | Owner confirmation required. |
| `policy_downgraded_to_draft` | policy | Auto action downgraded to draft. |
| `policy_denied_missing_permission` | policy | Platform/capability permission missing. |
| `policy_denied_high_risk` | policy | Risk posture blocks action. |
| `policy_denied_breaker_open` | policy | Body-tool circuit breaker blocks action. |
| `guidance_unavailable` | execution | Guidance port is unavailable; no draft was generated. |
| `closure_completed` | closure | Action closed successfully. |
| `closure_no_action` | closure | No action was required. |
| `closure_denied` | closure | Policy denial closed the cycle. |
| `closure_deferred` | closure | Deferred action closed the cycle. |
| `closure_downgraded` | closure | Downgraded action closed the cycle. |
| `closure_downgraded_without_draft` | closure | Downgraded action closed without draft output because guidance was unavailable. |
| `closure_failed` | closure | Execution or draft generation failed. |

### 5.3 Perception / Judgment / Observability

| code | owner stage | Meaning |
| --- | --- | --- |
| `perception_rules_only` | perception | Model unavailable; deterministic perception used. |
| `evidence_batch_empty` | perception | No evidence available. |
| `evidence_batch_truncated` | perception | Evidence batch exceeded limit. |
| `judgment_low_confidence` | judgment | Judgment confidence below action threshold. |
| `judgment_missing_source_refs` | judgment | Source refs missing. |
| `source_refs_unresolved` | observability | Required source refs could not be resolved. |
| `state_unreadable` | observability | State probe failed. |
| `stage_event_missing` | observability | Required stage event missing. |
