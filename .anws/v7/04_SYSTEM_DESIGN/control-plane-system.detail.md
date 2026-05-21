# Control Plane System — 实现细节 (L1)

| 字段 | 值 |
| --- | --- |
| **对应 L0** | [control-plane-system.md](./control-plane-system.md) |
| **文件性质** | L1 实现层 |
| **创建日期** | 2026-05-21 |

> 本文件仅在 `/forge` 任务明确引用时加载。日常设计与任务规划优先读取 L0。

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v1.0 | 2026-05-21 | 初始实现层补充；配置常量、完整数据结构、四个核心算法伪代码、决策树展开与边缘 case |

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §10 / §9.3 |
| §2 | [核心数据结构完整定义](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5.1 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 / §5 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 / §5.3 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

| Key | Default | Owner | Notes |
| --- | --- | --- | --- |
| `heartbeat.contextSourceRefLimit` | `20` | control-plane | EmbodiedContext source refs 上限 |
| `heartbeat.recentInteractionLimit` | `10` | control-plane | 近期交互摘要上限 |
| `heartbeat.toolExperienceLimit` | `10` | control-plane | ToolExperience summary 上限 |
| `heartbeat.contextAssemblyTimeoutMs` | `400` | control-plane | EmbodiedContext assembly P95 目标 |
| `heartbeat.cycleP95TargetMs` | `2000` | control-plane | 整轮 heartbeat P95 目标 |
| `heartbeat.idleCuriosityMaxCandidates` | `1` | control-plane | idle sensing 每轮最多一个候选 |
| `heartbeat.tracePayloadMaxReasonCodes` | `10` | control-plane | DecisionTracePayload reasonCodes 上限 |
| `heartbeat.goalScopeUniquenessEnforced` | `true` | control-plane | 同 kind+scope 同时只有一个 accepted goal |

> 对应 L0 入口：§10

---

## §2 核心数据结构完整定义 (Full Data Structures)

L0 §6 声明 `EmbodiedContext`、`ContextSliceStatus`、`CandidateIntent`、`HeartbeatDecision` 公共字段。实现建议拆分：

```text
src/core/second-nature/heartbeat/run-heartbeat-cycle.ts         # runHeartbeat entry
src/core/second-nature/heartbeat/embodied-context-assembler.ts  # EmbodiedContextAssembler
src/core/second-nature/heartbeat/goal-lifecycle-policy.ts       # GoalLifecyclePolicy
src/core/second-nature/heartbeat/idle-curiosity-policy.ts       # IdleCuriosityPolicy
src/core/second-nature/orchestrator/intent-planner.ts           # CandidateIntentPlanner
src/core/second-nature/orchestrator/hard-guard-evaluator.ts     # HardGuardEvaluator
src/core/second-nature/feedback/channel-feedback-router.ts      # ChannelFeedbackRouter
src/core/second-nature/observability/decision-trace-emitter.ts
```

以下类型为 L0 §6 未完整声明的实现补充：

```ts
// HeartbeatSignal — 触发 heartbeat 的信号
export interface HeartbeatSignal {
  signalId: string;
  scope: "rhythm" | "user_task" | "user_reply";
  triggeredAt: string;       // ISO-8601
  runtimeMode: string;       // e.g. "plugin", "carrier", "cli"
  channelHint?: string;      // optional channel context for user_reply/user_task
}

// HeartbeatRunInput — runHeartbeat 的完整输入
export interface HeartbeatRunInput {
  signal: HeartbeatSignal;
  embodiedContextQuery: EmbodiedContextQuery;
}

// EmbodiedContextQuery — 组装 EmbodiedContext 所需的查询参数
export interface EmbodiedContextQuery {
  assembledAt: string;       // ISO-8601，由 runHeartbeat 在调用前生成
  sliceLimits: SliceLimits;
  timestamp: string;         // 参考时间戳，用于 expiry / recency 计算
}

// SliceLimits — 各 slice 的上限配置（来自 §1 常量）
export interface SliceLimits {
  sourceRefs: number;        // contextSourceRefLimit
  recentInteractions: number;// recentInteractionLimit
  toolExperience: number;    // toolExperienceLimit
}

// GoalContextSlice — goals slice 的完整结构
export interface GoalContextSlice {
  activeGoals: AgentGoalSummary[];
  proposedGoals: AgentGoalSummary[];
  degradedReason?: string;
}

// AgentGoalSummary — goal 的读模型摘要（control-plane 只读）
export interface AgentGoalSummary {
  goalId: string;
  kind: string;
  scope: string;
  status: string;            // "accepted" | "proposal" | "expired" | "completed" | "replaced" | "paused"
  priorityHint: number;
  description: string;
  sourceRefs: SourceRef[];
}

// ToolAffordanceSlice — 工具可供性 slice
export interface ToolAffordanceSlice {
  platforms: PlatformAffordanceSummary[];
  breakerPosture: "open" | "half_open" | "closed";
  degradedReason?: string;
}

// DecisionTracePayload — 决策追踪载荷（完整字段）
export interface DecisionTracePayload {
  decisionId: string;
  contextId?: string;
  scope: string;
  status: string;
  selectedIntentId?: string;
  reasonCodes: string[];                 // 上限: tracePayloadMaxReasonCodes
  contextSliceStatuses: ContextSliceStatus[];
  sourceRefs: SourceRef[];
  tracedAt: string;          // ISO-8601
}

// GoalTransitionRequest — goal 状态变更请求（发往 state-memory，control-plane 不直接写）
export interface GoalTransitionRequest {
  goalId: string;
  targetStatus: "completed" | "expired" | "replaced" | "paused";
  reason: string;
  evidenceRefs?: string[];
}
```

> 对应 L0 入口：§6

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 `assembleEmbodiedContext(query)`

**对应契约**：L0 §5.1
**准入理由**：多个独立 slice 并行加载 + 各自降级 + 合并为 bounded context，顺序有语义。

```text
function assembleEmbodiedContext(query):
  contextId = uuid()
  sliceTimeout = contextAssemblyTimeoutMs / n_slices

  -- 1. 并行触发所有 slice 加载（各自带超时）
  results = await Promise.allSettled([
    withTimeout(state.loadIdentityProfile(limits),                           sliceTimeout),
    withTimeout(state.loadRecentInteractionSnapshot(recentInteractionLimit),  sliceTimeout),
    withTimeout(state.loadToolExperienceSlice(toolExperienceLimit),           sliceTimeout),
    withTimeout(state.loadAcceptedDreamProjection(),                          sliceTimeout),
    withTimeout(body.loadToolAffordanceSnapshot(),                            sliceTimeout),
    withTimeout(body.loadCircuitBreakerPosture(),                             sliceTimeout),
    withTimeout(health.loadSelfHealthSnapshot(),                              sliceTimeout),
    withTimeout(state.loadLifeEvidenceSlice(),                                sliceTimeout),
  ])

  -- 2. 逐一评估每个 slice 结果
  sliceStatuses = []
  for each (sliceKind, result) in zip(SLICE_KINDS, results):
    if result.status == "fulfilled":
      sliceStatuses.push({ kind: sliceKind, status: "loaded",
                           sourceRefCount: result.value.sourceRefs.length })
    else if result.reason is TimeoutError or NetworkError:
      sliceStatuses.push({ kind: sliceKind, status: "degraded",
                           reason: result.reason.message, sourceRefCount: 0 })
    else if result.reason is PolicyBlockedError:
      sliceStatuses.push({ kind: sliceKind, status: "blocked",
                           reason: result.reason.policyReason, sourceRefCount: 0 })

  -- 3. 组合 EmbodiedContext
  ctx = {
    contextId,
    assembledAt: now(),
    sliceStatuses,
    identity:      results[IDENTITY].value ?? undefined,
    goals:         buildGoalContextSlice(results[GOALS]),
    acceptedDream: results[DREAM].value ?? undefined,
    affordance:    mergeAffordanceAndBreaker(results[AFFORDANCE], results[BREAKER]),
  }

  -- 4. 截断 sourceRefs 至 sourceRefLimit
  ctx.sourceRefs = collectAndTruncate(ctx, sourceRefLimit)

  return ctx
```

> 对应 L0 入口：§5.1

---

### §3.2 `evaluateGoalLifecycle(context)`

**对应契约**：L0 §5.1
**准入理由**：goal 过滤和 transition request 生成的顺序不可颠倒，且不能直接写 state。

```text
function evaluateGoalLifecycle(context):
  now = context.assembledAt
  activeGoals = context.goals.activeGoals
  transitionRequests = []

  -- 1. 过期检查
  for each goal in activeGoals:
    if goal.expiresAt != null and goal.expiresAt < now:
      transitionRequests.push({ goalId: goal.goalId,
                                 targetStatus: "expired",
                                 reason: "ttl_exceeded" })

  -- 2. 完成检查（跳过已被标 replaced 的）
  for each goal in activeGoals where goal.status != "replaced":
    if goal.completionEvidenceRefs.length > 0 and meetsCriteria(goal):
      transitionRequests.push({ goalId: goal.goalId,
                                 targetStatus: "completed",
                                 reason: "criteria_met",
                                 evidenceRefs: goal.completionEvidenceRefs })

  -- 3. kind+scope 唯一性检查（goalScopeUniquenessEnforced = true）
  groupByKindScope = groupBy(activeGoals, g => g.kind + ":" + g.scope)
  for each group where group.length > 1:
    sorted = sortByCreatedAt(group, DESC)
    keep = sorted[0]
    for each duplicate in sorted[1..]:
      transitionRequests.push({ goalId: duplicate.goalId,
                                 targetStatus: "replaced",
                                 reason: "scope_uniqueness_enforced" })

  -- 4. 过滤剩余 active goals
  excludedIds = transitionRequests.map(r => r.goalId)
  remainingActive = activeGoals.filter(g => !excludedIds.includes(g.goalId))

  -- 5. 计算候选 boost refs
  candidateBoostRefs = remainingActive.map(g => g.goalId)

  return { activeGoals: remainingActive, transitionRequests, candidateBoostRefs }
```

> 对应 L0 入口：§5.1

---

### §3.3 `selectIdleCuriosity(context)`

**对应契约**：L0 §5.1
**准入理由**：idle sensing 的资格检查顺序必须防止爬虫行为。

```text
function selectIdleCuriosity(context):

  -- 1. 有 active goal -> 跳过 idle
  if context.goals.activeGoals.length > 0:
    return null

  -- 2. 筛选符合资格的 platform+capability
  eligiblePlatforms = []
  for each platform in context.affordance.platforms:
    if context.affordance.breakerPosture == "open":
      continue              -- 全局 breaker open -> 跳过
    if platform.breakerPosture == "open":
      continue              -- 单 platform breaker open -> 跳过
    for each capability in platform.capabilities:
      if capability.effectClass != "no_effect":
        continue            -- 必须是 read-only
      if capability.capabilityId not in READ_ONLY_ALLOWLIST:
        continue            -- 必须在 allowlist
      if capability.healthStatus == "degraded":
        continue            -- 健康状态不能降级
      eligiblePlatforms.push({ platform, capability })

  -- 3. 无候选 -> 返回 no_eligible_connector
  if eligiblePlatforms.length == 0:
    return { candidate: null, reason: "idle_policy_no_eligible_connector" }

  -- 4. 选择最低 painScore（来自 ToolExperience）的 platform+capability
  scored = eligiblePlatforms.map(p => ({
    ...p,
    painScore: context.toolExperience
                 .find(e => e.platformId == p.platform.platformId)?.painScore ?? 0
  }))
  selected = minBy(scored, s => s.painScore)

  -- 5. 创建唯一 idle_sensing 候选（effectClass 硬编码为 no_effect）
  candidate = {
    intentId:         uuid(),
    kind:             "idle_sensing",
    effectClass:      "no_effect",           -- 硬编码，不可覆盖
    priority:         0,                     -- lowest
    sourceRefs:       [toAffordanceSourceRef(selected.platform)],
    goalInfluenceRefs: [],
    platformId:       selected.platform.platformId,
    capabilityId:     selected.capability.capabilityId,
    idempotencyKey:   buildIdempotencyKey(selected),
  }

  return { candidate }
```

> 对应 L0 入口：§5.1

---

### §3.4 `evaluateHardGuards(candidate)`

**对应契约**：L0 §5.1
**准入理由**：guard 应用顺序（source → affordance → breaker → budget → cooldown → quiet → risk → privacy）是安全契约，不可随意调换。

```text
function evaluateHardGuards(candidate):

  -- GUARD 1: source refs
  -- 非 no_effect / maintenance 的意图必须有 sourceRefs
  if candidate.sourceRefs.isEmpty()
     and candidate.effectClass != "no_effect"
     and candidate.effectClass != "maintenance":
    return { verdict: "deny", reason: "missing_source_refs", guardName: "source_refs" }

  -- GUARD 2: affordance 注册检查
  if candidate.platformId != null
     and !affordanceMap.hasPlatform(candidate.platformId):
    return { verdict: "deny", reason: "connector_not_registered", guardName: "affordance" }

  -- GUARD 3: circuit breaker
  if candidate.platformId != null
     and breakerPosture(candidate.platformId) == "open":
    return { verdict: "defer", reason: "connector_circuit_open", guardName: "circuit_breaker" }

  -- GUARD 4: daily budget
  if candidate.platformId != null
     and dailyBudget.isExhausted(candidate.platformId):
    return { verdict: "defer", reason: "budget_exhausted", guardName: "budget" }

  -- GUARD 5: cooldown window
  if candidate.platformId != null and candidate.capabilityId != null
     and cooldownRegistry.isActive(candidate.platformId, candidate.capabilityId):
    return { verdict: "defer", reason: "cooldown_active", guardName: "cooldown" }

  -- GUARD 6: quiet suppression
  if quietFlag.isActive() and candidate.effectClass == "user_outreach":
    return { verdict: "defer", reason: "quiet_suppression_active", guardName: "quiet_suppression" }

  -- GUARD 7: risk threshold
  if riskScore(candidate) > RISK_THRESHOLD and !candidate.ownerOverride:
    return { verdict: "deny", reason: "risk_threshold_exceeded", guardName: "risk" }

  -- GUARD 8: raw private content
  if candidate.sourceRefs.some(r => r.kind == "raw_private_content"):
    return { verdict: "deny", reason: "raw_private_content_detected", guardName: "privacy" }

  -- 所有 guard 通过
  return { verdict: "allow", reason: "all_guards_passed", guardName: "none" }
```

> 对应 L0 入口：§5.1

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 scope routing 详细逻辑

展开 L0 §4.1 架构图的 ScopeRouter：

**`rhythm` 路径**（完整 embodied loop）：
1. 完整 `assembleEmbodiedContext()` → 所有 slice 并行加载，各自降级
2. `evaluateGoalLifecycle()` → 过滤 active goals，生成 transition requests
3. `selectIdleCuriosity()` → 无 active goal 时选择 read-only 候选
4. `planCandidateIntents()` → 从 context + goals + idle 生成候选列表
5. `evaluateHardGuards()` → 应用 8 个 guard
6. `orchestrateAllowedIntent()` → 映射为 typed downstream request
7. `emitDecisionTrace()` → 记录 DecisionTracePayload

**`user_task` 路径**（绕过 rhythm gate，不走完整 slice assembly）：
1. 从 context snapshot 快速装配（跳过 idle/dream 路径）
2. `planCandidateIntents()` with goal/task hint 参数
3. `evaluateHardGuards()` — **不可绕过**（source / privacy / risk guards 强制执行）
4. `orchestrateAllowedIntent()` → typed downstream request
5. `emitDecisionTrace()`

**`user_reply` 路径**（最轻量，不走 planner / guard）：
1. `ChannelFeedbackRouter` 接管
2. `state.appendRecentInteractionSummary()` → 写入近期交互摘要
3. `observability.trace()` → 记录 reply ingestion 事件
4. 直接返回 `HeartbeatDecision`（status: `heartbeat_ok`）
5. **不走** planner、guard、downstream request

> 对应 L0 入口：§4.1 / §5

---

### §4.2 HeartbeatDecision status mapping

| status | 触发条件 |
| --- | --- |
| `heartbeat_ok` | guard deny/defer 且 candidate 为 no_effect；或无 candidate；或 user_reply 路径正常完成 |
| `intent_selected` | guard allow，downstream request 已发出 |
| `deferred` | guard 返回 defer（cooldown / budget / quiet / circuit_open） |
| `denied` | guard 返回 deny（source / privacy / risk） |
| `delivery_unavailable` | downstream outreach 系统不可达，fallback request 发出 |
| `runtime_carrier_only` | carrier mode，context 从未 assembled，直接返回 |

> 对应 L0 入口：§6.1（HeartbeatDecision 字段）

---

### §4.3 downstream request type mapping（by effectClass）

| effectClass | downstream request type | 发往系统 |
| --- | --- | --- |
| `connector_action` | `ConnectorIntentRequest` | body-tool / connector-system |
| `quiet_run` | `QuietRunRequest` | dream-quiet-system |
| `dream_schedule` | `DreamScheduleRequest` | dream-quiet-system |
| `user_outreach` | `GuidanceDraftRequest` | guidance-voice-system |
| `maintenance` | DecisionTracePayload only | observability-health-system（无 downstream action） |
| `no_effect` | DecisionTracePayload only | observability-health-system（无 downstream action） |

> 对应 L0 入口：§5.1（orchestrateAllowedIntent 契约）

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| **candidate Dream 污染 context** | 未经验证的 Dream output 进入 heartbeat | DreamOutput status 必须为 `accepted` 才能进入 context；control-plane 不能检查 `candidate` status 并自行晋升——这是 state-memory 的职责 |
| **goal 多 scope 并发** | 两次快速提交产生重复 accepted goal | 同 kind+scope 重复是合法的临时状态；lifecycle policy 取最新，其余发 `replaced` request；不 crash，不丢弃所有 |
| **idle sensing 变爬虫** | 每轮无限制地触发 read-only 探测 | 严格限制 1 个 read-only candidate/轮；guard 仍然全部执行（affordance / breaker / cooldown）；即使是 idle，sourceRef 也必须有（affordance row 算作 sourceRef） |
| **context degraded 继续 vs 停止** | 降级后行为不一致 | identity degraded → 继续（不是 safety blocker）；affordance degraded → 继续但 connector intent 被 guard deny；self_health degraded → 继续，记录 trace；安全相关 slice degraded → deny 受影响的 action |
| **trace_unavailable 不影响决策** | trace emit 失败导致决策回滚 | DecisionTracePayload emit 失败不影响 HeartbeatDecision；决策先返回，trace emit 在 finally block；trace port 不可用时 HeartbeatDecision.reasons 追加 `trace_unavailable` 说明 |
| **user_task 绕过 rhythm gate 但不绕过 guard** | user_task 路径跳过 guard 导致安全漏洞 | user_task scope 跳过完整 EmbodiedContext slice assembly，但 `evaluateHardGuards()` 仍然完整执行；source / privacy / risk guards 在任何 scope 下均不可绕过 |

> 对应 L0 入口：§9 / §5.3

---

## §6 测试辅助 (Test Helpers)

建议的测试辅助（fixtures / helpers）：

- **`makeHeartbeatSignal(scope)`** — 生成指定 scope（`rhythm` / `user_task` / `user_reply`）的最小 HeartbeatSignal，自动填充 signalId 和 triggeredAt
- **`stubEmbodiedContext(overrides)`** — 生成带默认值的 EmbodiedContext，支持 slice degraded override（如 `{ goals: { degradedReason: "timeout" } }`）
- **`makeGoalSummary(status, kind, scope)`** — 生成指定状态的 AgentGoalSummary，自动填充 goalId、priorityHint 和空 sourceRefs
- **`stubAffordanceSlice(breakerPosture, platforms)`** — 生成带 breaker 状态的 ToolAffordanceSlice，用于 idle curiosity 和 guard 测试
- **`assertGuardDeny(candidate, guardName)`** / **`assertGuardAllow(candidate)`** — guard 结果断言助手，校验 verdict 字段和 guardName
- **`captureDownstreamRequests()`** — mock downstream ports 并捕获发出的所有 request（ConnectorIntentRequest / QuietRunRequest / DreamScheduleRequest / GuidanceDraftRequest），用于 intent orchestration 集成测试

> 对应 L0 入口：§11
