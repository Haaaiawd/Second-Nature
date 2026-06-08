# 05B_VERIFICATION_PLAN.md — 验证计划

> 版本: v8
> 产出自: /blueprint
> 最后更新: 2026-06-05
>
> 执行主清单: [05A_TASKS.md](./05A_TASKS.md)

---

## 1. 范围与目标

本验证计划覆盖 v8 Living Perception Loop 的 P0/P1 任务，确保 connector read evidence 能进入 perception、judgment、policy、closure、Quiet/Dream、accepted projection、next EmbodiedContext，并能通过 `loop_status` 解释卡点。

项目验收必须同时包含单元测试与 API 接口功能测试；API 在本 runtime 架构中包含 CLI/OpenClaw ops surface、内部 port contract、state read/write port 和 connector/guidance callable boundary。

---

## 2. 验证分层策略

| 层次 | 负责范围 | 主要工具/材料 |
| --- | --- | --- |
| 单元测试 | 分类、状态机、policy、reason code、projection lifecycle | `node --test` / existing test runner |
| API接口功能测试 | CLI/OpenClaw ops、internal port request/result、state data-changing ports | `tests/api/**` |
| 集成测试 | connector -> state -> perception -> judgment -> action -> quiet/dream | `tests/integration/**` |
| 冒烟测试 | Sprint INT-S gate | `reports/int-s*.md` |
| E2E测试 | v8 full living loop only | `tests/integration/v8/living-perception-loop.test.ts`, optional host logs |
| 回归测试 | v7 connector/runtime/dream/ops surfaces | targeted existing suites |
| 编译/Lint | TypeScript and package safety | `pnpm exec tsc --noEmit`, `pnpm lint`, build logs |

---

## 3. 风险类别覆盖原则

- Risk closure beats test count; representative fixtures are preferred over all-combination matrices.
- Unit tests cover local rules, state transitions, invalid shape, timeout downgrade, and reason-code selection.
- API接口功能测试 covers visible request/response contracts, before/after state change assertions, degraded outputs, and permission/side-effect branches.
- Integration tests cover cross-system handoffs and persistence.
- E2E is restricted to INT-V8 full chain; no browser/manual E2E is executed during blueprint.

---

## 4. 测试材料与证据要求

| 验证类型 | 测试材料位置 | 证据形式 |
| --- | --- | --- |
| 单元测试 | `tests/unit/**` | test runner report / CI log |
| API接口功能测试 | `tests/api/**` | request/result assertions and before/after state logs |
| 集成测试 | `tests/integration/**` | integration report and generated artifacts |
| 冒烟测试 | `reports/int-s*.md` | pass/fail table and bug list |
| E2E测试 | `tests/integration/v8/**` | full-chain report and runtime logs |
| 回归测试 | existing targeted suites | regression report |
| 编译/Lint | build scripts | `logs/pnpm-build.log`, `logs/pnpm-lint.log` |

---

## 5. Task-by-Task 验证计划

### T-SH.C.1
- **关联需求**: REQ-003, REQ-004, REQ-008, REQ-009
- **关联契约**: `PlatformNeutralActionKind`, `SourceRef`, `HeartbeatCycleTrace`, `LoopStageEvent`, `MemoryReviewCandidateClosure`, `DegradedOperationResult`, heartbeat rhythm contract, `V8ReasonCode`
- **风险类别**: 共享类型漂移 / 错误语义 / 可构建性
- **单元测试覆盖**: valid/invalid action side-effect contracts; SourceRef URI/family validation; cycle sequence requirement; heartbeat rhythm vs wall-clock split; degraded response shape; reason-code registry membership.
- **API接口功能测试覆盖**: 不适用；shared type has no callable runtime port.
- **集成/E2E/冒烟覆盖**: INT-S1 contract spine smoke.
- **前置数据**: shared fixture objects.
- **断言**: invalid shape rejected; `run_connector` side effect derived from capability; `remember` maps only to review closure; heartbeat-count SLA uses `cycleSequence`; state-unreadable returns a common degraded result.
- **证据**: `tests/unit/contracts/v8-shared-contracts.test.ts`, `logs/tsc-v8-contracts.log`

### T-SMS.C.1
- **关联需求**: REQ-001, REQ-002, REQ-003, REQ-005, REQ-008, REQ-009
- **关联契约**: v8 state stores and bounded read models
- **风险类别**: 持久化结构 / 数据一致性 / read model drift
- **单元测试覆盖**: entity validation, lifecycle transitions, source ref preservation, invalid state rejection.
- **API接口功能测试覆盖**: state port write/read before-after assertions for all v8 entity families.
- **集成/E2E/冒烟覆盖**: INT-S1 and downstream INT-S2..S5.
- **前置数据**: in-memory SQLite/sql.js test database and v8 fixtures.
- **断言**: persisted rows round-trip with cycle sequence, lifecycle status, redaction posture, and source refs intact.
- **证据**: `tests/unit/storage/v8-state-stores.test.ts`, `tests/api/storage/v8-state-port.test.ts`

### T-OBS.C.1
- **关联需求**: REQ-008, REQ-009
- **关联契约**: `recordLoopStageEvent(event)`
- **风险类别**: 可观测性 / redaction / malformed event handling
- **单元测试覆盖**: required fields, canonical reason codes, redaction class, malformed event degraded diagnostic.
- **API接口功能测试覆盖**: event port accepts valid event and rejects/diagnoses invalid event without raw payload.
- **集成/E2E/冒烟覆盖**: INT-S1, INT-S5.
- **前置数据**: `HeartbeatCycleTrace`, stage event fixtures.
- **断言**: valid events append; malformed events do not crash; raw secret/private payload is not emitted.
- **证据**: `tests/unit/observability/loop-stage-event-sink.test.ts`, `tests/api/observability/loop-stage-event-port.test.ts`

### T-CS.C.1
- **关联需求**: REQ-001
- **关联契约**: ConnectorResult -> EvidenceItem normalization
- **风险类别**: connector truth / dedupe / no-fabrication / truncation
- **单元测试覆盖**: mapping success result, duplicate content hash, empty array, failure result, over-100 truncation.
- **API接口功能测试覆盖**: connector execution adapter returns evidence normalization result and before-after state counts.
- **集成/E2E/冒烟覆盖**: INT-S2.
- **前置数据**: MoltBook feed fixture and connector result fixture.
- **断言**: each public feed item becomes EvidenceItem with contentHash, platform id, observedAt, SourceRef, sensitivity class.
- **证据**: `tests/unit/connectors/evidence-normalizer.test.ts`, `tests/integration/connectors/v8-evidence-normalization.test.ts`

### T-PJ.C.1
- **关联需求**: REQ-007
- **关联契约**: context-aware sensitivity classification
- **风险类别**: false positive sensitive block / credential leakage
- **单元测试覆盖**: public technical vocabulary, bearer token shape, private key header, assignment-like secret, private context.
- **API接口功能测试覆盖**: classifier port returns expected class and diagnostic reason for representative payloads.
- **集成/E2E/冒烟覆盖**: INT-S2, T-OBS.C.3.
- **前置数据**: public technical and credential-shaped fixtures.
- **断言**: keywords alone do not block; value-like secret shape blocks raw exposure.
- **证据**: `tests/unit/perception/sensitivity-classifier.test.ts`, `tests/api/perception/sensitivity-port.test.ts`

### T-PJ.C.2
- **关联需求**: REQ-002, REQ-007
- **关联契约**: `buildPerceptionCards(cycleId)`, `PerceptionCard`
- **风险类别**: perception loss / model fallback / duplicate noise
- **单元测试覆盖**: summary, topic/entities, novelty, relevance, risk flags, reviewPriority, model timeout rules-only.
- **API接口功能测试覆盖**: perception port writes cards and returns empty/truncated/degraded reasons.
- **集成/E2E/冒烟覆盖**: INT-S2.
- **前置数据**: EvidenceItem batch fixtures.
- **断言**: cards are source-backed, deduped, bounded, and safe under model failure.
- **证据**: `tests/unit/perception/perception-builder.test.ts`, `tests/api/perception/perception-port.test.ts`

### T-PJ.C.3
- **关联需求**: REQ-003
- **关联契约**: `runAgentJudgment(perceptionCardId)`, `JudgmentVerdict`
- **风险类别**: unsupported action / missing source refs / low-confidence write action
- **单元测试覆盖**: high relevance action, missing source refs downgrade, risk blocked, low confidence, remember review priority.
- **API接口功能测试覆盖**: judgment port request/result and before-after verdict persistence.
- **集成/E2E/冒烟覆盖**: INT-S2, INT-S3.
- **前置数据**: PerceptionCard fixtures, goals, memory projection, affordance map.
- **断言**: external write verdicts require confidence and source refs; remember remains review intent.
- **证据**: `tests/unit/judgment/judgment-engine.test.ts`, `tests/api/judgment/judgment-port.test.ts`

### T-CP.C.1
- **关联需求**: REQ-002, REQ-003, REQ-008, REQ-009
- **关联契约**: `HeartbeatCycleTrace`, perception/judgment orchestration
- **风险类别**: control-plane bloat / cycle ordering / degraded orchestration
- **单元测试覆盖**: cycle sequence increments, degraded perception path, no semantic judgment in control-plane.
- **API接口功能测试覆盖**: heartbeat check exposes cycle trace and invokes ports with correct request shape.
- **集成/E2E/冒烟覆盖**: INT-S2, T-OBS.C.2.
- **前置数据**: pending evidence and mock ports.
- **断言**: ordered cycle trace exists and semantic decisions are delegated.
- **证据**: `tests/unit/control-plane/heartbeat-cycle-trace.test.ts`, `tests/integration/control-plane/perception-judgment-orchestration.test.ts`

### T-BT.C.1
- **关联需求**: REQ-004, REQ-009
- **关联契约**: capability side-effect affordance
- **风险类别**: read/write action misclassification / breaker bypass
- **单元测试覆盖**: read, write, local, unknown side effects and breaker open posture.
- **API接口功能测试覆盖**: tool affordance port returns side-effect class and breaker state.
- **集成/E2E/冒烟覆盖**: INT-S3.
- **前置数据**: connector manifest/capability fixtures.
- **断言**: `run_connector` effective side effect comes from capability metadata.
- **证据**: `tests/unit/body/affordance-side-effect.test.ts`, `tests/api/body/tool-affordance-v8.test.ts`

### T-AC.C.1
- **关联需求**: REQ-003, REQ-004, REQ-009
- **关联契约**: `buildActionProposal`, `MemoryReviewCandidateClosure`
- **风险类别**: memory boundary violation / proposal shape drift
- **单元测试覆盖**: normal proposal, no-action result, missing source refs, remember-for-review closure.
- **API接口功能测试覆盖**: action proposal port writes proposal/closure candidate and does not write projection.
- **集成/E2E/冒烟覆盖**: INT-S3, INT-S4.
- **前置数据**: JudgmentVerdict fixtures.
- **断言**: `remember` creates review candidate only; external actions carry sideEffectClass.
- **证据**: `tests/unit/action/action-proposal-builder.test.ts`, `tests/api/action/action-proposal-port.test.ts`

### T-AC.C.2
- **关联需求**: REQ-004
- **关联契约**: `evaluateActionPolicy`
- **风险类别**: policy bypass / permission drift / side-effect misclassification
- **单元测试覆盖**: allow/defer/downgrade/deny table by sideEffectClass, permission, risk, source refs, breaker.
- **API接口功能测试覆盖**: policy evaluation port returns decision and canonical reason for representative requests.
- **集成/E2E/冒烟覆盖**: INT-S3.
- **前置数据**: proposals, platform profiles, owner preferences, affordance map.
- **断言**: external write requires permission, low risk, source refs, and healthy affordance.
- **证据**: `tests/unit/action/autonomy-policy-evaluator.test.ts`, `tests/api/action/policy-evaluation-port.test.ts`

### T-AC.C.3
- **关联需求**: REQ-004, REQ-009
- **关联契约**: policy-bound dispatch
- **风险类别**: duplicate write / delivery truthfulness / downgrade failure
- **单元测试覆盖**: no dispatch for deny/defer, idempotency, connector failure, guidance draft success, guidance unavailable fallback.
- **API接口功能测试覆盖**: dispatch port returns connector/guidance output refs or `guidance_unavailable` downgraded dispatch result, and no raw platform write without proof.
- **集成/E2E/冒烟覆盖**: INT-S3.
- **前置数据**: allowed and downgraded decisions.
- **断言**: connector writes include proof/idempotency; downgraded actions produce draft only when guidance is available; guidance-unavailable downgrade returns closure-ready `closure_downgraded_without_draft` input.
- **证据**: `tests/unit/action/policy-bound-dispatch.test.ts`, `tests/integration/action/dispatch-to-connector-guidance.test.ts`

### T-AC.C.4
- **关联需求**: REQ-009
- **关联契约**: `recordActionClosure`, `ActionClosureRecord`, `no_action_reason`, idempotent closure retry semantics
- **风险类别**: silent no-op / failed action lost / closure state drift
- **单元测试覆盖**: completed, no_action, denied, deferred, downgraded, downgraded-without-draft, failed statuses, duplicate idempotency key, retry attempt linkage.
- **API接口功能测试覆盖**: closure port before-after state assertions for each status.
- **集成/E2E/冒烟覆盖**: INT-S3, INT-S4.
- **前置数据**: decision/output/no-action fixtures.
- **断言**: every heartbeat outcome writes exactly one closure or no-action record; duplicate dispatch does not create duplicate external write or unlinked closure.
- **证据**: `tests/unit/action/action-closure-recorder.test.ts`, `tests/api/action/action-closure-port.test.ts`

### T-DQ.C.1
- **关联需求**: REQ-005, REQ-009
- **关联契约**: `runQuietDailyReview`, `QuietDailyReview`, memory-review candidate consumption
- **风险类别**: memory signal loss / empty input ambiguity / redaction boundary
- **单元测试覆盖**: closure input, memory candidate priority, important perception input, empty input, redaction block.
- **API接口功能测试覆盖**: quiet review port writes review/diary and returns blocked/empty reasons.
- **集成/E2E/冒烟覆盖**: INT-S4.
- **前置数据**: action closures and memory review candidates.
- **断言**: remember-for-review is preserved as review material and not projected directly.
- **证据**: `tests/unit/quiet/quiet-daily-review-builder.test.ts`, `tests/api/quiet/quiet-review-port.test.ts`

### T-DQ.C.2
- **关联需求**: REQ-006
- **关联契约**: `scheduleDreamAfterQuiet`, Dream lifecycle trace
- **风险类别**: fire-and-forget loss / scheduler unavailable ambiguity
- **单元测试覆盖**: scheduled, duplicate schedule, scheduler unavailable, failed trace.
- **API接口功能测试覆盖**: schedule port returns canonical reason and writes lifecycle rows.
- **集成/E2E/冒烟覆盖**: INT-S4, INT-S5.
- **前置数据**: completed Quiet review.
- **断言**: scheduler unavailable writes `dream_scheduler_unavailable`.
- **证据**: `tests/unit/dream/dream-scheduler-lifecycle.test.ts`, `tests/api/dream/dream-schedule-port.test.ts`

### T-DQ.C.3
- **关联需求**: REQ-005, REQ-006, REQ-007
- **关联契约**: `runDreamConsolidation`, Dream candidate validation, redaction blocked output
- **风险类别**: false sensitive block / model timeout / invalid candidate
- **单元测试覆盖**: rules-only, hybrid model, timeout, redaction block, missing source refs, public technical.
- **API接口功能测试覆盖**: consolidation port returns candidate/completed or blocked/failed with reason.
- **集成/E2E/冒烟覆盖**: INT-S4.
- **前置数据**: QuietDailyReview and redacted evidence bundle.
- **断言**: public technical vocabulary is not blocked; credential-shaped raw exposure is blocked.
- **证据**: `tests/unit/dream/dream-consolidation-runner.test.ts`, `tests/api/dream/dream-consolidation-port.test.ts`

### T-DQ.C.4
- **关联需求**: REQ-005, REQ-006
- **关联契约**: `acceptMemoryProjection`, projection lifecycle
- **风险类别**: direct projection bypass / supersession conflict / stale memory
- **单元测试覆盖**: accept, reject, active, supersede, retire, source missing.
- **API接口功能测试覆盖**: projection port before-after state for accepted and superseded rows.
- **集成/E2E/冒烟覆盖**: INT-S4, INT-V8.
- **前置数据**: validated candidate memory.
- **断言**: only Dream candidates can become active projection; duplicate topic supersedes old projection.
- **证据**: `tests/unit/dream/memory-projection-lifecycle.test.ts`, `tests/api/dream/memory-projection-port.test.ts`

### T-CP.C.2
- **关联需求**: REQ-006
- **关联契约**: accepted projection read model into EmbodiedContext
- **风险类别**: candidate memory leaks into context / stale projection
- **单元测试覆盖**: accepted-only load, superseded exclusion, state unavailable degraded reason.
- **API接口功能测试覆盖**: context state port returns accepted projection slice and rejects candidate projection.
- **集成/E2E/冒烟覆盖**: INT-S4, INT-V8.
- **前置数据**: accepted, candidate, superseded projections.
- **断言**: only accepted/active projections appear in EmbodiedContext.
- **证据**: `tests/unit/control-plane/accepted-projection-loader.test.ts`, `tests/integration/control-plane/embodied-context-v8-memory.test.ts`

### T-OBS.C.2
- **关联需求**: REQ-008
- **关联契约**: `assembleLoopStatus`, `CausalLoopHealthSnapshot`
- **风险类别**: false healthy / false stalled / degraded state masking
- **单元测试覆盖**: healthy, no_data, stalled, blocked, degraded states and stage priority.
- **API接口功能测试覆盖**: loop status read model returns correct `overallStatus`, `stalledAt`, and next action.
- **集成/E2E/冒烟覆盖**: INT-S5.
- **前置数据**: cycle traces, stage events, state counts.
- **断言**: heartbeat-count SLA uses `cycleSequence`, not timestamp guesswork.
- **证据**: `tests/unit/observability/causal-loop-health.test.ts`, `tests/api/runtime/loop-status-read-model.test.ts`

### T-OBS.C.3
- **关联需求**: REQ-007, REQ-008
- **关联契约**: diagnostic redaction and sensitivity attribution
- **风险类别**: secret leakage / false block attribution / raw prompt exposure
- **单元测试覆盖**: public technical, credential-shaped value, private message, raw prompt.
- **API接口功能测试覆盖**: diagnostic projector returns redacted/blocked payload and correct owner stage.
- **集成/E2E/冒烟覆盖**: INT-S5, T-DQ.C.3.
- **前置数据**: diagnostic payload fixtures.
- **断言**: sensitive values never appear in health/audit output.
- **证据**: `tests/unit/observability/diagnostic-redaction.test.ts`, `tests/api/observability/diagnostic-projection.test.ts`

### T-OBS.R.1
- **关联需求**: REQ-006, REQ-008, REQ-009
- **关联契约**: `connector.attempt` audit family, Quiet audit-backed digest visibility, `heartbeat_digest.connectorSummary`, `heartbeat_digest.quietDreamSummary`
- **风险类别**: observability truth gap / digest false empty / audit-store split-brain / raw payload leakage
- **单元测试覆盖**: connector attempt audit envelope creation for success/failure/blocked outcomes; digest fallback counts Quiet audit events; no raw payload or credential appears in digest output.
- **API接口功能测试覆盖**: `connector:run` followed by `heartbeat_digest` returns a non-empty connector summary for the same day with shared audit store wiring.
- **集成/E2E/冒烟覆盖**: targeted runtime-ops regression; no broad E2E trigger.
- **前置数据**: in-memory audit store, manual connector executor fixture, source-backed Quiet result fixture.
- **断言**: manual and heartbeat connector attempts are visible in audit; Quiet run outcomes are visible in digest fallback; missing audit remains honest empty instead of fabricated activity.
- **证据**: `tests/unit/observability/heartbeat-digest-assembler.test.ts`, `tests/unit/ops/manual-run-dispatcher.test.ts`, `tests/integration/runtime-ops/commands.test.ts`

### T-CP.R.2
- **关联需求**: REQ-002, REQ-003, REQ-004, REQ-008, REQ-009
- **关联契约**: real workspace heartbeat spine, `ActionProposal`, `ActionPolicyDecision`, `ActionClosureRecord`, no-action reason, policy/execution/closure stage events
- **风险类别**: split-brain heartbeat / contract-smoke false pass / closure loss / false healthy loop
- **单元测试覆盖**: real-runtime spine coordinator branches for no-action, allow, downgrade, deny, connector failure, and state-write degraded output.
- **API接口功能测试覆盖**: `heartbeat_run` or `heartbeat_check` returns cycle id, closure/no-action id, owner stage on degradation, and CLI/OpenClaw parity fields.
- **集成/E2E/冒烟覆盖**: state-backed v8 runtime integration from evidence through closure; no browser E2E.
- **前置数据**: SQLite/sql.js v8 state fixture with EvidenceItem, PerceptionCard, JudgmentVerdict, policy context, affordance map, and connector/guidance test doubles.
- **断言**: every real heartbeat cycle writes exactly one closure or no-action reason; loop stage events identify missing policy/execution/closure; contract-only smoke cannot satisfy real-run gate.
- **证据**: `tests/unit/control-plane/real-runtime-spine.test.ts`, `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts`, `tests/integration/v8/real-runtime-living-loop.test.ts`

### T-GVS.R.1
- **关联需求**: REQ-003, REQ-004, REQ-008, REQ-009
- **关联契约**: impulse context artifact, `guidance_payload` parity, platform/capability impulse selection, context freshness, no false context-engine registration
- **风险类别**: passive guidance API / agent context invisibility / fake host capability / stale impulse
- **单元测试覆盖**: impulse selection parity for scene kind, capability class, platform override absence, and artifact freshness classification.
- **API接口功能测试覆盖**: setup/heartbeat/guidance context surfaces return artifact pointer, impulse text metadata, freshness status, and degraded reason when missing.
- **集成/E2E/冒烟覆盖**: plugin bridge smoke confirms no context-engine registration and agent-facing setup/heartbeat response exposes the context artifact; optional host manual smoke only.
- **前置数据**: guidance templates, MoltBook feed/reply/publish scene fixtures, workspace root with and without existing impulse artifact.
- **断言**: artifact content matches `guidance_payload` assembly; no response claims external delivery or action decision; plugin manifest remains tool/service honest.
- **证据**: `tests/unit/guidance/impulse-context-artifact.test.ts`, `tests/api/runtime-ops/guidance-context-command.test.ts`, `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`

### T-CS.R.1
- **关联需求**: REQ-004, REQ-009
- **关联契约**: `PolicyBoundConnectorRequest`, MoltBook `post.publish`, MoltBook `comment.reply`, write idempotency, policy proof, closure on write outcome
- **风险类别**: unsafe external write / missing permission / duplicate write / terminal failure without closure / credential leakage
- **单元测试覆盖**: payload validation, missing policy proof rejection, dry-run request construction, idempotency key echo, and credential redaction.
- **API接口功能测试覆盖**: connector write port normal/dry-run path and representative errors for missing content/postId, missing proof, owner-confirm absent, duplicate idempotency.
- **集成/E2E/冒烟覆盖**: policy-bound MoltBook write fixture through dispatch -> connector result -> ActionClosureRecord; no real platform write by default.
- **前置数据**: source-backed draft proposal, policy decision proof, MoltBook API mock, credential context fixture, duplicate idempotency fixture.
- **断言**: no platform write occurs without proof and owner-confirm/dry-run posture; success/failure/downgrade all close; raw credential and raw private payload do not appear in output.
- **证据**: `tests/unit/connectors/moltbook-write-policy.test.ts`, `tests/api/connectors/moltbook-write-port.test.ts`, `tests/integration/action/moltbook-write-closure.test.ts`

### T-DQ.R.2
- **关联需求**: REQ-005, REQ-006, REQ-008, REQ-009
- **关联契约**: daily Quiet cadence, Dream schedule lifecycle, Quiet/Dream absence reasons, projection freshness
- **风险类别**: single heartbeat rhythm / missed daily review / silent Dream absence / stale projection
- **单元测试覆盖**: due-state calculation, duplicate daily schedule guard, quiet empty input, scheduler unavailable, blocked Dream, projection freshness classification.
- **API接口功能测试覆盖**: Quiet/Dream status port returns due/completed/blocked/skipped states with canonical reason codes and before/after state assertions.
- **集成/E2E/冒烟覆盖**: daily cadence integration from completed closures to Quiet review and Dream schedule/absence event; no browser E2E.
- **前置数据**: one day with closures, one day empty, completed Quiet review, scheduler unavailable fixture, projection freshness fixture.
- **断言**: daily Quiet is not dependent on fast heartbeat selecting a quiet intent; Dream absence is explicit; digest and loop_status reflect the same reason.
- **证据**: `tests/unit/dream/daily-rhythm-scheduler.test.ts`, `tests/api/dream/quiet-dream-status-port.test.ts`, `tests/integration/v8/quiet-dream-cadence.test.ts`

### T-OBS.R.2
- **关联需求**: REQ-006, REQ-008, REQ-009
- **关联契约**: real-run causal health, stage freshness, contract-smoke detection, impulse-context freshness, Quiet/Dream absence reason
- **风险类别**: false healthy runtime / diagnostic drift / contract-only evidence accepted as life / redaction leak
- **单元测试覆盖**: health gate classifiers for missing closure, missing impulse artifact, missing Quiet/Dream cadence, stale projection, and contract-smoke-only evidence.
- **API接口功能测试覆盖**: `loop_status` and `heartbeat_digest` return real-run activation status, missing stage, next action, and redacted digest sections.
- **集成/E2E/冒烟覆盖**: repair gate consumes outputs of T-CP.R.2, T-GVS.R.1, T-CS.R.1, and T-DQ.R.2; no broad E2E.
- **前置数据**: real-run state fixture, contract-smoke-only fixture, missing impulse artifact fixture, missing Quiet/Dream fixture.
- **断言**: status is not healthy until real runtime stages have persisted evidence or explicit absence reasons; raw platform payload and credential values are redacted.
- **证据**: `tests/api/runtime-ops/living-loop-health-gate.test.ts`, `tests/integration/v8/real-runtime-living-loop.test.ts`, `reports/int-r1-v8-runtime-activation-repair.md`

### T-GVS.C.1
- **关联需求**: REQ-003, REQ-004, REQ-009
- **关联契约**: policy-bound draft/notify output
- **风险类别**: guidance owns delivery / ungrounded draft / source invalidation
- **单元测试覆盖**: draft, notify, invalid source, style output, no external delivery proof.
- **API接口功能测试覆盖**: guidance proposal port returns source-backed draft/notify response.
- **集成/E2E/冒烟覆盖**: INT-S5.
- **前置数据**: policy-bound ActionProposal.
- **断言**: guidance output carries source refs and never claims delivery.
- **证据**: `tests/unit/guidance/action-proposal-guidance.test.ts`, `tests/api/guidance/guidance-proposal-port.test.ts`

### T-ROS.C.1
- **关联需求**: REQ-006, REQ-008, REQ-009
- **关联契约**: `loop_status` CLI/OpenClaw ops command
- **风险类别**: host parity / degraded health misreport / operator action ambiguity
- **单元测试覆盖**: response mapping from CausalLoopHealthSnapshot.
- **API接口功能测试覆盖**: CLI/plugin command normal and error responses for healthy/no_data/stalled/blocked/degraded.
- **集成/E2E/冒烟覆盖**: INT-S5.
- **前置数据**: loop status fixtures.
- **断言**: OpenClaw and CLI surfaces return equivalent JSON-first response.
- **证据**: `tests/api/runtime-ops/loop-status-command.test.ts`, `tests/integration/runtime-ops/v8-loop-status.test.ts`

### INT-S1
- **关联需求**: S1 exit criteria
- **关联契约**: shared contracts, state stores, stage event sink
- **风险类别**: milestone readiness
- **单元测试覆盖**: 不新增单元测试； consumes S1 task evidence.
- **API接口功能测试覆盖**: 不新增 API tests; verifies task outputs.
- **集成/E2E/冒烟覆盖**: S1 smoke and contract/store integration.
- **前置数据**: S1 tasks completed.
- **断言**: shared contracts compile, state stores round-trip, event sink records valid events.
- **证据**: `reports/int-s1-v8-contract-spine.md`

### INT-S2
- **关联需求**: REQ-001, REQ-002, REQ-003, REQ-007
- **关联契约**: evidence -> perception -> judgment
- **风险类别**: semantic spine break
- **单元测试覆盖**: 不新增单元测试； consumes S2 task evidence.
- **API接口功能测试覆盖**: 不新增 API tests; verifies task API outputs.
- **集成/E2E/冒烟覆盖**: connector read fixture to JudgmentVerdict.
- **前置数据**: S2 tasks completed.
- **断言**: EvidenceItem, PerceptionCard, JudgmentVerdict, and stage events exist.
- **证据**: `reports/int-s2-v8-see-and-judge.md`

### INT-S3
- **关联需求**: REQ-003, REQ-004, REQ-009
- **关联契约**: proposal -> policy -> dispatch -> closure
- **风险类别**: action safety and closure loss
- **单元测试覆盖**: 不新增单元测试； consumes S3 task evidence.
- **API接口功能测试覆盖**: 不新增 API tests; verifies task API outputs.
- **集成/E2E/冒烟覆盖**: all policy decisions and closure statuses, including guidance-unavailable downgrade.
- **前置数据**: S3 tasks completed.
- **断言**: all action outcomes close with source refs and reason; S3 does not depend on T-GVS.C.1 to close downgraded paths.
- **证据**: `reports/int-s3-v8-act-and-close.md`

### INT-S4
- **关联需求**: REQ-005, REQ-006, REQ-009
- **关联契约**: closure -> Quiet -> Dream -> projection
- **风险类别**: memory formation break
- **单元测试覆盖**: 不新增单元测试； consumes S4 task evidence.
- **API接口功能测试覆盖**: 不新增 API tests; verifies task API outputs.
- **集成/E2E/冒烟覆盖**: Quiet/Dream/projection lifecycle.
- **前置数据**: S4 tasks completed.
- **断言**: accepted projection exists or explicit blocked reason exists.
- **证据**: `reports/int-s4-v8-quiet-dream-memory.md`

### INT-S5
- **关联需求**: REQ-006, REQ-007, REQ-008, REQ-009
- **关联契约**: causal loop health and loop_status
- **风险类别**: observability and host parity
- **单元测试覆盖**: 不新增单元测试； consumes S5 task evidence.
- **API接口功能测试覆盖**: loop_status command evidence.
- **集成/E2E/冒烟覆盖**: healthy/stalled/blocked/degraded fixtures.
- **前置数据**: S5 tasks completed.
- **断言**: loop_status explains the correct stalled stage and reason.
- **证据**: `reports/int-s5-v8-explain-the-loop.md`

### INT-V8
- **关联需求**: REQ-001 through REQ-009
- **关联契约**: full living perception loop
- **风险类别**: end-to-end loop closure
- **单元测试覆盖**: 不新增单元测试； consumes all task evidence.
- **API接口功能测试覆盖**: loop_status and state/context API outputs.
- **集成/E2E/冒烟覆盖**: full chain connector read -> next EmbodiedContext.
- **前置数据**: INT-S1..INT-S5 completed.
- **断言**: every stage has output or explicit blocked reason; accepted projection appears in next context when valid.
- **证据**: `reports/int-v8-living-perception-loop.md`, `tests/integration/v8/living-perception-loop.test.ts`, `logs/v8-loop-status.json`

### INT-R1
- **关联需求**: REQ-002 through REQ-009
- **关联契约**: real runtime living-loop activation gate
- **风险类别**: repair backlog incomplete / real runtime still passive / false closure / host visibility gap
- **单元测试覆盖**: 不新增单元测试； consumes repair task unit evidence.
- **API接口功能测试覆盖**: heartbeat, guidance context, MoltBook dry-run, Quiet/Dream status, loop_status, and digest surfaces.
- **集成/E2E/冒烟覆盖**: state-backed real runtime integration plus optional OpenClaw host smoke; no real external platform write unless separately confirmed.
- **前置数据**: T-CP.R.2, T-GVS.R.1, T-CS.R.1, T-DQ.R.2, T-OBS.R.2 completed.
- **断言**: real workspace runtime produces persisted closure/no-action, impulse context, safe write dry-run/owner-confirm evidence, daily Quiet/Dream due or absence state, and non-false `loop_status`.
- **证据**: `reports/int-r1-v8-runtime-activation-repair.md`, `tests/integration/v8/real-runtime-living-loop.test.ts`, `logs/int-r1-loop-status.json`

### T-REG.C.1
- **关联需求**: Definition of Done
- **关联契约**: build/lint/regression gate
- **风险类别**: regression / packaging / CI drift
- **单元测试覆盖**: targeted regression suites.
- **API接口功能测试覆盖**: runtime ops and connector API-style tests included in targeted regression.
- **集成/E2E/冒烟覆盖**: plugin package smoke and v7 key capability checks.
- **前置数据**: INT-V8 completed.
- **断言**: build, lint, targeted regression, and packaging smoke pass or justified skips are documented.
- **证据**: `reports/v8-regression-gate.md`, `logs/pnpm-build.log`, `logs/pnpm-lint.log`

---

## 6. Contract Coverage Overlay

| 契约 | 类型 | 实现承接 | 验证承接 | 状态 |
| --- | --- | --- | --- | :---: |
| Shared v8 action taxonomy | 数据结构 / 错误语义 | T-SH.C.1 | T-SH.C.1 单元测试 | ⬜ |
| `SourceRef` contract | 数据结构 / 审计 | T-SH.C.1, T-SMS.C.1 | T-SH.C.1, T-SMS.C.1 | ⬜ |
| `HeartbeatCycleTrace` | 状态 / 可观测性 | T-SH.C.1, T-CP.C.1 | T-CP.C.1, T-OBS.C.2 | ⬜ |
| Heartbeat rhythm contract | 时间 / SLA | T-SH.C.1, T-CP.C.1, T-OBS.C.2 | T-SH.C.1 单元 + T-OBS.C.2 API接口功能测试 | ⬜ |
| Cross-system degraded response | 错误语义 / root cause | T-SH.C.1, T-OBS.C.1, T-OBS.C.2 | T-SH.C.1 单元 + T-OBS.C.2 API接口功能测试 | ⬜ |
| `LoopStageEvent` | 可观测性 / 持久化 | T-SH.C.1, T-OBS.C.1 | T-OBS.C.1 API接口功能测试 | ⬜ |
| EvidenceItem normalization | 数据结构 / connector contract | T-CS.C.1 | T-CS.C.1 单元 + 集成 | ⬜ |
| `SensitivityClassifier` | 安全 / 错误语义 | T-PJ.C.1 | T-PJ.C.1 单元 + API接口功能测试 | ⬜ |
| `buildPerceptionCards` | 操作契约 | T-PJ.C.2 | T-PJ.C.2 单元 + API接口功能测试 | ⬜ |
| `runAgentJudgment` | 操作契约 | T-PJ.C.3 | T-PJ.C.3 单元 + API接口功能测试 | ⬜ |
| capability side-effect affordance | 数据结构 / policy input | T-BT.C.1 | T-BT.C.1 单元 + API接口功能测试 | ⬜ |
| `buildActionProposal` | 操作契约 | T-AC.C.1 | T-AC.C.1 单元 + API接口功能测试 | ⬜ |
| `MemoryReviewCandidateClosure` | 状态 / memory boundary | T-AC.C.1, T-DQ.C.1 | T-AC.C.1, T-DQ.C.1 | ⬜ |
| `evaluateActionPolicy` | 安全 / 操作契约 | T-AC.C.2 | T-AC.C.2 单元 + API接口功能测试 | ⬜ |
| policy-bound dispatch | 操作契约 / side effect | T-AC.C.3 | T-AC.C.3 单元 + 集成 | ⬜ |
| `ActionClosureRecord` | 持久化 / closure ledger | T-AC.C.4 | T-AC.C.4 API接口功能测试 | ⬜ |
| Idempotent closure retry | 运行承诺 / duplicate write | T-AC.C.3, T-AC.C.4 | T-AC.C.3 单元 + T-AC.C.4 API接口功能测试 | ⬜ |
| `runQuietDailyReview` | 操作契约 / memory input | T-DQ.C.1 | T-DQ.C.1 单元 + API接口功能测试 | ⬜ |
| `scheduleDreamAfterQuiet` | 操作契约 / lifecycle | T-DQ.C.2 | T-DQ.C.2 API接口功能测试 | ⬜ |
| `runDreamConsolidation` | 操作契约 / redaction | T-DQ.C.3 | T-DQ.C.3 单元 + API接口功能测试 | ⬜ |
| projection lifecycle | 状态 / memory read model | T-DQ.C.4 | T-DQ.C.4 单元 + API接口功能测试 | ⬜ |
| accepted projection in EmbodiedContext | read model / context | T-CP.C.2 | T-CP.C.2 集成 | ⬜ |
| `assembleLoopStatus` | ops read model | T-OBS.C.2 | T-OBS.C.2 API接口功能测试 | ⬜ |
| diagnostic redaction attribution | 安全 / observability | T-OBS.C.3 | T-OBS.C.3 单元 + API接口功能测试 | ⬜ |
| audit-backed digest closure | 可观测性 / read model | T-OBS.R.1 | T-OBS.R.1 单元 + API接口功能测试 + 集成 | ⬜ |
| guidance proposal consumption | operation contract | T-GVS.C.1 | T-GVS.C.1 API接口功能测试 | ⬜ |
| `loop_status` runtime command | CLI/OpenClaw API | T-ROS.C.1 | T-ROS.C.1 API接口功能测试 | ⬜ |
| real runtime heartbeat spine | 操作契约 / runtime bridge | T-CP.R.2 | T-CP.R.2 单元 + API接口功能测试 + 集成 | ⬜ |
| impulse context artifact | agent-facing context / guidance | T-GVS.R.1 | T-GVS.R.1 单元 + API接口功能测试 + 集成/手动 | ⬜ |
| policy-bound MoltBook write | connector action / external write safety | T-CS.R.1 | T-CS.R.1 单元 + API接口功能测试 + 集成 | ⬜ |
| independent Quiet/Dream cadence | rhythm / async lifecycle | T-DQ.R.2 | T-DQ.R.2 单元 + API接口功能测试 + 集成 | ⬜ |
| real living-loop health gate | observability / read model | T-OBS.R.2 | T-OBS.R.2 API接口功能测试 + 集成 + report | ⬜ |
| Runtime Activation Repair Gate | 集成契约 | INT-R1 | INT-R1 集成 + 冒烟 + 手动 | ⬜ |
| Full living loop DoD | 集成契约 | INT-V8 | INT-V8 集成/E2E/冒烟 | ⬜ |

---

## 7. Testing Coverage Overlay

| 测试责任 | 风险类别 | 覆盖方法 | 任务承接 | 测试材料 | 状态 |
| --- | --- | --- | --- | --- | :---: |
| Shared contracts valid/invalid shapes | contract drift | 单元测试 + compile check | T-SH.C.1 | `tests/unit/contracts/v8-shared-contracts.test.ts` | ⬜ |
| State store before/after | persistence | API接口功能测试 + integration | T-SMS.C.1 | `tests/api/storage/v8-state-port.test.ts` | ⬜ |
| Evidence normalization no-fabrication | connector truth | 单元 + 集成 | T-CS.C.1 | `tests/integration/connectors/v8-evidence-normalization.test.ts` | ⬜ |
| Public technical vs credential shape | security | 单元 + API接口功能测试 | T-PJ.C.1 | `tests/unit/perception/sensitivity-classifier.test.ts` | ⬜ |
| Perception fallback and dedupe | semantic transformation | 单元 + API接口功能测试 | T-PJ.C.2 | `tests/api/perception/perception-port.test.ts` | ⬜ |
| Judgment source and confidence guard | autonomy safety | 单元 + API接口功能测试 | T-PJ.C.3 | `tests/api/judgment/judgment-port.test.ts` | ⬜ |
| Heartbeat cycle ordering | causal health | 单元 + 集成 | T-CP.C.1, T-OBS.C.2 | `tests/unit/control-plane/heartbeat-cycle-trace.test.ts` | ⬜ |
| Cross-system degraded state unreadable | root-cause attribution | 单元 + API接口功能测试 | T-SH.C.1, T-OBS.C.2 | `tests/unit/contracts/v8-shared-contracts.test.ts` | ⬜ |
| Capability side-effect classification | policy input | 单元 + API接口功能测试 | T-BT.C.1 | `tests/api/body/tool-affordance-v8.test.ts` | ⬜ |
| Policy allow/defer/downgrade/deny | safety boundary | table-driven unit + API接口功能测试 | T-AC.C.2 | `tests/unit/action/autonomy-policy-evaluator.test.ts` | ⬜ |
| Action closure statuses | closure reliability | 单元 + API接口功能测试 | T-AC.C.4 | `tests/api/action/action-closure-port.test.ts` | ⬜ |
| Idempotent closure retry | duplicate write prevention | 单元 + API接口功能测试 | T-AC.C.3, T-AC.C.4 | `tests/unit/action/action-closure-recorder.test.ts` | ⬜ |
| Quiet review memory candidate consumption | memory boundary | 单元 + API接口功能测试 | T-DQ.C.1 | `tests/api/quiet/quiet-review-port.test.ts` | ⬜ |
| Connector/Quiet digest visibility | audit truth | 单元 + API接口功能测试 + 集成 | T-OBS.R.1 | `tests/integration/runtime-ops/commands.test.ts` | ⬜ |
| Dream lifecycle diagnostics | async lifecycle | 单元 + API接口功能测试 | T-DQ.C.2 | `tests/api/dream/dream-schedule-port.test.ts` | ⬜ |
| Dream redaction and candidate validation | security + memory | 单元 + API接口功能测试 | T-DQ.C.3 | `tests/api/dream/dream-consolidation-port.test.ts` | ⬜ |
| Projection lifecycle supersession | long-term memory consistency | 单元 + API接口功能测试 | T-DQ.C.4 | `tests/api/dream/memory-projection-port.test.ts` | ⬜ |
| loop_status stage diagnosis | observability | API接口功能测试 + integration | T-ROS.C.1, INT-S5 | `tests/api/runtime-ops/loop-status-command.test.ts` | ⬜ |
| Real heartbeat writes closure/no-action | split-brain heartbeat | 单元 + API接口功能测试 + 集成 | T-CP.R.2 | `tests/integration/v8/real-runtime-living-loop.test.ts` | ⬜ |
| Impulse context visible to agent surfaces | passive guidance API | 单元 + API接口功能测试 + plugin bridge | T-GVS.R.1 | `tests/api/runtime-ops/guidance-context-command.test.ts` | ⬜ |
| MoltBook write remains policy-bound | unsafe external write | 单元 + API接口功能测试 + 集成 | T-CS.R.1 | `tests/integration/action/moltbook-write-closure.test.ts` | ⬜ |
| Quiet/Dream due and absence states | single rhythm / silent Dream absence | 单元 + API接口功能测试 + 集成 | T-DQ.R.2 | `tests/integration/v8/quiet-dream-cadence.test.ts` | ⬜ |
| Runtime activation false-health prevention | false healthy | API接口功能测试 + 集成 + report | T-OBS.R.2, INT-R1 | `reports/int-r1-v8-runtime-activation-repair.md` | ⬜ |
| Full living loop | end-to-end value | integration + scoped E2E + smoke | INT-V8 | `tests/integration/v8/living-perception-loop.test.ts` | ⬜ |
| Build/lint/regression | release safety | compile/lint/regression | T-REG.C.1 | `reports/v8-regression-gate.md` | ⬜ |

---

## 8. Verification Traceability Matrix

| REQ/Contract | Task | Verification | Test Material | Evidence | Status |
| --- | --- | --- | --- | --- | :---: |
| REQ-001 Evidence Normalization | T-CS.C.1, INT-S2 | 单元 + 集成 | `tests/unit/connectors/evidence-normalizer.test.ts` | INT-S2 report | ⬜ |
| REQ-002 Perception Card | T-PJ.C.2, T-CP.C.1, INT-S2 | 单元 + API接口功能测试 + 集成 | `tests/api/perception/perception-port.test.ts` | INT-S2 report | ⬜ |
| REQ-003 Judgment Verdict | T-PJ.C.3, T-AC.C.1, INT-S2, INT-S3 | 单元 + API接口功能测试 | `tests/api/judgment/judgment-port.test.ts` | INT-S3 report | ⬜ |
| REQ-004 Common Autonomy Policy | T-BT.C.1, T-AC.C.2, T-AC.C.3, INT-S3 | 单元 + API接口功能测试 + 集成 | `tests/unit/action/autonomy-policy-evaluator.test.ts` | INT-S3 report | ⬜ |
| REQ-005 Quiet/Dream Long-Term Memory | T-DQ.C.1, T-DQ.C.3, T-DQ.C.4, T-CP.C.2, INT-S4 | 单元 + API接口功能测试 + 集成 | `tests/api/dream/memory-projection-port.test.ts` | INT-S4 report | ⬜ |
| REQ-006 Dream/Quiet Closure Repair | T-DQ.C.2, T-DQ.C.3, T-DQ.C.4, T-OBS.C.2, T-OBS.R.1, INT-S4, INT-S5 | API接口功能测试 + 集成 | `tests/api/dream/dream-schedule-port.test.ts`, `tests/unit/observability/heartbeat-digest-assembler.test.ts` | INT-S5 report | ⬜ |
| REQ-007 Context-Aware Sensitivity | T-PJ.C.1, T-OBS.C.3, T-DQ.C.3 | 单元 + API接口功能测试 | `tests/unit/perception/sensitivity-classifier.test.ts` | diagnostic test report | ⬜ |
| REQ-008 Causal Loop Health | T-SH.C.1, T-OBS.C.1, T-CP.C.1, T-OBS.C.2, T-OBS.R.1, T-ROS.C.1, INT-S5 | API接口功能测试 + 集成 | `tests/api/runtime-ops/loop-status-command.test.ts`, `tests/integration/runtime-ops/commands.test.ts` | INT-S5 report | ⬜ |
| REQ-009 Heartbeat Action Closure | T-AC.C.1, T-AC.C.2, T-AC.C.3, T-AC.C.4, T-DQ.C.1, T-OBS.R.1, INT-S3 | 单元 + API接口功能测试 + 集成 | `tests/api/action/action-closure-port.test.ts`, `tests/unit/ops/manual-run-dispatcher.test.ts` | INT-S3 report | ⬜ |
| Shared action contract | T-SH.C.1, T-AC.C.2 | 单元 + API接口功能测试 | `tests/unit/contracts/v8-shared-contracts.test.ts` | contract test logs | ⬜ |
| SourceRef grounding | T-SH.C.1, T-SMS.C.1, T-OBS.C.1 | 单元 + API接口功能测试 | `tests/api/storage/v8-state-port.test.ts` | state port report | ⬜ |
| Heartbeat-count SLA | T-CP.C.1, T-OBS.C.2, T-ROS.C.1 | 单元 + API接口功能测试 | `tests/unit/observability/causal-loop-health.test.ts` | loop_status report | ⬜ |
| Memory review closure | T-AC.C.1, T-AC.C.4, T-DQ.C.1 | 单元 + API接口功能测试 | `tests/api/action/action-closure-port.test.ts` | Quiet review report | ⬜ |
| REQ-002..009 Runtime Activation Repair | T-CP.R.2, T-GVS.R.1, T-CS.R.1, T-DQ.R.2, T-OBS.R.2, INT-R1 | 单元 + API接口功能测试 + 集成 + 冒烟 | `tests/integration/v8/real-runtime-living-loop.test.ts` | `reports/int-r1-v8-runtime-activation-repair.md` | ⬜ |
| Real heartbeat closure | T-CP.R.2, T-OBS.R.2 | 单元 + API接口功能测试 + 集成 | `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts` | real-runtime integration report | ⬜ |
| Impulse context injection | T-GVS.R.1 | 单元 + API接口功能测试 + 集成/手动 | `tests/api/runtime-ops/guidance-context-command.test.ts` | plugin bridge smoke | ⬜ |
| Policy-bound platform write | T-CS.R.1 | 单元 + API接口功能测试 + 集成 | `tests/api/connectors/moltbook-write-port.test.ts` | write closure integration report | ⬜ |
| Independent Quiet/Dream cadence | T-DQ.R.2 | 单元 + API接口功能测试 + 集成 | `tests/api/dream/quiet-dream-status-port.test.ts` | cadence integration report | ⬜ |
| Full v8 DoD | INT-V8, T-REG.C.1 | 集成 + scoped E2E + regression | `tests/integration/v8/living-perception-loop.test.ts` | `reports/int-v8-living-perception-loop.md` | ⬜ |
