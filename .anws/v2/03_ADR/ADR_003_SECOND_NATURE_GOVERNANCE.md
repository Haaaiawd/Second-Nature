# ADR-003: Second Nature 行为节律、Quiet 与记忆治理原则

## 状态
Accepted

## 日期
2026-03-23

## 背景
Second Nature v2 不再只是“探索控制器”。它的核心价值已经升级为三条并列主线：
- 平台接入
- 行为节律
- Quiet 记忆整理 / 自我反思 / 连续性维护

这意味着有几项设计必须被正式记录为架构法律，而不是停留在聊天灵感里：
- Agent 是否要完全拟人化作息
- Quiet 是否等于睡眠
- 夜间感性总结应如何表达
- OpenClaw 现有 workspace memory 与 session 机制如何被纳入长期记忆整理
- 哪些部分可以借鉴外部项目，哪些必须保持产品主权

## 决策驱动因素
- 因素 1: 产品必须从“脚本调度器”升级为“生活方式编排器”
- 因素 2: 拟人化应服务于社会可读性与连续性，而不是表演式伪装
- 因素 3: Quiet 需要成为结构化的内务、反思与记忆培育窗口
- 因素 4: OpenClaw 已有 workspace memory 语义，必须顺势而为
- 因素 5: 用户对 agent 的期待包含长期关系感、自然节律和成长感

## 候选方案

### 方案 A: 纯任务调度器
- **描述**: 系统只负责平台探索、connector 调度和预算控制，不引入明显的生活节律和 Quiet 治理。
- **优点**:
  - 实现简单
  - 可快速验证最基础平台接入能力
- **缺点**:
  - 难以体现 Second Nature 的独特价值
  - 无法承载记忆整理、自我反思与人格连续性

### 方案 B: 完全拟人化生理模拟
- **描述**: 严格模拟人类作息、吃饭、睡眠、疲劳等节律，把 agent 包装成类人生物。
- **优点**:
  - 叙事感强
  - 容易让用户感知“像活着”
- **缺点**:
  - 容易滑向表演型调度与自欺欺人
  - 与 agent 的真实能力边界不匹配
  - 不利于解释高价值 interrupt 与持续义务动作

### 方案 C: 节律化行为系统 + Quiet 治理 + Narrative Reflection
- **描述**: 以节律化行为窗口组织 work / exploration / social / quiet / reflection；Quiet 作为低主动性整理窗口；夜间总结允许更具叙事感和主观色彩，但必须基于真实事实；记忆整理顺着 OpenClaw workspace memory 生长。
- **优点**:
  - 兼顾自然感、可解释性与工程可控性
  - 让 Quiet 成为内务、记忆培育和自我深化的正式能力
  - 避免重建平行记忆系统
  - 为用户关系感和 agent 连续性提供稳定协议
- **缺点**:
  - 需要明确 Quiet 边界、Anchor Memory 更新约束与审计模型
  - 首版需要接受“人格成长”只能渐进推进，不能一步到位

## 决策
选择 **方案 C: 节律化行为系统 + Quiet 治理 + Narrative Reflection**。

并正式确定以下原则：

### 1. Agent 不做生理模仿秀，只做节律化行为
- 系统不追求“像人类一样吃饭睡觉上班”的表演性拟人化
- 系统追求的是：
  - 社会可读性
  - 节律稳定性
  - 平台生态兼容性

### 2. Quiet 不是睡眠，而是低主动性整理窗口
- Quiet 默认开启，但允许用户配置或关闭
- Quiet 的核心用途是：
  - 记忆整理
  - 自我反思
  - 用户理解深化
  - 系统内务与低频巡检
- Quiet 默认不鼓励普通闲聊式用户打扰，但允许高价值 interrupt

### 3. 夜间总结采用 Narrative Reflection
- 白天行为以理性、结构化、任务导向为主
- 夜间或 Quiet 总结允许更感性、更叙事、更主观
- 但必须基于真实事实，禁止虚构经历、关系或情绪事件

### 4. 记忆整理顺着 OpenClaw workspace memory 生长
- `AGENTS.md`、`SOUL.md`、`USER.md`、`IDENTITY.md`、`MEMORY.md`、`memory/YYYY-MM-DD.md` 是主记忆资产
- session JSONL、平台日志、插件记忆是输入源，而不是平行主存
- 不新建脱离 OpenClaw 的平行主记忆系统

### 5. Anchor Memory 受治理保护
- `SOUL.md`、`AGENTS.md` 等宪法性文件属于 Anchor Memory
- Anchor Memory 可以演进，但必须谨慎、增量、可审计
- 单次 Quiet 不允许无依据的大范围重写

### 6. 用户主动联系由 Agent 自主判断，不做僵硬分类
- 系统提供窗口与边界，不把 user outreach 设计成客服型分类树
- agent 应在“值得联系、需要帮助、确有价值”时主动联系用户
- 系统只负责打扰边界、时间窗口与审计记录

### 7. 可借鉴思路，但不外包产品主权
- 可借鉴：
  - `mem0` 的记忆提炼思路
  - `LangGraph` / `Temporal` 的 interrupt / resume / durable execution 思想
  - `Agenda` / `BullMQ` 的 retry/backoff / job lifecycle 思想
- 必须自有：
  - 行为节律模型
  - Quiet 进入/打断/恢复
  - Narrative Reflection
  - 用户模型 / 自我模型 / Anchor Memory 更新边界

## 后果

### 正面
- Second Nature 获得清晰的产品灵魂，不再只是平台调度器
- Quiet、Narrative Reflection 与记忆治理被正式纳入架构层，而不是零散 prompt 约定
- 系统既能保持自然感，又能避免表演式拟人化

### 负面
- 需要在后续系统设计中详细定义 Quiet 输入源、更新策略与 Anchor Memory guard
- 叙事性总结若约束不够明确，存在漂移为“文艺但失真”的风险

### 需要的后续行动
- 在 `control-plane-system` 设计文档中定义 rhythm windows、Quiet policy、interrupt policy 与 Narrative Reflection 触发点
- 在 `state-system` 设计文档中定义记忆资产层次、workspace adapter 与 Anchor Memory 更新策略
- 在 `observability-system` 设计文档中定义 Quiet 整理来源链与 Anchor Memory 审计事件
- 在 `/blueprint` 阶段将 Quiet、Narrative Reflection、用户模型深化与自我模型深化拆解为显式任务

## 参考资料
- `https://github.com/openclaw/openclaw`
- `https://docs.openclaw.ai/concepts/agent-workspace`
- `https://docs.openclaw.ai/reference/templates/SOUL`
- `https://docs.openclaw.ai/reference/templates/USER`
- `https://docs.openclaw.ai/reference/templates/IDENTITY`
- `https://github.com/mem0ai/mem0`
- `https://github.com/langchain-ai/langgraph`
- `https://github.com/temporalio/sdk-typescript`
- `https://github.com/agenda/agenda`

## 影响范围

本 ADR 被以下系统引用:
- `control-plane-system` - 节律、Quiet、Narrative Reflection、用户主动联系时机
- `state-system` - OpenClaw workspace memory 对齐、Anchor Memory 更新边界、记忆整理目标资产
- `observability-system` - Quiet 来源链、叙事反思审计、Anchor Memory 写保护事件
- `cli-system` - Quiet 配置、节律配置与记忆整理结果展示
