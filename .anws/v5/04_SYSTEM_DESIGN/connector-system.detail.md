# Connector System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`connector-system.md`](./connector-system.md)  
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。  
> **孤岛检查**: 本文件各节均在 L0 有对应链接入口。

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v5.0 | 2026-05-01 | 重写为 v5 source-backed connector execution、LifeEvidenceCandidate、effect semantics、idempotency/retry 与 degraded fallback |

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §6 / §9 / §10 |
| §2 | [完整数据结构](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §5 / §9 / §11 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

```ts
export const CONNECTOR_CAPABILITY_CONFIG = {
  socialCommunity: [
    'feed.read',
    'notification.list',
    'profile.read',
    'post.publish',
    'comment.reply',
    'message.read',
    'message.send',
  ],
  agentNetwork: [
    'agent.register',
    'agent.heartbeat',
    'work.discover',
    'task.claim',
    'task.update',
  ],
} as const;

export const EFFECT_SEMANTICS_CONFIG = {
  readOnly: ['feed.read', 'notification.list', 'profile.read', 'message.read', 'work.discover'],
  keepalive: ['agent.heartbeat'],
  sideEffect: ['post.publish', 'comment.reply', 'message.send', 'agent.register', 'task.update'],
  taskClaim: ['task.claim'],
} as const;

export const CHANNEL_PRIORITY_CONFIG = {
  default: ['api_rest', 'a2a', 'mcp', 'cli', 'skill', 'browser'],
  readOnly: ['api_rest', 'a2a', 'mcp', 'cli', 'skill', 'browser'],
  sideEffect: ['api_rest', 'a2a'],
  taskClaim: ['api_rest', 'a2a'],
  degradedOnly: ['cli', 'skill', 'browser'],
} as const;

export const RETRY_POLICY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitter: true,
  respectRetryAfter: true,
  retryableFailureClasses: ['transport_failure', 'rate_limited', 'timeout', 'temporary_platform_failure'],
} as const;

export const CONNECTOR_TIMEOUT_CONFIG = {
  routePlanMs: 50,
  checkConnectorMs: 3_000,
  readActionMs: 5_000,
  sideEffectActionMs: 10_000,
  degradedActionMs: 15_000,
} as const;

export const SOURCE_REF_POLICY = {
  requireSourceRefsForEvidence: true,
  maxSummaryChars: 280,
  sensitiveContentRefOnly: true,
  allowedSourceKinds: ['platform_item', 'connector_result', 'workspace_artifact'],
} as const;

export const FAILURE_CLASS_CONFIG = [
  'transport_failure',
  'timeout',
  'auth_failure',
  'credential_expired',
  'verification_required',
  'rate_limited',
  'cooldown_blocked',
  'parse_failure',
  'protocol_mismatch',
  'semantic_rejection',
  'idempotency_conflict',
  'concurrency_conflict',
  'permanent_input_error',
  'temporary_platform_failure',
  'unknown_platform_change',
  'missing_source_ref',
] as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

```ts
export type ConnectorFamily = 'social_community' | 'agent_network' | 'work_platform';

export type CapabilityIntent =
  | 'feed.read'
  | 'notification.list'
  | 'profile.read'
  | 'post.publish'
  | 'comment.reply'
  | 'message.read'
  | 'message.send'
  | 'agent.register'
  | 'agent.heartbeat'
  | 'work.discover'
  | 'task.claim'
  | 'task.update';

export type ExecutionChannel = 'api_rest' | 'a2a' | 'mcp' | 'cli' | 'skill' | 'browser';
export type EffectSemantics = 'read_only' | 'keepalive' | 'side_effect' | 'task_claim';
export type ConnectorResultStatus = 'success' | 'retryable_failure' | 'terminal_failure' | 'skipped';
export type FailureClass = typeof FAILURE_CLASS_CONFIG[number];

export interface SourceRef {
  id: string;
  kind: 'platform_item' | 'workspace_artifact' | 'decision_record' | 'user_anchor' | 'connector_result' | 'host_report' | 'fallback_artifact';
  uri: string;
  excerptHash?: string;
  observedAt?: string;
}

export interface ConnectorCapability {
  intent: CapabilityIntent;
  effectSemantics: EffectSemantics;
  supportedChannels: ExecutionChannel[];
  requiresCredential: boolean;
  requiresIdempotencyKey: boolean;
  producesEvidence: boolean;
}

export interface CredentialRequirement {
  type: 'api_key' | 'oauth_token' | 'session_cookie' | 'none';
  scopes: string[];
  verificationRequired: boolean;
}

export interface SourceRefPolicy {
  sourceKind: SourceRef['kind'];
  uriTemplate: string;
  excerptHashRequired: boolean;
  contentRefOnlyForSensitive: boolean;
}

export interface ConnectorManifest {
  platformId: string;
  displayName: string;
  family: ConnectorFamily;
  capabilities: ConnectorCapability[];
  credentialRequirements: CredentialRequirement[];
  degradedChannels: ExecutionChannel[];
  sourceRefPolicy: SourceRefPolicy;
  version: string;
}

export interface ConnectorManifestView {
  platformId: string;
  displayName: string;
  family: ConnectorFamily;
  capabilityCount: number;
  channels: ExecutionChannel[];
  degradedChannels: ExecutionChannel[];
  credentialTypes: string[];
  version: string;
}

export interface ConnectorCapabilityInventory {
  platformId: string;
  capabilities: ConnectorCapability[];
  degradedWarnings: string[];
}

export interface ConnectorCheckResult {
  platformId: string;
  status: 'available' | 'degraded' | 'unavailable' | 'pending_verification';
  credentialStatus: 'missing' | 'valid' | 'expired' | 'pending_verification' | 'not_required';
  permissionWarnings: string[];
  checkedAt: string;
}

export interface ConnectorExecutionRequest {
  requestId: string;
  traceId: string;
  platformId: string;
  capability: CapabilityIntent;
  effectSemantics: EffectSemantics;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  preferredChannel?: ExecutionChannel;
  decisionId?: string;
  timeoutMs?: number;
}

export interface ExecutionPlan {
  planId: string;
  requestId: string;
  traceId: string;
  platformId: string;
  capability: CapabilityIntent;
  effectSemantics: EffectSemantics;
  channel: ExecutionChannel;
  degraded: boolean;
  idempotencyKey?: string;
  retryPolicy: RetryPolicy;
  effectCommitId?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
  retryAfterMs?: number;
  retrySafe: boolean;
}

export interface RawConnectorAttempt {
  attemptId: string;
  planId: string;
  traceId: string;
  channel: ExecutionChannel;
  startedAt: string;
  completedAt?: string;
  success: boolean;
  statusCode?: number;
  rawPayload?: unknown;
  error?: unknown;
  retryAfterMs?: number;
  degraded: boolean;
}

export interface ConnectorFailure {
  failureClass: FailureClass;
  retryable: boolean;
  retryAfterMs?: number;
  message: string;
  rawErrorRef?: SourceRef;
}

export interface ConnectorResult {
  requestId: string;
  traceId: string;
  platformId: string;
  capability: CapabilityIntent;
  status: ConnectorResultStatus;
  channel: ExecutionChannel;
  degraded: boolean;
  sourceRefs: SourceRef[];
  evidenceCandidates: LifeEvidenceCandidate[];
  failure?: ConnectorFailure;
  effectCommitId?: string;
  retryAfterMs?: number;
  latencyMs: number;
}

export interface LifeEvidenceCandidate {
  id?: string;
  timestamp: string;
  evidenceType: 'platform_browse' | 'platform_interaction' | 'work_progress' | 'task_discovery';
  platformId: string;
  summary: string;
  sourceRefs: SourceRef[];
  sensitivity: 'public' | 'private' | 'credential' | 'sensitive';
  confidence: number;
  tags: string[];
}

export interface ConnectorAttemptAudit {
  attemptId: string;
  traceId: string;
  platformId: string;
  operation: CapabilityIntent;
  channel: ExecutionChannel;
  status: 'started' | 'succeeded' | 'failed' | 'retried' | 'rate_limited' | 'skipped';
  degraded: boolean;
  failureClass?: FailureClass;
  sourceRefs: SourceRef[];
  retryAfterMs?: number;
  idempotencyKeyHash?: string;
  createdAt: string;
}

export interface VerificationContext {
  platformId: string;
  credentialRef: string;
  challengeRef?: SourceRef;
  deadline?: string;
  attemptsRemaining: number;
}

export interface VerificationOutcome {
  platformId: string;
  status: 'verified' | 'failed' | 'pending';
  reason?: string;
  sourceRefs: SourceRef[];
}

export interface CredentialContext {
  platformId: string;
  status: 'missing' | 'valid' | 'expired' | 'pending_verification' | 'not_required';
  credentialRef?: string;
  scopes: string[];
}

export interface PolicyRecord {
  scope: string;
  cooldownUntil?: string;
  retryBudgetRemaining?: number;
  disabledChannels?: ExecutionChannel[];
}

export type IntentCommitState = 'planned' | 'dispatched' | 'externally_acknowledged' | 'committed' | 'failed' | 'reconcile_required' | 'aborted';

export interface IntentCommitRecordInput {
  decisionId?: string;
  intentId: string;
  idempotencyKey: string;
  effectClass: EffectSemantics;
}

export interface IntentCommitRecord {
  id: string;
  decisionId?: string;
  intentId: string;
  state: IntentCommitState;
  idempotencyKeyHash: string;
  outcomeRef?: string;
  createdAt: string;
}

export interface IntentCommitLookup {
  record: IntentCommitRecord;
  existing: boolean;
}

export interface LifeEvidenceWriteAck {
  evidenceId: string;
  artifactRef: SourceRef;
  indexed: boolean;
}

export interface AuditAppendAck {
  auditId: string;
  traceId: string;
  appendedAt: string;
}

export interface ConnectorManifestRegistry {
  load(platformId: string): Promise<ConnectorManifest>;
}

export interface ConnectorStatePort {
  loadCredentialContext(platformId: string): Promise<CredentialContext>;
  loadPolicyRecord(scope: string): Promise<PolicyRecord | null>;
  getOrCreateIntentCommitRecord(input: IntentCommitRecordInput): Promise<IntentCommitLookup>;
  loadIntentCommitByIdempotencyKey(idempotencyKey: string): Promise<IntentCommitRecord | null>;
  advanceIntentCommitState(id: string, state: IntentCommitState, metadata?: Record<string, unknown>): Promise<void>;
  appendLifeEvidence(candidate: LifeEvidenceCandidate): Promise<LifeEvidenceWriteAck>;
}

export interface ConnectorObservabilityPort {
  recordConnectorAttempt(attempt: ConnectorAttemptAudit): Promise<AuditAppendAck>;
}

export interface ConnectorAdapter {
  execute(plan: ExecutionPlan, request: ConnectorExecutionRequest): Promise<RawConnectorAttempt>;
  resumeVerification?(ctx: VerificationContext): Promise<VerificationOutcome>;
}

export interface ConnectorAdapterRegistry {
  get(channel: ExecutionChannel): ConnectorAdapter;
}

export interface ConnectorDeps {
  manifestRegistry: ConnectorManifestRegistry;
  state: ConnectorStatePort;
  observability: ConnectorObservabilityPort;
  adapters: ConnectorAdapterRegistry;
  clock: { now(): string };
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 describeConnector

**对应契约**: L0 §5.1 — `describeConnector(platformId)`  
**准入理由**: manifest view 是 CLI/status/blueprint 的基础读模型。

```ts
async function describeConnector(platformId: string, deps: ConnectorDeps): Promise<ConnectorManifestView> {
  const manifest = await deps.manifestRegistry.load(platformId);
  return {
    platformId: manifest.platformId,
    displayName: manifest.displayName,
    family: manifest.family,
    capabilityCount: manifest.capabilities.length,
    channels: unique(manifest.capabilities.flatMap((capability) => capability.supportedChannels)),
    degradedChannels: manifest.degradedChannels,
    credentialTypes: manifest.credentialRequirements.map((requirement) => requirement.type),
    version: manifest.version,
  };
}
```

### §3.2 checkConnector

**对应契约**: L0 §5.1 — `checkConnector(platformId)`  
**准入理由**: 连接状态是 host smoke / CLI status / recovery 的门禁。

```ts
async function checkConnector(platformId: string, deps: ConnectorDeps): Promise<ConnectorCheckResult> {
  const manifest = await deps.manifestRegistry.load(platformId);
  const credential = await deps.state.loadCredentialContext(platformId);

  if (manifest.credentialRequirements.length > 0 && !credential) {
    return makeCheckResult(platformId, 'unavailable', 'missing', ['missing_credential']);
  }

  if (credential.status === 'pending_verification') {
    return makeCheckResult(platformId, 'pending_verification', 'pending_verification', []);
  }

  if (credential.status === 'expired') {
    return makeCheckResult(platformId, 'unavailable', 'expired', ['credential_expired']);
  }

  return makeCheckResult(platformId, 'available', credential.status === 'not_required' ? 'not_required' : 'valid', []);
}
```

### §3.3 discoverCapabilities

**对应契约**: L0 §5.1 — `discoverCapabilities(platformId)`  
**准入理由**: manifest-first connector 需要显式能力库存。

```ts
async function discoverCapabilities(platformId: string, deps: ConnectorDeps): Promise<ConnectorCapabilityInventory> {
  const manifest = await deps.manifestRegistry.load(platformId);
  return {
    platformId,
    capabilities: manifest.capabilities,
    degradedWarnings: manifest.degradedChannels.map((channel) => `${channel} is degraded and must not be treated as stable API.`),
  };
}
```

### §3.4 executeCapability

**对应契约**: L0 §5.1 — `executeCapability(request)`  
**准入理由**: 多步骤副作用链：路由、policy、adapter、normalization、evidence、audit、state write。

```ts
async function executeCapability(request: ConnectorExecutionRequest, deps: ConnectorDeps): Promise<ConnectorResult> {
  const plan = await planExecutionRoute(request, deps);
  const allowedPlan = await enforceExecutionPolicy(plan, request, deps);
  const attempt = await runExecutionAdapter(allowedPlan, request, deps);
  const result = normalizeConnectorOutcome(attempt, request, allowedPlan);

  const evidence = mapLifeEvidence(result, request);
  for (const candidate of evidence) {
    await deps.state.appendLifeEvidence(candidate);
  }

  await deps.observability.recordConnectorAttempt(toConnectorAttemptAudit(attempt, result, allowedPlan));
  return { ...result, evidenceCandidates: evidence };
}
```

### §3.5 planExecutionRoute

**对应契约**: L0 §5.1 — `planExecutionRoute(request)`  
**准入理由**: 需要合并 manifest、capability、effect semantics、credential、policy、channel health。

```ts
async function planExecutionRoute(request: ConnectorExecutionRequest, deps: ConnectorDeps): Promise<ExecutionPlan> {
  const manifest = await deps.manifestRegistry.load(request.platformId);
  const capability = findCapability(manifest, request.capability);
  assertCapabilityMatchesEffect(capability, request.effectSemantics);

  const credential = await deps.state.loadCredentialContext(request.platformId);
  const channel = selectExecutionChannel(capability, request, manifest, credential);
  const degraded = manifest.degradedChannels.includes(channel);

  return {
    planId: crypto.randomUUID(),
    requestId: request.requestId,
    traceId: request.traceId,
    platformId: request.platformId,
    capability: request.capability,
    effectSemantics: request.effectSemantics,
    channel,
    degraded,
    idempotencyKey: request.idempotencyKey,
    retryPolicy: buildRetryPolicy(request, capability, degraded),
  };
}
```

### §3.6 enforceExecutionPolicy

**对应契约**: L0 §5.1 — `enforceExecutionPolicy(plan)`  
**准入理由**: side-effect safety 与 retry safety 的关键门。

```ts
async function enforceExecutionPolicy(
  plan: ExecutionPlan,
  request: ConnectorExecutionRequest,
  deps: ConnectorDeps,
): Promise<ExecutionPlan> {
  if ((plan.effectSemantics === 'side_effect' || plan.effectSemantics === 'task_claim') && !plan.idempotencyKey) {
    throw connectorPolicyFailure('permanent_input_error', 'side_effect_requires_idempotency_key');
  }

  if (plan.degraded && (plan.effectSemantics === 'side_effect' || plan.effectSemantics === 'task_claim')) {
    throw connectorPolicyFailure('semantic_rejection', 'degraded_channel_not_allowed_for_side_effect');
  }

  const policy = await deps.state.loadPolicyRecord(`connector:${plan.platformId}:${plan.capability}`);
  if (policy?.cooldownUntil && new Date(policy.cooldownUntil) > new Date(deps.clock.now())) {
    throw connectorPolicyFailure('cooldown_blocked', 'connector_policy_cooldown_active');
  }

  if (plan.idempotencyKey) {
    const lookup = await deps.state.getOrCreateIntentCommitRecord({
      decisionId: request.decisionId,
      intentId: request.requestId,
      idempotencyKey: plan.idempotencyKey,
      effectClass: plan.effectSemantics,
    });
    if (lookup.existing && lookup.record.state === 'committed') {
      return { ...plan, effectCommitId: lookup.record.id, skipAdapter: true, existingOutcomeRef: lookup.record.outcomeRef };
    }
    if (lookup.existing && (lookup.record.state === 'dispatched' || lookup.record.state === 'reconcile_required')) {
      throw connectorPolicyFailure('retry_later', 'effect_commit_requires_reconcile');
    }
    return { ...plan, effectCommitId: lookup.record.id };
  }

  return plan;
}
```

### §3.7 runExecutionAdapter

**对应契约**: L0 §5.1 — `runExecutionAdapter(plan)`  
**准入理由**: adapter 执行需要统一 timeout、retry、audit attempt。

```ts
async function runExecutionAdapter(
  plan: ExecutionPlan,
  request: ConnectorExecutionRequest,
  deps: ConnectorDeps,
): Promise<RawConnectorAttempt> {
  const adapter = deps.adapters.get(plan.channel);
  let attempt = 0;
  let lastAttempt: RawConnectorAttempt | undefined;

  while (attempt < plan.retryPolicy.maxAttempts) {
    attempt += 1;
    lastAttempt = await adapter.execute(plan, request);
    if (lastAttempt.success) return lastAttempt;

    const failure = classifyConnectorFailure(lastAttempt.error, lastAttempt);
    if (!failure.retryable || !plan.retryPolicy.retrySafe) return lastAttempt;
    await wait(computeBackoff(attempt, failure.retryAfterMs, plan.retryPolicy));
  }

  return lastAttempt!;
}
```

### §3.8 normalizeConnectorOutcome

**对应契约**: L0 §5.1 — `normalizeConnectorOutcome(attempt)`  
**准入理由**: 防止原始 DTO / 错误字符串泄漏到上层。

```ts
function normalizeConnectorOutcome(
  attempt: RawConnectorAttempt,
  request: ConnectorExecutionRequest,
  plan: ExecutionPlan,
): ConnectorResult {
  const latencyMs = diffMs(attempt.startedAt, attempt.completedAt ?? new Date().toISOString());

  if (attempt.success) {
    const sourceRefs = extractSourceRefs(attempt.rawPayload, request.platformId);
    return {
      requestId: request.requestId,
      traceId: request.traceId,
      platformId: request.platformId,
      capability: request.capability,
      status: 'success',
      channel: plan.channel,
      degraded: plan.degraded,
      sourceRefs,
      evidenceCandidates: [],
      effectCommitId: plan.effectCommitId,
      latencyMs,
    };
  }

  const failure = classifyConnectorFailure(attempt.error, attempt);
  return {
    requestId: request.requestId,
    traceId: request.traceId,
    platformId: request.platformId,
    capability: request.capability,
    status: failure.retryable ? 'retryable_failure' : 'terminal_failure',
    channel: plan.channel,
    degraded: plan.degraded,
    sourceRefs: [],
    evidenceCandidates: [],
    failure,
    effectCommitId: plan.effectCommitId,
    retryAfterMs: failure.retryAfterMs,
    latencyMs,
  };
}
```

### §3.9 mapLifeEvidence

**对应契约**: L0 §5.1 — `mapLifeEvidence(result)`  
**准入理由**: v5 source-backed closure 的核心转译点。

```ts
function mapLifeEvidence(result: ConnectorResult, request: ConnectorExecutionRequest): LifeEvidenceCandidate[] {
  if (result.status !== 'success') return [];
  if (result.sourceRefs.length === 0) {
    return [];
  }

  const evidenceType = mapCapabilityToEvidenceType(request.capability);
  if (!evidenceType) return [];

  return [{
    timestamp: new Date().toISOString(),
    evidenceType,
    platformId: result.platformId,
    summary: summarizeConnectorResult(result, SOURCE_REF_POLICY.maxSummaryChars),
    sourceRefs: result.sourceRefs,
    sensitivity: inferSensitivity(result),
    confidence: result.degraded ? 0.6 : 0.9,
    tags: [request.capability, result.channel, result.degraded ? 'degraded_channel' : 'stable_channel'],
  }];
}
```

### §3.10 recoverVerification

**对应契约**: L0 §5.1 — `recoverVerification(ctx)`  
**准入理由**: pending verification 是 connector 与 credential state 的关键恢复路径。

```ts
async function recoverVerification(ctx: VerificationContext, deps: ConnectorDeps): Promise<VerificationOutcome> {
  if (ctx.deadline && new Date(ctx.deadline) < new Date(deps.clock.now())) {
    return {
      platformId: ctx.platformId,
      status: 'failed',
      reason: 'verification_deadline_expired',
      sourceRefs: ctx.challengeRef ? [ctx.challengeRef] : [],
    };
  }

  const adapter = deps.adapters.get('api_rest');
  if (!adapter.resumeVerification) {
    return {
      platformId: ctx.platformId,
      status: 'pending',
      reason: 'verification_adapter_unavailable',
      sourceRefs: ctx.challengeRef ? [ctx.challengeRef] : [],
    };
  }

  return adapter.resumeVerification(ctx);
}
```

### §3.11 classifyConnectorFailure

**对应契约**: L0 §5.1 — `classifyConnectorFailure(error)`  
**准入理由**: 统一 failure taxonomy，避免上层被平台错误字符串绑架。

```ts
function classifyConnectorFailure(error: unknown, attempt?: RawConnectorAttempt): ConnectorFailure {
  if (isTimeout(error)) return failure('timeout', true);
  if (isRateLimit(error, attempt)) return failure('rate_limited', true, readRetryAfter(attempt));
  if (isAuthExpired(error)) return failure('credential_expired', false);
  if (isVerificationRequired(error)) return failure('verification_required', false);
  if (isParseFailure(error)) return failure('parse_failure', false);
  if (isProtocolMismatch(error)) return failure('protocol_mismatch', false);
  if (isPermanentInputError(error)) return failure('permanent_input_error', false);
  return failure('unknown_platform_change', false);
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Capability Effect Classification

**对应 L0 Mermaid**: `connector-system.md §4.4`

```ts
function classifyEffectSemantics(intent: CapabilityIntent): EffectSemantics {
  if ((EFFECT_SEMANTICS_CONFIG.readOnly as readonly string[]).includes(intent)) return 'read_only';
  if ((EFFECT_SEMANTICS_CONFIG.keepalive as readonly string[]).includes(intent)) return 'keepalive';
  if ((EFFECT_SEMANTICS_CONFIG.taskClaim as readonly string[]).includes(intent)) return 'task_claim';
  return 'side_effect';
}

function mapCapabilityToEvidenceType(intent: CapabilityIntent): LifeEvidenceCandidate['evidenceType'] | null {
  if (['feed.read', 'notification.list', 'profile.read', 'message.read'].includes(intent)) return 'platform_browse';
  if (['post.publish', 'comment.reply', 'message.send', 'agent.heartbeat'].includes(intent)) return 'platform_interaction';
  if (['work.discover'].includes(intent)) return 'task_discovery';
  if (['task.claim', 'task.update'].includes(intent)) return 'work_progress';
  return null;
}
```

### §4.2 Side-effect Retry Gate

**对应 L0 Mermaid**: `connector-system.md §4.5`

```ts
function buildRetryPolicy(
  request: ConnectorExecutionRequest,
  capability: ConnectorCapability,
  degraded: boolean,
): RetryPolicy {
  const sideEffect = request.effectSemantics === 'side_effect' || request.effectSemantics === 'task_claim';
  const retrySafe = !sideEffect || Boolean(request.idempotencyKey);

  return {
    maxAttempts: retrySafe && !degraded ? RETRY_POLICY_CONFIG.maxAttempts : 1,
    baseDelayMs: RETRY_POLICY_CONFIG.baseDelayMs,
    maxDelayMs: RETRY_POLICY_CONFIG.maxDelayMs,
    jitter: RETRY_POLICY_CONFIG.jitter,
    retrySafe,
  };
}

function computeBackoff(attempt: number, retryAfterMs: number | undefined, policy: RetryPolicy): number {
  if (retryAfterMs && RETRY_POLICY_CONFIG.respectRetryAfter) return retryAfterMs;
  const exponential = Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
  return policy.jitter ? Math.floor(Math.random() * exponential) : exponential;
}
```

### §4.3 Evidence Mapping Gate

**对应 L0 Mermaid**: `connector-system.md §4.6`

```ts
function extractSourceRefs(rawPayload: unknown, platformId: string): SourceRef[] {
  const refs = tryExtractPlatformRefs(rawPayload, platformId);
  return refs.filter((ref) => ref.uri && SOURCE_REF_POLICY.allowedSourceKinds.includes(ref.kind));
}

function inferSensitivity(result: ConnectorResult): LifeEvidenceCandidate['sensitivity'] {
  if (result.sourceRefs.some((ref) => ref.uri.includes('credential'))) return 'credential';
  if (result.capability === 'message.read' || result.capability === 'message.send') return 'private';
  return 'public';
}
```

### §4.4 Channel Selection

**对应 L0**: `connector-system.md §5.4`

```ts
function selectExecutionChannel(
  capability: ConnectorCapability,
  request: ConnectorExecutionRequest,
  manifest: ConnectorManifest,
  credential: CredentialContext,
): ExecutionChannel {
  if (request.preferredChannel && capability.supportedChannels.includes(request.preferredChannel)) {
    return request.preferredChannel;
  }

  const candidateChannels = capability.supportedChannels.filter((channel) => {
    if (manifest.degradedChannels.includes(channel) && capability.effectSemantics !== 'read_only') return false;
    if (credential.status === 'pending_verification' && channel !== 'skill' && channel !== 'browser') return false;
    return true;
  });

  const priority = request.effectSemantics === 'read_only'
    ? CHANNEL_PRIORITY_CONFIG.readOnly
    : request.effectSemantics === 'task_claim'
      ? CHANNEL_PRIORITY_CONFIG.taskClaim
      : CHANNEL_PRIORITY_CONFIG.sideEffect;

  return priority.find((channel) => candidateChannels.includes(channel)) ?? candidateChannels[0];
}
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| connector 成功但无 sourceRefs | Quiet / outreach 没事实来源 | 不写 evidence，返回 `missing_source_ref` audit warning |
| `message.send` 被误认为 OpenClaw owner delivery | 主动联系闭环被伪造 | 标注为 platform interaction evidence，不作为 delivery success |
| degraded channel 执行 side effect | 重复发帖/回复/claim | 默认禁止，除非 explicit policy + idempotency + human approval |
| 无 idempotency key 自动 retry | 重复副作用 | policy layer 阻断 |
| adapter、connector、control-plane 多层 retry | retry storm | retry 只在 connector policy 一层执行 |
| 平台 DTO 透传 | 上层被平台细节污染 | outcome normalizer 强制收敛 |
| credential 状态双写 | state 漂移 | canonical credential 只在 state-system |
| verification required 被当 failure 终结 | 用户无法恢复 | 转入 pending verification / recovery flow |
| browser fallback 坐标或 UI 变化 | 脆弱执行 | 仅 degraded + explicit fallback，不作为主路径 |
| 私信/敏感正文进入 evidence | 隐私泄漏 | content_ref / excerptHash / sensitivity |

### §5.1 错误示例：平台 DTO 直传上层

```ts
// 错误：control-plane 会开始依赖平台字段
// return rawMoltbookPost;

// 正确：connector 输出统一结果和 source refs
// return { status, sourceRefs, evidenceCandidates, failure, channel };
```

### §5.2 错误示例：把 degraded fallback 当稳定通道

```ts
// 错误：REST 失败就自动浏览器发帖
// if (restFailed) await browser.post(payload);

// 正确：side effect 默认不降级到 browser
// if (plan.degraded && sideEffect) throw semantic_rejection;
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeSourceRef(overrides: Partial<SourceRef> = {}): SourceRef {
  return {
    id: 'src-test',
    kind: 'platform_item',
    uri: 'moltbook://post/123',
    excerptHash: 'hash-test',
    ...overrides,
  };
}

export function makeManifest(overrides: Partial<ConnectorManifest> = {}): ConnectorManifest {
  return {
    platformId: 'moltbook',
    displayName: 'Moltbook',
    family: 'social_community',
    capabilities: [
      {
        intent: 'feed.read',
        effectSemantics: 'read_only',
        supportedChannels: ['api_rest', 'cli'],
        requiresCredential: true,
        requiresIdempotencyKey: false,
        producesEvidence: true,
      },
      {
        intent: 'post.publish',
        effectSemantics: 'side_effect',
        supportedChannels: ['api_rest'],
        requiresCredential: true,
        requiresIdempotencyKey: true,
        producesEvidence: true,
      },
    ],
    credentialRequirements: [{ type: 'oauth_token', scopes: ['read', 'write'], verificationRequired: false }],
    degradedChannels: ['cli', 'skill', 'browser'],
    sourceRefPolicy: {
      sourceKind: 'platform_item',
      uriTemplate: 'moltbook://{resourceType}/{id}',
      excerptHashRequired: true,
      contentRefOnlyForSensitive: true,
    },
    version: 'v5-test',
    ...overrides,
  };
}

export function makeExecutionRequest(overrides: Partial<ConnectorExecutionRequest> = {}): ConnectorExecutionRequest {
  return {
    requestId: 'connector-request-test',
    traceId: 'trace-test',
    platformId: 'moltbook',
    capability: 'feed.read',
    effectSemantics: 'read_only',
    payload: {},
    decisionId: 'decision-test',
    ...overrides,
  };
}

export function makeConnectorResult(overrides: Partial<ConnectorResult> = {}): ConnectorResult {
  return {
    requestId: 'connector-request-test',
    traceId: 'trace-test',
    platformId: 'moltbook',
    capability: 'feed.read',
    status: 'success',
    channel: 'api_rest',
    degraded: false,
    sourceRefs: [makeSourceRef()],
    evidenceCandidates: [],
    latencyMs: 42,
    ...overrides,
  };
}

export function makeLifeEvidenceCandidate(overrides: Partial<LifeEvidenceCandidate> = {}): LifeEvidenceCandidate {
  return {
    timestamp: new Date().toISOString(),
    evidenceType: 'platform_browse',
    platformId: 'moltbook',
    summary: 'Read a Moltbook post relevant to the current exploration window.',
    sourceRefs: [makeSourceRef()],
    sensitivity: 'public',
    confidence: 0.9,
    tags: ['feed.read', 'api_rest'],
    ...overrides,
  };
}
```

### §6.1 Contract Fixtures

| Fixture | 用途 |
| --- | --- |
| `makeManifest()` | manifest validation / capability discovery |
| `makeExecutionRequest({ capability: "post.publish", effectSemantics: "side_effect" })` | side-effect policy gate |
| `makeConnectorResult({ degraded: true })` | degraded channel audit |
| `makeLifeEvidenceCandidate({ sourceRefs: [] })` | state contract rejection |
| `makeConnectorResult({ capability: "message.send" })` | platform message vs OpenClaw delivery 区分 |
