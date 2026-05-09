# Observability System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: `[observability-system.md](./observability-system.md)`  
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。  
> **孤岛检查**: 本文件各节均在 L0 有对应链接入口。

---

## 版本历史


| 版本   | 日期         | Changelog                                                                                       |
| ---- | ---------- | ----------------------------------------------------------------------------------------------- |
| v5.0 | 2026-05-01 | 重写为 v5 decision trace、delivery audit、source coverage、guidance grounding 与 host capability audit |


---

## 本文件章节索引


| §   | 章节                                                     | 对应 L0 入口         |
| --- | ------------------------------------------------------ | ---------------- |
| §1  | [配置常量](#1-配置常量-config-constants)                       | L0 §6 / §9 / §10 |
| §2  | [完整数据结构](#2-核心数据结构完整定义-full-data-structures)           | L0 §6            |
| §3  | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5            |
| §4  | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details)            | L0 §4            |
| §5  | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas)          | L0 §5 / §9 / §11 |
| §6  | [测试辅助](#6-测试辅助-test-helpers)                           | L0 §11           |


---

## §1 配置常量 (Config Constants)

```ts
export const AUDIT_RETENTION_CONFIG = {
  decisionDays: 365,
  deliveryDays: 365,
  sourceCoverageDays: 365,
  governanceDays: 365,
  telemetryDays: 30,
  exportDefaultDays: 7,
} as const;

export const AUDIT_WRITE_CONFIG = {
  syncCriticalFamilies: [
    'heartbeat.decision',
    'delivery',
    'source_coverage',
    'guidance.grounding',
    'host_capability',
    'state.governance',
  ],
  allowTelemetrySampling: true,
  maxExplainEvents: 200,
  hashChainEnabled: true,
} as const;

export const REDACTION_POLICY = {
  maskedPaths: [
    '/input/authorization',
    '/input/apiKey',
    '/input/token',
    '/input/recipient',
    '/result/recipient',
  ],
  erasedPaths: [
    '/input/fullPrompt',
    '/input/messageContent',
    '/input/postBody',
    '/result/fullModelOutput',
    '/result/rawConnectorPayload',
  ],
  hashedPaths: [
    '/input/channel',
    '/input/recipient',
    '/input/contentHashTarget',
  ],
  contentRefPaths: [
    '/input/reflectionBody',
    '/input/privateMessage',
    '/result/outreachDraftText',
  ],
} as const;

export const DELIVERY_REASON_CODES = {
  targetNone: 'not_delivered_by_host_policy',
  channelMissing: 'delivery_channel_missing',
  hostUnsupported: 'host_delivery_unsupported',
  ackDropped: 'heartbeat_ack_dropped',
  sent: 'message_sent',
  failed: 'delivery_failed',
  fallbackNotSent: 'operator_fallback_not_sent',
} as const;

export const SOURCE_COVERAGE_CONFIG = {
  sufficientRatio: 1.0,
  maxUnsupportedClaimsForPass: 0,
  requireAllClaimsBackedForPass: true,
  emptyEvidenceReason: 'empty_evidence',
  unresolvedRefsReason: 'unresolved_source_refs',
} as const;

export const OTEL_PROJECTION_CONFIG = {
  enabledByDefault: false,
  agentOperationName: 'invoke_agent',
  toolOperationName: 'execute_tool',
  includeSensitiveContent: false,
  providerName: 'second-nature.local',
} as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

```ts
export type AuditPlane =
  | 'decision'
  | 'delivery'
  | 'source_coverage'
  | 'governance'
  | 'telemetry';

export type AuditEventFamily =
  | 'heartbeat.decision'
  | 'delivery'
  | 'source_coverage'
  | 'guidance.grounding'
  | 'host_capability'
  | 'connector.attempt'
  | 'state.governance';

export type RuntimeScope = 'rhythm' | 'user_task' | 'user_reply';

export type HeartbeatOutcome =
  | 'heartbeat_ok'
  | 'intent_selected'
  | 'denied'
  | 'deferred'
  | 'runtime_carrier_only'
  | 'delivery_unavailable';

export type DeliveryAuditStatus =
  | 'not_requested'
  | 'target_available'
  | 'target_none'
  | 'channel_missing'
  | 'host_unsupported'
  | 'ack_dropped'
  | 'sent'
  | 'failed'
  | 'not_sent_fallback';

export type GroundingStatus = 'pass' | 'degraded' | 'blocked';

export type Sensitivity =
  | 'public'
  | 'internal'
  | 'private'
  | 'credential'
  | 'sensitive';

export interface SourceRef {
  id: string;
  kind:
    | 'platform_item'
    | 'workspace_artifact'
    | 'decision_record'
    | 'user_anchor'
    | 'connector_result'
    | 'host_report'
    | 'fallback_artifact';
  uri: string;
  excerptHash?: string;
  observedAt?: string;
}

export interface AuditEnvelope<TPayload> {
  eventId: string;
  family: AuditEventFamily;
  plane: AuditPlane;
  traceId: string;
  sequence: number;
  createdAt: string;
  payload: TPayload;
  redaction: RedactionManifest;
  integrity: AuditIntegrity;
}

export interface AuditIntegrity {
  previousHash?: string;
  recordHash: string;
  schemaVersion: 'observability.v5';
}

export interface RedactionManifest {
  manifestId: string;
  maskedPaths: string[];
  erasedPaths: string[];
  hashedPaths: string[];
  contentRefPaths: string[];
  sensitivity: Sensitivity;
}

export interface AuditAppendAck {
  eventId: string;
  family: AuditEventFamily;
  plane: AuditPlane;
  traceId: string;
  persistedAt: string;
  recordHash: string;
}

export interface DecisionTrace {
  decisionId: string;
  traceId: string;
  heartbeatId?: string;
  runtimeScope: RuntimeScope;
  outcome: HeartbeatOutcome;
  selectedIntentId?: string;
  candidateId?: string;
  rhythmWindowKind?: string;
  hardGuardVerdict?: 'allow' | 'deny' | 'defer' | 'silent';
  outreachVerdict?: 'allow' | 'deny' | 'defer';
  deliveryAuditId?: string;
  reasonCodes: string[];
  sourceRefs: SourceRef[];
  snapshotRef?: SourceRef;
  createdAt: string;
}

export interface DeliveryAuditRecord {
  auditId: string;
  decisionId: string;
  traceId: string;
  target?: 'none' | 'last' | 'explicit';
  channel?: string;
  recipientRef?: string;
  status: DeliveryAuditStatus;
  messageId?: string;
  hostProofRef?: SourceRef;
  fallbackRef?: string;
  ackDropMatched?: boolean;
  hostVersion?: string;
  reasonCodes: string[];
  createdAt: string;
}

export interface SourceCoverageAudit {
  auditId: string;
  traceId: string;
  subjectType:
    | 'quiet_artifact'
    | 'outreach_draft'
    | 'guidance_payload'
    | 'decision_trace'
    | 'host_report';
  subjectRef: string;
  usedSourceRefs: SourceRef[];
  unresolvedRefs: SourceRef[];
  coverageRatio: number;
  unsupportedClaims: string[];
  status: GroundingStatus;
  reasonCodes: string[];
  createdAt: string;
}

export interface GuidanceGroundingAudit {
  auditId: string;
  traceId: string;
  requestId: string;
  draftId?: string;
  sceneType:
    | 'outreach'
    | 'quiet_reflection'
    | 'social'
    | 'explain'
    | 'user_reply_continuity'
    | 'fallback_candidate';
  groundingStatus: GroundingStatus;
  usedSourceRefs: SourceRef[];
  unsupportedClaims: string[];
  guardViolations: string[];
  deliveryWording?: 'sendable' | 'not_sent_fallback_candidate';
  createdAt: string;
}

export interface HostCapabilityAudit {
  reportId: string;
  traceId: string;
  generatedAt: string;
  hostVersion?: string;
  heartbeatBridgeStatus: 'available' | 'unavailable' | 'unknown';
  deliveryTargetStatus:
    | 'target_available'
    | 'target_none'
    | 'channel_missing'
    | 'host_api_unavailable'
    | 'host_unsupported'
    | 'unknown';
  ackDropBehavior: 'verified' | 'not_verified' | 'conflict';
  runHeartbeatOnceStatus?: 'available' | 'unavailable' | 'unknown';
  hookSupport: Array<{
    hookName: string;
    status: 'available' | 'unavailable' | 'unknown';
    evidenceRef?: SourceRef;
  }>;
  evidenceRefs: SourceRef[];
  reasonCodes?: string[];
  recommendedNextStep?: string;
}

export interface ConnectorAttemptAudit {
  attemptId: string;
  traceId: string;
  platformId: string;
  operation: string;
  status: 'started' | 'succeeded' | 'failed' | 'retried' | 'rate_limited';
  failureClass?:
    | 'rate_limit'
    | 'auth'
    | 'verification_required'
    | 'protocol_drift'
    | 'network'
    | 'parse'
    | 'unknown';
  sourceRefs: SourceRef[];
  createdAt: string;
}

export interface StateGovernanceAudit {
  eventId: string;
  traceId: string;
  kind:
    | 'fallback_written'
    | 'anchor_proposal_created'
    | 'anchor_applied'
    | 'anchor_rejected'
    | 'effect_commit_created'
    | 'effect_commit_advanced'
    | 'effect_commit_reconciled';
  artifactRef?: SourceRef;
  fallbackRef?: string;
  proposalId?: string;
  effectCommitId?: string;
  sourceRefs: SourceRef[];
  reasonCodes: string[];
  createdAt: string;
}

export interface ExplainQuery {
  decisionId?: string;
  traceId?: string;
  fallbackRef?: string;
  sourceRefId?: string;
  reportId?: string;
  includeTelemetry?: boolean;
}

export interface ExplainReadModel {
  subject: ExplainQuery;
  summary: string;
  outcome?: HeartbeatOutcome;
  deliveryStatus?: DeliveryAuditStatus;
  sourceCoverage?: GroundingStatus;
  reasonCodes: string[];
  evidenceRefs: SourceRef[];
  redaction: RedactionManifest[];
  relatedEvents: Array<{
    eventId: string;
    family: AuditEventFamily;
    createdAt: string;
    capsule: string;
  }>;
  warnings: string[];
}

export interface AuditExportRange {
  from: string;
  to: string;
  families?: AuditEventFamily[];
  format: 'json_bundle' | 'otel_projection';
}

export interface AuditBundle {
  bundleId: string;
  generatedAt: string;
  range: AuditExportRange;
  events: Array<AuditEnvelope<unknown>>;
  redactionSummary: {
    maskedCount: number;
    erasedCount: number;
    contentRefCount: number;
  };
}

export interface AuditHashChainVerificationReport {
  reportId: string;
  generatedAt: string;
  range: AuditExportRange;
  checkedEventCount: number;
  status: 'pass' | 'broken' | 'incomplete';
  brokenAtEventIds: string[];
  reasons: string[];
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 recordDecisionTrace

**对应契约**: L0 §5.1 — `recordDecisionTrace(trace)`  
**准入理由**: 需要同步写入、redaction、hash、explain index 多步副作用。

```ts
async function recordDecisionTrace(trace: DecisionTrace, deps: ObservabilityDeps): Promise<AuditAppendAck> {
  assertRequired(trace.decisionId, 'decisionId');
  assertRequired(trace.traceId, 'traceId');
  assertRequired(trace.outcome, 'outcome');

  const normalized: DecisionTrace = {
    ...trace,
    reasonCodes: unique(trace.reasonCodes),
    sourceRefs: uniqueSourceRefs(trace.sourceRefs),
  };

  const envelope = await buildAuditEnvelope({
    family: 'heartbeat.decision',
    plane: 'decision',
    traceId: normalized.traceId,
    payload: normalized,
  }, deps);

  await deps.auditStore.append(envelope);
  await deps.explainIndex.upsertDecision(normalized.decisionId, envelope.eventId);

  return ack(envelope);
}
```

### §3.2 recordDeliveryAudit

**对应契约**: L0 §5.1 — `recordDeliveryAudit(audit)`  
**准入理由**: delivery status 关系到“是否真的联系用户”的硬语义。

```ts
async function recordDeliveryAudit(audit: DeliveryAuditRecord, deps: ObservabilityDeps): Promise<AuditAppendAck> {
  const classified = classifyDeliveryAudit(audit);

  if (classified.status === 'target_none' || classified.status === 'not_sent_fallback') {
    classified.reasonCodes = unique([
      ...classified.reasonCodes,
      classified.status === 'target_none'
        ? DELIVERY_REASON_CODES.targetNone
        : DELIVERY_REASON_CODES.fallbackNotSent,
    ]);
  }

  const envelope = await buildAuditEnvelope({
    family: 'delivery',
    plane: 'delivery',
    traceId: classified.traceId,
    payload: classified,
  }, deps);

  await deps.auditStore.append(envelope);
  await deps.explainIndex.linkDelivery(classified.decisionId, envelope.eventId);
  return ack(envelope);
}
```

### §3.3 recordSourceCoverage

**对应契约**: L0 §5.1 — `recordSourceCoverage(audit)`  
**准入理由**: coverage 决定 Quiet / outreach / guidance 是否能被信任。

```ts
async function recordSourceCoverage(audit: SourceCoverageAudit, deps: ObservabilityDeps): Promise<AuditAppendAck> {
  const classified = classifySourceCoverage(audit);
  const envelope = await buildAuditEnvelope({
    family: 'source_coverage',
    plane: 'source_coverage',
    traceId: classified.traceId,
    payload: classified,
  }, deps);

  await deps.auditStore.append(envelope);
  await deps.explainIndex.linkSourceCoverage(classified.subjectRef, envelope.eventId);
  return ack(envelope);
}
```

### §3.4 recordGuidanceGrounding

**对应契约**: L0 §5.1 — `recordGuidanceGrounding(audit)`  
**准入理由**: guidance 是表达层，但 unsupported claim 必须回流到审计。

```ts
async function recordGuidanceGrounding(audit: GuidanceGroundingAudit, deps: ObservabilityDeps): Promise<AuditAppendAck> {
  const status = audit.unsupportedClaims.length > 0 || audit.guardViolations.length > 0
    ? audit.groundingStatus === 'pass'
      ? 'degraded'
      : audit.groundingStatus
    : audit.groundingStatus;

  const normalized = { ...audit, groundingStatus: status };
  const envelope = await buildAuditEnvelope({
    family: 'guidance.grounding',
    plane: 'source_coverage',
    traceId: normalized.traceId,
    payload: normalized,
  }, deps);

  await deps.auditStore.append(envelope);
  await deps.explainIndex.linkGuidance(normalized.requestId, envelope.eventId);
  return ack(envelope);
}
```

### §3.5 recordHostCapability

**对应契约**: L0 §5.1 — `recordHostCapability(report)`  
**准入理由**: host smoke 是 v5 主动联系闭环的门禁证据。

```ts
async function recordHostCapability(report: HostCapabilityAudit, deps: ObservabilityDeps): Promise<AuditAppendAck> {
  const reasonCodes: string[] = [];

  if (report.deliveryTargetStatus === 'target_none') {
    reasonCodes.push(DELIVERY_REASON_CODES.targetNone);
  }
  if (report.ackDropBehavior === 'verified') {
    reasonCodes.push(DELIVERY_REASON_CODES.ackDropped);
  }

  const payload = { ...report, reasonCodes };
  const envelope = await buildAuditEnvelope({
    family: 'host_capability',
    plane: 'governance',
    traceId: report.traceId,
    payload,
  }, deps);

  await deps.auditStore.append(envelope);
  await deps.explainIndex.linkHostReport(report.reportId, envelope.eventId);
  return ack(envelope);
}
```

### §3.6 recordConnectorAttempt

**对应契约**: L0 §5.1 — `recordConnectorAttempt(attempt)`  
**准入理由**: connector errors 是 life evidence provenance 与 retry/reconcile 的主要输入。

```ts
async function recordConnectorAttempt(attempt: ConnectorAttemptAudit, deps: ObservabilityDeps): Promise<AuditAppendAck> {
  const plane: AuditPlane = attempt.status === 'failed' ? 'governance' : 'telemetry';
  const envelope = await buildAuditEnvelope({
    family: 'connector.attempt',
    plane,
    traceId: attempt.traceId,
    payload: attempt,
  }, deps);

  await deps.auditStore.append(envelope);
  if (attempt.status === 'failed') {
    await deps.explainIndex.linkTrace(attempt.traceId, envelope.eventId);
  }
  return ack(envelope);
}
```

### §3.7 recordStateGovernance

**对应契约**: L0 §5.1 — `recordStateGovernance(event)`  
**准入理由**: fallback、anchor、effect commit 都是长期治理证据。

```ts
async function recordStateGovernance(event: StateGovernanceAudit, deps: ObservabilityDeps): Promise<AuditAppendAck> {
  const envelope = await buildAuditEnvelope({
    family: 'state.governance',
    plane: 'governance',
    traceId: event.traceId,
    payload: event,
  }, deps);

  await deps.auditStore.append(envelope);
  await deps.explainIndex.linkGovernance(event, envelope.eventId);
  return ack(envelope);
}
```

### §3.8 queryExplain

**对应契约**: L0 §5.1 — `queryExplain(query)`  
**准入理由**: 需要跨 event family 组装人类可读解释，同时保持脱敏边界。

```ts
async function queryExplain(query: ExplainQuery, deps: ObservabilityDeps): Promise<ExplainReadModel> {
  const plan = resolveExplainPlan(query);
  const eventIds = await deps.explainIndex.resolve(plan);
  const envelopes = await deps.auditStore.loadMany(eventIds, AUDIT_WRITE_CONFIG.maxExplainEvents);

  const model = composeExplainReadModel(query, envelopes);
  if (model.deliveryStatus === 'target_none' || model.deliveryStatus === 'not_sent_fallback') {
    model.warnings.push('No user-visible contact was completed.');
  }

  return model;
}
```

### §3.9 redactAuditEvent

**对应契约**: L0 §5.1 — `redactAuditEvent(event)`  
**准入理由**: redaction 是持久化前置条件，不能事后补救。

```ts
function redactAuditEvent<T extends Record<string, unknown>>(payload: T): {
  payload: T;
  manifest: RedactionManifest;
} {
  const mutable = structuredClone(payload) as Record<string, unknown>;
  const manifest: RedactionManifest = {
    manifestId: crypto.randomUUID(),
    maskedPaths: [],
    erasedPaths: [],
    hashedPaths: [],
    contentRefPaths: [],
    sensitivity: inferSensitivity(payload),
  };

  for (const path of REDACTION_POLICY.erasedPaths) {
    if (hasJsonPointer(mutable, path)) {
      removeJsonPointer(mutable, path);
      manifest.erasedPaths.push(path);
    }
  }

  for (const path of REDACTION_POLICY.maskedPaths) {
    if (hasJsonPointer(mutable, path)) {
      setJsonPointer(mutable, path, '[MASKED]');
      manifest.maskedPaths.push(path);
    }
  }

  for (const path of REDACTION_POLICY.hashedPaths) {
    if (hasJsonPointer(mutable, path)) {
      setJsonPointer(mutable, path, sha256(String(getJsonPointer(mutable, path))));
      manifest.hashedPaths.push(path);
    }
  }

  for (const path of REDACTION_POLICY.contentRefPaths) {
    if (hasJsonPointer(mutable, path)) {
      setJsonPointer(mutable, path, makeContentRef(path, getJsonPointer(mutable, path)));
      manifest.contentRefPaths.push(path);
    }
  }

  return { payload: mutable as T, manifest };
}
```

### §3.10 exportAuditBundle

**对应契约**: L0 §5.1 — `exportAuditBundle(range)`  
**准入理由**: 导出需要遵守 retention、redaction 与 projection 格式。

```ts
async function exportAuditBundle(range: AuditExportRange, deps: ObservabilityDeps): Promise<AuditBundle> {
  const events = await deps.auditStore.loadRange(range.from, range.to, range.families);
  const redactedEvents = events.map((event) => ensureExportSafe(event));

  if (range.format === 'otel_projection') {
    return buildOtelProjectionBundle(redactedEvents, range);
  }

  return {
    bundleId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    range,
    events: redactedEvents,
    redactionSummary: summarizeRedaction(redactedEvents),
  };
}
```

### §3.11 verifyAuditHashChain

**对应契约**: L0 §5.1 — `verifyAuditHashChain(range)`  
**准入理由**: append-only audit 需要可验证完整性，不能只预留字段。

```ts
async function verifyAuditHashChain(
  range: AuditExportRange,
  deps: ObservabilityDeps,
): Promise<AuditHashChainVerificationReport> {
  const events = await deps.auditStore.loadRange(range.from, range.to, range.families);
  const brokenAtEventIds: string[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedHash = computeAuditRecordHash(event);
    if (event.integrity.recordHash !== expectedHash) brokenAtEventIds.push(event.eventId);

    const previous = events[index - 1];
    if (previous && event.integrity.previousHash !== previous.integrity.recordHash) {
      brokenAtEventIds.push(event.eventId);
    }
  }

  return {
    reportId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    range,
    checkedEventCount: events.length,
    status: brokenAtEventIds.length === 0 ? 'pass' : 'broken',
    brokenAtEventIds: unique(brokenAtEventIds),
    reasons: brokenAtEventIds.length === 0 ? ['hash_chain_valid'] : ['hash_chain_broken'],
  };
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Audit Event Routing

**对应 L0 Mermaid**: `observability-system.md §4.1`

```ts
function routeAuditPlane(family: AuditEventFamily): AuditPlane {
  if (family === 'heartbeat.decision') return 'decision';
  if (family === 'delivery') return 'delivery';
  if (family === 'source_coverage' || family === 'guidance.grounding') return 'source_coverage';
  if (family === 'host_capability' || family === 'state.governance') return 'governance';
  return 'telemetry';
}
```

### §4.2 Delivery Audit Classification

**对应 L0 Mermaid**: `observability-system.md §4.4`

```ts
function classifyDeliveryAudit(audit: DeliveryAuditRecord): DeliveryAuditRecord {
  if (audit.target === 'none') {
    if (audit.fallbackRef) {
      return {
        ...audit,
        status: 'not_sent_fallback',
        reasonCodes: unique([
          ...audit.reasonCodes,
          DELIVERY_REASON_CODES.targetNone,
          DELIVERY_REASON_CODES.fallbackNotSent,
        ]),
      };
    }

    return {
      ...audit,
      status: 'target_none',
      reasonCodes: unique([...audit.reasonCodes, DELIVERY_REASON_CODES.targetNone]),
    };
  }

  if (audit.ackDropMatched) {
    return {
      ...audit,
      status: 'ack_dropped',
      reasonCodes: unique([...audit.reasonCodes, DELIVERY_REASON_CODES.ackDropped]),
    };
  }

  if (audit.status === 'sent' && !audit.messageId && !audit.hostProofRef) {
    return {
      ...audit,
      status: 'failed',
      reasonCodes: unique([...audit.reasonCodes, 'missing_delivery_proof_for_sent_status']),
    };
  }

  if (audit.fallbackRef && audit.status !== 'sent') {
    return {
      ...audit,
      status: 'not_sent_fallback',
      reasonCodes: unique([...audit.reasonCodes, DELIVERY_REASON_CODES.fallbackNotSent]),
    };
  }

  return audit;
}
```

### §4.3 Source Coverage Classification

**对应 L0 Mermaid**: `observability-system.md §4.5`

```ts
function classifySourceCoverage(audit: SourceCoverageAudit): SourceCoverageAudit {
  const reasonCodes = [...audit.reasonCodes];

  if (audit.usedSourceRefs.length === 0) {
    reasonCodes.push(SOURCE_COVERAGE_CONFIG.emptyEvidenceReason);
    return { ...audit, coverageRatio: 0, status: 'blocked', reasonCodes: unique(reasonCodes) };
  }

  if (audit.unresolvedRefs.length > 0) {
    reasonCodes.push(SOURCE_COVERAGE_CONFIG.unresolvedRefsReason);
  }

  if (audit.unsupportedClaims.length > SOURCE_COVERAGE_CONFIG.maxUnsupportedClaimsForPass) {
    return { ...audit, status: 'blocked', reasonCodes: unique(reasonCodes) };
  }

  if (audit.coverageRatio < SOURCE_COVERAGE_CONFIG.sufficientRatio) {
    return { ...audit, status: 'blocked', reasonCodes: unique(reasonCodes) };
  }

  return { ...audit, status: 'pass', reasonCodes: unique(reasonCodes) };
}
```

### §4.4 Explain Resolution

**对应 L0**: `observability-system.md §5.1 queryExplain`

```ts
function resolveExplainPlan(query: ExplainQuery): ExplainResolutionPlan {
  if (query.decisionId) {
    return { keys: [{ kind: 'decisionId', value: query.decisionId }], includeFamilies: ['heartbeat.decision', 'delivery', 'source_coverage', 'guidance.grounding', 'state.governance'] };
  }
  if (query.fallbackRef) {
    return { keys: [{ kind: 'fallbackRef', value: query.fallbackRef }], includeFamilies: ['delivery', 'state.governance', 'source_coverage'] };
  }
  if (query.reportId) {
    return { keys: [{ kind: 'reportId', value: query.reportId }], includeFamilies: ['host_capability', 'delivery'] };
  }
  if (query.sourceRefId) {
    return { keys: [{ kind: 'sourceRefId', value: query.sourceRefId }], includeFamilies: ['source_coverage', 'heartbeat.decision'] };
  }
  return { keys: [{ kind: 'traceId', value: query.traceId ?? '' }], includeFamilies: ['heartbeat.decision', 'delivery', 'connector.attempt'] };
}
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)


| 场景                                       | 风险                  | 处理方式                                                                           |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `target: "none"` 但 heartbeat returned ok | 被误读为主动联系成功          | `DeliveryAuditRecord.status = target_none`; explain 显示 no user-visible contact |
| `HEARTBEAT_OK` 被宿主 ack drop              | 用户以为 agent 没运行      | decision 记录 `heartbeat_ok`; delivery 记录 `ack_dropped` 或不请求 delivery            |
| deny/defer 没有记录                          | 无法解释“为什么没做”         | 所有 verdict 必须先 `recordDecisionTrace`                                           |
| fallback 有候选文案                           | 被误写成 sent           | fallback audit 必须 `not_sent_fallback`; wording 不得写成已发送                         |
| guidance unsupported claim               | 朋友式表达变成编故事          | `GuidanceGroundingAudit.status = blocked/degraded`                             |
| Quiet empty evidence                     | 虚构一天经历              | source coverage `blocked` + reason `empty_evidence`                            |
| audit payload 保存原文                       | 泄漏凭据/私信/prompt      | `RedactionManifest` + `content_ref`                                            |
| telemetry 被采样                            | 丢失治理证据              | critical families 不采样，仅 connector success telemetry 可采样                        |
| hash chain 断裂                            | 审计可信度下降             | repair 不改旧记录，只追加 `audit.integrity_failure` future event                        |
| OTel exporter 开启                         | vendor schema 误作真相源 | exporter bundle 标注 projection，local ledger 仍是 source of truth                  |


### §5.1 典型错误：把 run success 当 contact success

```ts
// 错误：heartbeat 成功不代表联系成功
// if (surfaceResult.ok) contactSucceeded = true;

// 正确：只有 sent + messageId / hostProofRef 才是用户联系成功
// contactSucceeded = delivery.status === 'sent' && Boolean(delivery.messageId || delivery.hostProofRef);
```

### §5.2 典型错误：source coverage 只存数字

```ts
// 错误：只存 coverageRatio，无法追踪来源
// { coverageRatio: 0.9 }

// 正确：source refs、unresolved refs、unsupported claims 一起保存
// { usedSourceRefs, unresolvedRefs, coverageRatio, unsupportedClaims, status }
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeSourceRef(overrides: Partial<SourceRef> = {}): SourceRef {
  return {
    id: 'src-test',
    kind: 'workspace_artifact',
    uri: 'memory/2026-05-01.md',
    excerptHash: 'hash-test',
    ...overrides,
  };
}

export function makeDecisionTrace(overrides: Partial<DecisionTrace> = {}): DecisionTrace {
  return {
    decisionId: 'decision-test',
    traceId: 'trace-test',
    heartbeatId: 'heartbeat-test',
    runtimeScope: 'rhythm',
    outcome: 'delivery_unavailable',
    hardGuardVerdict: 'allow',
    outreachVerdict: 'allow',
    reasonCodes: ['delivery_channel_missing'],
    sourceRefs: [makeSourceRef()],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeDeliveryAudit(overrides: Partial<DeliveryAuditRecord> = {}): DeliveryAuditRecord {
  return {
    auditId: 'delivery-test',
    decisionId: 'decision-test',
    traceId: 'trace-test',
    target: 'none',
    status: 'target_none',
    reasonCodes: [DELIVERY_REASON_CODES.targetNone],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeSourceCoverageAudit(overrides: Partial<SourceCoverageAudit> = {}): SourceCoverageAudit {
  return {
    auditId: 'coverage-test',
    traceId: 'trace-test',
    subjectType: 'quiet_artifact',
    subjectRef: 'quiet-test',
    usedSourceRefs: [makeSourceRef()],
    unresolvedRefs: [],
    coverageRatio: 1,
    unsupportedClaims: [],
    status: 'pass',
    reasonCodes: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeHostCapabilityAudit(overrides: Partial<HostCapabilityAudit> = {}): HostCapabilityAudit {
  return {
    reportId: 'host-report-test',
    traceId: 'trace-host-test',
    generatedAt: new Date().toISOString(),
    heartbeatBridgeStatus: 'available',
    deliveryTargetStatus: 'target_none',
    ackDropBehavior: 'verified',
    hookSupport: [],
    evidenceRefs: [makeSourceRef({ kind: 'host_report', uri: 'reports/host-smoke.json' })],
    recommendedNextStep: 'Configure a user-visible delivery target.',
    ...overrides,
  };
}
```

### §6.1 Contract Fixtures


| Fixture                                           | 用途                           |
| ------------------------------------------------- | ---------------------------- |
| `makeDecisionTrace({ outcome: "heartbeat_ok" })`  | 验证静默 heartbeat explain       |
| `makeDeliveryAudit({ target: "none" })`           | 验证 `target_none` 不算 sent     |
| `makeDeliveryAudit({ ackDropMatched: true })`     | 验证 ack drop 分类               |
| `makeSourceCoverageAudit({ usedSourceRefs: [] })` | 验证 empty evidence blocked    |
| `makeHostCapabilityAudit()`                       | 验证 host smoke report explain |


