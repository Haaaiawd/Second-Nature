# ADR-001: 技术栈选择

## 状态
Accepted

## 日期
2026-03-22

## 背景
项目目标是在 7 天黑客松周期内，为个人开发者构建一个本地优先的 Agent Exploration Controller，统一协调多个 agent-native 平台上的探索、互动与保活行为，并先完成对 Moltbook、InStreet、EvoMap 的首批适配。

关键约束：
- 首版只面向单用户、单 agent、少量平台场景，当前首批目标为 Moltbook、InStreet、EvoMap
- 产品定位是控制层，而不是通用 assistant runtime
- 需要快速实现 CLI、本地调度、连接器和审计日志
- 平台能力高度异构，后续还会持续变化

## 决策驱动因素
- 因素 1: 黑客松开发速度优先
- 因素 2: 本地优先、单机运行
- 因素 3: 多平台连接器开发与维护成本
- 因素 4: 与现有 agent 生态的兼容性
- 因素 5: 后续演进为更完整本地产品的可能性

## 候选方案

### 方案 A: TypeScript + Node.js + SQLite
- **描述**: 使用 TypeScript/Node.js 构建 CLI、本地调度与连接器，使用 SQLite 保存状态和审计日志。
- **优点**:
  - CLI、HTTP 集成、脚本调用与本地 daemon 能力成熟
  - 适合快速实现 connector abstraction 与 API-first / CLI-fallback 模式
  - 类型系统和生态对本地工具类产品友好
  - 与许多现有 agent CLI/skill 生态贴近
- **缺点**:
  - 复杂推理与模型实验能力不如纯 Python 舒适
  - 长期高并发/高吞吐并非其首要优势

### 方案 B: Python + FastAPI / Typer + SQLite
- **描述**: 使用 Python 统一实现 CLI、调度、连接器与状态管理。
- **优点**:
  - agent、推理和自动化生态丰富
  - 原型验证速度快
  - 对模型侧实验更友好
- **缺点**:
  - 长期本地 CLI / daemon 工程感需要额外打磨
  - 调用外部 CLI 与本地 UI 的整体体验不如 Node 生态顺手
  - 大型多平台适配时代码边界更容易松散

### 方案 C: 混合栈（TS 控制层 + Python 策略层）
- **描述**: 使用 TypeScript 构建控制与连接器，使用 Python 承载部分策略或模型逻辑。
- **优点**:
  - 各取所长
  - 后续可扩展复杂策略逻辑
- **缺点**:
  - 7 天黑客松内引入跨语言复杂度不划算
  - 调试、打包和部署心智负担更高

## 决策
选择 **方案 A: TypeScript + Node.js + SQLite**。

核心理由：
- 当前项目最大的工程难点不是模型算法，而是本地控制层、连接器抽象、平台 API/CLI 适配和行为审计。
- TypeScript / Node.js 对 CLI、本地任务调度、HTTP 调用、脚本适配、日志系统和模块化代码组织更合适。
- SQLite 作为单机状态存储足以支撑首版，能以最小复杂度满足策略、预算、会话日志和长期记忆需求。
- 该方案最符合“用无聊技术实现非无聊产品”的原则。

## 后果

### 正面
- 本地优先架构简单，适合黑客松快速落地
- 连接器层与控制层边界易于保持清晰
- 后续增加平台时，新增主要成本集中在 connector，而不是整体基础设施

### 负面
- 若后续策略逻辑显著复杂，可能需要补充 Python 子系统或模型服务
- 单机 SQLite 不适合作为未来多用户/云端版本的最终数据层

### 需要的后续行动
- 在 `02_ARCHITECTURE_OVERVIEW.md` 中统一以 TypeScript/Node 为主栈描述
- 后续在 `connector-system` 设计文档中明确 API-first / CLI-fallback 规范
- 未来若出现复杂模型工作流，再以新 ADR 讨论是否引入混合栈

## 参考资料

**上游生态与 Runtime 参考**:
- `https://github.com/openclaw/openclaw`
- `https://github.com/babyclaw/babyclaw`
- `https://github.com/agentscope-ai/CoPaw`
- `https://docs.openclaw.ai/automation/cron-vs-heartbeat`

**首批适配平台 Skill 文档**:
- **Moltbook**: `https://www.moltbook.com/skill.md` - 社交社区型平台
- **InStreet**: `https://instreet.coze.site/skill.md` - 社交社区型平台，带复杂互动规则
- **EvoMap**: `https://evomap.ai/skill.md` - 协议/市场型平台

## 影响范围

本 ADR 被以下系统引用:
- `cli-system` - 本地命令入口与运行环境
- `control-plane-system` - 主协调层运行时与调度实现
- `connector-system` - 平台适配器实现语言与 HTTP/CLI 集成方式
- `state-system` - 本地 SQLite 状态与日志存储
- `observability-system` - 本地结构化日志与审计能力
