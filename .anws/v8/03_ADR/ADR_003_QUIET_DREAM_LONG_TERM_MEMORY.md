# ADR-003: Long-Term Memory Must Be Formed by Quiet and Dream

## 状态
Accepted

## 日期
2026-06-01

## 背景
The user clarified that long-term memory should come from Dream/Quiet reviewing a whole day. Real-time perception is necessary for action, but it must not directly write long-term memory.

## 决策驱动因素
- Long-term memory should feel like lived experience, not raw event ingestion.
- Quiet and Dream are already the architecture's meaning-consolidation mechanisms.
- Real-time perception contains noise and should feed action closure, not permanent memory directly.
- Accepted memory must still be available to EmbodiedContext.

## 候选方案

### 方案 A: Direct real-time memory projection from perception
- **描述**: Important perceptions immediately become memory projection candidates.
- **优点**:
  - Low latency.
  - Simpler direct path into context.
- **缺点**:
  - Pollutes long-term memory with unreviewed noise.
  - Contradicts the intended Dream/Quiet memory model.

### 方案 B: Quiet/Dream-backed long-term memory
- **描述**: Real-time perception/action produces closure records; Quiet reviews the day; Dream consolidates long-term memory candidates and accepted projections.
- **优点**:
  - Matches the human-like daily review model.
  - Keeps short-term action separate from long-term identity.
  - Preserves candidate/accepted projection discipline.
- **缺点**:
  - Requires closure records and daily review completeness.
  - Memory latency is daily or schedule-bound.

## 决策
Adopt方案 B. Long-term memory is formed only through Quiet Daily Review and Dream Consolidation. MemoryProjection is an accepted long-term memory read model, not a real-time write-through cache.

## 后果

### 正面
- Long-term memory remains curated and source-backed.
- Action closure becomes the proper bridge from heartbeat to Quiet/Dream.
- EmbodiedContext receives memory that has passed consolidation.

### 负面
- Requires robust Dream lifecycle observability.
- Requires Quiet to consume ActionClosureRecord, not only diary artifacts.

### 需要的后续行动
- Repair Quiet-to-Diary/Dream lifecycle.
- Add Dream scheduled/started/completed/failed trace.
- Add projection supersession rules.

## 参考资料
- `../01_PRD.md` [REQ-005], [REQ-006], [REQ-009]
- `../concept_model.json`

## 影响范围
本 ADR 被以下系统引用:
- [dream-quiet-memory-system](../04_SYSTEM_DESIGN/dream-quiet-memory-system.md) - §8 Trade-offs
- [state-memory-system](../04_SYSTEM_DESIGN/state-memory-system.md) - §8 Trade-offs
- [control-plane-system](../04_SYSTEM_DESIGN/control-plane-system.md) - §8 Trade-offs
