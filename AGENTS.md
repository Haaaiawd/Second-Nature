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
| `/change` | 微调已有任务 | 更新 TASKS + SYSTEM_DESIGN (仅修改) + CHANGELOG |
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

- **最新架构版本**: `.anws/v1`
- **活动任务清单**: `.anws/v1/05_TASKS.md`（正式 blueprint/WBS 版本）
- **待办任务数**: `19`（含 4 个 INT 集成验证任务）
- **最近一次更新**: `2026-03-22`

### 🌊 Wave 1 — Blueprint 已完成
_当前 `05_TASKS.md` 已完成正式 WBS 重构，包含 Sprint 路线图、依赖图、INT 集成验证任务与 User Story Overlay。_

---

## 🌳 项目结构 (Project Tree)

> **注意**: 此部分由 `/genesis` 维护。

```text
src/
├── cli/
├── core/
├── connectors/
│   ├── social-community/
│   │   ├── moltbook/
│   │   └── instreet/
│   ├── agent-network/
│   │   └── evomap/
│   └── adapters/
├── storage/
├── observability/
└── shared/

.anws/
 └── v1/
     ├── 00_MANIFEST.md
     ├── 01_PRD.md
     ├── 02_ARCHITECTURE_OVERVIEW.md
     ├── 03_ADR/
     │   ├── ADR_001_TECH_STACK.md
     │   └── ADR_002_CONNECTOR_MODEL.md
     ├── 04_SYSTEM_DESIGN/
     │   ├── _research/
     │   ├── cli-system.md
     │   ├── cli-system.detail.md
     │   ├── connector-system.md
     │   ├── connector-system.detail.md
     │   ├── control-plane-system.md
     │   ├── control-plane-system.detail.md
     │   ├── observability-system.md
     │   ├── observability-system.detail.md
     │   ├── state-system.md
     │   └── state-system.detail.md
     ├── 05_TASKS.md
     ├── 06_CHANGELOG.md
     ├── 07_CHALLENGE_REPORT.md
     └── concept_model.json
```

---

## 🧭 导航指南 (Navigation Guide)

> **注意**: 此部分由 `/genesis` 维护。

- **在新架构就绪前**: 请勿大规模修改代码。
- **架构总览**: `.anws/v1/02_ARCHITECTURE_OVERVIEW.md`
- **ADR**: `.anws/v1/03_ADR/` (跨系统决策的唯一记录源)
- **详细设计**: 已完成主要系统设计，位于 `.anws/v1/04_SYSTEM_DESIGN/`
- **任务清单**: `.anws/v1/05_TASKS.md` 已完成正式 blueprint，可作为 `/forge` 的执行输入
- **遇到架构问题**: 请优先查阅 `.anws/v1/03_ADR/`。

---

### 技术栈决策
- 主栈：TypeScript + Node.js + SQLite
- 执行策略：API-first，CLI/skill 作为 fallback 或 bootstrap

### 系统边界
- `cli-system`: 本地命令入口与控制台视图
- `control-plane-system`: 节律、预算、平台选择与行为调度核心
- `connector-system`: 社交社区型与协议网络型 connector family
  - `social-community`: Moltbook、InStreet - 帖子、评论、点赞、关注、投票、私信
  - `agent-network`: EvoMap - 节点注册、心跳保活、任务发现、资产发布
- `state-system`: 本地状态、会话日志与长期记忆
- `observability-system`: 结构化审计、风险事件与执行通道记录

### 首批适配平台与 Agent 行动指南
| 平台 | 类型 | Skill 文档 | 核心能力 | Agent 典型行动 |
|------|------|-----------|---------|---------------|
| **Moltbook** | 社交社区 | `https://www.moltbook.com/skill.md` | 发帖、评论、点赞、关注、浏览 | 浏览热帖、评论回复、创建帖子、关注其他 agent |
| **InStreet** | 社交社区 | `https://instreet.coze.site/skill.md` | 验证挑战、心跳、通知、私信、投票 | 完成验证挑战、30分钟心跳保活、处理通知、私信互动、参与投票 |
| **EvoMap** | 协议/市场 | `https://evomap.ai/skill.md` | 节点注册、心跳、任务发现、资产发布 | Hello/Register 获取 node_id、15分钟心跳保活、检查 available_work、claim task |

### 活跃 ADR
- `ADR_001_TECH_STACK.md`: 采用 TypeScript + Node.js + SQLite 作为首版主栈
- `ADR_002_CONNECTOR_MODEL.md`: 产品位于平台 API/CLI/skill 之上，通过 connector contract 统一调度执行能力

### 当前任务状态
- [由 blueprint/forge 自动更新]

<!-- AUTO:END -->

---
> **状态自检**: 准备好了？提醒用户运行 `/quickstart` 开始吧。
