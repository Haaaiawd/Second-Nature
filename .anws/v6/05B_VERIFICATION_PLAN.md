# Second Nature v6 验证计划 (05B_VERIFICATION_PLAN)

> **版本**: v6  
> **生成日期**: 2026-05-16  
> **Task Source**: `.anws/v6/05A_TASKS.md`  
> **Design Source**: `.anws/v6/01_PRD.md`, `.anws/v6/02_ARCHITECTURE_OVERVIEW.md`, `.anws/v6/03_ADR/`, `.anws/v6/04_SYSTEM_DESIGN/`

---

## 验证分层策略

| 层级 | 用途 | v6 适用范围 | 证据 |
| --- | --- | --- | --- |
| 单元测试 | 局部状态转换、schema、policy、parser、validator | state schemas、registry parser、goal gate、Dream validator、grounding validator | `tests/unit/**` |
| API接口功能测试 | CLI/tool/port 操作契约、错误语义、数据变更 before/after | `second_nature_ops` commands、state ports、connector registry APIs、observability query APIs | `tests/integration/**` |
| 集成测试 | 跨系统读写、trace/read model、pipeline | Dream pipeline、heartbeat narrative、connector registry -> status | `tests/integration/**` |
| 冒烟测试 | Sprint 关门任务 | INT-S1 到 INT-S5 | `reports/int-s*.md` |
| 回归测试 | v5 不倒退 | heartbeat surface、state schema、connector parity、plugin runtime | existing v5 test suites + INT reports |
| 手动验证 | 真实宿主能力与 host-safe/full runtime / life loop activation | INT-S4 OpenClaw session tool visibility and workspace bridge；INT-S5 one real connector + outreach loop | `reports/int-s4-v6-ops-host-readiness.md`, `reports/int-s5-v6-life-loop-activation.md` |

> E2E/真实宿主验证只在本计划记录触发条件与证据预期；实际执行由 `/forge` 对应里程碑承接。

---

## 风险类别覆盖规则

| 风险类别 | 代表风险 | 覆盖任务 |
| --- | --- | --- |
| 记忆污染 | Dream candidate 被 heartbeat 消费、unsupported claim 进入 active memory | T4.1.5, T7.1.1, T7.1.4, INT-S2 |
| 任意代码执行 | workspace connector custom adapter 自动执行 | T3.1.1, T1.2.3, T1.3.1, INT-S1 |
| 授权越权 | agent-proposed goal 直接影响 planning | T4.1.4, T2.1.4, INT-S3 |
| Ops surface 不可见 | goal/status/cycle 命令 producer task 与验证锚点必须同时存在 | T1.2.4, T1.2.5, T1.2.6, INT-S4 |
| 隐私泄漏 | prompt、PII、credential、private message 进入 model/audit | T5.1.1, T7.1.3, T6.1.1, INT-S2 |
| 验证不可见 | INT milestone 没有证据路径 | INT-S1, INT-S2, INT-S3, INT-S4, INT-S5 |
| v5 回归 | existing heartbeat/state/plugin/connector behavior broken | T3.2.1, INT-S1, INT-S4 |
| 运行时 secret 漂移 | encryption key / base URL / credential recovery 只存在于临时会话 | T1.4.1, INT-S5 |
| 真实感知未激活 | connector dry-run pass 但 heartbeat 没有真实 evidence | T3.3.1, T2.4.1, INT-S5 |
| 关系反馈未闭合 | owner reply 没有进入 RelationshipMemory 或不影响下次 outreach | T4.2.1, T1.4.2, INT-S5 |

---

## Task-by-Task 验证计划

### T1.2.1
- 关联需求: REQ-002, REQ-006
- 关联契约: `sn narrative`, `NarrativeState`, `NarrativeTrace`, RuntimeMode envelope
- 风险类别: 可观测性不可见、host-safe/full runtime 混淆
- 单元测试覆盖: formatter handles active/nothing_yet/degraded states
- API接口功能测试覆盖: `second_nature_ops narrative` returns structured JSON and honest unavailable envelope
- 集成/E2E/冒烟覆盖: included in INT-S4
- 前置数据: fixture NarrativeState + NarrativeTrace rows
- 断言: focus/progress/nextIntent/sourceRefs visible; empty state is honest
- 证据: `tests/integration/cli/t1-2-1-narrative-command.test.ts`

### T1.2.2
- 关联需求: REQ-001, REQ-006
- 关联契约: `sn dream:recent`, DreamTrace, MemoryStore summary
- 风险类别: Dream status 不可见、candidate/accepted 混淆
- 单元测试覆盖: formatter renders success/partial/empty
- API接口功能测试覆盖: command returns lifecycle, fallback reason, cost/duration summary
- 集成/E2E/冒烟覆盖: included in INT-S2 and INT-S4
- 前置数据: fixture DreamTrace and MemoryStore lifecycle records
- 断言: candidate/partial/accepted status is explicit
- 证据: `tests/integration/cli/t1-2-2-dream-recent-command.test.ts`

### T1.2.3
- 关联需求: REQ-004, REQ-006
- 关联契约: `connector:status`, `connector:test`, ConnectorInventoryAudit, ConnectorTrustPolicy
- 风险类别: pending trust connector 被误执行
- 单元测试覆盖: formatter and trust/executable mapper
- API接口功能测试覆盖: pending trust denied, executable dry-run succeeds, conflict visible
- 集成/E2E/冒烟覆盖: included in INT-S1 and INT-S4
- 前置数据: registry snapshot with valid, invalid, conflict, pending trust rows
- 断言: pending trust returns denied and no side effect occurs
- 证据: `tests/integration/cli/t1-2-3-connector-commands.test.ts`

### T1.2.4
- 关联需求: REQ-002, REQ-006
- 关联契约: `sn goal set/list/accept/reject`, AgentGoal lifecycle, RuntimeMode envelope
- 风险类别: goal proposal 越权、host-safe/full runtime 混淆
- 单元测试覆盖: formatter and command mapper preserve proposal/accepted/rejected/completed status
- API接口功能测试覆盖: `second_nature_ops goal` set/list/accept/reject returns structured JSON and before/after state changes
- 集成/E2E/冒烟覆盖: included in INT-S3 and INT-S4
- 前置数据: fixture AgentGoal store with owner-set and agent-proposed goals
- 断言: owner-set goal is accepted; proposal is not accepted unless explicit accept command succeeds; host-safe carrier is honest
- 证据: `tests/integration/cli/t1-2-4-goal-command.test.ts`

### T1.2.5
- 关联需求: REQ-006
- 关联契约: `sn cycle:recent`, CycleRecent read model, RuntimeMode envelope
- 风险类别: recent cycle invisible, partial trace misrepresented as complete
- 单元测试覆盖: formatter handles complete/partial/empty cycle views
- API接口功能测试覆盖: command returns decision/narrative/dream/delivery/connector includes list and honest degraded/empty states
- 集成/E2E/冒烟覆盖: included in INT-S4
- 前置数据: fixture decision trace, NarrativeTrace, DreamTrace, delivery/fallback audit rows
- 断言: missing trace dimensions are marked partial/degraded and never fabricated
- 证据: `tests/integration/cli/t1-2-5-cycle-recent-command.test.ts`

### T1.2.6
- 关联需求: REQ-006
- 关联契约: `sn status`, `second_nature_ops status`, v6 aggregate read model, RuntimeMode envelope
- 风险类别: status aggregate stale at v5 semantics, sensitive read model leak
- 单元测试覆盖: aggregate mapper handles complete/partial/nothing_yet/degraded sections
- API接口功能测试覆盖: command returns narrative, Dream, connector, cycle and runtime summaries with representative unavailable paths
- 集成/E2E/冒烟覆盖: included in INT-S4
- 前置数据: fixture read models from T1.2.1, T1.2.2, T1.2.3 and T1.2.5 plus sensitive refs
- 断言: status includes v6 sections, preserves honest empty/degraded states, and redacts prompt/token/credential/private content
- 证据: `tests/integration/cli/t1-2-6-status-aggregate.test.ts`

### T1.3.1
- 关联需求: REQ-004
- 关联契约: connector init CLI, workspace path safety, no-overwrite, custom adapter pending trust
- 风险类别: 任意代码执行、用户文件覆盖、路径逃逸
- 单元测试覆盖: platform id sanitizer and path resolver
- API接口功能测试覆盖: init success, no-overwrite failure, path_safety_denied
- 集成/E2E/冒烟覆盖: generated manifest scan confirms executable=false for custom adapter
- 前置数据: temp workspace connector root
- 断言: files remain under connector root; existing files remain unchanged unless explicit overwrite; custom adapter not executable
- 证据: `tests/integration/cli/t1-3-1-connector-init.test.ts`

### T2.1.4
- 关联需求: REQ-002
- 关联契约: accepted goal priority, user task > accepted goal > rhythm
- 风险类别: 授权越权
- 单元测试覆盖: accepted/proposal/rejected goal table cases
- API接口功能测试覆盖: planning port returns reason refs
- 集成/E2E/冒烟覆盖: included in INT-S3
- 前置数据: self-aware snapshot with narrative and goals
- 断言: proposal/rejected goals do not boost priority
- 证据: `tests/unit/control-plane/t2-1-4-goal-priority.test.ts`

### T2.1.5
- 关联需求: REQ-002
- 关联契约: heartbeat narrative update, NarrativeTrace
- 风险类别: unsupported claim 进入 active narrative
- 单元测试覆盖: success, awaiting_sources, unsupported claim
- API接口功能测试覆盖: state write and trace append before/after
- 集成/E2E/冒烟覆盖: included in INT-S3 and INT-S4
- 前置数据: heartbeat effect/fallback fixtures
- 断言: narrative status and trace grounding match effect
- 证据: `tests/integration/control-plane/t2-1-5-narrative-update.test.ts`

### T2.3.1
- 关联需求: REQ-005
- 关联契约: outreach v6 judgment, hard guard, narrative draft request
- 风险类别: outreach 越过 delivery/cooldown guard
- 单元测试覆盖: allow/deny/defer judgment
- API接口功能测试覆盖: draft request includes source refs only when guard allows
- 集成/E2E/冒烟覆盖: included in INT-S3
- 前置数据: evidence + narrative + relationship + delivery policy fixtures
- 断言: denied path emits reason and no delivery request
- 证据: `tests/integration/control-plane/t2-3-1-outreach-v6.test.ts`

### T3.1.1
- 关联需求: REQ-004
- 关联契约: DynamicConnectorRegistry, manifest.yaml schema, ConnectorTrustPolicy, conflict policy
- 风险类别: 任意代码执行、registry 半构建、manifest 注入
- 单元测试覆盖: safe YAML parse, schema validation, trust classification
- API接口功能测试覆盖: reload returns scanned/registered/skipped/conflicts
- 集成/E2E/冒烟覆盖: included in INT-S1
- 前置数据: valid/invalid/duplicate/custom adapter manifests
- 断言: invalid skipped, conflict recorded, custom pending not executable, active snapshot atomic
- 证据: `tests/unit/connectors/t3-1-1-dynamic-registry.test.ts`

### T3.1.2
- 关联需求: REQ-004
- 关联契约: CapabilityContractRegistry namespace route
- 风险类别: route drift and v5 incompatibility
- 单元测试覆盖: namespaced and v5 explicit platform routes
- API接口功能测试覆盖: route planner contract returns expected platform/capability
- 集成/E2E/冒烟覆盖: included in INT-S1
- 前置数据: registry snapshot with v5 and dynamic capabilities
- 断言: namespaced route and v5 route both resolve
- 证据: `tests/unit/connectors/t3-1-2-capability-registry.test.ts`

### T3.2.1
- 关联需求: REQ-004
- 关联契约: v5 connector behavior compatibility, idempotency for side effects
- 风险类别: v5 回归、重复外部副作用
- 单元测试覆盖: manifest parity mapping
- API接口功能测试覆盖: connector execution adapter behavior
- 集成/E2E/冒烟覆盖: included in INT-S1
- 前置数据: Moltbook/InStreet/EvoMap parity fixtures
- 断言: normalized result matches v5; side-effect retry without idempotency is denied
- 证据: `tests/integration/connectors/t3-2-1-v5-parity.test.ts`

### T4.1.1
- 关联需求: REQ-001, REQ-002, REQ-003
- 关联契约: SessionChronicle
- 风险类别: 时间线缺失导致 Dream/relationship 无输入
- 单元测试覆盖: append/read, missing source, owner reply projection
- API接口功能测试覆盖: store API before/after append
- 集成/E2E/冒烟覆盖: included in INT-S1
- 前置数据: heartbeat and owner reply entries
- 断言: source-backed fields survive write/read
- 证据: `tests/unit/storage/t4-1-1-session-chronicle.test.ts`

### T4.1.2
- 关联需求: REQ-002
- 关联契约: NarrativeState
- 风险类别: narrative 幻觉或 unsupported active state
- 单元测试覆盖: active, awaiting_sources, insufficient_sources
- API接口功能测试覆盖: write/load before/after
- 集成/E2E/冒烟覆盖: included in INT-S3
- 前置数据: narrative update inputs with source refs and unsupported claims
- 断言: unsupported claim rejected or degraded
- 证据: `tests/unit/storage/t4-1-2-narrative-state.test.ts`

### T4.1.3
- 关联需求: REQ-003
- 关联契约: RelationshipMemory
- 风险类别: relationship over-inference
- 单元测试覆盖: reply/no_reply and confidence handling
- API接口功能测试覆盖: upsert/load before/after
- 集成/E2E/冒烟覆盖: included in INT-S3
- 前置数据: owner reply and no-reply chronicle entries
- 断言: no-reply creates cooldown signal without invented preference
- 证据: `tests/unit/storage/t4-1-3-relationship-memory.test.ts`

### T4.1.4
- 关联需求: REQ-002
- 关联契约: AgentGoal lifecycle
- 风险类别: goal proposal 越权
- 单元测试覆盖: owner-set, agent-proposed, policy allowlist transition, denial
- API接口功能测试覆盖: goal write/list/transition before/after
- 集成/E2E/冒烟覆盖: included in INT-S3
- 前置数据: goal fixtures with risk and completion criteria
- 断言: proposal remains non-priority until owner/policy gate accepts
- 证据: `tests/unit/storage/t4-1-4-agent-goal.test.ts`

### T4.1.5
- 关联需求: REQ-001
- 关联契约: MemoryStore, DreamOutputLifecycle
- 风险类别: active memory pollution
- 单元测试覆盖: lifecycle transition and input hash immutability
- API接口功能测试覆盖: write candidate, transition accepted/archive before/after
- 集成/E2E/冒烟覆盖: included in INT-S2
- 前置数据: input store and candidate outputs
- 断言: accepted pointer changes only after validation; failed validation archives candidate
- 证据: `tests/integration/storage/t4-1-5-memory-store-lifecycle.test.ts`

### T5.1.1
- 关联需求: REQ-001, REQ-006
- 关联契约: DreamTrace, RedactionManifest
- 风险类别: Dream failure invisible, sensitive audit leak
- 单元测试覆盖: schema, budget, redaction
- API接口功能测试覆盖: record/query DreamTrace
- 集成/E2E/冒烟覆盖: included in INT-S2 and INT-S4
- 前置数据: success, budget, timeout, sensitive-field traces
- 断言: sensitive fields absent; lifecycle/fallback visible
- 证据: `tests/unit/observability/t5-1-1-dream-trace.test.ts`

### T5.1.2
- 关联需求: REQ-002, REQ-006
- 关联契约: NarrativeTrace
- 风险类别: narrative change unexplainable
- 单元测试覆盖: grounding status and unsupported claims
- API接口功能测试覆盖: record/query NarrativeTrace
- 集成/E2E/冒烟覆盖: included in INT-S3 and INT-S4
- 前置数据: narrative revision and blocked proposal traces
- 断言: sourceRefs and unsupportedClaims visible
- 证据: `tests/unit/observability/t5-1-2-narrative-trace.test.ts`

### T5.1.3
- 关联需求: REQ-004, REQ-006
- 关联契约: ConnectorInventoryAudit
- 风险类别: inventory vs execution telemetry 混淆
- 单元测试覆盖: snapshot counts and trust rows
- API接口功能测试覆盖: record/query inventory
- 集成/E2E/冒烟覆盖: included in INT-S1 and INT-S4
- 前置数据: registry reload snapshots
- 断言: conflicts visible in inventory and not execution attempt
- 证据: `tests/unit/observability/t5-1-3-connector-inventory.test.ts`

### T6.1.1
- 关联需求: REQ-005
- 关联契约: NarrativeOutreachDraft, GroundingReport
- 风险类别: unsupported outreach claim, PII leak
- 单元测试覆盖: grounding validator, redaction, insufficient history
- API接口功能测试覆盖: draftNarrativeOutreach structured output
- 集成/E2E/冒烟覆盖: included in INT-S3
- 前置数据: evidence/narrative/relationship fixtures
- 断言: missing source blocks/degrades; no raw sensitive data in prompt
- 证据: `tests/unit/guidance/t6-1-1-narrative-outreach.test.ts`

### T7.1.1
- 关联需求: REQ-001
- 关联契约: DreamOutput, candidate lifecycle, budget gate
- 风险类别: memory pollution, model hallucination
- 单元测试覆盖: consolidator, sampler, validator, budget gate
- API接口功能测试覆盖: Dream pipeline run contract
- 集成/E2E/冒烟覆盖: included in INT-S2
- 前置数据: evidence, chronicle, memory store, model fixtures
- 断言: input store immutable; candidate output validated before acceptance
- 证据: `tests/integration/dream/t7-1-1-dream-pipeline.test.ts`

### T7.1.2
- 关联需求: REQ-001
- 关联契约: Dream scheduler, DreamRunLock, partial output
- 风险类别: duplicate Dream runs, heartbeat blocking
- 单元测试覆盖: trigger policy, lock conflict
- API接口功能测试覆盖: scheduleDream returns queued/skipped/running
- 集成/E2E/冒烟覆盖: included in INT-S2
- 前置数据: cron, threshold, active lock, timeout fixtures
- 断言: heartbeat not blocked; active lock prevents duplicate run; timeout writes partial
- 证据: `tests/integration/dream/t7-1-2-dream-scheduler.test.ts`

### T7.1.3
- 关联需求: REQ-001
- 关联契约: InsightCandidate, ModelAssistPort
- 风险类别: PII/model leak, unsupported insight
- 单元测试覆盖: mock model success/failure, redaction
- API接口功能测试覆盖: extraction port returns structured result
- 集成/E2E/冒烟覆盖: included in INT-S2
- 前置数据: sampled evidence and model fixtures
- 断言: each insight has confidence/sourceRefs; unavailable model falls back honestly
- 证据: `tests/unit/dream/t7-1-3-insight-extraction.test.ts`

### T7.1.4
- 关联需求: REQ-001, REQ-002
- 关联契约: NarrativeUpdateProposal
- 风险类别: unsupported narrative claim
- 单元测试覆盖: source-backed and unsupported proposal cases
- API接口功能测试覆盖: proposal schema validation
- 集成/E2E/冒烟覆盖: included in INT-S2 and INT-S3
- 前置数据: evidence and insight fixtures
- 断言: unsupported proposal is blocked/degraded before state acceptance
- 证据: `tests/unit/dream/t7-1-4-narrative-update.test.ts`

### T7.1.5
- 关联需求: REQ-001, REQ-003
- 关联契约: RelationshipUpdateProposal
- 风险类别: relationship over-inference
- 单元测试覆盖: reply/no_reply and confidence
- API接口功能测试覆盖: proposal schema validation
- 集成/E2E/冒烟覆盖: included in INT-S2 and INT-S3
- 前置数据: chronicle fixtures
- 断言: no-reply records cooldown signal without invented preference
- 证据: `tests/unit/dream/t7-1-5-relationship-update.test.ts`

### INT-S1
- 关联需求: REQ-004 plus v5 compatibility
- 关联契约: state schemas, DynamicConnectorRegistry, ConnectorTrustPolicy, v5 connector parity
- 风险类别: sprint gate false positive
- 单元测试覆盖: S1 unit suite must pass
- API接口功能测试覆盖: registry and state port APIs
- 集成/E2E/冒烟覆盖: connector registry smoke and v5 regression
- 前置数据: S1 task outputs
- 断言: S1 exit criteria all pass or report records failures
- 证据: `reports/int-s1-v6-foundation-connector.md`

### INT-S2
- 关联需求: REQ-001
- 关联契约: DreamOutputLifecycle, DreamRunLock, DreamTrace
- 风险类别: Dream memory pollution and invisible failure
- 单元测试覆盖: S2 unit suite must pass
- API接口功能测试覆盖: Dream run and trace query APIs
- 集成/E2E/冒烟覆盖: normal/empty/timeout/model-unavailable smoke
- 前置数据: S2 task outputs
- 断言: candidate/partial/accepted semantics are correct
- 证据: `reports/int-s2-v6-dream-engine.md`

### INT-S3
- 关联需求: REQ-002, REQ-003, REQ-005
- 关联契约: goal priority, NarrativeTrace, source-backed outreach
- 风险类别: autonomous behavior without governance
- 单元测试覆盖: S3 unit suite must pass
- API接口功能测试覆盖: heartbeat/outreach decision APIs
- 集成/E2E/冒烟覆盖: accepted goal -> outreach reason smoke
- 前置数据: S3 task outputs
- 断言: accepted goal affects priority; proposal goal does not; draft is grounded
- 证据: `reports/int-s3-v6-agent-self.md`

### INT-S4
- 关联需求: REQ-006
- 关联契约: JSON-first ops surface, RuntimeMode, redacted read models, goal/status/cycle command set
- 风险类别: host-safe/full runtime drift
- 单元测试覆盖: S4 unit/API suite must pass
- API接口功能测试覆盖: narrative/dream/connector/goal/cycle/status commands
- 集成/E2E/冒烟覆盖: OpenClaw host-safe and workspace full runtime smoke
- 前置数据: S4 task outputs and OpenClaw session/tool visibility
- 断言: full runtime returns data; carrier/unavailable responses are honest
- 证据: `reports/int-s4-v6-ops-host-readiness.md`

### T1.4.1
- 关联需求: REQ-004, REQ-006
- 关联契约: RuntimeSecretBootstrap, credential unavailable/decrypt failed error semantics, redacted diagnostics
- 风险类别: 运行时 secret 漂移、credential 误报为平台故障、敏感信息泄漏
- 单元测试覆盖: secret health mapper handles missing/wrong/valid key and missing base URL states
- API接口功能测试覆盖: status/connector diagnostic returns actionable unavailable envelopes without raw secret material
- 集成/E2E/冒烟覆盖: included in INT-S5
- 前置数据: fixture credential rows encrypted with valid and invalid keys plus absent env vars
- 断言: missing key/decrypt failure/base URL missing are distinguishable and redacted
- 证据: `tests/integration/cli/t1-4-1-runtime-secret-bootstrap.test.ts`

### T3.3.1
- 关联需求: REQ-004
- 关联契约: platformId:capability execution, LifeEvidence source refs, ConnectorAttemptAudit linkage
- 风险类别: 真实感知未激活、dry-run 与 real execution 断层、空结果被伪造成 evidence
- 单元测试覆盖: connector result mapper rejects source-less or credential-sensitive evidence candidates
- API接口功能测试覆盖: real read capability writes evidence and attempt audit for success/empty/auth/network outcomes
- 集成/E2E/冒烟覆盖: one real connector smoke included in INT-S5
- 前置数据: one trusted connector fixture with runtime secret, credential, base URL and deterministic source response
- 断言: successful read writes artifact + index with sourceRefs; empty/failure writes honest attempt without fabricated evidence
- 证据: `tests/integration/connectors/t3-3-1-real-connector-evidence.test.ts`

### T2.4.1
- 关联需求: REQ-002, REQ-004
- 关联契约: platformId:capability heartbeat intent contract, goal/narrative reason trace
- 风险类别: heartbeat 泛化 intent 空转、ambiguous capability 执行错误平台、credential unavailable 被误选
- 单元测试覆盖: planner selects platform-specific intent only when capability and credential route are unambiguous
- API接口功能测试覆盖: heartbeat decision contains platformId/capability/reason refs for goal and narrative driven cases
- 集成/E2E/冒烟覆盖: included in INT-S5 heartbeat smoke
- 前置数据: accepted goal, narrative focus, registered connector capability, credential health states
- 断言: selected intent includes platformId and capability; ambiguous/unavailable paths produce explicit denied reason
- 证据: `tests/unit/control-plane/t2-4-1-platform-intent.test.ts`, `tests/integration/control-plane/t2-4-1-heartbeat-platform-intent.test.ts`

### T2.4.2
- 关联需求: REQ-005
- 关联契约: source-backed outreach, delivery unavailable fallback, Narrative/Relationship context usage
- 风险类别: outreach 无 source refs、delivery 不可用时静默丢失、fallback 没有叙事来由
- 单元测试覆盖: outreach trigger mapper requires evidence + source refs + guard allow
- API接口功能测试覆盖: evidence -> judgment -> draft -> delivery/fallback returns before/after audit rows
- 集成/E2E/冒烟覆盖: included in INT-S5 source-backed outreach smoke
- 前置数据: connector evidence, narrative state, relationship memory, delivery available/unavailable fixtures
- 断言: draft includes what/why/source refs; unavailable delivery writes not_sent fallback with reason
- 证据: `tests/integration/control-plane/t2-4-2-source-backed-outreach-loop.test.ts`

### T4.2.1
- 关联需求: REQ-003, REQ-005
- 关联契约: owner reply chronicle event, RelationshipMemory feedback contract, relationship-aware outreach
- 风险类别: 关系反馈未闭合、单次回复过度推断、下次 outreach 不受历史影响
- 单元测试覆盖: reply classifier handles positive/negative/no_reply/busy and single-sample insufficient history
- API接口功能测试覆盖: owner reply ingestion writes SessionChronicle and updates RelationshipMemory before/after
- 集成/E2E/冒烟覆盖: included in INT-S5 relationship feedback smoke
- 前置数据: delivered/fallback outreach row, owner reply fixture, existing relationship memory
- 断言: reply updates tone/timing/topic/sourceRefs; next draft references the signal or marks insufficient_history
- 证据: `tests/integration/state/t4-2-1-owner-reply-relationship-loop.test.ts`

### T1.4.2
- 关联需求: REQ-002, REQ-003, REQ-006
- 关联契约: `sn goal set` criteria alias, `explain relationship` read contract, host-safe unavailable envelope
- 风险类别: ops UX 契约漂移、goal completion criteria 丢失、relationship state 不可解释
- 单元测试覆盖: goal input mapper accepts criteria and completionCriteria with deterministic precedence
- API接口功能测试覆盖: goal set persists criteria before/after; explain relationship returns redacted summary or honest nothing_yet/unavailable
- 集成/E2E/冒烟覆盖: included in INT-S5 activation UX smoke
- 前置数据: goal command input variants, relationship memory fixture, host-safe carrier fixture
- 断言: criteria persists to completionCriteria; explain relationship is supported and redacted
- 证据: `tests/integration/cli/t1-4-2-activation-ux-contract.test.ts`

### INT-S5
- 关联需求: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006
- 关联契约: RuntimeSecretBootstrap, real connector evidence, platform-specific intent, source-backed outreach, relationship feedback, activation UX
- 风险类别: v6 只完成工程面但 life loop 未激活
- 单元测试覆盖: S5 unit suite must pass
- API接口功能测试覆盖: runtime diagnostics, connector execution, heartbeat intent, outreach loop, reply ingestion, UX aliases
- 集成/E2E/冒烟覆盖: one real connector + one source-backed outreach + one owner reply feedback smoke
- 前置数据: configured runtime secret, one trusted connector, one accepted goal/narrative focus, delivery/fallback target
- 断言: connector evidence -> heartbeat intent -> outreach/fallback -> owner reply -> relationship signal is traceable end-to-end
- 证据: `reports/int-s5-v6-life-loop-activation.md`

---

## Contract Coverage Overlay

| Contract | Implementation | Verification | Risk | Status |
| --- | --- | --- | --- | --- |
| SessionChronicle | T4.1.1 | T4.1.1, INT-S1 | Dream/relationship input missing | Planned |
| NarrativeState | T4.1.2, T2.1.5 | T4.1.2, T2.1.5, INT-S3 | Unsupported narrative claim | Planned |
| RelationshipMemory | T4.1.3, T7.1.5 | T4.1.3, T7.1.5, INT-S3 | Over-inference | Planned |
| AgentGoal | T4.1.4, T2.1.4 | T4.1.4, T2.1.4, INT-S3 | Goal proposal越权 | Planned |
| MemoryStore / DreamOutputLifecycle | T4.1.5, T7.1.1 | T4.1.5, T7.1.1, INT-S2 | Active memory pollution | Planned |
| DreamTrace | T5.1.1 | T5.1.1, INT-S2, INT-S4 | Invisible Dream failure | Planned |
| NarrativeTrace | T5.1.2 | T5.1.2, INT-S3, INT-S4 | Unexplainable narrative update | Planned |
| ConnectorInventoryAudit | T5.1.3 | T5.1.3, T1.2.3, INT-S1 | Inventory/attempt confusion | Planned |
| DynamicConnectorRegistry | T3.1.1 | T3.1.1, INT-S1 | Manifest trust / conflict drift | Planned |
| CapabilityContractRegistry | T3.1.2 | T3.1.2, INT-S1 | route namespace drift | Planned |
| manifest.yaml schema | T3.1.1 | T3.1.1, INT-S1 | unsafe YAML / invalid schema | Planned |
| ConnectorTrustPolicy | T3.1.1 | T3.1.1, T1.2.3, INT-S1 | custom code execution | Planned |
| connector init CLI | T1.3.1 | T1.3.1 | overwrite/path escape/pending trust | Planned |
| goal command | T1.2.4 | T1.2.4, INT-S3, INT-S4 | proposal accepted by accident | Planned |
| cycle:recent read model | T1.2.5 | T1.2.5, INT-S4 | recent activity invisible or fabricated | Planned |
| status aggregate | T1.2.6 | T1.2.6, INT-S4 | v6 state invisible or sensitive leak | Planned |
| v6 ops commands | T1.2.1-T1.2.6 | T1.2.1-T1.2.6, INT-S4 | host-safe/full runtime drift | Planned |
| RuntimeSecretBootstrap | T1.4.1 | T1.4.1, INT-S5 | runtime secret drift / credential recovery invisible | Planned |
| real connector evidence path | T3.3.1 | T3.3.1, INT-S5 | dry-run pass but no lived evidence | Planned |
| platformId:capability heartbeat intent | T2.4.1 | T2.4.1, INT-S5 | generic intent never reaches connector | Planned |
| source-backed outreach delivery loop | T2.4.2 | T2.4.2, INT-S5 | evidence never becomes owner-visible outreach | Planned |
| owner reply relationship feedback | T4.2.1 | T4.2.1, INT-S5 | relationship memory not shaped by real replies | Planned |
| activation UX aliases / relationship explain | T1.4.2 | T1.4.2, INT-S5 | manual/E2E surface mismatches implementation | Planned |
| v5 compatibility | T3.2.1 and all state/ops tasks | INT-S1, INT-S4 | regression | Planned |

---

## Testing Coverage Overlay

| 测试类型 | 覆盖任务 | 说明 |
| --- | --- | --- |
| 单元测试 | T2.1.4, T2.1.5, T2.4.1, T3.1.1, T3.1.2, T4.1.1-T4.1.5, T4.2.1, T5.1.1-T5.1.3, T6.1.1, T7.1.1-T7.1.5 | schema、state transitions、policy、parser、validator、grounding、platform intent、reply classifier |
| API接口功能测试 | T1.2.1-T1.2.6, T1.3.1, T1.4.1, T1.4.2, T2.4.2, T3.1.2, T3.3.1, T4.1.1-T4.1.5, T4.2.1, T5.1.1-T5.1.3, T7.1.1-T7.1.3 | CLI/tool/port inputs, error semantics, before/after assertions, runtime diagnostics |
| 集成测试 | T1.2.1-T1.2.6, T1.4.1, T1.4.2, T2.1.5, T2.3.1, T2.4.1, T2.4.2, T3.1.1, T3.2.1, T3.3.1, T4.1.5, T4.2.1, T6.1.1, T7.1.1, T7.1.2 | cross-system flow, read models, real connector evidence, outreach and relationship feedback |
| 冒烟测试 | INT-S1, INT-S2, INT-S3, INT-S4, INT-S5 | sprint close gates |
| 回归测试 | T3.2.1, INT-S1, INT-S4, INT-S5 | v5 connector/state/plugin/heartbeat non-regression |
| 手动验证 | INT-S4, INT-S5 | true OpenClaw host/session smoke and one real life-loop activation smoke |

---

## Verification Traceability Matrix

| REQ/Contract | Task | Verification | Test Material | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| REQ-001 Dream | T4.1.5, T7.1.1, T7.1.2, T7.1.3, T7.1.4, T7.1.5, T5.1.1, T1.2.2, INT-S2, T3.3.1, INT-S5 | unit/API/integration/smoke | `tests/**/dream/**`, `tests/**/storage/**`, `tests/**/connectors/**` | `reports/int-s2-v6-dream-engine.md`, `reports/int-s5-v6-life-loop-activation.md` | Planned |
| REQ-002 Narrative/Goal | T4.1.2, T4.1.4, T1.2.4, T1.4.2, T2.1.4, T2.1.5, T2.4.1, T5.1.2, T1.2.1, INT-S3, INT-S5 | unit/API/integration/smoke | `tests/**/control-plane/**`, `tests/**/storage/**`, `tests/**/cli/**` | `reports/int-s3-v6-agent-self.md`, `reports/int-s5-v6-life-loop-activation.md` | Planned |
| REQ-003 Relationship | T4.1.3, T4.2.1, T7.1.5, T6.1.1, T2.3.1, T1.4.2, INT-S3, INT-S5 | unit/API/integration/smoke | `tests/**/guidance/**`, `tests/**/dream/**`, `tests/**/state/**`, `tests/**/cli/**` | `reports/int-s3-v6-agent-self.md`, `reports/int-s5-v6-life-loop-activation.md` | Planned |
| REQ-004 Connector Ecosystem | T1.4.1, T3.1.1, T3.1.2, T3.2.1, T3.3.1, T5.1.3, T1.3.1, T1.2.3, INT-S1, INT-S5 | unit/API/integration/smoke/manual | `tests/**/connectors/**`, `tests/**/cli/**` | `reports/int-s1-v6-foundation-connector.md`, `reports/int-s5-v6-life-loop-activation.md` | Planned |
| REQ-005 Outreach | T6.1.1, T2.3.1, T2.4.2, T4.2.1, INT-S3, INT-S5 | unit/integration/smoke/manual | `tests/**/guidance/**`, `tests/**/control-plane/**`, `tests/**/state/**` | `reports/int-s3-v6-agent-self.md`, `reports/int-s5-v6-life-loop-activation.md` | Planned |
| REQ-006 Observability | T1.4.1, T1.4.2, T5.1.1, T5.1.2, T5.1.3, T1.2.1-T1.2.6, INT-S4, INT-S5 | API/integration/smoke/manual | `tests/**/observability/**`, `tests/**/cli/**` | `reports/int-s4-v6-ops-host-readiness.md`, `reports/int-s5-v6-life-loop-activation.md` | Planned |
| ConnectorTrustPolicy | T3.1.1, T1.2.3, T1.3.1 | unit/API/integration | pending trust and executable=false fixtures | `reports/int-s1-v6-foundation-connector.md` | Planned |
| DreamOutputLifecycle | T4.1.5, T7.1.1, T7.1.2 | unit/API/integration | candidate/accepted/partial fixtures | `reports/int-s2-v6-dream-engine.md` | Planned |
| `sn goal` command | T1.2.4 | API/integration/smoke | `tests/integration/cli/t1-2-4-goal-command.test.ts` | `reports/int-s4-v6-ops-host-readiness.md` | Planned |
| `sn cycle:recent` command | T1.2.5 | API/integration/smoke | `tests/integration/cli/t1-2-5-cycle-recent-command.test.ts` | `reports/int-s4-v6-ops-host-readiness.md` | Planned |
| `sn status` aggregate | T1.2.6 | API/integration/smoke | `tests/integration/cli/t1-2-6-status-aggregate.test.ts` | `reports/int-s4-v6-ops-host-readiness.md` | Planned |
| RuntimeMode ops envelope | T1.2.1-T1.2.6, INT-S4 | API/smoke/manual | host-safe/full runtime fixtures | `reports/int-s4-v6-ops-host-readiness.md` | Planned |
| Life Loop Activation | T1.4.1, T3.3.1, T2.4.1, T2.4.2, T4.2.1, T1.4.2, INT-S5 | unit/API/integration/smoke/manual | runtime secret + real connector + heartbeat + outreach + reply fixtures | `reports/int-s5-v6-life-loop-activation.md` | Planned |
