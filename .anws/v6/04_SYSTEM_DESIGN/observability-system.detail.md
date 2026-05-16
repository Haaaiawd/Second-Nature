# Observability & Safety System — 实现细节 (L1)

> **文件性质**: L1 实现层  
> **对应 L0**: [observability-system.md](./observability-system.md)  
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
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §7 / §9 / §10 |
| §2 | [完整数据结构补充](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 / §11 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

| Key | Default | Owner | Notes |
| --- | --- | --- | --- |
| `observability.redaction.defaultFullContent` | `false` | observability-system | 不默认记录 prompt/input/output 原文 |
| `observability.auditHashChain.enabled` | `true` | observability-system | append-only integrity |
| `observability.telemetrySuccessSampleRate` | `0.1` | observability-system | 不适用于关键审计族 |
| `observability.explainDefaultDays` | `30` | cli-system / observability | 默认查询窗口 |
| `observability.exportDefaultRedacted` | `true` | observability-system | export 默认脱敏 |
| `observability.otelProjectionEnabled` | `false` | operator config | P0 非必需 |

Critical event families that must not be sampled:

- `heartbeat.decision.*`
- `delivery.*`
- `dream.trace.*`
- `narrative.trace.*`
- `connector.inventory.*`
- `source_coverage.*`
- `host_capability.*`

---

## §2 核心数据结构完整定义 (Full Data Structures)

L0 §6 声明公共字段。实现建议保留通用 envelope：

```ts
export interface AuditEnvelope<TEvent> {
  eventId: string;
  family: string;
  traceId: string;
  subjectRef: string;
  createdAt: string;
  event: TEvent;
  redactionManifest: RedactionManifest;
  previousHash?: string;
  recordHash: string;
}
```

Projection mapping:

| SN event | OTel-compatible signal | Notes |
| --- | --- | --- |
| `DreamTrace` | span/event `invoke_workflow` or custom `sn.dream` | projection only |
| `NarrativeTrace` | event `sn.narrative.update` | projection only |
| `ConnectorAttemptAudit` | span `execute_tool` | source refs only |
| `ConnectorInventoryAudit` | log/event `sn.connector.inventory` | not a tool execution |

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 `recordDreamTrace(trace)`

**对应契约**: L0 §5.1  
**准入理由**: budget、lifecycle、redaction 和 hash append 顺序不可颠倒。

```text
validate dreamRunId and traceId
derive budgetStatus if not supplied
assert input/output counts are numeric and non-negative
redact model/provider private fields and content refs
build audit envelope
append to dream trace ledger
update explain index by dreamRunId and outputMemoryStoreId
return AuditAppendAck
```

### §3.2 `recordNarrativeTrace(trace)`

**对应契约**: L0 §5.1  
**准入理由**: unsupported claims 必须影响 grounding status。

```text
validate narrativeId and revision
resolve sourceRef count if provided
if unsupportedClaims length > 0:
  set groundingStatus degraded or blocked
redact source summaries
append envelope
index by narrativeId and related goal refs
return AuditAppendAck
```

### §3.3 `recordConnectorInventory(snapshot)`

**对应契约**: L0 §5.1  
**准入理由**: inventory 是注册状态，不是 execution telemetry。

```text
validate snapshot counts match entries
redact manifest paths if workspace path is private
summarize trust statuses
append connector.inventory event
index by platformId and snapshotId
return AuditAppendAck
```

### §3.4 `queryExplain(query)`

**对应契约**: L0 §5.1  
**准入理由**: 多 subject query 需要防止泄漏 raw payload。

```text
classify query subject kind
load indexed audit envelopes for subject
resolve allowed artifact summaries through state port
never inline private content unless policy explicitly permits
compose explain sections: what happened, why, sources, redactions, next steps
return ExplainReadModel
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Redaction Policy

```text
if path matches credential/token/cookie/auth header:
  erase
else if path contains prompt/input/output/private message:
  replace with contentRef and hash
else if path contains recipient/channel secret:
  hash
else:
  keep summary field
record every action in RedactionManifest
```

### §4.2 Budget Status

```text
if llmCostUsd is undefined:
  not_applicable
else if monthlyBudgetRemaining <= 0:
  exceeded
else if monthlyBudgetRemaining <= configuredWarningThreshold:
  approaching_limit
else:
  ok
```

### §4.3 Connector Status Explain

```text
if inventory has validationErrors for platform:
  status invalid_manifest
else if trustStatus pending:
  status registered_not_executable
else if executable and recent attempt failed:
  status executable_degraded
else if executable:
  status executable
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| Dream trace lacks output store id | `dream:recent` 显示断链 | allow for skipped/failed only; otherwise validation error |
| Narrative unsupported claims empty but no source refs | 假 pass | groundingStatus must be degraded/awaiting_sources |
| Pending trust connector shown green | 安全误导 | inventory status says registered_not_executable |
| Full prompt in event payload | 隐私泄漏 | redaction policy test fixture must catch |
| OTel projection enabled | projection 泄漏 | projection consumes redacted event only |
| Hash-chain repair | 篡改误判 | append correction event, never rewrite previous event |

---

## §6 测试辅助 (Test Helpers)

Recommended fixtures:

- `makeDreamTrace({ status, lifecycleStatus, llmCostUsd })`
- `makeNarrativeTrace({ unsupportedClaims, sourceRefs })`
- `makeConnectorInventoryAudit({ trustStatus, validationErrors })`
- `makeAuditEnvelope({ family, event })`
- `makeRedactionPolicyFixture({ rawCredential, rawPrompt })`
- `makeExplainQuery({ dreamRunId | narrativeId | platformId })`
