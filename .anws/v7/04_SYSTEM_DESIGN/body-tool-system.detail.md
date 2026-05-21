# Body Tool System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`body-tool-system.md`](./body-tool-system.md)
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。
> **孤岛检查**: 本文件各节均在 L0 有对应超链接入口，无孤岛内容。

---

## 版本历史

| 版本 | 日期       | Changelog                                 |
| ---- | ---------- | ----------------------------------------- |
| v1.0 | 2026-05-21 | 初始版本（随 L0 v1.0 创建）               |

---

## 本文件章节索引

|   §   | 章节                                                                                          |     对应 L0 入口      |
| :---: | --------------------------------------------------------------------------------------------- | :-------------------: |
|  §1   | [配置常量](#1-配置常量-config-constants)                                                      |   L0 §6 数据模型末尾  |
|  §2   | [完整数据结构定义](#2-核心数据结构完整定义-full-data-structures)                              |   L0 §6.1 核心实体   |
|  §3   | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode)                          |  L0 §5 操作契约表    |
|  §4   | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details)                                     |  L0 §4.4 状态机图    |
|  §5   | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas)                               |  L0 §5 / §9 安全章节 |
|  §6   | [测试辅助](#6-测试辅助-test-helpers)                                                          |  L0 §11 测试策略     |

---

## §1 配置常量 (Config Constants)

> 所有硬编码配置与枚举映射集中于此，禁止散落在业务代码中。
> **L0 对应入口**: L0 §6 数据模型末尾锚点 → *配置常量字典详见 [L1 §1]*

```typescript
// ── CircuitBreaker 配置 ──
export const CIRCUIT_BREAKER_CONFIG = {
  /** 连续失败阈值，达到后进入 Open 状态 */
  FAILURE_THRESHOLD: 3,

  /** 初始 cooldown 时长（毫秒），进入 Open 后等待此时长再转 HalfOpen */
  INITIAL_COOLDOWN_MS: 5 * 60 * 1000,          // 5 分钟

  /** 指数退避基数：每次 HalfOpen → Open 后 cooldown *= backoffFactor */
  BACKOFF_FACTOR: 2,

  /** 最大 cooldown 上限（毫秒），指数退避不超过此值 */
  MAX_COOLDOWN_MS: 60 * 60 * 1000,             // 1 小时

  /** HalfOpen 阶段允许的单次 wet probe 超时（毫秒） */
  PROBE_TIMEOUT_MS: 10 * 1000,                  // 10 秒
} as const;

// ── BehaviorPromotion 配置 ──
export const BEHAVIOR_PROMOTION_CONFIG = {
  /** 累计观察次数达到此阈值才可创建 candidate entry */
  OBSERVATION_THRESHOLD: 5,

  /** 最大 candidate 条目数（per connector），超过后不再创建新 candidate */
  MAX_CANDIDATES_PER_CONNECTOR: 20,

  /** candidate 过期时间（天），超过后自动标记为 rejected */
  CANDIDATE_EXPIRY_DAYS: 30,
} as const;

// ── ExperienceWriter 配置 ──
export const EXPERIENCE_WRITER_CONFIG = {
  /** ToolExperienceLog bounded query 最大条目数 */
  MAX_EXPERIENCE_ROWS: 1000,

  /** sourceRef 最大字节长度 */
  SOURCE_REF_MAX_BYTES: 512,

  /** 近期失败率计算窗口（条目数） */
  PAIN_SIGNAL_WINDOW: 20,

  /** 超过此失败率触发 moderate 疼痛 */
  PAIN_MODERATE_THRESHOLD: 0.5,

  /** 超过此失败率触发 severe 疼痛 */
  PAIN_SEVERE_THRESHOLD: 0.8,
} as const;

// ── AffordanceAssembler 配置 ──
export const AFFORDANCE_ASSEMBLER_CONFIG = {
  /** affordance map 最大 entry 数（context-aware 过滤后上限） */
  MAX_ENTRIES: 30,

  /** assembly 超时（毫秒），超时后返回已完成的 entries + degraded 标记 */
  ASSEMBLY_TIMEOUT_MS: 800,

  /** breaker state 在同一 heartbeat 内的缓存时间（毫秒） */
  BREAKER_STATE_CACHE_TTL_MS: 30 * 1000,        // 30 秒
} as const;

// ── AffordanceStatus 优先级（数值越小优先级越高，越优先展示）──
export const AFFORDANCE_STATUS_PRIORITY: Record<string, number> = {
  safe:         1,
  exploratory:  2,
  needs_auth:   3,
  painful:      4,
  unavailable:  5,
} as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

> 含方法签名的完整类型定义。L0 层只放属性字段声明（TypeScript interface）。
> **L0 对应入口**: L0 §6.1 核心实体末尾锚点 → *完整方法实现详见 [L1 §2]*

```typescript
// ── AffordanceContextScope: assembleAffordanceMap 的上下文范围 ──
interface AffordanceContextScope {
  /** 当前 heartbeat 关注的平台 IDs，null 表示全平台 */
  platformIds: string[] | null;

  /** 当前 active goal kind，用于过滤相关 capability */
  goalKind: string | null;

  /** 允许返回的 status 类型（用于 control-plane 按场景过滤） */
  allowedStatuses: Array<'safe' | 'exploratory' | 'needs_auth' | 'painful' | 'unavailable'> | null;

  /** 是否包含 unavailable entries（默认 false，减少 agent 噪声） */
  includeUnavailable: boolean;
}

// ── AttemptRecord: recordExperience 的输入 ──
interface AttemptRecord {
  connectorId: string;
  capabilityId: string;
  attemptType: 'execution' | 'delivery' | 'probe';
  outcome: 'success' | 'failure' | 'policy_denied' | 'timeout';
  failureClass: string | null;
  latencyMs: number | null;
  ownerReaction: 'positive' | 'neutral' | 'negative' | 'ignored' | null;
  evidenceQuality: 'high' | 'medium' | 'low';
  triggerSource: 'heartbeat' | 'manual_run' | 'probe';

  /**
   * sourceRef 只接受 ref 格式（ID / 路径），不接受 raw content。
   * 验证规则：不得含 '\n'，不得超过 SOURCE_REF_MAX_BYTES。
   */
  sourceRef: string;

  /**
   * rawPayload 字段仅用于 redaction 流程内部传递。
   * ExperienceWriter 在写入前必须调用 redactPayload，
   * 写入 ToolExperienceRow 时此字段不落盘。
   */
  rawPayload?: unknown;
}

// ── ObservedCapabilityInput: submitBehaviorPromotion 的输入 ──
interface ObservedCapabilityInput {
  connectorId: string;
  capabilityId: string;
  observationCount: number;
  evidenceRefs: string[];
  firstObserved: string;
  lastObserved: string;
}

// ── ExperienceQuery: readExperienceRows 的查询条件 ──
interface ExperienceQuery {
  connectorId?: string;
  capabilityId?: string;
  outcomes?: Array<'success' | 'failure' | 'policy_denied' | 'timeout'>;
  /** 最多返回条目数，默认 MAX_EXPERIENCE_ROWS */
  limit?: number;
  /** 时间范围起点 ISO8601 */
  since?: string;
}

// ── CircuitBreakerAuditEvent: 断路器状态转换 audit 事件 ──
interface CircuitBreakerAuditEvent {
  connectorId: string;
  capabilityId: string;
  fromState: 'closed' | 'open' | 'half_open';
  toState: 'closed' | 'open' | 'half_open';
  reason: string;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  timestamp: string;
}

// ── HealthProbeResult: 来自 observability-health-system 的健康探针结果 ──
interface HealthProbeResult {
  connectorId: string;
  capabilityId: string | null;
  isHealthy: boolean;
  lastProbeAt: string;
  httpStatus: number | null;
  actualEndpoint: string | null;
  endpointMismatch: boolean;
}

// ── RedactedPayload: redaction 结果 ──
interface RedactedPayload {
  redacted: true;
  summary: string | null;
  redactionReason: string;
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 CircuitBreakerManager 状态转换

**对应契约**: L0 §5.1 — `getCircuitBreakerPosture()` 及内部状态评估
**准入理由**: 多步骤副作用链（失败计数 → 状态转换 → 持久化 → audit）；状态机分支不明显

```typescript
/**
 * 评估 connector attempt 结果并更新 CircuitBreaker 状态。
 *
 * 前置条件:
 * 1. connectorId 和 capabilityId 有效
 * 2. state-memory-system 可写
 * 3. observability-health-system audit 可写
 *
 * 副作用:
 * - 更新 CircuitBreakerState 到 state-memory-system
 * - 写入 CircuitBreakerAuditEvent 到 observability-health-system
 */
async function evaluateAttemptAndUpdateBreaker(
  connectorId: string,
  capabilityId: string,
  outcome: 'success' | 'failure' | 'policy_denied' | 'timeout',
  statePort: IBodyToolStatePort,
  obsPort: IBodyToolObsPort,
): Promise<CircuitBreakerState> {
  const current = await statePort.readBreakerState(connectorId, capabilityId)
    ?? defaultClosedState(connectorId, capabilityId);

  let next: CircuitBreakerState;

  if (current.state === 'closed') {
    if (outcome === 'success') {
      // 成功：重置失败计数，保持 Closed
      next = { ...current, consecutiveFailures: 0, updatedAt: now() };
    } else {
      // 失败：递增计数，检查是否达阈值
      const newCount = current.consecutiveFailures + 1;
      if (newCount >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) {
        const cooldownUntil = addMs(now(), CIRCUIT_BREAKER_CONFIG.INITIAL_COOLDOWN_MS);
        next = { ...current, state: 'open', consecutiveFailures: newCount,
                 lastFailureAt: now(), cooldownUntil, updatedAt: now() };
        await obsPort.writeCircuitBreakerAudit(buildAuditEvent(current, next, 'failure_threshold_reached'));
      } else {
        next = { ...current, consecutiveFailures: newCount, lastFailureAt: now(), updatedAt: now() };
      }
    }
  } else if (current.state === 'open') {
    // Open 状态：检查 cooldown 是否到期
    if (isBefore(current.cooldownUntil!, now())) {
      // cooldown 到期：转 HalfOpen
      next = { ...current, state: 'half_open', lastProbeAt: null, updatedAt: now() };
      await obsPort.writeCircuitBreakerAudit(buildAuditEvent(current, next, 'cooldown_expired'));
    } else {
      // 仍在 cooldown 中：记录失败但不改变状态
      next = { ...current, updatedAt: now() };
    }
  } else {
    // HalfOpen 状态：wet probe 结果决定下一步
    if (outcome === 'success') {
      // probe 成功：恢复 Closed，重置失败计数
      next = { ...current, state: 'closed', consecutiveFailures: 0,
               cooldownUntil: null, lastProbeAt: now(), updatedAt: now() };
      await obsPort.writeCircuitBreakerAudit(buildAuditEvent(current, next, 'probe_success'));
    } else {
      // probe 失败：重新 Open，指数退避延长 cooldown
      const prevCooldownMs = cooldownDurationMs(current);
      const nextCooldownMs = Math.min(
        prevCooldownMs * CIRCUIT_BREAKER_CONFIG.BACKOFF_FACTOR,
        CIRCUIT_BREAKER_CONFIG.MAX_COOLDOWN_MS,
      );
      const cooldownUntil = addMs(now(), nextCooldownMs);
      next = { ...current, state: 'open', consecutiveFailures: current.consecutiveFailures + 1,
               lastFailureAt: now(), cooldownUntil, lastProbeAt: now(), updatedAt: now() };
      await obsPort.writeCircuitBreakerAudit(buildAuditEvent(current, next, 'probe_failure'));
    }
  }

  await statePort.writeBreakerState(next);
  return next;
}
```

> **注意事项**: HalfOpen 状态下严格允许单次 wet probe（由 ProbeSignalAdapter 控制调用频率）；不允许在 HalfOpen 期间多次 probe。cooldown 到期判断使用服务端时间，不依赖客户端时钟。

---

### §3.2 `assembleAffordanceMap`

**对应契约**: L0 §5.1 — `assembleAffordanceMap(contextScope)`
**准入理由**: 多源并发读取 + 过滤逻辑 + 降级处理，顺序不可颠倒

```typescript
/**
 * 组装 agent-facing ToolAffordanceMap。
 *
 * 前置条件:
 * 1. connector-system 可查询（降级时返回空 entries）
 * 2. state-memory-system 可读（降级时 breaker state 假设为 Closed）
 * 3. observability-health-system 可读（降级时 health probe 标记 unknown）
 *
 * 副作用:
 * - 无持久化副作用（纯读操作）
 * - assembly 耗时写入 observability trace
 */
async function assembleAffordanceMap(
  scope: AffordanceContextScope,
  connectorPort: IConnectorSystemPort,
  statePort: IBodyToolStatePort,
  obsPort: IBodyToolObsPort,
): Promise<ToolAffordanceMap> {
  const startAt = Date.now();

  // Step 1: 并发读取所有依赖源（设置整体超时）
  const [inventory, healthProbes] = await Promise.allSettled([
    connectorPort.getConnectorInventory({ platformIds: scope.platformIds }),
    obsPort.getHealthProbeResults(scope.platformIds ?? []),
  ]);

  const connectors = inventory.status === 'fulfilled' ? inventory.value : [];
  const probes = healthProbes.status === 'fulfilled' ? healthProbes.value : [];

  // Step 2: 读取所有相关 connector 的 breaker states（批量）
  const connectorIds = connectors.map(c => c.connectorId);
  const breakerStates = await statePort.readBreakerStatesBatch(connectorIds)
    .catch(() => new Map<string, CircuitBreakerState>());

  // Step 3: 逐个 connector capability 构建 entry
  const rawEntries: ToolAffordanceEntry[] = [];

  for (const connector of connectors) {
    for (const capability of connector.capabilities) {
      const breakerState = breakerStates.get(`${connector.connectorId}:${capability.capabilityId}`)
        ?? defaultClosedState(connector.connectorId, capability.capabilityId);
      const probeResult = probes.find(p =>
        p.connectorId === connector.connectorId && p.capabilityId === capability.capabilityId
      ) ?? null;

      const status = deriveAffordanceStatus(connector.trustTier, breakerState, probeResult, capability);
      const entry: ToolAffordanceEntry = {
        connectorId: connector.connectorId,
        capabilityId: capability.capabilityId,
        status,
        trustTier: connector.trustTier,
        circuitBreakerState: breakerState.state,
        lastSuccess: capability.lastSuccessAt ?? null,
        lastFailure: capability.lastFailureAt ?? null,
        painReason: status === 'painful' ? buildPainReason(breakerState, probeResult) : null,
        unavailableReason: status === 'unavailable' ? buildUnavailableReason(breakerState, connector.trustTier) : null,
        recommendedProbe: status === 'exploratory' || status === 'painful' ? capability.safeProbeEndpoint ?? null : null,
      };

      rawEntries.push(entry);
    }
  }

  // Step 4: context-aware 过滤（allowedStatuses + goalKind + platformId）
  const filtered = applyContextFilter(rawEntries, scope);

  // Step 5: 按 status 优先级排序，截取 MAX_ENTRIES
  const sorted = filtered
    .sort((a, b) => AFFORDANCE_STATUS_PRIORITY[a.status] - AFFORDANCE_STATUS_PRIORITY[b.status])
    .slice(0, AFFORDANCE_ASSEMBLER_CONFIG.MAX_ENTRIES);

  return {
    assembledAt: new Date().toISOString(),
    contextScope: scope,
    entries: sorted,
    totalConnectors: connectors.length,
    filteredCount: sorted.length,
  };
}

/**
 * 根据 trustTier、breakerState、health probe 派生 AffordanceStatus。
 *
 * 派生规则（优先级从高到低）:
 * 1. breakerState = 'open' → 'painful'（cooldown 中）
 * 2. trustTier = 'unknown' → 'unavailable'
 * 3. trustTier = 'restricted' → 'needs_auth'
 * 4. probeResult.endpointMismatch = true → 'unavailable'
 * 5. probeResult.isHealthy = false → 'painful'
 * 6. breakerState = 'half_open' → 'exploratory'（可试探）
 * 7. trustTier = 'system' || 'trusted' → 'safe'
 * 8. default → 'exploratory'
 */
function deriveAffordanceStatus(
  trustTier: string,
  breaker: CircuitBreakerState,
  probe: HealthProbeResult | null,
  capability: ConnectorCapabilityMeta,
): ToolAffordanceEntry['status'] {
  if (breaker.state === 'open') return 'painful';
  if (trustTier === 'unknown') return 'unavailable';
  if (trustTier === 'restricted') return 'needs_auth';
  if (probe?.endpointMismatch) return 'unavailable';
  if (probe !== null && !probe.isHealthy) return 'painful';
  if (breaker.state === 'half_open') return 'exploratory';
  if (trustTier === 'system' || trustTier === 'trusted') return 'safe';
  return 'exploratory';
}
```

---

### §3.3 `recordExperience`

**对应契约**: L0 §5.1 — `recordExperience(attempt)`
**准入理由**: 多步骤副作用链（redaction → validate → write → breaker evaluate）

```typescript
/**
 * 将 connector attempt 转写为 ToolExperienceRow 并触发 breaker 评估。
 *
 * 副作用:
 * - 写入 ToolExperienceRow 到 state-memory-system
 * - 调用 evaluateAttemptAndUpdateBreaker（可能更新 breaker state）
 * - 写入 audit event
 */
async function recordExperience(
  attempt: AttemptRecord,
  statePort: IBodyToolStatePort,
  obsPort: IBodyToolObsPort,
): Promise<void> {
  // Step 1: redaction — 拒绝 raw payload
  if (attempt.rawPayload !== undefined) {
    const redacted = obsPort.redactPayload(attempt.rawPayload);
    if (!redacted.redacted) {
      // redaction 失败：写入 audit 并中止
      await obsPort.writeExperienceAudit({ ...attempt, redactionFailed: true } as any);
      return;
    }
    // rawPayload 已处理，不落盘
  }

  // Step 2: 验证 sourceRef 格式
  if (!isValidSourceRef(attempt.sourceRef)) {
    throw new Error(`invalid_source_ref: ${attempt.sourceRef}`);
  }

  // Step 3: 构建 ToolExperienceRow（不含 rawPayload）
  const row: ToolExperienceRow = {
    experienceId: generateId(),
    connectorId: attempt.connectorId,
    capabilityId: attempt.capabilityId,
    attemptType: attempt.attemptType,
    outcome: attempt.outcome,
    failureClass: attempt.failureClass,
    latencyMs: attempt.latencyMs,
    ownerReaction: attempt.ownerReaction,
    evidenceQuality: attempt.evidenceQuality,
    triggerSource: attempt.triggerSource,
    timestamp: new Date().toISOString(),
    sourceRef: attempt.sourceRef,
  };

  // Step 4: 写入 state-memory-system
  await statePort.writeExperienceRow(row);

  // Step 5: 触发 CircuitBreaker 评估（仅 execution / probe 类型）
  if (attempt.attemptType !== 'delivery') {
    await evaluateAttemptAndUpdateBreaker(
      attempt.connectorId,
      attempt.capabilityId,
      attempt.outcome,
      statePort,
      obsPort,
    );
  }
}
```

---

### §3.4 `getCircuitBreakerPosture`

**对应契约**: L0 §5.1 — `getCircuitBreakerPosture(connectorId, capabilityId?)`
**准入理由**: 含状态机枚举映射 + 跨 capability 聚合逻辑

```typescript
/**
 * 返回 connector（可选 capability）的 CircuitBreakerPosture。
 * capabilityId 为 null 时，聚合该 connector 所有 capability 的最劣状态。
 */
async function getCircuitBreakerPosture(
  connectorId: string,
  capabilityId: string | null,
  statePort: IBodyToolStatePort,
): Promise<CircuitBreakerPosture> {
  if (capabilityId !== null) {
    const state = await statePort.readBreakerState(connectorId, capabilityId)
      ?? defaultClosedState(connectorId, capabilityId);
    return stateToPosture(state, capabilityId);
  }

  // 聚合 connector 所有 capability 的最劣状态
  const allStates = await statePort.readBreakerStatesByConnector(connectorId);
  if (allStates.length === 0) {
    return { connectorId, capabilityId: null, state: 'closed',
             cooldownUntil: null, consecutiveFailures: 0, recommendedProbe: null };
  }

  // 最劣状态优先级: open > half_open > closed
  const worst = allStates.reduce((prev, cur) => {
    const priority = { open: 3, half_open: 2, closed: 1 };
    return priority[cur.state] > priority[prev.state] ? cur : prev;
  });

  return stateToPosture(worst, null);
}

function stateToPosture(state: CircuitBreakerState, capabilityId: string | null): CircuitBreakerPosture {
  return {
    connectorId: state.connectorId,
    capabilityId,
    state: state.state,
    cooldownUntil: state.cooldownUntil,
    consecutiveFailures: state.consecutiveFailures,
    recommendedProbe: state.state === 'half_open' ? buildRecommendedProbe(state) : null,
  };
}
```

---

### §3.5 `submitBehaviorPromotion`

**对应契约**: L0 §5.1 — `submitBehaviorPromotion(observedCapability)`
**准入理由**: 含重复检测 + 阈值校验 + 状态创建/更新逻辑

```typescript
/**
 * 提交行为提升候选。observationCount >= threshold 时创建/更新 candidate entry。
 * 不自动 approve，不授予执行权。
 */
async function submitBehaviorPromotion(
  input: ObservedCapabilityInput,
  statePort: IBodyToolStatePort,
  obsPort: IBodyToolObsPort,
): Promise<BehaviorPromotionEntry> {
  // Step 1: 检查 observationCount 阈值
  if (input.observationCount < BEHAVIOR_PROMOTION_CONFIG.OBSERVATION_THRESHOLD) {
    throw new Error(`observation_count_below_threshold: ${input.observationCount}`);
  }

  // Step 2: 查找是否已有 candidate entry
  const existing = await statePort.readPromotionEntries(input.connectorId);
  const match = existing.find(e => e.observedCapabilityId === input.capabilityId
    && (e.status === 'candidate' || e.status === 'submitted'));

  if (match) {
    // Step 3a: 已有 candidate，更新 observationCount 和 evidenceRefs
    const updated: BehaviorPromotionEntry = {
      ...match,
      observationCount: Math.max(match.observationCount, input.observationCount),
      lastObserved: input.lastObserved,
      evidenceRefs: deduplicateRefs([...match.evidenceRefs, ...input.evidenceRefs]),
    };
    await statePort.writePromotionEntry(updated);
    return updated;
  }

  // Step 3b: 检查 per-connector 上限
  const candidateCount = existing.filter(e => e.status === 'candidate' || e.status === 'submitted').length;
  if (candidateCount >= BEHAVIOR_PROMOTION_CONFIG.MAX_CANDIDATES_PER_CONNECTOR) {
    throw new Error(`max_candidates_reached: ${input.connectorId}`);
  }

  // Step 4: 创建新 candidate entry
  const entry: BehaviorPromotionEntry = {
    promotionId: generateId(),
    connectorId: input.connectorId,
    observedCapabilityId: input.capabilityId,
    observationCount: input.observationCount,
    firstObserved: input.firstObserved,
    lastObserved: input.lastObserved,
    status: 'candidate',
    submittedBy: null,
    reviewedBy: null,
    reviewedAt: null,
    evidenceRefs: input.evidenceRefs,
  };

  await statePort.writePromotionEntry(entry);
  return entry;
}
```

---

### §3.6 `approveBehaviorPromotion`

**对应契约**: L0 §5.1 — `approveBehaviorPromotion(promotionId)`
**准入理由**: 含 operator 身份验证 + 状态转换 + audit 写入，不自动授权执行

```typescript
/**
 * operator 批准行为提升候选。
 * 更新 status 为 approved，写入 audit，不自动授予 connector 执行权。
 */
async function approveBehaviorPromotion(
  promotionId: string,
  operatorId: string,
  statePort: IBodyToolStatePort,
  obsPort: IBodyToolObsPort,
): Promise<BehaviorPromotionEntry> {
  const entry = await statePort.readPromotionEntryById(promotionId);
  if (!entry) throw new Error(`promotion_not_found: ${promotionId}`);
  if (entry.status !== 'submitted' && entry.status !== 'candidate') {
    throw new Error(`invalid_promotion_status: ${entry.status}`);
  }

  const approved: BehaviorPromotionEntry = {
    ...entry,
    status: 'approved',
    reviewedBy: operatorId,
    reviewedAt: new Date().toISOString(),
  };

  await statePort.writePromotionEntry(approved);
  await obsPort.writePromotionAudit({
    promotionId,
    action: 'approved',
    operatorId,
    timestamp: approved.reviewedAt!,
  });

  return approved;
}
```

---

### §3.7 `getPainSignal`

**对应契约**: L0 §5.1 — `getPainSignal(connectorId, capabilityId?)`
**准入理由**: 含滑动窗口计算 + 多级 painLevel 枚举映射

```typescript
/**
 * 聚合近期 experience rows 计算疼痛信号。
 * 使用 PAIN_SIGNAL_WINDOW 条最近记录计算失败率。
 */
async function getPainSignal(
  connectorId: string,
  capabilityId: string | null,
  statePort: IBodyToolStatePort,
): Promise<PainSignal> {
  const rows = await statePort.readExperienceRows({
    connectorId,
    capabilityId: capabilityId ?? undefined,
    limit: EXPERIENCE_WRITER_CONFIG.PAIN_SIGNAL_WINDOW,
  });

  if (rows.length === 0) {
    return { connectorId, capabilityId, painLevel: 'none',
             recentFailureRate: 0, consecutiveFailures: 0,
             cooldownRecommended: false, lastOutcomes: [] };
  }

  const failureOutcomes: Set<string> = new Set(['failure', 'timeout']);
  const failures = rows.filter(r => failureOutcomes.has(r.outcome)).length;
  const recentFailureRate = failures / rows.length;

  // 计算当前连续失败数（从最新往前数）
  let consecutiveFailures = 0;
  for (const row of rows) {
    if (failureOutcomes.has(row.outcome)) consecutiveFailures++;
    else break;
  }

  let painLevel: PainSignal['painLevel'];
  if (recentFailureRate >= EXPERIENCE_WRITER_CONFIG.PAIN_SEVERE_THRESHOLD) painLevel = 'severe';
  else if (recentFailureRate >= EXPERIENCE_WRITER_CONFIG.PAIN_MODERATE_THRESHOLD) painLevel = 'moderate';
  else if (recentFailureRate > 0) painLevel = 'mild';
  else painLevel = 'none';

  return {
    connectorId,
    capabilityId,
    painLevel,
    recentFailureRate,
    consecutiveFailures,
    cooldownRecommended: consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD,
    lastOutcomes: rows.map(r => r.outcome),
  };
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

> 对应 L0 §4.4 CircuitBreaker 状态机图的完整文字展开。
> **L0 对应入口**: L0 §4.4 状态机图注释 → *完整状态转换伪代码见 [L1 §3.1] 与 [L1 §4.1]*

### §4.1 AffordanceStatus 派生决策树

**对应 L0**: `body-tool-system.md §4.1 架构图` + `§4.4 状态机`

```
deriveAffordanceStatus(trustTier, breakerState, probeResult, capability):

  RULE 1: breakerState.state = 'open'
    → return 'painful'
    (reason: connector 在 cooldown 中，不推荐执行)

  RULE 2: trustTier = 'unknown'
    → return 'unavailable'
    (reason: 未知信任等级，不可感知)

  RULE 3: trustTier = 'restricted'
    → return 'needs_auth'
    (reason: 需要授权，可见但不可执行)

  RULE 4: probeResult != null AND probeResult.endpointMismatch = true
    → return 'unavailable'
    (reason: declared endpoint 与 actual 不一致，wet probe 已确认)

  RULE 5: probeResult != null AND probeResult.isHealthy = false
    → return 'painful'
    (reason: 健康探针失败，当前不健康)

  RULE 6: breakerState.state = 'half_open'
    → return 'exploratory'
    (reason: breaker 半开，可以发起单次探针试探)

  RULE 7: trustTier = 'system' OR trustTier = 'trusted'
    → return 'safe'
    (reason: 高信任等级且 breaker 正常)

  DEFAULT:
    → return 'exploratory'
    (reason: 中等信任等级，可试探但不保证安全)
```

### §4.2 BehaviorPromotionEntry 状态流转

```
状态转换规则:

  candidate
    → submitted  : 由 agent 或 runtime-ops 发起提交审批请求
    → rejected   : operator 拒绝或 CANDIDATE_EXPIRY_DAYS 到期

  submitted
    → approved   : operator 显式批准（approveBehaviorPromotion）
    → rejected   : operator 显式拒绝

  approved
    → (terminal) : 不可逆，已进入 connector manifest 候选
    注意: approved 不自动授予执行权；需要 connector-system 单独的 trust policy 更新

  rejected
    → (terminal) : 不可逆
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

> 实现时必须处理的非显而易见情况。
> **L0 对应入口**: L0 §5 操作契约表与 §9 安全章节

| 场景                                          | 风险                                         | 处理方式                                                                                       |
| --------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `state-memory-system` 不可读时请求 breaker state | breaker state 丢失，Open connector 被误判为可用 | 返回默认 Closed 状态 + `breaker_state_degraded` trace 标记；heartbeat 继续但 trace 记录降级    |
| `connector-system` 不可查询时 assembleAffordanceMap | 返回空视图，agent 无工具可用                  | 返回 `entries: []` + `inventory_unavailable` 标记；control-plane 检查 filteredCount = 0 时降级 |
| rawPayload 字段携带 private content 写入 experience | private content 落盘                         | ExperienceWriter 对 rawPayload 调用 redaction；失败时整条记录拒绝写入，写入 audit              |
| HalfOpen 阶段被多次并发调用 probe              | 多次 probe 触发副作用                         | ProbeSignalAdapter 使用 per-capability 互斥锁；HalfOpen 期间严格一次 probe                    |
| connector manifest 中 capabilityId 重名       | affordance entry 重复                         | AffordanceAssembler 对 `connectorId:capabilityId` 做唯一化，重复时保留最新                     |
| breaker state 写入失败（SQLite 锁/磁盘满）     | 状态转换丢失，下次 heartbeat 重复触发 Open    | 写入失败时返回原 state + `breaker_write_failed` audit；不阻断 experience row 写入              |
| `observability-health-system` audit 不可写    | 状态转换无 audit trace                        | 降级记录到本地 error log；不阻塞 breaker 状态转换或 experience row 写入                        |
| assembleAffordanceMap 超时（ASSEMBLY_TIMEOUT_MS）| 部分 connector 未组装进 affordance map      | 返回已完成 entries + `assembly_partial` 标记；超时的 connector 以 unknown health 状态处理     |
| 旧版 connector manifest 无 safeProbeEndpoint  | recommendedProbe 为 null，HalfOpen 无法探针  | recommendedProbe 为 null 时不强制 HalfOpen probe；breaker 等待完整 cooldown 后重试              |

### §5.1 HalfOpen 并发 probe 互斥

```typescript
// 错误做法：两个并发 heartbeat 同时发现 HalfOpen，各自发起 probe，结果冲突
// const state = await readBreakerState(...)  // state = half_open
// await connectorSystem.probe(...)           // 两次并发 probe

// 正确做法：per-capability 互斥锁，HalfOpen 期间严格一次 probe
const lockKey = `probe_lock:${connectorId}:${capabilityId}`;
const acquired = await tryAcquireLock(lockKey, CIRCUIT_BREAKER_CONFIG.PROBE_TIMEOUT_MS);
if (!acquired) {
  // 已有 probe 在进行，跳过
  return;
}
try {
  await doWetProbe(connectorId, capabilityId);
} finally {
  await releaseLock(lockKey);
}
```

### §5.2 sourceRef 验证

```typescript
// 错误做法：直接接受任意字符串作为 sourceRef
// const row = { sourceRef: rawApiResponse }  // 可能含 private content

// 正确做法：强制 ref 格式，拒绝含换行符或超长字符串
function isValidSourceRef(ref: string): boolean {
  if (!ref || ref.length === 0) return false;
  if (ref.includes('\n') || ref.includes('\r')) return false;
  if (Buffer.byteLength(ref, 'utf8') > EXPERIENCE_WRITER_CONFIG.SOURCE_REF_MAX_BYTES) return false;
  // ref 应为 ID / 路径格式，不应含 JSON 或 HTTP 响应体特征
  if (ref.startsWith('{') || ref.startsWith('[')) return false;
  return true;
}
```

---

## §6 测试辅助 (Test Helpers)

> 单元测试和集成测试中复用的工厂函数与 mock。
> **L0 对应入口**: L0 §11 测试策略锚点

```typescript
// ── CircuitBreakerState 工厂 ──
function makeClosedBreakerState(
  connectorId = 'test-connector',
  capabilityId = 'test-cap',
): CircuitBreakerState {
  return {
    connectorId,
    capabilityId,
    state: 'closed',
    consecutiveFailures: 0,
    lastFailureAt: null,
    cooldownUntil: null,
    lastProbeAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function makeOpenBreakerState(
  connectorId = 'test-connector',
  capabilityId = 'test-cap',
  cooldownMinutes = 5,
): CircuitBreakerState {
  const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
  return {
    connectorId,
    capabilityId,
    state: 'open',
    consecutiveFailures: CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD,
    lastFailureAt: new Date().toISOString(),
    cooldownUntil,
    lastProbeAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function makeHalfOpenBreakerState(
  connectorId = 'test-connector',
  capabilityId = 'test-cap',
): CircuitBreakerState {
  return {
    connectorId,
    capabilityId,
    state: 'half_open',
    consecutiveFailures: CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD,
    lastFailureAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    cooldownUntil: new Date(Date.now() - 1000).toISOString(), // 已过期
    lastProbeAt: null,
    updatedAt: new Date().toISOString(),
  };
}

// ── ToolExperienceRow 工厂 ──
function makeExperienceRow(overrides: Partial<ToolExperienceRow> = {}): ToolExperienceRow {
  return {
    experienceId: `exp-${Date.now()}`,
    connectorId: 'test-connector',
    capabilityId: 'test-cap',
    attemptType: 'execution',
    outcome: 'success',
    failureClass: null,
    latencyMs: 200,
    ownerReaction: null,
    evidenceQuality: 'medium',
    triggerSource: 'heartbeat',
    timestamp: new Date().toISOString(),
    sourceRef: 'ref://test/evidence/001',
    ...overrides,
  };
}

// ── AttemptRecord 工厂 ──
function makeAttemptRecord(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    connectorId: 'test-connector',
    capabilityId: 'test-cap',
    attemptType: 'execution',
    outcome: 'success',
    failureClass: null,
    latencyMs: 150,
    ownerReaction: null,
    evidenceQuality: 'medium',
    triggerSource: 'heartbeat',
    sourceRef: 'ref://test/attempt/001',
    ...overrides,
  };
}

// ── MockStatePort ──
function makeMockStatePort(
  initialBreakerState?: CircuitBreakerState,
): jest.Mocked<IBodyToolStatePort> {
  const stateStore = new Map<string, CircuitBreakerState>();
  if (initialBreakerState) {
    stateStore.set(
      `${initialBreakerState.connectorId}:${initialBreakerState.capabilityId}`,
      initialBreakerState,
    );
  }
  return {
    readBreakerState: jest.fn(async (connectorId, capabilityId) =>
      stateStore.get(`${connectorId}:${capabilityId}`) ?? null,
    ),
    writeBreakerState: jest.fn(async (state) => {
      stateStore.set(`${state.connectorId}:${state.capabilityId}`, state);
    }),
    writeExperienceRow: jest.fn(async () => {}),
    readExperienceRows: jest.fn(async () => []),
    writePromotionEntry: jest.fn(async () => {}),
    readPromotionEntries: jest.fn(async () => []),
    readBreakerStatesBatch: jest.fn(async () => new Map()),
    readBreakerStatesByConnector: jest.fn(async () => []),
    readPromotionEntryById: jest.fn(async () => null),
  } as jest.Mocked<IBodyToolStatePort>;
}
```
