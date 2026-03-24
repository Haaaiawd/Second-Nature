# Control Plane System — 实现细节 (L1)

> **对应 L0**: [control-plane-system.md](./control-plane-system.md)

---

## 版本历史

| 版本 | 日期 | Changelog |
| ---- | ------------ | --------- |
| v1.0 | 2026-03-22 | 初始版本 |

---

## 章节索引

| § | 章节 | 对应 L0 |
| :---: | ---- | :-----------: |
| §1 | [配置常量](#1-配置常量) | L0 §6 |
| §2 | [数据结构](#2-数据结构) | L0 §6 |
| §3 | [核心算法](#3-核心算法) | L0 §5 |
| §4 | [决策树](#4-决策树) | L0 §4 |
| §5 | [边缘情况](#5-边缘情况) | L0 §5/§9 |
| §6 | [测试辅助](#6-测试辅助) | L0 §11 |

---

## §1 配置常量

```typescript
export const SCHEDULER_CONFIG = {
  checkIntervalMs: 1000,           // 调度检查间隔
  maxConcurrentHeartbeats: 3,      // 最大并发心跳数
  heartbeatPriority: 2,            // 心跳优先级
  explorationPriority: 1,          // 探索优先级
  explorationLeaseTtlMs: 90 * 1000, // exploration 全局租约 TTL
} as const;

export const STATE_MACHINE_CONFIG = {
  // PENDING_VERIFICATION 超时
  verificationTimeoutMs: 5 * 60 * 1000,  // 5分钟
  
  // 冷却期计算
  coolingBaseMs: 5 * 60 * 1000,          // 基础 5分钟
  coolingMultiplier: 1.5,                // 错误时倍数
  maxCoolingMs: 60 * 60 * 1000,        // 最大 1小时
} as const;

export const LLM_CONFIG = {
  reflectionTimeoutMs: 15000,      // 15s 超时
  reflectionCacheTtlMs: 3600000,  // 1小时缓存
  maxRetries: 2,
} as const;

export const BUDGET_CONFIG = {
  defaultDailyDuration: 60,        // 默认每日60分钟
  defaultSessionDuration: 10,      // 默认单次10分钟
  defaultDailyInteractions: 10,    // 默认每日10次互动
} as const;
```

---

## §2 数据结构

### 2.1 ExplorationSession（运行时模型）

> **持久化模型定义于**: [state-system.detail.md §2.2](./state-system.detail.md)
>
> 运行时模型是持久化模型的内存投影，支持状态机流转和业务方法。

```typescript
export class ExplorationSession {
  // 基础信息（与持久化模型一致）
  id: string;                       
  state: ExplorationState;
  platformId: string;
  
  // 时间（与持久化模型一致）
  startTime: ISO8601String;
  endTime?: ISO8601String;
  
  // 预算快照（与持久化模型一致）
  budgetSnapshot: {
    globalRemaining: number;       
    platformRemaining: number;   
    interactionsRemaining: number; 
  };
  
  // 运行时对象（序列化后存于持久化的 actionsJson）
  actions: SessionAction[];
  
  // 运行时对象（序列化后存于持久化的 reflectionJson）
  reflection?: ReflectionResult;
  
  // 运行时对象（序列化后存于持久化的 contextJson）
  // 用于平台选择上下文恢复、状态流转决策
  context: SessionContext;

  constructor(init: SessionInit) {
    this.id = generateUUID();
    this.state = 'IDLE';
    this.platformId = init.platformId;
    this.startTime = now();
    this.budgetSnapshot = init.budgetSnapshot;
    this.actions = [];
    this.context = init.context;
  }
  
  addAction(action: SessionAction): void {
    this.actions.push(action);
  }
  
  canTransition(to: ExplorationState): boolean {
    // 状态流转合法性检查
    const validTransitions: Record<ExplorationState, ExplorationState[]> = {
      IDLE: ['SELECTING'],
      SELECTING: ['CONNECTING', 'COOLING_DOWN'],
      CONNECTING: ['ACTING', 'PENDING_VERIFICATION', 'COOLING_DOWN'],
      PENDING_VERIFICATION: ['CONNECTING', 'COOLING_DOWN'],
      ACTING: ['ACTING', 'REFLECTING', 'COOLING_DOWN'],
      REFLECTING: ['COOLING_DOWN'],
      COOLING_DOWN: ['IDLE'],
    };
    return validTransitions[this.state]?.includes(to) ?? false;
  }
}

// 会话上下文（用于状态恢复）
export interface SessionContext {
  // 平台选择上下文
  selection?: {
    reason: string;                    // 选择理由
    score: number;                     // 平台评分
    forced: boolean;                   // 是否强制选择（如心跳优先）
    breakdown?: Record<string, number>; // 评分拆解
  };
  
  // 用户目标（用于恢复后决策一致性）
  currentGoal?: {
    description: string;
    tags: string[];
    priority: number;
  };
  
  // 历史参考
  history?: {
    lastVisitTime?: number;
    recentPlatforms: string[];         // 最近访问的平台
  };
  
  // 恢复标记
  resumedFromSessionId?: string;       // 从哪个会话恢复
  resumeCount: number;                  // 恢复次数（防止无限恢复）

  lease?: {
    leaseKey: 'global-exploration';
    ownerId: string;
    acquiredAt: ISO8601String;
    expiresAt: ISO8601String;
  };
}

export interface SessionAction {
  id: string;
  type: 'maintain_presence' | 'discover' | 'engage' | 'sync_inbox';
  budgetClass: 'obligation' | 'discretionary';
  timestamp: ISO8601String;
  status: 'success' | 'failure' | 'skipped';
  result?: unknown;
  error?: string;
}
```

### 2.2 PlatformPolicy

```typescript
export interface PlatformPolicy {
  platformId: string;
  
  budget: {
    dailyDuration: number;      // 分钟
    sessionDuration: number;    // 分钟
    dailyInteractions: number;
  };
  
  scheduling: {
    priority: number;           // 0-100
    coolingPeriod: number;      // 分钟
    heartbeatInterval?: number; // 毫秒
  };
  
  relevanceTags: string[];      // 用于目标匹配
}
```

### 2.3 ReflectionResult

```typescript
export interface ReflectionResult {
  summary: string;                    // 一句话摘要
  keyTakeaways: string[];             // 最多3条
  interactionQuality: 'high' | 'medium' | 'low';
  followUpSuggestions: string[];      // 最多2条
  emotionalTone?: string;
  
  // 元数据
  generatedAt: ISO8601String;
  llmLatencyMs: number;
  modelVersion: string;
}

export interface ExplorationLease {
  leaseKey: 'global-exploration';
  sessionId: string;
  ownerId: string;
  traceId: string;
  reason: 'scheduled_exploration' | 'manual_trigger' | 'resume_recovery';
  acquiredAt: ISO8601String;
  heartbeatAt: ISO8601String;
  expiresAt: ISO8601String;
}
```

---

## §3 核心算法

### §3.1 PlatformSelector.calculateScore()

**对应契约**: L0 §5.1 — `selectPlatform()`

```typescript
function calculatePlatformScore(
  platform: PlatformPolicy,
  context: SelectionContext
): PlatformScore {
  /**
   * 多因子评分算法。
   * 
   * Score = α×Priority + β×(1-BudgetConsumed) + γ×Relevance + δ×CoolingFactor
   */
  
  const { budget, history, currentGoal } = context;
  
  // α: 固定优先级权重 (0-1)
  const α = 0.3;
  const priorityScore = normalizePriority(platform.scheduling.priority);
  
  // β: 预算剩余因子 (0-1, 耗尽时 0)
  const β = 0.3;
  const budgetConsumed = 1 - (budget.platformRemaining / budget.platformTotal);
  const budgetScore = 1 - budgetConsumed;
  
  // γ: 目标相关性 (0-1)
  const γ = 0.25;
  const relevanceScore = calculateRelevance(
    currentGoal?.tags || [],
    platform.relevanceTags
  );
  
  // δ: 冷却因子 (0-1, 刚访问过时接近 0)
  const δ = 0.15;
  const coolingScore = calculateCoolingFactor(
    history.lastVisitTime,
    platform.scheduling.coolingPeriod
  );
  
  // 综合评分
  const score = 
    α * priorityScore +
    β * budgetScore +
    γ * relevanceScore +
    δ * coolingScore;
  
  return {
    platformId: platform.platformId,
    score,
    breakdown: { α: priorityScore, β: budgetScore, γ: relevanceScore, δ: coolingScore },
  };
}

function calculateRelevance(goalTags: string[], platformTags: string[]): number {
  if (goalTags.length === 0 || platformTags.length === 0) return 0.5;
  
  const intersection = goalTags.filter(t => platformTags.includes(t));
  const union = [...new Set([...goalTags, ...platformTags])];
  
  return intersection.length / union.length;
}

function calculateCoolingFactor(
  lastVisitTime: number | null,
  coolingPeriodMinutes: number
): number {
  if (!lastVisitTime) return 1;  // 从未访问，无冷却
  
  const elapsedMs = Date.now() - lastVisitTime;
  const coolingMs = coolingPeriodMinutes * 60 * 1000;
  
  if (elapsedMs >= coolingMs) return 1;  // 冷却完成
  
  // 线性冷却曲线
  return elapsedMs / coolingMs;
}
```

> **注意事项**: 评分权重可调，强制优先模式提升 γ 到 0.5

---

### §3.2 Scheduler.getNextEvents()

**对应契约**: L0 §5.1 — `scheduleHeartbeat()`

```typescript
function getNextEvents(schedules: Schedule[]): ScheduleEvent[] {
  /**
   * 获取所有到期的调度事件，按优先级排序。
   * 
   * 关键规则:
   * 1. 心跳优先级高于探索
   * 2. 同优先级时，间隔短的平台优先（避免超时）
   * 3. 最多返回 maxConcurrentHeartbeats 个心跳
   */
  
  const now = Date.now();
  
  // 筛选到期事件
  const dueEvents = schedules
    .filter(s => s.nextTime <= now)
    .map(s => ({
      ...s,
      // 计算排序分数：优先级 * 1000 + 紧急度
      sortScore: s.priority * 1000 + (s.intervalMs ? 1000000 / s.intervalMs : 0),
    }));
  
  // 按分数降序
  dueEvents.sort((a, b) => b.sortScore - a.sortScore);
  
  // 限制并发心跳数
  const heartbeats = dueEvents.filter(e => e.type === 'heartbeat');
  const explorations = dueEvents.filter(e => e.type === 'exploration');
  
  const limitedHeartbeats = heartbeats.slice(0, SCHEDULER_CONFIG.maxConcurrentHeartbeats);
  
  // 如果心跳被限制，记录警告
  if (heartbeats.length > limitedHeartbeats.length) {
    logger.warn(
      `Heartbeat concurrency limit reached: ${heartbeats.length} due, ` +
      `only ${limitedHeartbeats.length} will be processed`
    );
  }
  
  return [...limitedHeartbeats, ...explorations];
}
```

> **注意事项**: 限流的心跳会在下一轮调度继续处理

### §3.2.1 SessionManager.acquireExplorationLease()

**对应契约**: L0 §5.1 — `acquireExplorationLease()`

```typescript
async function acquireExplorationLease(input: {
  sessionId: string;
  ownerId: string;
  traceId: string;
  reason: 'scheduled_exploration' | 'manual_trigger' | 'resume_recovery';
}): Promise<
  | { ok: true; lease: ExplorationLease }
  | { ok: false; blockingSessionId?: string; reason: 'lease_held' | 'lease_store_unavailable' }
> {
  /**
   * 通过 state-system 提供的 compare-and-set 租约接口，保证同一时刻最多一个 exploration 会话向外执行。
   */

  const nowIso = now();
  const expiresAt = new Date(
    Date.now() + SCHEDULER_CONFIG.explorationLeaseTtlMs
  ).toISOString();

  const lease: ExplorationLease = {
    leaseKey: 'global-exploration',
    sessionId: input.sessionId,
    ownerId: input.ownerId,
    traceId: input.traceId,
    reason: input.reason,
    acquiredAt: nowIso,
    heartbeatAt: nowIso,
    expiresAt,
  };

  const result = await stateSystem.tryAcquireExplorationLease(lease);
  if (!result.ok) {
    auditLog.record({
      eventType: 'platform_skipped',
      sessionId: input.sessionId,
      reason: 'exploration_lease_held',
      blockingSessionId: result.blockingSessionId,
    });

    return {
      ok: false,
      blockingSessionId: result.blockingSessionId,
      reason: result.reason,
    };
  }

  return { ok: true, lease };
}
```

### §3.2.2 Orchestrator.executeExplorationWithLease()

**对应契约**: L0 §5.1 — `executeSession()`

```typescript
async function executeExplorationWithLease(session: ExplorationSession): Promise<SessionResult> {
  const leaseResult = await acquireExplorationLease({
    sessionId: session.id,
    ownerId: 'local-agent',
    traceId: session.id,
    reason: 'scheduled_exploration',
  });

  if (!leaseResult.ok) {
    return {
      status: 'skipped',
      reason: 'exploration_lease_held',
      blockingSessionId: leaseResult.blockingSessionId,
    };
  }

  try {
    await transitionState(session, 'CONNECTING');
    return await executeSessionCore(session);
  } finally {
    await stateSystem.releaseExplorationLease({
      leaseKey: 'global-exploration',
      sessionId: session.id,
    });
  }
}
```

---

### §3.3 SessionManager.handleVerificationTimeout()

**对应契约**: L0 §5.2 — PENDING_VERIFICATION 超时处理

```typescript
async function handleVerificationTimeout(session: ExplorationSession): Promise<void> {
  /**
   * 处理验证超时，强制状态转移。
   * 
   * 前置条件: session.state === 'PENDING_VERIFICATION'
   * 副作用: 会话状态变为 COOLING_DOWN 或 FAILED
   */
  
  const startedAt = new Date(session.startTime).getTime();
  if (!Number.isFinite(startedAt)) {
    auditLog.record({
      eventType: 'invalid_session_time',
      sessionId: session.id,
      platformId: session.platformId,
      rawStartTime: session.startTime,
    });
    return;
  }

  const elapsedMs = Date.now() - startedAt;
  const timeoutMs = STATE_MACHINE_CONFIG.verificationTimeoutMs;
  
  if (elapsedMs < timeoutMs) {
    // 未超时，继续等待
    return;
  }
  
  // 超时处理
  logger.warn(`Verification timeout for session ${session.id}, platform ${session.platformId}`);
  
  // 通知 connector 取消验证
  await connectorSystem.cancelVerification(session.platformId, 'timeout');
  
  // 状态转移
  await transitionState(session, 'COOLING_DOWN', {
    reason: 'verification_timeout',
    coolingDurationMs: calculateBackoff(1),  // 基础冷却期
  });
  
  // 记录审计
  auditLog.record({
    eventType: 'verification_timeout',
    sessionId: session.id,
    platformId: session.platformId,
    elapsedMs,
  });
}

function calculateBackoff(failureCount: number): number {
  const base = STATE_MACHINE_CONFIG.coolingBaseMs;
  const multiplier = Math.pow(STATE_MACHINE_CONFIG.coolingMultiplier, failureCount);
  const calculated = base * multiplier;
  
  return Math.min(calculated, STATE_MACHINE_CONFIG.maxCoolingMs);
}
```

### §3.4 BudgetManager.shouldConsumeInteractionBudget()

**对应契约**: L0 §5.3 — 预算仲裁规则

```typescript
function shouldConsumeInteractionBudget(
  action: SessionAction,
  policy: PlatformPolicy
): boolean {
  /**
   * 预算扣减判定。
   * obligation 动作可以配置为豁免，discretionary 必须扣减。
   */

  if (action.budgetClass === 'discretionary') {
    return true;
  }

  // obligation 默认不扣减互动预算，可由平台策略开启扣减
  const consumeObligation = Boolean(
    (policy as unknown as { budget?: { consumeObligation?: boolean } }).budget?.consumeObligation
  );

  return consumeObligation;
}
```

---

## §4 决策树

### §4.1 平台选择决策

**对应 L0 Mermaid**: `control-plane-system.md` §4.2

```typescript
function decidePlatformSelection(context: SelectionContext): PlatformDecision {
  /**
   * 平台选择决策树。
   */
  
  // Step 1: 检查预算
  if (context.budget.globalRemaining <= 0) {
    return { type: 'skip', reason: 'global_budget_exhausted' };
  }
  
  // Step 2: 检查是否有平台需要心跳保活
  const urgentHeartbeats = context.platforms.filter(p => {
    const nextHeartbeat = context.schedules.getNextHeartbeatTime(p.platformId);
    const timeToDeadline = nextHeartbeat - Date.now();
    return timeToDeadline < 60000;  // 1分钟内必须心跳
  });
  
  if (urgentHeartbeats.length > 0) {
    // 保活优先，选择最紧急的
    const mostUrgent = urgentHeartbeats
      .sort((a, b) => {
        const timeA = context.schedules.getNextHeartbeatTime(a.platformId);
        const timeB = context.schedules.getNextHeartbeatTime(b.platformId);
        return timeA - timeB;
      })[0];
    
    return {
      type: 'select',
      platformId: mostUrgent.platformId,
      reason: 'heartbeat_priority',
      forced: true,
    };
  }
  
  // Step 3: 正常评分选择
  const scores = context.platforms.map(p => calculatePlatformScore(p, context));
  const validScores = scores.filter(s => s.score > 0.2);  // 最低阈值
  
  if (validScores.length === 0) {
    return { type: 'skip', reason: 'no_suitable_platform' };
  }
  
  // 选择最高分
  const best = validScores.sort((a, b) => b.score - a.score)[0];
  
  return {
    type: 'select',
    platformId: best.platformId,
    reason: 'score_based',
    score: best.score,
    breakdown: best.breakdown,
    forced: false,
  };
}
```

---

## §5 边缘情况

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| PENDING_VERIFICATION 用户永不完成 | 会话卡住 | 5分钟超时自动转移 |
| 多个平台同时心跳到期 | 部分超时 | 优先级队列，限流处理 |
| 多个 exploration tick 重叠触发 | 重复外呼、预算竞争 | 使用全局 exploration lease，未拿到租约则 skip |
| LLM 调用超时 | 摘要生成失败 | 降级为最小日志，不阻断 |
| 状态机非法流转请求 | 数据不一致 | 检查 `canTransition()`，拒绝非法请求 |
| connector 返回 terminal_failure | 平台永久不可用 | 标记状态，通知用户，不再调度 |
| 预算实时更新冲突 | 超预算或义务动作被错误阻断 | 预算按 `obligation/discretionary` 分层仲裁 |
| AI 会话重启中间态恢复 | 状态不一致 | 从 state-system 读取最新状态 |

### §5.1 LLM 降级策略

```typescript
async function generateReflectionWithFallback(
  session: ExplorationSession
): Promise<ReflectionResult> {
  // 尝试 LLM
  try {
    const result = await withTimeout(
      llmClient.generateReflection(buildPrompt(session)),
      LLM_CONFIG.reflectionTimeoutMs
    );
    return result;
  } catch (error) {
    logger.warn(`LLM reflection failed: ${error.message}, using fallback`);
    
    // 降级：最小摘要
    return {
      summary: `Explored ${session.platformId} at ${session.startTime}`,
      keyTakeaways: [`Actions: ${session.actions.length}`],
      interactionQuality: 'medium',
      followUpSuggestions: [],
      generatedAt: now(),
      llmLatencyMs: 0,
      modelVersion: 'fallback',
    };
  }
}
```

---

## §6 测试辅助

```typescript
// 创建测试会话
export function makeTestSession(
  overrides: Partial<ExplorationSession> = {}
): ExplorationSession {
  return new ExplorationSession({
    platformId: 'test-platform',
    budgetSnapshot: {
      globalRemaining: 60,
      platformRemaining: 20,
      interactionsRemaining: 10,
    },
    context: {
      goal: { tags: ['ai', 'agent'] },
      history: { lastVisitTime: null },
    },
    ...overrides,
  });
}

// Mock Connector
export class MockConnector {
  private responses = new Map<string, ConnectorResult<unknown>>();
  
  setResponse(action: string, result: ConnectorResult<unknown>): void {
    this.responses.set(action, result);
  }
  
  async execute(action: string, params: unknown): Promise<ConnectorResult<unknown>> {
    const response = this.responses.get(action);
    if (!response) {
      throw new Error(`No mock response for action: ${action}`);
    }
    return response;
  }
}

// 状态机测试遍历
export function getAllValidTransitions(): [ExplorationState, ExplorationState][] {
  const transitions: [ExplorationState, ExplorationState][] = [];
  
  const validMap: Record<ExplorationState, ExplorationState[]> = {
    IDLE: ['SELECTING'],
    SELECTING: ['CONNECTING', 'COOLING_DOWN'],
    CONNECTING: ['ACTING', 'PENDING_VERIFICATION', 'COOLING_DOWN'],
    PENDING_VERIFICATION: ['CONNECTING', 'COOLING_DOWN'],
    ACTING: ['ACTING', 'REFLECTING', 'COOLING_DOWN'],
    REFLECTING: ['COOLING_DOWN'],
    COOLING_DOWN: ['IDLE'],
  };
  
  for (const [from, tos] of Object.entries(validMap)) {
    for (const to of tos) {
      transitions.push([from as ExplorationState, to]);
    }
  }
  
  return transitions;
}
```
