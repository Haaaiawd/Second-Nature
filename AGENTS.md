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

- **最新架构版本**: `.anws/v9`
- **活动任务清单**: `.anws/v9/05A_TASKS.md`
- **活动验证计划**: `.anws/v9/05B_VERIFICATION_PLAN.md`
- **最近一次更新**: `2026-06-26` (Wave 122 已结算；T5.2.1 已签入；review-fix 完成)
- **当前波次**: Wave 122 ✅ — v9 S2 Continuity Foundation
- **下一步**: `/forge` Wave 123 — S2 Continuation Unblockers（T7.2.1 + T8.1.1，为下游 T7.2.2 / T6.3.1 / T5.2.2 解锁）

### 🌱 Genesis v9 🧭 — Self Continuity, Character & Procedural Evolution

v9 将 Second Nature 从“闭环能运行”推进为“上下文清空后仍能继承身体直觉，并通过工具、外部刺激、反馈、持续活动脉络和闭环长出习惯与人格”。新增 Continuity Projection、SelfContinuityCard、ActivityThread、CharacterFrame、ProceduralProjection、ToolRoutine、workspace-only ConnectorEvolutionPlan 与 AutonomousChangeLedger。`ActivityThread` 让 attention、联想、观察、行动闭包与暂停/完成跨 heartbeat 延续，但不把 heartbeat 变成无限内部循环；`character-continuity-system` 产出 source-backed、contestable 的 emergent character/habit projection，不是人格分数表、控制器或情绪断言；Claw Agent 仍是开放心智，Second Nature 提供 attention、body intuition、policy closure、Dream-backed continuity、activity continuity、character continuity 与可回滚的 workspace connector 演化。

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
└── v9/
   ├── 00_MANIFEST.md
   ├── 00_TECH_EVALUATION.md
   ├── 01_PRD.md
   ├── 02_ARCHITECTURE_OVERVIEW.md
   ├── 03_ADR/
   │   ├── ADR_001_CONTINUE_TYPESCRIPT_NODE_OPENCLAW_SQLITE.md
   │   ├── ADR_002_ATTENTION_NOT_AGENT_MIND.md
   │   ├── ADR_003_CONTINUITY_PROJECTION_AFTER_DREAM.md
    │   ├── ADR_004_WORKSPACE_ONLY_CONNECTOR_EVOLUTION.md
    │   ├── ADR_005_PROCEDURAL_MEMORY_AS_VERIFIED_ROUTINE.md
    │   └── ADR_006_CHARACTER_CONTINUITY_AS_EMERGENT_PROJECTION.md
   ├── 04_SYSTEM_DESIGN/
   │   ├── README.md
   │   ├── shared-v9-contracts.md
   │   ├── runtime-ops-system.md
   │   ├── runtime-ops-system.detail.md
   │   ├── control-context-system.md
   │   ├── control-context-system.detail.md
   │   ├── attention-system.md
   │   ├── attention-system.detail.md
   │   ├── action-closure-policy-system.md
   │   ├── action-closure-policy-system.detail.md
   │   ├── memory-continuity-system.md
   │   ├── memory-continuity-system.detail.md
   │   ├── character-continuity-system.md
   │   ├── character-continuity-system.detail.md
   │   ├── body-connector-system.md
   │   ├── body-connector-system.detail.md
   │   ├── observability-recovery-system.md
   │   ├── observability-recovery-system.detail.md
   │   ├── _research/
   │   │   └── memory-continuity-system-research.md
   │   └── _review/
   │       ├── cross-system-design-review.md
   │       ├── cross-system-design-review-2-fix-report.md
   │       ├── character-continuity-boundary-review.md
   │       ├── character-continuity-boundary-review-2.md
   │       ├── shared-contracts-spot-review.md
   │       └── connector-alignment-spot-review-2.md
   ├── 06_CHANGELOG.md
   └── concept_model.json
```

---

## 🧭 导航指南 (Navigation Guide)

> **注意**: 此部分由 `/genesis` 维护。

- **架构总览**: `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`
- **PRD**: `.anws/v9/01_PRD.md`
- **ADR**: `.anws/v9/03_ADR/` (跨系统决策的唯一记录源)
- **详细设计**: `.anws/v9/04_SYSTEM_DESIGN/`（待 `/design-system`）
- **执行主清单**: `.anws/v9/05A_TASKS.md`
- **验证计划**: `.anws/v9/05B_VERIFICATION_PLAN.md`
- **质疑报告**: `.anws/v9/07_CHALLENGE_REPORT.md`

### ADR ↔ SYSTEM_DESIGN 关系

- **ADR** 记录跨系统决策 (如 embodied context、tool affordance、wet probe、digest、rollback、secret recovery)
- **SYSTEM_DESIGN** §8 Trade-offs 引用 ADR,不复制决策内容
- 修改 ADR 时,检查影响范围章节,确认引用该 ADR 的系统

---

### 技术栈决策
- 语言: TypeScript
- Runtime: Node.js + OpenClaw native plugin
- 存储: SQLite/sql.js index + Markdown/JSON workspace artifacts
- 主运行入口: OpenClaw heartbeat + plugin ops surface + bounded EmbodiedContext + SelfContinuityCard/CharacterFrame injection
- Runtime secret: `SECOND_NATURE_ENCRYPTION_KEY` 必须由宿主稳定持久化；AGENTS/README/self_health 只记录管理位置与恢复原则，不记录 key 明文

### 系统边界
- `runtime-ops-system`: OpenClaw plugin / CLI / ops surface / continuity and evolution diagnostics — 详见 `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`
- `control-context-system`: heartbeat、EmbodiedContext assembly、SelfContinuityCard 注入、daily rhythm trigger — 详见 `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`
- `attention-system`: Evidence/Perception → AttentionSignal；提示 Agent，不替代 Agent mind — 详见 `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`
- `action-closure-policy-system`: Agent/routine action intent → policy decision → execution/closure — 详见 `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`
- `memory-continuity-system`: state、Quiet/Dream、MemoryProjection、ProceduralProjection、SelfContinuityCard、ConnectorEvolutionPlan — 详见 `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`
- `character-continuity-system`: CharacterFrame、emergent habits、value/relationship/expression posture、growth tensions、contest/re-authoring；滋养 Agent，不替代 Agent mind，不声称真实情绪 — 详见 `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`
- `body-connector-system`: real-hand affordance、ToolExperience、ToolRoutine、connector execution、workspace connector evolution — 详见 `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`
- `observability-recovery-system`: loop/continuity/routine/evolution health、AutonomousChangeLedger、rollback health — 详见 `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`

### 活跃 ADR
- ADR-001: Continue TypeScript / Node / OpenClaw / SQLite Runtime
- ADR-002: Narrow Real-Time Semantics to Attention, Not Agent Mind
- ADR-003: Add Continuity Projection After Quiet/Dream
- ADR-004: Allow Workspace-Only Autonomous Connector Evolution
- ADR-005: Model Procedural Memory as Verified Routine
- ADR-006: Model Character Continuity as Emergent Projection

### 当前任务状态
- 执行主清单: `.anws/v9/05A_TASKS.md`
- 验证计划: `.anws/v9/05B_VERIFICATION_PLAN.md`
- User Story 数: 8
- 系统数: 8
- **状态**: ✅ v9 `/genesis` + `/design-system` + `/challenge` + `/blueprint` 完成；任务与验证计划已落盘
- **Challenge**: `.anws/v9/07_CHALLENGE_REPORT.md` complete，所有发现已在设计文档闭合并转入 05A/05B
- **下一步**: `/forge` Wave 123 — S2 SelfContinuityCard assembly（T5.2.2 / T7.2.2 / T6.2.2 ready when dependencies satisfied）
- **最近更新**: `2026-06-26` (Wave 122 complete; T5.2.1 checked; review-fix applied)

### 🌊 Wave 122 ✅ — v9 S2 Continuity Foundation
T5.2.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 122 完成
- **分支**: `feature/wave-119-v9-contract-spine`
- **任务**: T5.2.1 扩展 Quiet/Dream 输出族与 projection lifecycle
- **产出**:
  - `src/storage/v9-state-stores.ts` — `procedural_projection` / `connector_evolution_plan` 读写端口（degraded-aware）
  - `src/core/second-nature/quiet-dream/v9-dream-consolidation-runner.ts` — memory/procedural/self_continuity/connector_evolution/character 五族候选生成，placeholder/no-content 阻断，credential/private redaction
  - `src/core/second-nature/quiet-dream/v9-procedural-projection-lifecycle.ts` — accept/supersede/reject/retire 生命周期
  - `tests/unit/dream/v9-dream-consolidation-runner.test.ts`
  - `tests/unit/dream/v9-procedural-projection-lifecycle.test.ts`
  - `tests/integration/v9/quiet-dream-continuity.test.ts`
- **验证**:
  - `pnpm typecheck` ✅
  - `pnpm build` ✅
  - `pnpm build:plugin` ✅
  - `pnpm test` 1774 tests, 1765 pass, 0 fail, 9 skipped
  - code-reviewer: `.anws/v9/wave-reviews/wave-122-review.md` — 待生成
- **下一步**: 进入 Wave 123；按 05A 依赖图选择就绪任务。
- **说明**: T5.2.1 产出仅包含候选生成与 procedural 生命周期；SelfContinuityCard（T5.2.2）/ CharacterFrame（T7.2.2）/ ToolRoutine registry（T6.2.2）/ ConnectorEvolutionPlan gates（T6.3.1）为下游依赖，需等待上游就绪。

### 🌊 Wave 120 ✅ — v9 S2 Attention + Stable Identity
T3.2.1, T3.2.2
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 120 完成
- **分支**: `feature/wave-119-v9-contract-spine`
- **任务**: T3.2.1 AttentionSignal 装配器；T3.2.2 重复 feed 抑制与 identity_unstable 阻断
- **产出**:
  - `src/shared/types/v9-contracts.ts` — `StableEvidenceIdentity` / `AttentionSignal` 契约定型
  - `src/storage/v9-evidence-identity-port.ts` — 只读 identity resolution over v8 evidence
  - `src/connectors/evidence-normalizer.ts` + `src/storage/v8-state-stores.ts` — identity 列写入与幂等更新
  - `src/core/second-nature/perception/attention-assembler.ts` — 装配器主流程
  - `src/core/second-nature/perception/attention-scorer.ts` — relevance/risk/action/thread 评分
  - `src/core/second-nature/perception/repetition-detector.ts` — identity 查询包装
  - `src/core/second-nature/perception/attention-signal-validator.ts` — 最终校验门
  - `tests/unit/attention/v9-attention-assembler.test.ts`
  - `tests/integration/v9/stable-identity-attention.test.ts`
  - `tests/integration/v9/repeated-feed-suppression.test.ts`
  - `src/storage/db/index.ts` — 修复 bootstrap 在旧 DB 上引用未创建列的索引（移入迁移块）
- **验证**:
  - `pnpm typecheck` ✅
  - `pnpm build` ✅
  - `pnpm build:plugin` ✅
  - `pnpm test` 1750 tests, 1741 pass, 0 fail, 9 skipped
  - code-reviewer: `.anws/v9/wave-reviews/wave-120-review.md` — Pass（1 Medium / 5 Low）
- **下一步**: 进入 Wave 121；按 05A 依赖图选择就绪任务。
- **说明**: AGENTS.md 原建议 Wave 120 同时包含 T2.2.1/T2.2.4，但 05A 依赖图显示二者依赖 T5.2.2/T7.2.2/T6.2.1 等上游任务，本波按依赖就绪顺序先做 T3.2.1/T3.2.2。

### 🌊 Wave 121 ✅ — v9 S2 Affordance Baseline
T6.2.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 121 完成
- **分支**: `feature/wave-119-v9-contract-spine`
- **任务**: T6.2.1 real-hand affordance 三轴与 scaffold/stale 降级
- **产出**:
  - `src/shared/types/v9-contracts.ts` — 更新 `AffordancePosture` 为 design doc L1 三轴形态
  - `src/storage/v9-state-stores.ts` — `readActiveToolRoutinesByCapabilityPattern` + `writeToolRoutine` 种子端口
  - `src/core/second-nature/body/tool-affordance/v9-affordance-assembler.ts` — 三轴 posture 装配器
  - `tests/unit/body/v9-affordance-posture.test.ts`
  - `tests/integration/v9/real-hand-affordance.test.ts`
- **验证**:
  - `pnpm typecheck` ✅
  - `pnpm build` ✅
  - `pnpm build:plugin` ✅
  - `pnpm test` 1761 tests, 1752 pass, 0 fail, 9 skipped
  - code-reviewer: `.anws/v9/wave-reviews/wave-121-review.md` — Pass（2 Medium / 5 Low）
- **下一步**: 进入 Wave 122；按 05A 依赖图选择就绪任务。
- **说明**: M-1 credential presence 已收紧为仅 `active`；M-2 v9 `ProbeStatus.not_implemented` 需等待 v9 probe runner（T6.3.x）引入，当前在代码中已标注 residual。

### 🌊 Wave 116 🧭 — v8 Change: Host Reality and Ideal Loop Hemostasis
T-ROS.R.5, T-ROS.R.6, T-ROS.R.7, T-ROS.R.8, T-SH.R.6, T-CP.R.5, T-AC.R.2, T-OBS.R.7, T-OBS.R.8, T-CS.R.9, T-DQ.R.9, INT-R11
**签入**: AUTO (Wave 116D)
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 116D 完成（T-ROS.R.6 plugin workspace bridge repair merged）；116A/116B/116C implementation tasks checked in `05A_TASKS.md`
- **子波划分**: 116A 契约基础 → 116B 心跳/闭包模型 → 116C 内容/记忆/回归门 → 116D 桥接修复
- **目标**: repair host reality and v8 ideal-loop semantic drift so loaded/smoke/carrier-visible states cannot masquerade as real runtime health; and plugin workspace bridge does not return cli surfaceMode for full-runtime commands.
- **计划产出**:
  - Host-visible `second_nature_ops` injection proof or explicit `host_tool_unavailable` diagnostic.
  - Packaged `SKILL.md` projection into host skill discovery or explicit `skill_projection_unavailable` diagnostic.
  - Setup ack truth gate rejecting `placedIn: "unspecified"` as complete.
  - `HostCapabilityDiscoveryPort`, skill discovery probe, setup ack schema, and host smoke minimum evidence fields.
  - Provenance tiers: `sourceRefs`, `proofRefs`, `traceRefs`.
  - Single operator-facing v8 living-loop heartbeat model; v7 only as internal adapter trace.
  - `CycleFinalizer` exactly-one closure invariant.
  - `EvidenceLevelClassifier`: `carrier_ack`, `contract_smoke`, `state_present`, `real_runtime`, `durable_verified` promotion/cap rules.
  - Precise stage/degraded-result states: `empty`, `partial`, `blocked`, `unavailable`, `unsafe`; `degraded` aggregate only.
  - Content-bearing evidence minimum contract and no-fabrication handling for ID-only evidence.
  - Quiet placeholder rejection and precise Dream blocked reasons.
  - Plugin workspace bridge returns `surfaceMode: "workspace_full_runtime"` and correct statuses.
- **测试计划**: INT-R11 report `reports/int-r11-wave-116-host-reality-hemostasis.md`; targeted host/plugin/setup/evidence/closure/Quiet-Dream tests plus Wave 108-115 regression sample.
- **最高严重度**: documentation P0 closed; 116A/116B/116C/116D implementation completed; code review `wave-116d-review.md` Partial Pass → review-fix applied
- **下一步**: Run INT-R11 host reality and hemostasis gate; update report and verify Wave 108-115 regressions.

### 🌊 Wave 117 🧭 — v8 Change: Triage Pre-existing v8 Runtime Integration Failures
INT-R11 repair
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 117 完成（21 项预存 v8 runtime 集成失败已修复；INT-R11 gate 通过）
- **子波目标**: triage and repair the 21 pre-existing v8 runtime integration failures surfaced by INT-R11 so the full `pnpm test` regression gate passes.
- **根因**:
  - `src/storage/db/index.ts` bootstrap schema for `loop_stage_event` 缺少 `proof_refs_json`/`trace_refs_json`；现有数据库通过 `applyStateSchemaMigrations` 防御性补列。
  - `src/storage/v8-state-stores.ts` 中多个 writer 使用 `...row` 展开，把 `sourceRefs`/`proofRefs`/`traceRefs`/`closureRefs`/`payload` 数组/对象当作列值传给 Drizzle，潜在 schema 漂移风险；已在所有 v8 writer 中解构移除非列字段。
  - T-DQ.R.9 引入的 Quiet placeholder rejection 使原本 closure-only / ID-only evidence 的测试期望 `dream completed` 不再成立；已通过 `tests/shared/content-evidence-fixture.ts` 统一注入 content-bearing evidence，或把无证据路径的期望改为 `dream_blocked_no_content`。
  - INT-V8 guidance consumption contract 测试错误期望 `sourceRefs` 混入 `proofRefs`；已改为分别断言 `sourceRefs` 与 `proofRefs`。
- **产出**:
  - `src/storage/db/index.ts` — `loop_stage_event` bootstrap + defensive column migration
  - `src/storage/v8-state-stores.ts` — 10 个 writer 的 `...row` spread 清理（evidence/perception/judgment/closure/quiet/dream/projection/cycle-trace/loop-stage/impulse/daily-rhythm/cooldown）
  - `tests/shared/content-evidence-fixture.ts` — content-bearing evidence seed helper
  - `tests/api/runtime-ops/loop-status-real-run-gate.test.ts`
  - `tests/api/dream/quiet-dream-runtime-chain.test.ts`
  - `tests/integration/v8/int-r1-runtime-activation-repair.test.ts`
  - `tests/integration/v8/living-perception-loop.test.ts`
  - `tests/integration/v8/proof-memory-closure.test.ts`
  - `tests/integration/v8/real-runtime-quiet-dream-advance.test.ts`
  - `tests/integration/v8/runtime-recovery-closure.test.ts`
  - `tests/unit/dream/daily-rhythm-scheduler.test.ts`
  - `tests/unit/dream/dream-runner-lifecycle.test.ts`
  - `reports/int-r11-wave-117-runtime-integration-repair.md` — Wave 117 修复报告
  - `.anws/v8/05A_TASKS.md` — INT-R11 已勾选
  - `.anws/v8/05B_VERIFICATION_PLAN.md` — Wave 116/INT-R11 验证状态更新为 ✅
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；`pnpm build:plugin` ✅；targeted previously-failing 9 suites 48/48 PASS；full `pnpm test` 1693 tests, 1684 pass, 0 fail, 9 skipped
- **最高严重度**: none
- **残留待跟进**: 无
- **下一步**: Wave 118 release packaging.

### 🌊 Wave 118 🧭 — v8 Release Packaging
Release packaging for `@haaaiawd/second-nature@0.2.13`
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 118 完成（版本 `0.2.13`；plugin package 已构建；`npm pack --dry-run` 通过）
- **目标**: Bump package version, rebuild plugin runtime, verify packaged artifact, and prepare for npm upload.
- **产出**:
  - `package.json` — version bumped to `0.2.13`
  - `plugin/package.json` — version bumped to `0.2.13`
  - `plugin/openclaw.plugin.json` — version bumped to `0.2.13`
  - `plugin/index.js` + `plugin/workspace-ops-bridge.js` + `plugin/runtime/` — rebuilt
  - `.anws/v8/06_CHANGELOG.md` — v0.2.13 release entry
  - `AGENTS.md` — Wave 118 state updated
- **验证**:
  - `pnpm typecheck` ✅
  - `pnpm build` ✅
  - `pnpm build:plugin` ✅
  - `cd plugin && npm pack --dry-run` ✅ — `@haaaiawd/second-nature@0.2.13`, 635 files, 450.4 kB tarball, 2.1 MB unpacked
  - full `pnpm test` 1693 tests, 1684 pass, 0 fail, 9 skipped
- **最高严重度**: none
- **残留待跟进**: 无
- **下一步**: Upload `@haaaiawd/second-nature@0.2.13` to npm registry, or open next wave for host E2E/manual smoke backfill.

### 🌊 Wave 108 🧭 — v8 Change: Runtime Recovery Closure Backlog
T-CP.R.3, T-DQ.R.5, T-CS.R.2, T-CS.R.3, T-OBS.R.4, INT-R3
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 108 全部完成（T-CP.R.3 + T-DQ.R.5 + T-CS.R.2 + T-CS.R.3 + T-OBS.R.4 + INT-R3）
- **产出**:
  - `src/core/second-nature/control-plane/heartbeat-orchestrator.ts` — `advanceAndRecordDailyRhythm` wired after every closure path; rhythm state returned in cycle result
  - `src/core/second-nature/control-plane/real-runtime-spine.ts` — rhythm state pass-through
  - `src/core/second-nature/quiet-dream/daily-rhythm-scheduler.ts` — `RhythmStatus` extended with `scheduled`; precise skipped/blocked dream reasons; duplicate-schedule guard; H-1 `quiet_empty_input` while `due` fixed
  - `src/connectors/base/failure-taxonomy.ts` — HTTP `status`/`statusCode` mapping to actionable failure classes; 5xx range broadened to 500-599
  - `src/connectors/services/connector-executor-adapter.ts` — declarative_http runner now returns `status` in errors; detail truncated to 200 chars
  - `src/connectors/services/connector-cooldown-port.ts` — durable cooldown table + threshold/retryAfter policy; separate `terminalCount`; fail-closed on degraded read
  - `src/connectors/services/credential-route-context.ts` — cooldown state load integration; fail-closed on degraded read
  - `src/storage/db/schema/v8-entities.ts` + `src/storage/db/index.ts` + `src/storage/v8-state-stores.ts` — `connector_cooldown_state` schema + `terminal_count` + composite index; `action_closure_record.platform_id`
  - `src/observability/loop-status.ts` — canonical reason-code attribution set + durable cooldown state read for replay attribution; `stalledAt` override fixed
  - `src/core/second-nature/action/action-closure-recorder.ts` + `action-proposal-builder.ts` — populate `platform_id` on closure writes
  - `tests/integration/v8/runtime-recovery-closure.test.ts` — INT-R3 9 cases (no-action rhythm, multi-HTTP-status failure mapping, closureRefs grounding)
  - `tests/api/runtime-ops/loop-status-denial-attribution.test.ts` — durable cooldown attribution + credential leak checks
  - `tests/unit/observability/heartbeat-denial-attribution.test.ts` — canonical reason-code classification
  - `reports/int-r3-v8-runtime-recovery-closure.md` — Wave 108 gate report
  - `logs/int-r3-loop-status.json` — structured attribution evidence
  - `.anws/v8/05A_TASKS.md` — Wave 108 all tasks checked
  - `.anws/v8/05B_VERIFICATION_PLAN.md` — Wave 108 verification gates checked
  - `.anws/v8/wave-reviews/wave-108-review.md` — code review report, H-1 fixed, final verdict Pass
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；Wave 108 targeted 79/79 PASS（含 INT-V8 + declarative-http 回归）；`real-runtime-living-loop` 2/2 PASS
- **最高严重度**: none blocking (H-1, H-2, H-3 fixed during review; M-1, M-3, M-4 fixed; M-2 + generic connector target derivation accepted residual)
- **下一步**: 等待用户指令进入发布 / 下一轮

### 🌊 Wave 109 🧭 — v8 Change: Content-Bearing Evidence and Memory Activation Repair
T-CS.R.4, T-CS.R.5, T-PJ.R.2, T-DQ.R.6, T-DQ.R.7, T-OBS.R.5, INT-R4
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 109 全部完成（T-CS.R.4 + T-CS.R.5 + T-PJ.R.2 + T-DQ.R.6 + T-DQ.R.7 + T-OBS.R.5 + INT-R4）
- **产出**:
  - `src/connectors/base/normalized-evidence-content.ts` — generic `NormalizedEvidenceContent` envelope + extractor
  - `src/connectors/evidence-normalizer.ts` — content-bearing v8 `EvidenceItem` dedup + upsert (v7 double-write preserved)
  - `src/core/second-nature/heartbeat/heartbeat-loop.ts` — v8 evidence normalization double-write after v7 append
  - `src/core/second-nature/perception/perception-builder.ts` — content-bearing perception + lifecycle advance to `perceived`
  - `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts` — readable daily review from evidence/perception/closure rows
  - `src/core/second-nature/quiet-dream/daily-rhythm-scheduler.ts` — immediate Dream execution, 7-day interval, stale repair
  - `src/storage/services/write-validation-gate.ts` — UUID/identifier exemption + field-level attribution
  - `src/storage/db/migrations/v8-003-quiet-closure-refs.ts` — no-op migration (bootstrap schema already includes column)
  - `src/cli/commands/index.ts` — `connector_status` CLI registration (fixes plugin bridge v6 ops surface)
  - `tests/integration/v8/content-bearing-living-loop.test.ts` — INT-R4 4 cases
  - `reports/int-r4-v8-content-bearing-loop.md` — INT-R4 verification report
  - `.anws/v8/wave-reviews/wave-109-review.md` — code review report, final verdict Pass
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；`pnpm build:plugin` ✅；INT-R4 4/4 PASS；Wave 109 targeted unit 24/24 PASS；Wave 108 regression 9/9 PASS；`plugin-workspace-ops-bridge` 17/17 PASS；`proof-memory-closure` 6/6 PASS；`real-runtime-quiet-dream-advance` 3/3 PASS；`quiet-dream-runtime-chain` 4/4 PASS；`heartbeat-rhythm-advance` 2/2 PASS；`commands.test.ts` narrative:diff 5/5 PASS
- **最高严重度**: none
- **残留待跟进**: 无
- **下一步**: 等待用户指令进入发布 / 下一轮 / 实机 E2E 回填

### 🌊 Wave 111 🧭 — v8 Change: v0.2.10 Review-Closure Repair
T-SMS.R.2, T-CP.R.4, T-DQ.R.8, T-AC.R.1, T-CS.R.8, T-GVS.R.3, INT-R6
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 111 全部完成（T-SMS.R.2 + T-CP.R.4 + T-DQ.R.8 + T-AC.R.1 + T-CS.R.8 + T-GVS.R.3 + INT-R6）
- **产出**:
  - `src/storage/db/migrations/v8-004-schema-closure.ts` — v8 schema closure migration with idempotent daily_rhythm_state, impulse_context_artifact, connector_cooldown_state
  - `src/storage/db/index.ts` — defensive `applyStateSchemaMigrations` for `platform_id`, `capability_id`, `terminal_count`, `closure_refs_json`, composite index
  - `src/storage/db/schema/v8-entities.ts` — evidence_item platform/content-hash unique index
  - `tests/integration/storage/schema-migration.test.ts` — v8-004 upgrade + idempotency coverage
  - `src/core/second-nature/control-plane/heartbeat-orchestrator.ts` — `rhythmDegraded` propagated to cycle result; impulse context refresh removed from orchestrator
  - `src/core/second-nature/control-plane/real-runtime-spine.ts` — `rhythmDegraded` and `impulseContextArtifactId` handoff
  - `src/cli/ops/heartbeat-surface.ts` — owns single impulse context refresh; exposes `expressionBoundaryConstraints`/`expressionBoundaryStyle`
  - `src/core/second-nature/quiet-dream/daily-rhythm-scheduler.ts` — global 7-day Dream interval via latest run query
  - `src/storage/v8-state-stores.ts` — `readLatestDreamConsolidationRunByStatus` read port
  - `src/shared/types/v8-contracts.ts` — canonical `dream_interval_active` reason
  - `src/core/second-nature/action/action-proposal-builder.ts` — removed remember closure write
  - `src/core/second-nature/action/action-closure-recorder.ts` — optional `platformId`/`capabilityId` on `RecordClosureOptions`
  - `src/connectors/services/connector-executor-adapter.ts` — unified safe-shadow precedence + built-in shadow trust gate + `configuration_missing` mapping
  - `tests/integration/connectors/connector-executor-adapter-honest-failure.test.ts` — safe/unsafe shadow tests
  - `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts` — surface-owned impulse artifact id assertion
  - `tests/api/runtime-ops/loop-status-real-run-gate.test.ts` — surface-owned impulse context test
  - `reports/int-r6-wave-111-repair-gate.md` — INT-R6 verification report
  - `package.json` / `plugin/package.json` / `plugin/openclaw.plugin.json` — version bump to `0.2.11`
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；`pnpm build:plugin` ✅；Wave 111 targeted 32/32 PASS + 3 justified skips；Wave 108-109 regression 35/35 PASS；`reports/int-r6-wave-111-repair-gate.md` 记录实测证据
- **最高严重度**: none
- **残留待跟进**: 无
- **下一步**: v0.2.11 published; monitor host E2E / begin next cycle on user signal

### 🌊 Wave 112 ✅ — v8 /change Repair: Canonical Contract Shape (Hemostasis)
T-SH.R.2 (adjusted), T-SMS.R.3 (adjusted), INT-R7
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 112 完成（T-SH.R.2 + T-SMS.R.3 + INT-R7）
- **产出**:
  - `src/shared/types/source-ref.ts` — renamed v7 tuple to `SourceRefTuple`
  - `src/shared/types/index.ts` — re-exports v8 contracts; canonical `SourceRef` object available
  - `src/shared/types/v7-entities.ts`, `src/shared/types/goal.ts`, `src/storage/services/write-validation-gate.ts` — adapted to `SourceRefTuple`
  - `src/shared/serialization.ts` — `parseSourceRefs`/`serializeSourceRefs`
  - `src/storage/v8-state-stores.ts` — uses shared serializer
  - `tests/unit/shared/source-ref-serialization.test.ts` — serialization round-trip tests
  - `tests/unit/shared/v7-entities.test.ts` — `SourceRefTuple` compile tests
  - `reports/int-r7-wave-112-hemostasis-gate.md` — INT-R7 verification report
  - `.anws/v8/wave-reviews/wave-112-review.md` — code review (Partial Pass, no Critical/High)
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；Wave 112 targeted 41/41 PASS + 3 justified skips；Wave 108-111 regression 34/34 PASS + 3 justified skips
- **最高严重度**: none
- **残留待跟进**: Wave 113–115 opened for remaining SourceRef clones and single-status cleanup
- **下一步**: Execute Wave 113 tasks (T-SH.R.3, T-SH.R.4, T-SH.R.5); run INT-R8 gate

### 🌊 Wave 113 ✅ — v8 /change Repair: Remove SourceRef Local Clones
T-SH.R.3, T-SH.R.4, T-SH.R.5, INT-R8
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 113 完成（T-SH.R.3 + T-SH.R.4 + T-SH.R.5 + INT-R8）
- **产出**:
  - `src/core/second-nature/types.ts` — removed `ControlPlaneSourceRef`; `CandidateIntent.sourceRefs` now uses canonical v8 `SourceRef`
  - `src/shared/source-ref-compat.ts` — explicit legacy `kind` ↔ canonical `family` boundary adapter
  - `src/cli/host-capability/types.ts` — uses canonical v8 `SourceRef`
  - `src/storage/life-evidence/types.ts` — local ref renamed to `LifeEvidenceSourceRef`
  - control-plane, host-capability, life-evidence, quiet/outreach, and snapshot call sites updated
  - plugin runtime rebuilt so packaged declarations no longer expose `ControlPlaneSourceRef`
  - `reports/int-r8-wave-113-source-ref-clones.md` — INT-R8 verification report
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；`pnpm build:plugin` ✅；Wave 113 targeted 57/57 PASS；Wave 113 integration 33/33 PASS + 2 historical skips；Wave 108-112 regression sample 51/51 PASS
- **最高严重度**: none
- **残留待跟进**: Wave 115 remaining v8 SourceRef serialization migration
- **下一步**: Execute Wave 115 task T-SMS.R.5; run INT-R10 gate

### 🌊 Wave 114 ✅ — v8 /change Repair: v8 Schema Single Status Column
T-SMS.R.4, INT-R9
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 114 完成（T-SMS.R.4 + INT-R9）
- **产出**:
  - `src/storage/db/schema/v8-entities.ts` — removed redundant `lifecycleStatus` from status-bearing v8 target tables
  - `src/storage/db/index.ts` — fresh bootstrap no longer creates target `lifecycle_status`; startup defensive migration drops old duplicate columns
  - `src/storage/db/migrations/v8-005-single-status-schema.ts` — schema-version marker for single-status cleanup
  - `src/storage/v8-state-stores.ts` + target runtime writers — no target-table `lifecycleStatus` writes
  - `tests/integration/storage/v8-schema-shape.test.ts` — fresh bootstrap + pre-Wave-114 upgrade introspection
  - `reports/int-r9-wave-114-single-status-schema.md` — INT-R9 verification report
  - `.anws/v8/wave-reviews/wave-114-review.md` — code review report, final verdict Pass
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；`pnpm build:plugin` ✅；INT-R9 storage 5/5 PASS + 3 historical skips；Wave 114 regression sample 21/21 PASS
- **最高严重度**: none
- **残留待跟进**: Wave 115 remaining v8 SourceRef serialization migration
- **下一步**: Execute Wave 115 task T-SMS.R.5; run INT-R10 gate

### 🌊 Wave 115 ✅ — v8 /change Repair: Migrate Remaining SourceRef Serialization to Shared Helper
T-SMS.R.5, INT-R10
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 115 完成（T-SMS.R.5 + INT-R10）
- **产出**:
  - `src/core/second-nature/action/policy-bound-dispatch.ts` — `serializeSourceRefs` for canonical v8 `SourceRef[]`
  - `src/observability/living-loop-health-gate.ts` — `parseSourceRefs` for v8 closure source refs
  - `src/core/second-nature/control-plane/accepted-projection-loader.ts` — removed local `parseSourceRefs`, imports shared helper
  - `src/core/second-nature/perception/perception-builder.ts` — removed local `parseSourceRefs`, imports shared helper
  - `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts` — removed local `parseSourceRefs`, imports shared helper
  - `src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts` — removed local `parseSourceRefs`, imports shared helper
  - `logs/wave-115-source-refs-search.log` — v8/v7 search boundary evidence
  - `reports/int-r10-wave-115-serialization-completion.md` — INT-R10 verification report
  - `.anws/v8/wave-reviews/wave-115-review.md` — code review report
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；`pnpm build:plugin` ✅；Wave 115 targeted 36/36 PASS；Wave 108-114 regression 14/14 PASS
- **最高严重度**: none
- **残留待跟进**: 无
- **下一步**: Wave 115 settlement; all v8 /change repair waves complete

### 🌊 Wave 107 🧭 — v8 Change: Proof Truth and Memory Feedback Backlog
T-VERIFY.R.1, T-OBS.R.3, T-PJ.R.1, T-DQ.R.3, T-DQ.R.4, INT-R2
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: ✅ Wave 107 全部完成（T-VERIFY.R.1 + T-OBS.R.3 + T-PJ.R.1 + T-DQ.R.3 + T-DQ.R.4 + INT-R2）
- **产出**:
  - `reports/v8-current-system-mechanism-audit-2026-06-09.md` — current system mechanism audit and gap analysis
  - `reports/v8-wave107-proof-memory-change-spec.md` — Wave 107 change spec and implementation order
  - `.anws/v8/05A_TASKS.md` — Wave 107 all tasks checked; INT-R2 checked
  - `.anws/v8/05B_VERIFICATION_PLAN.md` — added Wave 107 verification gates
  - `.anws/v8/06_CHANGELOG.md` — recorded Wave 107 full completion
  - `reports/int-r1-v8-runtime-activation-repair.md` — INT-R1 verification report
  - `logs/int-r1-loop-status.json` — structured loop status evidence
  - `logs/int-r2-loop-status.json` — loop_status/digest real-run parity evidence
  - `reports/perception-contract-alignment.md` — perception contract alignment report
  - `reports/int-r2-v8-proof-memory-closure.md` — INT-R2 Wave 107 gate report
  - `.anws/v8/wave-reviews/wave-106-review.md` — Wave 106 retrospective review
- **最高严重度**: High planning repair (全部已关闭)
- **下一步**: 等待用户指令 — Wave 107 已完成，可进入下一轮或发布

### 🌊 Wave 106 🧭 — v8 Change: Runtime Activation Repair Backlog
T-CP.R.2, T-GVS.R.1, T-CS.R.1, T-DQ.R.2, T-OBS.R.2, INT-R1
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: 实现完成；proof truth / handoff evidence 由 Wave 107 重新打开验证
- **产出**:
  - `src/core/second-nature/control-plane/heartbeat-orchestrator.ts` — extended with full action-closure spine (proposal → policy → dispatch → closure)
  - `src/core/second-nature/control-plane/real-runtime-spine.ts` — bridge module wrapping `runHeartbeatCycle`
  - `src/cli/ops/heartbeat-surface.ts` — v8 spine result merged into heartbeat surface
  - `src/cli/ops/ops-router.ts` — auto-enables v8 spine when state DB is wired
  - `src/core/second-nature/guidance/impulse-context-reader.ts` — read persisted artifact with freshness diagnostics
  - `src/core/second-nature/guidance/impulse-context-writer.ts` — persist assembled impulse + atmosphere as durable artifact
  - `src/connectors/base/policy-bound-write-dispatch.ts` — write-side policy gate with dry-run/owner-confirm
  - `src/core/second-nature/quiet-dream/daily-rhythm-scheduler.ts` — independent Quiet/Dream daily rhythm
  - `src/observability/living-loop-health-gate.ts` — real-run vs contract-smoke detection
  - `src/storage/db/index.ts` — daily_rhythm_state schema added
  - `src/storage/db/schema/v8-entities.ts` — daily_rhythm_state + impulse_context_artifact tables
  - `src/storage/v8-state-stores.ts` — read/write ports for daily rhythm + impulse context
  - 测试: 4/4 real-runtime-spine + 2/2 heartbeat-v8-spine + 2/2 real-runtime-living-loop
  - 测试: 4/4 impulse-context-artifact + 2/2 guidance-context-command + 11/11 moltbook-write-policy + 4/4 moltbook-write-port
  - 测试: 4/4 daily-rhythm-scheduler + 4/4 living-loop-health-gate + 2/2 INT-R1
  - `.anws/v8/05A_TASKS.md` — Wave 106 全部 6 项任务 checked
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；41/41 targeted tests PASS；`pnpm build:plugin` ✅
- **最高严重度**: none
- **代码审查要点**:
  - ✅ Split-brain 修复：早期返回路径（空证据、感知降级）现在写入 closure
  - ✅ Exactly-once：每个周期产生恰好一个 closure/no-action；idempotency 键防止重复
  - ✅ 降级可观测性：所有路径记录 canonical stage events
  - ✅ 无真实外部写入：保守策略默认值
  - ✅ Impulse context: guidance_payload 先读 persisted artifact
  - ✅ Heartbeat surface: 暴露 impulse context read pointer
  - ✅ MoltBook write: policy proof gate，dry-run/owner-confirm 安全路径
  - ✅ Daily rhythm: Quiet/Dream 独立节律，不依赖 heartbeat 恰好选中 quiet intent
  - ✅ Health gate: 区分 contract-smoke 与 real-run，显式 missing stage reason
- **下一步**: Wave 107 已打开 proof truth / memory feedback 修复，不进入 Step 5 结算。

### 🌊 Wave 105 ✅ — v8 Repair: Audit-backed Connector/Quiet Digest Closure
T-OBS.R.1
**签入**: USER
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-04）
- **产出**:
  - `src/observability/services/audit-closure-recorders.ts` — connector attempt and Quiet artifact audit recorders
  - `src/observability/services/heartbeat-digest-assembler.ts` — audit fallback now counts Quiet source coverage events
  - `src/cli/index.ts`, `src/cli/ops/heartbeat-surface.ts`, `src/cli/ops/ops-router.ts`, `src/cli/ops/workspace-heartbeat-runner.ts` — shared audit store wiring
  - `src/cli/ops/manual-run-dispatcher.ts`, `src/core/second-nature/heartbeat/heartbeat-loop.ts`, `src/core/second-nature/quiet/run-source-backed-quiet.ts` — manual/heartbeat connector and Quiet audit emission
  - `.anws/v8/wave-reviews/wave-105-review.md` — static code review report
- **测试**: `pnpm typecheck` ✅；`pnpm build` ✅；targeted node tests 58/58 PASS；`pnpm build:plugin` ✅
- **最高严重度**: none
- **下一步**: 如需更保守，可跑全量 `pnpm test`；当前 targeted gate 已覆盖 T-OBS.R.1 验收

### 🌊 Wave 104 ✅ — v8 S5 Closure: INT-S5 + INT-V8 + T-REG.C.1 Regression Gate
INT-S5, INT-V8, T-REG.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `reports/int-s5-v8-explain-the-loop.md` — S5 集成验证报告
  - `reports/int-v8-living-perception-loop.md` — v8 全链 Living Perception Loop 集成报告
  - `reports/v8-regression-gate.md` — 回归门报告（1447/1456 pass, 0 fail）
  - `tests/integration/v8/loop-status-integration.test.ts` — INT-S5 集成测试 2/2 PASS
  - `tests/integration/v8/living-perception-loop.test.ts` — INT-V8 全链集成测试 12/12 PASS
- **测试**: `pnpm build` ✅；`pnpm typecheck` ✅；全量回归 1447/1456 pass, 0 fail, 9 skipped（历史 justified skips）
- **最高严重度**: none
- **下一步**: v8 全部完成。所有 05A_TASKS.md 任务已勾选。

### 🌊 Wave 103 ✅ — v8 S5 Wave 1: loop_status + Diagnostic Redaction + Guidance Consumption
T-ROS.C.1, T-OBS.C.3, T-GVS.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/observability/loop-status.ts` — readLoopStatus with nextAction generation, operator-facing diagnostics
  - `src/cli/ops/ops-router.ts` — loop_status command dispatch with degraded envelope handling
  - `src/cli/commands/index.ts` — loop_status CLI registration
  - `src/observability/diagnostic-redaction.ts` — projectDiagnosticRedaction with classifyDiagnosticAttribution (storage/dream/perception/policy)
  - `src/core/second-nature/guidance/guidance-proposal-consumer.ts` — consumeGuidanceProposal with source validation, GuidanceOutput shape, degraded paths
  - `tests/unit/observability/loop-status.test.ts` — 2 单元测试（0 失败）
  - `tests/unit/observability/diagnostic-redaction.test.ts` — 8 单元测试（0 失败）
  - `tests/unit/guidance/guidance-proposal-consumer.test.ts` — 8 单元测试（0 失败）
- **测试**: `pnpm build` ✅；loop-status 2/2 PASS；diagnostic-redaction 8/8 PASS；guidance-proposal-consumer 8/8 PASS
- **最高严重度**: none
- **下一步**: Wave 104 — INT-S5 (S5 Milestone) + INT-V8 + T-REG.C.1 (Regression Gate)

### 🌊 Wave 102 ✅ — v8 S4 Milestone + CP Projection Loader + Loop Health
INT-S4, T-CP.C.2, T-OBS.C.2
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `reports/int-s4-v8-remember-by-quiet-dream.md` — S4 集成验证报告
  - `src/core/second-nature/control-plane/accepted-projection-loader.ts` — loadAcceptedProjections with active/accepted-only filter, candidate exclusion, degraded handling
  - `src/observability/causal-loop-health.ts` — assembleLoopStatus with stage freshness, stall detection by cycle-sequence gap
  - `tests/unit/control-plane/accepted-projection-loader.test.ts` — 1 单元测试（0 失败）
  - `tests/unit/observability/causal-loop-health.test.ts` — 1 单元测试（0 失败）
- **测试**: `pnpm build` ✅；accepted-projection-loader 1/1 PASS；causal-loop-health 1/1 PASS
- **最高严重度**: none
- **下一步**: Wave 103 — T-ROS.C.1 (loop_status) + T-OBS.C.3 (Diagnostic Redaction) + INT-S5

### 🌊 Wave 101 ✅ — v8 S4 Dream Consolidation + Memory Projection
T-DQ.C.3, T-DQ.C.4
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/core/second-nature/quiet-dream/dream-consolidation-runner.ts` — runDreamConsolidation with rules-only candidate generation, redaction gate, validation, projection candidate write
  - `src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts` — acceptMemoryProjection with auto-supersede, rejectMemoryProjection, retireMemoryProjection
  - `src/storage/v8-state-stores.ts` — added readDreamConsolidationRunById
  - `tests/unit/dream/dream-consolidation-runner.test.ts` — 1 单元测试（0 失败）
  - `tests/unit/dream/memory-projection-lifecycle.test.ts` — 4 单元测试（0 失败）
- **测试**: `pnpm build` ✅；dream-consolidation-runner 1/1 PASS；memory-projection-lifecycle 4/4 PASS
- **最高严重度**: none
- **下一步**: Wave 102 — INT-S4 (S4 Milestone) + T-CP.C.2 (Accepted Projection Loader) + T-OBS.C.2 (Loop Health)

### 🌊 Wave 100 ✅ — v8 S3 Milestone + S4 Quiet/Dream Bootstrap
INT-S3, T-DQ.C.1, T-DQ.C.2
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `reports/int-s3-v8-act-and-close.md` — S3 集成验证报告
  - `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts` — buildQuietDailyReview from ActionClosureRecord by day, memory candidate extraction, summary generation
  - `src/core/second-nature/quiet-dream/dream-scheduler.ts` — scheduleDreamAfterQuiet with scheduled/blocked lifecycle, scheduler unavailable handling
  - `src/storage/v8-state-stores.ts` — added readActionClosuresByDay, readQuietDailyReviewById
  - `tests/unit/quiet/quiet-daily-review-builder.test.ts` — 2 单元测试（0 失败）
  - `tests/unit/dream/dream-scheduler-lifecycle.test.ts` — 2 单元测试（0 失败）
- **测试**: `pnpm build` ✅；quiet-daily-review-builder 2/2 PASS；dream-scheduler 2/2 PASS
- **最高严重度**: none
- **下一步**: Wave 101 — T-DQ.C.3 (Dream Consolidation) + T-DQ.C.4 (Memory Projection)

### 🌊 Wave 99 ✅ — v8 S3 Dispatch + Closure Recorder
T-AC.C.3, T-AC.C.4
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/core/second-nature/action/policy-bound-dispatch.ts` — dispatchAllowedAction with deny/defer/downgrade/allow routing, connector/guidance dispatch envelopes, guidance_unavailable fallback
  - `src/core/second-nature/action/action-closure-recorder.ts` — recordNoActionClosure, recordRememberClosure, recordPolicyOutcomeClosure, recordExecutionClosure with idempotent semantics
  - `tests/unit/action/policy-bound-dispatch.test.ts` — 7 单元测试（0 失败）
  - `tests/unit/action/action-closure-recorder.test.ts` — 4 单元测试（0 失败）
- **测试**: `pnpm build` ✅；policy-bound-dispatch 7/7 PASS；action-closure-recorder 4/4 PASS
- **最高严重度**: none
- **下一步**: Wave 100 — INT-S3 (S3 Milestone) 或进入 S4 (Quiet/Dream/Projection)

### 🌊 Wave 98 ✅ — v8 S3 Action Proposal + Policy Evaluator
T-AC.C.1, T-AC.C.2
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/core/second-nature/action/action-proposal-builder.ts` — buildActionProposal from JudgmentVerdict, with no-action/remember-for-review/proposal branches, MemoryReviewCandidateClosure emission, batch builder
  - `src/core/second-nature/action/autonomy-policy-evaluator.ts` — evaluateActionPolicy with table-driven allow/defer/downgrade/deny decisions (source refs, risk posture, breaker, permission, owner preference)
  - `src/storage/v8-state-stores.ts` — added readJudgmentVerdictById
  - `tests/unit/action/action-proposal-builder.test.ts` — 3 单元测试（0 失败）
  - `tests/unit/action/autonomy-policy-evaluator.test.ts` — 9 单元测试（0 失败）
- **测试**: `pnpm build` ✅；action-proposal-builder 3/3 PASS；autonomy-policy-evaluator 9/9 PASS
- **最高严重度**: none
- **下一步**: Wave 99 — T-AC.C.3 (Policy-bound Dispatch) + T-AC.C.4 (ActionClosureRecord)

### 🌊 Wave 96 ✅ — v8 S2 Judgment Engine + Heartbeat Orchestrator
T-PJ.C.3, T-CP.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/core/second-nature/perception/judgment-engine.ts` — runAgentJudgment with rules-only decision tree (relevance/risk/confidence/source-refs thresholds), batch judgment, degraded handling
  - `src/core/second-nature/control-plane/heartbeat-orchestrator.ts` — runHeartbeatCycle with monotonic cycleSequence, perception/judgment port invocation, stage event recording, no semantic decision in control-plane
  - `src/storage/v8-state-stores.ts` — added readPerceptionCardById
  - `tests/unit/judgment/judgment-engine.test.ts` — 3 单元测试（0 失败）
  - `tests/unit/control-plane/heartbeat-cycle-trace.test.ts` — 2 单元测试（0 失败）
- **测试**: `pnpm build` ✅；judgment-engine 3/3 PASS；heartbeat-orchestrator 2/2 PASS
- **最高严重度**: none
- **下一步**: Wave 97 — INT-S2 (S2 Milestone) 或 T-AC.C.1 (Action Proposal)

### 🌊 Wave 95 ✅ — v8 S2 Perception Builder
T-PJ.C.2
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/core/second-nature/perception/perception-builder.ts` — buildPerceptionCards with topic/entities/novelty/relevance/summary/risk/priority inference, rules-only fallback, empty batch handling, truncation support
  - `tests/unit/perception/perception-builder.test.ts` — 4 单元测试（0 失败）
- **测试**: `pnpm build` ✅；perception-builder 4/4 PASS
- **最高严重度**: none
- **下一步**: Wave 96 — T-PJ.C.3 (Judgment Engine) + T-CP.C.1 (Heartbeat Trace) 或 INT-S2

### 🌊 Wave 94 ✅ — v8 S1 Milestone INT-S1 + S2 Sensitivity Classifier
INT-S1, T-PJ.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/core/second-nature/perception/sensitivity-classifier.ts` — classifyEvidenceSensitivity with credential/private/public_technical/public_general signals + batch support
  - `tests/unit/perception/sensitivity-classifier.test.ts` — 13 单元测试（0 失败）
  - `reports/int-s1-v8-contract-spine.md` — S1 集成验证报告（88 测试全绿，schema 无漂移）
- **测试**: `pnpm build` ✅；sensitivity-classifier 13/13 PASS
- **最高严重度**: none
- **下一步**: Wave 95 — T-PJ.C.2 (Perception Builder) + T-PJ.C.3 (Judgment Engine) 或 INT-S2

### 🌊 Wave 93 ✅ — v8 S1 Observability + Connector: Loop Stage Event + Evidence Normalization
T-OBS.C.1, T-CS.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/observability/loop-stage-event-sink.ts` — recordLoopStageEvent with validation, redaction, batch recording, malformed-event degraded response
  - `src/connectors/evidence-normalizer.ts` — normalizeConnectorEvidence with dedup by content hash, sensitivity classification, empty/truncation/failure handling
  - `src/shared/types/v8-contracts.ts` — added payloadJson to LoopStageEvent
  - `tests/unit/observability/loop-stage-event-sink.test.ts` — 12 单元测试（0 失败）
  - `tests/unit/connectors/evidence-normalizer.test.ts` — 14 单元测试（0 失败）
- **测试**: `pnpm build` ✅；loop-stage-event 12/12 PASS；evidence-normalizer 14/14 PASS
- **最高严重度**: none
- **下一步**: Wave 94 — T-PJ.C.1 (Sensitivity Classifier) + T-CP.C.1 (Heartbeat Trace) 或 INT-S1

### 🌊 Wave 92 ✅ — v8 S1 State Stores + Body Tool Side Effects
T-SMS.C.1, T-BT.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/storage/db/schema/v8-entities.ts` — 9 tables (evidence_item, perception_card, judgment_verdict, action_closure_record, quiet_daily_review, dream_consolidation_run, long_term_memory_projection, heartbeat_cycle_trace, loop_stage_event)
  - `src/storage/v8-state-stores.ts` — write/read ports per family with source-ref validation, degraded response, lifecycle status round-trip
  - `src/core/second-nature/body/tool-affordance/affordance-side-effect.ts` — deriveConnectorSideEffect + assembleCapabilityAffordancePosture + buildSideEffectAwareAffordanceMap + policy-facing helpers
  - `tests/unit/storage/v8-state-stores.test.ts` — 13 单元测试（0 失败）
  - `tests/unit/body/affordance-side-effect.test.ts` — 15 单元测试（0 失败）
- **测试**: `pnpm build` ✅；v8-state-stores 13/13 PASS；affordance-side-effect 15/15 PASS
- **最高严重度**: none
- **下一步**: Wave 93 — T-OBS.C.1 (Loop Stage Event Sink) + T-CS.C.1 (Evidence Normalization) 或 INT-S1

### 🌊 Wave 91 ✅ — v8 S1 Contract Spine: Shared Contracts
T-SH.C.1
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-06-01）
- **产出**:
  - `src/shared/types/v8-contracts.ts` — PlatformNeutralActionKind + ACTION_KIND_REGISTRY + SourceRef + HeartbeatCycleTrace + LoopStageEvent + MemoryReviewCandidateClosure + DegradedOperationResult + V8ReasonCode
  - `tests/unit/contracts/v8-shared-contracts.test.ts` — 21 单元测试（0 失败）
- **测试**: `pnpm build` ✅；`node --test dist/tests/unit/contracts/v8-shared-contracts.test.js` — 21/21 PASS
- **最高严重度**: none
- **下一步**: Wave 92 — T-SMS.C.1 (State Stores) + T-OBS.C.1 (Loop Stage Event Sink)

### 🌊 Wave 90 ✅ — v7 S9 Connector: Scriptable Runner + INT-S9 里程碑关门
T-CS.C.11, T-CS.C.12, INT-S9
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-29）
- **产出**: 
  - `src/connectors/services/connector-executor-adapter.ts` — `createScriptableNodeRunner` + `pathToFileURL` + 接口规范注释
  - `src/connectors/base/failure-taxonomy.ts` — `script_error`/`timeout` FailureClass + classifyFailure 映射
  - `src/connectors/base/contract.ts` — `ConnectorResult.metadata.detail` 扩展
  - `src/connectors/base/policy-layer.ts` — error detail 透传至 metadata
  - `tests/unit/connectors/scriptable-node-runner.test.ts` — 4 单元测试
  - `tests/integration/connectors/scriptable-node-e2e.test.ts` — 4 集成测试（scanner→executor→mapLifeEvidence→full chain）
  - `reports/int-s9-connector-chain.md` — S9 完整性验证报告
  - `scripts/verification/int-s9-db-validation.js` — DB before/after 验证脚本
- **测试**: T-CS.C.11 4/4 PASS；T-CS.C.12 4/4 PASS；S9 全部任务测试通过；connector 全回归 157/158 PASS
- **最高严重度**: none
- **残留待跟进**: 4 项 Low 风险（credential optional route-planner / evomap env / agent-world env / timeout 硬编码）
- **下一步**: v7 全部 Sprint 里程碑关门

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

### 🌊 Wave 73 ✅ — v7 Guidance Chain & Prompt Injection Closure
T-V7C.C.4R
**签入**: AUTO
**code-reviewer**: 用户审核提示词后执行
- **状态**: 完成（2026-05-25）
- **产出**: capability-class.ts + impulse-assembler.ts + explore.md + work.md + guidance_payload command + buildDraftText 中文化 + agent-inner-guide.md 平台语言指导章节 + 53 测试（53/53 PASS）
- **测试**: `pnpm build` ✅；`node --test v7c-guidance-chain.test.js` — 53/53 PASS；regression 231/231 PASS（0 fail）
- **最高严重度**: none
- **下一步**: Wave 74 — T-V7C.C.4 Identity / Goal Hygiene Closure

### 🌊 Wave 75 ✅ — v7 INT-V7C Living Loop Closure 集成验证
INT-V7C
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-25）
- **产出**: `reports/int-v7c-living-loop-closure.md` — 全链路 closure 验证报告；07_CHALLENGE_REPORT 全部 5 项发现关闭确认
- **验证领域**: Data Lifecycle (25/25 PASS) / Connector Truth + Body Feedback (5/5 PASS) / Rhythm Loop (6/6 PASS) / Guidance Chain (12/12 PASS) / Identity/Goal Hygiene (9/9 PASS)
- **测试**: `pnpm test` — 231/231 PASS（0 fail）；`pnpm lint` ✅；`pnpm build` ✅
- **最高严重度**: none
- **07_CHALLENGE_REPORT 关闭**: CR-CODE-001 INT-S6 / CR-CODE-002 restore state / CR-CODE-003 v6 regression skips / CR-CODE-004 AGENTS 更新 / CR-CODE-005 lint script
- **下一步**: v7 架构版本锁定，后续变更走 `/change`

### 🌊 Wave 76 ✅ — 0.1.38 Real-host Closure: Host Ops Surface Parity
T-V7C.C.5
**签入**: AUTO
**code-reviewer**: 默认执行
**状态**: 完成（2026-05-26）

### 🌊 Wave 77 ✅ — 0.1.38 Real-host Closure: Production Data Growth Closure
T-V7C.C.6
**签入**: AUTO
**code-reviewer**: 默认执行
**状态**: 完成（2026-05-27）
**产出**:
- `src/cli/ops/heartbeat-surface.ts` — `HeartbeatCheckInput` 新增 `digestOpts` 和 `dreamSchedulePort`；透传至 `createWorkspaceHeartbeatRunner`；新增 try-catch 异常保护
- `src/cli/ops/ops-router.ts` — `heartbeat_check` dispatch 内联创建 `digestOpts`（auditStore + heartbeatDigestDeps）和 `dreamSchedulePort` adapter（state DB → `scheduleDream`）；`createOpsRouter.heartbeatCheck` 透传新字段；新增 try-catch → `HEARTBEAT_CYCLE_EXCEPTION` 结构化错误
- `src/cli/ops/workspace-heartbeat-runner.ts` — digest 生成后调用 `toStoreDigest` 桥接 + `createHistoryDigestStore.writeHeartbeatDigest` 持久化；修复生成结果被丢弃的断裂
- `tests/integration/runtime-ops/commands.test.ts` — 3 个 T-V7C.C.6 集成测试（digest 持久化 / 无 auditStore 降级 / stateMemoryPort 抛出时 cycle 存活）
- `scripts/build-plugin-package.ts` — `dream/` 加入 RUNTIME_ARTIFACTS，修复 plugin 打包后 `createQuietDreamSchedulePort` import 失败
**测试**: `pnpm build` ✅；`pnpm lint` ✅；commands 36/36 PASS；heartbeat-surface-workspace 5/5 PASS；plugin-registration 15/15 PASS；heartbeat integration 84/84 PASS；dream 12/12 PASS；bridge 16/16 PASS
**审查报告**: `.anws/v7/wave-reviews/wave-77-review.md`（Partial Pass → 修复后 Pass）
**最高严重度**: High（2 项，均已修复：exception catch + test corrections）
**残留待跟进**: life_evidence_index / tool_experience / dream_output_index 行增长需真实 connector exec，实机验证时补充
**E2E**: `.anws/v7/wave-reviews/wave-77-e2e.md`（guide-only；实机步骤 A/B Journey 待 Claw 0.1.38+ 环境）
**下一步**: Wave 79 — INT-V7C.R 0.1.38 Claw Gap Regression Gate

### 🌊 Wave 79 ✅ — 0.1.38 Claw Gap Regression Gate
INT-V7C.R
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-27）
- **产出**:
  - `reports/int-v7c-r-claw-gap-regression.md` — 回归验证报告
  - 本地集成测试 ~231/231 PASS（0 fail，3 justified skips）
  - `pnpm build` ✅；`pnpm lint` ✅
  - package/plugin version `0.1.38` 一致
  - 实机复测手册 §6（guide-only；待 Claw 0.1.38+ 环境）
- **审查报告**: `.anws/v7/wave-reviews/wave-79-review.md` — PASS
- **最高严重度**: none
- **残留待跟进**: 实机 connector exec DB growth（Wave 77 已标记，非本波引入）
- **E2E**: `.anws/v7/wave-reviews/wave-79-e2e.md`（guide-only）
- **下一步**: v7 S8 全部关闭，v7 架构版本锁定

### 🌊 Wave 83 ✅ — v7 Declarative HTTP Runner + 自定义 Connector 执行解锁
Wave 83 (T-V7C.C.8, T-V7C.C.9, INT-V7C.U 补全)
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-27）
- **产出**:
  - `src/cli/commands/connector-init.ts` — `declarative_http` → `declarative_trusted`；`baseUrl` → `runner.config.baseUrl`
  - `src/connectors/services/connector-executor-adapter.ts` — 通用 HTTP runner (`createDeclarativeHttpRunner`) + workspace manifest 动态加载
  - `reports/int-v7c-u-heartbeat-unlock.md` — 全链路验证报告
  - 5 新测试（3 单元 + 2 集成）
- **测试**: 核心回归 364/364（361 pass + 3 justified skips）；Wave 83 6/6 PASS；`pnpm build` ✅；`pnpm lint` ✅
- **审查报告**: `.anws/v7/wave-reviews/wave-83-review.md`（待生成，本波产出）
- **最高严重度**: none
- **残留待跟进**: evomap 仍 `not_implemented`；agent-world 仍需要 env var；通用 HTTP runner 路径映射为约定式（`/{capabilityId}`）
- **E2E**: `tests/integration/connectors/declarative-http-runner.test.ts` — 自定义 connector 全链路 PASS
- **下一步**: 提交 Wave 80-83 改动；或继续 evomap/agent-world mock

### 🌊 Wave 84 ✅ — 0.1.41 Heartbeat Affordance Default Hotfix
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-28）
- **产出**:
  - `src/core/second-nature/body/tool-affordance/affordance-context-scope.ts` — 默认 `allowedStatuses` 纳入 `needs_auth`
  - `tests/unit/body/affordance-context-scope.test.ts` / `tests/unit/body/affordance-assembler.test.ts` — 覆盖默认 scope 保留 `needs_auth`
  - package/plugin/openclaw version bump `0.1.41`
  - plugin runtime 重建
- **测试**: `pnpm build` ✅；`pnpm lint` ✅；affordance + heartbeat unlock + declarative HTTP 22/22 PASS；`cd plugin && npm pack --dry-run` ✅ (`@haaaiawd/second-nature@0.1.41`)
- **最高严重度**: none
- **残留待跟进**: Claw 实机复测；`delivery_target_none` 仍需配置输出通道；真实 evidence pipeline 仍需 connector 数据增长

### 🌊 Wave 80-82 ✅ — v7 Heartbeat Unlock: SourceRefs / Affordance / Execution 因果链修复
T-V7C.C.8, T-V7C.C.9, INT-V7C.U
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-27）
- **产出**:
  - `src/core/second-nature/orchestrator/intent-planner.ts` — sourceRefs goal fallback + capabilityIntent
  - `src/cli/index.ts` — affordance assembler built-in `needs_auth` posture
  - `src/connectors/services/connector-executor-adapter.ts` — moltbook mock runner
  - `.second-nature/mock/moltbook-feed.json` — mock 数据模板
  - 10 新测试（6 单元 + 2 集成 + 1 E2E + 1 扩展）
- **测试**: 核心回归 364/364（361 pass + 3 justified skips）；`pnpm build` ✅；`pnpm lint` ✅
- **审查报告**: `.anws/v7/wave-reviews/wave-80-82-review.md`
- **最高严重度**: none
- **残留待跟进**: 已补全（Wave 83）
- **E2E**: `tests/integration/control-plane/v7c-heartbeat-unlock-e2e.test.ts` — 全链路 PASS
- **下一步**: Wave 83

### 🌊 Wave 78 ✅ — 0.1.38 Real-host Closure: Guidance Semantics Refinement
T-V7C.C.7
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-27）
- **产出**:
  - `src/guidance/output-guard.ts` — `buildExpressionBoundary` + `ExpressionBoundaryBlock` 新语义；`buildOutputGuard` 兼容层保留
  - `src/guidance/template-registry.ts` — `getShortAtmosphereTemplate` 短约束 atmosphere（按 mode+risk ≤120 字）；`getBaselineAtmosphereTemplate` 兼容层保留
  - `src/guidance/guidance-assembler.ts` / `fallback.ts` — 生产默认使用短 atmosphere + expressionBoundary
  - `src/core/second-nature/guidance/apply-guidance.ts` — 消费 `expressionBoundary` 并回退 `outputGuard`
  - `src/core/second-nature/guidance/user-reply-continuity.ts` — expressionBoundary 注入
  - `src/observability/projections/guidance-audit.ts` — `expression_boundary` block 识别
  - `src/cli/ops/ops-router.ts` — `guidance_payload` 返回 `expressionBoundaryConstraints`
  - `plugin/agent-inner-guide.md` — expression boundary 语义说明章节
  - `tests/integration/guidance/v7c-guidance-semantics.test.ts` — 12 项新测试全部通过
  - `tests/unit/guidance/guidance-draft-service.test.ts` — 修复中文 buildDraftText 期望
- **测试**: `pnpm build` ✅；`pnpm lint` ✅；guidance integration + unit + heartbeat 170/170 PASS
- **审查报告**: `.anws/v7/wave-reviews/wave-78-review.md` — PASS
- **最高严重度**: none
- **残留待跟进**: 无
- **E2E**: N/A
- **下一步**: Wave 79 — INT-V7C.R 0.1.38 Claw Gap Regression Gate

### 🌊 Wave 74 ✅ — v7 Identity / Goal Hygiene Closure
T-V7C.C.4
**签入**: AUTO
**code-reviewer**: 默认执行
- **状态**: 完成（2026-05-25）
- **产出**: agent-goal-store.ts dedupe (scope + upsert replace + list dedupe) + goal command scope 参数 + IdentityProfile→ConnectorRequest (snapshot-builder + runtime-snapshot + heartbeat-loop + contract) + outreach-strategy-selector export + v7c-identity-goal-hygiene 集成测试（20/20 PASS）
- **测试**: `pnpm build` ✅；`node --test t4-1-4-agent-goal.test.js + v7c-identity-goal-hygiene.test.js` — 20/20 PASS；full regression 231/231 PASS（0 fail）
- **最高严重度**: none
- **下一步**: Wave 75 — INT-V7C v7 Living Loop Closure 集成验证

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
**code-reviewer**: `.anws/v7/wave-reviews/wave-50-review.md`（最高严重度：Low — `resolveCapability` unqualified intent fallback 设计 accepted）  

### 🌊 Wave 49 ✅ — v7 S1 Foundation: INT-S1 Integration Verification
INT-S1
**签入**: AUTO  
**code-reviewer**: `.anws/v7/wave-reviews/wave-49-review.md`（最高严重度：无）  

### 🌊 Wave 48 ✅ — v7 S1 Foundation: Write Queue
T-SMS.F.3
**签入**: AUTO  
**code-reviewer**: `.anws/v7/wave-reviews/wave-48-review.md`（最高严重度：无）  

### 🌊 Wave 47 ✅ — v7 S1 Foundation: Schema Migration + Audit Family Registry
T-SMS.F.2, T-OBS.F.1
**签入**: AUTO  
**code-reviewer**: `.anws/v7/wave-reviews/wave-47-review.md`（最高严重度：无）  
**风险备注**: 同 Wave 46——`04_SYSTEM_DESIGN/` 物理缺失，以 05A + ADR 为编码权威。

### 🌊 Wave 46 ✅ — v7 S1 Foundation: Shared Types
T-SMS.F.1
**签入**: AUTO  
**code-reviewer**: `.anws/v7/wave-reviews/wave-46-review.md`（最高严重度：无）  
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

### 🌊 Wave 90 ✅ — Scriptable Runner + INT-S9 Closure
**T-CS.C.11**：新增 `scriptable_node` runner 类型，`createScriptableNodeRunner` 用动态 `import()` 加载 `runner.mjs`，入参 `{intent, payload, credential}`，期待默认函数返回 `{success, data, error}`。四种错误分支：`timeout`（默认 10s，可配置）/`configuration_missing`/`script_error`/invalid shape。manifest schema 新增 `scriptable_node` kind。

**T-CS.C.12**：集成测试验证完整链路：manifest → scanner → executor → fixture .mjs → ConnectorResult → mapLifeEvidence → evidence。脚本接口规范以 inline 注释补充。

**INT-S9 关门**：S9 全部 7 个任务（T-CS.C.7~C.12 + T-ROS.C.6）通过集成验证。全量测试 1290 tests, 1281 pass, **0 fail**。发现并修复 6 个回归：
- T2.4.1-D/F ×3：platform fallback 返回 `agent-world` 而非 `undefined` → 更新测试期望
- rhythm-intent-guard：`idempotencyKey` 与 `intentHash` 不匹配 → 测试改用 `intent.idempotencyKey`
- INT-S3：`cbe3b06` 将 `needs_auth` 加入默认 scope → 更新断言
- INT-S5：`makeDeps` 未传 `createdAt` 导致日期漂移 → 固定 `createdAt`

三 commit：`2e4f41f` (Wave 90 主体) + `c7a4e1a` (回归修复) + `1d95ccc` (任务状态更新) + `a8c7da6` (INT-S9 报告更新)。05A_TASKS.md 勾选 T-CS.C.11/C.12/INT-S9。`reports/int-s9-connector-chain.md` 已更新。

<!-- AUTO:END -->

---

> **状态自检**: 准备好了？提醒用户运行 `/quickstart` 开始吧。


