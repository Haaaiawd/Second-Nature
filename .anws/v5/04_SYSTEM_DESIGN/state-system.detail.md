# State System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`state-system.md`](./state-system.md)  
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。  
> **孤岛检查**: 本文件各节均须在 L0 有对应超链接入口，禁止孤岛内容。

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §6 / §7 / §12 |
| §2 | [完整数据结构](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 / §12 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

```ts
export const STATE_STORAGE_CONFIG = {
  sqlitePath: './data/second-nature-state.db',
  sqliteJournalMode: 'WAL' as const,
  sqliteBusyTimeoutMs: 5_000,
  sqliteWalAutocheckpointPages: 1_000,
  startupRepairEnabled: true,
  backupMode: 'sqlite_backup_api_or_vacuum_into' as const,
} as const;

export const STATE_ARTIFACT_CONFIG = {
  workspaceRoot: './workspace',
  evidenceDir: 'memory/evidence',
  journalsDir: 'memory/journals',
  quietDir: 'memory/quiet',
  curatedDir: 'memory/curated',
  proposalsDir: 'memory/proposals',
  fallbackDir: 'memory/fallbacks',
  snapshotCacheDir: 'memory/.snapshots',
} as const;

export const LIFE_EVIDENCE_CONFIG = {
  requireSourceRefs: true,
  maxSourceRefsPerEvidence: 20,
  maxSummaryChars: 1_000,
  rejectCredentialSensitivityInPlaintext: true,
  appendOnlyRawEvidence: true,
} as const;

export const SNAPSHOT_CONFIG = {
  defaultLookbackHours: 24,
  maxEvidenceItemsPerSnapshot: 80,
  maxResolvedEvidenceRefs: 24,
  staleSnapshotMinutes: 30,
  insufficientInterestConfidence: 0.35,
} as const;

export const QUIET_ARTIFACT_CONFIG = {
  minimumCoverageRatio: 1.0,
  maxUnsupportedClaimsForNormalPass: 0,
  allowEmptyEvidenceArtifact: true,
  maxCuratedCandidatesPerQuietRun: 3,
  maxAnchorProposalsPerQuietRun: 1,
  unsupportedClaimAction: 'reject_or_downgrade' as const,
} as const;

export const GOVERNANCE_CONFIG = {
  anchorAssets: ['SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md', 'MEMORY.md'],
  allowDirectAnchorWrites: false,
  requireBeforeHashForApply: true,
  requireSupportingSources: true,
  anchorProposalConfidenceThreshold: 0.8,
} as const;

export const FALLBACK_CONFIG = {
  forcedStatus: 'not_sent' as const,
  allowedReasons: ['target_none', 'channel_missing', 'host_unsupported', 'delivery_failed'] as const,
  maxCandidateMessageChars: 800,
} as const;

export const REPAIR_CONFIG = {
  orphanRepairBatchSize: 100,
  markOrphanInsteadOfDelete: true,
  rebuildSnapshotCacheOnRepair: true,
} as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

```ts
export type LifeEvidenceType =
  | 'platform_browse'
  | 'platform_interaction'
  | 'work_progress'
  | 'task_discovery'
  | 'user_interaction'
  | 'quiet_reflection'
  | 'delivery_fallback';

export type Sensitivity = 'public' | 'private' | 'credential' | 'sensitive';

export interface SourceRef {
  id: string;
  kind: 'platform_item' | 'workspace_artifact' | 'decision_record' | 'user_anchor' | 'connector_result' | 'host_report' | 'fallback_artifact';
  uri: string;
  excerptHash?: string;
  observedAt?: string;
}

export interface LifeEvidenceCandidate {
  id?: string;
  timestamp: string;
  evidenceType: LifeEvidenceType;
  platformId?: string;
  summary: string;
  rawContentRef?: string;
  sourceRefs: SourceRef[];
  sensitivity: Sensitivity;
  confidence?: number;
  tags?: string[];
  producer: 'connector-system' | 'control-plane-system' | 'observability-system' | 'state-system';
}

export interface LifeEvidence {
  id: string;
  timestamp: string;
  evidenceType: LifeEvidenceType;
  platformId?: string;
  summary: string;
  rawContentRef?: string;
  sourceRefs: SourceRef[];
  sensitivity: Sensitivity;
  confidence: number;
  tags: string[];
  producer: string;
  artifactRef: SourceRef;
}

export interface SourceCoverage {
  requiredClaims: number;
  coveredClaims: number;
  coverageRatio: number;
  missingClaimIds: string[];
  sourceRefs: SourceRef[];
}

export interface LifeEvidenceQuery {
  windowStart?: string;
  windowEnd?: string;
  evidenceTypes?: LifeEvidenceType[];
  platformIds?: string[];
  tags?: string[];
  minConfidence?: number;
  limit?: number;
}

export interface LifeEvidenceSnapshot {
  snapshotId: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  evidenceRefs: SourceRef[];
  platformEvents: LifeEvidence[];
  workEvents: LifeEvidence[];
  userInteractionEvents: LifeEvidence[];
  quietArtifacts: SourceRef[];
  coverage: SourceCoverage;
  empty: boolean;
}

export interface ContinuitySnapshot {
  snapshotId: string;
  generatedAt: string;
  lastHeartbeatAt?: string;
  recentDecisionRefs: SourceRef[];
  openObligations: SourceRef[];
  quietDebt: {
    hasUnprocessedEvidence: boolean;
    oldestUnprocessedEvidenceAt?: string;
    pendingCount: number;
  };
  fallbackRefs: SourceRef[];
}

export interface UserInterestSignal {
  id: string;
  topic: string;
  affinity: 'positive' | 'negative' | 'watching' | 'unknown';
  reason: string;
  sourceRefs: SourceRef[];
  confidence: number;
  updatedAt: string;
}

export interface UserInterestSnapshot {
  snapshotId: string;
  generatedAt: string;
  signals: UserInterestSignal[];
  sourceRefs: SourceRef[];
  confidence: number;
  staleness: 'fresh' | 'stale' | 'insufficient';
  missingReasons?: string[];
}

export interface RhythmPolicySnapshot {
  snapshotId: string;
  generatedAt: string;
  quietEnabled: boolean;
  socialDailyLimit: number;
  outreachDailyBudget: number;
  updatedAt: string;
}

export interface QuietClaim {
  id: string;
  text: string;
  sourceRefs: SourceRef[];
  claimType: 'fact' | 'emotion' | 'interpretation' | 'next_step';
}

export interface QuietArtifactWrite {
  day: string;
  kind: 'daily_report' | 'narrative_reflection' | 'curated_memory_candidate' | 'empty_state';
  title: string;
  body: string;
  claims: QuietClaim[];
  sourceRefs: SourceRef[];
  memoryCandidateRefs?: SourceRef[];
}

export interface QuietArtifact {
  id: string;
  kind: QuietArtifactWrite['kind'];
  day: string;
  sourceCoverage: SourceCoverage;
  artifactRef: SourceRef;
  memoryCandidateRefs: SourceRef[];
  createdAt: string;
}

export interface OperatorFallbackWrite {
  reason: 'target_none' | 'channel_missing' | 'host_unsupported' | 'delivery_failed';
  decisionId: string;
  sourceRefs: SourceRef[];
  candidateMessage?: string;
  nextStep: string;
}

export interface OperatorFallbackArtifact {
  fallbackRef: string;
  createdAt: string;
  reason: OperatorFallbackWrite['reason'];
  status: 'not_sent';
  decisionId: string;
  sourceRefs: SourceRef[];
  candidateMessage?: string;
  nextStep: string;
}

export interface OperatorFallbackView {
  fallbackRef: string;
  reason: OperatorFallbackArtifact['reason'];
  status: 'not_sent';
  sourceRefs: SourceRef[];
  candidateMessage?: string;
  nextStep: string;
}

export interface DeliveryAttemptWrite {
  attemptId: string;
  decisionId: string;
  target?: 'none' | 'last' | 'explicit';
  channel?: string;
  status: 'sent' | 'failed' | 'dropped_by_host_policy';
  messageId?: string;
  hostProofRef?: SourceRef;
  errorClass?: string;
  fallbackRef?: string;
}

export interface DeliveryAttemptRecord extends DeliveryAttemptWrite {
  createdAt: string;
}

export interface AnchorWriteProposal {
  id: string;
  targetAssetId: string;
  beforeHash?: string;
  afterHash?: string;
  status: 'draft' | 'requires_review' | 'approved' | 'rejected' | 'applied' | 'conflicted';
  proposedDiff: string;
  reason: string;
  supportingSources: SourceRef[];
  confidence: number;
  policyBasis: string[];
  riskFlags: string[];
  createdAt: string;
}

export interface CredentialContextWrite {
  platformId: string;
  credentialType: 'api_key' | 'oauth_token' | 'node_secret' | 'verification_code';
  encryptedValue: string;
  status: 'missing' | 'pending_verification' | 'active' | 'expired' | 'revoked' | 'failed';
  verificationCode?: string;
  challengeText?: string;
  expiresAt?: string;
  attemptsRemaining?: number;
}

export interface PolicyWriteInput {
  scope: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

export type IntentCommitState = 'planned' | 'dispatched' | 'externally_acknowledged' | 'committed' | 'failed' | 'reconcile_required' | 'aborted';

export interface IntentCommitRecordInput {
  intentId: string;
  decisionId: string;
  idempotencyKey: string;
  checkpointId?: string;
  state: IntentCommitState;
}

export interface IntentCommitOutcome {
  traceId: string;
  outcomeRef: string;
}

export interface IntentCommitRecord {
  id: string;
  intentId: string;
  decisionId: string;
  idempotencyKeyHash: string;
  checkpointId?: string;
  state: IntentCommitState;
  outcomeRef?: string;
  metadata?: Record<string, unknown>;
  updatedAt: string;
}

export interface ProvenanceTrace {
  ref: string;
  upstreamSources: SourceRef[];
  derivedArtifacts: SourceRef[];
  proposalIds: string[];
  applyIds: string[];
  missingRefs: SourceRef[];
}

export interface LifeEvidenceWriteAck {
  evidenceId: string;
  artifactRef: SourceRef;
}

export interface QuietArtifactAck {
  artifactId: string;
  artifactRef: SourceRef;
  sourceCoverage: SourceCoverage;
}

export interface OperatorFallbackAck {
  fallbackRef: string;
  status: 'not_sent';
}

export interface DeliveryAttemptAck {
  attemptId: string;
  status: DeliveryAttemptRecord['status'];
  fallbackRef?: string;
}

export interface IntentCommitLookup {
  record: IntentCommitRecord;
  existing: boolean;
}

export interface AnchorProposalAck {
  proposalId: string;
  status: AnchorWriteProposal['status'];
}

export interface AnchorApplyAck {
  applied: true;
  targetAssetId: string;
  afterHash: string;
}

export interface ResolvedEvidenceBundle {
  resolved: LifeEvidence[];
  missing: SourceRef[];
}

export interface UserInterestSnapshotInput {
  forceRefresh?: boolean;
  includeStale?: boolean;
}

export interface RepairSummary {
  repaired: string[];
  orphaned: string[];
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 appendLifeEvidence

**对应契约**: L0 §5.1 — `appendLifeEvidence(candidate)`  
**准入理由**: v5 P0 写入路径，含 source 校验、脱敏、文件/索引双写和 provenance。

```ts
async function appendLifeEvidence(candidate: LifeEvidenceCandidate): Promise<LifeEvidenceWriteAck> {
  if (LIFE_EVIDENCE_CONFIG.requireSourceRefs && candidate.sourceRefs.length === 0) {
    throw new Error('life_evidence_requires_source_refs');
  }

  if (candidate.sensitivity === 'credential') {
    throw new Error('credential_content_must_not_enter_life_evidence');
  }

  const evidence: LifeEvidence = {
    ...candidate,
    id: candidate.id ?? crypto.randomUUID(),
    summary: redactSummary(candidate.summary, candidate.sensitivity),
    confidence: candidate.confidence ?? 1,
    tags: candidate.tags ?? [],
    artifactRef: buildEvidenceArtifactRef(candidate.timestamp),
  };

  const artifactPath = resolveEvidenceArtifactPath(evidence.timestamp);
  await fileStore.appendJsonLine(artifactPath, evidence);

  await indexStore.transaction(async (tx) => {
    await tx.upsertEvidenceIndex(evidence);
    await tx.linkProvenance(evidence.artifactRef, evidence.sourceRefs, 'derived_from');
    await tx.invalidateSnapshotCaches(['life_evidence', 'continuity', 'user_interest']);
  });

  return { evidenceId: evidence.id, artifactRef: evidence.artifactRef };
}
```

### §3.2 loadLifeEvidenceSnapshot

**对应契约**: L0 §5.1 — `loadLifeEvidenceSnapshot(query)`  
**准入理由**: heartbeat 热路径，需要 bounded query 和空 evidence 安全返回。

```ts
async function loadLifeEvidenceSnapshot(query: LifeEvidenceQuery): Promise<LifeEvidenceSnapshot> {
  const normalized = normalizeLifeEvidenceQuery(query);
  const cacheKey = buildSnapshotCacheKey('life_evidence', normalized);
  const cached = await snapshotCache.loadFresh<LifeEvidenceSnapshot>(cacheKey, SNAPSHOT_CONFIG.staleSnapshotMinutes);
  if (cached) return cached;

  const items = await indexStore.queryLifeEvidence({
    ...normalized,
    limit: normalized.limit ?? SNAPSHOT_CONFIG.maxEvidenceItemsPerSnapshot,
  });

  const snapshot: LifeEvidenceSnapshot = {
    snapshotId: crypto.randomUUID(),
    generatedAt: nowIso(),
    windowStart: normalized.windowStart,
    windowEnd: normalized.windowEnd,
    evidenceRefs: items.map((item) => item.artifactRef),
    platformEvents: items.filter((item) => item.evidenceType.startsWith('platform_')),
    workEvents: items.filter((item) => item.evidenceType === 'work_progress' || item.evidenceType === 'task_discovery'),
    userInteractionEvents: items.filter((item) => item.evidenceType === 'user_interaction'),
    quietArtifacts: await indexStore.queryQuietArtifactRefs(normalized),
    coverage: calculateSnapshotCoverage(items),
    empty: items.length === 0,
  };

  await snapshotCache.write(cacheKey, snapshot);
  return snapshot;
}
```

### §3.3 loadContinuitySnapshot

**对应契约**: L0 §5.1 — `loadContinuitySnapshot()`  
**准入理由**: control-plane 每轮 heartbeat 依赖的基本状态快照。

```ts
async function loadContinuitySnapshot(): Promise<ContinuitySnapshot> {
  const recentDecisionRefs = await indexStore.queryRecentDecisionRefs({ limit: 20 });
  const openObligations = await indexStore.queryOpenObligationRefs();
  const quietDebt = await indexStore.calculateQuietDebt();
  const fallbackRefs = await indexStore.queryRecentFallbackRefs({ status: 'not_sent', limit: 10 });

  return {
    snapshotId: crypto.randomUUID(),
    generatedAt: nowIso(),
    lastHeartbeatAt: await indexStore.loadLastHeartbeatAt(),
    recentDecisionRefs,
    openObligations,
    quietDebt,
    fallbackRefs,
  };
}
```

### §3.4 loadUserInterestSnapshot

**对应契约**: L0 §5.1 — `loadUserInterestSnapshot()`  
**准入理由**: 不能编造用户偏好；缺失资料必须降级。

```ts
async function loadUserInterestSnapshot(input: UserInterestSnapshotInput = {}): Promise<UserInterestSnapshot> {
  const anchorRefs = await workspaceStore.loadAvailableAnchorRefs(['USER.md', 'MEMORY.md']);
  const curatedSignals = await indexStore.queryCuratedUserInterestSignals({ limit: 30 });
  const recentInteractionEvidence = await indexStore.queryLifeEvidence({
    evidenceTypes: ['user_interaction'],
    limit: 30,
  });

  const signals = deriveInterestSignals({
    anchorRefs,
    curatedSignals,
    recentInteractionEvidence,
  }).filter((signal) => signal.sourceRefs.length > 0);

  if (signals.length === 0) {
    return {
      snapshotId: crypto.randomUUID(),
      generatedAt: nowIso(),
      signals: [],
      sourceRefs: [],
      confidence: 0,
      staleness: 'insufficient',
      missingReasons: ['missing_user_interest_model'],
    };
  }

  const confidence = average(signals.map((signal) => signal.confidence));
  return {
    snapshotId: crypto.randomUUID(),
    generatedAt: nowIso(),
    signals,
    sourceRefs: uniqueSourceRefs(signals.flatMap((signal) => signal.sourceRefs)),
    confidence,
    staleness: confidence < SNAPSHOT_CONFIG.insufficientInterestConfidence ? 'insufficient' : resolveInterestStaleness(signals),
  };
}
```

### §3.5 writeQuietArtifact

**对应契约**: L0 §5.1 — `writeQuietArtifact(input)`  
**准入理由**: Quiet 是 v5 source-backed closure 的核心路径，必须防虚构。

```ts
async function writeQuietArtifact(input: QuietArtifactWrite): Promise<QuietArtifactAck> {
  if (input.sourceRefs.length === 0 && input.kind !== 'empty_state') {
    throw new Error('quiet_artifact_requires_source_refs');
  }

  const coverage = calculateSourceCoverage(input.claims);
  if (input.kind !== 'empty_state' && coverage.coverageRatio < QUIET_ARTIFACT_CONFIG.minimumCoverageRatio) {
    throw new Error('quiet_artifact_source_coverage_too_low');
  }

  const artifactId = crypto.randomUUID();
  const artifactPath = resolveQuietArtifactPath(input.day, input.kind, artifactId);
  const artifact = {
    ...input,
    id: artifactId,
    sourceCoverage: coverage,
    createdAt: nowIso(),
  };

  await fileStore.writeAtomic(artifactPath, renderQuietArtifact(artifact));
  const artifactRef = buildWorkspaceArtifactRef(artifactPath);

  await indexStore.transaction(async (tx) => {
    await tx.upsertQuietArtifact({ ...artifact, artifactRef });
    await tx.linkProvenance(artifactRef, input.sourceRefs, 'derived_from');
    await tx.markEvidenceProcessedByQuiet(input.sourceRefs, artifactRef);
  });

  return { artifactId, artifactRef, sourceCoverage: coverage };
}
```

### §3.6 writeOperatorFallback

**对应契约**: L0 §5.1 — `writeOperatorFallback(fallback)`  
**准入理由**: delivery unavailable 兜底必须可见，且不能被误判 sent。

```ts
async function writeOperatorFallback(fallback: OperatorFallbackWrite): Promise<OperatorFallbackAck> {
  if (!FALLBACK_CONFIG.allowedReasons.includes(fallback.reason)) {
    throw new Error('invalid_fallback_reason');
  }
  if (fallback.sourceRefs.length === 0) {
    throw new Error('fallback_requires_source_refs');
  }

  const artifact: OperatorFallbackArtifact = {
    fallbackRef: `fallback:${crypto.randomUUID()}`,
    createdAt: nowIso(),
    status: FALLBACK_CONFIG.forcedStatus,
    reason: fallback.reason,
    decisionId: fallback.decisionId,
    sourceRefs: fallback.sourceRefs,
    candidateMessage: truncate(fallback.candidateMessage, FALLBACK_CONFIG.maxCandidateMessageChars),
    nextStep: fallback.nextStep,
  };

  const path = resolveFallbackArtifactPath(artifact.fallbackRef);
  await fileStore.writeAtomic(path, renderOperatorFallback(artifact));
  await indexStore.upsertFallbackArtifact(artifact, buildWorkspaceArtifactRef(path));
  return { fallbackRef: artifact.fallbackRef, status: artifact.status };
}
```

```ts
async function writeDeliveryAttempt(attempt: DeliveryAttemptWrite): Promise<DeliveryAttemptAck> {
  if (attempt.status === 'sent' && !attempt.messageId && !attempt.hostProofRef) {
    throw new Error('sent_delivery_attempt_requires_host_proof');
  }
  if ((attempt.status === 'failed' || attempt.status === 'dropped_by_host_policy') && !attempt.errorClass && !attempt.fallbackRef) {
    throw new Error('failed_delivery_attempt_requires_error_or_fallback');
  }

  const record: DeliveryAttemptRecord = {
    ...attempt,
    createdAt: new Date().toISOString(),
  };

  await indexStore.transaction(async (tx) => {
    await tx.insertDeliveryAttempt(record);
    if (record.fallbackRef) await tx.linkDeliveryAttemptToFallback(record.attemptId, record.fallbackRef);
  });

  return { attemptId: record.attemptId, status: record.status, fallbackRef: record.fallbackRef };
}
```

### §3.7 loadFallbackView

**对应契约**: L0 §5.1 — `loadFallbackView(ref)`  
**准入理由**: CLI/operator read model 必须保留 not_sent truth。

```ts
async function loadFallbackView(ref: string): Promise<OperatorFallbackView> {
  const fallback = await indexStore.loadFallbackArtifact(ref);
  if (!fallback) throw new Error('fallback_not_found');

  return {
    fallbackRef: fallback.fallbackRef,
    reason: fallback.reason,
    status: 'not_sent',
    sourceRefs: fallback.sourceRefs,
    candidateMessage: fallback.candidateMessage,
    nextStep: fallback.nextStep,
  };
}
```

### §3.8 loadEvidenceRefs

**对应契约**: L0 §5.1 — `loadEvidenceRefs(refs)`  
**准入理由**: guidance 需要 source-backed context，但不能拿到敏感原文。

```ts
async function loadEvidenceRefs(refs: SourceRef[]): Promise<ResolvedEvidenceBundle> {
  const resolved = [];
  const missing = [];

  for (const ref of refs.slice(0, SNAPSHOT_CONFIG.maxResolvedEvidenceRefs)) {
    const evidence = await indexStore.resolveEvidenceRef(ref);
    if (!evidence) {
      missing.push(ref);
      continue;
    }
    resolved.push(redactEvidenceForConsumer(evidence));
  }

  return { resolved, missing };
}
```

### §3.9 proposeAnchorWrite

**对应契约**: L0 §5.1 — `proposeAnchorWrite(proposal)`  
**准入理由**: Anchor Memory 只能受治理演进。

```ts
async function proposeAnchorWrite(proposal: AnchorWriteProposal): Promise<AnchorProposalAck> {
  if (!GOVERNANCE_CONFIG.anchorAssets.includes(resolveAssetName(proposal.targetAssetId))) {
    throw new Error('target_is_not_anchor_asset');
  }
  if (GOVERNANCE_CONFIG.requireSupportingSources && proposal.supportingSources.length === 0) {
    throw new Error('anchor_proposal_requires_supporting_sources');
  }
  if (proposal.confidence < GOVERNANCE_CONFIG.anchorProposalConfidenceThreshold) {
    throw new Error('anchor_proposal_confidence_too_low');
  }

  const target = await workspaceStore.loadAnchorAsset(proposal.targetAssetId);
  const beforeHash = await fileStore.hashFile(target.path);
  const nextProposal = { ...proposal, beforeHash, status: 'requires_review' as const };
  const proposalPath = resolveAnchorProposalPath(nextProposal.id);

  await fileStore.writeAtomic(proposalPath, renderAnchorProposal(nextProposal));
  await indexStore.registerAnchorProposal(nextProposal, buildWorkspaceArtifactRef(proposalPath));
  return { proposalId: nextProposal.id, status: nextProposal.status };
}
```

### §3.10 applyGovernedAnchorWrite

**对应契约**: L0 §5.1 — `applyGovernedAnchorWrite(proposalId)`  
**准入理由**: 核心人格资产更新必须原子、可冲突检测、可审计。

```ts
async function applyGovernedAnchorWrite(proposalId: string): Promise<AnchorApplyAck> {
  const proposal = await indexStore.loadAnchorProposal(proposalId);
  if (!proposal) throw new Error('proposal_not_found');
  if (proposal.status !== 'approved') throw new Error('proposal_not_approved');

  const target = await workspaceStore.loadAnchorAsset(proposal.targetAssetId);
  const currentHash = await fileStore.hashFile(target.path);
  if (proposal.beforeHash && proposal.beforeHash !== currentHash) {
    await indexStore.markAnchorProposalConflicted(proposalId, currentHash);
    throw new Error('anchor_proposal_conflict');
  }

  const beforeContent = await fileStore.readText(target.path);
  const afterContent = applyUnifiedDiff(beforeContent, proposal.proposedDiff);
  await fileStore.writeAtomic(target.path, afterContent);
  const afterHash = await fileStore.hashFile(target.path);

  await indexStore.transaction(async (tx) => {
    await tx.bumpAnchorAssetVersion(proposal.targetAssetId, afterHash);
    await tx.markAnchorProposalApplied(proposalId, afterHash);
    await tx.recordAnchorApply({
      proposalId,
      targetAssetId: proposal.targetAssetId,
      beforeHash: currentHash,
      afterHash,
      supportingSources: proposal.supportingSources,
    });
  });

  return { applied: true, targetAssetId: proposal.targetAssetId, afterHash };
}
```

### §3.11 saveCredentialContext

**对应契约**: L0 §5.1 — `saveCredentialContext(input)`  
**准入理由**: connector 不保存 canonical credential，state 负责恢复与加密边界。

```ts
async function saveCredentialContext(input: CredentialContextWrite): Promise<void> {
  const encryptedValue = ensureEncryptedPayload(input.encryptedValue);
  await credentialStore.upsert({
    ...input,
    encryptedValue,
    updatedAt: nowIso(),
  });
}
```

### §3.12 getOrCreateIntentCommitRecord

**对应契约**: L0 §5.1 — `getOrCreateIntentCommitRecord(input)`  
**准入理由**: 外部副作用恢复链需要 canonical ledger。

```ts
async function getOrCreateIntentCommitRecord(input: IntentCommitRecordInput): Promise<IntentCommitLookup> {
  return commitStore.transaction(async (tx) => {
    const idempotencyKeyHash = hashIdempotencyKey(input.idempotencyKey);
    const existing = await tx.loadIntentCommitByIdempotencyKeyHash(idempotencyKeyHash);
    if (existing) return { record: existing, existing: true };

    const record: IntentCommitRecord = {
      id: crypto.randomUUID(),
      ...input,
      idempotencyKeyHash,
      updatedAt: nowIso(),
    };
    await tx.insertIntentCommit(record);
    return { record, existing: false };
  });
}
```

### §3.13 repairStateIndexes

**对应契约**: L0 §5.1 — `repairStateIndexes()`  
**准入理由**: filesystem + SQLite 双平面必须具备补偿恢复。

```ts
async function repairStateIndexes(input: { startupGate?: boolean } = {}): Promise<RepairSummary> {
  const artifacts = await workspaceStore.scanKnownStateArtifacts();
  const indexed = await indexStore.listArtifactIndexes();
  const repaired = [];
  const orphaned = [];

  for (const artifact of artifacts) {
    const currentHash = await fileStore.hashFile(artifact.path);
    const row = indexed.find((item) => item.path === artifact.path);
    if (!row) {
      await indexStore.registerScannedArtifact({ ...artifact, hash: currentHash });
      repaired.push(artifact.path);
      continue;
    }
    if (row.hash !== currentHash) {
      await indexStore.updateArtifactHash(row.id, currentHash);
      repaired.push(artifact.path);
    }
  }

  for (const row of indexed) {
    if (!artifacts.find((artifact) => artifact.path === row.path)) {
      await indexStore.markArtifactOrphan(row.id);
      orphaned.push(row.path);
    }
  }

  if (REPAIR_CONFIG.rebuildSnapshotCacheOnRepair) {
    await snapshotCache.clearAll();
  }

  const summary = { repaired, orphaned };
  if (input.startupGate && orphaned.length > 0) {
    await indexStore.markReadModelsRepairRequired(summary);
  }
  return summary;
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Evidence 写入路径选择

**对应 L0 Mermaid**: `state-system.md §4.4`

```ts
function selectEvidenceWritePath(candidate: LifeEvidenceCandidate): EvidenceWriteDecision {
  if (candidate.sourceRefs.length === 0) return { path: 'reject', reason: 'missing_source_refs' };
  if (candidate.sensitivity === 'credential') return { path: 'reject', reason: 'credential_plaintext_forbidden' };
  if (candidate.evidenceType === 'delivery_fallback') return { path: 'operator_fallback' };
  if (candidate.evidenceType === 'quiet_reflection') return { path: 'quiet_artifact_or_evidence' };
  return { path: 'append_life_evidence' };
}
```

### §4.2 Quiet Artifact admission

**对应 L0 Mermaid**: `state-system.md §4.5`

```ts
function decideQuietArtifactAdmission(input: QuietArtifactWrite): QuietAdmissionDecision {
  if (input.sourceRefs.length === 0) {
    return input.kind === 'empty_state'
      ? { decision: 'allow_empty_state' }
      : { decision: 'reject', reason: 'quiet_requires_evidence' };
  }

  const coverage = calculateSourceCoverage(input.claims);
  if (coverage.coverageRatio < QUIET_ARTIFACT_CONFIG.minimumCoverageRatio) {
    return { decision: 'reject_or_downgrade', reason: 'source_coverage_too_low', coverage };
  }

  return { decision: 'allow', coverage };
}
```

### §4.3 User Interest Snapshot staleness

**对应 L0**: §5.1 `loadUserInterestSnapshot()` / §6.1 `UserInterestSnapshot`

```ts
function resolveInterestStaleness(signals: UserInterestSignal[]): UserInterestSnapshot['staleness'] {
  if (signals.length === 0) return 'insufficient';
  const newest = maxIso(signals.map((signal) => signal.updatedAt));
  if (hoursBetween(newest, nowIso()) > 24 * 30) return 'stale';
  const confidence = average(signals.map((signal) => signal.confidence));
  return confidence < SNAPSHOT_CONFIG.insufficientInterestConfidence ? 'insufficient' : 'fresh';
}
```

### §4.4 Anchor apply decision

**对应 L0**: §5.1 `applyGovernedAnchorWrite()`

```ts
function decideAnchorApply(proposal: AnchorWriteProposal, currentHash: string): AnchorApplyDecision {
  if (proposal.status !== 'approved') return { decision: 'deny', reason: 'proposal_not_approved' };
  if (proposal.beforeHash && proposal.beforeHash !== currentHash) return { decision: 'conflict', reason: 'before_hash_mismatch' };
  if (proposal.supportingSources.length === 0) return { decision: 'deny', reason: 'missing_supporting_sources' };
  return { decision: 'allow' };
}
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| connector 返回内容没有 source refs | 后续 outreach / Quiet 编故事 | 拒绝 `appendLifeEvidence`，要求 producer 补 source |
| `target: "none"` 触发 fallback | 被误报为已联系用户 | `OperatorFallbackArtifact.status` 固定 `not_sent` |
| `UserInterestSnapshot` 资料不足 | 随机猜用户喜好 | 返回 `insufficient` + `missing_user_interest_model` |
| Quiet 当天无 evidence | 虚构“今天我看到了” | 写 `empty_state` / maintenance artifact |
| Quiet claim 没有 source | 叙事漂亮但失真 | source coverage 低于阈值则 reject/downgrade |
| sensitive 原文进入 report | 隐私泄露 | 保存 redacted summary 或 rawContentRef |
| SQLite index 写失败但 artifact 已落盘 | 双平面不一致 | startup repair 是 read model 对外服务前的必选门禁；无法修复时标记 `repair_required` |
| artifact 被用户手动删除 | provenance 断链 | 标记 orphan，不自动删除 index 以外内容 |
| compaction summary 被当长期事实 | 记忆污染 | 只能作为 evidence candidate，必须带 source refs |
| anchor proposal 目标已变化 | 旧 diff 覆盖新内容 | apply 前校验 beforeHash |
| 外部 memory plugin 给出身份判断 | 污染 persona | 先作为 evidence / curated candidate，不直接写 anchor |
| raw DB file 被直接复制备份 | WAL 不一致或备份损坏 | 使用 SQLite Backup API / `VACUUM INTO` |

### §5.1 错误示例: 无 source 的 evidence

```ts
// 错误
await appendLifeEvidence({ summary: '用户应该喜欢这个帖子', sourceRefs: [] });

// 正确
await appendLifeEvidence({ summary: 'InStreet feed item matched user AI tooling interest', sourceRefs: [feedItemRef] });
```

### §5.2 错误示例: fallback 写成 sent

```ts
// 错误
fallback.status = 'sent';

// 正确
fallback.status = 'not_sent';
```

### §5.3 错误示例: Quiet 直接写 anchor

```ts
// 错误
await fileStore.writeAtomic('USER.md', quietReflection);

// 正确
await proposeAnchorWrite({
  targetAssetId: 'USER.md',
  proposedDiff,
  supportingSources,
  confidence,
});
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeSourceRef(overrides: Partial<SourceRef> = {}): SourceRef {
  return {
    id: 'src-test',
    kind: 'platform_item',
    uri: 'instreet://feed/item-1',
    excerptHash: 'hash-test',
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeLifeEvidenceCandidate(overrides: Partial<LifeEvidenceCandidate> = {}): LifeEvidenceCandidate {
  return {
    timestamp: new Date().toISOString(),
    evidenceType: 'platform_browse',
    platformId: 'instreet',
    summary: 'Viewed an InStreet post about agent memory.',
    sourceRefs: [makeSourceRef()],
    sensitivity: 'public',
    confidence: 0.9,
    tags: ['agent-memory'],
    producer: 'connector-system',
    ...overrides,
  };
}

export function makeQuietArtifactWrite(overrides: Partial<QuietArtifactWrite> = {}): QuietArtifactWrite {
  const source = makeSourceRef();
  return {
    day: '2026-05-01',
    kind: 'daily_report',
    title: 'Daily report',
    body: 'Today I found one useful post about source-backed memory.',
    claims: [
      {
        id: 'claim-1',
        text: 'Found one useful post about source-backed memory.',
        sourceRefs: [source],
        claimType: 'fact',
      },
    ],
    sourceRefs: [source],
    ...overrides,
  };
}

export function makeOperatorFallbackWrite(overrides: Partial<OperatorFallbackWrite> = {}): OperatorFallbackWrite {
  return {
    reason: 'target_none',
    decisionId: 'decision-test',
    sourceRefs: [makeSourceRef()],
    candidateMessage: '你可能会喜欢这个 agent memory 资料。',
    nextStep: 'Configure OpenClaw heartbeat delivery target.',
    ...overrides,
  };
}

export function makeAnchorProposal(overrides: Partial<AnchorWriteProposal> = {}): AnchorWriteProposal {
  return {
    id: 'proposal-test',
    targetAssetId: 'USER.md',
    status: 'requires_review',
    proposedDiff: '+ User seems interested in source-backed agent memory.',
    reason: 'Repeated evidence-backed interest signals.',
    supportingSources: [makeSourceRef()],
    confidence: 0.86,
    policyBasis: ['anchor_guard', 'source_backed_interest'],
    riskFlags: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v5.0 | 2026-05-01 | 从旧 memory substrate 细节升级为 v5 life evidence / snapshot / Quiet source coverage / fallback artifact 实现细节 |
