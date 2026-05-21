# Second Nature v5 任务清单 (Task List)

> **版本**: v5  
> **Source of Truth**: `.anws/v5/01_PRD.md`, `.anws/v5/02_ARCHITECTURE_OVERVIEW.md`, `.anws/v5/03_ADR/`, `.anws/v5/04_SYSTEM_DESIGN/`  
> **生成日期**: 2026-05-01  
> **规划原则**: 不重新设计 v5 架构，只把已修复的 PRD / ADR / System Design 转成可执行 WBS。

---

## 🔐 Contract Mapping

| 公共契约 | 类型 | 契约层级 | 实现承接 | 验证承接 |
| --- | --- | --- | --- | --- |
| `second_nature_ops("heartbeat_check")` / `HeartbeatSurfaceResult` | CLI / 操作契约 | 关键用户路径契约 | T1.1.3, T1.1.4, T2.1.1, T2.2.1, **T2.2.2**, **T2.2.3**, **T1.2.4** | T1.3.1, INT-S1, INT-S2, INT-S4 |
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
| `loadStatus` 聚合（`rhythm` / `runtime` / `quiet` 摘要）与 `data/observability.db` | operator 面板 / 读模型一致 | 基础规则层契约 | T1.2.1, T1.2.3, T2.2.1, **T1.2.5** | T1.2.3, INT-S4 |
| `SnapshotInputs` life evidence（workspace 心跳路径） | 控制面输入 / state 读 | 关键用户路径契约 | **T2.2.2** | T2.2.2, INT-S2, INT-S4 |
| `connector_action` workspace 效应 / `execution_attempts` 平台行 | 控制面 + 观测 | 关键用户路径契约 | **T2.2.3**, T3.1.1, T5.1.2 | T2.2.3, INT-S2 |
| Quiet artifact ↔ operator `report`/`quiet` 读面 | 读模型 / FS canonical | 关键用户路径契约 | **T1.2.4**, T4.4.1 | T1.2.4, INT-S3, INT-S4 |
| operator `explain` 默认审计投影（非 carrier-only） | CLI / 插件默认 deps | 基础规则层契约 | **T1.2.5**, T5.3.1 | T1.2.5, INT-S4 |
| `policy show` / `audit` CLI（非占位） | ops command | 基础规则层契约 | **T1.2.6**, **T1.2.7** | T1.2.6, T1.2.7, INT-S4 |
| `capability_probe` / ops-router probe 分支 | CLI / 宿主能力对照 | 跨系统契约 | **T1.2.8**, T1.1.2 | T1.2.8, INT-S4 |
| `loadStatus.runtime.serviceStatus` vs `decision_denied` | operator 读模型语义 | 基础规则层契约 | **T1.2.9**, T1.2.3 | T1.2.9, INT-S4 |
| `near_real_smoke` 显式连接器哨兵入口 | CLI / bridge command | 关键用户路径契约 | **T3.3.2**, T3.3.1 | T3.3.2, INT-S4 |

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
    T1_1_3 --> T1_1_4[T1.1.4 plugin workspace read bridge]
    T1_1_4 --> T1_1_5[T1.1.5 OpenClaw workspace ops docs]
    T4_2_1 --> T2_1_1
    T2_1_2 --> T2_1_3[T2.1.3 candidate planner and guards]
    T3_1_1[T3.1.1 connector manifest contract] --> T3_1_2[T3.1.2 LifeEvidenceCandidate mapping]
    T3_1_2 --> T4_2_1
    T2_1_1 --> T2_2_1[T2.2.1 heartbeat integration]
    T2_1_3 --> T2_2_1
    T1_2_1[T1.2.1 ops read models] --> T1_2_2[T1.2.2 fallback view]
    T1_2_1 --> T1_2_3[T1.2.3 status aggregate observability writeback]
    T2_2_1 --> T1_2_3
    T2_2_1 --> T2_2_2[T2.2.2 workspace snapshot life evidence]
    T4_2_1 --> T2_2_2
    T1_1_4 --> T2_2_2
    T2_2_2 --> T2_2_3[T2.2.3 connector_action effector]
    T3_1_1 --> T2_2_3
    T2_2_3 --> T1_2_4[T1.2.4 Quiet report read canonical]
    T4_4_1 --> T1_2_4
    T1_2_1 --> T1_2_5[T1.2.5 status delivery + audit store]
    T1_1_2 --> T1_2_5
    T5_3_1[T5.3.1 explain query] --> T1_2_5
    T4_2_2[T4.2.2 UserInterest insufficient downgrade] --> T2_3_1[T2.3.1 OutreachJudgment and delivery policy]
    T4_2_2 --> T6_1_2[T6.1.2 interest and Quiet downgrade]
    T6_1_1[T6.1.1 guidance interfaces] --> T6_2_1[T6.2.1 OutreachDraftRequest contract test]
    T2_3_1 --> T6_2_1
    T6_2_1 --> T2_3_2[T2.3.2 delivery failed fallback test]
    T4_3_1[T4.3.1 DeliveryAttemptRecord write/read] --> T2_3_2
    T5_2_1[T5.2.1 delivery audit explain] --> T2_3_2
    T5_2_1 --> T5_3_1[T5.3.1 explain query]
    T5_2_2[T5.2.2 verifyAuditHashChain(range)] --> INT_S3[INT-S3]
    T4_2_1 --> T4_4_1[T4.4.1 Quiet artifact writer]
    T4_4_1 --> T6_1_2
    T4_4_1 --> T2_3_3[T2.3.3 Quiet orchestration]
    T1_3_1 --> INT_S4[INT-S4]
    T1_3_1 --> T1_4_1[T1.4.1 README truth boundary]
    T1_4_1 --> T7_1_1[T7.1.1 documentation review]
    T1_1_2 --> T1_2_8[T1.2.8 capability_probe ops]
    T1_2_3 --> T1_2_9[T1.2.9 decision_denied vs degraded]
    T3_1_2 --> T3_3_1[T3.3.1 near-real connector smoke]
    T3_3_1 --> T3_3_2[T3.3.2 near_real_smoke ops entry]
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

- [x] **T1.1.4** [REQ-019]: OpenClaw 插件 — workspace 根已知时的 **full ops / Quiet 读路径桥接**（受控）
  - **用户原话承接**: 「不允许」插件面仅 carrier 拒绝 Quiet；须在 **可解析 workspace** 条件下提供 **真实 Quiet / heartbeat 读结果或诚实失败**，不得回退假读模型。
  - **描述**: 在 `SECOND_NATURE_WORKSPACE_ROOT` 或工具 `workspaceRoot` 解析为 `env`/`tool_args` 时，经 **惰性动态加载**（保持 `register()` 同步）装配与 CLI 等价的 `CliReadModels` + `createOpsRouter`，使 `second_nature_ops` 的 `heartbeat_check` 与 **同一读桥** 下的只读命令可走与 CLI 一致的 read model 路径（含 `heartbeatCheck(..., readModels)` → `runHeartbeatCycle`）；`workspaceRootResolution === "unknown"` 时 **维持** 当前 `ok: false` / `evaluated: false` 诚实语义（含 CH-11-02：`explain` 不得维持 carrier 上 `ok: true` 半成功形状）。备选实现：受控 **子进程** 调用 workspace CLI（Plan B），须在任务验收中二选其一或并列说明宿主约束。
  - **输入**: `plugin/index.ts`；`src/cli/index.ts`；`src/cli/ops/heartbeat-surface.ts`；`src/cli/ops/workspace-heartbeat-runner.ts`；`explore/reports/2026-05-03_openclaw-plugin-quiet-workspace-bridge.md`；`explore/reports/2026-05-03_t1-1-4-bridge-prd-feasibility.md`；`.anws/v5/07_CHALLENGE_REPORT.md`（Round 11 CH-11-01/02）；`reports/int-s4-release-readiness.md`；`docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`
  - **输出**: 插件内 bridge 模块（或等价内联段）+ 集成测；README / host 指南中 **「根已知 = 可跑 full 读路径」** 的运维句；INT-S4 验证说明补丁
  - **契约承接**: ADR-006 包边界；ADR-005 runtime 分层；US-001 / US-006 在 **OpenClaw 插件 + 已知 workspace** 组合下的可观测性
  - **验收标准**:
    - Given `workspaceRootResolution` 为 `env` 或 `tool_args` 且 state DB 可打开
    - When 调用 `second_nature_ops` 的 `heartbeat_check`、`quiet`、聚合 `status`，以及 **至少** `explain`（有效 `subject`）、`fallback`（有效 `ref`）、`report` / `session` / `credential`（show）中与桥接实现范围一致的子集
    - Then 返回结果与 **同路径 CLI** 的 `HeartbeatSurfaceResult`、对应 read model（`loadQuiet` / `loadStatus` / `explainSurfaceSubject` / `showOperatorFallback` / `loadDailyReport` / `loadSession` / `loadCredential`）语义一致或给出 **同级的显式错误**（非假空）；且 `livedExperienceLoopClaimed` 与事实一致
    - **根对齐验证（新增，承接 survey + subagent review）**: 证据中**必须**记录所设 `SECOND_NATURE_WORKSPACE_ROOT` / `workspaceRoot` 是否与实际 OpenClaw agent workspace（含可打开 `data/state.db` + `SOUL.md` / `HEARTBEAT.md`）一致；sandbox / 多 agent 场景下须注明实际落库路径而非默认 `~/.openclaw/workspace`。
    - Given `workspaceRootResolution === "unknown"`
    - When 调用上述命令（含带参数的 `explain`）
    - Then 仍不得返回「已评估读模型」形状（保持 CH-10 诚实语义）；**且** `explain` 必须与 `status`/`quiet` 同族：`ok: false` + 明确 `error.code` **或** 任务实施前在 `05_TASKS` 中写死并评审通过的单一替代信封（默认推荐 `ok: false` 对齐 CH-11-02）
  - **验证类型**: 集成测试（fixture workspace）+ 文档；**真实宿主** 归入 INT-S4
  - **验证说明**: 新增/扩展 `plugin-runtime-registration` 或专用集成测覆盖「根已知桥接」与「根 unknown 仍拒绝」；不得删除现有 carrier-only 基线测例。**新增**：验收时须附 `explore/reports/2026-05-05_openclaw-plugin-support-survey.md`（含 subagent 48/100 审查）作为风险评估输入；bridge dispatch 中 `process.chdir` 的全局副作用须在测试报告中显式说明（若宿主支持并发工具调用，未来建议采用 subprocess Plan B 隔离）。
  - **运维约定 (OpenClaw 宿主)**: **推荐** 将 `SECOND_NATURE_WORKSPACE_ROOT` 与工具 `workspaceRoot` 设为 **与 OpenClaw agent workspace 相同的绝对路径**（默认 `~/.openclaw/workspace`，或 `~/.openclaw/openclaw.json` → `agents.defaults.workspace`），使 state / `data/` 与 `SOUL.md`、`HEARTBEAT.md` 等同桌；**不得**假设可从插件安装目录相对推出该根。若启用 **sandbox** 或 **每 agent 独立 workspace**，以 **实际承载 Second Nature state 的路径** 为准。详见 `explore/reports/2026-05-04_openclaw-plugin-install-vs-workspace-root.md` 及 `explore/reports/2026-05-05_openclaw-plugin-support-survey.md` §8（subagent 审查）。
  - **估时**: 12h（含沙箱风险缓冲）
  - **依赖**: T1.1.1, T1.1.3, T2.2.1（decision loop 行为以现有 `runHeartbeatCycle` 为准）
  - **优先级**: P0

- [x] **T1.1.5** [REQ-019]: OpenClaw 宿主 — **agent workspace** 与 SN 根对齐的运维文档回流 + semver 对齐
  - **描述**: 将 T1.1.4「运维约定 (OpenClaw 宿主)」显式写入 README / README.zh-CN / `HEARTBEAT.md` / `plugin/index.ts` 头注释；宿主操作与 J-HOST 步骤以 `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md` 为准；INT-S4 人类记录与阻塞表写入 `reports/int-s4-release-readiness.md`。强调 sandbox / 多 agent 下以**实际落库路径**为准；声明 **宿主验收以 `second_nature_ops` JSON 为真源**（或 cron+bridge 路径见 INT-S4 验证说明）。根 `package.json` **version** 与 `plugin/package.json` / `openclaw.plugin.json` 对齐（当前 **0.1.13**）。
  - **输入**: T1.1.4 运维约定段；`explore/reports/2026-05-04_openclaw-plugin-install-vs-workspace-root.md`
  - **输出**: 上述文档与 manifest 描述补丁；无行为变更时以静态审阅 + 既有测试绿为证
  - **契约承接**: 与 T1.1.4 同一运维边界；支撑 INT-S4（`e2e-t1-1-4` + `int-s4-release-readiness`）与 CH-11 证据口径
  - **验收标准**:
    - Given 操作者阅读 README / HEARTBEAT / `e2e-t1-1-4-workspace-bridge-and-host-verification.md` / `int-s4-release-readiness.md`
    - When 配置 `SECOND_NATURE_WORKSPACE_ROOT` 或工具 `workspaceRoot`
    - Then 能识别应设为 OpenClaw **agent workspace** 同路径，且不以插件安装目录推断；并知悉 JSON-first 验收规则
  - **验证类型**: 文档审阅 + `pnpm test`（仓库门禁）
  - **验证说明**: 无代码路径变更时可不增测例；若有注释/版本号变更，跑全量测试防回归。
  - **估时**: 1h
  - **依赖**: T1.1.4
  - **优先级**: P1

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
  - **验证说明**: 使用 fake state/observability read models 验证 subject 路由、missing subject、unsupported subject。**注**：聚合 `loadStatus()` 的 `rhythm` / `runtime.serviceStatus` 等字段依赖 `observability.db` 中 **具名写入**（`sn-runtime-*` ledger、`second-nature-runtime` attempt）；空表回落 `unknown` 的闭合由 **T1.2.3** 承接，非 read model 单点故障。
  - **估时**: 6h
  - **依赖**: T5.3.1, T4.3.1
  - **优先级**: P1

- [x] **T1.2.2** [REQ-022]: 实现 operator-visible fallback view
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

- [x] **T1.2.3** [REQ-019]: `loadStatus` 聚合观测写回 — 与 workspace 心跳路径融洽闭合
  - **用户原话承接**: 「让其融洽即可」— 使 operator `status` 读模型与 **真实运行路径** 写入同一 `data/observability.db`，避免因 **无写入方** 导致 `rhythm` / `runtime.serviceStatus` / `status.quiet` 摘要长期 `unknown` 而被误判为节律或 Quiet 损坏。
  - **描述**: 在 **工作区 full runtime** `heartbeat_check`（`createWorkspaceHeartbeatRunner` → `runHeartbeatCycle`）完成可审计的一轮结果后，写入 `DecisionLedger.recordHeartbeatDecision`：`traceId` 前缀 **`sn-runtime-`**（与 `src/cli/read-models/index.ts` 聚合筛选一致），`mode` / `decisionStatus` 与 `HeartbeatCycleResult` 及快照节律对齐；并（最小）写入 `ExecutionTelemetry` **`platformId === "second-nature-runtime"`** 的一条 attempt，使 `runtime.serviceStatus` 可收敛为 `running`/`degraded`。可选：`deps.recordDecisionTrace` 转调 ledger。明确 **status 中 `quiet` 摘要** 仅当 ledger `mode` 为 `quiet`/`maintenance_only`/`paused_for_interrupt` 时非 `unknown`；与 **`loadQuiet` 命令** 的语义分界在验收中注明（必要时仅文档 + 单行注释，不改 PRD 边界）。
  - **输入**: `src/cli/read-models/index.ts`；`src/cli/ops/workspace-heartbeat-runner.ts`；`src/observability/services/decision-ledger.ts`；`src/observability/services/execution-telemetry.ts`；`src/core/second-nature/heartbeat/heartbeat-loop.ts`；ADR-005 / `observability-system.md` §决策 trace
  - **输出**: 接线后的 workspace runner（及插件 bridge 若共享同路径）+ 集成测：`status` 在至少一次成功 `heartbeat_check` 后 **`rhythm.mode` 非 `unknown`**（在正常 `active` 窗口），**`runtime.serviceStatus` 非 `unknown`**
  - **契约承接**: Contract Mapping 表「`loadStatus` 聚合与 observability.db」；`HeartbeatCycleResult` → 持久化观测一致
  - **验收标准**:
    - Given 可写 `data/observability.db` 的工作区 fixture
    - When 执行一次完整 `heartbeat_check`（非 probeOnly carrier）
    - Then `decision_ledger` 存在 `traceId` 以 `sn-runtime-` 开头的记录，且 `execution_attempts` 存在 `platformId === "second-nature-runtime"` 的最新一条可供 `loadStatus` 选取；随后 CLI / 插件桥接 `status` 中 **`rhythm.mode` 不为 `unknown`**，**`runtime.serviceStatus` 不为 `unknown`**
    - **说明**: `status.quiet.mode` 在节律为 `active` 时按当前聚合规则仍可能为 `unknown` —— 验收中须记录该预期或 T1.2.3 实施时一并调整读模型（仅在同任务内文档化，不扩展 PRD 需求）
  - **验证类型**: 集成测试（fixture workspace DB）
  - **验证说明**: 复用或扩展 `cli-ops-surface` / plugin workspace 桥接测；回归空 DB 基线（未跑心跳时仍可 `unknown`）。INT-S4 真实宿主：根已知场景下抽样确认 `status` JSON 与心跳执行顺序一致。
  - **估时**: 4h
  - **依赖**: T1.2.1, T2.2.1, T5.1.1
  - **优先级**: P0

- [x] **T1.2.4** [REQ-024][REQ-019]: Ops 读面 — **Quiet JSON 工件与 `report`/`quiet` canonical 对齐 + workspace `quietWorkflow` 接线**（CH-14-07 / 场测 report 空）
  - **用户原话承接**（`/change` 已批准 + Claw）：Nyx 场测「daily report 空」「quiet 无体感」；**Claw D7**：磁盘 **无** `.second-nature/quiet/` → **未触发写路径**，与「JSON 已写但 Markdown 读不到」**当前现场不适用**；后者仍为 **CH-14-07** 在 **Quiet 一旦运行后** 的回归风险，须保留在验收 B 路径。
  - **描述**: (1) **`loadDailyReport` / `loadQuiet` / `QuietInputLoader`** 必须消费 **与 `persistQuietArtifactToWorkspace` 写入的 `.second-nature/quiet/{day}/*.json` 一致或可合并的 canonical**（任务验收中 **二选一写死**：扩展 loader 读 JSON **或** 同步生成 Markdown 日报 — 禁止长期双源漂移且无文档）。(2) **`createWorkspaceHeartbeatRunner`** 向 `runHeartbeatCycle` 注入 **`quietWorkflow`（含 workspaceRoot）**，使 quiet/reflection 类 intent 被允许时可调用 **`runSourceBackedQuiet`**（与 T2.3.3 编排一致，宿主安全边界不变）。(3) **`quietEnabledBridge`** 不得长期错误依赖 `status.quiet.mode === "quiet"` 导致 **无 quiet 窗口**；若调整聚合，仅限读模型/快照桥，**不扩展 PRD REQ 集合**。
  - **输入**: `run-source-backed-quiet.ts`；`persist-quiet-artifact.ts`；`quiet-input-loader.ts`；`read-models/index.ts`；`workspace-heartbeat-runner.ts`；`heartbeat-loop.ts`；state-system Quiet 章节；Round 14 **CH-14-07**、**CH-14-08**、**CH-14-09**（实现侧在验收中择可测子集）
  - **输出**: 读路径 + deps 接线 + 集成测 **A**：fixture 触发 Quiet 写盘后 `report`/`quiet` 可读；**B**：若仅存在「已写 JSON」而无 Markdown，读面仍须非空或诚实 `evaluated`+原因（承接 CH-14-07）
  - **契约承接**: US-006 Quiet 可观测；REQ-024 已有范围内之 operator 读
  - **验收标准**:
    - Given fixture 已执行一次 source-backed Quiet 并落盘 JSON
    - When 调用 `second_nature_ops` / CLI `report` 与 `quiet`（同 workspaceRoot）
    - Then 读模型 **非零** 展示 JSON 中可公开字段 **或** 显式 `evaluated`+原因（不得静默空对象冒充已读）
    - Given full-runtime heartbeat 选中 quiet intent（fixture 或 mock）
    - When `heartbeat_check` 完成
    - Then 可审计 Quiet 编排路径被触发 **或** 周期结果含「未接线」诚实原因（与实现选项一致）
  - **验证类型**: 集成测试
  - **验证说明**: 与 T1.1.4 插件桥同路径回归；不得破坏 carrier-only / probeOnly 语义。
  - **估时**: 6h
  - **依赖**: T1.2.1, T4.4.1, T2.2.3
  - **优先级**: P1

- [x] **T1.2.5** [REQ-022][REQ-019][REQ-026]: Ops 读面 — **`status` 投递姿态 + 默认 `livedExperienceAuditStore` 接线**（CH-14-04/05 / 场测 delivery 黑盒、explain 骨架）
  - **用户原话承接**（`/change` 已批准 + Claw **E9/E10**）：OpenClaw **cron** 层可配置 **`delivery.mode: none`**（与 SN workspace 快照内 **`deliveryCapability: none`** **并存**）；`workspace-ops-bridge` **当前无** `probeHostCapability` 命令 → **`explain(delivery:…)`** 易 `lived_experience_audit_store_unavailable`。本任务闭合 **SN 侧可解释性**，**不**替代宿主改 cron 为 `announce`（运维决策）。
  - **描述**: (1) 扩展 **`StatusReadModel`**（及 `loadStatus` 聚合）：增加结构化 **`deliveryPosture`**（至少含 `verdict` / `reasonCode` / `source`，能区分 **`workspace_default_none`**、**`openclaw_cron_delivery_none`（或等价命名，与宿主配置可对照）** 与来自 **T1.1.2** `HostCapabilityReport` 的最新观测；**不得**在无 proof 时暗示已用户可见联系）。(2) **`createCliReadModels` / `createCliRuntimeDeps` / `plugin/workspace-ops-bridge`** 默认注入 **只读** `livedExperienceAuditStore`（或 observability 上等价只读投影），使 `explain` 对 `delivery:`/`fallback:`/`decision:` 等 subject **不因缺少 store 配置而恒为骨架 unavailable**（仍须脱敏与 host-safe）。(3) **可选（验收说明层）**：若产品要求 bridge 暴露 probe，**另开任务** —— 本任务可在 README/INT-S4 中 **引用** `probeHostCapability` 已存在于 runtime 导出、bridge 未接线之事实。
  - **输入**: `read-models/types.ts`；`read-models/index.ts`；`cli/index.ts`；`plugin/workspace-ops-bridge.ts`；`judge-input-from-snapshot.ts`；`probe-host-capability.ts`；Round 14 **CH-14-04**、**CH-14-05**
  - **输出**: JSON schema 扩展 + 集成测 + README/INT-S4 一句「`status.deliveryPosture.source` 语义」
  - **契约承接**: REQ-022 operator 可解释；REQ-019 ops JSON-first；REQ-026 文档可追溯（仅新增字段说明）
  - **验收标准**:
    - Given 默认 CLI / 插件桥 runtime deps（无手工注入 store）
    - When 调用 `explain` 针对已存在的 `decision:` 或 `fallback:` subject（fixture）
    - Then 不得仅返回 `lived_experience_audit_store_unavailable` 类结论 **若** observability 中已有可联接的审计行（具体断言在实现时写死）
    - When 调用 `status`
    - Then JSON 含 **`deliveryPosture`** 且 `source === "workspace_default_none"` 时与 workspace 心跳硬编码 `none` 一致可复核
  - **验证类型**: 集成测试 + 单元测试
  - **验证说明**: 与 ADR-007「无 proof 不 sent」单测不冲突；probe 缺失时允许 `unknown` verdict 但须有 `source`。
  - **估时**: 5h
  - **依赖**: T1.2.1, T1.1.2, T5.3.1, T5.2.1
  - **优先级**: P1

- [x] **T1.2.6** [REQ-019]: CLI / `second_nature_ops` — **`policy` 命令 `show` 非空壳**（承接 `.anws/v5/CHANGE_PREP_CODE_SIDE_GAPS.md` SN-CODE-01）
  - **用户原话承接**: 「policy CLI 空壳」「整理代码侧缺口准备 /change」— 将 `createCliCommands` 中 `policy` 的 `action !== "set"` 路径从占位 `notImplemented` 改为与 **ActionBridge / rhythm policy read model** 对齐的真实 `show`（或等价查询）输出；插件 host-safe 路由下保持与既有「`policy set` 须结构化参数」约束一致。
  - **描述**: 实现 `policy show`：返回当前可公开的 policy 快照字段（与 `RhythmPolicySnapshot` / actionBridge 一致），不得伪造决策结果；错误路径须 JSON-first。
  - **输入**: `src/cli/commands/index.ts`；`src/cli/commands/policy.ts`；`04_SYSTEM_DESIGN/cli-system.md`；`04_SYSTEM_DESIGN/state-system.md` §rhythm policy
  - **输出**: `policy` CLI + tool 路径可观测的 show 结果 + 单测/集成测最小覆盖
  - **契约承接**: operator JSON-first；与 README「current capability」叙述一致
  - **验收标准**:
    - Given workspace deps 可用
    - When 调用 `policy` 且 `action === "show"`（或默认 show）
    - Then 返回 `ok: true` + 结构化 `data`，且 **不得**返回「Implementation lands in later Wave tasks」占位文案
  - **验证类型**: 集成测试 + 单元测试（择一最小）
  - **验证说明**: 覆盖默认 snapshot 与缺失 policy 的诚实降级。
  - **估时**: 4h
  - **依赖**: T1.2.1, T4.1.2
  - **优先级**: P1

- [x] **T1.2.7** [REQ-019]: CLI / `second_nature_ops` — **`audit` 命令最小闭环**（承接 SN-CODE-02）
  - **用户原话承接**: 「audit CLI 空壳」「代码侧缺口」— 将 `audit` 从全盘 `notImplemented` 改为委托 **`queryExplain` / observability 读路径** 的最小只读视图（例如最近决策/投递摘要引用 id，或明确 `audit export` 委托 `exportAuditBundle` 之一）；**不**扩展 PRD REQ 集合。
  - **描述**: 实现 `second_nature_ops({ command: "audit", args })` 与 CLI 同构；默认行为须在验收中写死（list vs export vs subject）。
  - **输入**: `src/cli/commands/index.ts`；`src/observability/query/explain-query.ts`；`export-audit-bundle.ts`；`04_SYSTEM_DESIGN/observability-system.md`
  - **输出**: 非占位 `audit` 命令 + 测试
  - **契约承接**: REQ-019 operator 可观测；与 T1.2.5 默认 audit store 注入语义兼容
  - **验收标准**:
    - Given fixture observability DB
    - When 调用 `audit`（默认动作）
    - Then 返回可解析 JSON，且 **不得**为占位 notImplemented
  - **验证类型**: 集成测试
  - **验证说明**: 与空 DB 诚实路径一并断言。
  - **估时**: 4h
  - **依赖**: T1.2.1, T5.3.1, T5.2.1
  - **优先级**: P1

- [x] **T1.2.8** [REQ-019][REQ-025]: Ops — **`capability_probe`（或等价）接入 `createOpsRouter.dispatch` + workspace bridge**（承接 SN-CODE-03 / T1.2.5「可选 probe」）
  - **用户原话承接**: 「probeHostCapability 存在于 runtime 但未接入 bridge dispatch」「准备 /change」— 暴露 **只读** capability 探测结果，使 **INT-S4** 可与会话侧工具枚举 **`tools.allow` / `tools.profile` 排除规则**（宿主配置）交叉对照；**不**替代宿主改配置。
  - **描述**: (1) 在 `createCliCommands` 增加命令（如 `capability_probe`），内部调用 **`probeHostCapability`** + `recordHostCapability` 既有契约；(2) `createOpsRouter.dispatch` 增加同名校验分支；(3) `plugin/index.ts` **`WORKSPACE_BRIDGE_COMMANDS`** 与白名单路由扩展；(4) `parseCommandInput` / tool schema 补齐参数形状。
  - **输入**: `src/cli/ops/ops-router.ts`；`src/cli/host-capability/probe-host-capability.ts`；`plugin/index.ts`；`plugin/workspace-ops-bridge.ts`
  - **输出**: 可调用的 probe 命令 + 集成测（fixture adapter）
  - **契约承接**: `HostCapabilityReport`；T1.1.2 probe 结果可读路径闭合到 ops surface
  - **验收标准**:
    - Given fake host adapter
    - When bridge / CLI 执行 `capability_probe`
    - Then 返回与 `probeHostCapability` 一致的 JSON 子集，且非 `unknown_ops_command`
  - **验证类型**: 集成测试
  - **验证说明**: plugin workspace bridge 与 CLI parity；host-safe 路径保持诚实不可用语义。
  - **估时**: 5h
  - **依赖**: T1.1.2, T1.1.4
  - **优先级**: P1

- [x] **T1.2.9** [REQ-019]: `loadStatus` — **`decision_denied` 不得冒充 runtime `degraded`（语义修正）**（承接 SN-CODE-04）
  - **用户原话承接**: 「degraded 语义过激」「decision_denied 作为 failureClass 触发 degraded」— 调整 **`runtime-decision-recorder`** 与/或 **`mapRuntimeStatus`**：控制面 **`denied`（无可执行候选/门禁）** 与 **真正故障类 failureClass** 区分展示；目标状态须在验收中写死（例如 `serviceStatus: running` + `lastCycleHint` **或** 新枚举 **`awaiting_sources`** —— **不改** `[REQ-*]` 编号，仅实现层字段扩展）。
  - **输入**: `src/observability/services/runtime-decision-recorder.ts`；`src/cli/read-models/index.ts`；`07_CHALLENGE_REPORT.md` Round 14 场测「degraded」误读条
  - **输出**: 语义修正 + 单测更新 + 集成测回归（`loadStatus` fixture）
  - **契约承接**: Contract Mapping「`loadStatus` 聚合」；ADR-005 观测诚实
  - **验收标准**:
    - Given 最近一次 `second-nature-runtime` attempt 的 `failureClass === "decision_denied"`（fixture 写入）
    - When `loadStatus`
    - Then **`runtime.serviceStatus` 不得仅因此字段等同于 delivery/runtime 故障 degraded**（具体断言实现时写死）；**真正** `delivery_unavailable` 等仍可为 degraded
  - **验证类型**: 单元测试 + 集成测试
  - **验证说明**: 回归 T1.2.3 写入路径；更新文档化 INT-S2/S3 报告表述若引用旧语义。
  - **估时**: 4h
  - **依赖**: T1.2.3
  - **优先级**: P0

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
  - **验证说明**: 使用可复现 host smoke fixture；若真实 host 不可用，near-real adapter 必须输出 fail/unknown，而不是 pass；覆盖 docs-vs-observed conflict fixture。**新增（承接 `reports/second-nature-ops-tool-visibility-issue-2026-05-06.md`）**：真实宿主上若当前 agent 会话的工具枚举**不包含** `second_nature_ops`，则不得将失败仅解释为「模型未调用 tool」并记入 `heartbeat_tool_not_invoked`；须先排除插件加载链、宿主 profile / tool allowlist、网关实例与插件版本对齐等问题（背景见 `explore/reports/2026-05-05_second-nature-ops-registration-gap.md`）。**承接 OpenClaw 2026.5.7**：即使 daemon 成功加载插件（`registerTool` 已执行），**`tools.profile: coding`** 仍可能在**会话注入阶段**过滤掉 `second_nature_ops` —— 验收前须核对 **`tools.allow`** / **`tools.profile`**（见 INT-S4 验证说明「宿主回填」段）。
  - **估时**: 6h
  - **依赖**: T1.1.2, T1.1.3
  - **优先级**: P0

### Phase 4: Documentation Boundary

- [x] **T1.4.1** [REQ-026]: README current / target / validation-needed 边界更新
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

- [x] **T1.4.2** [REQ-026]: 发布门禁报告与 package host smoke 汇总
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
  - **验证说明**: 使用 fake state/connector/observability 端口验证 snapshot -> intent -> record 顺序。**workspace 全运行时路径**与 state-backed life evidence 的 parity 由 **T2.2.2** 闭合（参见 `.anws/v5/07_CHALLENGE_REPORT.md` Round 14 / CH-14-01）。
  - **估时**: 7h
  - **依赖**: T2.1.1, T2.1.3, T3.1.2, T5.1.1
  - **优先级**: P0

- [x] **T2.2.2** [REQ-019]: Workspace 心跳 — **SnapshotInputs 并入 bounded life evidence**（场测空快照 / CH-14-01）
  - **用户原话承接**（`/change` 已批准，2026-05-10）：「任务重大，先修改文档」+ Nyx v0.1.18 初报；**Claw 回填勘误**：全量心跳实测多为 **`intent_selected` + `reasons: []` + `surfaceMode: workspace_full_runtime`**（**非** `silent_no_candidates`）—— **maintenance** 类意图可走 guard 且无外部 source refs；**observability.db 持续增长** 表明决策在写。初报「空转」应修正为 **「maintenance 回路对 operator 无可见外效应 + 需 source refs 的候选仍缺输入」** 的组合。本任务仍负责 **life evidence 并入 SnapshotInputs**，使需 refs 的 planner/guard 路径与 DB 真值一致。
  - **描述**: 在 `loadSnapshotInputsForWorkspaceHeartbeat`（或经 `createWorkspaceHeartbeatRunner` 注入的等价 `loadSnapshotInputs`）中，当 **`state` API + 已解析 workspaceRoot** 可用时，调用既有 **`loadLifeEvidenceSnapshot`**（或与 `loadContinuitySnapshot` 一致的 bounded 查询），填充 `SnapshotInputs` 的 `lifeEvidenceRefs`、`platformEventCount`、`workEventCount`、`lifeEvidenceEmptyReason`；**禁止**仅靠 `readModels.loadStatus()` 推断而留空上述字段。插件 bridge 与 CLI 须同构。**不**把「曾误报的 `silent_no_candidates`」写进硬验收；以 **fixture + 可选真实 transcript** 的 JSON 真源为准。
  - **输入**: `src/cli/ops/workspace-heartbeat-runner.ts`；`src/storage/snapshots/life-evidence-snapshot.ts`；`control-plane-system.md` §4.2–4.3；`.anws/v5/07_CHALLENGE_REPORT.md` Round 14 **CH-14-01**
  - **输出**: 接线后的 `loadSnapshotInputs` + 集成测（fixture：DB 有 index 行则快照非空）
  - **契约承接**: US-001 可读快照输入；ADR-007 source-backed 前提在 **workspace 路径**上的输入层
  - **验收标准**:
    - Given fixture workspace 的 `state` 中已有可读的 life evidence index 行
    - When 执行 **full-runtime** `heartbeat_check`（非 `probeOnly`）
    - Then `SnapshotInputs`（或决策 trace 暴露的等价切片）中 **life evidence 计数或 refs 至少一项**反映 DB 真值，且不得在无数据时伪造 refs
  - **验证类型**: 集成测试
  - **验证说明**: 覆盖「有证据非空」「无证据显式 emptyReason」；与 T1.1.4 根已知路径兼容。
  - **估时**: 8h
  - **依赖**: T2.2.1, T4.2.1, T1.1.4
  - **优先级**: P0

- [x] **T2.2.3** [REQ-019]: Workspace 心跳 — **`connector_action` / 无外部效应 `intent_selected` 诚实闭合**（CH-14-02 / 场测 `connectors: []` + maintenance 无可见效果）
  - **用户原话承接**（同上 + Claw）：场测「connector 未通电」= **无 connector execution attempt**（与 `connectors: []` **telemetry 语义一致**）；**maintenance** 选中后 **无 outreach/quiet dispatch** → 对外无可见效果，须在 JSON 上可区分于「已执行平台侧效应」。
  - **描述**: 对 `resolveAllowedIntentResult`：**若**允许 `connector_action`，则必须 **(A)** 调用 connector-system 侧已存在的执行入口并经 **`ExecutionTelemetry` / `recordConnectorAttempt` 等价路径**写入 **真实 `platformId`** 的 attempt，**或 (B)** 返回带 **显式 `reasons` / reasonCodes** 的周期结果，禁止长期「`intent_selected` + 空 reasons」冒充已执行。**若**选中 **`maintenance`**（或同类 **无 outreach/quiet/connector 分支** 的 intent），**(C)** 周期 JSON 须含可机读的 **「无外部效应 / internal_tick」** 类原因（具体键名在实现时写死于验收），避免 operator 将 `reasons: []` 误读为「成功无输出」。`createWorkspaceHeartbeatRunner` 视需要扩展 `HeartbeatDeps`。**不改变** ADR-007「无 proof 不 sent」底线。
  - **输入**: `heartbeat-loop.ts`；`connector-system.md` §4；`read-models/index.ts`（`connectors` 语义）；Round 14 **CH-14-02**、**CH-14-03**
  - **输出**: 效应或诚实降级 + 单测/集成测；**文档或 JSON 注释**澄清 `status.connectors` = 最近 **非 runtime** execution attempt 摘要，**非** manifest 全量
  - **契约承接**: US-002 证据入库路径在 heartbeat 下的可观测性；ADR-002 执行边界
  - **验收标准**:
    - Given 允许的探索/社交类 `connector_action` intent（fixture）
    - When workspace 心跳解析该 intent
    - Then observability 中出现对应 **`platformId` ≠ `second-nature-runtime`** 的 attempt **或** 周期 JSON 含 **非空**「未接线/未执行」诚实原因（二者择一写死于验收）
    - Given fixture 仅产生 **maintenance** 类允许 intent（与 Claw 场测形态一致）
    - When workspace 心跳完成
    - Then 周期 JSON **不得**仅为 `intent_selected` 且 `reasons` 空数组而无 **(C)** 所述可机读原因（或等价的 `surface`/`operatorHint` 字段——实现与验收绑定一处即可）
  - **验证类型**: 集成测试 + 单元测试
  - **验证说明**: 断言 `recordConnectorAttempt` 或替代写入点在主路径被调用（若选 A）；选 B 时断言稳定 reason 键供 INT-S4 收集。
  - **估时**: 10h
  - **依赖**: T2.2.2, T3.1.1, T3.2.1
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

- [x] **T3.3.1** [REQ-020]: Moltbook / InStreet / EvoMap near-real read/write path
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

- [x] **T3.3.2** [REQ-020]: Ops 表面 — **`near_real_smoke`（或等价）CLI / bridge 命令包装 `runNearRealConnectorSmoke`**（承接 SN-CODE-05）
  - **用户原话承接**: 「connector 从未触发」「bridge 无 near_real」「准备 /change」— 在 **不修改 ADR-002 连接器执行边界前提** 下，提供 **显式运维/验收入口**：调用既有 **`runNearRealConnectorSmoke`**，写入 life evidence / execution telemetry（与 T3.3.1 哨兵一致）；**不得**声称 heartbeat 已自动通电所有连接器。
  - **描述**: 新增 `createCliCommands` 命令 + `WORKSPACE_BRIDGE_COMMANDS` + 插件 router 路由；参数：`workspaceRoot?`、`platformId?`（验收写死最小集）；失败返回诚实错误码。
  - **输入**: `src/connectors/near-real/near-real-connector-smoke.ts`；`plugin/index.ts`；`src/cli/commands/index.ts`
  - **输出**: 可复现的 operator 入口 + 集成测（fixture near-real）
  - **契约承接**: connector smoke harness；与 **T2.2.3** `connector_dispatch_unwired` 文档区分（heartbeat vs 显式 smoke）
  - **验收标准**:
    - Given fixture workspace + observability/state DB
    - When CLI / `second_nature_ops` 调用 `near_real_smoke`（具体命令名以实现为准并在验收写死）
    - Then observability 出现 **非 `second-nature-runtime`** 的 connector attempt **或** 诚实 `unsupported`/凭证缺失错误（与 near-real 适配器一致）
  - **验证类型**: 集成测试
  - **验证说明**: 与现有 `tests/integration/connectors/near-real-connector-smoke.test.ts` 共享 harness；插件 bridge `chdir` 语义不变。
  - **估时**: 5h
  - **依赖**: T3.3.1, T1.1.4
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

- [x] **T4.1.4** [REQ-019]: native SQLite vs sql.js storage mode smoke
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

- [x] **T7.1.1** [REQ-026]: 文档契约一致性检查
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

- [x] **INT-S1** [MILESTONE]: S1 集成验证 — Host & State Foundation
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

- [x] **INT-S2** [MILESTONE]: S2 集成验证 — Evidence & Rhythm Loop
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
  - **描述**: 验证 S4 退出标准，确认 packaged plugin、host smoke、ops explain、platform near-real path、README 边界和 release gate 可复现；**若 T1.1.4 已交付**：在真实宿主上增加 **workspace 根已知** 场景下 `heartbeat_check` / `quiet` 与 CLI 语义对齐或诚实失败的证据（见 `reports/int-s4-release-readiness.md` 与本节「验证说明」；步骤表见 `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`）。**若 `/change` Round 14 回流任务已 `/forge` 交付**：场测类 Finding 须在 transcript 中 **显式采样** `status` / `heartbeat_check` / `report` / `explain` JSON；**Claw 勘误**：初报「`silent_no_candidates` 空转」应以实测 JSON 为准——**`intent_selected` + maintenance + `reasons: []`** 与 **observability 增长** 为合法形态，与「空快照 / 无 connector attempt」**并存**时须在 readiness 中分条叙述（对照 Nyx / Claw 2026-05-10 回填）。
  - **输入**: S4 所有任务产出：T1.2.1, T1.2.2, **T1.2.3**（`loadStatus` 观测写回，与根已知宿主 `status` 证据强相关）, T1.3.1, T3.3.1, T5.3.1, T1.4.1, T1.4.2, T7.1.1；**T1.1.4**（插件 workspace 桥接，可选纳入同一宿主波次）；**可选前置闭环**：**T2.2.2, T2.2.3, T1.2.4, T1.2.5**（`07_CHALLENGE_REPORT.md` Round 14 / CH-14 与 Nyx v0.1.18 场测同源；未交付则记入 `int-s4-release-readiness` Finding 而非强行勾选里程碑）
  - **输出**: `reports/int-s4-release-readiness.md`
  - **契约承接**: host smoke report、fallback visibility、README truth boundary、release gate
  - **📎 参考**: `cli-system.md` §12.2；`01_PRD.md` US-008；`explore/reports/2026-05-03_openclaw-plugin-quiet-workspace-bridge.md`
  - **验收标准**:
    - Given package artifact 与 host smoke plan 已准备
    - When 执行 release readiness 验证
    - Then package load、heartbeat_check、target none、ack drop、heartbeat_tool_not_invoked、fallback visibility、README boundary 均有 pass/fail/unknown 证据
  - **验证类型**: 冒烟测试 / 手动验证
  - **验证说明**: 只在本 INT 执行真实宿主冒烟；失败进入 bug/fix 波次，不把 Sprint 标记完成。**T1.2.3 完成后**（或在 INT 证据中单列为 Finding）：根已知场景下在至少一次 **full-bridge `heartbeat_check`** 后，`second_nature_ops status` 的 **`rhythm.mode` / `runtime.serviceStatus` 不得仅因 observability 表空而全系 `unknown`**（与空 workspace 对照区分）。**T1.1.4 完成后**：宿主须覆盖 `SECOND_NATURE_WORKSPACE_ROOT`（或工具 `workspaceRoot`）与 **未设置** 对照，记录 Quiet/heartbeat/**explain**（CH-11-02）是否从「仅 carrier 拒绝 / 半成功 `ok:true`」升级为「真读或诚实错误」；步骤见 `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`；人类记录写入 `reports/int-s4-release-readiness.md`。**根已知** 证据中**必须**注明所设路径是否与宿主 **OpenClaw agent workspace**（`agents.defaults.workspace`，或沙箱内实际生效 workspace）一致，避免与默认路径口头对齐而实际漂移（见 T1.1.4 **运维约定 (OpenClaw 宿主)**）。**新增（承接 2026-05-05 survey + subagent 48/100 审查）**：真实宿主 transcript 须同时覆盖 carrier-only 与 full-bridge 两种路径；bridge 成功案例须附 root 红acted 截图 + chdir 影响声明；若 sandbox 下 dynamic import + sql.js 失败，须记录 `WORKSPACE_FULL_OPS_BRIDGE_FAILED` 详情并触发 Plan B 讨论。参考 `explore/reports/2026-05-05_openclaw-plugin-support-survey.md` §8。**新增（承接 2026-05-06 干系人报告）**：若以 **agent 会话工具调用**为验收主路径，须确认工具枚举**包含** `second_nature_ops`；若缺失，**不得**将 E2E / INT-S4 标为通过，须先按 `reports/second-nature-ops-tool-visibility-issue-2026-05-06.md` 与 `explore/reports/2026-05-05_second-nature-ops-registration-gap.md` 排查（与「心跳正常但工具表无 SN」区分）。**新增（OpenClaw 2026.5.7 宿主回填）**：若 `openclaw plugins info` 显示插件 **loaded**、网关 stderr **无**加载失败，但会话 `tools` 仍无 `second_nature_ops`，须核对宿主 **`tools.profile`**（例如 **`coding`** 仅包含内置组）是否过滤扩展工具；可按宿主配置追加 **`tools.allow: ["second_nature_ops"]`** 或调整 **`tools.profile`** —— **归因属宿主配置，非 SN 仓库缺陷**，须在 `int-s4-release-readiness` 记录后再验会话 JSON。**场测勘误（2026-05-10 Claw）**：若组织**声明**生产主入口为 **cron + `openWorkspaceBridge(resolvedRoot)`**（与 agent 工具表解耦），则须另附 **cron 片段**（含 `export SECOND_NATURE_WORKSPACE_ROOT`、`cd`、`openWorkspaceBridge`）、**同路径 `heartbeat_check` JSON 两条**（`probeOnly: true` 与 `false`，`surfaceMode` 可区分）、以及 **state.db / SOUL.md / HEARTBEAT.md** 三锚点路径一致性；此时 agent 侧 **`second_nature_ops` 不可见** 记 **Finding: tool_visibility_gap**，**不得**记入 `heartbeat_tool_not_invoked`。里程碑勾选须在 `reports/int-s4-release-readiness.md` **人工裁量**并引用本段。
  - **估时**: 4h
  - **依赖**: T1.2.1, T1.2.2, T1.2.3, T1.3.1, T3.3.1, T5.3.1, T1.4.1, T1.4.2, T7.1.1

---

## 🎯 User Story Overlay

### US-001: 让 heartbeat_check 进入真实生活决策链 (P0)
**涉及任务**: T1.1.1 → T1.1.3 → T5.1.1 → T4.2.1 → T2.1.1 → T2.2.1 → **T2.2.2** → **T2.2.3** → INT-S2  
**关键路径**: T1.1.3 → T4.2.1 → T2.1.1 → T2.2.1 → **T2.2.2**（workspace 快照并入 life evidence）  
**独立可测**: ✅ S2 结束可用 near-real workspace 状态验证；**OpenClaw workspace 全运行时** 与 Nyx 场测 parity 由 **T2.2.2–T2.2.3** + INT-S4 追加验证  
**覆盖状态**: ✅ 完整；**T2.2.2**（workspace 快照并入 life evidence）+ **T2.2.3**（connector_dispatch_unwired / internal_tick 诚实 reasons）已由 Wave 19 闭合；宿主 INT-S4 端到端验证 ⏳

### US-002: 建立 life evidence 入库与查询契约 (P0)
**涉及任务**: T3.1.2 → T4.1.1 → T4.2.1 → T5.1.2 → T3.3.1  
**关键路径**: T3.1.2 → T4.1.1 → T4.2.1  
**独立可测**: ✅ S2 可测基础写读，S4 可测 near-real 平台路径（T3.3.1 哨兵 harness）  
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
**涉及任务**: T4.2.1 → T4.4.1 → T6.1.2 → T2.3.3 → T5.2.1 → INT-S3 → **T1.2.4**  
**关键路径**: T4.4.1 → T6.1.2 → T2.3.3 → **T1.2.4**（operator 读面与 workspace `quietWorkflow`）  
**独立可测**: ✅ S3 可验证空/非空 evidence 两条路径  
**覆盖状态**: ✅ 完整；**T1.2.4**（loadQuiet + loadDailyReport FS 合并）已由 Wave 19 闭合；宿主 INT-S4 端到端验证 ⏳

### US-007: 验证 OpenClaw 主动联系能力与兜底路径 (P0)
**涉及任务**: T1.1.2 → T1.3.1 → T2.3.2 → T1.2.2 → **T1.2.3** → INT-S1 → INT-S4  
**关键路径**: T1.1.2 → T1.3.1  
**独立可测**: ✅ S1 即可先出 capability report；S4 出真实 host smoke 汇总  
**覆盖状态**: ✅ 完整

### US-008: 对齐 README 与 v5 真实能力边界 (P1)
**涉及任务**: T1.4.1 → T1.4.2 → T7.1.1 → INT-S4  
**关键路径**: T1.4.1 → T7.1.1  
**独立可测**: ✅ S4 文档审查可验  
**覆盖状态**: ✅ 文档与门禁已落地；真实宿主验证 ⏳ INT-S4

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
| README truth boundary | 文档契约 | T1.4.1, T1.4.2, T7.1.1 | T7.1.1, INT-S4（宿主 ⏳） | ✅ |
| `loadStatus` 聚合与 `observability.db` 写入一致 | operator 面板 | T1.2.1, T1.2.3, T2.2.1, **T1.2.5** | T1.2.3, INT-S4（宿主 ⏳） | ✅（单测/集成）｜⏳（宿主 INT-S4） |
| workspace `SnapshotInputs` life evidence | 控制面输入 | **T2.2.2** | T2.2.2, INT-S4 | ✅（集成）｜⏳（宿主 INT-S4） |
| workspace `connector_action` 效应/telemetry | 控制面 + 观测 | **T2.2.3** | T2.2.3, INT-S4 | ✅（connector_dispatch_unwired + internal_tick；集成）｜⏳（宿主 INT-S4） |
| Quiet JSON ↔ operator report/quiet | 读模型 | **T1.2.4** | T1.2.4, INT-S4 | ✅（loadQuiet + loadDailyReport FS 合并；集成）｜⏳（宿主 INT-S4） |
| `deliveryPosture` + 默认 audit explain deps | operator JSON | **T1.2.5** | T1.2.5, INT-S4 | ✅（deliveryPosture + default store；集成）｜⏳（宿主 INT-S4） |
| `policy show` / `audit` CLI | ops command | **T1.2.6**, **T1.2.7** | T1.2.6, T1.2.7, INT-S4 | ✅（集成）｜⏳（宿主 INT-S4） |
| `capability_probe` ops surface | 宿主能力对照 | **T1.2.8** | T1.2.8, INT-S4 | ✅（集成）｜⏳（宿主 INT-S4） |
| `decision_denied` vs runtime degraded | operator `loadStatus` | **T1.2.9** | T1.2.9, INT-S4 | ✅（集成）｜⏳（宿主 INT-S4） |
| `near_real_smoke` ops 入口 | connector 显式通电 | **T3.3.2** | T3.3.2, INT-S4 | ✅（集成）｜⏳（宿主 INT-S4） |

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
- ✅ **Round 14（CH-14 / Nyx v0.1.18 场测）** 已回流为 **T2.2.2、T2.2.3、T1.2.4、T1.2.5**（`/change` 2026-05-10）。
- ✅ **代码侧缺口（CHANGE_PREP）** 已回流为 **T1.2.6～T1.2.9、T3.3.2**（`/change` 2026-05-11；见 `.anws/v5/CHANGE_PREP_CODE_SIDE_GAPS.md`）。

## 📊 任务统计

- Level 3 任务数: 47
- INT 任务数: 4
- 总任务数: 51
- P0 任务: 31
- P1 任务: 16
- P2 任务: 0
- Milestone 任务: 4
- 总预估工时: 263h

