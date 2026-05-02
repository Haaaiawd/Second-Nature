# AGENTS.md - AI 协作协议

> **"如果你正在阅读此文档，你就是那个智能体 (The Intelligence)。"**
> 
> 这个文件是你的**锚点 (Anchor)**。它定义了项目的法则、领地的地图，以及记忆协议。
> 当你唤醒（开始新会话）时，**请首先阅读此文件**。

---

## 🧠 30秒恢复协议 (Quick Recovery)

**当你开始新会话或感到"迷失"时，立即执行**:

1. **读取根目录的 AGENTS.md** → 获取项目地图
2. **查看下方"当前状态"** → 找到最新架构版本
3. **读取 `.anws/v{N}/05_TASKS.md`** → 了解当前待办
4. **开始工作**

---

## 🗺️ 地图 (领地感知)

以下是这个项目的组织方式：

| 路径 | 描述 | 访问协议 |
|------|------|----------|
| `src/` | **实现层**。实际的代码库。 | 通过 Task 读/写。 |
| `.anws/` | **统一架构根目录**。包含版本化架构状态与升级记录。 | **只读**(旧版) / **写一次**(新版) / `changelog` 由 CLI 维护。 |
| `.anws/v{N}/` | **当前真理**。最新的架构定义。 | 永远寻找最大的 `v{N}`。 |
| `.anws/changelog/` | **升级记录**。`anws update` 生成的变更记录。 | 由 CLI 自动维护，请勿删除。 |
| `target-specific workflow projection` | **工作流**。`/genesis`, `/blueprint` 等。 | 读取当前 target 对应的原生投影文件。 |
| `target-specific skill projection` | **技能库**。原子能力。 | 调用当前 target 对应的原生投影文件。 |
| `.nexus-map/` | **知识库**。代码库结构映射。 | 由 nexus-mapper 生成。 |

## 🛠️ 工作流注册表

> [!IMPORTANT]
> **工作流优先原则**：当任务匹配某个工作流，或你判断当前任务**明显符合、基本符合、甚至只是疑似符合**某个工作流的适用场景时，**都必须先读取相应文件**，并严格遵循其中的步骤执行。工作流是经过精心设计的协议，而非可选参考。
>
> **触发流程**：
> 1. 用户提及工作流名称，或你判断当前任务明显符合、基本符合、甚至只是疑似符合某个工作流的适用场景时，都必须先读取相应文件
> 2. **立即读取** 相应工作流文件
> 3. **严格遵循**工作流中的步骤执行
> 4. 在检查点暂停等待用户确认

| 工作流 | 触发时机 | 产出 |
|--------|---------|------|
| `/quickstart` | 新用户入口 / 不知道从哪开始 | 编排其他工作流 |
| `/genesis` | 新项目 / 重大重构 | PRD, Architecture, ADRs |
| `/probe` | 变更前 / 接手项目 | `.anws/v{N}/00_PROBE_REPORT.md` |
| `/design-system` | genesis 后 | 04_SYSTEM_DESIGN/*.md |
| `/blueprint` | genesis 后 | 05_TASKS.md + AGENTS.md 初始 Wave |
| `/change` | 进入 forge 编码后的任务局部修订 | 更新 TASKS + SYSTEM_DESIGN (仅修改) + CHANGELOG |
| `/explore` | 调研时 | 探索报告 |
| `/challenge` | 决策前质疑 | 07_CHALLENGE_REPORT.md (含问题总览目录) |
| `/forge` | 编码执行 | 代码 + 更新 AGENTS.md Wave 块 |
| `/craft` | 创建工作流/技能/提示词 | Workflow / Skill / Prompt 文档 |
| `/upgrade` | `anws update` 后做升级编排 | 判断 Minor / Major，并路由到 `/change` 或 `/genesis` |

---

## 📜 宪法 (The Constitution)

1. **版本即法律**: 不"修补"架构文档，只"演进"。变更必须创建新版本。
2. **显式上下文**: 决策写入 ADR，不留在"聊天记忆"里。
3. **交叉验证**: 编码前对照 `05_TASKS.md`。我在做计划好的事吗？
4. **美学**: 文档应该是美的。善用 Markdown 和 Emoji。

---
## 🔄 项目状态保留区

<!-- AUTO:BEGIN — 项目状态保留区（升级时唯一保留的部分，请勿手动修改区块边界） -->

## 📍 当前状态 (由 Workflow 自动更新)

> **注意**: 这是项目文件中的保留部分，由 `/genesis`、`/blueprint` 和 `/forge` 自动维护。

- **最新架构版本**: `.anws/v5`
- **活动任务清单**: `.anws/v5/05_TASKS.md`
- **最近一次更新**: `2026-05-02` (Wave 12)

### 🌱 Genesis v5 ✅ — Lived Experience Closure

v5 将 Second Nature 从 host-safe heartbeat acknowledgment 推进为 lived-experience closure：heartbeat decision loop、life evidence、rhythm windows、Quiet source coverage、user interest snapshot 与 OpenClaw 用户可见主动联系闭环。

---

## 🌳 项目结构 (Project Tree)

> **注意**: 此部分由 `/genesis` 维护。

```text
plugin/
├── index.ts
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
└── v5/
   ├── 00_MANIFEST.md
   ├── 01_PRD.md
   ├── 02_ARCHITECTURE_OVERVIEW.md
   ├── 03_ADR/
   │   ├── ADR_001_TECH_STACK.md
   │   ├── ADR_002_CONNECTOR_MODEL.md
   │   ├── ADR_003_SECOND_NATURE_GOVERNANCE.md
   │   ├── ADR_004_BEHAVIORAL_GUIDANCE_LAYER.md
   │   ├── ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md
   │   ├── ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md
   │   └── ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md
   ├── 04_SYSTEM_DESIGN/
   │   └── _research/
   ├── 06_CHANGELOG.md
   └── concept_model.json
```

---

## 🧭 导航指南 (Navigation Guide)

> **注意**: 此部分由 `/genesis` 维护。

- **架构总览**: `.anws/v5/02_ARCHITECTURE_OVERVIEW.md`
- **PRD**: `.anws/v5/01_PRD.md`
- **ADR**: `.anws/v5/03_ADR/` (跨系统决策的唯一记录源)
- **OpenClaw capability research**: `.anws/v5/04_SYSTEM_DESIGN/_research/openclaw-lived-experience-closure-research.md`
- **详细设计**: `control-plane-system`、`cli-system`、`state-system`、`behavioral-guidance-system`、`observability-system`、`connector-system` 已完成；任务清单已按第 8 轮 review 回流修复，可进入 `/forge`
- **任务清单**: `.anws/v5/05_TASKS.md`

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
- `cli-system`: OpenClaw command/tool/service surface、runtime artifact、host capability probe — 详细设计见 `.anws/v5/04_SYSTEM_DESIGN/cli-system.md`
- `control-plane-system`: heartbeat decision loop、rhythm windows、outreach judgment、delivery policy — 详细设计见 `.anws/v5/04_SYSTEM_DESIGN/control-plane-system.md`
- `connector-system`: 平台读取、互动、任务发现、执行通道治理与 source-backed life evidence candidate 生产 — 详细设计见 `.anws/v5/04_SYSTEM_DESIGN/connector-system.md`
- `state-system`: life evidence、user interest snapshot、Quiet artifact、workspace memory 索引 — 详细设计见 `.anws/v5/04_SYSTEM_DESIGN/state-system.md`
- `observability-system`: heartbeat decision trace、delivery audit、source coverage、guidance grounding、host capability 与 fallback reason 证据层 — 详细设计见 `.anws/v5/04_SYSTEM_DESIGN/observability-system.md`
- `behavioral-guidance-system`: source-backed guidance assembly、friend-like outreach draft、Quiet narrative guidance 与 User Reply light continuity，不拥有行动决策权或投递权 — 详细设计见 `.anws/v5/04_SYSTEM_DESIGN/behavioral-guidance-system.md`

### 活跃 ADR
- ADR-001: 主技术栈、宿主运行时与验证策略选择 — 继续 TypeScript/Node/OpenClaw plugin，验证重点转向 heartbeat delivery 与 source-backed outreach
- ADR-002: 平台连接器模型与执行边界 — connector 采用 Contract + Execution Adapter，API-first，CLI/skill 仅作显式 fallback
- ADR-003: Second Nature 行为节律、Quiet 与记忆治理原则 — Quiet / reflection 必须基于 source-backed life evidence
- ADR-004: Behavioral Guidance Layer 的系统边界与实现形态 — guidance 可生成朋友式草稿，但不拥有决策或投递权
- ADR-005: Heartbeat 作为 Second Nature 的主运行入口与三层运行时边界 — heartbeat 仍是自由心跳主入口
- ADR-006: 可发布的自足 Plugin Runtime Package — 发布包必须包含自足 runtime artifact
- ADR-007: Heartbeat Delivery 与 Life Evidence 闭环 — delivery target 是主动联系成立的硬前提

### 当前任务状态
- 任务清单: `.anws/v5/05_TASKS.md`
- 总任务数: 40, P0: 27, P1: 9, P2: 0
- Sprint 数: 4
- Wave 12 建议: T1.4.1, T1.4.2, T7.1.1 → 收口 INT-S4（真实宿主冒烟）；INT-S1 可含 storage_smoke
- 最近更新: `2026-05-02`

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

<!-- AUTO:END -->

---
> **状态自检**: 准备好了？提醒用户运行 `/quickstart` 开始吧。
