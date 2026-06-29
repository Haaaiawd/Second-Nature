# action-closure-policy-system L1 实现层

> **文件性质**: L1 实现层 · **对应 L0**: [`action-closure-policy-system.md`](./action-closure-policy-system.md)
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。
> **孤岛检查**: 本文件各节均须在 L0 有对应超链接入口。

---

## 版本历史

| 版本 | 日期       | Changelog |
| ---- | ---------- | --------- |
| v1.0 | 2026-06-21 | 初始 L1；关闭 HI-06 三个 OPEN 项，定义 proposal/policy/dispatch/closure 完整契约 |

---

## 本文件章节索引

|   §   | 章节                                                         | 对应 L0 入口           |
| :---: | ------------------------------------------------------------ | ---------------------- |
|  §1   | [配置常量](#1-配置常量-config-constants)                     | L0 §6 / §10            |
|  §2   | [完整数据结构](#2-完整数据结构-full-data-structures)         | L0 §6 数据模型         |
|  §3   | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5.1 操作契约表     |
|  §4   | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details)    | L0 §4 架构图 / 数据流  |
|  §5   | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §5 / §9             |
|  §6   | [契约验证矩阵详细版](#6-契约验证矩阵详细版)                  | L0 §11.5 测试策略      |

---

## §1 配置常量 (Config Constants)

> **L0 对应入口**: L0 §6 数据模型、§10 性能考虑

| 常量 | 值 | 说明 | 来源 |
| ---- | --- | ---- | ---- |
| `MAX_PROPOSALS_PER_CYCLE` | `8` | 单轮 cycle 最大候选 proposal 数 | 本系统决策 |
| `ACTION_PROPOSAL_SUMMARY_MAX_CHARS` | `240` | proposal reason 长度上限 | PRD §6.1 |
| `CLOSURE_IDEMPOTENCY_TTL_MS` | `300_000` | closure idempotency 窗口 | v8 行为继承 |
| `POLICY_EVALUATION_TIMEOUT_MS` | `50` | policy 评估超时回退 | PRD §6.1 |
| `DEFAULT_AUTONOMY_LEVEL` | `"draft_only"` | 高风险/未知 capability 默认 autonomy | [REQ-003] |

### §1.1 决策表驱动 autonomy mapping

| sideEffectClass | riskPosture | permissionDeclared | breakerClosed | ownerPreference | decision | autonomyLevel |
| --------------- | :---------: | :----------------: | :-----------: | :-------------: | :------: | :-----------: |
| `none` | any | — | — | — | `allow` | `auto_allowed` |
| `external_write` | `high` | any | any | any | `deny` | `none` |
| `external_write` | `medium` | `true` | `true` | `true` | `downgrade` | `owner_confirm` |
| `external_write` | `low` | `true` | `true` | `true` | `allow` | `auto_allowed` |
| `external_write` | any | `false` | — | — | `deny` | `none` |
| `owner_attention` | any | — | — | — | `downgrade` | `draft_only` |
| `capability_declared` | `high` | any | any | any | `deny` | `none` |
| `capability_declared` | `low/medium` | `true` | `true` | `true` | `allow` | `auto_allowed` |
| `routine` | any | `true` | `true` | `true` | `allow` | `auto_allowed` |
| `routine` | any | `false` | — | — | `deny` | `none` |

> `downgrade` 表示将 `external_write` 退化为 `guidance_draft`，`owner_attention` 退化为 `notify_owner` draft。

---

## §2 完整数据结构 (Full Data Structures)

> **L0 对应入口**: L0 §6.1 核心实体

### §2.1 跨系统输入契约

```typescript
// 来自 control-context-system 的 Agent-authored 或 attention-derived intent
interface AgentActionIntent {
  intentId: string;
  actionKind: PlatformNeutralActionKind;
  attentionSignalRefs: SourceRef[];
  sourceRefs: SourceRef[];
  targetPlatformId?: string;
  targetCapabilityId?: string;
  routineInvocation?: RoutineInvocation;
  payloadSummary?: string; // redacted; 不含 credential
}

// 来自 attention-system 的候选 action refs
interface AttentionSignalRef {
  signalId: string;
  selectedActionKind: AttentionActionKind;
  platformId?: string;
  capabilityId?: string;
  rationale: string;
  sourceRefs: SourceRef[];
}

// 来自 memory-continuity-system 的 routine registry 读模型
interface ToolRoutineReadModel {
  routineId: string;
  capabilityPattern: string;
  version: string; // semver
  status: RoutineRegistryStatus; // candidate | validated | active | retired
  sourceRefs: SourceRef[];
  rollbackRef?: SourceRef;
}

// 来自 body-connector-system 的 policy 评估上下文
interface PolicyEvaluationContext {
  affordancePosture: AffordancePosture;
  platformPermissionDeclared: boolean;
  circuitBreakerClosed: boolean;
  ownerPreference: boolean; // 显式 owner allow / default false
  credentialHealth: "ok" | "missing" | "degraded";
}
```

### §2.2 输出契约

```typescript
interface ActionProposal {
  id: string;
  cycleId: string;
  actionKind: PlatformNeutralActionKind;
  targetPlatformId?: string;
  targetCapabilityId?: string;
  sourceRefs: SourceRef[];
  proofRefs: SourceRef[];
  reason: V8ReasonCode;
  riskPosture: "low" | "medium" | "high" | "blocked";
  sideEffectClass: ActionSideEffectClass;
  idempotencyKey: string;
  routineInvocationId?: string;
  routineVersion?: string; // semver
  createdAt: string;
}

interface ActionPolicyDecision {
  id: string;
  proposalId: string;
  decision: "allow" | "defer" | "downgrade" | "deny";
  decisionReason: V8ReasonCode;
  autonomyLevel: "none" | "draft_only" | "owner_confirm" | "auto_allowed";
  downgradedActionKind?: PlatformNeutralActionKind;
  proofRefs: SourceRef[];
  decidedAt: string;
}

interface ActionClosureRecord {
  id: string;
  cycleSequence: number;
  intentId?: string;
  actionKind: "no_action" | "remember" | "connector" | "guidance" | "routine";
  decision: "allow" | "defer" | "downgrade" | "deny";
  platformId?: string;
  capabilityId?: string;
  sourceRefs: SourceRef[];
  proofRefs: SourceRef[];
  traceRefs: SourceRef[];
  closureRefs: SourceRef[];
  payloadJson?: string;
  reasonCode: string;
  createdAt: string;
}
```

### §2.3 Routine Invocation 结构

```typescript
interface RoutineInvocation {
  routineId: string;
  version: string; // semver
  capabilityPattern: string;
  payload: Record<string, unknown>;
  sourceRefs: SourceRef[]; // 必须包含 routine 安装来源 + 当前 invocation context
}

// routine 调用进入 policy 评估时的 envelope
interface RoutineInvocationProposal extends ActionProposal {
  actionKind: "routine";
  sideEffectClass: "routine";
  routineInvocationId: string;
  routineVersion: string; // semver
}

// ToolRoutineGuardSchema policy evaluation contract.
// The DSL is canonical in shared-v9-contracts.md §6.3.
// action-closure-policy-system evaluates the guard against current policy context
// (owner preference, breaker state, permission declared, risk posture) and produces
// the final ActionPolicyDecision. It does NOT parse sandbox/execution syntax.
interface RoutinePolicyEvaluationContext extends PolicyEvaluationContext {
  guard: ToolRoutineGuardSchema;
  routineSourceRefs: SourceRef[];
}
```

### §2.4 SourceRef 使用规则

- `sourceRefs`: 指向原始证据、attention signal、routine 安装来源、owner preference 等输入。
- `proofRefs`: policy 评估时产生的证明引用（affordance posture、permission declaration、breaker state）。
- `traceRefs`: cycle trace、stage event、closure id。
- `closureRefs`: 当前 closure 关联的上游 closure 或 rollback ref。

所有引用遵循 [`shared-v9-contracts.md`](./shared-v9-contracts.md) §1 canonical `SourceRef` shape。

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

> **L0 对应入口**: L0 §5.1 操作契约表

### §3.1 `buildActionProposal`

**对应契约**: L0 §5.1 `buildActionProposal(...)`
**准入理由**: 多输入类型归一化 + source ref 合并。

```typescript
function buildActionProposal(
  cycleId: string,
  intent: AgentActionIntent,
  attentionRefs: AttentionSignalRef[],
  routineReadModel?: ToolRoutineReadModel,
  affordance?: AffordancePosture,
): ActionProposal | NoActionResult {
  const selectedKind = intent.actionKind ?? deriveKindFromAttention(attentionRefs);
  if (!selectedKind) {
    return { kind: "no_action", reason: "no_actionable_intent" };
  }

  const sideEffectClass = classifySideEffect(selectedKind, intent.targetCapabilityId);
  const riskPosture = computeRiskPosture(selectedKind, attentionRefs, affordance);
  const sourceRefs = deduplicateSourceRefs([
    ...intent.sourceRefs,
    ...attentionRefs.flatMap((a) => a.sourceRefs),
    ...(routineReadModel ? routineReadModel.sourceRefs : []),
  ]);

  if (sourceRefs.length === 0 && sideEffectClass !== "none") {
    return { kind: "no_action", reason: "policy_denied_missing_sources" };
  }

  return {
    id: generateId(),
    cycleId,
    actionKind: selectedKind,
    targetPlatformId: intent.targetPlatformId,
    targetCapabilityId: intent.targetCapabilityId,
    sourceRefs,
    proofRefs: [],
    reason: deriveReason(selectedKind, attentionRefs),
    riskPosture,
    sideEffectClass,
    idempotencyKey: buildIdempotencyKey(cycleId, intent, selectedKind),
    routineInvocationId: routineReadModel?.routineId,
    routineVersion: routineReadModel?.version,
    createdAt: now(),
  };
}
```

### §3.2 `evaluateActionPolicy`

**对应契约**: L0 §5.1 `evaluateActionPolicy(...)`
**准入理由**: 纯函数决策表 + 降级路径。

```typescript
function evaluateActionPolicy(
  proposal: ActionProposal,
  context: PolicyEvaluationContext,
): ActionPolicyDecision {
  const { decision, autonomyLevel } = lookupDecisionTable(proposal, context);
  const proofRefs: SourceRef[] = [
    ...(context.affordancePosture?.sourceRefs ?? []),
    { family: "action", id: proposal.id },
  ];

  return {
    id: generateId(),
    proposalId: proposal.id,
    decision,
    decisionReason: deriveDecisionReason(proposal, context, decision),
    autonomyLevel,
    downgradedActionKind:
      decision === "downgrade" ? computeDowngradedKind(proposal.actionKind) : undefined,
    proofRefs,
    decidedAt: now(),
  };
}
```

### §3.3 `dispatchAllowedAction`

**对应契约**: L0 §5.1 `dispatchAllowedAction(...)`
**准入理由**: 决策 → 执行路由。

```typescript
async function dispatchAllowedAction(
  proposal: ActionProposal,
  decision: ActionPolicyDecision,
  guidanceAvailable: boolean,
  bodyConnector: IBodyConnectorSystem,
): Promise<DispatchResult> {
  if (decision.decision === "deny" || decision.decision === "defer") {
    return { kind: "no_dispatch", decision };
  }

  const effectiveKind = decision.downgradedActionKind ?? proposal.actionKind;

  if (effectiveKind === "guidance" || effectiveKind === "notify_owner") {
    if (!guidanceAvailable) {
      return { kind: "no_dispatch", reason: "guidance_unavailable" };
    }
    return { kind: "guidance", request: buildGuidanceRequest(proposal, decision) };
  }

  if (effectiveKind === "routine") {
    return {
      kind: "routine",
      request: {
        routineId: proposal.routineInvocationId!,
        version: proposal.routineVersion!,
        capabilityPattern: proposal.targetCapabilityId!,
        payload: proposal.routinePayload ?? {},
        sourceRefs: proposal.sourceRefs,
      },
    };
  }

  // connector execution (read / write / probe)
  return {
    kind: "connector",
    request: buildConnectorDispatchRequest(proposal, decision),
  };
}
```

### §3.4 `recordNoActionClosure`

**对应契约**: L0 §5.1 `recordNoActionClosure(...)`
**准入理由**: exactly-one closure 回退。

```typescript
async function recordNoActionClosure(
  cycleId: string,
  reason: V8ReasonCode,
  traceRefs: SourceRef[] = [],
  memoryStore: MemoryContinuityWritePort,
): Promise<ActionClosureRecord> {
  const closure: ActionClosureRecord = {
    id: generateId(),
    cycleSequence: await resolveCycleSequence(cycleId),
    actionKind: "no_action",
    decision: "deny",
    sourceRefs: traceRefs,
    proofRefs: [],
    traceRefs,
    closureRefs: traceRefs,
    reasonCode: reason,
    createdAt: now(),
  };
  await memoryStore.writeActionClosureRecord(closure);
  return closure;
}
```

### §3.5 `recordExecutionClosure`

**对应契约**: L0 §5.1 `recordExecutionClosure(...)`
**准入理由**: 执行结果闭环。

```typescript
async function recordExecutionClosure(
  cycleId: string,
  proposal: ActionProposal,
  decision: ActionPolicyDecision,
  executionResult: ConnectorResultSummary | GuidanceResultSummary,
  memoryStore: MemoryContinuityWritePort,
): Promise<ActionClosureRecord> {
  const closure: ActionClosureRecord = {
    id: generateId(),
    cycleSequence: await resolveCycleSequence(cycleId),
    intentId: proposal.id,
    actionKind: inferActionKindFromProposal(proposal),
    decision: decision.decision,
    platformId: proposal.targetPlatformId,
    capabilityId: proposal.targetCapabilityId,
    sourceRefs: proposal.sourceRefs,
    proofRefs: decision.proofRefs,
    traceRefs: [...proposal.sourceRefs, { family: "action", id: proposal.id }],
    closureRefs: executionResult.closureRefs ?? [],
    payloadJson: JSON.stringify({
      routineInvocationId: proposal.routineInvocationId,
      routineVersion: proposal.routineVersion,
      outcome: executionResult.outcome,
      summary: executionResult.summary,
    }),
    reasonCode: executionResult.reasonCode,
    createdAt: now(),
  };
  await memoryStore.writeActionClosureRecord(closure);
  return closure;
}
```

### §3.6 `recordRememberClosure`

**对应契约**: L0 §5.1 `recordRememberClosure(...)`
**准入理由**: Dream 输入来源。

```typescript
async function recordRememberClosure(
  cycleId: string,
  memoryCandidate: MemoryReviewCandidateClosure,
  memoryStore: MemoryContinuityWritePort,
): Promise<ActionClosureRecord> {
  const closure: ActionClosureRecord = {
    id: generateId(),
    cycleSequence: await resolveCycleSequence(cycleId),
    actionKind: "remember",
    decision: "allow",
    sourceRefs: memoryCandidate.sourceRefs,
    proofRefs: [],
    traceRefs: memoryCandidate.traceRefs,
    closureRefs: memoryCandidate.closureRefs,
    payloadJson: JSON.stringify({ memoryCandidateId: memoryCandidate.id }),
    reasonCode: "remember_for_review",
    createdAt: now(),
  };
  await memoryStore.writeActionClosureRecord(closure);
  return closure;
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

> **L0 对应入口**: L0 §4.1 架构图、§4.3 数据流

### §4.1 输入 → Proposal 决策树

```text
输入
├── AgentActionIntent 直接指定 actionKind
│   └── 使用指定 kind
├── ActivityStepIntent 指向 propose_action / policy_closure
│   └── 仅当 step 已由 Agent 或 verified routine author，才生成 proposal
├── ToolRoutine invocation
│   └── 重新评估 guard + policy context 后生成 proposal
└── 无 AgentActionIntent / ActivityStepIntent / ToolRoutine，仅有 AttentionSignal refs
    └── 不生成 action proposal；写 no-action / ask-agent / watch closure，reason="attention_hint_without_agent_or_routine_intent"
```

`AttentionSignal` refs may ground source refs, risk posture and rationale of a proposal, but they must not author a proposal by themselves.

### §4.2 Policy 评估决策树

```text
proposal
├── sourceRefs 为空且 sideEffectClass ≠ none
│   └── deny / none
├── riskPosture = blocked
│   └── deny / none
├── sideEffectClass = routine
│   ├── routine status = active + guard policy context (permission + breaker + owner pref) pass
│   │   └── allow / auto_allowed
│   └── 任一不满足（包括 guard.expandsCapability=true）
│       └── deny / none
├── sideEffectClass = external_write
│   ├── high risk → deny
│   ├── permission=false / breaker=open / ownerPref=false → deny
│   ├── medium risk + all true → downgrade / owner_confirm
│   └── low risk + all true → allow / auto_allowed
├── sideEffectClass = owner_attention
│   └── downgrade / draft_only
└── sideEffectClass = none
    └── allow / auto_allowed
```

**ToolRoutine guard evaluation**: `evaluateActionPolicy` receives the parsed `ToolRoutineGuardSchema` (via `RoutinePolicyEvaluationContext`). It checks `expandsCapability` and `requiredOwnerConfirmation` against current policy context. Syntax/sandbox validation is delegated to `body-connector-system`.

### §4.3 Dispatch 路由决策树

```text
decision
├── deny / defer
│   └── no_dispatch → 直接 closure
├── downgrade
│   ├── downgradedKind = guidance/notify_owner/watch → guidance dispatch
│   └── downgradedKind = remember → remember closure
└── allow
    ├── actionKind = routine → body-connector routine invocation
    ├── actionKind = guidance/notify_owner/watch → guidance dispatch
    └── actionKind = connector_* → body-connector connector dispatch
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

> **L0 对应入口**: L0 §5 接口设计、§9 安全性考虑

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| `AttentionSignal` 建议 `connector_read` | 非最终 action | 不生成 proposal；由 Agent/routine 在更高层决定是否发起 connector read |
| Routine 调用被重新评估后 deny | 绕过 policy / 未闭合 activity step | 返回 `routine_invocation_denied`；不执行 routine；必须写 denied/no-action `ActionClosureRecord` |
| Proposal 与 decision idempotency key 冲突 | 重复 closure | 按 cycle + idempotencyKey 去重；重复调用返回已存在 closure ref |
| Connector evolution intent 进入 proposal | 直接改 core | 强制 autonomyLevel ≤ `draft_only`；只生成到 body-connector 的受控请求 |
| Guidance service unavailable | 降级路径断裂 | 返回 `guidance_unavailable` reason；写 no-action/downgraded closure |
| 同时存在多个 attention action 建议 | 选项过载 | 最多取 `MAX_PROPOSALS_PER_CYCLE` 个；按 relevance 排序 |

---

## §6 契约验证矩阵详细版 (Contract Verification Matrix Detail)

> **L0 对应入口**: L0 §11.5 契约验证责任矩阵

| 契约 | 风险级别 | 正常态验证 | 失败态验证 | 回归责任 |
|------|---------|-----------|-----------|---------|
| `buildActionProposal` authoring boundary | 关键路径 | 单元：Agent / activity / routine 生成正确 proposal，attention refs 只做 grounding | attention-only → no_action / ask-agent closure；缺失 source refs → no_action | action proposal 主链路 |
| `evaluateActionPolicy` allow/defer/downgrade/deny | 关键路径 | 单元：覆盖 decision table 全分支 | high risk / missing permission → deny | policy evaluator |
| `dispatchAllowedAction` 不自动执行 downgrade 外部写 | 高 | 单元：downgrade → guidance | guidance unavailable → safe closure | dispatch 安全 |
| 每 cycle exactly-one closure | 关键路径 | 集成：成功/失败/无行动均产生 closure | 重复调用 → idempotent | closure cycle |
| `ToolRoutine` 调用重新过 policy | 高 | 集成：active routine + 健康 context → allow | breaker open → deny | routine safety |
| denied routine/activity step closure | 高 | 单元：deny → no dispatch + denied/no-action closure | 单元：缺 closure linkage → `activity_thread_missing_closure` | closure cycle |
| Connector evolution 不落地 core | 高 | 集成：evolution intent → body-connector request | 直接写 core 路径不存在 | workspace-only autonomy |

---

<!-- L1 孤岛检查：
- §1 配置常量 → L0 §6/§10 已链接
- §2 数据结构 → L0 §6.1 已链接
- §3 算法 → L0 §5.1 已链接
- §4 决策树 → L0 §4 已链接
- §5 边缘情况 → L0 §5/§9 已链接
- §6 契约矩阵 → L0 §11.5 已链接
-->
