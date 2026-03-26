# ADR-004: Behavioral Guidance Layer 的系统边界与实现形态

## 状态
Accepted

## 日期
2026-03-26

## 背景
Second Nature v2 已完成主线闭环：平台接入、行为节律、Quiet、Narrative Reflection、observability、plugin packaging 与 operator voice 都已具备正式实现与验证路径。

但 v2 仍缺少一个正式定义的软层能力：agent 的运行时行为气候、内在冲动、人格强化与表达边界仍主要依赖临场生成，没有稳定的架构归属。这导致以下问题：

- 行为风格容易漂移
- Quiet 容易退化为机械整理
- outreach 容易退化为客服式或日报式表达
- SOUL / USER / IDENTITY / MEMORY 虽然存在，但缺少稳定的运行时强化策略

与此同时，用户明确提出以下约束：

- `control-plane-system` 已足够复杂，不应继续膨胀为“心智 + 决策 + 执行”的全能层
- 不做 platform flavor layer，不预设平台文化印象
- 不做教学型 skill 库，不教 agent 如何浏览、回复、发帖
- 不做步骤模板，不把软层退化成 workflow 手册
- 复用 OpenClaw 的人格资产体系，而不是重建人格系统

## 决策驱动因素
- 因素 1: 需要正式定义 agent 行为引导层，而不是停留在聊天约定
- 因素 2: 不能继续把软层职责塞进 control-plane-system
- 因素 3: 必须保留 agent 的主体性，避免系统替它预设平台印象
- 因素 4: 当前只剩约 1 天，必须严格控制复杂度
- 因素 5: v3 当前阶段只做文档设计，不引入重型引擎或新实现复杂度

## 候选方案

### 方案 A: 继续把 guidance 作为 control-plane 内部子模块
- **描述**: 不新增系统，把 runtime atmosphere、impulse、persona reinforcement 与 output guard 继续写在 control-plane-system 内。
- **优点**:
  - 表面上新增文档最少
  - 调用链最直接
- **缺点**:
  - 继续放大 control-plane-system 的复杂度
  - 软层边界不清，容易与决策和执行混淆
  - 不利于后续单独设计和演进

### 方案 B: 独立 `behavioral-guidance-system`，主形态为运行时注入模板
- **描述**: 新增独立系统，负责 runtime atmosphere、behavioral impulses、persona reinforcement 与 output guard 的 guidance assembly；以文本模板和轻量装配为主；不负责决策与执行。
- **优点**:
  - 将软层能力正式独立出来，保护 control-plane 边界
  - 保留 agent 主体性，不把平台印象写死
  - 复用现有 OpenClaw 人格资产与 v2 系统能力
  - 符合当前时间约束，不引入新引擎复杂度
- **缺点**:
  - 新增一个系统，需要补充架构与系统设计文档
  - 后续若真的实现 guidance assembly，需要明确接口与装配点

### 方案 C: Skill-first guidance（大量 skills / prompt 包）
- **描述**: 不新增独立系统，主要通过 skills / prompt 包管理 browsing、reply、outreach、quiet 等行为风格。
- **优点**:
  - 表面灵活，似乎容易增减模板
  - 与 OpenClaw skills 形式接近
- **缺点**:
  - 容易退化成教学型 skill 库
  - 容易把 agent 变成执行培训材料的机器人
  - 软层缺乏正式系统归属，边界持续模糊

## 决策
选择 **方案 B: 独立 `behavioral-guidance-system`，主形态为运行时注入模板**。

并正式确定以下原则：

### 1. Behavioral Guidance 是独立系统
- 新增 `behavioral-guidance-system`
- 它与 `control-plane-system` 强关联，但不并入 control-plane

### 2. Guidance System 只负责 guidance assembly，不负责决策与执行
- 负责：
  - runtime atmosphere
  - behavioral impulses
  - persona reinforcement
  - output guard
- 不负责：
  - 行为决策
  - 平台执行
  - connector route planning
  - 状态持久化
  - 人格资产真相源管理

### 3. 主形态是运行时注入模板，不是教学型 skill 库
- guidance 以模板和轻量装配为主
- 不把 soft layer 设计成“如何浏览 / 如何回复 / 如何发帖”的教学系统

### 4. 不做 platform flavor layer
- 平台规则、通道约束、失败模式等硬信息仍然由现有系统提供
- 平台印象、社区气味、互动节奏由 agent 自己通过浏览和体验形成
- 系统不预设平台文化说明书

### 4.1 Non-Goal 红线必须可执行
- 不允许新增平台文化静态模板库或平台气味素材库
- 不允许 guidance 资产退化为“步骤教学”或“如何浏览/如何回复”的流程说明书
- 不允许 persona reinforcement 成为新的 canonical persona store 或隐式人格真相源

### 5. persona reinforcement 复用 OpenClaw 人格资产体系
- 使用 `SOUL.md`、`USER.md`、`IDENTITY.md`、`MEMORY.md` 作为来源资产
- Guidance System 只做场景化片段选择与强化注入
- 不重建新的 persona store，不新增独立人格真相源

### 6. soft layer 必须保持第一人称、自述风格，但不命令 agent
- behavioral impulses 采用第一人称、自述风格
- 目的是点燃内在倾向，而不是下达操作步骤

### 7. output guard 是正式能力
- 必须约束以下退化：
  - 客服腔
  - 日报腔
  - 教学腔
  - 虚构经历
  - 高相似重复
- 但 output guard 不替代硬治理，只约束表达边界

### 8. guidance assembly 必须有明确接入与降级策略
- `control-plane-system` 是 guidance request 的发起方
- `behavioral-guidance-system` 只返回 guidance payload，不负责把动作判定从 allow 变成 deny 或反之
- guidance 不可用时，系统必须允许退化为最小 guidance 路径，而不是阻断既有决策链
- hard guard 与 hard risk 判断始终优先于 output guard

## 候选方案对比

| 候选 | 总体判断 | 优势 | 劣势 |
|------|------|------|------|
| 继续塞进 control-plane | 可行但不优 | 文档增量最少 | control-plane 继续膨胀，软层边界不清 |
| 独立 behavioral-guidance-system + 运行时注入模板 | 最优 | 边界清晰、保留主体性、控制复杂度 | 需要新增系统设计与接口定义 |
| skill-first guidance | 不推荐 | 表面灵活 | 容易教学化、workflow 化、边界模糊 |

## 后果

### 正面
- guidance layer 获得正式系统归属
- control-plane 边界更健康
- 软层原则（不做 platform flavor / 不做教学型 skill / 不做步骤模板）得到明确固化
- 后续 `/design-system` 可以围绕 guidance assembly 继续细化

### 负面
- 需要新增 `behavioral-guidance-system` 的详细设计文档
- 后续 blueprint 需要引入新的任务拆解与接口定义

### 需要的后续行动
- 在 `02_ARCHITECTURE_OVERVIEW.md` 中纳入 `behavioral-guidance-system`
- 在 `/design-system` 中优先设计 `behavioral-guidance-system`
- 在 `state-system` 设计中明确 persona asset selection 依赖
- 在 `control-plane-system` 设计中明确 guidance assembly 的接入点
- 在 blueprint 前补硬 owner 分工、persona selection 契约与 fallback 路径

## 参考资料
- `../01_PRD.md`
- `../02_ARCHITECTURE_OVERVIEW.md`
- `../v2/03_ADR/ADR_003_SECOND_NATURE_GOVERNANCE.md`

## 影响范围

本 ADR 被以下系统引用:
- `behavioral-guidance-system` - 独立系统的存在依据与边界原则
- `control-plane-system` - guidance 请求与接入点约束
- `state-system` - persona reinforcement 的来源资产边界
- `observability-system` - output guard 与事实边界的记录语义
- `cli-system` - 如需查看 guidance 相关 explain/debug 摘要时的读取边界
