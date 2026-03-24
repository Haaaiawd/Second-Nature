# Observability System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`observability-system.md`](./observability-system.md)
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。
> **⚠️ 孤岛检查**: 本文件各节均须在 L0 有对应超链接入口，禁止孤岛内容。

---

## 版本历史

| 版本 | 日期         | Changelog |
| ---- | ------------ | --------- |
| v2.0 | 2026-03-23 | 初始版本 |

---

## 本文件章节索引

|   §   | 章节 | 对应 L0 入口 |
| :---: | ---- | :----------: |
|  §1   | [配置常量](#1-配置常量-config-constants) | L0 §6 数据模型 |
|  §2   | [完整数据结构](#2-核心数据结构完整定义-full-data-structures) | L0 §6 数据模型 |
|  §3   | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 操作契约表 |
|  §4   | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 架构图 |
|  §5   | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §5 / §9 |
|  §6   | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 测试策略 |

---

## §1 配置常量 (Config Constants)

```ts
export const AUDIT_CONFIG = {
  retainGovernanceDays: 365,
  retainTelemetryDays: 30,
  syncCriticalWrites: true,
} as const;

export const REDACTION_CONFIG = {
  defaultSensitivity: 'internal',
  maskedFieldNames: ['apiKey', 'token', 'authorization', 'secret'],
  eraseFieldNames: ['messageContent', 'postBody', 'fullPrompt'],
  hashFieldNames: ['contentHashTarget'],
} as const;

export const EVENT_CONFIG = {
  criticalEvents: ['decision.recorded', 'anchor.applied', 'anchor.rejected'],
  governanceEvents: ['quiet.interrupted', 'reflection.rejected', 'outreach.denied'],
} as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

```ts
export type DecisionRecord = SharedDecisionRecord;

// `DecisionRecord`、`ExecutionAttempt`、`AnchorChangeAudit` 等领域对象应来自 shared contract。
// 本处展示的是 observability 视角下的使用形状，不应在本系统内演化为独立真定义。

export type ExecutionAttempt = SharedExecutionAttempt;

export type AnchorChangeAudit = SharedAnchorChangeAudit;

export interface CredentialLifecycleAudit {
  id: string;
  platformId: string;
  statusFrom?: string;
  statusTo: string;
  verificationDeadline?: string;
  attemptsRemaining?: number;
  explanationCapsule: string;
}

export interface RedactionManifest {
  id: string;
  sensitivityLevel: 'public' | 'internal' | 'restricted';
  maskedFields: string[];
  erasedFields: string[];
  hashedFields: string[];
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 recordDecision

**对应契约**: L0 §5.1 — `recordDecision(record)`
**准入理由**: 审计优先级最高，需要同步落盘与 redaction。

```ts
async function recordDecision(record: DecisionRecord): Promise<void> {
  const redacted = redactEvent(record);
  await auditStore.append('decision_ledger', redacted);
}
```

### §3.2 recordExecutionAttempt

**对应契约**: L0 §5.1 — `recordExecutionAttempt(attempt)`
**准入理由**: 需要统一 trace、channel、failure 与 retry 元信息。

```ts
async function recordExecutionAttempt(attempt: ExecutionAttempt): Promise<void> {
  const redacted = redactEvent(attempt);
  await telemetryStore.append('execution_attempts', redacted);
}
```

### §3.3 recordQuietLifecycle

**对应契约**: L0 §5.1 — `recordQuietLifecycle(event)`
**准入理由**: Quiet 中断/恢复是治理核心事件，不可只当普通日志。

```ts
async function recordQuietLifecycle(event: QuietLifecycleEvent): Promise<void> {
  const redacted = redactEvent(event);
  await governanceStore.append('quiet_events', redacted);
}
```

### §3.4 recordOutreachDecision

**对应契约**: L0 §5.1 — `recordOutreachDecision(event)`
**准入理由**: 需要记录“考虑过但没发”的场景。

```ts
async function recordOutreachDecision(event: OutreachDecision): Promise<void> {
  const redacted = redactEvent(event);
  await governanceStore.append('outreach_events', redacted);
}
```

### §3.5 recordAnchorChangeAudit

**对应契约**: L0 §5.1 — `recordAnchorChangeAudit(event)`
**准入理由**: 需要 proposal/apply/diff/sourceRefs 的长期证据链。

```ts
async function recordAnchorChangeAudit(event: AnchorChangeAudit): Promise<void> {
  const redacted = redactEvent(event);
  await governanceStore.append('anchor_audit', redacted);
}
```

### §3.5a recordCredentialLifecycle

**对应契约**: L0 §5.1 — `recordCredentialLifecycle(event)`
**准入理由**: 注册、验证、过期、撤销是平台接入可恢复性的关键证据链。

```ts
async function recordCredentialLifecycle(event: CredentialLifecycleAudit): Promise<void> {
  const redacted = redactEvent(event);
  await governanceStore.append('credential_audit', redacted);
}
```

### §3.6 queryEvidence

**对应契约**: L0 §5.1 — `queryEvidence(query)`
**准入理由**: 跨 decision/trace/asset/proposal 组装解释性证据。

```ts
async function queryEvidence(query: EvidenceQuery): Promise<EvidenceBundle> {
  const plan = resolveEvidencePath(query);
  const decisions = plan.path.includes('decision') ? await auditStore.find(query) : [];
  const attempts = plan.path.includes('attempts') || plan.path.includes('telemetry') ? await telemetryStore.find(query) : [];
  const governance = plan.path.includes('governance') || plan.path.includes('anchor_audit') || plan.path.includes('provenance')
    ? await governanceStore.find(query)
    : [];

  return composeEvidenceBundle(decisions, attempts, governance);
}
```

### §3.7 redactEvent

**对应契约**: L0 §5.1 — `redactEvent(event)`
**准入理由**: 结构化脱敏是本系统安全核心，不可事后补丁。

```ts
function redactEvent<T extends Record<string, unknown>>(event: T): T & { redactionManifest: RedactionManifest } {
  const maskedFields: string[] = [];
  const erasedFields: string[] = [];
  const hashedFields: string[] = [];

  const output = { ...event } as Record<string, unknown>;

  for (const key of Object.keys(output)) {
    if (REDACTION_CONFIG.maskedFieldNames.includes(key)) {
      output[key] = '[MASKED]';
      maskedFields.push(key);
    }
    if (REDACTION_CONFIG.eraseFieldNames.includes(key)) {
      delete output[key];
      erasedFields.push(key);
    }
  }

  return {
    ...(output as T),
    redactionManifest: {
      id: crypto.randomUUID(),
      sensitivityLevel: 'internal',
      maskedFields,
      erasedFields,
      hashedFields,
    },
  };
}
```

### §3.8 exportAuditBundle

**对应契约**: L0 §5.1 — `exportAuditBundle(range)`
**准入理由**: 导出必须遵守 redaction 规则与双平面保留策略。

```ts
async function exportAuditBundle(range: TimeRange): Promise<AuditBundle> {
  const records = await auditStore.findByRange(range);
  const telemetry = await telemetryStore.findByRange(range);
  const governance = await governanceStore.findByRange(range);

  return buildExportBundle(records, telemetry, governance);
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 事件落平面决策

**对应 L0 Mermaid**: `observability-system.md §4.4`

```ts
function routeEventPlane(event: DomainEvent): 'decision_ledger' | 'telemetry' | 'governance_audit' {
  if (event.type.startsWith('decision.')) return 'decision_ledger';
  if (event.type.startsWith('anchor.') || event.type.startsWith('quiet.') || event.type.startsWith('outreach.') || event.type.startsWith('reflection.')) {
    return 'governance_audit';
  }
  return 'telemetry';
}
```

### §4.2 证据查询决策

**对应 L0 Mermaid**: `observability-system.md §4.3`

```ts
function resolveEvidencePath(query: EvidenceQuery): EvidenceResolutionPlan {
  if (query.decisionId) return { path: ['decision', 'attempts', 'governance'] };
  if (query.proposalId) return { path: ['anchor_audit', 'provenance', 'decision'] };
  if (query.assetId) return { path: ['provenance', 'anchor_audit', 'decision'] };
  return { path: ['telemetry'] };
}
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| 只记录执行成功，不记录 deny | 无法解释“为什么没做” | allow/deny/defer/escalate 同级建模 |
| Quiet 被打断但没记录中断原因 | 无法复盘节律异常 | 记录 `quiet.interrupted` + reason code |
| Anchor apply 只记录结果不记录 diff | 无法解释人格变化 | 保存 before/after hash + diffSummary + sourceRefs |
| 过度保留原文 | observability 变成泄漏面 | 使用 redactionManifest + content_ref |
| trace backend 不可用 | 审计丢失 | 本地 append-only 审计账本始终优先 |
| 各系统各自复制一份 `DecisionRecord` 结构 | schema 漂移，解释链失真 | 跨系统对象统一来自 shared contract，observability 不维护私有变体 |

### §5.1 deny path 丢失

```ts
// ❌ 错误做法
// if (verdict !== 'allow') return;

// ✅ 正确做法
// 任何 verdict 都先 recordDecision，再决定是否执行 effect
```

### §5.2 把 reflection 正文当审计证据

```ts
// ❌ 错误做法
// audit.payload = fullReflectionMarkdown

// ✅ 正确做法
// audit.payload = explanationCapsule + content_ref + sourceRefs
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeDecisionRecord(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: 'decision-test',
    traceId: 'trace-test',
    tickId: 'tick-test',
    verdict: 'deny',
    reasonCodes: ['quiet_window'],
    explanationCapsule: 'Quiet window suppressed a non-urgent outreach.',
    stateSnapshotRef: 'snapshot-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```
