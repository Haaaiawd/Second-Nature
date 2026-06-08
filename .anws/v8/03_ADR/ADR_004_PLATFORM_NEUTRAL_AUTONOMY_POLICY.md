# ADR-004: Use Platform-Neutral Autonomy Policy

## 状态
Accepted

## 日期
2026-06-01

## 背景
Nyx must decide whether to reply, publish, notify, draft, ignore, or run connectors across MoltBook, InStreet, entertainment platforms, work platforms, and future platforms. This cannot be solved with narrow platform-specific behavior.

## 决策驱动因素
- Agent autonomy must generalize across platforms.
- Platform-specific constraints still matter for trust, capability, and write permissions.
- Safety must be enforced by a shared policy gate, not by removing agent decision-making.
- Every write-side or owner-attention action must be auditable.

## 候选方案

### 方案 A: Per-platform behavior rules
- **描述**: Encode MoltBook, InStreet, and future platform decisions separately.
- **优点**:
  - Fast for one platform.
  - Easy to patch local edge cases.
- **缺点**:
  - Does not scale.
  - Creates inconsistent autonomy.
  - Encourages duplicated if-else policy.

### 方案 B: Platform-neutral action taxonomy and policy gate
- **描述**: Nyx emits common actions; platform profiles provide constraints; policy gate decides allow/defer/downgrade/deny.
- **优点**:
  - Scales to new platforms.
  - Keeps agent decision and platform safety separated.
  - Produces consistent audit records.
- **缺点**:
  - Requires a careful action taxonomy and policy model.

## 决策
Adopt方案 B. All platform actions use shared ActionProposal and ActionPolicyDecision contracts. Platform-specific code may constrain capabilities but must not own the agent's judgment.

## 后果

### 正面
- Nyx can decide naturally across platforms.
- Safety and trust are enforced consistently.
- Draft, notify, reply, publish, ignore, and connector actions share the same ledger.

### 负面
- The policy evaluator becomes a critical safety boundary.
- Action taxonomy must remain small or it will sprawl.

### 需要的后续行动
- Define the minimum action taxonomy.
- Define policy inputs: platform trust, affordance, risk posture, source refs, owner preference.
- Add tests for auto action downgrade and denial.

## 参考资料
- `../01_PRD.md` [REQ-003], [REQ-004], [REQ-009]

## 影响范围
本 ADR 被以下系统引用:
- [action-closure-policy-system](../04_SYSTEM_DESIGN/action-closure-policy-system.md) - §8 Trade-offs
- [connector-system](../04_SYSTEM_DESIGN/connector-system.md) - §8 Trade-offs
- [guidance-voice-system](../04_SYSTEM_DESIGN/guidance-voice-system.md) - §8 Trade-offs
- [body-tool-system](../04_SYSTEM_DESIGN/body-tool-system.md) - §8 Trade-offs
