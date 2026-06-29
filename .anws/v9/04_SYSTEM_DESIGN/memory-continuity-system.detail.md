# Memory Continuity System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`memory-continuity-system.md`](./memory-continuity-system.md)
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。
> **孤岛检查**: 本文件各节均须在 L0 有对应超链接入口。

---

## 版本历史

| 版本 | 日期         | Changelog |
| ---- | ------------ | --------- |
| v1.1 | 2026-06-22 | Added ActivityThread / ActivityStep persistence fields for multi-heartbeat continuation |
| v1.0 | 2026-06-21 | 初始 L1；由 L0 R5 拆分触发，收纳完整字段表与契约矩阵 |

---

## 本文件章节索引

|   §   | 章节                                                         | 对应 L0 入口           |
| :---: | ------------------------------------------------------------ | ---------------------- |
|  §1   | [配置常量](#1-配置常量-config-constants)                     | L0 §6 / §10            |
|  §2   | [完整数据模型字段声明](#2-完整数据模型字段声明-full-data-model) | L0 §6.1 数据模型       |
|  §3   | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5.1 操作契约表     |
|  §4   | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details)    | L0 §4 架构图 / 数据流  |
|  §5   | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §5 / §9             |
|  §6   | [契约验证矩阵详细版](#6-契约验证矩阵详细版)                  | L0 §11.4 测试策略      |

---

## §1 配置常量 (Config Constants)

> **L0 对应入口**: L0 §6 数据模型、§10 性能考虑

| 常量 | 值 | 说明 | 来源 |
| ---- | --- | ---- | ---- |
| `SELF_CONTINUITY_CARD_MAX_CHARS` | 1200 | `cardText` 默认 UTF-8 长度上限 | PRD US-001 |
| `CHARACTER_FRAME_MAX_CHARS` | 900 | 由 `character-continuity-system` 负责；本系统仅校验指针 | PRD US-008 |
| `QUIET_MAX_CLOSURES_PER_DAY` | 200 | 单日进入 Quiet review 的 closure 上限 | v8 `quiet-daily-review-builder.ts` |
| `QUIET_REVIEW_MAX_MEMORY_CANDIDATES` | 20 | 单日展示 memory candidate 上限 | v8 `quiet-daily-review-builder.ts` |
| `EVIDENCE_STABLE_IDENTITY_SEPARATOR` | `:` | stable identity key 分段符 | 本系统决策 §8.4 |
| `CARD_ASSEMBLY_TIMEOUT_MS` | 2000 | `assembleSelfContinuityCard` 默认超时 | PRD §6.1 |
| `CONNECTOR_EVOLUTION_TIMEOUT_MS` | 30_000 | `applyConnectorEvolutionPlan` 执行上限 | DR-05 rollback liveness |

---

## §2 完整数据模型字段声明 (Full Data Model)

> **L0 对应入口**: L0 §6.1 核心实体；本节提供每个实体的完整字段表。

### EvidenceItem（稳定 identity 扩展）

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v8 schema |
| `createdAt` | text | ISO-8601, not null | v8 schema |
| `platformId` | text | not null | v8 schema |
| `externalId` | text | nullable；connector 提供的稳定 id | v9 [REQ-002] |
| `contentHash` | text | not null | v8 schema |
| `stableIdentityKey` | text | not null；derived from platform+externalId+contentHash | v9 [REQ-002] |
| `observedAt` | text | ISO-8601, not null | v8 schema |
| `firstObservedAt` | text | ISO-8601 | v9 [REQ-002] |
| `lastObservedAt` | text | ISO-8601 | v9 [REQ-002] |
| `seenCount` | integer | default 1 | v9 [REQ-002] |
| `rowIdentityStatus` | text | `stable` / `unstable` / `duplicate_row` | v9 [REQ-002] |

**语义说明**: `rowIdentityStatus` 描述 durable row 状态，与 `attention-system.RepetitionKind` 映射如下：
- `new` / `changed` → `stable`
- `duplicate`（重复暴露） → `duplicate_row`
- `identity_unstable` → `unstable`

`duplicate_row` 表示该行是已有 logical identity 的重复写入（更新 `seenCount`），而不是 evidence 本身的重复状态。
| `sensitivityHint` | text | nullable | v8 schema |
| `redactionClass` | text | default `none` | v8 schema |
| `sourceRefsJson` | text | not null | v8 schema |
| `payloadJson` | text | redacted normalized content | v8 schema |
| `status` | text | default `pending` | v8 Wave 114 |

索引：`uniqueIndex(platformId, contentHash)` 保留；新增 `index(stableIdentityKey)`、`index(lastObservedAt, rowIdentityStatus)`。

### AttentionSignal

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v9 [REQ-003] |
| `createdAt` | text | not null | v9 |
| `cycleId` | text | not null | v9 |
| `evidenceRefsJson` | text | 关联 EvidenceItem ids | v9 |
| `novelty` | real | 0.0–1.0 | v9 |
| `relevance` | real | 0.0–1.0 | v9 |
| `repetition` | text | `new` / `changed` / `duplicate` / `identity_unstable` | v9 |
| `riskFlagsJson` | text | JSON array | v9 |
| `possibleActionsJson` | text | JSON array；不包含 `connector_read` | v9 |
| `sourceRefsJson` | text | not null | v9 |
| `status` | text | `attentive` / `attention_blocked_missing_sources` / `degraded` | v9 |
| `redactionClass` | text | default `none` | v9 |
| `payloadJson` | text | bounded summary | v9 |
| `activityThreadId` | text | nullable；related thread pointer | v9 [REQ-003] |
| `threadSuggestion` | text | nullable；`create` / `continue` / `pause` / `complete` / `none` | v9 [REQ-003] |

**v8 兼容性**: v9 新建 `attention_signal` 表；`judgment_verdict` 表保留为只读 legacy。
- `control-context-system` 不再从 `judgment_verdict` 读取作为决策输入。
- `memory-continuity-system` 提供 `readLegacyJudgmentVerdictAsAttentionSignal(judgmentId)`，返回 `status=degraded`、`reason=v8_legacy_judgment_mapped` 的 `AttentionSignal`，用于 observability replay / 历史查询。
- v9 实时 heartbeat 路径只写入/读取 `attention_signal`。
- 现有 v8 测试：保留为 legacy replay tests，标记 `legacy_judgment_verdict_adapter`；新测试必须基于 `AttentionSignal` 语义。

### ActivityThread

新增 v9 `activity_thread` 表，由 `control-context-system` 推进语义，`memory-continuity-system` 负责持久化与 bounded read。

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `threadId` | text | PK | v9 [REQ-003] |
| `originAttentionSignalId` | text | not null | v9 [REQ-003] |
| `status` | text | `active` / `paused` / `completed` / `abandoned` / `blocked` | v9 [REQ-003] |
| `currentFocus` | text | redacted, ≤200 chars | v9 [REQ-003] |
| `associationsJson` | text | JSON array；每项 ≤160 chars | v9 [REQ-003] |
| `nextPossibleMovesJson` | text | JSON array of ActivityStepKind | v9 [REQ-003] |
| `completedStepCount` | integer | default 0 | v9 [REQ-003] |
| `lastStepKind` | text | nullable | v9 [REQ-003] |
| `blockerReason` | text | nullable | v9 [REQ-003] |
| `stopCondition` | text | not null | v9 [REQ-003] |
| `lastHeartbeatSequence` | integer | not null | v9 [REQ-003] |
| `sourceRefsJson` | text | not null | v9 [REQ-003] |
| `createdAt` | text | ISO-8601 | v9 |
| `updatedAt` | text | ISO-8601 | v9 |

索引：`index(status, updatedAt)`, `index(originAttentionSignalId)`, `index(lastHeartbeatSequence)`。

### ActivityStep

新增 v9 `activity_step` append-only 表。

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `stepId` | text | PK | v9 [REQ-003] |
| `threadId` | text | not null；FK-like reference to activity_thread | v9 [REQ-003] |
| `cycleId` | text | not null | v9 [REQ-003] |
| `stepKind` | text | ActivityStepKind | v9 [REQ-003] |
| `summary` | text | redacted, ≤200 chars | v9 [REQ-003] |
| `sourceRefsJson` | text | not null | v9 [REQ-003] |
| `closureRefJson` | text | nullable；side-effecting step closure link | v9 [REQ-003] |
| `createdAt` | text | ISO-8601 | v9 |

索引：`index(threadId, createdAt)`, `index(cycleId)`。

### ActionClosureRecord

复用 v8 `action_closure_record` schema；v9 新增 `routineId` nullable 列以关联 `ToolRoutine`。

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v8 schema |
| `createdAt` | text | not null | v8 schema |
| `cycleId` | text | not null | v8 schema |
| `platformId` | text | nullable | v8 schema |
| `capabilityId` | text | nullable | v8 schema |
| `proposalId` | text | nullable | v8 schema |
| `decisionId` | text | nullable | v8 schema |
| `status` | text | not null | v8 schema |
| `reason` | text | nullable | v8 schema |
| `nextState` | text | nullable | v8 schema |
| `sourceRefsJson` | text | not null | v8 schema |
| `proofRefsJson` | text | nullable | v8 schema |
| `traceRefsJson` | text | nullable | v8 schema |
| `redactionClass` | text | default `none` | v8 schema |
| `payloadJson` | text | nullable | v8 schema |
| `routineId` | text | nullable；v9 新增 | v9 [REQ-004] |
| `activityThreadId` | text | nullable；v9 新增 | v9 [REQ-003] |
| `activityStepId` | text | nullable；v9 新增 | v9 [REQ-003] |

### QuietDailyReview

复用 v8 `quiet_daily_review` schema。

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v8 schema |
| `createdAt` | text | not null | v8 schema |
| `day` | text | not null | v8 schema |
| `closureCount` | integer | default 0 | v8 schema |
| `memoryCandidateCount` | integer | default 0 | v8 schema |
| `sourceRefsJson` | text | not null | v8 schema |
| `closureRefsJson` | text | nullable | v8 schema |
| `redactionClass` | text | default `none` | v8 schema |
| `payloadJson` | text | nullable | v8 schema |
| `status` | text | default `pending` | v8 Wave 114 |

### DreamConsolidationRun

复用 v8 `dream_consolidation_run`；v9 在 `payloadJson` 中增加 `outputFamilies` 字段，记录生成的 memory/procedural/self-continuity/connector-evolution candidate ids。

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v8 schema |
| `createdAt` | text | not null | v8 schema |
| `quietReviewId` | text | not null | v8 schema |
| `status` | text | not null | v8 schema |
| `reason` | text | nullable | v8 schema |
| `sourceRefsJson` | text | not null | v8 schema |
| `redactionClass` | text | default `none` | v8 schema |
| `payloadJson` | text | nullable | v8 schema |

### MemoryProjection

复用 v8 `long_term_memory_projection`；`status` 枚举：`candidate` / `active` / `superseded` / `rejected` / `retired`。

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v8 schema |
| `createdAt` | text | not null | v8 schema |
| `candidateId` | text | not null | v8 schema |
| `topicKey` | text | not null | v8 schema |
| `status` | text | not null | v8 schema |
| `sourceRefsJson` | text | not null | v8 schema |
| `redactionClass` | text | default `none` | v8 schema |
| `payloadJson` | text | 含 `memoryText`, `acceptedAt`, `supersedesProjectionId` | v8 schema |

索引：`index(topicKey, status)`。

### ProceduralProjection

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v9 [REQ-004] |
| `createdAt` | text | not null | v9 |
| `candidateId` | text | not null | v9 |
| `capabilityPattern` | text | not null；如 `moltbook:feed.read` | v9 [REQ-004] |
| `status` | text | `candidate` / `validated` / `rejected` / `installed` | v9 [REQ-004] |
| `sourceRefsJson` | text | not null | v9 |
| `redactionClass` | text | default `none` | v9 |
| `payloadJson` | text | 含 `routineDefinition`, `toolExperienceRefs`, `actionClosureRefs`, `guardSummary`, `validationStatus`, `validationReason` | v9 [REQ-004] |

### ToolRoutine

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v9 [REQ-004] |
| `createdAt` | text | not null | v9 |
| `name` | text | not null | v9 |
| `version` | text | not null；semver | v9 [REQ-004] |
| `capabilityPattern` | text | not null | v9 |
| `status` | text | `candidate` / `validated` / `active` / `retired`；ops read model 映射：`active` → `installed`，`candidate`/`validated` → `disabled`，`retired` → `rollback` | v9 [REQ-004] |
| `sourceRefsJson` | text | not null | v9 |
| `rollbackRef` | text | 指向上一 stable routine 或 null | v9 [REQ-007] |
| `guardRefsJson` | text | JSON array of guard ids | v9 [REQ-004] |
| `ledgerRef` | text | 指向 `AutonomousChangeLedger` | v9 [REQ-007] |
| `redactionClass` | text | default `none` | v9 |
| `payloadJson` | text | 含步骤、policy gate 结果、trace | v9 [REQ-004] |

### SelfContinuityCard

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v9 [REQ-001] |
| `createdAt` | text | not null | v9 |
| `version` | integer | not null；单调递增 | v9 |
| `cardText` | text | not null；UTF-8 长度 ≤1200；human-readable fallback | v9 [REQ-001] |
| `sectionsJson` | text | not null；typed decomposition of structured fields | v9 [REQ-001] |
| `sourceRefsJson` | text | not null | v9 |
| `characterFramePointerJson` | text | not null；序列化后的 `CharacterFramePointer` | v9 [REQ-008] |
| `status` | text | `active` / `deferred` / `unavailable` | v9 [REQ-001] |
| `redactionClass` | text | default `none` | v9 |
| `payloadJson` | text | 结构化 section map；与 `sectionsJson` 一致 | v9 |

Runtime/read model shape 见 [`shared-v9-contracts.md`](./shared-v9-contracts.md) §4。

### CharacterFrame

`memory-continuity-system` 持久化由 `character-continuity-system` 生成的完整 `CharacterFrame` artifact；`control-context-system` 只接收 `CharacterFramePointer` 与 `EmbodiedContextCharacterProjection`。

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v9 [REQ-008] |
| `createdAt` | text | not null | v9 |
| `version` | integer | not null | v9 |
| `sectionsJson` | text | not null；含 habits / value / relationship / expression / tensions | v9 [REQ-008] |
| `contestPrompt` | text | not null；≤300 UTF-8 chars | v9 [REQ-008] |
| `sourceRefsJson` | text | not null | v9 |
| `status` | text | `candidate` / `accepted` / `rejected` / `retired` / `superseded` | v9 [REQ-008] |
| `supersededBy` | text | nullable | v9 [REQ-007] |
| `revisionOf` | text | nullable | v9 [REQ-008] |
| `acceptedAt` | text | nullable | v9 |
| `redactionClass` | text | default `none` | v9 |
| `payloadJson` | text | 完整结构化 frame | v9 |

### ConnectorEvolutionPlan

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v9 [REQ-005] |
| `createdAt` | text | not null | v9 |
| `platformId` | text | not null；canonical connector/platform id | v9 [REQ-005] |
| `planType` | text | `manifest_delta` / `recipe_delta` / `adapter_delta` | v9 [REQ-005] |
| `status` | text | `proposed` / `gating` / `activated` / `rolled_back` / `blocked` | v9 [REQ-005] |
| `gateResultsJson` | text | `GateResult[]` 序列化 | v9 [REQ-005] |
| `previousStableRef` | text | nullable | v9 [REQ-007] |
| `rollbackCommandHint` | text | nullable；由 `body-connector-system` 在激活时生成 | v9 [REQ-007] |
| `sourceRefsJson` | text | not null | v9 |
| `ledgerRef` | text | 指向 `AutonomousChangeLedger` | v9 [REQ-007] |
| `redactionClass` | text | default `none` | v9 |
| `payloadJson` | text | redacted plan summary | v9 [REQ-005] |

### ConnectorVersion

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v9 [REQ-005] |
| `createdAt` | text | not null | v9 |
| `platformId` | text | not null；canonical connector/platform id | v9 [REQ-005] |
| `versionId` | text | not null；canonical string version id (e.g. "moltbook-12") | v9 [REQ-005] |
| `sequence` | integer | nullable；单调递增辅助排序，非 canonical runtime id | v9 [REQ-005] |
| `assetPathsJson` | text | 含 `manifestPath` / `recipePath` / `adapterPath` 的 JSON | v9 [REQ-005] |
| `declaredCapabilitiesJson` | text | capability id 数组 | v9 [REQ-005] |
| `status` | text | `candidate` / `staged` / `active` / `rolled_back` | v9 [REQ-005] |
| `previousStableRef` | text | nullable | v9 [REQ-007] |
| `rollbackRef` | text | nullable | v9 [REQ-007] |
| `rollbackCommandHint` | text | nullable | v9 [REQ-007] |
| `sourceRefsJson` | text | not null | v9 |
| `payloadJson` | text | metadata | v9 [REQ-005] |
| `activatedAt` | text | nullable | v9 |
| `rolledBackAt` | text | nullable | v9 |

**Storage-row → canonical contract mapping**:

| Storage field | Canonical field | Transform |
| ---- | ---- | ---- |
| `platformId` | `platformId` | 1:1 |
| `versionId` | `versionId` | 1:1 |
| `assetPathsJson` | `manifestPath` / `recipePath` / `adapterPath` | parse JSON |
| `declaredCapabilitiesJson` | `declaredCapabilities` | parse JSON |
| `previousStableRef` | `previousStableRef` | 1:1 |
| `rollbackRef` | `rollbackRef` | 1:1 |
| `rollbackCommandHint` | `rollbackCommandHint` | 1:1 |
| `activatedAt` | `activatedAt` | 1:1 |
| `rolledBackAt` | `rolledBackAt` | 1:1 |

`memory-continuity-system` 不直接拥有 `AutonomousChangeLedger`；owner 为 `observability-recovery-system`。本系统在 `installToolRoutine` 时作为消费者调用 `writeLedgerEntry`。
Ledger 类型的 canonical source 是 `shared-v9-contracts.md` §8 `AutonomousChangeLedgerEntry`；下表仅列出本文件读/写时使用的字段，禁止在实现中重新定义。

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v9 [REQ-007] |
| `createdAt` | text | not null | v9 |
| `workspaceRoot` | text | not null | v9 [REQ-007] |
| `changeKind` | text | `routine_install` / `routine_supersede` / `routine_retire` / `connector_manifest_delta` / `connector_recipe_delta` / `connector_adapter_delta` | v9 [REQ-007] |
| `targetId` | text | 指向 routine id 或 connector id | v9 [REQ-007] |
| `previousStableRef` | text | nullable | v9 [REQ-007] |
| `status` | text | `proposed` / `gated` / `activated` / `rolled_back` / `blocked` | v9 [REQ-007] |
| `gateResultsJson` | text | nullable | v9 [REQ-007] |
| `rollbackRef` | text | nullable | v9 [REQ-007] |
| `rollbackCommandHint` | text | nullable | v9 [REQ-007] |
| `sourceRefsJson` | text | not null | v9 [REQ-007] |
| `redactedPayloadJson` | text | redacted summary；不含 credential value | v9 [REQ-007] |
| `activatedAt` | text | nullable | v9 |
| `rolledBackAt` | text | nullable | v9 |

### RoutineExecutionTrace

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v9 [REQ-004] |
| `createdAt` | text | not null | v9 |
| `routineId` | text | not null | v9 |
| `cycleId` | text | not null | v9 |
| `status` | text | `completed` / `failed` / `denied` | v9 [REQ-004] |
| `sourceRefsJson` | text | not null | v9 |
| `proofRefsJson` | text | nullable | v9 |
| `traceRefsJson` | text | nullable | v9 |
| `payloadJson` | text | redacted trace | v9 [REQ-004] |

### DailyRhythmState

复用 v8 `daily_rhythm_state` schema。

| 字段 | 类型 | 约束 | 来源 |
| ---- | ---- | ---- | ---- |
| `id` | text | PK | v8 schema |
| `day` | text | not null | v8 schema |
| `quietStatus` | text | default `not_due` | v8 schema |
| `dreamStatus` | text | default `not_due` | v8 schema |
| `quietReason` | text | nullable | v8 schema |
| `dreamReason` | text | nullable | v8 schema |
| `quietCompletedAt` | text | nullable | v8 schema |
| `dreamCompletedAt` | text | nullable | v8 schema |
| `sourceRefsJson` | text | not null | v8 schema |
| `payloadJson` | text | nullable | v8 schema |
| `updatedAt` | text | not null | v8 schema |

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

> **L0 对应入口**: L0 §5.1 操作契约表

### §3.1 `normalizeEvidenceIdentity(item)`

**对应契约**: L0 §5.1 — `normalizeEvidenceIdentity(item)`
**准入理由**: 含多步副作用链与去重规则。

```typescript
async function normalizeEvidenceIdentity(item: EvidenceItem): Promise<StableIdentityResult> {
  const key = buildStableIdentityKey(item.platformId, item.externalId, item.contentHash);
  const existing = await evidenceStore.findByStableIdentityKey(key);

  if (existing) {
    const updated = await evidenceStore.updateSeenCount(existing.id, {
      lastObservedAt: item.observedAt,
      seenCount: existing.seenCount + 1,
      rowIdentityStatus: "stable",
    });
    return { identity: "duplicate", row: updated };
  }

  // externalId missing/empty OR contentHash is empty/placeholder => unstable for routine promotion,
  // but still deduplicated under platformId+contentHash when contentHash is present.
  const missingExternalId = !item.externalId || item.externalId.trim() === "";
  const missingContentHash = !item.contentHash || item.contentHash === EMPTY_CONTENT_HASH;
  const rowIdentityStatus = missingContentHash || missingExternalId ? "unstable" : "stable";
  const row = await evidenceStore.insert({
    ...item,
    stableIdentityKey: key,
    firstObservedAt: item.observedAt,
    lastObservedAt: item.observedAt,
    seenCount: 1,
    rowIdentityStatus,
  });
  return { identity: rowIdentityStatus, row };
}

function buildStableIdentityKey(
  platformId: string,
  externalId: string | undefined,
  contentHash: string,
): string {
  const parts = externalId && externalId.trim() !== ""
    ? [platformId, externalId, contentHash]
    : [platformId, contentHash];
  return parts.join(EVIDENCE_STABLE_IDENTITY_SEPARATOR);
}
```

**单一写入入口原则**:
- `EvidenceItem` 的 durable write canonical owner 是本系统的 `normalizeEvidenceIdentity`。
- `body-connector-system.normalizeEvidence` 必须调用本端口，禁止绕过它直接写入 `evidence_item` 表。
- `attention-system` 通过 `memoryContinuitySystem.normalizeEvidenceIdentity` 解析 stable identity，不直接写入。
- 任何新增证据路径都必须在 `normalizeEvidenceIdentity` 中收敛，否则视为契约破坏。

### §3.1a `readLegacyJudgmentVerdictAsAttentionSignal(judgmentId)`

**对应契约**: DR-08 v8 `JudgmentVerdict` → v9 `AttentionSignal` schema compatibility
**准入理由**: 明确映射层位置与降级语义。

```typescript
async function readLegacyJudgmentVerdictAsAttentionSignal(
  judgmentId: string,
): Promise<AttentionSignal | DegradedOperationResult> {
  const row = await legacyStore.readJudgmentVerdict(judgmentId);
  if (!row) {
    return degraded("legacy_judgment_not_found", "attention");
  }
  return {
    id: generateId(),
    createdAt: row.createdAt,
    cycleId: row.cycleId,
    evidenceRefsJson: row.evidenceRefsJson,
    novelty: 0,
    relevance: 0,
    repetition: "identity_unstable",
    riskFlagsJson: row.riskFlagsJson ?? "[]",
    possibleActionsJson: "[]", // legacy judgment does not expose actionable suggestions
    sourceRefsJson: JSON.stringify([
      { family: "attention", id: row.id, label: "v8_legacy_judgment" },
    ]),
    status: "degraded",
    redactionClass: row.redactionClass ?? "none",
    payloadJson: JSON.stringify({
      reason: "v8_legacy_judgment_mapped",
      originalVerdictId: row.id,
      summary: row.summary,
    }),
  };
}
```

*来源锚点*: [DR-08](../07_CHALLENGE_REPORT.md#dr-08--v8-judgmentverdict--v9-attentionsignal-schema-兼容策略未闭合high)

### §3.1b `appendActivityThreadProgress(thread, step)`

**对应契约**: L0 §5.1 — `appendActivityThreadProgress()`; shared contracts `ActivityThread` / `ActivityStep`
**准入理由**: 持续活动的 durable state 必须有唯一写入语义，避免 thread continuation 漂移。

```typescript
async function appendActivityThreadProgress(
  thread: ActivityThread,
  step?: ActivityStep,
): Promise<ActivityThreadProgressResult | DegradedOperationResult> {
  if (thread.sourceRefs.length === 0 || (step && step.sourceRefs.length === 0)) {
    return degraded("source_refs_unresolved", "activity_thread");
  }

  const existing = await activityThreadStore.readById(thread.id);
  const nextThread = existing
    ? mergeThreadProgress(existing, thread)
    : initializeThread(thread);

  if (nextThread.completedStepCount > ACTIVITY_THREAD_MAX_STEPS) {
    nextThread.status = "blocked";
    nextThread.blockedReason = "activity_thread_overlong";
  }

  await activityThreadStore.upsert(nextThread);

  let appendedStep: ActivityStep | undefined;
  if (step) {
    const priorStep = await activityStepStore.readById(step.id);
    if (priorStep) {
      appendedStep = priorStep; // idempotent retry; do not double count
    } else {
      appendedStep = await activityStepStore.insert({
        ...step,
        closureRefJson: step.closureRef ? JSON.stringify(step.closureRef) : null,
      });
      await activityThreadStore.updateProgress(thread.id, {
        completedStepCount: nextThread.completedStepCount + 1,
        lastStepKind: step.kind,
        lastHeartbeatSequence: step.heartbeatSequence,
        status: step.kind === "complete" ? "completed" : nextThread.status,
      });
    }
  }

  return {
    threadId: nextThread.id,
    stepId: appendedStep?.id,
    status: nextThread.status,
    boundedReadRow: projectActivityThreadReadRow(nextThread, appendedStep),
  };
}
```

**写入约束**:
- `activity_thread.id` 是 upsert key；`activity_step.id` 是 append idempotency key。
- `completedStepCount` 只在新 step insert 成功时递增；重复 step 返回既有 row。
- `ActivityStep.kind = "propose_action" | "policy_closure"` 时必须携带 `activityThreadId` / `activityStepId` linkage；closure 未产生时由 observability 标记 `activity_thread_missing_closure`。
- stale / overlong 更新只改变 thread lifecycle，不自动生成新 action，不触发内部循环。

### §3.2 `buildQuietDailyReview(day)`

**对应契约**: L0 §5.1 — `buildQuietDailyReview()`
**准入理由**: Quiet 是 Dream 的前置输入；必须在 L1 定义空内容/placeholder 拒绝逻辑。

```typescript
async function buildQuietDailyReview(day: string): Promise<QuietDailyReviewOutput> {
  const closures = await actionClosureStore.listByDay(day);
  if (closures.length === 0) {
    return blocked("quiet_empty_input", "quiet_daily_review");
  }
  const contentStatus = classifyContent(closures);
  if (contentStatus === "placeholder_rejected") {
    return blocked("quiet_placeholder_rejected", "quiet_daily_review");
  }
  const sourceRefs = closures.flatMap((c) => c.sourceRefs);
  const candidates = extractCandidates(closures);
  const review = await quietReviewStore.insert({
    day,
    closureCount: closures.length,
    closureRefsJson: JSON.stringify(closures.map((c) => c.id)),
    sourceRefsJson: JSON.stringify(sourceRefs),
    payloadJson: JSON.stringify({ candidates }),
    contentStatus,
    status: "pending",
  });
  return { reviewId: review.id, status: "pending", candidateCount: candidates.length };
}
```

### §3.3 `acceptMemoryProjection(...)`

**对应契约**: L0 §5.1 — `acceptMemoryProjection()`
**准入理由**: 涉及 supersede 副作用链。

```typescript
async function acceptMemoryProjection(
  candidateId: string,
  topicKey: string,
  memoryText: string,
  sourceRefs: SourceRef[],
): Promise<ProjectionLifecycleResult> {
  if (sourceRefs.length === 0) {
    return degraded("source_refs_unresolved", "projection");
  }
  const active = await memoryStore.findActiveByTopic(topicKey);
  let supersedesId: string | undefined;
  if (active) {
    await memoryStore.updateStatus(active.id, "superseded", { supersededBy: candidateId });
    supersedesId = active.id;
  }
  const projectionId = generateProjectionId(candidateId);
  await memoryStore.insert({
    id: projectionId,
    candidateId,
    topicKey,
    status: "active",
    sourceRefs,
    payloadJson: JSON.stringify({ memoryText, acceptedAt: now(), supersedesProjectionId: supersedesId }),
  });
  return { projectionId, status: "accepted", reason: "projection_accepted", supersedesProjectionId: supersedesId };
}
```

### §3.4 `runDreamConsolidation(quietReviewId)`

**对应契约**: L0 §5.1 — `runDreamConsolidation()`
**准入理由**: Quiet review 是 v9 唯一能产生 memory/procedural/connector/character candidate 的入口；必须在 L1 定义输出族路由。

```typescript
async function runDreamConsolidation(
  quietReviewId: string,
): Promise<DreamConsolidationOutput> {
  const review = await quietReviewStore.readById(quietReviewId);
  if (!review || review.status === "placeholder_rejected") {
    return blocked("dream_blocked_no_content", "dream_consolidation");
  }
  const candidates: CandidateEnvelope[] = [];
  if (review.memoryCandidates.length > 0) {
    candidates.push(...review.memoryCandidates.map(toMemoryCandidate));
  }
  if (review.routineCandidates.length > 0) {
    candidates.push(...review.routineCandidates.map(toRoutineCandidate));
  }
  if (review.connectorCandidates.length > 0) {
    candidates.push(...review.connectorCandidates.map(toConnectorEvolutionCandidate));
  }
  if (review.characterSignals.length > 0) {
    // 仅传递 source-backed refs；不传递 card 装配输入
    await characterContinuity.refreshCharacterFrame({ sourceRefs: review.characterSignals });
  }
  await dreamRunStore.updateStatus(quietReviewId, "completed", { candidateCount: candidates.length });
  return { status: "completed", candidates };
}
```

### §3.5 `installToolRoutine(projection, gateResult, ledgerWritePort)`

**对应契约**: L0 §5.1 — `installToolRoutine()`
**准入理由**: routine 安装涉及权限边界与 ledger 写入，必须在 L1 显式化。

```typescript
interface PolicyGateResult {
  decision: "allow" | "deny" | "defer";
  reason?: string;
  sourceRefs: SourceRef[];
}

interface AutonomousChangeLedgerWritePort {
  writeLedgerEntry(entry: AutonomousChangeLedgerEntry): Promise<RecordResult>;
}

async function installToolRoutine(
  projection: ProceduralProjection,
  gateResult: PolicyGateResult,
  ledgerWritePort: AutonomousChangeLedgerWritePort,
): Promise<RoutineInstallResult> {
  if (gateResult.decision !== "allow") {
    return degraded("routine_install_policy_denied", "tool_routine");
  }

  // Parse canonical ToolRoutineGuardSchema DSL (shared-v9-contracts §6.3).
  const guard = parseToolRoutineGuardSchema(projection.payloadJson);
  if (!guard.ok) {
    return degraded("routine_guard_schema_invalid", "tool_routine", guard.error);
  }
  if (guard.data.expandsCapability) {
    return degraded("routine_permission_expansion_denied", "tool_routine");
  }

  const routineId = generateRoutineId(projection.id);
  const rollbackRef: SourceRef = { family: "routine", id: projection.id, label: "previous-routine" };
  const ledgerEntry: AutonomousChangeLedgerEntry = {
    id: generateLedgerId(),
    workspaceRoot: projection.workspaceRoot,
    changeKind: "routine_install",
    targetId: routineId,
    status: "activated",
    gateResultsJson: JSON.stringify([{ gate: "policy", passed: true, reason: gateResult.reason }]),
    rollbackRef: rollbackRef.id,
    rollbackCommandHint: `second_nature_ops routine.rollback --routineId=${routineId}`,
    sourceRefs: gateResult.sourceRefs,
    redactedPayloadJson: JSON.stringify({ capabilityPattern: projection.capabilityPattern }),
    createdAt: now(),
    activatedAt: now(),
  };
  const ledgerResult = await ledgerWritePort.writeLedgerEntry(ledgerEntry);
  await toolRoutineStore.insert({
    id: routineId,
    name: projection.capabilityPattern,
    version: "1.0.0",
    capabilityPattern: projection.capabilityPattern,
    status: "active",
    sourceRefsJson: JSON.stringify(gateResult.sourceRefs),
    rollbackRef: rollbackRef.id,
    guardRefsJson: JSON.stringify(guard.guardIds),
    ledgerRef: ledgerResult.entryId,
    payloadJson: projection.payloadJson,
  });
  return { routineId, status: "active", rollbackRef, ledgerRef: { family: "ledger", id: ledgerResult.entryId } };
}
```

### §3.6 `applyConnectorEvolutionPlan(plan, bodyConnector)`

**对应契约**: L0 §5.1 — `applyConnectorEvolutionPlan()`
**准入理由**: CR-04 / HI-09 要求明确 Dream 生成 plan → body-connector 执行 gates → memory 更新 plan 状态的单向序列。

```typescript
interface ConnectorEvolutionApplyPort {
  applyConnectorEvolution(plan: ConnectorEvolutionPlan): Promise<ConnectorEvolutionApplyResult>;
}

interface ConnectorEvolutionApplyResult {
  status: "activated" | "blocked" | "rolled_back";
  versionId?: string;
  gateResults: GateResult[];
  rollbackCommandHint?: string;
  ledgerRef?: SourceRef;
}

interface RollbackHealthGatePort {
  watchPlan(planId: string): Promise<void>;
}

async function applyConnectorEvolutionPlan(
  plan: ConnectorEvolutionPlan,
  bodyConnector: ConnectorEvolutionApplyPort,
  rollbackWatchdog: RollbackHealthGatePort,
): Promise<EvolutionApplyResult> {
  await evolutionPlanStore.updateStatus(plan.id, "gating");

  // Bounded execution: body-connector must complete within a single heartbeat budget.
  const result = await withTimeout(
    bodyConnector.applyConnectorEvolution(plan),
    CONNECTOR_EVOLUTION_TIMEOUT_MS,
  );

  if (result.status === "blocked") {
    await evolutionPlanStore.updateStatus(plan.id, "blocked", {
      gateResultsJson: JSON.stringify(result.gateResults),
    });
    return { planId: plan.id, status: "blocked" };
  }

  if (result.status === "rolled_back") {
    await evolutionPlanStore.updateStatus(plan.id, "rolled_back", {
      gateResultsJson: JSON.stringify(result.gateResults),
      rollbackCommandHint: result.rollbackCommandHint,
      ledgerRef: result.ledgerRef?.id,
    });
    return {
      planId: plan.id,
      status: "rolled_back",
      versionId: result.versionId,
      ledgerRef: result.ledgerRef,
    };
  }

  // activated
  await evolutionPlanStore.updateStatus(plan.id, "activated", {
    gateResultsJson: JSON.stringify(result.gateResults),
    rollbackCommandHint: result.rollbackCommandHint,
    ledgerRef: result.ledgerRef?.id,
  });

  // Register with rollback watchdog so a missing success/failure event can be inferred later.
  await rollbackWatchdog.watchPlan(plan.id);

  return {
    planId: plan.id,
    status: "activated",
    versionId: result.versionId,
    ledgerRef: result.ledgerRef,
  };
}
```

`withTimeout` 是共享工具函数：Promise.race 包装，超时抛出 `timeout`，由调用者降级处理。

### §3.7 `assembleSelfContinuityCard(scope)`

**对应契约**: L0 §5.1 — `assembleSelfContinuityCard()`
**准入理由**: 运行时 `SelfContinuityCard` 与存储行形状不同，需要在 L1 定义映射。

```typescript
async function assembleSelfContinuityCard(
  scope: ContinuityScope,
): Promise<SelfContinuityCard | DegradedOperationResult> {
  const activeMemories = await memoryProjectionStore.listActive(scope);
  const activeRoutines = await toolRoutineStore.listActive(scope);
  const characterPointer = await characterFrameStore.loadActivePointer(scope);
  if (activeMemories.length === 0 && activeRoutines.length === 0 && !characterPointer) {
    return degraded("continuity_unavailable", "self_continuity_card");
  }

  // Section ordering is canonical: shared-v9-contracts.md §4 SelfContinuityCard Rules.
  // The assembler MUST NOT reorder or omit sections unless forced by the 1200-char budget.
  const sections = buildCardSections(activeMemories, activeRoutines, characterPointer);
  const cardText = serializeCardSections(sections, scope.maxSummaryLength ?? SELF_CONTINUITY_CARD_MAX_CHARS);
  await selfContinuityCardStore.upsert({
    workspaceRoot: scope.workspaceRoot,
    cardText,
    sectionsJson: JSON.stringify(sections),
    characterFramePointerJson: JSON.stringify(characterPointer),
    sourceRefsJson: JSON.stringify(collectSourceRefs(activeMemories, activeRoutines, characterPointer)),
    status: "active",
  });
  return {
    summary: sections.summary,
    bodyIntuition: sections.bodyIntuition,
    relationshipPosture: sections.relationshipPosture,
    valuePosture: sections.valuePosture,
    behaviorHabits: sections.behaviorHabits,
    activeRoutinePointers: activeRoutines.map(toRoutinePointer),
    currentProhibitions: sections.currentProhibitions,
    characterFramePointer: characterPointer ?? makeDeferredPointer(),
    sourceRefs: collectSourceRefs(activeMemories, activeRoutines, characterPointer),
    acceptedAt: now(),
    status: "active",
  };
}
```

### §3.8 `loadBoundedReadModel(modelName, filters)`

**对应契约**: L0 §5.1 — `loadBoundedReadModel()`
**准入理由**: ops surface 读取 redacted read models 需要白名单与 redaction 校验。

```typescript
const READ_MODEL_ALLOWLIST = [
  "memory_projection",
  "procedural_projection",
  "tool_routine",
  "self_continuity_card",
  "connector_evolution_plan",
  "autonomous_change_ledger",
] as const;

async function loadBoundedReadModel(
  modelName: typeof READ_MODEL_ALLOWLIST[number],
  filters: BoundedReadFilters,
): Promise<BoundedReadModelResult> {
  if (!READ_MODEL_ALLOWLIST.includes(modelName)) {
    return degraded("read_model_not_allowed", modelName);
  }
  const rows = await readModelStore.query(modelName, filters);
  const redacted = rows.map((r) => redactPayload(r));
  return { rows: redacted, count: redacted.length };
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

> **L0 对应入口**: L0 §4.3 数据流

### §4.1 Dream 输出族路由

```text
runDreamConsolidation(review)
  ├─ review.contentStatus in [placeholder_rejected, content_missing, empty]
  │    → return blocked(dream_blocked_no_content)
  ├─ redaction gate blocks all candidates
  │    → return blocked(firstBlockedReason)
  ├─ generate candidates
       ├─ topic summary → MemoryProjection candidate
       ├─ repeated capability success → ProceduralProjection candidate
       ├─ scaffold gap + fixture → ConnectorEvolutionPlan candidate
       └─ identity/relationship signals → `character-continuity-system` 输入（source-backed refs；禁止把 `SelfContinuityCard` 装配输入直接传给 character 系统）
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

> **L0 对应入口**: L0 §5 / §9

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| `externalId` 缺失但 contentHash 稳定 | 误标 `identity_unstable` | 允许运行，但 `rowIdentityStatus="unstable"`；不作为 routine signal |
| `externalId` 相同但 content 改变 | 同一 logical identity 新内容 | 更新 `contentHash`、重置 `seenCount`、保留同一 identity key |
| 同名 topic 已有 active projection | 重复记忆 | 自动 supersede；旧状态改为 `superseded` |
| routine guard 要求新 capability | 权限扩大 | `installToolRoutine` 返回 `routine_permission_expansion_denied`；不写 registry |
| connector evolution asset path 越界 | 改 core runtime | 校验路径必须在 `.second-nature/connectors/{platformId}/` 下 |
| `cardText` 写入时刚好等于 1200 | 字符边界 | 写入前用 `new TextEncoder().encode(text).length` 校验，不依赖 `String.length` |
| v7 artifact 读取 | 污染 identity | v7 compatibility 只读；新写入走 v9 normalizer |

---

## §6 契约验证矩阵详细版 (Contract Verification Matrix Detail)

> **L0 对应入口**: L0 §11.4 测试策略

| 契约 | 风险级别 | 正常态验证 | 失败态验证 | 回归责任 |
|------|---------|-----------|-----------|---------|
| `normalizeEvidenceIdentity` 重复抑制 | 高 | 单元：same feed 3 次 → 1 row + seenCount=3 | 单元：无 externalId + unstable hash → `rowIdentityStatus=unstable` | evidence ingestion 回归 |
| `appendActivityThreadProgress` continuation 持久化 | 高 | 单元：create/update/append step → bounded read row；重复 step idempotent | 单元：sourceRefs 缺失、overlong、missing closure linkage → degraded/blocked reason | activity continuation 回归 |
| `acceptMemoryProjection` supersede | 高 | 单元：同名 topic 第二个 projection → 旧状态变 superseded | 单元：sourceRefs 为空 → `source_refs_unresolved` | projection lifecycle 回归 |
| `rejectMemoryProjection` / `retireMemoryProjection` | 中 | 单元：状态迁移为 rejected/retired | 单元：不存在 projectionId → `state_unreadable` | projection lifecycle 回归 |
| `installToolRoutine` 权限边界 | 高 | 单元：allowed gate → installed + ledger 写入（通过 `observability-recovery-system.writeLedgerEntry`） | 单元：guard 扩大 capability → `routine_permission_expansion_denied` | routine safety 回归 |
| `applyConnectorEvolutionPlan` rollback | 高 | 集成：Dream 生成 plan → body-connector 执行 gates → 激活 version → observability 写 ledger → memory 更新 plan 为 activated | 集成：canary fail → previous stable restored + ledger | connector evolution 回归 |
| `assembleSelfContinuityCard` boundedness | 中 | 单元：正常数据 → cardText ≤1200 | 单元：无 active data → `continuity_unavailable` | continuity injection 回归 |
| `loadBoundedReadModel` redaction | 中 | 单元：返回 rows 不带 raw credential | 单元：degraded read → `state_unreadable` envelope | read model 回归 |
| `AutonomousChangeLedger` payload redaction | 高 | 单元：写入 credential 形状 → redaction gate 拦截 | 单元：gate 失败 → 不写入 ledger | ledger safety 回归 |

---

<!-- L1 孤岛检查：
- §1 配置常量 → L0 §6/§10 已链接
- §2 完整数据模型 → L0 §6.1 已链接
- §3 算法 → L0 §5.1 已链接
- §4 决策树 → L0 §4.3 已链接
- §5 边缘情况 → L0 §5/§9 已链接
- §6 契约矩阵 → L0 §11.4 已链接
-->
