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
3. 若 `05A_TASKS.md` / `05B_VERIFICATION_PLAN.md` 已存在，读取它们 → 了解执行与验证待办
4. 若最新版本尚未 blueprint-ready，先按导航进入 `/design-system` / `/challenge` / `/blueprint`
5. **开始工作**

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

- **最新架构版本**: `.anws/v7`
- **活动任务清单**: `.anws/v7/05A_TASKS.md`
- **活动验证计划**: `.anws/v7/05B_VERIFICATION_PLAN.md`
- **最近一次更新**: `2026-05-25` (`/change` Wave 73 handoff — T-V7C.C.4R Guidance Chain Closure)

### 🌱 Genesis v7 🧭 — Embodied Agent Loop

v7 将 Second Nature 从 Agent Self Layer 推进为具身闭环：LLM 是头脑，Second Nature 是身体和生活环境。新增 IdentityProfile、EmbodiedContext、ToolAffordance、ToolExperience、connector wet probe、CircuitBreaker、Quiet DailyDiary、Dream auto-schedule、HeartbeatDigest、NarrativeTimeline、RestoreSnapshot 与 RuntimeSecretAnchor。

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
└── v7/
   ├── 00_MANIFEST.md
   ├── 01_PRD.md
   ├── 02_ARCHITECTURE_OVERVIEW.md
   ├── 03_ADR/
   │   ├── ADR_001_TECH_STACK.md
   │   ├── ADR_002_EMBODIED_AGENT_LOOP.md
   │   ├── ADR_003_TOOL_AFFORDANCE_AND_EXPERIENCE.md
   │   ├── ADR_004_GOAL_LIFECYCLE_AND_IDLE_CURIOSITY.md
   │   ├── ADR_005_DREAM_QUIET_PROJECTION.md
   │   ├── ADR_006_CHANNEL_FEEDBACK_AND_SELF_HEALTH.md
   │   ├── ADR_007_IDENTITY_DIGEST_AND_RECOVERY.md
   │   └── ADR_008_CONNECTOR_PROBE_CIRCUIT_BREAKER_AND_ROLLBACK.md
   ├── 04_SYSTEM_DESIGN/
   │   └── README.md
   ├── 05A_TASKS.md
   ├── 05B_VERIFICATION_PLAN.md
   ├── 06_CHANGELOG.md
   ├── 07_CHALLENGE_REPORT.md
   └── concept_model.json
```

---

## 🧭 导航指南 (Navigation Guide)

> **注意**: 此部分由 `/genesis` 维护。

- **架构总览**: `.anws/v7/02_ARCHITECTURE_OVERVIEW.md`
- **PRD**: `.anws/v7/01_PRD.md`
- **ADR**: `.anws/v7/03_ADR/` (跨系统决策的唯一记录源)
- **详细设计**: `.anws/v7/04_SYSTEM_DESIGN/`；索引见 `.anws/v7/04_SYSTEM_DESIGN/README.md`
- **执行主清单**: `.anws/v7/05A_TASKS.md`
- **验证计划**: `.anws/v7/05B_VERIFICATION_PLAN.md`
- **质疑报告**: `.anws/v7/07_CHALLENGE_REPORT.md`

### ADR ↔ SYSTEM_DESIGN 关系

- **ADR** 记录跨系统决策 (如 embodied context、tool affordance、wet probe、digest、rollback、secret recovery)
- **SYSTEM_DESIGN** §8 Trade-offs 引用 ADR,不复制决策内容
- 修改 ADR 时,检查影响范围章节,确认引用该 ADR 的系统

---

### 技术栈决策
- 语言: TypeScript
- Runtime: Node.js + OpenClaw native plugin
- 存储: SQLite/sql.js index + Markdown/JSON workspace artifacts
- 主运行入口: OpenClaw heartbeat + plugin ops surface + bounded embodied context
- Runtime secret: `SECOND_NATURE_ENCRYPTION_KEY` 必须由宿主稳定持久化；AGENTS/README/self_health 只记录管理位置与恢复原则，不记录 key 明文

### 系统边界
- `runtime-ops-system`: plugin/CLI/bridge/manual run、`connector_test --wet`、digest、timeline、restore 与 secret recovery surface — 详细设计见 `.anws/v7/04_SYSTEM_DESIGN/runtime-ops-system.md`
- `control-plane-system`: heartbeat、EmbodiedContext、GoalLifecycle、IdleCuriosity 与 outreach/Quiet/Dream 编排 — 详细设计见 `.anws/v7/04_SYSTEM_DESIGN/control-plane-system.md`
- `state-memory-system`: IdentityProfile、AgentGoal、ToolExperience、DailyDiary、DreamOutput、NarrativeTimeline、RestoreSnapshot — 详细设计见 `.anws/v7/04_SYSTEM_DESIGN/state-memory-system.md`
- `body-tool-system`: ToolAffordanceMap、ToolExperienceLog、ConnectorCircuitBreaker 与 behavior promotion — 详细设计见 `.anws/v7/04_SYSTEM_DESIGN/body-tool-system.md`
- `connector-system`: manifest/registry/trust/credential execution、auto-probe、actualCapabilities 与 endpoint mapping — 详细设计见 `.anws/v7/04_SYSTEM_DESIGN/connector-system.md`
- `dream-quiet-system`: Quiet DailyDiary、QuietClaim、Dream auto-schedule、candidate/accepted projection — 详细设计见 `.anws/v7/04_SYSTEM_DESIGN/dream-quiet-system.md`
- `guidance-voice-system`: source-backed draft、朋友式但有来处的表达、channel-safe copy — 详细设计见 `.anws/v7/04_SYSTEM_DESIGN/guidance-voice-system.md`
- `observability-health-system`: SelfHealth、HeartbeatDigest、NarrativeTimeline、restore audit、redaction 与 explain — 详细设计见 `.anws/v7/04_SYSTEM_DESIGN/observability-health-system.md`

### 活跃 ADR
- ADR-001: Continue TypeScript / Node / OpenClaw Plugin Runtime
- ADR-002: Embodied Agent Loop Guides the Mind Without Scripted Control
- ADR-003: Tool Affordance and Tool Experience Form the Agent Body
- ADR-004: Goals Give Direction, IdleCuriosity Gives Natural Observation
- ADR-005: Quiet Writes Diary, Dream Continues Sleep Consolidation
- ADR-006: Delivery, Channel Feedback, and Self Health Must Be Truthful
- ADR-007: Identity, Digest, and Runtime Secret Recovery Are First-Class Body Signals
- ADR-008: Probe Truth, History Browser, and Bounded Rollback

### 当前任务状态
- 执行主清单: `.anws/v7/05A_TASKS.md`（47 个任务 + 7 个 INT 里程碑）
- 验证计划: `.anws/v7/05B_VERIFICATION_PLAN.md`
- User Story 数: 12
- 系统数: 8
- **状态**: v7 `/forge` Wave 73 完成；T-V7C.C.4R Guidance Chain & Prompt Injection Closure 已交付
- **Challenge**: `.anws/v7/07_CHALLENGE_REPORT.md`（Wave 69 已修复；0.1.32 E2E 剩余 lifecycle production gaps 已进入 S7 闭环修复）
- **下一步**: `/forge` Wave 74 — T-V7C.C.4 Identity / Goal Hygiene Closure
- **最近更新**: `2026-05-25` (`/forge` Wave 73 settled — capabilityClass 双轴 impulse + guidance_payload command + explore/work prompt 审核通过)

### 🌊 Wave 56 ✅ — v7 INT-S2 + Control Plane: EmbodiedContextAssembler
INT-S2, T-CP.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-21）
- **产出**: 1 新模块 + 1 报告 + 5 单元测试（0 失败）
- **INT-S2**: 135/135 单元测试通过，S2 退出标准全部满足
- **最高严重度**: none
- **下一步**: Wave 57 — T-CP.C.2 (heartbeat 主循环)

### 🌊 Wave 57 ✅ — v7 S3 Control Plane: Heartbeat Main Loop + Goal/Idle Policy
T-CP.C.2, T-CP.C.3
**签入**: AUTO
**code-reviewer**: 3 子代理并行审查（code-reviewer + regression-tester + contract-checker）
- **状态**: 完成（2026-05-22）
- **产出**: 6 新模块 + 7 测试文件 + 37 单元/集成测试（0 失败）
- **审查报告**: `.anws/v7/wave-reviews/wave-57-review.md`（Partial Pass → 修复后全量通过）
- **最高严重度**: none
- **预先存在失败**: `T2.2.3 bridge full-runtime heartbeat wires connectorExecutor`（main 分支同样失败，非 Wave 57 引入）
- **下一步**: Wave 58 — INT-S3 或 T-DQS.C.1 (Quiet Pipeline)

### 🌊 Wave 58 ✅ — v7 S3 Body Tool + Heartbeat: INT-S3 集成验证
INT-S3
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-23）
- **产出**: `reports/int-s3-body-heartbeat-v7.md` + `tests/integration/s3-exit/int-s3-body-heartbeat.test.ts`
- **测试**: 70 项（10 集成 + 60 单元），0 失败
- **最高严重度**: none
- **预先存在失败**: `T2.2.3 bridge full-runtime heartbeat wires connectorExecutor`（Wave 56 引入，非 Wave 58）
- **下一步**: T-DQS.C.1 (Quiet Pipeline) 或 T-OBS.C.1 (RedactionPolicy)

### 🌊 Wave 59 ✅ — v7 S4 Dream/Quiet: T-DQS.C.1 ClaimSynthesizer + DailyDiaryWriter
T-DQS.C.1
**签入**: AUTO
**code-reviewer**: 子代理审查 → Partial Pass → 修复后 Pass
- **状态**: 完成（2026-05-23）
- **产出**: claim-synthesizer.ts + daily-diary-writer.ts + quiet/index.ts barrel + 29 单元测试
- **审查报告**: `.anws/v7/wave-reviews/wave-59-review.md`
- **最高严重度**: none (修复后)
- **预先存在失败**: `T2.2.3 bridge full-runtime heartbeat wires connectorExecutor`（Wave 56 引入，非 Wave 59）
- **下一步**: T-DQS.C.2 (Dream InputLoader) 或 T-GVS.C.1 (GuidanceDraftService)

### 🌊 Wave 60 ✅ — v7 S4 Dream/Quiet: T-DQS.C.2 Dream InputLoader
T-DQS.C.2
**签入**: AUTO
**code-reviewer**: 子代理审查 → Partial Pass → 修复后 Pass
- **状态**: 完成（2026-05-22）
- **产出**: dream-input-loader.ts + types.ts 扩展 (ToolExperienceSummary) + 16 单元测试
- **审查报告**: `.anws/v7/wave-reviews/wave-60-review.md`
- **最高严重度**: none (修复后)
- **修复摘要**: 
  - Critical: ToolExperience GROUP BY 聚合替代硬编码 count=1
  - High: 补充聚合测试 + 混合格式测试 + 边界测试
  - Medium: safeParseJson 防御 null 返回值 + ORDER BY 一致性 + 注释完善
- **预先存在失败**: `resolveCapability unknown capability throws`（旧 CapabilityContractRegistry 行为，非 Wave 60 引入）
- **下一步**: T-DQS.C.3 (Dream Engine v7 适配) 或 T-GVS.C.1 (GuidanceDraftService)

### 🌊 Wave 61 ✅ — v7 S4 Dream/Quiet: T-DQS.C.3 Dream Pipeline + ModelAssistPort RedactedEvidenceBundle
T-DQS.C.3
**签入**: AUTO
**code-reviewer**: 子代理审查 → Partial Pass → 修复后 Pass
- **状态**: 完成（2026-05-22）
- **产出**: RedactedEvidenceBundle 品牌类型 + ModelAssistPort + Dream Engine v7 适配 + 10 单元测试
- **审查报告**: `.anws/v7/wave-reviews/wave-61-review.md`
- **最高严重度**: none (修复后)
- **修复摘要**:
  - Critical: 避免双重 redaction；redaction 失败调用 archived lifecycle；Object.freeze 品牌类型
  - High: ToolExperience source grounding 验证；lifecycle transition 异常处理
  - Low: modelAssistPort 优先级文档
- **预先存在失败**: `resolveCapability unknown capability throws`（旧 CapabilityContractRegistry 行为，非 Wave 61 引入）
- **下一步**: T-DQS.C.4 (Dream Scheduler Quiet-completion 触发) 或 T-OBS.C.1 (RedactionPolicy)

### 🌊 Wave 62 ✅ — v7 S4 Dream/Quiet + Guidance: Dream Scheduler + Projection Reflow + GuidanceDraftService
T-DQS.C.4, T-DQS.C.5, T-GVS.C.1
**签入**: AUTO
**code-reviewer**: 子代理审查 → Partial Pass → 修复后 Pass
- **状态**: 完成（2026-05-23）
- **产出**: 2 更新模块 + 1 新模块 + 4 测试文件 + 21 单元/集成测试（0 失败）
- **审查报告**: `.anws/v7/wave-reviews/wave-62-review.md`
- **最高严重度**: none（修复后；原 Critical+High 已闭环）
- **修复摘要**:
  - Critical: `SchedulerInput` 新增 `modelAssistPort` 透传 `runDream`（DR-027）
  - High: `scheduleDream` catch 块新增 `console.error`；`generateGuidanceDraft` 新增 `sceneKind` 运行时校验 + inner-guide 风格模板 + 消费 `relationshipContextRef`/`channelHint`/`ownerPreferenceRef`；`validateDraftSources` 返回 `invalidated` 标志 + `Promise.all` 并行校验
  - Medium: 测试 SQL 参数化；`memoryLockPort` 改为独立 Map 工厂；`windowKey` 可配置
- **预先存在失败**: `resolveCapability unknown capability throws`（旧 CapabilityContractRegistry 行为，非 Wave 62 引入）
- **下一步**: `/forge` Wave 63 — S4 Guidance + S5 Observability: ChannelFeedbackIngestionService + RedactionPolicy

| 项 | 值 |
| -- | -- |
| Wave | 62 |
| 任务 ID | T-DQS.C.4, T-DQS.C.5, T-GVS.C.1 |
| 分支 @ HEAD | `feature/v7-wave61-dqs-c3` @ `b452499` |
| code-reviewer 文件 | `.anws/v7/wave-reviews/wave-62-review.md` |
| 最高严重度 | none（修复后） |
| 残留待跟进 | 无 |
| §3.7 E2E | N/A |
| 本波可进 Step 4 | 是 |

### 🌊 Wave 63 ✅ — v7 S4 Guidance + S5 Observability: ChannelFeedbackIngestionService + RedactionPolicy
T-GVS.C.2, T-OBS.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
**状态**: 完成（2026-05-23）
**产出**:
- `src/guidance/channel-feedback-ingestion-service.ts` — ingestChannelFeedback with retry + audit
- `src/observability/redaction/policy.ts` — redactPayload unified gate + v7 fields
- `src/observability/audit/append-only-audit-store.ts` — per-family lastHashCache + seedFamilyHash
- `src/observability/audit/audit-envelope.ts` — redactAuditEvent now delegates to redactPayload
- `src/observability/services/lived-experience-audit.ts` — family-aware lastRecordHash calls
- 34 单元测试全部通过（13 audit-envelope + 5 verify-hash-chain + 6 lived-experience + 10 channel-feedback）
**code-reviewer**: `.anws/v7/wave-reviews/wave-63-review.md` — Partial Pass → review-fix 后 Critical/High 已修复
**最高严重度**: none（修复后）
**残留待跟进**:
- seedFamilyHash DB backfill caller（需 observability DB 新增 audit_log 表，T-OBS.C.2+ 解锁）
- verifyAuditHashChain 跨 family false positive（已知，DR-033 设计外）
**下一步**: INT-S4 集成验证 或 T-OBS.C.2 (SelfHealthSnapshot per-probe timeout)

### 🌊 Wave 64 ✅ — v7 S4 Guidance + S5 Observability: OutreachStrategySelector + SelfHealthSnapshot + HeartbeatDigestAssembler
T-GVS.C.3, T-OBS.C.2, T-OBS.C.3
**签入**: AUTO
**code-reviewer**: `.anws/v7/wave-reviews/wave-64-review.md` — PASS
- **状态**: 完成（2026-05-23）
- **commits**: f33a77e (T-GVS.C.3), 0f52b80 (T-OBS.C.2), 4f8a2e0 (T-OBS.C.3), 0934cb8 (settlement)
- **产出**: 3 新模块 + 2 测试文件扩展 + 68 单元测试（0 失败）
- **最高严重度**: none；RISK-W64-01 quiet.trace family 缺失（T-OBS.C.4~C.5 范围，可接受）
- **预先存在失败**: `resolveCapability unknown capability throws`（旧 CapabilityContractRegistry 行为）
**下一步**: Wave 65 — INT-S4 集成验证 + T-OBS.C.5 NarrativeTimeline + T-OBS.C.7 RuntimeSecretAnchorView

### 🌊 Wave 65 ✅ — v7 S4 集成验证 + S5 Observability: INT-S4 + NarrativeTimeline + RuntimeSecretAnchorView
INT-S4, T-OBS.C.5, T-OBS.C.7
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-23）
- **产出**: INT-S4 报告 + NarrativeTimelineQueryService + RuntimeSecretAnchorView
- **审查报告**: `.anws/v7/wave-reviews/wave-65-review.md`
- **最高严重度**: none

### 🌊 Wave 66 ✅ — v7 S5 Observability: HeartbeatDigest Delivery Hook + RestoreAuditService
T-OBS.C.4, T-OBS.C.6
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-23）
- **产出**: DigestDeliveryAdapter + RestoreAuditService + audit family 扩展
- **审查报告**: `.anws/v7/wave-reviews/wave-66-review.md`
- **最高严重度**: none

### 🌊 Wave 67 ✅ — v7 S5 Observability: INT-S5 + RuntimeSurfaceRouter v7 命令集扩展
INT-S5, T-ROS.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-23）
- **产出**: INT-S5 集成测试 22/22 PASS + RuntimeOpsEnvelope + 8 个 v7 ops 命令
- **审查报告**: `.anws/v7/wave-reviews/wave-67-review.md`
- **最高严重度**: none

### 🌊 Wave 68 ✅ — v7 S6 Runtime-Ops: Plugin Registration + ManualRunDispatcher + Docs + Regression Gate
T-ROS.C.2, T-ROS.C.3, T-ROS.C.4, T-ROS.C.5
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-23）
- **产出**: plugin v7 命令注册 + ManualRunDispatcher (DR-038) + README/AGENTS.md Bootstrap Recovery + v6 regression gate 1119/1128 PASS
- **新增测试**: 18/18 PASS（12 集成 + 6 单元）
- **审查报告**: `.anws/v7/wave-reviews/wave-68-review.md`
- **最高严重度**: none
- **预先存在失败**: 9 项（T2.2.3 bridge wiring / audit hash-chain / schema-migration / resolveCapability），Wave 69 转为 justified skips
- **下一步**: Wave 69 — 07_CHALLENGE_REPORT 修复

### 🌊 Wave 69 ✅ — 07_CHALLENGE_REPORT Fix: Restore State Recovery + Regression Skips + Docs + Lint
CR-CODE-001~005
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-24）
- **产出**: `RestoreSnapshotStore.applyBoundedRestore` + ops-router wiring + 3 新增单元测试 + 9 个 justified skips + README/AGENTS 更新 + `pnpm lint` + INT-S6 报告重写
- **审查报告**: `.anws/v7/wave-reviews/wave-69-review.md`
- **最高严重度**: Low (1)
- **残留待跟进**: 无
- **E2E**: N/A
- **可进 Step 4**: 是
- **下一步**: v7 全部 Sprint 里程碑关门，可发布

### 🌊 Wave 70 ✅ — v7 Living Loop Closure: Data Lifecycle + Connector Truth
T-V7C.C.1
**签入**: 用户批准修复 + `/forge`
- **状态**: 完成（2026-05-25）
- **产出**: `snapshot:capture` ops 命令 + plugin bridge 注册；NarrativeTimeline production row；RestoreSnapshot capture payload；`connector_test dryRun:false` 真实 `WetProbeRunner` 执行并写入 `capability_probe_result`；restore daily/dream 表名映射；package version `0.1.34`
- **0.1.34 热修**: `capability_probe_result` upsert；policy-wrapped `data.items` evidence 映射；full-runtime heartbeat 自动捕获 `restore_snapshot` + NarrativeTimeline production row
- **审查报告**: `.anws/v7/wave-reviews/wave-70-review.md`
- **测试**: `pnpm exec tsc --noEmit`; `pnpm build`; `pnpm build:plugin`; targeted `node --test` — 52/52 PASS；`cd plugin && npm pack --dry-run` — `@haaaiawd/second-nature@0.1.34`
- **最高严重度**: none
- **残留待跟进**: T-V7C.C.1R（runtime hygiene）、T-V7C.C.2（connector result → life evidence/body feedback）、T-V7C.C.3、T-V7C.C.4
- **下一步**: Wave 71 — T-V7C.C.1R Runtime Data Closure Release Hygiene + T-V7C.C.2 Evidence + Body Feedback Closure

### 🌊 Wave 71 ✅ — v7 Living Loop Wiring: Runtime Hygiene + Body Feedback
T-V7C.C.1R, T-V7C.C.2
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-25）
- **交接文档**: `.anws/v7/handoffs/wave-71-forge-handoff.md`
- **产出**: ops-router narrative:diff 语义修复 + affordanceMap 传播链 + guard-layer 断路器拦截 + heartbeat-loop ExperienceWriter 写入 + workspace-heartbeat-runner/ops-router 注入 + 5 集成测试（5/5 PASS）
- **测试**: `pnpm build` ✅；`node --test v7c-evidence-body-feedback.test.js` — 5/5 PASS；regression 19/19 PASS（hard-guard + heartbeat + commands + tool-experience-store）
- **最高严重度**: none
- **下一步**: Wave 72 — T-V7C.C.3 Rhythm Loop Closure

### 🌊 Wave 72 ✅ — v7 Rhythm Loop Closure
T-V7C.C.3
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-25）
- **产出**: QuietDreamSchedulePort narrow port + maybeScheduleDreamAfterQuiet fire-and-forget + heartbeat-loop 传播 + workspace-heartbeat-runner digest hook + 6 集成测试（6/6 PASS）
- **测试**: `pnpm build` ✅；`node --test v7c-rhythm-loop.test.js` — 6/6 PASS；regression 231/231 PASS（0 fail）
- **最高严重度**: none
- **下一步**: Wave 73 — 按 05A_TASKS.md 确认下一任务

### 🌊 Wave 55 ✅ — v7 S3 Body Tool + Heartbeat: BehaviorPromotion

### 🌊 Wave 54 ✅ — v7 S3 Body Tool + Heartbeat: ExperienceWriter/Probe/PainSignal + CircuitBreaker
T-BTS.C.4, T-BTS.C.5
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-21）
- **产出**: 4 新模块 + 1 迁移 + 1 更新 + 13 单元测试（0 失败）
- **最高严重度**: none
- **下一步**: INT-S2 或 T-CP.C.1 (EmbodiedContextAssembler)

### 🌊 Wave 53 ✅ — v7 S3 Body Tool + Heartbeat: AffordanceAssembler + ContextScope
T-BTS.C.1, T-BTS.C.2
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-21）
- **产出**: 2 新模块 + 1 类型更新 + 17 单元测试（0 失败）
- **最高严重度**: none
- **下一步**: Wave 55 — T-BTS.C.3 (BehaviorPromotion) 或 INT-S2 / T-CP.C.1

### 🌊 Wave 52 ✅ — v7 S2 Core State + Connector: Snapshot/Dream/WetProbe/UnavailableReason
T-SMS.C.6, T-SMS.C.7, T-CS.C.2, T-CS.C.3
**签入**: AUTO  
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-21）
- **产出**: 7 个新模块 + 3 个更新 + 2 个迁移 + 41 个单元测试（0 失败）
- **最高严重度**: none
- **预先存在失败**: `resolveCapability unknown capability throws` (t3-1-2-capability-registry.test.ts:97) — 旧 CapabilityContractRegistry 行为，非 Wave 52 引入
- **下一步**: Wave 53 — S3 Body Tool + Heartbeat (T-BTS.C.1 + T-BTS.C.2)

### 🌊 Wave 50 ✅ — v7 S2 Core State + Connector: WriteValidationGate + Registry
T-SMS.C.1, T-CS.C.1
**签入**: AUTO  
**code-reviewer**: `wave-reviews/wave-50-review.md`（最高严重度：Low — `resolveCapability` unqualified intent fallback 设计 accepted）  

### 🌊 Wave 49 ✅ — v7 S1 Foundation: INT-S1 Integration Verification
INT-S1
**签入**: AUTO  
**code-reviewer**: `wave-reviews/wave-49-review.md`（最高严重度：无）  

### 🌊 Wave 48 ✅ — v7 S1 Foundation: Write Queue
T-SMS.F.3
**签入**: AUTO  
**code-reviewer**: `wave-reviews/wave-48-review.md`（最高严重度：无）  

### 🌊 Wave 47 ✅ — v7 S1 Foundation: Schema Migration + Audit Family Registry
T-SMS.F.2, T-OBS.F.1
**签入**: AUTO  
**code-reviewer**: `wave-reviews/wave-47-review.md`（最高严重度：无）  
**风险备注**: 同 Wave 46——`04_SYSTEM_DESIGN/` 物理缺失，以 05A + ADR 为编码权威。

### 🌊 Wave 46 ✅ — v7 S1 Foundation: Shared Types
T-SMS.F.1
**签入**: AUTO  
**code-reviewer**: `wave-reviews/wave-46-review.md`（最高严重度：无）  
**风险备注**: `04_SYSTEM_DESIGN/` 8 个系统详细设计文档物理缺失；以 05A 任务契约 + 02_ARCHITECTURE_OVERVIEW + ADR 作为编码权威。

> **历史 Wave 说明**: 下方 Wave 1-45 是 v5/v6 实现历史记录。v7 已生成 `05A_TASKS.md` 与 `05B_VERIFICATION_PLAN.md`；进入实现前建议先执行任务层 `/challenge`，通过后再 `/forge`。

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

### 🌊 Wave 37 ✅ — v6 S5 Life Loop Activation: T2.4.1 platform-specific intent
**T2.4.1**：新增 `platform-capability-router.ts`（`src/core/second-nature/orchestrator/`），提供 `resolvePlatformForIntent` 从 `acceptedGoals` 文本和 `evidenceRefs` 中推断明确的 `platformId`，并通过可选的 `CapabilityContractRegistry` 验证 capability 支持；`intent-planner.ts` 的 `planCandidateIntents` 扩展 `PlanCandidateIntentsOptions`（`acceptedGoals` + `connectorRegistry`），在 `planWork/Exploration/SocialIntents` 中调用 router 设置 `platformId`；`heartbeat-loop.ts` 的 `HeartbeatDeps` 扩展 `connectorRegistry?: CapabilityContractRegistry`，`ingestRhythmSignal` 将 `acceptedGoals` 与 `registry` 传入 planner；`workspace-heartbeat-runner.ts` 的 `WorkspaceHeartbeatRunnerOptions` 扩展 `connectorRegistry` 并透传到 `runHeartbeatCycle`。向后兼容：不传 registry 时 planner 行为与之前完全一致（platformId undefined）。单元测 10 cases（goal→platform、evidence→platform、registry 验证、无信号→undefined、quiet→undefined）；集成测 5 cases（heartbeat→platformId、connectorExecutor 接收 platformId、无 registry→compat、ambiguous→compat、goal boost→works）。204 测试全绿，无回归。05A_TASKS.md 勾选 T2.4.1。

### 🌊 Wave 38 ✅ — v6 S5 Life Loop Activation: T2.4.2 source-backed outreach delivery
**T2.4.2**：新增集成测试 `tests/integration/control-plane/t2-4-2-source-backed-outreach-loop.test.ts`，验证 evidence → outreach judgment → draft → delivery/fallback 完整闭环。核心链路已在 T2.3.1/T6.1.1 实现：connector evidence 通过 `lifeEvidenceRefs` 流入 `planCandidateIntents` 生成的 outreach candidate `sourceRefs`；`dispatchUserOutreachIntent` 加载 `NarrativeState` + `RelationshipMemory` 并通过 `buildOutreachDraftRequest` 注入 draft context；`GuidanceDraftPort.draftOutreachMessage` 生成含 source refs 的 draft；delivery 成功时 `writeDeliveryAttempt` 记录 messageId/hostProofRef，失败时 `writeOperatorFallback` 记录 candidateMessage + reason。4 个集成测试 cases（A: evidence→outreach candidate sourceRefs、B: evidence-backed draft→delivery sent、C: delivery unavailable→fallback with evidence context、D: no evidence→judgment deny）。208 测试全绿，无回归。05A_TASKS.md 勾选 T2.4.2。

### 🌊 Wave 39 ✅ — v6 S5 Life Loop Activation: T4.2.1 owner reply → RelationshipMemory feedback
**T4.2.1**：新增 `recordOwnerReplyFeedback()`（`src/core/second-nature/feedback/owner-reply-feedback.ts`），将 owner 对 outreach 的回复记录为 SessionChronicle `owner_reply` entry，并驱动 RelationshipMemory 更新。实现：通过 `inferToneFromReply`、`inferTimingFromReply`、`extractTopicsFromReply` 三个轻量推断函数分析回复文本，生成 `RelationshipUpdateProposal`（tone、timing、topicAffinities）；调用 `applyRelationshipUpdate` 将 proposal 合并入 `RelationshipMemoryStore`；若无现存 memory 则创建默认对象并应用推断。chronicle entry 与 memory update 均携带 `sourceRef`（reply signal id + chronicle id），保证可追溯。

S5 Waves 36-39 测试增量明细：
- Wave 36 T3.3.1: 4 个集成测试（real connector evidence 路径）
- Wave 37 T2.4.1: 12 个测试（7 单元 + 5 集成，platform-specific intent 路径）
- Wave 38 T2.4.2: 4 个集成测试（source-backed outreach delivery 路径）
- Wave 39 T4.2.1: 6 个集成测试（owner reply → relationship feedback 路径）
合计新增 26 个，214 测试全绿，无回归。05A_TASKS.md 勾选 T4.2.1。

### 🌊 Wave 40 ✅ — INT-S5 关门报告 + Wave 39 静态审查修复
**INT-S5 关门报告**：产出 `reports/int-s5-v6-life-loop-activation.md`，汇总 S5 全部 6 个任务的 Given/When/Then 证据表（T1.4.1/1.4.2、T2.4.1/2.4.2、T3.3.1、T4.2.1），确认 208 测试全绿，全部 6 个 User Story 标记为 `Activated`。05A_TASKS.md 勾选 INT-S5。

**Wave 39 静态审查修复**：四子代理并行审查（Lens 1-6），产出 `.anws/v6/wave-reviews/wave-39-review.md`。
- **Critical 4 项 → 修复**：CR-01 平台 ID 硬编码消除、CR-02 意图规划读取 snapshot narrative/relationship、CR-04 owner reply inference 可配置 + PII redaction
- **High 3 项 → 修复**：H-01 平台路由多信号歧义返回 undefined、H-03 goalInfluenceRefs 预填充、H-07 owner reply 空输入防御
- **Medium 3 项 → 修复**：M-02 narrative-update confidence tiered sigmoid 映射（0/0.35/0.60/0.80/0.90，hard cap 0.95）、M-03 AgentGoal 隐性耦合 → 本地 GoalRouterContext/GoalContext/GoalPriorityContext、M-04 intent-planner 提取 INTENT_CONFIGS + planIntentWithKind 工厂
- **Low 3 项 → 修复**：L-01 empty-reason 映射注释、L-02 namespace:capability URI 解析增强、L-03 narrative progress 去重 key 改为 `${effectClass}:${id}`

测试覆盖增量：14 个单元测试（owner reply inference）+ 4 个单元测试（evidence mapper）+ 2 个集成测试（ambiguous platform / conflicting tone）。208 测试全绿，无回归。三 commit：`657a2f6` (Wave 39 settlement) + `a6b3d27` (Critical/High fixes) + `99829a0` (Medium/Low fixes)。

### 🌊 Wave 41 ✅ — Claw Inner Guide Setup
`/change` 回流 Claw soft connection：新增 `docs/claw-second-nature-inner-guide.md` 与验证 checklist；README / README.zh-CN / HEARTBEAT / 根 `SKILL.md` 说明 hard bridge 后的自然吸收路径与当前初始化真相。

`/forge` 实现插件 one-shot setup surface：`second_nature_ops setup_hint` 返回 packaged `SKILL.md` + `agent-inner-guide.md`，`setup_ack` 在 workspace 写入 `.second-nature/setup/agent-inner-guide-ack.json` 并取消后续 setup nudge。插件包纳入 `SKILL.md` / `agent-inner-guide.md`，pack dry-run 已确认可读。

### 🌊 Wave 42 ✅ — MoltBook Connector Auth Failure Fix
定位到 `CredentialVault.loadCredentialContext()` 只读取 camelCase 字段，而 sql.js/drizzle 查询行在当前路径返回 `platform_id` / `credential_type` / `encrypted_value`。结果是 status 可读但 token 丢失，connector executor 在 API 前置阶段返回 `auth_failure`。

修复：CredentialVault 统一兼容 camelCase + snake_case；新增 connector executor 回归测试，验证 `moltbook` active credential 能解密并命中 MoltBook API mock；同步插件 runtime artifact。

### 🌊 Wave 43 ✅ — Agent World Profile Endpoint + Configurable Routes
定位到 `agent-world` connector 仍硬编码不存在的 `/api/v1/feed`、`/api/v1/work`、`/api/v1/tasks/*/claim`。同时 runner 只从 payload 读取 `apiKey`，没有使用 credential vault 解出的 token，导致真实运行会被错误地卡在执行层。

修复：`feed.read` 与 `work.discover` 改为 `GET /api/agents/profile/{username}`；`feed.read` 默认 `nyx_ha`，`work.discover` 支持 `targetUsername` / `username` / `agentUsername`；新增 `SECOND_NATURE_AGENT_WORLD_USERNAME`、`SECOND_NATURE_AGENT_WORLD_PROFILE_PATH_TEMPLATE` 与 payload `profilePathTemplate` / `claimEndpointPath` 覆盖口。`task.claim` 在没有真实端点时 fail closed，不再打不存在的默认 URL。新增 3 个 Agent World connector executor 回归测试并同步插件 runtime artifact。

### 🌊 Wave 44 ✅ — Connector Behavior Evolution
`/change` 回流“行为进化”：connector capability ID 从封闭枚举改为受限开放字符串，manifest registry 可登记 `github:issue.search`、`agent-world:profile.inspect` 这类 workspace-defined behavior。`connector-system` L0/L1 文档明确：行为登记只是 capability declaration，不授予执行代码、凭据、trust allowlist 或 side-effect 权限。

`/forge` 新增 `connector_behavior_add` runtime command，并接入 CLI ops router 与 OpenClaw plugin bridge。Agent 在 heartbeat / Quiet 里发现反复出现但未登记的平台动作时，可以把它追加到 `.second-nature/connectors/{platformId}/manifest.yaml` 的 `capabilities[]`；后续是否执行仍由 registry reload、route planner、credential gate、idempotency 与 trust policy 判断。README / README.zh-CN / HEARTBEAT / plugin setup guide / inner guide 已同步说明。

### 🌊 Wave 45 ✅ — Connector + Quiet Review Closure
静态审查发现行为进化与 Quiet 还有 5 个闭环缺口：新增 capability 只到 manifest/status，没进 executor registry；`connector_behavior_add` YAML 解析和 manifest 校验过松；新增行为缺少动机/source 记录；Quiet 会把敏感 source refs 带入 artifact；`empty_state` 会重复写随机文件并污染 read model 计数。

修复：executor adapter 现在扫描 workspace manifests 并把新增 capability 注册到 `CapabilityContractRegistry`，未知平台在 runner 边界诚实返回 `unknown_platform_change`；无 credential manifest 可路由到 runner fail-closed，而不是被 route planner 卡成 auth failure。`connector_behavior_add` 改用 JSON schema YAML 解析，写入前后做 v6 manifest schema 校验，并要求 `description` 或 `sourceRefs`，支持 `observedCount`。Quiet 对 sensitive source refs 直接 denied，不落盘；`empty_state` 使用确定性 `empty_state.json`，并从 source-backed report/sourceCount 中剥离，仅通过 `emptyStateCount` 暴露。插件 runtime 已重建。

<!-- AUTO:END -->

---

## Bootstrap Recovery (DR-034)

> **铁律**：RuntimeSecretAnchor 只记录密钥的**管理位置**与**恢复原则**，绝不输出密钥**明文**。任何请求 key value 的回复都必须拒绝。

当 `sn runtime_secret_bootstrap` 返回 `missing_key` 或 `wrong_key` 时，按以下步骤排查：

1. **检查环境变量**：确认 `SECOND_NATURE_ENCRYPTION_KEY` 已在当前 shell 或 `.env` 文件中设置。
2. **验证 anchor 位置**：检查 workspace root 下是否存在 `data/runtime-secret-anchor.json`（或配置中定义的路径）。
   - 默认路径：`{workspaceRoot}/data/runtime-secret-anchor.json`
   - 自定义路径：通过 `SECOND_NATURE_SECRET_ANCHOR_PATH` 环境变量覆盖。
3. **重新验证**：运行 `sn runtime_secret_bootstrap`，status 应变为 `ok`。
4. **密钥轮换（wrong_key）**：若密钥已更换，旧密文无法解密——需要执行 credential re-encryption 流程（见 runtime-ops-system.md §12）。

### DR-034 恢复路径摘要

| 场景 | RuntimeSecretAnchorView.status | 操作 |
|---|---|---|
| 密钥未设置 | `runtime_secret_anchor_missing` | 设置 `SECOND_NATURE_ENCRYPTION_KEY` 后重试 |
| 密钥错误 | `runtime_secret_unavailable` | 确认 key 与 anchor 文件匹配；如已轮换，执行 re-encryption |
| 凭据无法解密 | `credential_recovery_required` | 旧密文不可恢复，需重新初始化凭据；系统必须诚实报告，不得伪装恢复 |
| 正常 | `ok` | 无需操作 |

注：恢复操作**不**输出密钥明文；所有状态通过 `RuntimeSecretAnchorView` 的 `status` 字段机器可读。AGENTS.md、README.md 与 `self_health` 诊断面仅记录管理位置与恢复原则，不记录 key value。

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
