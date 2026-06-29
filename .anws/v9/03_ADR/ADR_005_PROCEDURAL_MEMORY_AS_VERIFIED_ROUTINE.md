# ADR-005: Model Procedural Memory as Verified Routine

## 状态
Accepted

## 日期
2026-06-21

## 背景
The user framed muscle memory as code-like reusable routines that reduce repeated Agent reasoning. v9 must support this without letting routines bypass policy or become vague prompt advice.

## 决策驱动因素
- ToolExperience and closure only matter if they change future behavior.
- Procedural memory must be executable or at least directly applicable.
- Routines must not expand authority or hide side effects.
- Agent should know which routine is being applied.

## 候选方案

### 方案 A: Free-text procedural notes
- **描述**: Dream writes natural-language tips into memory.
- **优点**:
  - Easy to generate.
- **缺点**:
  - Hard to validate, execute, or rollback.
  - Prone to prompt slop.

### 方案 B: Verified ToolRoutine artifacts
- **描述**: Dream produces routine candidates with typed steps, guards, source refs, version, trace, and rollback ref. Validated routines can be invoked by Agent/context.
- **优点**:
  - Reduces repeated reasoning while staying auditable.
  - Can be tested and versioned.
  - Cannot bypass policy if guard schema is enforced.
- **缺点**:
  - Requires routine schema and registry.

### 方案 C: Direct generated code routines
- **描述**: Dream writes arbitrary executable code for repeated workflows.
- **优点**:
  - Most flexible.
- **缺点**:
  - Harder to sandbox and review.
  - Overlaps with connector evolution and risks authority expansion.

## 决策
Adopt 方案 B. v9 procedural memory is represented as verified `ToolRoutine` artifacts, not free text or arbitrary code. Routines may call existing capabilities and must pass policy/guard validation.

## 后果

### 正面
- Muscle memory becomes durable, inspectable, and executable.
- Claw Agent can apply routines without rethinking repetitive tool paths.
- Routine safety can be tested independently.

### 负面
- Some high-flexibility code generation must stay in connector evolution or forge backlog.
- Requires schema evolution for routine lifecycle.

### 需要的后续行动
- Define `ToolRoutine` schema with triggers, steps, guards, source refs, version, rollback ref.
- Add routine registry read model to EmbodiedContext.
- Add routine execution trace to closure and observability.

## 参考资料
- `../01_PRD.md` [REQ-004]
- `../00_TECH_EVALUATION.md`

## 影响范围
本 ADR 被以下系统引用:
- [body-connector-system](../04_SYSTEM_DESIGN/body-connector-system.md) - §8 Trade-offs
- [memory-continuity-system](../04_SYSTEM_DESIGN/memory-continuity-system.md) - §8 Trade-offs
- [control-context-system](../04_SYSTEM_DESIGN/control-context-system.md) - §8 Trade-offs
- [action-closure-policy-system](../04_SYSTEM_DESIGN/action-closure-policy-system.md) - §8 Trade-offs
