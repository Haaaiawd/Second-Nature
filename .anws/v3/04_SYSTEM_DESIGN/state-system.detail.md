# State System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`state-system.md`](./state-system.md)
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
export const STORAGE_CONFIG = {
  sqlitePath: './data/state.db',
  sqliteJournalMode: 'WAL' as const,
  sqliteBusyTimeoutMs: 5_000,
  startupRepairEnabled: true,
} as const;

export const ASSET_CONFIG = {
  workspaceRoot: './workspace',
  journalsDir: 'memory',
  reportsDir: 'memory/reports',
  curatedDir: 'memory/curated',
  proposalsDir: 'memory/proposals',
  maxCuratedWritesPerReflection: 2,
  maxProposalWritesPerReflection: 2,
} as const;

export const GOVERNANCE_CONFIG = {
  anchorAssets: ['SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md', 'MEMORY.md'],
  requireFactTrace: true,
  allowDirectAnchorWrites: false,
  orphanRepairBatchSize: 100,
} as const;

export const CREDENTIAL_CONFIG = {
  encryptionRequired: true,
  maxVerificationAttempts: 5,
  defaultPendingStatus: 'pending_verification',
} as const;

export const PROVENANCE_CONFIG = {
  maxSourceRefsPerWrite: 20,
  confidenceThresholdForCuratedWrite: 0.6,
  confidenceThresholdForAnchorProposal: 0.8,
} as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

```ts
export type AssetKind = 'daily_journal' | 'curated_memory' | 'anchor_memory' | 'proposal';

export interface MemoryAsset {
  id: string;
  kind: AssetKind;
  path: string;
  hash: string;
  version: number;
  layer: 'runtime_context' | 'daily_journal' | 'curated_memory' | 'anchor_memory';
  lastIndexedAt: string;
}

export interface JournalEntryWrite {
  id: string;
  timestamp: string;
  category: 'platform_event' | 'user_dialog' | 'reflection_input' | 'plugin_observation';
  content: string;
  sourceRefs: string[];
}

export interface ActivityLogWrite {
  id: string;
  timestamp: string;
  platform?: string;
  kind: 'browse' | 'action' | 'failure' | 'task' | 'heartbeat';
  content: string;
  sourceRefs: string[];
}

export interface ObservationWrite {
  id: string;
  timestamp: string;
  summary: string;
  mood?: string;
  sourceRefs: string[];
}

export interface DailyReportInput {
  day: string;
  activityRefs: string[];
  observationRefs: string[];
  reflectionSummary: string;
  highlights: string[];
}

export interface CuratedMemoryWrite {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  ttlClass: 'short' | 'medium' | 'long';
  sourceRefs: string[];
  supersedes?: string[];
}

export interface AnchorWriteProposal {
  id: string;
  targetAssetId: string;
  beforeHash?: string;
  afterHash?: string;
  status: 'draft' | 'requires_review' | 'approved' | 'rejected' | 'applied' | 'conflicted';
  proposedDiff: string;
  reason: string;
  supportingSources: string[];
  confidence: number;
  policyBasis: string[];
  riskFlags: string[];
  createdAt: string;
}

export interface ProvenanceTrace {
  assetId: string;
  upstreamSources: string[];
  proposalIds: string[];
  applyIds: string[];
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

export type IntentCommitState = 'planned' | 'dispatched' | 'externally_acknowledged' | 'committed' | 'reconcile' | 'aborted';

export interface IntentCommitRecordInput {
  intentId: string;
  decisionId: string;
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
  checkpointId?: string;
  state: IntentCommitState;
  outcomeRef?: string;
  metadata?: Record<string, unknown>;
  updatedAt: string;
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 appendActivityLog

**对应契约**: L0 §5.1 — `appendActivityLog(entry)`
**准入理由**: 含多步骤副作用链与文件/索引双写补偿。

```ts
async function appendActivityLog(entry: ActivityLogWrite): Promise<AssetWriteAck> {
  const journalPath = resolveDailyJournalPath(entry.timestamp);
  const serialized = serializeActivityLog(entry);

  await fileStore.appendLine(journalPath, serialized);
  const hash = await fileStore.hashFile(journalPath);

  await indexStore.upsertAsset({
    id: buildJournalAssetId(journalPath),
    kind: 'daily_journal',
    path: journalPath,
    hash,
    version: 1,
  });

  await provenanceStore.linkEntrySources(entry.id, entry.sourceRefs);
  return { assetPath: journalPath, hash };
}
```

### §3.2 appendObservation

**对应契约**: L0 §5.1 — `appendObservation(entry)`
**准入理由**: observation 是低推断写入，需要和稳定记忆切开。

```ts
async function appendObservation(entry: ObservationWrite): Promise<AssetWriteAck> {
  const journalPath = resolveDailyJournalPath(entry.timestamp);
  const serialized = serializeObservation(entry);

  await fileStore.appendLine(journalPath, serialized);
  const hash = await fileStore.hashFile(journalPath);
  await indexStore.upsertAsset({
    id: buildJournalAssetId(journalPath),
    kind: 'daily_journal',
    path: journalPath,
    hash,
    version: 1,
  });

  return { assetPath: journalPath, hash };
}
```

### §3.3 generateDailyReport

**对应契约**: L0 §5.1 — `generateDailyReport(input)`
**准入理由**: 这是一条新的机制性主路径，关系到 24 小时产出。

```ts
async function generateDailyReport(input: DailyReportInput): Promise<AssetWriteAck> {
  const reportPath = resolveDailyReportPath(input.day);
  const content = renderDailyReport(input);

  await fileStore.writeCanonicalArtifact(reportPath, content);
  const hash = await fileStore.hashFile(reportPath);

  await indexStore.upsertAsset({
    id: buildReportAssetId(input.day),
    kind: 'daily_report',
    path: reportPath,
    hash,
    version: 1,
  });

  await provenanceStore.linkEntrySources(buildReportAssetId(input.day), [
    ...input.activityRefs,
    ...input.observationRefs,
  ]);

  return { assetPath: reportPath, hash };
}
```

### §3.4 upsertCuratedMemory

**对应契约**: L0 §5.1 — `upsertCuratedMemory(candidate)`
**准入理由**: 含 dedupe、merge、supersede 规则。

```ts
async function upsertCuratedMemory(candidate: CuratedMemoryWrite): Promise<AssetWriteAck> {
  const existing = await indexStore.findSimilarCuratedMemory(candidate);

  if (existing && shouldMerge(existing, candidate)) {
    const merged = mergeCuratedMemory(existing, candidate);
    await fileStore.writeCanonicalArtifact(resolveCuratedPath(merged.id), renderCuratedMemory(merged));
    await indexStore.upsertCurated(merged);
    return { assetPath: resolveCuratedPath(merged.id), hash: await fileStore.hashFile(resolveCuratedPath(merged.id)) };
  }

  await fileStore.writeCanonicalArtifact(resolveCuratedPath(candidate.id), renderCuratedMemory(candidate));
  await indexStore.upsertCurated(candidate);
  return { assetPath: resolveCuratedPath(candidate.id), hash: await fileStore.hashFile(resolveCuratedPath(candidate.id)) };
}
```

### §3.5 proposeAnchorWrite

**对应契约**: L0 §5.1 — `proposeAnchorWrite(proposal)`
**准入理由**: 含治理校验与 proposal-only 规则。

```ts
async function proposeAnchorWrite(proposal: AnchorWriteProposal): Promise<ProposalAck> {
  if (!proposal.supportingSources.length) {
    throw new Error('anchor_proposal_requires_sources');
  }

  if (proposal.confidence < PROVENANCE_CONFIG.confidenceThresholdForAnchorProposal) {
    throw new Error('anchor_proposal_confidence_too_low');
  }

  const proposalPath = resolveProposalPath(proposal.id);
  const initialStatus = proposal.riskFlags.length > 0 ? 'requires_review' : 'draft';
  await fileStore.writeCanonicalArtifact(proposalPath, renderProposal(proposal));
  await indexStore.registerProposal({
    ...proposal,
    status: initialStatus,
  });
  await provenanceStore.linkProposalSources(proposal.id, proposal.supportingSources);

  return { proposalId: proposal.id, proposalPath, status: initialStatus };
}
```

### §3.6 applyGovernedAnchorWrite

**对应契约**: L0 §5.1 — `applyGovernedAnchorWrite(proposalId)`
**准入理由**: 涉及核心身份文件更新、原子落盘与 apply log。

```ts
async function applyGovernedAnchorWrite(proposalId: string): Promise<ApplyAck> {
  const proposal = await indexStore.loadProposal(proposalId);
  if (!proposal) throw new Error('proposal_not_found');
  if (proposal.status !== 'approved') throw new Error('proposal_not_approved');

  const target = await indexStore.loadAsset(proposal.targetAssetId);
  if (!target) throw new Error('target_asset_not_found');

  const beforeContent = await fileStore.readText(target.path);
  const beforeHash = await fileStore.hashFile(target.path);
  if (proposal.beforeHash && proposal.beforeHash !== beforeHash) {
    await indexStore.markProposalConflicted(proposalId, beforeHash);
    throw new Error('anchor_proposal_conflict');
  }
  const nextContent = applyDiff(beforeContent, proposal.proposedDiff);
  await fileStore.writeAtomic(target.path, nextContent);

  const hash = await fileStore.hashFile(target.path);
  await indexStore.bumpAssetVersion(target.id, hash);
  await indexStore.markProposalApplied(proposalId, hash);
  await provenanceStore.recordApply(proposalId, target.id, {
    beforeHash,
    afterHash: hash,
    diff: proposal.proposedDiff,
  });

  return { applied: true, assetId: target.id, hash };
}
```

### §3.7 loadQuietInputs

**对应契约**: L0 §5.1 — `loadQuietInputs(query)`
**准入理由**: 需跨 journals / curated / plugin inputs 聚合但排除无关上下文膨胀。

```ts
async function loadQuietInputs(query: CurationInputQuery): Promise<CurationInputBundle> {
  const journals = await journalStore.loadByDateRange(query.dateRange);
  const reports = await reportStore.loadByDateRange(query.dateRange);
  const curated = await indexStore.loadRelevantCurated(query.topicFilters);
  const plugins = await pluginStore.loadMappedInputs(query.pluginFilters);

  return {
    journals,
    reports,
    curated,
    plugins,
    anchorSnapshot: query.includeAnchor ? await anchorStore.loadSnapshot() : undefined,
  };
}
```

### §3.8 importExternalMemory

**对应契约**: L0 §5.1 — `importExternalMemory(observation)`
**准入理由**: 需要防止 external plugin 直接污染 canonical memory。

```ts
async function importExternalMemory(observation: ExternalMemoryObservation): Promise<IngestAck> {
  const normalized = normalizePluginObservation(observation);
  const journalEntry = mapObservationToJournal(normalized);
  await appendActivityLog(journalEntry);
  return { ingestedAs: 'journal_observation', journalEntryId: journalEntry.id };
}
```

### §3.8a saveCredentialContext

**对应契约**: L0 §5.2 — `saveCredentialContext(input)`
**准入理由**: 平台注册/验证状态是跨 connector / control-plane / observability 的关键协作点。

```ts
async function saveCredentialContext(input: CredentialContextWrite): Promise<void> {
  const encrypted = enforceEncryption(input.encryptedValue);
  await credentialStore.upsert({
    ...input,
    encryptedValue: encrypted,
  });
}
```

### §3.8b createIntentCommitRecord

**对应契约**: L0 §5.2 — `EffectCommitStorePort.createIntentCommitRecord`
**准入理由**: effect commit protocol 的 canonical owner 必须在 state-system 正式承接。

```ts
async function createIntentCommitRecord(input: IntentCommitRecordInput): Promise<IntentCommitRecord> {
  const record = {
    id: crypto.randomUUID(),
    ...input,
    updatedAt: new Date().toISOString(),
  };

  await commitStore.insert(record);
  return record;
}
```

### §3.8c advanceIntentCommitState

**对应契约**: L0 §5.2 — `EffectCommitStorePort.advanceIntentCommitState`
**准入理由**: dispatched / acknowledged / reconcile 需要显式状态推进。

```ts
async function advanceIntentCommitState(id: string, state: IntentCommitState, metadata?: Record<string, unknown>): Promise<void> {
  await commitStore.update(id, {
    state,
    metadata,
    updatedAt: new Date().toISOString(),
  });
}
```

### §3.8d commitIntentOutcome

**对应契约**: L0 §5.2 — `EffectCommitStorePort.commitIntentOutcome`
**准入理由**: `committed` 是恢复链唯一 canonical 完成态。

```ts
async function commitIntentOutcome(id: string, outcome: IntentCommitOutcome): Promise<void> {
  await commitStore.update(id, {
    state: 'committed',
    outcomeRef: outcome.outcomeRef,
    metadata: { traceId: outcome.traceId },
    updatedAt: new Date().toISOString(),
  });
}
```

### §3.8e load / abort / reconcile intent commit

**对应契约**: L0 §5.2 — `EffectCommitStorePort.loadIntentCommitRecord` / `abortIntentCommit` / `markIntentCommitReconcile`
**准入理由**: resume、abort 与 reconcile 都依赖正式 owner 存储。

```ts
async function loadIntentCommitRecord(intentId: string): Promise<IntentCommitRecord | null> {
  return commitStore.findByIntentId(intentId);
}

async function abortIntentCommit(id: string, reason: string): Promise<void> {
  await commitStore.update(id, {
    state: 'aborted',
    metadata: { reason },
    updatedAt: new Date().toISOString(),
  });
}

async function markIntentCommitReconcile(id: string, details: Record<string, unknown>): Promise<void> {
  await commitStore.update(id, {
    state: 'reconcile',
    metadata: details,
    updatedAt: new Date().toISOString(),
  });
}
```

### §3.9 explainProvenance

**对应契约**: L0 §5.1 — `explainProvenance(assetId)`
**准入理由**: 需要组合索引、proposal、apply 与来源链。

```ts
async function explainProvenance(assetId: string): Promise<ProvenanceTrace> {
  const upstreamSources = await provenanceStore.loadSources(assetId);
  const proposalIds = await provenanceStore.loadProposalsForAsset(assetId);
  const applyIds = await provenanceStore.loadApplyEvents(assetId);

  return { assetId, upstreamSources, proposalIds, applyIds };
}
```

### §3.10 repairIndexes

**对应契约**: L0 §5.1 — `repairIndexes()`
**准入理由**: 含文件扫描、hash 对比、orphan repair。

```ts
async function repairIndexes(): Promise<RepairSummary> {
  const assetsOnDisk = await fileStore.scanKnownAssets();
  const indexedAssets = await indexStore.listAssets();

  for (const asset of assetsOnDisk) {
    const indexed = indexedAssets.find((x) => x.path === asset.path);
    if (!indexed) {
      await indexStore.registerScannedAsset(asset);
      continue;
    }

    if (indexed.hash !== asset.hash) {
      await indexStore.bumpAssetVersion(indexed.id, asset.hash);
    }
  }

  for (const indexed of indexedAssets) {
    if (!assetsOnDisk.find((x) => x.path === indexed.path)) {
      await indexStore.markOrphan(indexed.id);
    }
  }

  return { repaired: true };
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 记忆写入路径选择

**对应 L0 Mermaid**: `state-system.md §4.4`

```ts
function selectWritePath(item: MemoryWriteCandidate): WritePathDecision {
  if (item.kind === 'activity' || item.kind === 'browse_log') return { path: 'append_activity_log' };
  if (item.kind === 'observation') return { path: 'append_observation' };
  if (item.kind === 'daily_report') return { path: 'generate_daily_report' };
  if (item.kind === 'stable_fact' && item.target !== 'anchor') return { path: 'upsert_curated' };
  if (item.kind === 'identity_delta' || item.target === 'anchor') return { path: 'proposal_only' };
  return { path: 'discard_or_archive' };
}
```

### §4.2 Anchor proposal 审批流

**对应 L0 Mermaid**: `state-system.md §4.1`

```ts
function decideAnchorApply(proposal: AnchorWriteProposal): ApplyDecision {
  if (proposal.confidence < PROVENANCE_CONFIG.confidenceThresholdForAnchorProposal) {
    return { decision: 'reject', reason: 'confidence_too_low' };
  }

  if (proposal.riskFlags.includes('large_identity_shift')) {
    return { decision: 'requires_review', reason: 'risk_flagged' };
  }

  return { decision: 'allow_apply' };
}
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| 日间浏览日志太多且无节制 | Quiet 读取成本暴涨 | 日志按天分片，并保持 observation 轻量 |
| 反思一次写入太多长期记忆 | 记忆膨胀 | 限制每次 reflection 的 curated/proposal 数量 |
| external plugin 直接给出“身份结论” | 污染 self model | 先转 journal observation，不能直接写 anchor |
| 文件已落盘但 SQLite 索引写失败 | 索引与资产不一致 | 启动 repair 扫描修复 |
| SQLite 有资产记录但文件已丢失 | orphan index | 标记 orphan 并等待人工/自动修复 |
| proposal 无来源链 | 无法审计 | 直接拒绝 proposal |
| effect commit protocol 落成 control-plane 私有 helper | resume/reconcile 语义漂移 | intent commit records 只能由 state-system canonical owner 维护 |
| `SOUL.md` 被 apply 后无差异记录 | 后续无法解释人格变化 | 记录 before/after hash + diff 摘要 |
| 平台注册成功但 verification context 丢失 | 冷启动后无法继续激活 | 将 verification_code/deadline/attempts 一并写入 credential context |
| proposal 生成后目标文件已变化 | 旧提案覆盖新身份状态 | apply 前执行 `beforeHash == currentHash` 校验，不一致则标记 `conflicted` |

### §5.1 直接覆盖 Anchor Memory

```ts
// ❌ 错误做法
// await fileStore.writeCanonicalArtifact('SOUL.md', reflection.output)

// ✅ 正确做法
// 先生成 AnchorWriteProposal，再由治理流程决定是否 apply
```

### §5.2 把 compaction summary 当长期记忆

```ts
// ❌ 错误做法
// nightlyMemory = session.compactionSummary

// ✅ 正确做法
// compactionSummary 只能作为输入线索之一，不能直接视为 curated truth
```

### §5.3 日志和报告混写

```ts
// ❌ 错误做法
// 把 activity logs、AI observation、daily report 全写进一个 report.md

// ✅ 正确做法
// activity / observation 写 append-only 日志，report/reflection 作为 Quiet 产物单独生成
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeJournalEntryWrite(overrides: Partial<JournalEntryWrite> = {}): JournalEntryWrite {
  return {
    id: 'journal-test',
    timestamp: new Date().toISOString(),
    category: 'reflection_input',
    content: 'test entry',
    sourceRefs: ['src-1'],
    ...overrides,
  };
}

export function makeActivityLogWrite(overrides: Partial<ActivityLogWrite> = {}): ActivityLogWrite {
  return {
    id: 'activity-test',
    timestamp: new Date().toISOString(),
    kind: 'browse',
    content: 'viewed instreet feed item',
    sourceRefs: ['feed-1'],
    ...overrides,
  };
}

export function makeAnchorProposal(overrides: Partial<AnchorWriteProposal> = {}): AnchorWriteProposal {
  return {
    id: 'proposal-test',
    targetAssetId: 'soul-asset',
    proposedDiff: '+ New line',
    reason: 'stable pattern observed',
    supportingSources: ['src-1', 'src-2'],
    confidence: 0.9,
    policyBasis: ['anchor_guard'],
    riskFlags: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```
