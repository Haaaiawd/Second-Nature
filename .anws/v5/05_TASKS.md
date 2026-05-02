# Second Nature v5 任务清单 (Task List)

> **版本**: v5  
> **Source of Truth**: `.anws/v5/01_PRD.md`, `.anws/v5/02_ARCHITECTURE_OVERVIEW.md`, `.anws/v5/03_ADR/`, `.anws/v5/04_SYSTEM_DESIGN/`  
> **生成日期**: 2026-05-01  
> **规划原则**: 不重新设计 v5 架构，只把已修复的 PRD / ADR / System Design 转成可执行 WBS。

---

## 🔐 Contract Mapping

| 公共契约 | 类型 | 契约层级 | 实现承接 | 验证承接 |
| --- | --- | --- | --- | --- |
| `second_nature_ops("heartbeat_check")` / `HeartbeatSurfaceResult` | CLI / 操作契约 | 关键用户路径契约 | T1.1.3, T2.1.1, T2.2.1 | T1.3.1, INT-S1, INT-S2 |
| OpenClaw capability probe / `HostCapabilityReport` | 宿主能力契约 | 跨系统契约 | T1.1.2 | T1.1.2, INT-S1 |
| `heartbeat_tool_not_invoked` | 宿主默认态契约 | 关键用户路径契约 | T1.1.2 | T1.3.1 |
| Runtime artifact boundary | Packaging / 文件结构 | 基础规则层契约 | T1.1.1 | T1.1.1, INT-S4 |
| `LifeEvidence` / `LifeEvidenceCandidate` | 文件/持久化结构 | 跨系统契约 | T3.1.2, T4.1.1 | T3.1.2, T4.2.1 |
| `RhythmPolicySnapshot -> RhythmWindowDecision` | 状态/控制层接口 | 跨系统契约 | T4.1.2, T2.1.2 | T2.1.2 |
| `UserInterestSnapshot.staleness = insufficient` | 状态读模型 | 基础规则层契约 | T4.2.2, T6.1.2 | T4.2.2 |
| `SourceCoveragePolicy` / all-claim grounding | 事实边界 / 反思契约 | 关键用户路径契约 | T4.4.1, T5.2.1, T6.1.2 | T4.4.1, T5.2.1, T6.1.2, INT-S3 |
| `OutreachJudgment` | 控制层决策 | 关键用户路径契约 | T2.3.1 | T2.3.1, INT-S3 |
| `OutreachDraftRequest` | control-plane / guidance 接口 | 跨系统契约 | T6.1.1 | T6.2.1 |
| `DeliveryAttemptRecord` | 持久化结构 | 跨系统契约 | T4.3.1 | T4.3.1 |
| delivery failed / `dropped_by_host_policy` fallback | 错误语义 / fallback | 关键用户路径契约 | T2.3.2, T4.3.1 | T2.3.2 |
| `OperatorFallbackArtifact.status = not_sent` | 文件/状态格式 | 跨系统契约 | T4.3.1, T1.2.2 | T4.3.1, T1.2.2 |
| Quiet source coverage / empty evidence | 文件/反思契约 | 关键用户路径契约 | T2.3.3, T4.4.1, T6.1.2 | T4.4.1, T6.1.2, T2.3.3, INT-S3 |
| `DecisionTrace` / `DeliveryAuditRecord` | 审计结构 | 跨系统契约 | T5.1.1, T5.2.1 | T5.2.1 |
| `verifyAuditHashChain(range)` | 审计完整性 | 基础规则层契约 | T5.2.2 | T5.2.2 |
| startup repair gate / `repair_required` | 启动恢复契约 | 基础规则层契约 | T4.1.3 | T4.1.3 |
| side-effect idempotency / effect commit ledger | 外部副作用恢复 | 关键用户路径契约 | T3.2.1, T4.1.1 | T3.2.1, INT-S2 |
| native SQLite vs sql.js storage mode | 存储运行模式 | 基础设施契约 | T4.1.4 | T4.1.4, INT-S1 |
| README current / target / validation-needed | 文档边界 | 关键用户路径契约 | T1.4.1 | T7.1.1 |

---

## 📊 Sprint 路线图

| Sprint | 代号 | 核心任务 | 退出标准 | 预估 |
| --- | --- | --- | --- | --- |
| S1 | Host & State Foundation | OpenClaw capability probe、runtime artifact、基础 state / observability schema、repair / storage mode | 能生成 capability report；能区分 host tool 未调用；state 基础契约单测通过；native/sql.js smoke 有结果 | 6-7d |
| S2 | Evidence & Rhythm Loop | heartbeat decision loop、rhythm owner boundary、connector evidence、snapshot/read model | near-real heartbeat 可读取 evidence snapshot 并产出 rhythm decision / HEARTBEAT_OK / deferred 等结构化结果 | 7d |
| S3 | Outreach / Quiet Closure | OutreachJudgment、OutreachDraftRequest、delivery fallback、DeliveryAttemptRecord、Quiet writer/source coverage、hash-chain | source-backed outreach 可 allow/deny/fallback；delivery failed 不冒充 sent；Quiet 空/非空路径闭合 | 6-7d |
| S4 | Packaging / Host Smoke / Docs | ops read model、host smoke、platform near-real path、release/readme boundary | 插件包 host smoke 报告可复现；README 能诚实表达 current / target / validation-needed | 6-7d |

---

## 依赖图总览

> 说明：下图只展示主干依赖，完整执行顺序以各任务的 **依赖** 字段和 INT 输入为准。

```mermaid
graph TD
    T1_1_1[T1.1.1 Runtime artifact boundary] --> T1_1_3[T1.1.3 heartbeat_check surface]
    T1_1_2[T1.1.2 OpenClaw capability probe] --> T1_3_1[T1.3.1 host smoke]
    T5_1_1[T5.1.1 audit envelope] --> T1_1_2
    T4_1_1[T4.1.1 LifeEvidence storage] --> T4_2_1[T4.2.1 LifeEvidenceSnapshot]
    T4_1_2[T4.1.2 RhythmPolicySnapshot] --> T2_1_2[T2.1.2 Rhythm owner boundary test]
    T4_1_3[T4.1.3 startup repair gate] --> T4_2_1
    T4_1_4[T4.1.4 storage mode smoke] --> INT_S1[INT-S1]
    T1_1_3 --> T2_2_1[T2.2.1 heartbeat integration]
    T4_2_1 --> T2_1_1
    T2_1_2 --> T2_1_3[T2.1.3 candidate planner and guards]
    T3_1_1[T3.1.1 connector manifest contract] --> T3_1_2[T3.1.2 LifeEvidenceCandidate mapping]
    T3_1_2 --> T4_2_1
    T2_1_1 --> T2_2_1[T2.2.1 heartbeat integration]
    T2_1_3 --> T2_2_1
    T4_2_2[T4.2.2 UserInterest insufficient downgrade] --> T2_3_1[T2.3.1 OutreachJudgment and delivery policy]
    T4_2_2 --> T6_1_2[T6.1.2 interest and Quiet downgrade]
    T6_1_1[T6.1.1 guidance interfaces] --> T6_2_1[T6.2.1 OutreachDraftRequest contract test]
    T2_3_1 --> T6_2_1
    T6_2_1 --> T2_3_2[T2.3.2 delivery failed fallback test]
    T4_3_1[T4.3.1 DeliveryAttemptRecord write/read] --> T2_3_2
    T5_2_1[T5.2.1 delivery audit explain] --> T2_3_2
    T5_2_2[T5.2.2 verifyAuditHashChain(range)] --> INT_S3[INT-S3]
    T4_2_1 --> T4_4_1[T4.4.1 Quiet artifact writer]
    T4_4_1 --> T6_1_2
    T4_4_1 --> T2_3_3[T2.3.3 Quiet orchestration]
    T1_2_1[T1.2.1 ops read models] --> T1_2_2[T1.2.2 fallback view]
    T1_3_1 --> INT_S4[INT-S4]
    T1_3_1 --> T1_4_1[T1.4.1 README truth boundary]
    T1_4_1 --> T7_1_1[T7.1.1 documentation review]
```

---

## System 1: Agent-facing Ops Surface System (`cli-system`)

### Phase 1: Foundation

- [x] **T1.1.1** [REQ-019]: 实现 packaged runtime artifact boundary
  - **描述**: 建立 plugin entry wrapper、runtime registration、artifact module 清单与 source path dependency 禁止规则。
  - **输入**: `04_SYSTEM_DESIGN/cli-system.md` §5.1, §12.1；`04_SYSTEM_DESIGN/cli-system.detail.md` §3.1-§3.2；`03_ADR/ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md` §决策
  - **输出**: `RuntimeArtifactBoundary`、`resolvePackagedRuntime()`、package contents check
  - **契约承接**: runtime artifact boundary；`sourcePathDependencyAllowed: false`
  - **📎 参考**: `ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md`, `cli-system.md` §11-§12
  - **验收标准**:
    - Given 发布包安装后没有源码仓 `src/`
    - When plugin entry 加载 runtime artifact
    - Then command/tool/service/probe 所需模块从包内 artifact 解析，且源码相对路径被单元测试拒绝
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 `resolvePackagedRuntime()` 正常加载、artifact missing、source path dependency forbidden 三条分支。
  - **估时**: 6h
  - **依赖**: 无
  - **优先级**: P0

- [x] **T1.1.2** [REQ-025]: OpenClaw capability probe early sprint
  - **描述**: 实现 `probeHostCapability(options)` 与 `HostCapabilityReport` 写入，优先验证 heartbeat bridge、heartbeat tool invocation、delivery target、ack drop、hook/runHeartbeatOnce 能力，并记录 docs-vs-observed 冲突证据。
  - **输入**: `04_SYSTEM_DESIGN/cli-system.md` §5.1, §6.1, §11.3；`04_SYSTEM_DESIGN/cli-system.detail.md` §3.6；`03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md` §质量门禁；T5.1.1 产出的 host capability audit port
  - **输出**: `probeHostCapability()`、`HostCapabilityReport`、`recordHostCapability()` 调用点
  - **契约承接**: OpenClaw capability probe；`HostCapabilityReport`; `heartbeatToolInvocation`
  - **📎 参考**: `cli-system.md` §4.4, §11.4；`observability-system.md` §5.1
  - **验收标准**:
    - Given 当前 OpenClaw host adapter 可返回 feature checks
    - When 执行 capability probe
    - Then report 必须包含 pluginLoad、heartbeatBridge、heartbeatToolInvocation、deliveryTarget、ackDropBehavior、hookSupport、hostVersion、docLinks、docCheckedAt、observedVersion 与 conflictRecords，并写入 observability
  - **验证类型**: 单元测试 + 集成测试
  - **验证说明**: 使用 fake host adapter 验证 target_available、target_none、host_api_unavailable、unknown、docs-vs-observed conflict 分支；单测覆盖 `classifyDeliveryCapability()` 与 capability report merge；真实 host smoke 放到 T1.3.1。
  - **估时**: 6h
  - **依赖**: T5.1.1
  - **优先级**: P0

- [x] **T1.1.3** [REQ-019]: 收口 `second_nature_ops("heartbeat_check")` surface
  - **描述**: 实现 command/tool 共用 ops router 与 stable `HeartbeatSurfaceResult` schema；S1 只闭合 carrier/probe/runtime unavailable/fake control-plane passthrough，真实 control-plane decision loop 由 T2.2.1 接入。
  - **输入**: `04_SYSTEM_DESIGN/cli-system.md` §5.1-§5.4；`04_SYSTEM_DESIGN/cli-system.detail.md` §3.3-§3.5；T1.1.1 产出的 packaged runtime
  - **输出**: `createOpsRouter()`、`heartbeatCheck()`、`HeartbeatSurfaceResult`
  - **契约承接**: `HeartbeatSurfaceResult`; host-safe carrier truth split
  - **📎 参考**: `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`, `cli-system.md` §11.2
  - **验收标准**:
    - Given full runtime 不可用
    - When 调用 `second_nature_ops({ command: "heartbeat_check" })`
    - Then 返回 `runtime_carrier_only` 且不得声称进入 lived-experience loop；fake control-plane adapter 返回的 structured result 只用于 schema parity，不计入真实 decision loop 完成
  - **验证类型**: 集成测试
  - **验证说明**: command surface 与 tool surface 对同一输入返回同一 schema；覆盖 probeOnly、runtime unavailable、fake control-plane passthrough 三条路径；真实 state snapshot -> decision loop 接入由 T2.2.1 / INT-S2 验证。
  - **估时**: 5h
  - **依赖**: T1.1.1
  - **优先级**: P0

### Phase 2: Read Models

- [x] **T1.2.1** [REQ-019]: 实现 status / audit / explain / capability report read models
  - **描述**: 让 ops surface 可读取 decision、delivery、fallback、capability report、repair summary 等脱敏视图。
  - **输入**: `04_SYSTEM_DESIGN/cli-system.md` §5.1, §12.3；`04_SYSTEM_DESIGN/observability-system.md` §5.1；T5.3.1 产出的 explain read model
  - **输出**: `OpsReadModelPort` adapters、`explainSurfaceSubject()`
  - **契约承接**: operator explain read model；JSON-first result
  - **📎 参考**: `cli-system.detail.md` §3.8
  - **验收标准**:
    - Given decisionId / fallbackRef / reportId 存在
    - When CLI 或 tool 请求 explain/report/audit
    - Then 返回脱敏结构化视图，并包含 no user-visible contact 警告（如适用）
  - **验证类型**: 集成测试
  - **验证说明**: 使用 fake state/observability read models 验证 subject 路由、missing subject、unsupported subject。
  - **估时**: 6h
  - **依赖**: T5.3.1, T4.3.1
  - **优先级**: P1

- [ ] **T1.2.2** [REQ-022]: 实现 operator-visible fallback view
  - **描述**: 实现 `showOperatorFallback(ref)`，固定返回 `status: not_sent`，展示 reason、sourceRefs、candidateMessage、nextStep。
  - **输入**: `04_SYSTEM_DESIGN/cli-system.md` §5.1, §6.1；`04_SYSTEM_DESIGN/state-system.md` §5.1, §6.1；T4.3.1 产出的 fallback read model
  - **输出**: `showOperatorFallback()`、fallback CLI/tool view
  - **契约承接**: `OperatorFallbackView.status = not_sent`
  - **📎 参考**: `cli-system.detail.md` §3.9；`state-system.detail.md` §3.7
  - **验收标准**:
    - Given fallback artifact 存在
    - When operator 查询 fallback
    - Then 视图永远不把 fallback 展示为 sent / delivered
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 target_none、channel_missing、host_unsupported、delivery_failed 四类 fallback reason。
  - **估时**: 5h
  - **依赖**: T4.3.1
  - **优先级**: P1

### Phase 3: Host Smoke

- [x] **T1.3.1** [REQ-025]: `heartbeat_tool_not_invoked` host smoke
  - **描述**: 实现 host smoke case，验证真实/near-real heartbeat turn 是否实际调用 `second_nature_ops("heartbeat_check")`；未调用时记录 `heartbeat_tool_not_invoked`。
  - **输入**: `04_SYSTEM_DESIGN/cli-system.md` §11.3-§11.4；`04_SYSTEM_DESIGN/cli-system.detail.md` §3.7；T1.1.2 产出的 capability probe；T1.1.3 产出的 heartbeat surface
  - **输出**: `runHostSmoke()` case: `heartbeat_tool_invocation`
  - **契约承接**: `heartbeat_tool_not_invoked` 默认态失败语义
  - **📎 参考**: `07_CHALLENGE_REPORT.md` CH-07-06；`cli-system.md` §11.3
  - **验收标准**:
    - Given host smoke prompt fixture 要求 heartbeat 调用 `second_nature_ops("heartbeat_check")`
    - When 模型/host 未调用 tool
    - Then smoke report 标记 `heartbeat_tool_not_invoked`，不得当作 `HEARTBEAT_OK`；如官方文档与实测冲突，报告必须记录 doc link、doc checked date、host version 与 observed behavior
  - **验证类型**: 冒烟测试
  - **验证说明**: 使用可复现 host smoke fixture；若真实 host 不可用，near-real adapter 必须输出 fail/unknown，而不是 pass；覆盖 docs-vs-observed conflict fixture。
  - **估时**: 6h
  - **依赖**: T1.1.2, T1.1.3
  - **优先级**: P0

### Phase 4: Documentation Boundary

- [ ] **T1.4.1** [REQ-026]: README current / target / validation-needed 边界更新
  - **描述**: 更新 README，明确当前已验证能力、v5 target 能力和 host validation needed，不再把 v4 heartbeat ack 表述成完整生活闭环。
  - **输入**: `01_PRD.md` US-008；`04_SYSTEM_DESIGN/cli-system.md` §2.1；`07_CHALLENGE_REPORT.md` P1 建议；T1.1.2 capability report；T1.3.1 host smoke report；T1.2.2 fallback view
  - **输出**: README current shape / target / validation-needed 章节
  - **契约承接**: README 诚实边界契约
  - **📎 参考**: `01_PRD.md` §6.1, US-008
  - **验收标准**:
    - Given v5 capability report / host smoke report 已产出，或某项真实 host 结果仍为 unknown
    - When README 描述主动联系、heartbeat、life evidence
    - Then 每条能力标明 current / target / validation-needed，且以 `.anws/v5` 为当前规范来源
  - **验证类型**: 手动验证
  - **验证说明**: 对照 PRD US-008、capability report、host smoke report 与 fallback view 逐条检查 README 表述；unknown 必须标为 validation-needed，不等待 INT-S4 才能完成初版边界。
  - **估时**: 4h
  - **依赖**: T1.1.2, T1.3.1, T1.2.2
  - **优先级**: P1

- [ ] **T1.4.2** [REQ-026]: 发布门禁报告与 package host smoke 汇总
  - **描述**: 生成 release gate 报告，汇总 package contents、plugin install/load、heartbeat_check、target none、ack drop、delivery target availability、fallback visibility。
  - **输入**: `04_SYSTEM_DESIGN/cli-system.md` §12.2；T1.3.1 host smoke；T4.1.4 storage mode smoke；T1.4.1 README 更新
  - **输出**: release gate report artifact
  - **契约承接**: release gate / host smoke report
  - **📎 参考**: `cli-system.md` §12.2；`ADR_001_TECH_STACK.md` §验证策略决策
  - **验收标准**:
    - Given S4 任务完成
    - When release gate report 生成
    - Then report 明确 pass/fail/unknown，并列出阻塞下一步发布的 host 或 packaging 风险
  - **验证类型**: 手动验证
  - **验证说明**: 使用固定报告模板，逐项引用 smoke report / capability report / README diff。
  - **估时**: 5h
  - **依赖**: T1.3.1, T4.1.4, T1.4.1
  - **优先级**: P1

---

## System 2: Second Nature Orchestration System (`control-plane-system`)

### Phase 1: Heartbeat Runtime

- [x] **T2.1.1** [REQ-019]: 实现 `runHeartbeatCycle()` skeleton 与 scope routing
  - **描述**: 建立 heartbeat signal、runtime availability 分支、`routeScopedInput()`、snapshot load 与 no-candidate `HEARTBEAT_OK` 静默记录。
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.md` §5.1, §6.1；`04_SYSTEM_DESIGN/control-plane-system.detail.md` §3.1-§3.3；T4.2.1 产出的 snapshots
  - **输出**: `ControlPlaneRuntimePort.runHeartbeatCycle()`、`routeScopedInput()`
  - **契约承接**: heartbeat decision loop；`runtime_carrier_only`; User Task Scope bypass
  - **📎 参考**: `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`, `control-plane-system.md` §11.4
  - **验收标准**:
    - Given runtime available 且无候选 intent
    - When heartbeat cycle 运行
    - Then 返回 `heartbeat_ok` 并记录 silent reason；用户任务 scope 不进入 rhythm gate
  - **验证类型**: 单元测试 + 集成测试
  - **验证说明**: 单测覆盖 `routeScopedInput()`、runtime availability branch、user_task bypass、user_reply light continuity；集成测试覆盖 runtime unavailable 与 heartbeat rhythm scope。
  - **估时**: 8h
  - **依赖**: T4.2.1, T5.1.1
  - **优先级**: P0

- [x] **T2.1.2** [REQ-021]: `RhythmPolicySnapshot -> RhythmWindowDecision` owner boundary test
  - **描述**: 验证 state 只生产 `RhythmPolicySnapshot`，control-plane 拥有 `RhythmWindowDecision` 选择权，并统一 `allowedIntentKinds`。
  - **输入**: `02_ARCHITECTURE_OVERVIEW.md` §7；`04_SYSTEM_DESIGN/control-plane-system.md` §5.1；`04_SYSTEM_DESIGN/state-system.md` §5.2；T4.1.2 产出的 rhythm policy read model
  - **输出**: owner boundary unit test + `selectRhythmWindow()` fixtures
  - **契约承接**: `RhythmPolicySnapshot -> RhythmWindowDecision` owner boundary
  - **📎 参考**: `07_CHALLENGE_REPORT.md` CH-07-04；`control-plane-system.detail.md` §3.4
  - **验收标准**:
    - Given state 返回 `RhythmPolicySnapshot`
    - When control-plane 选择 rhythm window
    - Then 输出 `RhythmWindowDecision`，且 state 不提供 `allowedIntentKinds` 决策结果
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 work/social/quiet/reflection/maintenance、paused_for_interrupt、字段名漂移失败用例。
  - **估时**: 4h
  - **依赖**: T4.1.2
  - **优先级**: P0

- [x] **T2.1.3** [REQ-021]: 实现 candidate planner 与 hard guard
  - **描述**: 实现 work、exploration、social、quiet、reflection、outreach、maintenance 候选规划与 source/cooldown/dedupe/budget/risk guard。
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.md` §5.1, §11.1；`04_SYSTEM_DESIGN/control-plane-system.detail.md` §3.5-§3.6；T2.1.2 输出的 rhythm decision
  - **输出**: `planCandidateIntents()`、`evaluateHardGuards()`
  - **契约承接**: `CandidateIntent`; `GuardEvaluation`; source-backed candidate rule
  - **📎 参考**: `ADR_003_SECOND_NATURE_GOVERNANCE.md`, `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
  - **验收标准**:
    - Given 不同 rhythm window 和 evidence snapshot
    - When planner 生成候选
    - Then 候选集合符合 window bias，但最终 allow/deny/defer 由 hard guard 决定
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 source missing、duplicate、cooldown、quiet suppression、max candidates 分支。
  - **估时**: 6h
  - **依赖**: T2.1.2, T4.2.1
  - **优先级**: P0

### Phase 2: Evidence Integration

- [x] **T2.2.1** [REQ-019]: heartbeat -> snapshot -> intent integration
  - **描述**: 连接 state snapshots、candidate planner、decision recorder，完成无候选、work/connector、quiet 候选的基础集成路径。
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.md` §4.3, §11.2；T2.1.1, T2.1.3, T3.1.2, T5.1.1 的输出
  - **输出**: heartbeat integration flow + decision trace writes
  - **契约承接**: heartbeat decision record; `HeartbeatCycleResult`
  - **📎 参考**: `control-plane-system.md` §12.2
  - **验收标准**:
    - Given source-backed evidence snapshot 存在
    - When heartbeat 运行
    - Then 至少能产出 `heartbeat_ok`、`intent_selected`、`denied` 或 `deferred` 中一种结构化状态，并写 decision trace
  - **验证类型**: 集成测试
  - **验证说明**: 使用 fake state/connector/observability 端口验证 snapshot -> intent -> record 顺序。
  - **估时**: 7h
  - **依赖**: T2.1.1, T2.1.3, T3.1.2, T5.1.1
  - **优先级**: P0

### Phase 3: Outreach / Delivery / Quiet

- [x] **T2.3.1** [REQ-022]: 实现 `OutreachJudgment` 与 delivery policy
  - **描述**: 实现 `judgeOutreach()`、`resolveDeliveryTarget()`，覆盖 valueScore、userRelevance、actionability、cooldown、dedupe、target none/channel missing/target available。
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.md` §5.1, §6.1, §11.4；`04_SYSTEM_DESIGN/control-plane-system.detail.md` §3.7-§3.8；T4.2.2 产出的 user interest snapshot
  - **输出**: `OutreachJudgment`、`DeliveryTargetResolution`
  - **契约承接**: `OutreachJudgment`; delivery target availability hard prerequisite
  - **📎 参考**: `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md` §决策
  - **验收标准**:
    - Given source-backed candidate 与 user interest snapshot
    - When outreach judgment 执行
    - Then only evidence-backed, high-value, cooldown-clear candidate can allow；`target: none` 进入 fallback path 而不是 sent
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 missing source、low value、insufficient interest but actionable、cooldown、duplicate、target_none、channel_missing、target_available。
  - **估时**: 7h
  - **依赖**: T2.1.3, T4.2.2
  - **优先级**: P0

- [x] **T2.3.2** [REQ-022]: delivery failed / `dropped_by_host_policy` fallback test
  - **描述**: 为 `dispatchAllowedIntent()` 增加失败态验证，确保 delivery attempt `failed` 或 `dropped_by_host_policy` 后写 operator fallback，且结果为 `delivery_unavailable`。
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.detail.md` §3.9；`04_SYSTEM_DESIGN/state-system.md` §6.1；`07_CHALLENGE_REPORT.md` CH-07-02；T4.3.1 产出的 `writeDeliveryAttempt()`；T6.2.1 产出的 draft contract test
  - **输出**: delivery failed fallback integration test
  - **契约承接**: delivery failed / dropped_by_host_policy fallback; fallback 不冒充 sent
  - **📎 参考**: `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md` §质量门禁
  - **验收标准**:
    - Given outreach judgment allow 且 draft ready
    - When OpenClaw delivery 返回 `failed` 或 `dropped_by_host_policy`
    - Then 写入 `DeliveryAttemptRecord` 与 `OperatorFallbackArtifact`，返回 `delivery_unavailable`，且 explain 不声称已联系用户
  - **验证类型**: 集成测试
  - **验证说明**: 用 fake delivery port 返回 failed/dropped 两类状态；断言 fallbackRef、deliveryAttemptId、reasonCodes 同步存在。
  - **估时**: 4h
  - **依赖**: T2.3.1, T4.3.1, T5.2.1, T6.2.1
  - **优先级**: P0

- [x] **T2.3.3** [REQ-024]: source-backed Quiet / reflection orchestration
  - **描述**: 在 heartbeat 中接入 Quiet / reflection path，空 evidence 只产生 empty-state / maintenance，非空 evidence 请求 source coverage-aware Quiet artifact。
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.md` §4.4, §11.4；`04_SYSTEM_DESIGN/control-plane-system.detail.md` §4.3；T4.4.1 Quiet artifact writer；T6.1.2 Quiet guidance
  - **输出**: `runSourceBackedQuiet()` orchestration
  - **契约承接**: Quiet source coverage; empty evidence 不虚构经历
  - **📎 参考**: `ADR_003_SECOND_NATURE_GOVERNANCE.md`, `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
  - **验收标准**:
    - Given life evidence 为空
    - When Quiet window heartbeat 运行
    - Then 只写 empty-state / maintenance 结果，不生成虚构 narrative reflection
  - **验证类型**: 集成测试
  - **验证说明**: 覆盖 empty evidence、low coverage、sufficient coverage 三条路径。
  - **估时**: 6h
  - **依赖**: T2.2.1, T4.4.1, T6.1.2
  - **优先级**: P1

---

## System 3: Platform Connector System (`connector-system`)

### Phase 1: Contract Foundation

- [x] **T3.1.1** [REQ-020]: 实现 connector manifest / capability contract
  - **描述**: 建立 manifest-first connector registry、capability taxonomy、effect semantics、channel taxonomy 与 schema validation。
  - **输入**: `04_SYSTEM_DESIGN/connector-system.md` §5.1-§6.1；`04_SYSTEM_DESIGN/connector-system.detail.md` §1-§3.3；`03_ADR/ADR_002_CONNECTOR_MODEL.md`
  - **输出**: `ConnectorManifestRegistry`、`describeConnector()`、`checkConnector()`、`discoverCapabilities()`
  - **契约承接**: `ConnectorManifest`; `CapabilityIntent`; degraded channel policy
  - **📎 参考**: `connector-system.md` §11.3
  - **验收标准**:
    - Given Moltbook/InStreet/EvoMap manifest fixture
    - When registry 加载和 discover capabilities
    - Then capability、credential、degraded channel、sourceRefPolicy 均通过 schema 校验
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖缺 capability、未知 channel、degraded side-effect channel、credential missing 分支。
  - **估时**: 6h
  - **依赖**: 无
  - **优先级**: P0

- [x] **T3.1.2** [REQ-020]: `LifeEvidenceCandidate` mapping contract test
  - **描述**: 实现 `mapLifeEvidence(result)` 并验证 connector 成功结果能产生 platform/work evidence candidate，sourceRefs 非空且 sensitivity 正确。
  - **输入**: `04_SYSTEM_DESIGN/connector-system.md` §4.6, §5.1, §11.2；`04_SYSTEM_DESIGN/connector-system.detail.md` §3.8-§3.9；T3.1.1 manifest contract
  - **输出**: `LifeEvidenceCandidate` mapper + contract fixtures
  - **契约承接**: `LifeEvidenceCandidate`; `sourceRefs` 非空；sensitivity/redaction
  - **📎 参考**: `state-system.md` §5.1 `appendLifeEvidence(candidate)`
  - **验收标准**:
    - Given `feed.read` / `work.discover` connector success result
    - When evidence mapper 执行
    - Then 产出 `platform_browse` / `task_discovery` evidence candidate，且 sourceRefs 非空
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 no sourceRefs 不写 evidence、message.send 不等于 OpenClaw owner delivery、sensitive content ref-only。
  - **估时**: 5h
  - **依赖**: T3.1.1
  - **优先级**: P0

### Phase 2: Execution Safety

- [x] **T3.2.1** [REQ-020]: 实现 side-effect idempotency / retry gate
  - **描述**: 实现 `enforceExecutionPolicy()`、bounded retry、idempotency key、effect commit ledger 交互，防止重复 heartbeat / retry / crash recovery 造成重复副作用。
  - **输入**: `04_SYSTEM_DESIGN/connector-system.md` §4.5, §5.1, §9；`04_SYSTEM_DESIGN/connector-system.detail.md` §3.6, §4.2；T4.1.1 state commit port；`05_TASKS.md` Contract Mapping: side-effect idempotency
  - **输出**: execution policy layer + effect commit integration
  - **契约承接**: side-effect retry gate；effect commit ledger
  - **📎 参考**: `ADR_002_CONNECTOR_MODEL.md` §决策
  - **验收标准**:
    - Given side-effect request 缺少 idempotency key
    - When connector policy 执行
    - Then 阻断自动 retry 并返回 terminal policy failure；重复 idempotency key 命中 committed outcome 时不得再次执行 adapter
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 read-only retry、side-effect no key、degraded side-effect rejection、Retry-After respect、existing committed outcome、dispatched/reconcile recovery 分支。
  - **估时**: 6h
  - **依赖**: T3.1.1, T4.1.1
  - **优先级**: P0

### Phase 3: Near-real Platform Paths

- [ ] **T3.3.1** [REQ-020]: Moltbook / InStreet / EvoMap near-real read/write path
  - **描述**: 为至少一个社交平台和一个 agent-network 平台提供 near-real read path，并为一条 write/task path 提供 dry-run 或显式安全验证。
  - **输入**: `04_SYSTEM_DESIGN/connector-system.md` §11.1-§11.2；`01_PRD.md` US-002；T3.1.2 evidence mapper；T3.2.1 execution safety
  - **输出**: near-real platform smoke fixtures + connector attempt audit
  - **契约承接**: platform/work life evidence path
  - **📎 参考**: `connector-system.md` §12
  - **验收标准**:
    - Given platform fixture 或 near-real adapter 可用
    - When `feed.read` 与 `work.discover` 执行
    - Then state 可查询平台生活和任务发现 evidence，observability 有 connector attempt
  - **验证类型**: 集成测试
  - **验证说明**: 首版允许 dry-run/sentinel；真实副作用必须显式确认并带 idempotency key。
  - **估时**: 6h
  - **依赖**: T3.1.2, T3.2.1, T5.1.2
  - **优先级**: P1

---

## System 4: State & Memory System (`state-system`)

### Phase 1: Storage Foundation

- [x] **T4.1.1** [REQ-020]: 实现 `LifeEvidence` storage schema 与 repository
  - **描述**: 建立 filesystem + SQLite/sql.js hybrid 的 `appendLifeEvidence()`、evidence index、provenance link 与 snapshot cache invalidation。
  - **输入**: `04_SYSTEM_DESIGN/state-system.md` §5.1, §6.1；`04_SYSTEM_DESIGN/state-system.detail.md` §3.1；`02_ARCHITECTURE_OVERVIEW.md` §7
  - **输出**: `appendLifeEvidence()`、evidence artifact / index schema
  - **契约承接**: `LifeEvidence`; sourceRefs 非空；sensitive/credential redaction
  - **📎 参考**: `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md` §决策
  - **验收标准**:
    - Given connector 提交 source-backed evidence candidate
    - When state 写入 evidence
    - Then filesystem artifact 与 index 均可查询，且 credential sensitivity 被拒绝
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 missing sourceRefs、credential sensitivity、append artifact success / index invalidation。
  - **估时**: 6h
  - **依赖**: 无
  - **优先级**: P0

- [x] **T4.1.2** [REQ-021]: 实现 `RhythmPolicySnapshot` read model
  - **描述**: 实现 `loadRhythmPolicySnapshot()`，仅提供 quietEnabled、socialDailyLimit、outreachDailyBudget、updatedAt 等 policy 数据，不包含 decision 结果。
  - **输入**: `02_ARCHITECTURE_OVERVIEW.md` §7；`04_SYSTEM_DESIGN/state-system.md` §5.2；`04_SYSTEM_DESIGN/state-system.detail.md` §2
  - **输出**: `RhythmPolicySnapshot` repository/read model
  - **契约承接**: `RhythmPolicySnapshot` owner boundary
  - **📎 参考**: `07_CHALLENGE_REPORT.md` CH-07-04
  - **验收标准**:
    - Given policy record 存在或缺省
    - When state 加载 rhythm policy snapshot
    - Then 返回 policy 字段，不返回 `allowedIntentKinds` 或 window decision 字段
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖默认值、policy update、字段漂移禁止断言。
  - **估时**: 6h
  - **依赖**: T4.1.1
  - **优先级**: P0

- [x] **T4.1.3** [REQ-020]: startup repair gate
  - **描述**: 将 `repairStateIndexes({ startupGate: true })` 作为 read model 对外服务前置门禁；无法修复时标记 `repair_required`。
  - **输入**: `04_SYSTEM_DESIGN/state-system.md` §12.2；`04_SYSTEM_DESIGN/state-system.detail.md` §3.13；`07_CHALLENGE_REPORT.md` CH-07-07；T4.1.1 artifact/index schema
  - **输出**: startup repair gate + `RepairSummary`
  - **契约承接**: startup repair gate；`repair_required`
  - **📎 参考**: `state-system.md` §11.3, §12.2
  - **验收标准**:
    - Given artifact 已写入但 SQLite index 缺失
    - When runtime startup gate 执行
    - Then read model 对外可用前修复 index；无法修复时返回 `repair_required` 而非脏读
  - **验证类型**: 集成测试
  - **验证说明**: 使用临时 workspace 构造 artifact-only、index-only orphan、hash stale 三种场景。
  - **估时**: 5h
  - **依赖**: T4.1.1
  - **优先级**: P0

- [ ] **T4.1.4** [REQ-019]: native SQLite vs sql.js storage mode smoke
  - **描述**: 建立存储驱动模式 smoke，显式区分 native SQLite WAL/backup 与 sql.js fallback 单写队列/explicit flush/repair 语义。
  - **输入**: `04_SYSTEM_DESIGN/state-system.md` §12.1.1；`03_ADR/ADR_001_TECH_STACK.md` §决策；`07_CHALLENGE_REPORT.md` CH-07-10；T4.1.3 startup repair gate
  - **输出**: storage mode smoke report
  - **契约承接**: native SQLite vs sql.js storage mode
  - **📎 参考**: `state-system.md` §7.1, §12.1.1
  - **验收标准**:
    - Given native driver 可用或不可用
    - When storage mode smoke 执行
    - Then report 明确 native/sql.js 模式、backup 策略、repair 可重建性，不把 WAL 假设套到 sql.js
  - **验证类型**: 冒烟测试
  - **验证说明**: 在 packaged runtime 环境验证 native dependency load；fallback 模式验证 artifact -> index repair。
  - **估时**: 4h
  - **依赖**: T4.1.3
  - **优先级**: P0

### Phase 2: Runtime Snapshots

- [x] **T4.2.1** [REQ-019]: 实现 `LifeEvidenceSnapshot` 与 `ContinuitySnapshot`
  - **描述**: 实现 bounded query、snapshot cache、empty evidence safe return、recent decision/fallback/quiet debt read model。
  - **输入**: `04_SYSTEM_DESIGN/state-system.md` §5.1, §10.2；`04_SYSTEM_DESIGN/state-system.detail.md` §3.2-§3.3；T4.1.1 evidence store；T4.1.3 repair gate
  - **输出**: `loadLifeEvidenceSnapshot()`、`loadContinuitySnapshot()`
  - **契约承接**: `LifeEvidenceSnapshot`; `ContinuitySnapshot`; empty evidence safe return
  - **📎 参考**: `01_PRD.md` US-001, US-002
  - **验收标准**:
    - Given no evidence in query window
    - When loadLifeEvidenceSnapshot 执行
    - Then 返回 empty snapshot，不虚构 platform/work events
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 empty、platform/work mixed、snapshot cache hit/miss、cache invalidation。
  - **估时**: 5h
  - **依赖**: T4.1.1, T4.1.3
  - **优先级**: P0

- [x] **T4.2.2** [REQ-023]: `UserInterestSnapshot insufficient` downgrade test
  - **描述**: 实现最小 `loadUserInterestSnapshot()` 与 insufficient downgrade；P0 范围只要求 outreach 可安全降级到 evidence-only，不要求完整长期兴趣模型成熟。
  - **输入**: `04_SYSTEM_DESIGN/state-system.md` §5.1, §6.1, §11.4；`04_SYSTEM_DESIGN/state-system.detail.md` §3.4, §4.3；`07_CHALLENGE_REPORT.md` CH-07-03
  - **输出**: `UserInterestSnapshot` builder + downgrade tests
  - **契约承接**: `UserInterestSnapshot.staleness = insufficient`; 不编造用户兴趣
  - **📎 参考**: `01_PRD.md` US-004 / US-005；`state-system.md` §9
  - **验收标准**:
    - Given `USER.md` / `MEMORY.md` 缺失且没有 curated / recent interaction signals
    - When user interest snapshot 加载
    - Then 返回空 signals、confidence 0、staleness `insufficient`、missingReasons 包含 `missing_user_interest_model`
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 fresh、stale、insufficient、low confidence、missing anchor files。
  - **估时**: 4h
  - **依赖**: T4.1.1
  - **优先级**: P0

### Phase 3: Delivery Persistence

- [x] **T4.3.1** [REQ-022]: `DeliveryAttemptRecord` write/read test
  - **描述**: 实现 `writeDeliveryAttempt()`、delivery attempt index/read model、fallback link；失败与 host policy drop 必须有 errorClass 或 fallbackRef。
  - **输入**: `04_SYSTEM_DESIGN/state-system.md` §5.1, §6.1, §11.4；`04_SYSTEM_DESIGN/state-system.detail.md` §3.6；`07_CHALLENGE_REPORT.md` CH-07-05
  - **输出**: `DeliveryAttemptRecord` repository + read model tests
  - **契约承接**: `DeliveryAttemptRecord`; failed / dropped_by_host_policy 关联 fallback
  - **📎 参考**: `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md` §后续行动
  - **验收标准**:
    - Given delivery attempt status 为 `failed` 或 `dropped_by_host_policy`
    - When state 写入 attempt
    - Then `sent` 必须带 `messageId` 或 `hostProofRef`；`failed` / `dropped_by_host_policy` 必须带 errorClass 或 fallbackRef；read model 可按 decisionId 查询 attempt 与 fallback link
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 sent+messageId、sent+hostProofRef、sent 缺 delivery proof 被拒绝、failed+errorClass、dropped+fallbackRef、failed 缺 error/fallback 被拒绝。
  - **估时**: 4h
  - **依赖**: T4.1.1
  - **优先级**: P0

### Phase 4: Quiet / Governance

- [x] **T4.4.1** [REQ-024]: 实现 Quiet artifact writer 与 source coverage gate
  - **描述**: 实现 `writeQuietArtifact()`、source coverage calculation、empty-state artifact、curated/anchor proposal entry point。
  - **输入**: `04_SYSTEM_DESIGN/state-system.md` §4.5, §5.1, §11.4；`04_SYSTEM_DESIGN/state-system.detail.md` §3.5, §4.2；T4.2.1 evidence snapshot
  - **输出**: `QuietArtifact` writer + source coverage tests
  - **契约承接**: `QuietArtifact`; source coverage; empty evidence 不虚构经历
  - **📎 参考**: `ADR_003_SECOND_NATURE_GOVERNANCE.md`, `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
  - **验收标准**:
    - Given non-empty evidence with covered claims
    - When Quiet artifact 写入
    - Then artifact 带 sourceCoverage、artifactRef、provenance links；任一 factual claim 无 source ref 时被 reject/downgrade，正常 narrative pass 必须 `unsupportedClaims = 0`
  - **验证类型**: 集成测试
  - **验证说明**: 覆盖 daily_report、narrative_reflection、empty_state、source coverage too low、unsupported factual claim。
  - **估时**: 6h
  - **依赖**: T4.2.1
  - **优先级**: P0

---

## System 5: Observability & Safety System (`observability-system`)

### Phase 1: Audit Foundation

- [x] **T5.1.1** [REQ-019]: 实现 audit envelope / redaction / append-only ledger
  - **描述**: 建立 `AuditEnvelope`、`RedactionManifest`、hash-chain integrity fields、append-only audit store 基础。
  - **输入**: `04_SYSTEM_DESIGN/observability-system.md` §5.1, §6.1, §9；`04_SYSTEM_DESIGN/observability-system.detail.md` §1-§3.1
  - **输出**: `buildAuditEnvelope()`、`redactAuditEvent()`、append audit store port
  - **契约承接**: audit envelope; redaction manifest; append-only ledger
  - **📎 参考**: `observability-system.md` §11.3
  - **验收标准**:
    - Given audit event 包含 token、recipient、raw payload
    - When 持久化前 redaction 执行
    - Then sensitive paths 被 mask/erase/hash/content_ref，manifest 准确记录处理路径
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 mask、erase、hash、content_ref、recordHash/previousHash 生成。
  - **估时**: 5h
  - **依赖**: 无
  - **优先级**: P0

- [x] **T5.1.2** [REQ-020]: 实现 connector attempt / state governance audit
  - **描述**: 实现 `recordConnectorAttempt()` 与 `recordStateGovernance()`，承接 connector failure、fallback written、effect commit、anchor proposal/apply 等治理事件。
  - **输入**: `04_SYSTEM_DESIGN/observability-system.md` §5.1, §5.3；`04_SYSTEM_DESIGN/connector-system.md` §5.2；T5.1.1 audit foundation
  - **输出**: connector attempt telemetry/governance events
  - **契约承接**: `ConnectorAttemptAudit`; `StateGovernanceAudit`
  - **📎 参考**: `observability-system.detail.md` §3.6-§3.7
  - **验收标准**:
    - Given connector attempt failed
    - When audit append 执行
    - Then event 进入 governance plane 并可通过 traceId explain 查询
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 connector success sampled telemetry、failed governance、fallback_written、effect_commit_advanced。
  - **估时**: 4h
  - **依赖**: T5.1.1
  - **优先级**: P0

### Phase 2: Delivery / Source / Integrity

- [x] **T5.2.1** [REQ-022]: 实现 delivery audit 与 explain linkage
  - **描述**: 实现 `recordDecisionTrace()`、`recordDeliveryAudit()`、`recordSourceCoverage()`、`recordGuidanceGrounding()`，并把 decisionId/fallbackRef/sourceRef 链接到 explain index。
  - **输入**: `04_SYSTEM_DESIGN/observability-system.md` §4.4-§5.1, §11.2；`04_SYSTEM_DESIGN/observability-system.detail.md` §3.1-§3.4；T5.1.1 audit foundation
  - **输出**: decision/delivery/source coverage audit ports
  - **契约承接**: `DecisionTrace`; `DeliveryAuditRecord`; `SourceCoverageAudit`; `GuidanceGroundingAudit`
  - **📎 参考**: `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md` §影响范围
  - **验收标准**:
    - Given `target: none` heartbeat run 成功
    - When delivery audit 记录
    - Then status 为 `target_none` 或 `not_sent_fallback`，explain 不得声称已联系用户
  - **验证类型**: 单元测试 + 集成测试
  - **验证说明**: 单测覆盖 delivery audit classification、sent missing messageId/hostProofRef -> failed、source coverage status classification；集成测试覆盖 target_none、ack_dropped、fallback not_sent、empty source coverage。
  - **估时**: 6h
  - **依赖**: T5.1.1
  - **优先级**: P0

- [x] **T5.2.2** [REQ-025]: `verifyAuditHashChain(range)`
  - **描述**: 实现 audit hash-chain 校验接口，检测 recordHash 不匹配、previousHash 断链和范围不完整。
  - **输入**: `04_SYSTEM_DESIGN/observability-system.md` §5.1, §11.1, §13；`04_SYSTEM_DESIGN/observability-system.detail.md` §3.11；`07_CHALLENGE_REPORT.md` CH-07-08；T5.1.1 audit envelope
  - **输出**: `verifyAuditHashChain(range)` + integrity report
  - **契约承接**: `AuditIntegrity`; `AuditHashChainVerificationReport`
  - **📎 参考**: `observability-system.md` §11.3
  - **验收标准**:
    - Given audit events 形成 hash chain
    - When 校验完整 range
    - Then 返回 pass；当某条 recordHash 或 previousHash 被篡改时返回 broken 并列出 brokenAtEventIds
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 pass、record hash mismatch、previous hash mismatch、empty/incomplete range。
  - **估时**: 4h
  - **依赖**: T5.1.1
  - **优先级**: P1

### Phase 3: Explain / Export

- [x] **T5.3.1** [REQ-026]: 实现 explain query / audit export read model
  - **描述**: 实现 `queryExplain()` 与 `exportAuditBundle(range)`，支持 decisionId、fallbackRef、sourceRefId、reportId 查询，并默认 redacted export。
  - **输入**: `04_SYSTEM_DESIGN/observability-system.md` §5.1, §12；`04_SYSTEM_DESIGN/observability-system.detail.md` §3.8-§3.10；T5.2.1 delivery audit linkage
  - **输出**: `ExplainReadModel`、redacted `AuditBundle`
  - **契约承接**: operator explain; redacted audit export
  - **📎 参考**: `cli-system.md` §5.1 `explainSurfaceSubject`
  - **验收标准**:
    - Given fallbackRef 可查询
    - When queryExplain 执行
    - Then summary 包含 no user-visible contact warning，且相关事件均脱敏
  - **验证类型**: 集成测试
  - **验证说明**: 覆盖 decisionId、fallbackRef、reportId、sourceRefId、unknown query。
  - **估时**: 5h
  - **依赖**: T5.2.1
  - **优先级**: P1

---

## System 6: Behavioral Guidance System (`behavioral-guidance-system`)

### Phase 1: Guidance Assembly

- [x] **T6.1.1** [REQ-022]: 实现 guidance interfaces 与 `OutreachDraftRequest` schema
  - **描述**: 定义并实现 `GuidanceDraftPort`、`SceneGuidanceRequest`、`OutreachDraftRequest`、`DeliveryExpressionContext` 与 schema validation。
  - **输入**: `04_SYSTEM_DESIGN/behavioral-guidance-system.md` §5.1-§6.1；`04_SYSTEM_DESIGN/behavioral-guidance-system.detail.md` §2；`04_SYSTEM_DESIGN/control-plane-system.detail.md` §3.9
  - **输出**: guidance contract types + validators
  - **契约承接**: `OutreachDraftRequest`; `deliveryContext.wordingMode`
  - **📎 参考**: `07_CHALLENGE_REPORT.md` CH-07-01
  - **验收标准**:
    - Given control-plane 构造 outreach draft request
    - When schema validation 执行
    - Then 必须包含 `sceneType`、`decisionId`、`judgmentVerdict`、`valueScore`、`deliveryContext.wordingMode`
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 outreach、fallback_candidate、缺字段、delivery wording invalid。
  - **估时**: 6h
  - **依赖**: T2.3.1
  - **优先级**: P0

- [x] **T6.1.2** [REQ-023]: 实现 evidence pack / interest downgrade / Quiet guidance
  - **描述**: 实现 `buildEvidencePack()`、`selectInterestBasis()`、`buildQuietNarrativeGuidance()`，确保 interest insufficient 降级为 evidence-only 或 unavailable，并统一 `SourceCoveragePolicy`。
  - **输入**: `04_SYSTEM_DESIGN/behavioral-guidance-system.md` §5.1, §9, §11.4；`04_SYSTEM_DESIGN/behavioral-guidance-system.detail.md` §3.2-§3.3, §3.7；T4.2.2 user interest snapshot；T4.4.1 Quiet artifact contract
  - **输出**: evidence pack builder、interest basis selector、Quiet guidance
  - **契约承接**: `UserInterestSnapshot insufficient` guidance downgrade; Quiet empty evidence guidance
  - **📎 参考**: `behavioral-guidance-system.md` §11.4
  - **验收标准**:
    - Given user interest snapshot is `insufficient`
    - When draft / guidance selection 执行
    - Then 不编造用户喜好，只输出 evidence-only 降级或 unavailable reason；正常 Quiet / outreach 文案不得包含 unsupported factual claim
  - **验证类型**: 单元测试
  - **验证说明**: 覆盖 empty refs、unresolved refs、sensitive refs、fresh/stale/insufficient interest、Quiet empty/low/normal coverage、unsupported factual claim blocked。
  - **估时**: 5h
  - **依赖**: T4.2.2, T4.4.1
  - **优先级**: P0

### Phase 2: Outreach Draft Contract

- [x] **T6.2.1** [REQ-022]: `OutreachDraftRequest` contract test
  - **描述**: 验证 control-plane 的 `buildOutreachDraftRequest()` 与 guidance 的 `draftOutreachMessage()` 字段、语义和 fallback wording 完全对齐。
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.detail.md` §3.9；`04_SYSTEM_DESIGN/behavioral-guidance-system.detail.md` §3.6, §4.1, §4.3；T6.1.1 schema；T2.3.1 OutreachJudgment
  - **输出**: cross-system contract test suite
  - **契约承接**: `OutreachDraftRequest`; sendable vs not_sent fallback candidate wording
  - **📎 参考**: `07_CHALLENGE_REPORT.md` CH-07-01；`ADR_004_BEHAVIORAL_GUIDANCE_LAYER.md`
  - **验收标准**:
    - Given judgment allow and delivery target available
    - When control-plane builds request and guidance drafts message
    - Then draft `deliveryWording = sendable`; when delivery unavailable, draft uses `not_sent_fallback_candidate` and never claims sent
  - **验证类型**: 集成测试
  - **验证说明**: 覆盖 allow/sendable、allow/fallback_candidate、deny/defer hard_decision_not_allow、missing source refs。
  - **估时**: 4h
  - **依赖**: T6.1.1, T6.1.2, T2.3.1
  - **优先级**: P0

---

## System 7: Documentation & Traceability

### Phase 1: Traceability Review

- [ ] **T7.1.1** [REQ-026]: 文档契约一致性检查
  - **描述**: 对 PRD、ADR、System Design、05_TASKS、README 进行 traceability review，确认 current truth 指向 `.anws/v5`，且 challenge 必须承接项均在任务中。
  - **输入**: `01_PRD.md` US-008；`07_CHALLENGE_REPORT.md` P0/P1 建议；T1.4.1 README；本文件 Contract Coverage Overlay
  - **输出**: documentation traceability checklist
  - **契约承接**: README 与 v5 真实能力边界
  - **📎 参考**: `07_CHALLENGE_REPORT.md` §建议行动清单
  - **验收标准**:
    - Given `05_TASKS.md` 与 README 已更新
    - When 执行 traceability review
    - Then 所有 US-001~US-008、ADR-007 质量门禁、CH-07 blueprint 承接项都有任务或验证点
  - **验证类型**: 手动验证
  - **验证说明**: 使用本文末尾 User Story Overlay 和 Contract Coverage Overlay 逐项打勾。
  - **估时**: 4h
  - **依赖**: T1.4.1
  - **优先级**: P1

---

## Sprint 集成验证任务

- [ ] **INT-S1** [MILESTONE]: S1 集成验证 — Host & State Foundation
  - **描述**: 验证 S1 退出标准，确认 host capability、runtime artifact、基础 state/audit、repair/storage mode 能协作。
  - **输入**: S1 所有任务产出：T1.1.1, T1.1.2, T1.1.3, T4.1.1, T4.1.2, T4.1.3, T4.1.4, T5.1.1, T5.1.2
  - **输出**: `reports/int-s1-host-state-foundation.md`
  - **契约承接**: host capability report、heartbeat tool invocation、startup repair gate、storage mode smoke
  - **📎 参考**: `ADR_001_TECH_STACK.md` §验证策略决策；`cli-system.md` §11.3；`state-system.md` §12.1.1
  - **验收标准**:
    - Given S1 所有任务已完成
    - When 执行 capability probe、storage mode smoke、startup repair fixture 和基础 contract tests
    - Then 全部 pass 或明确 fail/unknown reason；unknown 不得被标为 pass
  - **验证类型**: 集成测试 / 冒烟测试
  - **验证说明**: 真实冒烟收敛在本 INT；不把 host smoke 扩散到普通开发任务。
  - **估时**: 4h
  - **依赖**: T1.1.1, T1.1.2, T1.1.3, T4.1.1, T4.1.2, T4.1.3, T4.1.4, T5.1.1, T5.1.2

- [ ] **INT-S2** [MILESTONE]: S2 集成验证 — Evidence & Rhythm Loop
  - **描述**: 验证 S2 退出标准，确认 evidence、snapshot、rhythm decision、candidate planner 和 connector mapping 能形成 heartbeat decision loop。
  - **输入**: S2 所有任务产出：T2.1.1, T2.1.2, T2.1.3, T2.2.1, T3.1.1, T3.1.2, T3.2.1, T4.2.1, T4.2.2
  - **输出**: `reports/int-s2-evidence-rhythm-loop.md`
  - **契约承接**: heartbeat decision loop、LifeEvidenceSnapshot、RhythmWindowDecision owner boundary、UserInterestSnapshot insufficient
  - **📎 参考**: `control-plane-system.md` §11.2；`state-system.md` §11.4；`connector-system.md` §11.3
  - **验收标准**:
    - Given near-real life evidence fixture 和 rhythm policy snapshot
    - When heartbeat integration test 运行
    - Then 输出结构化 decision result，并记录 source-backed decision trace
  - **验证类型**: 集成测试
  - **验证说明**: 同时复验 S1 repair/read model gate；若触及 host bridge，仅使用 S1 已产出的 capability report。
  - **估时**: 4h
  - **依赖**: T2.1.1, T2.1.2, T2.1.3, T2.2.1, T3.1.1, T3.1.2, T3.2.1, T4.2.1, T4.2.2

- [x] **INT-S3** [MILESTONE]: S3 集成验证 — Outreach / Delivery / Quiet Closure
  - **描述**: 验证 S3 退出标准，确认 source-backed outreach、guidance draft、delivery fallback、DeliveryAttemptRecord、Quiet source coverage 和 hash-chain 都闭合。
  - **输入**: S3 所有任务产出：T6.1.1, T6.1.2, T6.2.1, T2.3.1, T2.3.2, T2.3.3, T4.3.1, T4.4.1, T5.2.1, T5.2.2
  - **输出**: `reports/int-s3-outreach-delivery-quiet.md`
  - **契约承接**: OutreachDraftRequest、delivery failed fallback、DeliveryAttemptRecord、Quiet source coverage、verifyAuditHashChain(range)
  - **📎 参考**: `07_CHALLENGE_REPORT.md` §建议行动清单；`ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md` §质量门禁
  - **验收标准**:
    - Given source-backed outreach candidate 和 delivery failed / dropped_by_host_policy fixtures
    - When S3 集成验证执行
    - Then fallback、delivery attempt、delivery audit、explain 和 hash-chain verification 都能证明未发送不冒充 sent
  - **验证类型**: 集成测试 / 回归测试
  - **验证说明**: 回归复验 S2 heartbeat loop；S3 重点验证失败态、fallback、source coverage，不升级为 E2E。
  - **估时**: 4h
  - **依赖**: T6.1.1, T6.1.2, T6.2.1, T2.3.1, T2.3.2, T2.3.3, T4.3.1, T4.4.1, T5.2.1, T5.2.2

- [ ] **INT-S4** [MILESTONE]: S4 集成验证 — Packaging / Host Smoke / Docs
  - **描述**: 验证 S4 退出标准，确认 packaged plugin、host smoke、ops explain、platform near-real path、README 边界和 release gate 可复现。
  - **输入**: S4 所有任务产出：T1.2.1, T1.2.2, T1.3.1, T3.3.1, T5.3.1, T1.4.1, T1.4.2, T7.1.1
  - **输出**: `reports/int-s4-release-readiness.md`
  - **契约承接**: host smoke report、fallback visibility、README truth boundary、release gate
  - **📎 参考**: `cli-system.md` §12.2；`01_PRD.md` US-008
  - **验收标准**:
    - Given package artifact 与 host smoke plan 已准备
    - When 执行 release readiness 验证
    - Then package load、heartbeat_check、target none、ack drop、heartbeat_tool_not_invoked、fallback visibility、README boundary 均有 pass/fail/unknown 证据
  - **验证类型**: 冒烟测试 / 手动验证
  - **验证说明**: 只在本 INT 执行真实宿主冒烟；失败进入 bug/fix 波次，不把 Sprint 标记完成。
  - **估时**: 4h
  - **依赖**: T1.2.1, T1.2.2, T1.3.1, T3.3.1, T5.3.1, T1.4.1, T1.4.2, T7.1.1

---

## 🎯 User Story Overlay

### US-001: 让 heartbeat_check 进入真实生活决策链 (P0)
**涉及任务**: T1.1.1 → T1.1.3 → T5.1.1 → T4.2.1 → T2.1.1 → T2.2.1 → INT-S2  
**关键路径**: T1.1.3 → T4.2.1 → T2.1.1 → T2.2.1  
**独立可测**: ✅ S2 结束可用 near-real workspace 状态验证  
**覆盖状态**: ✅ 完整

### US-002: 建立 life evidence 入库与查询契约 (P0)
**涉及任务**: T3.1.2 → T4.1.1 → T4.2.1 → T5.1.2 → T3.3.1  
**关键路径**: T3.1.2 → T4.1.1 → T4.2.1  
**独立可测**: ✅ S2 可测基础写读，S4 可测 near-real 平台路径  
**覆盖状态**: ✅ 完整

### US-003: 现代化 rhythm windows 与生活节律 (P0)
**涉及任务**: T4.1.2 → T2.1.2 → T2.1.3 → T2.2.1 → INT-S2  
**关键路径**: T4.1.2 → T2.1.2 → T2.1.3  
**独立可测**: ✅ S2 结束可用不同 window fixture 验证  
**覆盖状态**: ✅ 完整

### US-004: 闭合朋友式主动联系用户链路 (P0)
**涉及任务**: T4.2.2 → T2.3.1 → T6.1.1 → T6.1.2 → T6.2.1 → T4.3.1 → T2.3.2 → T5.2.1 → T1.3.1 → INT-S3  
**关键路径**: T4.2.2 → T2.3.1 → T6.1.2 → T6.2.1 → T2.3.2  
**独立可测**: ✅ S3 可验证 allow/fallback；S4 验证真实 host delivery 能力  
**覆盖状态**: ✅ 完整

### US-005: 建立用户兴趣模型与关系记忆读取 (P1)
**涉及任务**: T4.2.2 → T6.1.2 → T2.3.1 → T6.2.1  
**关键路径**: T4.2.2 → T6.1.2  
**独立可测**: ✅ S2/S3 可验证 insufficient downgrade 与 source-backed interest  
**覆盖状态**: ✅ 完整

### US-006: 闭合 Quiet 对生活证据的夜间收纳 (P1)
**涉及任务**: T4.2.1 → T4.4.1 → T6.1.2 → T2.3.3 → T5.2.1 → INT-S3  
**关键路径**: T4.4.1 → T6.1.2 → T2.3.3  
**独立可测**: ✅ S3 可验证空/非空 evidence 两条路径  
**覆盖状态**: ✅ 完整

### US-007: 验证 OpenClaw 主动联系能力与兜底路径 (P0)
**涉及任务**: T1.1.2 → T1.3.1 → T2.3.2 → T1.2.2 → INT-S1 → INT-S4  
**关键路径**: T1.1.2 → T1.3.1  
**独立可测**: ✅ S1 即可先出 capability report；S4 出真实 host smoke 汇总  
**覆盖状态**: ✅ 完整

### US-008: 对齐 README 与 v5 真实能力边界 (P1)
**涉及任务**: T1.4.1 → T1.4.2 → T7.1.1 → INT-S4  
**关键路径**: T1.4.1 → T7.1.1  
**独立可测**: ✅ S4 文档审查可验  
**覆盖状态**: ✅ 完整

---

## 🔐 Contract Coverage Overlay

| 契约 | 类型 | 实现承接 | 验证承接 | 状态 |
| --- | --- | --- | --- | :---: |
| `OutreachDraftRequest` | 跨系统接口 | T6.1.1 | T6.2.1 | ✅ |
| delivery failed / `dropped_by_host_policy` fallback | 错误语义 | T2.3.2, T4.3.1 | T2.3.2, INT-S3 | ✅ |
| `UserInterestSnapshot insufficient` downgrade | 状态读模型 | T4.2.2, T6.1.2 | T4.2.2 | ✅ |
| `SourceCoveragePolicy` / all-claim grounding | 事实边界 | T4.4.1, T5.2.1, T6.1.2 | T4.4.1, T5.2.1, T6.1.2, INT-S3 | ✅ |
| `RhythmPolicySnapshot -> RhythmWindowDecision` owner boundary | 状态/控制接口 | T4.1.2, T2.1.2 | T2.1.2 | ✅ |
| `DeliveryAttemptRecord` write/read | 持久化结构 | T4.3.1 | T4.3.1 | ✅ |
| `heartbeat_tool_not_invoked` host smoke | 宿主默认态 | T1.1.2 | T1.3.1 | ✅ |
| startup repair gate | 状态恢复 | T4.1.3 | T4.1.3, INT-S1 | ✅ |
| `verifyAuditHashChain(range)` | 审计完整性 | T5.2.2 | T5.2.2 | ✅ |
| native SQLite vs sql.js storage mode smoke | 存储运行模式 | T4.1.4 | T4.1.4, INT-S1 | ✅ |
| OpenClaw capability probe early sprint | 宿主能力 | T1.1.2 | T1.1.2, INT-S1 | ✅ |
| `LifeEvidence` source refs | 持久化结构 | T3.1.2, T4.1.1 | T3.1.2, T4.1.1 | ✅ |
| `HEARTBEAT_OK` ack drop / target none | 宿主 delivery 语义 | T1.1.2, T2.3.1 | T1.3.1, T5.2.1 | ✅ |
| `queryExplain` / `exportAuditBundle` | operator explain / audit export | T5.3.1 | T5.3.1 | ✅ |
| `OperatorFallbackArtifact.status = not_sent` | fallback 文件格式 | T4.3.1, T1.2.2 | T1.2.2, T4.3.1 | ✅ |
| Quiet empty evidence | 关键用户路径 | T4.4.1, T6.1.2, T2.3.3 | T4.4.1, T6.1.2, T2.3.3, INT-S3 | ✅ |
| README truth boundary | 文档契约 | T1.4.1 | T7.1.1, INT-S4 | ✅ |

---

## ✅ Blueprint 检查清单

- ✅ 每个 Sprint 有退出标准和 INT 集成验证任务。
- ✅ Level 3 任务均包含输入、输出、契约承接、验收标准、验证类型、验证说明、估时、依赖、优先级。
- ✅ 任务间输入/输出已对齐，依赖任务引用具体产物。
- ✅ 公共契约均有实现任务与验证承接点。
- ✅ 基础层低依赖逻辑优先拆了单元测试：schema、mapping、repair、snapshot、hash-chain、owner boundary、scope routing、delivery capability classification、delivery audit classification。
- ✅ 冒烟测试主要收敛在 T1.3.1、T4.1.4 与 INT-S1 / INT-S4。
- ✅ User Story Overlay 覆盖 US-001 ~ US-008。
- ✅ `07_CHALLENGE_REPORT.md` 中 `/blueprint 必须承接` 事项均已落任务。

## 📊 任务统计

- Level 3 任务数: 36
- INT 任务数: 4
- 总任务数: 40
- P0 任务: 27
- P1 任务: 9
- P2 任务: 0
- Milestone 任务: 4
- 总预估工时: 207h

