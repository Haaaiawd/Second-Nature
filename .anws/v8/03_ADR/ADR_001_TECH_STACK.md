# ADR-001: Continue TypeScript / Node / OpenClaw Runtime

## 状态
Accepted

## 日期
2026-06-01

## 背景
v8 must close the living loop without destabilizing the already working plugin, connector, state, and test surfaces. The gap is semantic, not infrastructural: v7 can collect evidence and expose ops commands, but it lacks perception, judgment, action closure, and Dream-backed long-term memory flow.

## 决策驱动因素
- Reuse v7 plugin, connector, state, and test investments.
- Keep deployment inside the existing OpenClaw plugin and CLI surface.
- Spend complexity budget on semantic closure, not runtime migration.
- Preserve TypeScript contracts and existing package/build flow.

## 候选方案

### 方案 A: TypeScript / Node / OpenClaw in-place evolution
- **描述**: Keep the current runtime and add v8 modules inside `src/core/second-nature`, `src/storage`, `src/dream`, and ops surfaces.
- **优点**:
  - Lowest migration cost.
  - Existing test and packaging path remains valid.
  - Directly targets the semantic gap.
- **缺点**:
  - Requires careful module boundaries to avoid control-plane bloat.

### 方案 B: Add external workflow engine or event bus
- **描述**: Introduce a durable orchestration engine for heartbeat stages.
- **优点**:
  - Explicit stages and retry semantics.
  - Useful if runtime becomes distributed.
- **缺点**:
  - Does not solve semantic judgment by itself.
  - Adds deployment, debugging, and state consistency cost.

### 方案 C: Move Second Nature body into a daemon/service
- **描述**: Extract runtime from OpenClaw plugin into a separate service.
- **优点**:
  - Long-term productization path.
  - Cleaner process isolation.
- **缺点**:
  - Expands credential, host, and package surface too early.
  - Increases local setup and recovery burden.

## 决策
Adopt方案 A: continue TypeScript / Node / OpenClaw in-place evolution. v8 adds semantic systems and closure ledgers inside the existing runtime.

## 后果

### 正面
- v8 can reuse existing connector runners, state stores, plugin packaging, and tests.
- The architecture focuses on perception, judgment, policy, closure, and memory instead of infrastructure migration.

### 负面
- The codebase must enforce system boundaries by module contracts, not process boundaries.
- Control-plane bloat remains a risk.

### 需要的后续行动
- Define module roots for `perception`, `judgment`, `action`, and `policy`.
- Add integration tests for the full causal loop.

## 参考资料
- `../01_PRD.md`
- `../02_ARCHITECTURE_OVERVIEW.md`
- `../00_DEEPWIKI_MECHANISM_AUDIT.md`

## 影响范围
本 ADR 被以下系统引用:
- [runtime-ops-system](../04_SYSTEM_DESIGN/runtime-ops-system.md) - §8 Trade-offs
- [control-plane-system](../04_SYSTEM_DESIGN/control-plane-system.md) - §8 Trade-offs
- [perception-judgment-system](../04_SYSTEM_DESIGN/perception-judgment-system.md) - §8 Trade-offs
- [action-closure-policy-system](../04_SYSTEM_DESIGN/action-closure-policy-system.md) - §8 Trade-offs
