# Control Plane System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`control-plane-system.md`](./control-plane-system.md)
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
export const RHYTHM_CONFIG = {
  defaultTickIntervalMs: 60_000,
  quietSuppressionCooldownMs: 30 * 60_000,
  outreachCooldownMs: 90 * 60_000,
  maxInterruptsPerQuietWindow: 2,
  continueAsNewDecisionThreshold: 500,
} as const;

export const LEASE_CONFIG = {
  leaseKey: 'global-control-plane-flight',
  narrowLeasePrefix: 'effect-scope',
  ttlMs: 90_000,
  renewEveryMs: 30_000,
  recoveryGraceMs: 15_000,
} as const;

export const GUARD_CONFIG = {
  duplicateIntentWindowMs: 10 * 60_000,
  maxSimilarOutreachPerDay: 2,
  quietDefaultAllows: ['maintenance', 'memory_curation', 'narrative_reflection'],
  quietDefaultDenies: ['high_noise_social', 'routine_outreach'],
} as const;

export const REFLECTION_CONFIG = {
  maxNarrativeBullets: 5,
  maxStableUpdatesPerRun: 2,
  reflectionTimeoutMs: 20_000,
  requireFactTrace: true,
} as const;

export const DECISION_CONFIG = {
  maxCandidateIntents: 6,
  denyReasonTaxonomyVersion: 'v1',
  checkpointBeforeExternalEffect: true,
  checkpointBeforeQuietWrite: true,
} as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

```ts
export type TopLevelMode = 'active' | 'quiet' | 'maintenance_only' | 'paused_for_interrupt';
export type IntentKind = 'work' | 'exploration' | 'social' | 'reflection' | 'outreach' | 'maintenance';
export type Verdict = 'allow' | 'defer' | 'deny' | 'escalate';

export interface TickSignal {
  id: string;
  source: 'cron' | 'heartbeat' | 'platform_event' | 'user_interrupt' | 'resume';
  receivedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ContinuitySnapshot {
  mode: TopLevelMode;
  currentWindowId: string;
  recentPlatforms: string[];
  pendingObligations: string[];
  activeLeaseId?: string;
  quietContextId?: string;
  recentOutreachHashes: string[];
  deniedIntents: Array<{ intentHash: string; reason: string; at: string }>;
}

export interface CandidateIntent {
  id: string;
  kind: IntentKind;
  priority: number;
  source: 'tick' | 'interrupt' | 'obligation' | 'quiet_plan';
  platformId?: string;
  summary: string;
  effectClass: 'external_platform_action' | 'memory_curation' | 'narrative_reflection' | 'user_outreach' | 'maintenance';
}

export interface GuardEvaluation {
  verdict: Verdict;
  reasons: string[];
  quietSuppressed: boolean;
  leaseRequired: boolean;
  requiresCheckpoint: boolean;
}

export interface DecisionRecord {
  id: string;
  tickId: string;
  mode: TopLevelMode;
  intentId?: string;
  verdict: Verdict;
  reasons: string[];
  decisionBasis: 'rule_only' | 'score_based' | 'model_assisted';
  modelEvalRef?: string;
  evidenceRefs?: string[];
  matchedGuards: string[];
  decisionSnapshotId: string;
  createdAt: string;
}

export interface ModelEvaluationResult {
  id: string;
  kind: 'platform_choice' | 'outreach' | 'anchor_proposal';
  accepted: boolean;
  confidence: number;
  reasonCodes: string[];
  evidenceRefs: string[];
  summary: string;
}

// `model_assisted` 路径必须先把模型输出收敛为固定 schema，
// 再交给 guard/effect。禁止以模型自由文本直接驱动 effect。

export interface OutreachEvaluationInput {
  candidateId: string;
  summary: string;
  sourceRefs: string[];
  recentOutreachHashes: string[];
  requiredUserHelp?: boolean;
}

export interface OutreachEvaluationResult {
  valueScore: number;
  novelty: number;
  userRelevance: number;
  actionability: number;
  urgency: number;
  requiredUserHelp: boolean;
  isRoutineProgress: boolean;
  minThreshold: number;
  sourceRefs: string[];
  explanation?: string;
}

export interface ExecutionCheckpoint {
  id: string;
  tickId: string;
  intentId?: string;
  phase: 'before_effect' | 'before_quiet_write' | 'awaiting_resume';
  snapshotRef: string;
  createdAt: string;
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 ingestTick

**对应契约**: L0 §5.1 — `ingestTick(signal)`
**准入理由**: 含多步骤副作用链、恢复点与决策写入。

```ts
async function ingestTick(signal: TickSignal): Promise<DecisionCycleResult> {
  const snapshot = await state.loadContinuitySnapshot();
  const currentWindow = selectRhythmWindow(signal.receivedAt, snapshot);
  const candidateIntents = await planIntent({ signal, snapshot, currentWindow });

  for (const intent of candidateIntents) {
    const guard = await evaluateGuards(intent, snapshot);
    const decision = buildDecisionRecord(signal, snapshot, intent, guard);
    await recordDecision(decision);

    if (guard.verdict === 'allow') {
      return dispatchEffect(intent, decision);
    }

    if (guard.verdict === 'escalate') {
      return { status: 'escalated', decisionId: decision.id };
    }
  }

  return { status: 'idle', reason: 'no-allowable-intent' };
}
```

### §3.2 selectRhythmWindow

**对应契约**: L0 §5.1 — `selectRhythmWindow(now, snapshot)`
**准入理由**: 含时间窗口、Quiet 与 interrupt 交互规则。

```ts
function selectRhythmWindow(now: string, snapshot: ContinuitySnapshot): RhythmWindowDecision {
  const minuteOfDay = toLocalMinuteOfDay(now);
  const configuredWindow = rhythmPolicy.match(minuteOfDay);

  if (snapshot.mode === 'paused_for_interrupt') {
    return { windowId: configuredWindow.id, topLevelMode: 'paused_for_interrupt', interrupted: true };
  }

  if (configuredWindow.mode === 'quiet') {
    return { windowId: configuredWindow.id, topLevelMode: 'quiet', interrupted: false };
  }

  if (riskPolicy.shouldSuppress(snapshot)) {
    return { windowId: configuredWindow.id, topLevelMode: 'maintenance_only', interrupted: false };
  }

  return { windowId: configuredWindow.id, topLevelMode: 'active', interrupted: false };
}
```

### §3.3 planIntent

**对应契约**: L0 §5.1 — `planIntent(snapshot)`
**准入理由**: 含多来源意图合成与优先级排序。

```ts
async function planIntent(ctx: PlanningContext): Promise<CandidateIntent[]> {
  const intents: CandidateIntent[] = [];

  intents.push(...planObligationIntents(ctx));
  intents.push(...planPlatformIntents(ctx));
  intents.push(...planQuietIntents(ctx));
  intents.push(...planOutreachIntents(ctx));

  return intents
    .sort((a, b) => b.priority - a.priority)
    .slice(0, DECISION_CONFIG.maxCandidateIntents);
}
```

### §3.3a decideDecisionBasis

**对应契约**: L0 §6.4 — `Decision Class`
**准入理由**: 决定是否调用模型，是本系统与 observability/state 的关键交界。

```ts
function decideDecisionBasis(intent: CandidateIntent, snapshot: ContinuitySnapshot): 'rule_only' | 'score_based' | 'model_assisted' {
  if (intent.kind === 'maintenance') return 'rule_only';
  if (intent.kind === 'outreach' || intent.kind === 'reflection') return 'model_assisted';
  if (intent.kind === 'exploration' || intent.kind === 'social' || intent.kind === 'work') return 'score_based';
  return 'rule_only';
}
```

### §3.4 evaluateGuards

**对应契约**: L0 §5.1 — `evaluateGuards(intent, snapshot)`
**准入理由**: 含不明显业务规则和多 guard 组合逻辑。

```ts
async function evaluateGuards(intent: CandidateIntent, snapshot: ContinuitySnapshot): Promise<GuardEvaluation> {
  const reasons: string[] = [];

  if (isDuplicateIntent(intent, snapshot)) reasons.push('duplicate_intent');
  if (isBudgetExceeded(intent, snapshot)) reasons.push('budget_exceeded');
  if (isQuietSuppressed(intent, snapshot)) reasons.push('quiet_window');
  if (await isAwaitingUser(intent, snapshot)) reasons.push('awaiting_user');
  if (connectorRiskBlocks(intent)) reasons.push('platform_risk');

  if (requiresEscalation(reasons)) {
    return { verdict: 'escalate', reasons, quietSuppressed: false, leaseRequired: false, requiresCheckpoint: false };
  }

  if (reasons.length > 0) {
    return {
      verdict: reasons.includes('duplicate_intent') ? 'defer' : 'deny',
      reasons,
      quietSuppressed: reasons.includes('quiet_window'),
      leaseRequired: false,
      requiresCheckpoint: false,
    };
  }

  return {
    verdict: 'allow',
    reasons: ['guard_clear'],
    quietSuppressed: false,
    leaseRequired: intent.effectClass === 'external_platform_action' || intent.effectClass === 'user_outreach',
    requiresCheckpoint: intent.effectClass !== 'maintenance',
  };
}
```

### §3.5 dispatchEffect

**对应契约**: L0 §5.1 — `dispatchEffect(intent, verdict)`
**准入理由**: 含多步骤副作用链、lease、checkpoint、不同 effect class 路径。

```ts
async function dispatchEffect(intent: CandidateIntent, decision: DecisionRecord): Promise<DecisionCycleResult> {
  if (decision.verdict !== 'allow') {
    throw new Error('dispatchEffect called for non-allow decision');
  }

  let lease: LeaseHandle | undefined;

  if (needsLease(intent)) {
    lease = await leaseManager.acquire(resolveLeaseScope(intent));
    if (!lease.granted) {
      await recordDecision({ ...decision, verdict: 'defer', reasons: ['lease_unavailable'] });
      return { status: 'deferred', reason: 'lease_unavailable' };
    }
  }

  if (needsCheckpoint(intent)) {
    await state.saveCheckpoint(buildCheckpoint(intent, decision));
  }

  const commitRef = await state.createIntentCommitRecord({
    intentId: intent.id,
    decisionId: decision.id,
    checkpointId: decision.decisionSnapshotId,
    state: 'planned',
  });

  try {
    if (intent.effectClass === 'external_platform_action') {
      await state.advanceIntentCommitState(commitRef.id, 'dispatched');
      const result = await connector.executeEffect(buildExternalEffect(intent, decision));
      await state.advanceIntentCommitState(commitRef.id, 'externally_acknowledged', {
        outcomeRef: result.metadata?.platformId ?? 'external-outcome',
        idempotencyKey: (result.metadata as any)?.idempotencyKey,
      });
      await state.commitIntentOutcome(commitRef.id, {
        traceId: decision.id,
        outcomeRef: result.metadata?.platformId ?? 'external-outcome',
      });
      return { status: 'effect_executed', result };
    }

    if (intent.effectClass === 'memory_curation') {
      await state.persistCurationResult(await runMemoryCuration(intent));
      return { status: 'curated' };
    }

    if (intent.effectClass === 'narrative_reflection') {
      await runNarrativeReflection(buildReflectionContext(intent, decision));
      return { status: 'reflected' };
    }

    if (intent.effectClass === 'user_outreach') {
      await state.advanceIntentCommitState(commitRef.id, 'dispatched');
      await messaging.send(buildOutreachMessage(intent, decision));
      await state.advanceIntentCommitState(commitRef.id, 'externally_acknowledged');
      await state.commitIntentOutcome(commitRef.id, { traceId: decision.id, outcomeRef: 'outreach' });
      return { status: 'outreach_sent' };
    }

    return { status: 'maintenance_done' };
  } catch (error) {
    await state.abortIntentCommit(commitRef.id, String(error));
    throw error;
  } finally {
    if (lease) await lease.release();
  }
}
```

### §3.6 runNarrativeReflection

**对应契约**: L0 §5.1 — `runNarrativeReflection(context)`
**准入理由**: 含事实约束、输出限制与 Anchor Memory guard。

```ts
async function runNarrativeReflection(context: ReflectionContext): Promise<ReflectionWriteRequest> {
  const inputs = await memory.loadQuietInputs(context.query);
  const reflection = await llm.generateNarrativeReflection(inputs, {
    requireFactTrace: REFLECTION_CONFIG.requireFactTrace,
    maxStableUpdates: REFLECTION_CONFIG.maxStableUpdatesPerRun,
  });

  if (!reflection.factTrace || reflection.factTrace.length === 0) {
    throw new Error('reflection_missing_fact_trace');
  }

  if (!reflection.claims || reflection.claims.length === 0) {
    throw new Error('reflection_missing_claims');
  }

  const unsupportedClaimCount = reflection.claims.filter((claim) => !claim.sourceRefs || claim.sourceRefs.length === 0).length;
  const sourceCoverageRatio = (reflection.claims.length - unsupportedClaimCount) / reflection.claims.length;

  if (unsupportedClaimCount > 0) {
    throw new Error('reflection_unsupported_claims');
  }

  const guardedWrites = anchorGuard.filterAllowedWrites(reflection.proposedWrites);

  return {
    summary: reflection.summary,
    claims: reflection.claims,
    writes: guardedWrites,
    sourceRefs: reflection.factTrace,
    modelEvalRef: reflection.evaluationId,
    unsupportedClaimCount,
    sourceCoverageRatio,
  };
}
```

### §3.7 recordDecision

**对应契约**: L0 §5.1 — `recordDecision(decision)`
**准入理由**: 决策链是本系统可解释性的核心。

```ts
async function recordDecision(decision: DecisionRecord): Promise<void> {
  await observability.recordDecision(decision);
  await state.storeDecisionIndex({
    id: decision.id,
    tickId: decision.tickId,
    verdict: decision.verdict,
    reasons: decision.reasons,
    createdAt: decision.createdAt,
  });
}
```

### §3.8 resumeFromCheckpoint

**对应契约**: L0 §5.1 — `resumeFromCheckpoint(checkpointId)`
**准入理由**: 恢复点语义不明显，且涉及重复 effect 防护。

```ts
async function resumeFromCheckpoint(checkpointId: string): Promise<ResumeResult> {
  const checkpoint = await state.loadCheckpoint(checkpointId);
  if (!checkpoint) return { status: 'missing_checkpoint' };

  const commitRecord = await state.loadIntentCommitRecord(checkpoint.intentId);
  if (commitRecord?.state === 'committed') {
    return { status: 'already_committed', intentId: checkpoint.intentId };
  }

  if (commitRecord?.state === 'externally_acknowledged') {
    return { status: 'needs_reconcile', intentId: checkpoint.intentId, commitRecord };
  }

  const snapshot = await state.loadSnapshotByRef(checkpoint.snapshotRef);
  return {
    status: 'ready_to_resume',
    snapshot,
    checkpoint,
  };
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Tick 决策树

**对应 L0 Mermaid**: `control-plane-system.md §4`

```ts
function decideNextAction(snapshot: ContinuitySnapshot, signal: TickSignal): DecisionOutcome {
  const window = selectRhythmWindow(signal.receivedAt, snapshot);

  if (window.topLevelMode === 'paused_for_interrupt') {
    return { action: 'resume_interrupt_handling' };
  }

  if (window.topLevelMode === 'maintenance_only') {
    return { action: 'maintenance_only' };
  }

  if (window.topLevelMode === 'quiet') {
    if (hasHighValueInterrupt(snapshot, signal)) {
      return { action: 'pause_quiet_and_handle_interrupt' };
    }
    return { action: 'run_quiet_pipeline' };
  }

  if (hasPendingObligation(snapshot)) {
    return { action: 'run_obligation' };
  }

  return { action: 'plan_discretionary_intent' };
}
```

### §4.2 Quiet 子决策树

**对应 L0 Mermaid**: `control-plane-system.md §4.4`

```ts
function runQuietPipeline(snapshot: ContinuitySnapshot): QuietPlan {
  if (shouldRefreshIndexes(snapshot)) return { step: 'refresh_indexes' };
  if (reflectionDebtDue(snapshot)) return { step: 'narrative_reflection' };
  if (hasCurationInputs(snapshot)) return { step: 'curate_memory' };
  if (hasReflectionBudget(snapshot)) return { step: 'narrative_reflection' };
  return { step: 'low_frequency_inspection' };
}
```

### §4.3 outreach 价值判断

**对应 L0**: `control-plane-system.md §6.8`

```ts
function shouldAllowOutreach(evalResult: OutreachEvaluationResult): boolean {
  return (
    evalResult.sourceRefs.length > 0 &&
    evalResult.valueScore >= evalResult.minThreshold &&
    !evalResult.isRoutineProgress &&
    (evalResult.requiredUserHelp || evalResult.urgency > 0.5 || evalResult.actionability > 0.6)
  );
}
```

```ts
function buildOutreachMessage(intent: CandidateIntent, decision: DecisionRecord): OutboundMessage {
  return {
    style: 'conversational_micro_message',
    maxSentences: 3,
    avoidFormats: ['ticket', 'daily_report', 'status_broadcast'],
  };
}
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| 同一 tick 反复触发相同意图 | 重复外呼 / 重复发消息 | 使用 `intent_id` + duplicate window 去重 |
| Quiet 中收到高价值平台 interrupt | 既错过机会又破坏 Quiet | 进入 `paused_for_interrupt`，完成后恢复 Quiet |
| Narrative Reflection 输出无事实来源 | 文艺但失真 | 强制 `factTrace`，否则拒绝写入 |
| Narrative Reflection 的 claim 没有 source backing | summary 漂移为虚构推断 | 强制 claim-level 校验，不通过则拒绝 narrative output |
| effect 已在外部成功，但 commit 未完成 | resume 产生幽灵重放 | 引入 `planned -> dispatched -> externally_acknowledged -> committed` 协议；ack 未 commit 时进入 `reconcile` |
| Anchor Memory 更新范围过大 | 人格漂移 | 通过 `anchorGuard` 限制单次更新幅度 |
| lease 失效后 effect 仍在执行 | 双写 / 双发 | lease heartbeat + committed intent 检查 |
| outreach 被生成成客服工单或流水账 | 不像真实关系中的对话 | 默认使用 conversational micro-message style，短句、轻量、保留继续聊的空间 |

### §5.1 Quiet 被频繁打断

```ts
// ❌ 错误做法
// 每个 interrupt 都立即跳出 Quiet 并允许外呼

// ✅ 正确做法
// 先判断 interrupt 是否属于 high-value class，并受 maxInterruptsPerQuietWindow 限制
```

### §5.2 deny path 不写审计

```ts
// ❌ 错误做法
// if (!allowed) return;

// ✅ 正确做法
// 先 recordDecision({ verdict: 'deny', reasons: [...] })，再返回
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeTickSignal(source: TickSignal['source'] = 'cron'): TickSignal {
  return { id: 'tick-test', source, receivedAt: new Date().toISOString() };
}

export function makeSnapshot(overrides: Partial<ContinuitySnapshot> = {}): ContinuitySnapshot {
  return {
    mode: 'active',
    currentWindowId: 'morning-work',
    recentPlatforms: [],
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    ...overrides,
  };
}
```
