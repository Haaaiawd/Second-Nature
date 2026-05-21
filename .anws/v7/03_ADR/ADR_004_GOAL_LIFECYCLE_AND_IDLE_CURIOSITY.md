# ADR-004: Goals Give Direction, IdleCuriosity Gives Natural Observation

## 状态
Accepted

## 日期
2026-05-21

## 背景
用户反馈指出多 goal 共存会劫持 router，无 goal 时 heartbeat 会空转。v7 需要让 goal 像人的方向，而不是永远存在的脚本；无 goal 时也应有低噪声、低风险的自然观察。

## 决策驱动因素
- 同 kind/scope 的新 goal 应 replace 旧 goal，避免多目标劫持。
- Goal 必须支持 complete、expire、pause 和 completion evidence。
- 无 active goal 时不应 dispatch_unavailable 空转。
- IdleCuriosity 只能做 allowlisted read-only sensing。

## 候选方案

### 方案 A: 保持永久 goal
- **优点**: 简单。
- **缺点**: 旧目标持续劫持行为。

### 方案 B: 无 goal 时轮询所有 connector
- **优点**: 不空转。
- **缺点**: 容易爬虫化和制造噪声。

### 方案 C: GoalLifecycle + IdleCuriosityPolicy
- **优点**: goal 有自然生命周期；无 goal 时安全观察。
- **缺点**: 需要生命周期状态和 idle budget。

## 决策
采用方案 C。`AgentGoal` 增加 replace/complete/expire/pause 语义；无 active goal 时，control-plane 进入 `IdleCuriosityPolicy`，最多选择一个 healthy、allowlisted、read-only capability。

## 后果

### 正面
- 方向可持续但可放下。
- 无 goal 时 heartbeat 仍可自然观察，不虚构 evidence。

### 负面
- goal completion criteria 和 evidence 需要更明确。
- idle curiosity 要防止平台噪声和频率漂移。

### 需要的后续行动
- 定义 `goal complete <id>`、TTL、same kind/scope replace。
- 在 heartbeat trace 写明 idle choice 或 `idle_policy_no_eligible_connector`。

## 参考资料
- `.anws/v7/01_PRD.md` [REQ-004]

## 影响范围
本 ADR 被以下系统引用:
- [control-plane-system](../04_SYSTEM_DESIGN/control-plane-system.md) - §8 Trade-offs
- [state-memory-system](../04_SYSTEM_DESIGN/state-memory-system.md) - §8 Trade-offs
- [connector-system](../04_SYSTEM_DESIGN/connector-system.md) - §8 Trade-offs
