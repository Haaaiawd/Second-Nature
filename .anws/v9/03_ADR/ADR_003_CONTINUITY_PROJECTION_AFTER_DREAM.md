# ADR-003: Add Continuity Projection After Quiet/Dream

## 状态
Accepted

## 日期
2026-06-21

## 背景
v8 requires long-term memory to be formed by Quiet/Dream. v9 keeps that principle and extends Dream output so experiences can also become body intuition, procedural memory, self continuity, emergent character/habit projection, and connector evolution for the next context.

## 决策驱动因素
- AI context resets require a short continuity packet.
- Raw history is too noisy for direct Claw context injection.
- Personality should emerge from interaction loops, not from static score tables or prompt declarations.
- Dream already owns post-day consolidation and source-backed validation.

## 候选方案

### 方案 A: Store more raw history in context
- **描述**: Inject more evidence, closure, and tool logs into each session.
- **优点**:
  - Easy to implement initially.
- **缺点**:
  - Bloats context and repeats noise.
  - Does not form stable body intuition.

### 方案 B: Add a separate Self system
- **描述**: Create a standalone system for personality, growth, and continuity.
- **优点**:
  - Clear visible owner.
- **缺点**:
  - Encourages fake personality attributes.
  - Duplicates Dream/Quiet and EmbodiedContext responsibilities.

### 方案 C: Extend Quiet/Dream with Continuity Projection
- **描述**: Dream produces MemoryProjection, ProceduralProjection, SelfContinuityCard, CharacterFrame candidate, and ConnectorEvolutionPlan as separate source-backed outputs.
- **优点**:
  - Keeps long-term formation in the existing consolidation boundary.
  - Produces bounded, validated, supersedable projections.
  - Avoids making continuity a personality score table, emotion oracle, or independent brain.
- **缺点**:
  - Makes Dream more important and requires stronger lifecycle observability.

## 决策
Adopt 方案 C. v9 defines `Continuity Projection` as the post-Dream output family that feeds the next EmbodiedContext.

## 后果

### 正面
- Context-reset Agent receives stable body intuition without raw log stuffing.
- Self style, relationship posture, CharacterFrame inputs, and behavior habits remain source-backed and contestable.
- Procedural memory and connector evolution share the same validation discipline as memory.

### 负面
- Dream/Quiet must handle more output types and stronger validation.
- Projection lifecycle needs schema and supersession rules beyond memory text.

### 需要的后续行动
- Define `SelfContinuityCard`, `CharacterFrame`, `ProceduralProjection`, and `ConnectorEvolutionPlan` schemas.
- Add continuity read model to EmbodiedContext assembly.

## 参考资料
- `../01_PRD.md` [REQ-001], [REQ-004], [REQ-005], [REQ-008]
- `.anws/v8/03_ADR/ADR_003_QUIET_DREAM_LONG_TERM_MEMORY.md`

## 影响范围
本 ADR 被以下系统引用:
- [memory-continuity-system](../04_SYSTEM_DESIGN/memory-continuity-system.md) - §8 Trade-offs
- [character-continuity-system](../04_SYSTEM_DESIGN/character-continuity-system.md) - §8 Trade-offs
- [control-context-system](../04_SYSTEM_DESIGN/control-context-system.md) - §8 Trade-offs
- [body-connector-system](../04_SYSTEM_DESIGN/body-connector-system.md) - §8 Trade-offs
- [observability-recovery-system](../04_SYSTEM_DESIGN/observability-recovery-system.md) - §8 Trade-offs
