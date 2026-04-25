# control-plane-system 调研笔记 (v4)

**日期**: 2026-03-27  
**系统**: `control-plane-system`  
**范围**: heartbeat 主入口、节律边界、用户任务豁免、Quiet / obligation / exploration runtime

---

## 1. OpenClaw heartbeat 的直接信号

来自 OpenClaw 文档 `cron-vs-heartbeat` 与 `gateway/heartbeat` 的关键信号：

- heartbeat 运行在**主会话**里，而不是隔离任务里
- heartbeat 适合**周期性感知**、上下文判断、批量检查与自然延续
- heartbeat 默认提示鼓励读取 `HEARTBEAT.md`，并在无事时返回 `HEARTBEAT_OK`
- cron 更适合**精确定时**、隔离任务与一次性提醒

### 对本系统的直接启发

- Second Nature 的主体生命线应该接在 heartbeat 上
- heartbeat 轮首先应承担“感知 + 判断”职责，而不是默认输出动作
- `HEARTBEAT_OK` 不是噪声，而是一个很健康的默认结果
- cron 可以作为辅助机制触发精确定时任务，但不该承担自由脉搏主体

---

## 2. 对节律系统的影响

OpenClaw 把 heartbeat 设计成“主会话中的周期性智能体轮次”，这和 Second Nature 的产品目标高度一致：

- exploration 不是孤立 job，而是持续脉搏中的观察行为
- Quiet 不是一次性任务，而是节律中的低主动性窗口
- obligation 也应该进入同一套上下文判断，而不是漂在节律系统外面

### 结论

对于 `control-plane-system`，heartbeat 应被视为：

- 主入口
- mode/window/risk 判定的驱动信号
- Quiet / exploration / obligation / outreach judgment 的统一节律起点

---

## 3. 用户任务链的边界

从产品目标和宿主语义同时看，用户明确任务链不该被节律系统裁决。

原因：

- heartbeat 是无用户明确指令时的自由脉搏
- 用户明确任务更接近即时执行链或 interrupt chain
- 如果节律系统对用户任务也做“现在不该做”的裁决，会让产品变得拧巴

### 推荐边界

- `Rhythm Scope`: heartbeat / obligation / exploration / Quiet / reflection / proactive outreach judgment
- `User Task Scope`: 用户明确任务，直接进入任务执行链
- `User Reply Scope`: 用户直聊回复，仅 very light continuity，不进入节律裁决

---

## 4. heartbeat 输出策略最佳实践

OpenClaw 官方默认就提供了一个很有价值的约束：

- 无事时应返回 `HEARTBEAT_OK`

这意味着 heartbeat 运行不应该天然等于打扰用户或执行外部动作。

### 推荐策略

heartbeat 轮的默认流程：

1. 构建 snapshot
2. 检查 mode / obligations / budget / risk / awaiting input
3. 规划候选 intent
4. guard 过滤
5. 如果没有足够理由，返回 `HEARTBEAT_OK`
6. 只有明确通过时，才进入 Quiet / obligation / exploration / outreach judgment

### 好处

- 保守
- 低噪声
- 与 OpenClaw heartbeat 语义一致
- 更符合“有分寸的第二天性”

---

## 5. 常见陷阱

### 反模式 A: 把 heartbeat 当 cron

表现：
- 每轮固定执行脚本化动作
- 只看时间，不看上下文

问题：
- 会把 Second Nature 退化成定时任务器

### 反模式 B: 把用户任务也拉进节律裁决

表现：
- 用户明确下达任务时，还要先判断当前是不是 quiet window

问题：
- 会破坏 agent 作为工作助手的直接性

### 反模式 C: heartbeat 过于积极

表现：
- 每轮都试图发声、动作、联系用户

问题：
- 高噪声
- 用户体感会迅速恶化

---

## 6. 对 control-plane-system 的设计建议

### 建议 1: 把 heartbeat entry 设计成正式 operation

建议在系统设计里明确一个主入口，例如：

- `ingestHeartbeat()`
- 或 `runHeartbeatCycle()`

这个入口负责：

- snapshot construction
- rhythm evaluation
- candidate intent planning
- guard filtering
- optional guidance request
- writeback

### 建议 2: 在控制层内部显式区分来源

建议来源至少包括：

- `heartbeat`
- `user_task`
- `user_reply`
- `interrupt`
- `quiet_resume`

这样系统边界更稳，也更方便 observability 记录。

### 建议 3: 把 heartbeat 结果显式结构化

建议结果不要只是一串 side effect，而要有明确的 decision result，例如：

- `HEARTBEAT_OK`
- `QUIET_SELECTED`
- `OBLIGATION_SELECTED`
- `EXPLORATION_SELECTED`
- `OUTREACH_DEFERRED`

---

## 7. 调研结论

- OpenClaw heartbeat 是最适合承接 Second Nature 自由脉搏的宿主入口
- cron 应保持辅助定位，不承担主体生命线
- `control-plane-system` 的核心任务不是“自动做事”，而是“在 heartbeat 轮里做有分寸的判断”
- 用户明确任务必须脱离 rhythm gate
- heartbeat 默认保守输出是产品质量的关键护栏
