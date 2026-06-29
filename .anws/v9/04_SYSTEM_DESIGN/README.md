# v9 System Design Index

> **Status**: L0 设计已完成；L1 detail 文件按系统拆分。本节由 `/design-system` 维护。

## System Design Files

| 系统 | L0 | L1 |
| ---- | -- | -- |
| `runtime-ops-system` | [runtime-ops-system.md](./runtime-ops-system.md) | [runtime-ops-system.detail.md](./runtime-ops-system.detail.md) |
| `control-context-system` | [control-context-system.md](./control-context-system.md) | [control-context-system.detail.md](./control-context-system.detail.md) |
| `attention-system` | [attention-system.md](./attention-system.md) | [attention-system.detail.md](./attention-system.detail.md) |
| `action-closure-policy-system` | [action-closure-policy-system.md](./action-closure-policy-system.md) | [action-closure-policy-system.detail.md](./action-closure-policy-system.detail.md) |
| `memory-continuity-system` | [memory-continuity-system.md](./memory-continuity-system.md) | [memory-continuity-system.detail.md](./memory-continuity-system.detail.md) |
| `character-continuity-system` | [character-continuity-system.md](./character-continuity-system.md) | [character-continuity-system.detail.md](./character-continuity-system.detail.md) |
| `body-connector-system` | [body-connector-system.md](./body-connector-system.md) | [body-connector-system.detail.md](./body-connector-system.detail.md) |
| `observability-recovery-system` | [observability-recovery-system.md](./observability-recovery-system.md) | [observability-recovery-system.detail.md](./observability-recovery-system.detail.md) |

## Shared Contracts

- [shared-v9-contracts.md](./shared-v9-contracts.md) — v9 跨系统 canonical schema、enum、ownership 单一事实来源。

## Research & Review

- `_research/memory-continuity-system-research.md` — v9 memory-continuity 设计前调研。
- `_review/cross-system-design-review.md` — 第一轮跨系统冲突与命名不一致审查报告。
- `_review/cross-system-design-review-2-fix-report.md` — 第二轮修复报告（统一 shared contracts 与 L0/L1）。
- `_review/character-continuity-boundary-review.md` — 第一轮 character-continuity 人格/情绪边界审查报告。
- `_review/character-continuity-boundary-review-2.md` — 第二轮 character-continuity 边界审查报告（Pass）。
- `_review/shared-contracts-spot-review.md` — shared contracts 字段一致性 spot review。
- `_review/connector-alignment-spot-review-2.md` — ConnectorVersion/Plan 对齐复验报告。

## Design Focus

- Preserve the closed loop from sensing to next context.
- Keep Claw Agent as the open mind; body emits attention and continuity.
- Define automatic workspace connector evolution gates and rollback.
- Define procedural memory as verified routines, not free-text notes.
- Define `character-continuity-system` as source-backed emergent personality/habit projection, not a preconfigured personality score table, hard controller, or emotion claim.
