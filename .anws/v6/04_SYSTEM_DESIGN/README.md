# v6 System Design Gate

**状态**: Closed / Blueprint-ready  
**日期**: 2026-05-16

v6 的 PRD、Architecture Overview、ADR、System Design、`05A_TASKS.md` 与 `05B_VERIFICATION_PLAN.md` 已对齐。`05_TASKS.md` 仅作为旧版合并任务草案保留；后续 `/forge` 应读取 canonical `05A/05B`。

## Required Design Documents

| 文件 | 必须回答的问题 |
| --- | --- |
| `cli-system.md` | `narrative` / `goal` / `dream:recent` / `connector:*` / ops bridge JSON 契约，host-safe carrier 与 workspace runtime 的降级语义 |
| `control-plane-system.md` | Goal priority cap、user task > accepted goal > rhythm 的裁决顺序、narrative 更新点、无证据时的诚实状态 |
| `connector-system.md` | manifest schema、declarative runner、custom adapter trust policy、conflict policy、reload semantics、route planner 命名空间 |
| `state-system.md` | `SessionChronicle`、`NarrativeState`、`RelationshipMemory`、`AgentGoal`、`MemoryStore` schema、迁移、读写端口 |
| `observability-system.md` | `DreamTrace`、`NarrativeTrace`、connector inventory vs telemetry 分列、budget/timeout trace |
| `behavioral-guidance-system.md` | LLM 输出 schema、source grounding、unsupported claim 拦截、prompt/version 管理 |
| `dream-system.md` | pipeline、sampling、budget、redaction、partial output、candidate/accepted/archived lifecycle |

## Gate Rule

- `07_CHALLENGE_REPORT.md` 中 Critical / High findings 必须全部映射到任务、设计、验证计划或明确 Non-Goal。
- Dream output 不得在验证前污染 active memory。
- Dynamic connector 不得自动执行 workspace 中的任意代码。
- Agent-proposed goal 默认不是授权，必须通过 owner 或 policy gate。
- `05A_TASKS.md` 中每个任务必须带 `验证引用` 与 `证据产出`；`05B_VERIFICATION_PLAN.md` 必须保留 Contract Coverage、Testing Coverage 与 Traceability Matrix。
