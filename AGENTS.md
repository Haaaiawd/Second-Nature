# AGENTS.md - AI 协作协议

> **"如果你正在阅读此文档，你就是那个智能体 (The Intelligence)。"**
>
> 这个文件是你的**锚点 (Anchor)**。它定义了项目的法则、领地的地图，以及记忆协议。
> 当你唤醒（开始新会话）时，**请首先阅读此文件**。

---

## 30秒恢复协议 (Quick Recovery)

**当你开始新会话或感到"迷失"时，立即执行**:

1. **读取根目录的 AGENTS.md** → 获取项目地图
2. **查看下方"当前状态"** → 找到最新架构版本
3. **读取 `.anws/v{N}/05A_TASKS.md` 与 `05B_VERIFICATION_PLAN.md`** → 了解执行与验证待办
4. **开始工作**

---

## 地图 (领地感知)

以下是这个项目的组织方式：


| 路径                                    | 描述                                  | 访问协议                                             |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| `src/`                                | **实现层**。实际的代码库。                     | 通过 Task 读/写。                                     |
| `.anws/`                              | **统一架构根目录**。包含版本化架构状态与升级记录。         | **只读**(旧版) / **写一次**(新版) / `changelog` 由 CLI 维护。 |
| `.anws/v{N}/`                         | **当前真理**。最新的架构定义。                   | 永远寻找最大的 `v{N}`。                                  |
| `.anws/changelog/`                    | **升级记录**。`anws update` 生成的变更记录。     | 由 CLI 自动维护，请勿删除。                                 |
| `target-specific workflow projection` | **工作流**。`/genesis`, `/blueprint` 等。 | 读取当前 target 对应的原生投影文件。                           |
| `target-specific skill projection`    | **技能库**。原子能力。                       | 调用当前 target 对应的原生投影文件。                           |
| `.nexus-map/`                         | **知识库**。代码库结构映射。                    | 由 nexus-mapper 生成。                               |


## 工作流注册表

> [!IMPORTANT]
> **工作流优先原则**：当任务匹配某个工作流，或你判断当前任务**明显符合、基本符合、甚至只是疑似符合**某个工作流的适用场景时，**都必须先读取相应文件**，并严格遵循其中的步骤执行。工作流是经过精心设计的协议，而非可选参考。
>
> **触发流程**：
>
> 1. 用户提及工作流名称，或你判断当前任务明显符合、基本符合、甚至只是疑似符合某个工作流的适用场景时，都必须先读取相应文件
> 2. **立即读取** 相应工作流文件
> 3. **严格遵循**工作流中的步骤执行
> 4. 在检查点暂停等待用户确认


| 工作流              | 触发时机                 | 产出                                           |
| ---------------- | -------------------- | -------------------------------------------- |
| `/quickstart`    | 新用户入口 / 不知道从哪开始      | 编排其他工作流                                      |
| `/genesis`       | 新项目 / 重大重构           | PRD, Architecture, ADRs                      |
| `/probe`         | 变更前 / 接手项目           | `.anws/v{N}/00_PROBE_REPORT.md`              |
| `/design-system` | genesis 后            | 04_SYSTEM_DESIGN/*.md                        |
| `/blueprint`     | genesis 后            | 05A_TASKS.md + 05B_VERIFICATION_PLAN.md + AGENTS.md 初始 Wave |
| `/change`        | 进入 forge 编码后的任务局部修订  | 更新 TASKS + SYSTEM_DESIGN (仅修改) + CHANGELOG   |
| `/explore`       | 调研时                  | 探索报告                                         |
| `/challenge`     | 决策前质疑                | 07_CHALLENGE_REPORT.md (含问题总览目录)             |
| `/forge`         | 编码执行                 | 代码 + 更新 AGENTS.md Wave 块                     |
| `/craft`         | 创建工作流/技能/提示词         | Workflow / Skill / Prompt 文档                 |
| `/upgrade`       | `anws update` 后做升级编排 | 判断 Minor / Major，并路由到 `/change` 或 `/genesis` |


---

## 宪法 (The Constitution)

1. **版本即法律**: 不"修补"架构文档，只"演进"。变更必须创建新版本。
2. **显式上下文**: 决策写入 ADR，不留在"聊天记忆"里。
3. **交叉验证**: 编码前对照 `05A_TASKS.md` 与 `05B_VERIFICATION_PLAN.md`。我在做计划好的事吗？
4. **美学**: 文档应该是美的。善用 Markdown 与清晰的层次结构。

---

## 项目状态保留区

<!-- AUTO:BEGIN — 项目状态保留区（升级时唯一保留的部分，请勿手动修改区块边界） -->

## 📍 当前状态 (由 Workflow 自动更新)

> **注意**: 这是项目文件中的保留部分，由 `/genesis`、`/blueprint` 和 `/forge` 自动维护。

- **最新架构版本**: `.anws/v6`
- **活动任务清单**: `.anws/v6/05A_TASKS.md`
- **活动验证计划**: `.anws/v6/05B_VERIFICATION_PLAN.md`
- **最近一次更新**: `2026-05-18` (Wave 35 `/forge`: S5 Life Loop Activation — T1.4.1 RuntimeSecretBootstrap + T1.4.2 activation UX cleanup)

### 🌱 Genesis v6 ✅ — Agent Self Layer & Dream Blueprint Ready

v6 将 Second Nature 从 lived-experience closure 推进为 Agent Self Layer + Dream + Connector Ecosystem：NarrativeState、RelationshipMemory、AgentGoal、MemoryStore、Dream lifecycle、dynamic connector trust policy 与 JSON-first ops surface 已进入 canonical 任务/验证双文档。

---

## 🌳 项目结构 (Project Tree)

> **注意**: 此部分由 `/genesis` 维护。

```text
plugin/
├── index.ts
├── workspace-ops-bridge.ts
├── openclaw.plugin.json
└── package.json

src/
├── cli/
├── core/
│   └── second-nature/
├── connectors/
│   ├── social-community/
│   │   ├── moltbook/
│   │   └── instreet/
│   └── agent-network/
│       └── evomap/
├── guidance/
├── storage/
├── observability/
└── shared/

.anws/
└── v6/
   ├── 00_MANIFEST.md
   ├── 01_PRD.md
   ├── 02_ARCHITECTURE_OVERVIEW.md
   ├── 03_ADR/
   │   ├── ADR_001_TECH_STACK.md
   │   ├── ADR_002_CONNECTOR_ECOSYSTEM.md
   │   ├── ADR_003_AGENT_SELF_LAYER.md
   │   └── ADR_004_DREAM_MECHANISM.md
   ├── 04_SYSTEM_DESIGN/
   │   └── _research/
   ├── 05A_TASKS.md
   ├── 05B_VERIFICATION_PLAN.md
   ├── 06_CHANGELOG.md
   ├── 07_CHALLENGE_REPORT.md
   └── concept_model.json
```

---

## 🧭 导航指南 (Navigation Guide)

> **注意**: 此部分由 `/genesis` 维护。

- **架构总览**: `.anws/v6/02_ARCHITECTURE_OVERVIEW.md`
- **PRD**: `.anws/v6/01_PRD.md`
- **ADR**: `.anws/v6/03_ADR/` (跨系统决策的唯一记录源)
- **详细设计**: `control-plane-system`、`cli-system`、`state-system`、`behavioral-guidance-system`、`observability-system`、`connector-system`、`dream-system` 已完成
- **执行主清单**: `.anws/v6/05A_TASKS.md`
- **验证计划**: `.anws/v6/05B_VERIFICATION_PLAN.md`
- **质疑报告**: `.anws/v6/07_CHALLENGE_REPORT.md`

### ADR ↔ SYSTEM_DESIGN 关系

- **ADR** 记录跨系统决策 (如 heartbeat delivery、life evidence 闭环、plugin packaging 边界)
- **SYSTEM_DESIGN** §8 Trade-offs 引用 ADR,不复制决策内容
- 修改 ADR 时,检查影响范围章节,确认引用该 ADR 的系统

---

### 技术栈决策
- 语言: TypeScript
- Runtime: Node.js + OpenClaw native plugin
- 存储: SQLite/sql.js index + Markdown/JSON workspace artifacts
- 主运行入口: OpenClaw heartbeat delivery + plugin hooks / injection

### 系统边界
- `cli-system`: `narrative` / `goal` / `dream:recent` / `connector:*` / `cycle:recent` 与 JSON-first ops surface — 详细设计见 `.anws/v6/04_SYSTEM_DESIGN/cli-system.md`
- `control-plane-system`: self-aware heartbeat、goal priority、narrative update 与 Dream trigger — 详细设计见 `.anws/v6/04_SYSTEM_DESIGN/control-plane-system.md`
- `connector-system`: dynamic manifest registration、CapabilityContractRegistry、trust policy、v5 parity — 详细设计见 `.anws/v6/04_SYSTEM_DESIGN/connector-system.md`
- `state-system`: SessionChronicle、NarrativeState、RelationshipMemory、AgentGoal、MemoryStore 与 Dream I/O lifecycle — 详细设计见 `.anws/v6/04_SYSTEM_DESIGN/state-system.md`
- `observability-system`: DreamTrace、NarrativeTrace、ConnectorInventoryAudit、RedactionManifest 与 explain read models — 详细设计见 `.anws/v6/04_SYSTEM_DESIGN/observability-system.md`
- `behavioral-guidance-system`: source-backed outreach、insight/narrative/relationship proposal 与 ModelAssistPort — 详细设计见 `.anws/v6/04_SYSTEM_DESIGN/behavioral-guidance-system.md`
- `dream-system`: 异步记忆整理、candidate/accepted/archived/partial lifecycle、budget/timeout/redaction — 详细设计见 `.anws/v6/04_SYSTEM_DESIGN/dream-system.md`

### 活跃 ADR
- ADR-001: 主技术栈、宿主运行时与验证策略选择 — 继续 TypeScript/Node/OpenClaw plugin，验证重点转向 heartbeat delivery 与 source-backed outreach
- ADR-002: 平台连接器模型与执行边界 — connector 采用 Contract + Execution Adapter，API-first，CLI/skill 仅作显式 fallback
- ADR-003: Second Nature 行为节律、Quiet 与记忆治理原则 — Quiet / reflection 必须基于 source-backed life evidence
- ADR-004: Behavioral Guidance Layer 的系统边界与实现形态 — guidance 可生成朋友式草稿，但不拥有决策或投递权
- ADR-005: Heartbeat 作为 Second Nature 的主运行入口与三层运行时边界 — heartbeat 仍是自由心跳主入口
- ADR-006: 可发布的自足 Plugin Runtime Package — 发布包必须包含自足 runtime artifact
- ADR-007: Heartbeat Delivery 与 Life Evidence 闭环 — delivery target 是主动联系成立的硬前提

### 当前任务状态
- 执行主清单: `.anws/v6/05A_TASKS.md`
- 验证计划: `.anws/v6/05B_VERIFICATION_PLAN.md`
- 总任务数: 38, Level-3: 33, INT: 5, P0: 27, P1: 11, P2: 0
- Sprint 数: 5
- **状态**: v6 主体任务已完成；S5 `Life Loop Activation` 已通过 `/change` 回流为待执行 backlog（INT-S5 未完成）
- **Challenge**: Round 8 完成，CR8-01..04 + CR9-01..03 全部 Resolved，0 Open
- **下一步**: `/forge` 从 **S5 Life Loop Activation** 起步，先执行 T1.4.1 runtime secret bootstrap，再打通 T3.3.1 real connector evidence
- **最近更新**: `2026-05-18` (Round 7 `/change`: S5 Life Loop Activation backlog)

> **历史 Wave 说明**: 下方 Wave 1-20 是 v5/早期实现历史记录，存在与 v6 新任务相同的裸任务 ID；当前可执行真相以 `.anws/v6/05A_TASKS.md` 为准，未完成 backlog 从 Wave 34 / S5 开始。

### 🌊 Wave 1 ✅ — Host & State Foundation 起步
T1.1.1, T5.1.1, T4.1.1, T4.1.2

### 🌊 Wave 2 ✅ — Host bridge & repair readiness
T1.1.2, T1.1.3, T4.1.3, T4.2.1

### 🌊 Wave 3 ✅ — Heartbeat loop & interest read models
T2.1.1, T2.1.2, T4.2.2, T5.1.2

### 🌊 Wave 4 ✅ — Candidate planner integration & connector contracts
T2.1.3, T2.2.1, T3.1.1, T3.1.2

### 🌊 Wave 5 ✅ — Outreach persistence & audit linkage
T2.3.1, T4.3.1, T5.2.1, T6.1.1

### 🌊 Wave 6 ✅ — Delivery failure closure & execution/Quiet gates
T6.2.1, T2.3.2, T4.4.1, T3.2.1

### 🌊 Wave 7 ✅ — Code review closure (CR-M1/M2/M3) + Quiet orchestration
Heartbeat `resolveAllowedIntentResult`（outreach 全链路与 Quiet `runSourceBackedQuiet`）、`evidence-guidance`（T6.1.2）、workspace Quiet 持久化与集成/单测覆盖（T2.3.3）。

### 🌊 Wave 8 ✅ — INT-S3 closure + audit hash-chain
INT-S3（`reports/int-s3-outreach-delivery-quiet.md`）：source-backed draft → delivery failed / dropped_by_host_policy → `delivery_unavailable` + `not_sent` fallback；`verifyAuditHashChain`（T5.2.2）+ lived-experience audit / explain；Quiet 空态与 S2 轻触回归集成测。

### 🌊 Wave 9 ✅ — Explain export + ops read surface + host smoke fixtures
T5.3.1（`queryExplain`、`exportAuditBundle`）；T1.2.1（`explainSurfaceSubject`、`OpsReadModelPort`、可选 `livedExperienceAuditStore` 接线）；T1.3.1（`runHostSmoke` + `heartbeat_tool_not_invoked` fixture）。INT-S4 仍为部分就绪：`reports/int-s4-release-readiness.md` 列阻塞项，待 T1.4.x / T7.1.1 与真实宿主冒烟。

### 🌊 Wave 10 ✅ — Operator fallback view
T1.2.2（`showOperatorFallback`、`loadFallbackView`、`loadOperatorFallbackRow`、CLI / `second_nature_ops` `fallback` + host-safe explicit unavailable；单测覆盖四类 reason 与 DB status 纠偏为 `not_sent`）。

### 🌊 Wave 11 ✅ — Storage mode smoke
T4.1.4（`probeNativeSqliteLoad`、`runStorageModeSmoke`、`storage_smoke` CLI、插件动态加载 runtime 报告；集成测覆盖 sql.js 语义、可选 artifact→index repair fixture）。

### 🌊 Wave 12 ✅ — Near-real connector smoke
T3.3.1（`runNearRealConnectorSmoke`：Moltbook `feed.read` + EvoMap `work.discover` 哨兵 runner、life evidence 入库、`ExecutionTelemetry` 执行尝试、EvoMap `task.claim` 带 idempotency 的 dry 结果）。

### 🌊 Wave 13 ✅ — S1/S2 integration verification reports
INT-S1（`reports/int-s1-host-state-foundation.md`）：capability probe 持久化、storage mode smoke、repair gate、packaged `storage_smoke` 与 runtime 边界测试映射。INT-S2（`reports/int-s2-evidence-rhythm-loop.md`）：heartbeat 脊柱 + decision loop 与 connector/evidence 契约测试映射。

### 🌊 Wave 14 ✅ — README truth + release gate + doc traceability
T1.4.1（`README.md` / `README.zh-CN.md`：`.anws/v5` 为契约、current / target / validation-needed）；T1.4.2（`reports/release-gate-v5-s4.md`）；T7.1.1（`reports/t7-1-1-documentation-traceability-checklist.md`）；`reports/int-s4-release-readiness.md` 阻塞表同步。未决：**INT-S4** 真实宿主冒烟与里程碑勾选。

### 🌊 Wave 15 ✅ — Plugin workspace read bridge (T1.1.4)
T1.1.4：`plugin/workspace-ops-bridge.ts` 惰性装配 `createCliRuntimeDeps` + `createOpsRouter` + `createCliCommands`；`second_nature_ops` 在 `workspaceRootResolution` 为 `env`/`tool_args` 时走与 CLI 同构读路径；CH-11-02 carrier `explain` 诚实 `ok: false`；集成测 `plugin-workspace-ops-bridge.test.ts`（根已知桥接 + carrier 基线）。**INT-S4** 仍待真实宿主证据。

### 🌊 Wave 16 ✅ — OpenClaw workspace ops norm + JSON-first acceptance (T1.1.5)
T1.1.5：README / README.zh-CN / `HEARTBEAT.md` / INT-S4 人类指南（E2E Plan、§D4/D8、模板 6–7）与 `plugin/index.ts` 头注释回流 **agent workspace** 对齐约定；根 `package.json` version **0.1.13** 与插件包一致；`openclaw.plugin.json` 描述补丁。**INT-S4** 仍待真实宿主证据；宿主验收前置检查会话工具枚举须含 `second_nature_ops`（`reports/second-nature-ops-tool-visibility-issue-2026-05-06.md`）。

### 🌊 Wave 17 ✅ — Plugin bridge VM-safe module scope (T1.1.4)
T1.1.4：`plugin/workspace-ops-bridge` 将包根（`import.meta.url`）计算移入 `openWorkspaceOpsBridge()`，避免部分宿主 VM 在 `register()` 执行前因模块顶层求值失败而导致整包未加载；`service-entry` runtime 版本串对齐 **0.1.13**。集成测 `plugin-workspace-ops-bridge`、`plugin-runtime-registration` 通过。**INT-S4** 仍须在目标宿主复验会话工具表是否出现 `second_nature_ops`。

### 🌊 Wave 18 ✅ — Status aggregate observability writeback (T1.2.3)
T1.2.3：新增 `createRuntimeDecisionRecorder`（`src/observability/services/runtime-decision-recorder.ts`），在 `createCliRuntimeDeps` 注入并经 `OpsRouterDeps.runtimeRecorder` → `HeartbeatCheckInput.runtimeRecorder` → `createWorkspaceHeartbeatRunner` 接线；workspace `heartbeat_check` 完成后写入 `sn-runtime-*` ledger + `second-nature-runtime` execution attempt。`probeOnly` / 无 `readModels` / `runtimeAvailable=false` 路径不写入，保留 host-safe carrier 语义。覆盖：集成 `tests/integration/cli/t1-2-3-status-observability-writeback.test.ts`、单测 `tests/unit/observability/runtime-decision-recorder.test.ts`；plugin bridge 透传 `runtimeRecorder`。**INT-S4** 仍待真实宿主验证。

### 🌊 Wave 19 ✅ — Field parity（Round 14 / CH-14，`/change` 2026-05-10）
**T2.2.2**：`loadSnapshotInputsForWorkspaceHeartbeat` 现调用 `loadLifeEvidenceSnapshot`，填充 `lifeEvidenceRefs`/`platformEventCount`/`workEventCount`/`lifeEvidenceEmptyReason`；`state` + `workspaceRoot` 经 `HeartbeatCheckInput` → `OpsRouterDeps` → `createCommandRouter` 完整透传。**T2.2.3**：`resolveAllowedIntentResult` 对 maintenance/通用 `intent_selected` 新增 `internal_tick`、`maintenance_no_outreach_dispatch`、`connector_action_no_attempt` 机读原因，消除 `reasons: []` 歧义。**T1.2.4**：`loadQuiet()` 新增 FS 扫描路径——合并 `.second-nature/quiet/{day}/*.json` 工件计数，修复 Quiet 写入后 read model 不反映的 canonical 断裂。**T1.2.5**：`StatusReadModel` 新增 `DeliveryPosture`（`verdict`/`reasonCode`/`source`）；`createCliReadModels` 默认注入 `AppendOnlyAuditStore`，使 `explain()` 对所有 audit-only subject 返回 `no_matching_audit_events` 而非 `lived_experience_audit_store_unavailable` 骨架；T1.2.1 测试同步更新以反映新行为。新增集成测 4 套（t2-2-2/t2-2-3/t1-2-4/t1-2-5），286 测试全绿。**INT-S4** 仍待真实宿主验证。

### 🌊 Wave 20 ✅ — Code-side gap closure（`/change` 2026-05-11，SN-CODE-01～05）
**T1.2.9** [P0]：`mapRuntimeStatus` 新增 `decision_denied → awaiting_sources` 分支，控制面拒绝不再冒充 runtime `degraded`；`RuntimeSummary.serviceStatus` 枚举扩展；集成测 t1-2-9（3 cases）。**T1.2.6**：`policy show` 非空壳——`loadPolicy()` 委托 `loadRhythmPolicySnapshot`；CLI `policy` 默认路径返回 `RhythmPolicySnapshot`；集成测 t1-2-6（3 cases）。**T1.2.7**：`audit` 最小闭环——`loadAuditSummary()` 读取 in-memory `AppendOnlyAuditStore`；`createCliRuntimeDeps` 支持 `livedExperienceAuditStore` 透传；集成测 t1-2-7（3 cases）。**T1.2.8**：`capability_probe` 接入 `createOpsRouter.dispatch`（静态 unknown 适配器 + `recordHostCapability` 持久化）、`createCliCommands`、`WORKSPACE_BRIDGE_COMMANDS`、`workspace-ops-bridge`；`OpsRouterDeps` 新增可选 `observabilityDb`；集成测 t1-2-8（4 cases）。**T3.3.2**：`near_real_smoke` 接入 `createOpsRouter.dispatch`（deps 校验 + 委托 `runNearRealConnectorSmoke`）、`createCliCommands`、`WORKSPACE_BRIDGE_COMMANDS`；集成测 t3-3-2（3 cases）。**303 测试全绿**（新增 16 个）。**INT-S4** 仍待真实宿主验证。

### 🌊 Wave 22 ✅ — v6 S1 Foundation: DynamicConnectorRegistry + SessionChronicle
T3.1.1, T4.1.1

### 🌊 Wave 23 ✅ — v6 S1 Foundation: Agent Self Layer State Schemas
T4.1.2, T4.1.3, T4.1.4, T4.1.5

### 🌊 Wave 24 ✅ — v6 S1 Connector Ecosystem: CapabilityContractRegistry + connector init + InventoryAudit
T3.1.2, T1.3.1, T5.1.3

### 🌊 Wave 25 ✅ — v6 S1 Connector Ops Surface & v5 Parity
T1.2.3, T3.2.1

### 🌊 Wave 26 ✅ — v6 S1 Control-Plane & Guidance: Goal Planning + Outreach Draft + Narrative Update
T2.1.4, T6.1.1, T2.1.5

### 🌊 Wave 27 ✅ — v6 S1/S3 Ops & Outreach: Goal Command + Outreach v6 Judgment Integration
T1.2.4 (`sn goal` set/list/accept/reject/show CLI command；`GoalReadModel` types；`AgentGoalStore` 全生命周期)。T2.3.1（Outreach v6 judgment：`build-outreach-draft-request` 接入 `narrativeState` + `relationshipMemory` → `narrativeContext`/`relationshipContext`；`outreach-draft-schema` 扩展；`dispatch-user-outreach` 加载叙事/关系上下文后起草；draft text 嵌入 focus/tone/interests summary；`RelationshipMemory` 字段名修复 `tonePreference`）。新增 16 测试；452/452 pass。

### 🌊 Wave 28 ✅ — v6 S1 Observability: NarrativeTrace Audit Layer + INT-S1 Closure
T5.1.2：`NarrativeTracePayload` 类型；`LivedExperienceAuditRecorder.recordNarrativeTrace()` 方法；`AuditEventFamily` 扩展 `"narrative.trace"`/`"dream.trace"`；`HeartbeatDeps` 扩展 `recordNarrativeTrace`；`maybeUpdateNarrativeState` 在成功 narrative state write 后调用 `recordNarrativeTrace`（全 5 个 result 分支）；groundingStatus 按 `unsupportedClaims` 与 `status` 映射 pass/degraded/blocked；trace emitter throw 不阻塞 cycle。集成测 `tests/integration/observability/heartbeat-narrative-trace.test.ts`（5 cases）。INT-S1 关门报告 `reports/int-s1-v6-foundation-connector.md`：state schemas、connector registry、trust policy、v5 parity、ConnectorInventoryAudit、CLI ops surface、回归证据汇总。457 测试（454 pass，3 pre-existing guidance review workflow fail 与 S1 无关）。

### 🌊 Wave 29 ✅ — v6 S2 Dream Engine: Dream Pipeline
T7.1.1：`src/dream/` 目录新建；`types.ts`（DreamRun/DreamOutput/DreamInputBundle/DreamTrace/DreamNarrativeUpdate/DreamRelationshipUpdate/DreamOutputValidation 与 Port 接口）；`memory-consolidator.ts`（规则去重/合并/过时清理/冲突标记）；`sampler.ts`（最近 7 天 + key events 采样）；`redaction-gate.ts`（credential/PII 模式脱敏 + sensitivity flag 阻断）；`output-validator.ts`（schema/source grounding/sensitivity/unsupported claim 验证）；`dream-engine.ts`（pipeline 编排：load→consolidate→sample→redact→budget gate→optional model→merge→validate→write output + trace）；`index.ts` 统一导出。集成测 `tests/integration/dream/t7-1-1-dream-pipeline.test.ts`（11 cases：rules-only candidate、budget exceeded fallback、no inputs skipped、model timeout partial、validation failure archived、input immutability、consolidator dedupe、sampler drop、redaction block、validator ungrounded source）。Build 通过，新增 11 测试全部 green。

### 🌊 Wave 30 ✅ — v6 S2 Dream Engine: Scheduler + Insight + Narrative + Relationship
T7.1.2：`dream-scheduler.ts`（`scheduleDream` 异步触发不阻塞 heartbeat；`DreamRunLockPort` + in-memory fallback；cron/evidence threshold/manual `shouldTrigger` 策略；并发同 window 返回 skipped）。T7.1.3：`insight-extractor.ts`（`extractInsights` rules-based：recurring word pattern、learning keyword、conflict/failure keyword、high-activity day observation；每个 insight 含 type/summary/sourceRefs/confidence）。T7.1.4：`narrative-update-proposal.ts`（`draftNarrativeFromDream` 从 evidence+insights 生成 focus/progress/nextIntent；conflict 存在时 nextIntent=resolve；低 confidence 降级；无 evidence 阻断）。T7.1.5：`relationship-update-proposal.ts`（`draftRelationshipFromDream` 从 chronicle 推断 tone/timing/topic；positive/negative/neutral tone 投票；busy/responsive/normal timing；work/personal/tech/social topic；单样本 unsupported claim 防过度推断；无 reply 返回 cooldown）。测试覆盖：scheduler 8 cases、insight 6 cases、narrative 5 cases、relationship 6 cases，全部 green。

### 🌊 Wave 31 ✅ — v6 T5.1.1 DreamTrace + T1.2.2 dream:recent + T1.2.5 cycle:recent
T5.1.1：`LivedExperienceAuditRecorder.recordDreamTrace()` 写入 `dream.trace` family envelope；`OpsRouter.dispatch` 改为 async 以支持 await；`CliReadModels` 接口新增 `loadDreamRecent` / `loadCycleRecent` 并从 `types.ts` 导入 `DreamRecentReadModel` / `CycleRecentReadModel`；`createdAt` 从 envelope 元数据读取而非 payload（修复 undefined 问题）。T1.2.2：`dream:recent` CLI 命令 + read model 完整闭环，支持 limit、降序排列、lifecycleStatus 推断（completed/partial）。T1.2.5：`cycle:recent` read model 按小时 bucket 聚合 heartbeat.decision / narrative.trace / dream.trace / delivery / connector.attempt，dimensions 数组标记维度存在性，`connector.attempt` 须带 `previousHash` 以满足 hash-chain 约束。测试新增 13 cases（T5.1.1×5、T1.2.2×4、T1.2.5×4），全部 green。05A_TASKS.md 勾选 T5.1.1、T1.2.2、T1.2.5。

### 🌊 Wave 32 ✅ — v6 T1.2.1 narrative command + T1.2.6 v6 status aggregate
T1.2.1：`NarrativeReadModel` 类型新增到 `types.ts`（含 `groundingStatus: pass|degraded|blocked`、`status: nothing_yet` 哨兵）；`CliReadModels` 接口新增 `loadNarrative(narrativeId?)` 并在工厂中实现（`createNarrativeStateStore` → `loadNarrativeState` → 推导 groundingStatus：confidence≥0.7+active=pass，confidence≥0.4=degraded，否则/awaiting_sources=blocked；无数据返回 nothing_yet 诚实空态）；`narrative` CLI 命令注册到 `commands/index.ts`。T1.2.6：`StatusV6ReadModel extends StatusReadModel` 新增三个 v6 section：`narrative`（focus/groundingStatus/nextIntent/sourceRefCount）、`dream`（has_runs|nothing_yet）、`cycles`（has_cycles|nothing_yet，dimensions 集合）；`loadV6Status` 并行读取 narrativeState + 同步过滤 auditStore；`status:v6` CLI 命令注册。测试新增 8 cases（T1.2.1×4、T1.2.6×4），全部 green；全套 514 tests 无回归。05A_TASKS.md 勾选 T1.2.1、T1.2.6。

### 🌊 Wave 33 ✅ — INT-S2 + INT-S3 + INT-S4 v6 milestone reports
INT-S2（`reports/int-s2-v6-dream-engine.md`）：Dream pipeline（T7.1.1-T7.1.5）、DreamTrace（T5.1.1）、dream:recent（T1.2.2）验证报告；覆盖 candidate→accepted→archived 生命周期、scheduler lock、insight/narrative/relationship proposal、DreamTrace envelope；8 GWT 条目全部 pass。INT-S3（`reports/int-s3-v6-agent-self.md`）：accepted goal priority（T2.1.4）、narrative update + NarrativeTrace（T2.1.5/T5.1.2）、source-backed outreach judgment（T2.3.1/T6.1.1）验证报告；7 GWT 条目全部 pass。INT-S4（`reports/int-s4-v6-ops-host-readiness.md`）：v6 ops surface（T1.2.1-T1.2.6）、host-safe carrier/full runtime 语义、plugin bridge bridge、DreamTrace+NarrativeTrace 审计、514 全量回归验证报告；11 GWT 条目全部 pass。同步勾选 05A_TASKS.md：INT-S2、INT-S3、INT-S4、T1.2.4。

### 🌊 Wave 34 ✅ — v6 S5 Life Loop Activation backlog
Round 7 `/change` 新增 S5：T1.4.1 RuntimeSecretBootstrap、T3.3.1 real connector evidence、T2.4.1 platform-specific heartbeat intent、T2.4.2 source-backed outreach delivery/fallback、T4.2.1 owner reply → RelationshipMemory feedback、T1.4.2 activation UX cleanup、INT-S5 关门报告。目标是让 v6 从“工程面完成”进入“真实感知→自主判断→owner 可见→关系反馈→Dream 有食物”的闭环。

### 🌊 Wave 35 ✅ — v6 S5 Life Loop Activation: T1.4.1 + T1.4.2
**T1.4.1**：`probeCredentialHealth` 函数（`src/storage/services/credential-vault.ts`）检测 key 缺失/错误/有效三种状态，返回 `missing_runtime_secret` / `credential_recovery_required` / `ok` 诊断码；`CredentialReadModel` / `CredentialSummary` 扩展 `decrypt_failed` 状态与 `keyHealth` 字段；`loadCredential` 与 `buildBaseStatus` 均尝试解密并诚实报告诊断，不泄漏 raw secret；集成测 4 cases（缺 key、错 key、有效 key、status aggregate）。**T1.4.2**：`goal set` 支持 `criteria` 作为 `completionCriteria` alias（`GoalCommandInput` 新增 `criteria` 字段，`ops-router.ts` goal dispatch 透传）；`explain relationship:{id}` 通过 `resolveExplainSubject` → `toExplainQuery` → `explain` 读取 `RelationshipMemoryStore` 返回 redacted summary（tone/reply/topics）或诚实 `nothing_yet`；`ExplainSubjectKind` 扩展 `"relationship"`；集成测 6 cases（criteria alias×3、relationship explain×3）。195 测试全绿，无回归。05A_TASKS.md 勾选 T1.4.1、T1.4.2。

### 🌊 Wave 36 ✅ — v6 S5 Life Loop Activation: T3.3.1 real connector evidence
**T3.3.1**：在 `resolveAllowedIntentResult`（`src/core/second-nature/heartbeat/heartbeat-loop.ts`）的 `connector_action` 分支中，connector 执行成功后调用 `mapLifeEvidence`（`src/connectors/base/map-life-evidence.ts`）将 `ConnectorResult` 映射为 `LifeEvidenceCandidate`，再通过 `appendLifeEvidence`（`src/storage/life-evidence/append-life-evidence.ts`）写入 SQLite index + JSON artifact；`HeartbeatDeps` 扩展 `state?: StateDatabase` 与 `workspaceRoot?: string`；`workspace-heartbeat-runner.ts` 将 `state` 与 `workspaceRoot` 注入 `runHeartbeatCycle` deps。失败或空结果时不虚构证据，仅由 connector policy 层记录尝试审计。集成测 4 cases（A: success+sourceRefs→artifact+index、B: empty→no fabrication、C: failure→no fabrication、D: missing state/workspaceRoot→no crash）。199 测试全绿，无回归。05A_TASKS.md 勾选 T3.3.1。

<!-- AUTO:END -->

---

## Manual Handoff — v6 Design System

- `dream-system`: v6 异步记忆整理引擎设计已落盘，见 `.anws/v6/04_SYSTEM_DESIGN/dream-system.md`；实现层补充见 `.anws/v6/04_SYSTEM_DESIGN/dream-system.detail.md`；调研见 `.anws/v6/04_SYSTEM_DESIGN/_research/dream-system-research.md`。
- `connector-system`: v6 动态 connector 生态设计已落盘，见 `.anws/v6/04_SYSTEM_DESIGN/connector-system.md`；实现层补充见 `.anws/v6/04_SYSTEM_DESIGN/connector-system.detail.md`；调研见 `.anws/v6/04_SYSTEM_DESIGN/_research/connector-system-research.md`。
- `state-system`: v6 Agent Self Layer 与 Dream I/O 状态真相源设计已落盘，见 `.anws/v6/04_SYSTEM_DESIGN/state-system.md`；实现层补充见 `.anws/v6/04_SYSTEM_DESIGN/state-system.detail.md`；调研见 `.anws/v6/04_SYSTEM_DESIGN/_research/state-system-research.md`。
- `observability-system`: v6 DreamTrace、NarrativeTrace 与 connector inventory 审计设计已落盘，见 `.anws/v6/04_SYSTEM_DESIGN/observability-system.md`；实现层补充见 `.anws/v6/04_SYSTEM_DESIGN/observability-system.detail.md`；调研见 `.anws/v6/04_SYSTEM_DESIGN/_research/observability-system-research.md`。
- `control-plane-system`: v6 self-aware heartbeat、goal priority、narrative update 与 Dream trigger 设计已落盘，见 `.anws/v6/04_SYSTEM_DESIGN/control-plane-system.md`；调研见 `.anws/v6/04_SYSTEM_DESIGN/_research/control-plane-system-research.md`。
- `behavioral-guidance-system`: v6 source-backed outreach、insight/narrative/relationship proposal 与 ModelAssistPort 设计已落盘，见 `.anws/v6/04_SYSTEM_DESIGN/behavioral-guidance-system.md`；调研见 `.anws/v6/04_SYSTEM_DESIGN/_research/behavioral-guidance-system-research.md`。
- `cli-system`: v6 `narrative` / `goal` / `dream:recent` / `connector:*` / `cycle:recent` 与 JSON-first ops surface 设计已落盘，见 `.anws/v6/04_SYSTEM_DESIGN/cli-system.md`；调研见 `.anws/v6/04_SYSTEM_DESIGN/_research/cli-system-research.md`。
- 本轮 `/challenge` 与 `/change` 回写见 `.anws/v6/07_CHALLENGE_REPORT.md` 的 Round 2～6；DR3-01 已回流到 `.anws/v6/05A_TASKS.md` 的 T5.1.2 `NarrativeTrace` 与 T5.1.3 `ConnectorInventoryAudit`，DR6-01 / TR6-01 已回流到 T1.2.4～T1.2.6 与 `.anws/v6/05B_VERIFICATION_PLAN.md`。

---

> **状态自检**: 准备好了？提醒用户运行 `/quickstart` 开始吧。
