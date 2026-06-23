# ADR-001: Continue TypeScript / Node / OpenClaw / SQLite Runtime

## 状态
Accepted

## 日期
2026-06-21

## 背景
v9 changes the agent-body architecture, not the runtime platform. The existing v8 stack already supports OpenClaw plugin registration, CLI ops, SQLite/sql.js state, TypeScript contracts, connector execution, Dream/Quiet, and packaged plugin runtime.

## 决策驱动因素
- v9 should reduce accidental complexity, not introduce a new runtime substrate.
- Continuity and procedural evolution need strong integration with existing state, source refs, closures, and plugin surfaces.
- External skill libraries are useful references but too detached from Second Nature's heartbeat and rollback model.
- Automatic workspace connector evolution must be testable and recoverable inside the current package.

## 候选方案

### 方案 A: Continue the existing stack
- **描述**: Keep TypeScript, Node.js, OpenClaw native plugin, SQLite/sql.js, Markdown/JSON workspace artifacts, Drizzle, and Zod.
- **优点**:
  - Reuses v8 implementation and tests.
  - Directly integrates with Claw-facing plugin and workspace state.
  - Lowest TCO and migration risk.
- **缺点**:
  - Requires careful refactoring of existing v8 seams rather than a clean-room rewrite.

### 方案 B: Add an external procedural-memory runtime
- **描述**: Integrate a separate skill/memory framework as the primary v9 procedure layer.
- **优点**:
  - Could reuse mature skill artifact patterns.
  - Potentially portable across agents.
- **缺点**:
  - Weak coupling to ToolExperience, closure, loop health, and connector rollback.
  - Adds operational and dependency complexity.

### 方案 C: Full runtime self-modification framework
- **描述**: Let Dream/Agent modify core runtime code automatically.
- **优点**:
  - Maximum autonomy.
- **缺点**:
  - Violates recovery and security boundaries.
  - Makes tests, package integrity, and rollback significantly harder.

## 决策
Adopt 方案 A. v9 continues the existing TypeScript / Node / OpenClaw / SQLite stack and implements continuity/procedural evolution as native Second Nature contracts.

## 后果

### 正面
- Preserves OpenClaw compatibility and plugin package shape.
- Keeps v9 changes close to source-backed state, closures, and Dream.
- Avoids new dependency and operational burden.

### 负面
- Requires disciplined refactoring to avoid v8 compatibility clutter.
- Cannot outsource procedural-memory correctness to an external framework.

### 需要的后续行动
- Extend state schema for continuity projections, routines, connector versions, and autonomous change ledger.
- Keep plugin runtime build and packaging gates mandatory.

## 参考资料
- `../00_TECH_EVALUATION.md`
- `../01_PRD.md` [REQ-001] ~ [REQ-007]

## 影响范围
本 ADR 被以下系统引用:
- [runtime-ops-system](../04_SYSTEM_DESIGN/runtime-ops-system.md) - §8 Trade-offs
- [control-context-system](../04_SYSTEM_DESIGN/control-context-system.md) - §8 Trade-offs
- [memory-continuity-system](../04_SYSTEM_DESIGN/memory-continuity-system.md) - §8 Trade-offs
- [body-connector-system](../04_SYSTEM_DESIGN/body-connector-system.md) - §8 Trade-offs
- [observability-recovery-system](../04_SYSTEM_DESIGN/observability-recovery-system.md) - §8 Trade-offs
