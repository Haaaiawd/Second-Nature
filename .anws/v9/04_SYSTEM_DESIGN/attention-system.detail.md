# attention-system L1 实现层

> 仅 `/forge` 编码阶段加载。本文件包含配置常量、完整数据结构、算法、决策树与边缘场景。
> L0 导航层见 [attention-system.md](./attention-system.md)。

---

## §1 配置常量

### §1.1 注意力评分阈值

| 常量 | 值 | 说明 |
| --- | --- | --- |
| `NOVELTY_DUPLICATE` | `0.0` | 完全重复 |
| `NOVELTY_CHANGED` | `0.5` | 内容变化 |
| `NOVELTY_NEW` | `1.0` | 新证据 |
| `RELEVANCE_HIGH` | `0.8` | 目标/投影直接命中 |
| `RELEVANCE_MEDIUM` | `0.5` | 领域相关 |
| `RELEVANCE_LOW` | `0.2` | 弱相关 |
| `RISK_PUBLIC_TECHNICAL` | `low` | 公开技术内容 |
| `RISK_PUBLIC_GENERAL` | `low` | 公开一般内容 |
| `RISK_PRIVATE_CONTEXT` | `medium` | 私有上下文 |
| `RISK_SENSITIVE` | `high` | 敏感/凭证 |

### §1.2 输出边界

| 常量 | 值 | 来源 |
| --- | --- | --- |
| `ATTENTION_SUMMARY_MAX_CHARS` | `280` | PRD §6.1 char budget 推导 |
| `POSSIBLE_ACTIONS_MAX_COUNT` | `4` | 防止选项过载 |
| `ACTION_RATIONALE_MAX_CHARS` | `120` | 单条理由长度上限 |

### §1.3 Stable Identity 键

- 复合键：`(platformId, externalId?, contentHash)`
- `externalId` 缺失或空字符串时退化为 `(platformId, contentHash)`，并标记 `identity_unstable`
- `contentHash` 缺失或占位值（`EMPTY_CONTENT_HASH`）时，整个 identity 标记 `identity_unstable`，且无法用于去重或 routine 信号推广
- `observedAt` 不参与 logical identity（PRD US-002 边界）
- Stable identity 的 canonical owner 是 `memory-continuity-system.normalizeEvidenceIdentity`；`attention-system` 只读取结果，不直接写入 `EvidenceItem`

---

## §2 完整数据结构

### §2.1 枚举值

```typescript
type RepetitionKind = "new" | "changed" | "duplicate" | "identity_unstable";

type AttentionRiskLevel = "none" | "low" | "medium" | "high";

type AttentionSignalStatus =
  | "attentive"
  | "attention_blocked_missing_sources"
  | "degraded";

type AttentionPosture = "notify_owner" | "watch" | "remember" | "defer";

type AttentionActionKind =
  | "notify_owner"
  | "watch"
  | "remember"
  | "defer";
```

### §2.2 验证规则

`AttentionSignal`:

- `sourceRefs` 非空且全部 `resolveStatus !== "missing"`，否则 status = `attention_blocked_missing_sources`
- `summary` 长度 <= `ATTENTION_SUMMARY_MAX_CHARS`
- `possibleActions.length` <= `POSSIBLE_ACTIONS_MAX_COUNT`
- `novelty` 与 `repetition` 一致：`duplicate` → `novelty=0`; `changed` → `novelty>0`; `new` → `novelty=1`
- `AttentionActionKind` 不包含 `connector_read`；connector 读取需由 Agent/routine 在更高层决策
- `threadSuggestion` 只能是 `create` / `continue` / `pause` / `complete` / `none`；除 `create` / `none` 外必须携带 `activityThreadId`

**v8 `JudgmentVerdict` 兼容性**:
- v9 实时路径只生产/消费 `AttentionSignal`。
- v8 `judgment_verdict` 表保留为只读 legacy；读取映射由 `memory-continuity-system.readLegacyJudgmentVerdictAsAttentionSignal()` 提供。
- 映射结果 `status = "degraded"`，`reason = "v8_legacy_judgment_mapped"`，仅用于 observability replay / 历史查询，不作为当前 cycle 决策输入。
- v8 judgment 相关测试迁移路径：重写为 `AttentionSignal` 期望，或保留 legacy replay tests 并标记 `legacy_judgment_verdict_adapter`。

`StableEvidenceIdentity`:

- `contentHash` 必填
- `externalId` 缺失时 `repetitionStatus = identity_unstable`
- `seenCount` 单调递增

### §2.3 SourceRef 使用规则

v9 `attention-system` 使用 [`shared-v9-contracts.md`](./shared-v9-contracts.md) §1 canonical `SourceRef` shape：

```typescript
interface SourceRef {
  family: SourceRefFamily;
  id: string;
  label?: string;
}
```

`SourceRefFamily` 取值：`evidence` | `attention` | `action` | `routine` | `character` | `dream` | `quiet` | `connector` | `ledger`。

- `attention-system` 自身产出的 signal 使用 `family: "attention"`。
- 不扩展 `stable_identity` 作为独立 family；stable identity 属于 `memory-continuity-system` 内部概念。
- URI-string 约定（如 `evidence:{platformId}:{logicalId}`）仅用于 compact logging；canonical interchange 使用结构化对象。

---

## §3 算法

### §3.1 Stable Identity 解析算法

```text
resolveStableIdentity(evidence):
  if evidence.contentHash is missing:
    return identity_unstable, reason="missing_content_hash"

  identity = memoryContinuitySystem.normalizeEvidenceIdentity(evidence)
  return identity.repetitionStatus, identity.seenCount
```

### §3.2 Novelty 评分

```text
scoreNovelty(identity):
  if identity.repetitionStatus == "duplicate": return 0.0
  if identity.repetitionStatus == "changed":  return 0.5
  if identity.repetitionStatus == "new":      return 1.0
  if identity.repetitionStatus == "identity_unstable": return 0.0
```

### §3.3 Relevance 评分

```text
scoreRelevance(evidence, ctx):
  score = 0.0

  for goal in ctx.acceptedGoals:
    if goal.text or tags overlap evidence:
      score = max(score, RELEVANCE_HIGH)

  for projection in ctx.activeProjections:
    if projection.topic or tags overlap evidence:
      score = max(score, RELEVANCE_MEDIUM)

  if ctx.bodyIntuition.recentPlatforms includes evidence.platformId:
    score = max(score, RELEVANCE_LOW)

  return clamp(score, 0, 1)
```

### §3.4 Risk 评分

```text
scoreRisk(evidence):
  map sensitivityClass -> AttentionRiskLevel:
    public_technical -> low
    public_general   -> low
    private_context  -> medium
    sensitive        -> high
    default          -> low
```

### §3.5 Action Suggestion 算法

```text
suggestActions(evidence, ctx):
  suggestions = []

  if evidence.risk == "high":
    suggestions.append({ kind: "notify_owner", rationale: "敏感内容需要 owner 知情", sourceRefs })
    suggestions.append({ kind: "watch",        rationale: "持续观察", sourceRefs })

  if evidence.repetition == "new" and relevance >= RELEVANCE_MEDIUM:
    suggestions.append({ kind: "remember", rationale: "新相关证据，建议纳入记忆", sourceRefs })

  if suggestions.empty:
    suggestions.append({ kind: "defer", rationale: "低优先级，暂不处理", sourceRefs })

  return suggestions.slice(0, POSSIBLE_ACTIONS_MAX_COUNT)
```

### §3.5a ActivityThread Suggestion 算法

```text
suggestActivityThread(evidence, identity, ctx):
  if evidence.sourceRefs missing or empty:
    return { threadSuggestion: "none" }

  related = findActiveThreadByTopicOrSource(ctx.activeActivityThreads, evidence)

  if related exists and related.status == "active":
    if related.completedStepCount >= ACTIVITY_THREAD_MAX_STEPS:
      return { activityThreadId: related.id, threadSuggestion: "pause", reason: "activity_thread_overlong" }
    if heartbeatGap(related.lastHeartbeatSequence, ctx.cycleSequence) > ACTIVITY_THREAD_STALE_HEARTBEATS:
      return { activityThreadId: related.id, threadSuggestion: "pause", reason: "activity_thread_stale" }
    return { activityThreadId: related.id, threadSuggestion: "continue" }

  if identity.repetitionStatus == "new" and relevance >= RELEVANCE_MEDIUM:
    return { threadSuggestion: "create" }

  if related exists and related.status in ["paused", "blocked"]:
    return { threadSuggestion: "none" }

  return { threadSuggestion: "none" }
```

**Selection rules**:
- `attention-system` only suggests thread lifecycle; it never mutates `ActivityThread` state.
- Matching uses source refs, platform/capability topic, and stable identity key; duplicate evidence prefers `continue` on the existing active thread rather than `create`.
- `pause` / `complete` suggestions must include a thread id and source refs explaining why the suggestion exists.

### §3.6 AttentionSignal 装配算法

```text
assembleAttention(input):
  identity = repetitionDetector.resolveStableIdentity(input.evidenceItem)
  novelty  = scorer.scoreNovelty(identity, input.evidenceItem)
  relevance = scorer.scoreRelevance(input.evidenceItem, buildContext(input))
  risk     = scorer.scoreRisk(input.evidenceItem)
  actions  = scorer.suggestActions(input.evidenceItem, buildContext(input))
  thread   = scorer.suggestActivityThread(input.evidenceItem, identity, buildContext(input))

  if input.evidenceItem.sourceRefs missing or empty:
    status  = "attention_blocked_missing_sources"
    reason  = "missing_source_refs"
    summary = redact("无法为无来源证据生成注意力信号")
  else:
    status  = "attentive"
    reason  = null
    summary = generateSummary(input.evidenceItem, identity, relevance, risk)

  signal = new AttentionSignal({
    ...baseFields,
    activityThreadId: thread.activityThreadId,
    threadSuggestion: thread.threadSuggestion,
  })
  emitStageEvent("attention_assembled", signal)
  return signal
```

### §3.7 Summary 生成

- 规则优先：拼接 `(repetitionLabel) platformId/capabilityId: contentSummary[: riskHint]`
- 可选 LLM：仅在启用时重写为更自然语言，但必须受 char budget 和 redaction 约束
- LLM 输出必须验证长度与 `redactionClass`，失败则回退规则模板

---

## §4 决策树

```text
输入 EvidenceItem
  │
  ▼
sourceRefs 有效？
  ├─ 否 ──► status=attention_blocked_missing_sources, 无 action proposal
  │
  ▼
调用 memory-continuity-system.normalizeEvidenceIdentity
  │
  ▼
externalId 或 contentHash 稳定？
  ├─ 否 ──► repetition=identity_unstable, novelty=0, 仅 watch/defer
  │
  ▼
已存在 stable identity？
  ├─ 否 ──► new, novelty=1
  ├─ 是且 contentHash 相同 ──► duplicate, novelty=0
  └─ 是且 contentHash 不同 ──► changed, novelty=0.5
  │
  ▼
计算 relevance / risk / actions
  │
  ▼
返回 AttentionSignal
```

---

## §5 边缘场景

### §5.1 Missing SourceRefs

- 必须返回 `attention_blocked_missing_sources`
- `possibleActions` 为空或仅 `[defer]`
- 不得调用 `action-closure-policy-system` 的 proposal builder
- 记录 stage event 供 `observability-recovery-system`

### §5.2 Identity Unstable

- `externalId` 和 `contentHash` 都缺失
- 不更新 `seenCount`（无法识别）
- summary 标记 `identity_unstable`
- 不推广为 routine signal

### §5.3 Duplicate with Goal Direct Hit

- 默认 duplicate 降低 priority
- 若 `acceptedGoals` 直接命中 evidence 关键词，可维持 `relevance=RELEVANCE_HIGH`
- 但 `repetition` 仍为 `duplicate`，`novelty=0`

### §5.4 Sensitive Content

- `risk=high` 时建议 `notify_owner`/`watch`
- 不得建议 `remember` 为公开记忆（需 redaction gate）
- summary 不得包含 raw credential/PII

### §5.5 Model Assist Timeout

- LLM summary 调用超时时回退规则模板
- status 保持 `attentive`，不降级，但记录 `model_assist_timeout` trace

### §5.6 Empty Evidence Content

- `contentSummary` 为空或空白
- 标记 `degraded`，`reason="empty_evidence_content"`
- 若 sourceRefs 仍有效，返回 `AttentionSignal` 但 `possibleActions=[defer]`
