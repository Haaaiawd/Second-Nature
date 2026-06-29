# ADR-004: Allow Workspace-Only Autonomous Connector Evolution

## 状态
Accepted

## 日期
2026-06-21

## 背景
The user explicitly chose automatic workspace connector improvement. v9 must let the body improve its hands without requiring manual confirmation, while preserving core runtime recoverability.

## 决策驱动因素
- Workspace connector scaffold should not stay as permanent `NOT_IMPLEMENTED` hands.
- Agent/Dream should reduce repeated connector reasoning by improving recipes and adapters.
- Automatic changes must not expand authority or mutate core runtime.
- Rollback is mandatory because autonomous evolution can fail.

## 候选方案

### 方案 A: Candidate-only connector proposals
- **描述**: Dream writes suggestions but never applies them automatically.
- **优点**:
  - Very safe.
- **缺点**:
  - Fails the user requirement to avoid manual confirmation.
  - Keeps connector evolution outside the living loop.

### 方案 B: Workspace-only automatic evolution
- **描述**: Dream/Agent can automatically modify workspace connector manifest, declarative recipe, or sandboxed adapter after mechanical gates and rollback setup.
- **优点**:
  - Makes hands improve from experience.
  - Keeps changes inside workspace connector boundary.
  - Testable through schema, permission, sandbox, fixture, wet-probe, canary, rollback gates.
- **缺点**:
  - Requires new version ledger and gate orchestration.

### 方案 C: Full automatic core/runtime modification
- **描述**: Dream/Agent can modify Second Nature core source and dependencies.
- **优点**:
  - Maximum adaptive power.
- **缺点**:
  - Violates recovery, package integrity, and policy boundaries.
  - Too risky for plugin runtime.

## 决策
Adopt 方案 B. v9 permits automatic workspace connector evolution and forbids automatic core runtime, credential scope, external write policy, or dependency modification.

## 后果

### 正面
- Workspace connectors can become real hands through experience.
- Scaffold capabilities stop polluting real affordance until validated.
- Failed evolution can automatically rollback.

### 负面
- Requires deterministic gates and careful sandbox design.
- Some useful core improvements remain backlog items for `/change` or `/forge`, not automatic Dream changes.

### 需要的后续行动
- Define connector version ledger and gate result schema.
- Implement recipe/adapter sandbox policy.
- Add canary heartbeat rollback tests.

## 参考资料
- `../01_PRD.md` [REQ-005], [REQ-006], [REQ-007]
- `../concept_model.json` clarifications

## 影响范围
本 ADR 被以下系统引用:
- [body-connector-system](../04_SYSTEM_DESIGN/body-connector-system.md) - §8 Trade-offs
- [memory-continuity-system](../04_SYSTEM_DESIGN/memory-continuity-system.md) - §8 Trade-offs
- [runtime-ops-system](../04_SYSTEM_DESIGN/runtime-ops-system.md) - §8 Trade-offs
- [observability-recovery-system](../04_SYSTEM_DESIGN/observability-recovery-system.md) - §8 Trade-offs
