# State & Memory System — 实现细节 (L1)

> **文件性质**: L1 实现层  
> **对应 L0**: [state-system.md](./state-system.md)  
> 本文件仅在 `/forge` 任务明确引用时加载。日常设计与任务规划优先读取 L0。

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v1.0 | 2026-05-15 | 初始实现层补充；R5 行数触发 |

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §7 / §10 / §12 |
| §2 | [完整数据结构补充](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 / §5 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 / §11 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

| Key | Default | Owner | Notes |
| --- | --- | --- | --- |
| `state.chronicleRetentionDays` | `180` | state-system | P0 可长期保留摘要，正文不存敏感原文 |
| `state.memoryStoreRoot` | `.second-nature/dream` | state-system | Dream output artifacts |
| `state.memoryPartialRetentionDays` | `14` | state-system | partial output 清理窗口 |
| `state.dreamRunLockTtlMs` | `1800000` | state-system | 与 Dream operator timeout 对齐 |
| `state.maxDreamInputEvidence` | `1000` | dream-system/state-system | 读取上限，采样由 Dream 负责 |
| `state.sqlJsFlushRequired` | `true` | runtime adapter | sql.js 模式写入 ack 前必须 flush |
| `state.acceptedMemoryPointerKey` | `active_memory_store_id` | state-system | 当前 active accepted store 指针 |

---

## §2 核心数据结构完整定义 (Full Data Structures)

L0 §6 声明公共字段。实现建议拆分：

```text
src/storage/chronicle/types.ts
src/storage/narrative/types.ts
src/storage/relationship/types.ts
src/storage/goal/types.ts
src/storage/memory-store/types.ts
```

Migration 顺序：

1. `session_chronicle_entries`
2. `narrative_states`
3. `relationship_memory_revisions`
4. `agent_goals`
5. `memory_stores`
6. `memory_store_lifecycle_events`
7. `dream_run_locks`
8. accepted memory pointer config row

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 `appendSessionChronicle(entry)`

**对应契约**: L0 §5.1  
**准入理由**: 需要在 source refs、reply signal 与 index 副作用间保持顺序。

```text
validate eventKind and actor
if sourceRefs empty and no explicit insufficient reason:
  reject write
redact summary fields
derive ownerReply signal only for owner_reply event
append chronicle row
update eventKind/time indexes
return StateWriteAck(entryId)
```

### §3.2 `updateNarrativeState(input)`

**对应契约**: L0 §5.1  
**准入理由**: unsupported claim 会影响 active self description。

```text
resolve source refs
if unsupportedClaims not empty:
  write revision with status insufficient_sources or reject by policy
else if source refs empty:
  write awaiting_sources revision
else:
  write active revision
update current narrative pointer
return latest NarrativeState
```

### §3.3 `upsertRelationshipMemory(input)`

**对应契约**: L0 §5.1  
**准入理由**: owner reply/no-reply 对冷却和语气选择有后续影响。

```text
load previous relationship revision
merge tone distribution from ownerReply signal
update average reply delay if present
increment noReplyCount if event result is no_reply
merge topic affinities with bounded decay
write new immutable revision
return latest RelationshipMemory
```

### §3.4 `upsertAgentGoal(goal)`

**对应契约**: L0 §5.1  
**准入理由**: proposal 与 accepted goal 的权限差异是安全边界。

```text
validate completionCriteria is non-empty and verifiable
if origin is agent_proposed:
  set status proposal
  require source refs
if origin is owner_set:
  set status accepted unless policy blocks
write goal record
return AgentGoal
```

### §3.5 `writeMemoryStore(output)`

**对应契约**: L0 §5.1  
**准入理由**: artifact 与 index 双写，且 input store 必须不可变。

```text
validate schema and lifecycle status candidate or partial
if inputMemoryStoreId present:
  read input hash and store as immutable provenance
write artifact to temp path
atomic rename temp path to final path
insert memory_store index row
insert lifecycle event created
return MemoryStoreAck
```

### §3.6 `transitionMemoryStoreLifecycle(input)`

**对应契约**: L0 §5.1  
**准入理由**: active pointer 变更影响 heartbeat 读取。

```text
load memory store row
validate transition is allowed
if target is accepted:
  require validation summary pass
  verify sensitivity pass
  mark previous accepted store superseded
  update active memory pointer
if target is archived:
  write archive reason
append lifecycle event
return MemoryStoreAck
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Goal Acceptance

```text
if origin == owner_set:
  accepted unless blocked by policy
else if origin == agent_proposed:
  accepted only when owner confirms
  or risk == low and completionCriteria exists and policy allowlist matches
else:
  proposal
```

### §4.2 MemoryStore Active Read

```text
if active pointer missing:
  return null with reason nothing_yet
if pointed store status != accepted:
  return null with reason active_pointer_invalid and repair_required
return redacted accepted projection
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| Chronice source refs 缺失 | 后续 narrative 编造 | 拒绝或 explicit insufficient |
| Owner reply 含敏感正文 | PII 泄漏 | 只存 tone/timing/topic summary |
| Agent goal 无完成标准 | 无限追求污染 planning | 拒绝 accepted transition |
| Candidate memory 被读到 | 长期记忆污染 | active projection 只读 accepted |
| sql.js 写入后未 flush | 重启丢状态 | flush ack 前不返回 durable success |
| Artifact 成功、index 失败 | read model 缺数据 | repair marker + startup rebuild |
| Dream lock 泄漏 | 永久跳过 Dream | TTL + stale lease cleanup |

---

## §6 测试辅助 (Test Helpers)

Recommended fixtures:

- `makeChronicleEntry({ eventKind, sourceRefs })`
- `makeOwnerReplySignal({ tone, delayMinutes, topics })`
- `makeNarrativeState({ status, unsupportedClaims })`
- `makeAgentGoal({ origin, risk, completionCriteria })`
- `makeMemoryStore({ lifecycleStatus, inputMemoryStoreId })`
- `makeDreamRunLock({ expiresAt })`
- `makeStateRuntimeWithSqlJsFlushMode()`

