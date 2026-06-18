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

### 2.2 Provenance Tier Contract

`sourceRefs`, `proofRefs`, and `traceRefs` are distinct semantic tiers:

| Field | Meaning | May drive perception/memory? |
| --- | --- | :---: |
| `sourceRefs` | Real domain evidence or state objects being reasoned about. | yes |
| `proofRefs` | Runtime, policy, setup, host, or packaging proof artifacts. | no |
| `traceRefs` | Observability/audit/stage-event traces used to explain execution. | no |

Rules:

- Synthetic proofs such as plugin loaded, setup ack, carrier response, or test fixture evidence must not be serialized into `sourceRefs`.
- `proofRefs` and `traceRefs` may support operator diagnostics and closure audit, but they do not count as content-bearing evidence.
- If an existing payload only has `sourceRefs`, implementations must not stuff proof/trace artifacts into it for convenience. Add explicit fields instead.

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
  status: "empty" | "partial" | "blocked" | "unavailable" | "unsafe";
  reason: V8ReasonCode;
  ownerStage: LoopStage;
  sourceRefs: SourceRef[];
  operatorNextAction: string;
  retryable: boolean;
}
```

`degraded` is an aggregate/read-model status only. Stage-level diagnostics and `DegradedOperationResult.status` must use the precise state: `empty`, `partial`, `blocked`, `unavailable`, or `unsafe`.

| Failure family | Required reason | Minimum behavior |
| --- | --- | --- |
| state read unavailable | `state_unreadable` | Return degraded result, emit `LoopStageEvent(status=failed|blocked)`, do not claim healthy. |
| source refs unresolved | `source_refs_unresolved` | Block external write and return owner-stage diagnostic. |
| optional model unavailable | stage-specific rules-only reason | Continue with deterministic fallback where possible. |
| optional guidance unavailable | `guidance_unavailable` | Close downgraded action with `closure_downgraded_without_draft`; do not block heartbeat closure. |
| connector unavailable | `execution_unavailable` | No platform write; record closure failure or deferred retry posture. |

### 4.2 Evidence Level Contract

Operator-facing health/proof surfaces must classify how strong their evidence is:

| evidenceLevel | Meaning |
| --- | --- |
| `carrier_ack` | Host/plugin carrier returned an envelope, but no runtime path was exercised. |
| `contract_smoke` | Static or fixture contract passed. |
| `state_present` | Durable state exists/read succeeded, but no live runtime execution was proven. |
| `real_runtime` | The real runtime path executed and produced stage/closure evidence. |
| `durable_verified` | Real runtime evidence was persisted and replay/readback verified. |

Only `real_runtime` and `durable_verified` may be used as evidence for living-loop health.

### 4.3 EvidenceLevelClassifier

Every operator-facing response must derive `evidenceLevel` from observed execution depth, not from local optimism. The classifier is monotonic within one command: it may stay the same or increase only when the required proof for the next level exists.

| Level | Required proof | Examples | Hard cap |
| --- | --- | --- | --- |
| `carrier_ack` | Host/plugin/CLI produced a JSON envelope but no Second Nature contract path ran. | plugin loaded, command carrier returned, setup hint text read from package | Cannot claim runtime health. |
| `contract_smoke` | Static/fixture contract path ran without proving live state mutation. | package smoke, tool schema present, handler dispatch dry path, v7 adapter-only run | Cannot satisfy living-loop health. |
| `state_present` | Durable state was read or existing rows were observed, but no current live cycle executed. | DB can open, setup ack exists, historical closure rows exist | Cannot prove current runtime. |
| `real_runtime` | Current v8 living-loop command executed and produced stage plus closure/no-action proof for the same `cycleId`. | real `heartbeat_run` with v8 cycle, stage events, and final closure | Requires v8 cycle identity. |
| `durable_verified` | `real_runtime` proof was persisted and read back through the normal read model. | heartbeat result persisted, `loop_status` readback sees same `cycleId` and final closure | Highest operator-facing level. |

Classifier rules:

- `CausalLoopHealthSnapshot.evidenceLevel` is the minimum evidence level across required stage proofs for the reported cycle.
- v7 heartbeat traces, package smoke checks, and host carrier acknowledgements are capped at `contract_smoke`; they cannot be attached to a v8 living-loop cycle because the v8 control plane does not accept v7 heartbeat requests.
- Existing state rows without a current-cycle execution proof are capped at `state_present`.
- Manual host screenshots or logs may support an E2E appendix but cannot raise automated `loop_status` above the strongest machine-readable proof.

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
| `closure_unavailable` | closure | Closure row or finalizer write was unavailable; no closure content may be fabricated. |
| `closure_idempotency_conflict` | closure | More than one terminal closure or incompatible retry exists for the same cycle/idempotency key. |

### 5.3 Perception / Judgment / Observability

| code | owner stage | Meaning |
| --- | --- | --- |
| `perception_rules_only` | perception | Model unavailable; deterministic perception used. |
| `evidence_batch_empty` | perception | No evidence available. |
| `evidence_batch_truncated` | perception | Evidence batch exceeded limit. |
| `evidence_id_only` | perception | Evidence contains only identifiers/refs and cannot support a meaningful perception summary. |
| `evidence_content_missing` | perception | Evidence payload lacks content-bearing fields. |
| `evidence_content_redacted` | perception | Evidence content exists but was redacted or blocked before perception. |
| `judgment_low_confidence` | judgment | Judgment confidence below action threshold. |
| `judgment_missing_source_refs` | judgment | Source refs missing. |
| `source_refs_unresolved` | observability | Required source refs could not be resolved. |
| `state_unreadable` | observability | State probe failed. |
| `stage_event_missing` | observability | Required stage event missing. |
| `host_tool_unavailable` | observability | Host tool discovery did not expose `second_nature_ops`. |
| `host_probe_unsupported` | observability | Host does not expose a machine-readable capability probe. |
| `host_policy_blocked` | observability | Host policy blocks tool or skill projection. |
| `host_probe_timeout` | observability | Host capability probe timed out. |
| `skill_projection_unavailable` | observability | Packaged skill was not discoverable by the host skill registry. |
| `skill_probe_unsupported` | observability | Host skill discovery probe is unsupported. |
