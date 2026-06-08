# ADR-005: Add Causal Loop Health

## 状态
Accepted

## 日期
2026-06-01

## 背景
v7 can report heartbeat health while the living loop is stalled. Users can see "heartbeat ok" even when evidence never becomes perception, action, Quiet review, Dream memory, or EmbodiedContext projection.

## 决策驱动因素
- Health must describe life progression, not only process uptime.
- Every stage needs a deterministic stall reason.
- OpenClaw and operators need one read model for loop diagnosis.
- Sensitivity blocks must distinguish Dream redaction from storage write validation.

## 候选方案

### 方案 A: Extend existing self-health summaries
- **描述**: Add a few more counters to current health output.
- **优点**:
  - Small change.
  - Reuses current health surface.
- **缺点**:
  - Still symptom-oriented.
  - Does not establish stage-by-stage causality.

### 方案 B: Add causal loop health read model
- **描述**: Track stage freshness and stall reasons across ingestion, perception, judgment, policy, execution, closure, Quiet, Dream, and projection.
- **优点**:
  - Explains exactly where the loop stopped.
  - Supports ops, tests, and owner-facing diagnostics.
  - Prevents heartbeat-ok false confidence.
- **缺点**:
  - Requires consistent stage event emission.

## 决策
Adopt方案 B. v8 introduces `loop_status` as a causal health read model.

## 后果

### 正面
- Operators can diagnose the real broken stage.
- Tests can assert end-to-end life progression.
- Sensitivity scan alerts can be attributed to their real source.

### 负面
- Every system must emit minimal stage evidence.
- Missing events become health failures.

### 需要的后续行动
- Define stage event schema and reason code taxonomy.
- Add loop_status ops command.
- Add integration tests for staged stalls.

## 参考资料
- `../01_PRD.md` [REQ-006], [REQ-008], [REQ-009]
- `../00_DEEPWIKI_MECHANISM_AUDIT.md`

## 影响范围
本 ADR 被以下系统引用:
- [observability-health-system](../04_SYSTEM_DESIGN/observability-health-system.md) - §8 Trade-offs
- [runtime-ops-system](../04_SYSTEM_DESIGN/runtime-ops-system.md) - §8 Trade-offs
- [state-memory-system](../04_SYSTEM_DESIGN/state-memory-system.md) - §8 Trade-offs
