# Memory Continuity System — 设计前调研

## 1. 问题与范围

为 Second Nature v9 的 `memory-continuity-system` 确定存储、Quiet/Dream 压缩、连续性投影生命周期与 workspace connector 演化账本的边界。范围限定在：

- v9 state families 的持久化（evidence, attention, closure, quiet review, dream run, memory/procedural/self-continuity/connector-evolution/routine metadata）。
- 从 v8 closure 到 v9 `SelfContinuityCard`、`ToolRoutine`、`ConnectorEvolutionPlan` 的转换。
- 与 `control-context-system`、`body-connector-system`、`action-closure-policy-system`、`character-continuity-system`、`observability-recovery-system` 的接口契约。

不包含：LLM 模型选择、UI、核心 runtime 自动修改、情绪断言。

## 2. 核心洞察

1. **v8 schema 可直接演进，不必推倒重来**。`evidence_item`、`action_closure_record`、`quiet_daily_review`、`dream_consolidation_run`、`long_term_memory_projection` 已具备 `sourceRefsJson`、`payloadJson`、`redactionClass` 等扩展点；v9 新增列/表即可兼容历史数据。
2. **重复 evidence 止血必须发生在写入层**。v8 `evidence_item` 已有 `platformId+contentHash` 唯一索引，v9 只需显式引入 `externalId`、`stableIdentityKey`、`seenCount` 和 `lastObservedAt`，把“新增行”转为“更新计数”。
3. **Procedural memory 不能是文本建议**。参考 v8 `MemoryReviewCandidateClosure` 与 `ActionClosureRecord`，`ToolRoutine` 必须携带 capability pattern、guards、source refs、version 和 rollback ref，才能通过 `action-closure-policy-system` 复验。
4. **自动演化必须有独立账本**。`AutonomousChangeLedger` 与 `ConnectorVersion` 分离，让回滚不依赖重新解析 Dream payload。

## 3. 详细发现

### 3.1 v8 存储扩展点

- `src/storage/db/schema/v8-entities.ts` 中 `evidence_item` 已使用 `uniqueIndex("evidence_item_platform_content_hash_idx")`，是稳定 identity 的基础。
- `long_term_memory_projection` 使用 `status` 列（candidate/active/superseded/rejected/retired），`payloadJson` 存放 `memoryText` 与 `supersedesProjectionId`。
- `action_closure_record` 已区分 `sourceRefsJson` / `proofRefsJson` / `traceRefsJson`，可直接继承为 provenance tier。

### 3.2 Quiet/Dream 边界

- `quiet-daily-review-builder.ts` 负责把 closure 聚合为 readable review，不直接生成长期记忆。
- `dream-consolidation-runner.ts` 只生成 candidates，调用者通过 `acceptMemoryProjection` 完成生命周期转换。
- v9 延续该边界：Dream 生成 candidates → memory-continuity-system 执行 accept/install/activate。

### 3.3 安全与 redaction

- v8 Dream runner 已包含 credential/private context redaction gate，v9 对 `SelfContinuityCard`、`ProceduralProjection`、`ConnectorEvolutionPlan` 复用同一 gate。
- 任何 continuity projection 的 `payloadJson` 不得存放 raw credential、raw private message 或完整 prompt。

## 4. 创意/方案表

N/A — 本系统以约束继承和边界细化为主，没有开放式创意空间。

## 5. 行动建议

1. 在 `evidence_item` 上新增 `externalId`、`stableIdentityKey`、`seenCount`、`firstObservedAt`、`lastObservedAt`、`identityStatus` 列或等效 JSON 字段，并保留 v8 唯一索引作为 fallback。
2. 新增 `procedural_projection`、`tool_routine`、`connector_evolution_plan`、`connector_version`、`self_continuity_card`、`autonomous_change_ledger` 表。
3. `SelfContinuityCard` 字段 `cardText` 在写入时强制 UTF-8 长度 <=1200；`CharacterFrame` 由 `character-continuity-system` 生成，本系统只存指针。
4. 所有自动 routine 安装与 connector 演化结果写入 `autonomous_change_ledger`，并返回 rollback command hint。

## 6. 局限与待探

- `ToolRoutine` 的 guard schema 与 `action-closure-policy-system` 复验方式需在下层 L1 明确。
- Connector evolution 的 sandbox asset path 与 canary heartbeat 判定标准属于 `body-connector-system` 详细设计。
- v7 life evidence compatibility 是否需要独立 read adapter，还是复用 v8 evidence normalizer，待 forge 阶段验证。

## 7. 参考来源

- `.anws/v9/01_PRD.md` [REQ-001], [REQ-002], [REQ-004], [REQ-005], [REQ-007]
- `.anws/v9/02_ARCHITECTURE_OVERVIEW.md` §2 System 5, §3 系统依赖图
- `.anws/v9/03_ADR/ADR_003_CONTINUITY_PROJECTION_AFTER_DREAM.md`
- `.anws/v9/03_ADR/ADR_005_PROCEDURAL_MEMORY_AS_VERIFIED_ROUTINE.md`
- `.anws/v9/03_ADR/ADR_004_WORKSPACE_ONLY_CONNECTOR_EVOLUTION.md`
- `.anws/v9/concept_model.json`
- `src/storage/db/schema/v8-entities.ts`
- `src/core/second-nature/quiet-dream/dream-consolidation-runner.ts`
- `src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts`
- `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts`
- `src/shared/types/v8-contracts.ts`
