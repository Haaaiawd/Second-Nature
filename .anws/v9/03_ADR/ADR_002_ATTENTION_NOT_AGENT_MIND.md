# ADR-002: Narrow Real-Time Semantics to Attention, Not Agent Mind

## 状态
Accepted

## 日期
2026-06-21

## 背景
v8 introduced `JudgmentVerdict` to close the semantic loop. v9 clarifies the Mind/Body boundary: Claw Agent remains the open mind, while Second Nature provides source-backed attention, body intuition, policy boundaries, closure, and contestable projections. Those projections are not authoritative claims about final thought or emotion.

## 决策驱动因素
- Second Nature should guide, not replace, the Agent's reasoning.
- The user explicitly rejected over-engineered personality simulation and programmatic emotion claims, while allowing emergent personality/habit formation.
- Body outputs should be safe to inject into Claw context after reset.
- Action closure and policy still need machine-readable inputs.

## 候选方案

### 方案 A: Keep v8 JudgmentVerdict as the primary real-time brain
- **描述**: Keep perception -> judgment as the body-owned semantic decision path.
- **优点**:
  - Preserves existing v8 task structure.
  - Easy to map to action proposals.
- **缺点**:
  - Blurs the boundary between body and Agent mind.
  - Encourages scripted personality and fixed decision logic.

### 方案 B: Replace real-time body judgment with AttentionSignal
- **描述**: The body emits novelty, relevance, repetition, risk, possible actions, and source refs; Claw Agent or verified routines author the action intent.
- **优点**:
  - Preserves Agent autonomy.
  - Reduces accidental complexity.
  - Keeps attention grounded and testable.
- **缺点**:
  - Requires migration from v8 `JudgmentVerdict` tests and stores.

### 方案 C: Remove real-time semantics entirely
- **描述**: Store evidence and rely on the Agent to inspect raw evidence directly.
- **优点**:
  - Simplest body implementation.
- **缺点**:
  - Recreates v7 evidence-pile failure.
  - Increases Claw context burden.

## 决策
Adopt 方案 B. v9 introduces `AttentionSignal` as the body-owned semantic output. The final action judgment remains Agent-authored or routine-invoked and must pass policy/closure.

## 后果

### 正面
- Claw Agent stays tightly connected to the loop without being replaced.
- The body can suppress duplicates and surface relevance without owning final mind, personality control, or emotional truth.
- Action proposals remain source-backed and policy-bound.

### 负面
- Existing v8 `JudgmentVerdict` implementation must be adapted or compatibility-wrapped.
- Some tests and reports need renamed expectations.

### 需要的后续行动
- Define `AttentionSignal` schema and migration path.
- Ensure prompt/context wording presents attention and character signals as contestable body projections, not commands or emotion claims.
- Update action proposal builder to accept Agent/routine-authored intents with attention refs.

## 参考资料
- `../01_PRD.md` [REQ-003]
- `../02_ARCHITECTURE_OVERVIEW.md` §2 System 3
- `.anws/v8/03_ADR/ADR_002_LIVING_PERCEPTION_LOOP.md`

## 影响范围
本 ADR 被以下系统引用:
- [attention-system](../04_SYSTEM_DESIGN/attention-system.md) - §8 Trade-offs
- [control-context-system](../04_SYSTEM_DESIGN/control-context-system.md) - §8 Trade-offs
- [action-closure-policy-system](../04_SYSTEM_DESIGN/action-closure-policy-system.md) - §8 Trade-offs
- [guidance/voice paths](../04_SYSTEM_DESIGN/control-context-system.md) - §8 Trade-offs
