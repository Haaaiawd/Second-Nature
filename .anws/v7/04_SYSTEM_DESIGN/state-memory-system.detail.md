# State Memory System — 实现细节 (L1)

| 字段 | 值 |
| --- | --- |
| **对应 L0** | [state-memory-system.md](./state-memory-system.md) |
| **文件性质** | L1 实现层 |
| **创建日期** | 2026-05-21 |

> 本文件仅在 `/forge` 任务明确引用时加载。日常设计与任务规划优先读取 L0。

---

## 版本历史

| 版本 | 日期 | Changelog | 作者 |
| --- | --- | --- | --- |
| v1.0 | 2026-05-21 | 初始 L1 实现层；R2 + R5 触发生成 | GPT-5.5 / Nyx |

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §7 / §10 / §12 |
| §2 | [核心数据结构完整定义](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 / §5 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 / §11 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

| Key | Default | Owner | Notes |
| --- | --- | --- | --- |
| `state.workspaceDataDir` | `.second-nature` | state-memory | 相对 workspaceRoot |
| `state.dbFileName` | `second-nature.db` | state-memory | SQLite/sql.js index 文件名 |
| `state.sqlJsFlushRequired` | `true` | runtime adapter | sql.js 模式写后必须 flush |
| `state.recentInteractionSnapshotLimit` | `100` | state-memory | 近期交互 snapshot 上限 |
| `state.toolExperienceBoundedQueryLimit` | `1000` | state-memory | ToolExperience bounded query 上限 |
| `state.restoreSnapshotRetentionCount` | `3` | state-memory | 默认保留最近 N 版 snapshot |
| `state.restoreSnapshotMaxScopeItems` | `50` | state-memory | 单次 snapshot scope 最多 N 个 entity refs |
| `state.artifactAtomicWriteEnabled` | `true` | state-memory | temp 文件 + rename 保证 diary/dream artifact 原子写入 |
| `state.identityProfileMaxPlatforms` | `20` | state-memory | IdentityProfile 中 platformProfiles 上限 |
| `state.digestRetentionDays` | `30` | state-memory | HeartbeatDigest 最小保留天数 |

> 对应 L0 入口：§7.1 Core Technologies、§10 Performance Considerations、§12 部署与运维

---

## §2 核心数据结构完整定义 (Full Data Structures)

L0 §6.2 已声明所有实体的公共字段。本节补充 migration 顺序、文件路径规划与实现层专用类型，不重复 L0 字段声明。

### §2.1 Migration 顺序（FK 约束顺序，不可打乱）

必须按以下顺序初始化表，原因是后续表存在对前序表的外键依赖：

1. `identity_profiles`
2. `platform_profiles`
3. `agent_goals`
4. `agent_goal_lifecycle_events`
5. `recent_interaction_summaries`
6. `tool_experience_rows`
7. `daily_diary_index`
8. `dream_output_index`
9. `narrative_timeline_events`
10. `heartbeat_digest_rows`
11. `capability_probe_results`
12. `restore_snapshot_index`
13. `runtime_secret_anchors`
14. `v6_compat_views`（session_chronicle、narrative_states、relationship_memory、memory_stores 兼容视图）

### §2.2 文件路径规划

```text
src/storage/identity/identity-profile-store.ts
src/storage/goal/goal-lifecycle-store.ts
src/storage/interaction/interaction-snapshot-projector.ts
src/storage/tool-experience/tool-experience-store.ts
src/storage/diary-dream/diary-dream-store.ts
src/storage/history/history-digest-store.ts
src/storage/restore/restore-snapshot-store.ts
src/storage/shared/write-validation-gate.ts
src/storage/shared/repair-migration-service.ts
src/storage/shared/source-ref-normalizer.ts
```

### §2.3 实现层专用类型

以下类型是 L0 §6 字段声明的补充，包含方法签名体，仅在 `/forge` 实现层使用：

```typescript
/** WriteValidationGate 校验结果 */
interface WriteValidationResult {
  valid: boolean;
  rejectedReason?:
    | "sensitive_raw_payload_detected"
    | "source_refs_missing"
    | "schema_invalid"
    | "size_limit_exceeded";
  details?: string;
}

/** RestoreSnapshot 预检结果 */
interface RestorePreflightResult {
  pass: boolean;
  conflictReason?: string;
  excludedKinds: string[];
  snapshotExists: boolean;
  hashVerified: boolean;
}

/** RepairMigrationService 执行报告 */
interface RepairReport {
  rebuiltRows: number;
  degradedRows: number;
  unknownArtifacts: number;
  durationMs: number;
}

/** DreamOutput accepted 后的活跃指针（单 agent 唯一行） */
interface DreamOutputAcceptedPointer {
  outputId: string;
  acceptedAt: string;
  narrativeProposalRef?: string;
}
```

> 对应 L0 入口：§6 数据模型

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 `upsertAgentGoal(goal)`

**对应契约**：L0 §5.1
**准入理由**：goal 唯一性约束、scope 替换逻辑和 lifecycle event 顺序不可颠倒，需要显式定义执行序。

```text
FUNCTION upsertAgentGoal(goal):

  -- Step 1: schema validation
  validate goal fields: goalId, kind, scope, status, completionCriteria non-empty
  if schema invalid:
    return WriteValidationResult { valid: false, rejectedReason: "schema_invalid" }

  -- Step 2: source refs check
  if goal.sourceRefs is empty:
    return WriteValidationResult { valid: false, rejectedReason: "source_refs_missing" }

  -- Step 3: sensitivity scan
  if raw prompt content detected in description or completionCriteria:
    return WriteValidationResult { valid: false, rejectedReason: "sensitive_raw_payload_detected" }

  -- Step 4: active uniqueness check (only applies when new goal is "accepted")
  if goal.status == "accepted":
    existingGoals = queryActiveGoals(kind: goal.kind, scope: goal.scope)
    for each existing in existingGoals where existing.goalId != goal.goalId:
      emit GoalLifecycleEvent(
        goalId: existing.goalId,
        transition: "replaced",
        reason: "new_accepted_same_scope",
        replacedByGoalId: goal.goalId
      )
      write lifecycle event row for existing
      set existing.replacedByGoalId = goal.goalId
      update existing row status = "replaced"

  -- Step 5: upsert goal row
  upsert goal row by goalId (insert if new, update if exists)

  -- Step 6: write lifecycle event for this goal
  write GoalLifecycleEvent(goalId: goal.goalId, transition: goal.status, triggeredAt: now())

  -- Step 7: flush if sql.js mode
  if sqlJsFlushRequired: flush(); if flush fails: rollback and return error

  return GoalRevision { goalId, updatedAt, replacedGoalId? }
```

### §3.2 `appendToolExperience(experience)`

**对应契约**：L0 §5.1
**准入理由**：write gate 检查顺序（sensitivity → payload size → source refs → redaction）必须明确，且 ToolExperience 是 append-only，不允许 update。

```text
FUNCTION appendToolExperience(experience):

  -- Step 1: WriteValidationGate
  -- 1a. rawPayload field must be absent
  if experience.rawPayload is present:
    return WriteValidationResult { valid: false, rejectedReason: "sensitive_raw_payload_detected",
                                   details: "rawPayload field is forbidden" }

  -- 1b. sensitivity scan: token/cookie/credential pattern in any string field
  for each stringField in experience:
    if matches credentialPattern(stringField):
      return WriteValidationResult { valid: false, rejectedReason: "sensitive_raw_payload_detected" }

  -- 1c. source refs check
  if experience.sourceRefs is empty:
    return WriteValidationResult { valid: false, rejectedReason: "source_refs_missing" }

  -- 1d. outcome enum validation
  if experience.outcome not in ["success","failure","partial","timeout","unknown"]:
    return WriteValidationResult { valid: false, rejectedReason: "schema_invalid" }

  -- Step 2: large payload handling
  for each summaryField in experience where byteSize(summaryField) > sizeLimit:
    artifactRef = writeArtifactFile(summaryField, bounded)
    replace summaryField value with { artifactRef }

  -- Step 3: append row (no update, no upsert)
  append row to tool_experience_rows with new experienceId = uuid()

  -- Step 4: flush if sql.js mode
  if sqlJsFlushRequired: flush(); if flush fails: delete appended row and return error

  return { experienceId, createdAt }
```

### §3.3 `transitionDreamOutputLifecycle(input)`

**对应契约**：L0 §5.1
**准入理由**：candidate → accepted 的状态机必须单向，且 accepted pointer 更新必须原子，避免两个 accepted 并存。

```text
FUNCTION transitionDreamOutputLifecycle(input):

  -- Step 1: load and validate
  output = loadDreamOutput(input.outputId)
  if output not found: return error "output_not_found"

  -- Step 2: validate transition legality
  allowed_transitions = {
    "candidate"  -> ["accepted", "archived"],
    "partial"    -> ["candidate", "archived"],
    "accepted"   -> ["superseded"],
    "archived"   -> [],       -- terminal
    "superseded" -> []        -- terminal
  }
  if input.targetStatus not in allowed_transitions[output.status]:
    return error "invalid_lifecycle_transition"

  -- Step 3: accepted path (must be atomic)
  if input.targetStatus == "accepted":
    if output.validation is null or output.validation.passed == false:
      return error "validation_not_passed"

    BEGIN TRANSACTION:
      -- 3a. update this output to accepted
      UPDATE dream_output_index SET status = "accepted", acceptedAt = now()
        WHERE outputId = input.outputId

      -- 3b. find previous accepted row (if any)
      previousAccepted = queryDreamOutput(status: "accepted", excludeId: input.outputId)
      if previousAccepted exists:
        UPDATE dream_output_index SET status = "superseded"
          WHERE outputId = previousAccepted.outputId

      -- 3c. upsert single accepted pointer row
      UPSERT dream_output_accepted_pointer SET
        outputId = input.outputId,
        acceptedAt = now(),
        narrativeProposalRef = output.narrativeProposalRef
    COMMIT TRANSACTION

    if transaction fails: rollback, return error "accepted_pointer_update_failed"
    return { outputId, status: "accepted", acceptedPointer }

  -- Step 4: non-accepted path (simple update)
  else:
    UPDATE dream_output_index SET status = input.targetStatus
      WHERE outputId = input.outputId
    if sqlJsFlushRequired: flush()
    return { outputId, status: input.targetStatus }
```

### §3.4 `captureRestoreSnapshot(scope)`

**对应契约**：L0 §5.1
**准入理由**：snapshot 必须在 mutable write 之前捕获，sensitive kinds 必须显式排除，排除清单必须写入 snapshot index。

```text
FUNCTION captureRestoreSnapshot(scope):

  -- Step 1: validate scope kinds
  allowedKinds = ["goal", "narrative", "interaction", "experience", "diary_ref"]
  forbiddenKinds = ["credential", "raw", "prompt"]
  if any scope.kind in forbiddenKinds:
    return error "scope_contains_forbidden_kind"

  -- Step 2: enumerate state refs by scope kind
  stateRefs = []
  excludedSensitiveKinds = []
  for each kind in scope.kinds:
    refs = queryCurrentRowRefs(kind)   -- collect refs/ids, NOT raw content
    for each ref in refs:
      if ref.sensitivityFlag in ["credential","raw","pii_unredacted"]:
        excludedSensitiveKinds.add(ref.kind)
      else:
        stateRefs.add(ref)

  -- Step 3: validate scope size
  if stateRefs.length > restoreSnapshotMaxScopeItems:
    return error "scope_too_large"

  -- Step 4: compute content hash
  sortedRefs = sort(stateRefs, by: "refId asc")
  contentHash = sha256(JSON.stringify(sortedRefs))

  -- Step 5: write snapshot artifact (JSON manifest, not raw DB dump)
  snapshotId = uuid()
  artifactPath = "{workspaceDataDir}/snapshots/{snapshotId}.json"
  writeAtomicArtifact(artifactPath, {
    snapshotId, scope, stateRefs, excludedSensitiveKinds, contentHash,
    capturedBeforeMutationId: scope.mutationId, capturedAt: now()
  })

  -- Step 6: write index row
  write restore_snapshot_index row {
    snapshotId, scope, version: 1,
    capturedBeforeMutationId: scope.mutationId,
    stateRefs, excludedSensitiveKinds, contentHash,
    retentionExpiresAt: now() + retentionDays,
    createdAt: now()
  }

  -- Step 7: enforce retention limit
  allSnapshots = queryRestoreSnapshots(sortBy: "createdAt asc")
  if allSnapshots.count > restoreSnapshotRetentionCount:
    oldest = allSnapshots[0]
    DELETE from restore_snapshot_index WHERE snapshotId = oldest.snapshotId
    -- Note: artifact file is NOT deleted; only index row removed

  -- Step 8: flush if sql.js mode
  if sqlJsFlushRequired: flush()

  return { snapshotId, contentHash, excludedSensitiveKinds }
```

> 对应 L0 入口：§5.1 操作契约表、§5.3 Failure Semantics、§9.1 Data Exclusion Rules

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 WriteValidationGate 详细逻辑

对应 L0 §4.1 架构图中的 `WriteValidationGate` 节点，展开五步检查链：

```text
Step 1 — Schema Check
  required fields present? enum values valid?
  -> FAIL: reject with "schema_invalid"
  -> PASS: continue

Step 2 — Sensitivity Scan
  any string field matches token/cookie/credential/key pattern?
  -> FAIL: reject with "sensitive_raw_payload_detected"
  -> PASS: continue

Step 3 — Source Refs Check
  sourceRefs non-empty for factual/traceable entities?
  (ToolExperience, AgentGoal, DailyDiary, NarrativeTimeline require non-empty sourceRefs)
  -> FAIL: reject with "source_refs_missing"
  -> PASS: continue

Step 4 — Size Limit
  any field byte size > configurable per-field limit?
  -> ACTION: write large field to bounded artifact file, replace field value with { artifactRef }
  -> does NOT reject; artifact ref is the fallback
  -> continue

Step 5 — Redaction Policy Call
  field tagged for redaction by observability policy?
  -> ACTION: apply redaction tag; write redacted value to DB row
  -> does NOT reject; redaction is applied inline
  -> continue

All 5 steps pass -> write allowed
```

### §4.2 RestoreSnapshot Preflight 详细逻辑

对应 L0 §5.1 `restoreFromSnapshot` 前置条件展开：

```text
Check 1 — Snapshot Exists
  snapshotId present in restore_snapshot_index?
  -> FAIL: { pass: false, conflictReason: "snapshot_not_found" }

Check 2 — Integrity Hash
  recompute hash over stored stateRefs == stored contentHash?
  -> FAIL: { pass: false, conflictReason: "hash_mismatch" }

Check 3 — Mutation Lock Conflict
  active mutation lock exists for overlapping scope?
  -> FAIL: { pass: false, conflictReason: "scope_locked_by_active_mutation" }

Check 4 — Excluded Kinds
  requested restore scope does NOT include any kind in excludedSensitiveKinds?
  (cannot restore what was excluded at capture time)
  -> FAIL: { pass: false, conflictReason: "excluded_kind_cannot_be_restored",
             excludedKinds: [...] }

All checks pass:
  -> { pass: true, excludedKinds: snapshot.excludedSensitiveKinds,
      snapshotExists: true, hashVerified: true }
```

### §4.3 v6 兼容层策略

对应 L0 §6.1 Persistence Boundary 最后一行 `v6StateCompatibility`：

```text
策略：v6 表原样保留，v7 新实体作为独立表新增，不共用表。

读取路径：
  v7 read models -> 优先读 v7 tables
  control-plane 兼容查询 -> v6_compat_views 仍可见
  v6_compat_views = {
    session_chronicle_entries     (原 v6 表)
    narrative_states              (原 v6 表)
    relationship_memory_revisions (原 v6 表)
    agent_goals_v6                (原 v6 表，与 v7 agent_goals 隔离)
    memory_stores                 (原 v6 表)
  }

Migration 失败处理：
  -> 不 crash；标记 degraded row
  -> 启动时 self health 可见：{ status: "degraded", reason: "migration_failed", affectedTable }
  -> repair 在下次启动时重试

写入路径：
  新状态写入 -> 只写 v7 tables
  v6 表只读，不再接受新写入（除非 v6 regression gate 特殊场景）
```

> 对应 L0 入口：§4.2 Core Components、§5.3 Failure Semantics、§11.2 Contract Verification Matrix

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| # | 场景 | 风险 | 处理方式 |
| :---: | --- | --- | --- |
| 1 | **sql.js flush 竞态** | 两个写操作并发时内存状态 vs 磁盘不一致 | 写操作必须串行化（队列或 mutex）；flush 必须在 ack 之前完成 |
| 2 | **diary artifact 原子写入失败** | 旧 artifact 被覆盖到一半导致损坏 | 使用 temp file + atomic rename；rename 失败时保留 temp 文件供 repair 扫描，不删除旧 artifact |
| 3 | **DreamOutput candidate 不进 heartbeat** | heartbeat 消费未验证 projection | `loadAcceptedDreamProjection` 只读 `status=="accepted"` 的 pointer；candidate/partial/archived rows 不出现在 EmbodiedContext 切片 |
| 4 | **goal kind+scope 快速连续写入** | 第二次 replaced event 追上第一次 upsert，lifecycle log 顺序乱 | 以最终 DB row 状态为准；lifecycle event log 保留完整历史；不强制单次序，consumer 应容忍乱序 event |
| 5 | **snapshot scope 包含已脱敏实体** | snapshot 还原时期望拿到被替换掉的原始内容 | snapshot 只保存 artifact ref，不含原始内容；restore 时 ref 仍然有效，原始内容永远不进 snapshot |
| 6 | **repair service 扫描到 unknown artifact** | 误删用户文件 | repair 只重建 index row，对文件系统不做任何删除；未知文件计入 `unknownArtifacts` 字段，由 operator 决定处理 |
| 7 | **RuntimeSecretAnchor 包含诊断以外的 key 信息** | key 材料泄漏进 DB | `keyHealth` 枚举值（`ok`/`missing_key`/`wrong_key`/`unknown`）是仅有的诊断信号；`locationRef` 是字符串路径引用，不是 key 材料；任何写入企图包含 key 明文的字段均被 WriteValidationGate Step 2 拒绝 |

> 对应 L0 入口：§9 安全性考虑、§11.1 Test Layers

---

## §6 测试辅助 (Test Helpers)

推荐在 `src/storage/__test-helpers__/` 下提供以下辅助：

| Helper | 用途 |
| --- | --- |
| `makeGoalPayload(status, kind, scope, sourceRefs)` | 生成合法 AgentGoal payload 用于 upsert 测试 |
| `makeToolExperiencePayload(outcome, platformId, capabilityId)` | 生成无 `rawPayload` 的 experience，含最小合法 sourceRefs |
| `makeDreamOutputCandidate()` | 生成 `status: "candidate"` 的 DreamOutput（含 validationSummary.passed = false） |
| `makeDreamOutputAccepted()` | 生成 `status: "accepted"` 的 DreamOutput（含 validationSummary.passed = true） |
| `stubWriteValidationGate(result)` | 控制 WriteValidationGate 返回指定 WriteValidationResult，用于测试各拒绝路径 |
| `assertSnapshotExcludesKinds(snapshot, kinds[])` | 断言 snapshot.excludedSensitiveKinds 包含所有指定 kinds |
| `makeRestoreRequest(snapshotId, scope)` | 生成最小合法 restore request，scope 只含非敏感 kinds |
| `stubSqlJsFlushFail()` | 模拟 sql.js flush 失败，验证写操作回滚（不返回 durable success） |

> 对应 L0 入口：§11 测试策略
