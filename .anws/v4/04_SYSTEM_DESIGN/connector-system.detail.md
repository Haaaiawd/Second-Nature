# Connector System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`connector-system.md`](./connector-system.md)
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
export const CHANNEL_CONFIG = {
  priorities: {
    default: ['api_rest', 'a2a', 'cli', 'skill', 'browser'] as const,
    highRiskSideEffects: ['api_rest', 'a2a'] as const,
  },
} as const;

export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitter: true,
  respectRetryAfter: true,
} as const;

export const COOLDOWN_CONFIG = {
  defaultPlatformCooldownMs: 5 * 60_000,
  degradedChannelPenaltyMs: 10 * 60_000,
  verificationCooldownMs: 15 * 60_000,
} as const;

export const FAILURE_CLASSES = [
  'transport_failure',
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
  'unknown_platform_change',
] as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

```ts
export type ChannelType = 'api_rest' | 'api_rpc' | 'a2a' | 'mcp' | 'cli' | 'skill' | 'browser';
export type FailureClass = typeof FAILURE_CLASSES[number];

export interface ConnectorManifest {
  platformId: string;
  supportedCapabilities: CapabilityIntent[];
  channelPriority: ChannelType[];
  credentialTypes: string[];
  degradedChannels?: ChannelType[];
}

// `supportedCapabilities` 是稳定的能力抽象，不是平台 endpoint inventory。
// 若某个平台内部有 timeline / notification / inbox 等差异，只有在上层决策确实需要区分时才提升到 capability 层。

export interface ConnectorRequest {
  platformId: string;
  intent: CapabilityIntent;
  payload: Record<string, unknown>;
  preferredChannel?: ChannelType;
  timeoutMs?: number;
  idempotencyKey?: string;
}

export interface ExecutionPlan {
  platformId: string;
  intent: CapabilityIntent;
  channel: ChannelType;
  endpointMode: 'rest_json' | 'a2a_envelope' | 'cli_stdout' | 'skill_call';
  idempotencyKey?: string;
}

export interface ConnectorResult<T> {
  status: 'success' | 'retryable_failure' | 'terminal_failure' | 'skipped';
  data?: T;
  failureClass?: FailureClass;
  retryAfterMs?: number;
  metadata: {
    platformId: string;
    channel: ChannelType;
    latencyMs: number;
    degraded?: boolean;
  };
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 executeCapability

**对应契约**: L0 §5.1 — `executeCapability(intent, request)`
**准入理由**: 含多步骤副作用链、路由、执行、归一化和审计。

```ts
async function executeCapability(intent: CapabilityIntent, request: ConnectorRequest): Promise<ConnectorResult<unknown>> {
  const plan = await planRoute(intent, request);
  const rawAttempt = await runExecutionPlan(plan, request);
  return normalizeOutcome(rawAttempt);
}
```

### §3.2 planRoute

**对应契约**: L0 §5.1 — `planRoute(intent, request)`
**准入理由**: 含 manifest、credential、cooldown、health 与风险决策。

```ts
async function planRoute(intent: CapabilityIntent, request: ConnectorRequest): Promise<ExecutionPlan> {
  const manifest = await registry.loadManifest(request.platformId);
  const credential = await state.loadCredentialState(request.platformId);
  const cooldown = await state.loadCooldownState(request.platformId, intent);
  // credential / cooldown 的 canonical owner 是 state-system；
  // connector 只读取，不在本地持久化第二份真相源。

  if (cooldown.blocked) {
    throw new ConnectorPolicyError('cooldown_blocked');
  }

  const channels = manifest.channelPriority.filter((channel) => capabilitySupported(manifest, intent, channel));
  const selected = selectBestChannel(channels, request.preferredChannel, credential.state);

  return buildExecutionPlan(intent, request, selected);
}
```

### §3.3 runViaRest

**对应契约**: L0 §5.1 — `runViaRest(plan)`
**准入理由**: 需处理 timeout、HTTP errors、Retry-After、raw result capture。

```ts
async function runViaRest(plan: ExecutionPlan): Promise<RawAttempt> {
  const response = await httpAdapter.send(plan);
  return {
    channel: 'api_rest',
    statusCode: response.status,
    rawBody: await response.text(),
    headers: Object.fromEntries(response.headers.entries()),
  };
}
```

### §3.4 runViaCli

**对应契约**: L0 §5.1 — `runViaCli(plan)`
**准入理由**: stdout/stderr parsing 脆弱，且需降级标记。

```ts
async function runViaCli(plan: ExecutionPlan): Promise<RawAttempt> {
  const result = await cliAdapter.execute(plan);
  return {
    channel: 'cli',
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    degraded: true,
  };
}
```

### §3.5 runViaSkill

**对应契约**: L0 §5.1 — `runViaSkill(plan)`
**准入理由**: skill / browser automation 是高风险 degraded channel。

```ts
async function runViaSkill(plan: ExecutionPlan): Promise<RawAttempt> {
  const result = await skillAdapter.execute(plan);
  return {
    channel: 'skill',
    rawPayload: result,
    degraded: true,
  };
}
```

### §3.6 recoverVerification

**对应契约**: L0 §5.1 — `recoverVerification(ctx)`
**准入理由**: verification recovery 是本系统核心恢复路径之一。

```ts
async function recoverVerification(ctx: VerificationContext): Promise<VerificationOutcome> {
  if (ctx.deadline && isExpired(ctx.deadline)) {
    return { status: 'failed', reason: 'verification_deadline_expired' };
  }

  return adapterFor(ctx.platformId).resumeVerification(ctx);
}
```

### §3.7 normalizeOutcome

**对应契约**: L0 §5.1 — `normalizeOutcome(attempt)`
**准入理由**: 统一失败语义和 execution metadata，是上层稳定性的关键。

```ts
function normalizeOutcome(attempt: RawAttempt): ConnectorResult<unknown> {
  if (attempt.success) {
    return {
      status: 'success',
      data: attempt.normalizedPayload,
      metadata: buildMetadata(attempt),
    };
  }

  const failure = classifyFailure(attempt.error);
  return {
    status: failure.retryable ? 'retryable_failure' : 'terminal_failure',
    failureClass: failure.class,
    retryAfterMs: failure.retryAfterMs,
    metadata: buildMetadata(attempt),
  };
}
```

### §3.8 classifyFailure

**对应契约**: L0 §5.1 — `classifyFailure(error)`
**准入理由**: 避免上层依赖原始错误字符串。

```ts
function classifyFailure(error: unknown): { class: FailureClass; retryable: boolean; retryAfterMs?: number } {
  if (isRateLimit(error)) return { class: 'rate_limited', retryable: true, retryAfterMs: readRetryAfter(error) };
  if (isVerificationRequired(error)) return { class: 'verification_required', retryable: false };
  if (isAuthExpired(error)) return { class: 'credential_expired', retryable: false };
  if (isParseFailure(error)) return { class: 'parse_failure', retryable: false };
  return { class: 'unknown_platform_change', retryable: false };
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 channel selection 决策树

**对应 L0 Mermaid**: `connector-system.md §4.1`

```ts
function selectBestChannel(channels: ChannelType[], preferred?: ChannelType, credentialState?: string): ChannelType {
  if (preferred && channels.includes(preferred)) return preferred;
  if (credentialState === 'pending_verification') return 'skill';
  if (channels.includes('api_rest')) return 'api_rest';
  if (channels.includes('a2a')) return 'a2a';
  if (channels.includes('cli')) return 'cli';
  if (channels.includes('skill')) return 'skill';
  return 'browser';
}
```

### §4.2 capability profile 示例

**对应 L0 Mermaid**: `connector-system.md §4.4`

```ts
const socialCommunityProfile = {
  capabilities: ['feed.read', 'post.publish', 'comment.reply', 'notification.list', 'message.send'],
};

const agentNetworkProfile = {
  capabilities: ['agent.register', 'agent.heartbeat', 'work.discover', 'task.claim'],
};
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| API 失败后立刻盲目 fallback 到 CLI | 重复副作用 / 脆弱执行 | route planner 显式决策，且高风险 side effect 禁止 degraded fallback |
| CLI stdout 格式变更 | parse failure | 标记 `parse_failure` 并停止自动重试 |
| side-effecting request 无幂等键重试 | 重复发帖 / 重复 claim | 缺少 idempotency context 时禁止自动 retry |
| verification deadline 已过 | 无意义重试 | 直接标记 terminal failure 并写回 state |
| 平台原始 DTO 泄漏到上层 | control-plane 被污染 | outcome normalizer 强制转换为统一 payload |
| connector 与 state 双写 cooldown / credential 状态 | 两套真相源逐渐漂移 | canonical state 留在 state-system，connector 仅维护运行态 health / attempt context |
| 把 `verification_required` 当成 credential lifecycle state | connector / CLI / audit 口径分叉 | `verification_required` 只作为 failure class；canonical credential state 统一使用 `pending_verification` |

### §5.1 degraded channel 被当作等价通道

```ts
// ❌ 错误做法
// 任何 API 错误都立即切到 browser automation

// ✅ 正确做法
// 仅 manifest 显式允许且风险等级允许时才降级到 skill/browser
```

### §5.2 多层重试

```ts
// ❌ 错误做法
// adapter 重试 + connector 重试 + control-plane 再重试

// ✅ 正确做法
// 只在 connector policy layer 统一做一层重试
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeConnectorRequest(overrides: Partial<ConnectorRequest> = {}): ConnectorRequest {
  return {
    platformId: 'instreet',
    intent: 'feed.read',
    payload: {},
    ...overrides,
  };
}

export function makeManifest(overrides: Partial<ConnectorManifest> = {}): ConnectorManifest {
  return {
    platformId: 'instreet',
    supportedCapabilities: ['feed.read', 'post.publish', 'comment.reply'],
    channelPriority: ['api_rest', 'cli'],
    credentialTypes: ['oauth_token'],
    ...overrides,
  };
}
```
