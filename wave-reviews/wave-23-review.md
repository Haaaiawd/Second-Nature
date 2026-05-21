# Wave 23 Code Review — 2026-05-16

## 1. 总结结论

Pass（静态语义下）。T4.1.2–T4.1.5 的 v6 Agent Self Layer 状态层均忠实兑现 design 契约；27 单元/集成测试全绿；未发现 Critical / High / Medium / Low 级 issue。

## 2. 审查范围与静态边界

已审：
- `src/storage/db/schema/narrative-state.ts`
- `src/storage/narrative/narrative-state-store.ts`
- `src/storage/db/schema/relationship-memory.ts`
- `src/storage/relationship/relationship-memory-store.ts`
- `src/storage/db/schema/agent-goal.ts`
- `src/storage/goal/agent-goal-store.ts`
- `src/storage/db/schema/memory-store.ts`
- `src/storage/memory-store/memory-store-lifecycle.ts`
- `src/storage/db/index.ts`（STATE_SCHEMA_SQL 新增表与索引）
- `src/storage/index.ts`（新增导出）
- `tests/unit/storage/t4-1-2-narrative-state.test.ts`
- `tests/unit/storage/t4-1-3-relationship-memory.test.ts`
- `tests/unit/storage/t4-1-4-agent-goal.test.ts`
- `tests/integration/storage/t4-1-5-memory-store-lifecycle.test.ts`

未审：真实宿主运行时中 sql.js 并发读写与 WAL 回退；这些属运行时验证边界。

## 3. 契约 → 代码映射摘要

- T4.1.2：`narrative_state` drizzle schema 对应 design §6.1 `NarrativeState` 字段；`updateNarrativeState` / `loadNarrativeState` 对应 design §5.2 `StateSelfLayerPort`；status 枚举 (`active`/`insufficient_sources`/`awaiting_sources`) 与 design 一致；`unsupportedClaimsJson` 列承接 unsupported claim 处理契约。
- T4.1.3：`relationship_memory` schema 对应 design §6.1 `RelationshipMemory`；`tonePreference` 枚举 (`casual`/`direct`/`quiet`/`unknown`) 与 design 一致；`noReplyCount` 支持 no-reply cooldown signal；`topicAffinities` 以 JSON 存储 `TopicAffinity[]`。
- T4.1.4：`agent_goal` schema 对应 design §6.1 `AgentGoal`；status 枚举 (`proposal`/`accepted`/`rejected`/`completed`/`paused`)、origin 枚举 (`owner_set`/`agent_proposed`/`policy_seeded`)、risk 枚举 (`low`/`medium`/`high`) 均与 design 一致；`transitionGoalStatus` 实现 owner/policy gate；`acceptedBy` 字段承接授权治理。
- T4.1.5：`memory_store` schema 对应 design §6.1 `MemoryStore`；`lifecycleStatus` 枚举 (`candidate`/`accepted`/`archived`/`partial`/`superseded`) 与 design §4.4 lifecycle 一致；`loadAcceptedMemoryProjection()` 仅返回 `accepted` 状态，防止 candidate 污染 active memory；`inputMemoryStoreId` 不可变。

## 4. Lens 结果摘要

**L1 Contract Fidelity**：Pass。所有 schema 字段、枚举值、store 端口签名与 design §6.1 / §5.2 一致；`STATE_SCHEMA_SQL` 新增表与 `src/storage/index.ts` 导出是内部扩展，不引入新的跨系统公共契约。

**L2 Task Fulfillment**：Pass。T4.1.2 覆盖 active/insufficient/awaiting 与 unsupported claim；T4.1.3 覆盖 reply/no_reply 与 topic affinity；T4.1.4 覆盖 owner-set/proposal/transition；T4.1.5 覆盖 candidate/accepted/archived/accepted projection。Mock/Stub 边界清晰（`:memory:` DB）。

**L3 Architecture Fit**：Pass。目录结构与 design §7.2 一致（`src/storage/narrative/`、`relationship/`、`goal/`、`memory-store/`）；各 store 通过 `StateDatabase` 端口接入，不暴露泛化 `saveMemory()`；与现有 `src/storage/chronicle/` 模式同构。

**L4 Runtime/Safety**：Pass。所有 store 使用 drizzle ORM 参数化查询；JSON 字段通过 `safeParseJson` 回退，防止 malformed JSON 导致读取崩溃；`MemoryStorePort.loadAcceptedMemoryProjection()` 显式过滤 `accepted` 状态，防止 candidate 进入 active read path；`agent_goal` 的 `acceptedBy` 字段仅在 `status=accepted` 时有意义，但 schema 层面未强制约束（业务层承担）。

**L5 Verification**：Pass。`pnpm typecheck` 0 error；`node --test` 27/27 pass。T4.1.2–T4.1.4 为单元测试，T4.1.5 为集成测试，与 05B 验证计划要求一致。

**L6 Backflow/Handoff**：Pass。新增公共 API 均通过 `src/storage/index.ts` 导出；schema 表名使用 snake_case，与现有 `session_chronicle` 等表一致；测试文件名与 05A 证据产出路径对齐。

## 5. Issues

无。

## 6. 安全 / 测试覆盖补充

- sql.js 在真实宿主中 `:memory:` 模式与磁盘模式的并发差异未由静态审查证明。
- `MemoryStoreValidation` 中的 `unsupportedClaims` / `redactionIssues` 字段在当前 schema 中仅通过 JSON 存储，未建独立索引；如查询频繁需在未来增加索引。
- `TopicAffinity` 与 `DreamInsight` / `CanonicalMemoryEntry` / `MemoryStoreValidation` 为内部辅助类型，非跨系统公共契约。
