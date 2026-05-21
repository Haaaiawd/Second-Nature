# body-tool-system 调研报告

**生成日期**: 2026-05-21  
**系统**: `body-tool-system`  
**目的**: 为系统设计文档提供外部证据，支撑 Trade-off 决策和风险缓解

---

## 1. Agent Tool Affordance Map 设计模式

**搜索词**: "agent tool affordance map design patterns 2025"

### 关键发现

**来源 1**: [Affordance — Encyclopedia of Agentic Coding Patterns](https://aipatternbook.com/affordance)

- Affordance 在 agent 系统中有两层语义：面向终端用户的 UI affordance，以及面向 agent 自身的工具 affordance（函数名、参数描述、触发条件）。
- 工具描述（tool description）是 agent 感知可供性的核心媒介：三要素为"何时用 / 如何调用 / 结果如何回馈"。
- 平台约束（platform constraints）是塑造可用 affordance 集合的外部因素，与 body-tool-system 的 trust_tier / policy 分类高度契合。

**来源 2**: [Control Plane as a Tool — arxiv 2505.06817](https://www.arxiv.org/pdf/2505.06817)

- 提出"Control Plane as a Tool"模式：将工具路由逻辑封装在 control plane 内，agent 通过单一接口感知可用工具集，内部实现对 agent 透明。
- 设计目标包括：Modularity（工具逻辑与 agent reasoning 解耦）、Dynamic Selection（基于 metadata 动态选工具）、Governance and Observability（可审计、可强制安全策略）。
- 与 `ToolAffordanceMap` 的设计思路一致：agent 消费 affordance 视图，不直接感知 connector 内部实现。

**来源 3**: [Production AI Agent Architecture](https://www.mikul.me/blog/production-ai-agent-architecture-failures-lessons)

- 实践证明：每次给 agent 15 个工具比给 3-5 个相关工具导致工具选择错误率高 80%。
- 结论：affordance map 应在 heartbeat 时做 context-aware 过滤，而不是全量暴露 connector inventory。
- 与 `ToolAffordanceMap` 按 status（safe / exploratory / needs_auth / painful / unavailable）分类的决策一致。

**设计启示**:
- `ToolAffordanceMap` 应按 status 分层过滤，agent 消费视图，不直接消费 connector registry。
- 工具描述三要素（触发条件、调用方式、结果回馈）应在 manifest capability 中体现。
- Governance 属于 trust policy，不属于 affordance map 本身。

---

## 2. Circuit Breaker Pattern TypeScript 实现

**搜索词**: "circuit breaker pattern TypeScript implementation best practices"

### 关键发现

**来源 1**: [Build a Circuit Breaker in TypeScript in 80 Lines — DEV Community](https://dev.to/gabrielanhaia/build-a-circuit-breaker-in-typescript-in-80-lines-48g3)

- 状态机三态：CLOSED（正常）→ OPEN（失败达阈值）→ HALF_OPEN（cooldown 到期）→ CLOSED（wet probe 成功）/ OPEN（失败继续）。
- 关键设计建议：
  - `failureThreshold` 应为比例（失败率），不是固定次数，以应对流量波动。
  - 使用时间窗口（`windowMs`）而非最近 N 次请求，避免流量尖峰误报。
  - HALF_OPEN 阶段允许**严格一次**探测，不是"一段时间内几次"。
  - 探测失败后使用指数退避（exponential backoff），带上限（`maxCooldownMs`）。

**来源 2**: [Resilience Patterns in TypeScript: Circuit Breaker — Buti](https://nobuti.com/thoughts/resilience-patterns-circuit-breaker)

- 最小配置：`failureThreshold`（连续失败阈值）+ `recoveryTimeout`（cooldown ms）。
- HALF_OPEN 成功后重置 `failureCount = 0`，恢复 CLOSED。
- 提供了 Jest 单元测试模板，覆盖：CLOSED 正常路径、OPEN 快速失败、HALF_OPEN 恢复。

**来源 3**: [ts-easy-circuit-breaker](https://github.com/carmonac/ts-easy-circuit-breaker)

- `initialState` 参数支持从外部 store（如 SQLite）加载持久化状态，适合 plugin-first 架构（serverless/无状态进程重启）。
- 与 `body-tool-system` 依赖 `state-memory-system` 持久化 breaker state 的架构决策一致。

**设计启示**:
- `ConnectorCircuitBreaker` 状态机实现：Closed / Open / HalfOpen 三态，加指数退避 cooldown。
- Breaker state 必须持久化到 `state-memory-system`，不能只在进程内存中。
- HALF_OPEN 严格允许单次 wet probe，结果决定状态转移。
- 配置字段：`failureThreshold`（连续失败次数，简单场景固定次数可接受）、`cooldownMs`、`maxCooldownMs`。

---

## 3. Tool Experience Log 学习反馈回路

**搜索词**: "tool experience log learning feedback loop agent system"

### 关键发现

**来源 1**: [Hermes Agent's Learning Loop — DEV Community](https://dev.to/om_shree_0709/hermes-agents-learning-loop-is-the-only-thing-that-makes-an-agent-actually-get-better-heres-how-3l2k)

- Hermes Agent 的 Reflective Phase：任务执行后分析自身表现，提取可复用模式，写入 skill 文件并索引。
- 三层记忆：Working Memory（上下文）、Episodic Memory（历史会话可查询）、Skill Memory（可执行方式）。
- 关键设计：Skill Memory 只在系统 prompt 中加载名称和简介，完整内容按需加载，避免 context 爆炸。
- 与 `ToolExperienceLog` 的设计相似：记录执行历史（episodic），但 body-tool-system 明确限定不自动转为执行能力（behavior promotion loop 需要 operator explicit trust）。

**来源 2**: [Production AI Agent: Repetition Detection](https://www.mikul.me/blog/production-ai-agent-architecture-failures-lessons)

- 通过 `toolCallHistory` 检测重复失败模式，在达到阈值时 escalate 而非继续循环。
- 与 `CircuitBreaker` 连续失败检测 + pain signal 的逻辑一致。

**设计启示**:
- `ToolExperienceLog` 应记录：connector attempt outcome、failureClass、latency、evidenceQuality、ownerReaction、triggerSource。
- 经验不自动变成技能（no auto-promotion）；BehaviorPromotionLoop 需要 operator 显式 trust。
- Dream/Quiet 系统可读取 ToolExperienceLog 提炼模式，但 body-tool-system 本身不做推理。

---

## 4. Connector Capability Registry 设计

**搜索词**: "connector capability registry design agent tools inventory"

### 关键发现

**来源 1**: [AgentEnsemble Dynamic Discovery](https://docs.agentensemble.net/guides/discovery/)

- Capability registry 核心功能：advertise（注册能力）、discover（按名称或标签查询）、resolve（运行时动态绑定）。
- Tags 用于分类（food、stock、cooking），与 body-tool-system 的 trust_tier / capability_type 分类思路一致。
- 支持多 provider 的 selection logic（round-robin、least-loaded、affinity），对 body-tool-system 的 safe probe selection 有参考价值。

**来源 2**: [MarimerLLC/agentregistry](https://github.com/MarimerLLC/agentregistry)

- Protocol-agnostic registry：agents 声明协议（A2A/MCP/ACP），registry 只存储 metadata 不执行协议。
- `isLive` 字段通过 Redis liveness 实时反映健康状态，与 `CapabilityProbeResult.actualStatus` 类似。
- Registry 自身作为 MCP server 暴露，agent 可直接查询"find me a live agent"。

**来源 3**: [AWS Bedrock AgentCore Registry](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/registry-key-capabilities.html)

- Flexible metadata schema：支持 MCP Server、agents、skills，也支持自定义 resource 类型。
- 语义搜索 + 关键词匹配组合，自然语言 query 可匹配概念相关的 capability。
- 与 `ToolAffordanceMap` 的 agent-facing view 相比：AWS 更偏 operator/developer 视角；body-tool-system 需要同时支持 agent 消费视图和 operator 管理视角。

**设计启示**:
- Connector manifest 是 declared capabilities 的 source of truth；`CapabilityProbeResult` 记录 actual capabilities（wet probe 结果）。
- Declared vs Actual 的 diff 是 endpoint mismatch 暴露的核心机制。
- Registry 应支持按 status、trust_tier、platformId 过滤，生成 agent-facing affordance view。

---

## 5. 综合设计启示

| 主题 | 外部证据 | body-tool-system 实现映射 |
|---|---|---|
| Affordance 分层 | aipatternbook.com: 平台约束 → 可用 affordance | `status` 枚举：safe / exploratory / needs_auth / painful / unavailable |
| Tool 描述三要素 | DEV 实践：触发条件 / 调用方式 / 结果回馈 | manifest `capability.description` + `recommendedProbe` |
| Circuit Breaker 三态 | DEV TS 实现：Closed/Open/HalfOpen + 指数退避 | `ConnectorCircuitBreaker` 状态机 + `cooldownMs` / `maxCooldownMs` |
| Breaker 持久化 | ts-easy-circuit-breaker: `initialState` 外部 store | breaker state 写入 `state-memory-system` SQLite |
| 经验不自动执行 | Hermes: skill 需显式索引 | `BehaviorPromotionLoop` 需 operator explicit trust |
| Declared vs Actual | AgentRegistry: `isLive` 实时健康 | `CapabilityProbeResult` wet probe diff |
| 减少工具暴露 | production agent: 15→3-5 工具减少 80% 错误 | `ToolAffordanceMap` 按 status 过滤，不暴露全量 connector inventory |

---

*调研结论支撑的关键设计决策*:
1. `ToolAffordanceMap` 按 status 分层（支撑 §8.1 决策，对应 ADR-003）
2. `ConnectorCircuitBreaker` 使用指数退避 cooldown + HalfOpen 单次 wet probe（支撑 §8.2 决策，对应 ADR-008）
3. `ToolExperienceLog` 不自动提升为执行能力（支撑 §8.3 决策，对应 ADR-003）
4. Breaker state 持久化到 `state-memory-system`（支撑 §10 性能考虑中的状态恢复设计）
