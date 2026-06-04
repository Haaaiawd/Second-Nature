# ADR-002: Introduce the Living Perception Loop

## 状态
Accepted

## 日期
2026-06-01

## 背景
v7 heartbeat can repeatedly collect evidence while Nyx still has no meaningful next action. Evidence refs are not enough; the agent needs source-backed perception, judgment, action proposal, policy decision, and closure.

## 决策驱动因素
- Every heartbeat must behave like a natural action cycle, not a silent polling job.
- Agent autonomy must be grounded in evidence and explicit reasons.
- Action results must feed Quiet/Dream instead of disappearing into logs.
- The loop must be observable when stalled.

## 候选方案

### 方案 A: Keep v7 heartbeat and tune sensitivity/Dream triggers
- **描述**: Patch the existing heartbeat and Dream scheduler.
- **优点**:
  - Smallest change.
  - Could make Dream run in limited cases.
- **缺点**:
  - Does not create semantic perception or action closure.
  - Leaves heartbeat as collection without life progression.

### 方案 B: Add a living loop spine
- **描述**: Add explicit stages: EvidenceItem -> PerceptionCard -> JudgmentVerdict -> ActionProposal -> ActionPolicyDecision -> ActionClosureRecord.
- **优点**:
  - Closes the missing semantic loop.
  - Makes stalls diagnosable.
  - Keeps connector and control-plane responsibilities clean.
- **缺点**:
  - Adds new models and cross-system contracts.

## 决策
Adopt方案 B. v8 defines the living perception loop as the main real-time spine before Quiet/Dream memory formation.

## 后果

### 正面
- Evidence becomes agent-readable.
- Heartbeat can produce meaningful actions or explicit no-action reasons.
- Action results can be reviewed later by Quiet/Dream.

### 负面
- Requires new stores, reason codes, and integration tests.
- Poorly bounded implementation could turn perception/judgment into an uncontrolled LLM brain.

### 需要的后续行动
- Implement bounded perception/judgment modules.
- Add `ActionClosureRecord` and no-action reason tracking.
- Add E2E test for `connector read -> evidence -> perception -> judgment -> closure`.

## 参考资料
- `../concept_model.json`
- `../01_PRD.md` [REQ-001], [REQ-002], [REQ-003], [REQ-009]

## 影响范围
本 ADR 被以下系统引用:
- [control-plane-system](../04_SYSTEM_DESIGN/control-plane-system.md) - §8 Trade-offs
- [perception-judgment-system](../04_SYSTEM_DESIGN/perception-judgment-system.md) - §8 Trade-offs
- [action-closure-policy-system](../04_SYSTEM_DESIGN/action-closure-policy-system.md) - §8 Trade-offs
- [observability-health-system](../04_SYSTEM_DESIGN/observability-health-system.md) - §8 Trade-offs
