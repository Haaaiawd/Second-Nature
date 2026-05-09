# Control Plane System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [control-plane-system.md](./control-plane-system.md)  
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。  
> **孤岛检查**: 本文件各节均在 L0 中有对应入口。

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v5.0 | 2026-05-01 | 从 v4 tick/heartbeat 边界升级为 v5 heartbeat decision loop、delivery policy 与 source-backed Quiet |

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §6 / §10 |
| §2 | [完整数据结构](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

> **L0 对应入口**: L0 §6 数据模型与 §10 性能考虑。

```ts
export const HEARTBEAT_LOOP_CONFIG = {
  maxCycleMs: 2_000,
  maxCandidateIntents: 6,
  runtimeCarrierOnlyStatus: 'runtime_carrier_only',
  defaultNoActionStatus: 'heartbeat_ok',
  requireDecisionRecordForSilent: true,
} as const;

export const RHYTHM_WINDOW_CONFIG = {
  supportedKinds: ['work', 'exploration', 'social', 'quiet', 'reflection', 'maintenance'],
  defaultKind: 'maintenance',
  quietAllows: ['memory_curation', 'narrative_reflection', 'maintenance'],
  quietDenies: ['routine_outreach', 'high_noise_social'],
  userTaskBypassesRhythm: true,
} as const;

export const OUTREACH_POLICY_CONFIG = {
  minValueScore: 0.72,
  minUserRelevance: 0.55,
  cooldownMs: 90 * 60_000,
  duplicateWindowMs: 24 * 60 * 60_000,
  maxSimilarOutreachPerDay: 2,
  requireEvidenceRefs: true,
  requireInterestOrActionability: true,
} as const;

export const DELIVERY_POLICY_CONFIG = {
  acceptedTargets: ['last', 'explicit'],
  unavailableTargets: ['none'],
  fallbackArtifactKind: 'operator_visible_outreach_fallback',
  heartbeatOkAckDropAware: true,
  neverMarkFallbackAsSent: true,
} as const;

export const QUIET_SOURCE_CONFIG = {
  requireSourceCoverage: true,
  minClaimCoverageRatio: 1.0,
  allowEmptyEvidenceMaintenance: true,
  maxNarrativeClaims: 8,
  forbidUnsupportedMemoryProposal: true,
} as const;

export const DECISION_RECORD_CONFIG = {
  schemaVersion: 'control-plane-decision-v5',
  includeSnapshotRefs: true,
  includeDeliveryResolution: true,
  includeFallbackReason: true,
  includeSourceCoverage: true,
} as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

> **L0 对应入口**: L0 §6.1 核心实体。L0 只保留字段声明摘要，本节给出 forge 时可直接落地的完整类型集合。

```ts
export type RuntimeScope = 'rhythm' | 'user_task' | 'user_reply';
export type HeartbeatTarget = 'none' | 'last' | 'explicit';
export type HeartbeatSource = 'openclaw_heartbeat' | 'manual_probe' | 'service_resume';

export type HeartbeatStatus =
  | 'heartbeat_ok'
  | 'intent_selected'
  | 'denied'
  | 'deferred'
  | 'runtime_carrier_only'
  | 'delivery_unavailable';

export type RhythmKind = 'work' | 'exploration' | 'social' | 'quiet' | 'reflection' | 'maintenance';
export type IntentKind = 'work' | 'exploration' | 'social' | 'quiet' | 'reflection' | 'outreach' | 'maintenance';
export type EffectClass = 'connector_action' | 'memory_curation' | 'narrative_reflection' | 'user_outreach' | 'no_effect';

export interface HeartbeatSignal {
  id: string;
  receivedAt: string;
  source: HeartbeatSource;
  target?: HeartbeatTarget;
  channel?: string;
  recipient?: string;
  runtimeAvailable: boolean;
  rawHostMetadata?: Record<string, unknown>;
}

export interface ScopedRuntimeInput {
  trigger: 'heartbeat' | 'user_task' | 'user_reply' | 'interrupt';
  scopeHint?: RuntimeScope;
  payload: Record<string, unknown>;
}

export interface ScopeRouteResult {
  scope: RuntimeScope;
  route: 'heartbeat_cycle' | 'task_chain' | 'light_continuity';
  reasons: string[];
}

export interface SourceRef {
  id: string;
  kind: 'platform_item' | 'workspace_artifact' | 'decision_record' | 'user_anchor' | 'connector_result' | 'host_report' | 'fallback_artifact';
  uri: string;
  excerptHash?: string;
  observedAt?: string;
}

export interface ContinuitySnapshot {
  mode: 'active' | 'quiet' | 'maintenance_only' | 'paused_for_interrupt';
  currentWindowId?: string;
  pendingObligations: string[];
  recentOutreachHashes: string[];
  deniedIntentHashes: string[];
  awaitingUserInput: boolean;
}

export interface LifeEvidenceSnapshot {
  queryWindowStart: string;
  queryWindowEnd: string;
  evidenceRefs: SourceRef[];
  platformEventCount: number;
  workEventCount: number;
  quietInputCount: number;
  sourceCoverageRatio: number;
  emptyReason?: 'no_sources' | 'state_unavailable' | 'redacted_only';
}

export interface UserInterestSnapshot {
  snapshotId: string;
  generatedAt: string;
  signals: Array<{
    id: string;
    topic: string;
    affinity: 'positive' | 'negative' | 'watching' | 'unknown';
    reason: string;
    confidence: number;
    sourceRefs: SourceRef[];
    updatedAt: string;
  }>;
  sourceRefs: SourceRef[];
  confidence: number;
  staleness: 'fresh' | 'stale' | 'insufficient';
  missingReasons?: string[];
}

export interface DeliveryCapabilitySnapshot {
  target?: HeartbeatTarget;
  channel?: string;
  recipient?: string;
  hostSupportsRunHeartbeatOnce?: boolean;
  hostSupportsExplicitChannel?: boolean;
  lastKnownVisibleChannel?: string;
}

export interface RhythmWindowDecision {
  windowId: string;
  kind: RhythmKind;
  allowedIntentKinds: IntentKind[];
  quietBias: boolean;
  reasons: string[];
}

export interface HeartbeatRuntimeSnapshot {
  continuity: ContinuitySnapshot;
  lifeEvidence: LifeEvidenceSnapshot;
  userInterest: UserInterestSnapshot;
  delivery: DeliveryCapabilitySnapshot;
  rhythmWindow: RhythmWindowDecision;
}

export interface CandidateIntent {
  id: string;
  kind: IntentKind;
  effectClass: EffectClass;
  sourceRefs: SourceRef[];
  priority: number;
  summary: string;
  idempotencyKey: string;
}

export interface GuardEvaluation {
  verdict: 'allow' | 'deny' | 'defer' | 'silent';
  reasons: string[];
  sourceBacked: boolean;
  cooldownClear: boolean;
  duplicateClear: boolean;
}

export interface OutreachJudgment {
  decisionId: string;
  candidateId: string;
  verdict: 'allow' | 'deny' | 'defer';
  valueScore: number;
  userRelevance: number;
  actionability: number;
  interestRefs: SourceRef[];
  sourceRefs: SourceRef[];
  cooldownState: 'clear' | 'cooling_down' | 'duplicate';
  deliveryVerdict: 'target_available' | 'target_none' | 'channel_missing' | 'host_unsupported';
  reasons: string[];
}

export interface DeliveryTargetResolution {
  verdict: 'target_available' | 'target_none' | 'channel_missing' | 'host_unsupported';
  target?: HeartbeatTarget;
  channel?: string;
  recipient?: string;
  reason: string;
}

export interface DeliveryRequest {
  decisionId: string;
  target: Exclude<HeartbeatTarget, 'none'>;
  channel?: string;
  recipient?: string;
  message: string;
  sourceRefs: SourceRef[];
}

export interface DeliveryAttempt {
  id: string;
  decisionId: string;
  status: 'sent' | 'failed' | 'dropped_by_host_policy';
  messageId?: string;
  hostProofRef?: SourceRef;
  errorClass?: string;
}

export interface DeliveryFallback {
  id: string;
  decisionId: string;
  kind: 'operator_visible_outreach_fallback';
  reason: string;
  candidateMessage?: string;
  sourceRefs: SourceRef[];
  nextStep: string;
}

export interface HeartbeatCycleResult {
  decisionId: string;
  status: HeartbeatStatus;
  selectedIntentId?: string;
  deliveryAttemptId?: string;
  fallbackRef?: string;
  reasons: string[];
}

export interface DecisionRecord {
  id: string;
  schemaVersion: string;
  heartbeatSignalId: string;
  status: HeartbeatStatus;
  scope: RuntimeScope;
  rhythmWindowId?: string;
  selectedIntentId?: string;
  outreachJudgment?: OutreachJudgment;
  deliveryResolution?: DeliveryTargetResolution;
  fallbackRef?: string;
  sourceRefs: SourceRef[];
  reasons: string[];
  createdAt: string;
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 runHeartbeatCycle

**对应契约**: L0 §5.1 — `runHeartbeatCycle(signal)`  
**准入理由**: v5 主链路，含 runtime 降级、snapshot、intent、guard、delivery/fallback 和审计写入。

```ts
async function runHeartbeatCycle(signal: HeartbeatSignal): Promise<HeartbeatCycleResult> {
  if (!signal.runtimeAvailable) {
    const result = buildResult('runtime_carrier_only', ['full_runtime_unavailable']);
    await recordDecisionFromResult(signal, result, { scope: 'rhythm', sourceRefs: [] });
    return result;
  }

  const route = await routeScopedInput({ trigger: 'heartbeat', payload: { signal } });
  if (route.scope !== 'rhythm') {
    return buildResult('denied', ['heartbeat_signal_not_rhythm_scope']);
  }

  const snapshot = await buildRuntimeSnapshot(signal);
  const candidates = await planCandidateIntents(snapshot);

  if (candidates.length === 0) {
    const result = buildResult('heartbeat_ok', ['no_candidate_intent']);
    await recordDecisionFromResult(signal, result, { scope: 'rhythm', snapshot, sourceRefs: [] });
    return result;
  }

  for (const candidate of candidates) {
    const guard = await evaluateHardGuards(candidate, snapshot);
    if (guard.verdict === 'deny' || guard.verdict === 'defer') {
      await recordDecisionFromCandidate(signal, snapshot, candidate, guard);
      continue;
    }

    if (guard.verdict === 'silent') {
      const result = buildResult('heartbeat_ok', guard.reasons);
      await recordDecisionFromCandidate(signal, snapshot, candidate, guard, result);
      return result;
    }

    const result = await dispatchAllowedIntent(candidate, snapshot);
    await recordDecisionFromCandidate(signal, snapshot, candidate, guard, result);
    return result;
  }

  const result = buildResult('deferred', ['all_candidates_denied_or_deferred']);
  await recordDecisionFromResult(signal, result, { scope: 'rhythm', snapshot, sourceRefs: snapshot.lifeEvidence.evidenceRefs });
  return result;
}
```

### §3.2 routeScopedInput

**对应契约**: L0 §5.1 — `routeScopedInput(input)`  
**准入理由**: 用户任务绕过 rhythm gate 是 v5 红线。

```ts
async function routeScopedInput(input: ScopedRuntimeInput): Promise<ScopeRouteResult> {
  if (input.scopeHint === 'user_task' || input.trigger === 'user_task') {
    return { scope: 'user_task', route: 'task_chain', reasons: ['explicit_user_task_bypasses_rhythm'] };
  }

  if (input.scopeHint === 'user_reply' || input.trigger === 'user_reply') {
    return { scope: 'user_reply', route: 'light_continuity', reasons: ['direct_user_reply_light_continuity_only'] };
  }

  return { scope: 'rhythm', route: 'heartbeat_cycle', reasons: ['heartbeat_bridge_signal'] };
}
```

### §3.3 buildRuntimeSnapshot

**对应契约**: L0 §5.1 — `buildRuntimeSnapshot(signal)`  
**准入理由**: 需要组合多个 state read model 和 delivery capability。

```ts
async function buildRuntimeSnapshot(signal: HeartbeatSignal): Promise<HeartbeatRuntimeSnapshot> {
  const continuity = await state.loadContinuitySnapshot();
  const lifeEvidence = await state.loadLifeEvidenceSnapshot(resolveEvidenceQuery(signal, continuity));
  const userInterest = await state.loadUserInterestSnapshot();
  const delivery = await hostCapabilities.loadDeliveryCapabilitySnapshot(signal);
  const rhythmWindow = selectRhythmWindow({ continuity, lifeEvidence, userInterest, delivery });

  return { continuity, lifeEvidence, userInterest, delivery, rhythmWindow };
}
```

### §3.4 selectRhythmWindow

**对应契约**: L0 §5.1 — `selectRhythmWindow(snapshot)`  
**准入理由**: 窗口选择影响候选集合，但不能越权允许动作。

```ts
function selectRhythmWindow(input: Omit<HeartbeatRuntimeSnapshot, 'rhythmWindow'>): RhythmWindowDecision {
  if (input.continuity.mode === 'paused_for_interrupt') {
    return {
      windowId: 'paused-for-interrupt',
      kind: 'maintenance',
      allowedIntentKinds: ['maintenance'],
      quietBias: false,
      reasons: ['paused_for_interrupt'],
    };
  }

  const configured = rhythmPolicy.resolveCurrentWindow();
  const allowedIntentKinds = rhythmPolicy.allowedIntentKinds(configured.kind);

  return {
    windowId: configured.id,
    kind: configured.kind,
    allowedIntentKinds,
    quietBias: configured.kind === 'quiet' || configured.kind === 'reflection',
    reasons: ['configured_rhythm_window'],
  };
}
```

### §3.5 planCandidateIntents

**对应契约**: L0 §5.1 — `planCandidateIntents(snapshot)`  
**准入理由**: 需合成 work、social、Quiet、reflection、outreach 等候选并维护优先级。

```ts
async function planCandidateIntents(snapshot: HeartbeatRuntimeSnapshot): Promise<CandidateIntent[]> {
  const intents: CandidateIntent[] = [];

  if (snapshot.rhythmWindow.allowedIntentKinds.includes('work')) {
    intents.push(...planWorkIntents(snapshot));
  }

  if (snapshot.rhythmWindow.allowedIntentKinds.includes('exploration')) {
    intents.push(...planExplorationIntents(snapshot));
  }

  if (snapshot.rhythmWindow.allowedIntentKinds.includes('social')) {
    intents.push(...planSocialIntents(snapshot));
  }

  if (snapshot.rhythmWindow.allowedIntentKinds.includes('quiet') || snapshot.rhythmWindow.quietBias) {
    intents.push(...planQuietOrReflectionIntents(snapshot));
  }

  intents.push(...planOutreachCandidates(snapshot));
  intents.push(...planMaintenanceIntents(snapshot));

  return intents
    .filter((intent) => isAllowedByWindow(intent, snapshot.rhythmWindow))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, HEARTBEAT_LOOP_CONFIG.maxCandidateIntents);
}
```

### §3.6 evaluateHardGuards

**对应契约**: L0 §5.1 — `evaluateHardGuards(candidate)`  
**准入理由**: 多 guard 组合，尤其 evidence、cooldown、dedupe 与 Quiet 边界。

```ts
async function evaluateHardGuards(candidate: CandidateIntent, snapshot: HeartbeatRuntimeSnapshot): Promise<GuardEvaluation> {
  const reasons: string[] = [];

  const sourceBacked = candidate.sourceRefs.length > 0 || candidate.effectClass === 'no_effect';
  if (!sourceBacked && candidate.effectClass !== 'maintenance') reasons.push('missing_source_refs');

  const duplicateClear = !await state.hasDuplicateIntent(candidate.idempotencyKey, OUTREACH_POLICY_CONFIG.duplicateWindowMs);
  if (!duplicateClear) reasons.push('duplicate_intent');

  const cooldownClear = candidate.effectClass !== 'user_outreach' || await state.isOutreachCooldownClear(candidate.idempotencyKey);
  if (!cooldownClear) reasons.push('outreach_cooldown');

  if (snapshot.rhythmWindow.quietBias && RHYTHM_WINDOW_CONFIG.quietDenies.includes(candidate.kind)) {
    reasons.push('quiet_window_suppression');
  }

  if (reasons.length > 0) {
    return {
      verdict: reasons.includes('duplicate_intent') || reasons.includes('outreach_cooldown') ? 'defer' : 'deny',
      reasons,
      sourceBacked,
      cooldownClear,
      duplicateClear,
    };
  }

  return { verdict: 'allow', reasons: ['hard_guards_clear'], sourceBacked, cooldownClear, duplicateClear };
}
```

```ts
function isDeliveryUnavailableReason(reason: string): boolean {
  return reason === 'target_none' || reason === 'channel_missing' || reason === 'host_unsupported';
}
```

### §3.7 judgeOutreach

**对应契约**: L0 §5.1 — `judgeOutreach(candidate)`  
**准入理由**: 主动联系是否成立的核心判断，不能交给 guidance。

```ts
async function judgeOutreach(candidate: CandidateIntent, snapshot: HeartbeatRuntimeSnapshot): Promise<OutreachJudgment> {
  const interestRefs = matchInterestRefs(candidate, snapshot.userInterest);
  const valueScore = scoreOutreachValue(candidate, snapshot.lifeEvidence, snapshot.userInterest);
  const userRelevance = scoreUserRelevance(candidate, snapshot.userInterest);
  const actionability = scoreActionability(candidate);
  const cooldownState = await resolveCooldownState(candidate);
  const deliveryResolution = resolveDeliveryTarget(snapshot.delivery);

  const reasons: string[] = [];
  if (candidate.sourceRefs.length === 0) reasons.push('missing_source_refs');
  if (valueScore < OUTREACH_POLICY_CONFIG.minValueScore) reasons.push('value_score_too_low');
  if (userRelevance < OUTREACH_POLICY_CONFIG.minUserRelevance && actionability < 0.7) reasons.push('not_interest_relevant_or_actionable');
  if (cooldownState !== 'clear') reasons.push(cooldownState);
  if (deliveryResolution.verdict !== 'target_available') reasons.push(deliveryResolution.verdict);

  const blockingReasons = reasons.filter((reason) => !isDeliveryUnavailableReason(reason));

  return {
    decisionId: createId('outreach_judgment'),
    candidateId: candidate.id,
    verdict: blockingReasons.length === 0
      ? 'allow'
      : blockingReasons.includes('cooling_down') || blockingReasons.includes('duplicate')
        ? 'defer'
        : 'deny',
    valueScore,
    userRelevance,
    actionability,
    interestRefs,
    sourceRefs: candidate.sourceRefs,
    cooldownState,
    deliveryVerdict: deliveryResolution.verdict,
    reasons: reasons.length === 0 ? ['outreach_allowed'] : reasons,
  };
}
```

### §3.8 resolveDeliveryTarget

**对应契约**: L0 §5.1 — `resolveDeliveryTarget(snapshot)`  
**准入理由**: `target: "none"` 是主动联系闭环最大的宿主坑。

```ts
function resolveDeliveryTarget(snapshot: DeliveryCapabilitySnapshot): DeliveryTargetResolution {
  if (!snapshot.target || snapshot.target === 'none') {
    return { verdict: 'target_none', target: 'none', reason: 'heartbeat_run_without_user_visible_delivery' };
  }

  if (snapshot.target === 'explicit' && (!snapshot.channel || !snapshot.recipient)) {
    return { verdict: 'channel_missing', target: snapshot.target, reason: 'explicit_delivery_requires_channel_and_recipient' };
  }

  if (snapshot.target === 'last' && !snapshot.lastKnownVisibleChannel) {
    return { verdict: 'channel_missing', target: snapshot.target, reason: 'last_target_has_no_known_visible_channel' };
  }

  return {
    verdict: 'target_available',
    target: snapshot.target,
    channel: snapshot.channel ?? snapshot.lastKnownVisibleChannel,
    recipient: snapshot.recipient,
    reason: 'delivery_target_available',
  };
}
```

### §3.9 dispatchAllowedIntent

**对应契约**: L0 §5.1 — `dispatchAllowedIntent(intent)`  
**准入理由**: 多 effect class 与 fallback 的副作用链。

```ts
async function dispatchAllowedIntent(candidate: CandidateIntent, snapshot: HeartbeatRuntimeSnapshot): Promise<HeartbeatCycleResult> {
  if (candidate.effectClass === 'user_outreach') {
    const judgment = await judgeOutreach(candidate, snapshot);

    if (judgment.verdict !== 'allow') {
      return buildResult(judgment.verdict === 'defer' ? 'deferred' : 'denied', judgment.reasons, { selectedIntentId: candidate.id });
    }

    const deliveryResolution = resolveDeliveryTarget(snapshot.delivery);
    if (deliveryResolution.verdict !== 'target_available') {
      const fallbackDraft = shouldIncludeFallbackCandidateMessage(candidate)
        ? await guidance.draftOutreachMessage(buildOutreachDraftRequest(candidate, judgment, snapshot, deliveryResolution))
        : null;
      const fallback = await writeDeliveryFallback(
        candidate,
        judgment,
        deliveryResolution,
        fallbackDraft?.status === 'ready' ? fallbackDraft.draft.text : undefined,
      );
      return buildResult('delivery_unavailable', [deliveryResolution.reason], { selectedIntentId: candidate.id, fallbackRef: fallback.id });
    }

    const draftResult = await guidance.draftOutreachMessage(
      buildOutreachDraftRequest(candidate, judgment, snapshot, deliveryResolution),
    );

    if (draftResult.status !== 'ready') {
      return buildResult('denied', ['guidance_unavailable', ...draftResult.unavailable.reasons], { selectedIntentId: candidate.id });
    }

    const attempt = await openclawDelivery.sendDeliveryRequest({
      decisionId: judgment.decisionId,
      target: deliveryResolution.target!,
      channel: deliveryResolution.channel,
      recipient: deliveryResolution.recipient,
      message: draftResult.draft.text,
      sourceRefs: judgment.sourceRefs,
    });

    if (attempt.status !== 'sent') {
      const fallback = await writeDeliveryFallback(
        candidate,
        judgment,
        { ...deliveryResolution, verdict: 'host_unsupported', reason: attempt.errorClass ?? 'delivery_failed' },
        draftResult.draft.text,
      );
      return buildResult('delivery_unavailable', ['delivery_failed', attempt.status], {
        selectedIntentId: candidate.id,
        deliveryAttemptId: attempt.id,
        fallbackRef: fallback.id,
      });
    }

    return buildResult('intent_selected', ['outreach_sent'], {
      selectedIntentId: candidate.id,
      deliveryAttemptId: attempt.id,
    });
  }

  if (candidate.effectClass === 'memory_curation' || candidate.effectClass === 'narrative_reflection') {
    const quietResult = await runSourceBackedQuiet(candidate, snapshot);
    return buildResult('intent_selected', quietResult.reasons, { selectedIntentId: candidate.id });
  }

  if (candidate.effectClass === 'connector_action') {
    await connector.executeEffect(buildConnectorRequest(candidate));
    return buildResult('intent_selected', ['connector_effect_dispatched'], { selectedIntentId: candidate.id });
  }

  return buildResult('heartbeat_ok', ['maintenance_or_no_effect']);
}
```

```ts
function buildOutreachDraftRequest(
  candidate: CandidateIntent,
  judgment: OutreachJudgment,
  snapshot: HeartbeatRuntimeSnapshot,
  delivery: DeliveryTargetResolution,
): OutreachDraftRequest {
  return {
    requestId: createId('outreach_draft_request'),
    sceneType: delivery.verdict === 'target_available' ? 'outreach' : 'fallback_candidate',
    runtimeScope: 'rhythm',
    rhythmWindowKind: snapshot.rhythmWindow.kind,
    riskLevel: delivery.verdict === 'target_available' ? 'medium' : 'low',
    decisionId: judgment.decisionId,
    candidateId: candidate.id,
    judgmentVerdict: judgment.verdict,
    valueScore: judgment.valueScore,
    sourceRefs: judgment.sourceRefs,
    interestRefs: judgment.interestRefs,
    deliveryContext: {
      deliveryVerdict: delivery.verdict,
      wordingMode: delivery.verdict === 'target_available' ? 'sendable' : 'not_sent_fallback_candidate',
    },
  };
}
```

### §3.10 recordDecision

**对应契约**: L0 §5.1 — `recordDecision(result)`  
**准入理由**: v5 要求 silent、deny、fallback 都可审计。

```ts
async function recordDecision(record: DecisionRecord): Promise<void> {
  await observability.recordDecisionTrace(record);
  await state.storeDecisionIndex({
    id: record.id,
    status: record.status,
    sourceRefs: record.sourceRefs,
    fallbackRef: record.fallbackRef,
    createdAt: record.createdAt,
  });
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Heartbeat Cycle 主决策树

**对应 L0 Mermaid**: `control-plane-system.md §4.4`

```ts
function decideHeartbeatPath(signal: HeartbeatSignal, snapshot?: HeartbeatRuntimeSnapshot): string {
  if (!signal.runtimeAvailable) return 'runtime_carrier_only';
  if (!snapshot) return 'build_snapshot';
  if (snapshot.lifeEvidence.emptyReason && snapshot.rhythmWindow.kind !== 'maintenance') return 'heartbeat_ok_empty_evidence';
  if (snapshot.rhythmWindow.kind === 'quiet' || snapshot.rhythmWindow.kind === 'reflection') return 'source_backed_quiet';
  if (hasHighValueOutreachCandidate(snapshot)) return 'outreach_judgment';
  if (hasWorkOrConnectorCandidate(snapshot)) return 'connector_or_work_intent';
  return 'heartbeat_ok_no_action';
}
```

### §4.2 Outreach 子决策树

```ts
function decideOutreachPath(judgment: OutreachJudgment): 'send' | 'fallback' | 'deny' | 'defer' {
  if (judgment.verdict === 'deny') return 'deny';
  if (judgment.cooldownState !== 'clear') return 'defer';
  if (judgment.deliveryVerdict !== 'target_available') return 'fallback';
  if (judgment.sourceRefs.length === 0) return 'deny';
  return 'send';
}
```

### §4.3 Quiet Source Coverage 子决策树

```ts
function decideQuietPath(snapshot: HeartbeatRuntimeSnapshot): 'maintenance_empty' | 'reflect' | 'curate' | 'deny_unsupported' {
  if (snapshot.lifeEvidence.evidenceRefs.length === 0) return 'maintenance_empty';
  if (snapshot.lifeEvidence.sourceCoverageRatio < QUIET_SOURCE_CONFIG.minClaimCoverageRatio) return 'deny_unsupported';
  if (snapshot.rhythmWindow.kind === 'reflection') return 'reflect';
  return 'curate';
}
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| `target: "none"` 下 heartbeat 成功运行 | 误报“已主动联系用户” | 结果必须是 `delivery_unavailable` 或 `not_delivered_by_host_policy` |
| 有效提醒被写成短 `HEARTBEAT_OK` 包裹消息 | 被 OpenClaw ack drop 吞掉 | alert/outreach 绝不放入 ack-drop 形态 |
| evidence 为空但 Quiet 生成叙事 | 虚构经历 | 只允许 maintenance_empty / empty-state explanation |
| guidance 生成了没有 source 的朋友式文案 | 事实漂移 | control-plane 只给 guidance 传 source-backed request，并复查 sourceRefs |
| 用户任务进入 Quiet gate | 明确任务被错误延后 | `routeScopedInput()` 强制 user_task -> task_chain |
| duplicate outreach 在多轮 heartbeat 重复发送 | 噪声和信任损耗 | idempotencyKey + cooldown + daily similar limit |
| delivery fallback 被 UI 表述为 sent | 欺骗性状态 | fallback status 永远不同于 delivery attempt sent |
| `target: "last"` 没有可见 channel | 看似可投递，实际不可见 | `resolveDeliveryTarget()` 要求 lastKnownVisibleChannel |

### §5.1 Ack Drop 防误用

```ts
// 错误: 把有效提醒塞进可能被宿主丢弃的短 ack
// return "HEARTBEAT_OK 你快去看一下那个帖子";

// 正确: 有效提醒走 DeliveryRequest，没事才返回 HEARTBEAT_OK
```

### §5.2 Fallback 不冒充 Sent

```ts
// 错误: delivery unavailable 后写 status: sent
// await state.write({ status: 'sent', reason: 'target_none' });

// 正确: fallback 是 operator-visible artifact
// await state.writeOperatorFallback({ kind: 'operator_visible_outreach_fallback', reason: 'target_none' });
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeHeartbeatSignal(overrides: Partial<HeartbeatSignal> = {}): HeartbeatSignal {
  return {
    id: 'hb-test',
    receivedAt: new Date().toISOString(),
    source: 'openclaw_heartbeat',
    target: 'none',
    runtimeAvailable: true,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<HeartbeatRuntimeSnapshot> = {}): HeartbeatRuntimeSnapshot {
  return {
    continuity: {
      mode: 'active',
      pendingObligations: [],
      recentOutreachHashes: [],
      deniedIntentHashes: [],
      awaitingUserInput: false,
    },
    lifeEvidence: {
      queryWindowStart: new Date(Date.now() - 60_000).toISOString(),
      queryWindowEnd: new Date().toISOString(),
      evidenceRefs: [{ id: 'life:1', kind: 'workspace_artifact', uri: 'memory/evidence/life-1.md' }],
      platformEventCount: 1,
      workEventCount: 0,
      quietInputCount: 1,
      sourceCoverageRatio: 1,
    },
    userInterest: {
      snapshotId: 'interest-snapshot-test',
      generatedAt: new Date().toISOString(),
      signals: [{
        id: 'interest:1',
        topic: 'agent runtime',
        affinity: 'positive',
        reason: 'fixture interest',
        confidence: 0.8,
        sourceRefs: [{ id: 'user:1', kind: 'user_anchor', uri: 'USER.md' }],
        updatedAt: new Date().toISOString(),
      }],
      sourceRefs: [{ id: 'user:1', kind: 'user_anchor', uri: 'USER.md' }],
      confidence: 0.8,
      staleness: 'fresh',
    },
    delivery: {
      target: 'none',
      hostSupportsRunHeartbeatOnce: false,
    },
    rhythmWindow: {
      windowId: 'test-work',
      kind: 'work',
      allowedIntentKinds: ['work', 'outreach', 'maintenance'],
      quietBias: false,
      reasons: ['test_fixture'],
    },
    ...overrides,
  };
}
```
