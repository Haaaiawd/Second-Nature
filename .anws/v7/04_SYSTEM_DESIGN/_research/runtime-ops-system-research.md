# Runtime Ops System Research

| 字段 | 值 |
| --- | --- |
| System ID | `runtime-ops-system` |
| Target Version | `.anws/v7` |
| Date | 2026-05-21 |
| Scope | `/design-system runtime-ops-system` research |
| Source Policy | 仓库文档与源码优先；本轮未使用外网 |

## 1. 问题与范围

### 1.1 核心问题

`runtime-ops-system` 如何在 v7 中继续作为 OpenClaw / CLI / workspace bridge 的单一宿主入口，同时暴露 `self_health`、`tool_affordance`、`connector_test --wet`、digest、timeline、restore 与 secret recovery，而不越界接管 control-plane、state-memory、body-tool 或 observability-health 的职责。

### 1.2 子问题表

| 子问题 | 探索方向 | 预期产出 |
| --- | --- | --- |
| RQ1: v7 对 runtime-ops 的新增契约是什么 | 向外: 仓库文档 | 需求、边界、性能与安全约束 |
| RQ2: v6 ops surface 可复用什么 | 向外: v6 设计 | JSON-first、host-safe carrier、workspace bridge 基线 |
| RQ3: 当前实现的真实入口在哪里 | 向外: 源码 | plugin、CLI、OpsRouter、read model 与 credential 证据 |
| RQ4: runtime-ops 与相邻系统如何切边界 | 混合 | 输入输出、依赖方向、禁止复制逻辑 |
| RQ5: 设计上有哪些可辩驳方案 | 向内 | 保持单入口 vs 拆 plugin/cli；wet/manual 隔离策略 |

### 1.3 范围边界

- 包含：OpenClaw plugin registration、`second_nature_ops`、CLI command routing、workspace bridge、manual run 隔离、runtime mode envelope、bootstrap / self-health / recovery read surface。
- 不包含：heartbeat planner、ToolAffordanceMap 计算、ToolExperienceLog 持久化、SelfHealthSnapshot 诊断算法、HeartbeatDigest 生成算法、RestoreSnapshot 存储机制。
- 不包含代码实现；本次只产出 research 与 L0 设计。

### 1.4 探索进度表

| 子问题 | 状态 | 核心发现 |
| --- | --- | --- |
| RQ1 | 已完成 | v7 架构把 runtime-ops 定义为 plugin/CLI/bridge/manual run 入口，并要求暴露 `self_health`、`tool_affordance`、wet test、digest、timeline、restore、secret recovery surface。 |
| RQ2 | 已完成 | v6 已有 JSON-first `OpsCommandEnvelope`、`runtimeMode`、host-safe carrier 与 workspace bridge；这些是 v7 应继承的入口契约。 |
| RQ3 | 已完成 | 当前代码中 plugin 通过 `WORKSPACE_BRIDGE_COMMANDS` 路由 full runtime command，CLI 通过 `createCliRuntimeDeps` 组装 state/observability/registry/connector executor。 |
| RQ4 | 已完成 | runtime-ops 只能聚合和路由；状态真相在 state-memory，健康解释在 observability-health，工具可供性在 body-tool，行动裁决在 control-plane。 |
| RQ5 | 已完成 | 最小复杂度方案是保留单一 JSON-first ops surface；拆成 plugin-system 与 cli-system 会复制 workspace resolution 和 unavailable 语义。 |

## 2. 核心洞察

1. `runtime-ops-system` 是宿主神经接口，不是业务控制面；v7 架构明确它“不拥有业务判断”。来源：`.anws/v7/02_ARCHITECTURE_OVERVIEW.md:405`。
2. v7 的新增入口应作为 v6 ops surface 的增量命令进入同一 JSON-first router，而不是重建第二套 plugin/CLI。来源：`.anws/v7/02_ARCHITECTURE_OVERVIEW.md:470`、`.anws/v6/04_SYSTEM_DESIGN/cli-system.md:57`。
3. `connector_test --wet` 和 `connector:run` 必须标记 manual trigger，并与 cron heartbeat cadence 隔离；ADR-006 明确 wet test 不改变自然 heartbeat cadence。来源：`.anws/v7/03_ADR/ADR_006_CHANNEL_FEEDBACK_AND_SELF_HEALTH.md:33`。
4. Secret recovery 是 runtime-ops 必须暴露的 operator surface，但 key 明文永远不属于该系统。来源：`.anws/v7/01_PRD.md:64`、`src/storage/services/credential-vault.ts:40`。
5. 当前 v6 `connector_test` 仍默认 dry-run；v7 wet truth 需要新增 explicit `wet` contract，不能把现有 dry health 扩写成真实探针。来源：`src/cli/commands/connector-status.ts:111`、`.anws/v7/01_PRD.md:192`。

## 3. 详细发现

### 3.1 v7 需求与边界

v7 架构在 Runtime Ops System 下列出四类职责：OpenClaw plugin registration、workspace bridge、CLI / ops command surface；manual run 与 cron heartbeat 隔离；提供 agent/operator 可读入口；暴露 RuntimeSecretAnchor 与 bootstrap recovery view。来源：`.anws/v7/02_ARCHITECTURE_OVERVIEW.md:58-64`。

关联需求覆盖 `[REQ-001]`、`[REQ-002]`、`[REQ-003]`、`[REQ-006]`、`[REQ-007]`、`[REQ-009]`、`[REQ-010]`、`[REQ-011]`、`[REQ-012]`。来源：`.anws/v7/02_ARCHITECTURE_OVERVIEW.md:363`。

PRD 给出 runtime-ops 直接相关的验收点：

- `self_health` 必须输出 root/env/cron/bridge drift 和 redacted remediation。来源：`.anws/v7/01_PRD.md:161`。
- encryption key 缺失或错误必须通过 `self_health` / bootstrap view 返回 `runtime_secret_unavailable` 或 `credential_recovery_required`。来源：`.anws/v7/01_PRD.md:162`。
- `connector_test --wet` 对 404 必须返回真实 status/path/reason，不能返回 dry-run `ok`。来源：`.anws/v7/01_PRD.md:192`。
- HeartbeatDigest 是 dashboard proof，不是 outreach。来源：`.anws/v7/01_PRD.md:63`、`.anws/v7/01_PRD.md:199-210`。
- runtime 性能边界包括 SelfHealthSnapshot DB 可用时 P95 < 1s。来源：`.anws/v7/01_PRD.md:287`。

### 3.2 v6 可复用基线

v6 `cli-system` 已定义 agent-facing ops surface：`narrative`、`goal`、`dream:recent`、`connector:*`、`cycle:recent` 与 `second_nature_ops` JSON 契约；它只做可见性、受控命令和 host-safe carrier，不拥有 planning、Dream、connector 或 state 真相。来源：`.anws/v6/04_SYSTEM_DESIGN/cli-system.md:14`。

v6 底层契约是 JSON-first envelope，包含 `runtimeMode`、`ok`、`data`、`warnings`、`sourceRefs`。来源：`.anws/v6/04_SYSTEM_DESIGN/cli-system.md:57`、`.anws/v6/04_SYSTEM_DESIGN/cli-system.md:260-267`。

v6 已经把 host-safe carrier 误判 full runtime 定为 High 风险，缓解措施是强制 `runtimeMode`。来源：`.anws/v6/04_SYSTEM_DESIGN/cli-system.md:407`。

v6 bridge 运维原则是 full workspace runtime resolution 失败时返回 host-safe envelope。来源：`.anws/v6/04_SYSTEM_DESIGN/cli-system.md:461`。

### 3.3 当前实现证据

`plugin/index.ts` 注册 `second_nature_ops` 工具，并通过 `SECOND_NATURE_WORKSPACE_ROOT` 或 tool `workspaceRoot` 定位 workspace。来源：`plugin/index.ts:44`、`plugin/index.ts:1507-1510`。

`plugin/index.ts` 中 `WORKSPACE_BRIDGE_COMMANDS` 已包括 `status`、`explain`、`heartbeat_check`、`fallback`、`capability_probe`、`narrative`、`goal`、`dream:recent`、`connector_status`、`connector_test`、`connector_behavior_add`、`cycle:recent`。来源：`plugin/index.ts:211-234`。

`plugin/workspace-ops-bridge.ts` 动态导入 packaged runtime，创建 state/observability DB，并通过与 CLI 同构的 `createCliRuntimeDeps`、`createOpsRouter`、`createCliCommands` 分发命令。来源：`plugin/workspace-ops-bridge.ts:48-76`、`plugin/workspace-ops-bridge.ts:121-146`。

`src/cli/index.ts` 负责组装 `stateDb`、`observabilityDb`、`readModels`、`runtimeRecorder`、`connectorExecutor` 和 `DynamicConnectorRegistry`。来源：`src/cli/index.ts:121-149`。

`src/cli/ops/ops-router.ts` 当前已承接 `heartbeat_check`、`fallback`、`capability_probe`、`near_real_smoke`、`connector_init`、`connector_behavior_add`、`connector_status`、`connector_test`、`goal`、`dream:recent`、`cycle:recent`。来源：`src/cli/ops/ops-router.ts:91-378`。

Credential health 已有可复用探针：`probeCredentialHealth()` 区分 missing key、wrong key 与 ok，输出 `missing_runtime_secret` / `credential_recovery_required` / `ok`。来源：`src/storage/services/credential-vault.ts:101-156`。

### 3.4 相邻系统切边界

`state-memory-system` 持久化 `NarrativeTimeline`、`HeartbeatDigest`、`CapabilityProbeResult`、`RestoreSnapshot` 等实体；runtime-ops 只能调用 read/write ports，不应直接定义 canonical schema。来源：`.anws/v7/02_ARCHITECTURE_OVERVIEW.md:138-141`。

`observability-health-system` 提供 redaction、proof truthfulness、host/cron/bridge drift 诊断、HeartbeatDigest、NarrativeTimeline、runtime secret recovery diagnostics 与 restore audit。来源：`.anws/v7/02_ARCHITECTURE_OVERVIEW.md:328-330`。

`body-tool-system` 负责 `ToolAffordanceMap`、`ToolExperienceLog` 和 `ConnectorCircuitBreaker`；runtime-ops 只暴露 `tool_affordance` 命令。来源：`.anws/v7/02_ARCHITECTURE_OVERVIEW.md:177-184`、`.anws/v7/03_ADR/ADR_003_TOOL_AFFORDANCE_AND_EXPERIENCE.md:33`。

`control-plane-system` 负责 heartbeat 和 embodied context assembly；runtime-ops 的 `heartbeat_check` 只是入口与可见面，不拥有 planner。来源：`.anws/v7/02_ARCHITECTURE_OVERVIEW.md:99-114`。

### 3.5 矛盾与缺口

当前 `connector_test` 代码仍以 `dryRun` 为默认，只返回 inventory-level health checks；v7 要求 `--wet` 真实调用 safe endpoint 并返回 HTTP/path/reason。这不是命名层面的小改动，必须有显式 `mode: "dry" | "wet"` 和 safe endpoint gate。来源：`src/cli/commands/connector-status.ts:111-166`、`.anws/v7/01_PRD.md:192`。

当前 `status:v6` 和 credential read model 已能暴露 key health，但 v7 的 `self_health` 要聚合 root/env/cron/bridge/Dream/storage/setup 等多维 drift。不能把现有 `status` 直接改名为 `self_health`。来源：`src/cli/read-models/index.ts:220-413`、`.anws/v7/03_ADR/ADR_006_CHANNEL_FEEDBACK_AND_SELF_HEALTH.md:33`。

当前 plugin host-safe router 有大量 command-specific unavailable payload，但 v7 需要统一 `runtimeMode` / `surfaceMode` 与 reason code，避免每个新命令随手造错误形状。来源：`plugin/index.ts:267-280`、`.anws/v6/04_SYSTEM_DESIGN/cli-system.md:407`。

## 4. 创意 / 方案表

| 方案 | 判定 | 依据 | 代价 |
| --- | --- | --- | --- |
| A. 保留单一 runtime ops surface，增量加入 v7 命令 | 采用 | v7 架构明确 plugin/CLI 不拆，v6 已有 JSON-first envelope 与 bridge | 命令契约表会更长，需要严格分层 |
| B. 拆成 plugin-system 与 cli-system | 不采用 | `.anws/v7/02_ARCHITECTURE_OVERVIEW.md:470` 明确不拆；拆开会复制 workspace resolution | 表面清爽，实际增加偶然复杂度 |
| C. 将 `self_health` 做成 `status` alias | 不采用 | self-health 要诊断 root/env/cron/bridge/secret/Dream/storage，不只是 aggregate status | 容易把未知误写成健康 |
| D. `connector_test` 默认 wet | 不采用 | wet probe 有网络、安全和 side-effect 风险，PRD 要 operator 显式调用 `--wet` | 显式参数多一点，但安全边界清楚 |
| E. Digest 走 outreach 语气和投递链 | 不采用 | PRD 与 ADR-007 明确 digest 是 dashboard proof，不是朋友式 outreach | 需要单独 delivery mode 文案 |

## 5. 行动建议

1. L0 将 runtime-ops 拆为六个组件：`RuntimeSurfaceRouter`、`WorkspaceOpsBridge`、`ManualRunDispatcher`、`HealthAndRecoverySurface`、`DigestTimelineRestoreSurface`、`SecretBootstrapSurface`。
2. 设计所有 v7 新入口走同一 `RuntimeOpsEnvelope`，并保留 `runtimeMode`、`surfaceMode`、`sourceRefs`、`warnings`、`requiredAction`。
3. `connector_test` 明确 `mode=dry|wet`；wet 只允许 safe/read-only endpoint，必须返回真实 `httpStatus`、`path`、`redactedSampleRef` 或 unavailable reason。
4. `connector_run` 与 `connector_test --wet` 必须写 `triggerSource: "manual"`，不得推进 heartbeat cadence。
5. `self_health` 只聚合 observability-health/state/body/connector 探针结果；runtime-ops 不实现健康推断算法。
6. `restore` 只提交恢复请求并展示结果；snapshot selection、敏感排除、restore audit 由 state-memory 与 observability-health 执行。

## 6. 局限与待探

| 缺口 | 影响 | 下一步 |
| --- | --- | --- |
| `self_health` 内部 probe schema 尚未由 observability-health L0 固定 | runtime-ops 只能定义入口契约，不能细化所有 section | [OPEN: 等 observability-health-system 设计确认 section 字段 + owner/父会话汇总] |
| `ToolAffordanceMap` 字段由 body-tool-system 持有 | runtime-ops 只能声明透传 envelope 和 redaction 约束 | [OPEN: 等 body-tool-system 设计确认 affordance row 字段 + owner/父会话汇总] |
| `RestoreSnapshot` schema 由 state-memory-system 持有 | runtime-ops 无法定义 snapshot payload | [OPEN: 等 state-memory-system 设计确认 restore target/version/scope + owner/父会话汇总] |
| OpenClaw current channel / dm proof 实机行为仍需 host E2E | 本地代码不能证明 host delivery proof 语义 | [OPEN: blueprint 阶段创建 host E2E checklist + owner/maintainer 执行] |

未使用 skill harvesting；本次由 `/design-system` 触发，证据来自仓库文档与源码。

## 7. 参考来源

- `.anws/v7/01_PRD.md:51-64` — Digest、Timeline、Restore、RuntimeSecretAnchor 与 Non-Goals。
- `.anws/v7/01_PRD.md:87-107` — ToolAffordance 与 ToolExperience 需求。
- `.anws/v7/01_PRD.md:158-167` — SelfHealth 与 RuntimeSecretAnchor 验收。
- `.anws/v7/01_PRD.md:189-197` — wet probe 与 CircuitBreaker 验收。
- `.anws/v7/01_PRD.md:199-225` — HeartbeatDigest、NarrativeTimeline、RestoreSnapshot。
- `.anws/v7/01_PRD.md:287-300` — 性能、安全、host E2E 限制。
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md:58-93` — Runtime Ops System 清单。
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md:405-411` — runtime/state 边界。
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md:447-470` — 拆分理由与不再拆分。
- `.anws/v7/03_ADR/ADR_001_TECH_STACK.md:33-47` — TypeScript / Node / OpenClaw 存量演进。
- `.anws/v7/03_ADR/ADR_002_EMBODIED_AGENT_LOOP.md:33` — embodied context 引导而非控制。
- `.anws/v7/03_ADR/ADR_003_TOOL_AFFORDANCE_AND_EXPERIENCE.md:33-47` — ToolAffordance、ToolExperience、CircuitBreaker。
- `.anws/v7/03_ADR/ADR_006_CHANNEL_FEEDBACK_AND_SELF_HEALTH.md:13-46` — delivery proof、SelfHealth、manual trigger 隔离。
- `.anws/v7/03_ADR/ADR_007_IDENTITY_DIGEST_AND_RECOVERY.md:14-47` — HeartbeatDigest 与 RuntimeSecretAnchor。
- `.anws/v7/03_ADR/ADR_008_CONNECTOR_PROBE_CIRCUIT_BREAKER_AND_ROLLBACK.md:28-33` — wet probe、NarrativeTimeline、RestoreSnapshot。
- `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:14-59` — v6 ops surface 与 host-safe carrier。
- `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:260-267` — `OpsCommandEnvelope` 字段基线。
- `plugin/index.ts:211-234` — workspace bridge command set。
- `plugin/workspace-ops-bridge.ts:48-146` — packaged runtime bridge 装配。
- `src/cli/index.ts:121-149` — CLI runtime dependencies。
- `src/cli/ops/ops-router.ts:91-378` — 当前 ops command dispatch。
- `src/cli/commands/connector-status.ts:111-166` — 当前 `connector_test` dry-run 语义。
- `src/storage/services/credential-vault.ts:101-156` — credential key health probe。
