# State System Research

**System ID**: `state-system`  
**Target**: `.anws/v6`  
**Date**: 2026-05-15  
**Scope**: v6 state and memory contracts for Session Chronicle, Agent Self Layer, Dream I/O, lifecycle governance, and v5 compatibility.

---

## 1. Problem & Scope

| 子问题 | 方向 | 预期产出 |
| --- | --- | --- |
| v6 state 如何在不破坏 v5 evidence-first 基线下承接 Agent Self Layer？ | 混合 | `SessionChronicle`、`NarrativeState`、`RelationshipMemory`、`AgentGoal` 的边界 |
| Dream input/output store 应如何持久化而不污染 active memory？ | 混合 | `MemoryStore` 与 `DreamOutputLifecycle` 的接纳治理 |
| SQLite/sql.js + workspace artifacts 如何继续承担本地真相源？ | 向外 | atomic write、WAL/native 与 sql.js fallback 的运行边界 |
| state 与 observability 如何切分？ | 向内 | 状态资产 vs 审计事件的职责边界 |

**范围内**: state schema、workspace artifact shape、read/write ports、migration、repair、accepted projection。  
**范围外**: Dream pipeline 算法、LLM prompt、CLI 命令展示、observability audit schema。

---

## 2. Core Insights

1. v6 不能把 Agent Self Layer 做成 prompt-only；narrative、relationship、goal 和 memory store 必须是可追溯 state。
2. Dream output 必须先写成 candidate/partial/archived artifact，只有 state lifecycle port 能把它标记为 accepted。
3. Session Chronicle 是 v6 的最小时间线；它连接 heartbeat、outreach、owner reply、Dream 和 relationship update。
4. SQLite/sql.js 继续适合作为本地索引面，但 workspace artifacts 仍是人可读记忆面。
5. state 保存业务真相和 lifecycle；observability 保存解释链，二者不能混成第二套 memory。

---

## 3. Detailed Findings

### Q1. Agent Self Layer 的 state 归属

ADR-003 明确选择 Agent Self Layer 作为跨系统 concern：`state-system` 保存 NarrativeState、RelationshipMemory、AgentGoal、MemoryStore；`control-plane-system` 消费这些状态并做决策；`behavioral-guidance-system` 只生成 proposal；`dream-system` 执行异步整理。

**设计结论**: state-system 必须暴露专门 port，禁止新增泛化 `saveMemory()`。泛化接口会把 evidence、proposal、accepted memory 混成一锅，后面肯定炸。

### Q2. Dream output lifecycle

ADR-004 要求 Dream 输入输出分离，`dream-system.md` 进一步定义 `candidate`、`accepted`、`archived`、`partial`。这意味着 state-system 不只是存文件，还要成为 active memory pointer 和 lifecycle transition 的唯一 owner。

**设计结论**: `writeMemoryStore()` 只写 artifact；`transitionMemoryStoreLifecycle()` 才能改变状态；`loadAcceptedMemoryProjection()` 只能返回 accepted store 的派生读模型。

### Q3. SQLite / artifact 持久化现实边界

SQLite 官方 atomic commit 文档说明 rollback journal 让事务在崩溃后表现为全有或全无；WAL 文档说明 WAL 支持读写并发，但同一 WAL 仍只有一个 writer，并且 checkpoint 与长读事务会影响 WAL 增长。来源：<https://www2.sqlite.org/atomiccommit.html> 与 <https://www.sqlite.org/wal.html>（2026-05-15 检索）。

**设计结论**: native SQLite 可用 WAL + checkpoint 管理；sql.js/wasm fallback 不能假设 WAL，需要单写队列、explicit flush、artifact repair。

### Q4. State 与 Observability 切分

v5 state design 已经把 canonical artifact 与 SQLite index 作为业务状态层，v5 observability design 把 decision/delivery/source coverage 作为解释层。v6 新增 DreamTrace、NarrativeTrace、connector inventory audit 后，边界更容易混。

**设计结论**: `state-system` 存 `SessionChronicle`、`NarrativeState`、`RelationshipMemory`、`AgentGoal`、`MemoryStore` 和 active pointer；`observability-system` 存 `DreamTrace`、`NarrativeTrace`、inventory audit 与 explain index。

---

## 4. Options

| 方案 | 判定 | 理由 |
| --- | --- | --- |
| 把 Agent Self 全部放进 prompt/session | 拒绝 | 无积累、不可追溯、无法支撑 owner 可见状态 |
| 新增独立 agent-self store | 拒绝 | 与 state/observability 重叠，增加无必要复杂度 |
| 在 state-system 增量新增 typed state + lifecycle port | 采纳 | 继承 v5 evidence-first，同时承接 v6 schema |
| Dream output 直接替换 active memory | 拒绝 | 坏输出会污染长期行为 |
| candidate/accepted/archived lifecycle | 采纳 | 失败可见、接纳可控、便于 CLI 和 challenge 验证 |

---

## 5. Action Recommendations

| 行动 | 设计承接 |
| --- | --- |
| 定义 `SessionChronicle` 为所有 heartbeat/outreach/reply/Dream 事件的轻量时间线 | `state-system.md` §5, §6 |
| 定义 `NarrativeState`、`RelationshipMemory`、`AgentGoal` 的 source refs、confidence 和 status | `state-system.md` §6 |
| 定义 `MemoryStore` 与 lifecycle transition port | `state-system.md` §5, §6 |
| 将 `DreamRunLock` 放在 state lease port，供 dream-system 调用 | `state-system.md` §5 |
| 保留 v5 life evidence、quiet artifact、fallback、credential/policy 兼容层 | `state-system.md` §4, §11 |

---

## 6. Limits & Open Questions

| 项 | 状态 |
| --- | --- |
| MemoryStore 是否未来加入 vector index | P1/P2；v6 P0 只做 source-backed canonical entries |
| owner 多账号、多 agent 隔离 | 非 v6 P0；字段预留 `ownerId` / `agentId` 不强制多租户 |
| active memory 接纳是否需要人工 review UI | P1；P0 通过 validation + policy transition |
| sql.js flush 具体实现 | `/forge` 根据现有 runtime adapter 决定，设计只规定不可假设 WAL |

---

## 7. Sources

- `.anws/v6/01_PRD.md`
- `.anws/v6/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v6/03_ADR/ADR_003_AGENT_SELF_LAYER.md`
- `.anws/v6/03_ADR/ADR_004_DREAM_MECHANISM.md`
- `.anws/v6/04_SYSTEM_DESIGN/dream-system.md`
- `.anws/v5/04_SYSTEM_DESIGN/state-system.md`
- SQLite, "Atomic Commit In SQLite", accessed 2026-05-15: <https://www2.sqlite.org/atomiccommit.html>
- SQLite, "Write-Ahead Logging", accessed 2026-05-15: <https://www.sqlite.org/wal.html>
- `src/storage/life-evidence/types.ts`
- `src/storage/quiet/quiet-artifact-types.ts`
- `src/storage/delivery/types.ts`
