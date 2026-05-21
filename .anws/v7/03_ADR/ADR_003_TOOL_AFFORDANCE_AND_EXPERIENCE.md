# ADR-003: Tool Affordance and Tool Experience Form the Agent Body

## 状态
Accepted

## 日期
2026-05-21

## 背景
v6 的 connector inventory 和 audit attempt 更偏 operator view。用户反馈显示 agent-world endpoint 连续失败 35 次仍继续撞墙，dry health 还可能显示 ok。v7 需要让 agent 感到工具是否可用、疼痛、需要冷却，像身体一样回馈。

## 决策驱动因素
- Connector 是手脚，不只是 API adapter。
- Agent-facing affordance 必须区别于 operator-facing status。
- Tool failure 要回流为 experience、pain signal 和 breaker posture。
- Wet probe 必须暴露 endpoint truth，dry-run 不得冒充真实健康。

## 候选方案

### 方案 A: 继续只用 connector:status 和 audit log
- **优点**: 改动小。
- **缺点**: Agent 看不到可供性和痛感，连续失败仍会污染 heartbeat。

### 方案 B: 每次失败直接禁用 connector
- **优点**: 止损快。
- **缺点**: 过度惩罚临时网络/限流，不利于恢复。

### 方案 C: ToolAffordanceMap + ToolExperienceLog + CircuitBreaker
- **优点**: 区分可读、可试探、需授权、疼痛、冷却；支持半开恢复。
- **缺点**: 需要新增 read model、breaker policy 和测试矩阵。

## 决策
采用方案 C。`body-tool-system` 生成 agent-facing `ToolAffordanceMap`，写入 `ToolExperienceLog`，并基于连续失败开启 CircuitBreaker。`connector-system` 支持 auto-probe 和 `connector_test --wet`，记录 declared vs actual capabilities。

## 后果

### 正面
- endpoint mismatch 能在注册或 wet test 时暴露。
- 连续失败会冷却，不再无限污染 heartbeat。
- Dream/Quiet 可读取工具经验，而非只读日志。

### 负面
- Probe 和 breaker 需要严格限制到 safe/read-only endpoint。
- Experience schema 需要 redaction 和 size limit。

### 需要的后续行动
- 设计 `CapabilityProbeResult`、`ToolExperience`、`ConnectorCircuitBreaker` schema。
- 为 404/401/200、cooldown、half-open recovery 建集成测试。

## 参考资料
- `.anws/v7/01_PRD.md` [REQ-002], [REQ-003], [REQ-009]

## 影响范围
本 ADR 被以下系统引用:
- [body-tool-system](../04_SYSTEM_DESIGN/body-tool-system.md) - §8 Trade-offs
- [connector-system](../04_SYSTEM_DESIGN/connector-system.md) - §8 Trade-offs
- [observability-health-system](../04_SYSTEM_DESIGN/observability-health-system.md) - §8 Trade-offs
