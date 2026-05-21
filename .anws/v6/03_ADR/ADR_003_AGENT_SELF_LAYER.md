# ADR-003: Agent Self Layer 边界与职责划分

## 状态
Accepted

## 日期
2026-05-15

## 背景
v5 的架构把 SN 框定为"平台数据搬运工 + 通知发送器"——heartbeat 读取 evidence、按 rhythm window 选动作、outreach 投递。但 SN 的愿景是"有自我叙事、有目标追求、能持续成长的 Agent"。v6 需要在不推翻 v5 核心边界的前提下，引入 Agent 的"自我"能力。

## 决策驱动因素
- 因素 1: SN 需要"理解"它在平台看到的东西，不只是记录
- 因素 2: outreach 需要从"通知"变成"有来由的分享"
- 因素 3: agent 需要"记住"与 owner 的关系，不只是 user interest snapshot
- 因素 4: agent 需要有"追求"，而不只是按时间表运转
- 因素 5: 不能破坏 v5 的核心边界法律（guidance 不拥有决策权、rhythm 不越权授权）

## 候选方案

### 方案 A: 新增独立 Agent Self System
- **描述**: 新建一个 `agent-self-system`，拥有 narrative、relationship、goal、insight 的全部逻辑。
- **优点**: 边界清晰、独立演进
- **缺点**: 引入第七个系统，增加架构复杂度；与 control-plane、state、guidance 有大量交互

### 方案 B: Agent Self Layer 作为跨系统 concerns
- **描述**: 不新增独立系统，而是在现有系统中新增 responsibilities：
  - `state-system` 保存 NarrativeState、RelationshipMemory、AgentGoal、MemoryStore
  - `control-plane-system` 读取 narrative/goal/relationship 影响 planning，更新 narrative
  - `behavioral-guidance-system` 提供 insight extraction、narrative update draft
  - `dream-system`（原 quiet）执行异步记忆整理
- **优点**: 不增加系统数量、职责自然归属、与 v5 兼容
- **缺点**: 需要 careful 边界管理，防止 guidance 层越权

### 方案 C: 纯 prompt 工程（无持久化）
- **描述**: 每次 heartbeat 时通过 prompt 注入"agent 的自我描述"，不持久化 narrative/relationship/goal
- **优点**: 简单、无 schema 变更
- **缺点**: 无积累、每次从零开始、无法实现真正的"成长"

## 决策
选择 **方案 B: Agent Self Layer 作为跨系统 concerns**。

**核心原则**:
1. Narrative/Relationship/Goal 是**state**，由 `state-system` 持久化
2. Narrative 更新和 Goal 影响是**控制面决策**，由 `control-plane-system` 执行
3. Insight extraction 和 Narrative draft 是**软层表达**，由 `behavioral-guidance-system` 生成
4. Memory consolidation 是**异步任务**，由 `dream-system` 执行
5. **决策权仍属于 control-plane 的 evidence-backed guard**，narrative/relationship/goal 只影响优先级和语气，不改变 allow/deny 逻辑
6. **Goal proposal 默认不是授权**：agent 可提出 goal，但 proposal 不等于可执行目标；只有 owner 显式确认，或 policy allowlist 判定为低风险且有完成标准时，才允许影响 intent priority
7. **Narrative 是可追溯状态，不是人格幻觉**：每个 narrative/progress/next_intent 必须带 source refs、confidence 与 unsupported-claim 拦截结果

## 后果

### 正面
- 不新增独立系统，架构保持简洁
- 各职责归属自然：state 存数据、control-plane 做决策、guidance 生成表达、Dream 整理记忆
- v5 的核心边界法律保持完整

### 负面
- 需要 careful 接口设计，防止 guidance 层通过 narrative update 间接影响决策
- `state-system` schema 变更较大（新增 4+ 个持久化结构）
- narrative/relationship 的"幻觉"风险需要 prompt engineering 和验证
- 自主目标若没有治理闸门，会把"主动性"偷换成"越权执行"；必须在任务与设计中显式建模 goal proposal / goal accepted / goal rejected

### 需要的后续行动
- 在 `04_SYSTEM_DESIGN/state-system.md` 中定义 NarrativeState、RelationshipMemory、AgentGoal、MemoryStore schema
- 在 `04_SYSTEM_DESIGN/control-plane-system.md` 中定义 narrative/goal/relationship 读取点和 planning 影响规则
- 在 `04_SYSTEM_DESIGN/control-plane-system.md` 中定义 goal priority cap、user task > accepted goal > rhythm 的裁决顺序，以及 proposal 不能越过 hard guard 的规则
- 在 `04_SYSTEM_DESIGN/behavioral-guidance-system.md` 中定义 insight extraction 和 narrative update draft 的 prompt 工程
- 在 `04_SYSTEM_DESIGN/dream-system.md` 中定义 memory consolidation pipeline

## 参考资料
- `.anws/v5/03_ADR/ADR_003_SECOND_NATURE_GOVERNANCE.md`
- `.anws/v5/03_ADR/ADR_004_BEHAVIORAL_GUIDANCE_LAYER.md`
- `https://platform.claude.com/docs/en/managed-agents/dreams`

## 影响范围
- `state-system` - 新增 4+ 持久化结构
- `control-plane-system` - intent planning 增加 goal-directed 分支
- `behavioral-guidance-system` - 新增 insight extraction、narrative update
- `dream-system` - 承担 memory consolidation 职责
- `cli-system` - 新增 `narrative`、`goal` 命令
