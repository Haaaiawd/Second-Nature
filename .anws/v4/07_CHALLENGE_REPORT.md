# Second Nature v4 架构质疑报告 (第二轮)

> **审查日期**: 2026-03-31  
> **审查范围**: `.anws/v4` 全部设计文档 + 代码实现 + OpenClaw 官方文档交叉验证  
> **审查重点**: OpenClaw 宿主集成真实性、闭环完整性（连接处理→输出）、运行时可行性  
> **方法论**: Sequential Thinking 深度推演 (8步) + OpenClaw 官方文档验证 + 代码-设计交叉审计  
> **累计轮次**: 2

---

## 📋 问题总览

> 此目录随每轮审查同步维护。已解决的轮次仅保留此摘要行，详细内容在确认修复后删除。

### 第一轮（2026-03-27，3/3 Critical 未修复，4/4 High 未修复，1/1 Medium 未修复）

| ID | 严重度 | 摘要 | 状态 |
|----|--------|------|------|
| C1-C3 | 🔴 | 文档-实现脱节/闭环断裂/治理失效 | ⏳ 待修复 |
| H1-H4 | 🟠 | Packaging/Heartbeat/Scope/宿主集成缺失 | ⏳ 待修复 |
| M1 | 🟡 | 跳过任务拆解但声称就绪 | ⏳ 待修复 |

### 第二轮（2026-03-31，当前活跃）

> 2026-04-11 复核注记：
> 当前仓库已修复同步注册、最小 activation spine、status truth split 与 deployable runtime artifact。
> 因此本轮问题中与“插件完全不可作为最小可发布 surface”直接相关的判断已部分失效；
> 但与 heartbeat host bridge、scope routing 真实性、完整 connector 闭环相关的质疑仍然成立。

| ID | 严重度 | 摘要 | 状态 |
|----|--------|------|------|
| R2-C1 | 🔴 | Heartbeat Entry 不存在于 OpenClaw Plugin API — 根本性架构误解 | ⏳ 待修复 |
| R2-C2 | 🔴 | Scope Router 缺少触发源分类机制 — 设计前提不成立 | ⏳ 待修复 |
| R2-C3 | 🔴 | 闭环断裂：入口（heartbeat）和出口（connector API）双空 | ⏳ 待修复 |
| R2-C4 | 🔴 | REQ 覆盖率虚假声明 — 6 个 REQ 缺失实现但声称"完全覆盖" | ⏳ 待修复 |
| R2-H1 | 🟠 | Packaging 复杂度被低估 — 原生模块兼容性未解决 | ⏳ 待修复 |
| R2-H2 | 🟠 | 平台 API 客户端零实现 — Moltbook/InStreet/EvoMap 全是空接口 | ⏳ 待修复 |
| R2-H3 | 🟠 | 任务清单基于未验证前提 — S2 sprint 可能需完全重写 | ⏳ 待修复 |
| R2-H4 | 🟠 | 验收标准普遍模糊 — 多数使用不可量化的形容词 | ⏳ 待修复 |
| R2-M1 | 🟡 | HEARTBEAT.md 文件缺失 — OpenClaw 约定未遵循 | ⏳ 待修复 |
| R2-M2 | 🟡 | Guidance 与 Connector 之间缺少真实数据流验证 | ⏳ 待修复 |

---

## 🎯 审查方法论

本次审查模式: **FULL**（设计 + 任务 + OpenClaw 官方文档交叉验证）

1. **设计审查** (design-reviewer 三维框架) — 执行 — 系统设计 / 运行模拟 / 工程实现
2. **任务审查** (task-reviewer 启发式) — 执行 — REQ 覆盖 / 前提验证 / 估时合理性
3. **Pre-Mortem** — Sequential Thinking 8步深度推演 + OpenClaw 官方文档验证
4. **合并评定** — 统一严重度分级 + 综合判断

---

## 🔥 第二轮详细审查（当前活跃）

### 📊 本轮问题统计

| 严重度 | 数量 | 占比 |
|--------|------|------|
| Critical | 4 | 40% |
| High | 4 | 40% |
| Medium | 2 | 20% |
| **Total** | **10** | **100%** |

| 维度 | 问题数 |
|------|--------|
| OpenClaw 宿主集成验证 | 3 (C1, C2, M1) |
| 闭环完整性 | 2 (C3, H2) |
| 工程实现可行性 | 2 (H1, H3) |
| 任务覆盖率与质量 | 2 (C4, H4) |
| 数据流验证 | 1 (M2) |

---

# 🔴 Critical 级别

### R2-C1. Heartbeat Entry 不存在于 OpenClaw Plugin API

**严重度**: 🔴 Critical  
**文档**: `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md` §决策1; `control-plane-system.md` §4.2 HeartbeatEntry; `01_PRD.md` §4 US-001  
**ADR 影响**: ADR-005 (需重新定义), ADR-006 (heartbeat service entry 进入发布产物的前提动摇)

**问题描述**:

v4 的核心设计前提是"Second Nature 以 OpenClaw heartbeat 作为自由心跳主入口"，并设计了 `HeartbeatEntry` 组件来 `ingestHeartbeat()`。

但根据 OpenClaw 官方文档验证：

1. **heartbeat 是 LLM 智能体的推理轮次**，不是 plugin 的回调事件
2. OpenClaw plugin API 提供：`registerTool`, `registerHook`, `registerService`, `registerCommand`, `registerHttpRoute`, `on(...)` 等
3. **没有 `onHeartbeat` 或类似的 heartbeat 事件 hook**
4. heartbeat 的工作流程是：Gateway → 主会话 → LLM 读取 HEARTBEAT.md → LLM 生成回复 → 如果是 HEARTBEAT_OK 则丢弃
5. Plugin 的 `service.start()` 只在 Gateway 启动时调用一次，不是每次 heartbeat 轮次时调用

这意味着 v4 设计的 `HeartbeatEntry` 组件在 OpenClaw 的 plugin API 中**根本不存在对应物**。

**OpenClaw 官方文档证据**（来自 `docs.openclaw.ai/gateway/heartbeat`）:
> "心跳在主会话中运行周期性智能体轮次"
> "智能体读取 HEARTBEAT.md 如果存在（workspace context）"
> "如果没有需要关注的事项，回复 HEARTBEAT_OK"

**影响**:
- 整个 v4 的 "heartbeat 主入口" 概念需要重新定义
- ADR-005 的决策基础动摇
- control-plane-system 的架构图中 HeartbeatEntry 组件无法实现
- T2.1.1（heartbeat entry contract）任务的前提不成立

**建议**:

方案 A: 通过 HEARTBEAT.md + Tool Use 间接集成
- 在 HEARTBEAT.md 中指导 LLM 调用 Second Nature 的 tool
- 第二 nature 通过 tool 接收 heartbeat 信号
- 优点：符合 OpenClaw 模型
- 缺点：依赖 LLM 行为，不够确定性

方案 B: 使用独立的内部循环 + OpenClaw cron 触发
- Second Nature 在 service.start() 中启动内部循环
- 通过 OpenClaw cron 定时触发
- 优点：确定性高
- 缺点：与 ADR-005 "heartbeat 为主入口" 的决策冲突

方案 C: 重新定义 "heartbeat" 为 Second Nature 的内部概念
- 不依赖 OpenClaw heartbeat 事件
- 在 service.start() 中建立独立的节律循环
- 优点：完全自主
- 缺点：与 OpenClaw 主会话失去上下文连接

---

### R2-C2. Scope Router 缺少触发源分类机制

**严重度**: 🔴 Critical  
**文档**: `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md` §决策2-3; `control-plane-system.md` §4.2 ScopeRouter, §4.4 Runtime Boundary; `control-plane-system.md` §5.2 ControlPlaneRuntimePort  
**ADR 影响**: ADR-005 (三层边界定义需重新考虑实现路径)

**问题描述**:

ADR-005 定义了三层运行时边界：
1. `Rhythm Scope` — 自由心跳
2. `User Task Scope` — 用户明确任务
3. `User Reply Scope` — 用户直聊回复

设计文档中 `ScopeRouter` 负责根据 `Trigger Source` 区分这三种输入。但 OpenClaw plugin API **不提供触发源分类**：

- Plugin 注册的 `command` 被调用时，无法知道是用户直接输入还是 LLM tool use
- Plugin 注册的 `tool` 被调用时，无法区分是 heartbeat 轮中的调用还是用户任务中的调用
- Plugin 注册的 `service` 只在 Gateway 启动时调用一次
- OpenClaw 没有提供 `onUserMessage` 或 `onUserTask` 事件

这意味着 `ScopeRouter` 的设计前提（系统能明确知道触发源类型）在当前的 OpenClaw plugin API 下**无法可靠实现**。

**影响**:
- 三层运行时边界无法在 plugin 层实现
- T2.1.2（runtime scope router）任务的前提不成立
- T6.1.1（light continuity contract）依赖 scope router，也无法实现
- "用户明确任务不受节律裁决" 的产品承诺无法在技术层面保证

**建议**:

方案 A: 通过 tool 参数显式传递 scope
- 在 tool 定义中增加 `scope` 参数
- 依赖 LLM 在调用时正确传递
- 风险：LLM 可能传错

方案 B: 放弃 plugin 层 scope routing，改为 HEARTBEAT.md 指导
- 在 HEARTBEAT.md 中指导 LLM 区分场景
- 风险：依赖 LLM 行为，不够确定

方案 C: 重新定义边界为 "功能边界" 而非 "运行时边界"
- 不试图在运行时区分 scope
- 改为在功能设计上保证用户任务不被节律影响
- 风险：产品体验可能不如设计预期

---

### R2-C3. 闭环断裂：入口和出口双空

**严重度**: 🔴 Critical  
**文档**: `01_PRD.md` §2.2; `02_ARCHITECTURE_OVERVIEW.md` §1.1 C4 图; `control-plane-system.md` §4.3 Data Flow  
**关联需求**: [REQ-014], [REQ-017], [REQ-018]

**问题描述**:

追踪一个完整的操作链路（Agent 在 heartbeat 轮中决定在 Moltbook 发布帖子）：

```
OpenClaw heartbeat → Second Nature 感知 → ContinuitySnapshot → 
RhythmEngine → IntentPlanner → GuardLayer → allow → 
GuidanceBridge → EffectDispatcher → ConnectorSystem → 
Moltbook API → 结果写回 → observability 记录
```

实际代码状态：

| 环节 | 设计 | 代码 | 状态 |
|------|------|------|------|
| 入口触发 | ingestHeartbeat() | ❌ 不存在 | 断裂 |
| Snapshot 构建 | buildContinuitySnapshot() | ❌ 不存在 | 断裂 |
| 节律引擎 | RhythmEngine | ❌ 不存在 | 断裂 |
| 意图规划 | IntentPlanner | ✅ 存在 | 完整 |
| 守卫评估 | GuardLayer | ✅ 存在 | 完整 |
| Guidance 请求 | GuidanceBridge | ⚠️ 部分存在 | 部分 |
| 效果分发 | EffectDispatcher | ✅ 存在 | 完整 |
| Connector 执行 | executeCapability() | ⚠️ framework 存在，API 客户端空 | 断裂 |
| 状态写回 | state-system | ✅ 完整 | 完整 |
| 审计记录 | observability-system | ✅ 完整 | 完整 |

**关键发现**:
- **入口断裂**: 没有东西能触发整条链（R2-C1 的延伸）
- **出口断裂**: 所有 3 个 connector 的 API 客户端都是空接口
- **中间完整**: planning、guarding、dispatching 有代码但无法被调用

这意味着整个 "连接处理到输出" 的闭环在代码层是断裂的。文档设计得很完整，但实现层只有中间部分有代码。

**影响**:
- 产品无法运行任何完整的操作
- 即使修复了入口问题，connector 也无法真正与平台交互
- 7 天黑客松周期内无法同时修复入口和出口

**建议**:
1. 优先修复入口（R2-C1），确定 heartbeat 集成策略
2. 选择 1 个平台（建议 Moltbook）优先实现 API 客户端
3. 建立端到端的最小可运行链路，再扩展其他平台

---

### R2-C4. REQ 覆盖率虚假声明

**严重度**: 🔴 Critical  
**文档**: `05_TASKS.md` §9 US-REQ 映射表; `02_ARCHITECTURE_OVERVIEW.md` §2.6 系统边界矩阵  
**关联需求**: [REQ-002], [REQ-003], [REQ-004], [REQ-007], [REQ-008], [REQ-019 部分]

**问题描述**:

05_TASKS.md §9 声称："**所有 5 个 User Story 已被以上任务链完全覆盖**"。但基于任务审查的 6 大检测 Pass，实际覆盖率存在严重缺口：

**REQ 覆盖率矩阵**:

| REQ-ID | 需求描述 | 优先级 | 关联任务 | 状态 |
|--------|---------|:------:|---------|:----:|
| REQ-001 | CLI command surface | P0 | T1.2.1 ✅ | ✅ 完整 |
| REQ-002 | Moltbook connector capability | P0 | ❌ **无实现任务** | ❌ GAP |
| REQ-003 | InStreet connector capability | P0 | ❌ **无实现任务** | ❌ GAP |
| REQ-004 | EvoMap connector capability | P1 | ❌ **无实现任务** | ❌ GAP |
| REQ-005 | Plugin packaging | P0 | T1.1.1, T1.2.2 ✅ | ✅ 完整 |
| REQ-006 | Service surface | P0 | T1.2.1 ✅ | ✅ 完整 |
| REQ-007 | API-first + CLI fallback | P0 | ❌ **无实现任务** | ❌ GAP |
| REQ-008 | 验证恢复 | P1 | ❌ **无实现任务** | ❌ GAP |
| REQ-019 | Heartbeat 决策记录 | P0 | T4.1.1 ⚠️ **部分覆盖** | ⚠️ 不完整 |

**User Story 完整性**:

| US-ID | 标题 | 涉及系统 | 关键缺失 | 独立可测 | 状态 |
|-------|------|---------|----------|:--------:|:----:|
| US-001 | Heartbeat 主入口 | control-plane | heartbeat 集成方式未定义 | ❌ | ⚠️ 阻塞 |
| US-002 | Moltbook 社交探索 | connector | **API 客户端零实现** | ❌ | ❌ 断裂 |
| US-003 | InStreet 互动保活 | connector | **API 客户端零实现** | ❌ | ❌ 断裂 |
| US-004 | Plugin 分发 | cli | 原生模块兼容性未验证 | ⚠️ | ⚠️ 风险 |
| US-005 | Heartbeat 决策可审计 | observability | 部分覆盖 | ⚠️ | ⚠️ 不完整 |

**关键发现**:
- **6 个 REQ（37.5%）缺失实现任务**，但文档声称"完全覆盖"
- **US-002 和 US-003 的核心价值（平台连接）无法交付** — connector framework 存在，但 API 客户端全部为空
- T5.1.1 只是 connector routing 框架设计，不包含任何平台的真实 API 对接

**影响**:
- 产品无法展示核心价值（与 Moltbook/InStreet/EvoMap 的真实连接）
- 即使修复了 heartbeat 入口问题，也无法执行任何平台操作
- "完全覆盖"的声明误导团队，隐藏了 40% 的实现缺口

**建议**:
1. 移除 §9 中的"完全覆盖"声明，改为"设计覆盖完整，实现覆盖 62.5%"
2. 增加任务：
   - T5.2.1: Moltbook API 客户端实现（认证 + feed.read + post.publish）
   - T5.2.2: InStreet API 客户端实现（认证 + notification.list + agent.heartbeat）
   - T5.3.1: API-first + CLI fallback 策略验证
   - T5.3.2: 验证恢复机制实现
3. 更新 Sprint 计划，S3 应包含至少 1 个平台的完整 API 客户端实现

---

## 🟠 High 级别

### R2-H1. Packaging 复杂度被低估

**严重度**: 🟠 High  
**文档**: `ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md` §决策2; `cli-system.md` §4.4 Artifact Boundary; `05_TASKS.md` T1.1.1-T1.2.2  
**ADR 影响**: ADR-006 (需要补充原生模块兼容性策略)

**问题描述**:

ADR-006 要求构建自足 runtime artifact package，但低估了实现复杂度：

1. **jiti 加载机制**: OpenClaw 通过 jiti 运行时编译 TypeScript，需要能解析所有 import 依赖
2. **原生模块问题**: `better-sqlite3` 是原生模块，需要编译
3. **npm install --ignore-scripts**: OpenClaw 安装插件时不运行 lifecycle 脚本，原生模块可能无法编译
4. **依赖图闭合**: src/cli/index.ts → src/core/second-nature/ → src/storage/ → better-sqlite3，整条链都需要在发布包内可解析

T1.1.1 估时 4h 建立构建边界，但这需要研究：
- OpenClaw 的 jiti 加载机制
- 依赖解析策略
- 原生模块跨平台兼容性
- 发布包大小限制

**影响**:
- 如果原生模块无法在目标机器上工作，整个 state-system 崩溃
- 发布包可能过大，影响安装体验
- T1.x 系列任务的估时可能严重不足

**建议**:
1. 调研 OpenClaw 其他插件（如 voice-call）如何处理原生模块
2. 考虑使用 `better-sqlite3` 的预编译版本
3. 或者考虑使用纯 JS 的 SQLite 驱动（如 `sql.js`）
4. 在 T1.1.1 中增加 POC 验证步骤

---

### R2-H2. 平台 API 客户端零实现

**严重度**: 🟠 High  
**文档**: `connector-system.md` §4.2 Core Components; `connector-system.detail.md` §1-2; `05_TASKS.md`  
**关联需求**: [REQ-002], [REQ-003], [REQ-004], [REQ-007], [REQ-008]

**问题描述**:

三个目标平台的 API 客户端状态：

| 平台 | 能力定义 | API 客户端接口 | API 客户端实现 | 官方 API 文档引用 |
|------|---------|---------------|---------------|------------------|
| Moltbook | feed.read, post.publish, comment.reply | ✅ 定义 | ❌ 空接口 | ❌ 无 |
| InStreet | notification.list, message.send, comment.reply, agent.heartbeat | ✅ 定义 | ❌ 空接口 | ❌ 无 |
| EvoMap | agent.register, agent.heartbeat, work.discover, task.claim | ✅ 定义 | ❌ 空接口 | ❌ 无 |

Connector framework（contract、failure taxonomy、route planner、policy layer）实现得很完整，但**所有平台的 API 客户端都是空接口**。

更严重的是：没有找到任何 Moltbook/InStreet/EvoMap 的官方 API 文档引用。这意味着：
- 如果这些平台真实存在，需要找到 API 文档才能实现
- 如果这些平台不存在或 API 不开放，connector 的设计无法落地
- 7 天黑客松周期内完成 3 个平台的 API 客户端实现不现实

**影响**:
- 即使修复了入口问题，connector 也无法真正与平台交互
- 整个 "连接处理到输出" 的闭环无法完成
- 产品无法展示核心价值

**建议**:
1. 确认三个平台的 API 可用性和文档位置
2. 优先实现 1 个平台的最小 API 客户端（认证 + 1 个能力）
3. 如果平台 API 不可用，考虑使用 mock 或替代平台

---

### R2-H3. 任务清单基于未验证前提

**严重度**: 🟠 High  
**文档**: `05_TASKS.md` 全部; `01_PRD.md` §4 User Stories  
**关联需求**: [REQ-014], [REQ-015], [REQ-016], [REQ-017], [REQ-018]

**问题描述**:

05_TASKS.md 定义了 11 个任务（含 3 个里程碑），但存在以下问题：

1. **前提未验证**:
   - T2.1.1（heartbeat entry contract）假设 OpenClaw 提供 heartbeat 事件 — 实际不提供
   - T2.1.2（runtime scope router）假设 plugin 能区分触发源 — 实际不能
   - 如果前提不成立，S2 sprint（Heartbeat Spine）需要完全重新设计

2. **覆盖缺口**:
   - 没有任务涉及 Moltbook/InStreet/EvoMap 的 API 客户端实现
   - 没有任务涉及 HEARTBEAT.md 的创建和配置
   - 没有任务涉及 connector 的真实平台对接
   - 没有任务涉及 OpenClaw 宿主的实际集成验证（INT-S3 是手动验证）

3. **估时问题**:
   - 总估时约 50 小时，但基于 "所有前提成立" 的假设
   - T1.1.1（4h）需要研究 jiti 加载、依赖解析、原生模块兼容性
   - T2.1.1（6h）需要重新设计 heartbeat 集成策略

**影响**:
- 按当前任务清单执行可能走错方向
- 实际工作量可能远超预估
- Sprint 计划可能无法按时完成

**建议**:
1. 先修复 R2-C1 和 R2-C2，确定技术可行性
2. 重新设计 S2 sprint 任务
3. 增加 API 客户端实现任务
4. 增加 HEARTBEAT.md 配置任务

---

### R2-H4. 验收标准普遍模糊

**严重度**: 🟠 High  
**文档**: `05_TASKS.md` 所有任务的验收标准  
**关联 Pass**: task-reviewer Pass B（歧义检测）

**问题描述**:

基于任务审查的 Pass B（歧义检测），05_TASKS.md 中的验收标准普遍使用模糊语言，不满足 SMART 原则（Specific, Measurable, Achievable, Relevant, Time-bound）。

**模糊形容词扫描结果**:

| 任务 | 模糊验收标准 | 问题 | 建议量化方式 |
|------|-------------|------|-------------|
| T1.1.1 | "CLI runtime dependencies **完整且最小**" | "最小"无量化 | 指明最大包体积（如 < 10MB）或最大依赖数（如 < 15 个） |
| T2.0.1 | "能**接入** heartbeat 信号" | "接入"机制模糊 | 明确：通过 HEARTBEAT.md + tool use / service bridge / cron trigger |
| T2.2.1 | "支持**默认静默**" | "默认"无比例 | 量化：≥80% heartbeat 轮次返回 HEARTBEAT_OK |
| T2.2.2 | "Guard 逻辑**正确**" | "正确"无标准 | 给出具体阻断规则列表 + 测试用例 |
| T4.1.1 | "决策记录**完整**" | "完整"无定义 | 列出必须记录的字段（timestamp, decision, rationale, scope, outcome） |
| T6.1.1 | "Light continuity **有效**" | "有效"无度量 | 定义：用户连续 2 次回复能感知上下文 |

**未量化的性能/质量需求**:

| 任务 | 需求 | 问题 | 建议 |
|------|------|------|------|
| T1.1.1 | "构建时间合理" | 无时间目标 | < 30s on typical dev machine |
| T2.1.1 | "ContinuitySnapshot 构建性能可接受" | 无延迟目标 | < 100ms per snapshot |
| T5.1.1 | "Connector routing 快速" | 无延迟目标 | Route planning < 50ms |

**含糊代词示例**:
- T2.1.2: "**它**能根据触发源区分三层边界" — "它"指 ScopeRouter，但触发源从哪来？
- T1.2.2: "确保**系统**可在 OpenClaw 安装后直接运行" — "系统"是指 plugin 还是 Second Nature 整体？

**影响**:
- 验收时无法客观判断任务是否完成
- 不同开发者对"完整""正确""最小"的理解不一致
- 无法设计有效的验证测试

**建议**:
1. 将所有形容词替换为量化指标或具体列表
2. 为性能需求增加目标值（延迟、吞吐、资源占用）
3. 将含糊代词替换为明确的实体名称
4. 为每个验收标准增加验证方法（单元测试 / 集成测试 / 手动验证 + 具体步骤）

---

## 🟡 Medium / 🟢 Low 级别

### R2-M1. HEARTBEAT.md 文件缺失

**严重度**: 🟡 Medium  
**文档**: `control-plane-system.md` §12 部署与运维; OpenClaw 官方文档 `/gateway/heartbeat`  
**关联需求**: [REQ-014]

**问题描述**:

OpenClaw 官方文档明确说明 heartbeat 会读取工作区中的 `HEARTBEAT.md` 文件来指导行为。但项目中不存在此文件。

**影响**:
- OpenClaw heartbeat 轮次没有 Second Nature 的行为指导
- 即使实现了 heartbeat 集成，LLM 也不知道该做什么

**建议**:
1. 创建 `HEARTBEAT.md` 文件，定义 Second Nature 的 heartbeat 行为
2. 参考 OpenClaw 文档中的模板

---

### R2-M2. Guidance 与 Connector 之间缺少真实数据流验证

**严重度**: 🟡 Medium  
**文档**: `control-plane-system.md` §4.3 Data Flow; `behavioral-guidance-system.md` §4.3 Data Flow  
**关联需求**: [REQ-010], [REQ-011]

**问题描述**:

设计文档中 guidance payload 在 effect dispatch 之前被请求，但：
- guidance 系统不直接调用 connector
- connector 执行不需要 guidance payload
- guidance payload 只用于 LLM 生成时的上下文增强

这意味着 guidance 和 connector 之间的数据流在设计上可能不清晰：guidance 是用于 connector 执行前的 LLM 生成，还是 connector 执行后的内容生成？

**影响**:
- 实现时可能混淆 guidance 的使用时机
- 可能导致 guidance payload 被错误地传递给 connector

**建议**:
1. 在 control-plane-system 详细设计中明确 guidance 的使用时机
2. 增加 guidance 与 connector 之间的数据流图

---

## 📚 附录

### A. Pre-Mortem 分析 (Sequential Thinking 推演)

使用 `sthink` CLI 完成的 8 步失败预演，会话路径:  
`C:\Users\11341\AppData\Local\sthink\sessions\v4-architecture-challenge`

| 步骤 | 关键发现 | 对应问题 |
|------|---------|----------|
| 1 | heartbeat 是 LLM 推理轮次，不是 plugin 事件 | R2-C1 |
| 2 | plugin service.start() 只在启动时调用一次 | R2-C1 |
| 3 | 闭环入口和出口都是空的 | R2-C3 |
| 4 | packaging 需要处理 jiti 加载和原生模块 | R2-H1 |
| 5 | ScopeRouter 缺少触发源分类机制 | R2-C2 |
| 6 | 平台 API 客户端零实现，无官方文档引用 | R2-H2 |
| 7 | 任务清单基于未验证前提 | R2-H3 |
| 8 | 结论收敛：需要重新定义 heartbeat 集成策略 | 综合 |

### B. 假设验证结果

| 假设 | 验证方法 | 结果 | 风险 |
|------|---------|------|:----:|
| OpenClaw 提供 heartbeat 事件给 plugin | 查阅官方文档 | ❌ 不提供，heartbeat 是 LLM 轮次 | 🔴 Critical |
| Plugin 能区分 user task vs user reply | 查阅 plugin API 文档 | ❌ 无此分类机制 | 🔴 Critical |
| better-sqlite3 能在 npm install --ignore-scripts 下工作 | 分析 OpenClaw 安装机制 | ⚠️ 可能无法编译原生模块 | 🟠 High |
| Moltbook/InStreet/EvoMap API 可用 | 搜索官方 API 文档 | ❌ 未找到文档引用 | 🟠 High |
| HEARTBEAT.md 是可选的 | 查阅官方文档 | ⚠️ 可选但强烈推荐 | 🟡 Medium |

### C. OpenClaw 官方文档关键引用

| 文档 | 关键内容 | 对 v4 的影响 |
|------|---------|-------------|
| `/gateway/heartbeat` | heartbeat 在主会话中运行周期性智能体轮次 | R2-C1: 不是 plugin 事件 |
| `/gateway/heartbeat` | 智能体读取 HEARTBEAT.md 如果存在 | R2-M1: 需要创建此文件 |
| `/tools/plugin` | plugin 通过 jiti 加载 TypeScript | R2-H1: 依赖解析问题 |
| `/tools/plugin` | plugins install 使用 npm install --ignore-scripts | R2-H1: 原生模块问题 |
| `/tools/plugin` | plugin 可注册 tool/hook/service/command | R2-C2: 无 heartbeat hook |
| `/automation/cron-vs-heartbeat` | heartbeat 适合周期性感知，cron 适合精确定时 | ADR-005 决策部分正确 |

### D. ADR 影响追踪

> **提醒**: 如果本次审查发现需要修改 ADR,请检查以下引用链:

| ADR 文件 | 引用该 ADR 的 SYSTEM_DESIGN | 影响说明 |
|---------|---------------------------|---------|
| [ADR-005](../03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md) | [control-plane-system.md](../04_SYSTEM_DESIGN/control-plane-system.md) §8 | heartbeat 主入口的实现路径需要重新定义 |
| [ADR-005](../03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md) | [cli-system.md](../04_SYSTEM_DESIGN/cli-system.md) §8 | service surface 暴露 heartbeat entry 的方式需要调整 |
| [ADR-005](../03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md) | [behavioral-guidance-system.md](../04_SYSTEM_DESIGN/behavioral-guidance-system.md) §8 | user reply scope 的轻量边界实现路径需要重新考虑 |
| [ADR-006](../03_ADR/ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md) | [cli-system.md](../04_SYSTEM_DESIGN/cli-system.md) §8 | packaging 策略需要补充原生模块兼容性 |

**修改 ADR 后的行动**:
1. 更新 ADR-005，重新定义 heartbeat 集成策略
2. 更新 ADR-006，补充原生模块兼容性策略
3. 检查 control-plane-system.md 是否需要调整 heartbeat entry 设计
4. 检查 cli-system.md 是否需要调整 packaging 设计
5. 检查 behavioral-guidance-system.md 是否需要调整 user reply scope 设计

---

## 📋 建议行动清单

### P0 - 立即处理 (阻塞)
1. **[R2-C1]** 重新定义 heartbeat 集成策略 — 选择方案 A/B/C 之一，更新 ADR-005
2. **[R2-C2]** 重新设计 scope routing — 确定在 OpenClaw plugin API 限制下如何实现三层边界
3. **[R2-C3]** 建立最小可运行链路 — 优先修复入口，选择 1 个平台实现 API 客户端
4. **[R2-C4]** 修正 REQ 覆盖率声明 — 移除"完全覆盖"误导，补充 connector API 客户端实现任务

### P1 - 近期处理 (重要)
1. **[R2-H1]** 验证 packaging 可行性 — POC 测试 jiti 加载和原生模块兼容性
2. **[R2-H2]** 确认平台 API 可用性 — 找到 Moltbook/InStreet/EvoMap 的 API 文档
3. **[R2-H3]** 重新设计任务清单 — 基于修复后的架构重新拆解任务
4. **[R2-H4]** 量化所有验收标准 — 移除模糊形容词，增加具体度量指标

### P2 - 持续改进 (优化)
1. **[R2-M1]** 创建 HEARTBEAT.md 文件
2. **[R2-M2]** 明确 guidance 与 connector 的数据流

---

## 🚦 最终判断

- [ ] 🟢 项目可继续，风险可控
- [x] 🟡 **项目可继续，但需先解决 P0 问题**
- [ ] 🔴 项目需要重新评估

**判断依据**:

第二轮审查（含任务审查补充）发现了比第一轮更深层且更系统的问题：

1. **v4 的核心设计前提存在根本性误解** — OpenClaw heartbeat 不是 plugin 事件，这意味着整个 "heartbeat 主入口" 的概念需要重新定义。这不是实现问题，而是架构理解问题。

2. **Scope Router 的设计前提不成立** — OpenClaw plugin API 不提供触发源分类，三层运行时边界无法在 plugin 层实现。

3. **闭环的入口和出口都是空的** — 即使修复了架构理解问题，connector API 客户端也需要从零实现。

4. **任务覆盖率虚假声明** — 声称"完全覆盖"但实际 37.5% 的 REQ 缺失实现任务，US-002/003 的核心价值（平台连接）无法交付。

5. **验收标准普遍模糊** — 多数使用"完整""正确""最小"等不可量化形容词，无法客观验收。

但项目**不需要重新评估**，因为：
- 中间层（planning、guarding、dispatching、state、observability）的实现是扎实的
- Connector framework 的设计是合理的
- Behavioral guidance 的分层设计是清晰的
- 问题主要集中在 "如何与 OpenClaw 集成" 和 "如何连接真实平台" 两个边界上
- 所有 P0 问题都有明确的修复路径

**关键建议（优先级排序）**:
1. **先花 1-2 天解决 R2-C1**（heartbeat 集成策略），这是所有后续工作的前提
2. **同时确认平台 API 可用性**（R2-H2），这决定 connector 能否落地
3. **选择 1 个平台优先实现 API 客户端**（建议 Moltbook），建立端到端最小可运行链路
4. **基于以上结论重新设计 S2-S3 sprint**，移除"完全覆盖"声明，补充缺失任务
5. **量化所有验收标准**，确保每个任务都可客观验收

**预期修复时间**: 2-3 天（假设 OpenClaw heartbeat 集成和平台 API 可用）

---

## 📋 第一轮问题摘要（已归档详情）

| ID | 严重度 | 摘要 | 状态 |
|----|--------|------|------|
| C1 | 🔴 | 文档-实现完全脱节：核心承诺零实现但声称 Active | ⏳ 待修复 |
| C2 | 🔴 | 闭环彻底断裂：可安装-可唤醒-可持续运行三环全断 | ⏳ 待修复 |
| C3 | 🔴 | 架构治理失效：AGENTS.md 误导标记为"最新架构版本" | ⏳ 待修复 |
| H1 | 🟠 | Runtime Artifact Packaging 完全未修复 | ⏳ 待修复 |
| H2 | 🟠 | Heartbeat 主入口无任何实现 | ⏳ 待修复 |
| H3 | 🟠 | 三层 Scope 边界零实现 | ⏳ 待修复 |
| H4 | 🟠 | OpenClaw 宿主集成不完整 | ⏳ 待修复 |
| M1 | 🟡 | v4 跳过任务拆解阶段但声称版本就绪 | ⏳ 待修复 |

> **注意**: 第一轮问题与第二轮问题有重叠，但第二轮提供了更深入的根本原因分析。建议优先处理第二轮的 R2-C1/R2-C2/R2-C3，因为它们解决了第一轮问题的根本原因。