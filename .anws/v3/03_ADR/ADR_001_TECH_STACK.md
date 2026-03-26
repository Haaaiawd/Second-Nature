# ADR-001: 主技术栈与宿主运行时选择

## 状态
Accepted

## 日期
2026-03-23

## 背景
Second Nature v2 的目标是在 7 天黑客松周期内，为运行在 OpenClaw 之上的个人 agent 构建一层高阶行为连续性协议，统一协调多个 agent-native 平台上的探索、互动、保活、Quiet 记忆整理、Narrative Reflection 与用户主动联系行为。

关键约束：
- 产品明确定位为 **OpenClaw 原生 plugin**，不是独立 assistant runtime，也不是单纯 skill
- 首版面向单用户、单 agent、少量平台场景，首批目标为 Moltbook、InStreet、EvoMap
- 创新重点在于 `Second Nature` 的行为节律、Quiet 和记忆治理，而不是底层运行时重建
- 需要与 OpenClaw 的 workspace files、session transcripts、cron、skills、compaction、session pruning 语义兼容
- 需要快速实现 CLI、本地调度、连接器、文件整理与审计日志

## 决策驱动因素
- 因素 1: 黑客松开发速度优先
- 因素 2: 必须贴合 OpenClaw 现有 runtime 与 workspace memory 语义
- 因素 3: 平台 connector、本地文件整理与审计能力是首版工程主轴
- 因素 4: 创新预算应保留给节律、Quiet、Narrative Reflection 和记忆治理
- 因素 5: 需要用成熟技术承托“非无聊”的产品层

## 候选方案

### 方案 A: TypeScript + Node.js + SQLite + OpenClaw native plugin
- **描述**: 使用 TypeScript / Node.js 构建 plugin、service、CLI、本地编排、connector 与记忆整理逻辑，使用 SQLite 保存状态、审计与索引，并明确以 OpenClaw native plugin 形态运行和分发。
- **优点**:
  - 与 OpenClaw 本身的主栈、workspace 与工具生态最贴合
  - 适合 CLI、HTTP、文件系统、脚本调用与本地 daemon 风格能力
  - 便于快速实现 connector abstraction、API-first / CLI-fallback 和 Quiet 文件整理
  - 能把创新预算留给高层协议，而不是消耗在跨语言 glue code
- **缺点**:
  - 复杂记忆推理与实验性 reflection pipeline 不如 Python 舒适
  - 若后续人格演化规则显著复杂，可能需要额外的模型服务或插件

### 方案 B: Python-first sidecar on top of OpenClaw
- **描述**: 以 Python 为主实现节律、记忆整理与策略逻辑，通过 sidecar 方式附着在 OpenClaw 之上。
- **优点**:
  - 更适合实验性 memory / reflection pipeline
  - 模型侧实验和文本处理工具丰富
- **缺点**:
  - 容易把系统撕裂为两个 runtime 心智模型
  - 与 OpenClaw workspace 注入、session、tools 的贴合度下降
  - 黑客松周期内引入跨语言复杂度不划算

### 方案 C: 独立新 runtime + 自定义 memory system
- **描述**: 不依赖 OpenClaw 运行时，自建新的 runtime、workspace 体系与记忆系统。
- **优点**:
  - 理论上自主权最高
  - 可完全按 Second Nature 理念重建底座
- **缺点**:
  - 直接违背当前产品定位
  - 明显重做 OpenClaw 已有能力
  - 黑客松周期与实现风险不可接受

## 决策
选择 **方案 A: TypeScript + Node.js + SQLite + OpenClaw native plugin**。

核心理由：
- 当前项目的真正创新点不是底层 runtime，而是 `Second Nature`：行为节律、Quiet、Narrative Reflection、记忆整理与连续性维护。
- OpenClaw 已经提供 workspace、session、cron、bootstrap files、skills、compaction 与 pruning 等底层语义，再重做一次只会制造双重复杂度。
- OpenClaw 已提供成熟 plugin 机制与 ClawHub / npm 分发路径，Second Nature 作为 plugin 比作为零散脚本或单纯 skill 更符合长期产品形态。
- TypeScript / Node.js 对 CLI、本地任务调度、HTTP connector、文件系统整理、结构化日志和模块化代码组织最合适。
- SQLite 足以支撑首版平台策略、节律配置、Quiet 索引、会话日志与审计需求。
- 该方案最符合“把创新预算留给本质复杂度，把偶然复杂度压到最低”的原则。

## 候选方案对比

| 候选 | 总体判断 | 优势 | 劣势 |
|------|------|------|------|
| TypeScript + Node.js + SQLite + OpenClaw native plugin | 最优 | 最贴合宿主运行时与分发路径；CLI/文件/连接器实现快；把创新预算留给高层设计 | 复杂 reflection pipeline 可能需要后续补强 |
| Python-first sidecar | 次优 | 文本与记忆实验舒适 | 跨语言复杂度高；宿主贴合差 |
| 独立新 runtime | 不可取 | 自主权高 | 违背定位；重造轮子；风险极高 |

## 后果

### 正面
- 与 OpenClaw 运行时和 workspace memory 语义强一致
- 实现层可以专注在节律、Quiet、记忆治理，而不是底层搭台
- connector、审计和文件整理能力更容易在一个主栈内保持清晰边界
- 可通过 ClawHub / npm / 本地路径按 OpenClaw plugin 方式分发与安装
- 未来可按需附加 skill bundles，作为 plugin 之上的行为模板层

### 负面
- Second Nature 将在一段时间内受制于 OpenClaw 的宿主语义和演进节奏
- 若后续 reflection / memory pipeline 极度复杂，可能需要额外子系统或插件扩展

### 需要的后续行动
- 在 `02_ARCHITECTURE_OVERVIEW.md` 中统一描述为 OpenClaw native plugin
- 在 `control-plane-system` 设计文档中明确 OpenClaw cron/session/workspace 的接入方式
- 在 `state-system` 设计文档中明确 SQLite 索引与 OpenClaw workspace 文件的职责边界
- 在产品文档中明确 plugin 与 skills 的关系：plugin 为核心运行形态，skills 为可选补充模板
- 若未来需要复杂模型工作流，再以新 ADR 讨论是否引入插件式 context engine 或 sidecar

## 参考资料
- `https://github.com/openclaw/openclaw`
- `https://docs.openclaw.ai/concepts/agent`
- `https://docs.openclaw.ai/concepts/agent-workspace`
- `https://docs.openclaw.ai/concepts/compaction`
- `https://docs.openclaw.ai/concepts/session-pruning`
- `https://docs.openclaw.ai/tools/plugin`
- `https://docs.openclaw.ai/plugins/sdk-overview`
- `https://docs.openclaw.ai/plugins/building-plugins`
- `https://docs.openclaw.ai/tools/clawhub`

## 影响范围

本 ADR 被以下系统引用:
- `cli-system` - 本地命令入口与运行环境
- `control-plane-system` - 高层行为编排与 Quiet orchestration 的宿主假设
- `connector-system` - 平台适配器实现语言与 HTTP/CLI 集成方式
- `state-system` - SQLite 状态与 OpenClaw workspace memory 的双层存储边界
- `observability-system` - 本地结构化日志与记忆治理审计能力
