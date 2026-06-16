# 05B_VERIFICATION_PLAN.md — 验证计划

> 版本: v8
> 产出自: /blueprint
> 最后更新: 2026-06-11
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

### T-CP.R.3
- **关联需求**: REQ-005, REQ-006, REQ-008, REQ-009
- **关联契约**: closure -> Quiet/Dream runtime advancement, daily rhythm state, real-run health gate input
- **风险类别**: post-closure stall / Quiet never triggered / Dream absence hidden / operator false diagnosis
- **单元测试覆盖**: heartbeat rhythm advancement coordinator for closure, no-action closure, Quiet empty, Quiet blocked, Dream scheduled, Dream blocked.
- **API接口功能测试覆盖**: `heartbeat_check` before/after state assertions prove daily rhythm state is written after state-backed closure/no-action.
- **集成/E2E/冒烟覆盖**: real runtime integration from heartbeat closure into Quiet/Dream state and loop_status parity; optional host JSON smoke only.
- **前置数据**: state-backed heartbeat fixture with closure/no-action output, existing daily rhythm empty state, Dream scheduler available/unavailable fixtures.
- **断言**: ActionClosureRecord for today cannot remain the final stage without daily rhythm state or explicit blocked/empty reason.
- **证据**: `tests/api/runtime-ops/heartbeat-rhythm-advance.test.ts`, `tests/integration/v8/real-runtime-quiet-dream-advance.test.ts`, `logs/int-r3-loop-status.json`

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

### T-CS.R.2
- **关联需求**: REQ-001, REQ-008, REQ-009
- **关联契约**: connector failure taxonomy, HTTP status mapping, read failure no-fabrication, connector availability diagnostics
- **风险类别**: unknown failure bucket / wrong operator action / fabricated evidence / credential leak
- **单元测试覆盖**: failure taxonomy mapping for MoltBook and Agent-world 401/403, 404/422, 429, 5xx, malformed body, timeout, and truly unknown errors.
- **API接口功能测试覆盖**: connector execution adapter returns actionable failure classes and redacted detail for representative read failures.
- **集成/E2E/冒烟覆盖**: failed connector read through heartbeat/evidence normalization writes no fabricated EvidenceItem and surfaces the connector reason in loop_status/digest.
- **前置数据**: MoltBook/Agent-world API mocks, credential missing/expired fixtures, empty read fixture, redaction fixture.
- **断言**: `unknown_platform_change` is not used for known HTTP/auth/config branches; connector failure does not create EvidenceItem or PerceptionCard.
- **证据**: `tests/unit/connectors/failure-taxonomy.test.ts`, `tests/api/connectors/connector-failure-truth.test.ts`, `tests/integration/connectors/read-failure-no-fabrication.test.ts`

### T-CS.R.3
- **关联需求**: REQ-001, REQ-008, REQ-009
- **关联契约**: connector cooldown state, repeated terminal failure suppression, retry-after semantics, operator reset/retry guidance
- **风险类别**: infinite heartbeat replay / observability noise growth / connector hammering / stale failure loop
- **单元测试覆盖**: cooldown state creation, expiry, reset, retry-after calculation, terminal vs retryable failure behavior.
- **API接口功能测试覆盖**: route-planner or connector execution port reads cooldown before dispatch and writes cooldown after repeated terminal failures with before/after assertions.
- **集成/E2E/冒烟覆盖**: heartbeat integration verifies repeated same platform/capability failure becomes cooldown-blocked and later retry resumes after expiry/reset.
- **前置数据**: repeated MoltBook read terminal failure fixture, active cooldown row, expired cooldown row, successful recovery fixture.
- **断言**: identical connector failures do not replay every heartbeat; successful recovery clears or bypasses stale cooldown according to policy.
- **证据**: `tests/unit/connectors/connector-cooldown.test.ts`, `tests/api/connectors/connector-cooldown-port.test.ts`, `tests/integration/control-plane/connector-replay-cooldown.test.ts`

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

### T-VERIFY.R.1
- **关联需求**: REQ-002, REQ-005, REQ-006, REQ-008, REQ-009
- **关联契约**: runtime proof truth, handoff artifact completeness, no manually seeded closure as success proof
- **风险类别**: false-green milestone / missing artifacts / seeded state mistaken for runtime activity
- **单元测试覆盖**: 不新增纯单元；uses focused integration proof and artifact checks.
- **API接口功能测试覆盖**: loop_status JSON artifact is generated and cross-checked against the report.
- **集成/E2E/冒烟覆盖**: repaired INT-R1 integration fails on seeded-only closure and passes only when runtime-produced closure/no-action evidence exists; no browser E2E.
- **前置数据**: workspace runtime fixture, seeded-only closure fixture, missing artifact fixture, real heartbeat fixture.
- **断言**: missing `reports/int-r1-v8-runtime-activation-repair.md`, `logs/int-r1-loop-status.json`, or `.anws/v8/wave-reviews/wave-106-review.md` fails the gate; runtime-produced closure/no-action is required.
- **证据**: `tests/integration/v8/int-r1-runtime-activation-repair.test.ts`, `reports/int-r1-v8-runtime-activation-repair.md`, `logs/int-r1-loop-status.json`, `.anws/v8/wave-reviews/wave-106-review.md`

### T-OBS.R.3
- **关联需求**: REQ-006, REQ-008, REQ-009
- **关联契约**: real-run health read model, `loop_status`/digest parity, impulse freshness, projection feedback freshness
- **风险类别**: operator false healthy / health helper unwired / digest-status disagreement
- **单元测试覆盖**: real-run health projection mapper for missing closure, stale impulse, missing Quiet/Dream, missing projection feedback, and missing proof artifact.
- **API接口功能测试覆盖**: `loop_status` returns real-run health block, missing stage, and next action; digest returns the same redacted health reason for the same workspace/day.
- **集成/E2E/冒烟覆盖**: runtime-ops integration verifies `loop_status` and `heartbeat_digest` parity; no broad E2E.
- **前置数据**: T-VERIFY.R.1 artifact set, healthy real-run fixture, degraded real-run fixtures.
- **断言**: generic causal health cannot override a failed real-run gate; raw platform payload and credential-like strings are absent.
- **证据**: `tests/api/runtime-ops/loop-status-real-run-gate.test.ts`, `tests/integration/runtime-ops/heartbeat-digest-real-run-gate.test.ts`, `logs/int-r2-loop-status.json`

### T-OBS.R.4
- **关联需求**: REQ-008, REQ-009
- **关联契约**: `decision_denied` attribution, hard-guard reason projection, connector replay/cooldown diagnostics, redacted operator next action
- **风险类别**: governance false blame / hidden hard-guard cause / repeated failure noise / operator cannot repair
- **单元测试覆盖**: attribution mapper for hard guard deny/defer, connector terminal failure, cooldown block, source absence, quiet suppression, awaiting user, and true policy/governance denial.
- **API接口功能测试覆盖**: loop_status/digest expose denial/replay attribution fields and next action without leaking raw payload or credentials.
- **集成/E2E/冒烟覆盖**: runtime-ops integration cross-checks decision ledger, execution attempts, cooldown rows, and loop_status output for the same heartbeat window.
- **前置数据**: denied heartbeat fixture, deferred heartbeat fixture, repeated connector failure fixture, cooldown active fixture, redacted telemetry fixture.
- **断言**: `decision_denied` counters are explainable by concrete guard/cooldown/policy causes; repeated connector replay is visible as bounded cooldown, not generic governance denial.
- **证据**: `tests/unit/observability/heartbeat-denial-attribution.test.ts`, `tests/api/runtime-ops/loop-status-denial-attribution.test.ts`, `tests/integration/runtime-ops/connector-replay-diagnostics.test.ts`

### T-PJ.R.1
- **关联需求**: REQ-002, REQ-003, REQ-007
- **关联契约**: canonical PerceptionCard novelty/relevance shape
- **风险类别**: type contract drift / judgment misclassification / unsafe schema ambiguity
- **单元测试覆盖**: canonical writes for `noveltyClass`, `relevanceScore`, `relevanceClass`; legacy `recurring/update` and numeric-only relevance normalization or rejection.
- **API接口功能测试覆盖**: perception port before/after assertions verify persisted cards use canonical shape and expose drift diagnostics for legacy input.
- **集成/E2E/冒烟覆盖**: perception -> judgment integration verifies judgment consumes canonical relevance and novelty without semantic regression.
- **前置数据**: new/changed/duplicate/stale evidence fixtures, legacy cards, public technical and sensitive fixtures.
- **断言**: new writes do not persist ambiguous `recurring/update` novelty; relevance class and score remain consistent.
- **证据**: `tests/unit/perception/perception-contract-alignment.test.ts`, `tests/api/perception/perception-port.test.ts`, `reports/perception-contract-alignment.md`

### T-DQ.R.3
- **关联需求**: REQ-005, REQ-006, REQ-008, REQ-009
- **关联契约**: projection supersession lifecycle, accepted-only context feedback, projection freshness
- **风险类别**: primary-key conflict / stale memory / candidate memory leak / judgment without memory feedback
- **单元测试覆盖**: accept same-topic candidate, supersede old active projection, reject invalid candidate, retire projection, exclude candidate/superseded rows.
- **API接口功能测试覆盖**: projection port before/after assertions for status transition and accepted-active read model.
- **集成/E2E/冒烟覆盖**: heartbeat context integration proves accepted projection is loaded into the next judgment context; no browser E2E.
- **前置数据**: validated Dream candidate, existing active projection, candidate/superseded fixtures, heartbeat context fixture.
- **断言**: supersession updates old row instead of attempting insert-only overwrite; next heartbeat receives only accepted active memory.
- **证据**: `tests/unit/dream/memory-projection-lifecycle.test.ts`, `tests/api/dream/memory-projection-port.test.ts`, `tests/integration/control-plane/accepted-projection-feedback.test.ts`

### T-DQ.R.4
- **关联需求**: REQ-005, REQ-009
- **关联契约**: `QuietDailyReview.closureRefs`, Dream source grounding, action-closure provenance
- **风险类别**: closure provenance loss / payload JSON coupling / weak self-dialogue trace
- **单元测试覆盖**: Quiet review builder emits closureRefs for reviewed ActionClosureRecords, handles empty input, and preserves redaction boundaries.
- **API接口功能测试覆盖**: Quiet review port read/write round-trips closureRefs and remains compatible with older reviews.
- **集成/E2E/冒烟覆盖**: Quiet/Dream cadence integration proves Dream can source-ground from closureRefs without parsing payload JSON.
- **前置数据**: daily closure slice, empty day, older Quiet review fixture, Dream source grounding fixture.
- **断言**: closureRefs are first-class and redacted; Dream input validation can consume them directly.
- **证据**: `tests/unit/quiet/quiet-daily-review-builder.test.ts`, `tests/api/quiet/quiet-review-port.test.ts`, `tests/integration/v8/quiet-dream-cadence.test.ts`

### T-DQ.R.5
- **关联需求**: REQ-005, REQ-006, REQ-008, REQ-009
- **关联契约**: QuietDailyReview runtime production, DailyDiary absence truth, DreamConsolidationRun scheduling, blocked/empty memory reason, closureRefs grounding
- **风险类别**: Quiet stage deadlock / Dream no-input ambiguity / silent diary absence / memory formation false empty
- **单元测试覆盖**: daily rhythm scheduler writes QuietDailyReview from closure-day slice, preserves closureRefs, distinguishes empty input, blocked input, missing diary source, and redaction block.
- **API接口功能测试覆盖**: Quiet/Dream runtime chain port before/after assertions for QuietDailyReview, daily rhythm state, DreamConsolidationRun, and absence reason fields.
- **集成/E2E/冒烟覆盖**: heartbeat closure -> daily rhythm -> Quiet -> Dream schedule/block -> loop_status/digest parity; no browser E2E.
- **前置数据**: ActionClosureRecord day slice, no existing QuietDailyReview, diary present/absent fixtures, Dream scheduler available/unavailable fixtures.
- **断言**: real closure day with no QuietDailyReview cannot remain silent; Dream zero output is explained as scheduled, blocked, empty, or redaction-blocked.
- **证据**: `tests/unit/dream/daily-rhythm-scheduler.test.ts`, `tests/api/dream/quiet-dream-runtime-chain.test.ts`, `tests/integration/v8/real-runtime-quiet-dream-advance.test.ts`

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

### INT-R2
- **关联需求**: REQ-002, REQ-003, REQ-005, REQ-006, REQ-008, REQ-009
- **关联契约**: proof truth, real-run operator health, canonical perception, projection feedback, Quiet closure provenance
- **风险类别**: proof drift remains open / memory feedback still absent / contract repair not integrated
- **单元测试覆盖**: 不新增单元测试； consumes Wave 107 task evidence.
- **API接口功能测试覆盖**: loop_status, digest, perception, projection, and Quiet review ports are cross-checked through their task evidence.
- **集成/E2E/冒烟覆盖**: one integration gate verifies proof artifacts, health parity, perception contract, projection lifecycle/context feedback, and closureRefs together; optional host smoke only.
- **前置数据**: T-VERIFY.R.1, T-OBS.R.3, T-PJ.R.1, T-DQ.R.3, T-DQ.R.4 completed.
- **断言**: any missing proof artifact, real-run health link, perception canonical field, projection feedback path, or Quiet closureRef fails with a specific missing-link reason.
- **证据**: `reports/int-r2-v8-proof-memory-closure.md`, `tests/integration/v8/proof-memory-closure.test.ts`, `logs/int-r2-loop-status.json`

### INT-R3
- **关联需求**: REQ-001, REQ-005, REQ-006, REQ-008, REQ-009
- **关联契约**: closure -> Quiet/Dream runtime advance, connector failure truth, replay cooldown, denial attribution, real-run health parity
- **风险类别**: runtime still stalls at Quiet / connectors remain opaque / infinite replay / false governance blame / PRD loop not restored
- **单元测试覆盖**: 不新增单元测试；consumes Wave 108 task evidence.
- **API接口功能测试覆盖**: heartbeat rhythm advancement, connector failure truth, connector cooldown, and denial attribution ports are cross-checked through their task evidence.
- **集成/E2E/冒烟覆盖**: one integration gate verifies heartbeat closure advances to Quiet/Dream truth, representative connector failures are classified, repeated failures are cooldown-bounded, and loop_status/digest agree; optional host smoke only.
- **前置数据**: T-CP.R.3, T-DQ.R.5, T-CS.R.2, T-CS.R.3, T-OBS.R.4 completed.
- **断言**: a real heartbeat cannot pass while stuck at Quiet without a precise absence reason; connector failures cannot all collapse into `unknown_platform_change`; repeated failures cannot replay indefinitely.
- **证据**: `reports/int-r3-v8-runtime-recovery-closure.md`, `tests/integration/v8/runtime-recovery-closure.test.ts`, `logs/int-r3-loop-status.json`

### INT-R4
- **关联需求**: REQ-001, REQ-002, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009
- **关联契约**: content-bearing EvidenceItem, readable PerceptionCard, non-template QuietDailyReview, Dream execution lifecycle, UUID sensitivity false-positive fix
- **风险类别**: ref-only evidence / empty Quiet / Dream stuck scheduled / sensitivity scan over-blocking / real loop not producing memory
- **单元测试覆盖**: extractor, dedupe, perception content, Quiet review content, Dream runner lifecycle, write-validation identifier exemption.
- **API接口功能测试覆盖**: evidence normalization port, perception port, Quiet review port, Dream schedule/run port, sensitivity attribution port.
- **集成/E2E/冒烟覆盖**: one integration gate exercises connector fixture -> v8 EvidenceItem -> PerceptionCard -> ActionClosureRecord -> QuietDailyReview -> DreamConsolidationRun -> LongTermMemoryProjection candidate or explicit blocked reason, all with real DB.
- **前置数据**: T-CS.R.4, T-CS.R.5, T-PJ.R.2, T-DQ.R.6, T-DQ.R.7, T-OBS.R.5 completed.
- **断言**: evidence_item > 0 after connector success; perception_card > 0; closure written; quiet_daily_review.payloadJson has no template placeholders; dream_consolidation_run status reaches completed/blocked/failed (not stuck in scheduled); either projection candidate exists or a precise blocked reason is recorded.
- **证据**: `reports/int-r4-v8-content-bearing-loop.md`, `tests/integration/v8/content-bearing-living-loop.test.ts`, `logs/int-r4-loop-status.json`

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
| Shared v8 action taxonomy | 数据结构 / 错误语义 | T-SH.C.1 | T-SH.C.1 单元测试 | ✅ |
| `SourceRef` contract | 数据结构 / 审计 | T-SH.C.1, T-SMS.C.1 | T-SH.C.1, T-SMS.C.1 | ✅ |
| `HeartbeatCycleTrace` | 状态 / 可观测性 | T-SH.C.1, T-CP.C.1 | T-CP.C.1, T-OBS.C.2 | ✅ |
| Heartbeat rhythm contract | 时间 / SLA | T-SH.C.1, T-CP.C.1, T-OBS.C.2 | T-SH.C.1 单元 + T-OBS.C.2 API接口功能测试 | ✅ |
| Cross-system degraded response | 错误语义 / root cause | T-SH.C.1, T-OBS.C.1, T-OBS.C.2 | T-SH.C.1 单元 + T-OBS.C.2 API接口功能测试 | ✅ |
| `LoopStageEvent` | 可观测性 / 持久化 | T-SH.C.1, T-OBS.C.1 | T-OBS.C.1 API接口功能测试 | ✅ |
| EvidenceItem normalization | 数据结构 / connector contract | T-CS.C.1 | T-CS.C.1 单元 + 集成 | ✅ |
| `SensitivityClassifier` | 安全 / 错误语义 | T-PJ.C.1 | T-PJ.C.1 单元 + API接口功能测试 | ✅ |
| `buildPerceptionCards` | 操作契约 | T-PJ.C.2 | T-PJ.C.2 单元 + API接口功能测试 | ✅ |
| `runAgentJudgment` | 操作契约 | T-PJ.C.3 | T-PJ.C.3 单元 + API接口功能测试 | ✅ |
| capability side-effect affordance | 数据结构 / policy input | T-BT.C.1 | T-BT.C.1 单元 + API接口功能测试 | ✅ |
| `buildActionProposal` | 操作契约 | T-AC.C.1 | T-AC.C.1 单元 + API接口功能测试 | ✅ |
| `MemoryReviewCandidateClosure` | 状态 / memory boundary | T-AC.C.1, T-DQ.C.1 | T-AC.C.1, T-DQ.C.1 | ✅ |
| `evaluateActionPolicy` | 安全 / 操作契约 | T-AC.C.2 | T-AC.C.2 单元 + API接口功能测试 | ✅ |
| policy-bound dispatch | 操作契约 / side effect | T-AC.C.3 | T-AC.C.3 单元 + 集成 | ✅ |
| `ActionClosureRecord` | 持久化 / closure ledger | T-AC.C.4 | T-AC.C.4 API接口功能测试 | ✅ |
| Idempotent closure retry | 运行承诺 / duplicate write | T-AC.C.3, T-AC.C.4 | T-AC.C.3 单元 + T-AC.C.4 API接口功能测试 | ✅ |
| `runQuietDailyReview` | 操作契约 / memory input | T-DQ.C.1 | T-DQ.C.1 单元 + API接口功能测试 | ✅ |
| `scheduleDreamAfterQuiet` | 操作契约 / lifecycle | T-DQ.C.2 | T-DQ.C.2 API接口功能测试 | ✅ |
| `runDreamConsolidation` | 操作契约 / redaction | T-DQ.C.3 | T-DQ.C.3 单元 + API接口功能测试 | ✅ |
| projection lifecycle | 状态 / memory read model | T-DQ.C.4 | T-DQ.C.4 单元 + API接口功能测试 | ✅ |
| accepted projection in EmbodiedContext | read model / context | T-CP.C.2 | T-CP.C.2 集成 | ✅ |
| `assembleLoopStatus` | ops read model | T-OBS.C.2 | T-OBS.C.2 API接口功能测试 | ✅ |
| diagnostic redaction attribution | 安全 / observability | T-OBS.C.3 | T-OBS.C.3 单元 + API接口功能测试 | ✅ |
| audit-backed digest closure | 可观测性 / read model | T-OBS.R.1 | T-OBS.R.1 单元 + API接口功能测试 + 集成 | ✅ |
| guidance proposal consumption | operation contract | T-GVS.C.1 | T-GVS.C.1 API接口功能测试 | ✅ |
| `loop_status` runtime command | CLI/OpenClaw API | T-ROS.C.1 | T-ROS.C.1 API接口功能测试 | ✅ |
| real runtime heartbeat spine | 操作契约 / runtime bridge | T-CP.R.2 | T-CP.R.2 单元 + API接口功能测试 + 集成 | ✅ |
| impulse context artifact | agent-facing context / guidance | T-GVS.R.1 | T-GVS.R.1 单元 + API接口功能测试 + 集成/手动 | ✅ |
| policy-bound MoltBook write | connector action / external write safety | T-CS.R.1 | T-CS.R.1 单元 + API接口功能测试 + 集成 | ✅ |
| independent Quiet/Dream cadence | rhythm / async lifecycle | T-DQ.R.2 | T-DQ.R.2 单元 + API接口功能测试 + 集成 | ✅ |
| real living-loop health gate | observability / read model | T-OBS.R.2 | T-OBS.R.2 API接口功能测试 + 集成 + report | ✅ |
| Runtime Activation Repair Gate | 集成契约 | INT-R1 | INT-R1 集成 + 冒烟 + 手动 | ✅ |
| Wave 106 proof truth | verification / handoff artifact | T-VERIFY.R.1 | T-VERIFY.R.1 集成 + 冒烟 + 静态审查 | ✅ |
| operator-facing real-run health | observability / ops read model | T-OBS.R.3 | T-OBS.R.3 API接口功能测试 + 集成 | ✅ |
| canonical PerceptionCard semantics | 数据结构 / semantic contract | T-PJ.R.1 | T-PJ.R.1 单元 + API接口功能测试 + 集成 | ✅ |
| projection feedback into heartbeat context | memory lifecycle / context | T-DQ.R.3 | T-DQ.R.3 单元 + API接口功能测试 + 集成 | ✅ |
| QuietDailyReview closureRefs | memory provenance / source grounding | T-DQ.R.4 | T-DQ.R.4 单元 + API接口功能测试 + 集成 | ✅ |
| Proof Truth and Memory Feedback Gate | 集成契约 | INT-R2 | INT-R2 集成 + 冒烟 + 静态审查 | ✅ |
| heartbeat daily rhythm advancement | runtime orchestration / memory trigger | T-CP.R.3 | T-CP.R.3 API接口功能测试 + 集成 | ✅ |
| Quiet/Dream runtime closure truth | memory lifecycle / absence reason | T-DQ.R.5 | T-DQ.R.5 单元 + API接口功能测试 + 集成 | ✅ |
| connector failure taxonomy truth | 错误语义 / operator repair | T-CS.R.2 | T-CS.R.2 单元 + API接口功能测试 + 集成 | ✅ |
| connector terminal-failure cooldown | replay control / affordance | T-CS.R.3 | T-CS.R.3 单元 + API接口功能测试 + 集成 | ✅ |
| denial and replay attribution | observability / root cause | T-OBS.R.4 | T-OBS.R.4 单元 + API接口功能测试 + 集成 | ✅ |
| Runtime Recovery Closure Gate | 集成契约 | INT-R3 | INT-R3 集成 + 冒烟 + 静态审查 | ✅ |
| Full living loop DoD | 集成契约 | INT-V8 | INT-V8 集成/E2E/冒烟 | ✅ |
| Content-bearing Evidence and Memory Activation Gate | 集成契约 | INT-R4 | INT-R4 集成 + 冒烟 + 静态审查 | ✅ |

---

## 7. Wave 109 Verification Addendum

### T-CS.R.4
- **关联需求**: REQ-001, REQ-007
- **关联契约**: `NormalizedEvidenceContent`, connector result extractor
- **风险类别**: platform-specific extraction / missing fields / raw payload leakage
- **单元测试覆盖**: post, comment, profile, task, event, game_state, notification, document, unknown shapes; missing title/content; nested arrays.
- **API接口功能测试覆盖**: extractor port returns summary, actor, url, sourceKind, summaryProducer for representative payloads.
- **集成/E2E/冒烟覆盖**: INT-R4.
- **前置数据**: connector-system design.
- **断言**: extractor never throws on unknown shape; credential-shaped content is preserved as string but not blocked at extraction stage.
- **证据**: `tests/unit/connectors/normalized-evidence-content.test.ts`

### T-CS.R.5
- **关联需求**: REQ-001, REQ-008, REQ-009
- **关联契约**: EvidenceItem normalization, deduplication, v7/v8 double-write
- **风险类别**: evidence fabrication / duplicate explosion / v7 compatibility break
- **单元测试覆盖**: externalId dedupe, contentHash dedupe, repeat observedAt update, empty/failed result no-fabrication.
- **API接口功能测试覆盖**: evidence normalization port with real DB before/after counts.
- **集成/E2E/冒烟覆盖**: INT-R4, v7 regression.
- **前置数据**: T-CS.R.4.
- **断言**: same `externalId` does not create second row; same content repeated every 30 min updates seen count; v7 LifeEvidence artifact still exists.
- **证据**: `tests/integration/v8/real-evidence-ingestion.test.ts`

### T-PJ.R.2
- **关联需求**: REQ-002, REQ-007
- **关联契约**: `PerceptionCard` readable summary, duplicate/stale novelty, contentMissing flag
- **风险类别**: ref-only perception / false novelty / missing content signal
- **单元测试覆盖**: payload-driven summary/topic/entities, ref-only contentMissing, duplicate novelty.
- **API接口功能测试覆盖**: perception port returns readable cards from content-bearing evidence.
- **集成/E2E/冒烟覆盖**: INT-R4.
- **前置数据**: T-CS.R.5.
- **断言**: card summary is derived from evidence payload; duplicate evidence collapses to one card.
- **证据**: `tests/unit/perception/perception-content-bearing.test.ts`

### T-DQ.R.6
- **关联需求**: REQ-005, REQ-009
- **关联契约**: `QuietReviewPayload`, non-template review, memory candidates
- **风险类别**: template text / fabricated claims / missing source coverage
- **单元测试覆盖**: reviewSummary from evidence/perception/closure, memoryCandidates with sourceRefs, empty input honest reason.
- **API接口功能测试覆盖**: Quiet review port returns readable payload.
- **集成/E2E/冒烟覆盖**: INT-R4.
- **前置数据**: T-PJ.R.2.
- **断言**: payloadJson does not contain "Quiet daily report", "Source-backed quiet summary", or "Evidence-backed note".
- **证据**: `tests/unit/quiet/quiet-review-content.test.ts`

### T-DQ.R.7
- **关联需求**: REQ-005, REQ-006
- **关联契约**: Dream lifecycle scheduled → started → completed/blocked/failed, stale scheduled repair
- **风险类别**: Dream stuck scheduled / silent failure / missing lifecycle trace
- **单元测试覆盖**: scheduled → started → completed, blocked redaction, failed execution, stale repair.
- **API接口功能测试覆盖**: Dream run port transitions status and returns reason.
- **集成/E2E/冒烟覆盖**: INT-R4.
- **前置数据**: T-DQ.R.6.
- **断言**: no run remains `scheduled` after execution; stale scheduled run is repaired; blocked/failed reasons persisted.
- **证据**: `tests/unit/dream/dream-runner-lifecycle.test.ts`

### T-OBS.R.5
- **关联需求**: REQ-007, REQ-008
- **关联契约**: write-validation sensitivity scan, field-level attribution, UUID exemption
- **风险类别**: false positive secret detection / silent rejection / missing diagnostic
- **单元测试覆盖**: UUID passes, sourceRef ID passes, Bearer token fails, API key assignment fails, private key fails, field attribution returned.
- **API接口功能测试覆盖**: sensitivity attribution port returns field and pattern.
- **集成/E2E/冒烟覆盖**: INT-R4.
- **前置数据**: state-memory-system design.
- **断言**: `d7903d94-a6df-40e4-8cee-c2ff80c0ade1` passes validation; `Bearer eyJ...` fails with attribution.
- **证据**: `tests/unit/storage/write-validation-gate-uuid.test.ts`

### T-ROS.R.6
- **关联需求**: REQ-008, REQ-009
- **关联契约**: OpenClaw plugin startup activation, `contracts.tools`, `second_nature_ops` visibility
- **风险类别**: host capability gating / tool invisible despite plugin loaded / stale packaging invariant
- **单元测试覆盖**: 不适用。
- **API接口功能测试覆盖**: packaging walkthrough asserts `activation.onStartup=true`, `contracts.tools` includes `second_nature_ops`, and `activation.onCapabilities` is not required for tool injection.
- **集成/E2E/冒烟覆盖**: plugin bridge registration and Feishu cloud E2E guide.
- **前置数据**: plugin manifest and package metadata.
- **断言**: build/package checks pass without `onCapabilities:["tool"]`; tool registration remains synchronous.
- **证据**: `tests/integration/cli/plugin-packaging-walkthrough.test.ts`, `.anws/v8/wave-reviews/wave-110-e2e.md`

### T-GVS.R.2
- **关联需求**: REQ-005, REQ-008, REQ-009
- **关联契约**: heartbeat-owned impulse context artifact, real-run health gate
- **风险类别**: manual precondition / artifact_not_persisted stall / false unhealthy loop
- **单元测试覆盖**: impulse scene acceptance and writer shape.
- **API接口功能测试覆盖**: heartbeat run writes heartbeat-scoped impulse context and `readLoopStatus` reports `hasFreshImpulseContext=true`.
- **集成/E2E/冒烟覆盖**: INT-R5 host closure gate.
- **前置数据**: state DB with v8 spine enabled.
- **断言**: no prior `guidance_payload` call is required for heartbeat impulse freshness.
- **证据**: `tests/api/runtime-ops/loop-status-real-run-gate.test.ts`, `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts`

### T-CS.R.6
- **关联需求**: REQ-001, REQ-008
- **关联契约**: MoltBook `feed.read`, connector failure taxonomy, no fabricated evidence
- **风险类别**: unsupported fallback channel / opaque protocol_mismatch / blocked evidence ingestion
- **单元测试覆盖**: MoltBook adapter rejects unsupported skill fallback deterministically where relevant.
- **API接口功能测试覆盖**: connector executor returns success/mock or honest API/config/network failures for `feed.read`, never `moltbook_skill_runner_not_configured`.
- **集成/E2E/冒烟覆盖**: plugin bridge `connector:run` and INT-R5.
- **前置数据**: active credential, mock fixture or configured base URL.
- **断言**: `connector:run moltbook feed.read` does not surface the unimplemented skill runner as protocol mismatch.
- **证据**: `tests/integration/connectors/connector-executor-adapter-honest-failure.test.ts`, `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`

### T-CS.R.7
- **关联需求**: REQ-001, REQ-008
- **关联契约**: connector manifest trust boundary and registry snapshot
- **风险类别**: duplicate ID pollution / unsafe override / inability to repair built-in endpoint locally
- **单元测试覆盖**: built-in duplicate without override fails closed; explicit trusted shadow succeeds; unsafe runner shadow is rejected.
- **API接口功能测试覆盖**: connector_status reports workspace shadow without duplicate conflict.
- **集成/E2E/冒烟覆盖**: INT-R5 host closure gate.
- **前置数据**: built-in manifest plus workspace manifest with `trust.override=true` and `trust.reason`.
- **断言**: safe shadows are visible and auditable; unsafe overrides remain conflicts.
- **证据**: `tests/unit/connectors/t3-1-1-dynamic-registry.test.ts`, `tests/unit/cli/t1-2-3-connector-status.test.ts`

### T-OBS.R.6
- **关联需求**: REQ-008
- **关联契约**: host E2E truth report, no fake PASS before real execution
- **风险类别**: unverifiable host claim / credential leak / publish without tool visibility
- **单元测试覆盖**: 不适用。
- **API接口功能测试覆盖**: 不适用。
- **集成/E2E/冒烟覆盖**: `.anws/v8/wave-reviews/wave-110-e2e.md`.
- **前置数据**: v0.2.10 build/tag.
- **断言**: guide keeps verdict fields pending until real Feishu/OpenClaw execution; covers tool list, loop_status, connector status, and redaction.
- **证据**: `.anws/v8/wave-reviews/wave-110-e2e.md`

### INT-R5
- **关联需求**: REQ-001, REQ-005, REQ-008, REQ-009
- **关联契约**: v0.2.10 Feishu/OpenClaw host closure
- **风险类别**: agent cannot invoke tool / real-run gate remains stalled / connector diagnostics un-actionable
- **单元测试覆盖**: T-ROS.R.6, T-GVS.R.2, T-CS.R.6, T-CS.R.7 suites.
- **API接口功能测试覆盖**: heartbeat/loop_status/plugin bridge before-after assertions.
- **集成/E2E/冒烟覆盖**: cloud Feishu/OpenClaw guide.
- **前置数据**: v0.2.10 plugin package.
- **断言**: `second_nature_ops` visible in host tool list and heartbeat no longer stalls on missing impulse artifact.
- **证据**: targeted test logs, plugin tarball, tag `v0.2.10`, `.anws/v8/wave-reviews/wave-110-e2e.md`

### T-SMS.R.2
- **关联需求**: REQ-001, REQ-008
- **关联契约**: v8 schema durability and upgrade path
- **风险类别**: DB initialized at older migration missing tables/columns; bootstrap vs migration drift
- **单元测试覆盖**: migration runner idempotency and schema introspection.
- **API接口功能测试覆盖**: state store port round-trip after upgrade.
- **集成/E2E/冒烟覆盖**: schema-migration integration fixture simulating pre-v8-004 DB.
- **前置数据**: SQL DDL for v8-001..v8-003 tables.
- **断言**: pre-v8-004 DB upgraded to current schema; fresh DB remains idempotent.
- **证据**: `tests/integration/storage/schema-migration.test.ts`

### T-CP.R.4
- **关联需求**: REQ-008, REQ-009
- **关联契约**: `HeartbeatOrchestrationResult`, `RealRuntimeSpineResult`, daily rhythm health
- **风险类别**: rhythm write failure hidden; loop_status false-green
- **单元测试覆盖**: degraded rhythm state propagated to cycle result.
- **API接口功能测试覆盖**: heartbeat-run-v8-spine surfaces `rhythmDegraded`.
- **集成/E2E/冒烟覆盖**: INT-R6 regression gate.
- **前置数据**: T-SMS.R.2.
- **断言**: `advanceAndRecordDailyRhythm` degraded result is not swallowed.
- **证据**: `tests/unit/control-plane/heartbeat-cycle-trace.test.ts`, `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts`

### T-DQ.R.8
- **关联需求**: REQ-003, REQ-008
- **关联契约**: Quiet/Dream cadence contract (L0 §6.4)
- **风险类别**: Dream runs more than once per 7 days across consecutive daily Quiet reviews
- **单元测试覆盖**: global latest Dream run query; interval boundary.
- **API接口功能测试覆盖**: daily rhythm state reason `dream_interval_active`.
- **集成/E2E/冒烟覆盖**: INT-R6.
- **前置数据**: T-SMS.R.2.
- **断言**: second Quiet review within 7 days does not trigger a new Dream run.
- **证据**: `tests/unit/dream/daily-rhythm-scheduler.test.ts`

### T-AC.R.1
- **关联需求**: REQ-008
- **关联契约**: exactly-one-closure-per-cycle, `ActionClosureRecord` schema
- **风险类别**: duplicate remember closure; missing `platform_id` attribution
- **单元测试覆盖**: single remember closure per verdict; `platform_id="heartbeat"`.
- **API接口功能测试覆盖**: action closure port idempotency.
- **集成/E2E/冒烟覆盖**: INT-R6.
- **前置数据**: T-SMS.R.2.
- **断言**: one `action_closure_record` per remember verdict with populated `platform_id`.
- **证据**: `tests/unit/action/action-proposal-builder.test.ts`, `tests/unit/action/action-closure-recorder.test.ts`

### T-CS.R.8
- **关联需求**: REQ-001, REQ-008
- **关联契约**: Connector shadow trust policy
- **风险类别**: inventory registry allows safe shadow but executor ignores policy; unsafe shadow bypasses built-in runner
- **单元测试覆盖**: safe/unsafe shadow classification.
- **API接口功能测试覆盖**: executor adapter uses built-in runner for unsafe shadow and workspace runner for safe shadow.
- **集成/E2E/冒烟覆盖**: INT-R6.
- **前置数据**: built-in manifest plus workspace manifests with/without `trust.override`/`trust.reason`.
- **断言**: executor behavior matches registry trust policy.
- **证据**: `tests/unit/connectors/t3-1-1-dynamic-registry.test.ts`, `tests/integration/connectors/connector-executor-adapter-honest-failure.test.ts`

### T-GVS.R.3
- **关联需求**: REQ-005, REQ-008
- **关联契约**: `RealRuntimeSpineResult`, `HeartbeatSurfaceResult.impulseContext`
- **风险类别**: double refresh; missing artifact handoff; silent read failures
- **单元测试覆盖**: impulse context refresh only on surface.
- **API接口功能测试覆盖**: `v8Spine.impulseContextArtifactId` set; expression boundary exposed.
- **集成/E2E/冒烟覆盖**: INT-R6.
- **前置数据**: T-CP.R.4.
- **断言**: single refresh point; read failures return honest missing reason.
- **证据**: `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts`

### INT-R6
- **关联需求**: REQ-001, REQ-003, REQ-005, REQ-008, REQ-009
- **关联契约**: v8 runtime recovery closure
- **风险类别**: Wave 111 fixes regress Wave 108-110 or fail typecheck/build
- **单元测试覆盖**: all Wave 111 task suites.
- **API接口功能测试覆盖**: all Wave 111 API suites.
- **集成/E2E/冒烟覆盖**: Wave 108-110 targeted regression.
- **前置数据**: v0.2.11 candidate build.
- **断言**: 0 blocking failures; typecheck/build pass.
- **证据**: `reports/int-r6-wave-111-repair-gate.md`

### T-SH.R.2
- **关联需求**: REQ-001, REQ-002, REQ-008
- **关联契约**: `SourceRef` canonical shape, source grounding contract
- **风险类别**: name collision; silent type mismatch; refactor unreliability
- **单元测试覆盖**: v7 tuple renamed; v8 object remains canonical; `shared/types/index.ts` re-exports v8 contracts.
- **API接口功能测试覆盖**: N/A
- **集成/E2E/冒烟覆盖**: INT-R7.
- **前置数据**: 无.
- **断言**: only one object-shaped `SourceRef` exists in v8 space; v7 tuple is `SourceRefTuple`.
- **证据**: `logs/tsc-source-ref-unification.log`, updated contract tests

### T-SMS.R.3
- **关联需求**: REQ-008, REQ-009
- **关联契约**: v8 persistence schema, SourceRef JSON serialization contract
- **风险类别**: stale reads from wrong status column; malformed JSON interpreted differently across modules
- **单元测试覆盖**: serialization round-trip for malformed/empty/canonical shapes; schema shape introspection.
- **API接口功能测试覆盖**: N/A
- **集成/E2E/冒烟覆盖**: INT-R7.
- **前置数据**: T-SH.R.2.
- **断言**: one semantic status column per v8 table; all `sourceRefsJson` round-trip via `src/shared/serialization.ts`.
- **证据**: `tests/unit/shared/source-ref-serialization.test.ts`, `tests/integration/storage/v8-schema-shape.test.ts`

### INT-R7
- **关联需求**: REQ-001, REQ-002, REQ-008, REQ-009
- **关联契约**: v8 canonical contract shape
- **风险类别**: Wave 112 fixes regress Wave 108-111 or fail typecheck/build
- **单元测试覆盖**: T-SH.R.2 + T-SMS.R.3 suites.
- **API接口功能测试覆盖**: N/A.
- **集成/E2E/冒烟覆盖**: Wave 108-111 targeted regression.
- **前置数据**: Wave 112 candidate build.
- **断言**: 0 blocking failures; typecheck/build pass; CH-12 and CH-16 closed.
- **证据**: `reports/int-r7-wave-112-hemostasis-gate.md`

---

## 7. Testing Coverage Overlay

| 测试责任 | 风险类别 | 覆盖方法 | 任务承接 | 测试材料 | 状态 |
| --- | --- | --- | --- | --- | :---: |
| Shared contracts valid/invalid shapes | contract drift | 单元测试 + compile check | T-SH.C.1 | `tests/unit/contracts/v8-shared-contracts.test.ts` | ✅ |
| State store before/after | persistence | API接口功能测试 + integration | T-SMS.C.1 | `tests/api/storage/v8-state-port.test.ts` | ✅ |
| Evidence normalization no-fabrication | connector truth | 单元 + 集成 | T-CS.C.1 | `tests/integration/connectors/v8-evidence-normalization.test.ts` | ✅ |
| Public technical vs credential shape | security | 单元 + API接口功能测试 | T-PJ.C.1 | `tests/unit/perception/sensitivity-classifier.test.ts` | ✅ |
| Perception fallback and dedupe | semantic transformation | 单元 + API接口功能测试 | T-PJ.C.2 | `tests/api/perception/perception-port.test.ts` | ✅ |
| Judgment source and confidence guard | autonomy safety | 单元 + API接口功能测试 | T-PJ.C.3 | `tests/api/judgment/judgment-port.test.ts` | ✅ |
| Heartbeat cycle ordering | causal health | 单元 + 集成 | T-CP.C.1, T-OBS.C.2 | `tests/unit/control-plane/heartbeat-cycle-trace.test.ts` | ✅ |
| Cross-system degraded state unreadable | root-cause attribution | 单元 + API接口功能测试 | T-SH.C.1, T-OBS.C.2 | `tests/unit/contracts/v8-shared-contracts.test.ts` | ✅ |
| Capability side-effect classification | policy input | 单元 + API接口功能测试 | T-BT.C.1 | `tests/api/body/tool-affordance-v8.test.ts` | ✅ |
| Policy allow/defer/downgrade/deny | safety boundary | table-driven unit + API接口功能测试 | T-AC.C.2 | `tests/unit/action/autonomy-policy-evaluator.test.ts` | ✅ |
| Action closure statuses | closure reliability | 单元 + API接口功能测试 | T-AC.C.4 | `tests/api/action/action-closure-port.test.ts` | ✅ |
| Idempotent closure retry | duplicate write prevention | 单元 + API接口功能测试 | T-AC.C.3, T-AC.C.4 | `tests/unit/action/action-closure-recorder.test.ts` | ✅ |
| Quiet review memory candidate consumption | memory boundary | 单元 + API接口功能测试 | T-DQ.C.1 | `tests/api/quiet/quiet-review-port.test.ts` | ✅ |
| Connector/Quiet digest visibility | audit truth | 单元 + API接口功能测试 + 集成 | T-OBS.R.1 | `tests/integration/runtime-ops/commands.test.ts` | ✅ |
| Dream lifecycle diagnostics | async lifecycle | 单元 + API接口功能测试 | T-DQ.C.2 | `tests/api/dream/dream-schedule-port.test.ts` | ✅ |
| Dream redaction and candidate validation | security + memory | 单元 + API接口功能测试 | T-DQ.C.3 | `tests/api/dream/dream-consolidation-port.test.ts` | ✅ |
| Projection lifecycle supersession | long-term memory consistency | 单元 + API接口功能测试 | T-DQ.C.4 | `tests/api/dream/memory-projection-port.test.ts` | ✅ |
| loop_status stage diagnosis | observability | API接口功能测试 + integration | T-ROS.C.1, INT-S5 | `tests/api/runtime-ops/loop-status-command.test.ts` | ✅ |
| Real heartbeat writes closure/no-action | split-brain heartbeat | 单元 + API接口功能测试 + 集成 | T-CP.R.2 | `tests/integration/v8/real-runtime-living-loop.test.ts` | ✅ |
| Impulse context visible to agent surfaces | passive guidance API | 单元 + API接口功能测试 + plugin bridge | T-GVS.R.1 | `tests/api/runtime-ops/guidance-context-command.test.ts` | ✅ |
| MoltBook write remains policy-bound | unsafe external write | 单元 + API接口功能测试 + 集成 | T-CS.R.1 | `tests/integration/action/moltbook-write-closure.test.ts` | ✅ |
| Quiet/Dream due and absence states | single rhythm / silent Dream absence | 单元 + API接口功能测试 + 集成 | T-DQ.R.2 | `tests/integration/v8/quiet-dream-cadence.test.ts` | ✅ |
| Runtime activation false-health prevention | false healthy | API接口功能测试 + 集成 + report | T-OBS.R.2, INT-R1 | `reports/int-r1-v8-runtime-activation-repair.md` | ✅ |
| Proof artifacts cannot false-green | false completion | 集成 + 冒烟 + 静态审查 | T-VERIFY.R.1 | `reports/int-r1-v8-runtime-activation-repair.md` | ✅ |
| loop_status/digest real-run parity | operator truth | API接口功能测试 + 集成 | T-OBS.R.3 | `tests/integration/runtime-ops/heartbeat-digest-real-run-gate.test.ts` | ✅ |
| Perception novelty/relevance canonicalization | contract drift | 单元 + API接口功能测试 + 集成 | T-PJ.R.1 | `reports/perception-contract-alignment.md` | ✅ |
| Accepted memory feeds next heartbeat | memory feedback | 单元 + API接口功能测试 + 集成 | T-DQ.R.3 | `tests/integration/control-plane/accepted-projection-feedback.test.ts` | ✅ |
| Quiet closure provenance is first-class | self-dialogue trace | 单元 + API接口功能测试 + 集成 | T-DQ.R.4 | `tests/api/quiet/quiet-review-port.test.ts` | ✅ |
| Proof and memory closure gate | integrated repair | 集成 + 冒烟 + 静态审查 | INT-R2 | `reports/int-r2-v8-proof-memory-closure.md` | ✅ |
| Heartbeat advances daily rhythm | post-closure stall | API接口功能测试 + 集成 | T-CP.R.3 | `tests/integration/v8/real-runtime-quiet-dream-advance.test.ts` | ✅ |
| Quiet/Dream reports absence truth | Quiet deadlock / Dream no-input ambiguity | 单元 + API接口功能测试 + 集成 | T-DQ.R.5 | `tests/api/dream/quiet-dream-runtime-chain.test.ts` | ✅ |
| Connector failures classify truthfully | unknown failure bucket | 单元 + API接口功能测试 + 集成 | T-CS.R.2 | `tests/api/connectors/connector-failure-truth.test.ts` | ✅ |
| Connector replay is cooldown-bounded | infinite replay / noise growth | 单元 + API接口功能测试 + 集成 | T-CS.R.3 | `tests/integration/control-plane/connector-replay-cooldown.test.ts` | ✅ |
| Decision denial has root-cause attribution | false governance blame | 单元 + API接口功能测试 + 集成 | T-OBS.R.4 | `tests/api/runtime-ops/loop-status-denial-attribution.test.ts` | ✅ |
| Runtime recovery closure gate | PRD loop restoration | 集成 + 冒烟 + 静态审查 | INT-R3 | `tests/integration/v8/runtime-recovery-closure.test.ts` | ✅ |
| Full living loop | end-to-end value | integration + scoped E2E + smoke | INT-V8 | `tests/integration/v8/living-perception-loop.test.ts` | ✅ |
| Feishu/OpenClaw tool visibility | host injection | packaging + plugin bridge + E2E guide | T-ROS.R.6, INT-R5 | `tests/integration/cli/plugin-packaging-walkthrough.test.ts` | ✅ |
| Heartbeat impulse context ownership | real-run closure | API接口功能测试 + integration | T-GVS.R.2 | `tests/api/runtime-ops/loop-status-real-run-gate.test.ts` | ✅ |
| MoltBook read routing truth | connector truth | integration + plugin bridge | T-CS.R.6 | `tests/integration/connectors/connector-executor-adapter-honest-failure.test.ts` | ✅ |
| Built-in connector shadowing | registry trust | unit + API接口功能测试 | T-CS.R.7 | `tests/unit/connectors/t3-1-1-dynamic-registry.test.ts` | ✅ |
| Build/lint/regression | release safety | compile/lint/regression | T-REG.C.1 | `reports/v8-regression-gate.md` | ✅ |
| v8 schema migration alignment | upgrade path | integration + schema introspection | T-SMS.R.2 | `tests/integration/storage/schema-migration.test.ts` | ✅ |
| Daily rhythm failure propagation | false healthy | unit + API接口功能测试 | T-CP.R.4 | `tests/unit/control-plane/heartbeat-cycle-trace.test.ts` | ✅ |
| Global 7-day Dream interval | over-frequent Dream | unit | T-DQ.R.8 | `tests/unit/dream/daily-rhythm-scheduler.test.ts` | ✅ |
| Remember closure duplicate elimination | closure attribution | unit | T-AC.R.1 | `tests/unit/action/action-closure-recorder.test.ts` | ✅ |
| Connector shadow execution consistency | unsafe override | integration | T-CS.R.8 | `tests/integration/connectors/connector-executor-adapter-honest-failure.test.ts` | ✅ |
| Heartbeat impulse context handoff | double refresh / missing artifact | API接口功能测试 | T-GVS.R.3 | `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts` | ✅ |
| Wave 111 repair gate | regression | compile + targeted regression | INT-R6 | `reports/int-r6-wave-111-repair-gate.md` | ✅ |
| SourceRef canonical shape | contract drift / name collision | compile + unit | T-SH.R.2 | `logs/tsc-source-ref-unification.log` | ⬜ |
| Single status column and centralized serialization | schema drift / lifecycle ambiguity | unit + integration | T-SMS.R.3 | `tests/unit/shared/source-ref-serialization.test.ts` | ⬜ |
| Wave 112 hemostasis gate | regression | compile + targeted regression | INT-R7 | `reports/int-r7-wave-112-hemostasis-gate.md` | ⬜ |

---

## 8. Verification Traceability Matrix

| REQ/Contract | Task | Verification | Test Material | Evidence | Status |
| --- | --- | --- | --- | --- | :---: |
| REQ-001 Evidence Normalization | T-CS.C.1, INT-S2 | 单元 + 集成 | `tests/unit/connectors/evidence-normalizer.test.ts` | INT-S2 report | ✅ |
| REQ-002 Perception Card | T-PJ.C.2, T-CP.C.1, INT-S2 | 单元 + API接口功能测试 + 集成 | `tests/api/perception/perception-port.test.ts` | INT-S2 report | ✅ |
| REQ-003 Judgment Verdict | T-PJ.C.3, T-AC.C.1, INT-S2, INT-S3 | 单元 + API接口功能测试 | `tests/api/judgment/judgment-port.test.ts` | INT-S3 report | ✅ |
| REQ-004 Common Autonomy Policy | T-BT.C.1, T-AC.C.2, T-AC.C.3, INT-S3 | 单元 + API接口功能测试 + 集成 | `tests/unit/action/autonomy-policy-evaluator.test.ts` | INT-S3 report | ✅ |
| REQ-005 Quiet/Dream Long-Term Memory | T-DQ.C.1, T-DQ.C.3, T-DQ.C.4, T-CP.C.2, INT-S4 | 单元 + API接口功能测试 + 集成 | `tests/api/dream/memory-projection-port.test.ts` | INT-S4 report | ✅ |
| REQ-006 Dream/Quiet Closure Repair | T-DQ.C.2, T-DQ.C.3, T-DQ.C.4, T-OBS.C.2, T-OBS.R.1, INT-S4, INT-S5 | API接口功能测试 + 集成 | `tests/api/dream/dream-schedule-port.test.ts`, `tests/unit/observability/heartbeat-digest-assembler.test.ts` | INT-S5 report | ✅ |
| REQ-007 Context-Aware Sensitivity | T-PJ.C.1, T-OBS.C.3, T-DQ.C.3 | 单元 + API接口功能测试 | `tests/unit/perception/sensitivity-classifier.test.ts` | diagnostic test report | ✅ |
| REQ-008 Causal Loop Health | T-SH.C.1, T-OBS.C.1, T-CP.C.1, T-OBS.C.2, T-OBS.R.1, T-ROS.C.1, INT-S5 | API接口功能测试 + 集成 | `tests/api/runtime-ops/loop-status-command.test.ts`, `tests/integration/runtime-ops/commands.test.ts` | INT-S5 report | ✅ |
| REQ-009 Heartbeat Action Closure | T-AC.C.1, T-AC.C.2, T-AC.C.3, T-AC.C.4, T-DQ.C.1, T-OBS.R.1, INT-S3 | 单元 + API接口功能测试 + 集成 | `tests/api/action/action-closure-port.test.ts`, `tests/unit/ops/manual-run-dispatcher.test.ts` | INT-S3 report | ✅ |
| Shared action contract | T-SH.C.1, T-AC.C.2 | 单元 + API接口功能测试 | `tests/unit/contracts/v8-shared-contracts.test.ts` | contract test logs | ✅ |
| SourceRef grounding | T-SH.C.1, T-SMS.C.1, T-OBS.C.1 | 单元 + API接口功能测试 | `tests/api/storage/v8-state-port.test.ts` | state port report | ✅ |
| Heartbeat-count SLA | T-CP.C.1, T-OBS.C.2, T-ROS.C.1 | 单元 + API接口功能测试 | `tests/unit/observability/causal-loop-health.test.ts` | loop_status report | ✅ |
| Memory review closure | T-AC.C.1, T-AC.C.4, T-DQ.C.1 | 单元 + API接口功能测试 | `tests/api/action/action-closure-port.test.ts` | Quiet review report | ✅ |
| REQ-002..009 Runtime Activation Repair | T-CP.R.2, T-GVS.R.1, T-CS.R.1, T-DQ.R.2, T-OBS.R.2, INT-R1 | 单元 + API接口功能测试 + 集成 + 冒烟 | `tests/integration/v8/real-runtime-living-loop.test.ts` | `reports/int-r1-v8-runtime-activation-repair.md` | ✅ |
| Real heartbeat closure | T-CP.R.2, T-OBS.R.2 | 单元 + API接口功能测试 + 集成 | `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts` | real-runtime integration report | ✅ |
| Impulse context injection | T-GVS.R.1 | 单元 + API接口功能测试 + 集成/手动 | `tests/api/runtime-ops/guidance-context-command.test.ts` | plugin bridge smoke | ✅ |
| Policy-bound platform write | T-CS.R.1 | 单元 + API接口功能测试 + 集成 | `tests/api/connectors/moltbook-write-port.test.ts` | write closure integration report | ✅ |
| Independent Quiet/Dream cadence | T-DQ.R.2 | 单元 + API接口功能测试 + 集成 | `tests/api/dream/quiet-dream-status-port.test.ts` | cadence integration report | ✅ |
| Proof truth and handoff artifacts | T-VERIFY.R.1 | 集成 + 冒烟 + 静态审查 | `tests/integration/v8/int-r1-runtime-activation-repair.test.ts` | `reports/int-r1-v8-runtime-activation-repair.md` | ✅ |
| Real-run health operator surface | T-OBS.R.3 | API接口功能测试 + 集成 | `tests/api/runtime-ops/loop-status-real-run-gate.test.ts` | `logs/int-r2-loop-status.json` | ✅ |
| PerceptionCard canonical semantics | T-PJ.R.1 | 单元 + API接口功能测试 + 集成 | `tests/unit/perception/perception-contract-alignment.test.ts` | `reports/perception-contract-alignment.md` | ✅ |
| Memory projection feedback | T-DQ.R.3 | 单元 + API接口功能测试 + 集成 | `tests/integration/control-plane/accepted-projection-feedback.test.ts` | INT-R2 report | ✅ |
| Quiet closure provenance | T-DQ.R.4 | 单元 + API接口功能测试 + 集成 | `tests/api/quiet/quiet-review-port.test.ts` | INT-R2 report | ✅ |
| REQ-002/003/005/006/008/009 Proof and Memory Repair | T-VERIFY.R.1, T-OBS.R.3, T-PJ.R.1, T-DQ.R.3, T-DQ.R.4, INT-R2 | 单元 + API接口功能测试 + 集成 + 冒烟 | `tests/integration/v8/proof-memory-closure.test.ts` | `reports/int-r2-v8-proof-memory-closure.md` | ✅ |
| REQ-001/005/006/008/009 Runtime Recovery Repair | T-CP.R.3, T-DQ.R.5, T-CS.R.2, T-CS.R.3, T-OBS.R.4, INT-R3 | 单元 + API接口功能测试 + 集成 + 冒烟 | `tests/integration/v8/runtime-recovery-closure.test.ts` | INT-R3 report | ✅ |
| Connector failure truth | T-CS.R.2, T-OBS.R.4 | 单元 + API接口功能测试 + 集成 | `tests/api/connectors/connector-failure-truth.test.ts` | connector failure truth report | ✅ |
| Connector replay cooldown | T-CS.R.3, T-OBS.R.4 | 单元 + API接口功能测试 + 集成 | `tests/integration/control-plane/connector-replay-cooldown.test.ts` | replay diagnostics report | ✅ |
| Quiet runtime recovery | T-CP.R.3, T-DQ.R.5, T-OBS.R.4 | API接口功能测试 + 集成 | `tests/integration/v8/real-runtime-quiet-dream-advance.test.ts` | `logs/int-r3-loop-status.json` | ✅ |
| Full v8 DoD | INT-V8, T-REG.C.1 | 集成 + scoped E2E + regression | `tests/integration/v8/living-perception-loop.test.ts` | `reports/int-v8-living-perception-loop.md` | ✅ |
| SourceRef grounding canonical shape | T-SH.R.2, T-SMS.R.3 | 编译 + 单元 + 集成 | `tests/unit/shared/source-ref-serialization.test.ts` | `reports/int-r7-wave-112-hemostasis-gate.md` | ⬜ |
| v8 schema status/serialization hygiene | T-SMS.R.3 | 单元 + 集成 | `tests/integration/storage/v8-schema-shape.test.ts` | `reports/int-r7-wave-112-hemostasis-gate.md` | ⬜ |

---