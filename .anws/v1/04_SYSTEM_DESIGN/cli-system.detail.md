# CLI System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [cli-system.md](./cli-system.md)  
> 本文件仅在 `/forge` 任务明确引用时加载。

---

## 版本历史

| 版本 | 日期 | Changelog |
| ---- | ------------ | --------- |
| v1.0 | 2026-03-22 | 初始版本 |

---

## 本文件章节索引

|   §   | 章节 | 对应 L0 入口 |
| :---: | ---- | :-----------: |
|  §1   | [配置常量](#1-配置常量) | L0 §7 技术选型 |
|  §2   | [核心数据结构](#2-核心数据结构) | L0 §6 数据模型 |
|  §3   | [核心流程](#3-核心流程) | L0 §5 接口设计 |
|  §4   | [决策树](#4-决策树) | L0 §4 系统架构 |
|  §5   | [边缘情况](#5-边缘情况) | L0 §9 / §10 |
|  §6   | [测试辅助](#6-测试辅助) | L0 §11 测试策略 |

---

## §1 配置常量

```typescript
export const CLI_CONFIG = {
  output: {
    defaultMode: 'table' as const,
    maxTableWidth: 120,
    truncateTextAt: 80,
  },

  interaction: {
    confirmTimeoutMs: 30000,
    maxPromptRetries: 3,
    allowNonInteractiveFallback: true,
  },

  performance: {
    slowCommandThresholdMs: 1000,
    queryDefaultLimit: 20,
    queryMaxLimit: 100,
  },
} as const;

export const POLICY_LIMITS = {
  dailyDurationMinutes: { min: 0, max: 240 },
  sessionDurationMinutes: { min: 1, max: 60 },
  dailyInteractions: { min: 0, max: 30 },
  priority: { min: 0, max: 100 },
} as const;
```

---

## §2 核心数据结构

### 2.1 CliCommandContext

```typescript
export interface CliCommandContext {
  commandName: string;
  args: string[];
  flags: Record<string, unknown>;
  outputMode: 'table' | 'detail' | 'json';
  interactive: boolean;
  traceId: string;
}
```

### 2.2 视图模型

```typescript
export interface PolicyView {
  platformId: string;
  enabled: boolean;
  budget: {
    dailyDuration: number;
    sessionDuration: number;
    dailyInteractions: number;
  };
  scheduling: {
    priority: number;
    coolingPeriod: number;
  };
  warnings: string[];
}

export interface SystemStatusView {
  runtimeState: 'idle' | 'running' | 'paused' | 'degraded';
  budgetSummary: {
    globalRemainingMinutes: number;
    activePlatforms: number;
    exhaustedPlatforms: number;
  };
  platforms: Array<{
    platformId: string;
    connectorStatus: 'healthy' | 'degraded' | 'blocked';
    nextAction?: string;
    executionChannel?: 'api' | 'cli' | 'skill';
  }>;
  pendingActions: ActionRequiredView[];
}

export interface SessionSummaryView {
  sessionId: string;
  platformId: string;
  state: string;
  startedAt: string;
  interactionCount: number;
  outcome: 'completed' | 'skipped' | 'failed';
}

export interface SessionDetailView {
  sessionId: string;
  platformId: string;
  decisionReason?: string;
  reflectionSummary?: string;
  timeline: Array<{
    timestamp: string;
    type: string;
    status: string;
    summary: string;
  }>;
  auditRefs: string[];
}

export interface ActionRequiredView {
  platformId: string;
  type: 'verification' | 'claim_url' | 'credential_refresh' | 'manual_review';
  reason: string;
  nextStep: string;
  deadline?: string;
}
```

### 2.3 CliResult

```typescript
export interface CliResult<T> {
  status: 'success' | 'validation_error' | 'execution_error' | 'not_found';
  data?: T;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
    nextStep?: string;
  };
  metadata: {
    command: string;
    durationMs: number;
    traceId: string;
  };
}
```

---

## §3 核心流程

### §3.1 `policy set` 交互流程

**对应契约**: L0 §5.1 — `policy set`

```typescript
async function handlePolicySet(ctx: CliCommandContext): Promise<CliResult<PolicyView>> {
  const start = Date.now();

  const input = await resolvePolicyInput(ctx);
  const validation = validatePolicyInput(input);
  if (!validation.ok) {
    return {
      status: 'validation_error',
      error: {
        code: 'INVALID_POLICY_INPUT',
        message: validation.message,
        recoverable: true,
        nextStep: '修正输入后重新执行 `policy set`',
      },
      metadata: {
        command: 'policy set',
        durationMs: Date.now() - start,
        traceId: ctx.traceId,
      },
    };
  }

  const result = await controlPlane.configurePolicy({
    platformId: input.platformId,
    budget: input.budget,
    scheduling: input.scheduling,
  });

  if (!result.ok) {
    return {
      status: 'execution_error',
      error: {
        code: result.error.code,
        message: result.error.message,
        recoverable: result.error.recoverable,
        nextStep: result.error.nextStep,
      },
      metadata: {
        command: 'policy set',
        durationMs: Date.now() - start,
        traceId: ctx.traceId,
      },
    };
  }

  return {
    status: 'success',
    data: mapPolicyToView(result.data),
    metadata: {
      command: 'policy set',
      durationMs: Date.now() - start,
      traceId: ctx.traceId,
    },
  };
}
```

### §3.2 `status show` 聚合读取

**对应契约**: L0 §5.1 — `status show`

```typescript
async function handleStatusShow(ctx: CliCommandContext): Promise<CliResult<SystemStatusView>> {
  const start = Date.now();

  const [runtime, platformStates, pendingActions] = await Promise.all([
    controlPlane.getRuntimeStatus(),
    controlPlane.getPlatformStatuses(),
    observability.getActionRequired(),
  ]);

  return {
    status: 'success',
    data: {
      runtimeState: runtime.state,
      budgetSummary: runtime.budgetSummary,
      platforms: platformStates.map(state => ({
        platformId: state.platformId,
        connectorStatus: state.connectorStatus,
        nextAction: state.nextAction,
        executionChannel: state.executionChannel,
      })),
      pendingActions: pendingActions.map(mapActionRequired),
    },
    metadata: {
      command: 'status show',
      durationMs: Date.now() - start,
      traceId: ctx.traceId,
    },
  };
}
```

### §3.3 `session show` 审计详情展示

**对应契约**: L0 §5.1 — `session show`

```typescript
async function handleSessionShow(
  sessionId: string,
  ctx: CliCommandContext
): Promise<CliResult<SessionDetailView>> {
  const start = Date.now();

  const session = await stateSystem.getSession(sessionId);
  if (!session) {
    return {
      status: 'not_found',
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `Session ${sessionId} 不存在`,
        recoverable: true,
        nextStep: '先运行 `session list` 查看可用会话',
      },
      metadata: {
        command: 'session show',
        durationMs: Date.now() - start,
        traceId: ctx.traceId,
      },
    };
  }

  const auditEvents = await observability.queryEvents({
    sessionId,
    limit: CLI_CONFIG.performance.queryMaxLimit,
  });

  return {
    status: 'success',
    data: buildSessionDetailView(session, auditEvents),
    metadata: {
      command: 'session show',
      durationMs: Date.now() - start,
      traceId: ctx.traceId,
    },
  };
}
```

### §3.4 人工介入提示生成

**对应契约**: L0 §5.4 — 人工介入提示契约

```typescript
function buildActionRequiredMessage(action: ActionRequiredView): string {
  const lines = [
    `[${action.platformId}] 需要人工处理: ${action.type}`,
    `原因: ${action.reason}`,
    `下一步: ${action.nextStep}`,
  ];

  if (action.deadline) {
    lines.push(`截止时间: ${action.deadline}`);
  }

  lines.push('处理完成后，请重新运行相应状态或继续命令。');

  return lines.join('\n');
}
```

---

## §4 决策树

### §4.1 命令执行方式判定

```typescript
function decideInteractionMode(ctx: CliCommandContext, requiredFields: string[]): 'direct' | 'prompt' | 'reject' {
  const missing = requiredFields.filter(field => !(field in ctx.flags));

  if (missing.length === 0) {
    return 'direct';
  }

  if (ctx.interactive && CLI_CONFIG.interaction.allowNonInteractiveFallback) {
    return 'prompt';
  }

  return 'reject';
}
```

### §4.2 错误展示级别判定

```typescript
function decideErrorPresentation(error: {
  recoverable: boolean;
  code: string;
}): 'user_fixable' | 'system_failure' {
  if (error.recoverable) {
    return 'user_fixable';
  }

  if (error.code.startsWith('INVALID_') || error.code.endsWith('_NOT_FOUND')) {
    return 'user_fixable';
  }

  return 'system_failure';
}
```

---

## §5 边缘情况

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| 用户在非交互模式缺少必要参数 | 命令无法完成 | 直接失败并输出缺失参数与示例 |
| 用户输入预算冲突 | 无效策略写入 | 本地校验拦截，显示可修复原因 |
| 查询结果为空 | 用户误判系统故障 | 明确返回“无数据”而非空白输出 |
| 需要人工介入但提示不清楚 | 用户卡死 | 固定输出“原因 + 下一步 + 完成后命令” |
| JSON 输出泄漏敏感字段 | 安全风险 | JSON 模式同样经过脱敏层 |
| 底层系统超时 | CLI 看起来无响应 | 标记慢命令并输出阶段性提示 |

### §5.1 非交互模式拒绝模板

```typescript
function buildMissingArgsError(command: string, missingArgs: string[]): CliResult<never> {
  return {
    status: 'validation_error',
    error: {
      code: 'MISSING_REQUIRED_ARGS',
      message: `命令 ${command} 缺少必填参数: ${missingArgs.join(', ')}`,
      recoverable: true,
      nextStep: `补齐参数后重新运行 ${command}`,
    },
    metadata: {
      command,
      durationMs: 0,
      traceId: generateTraceId(),
    },
  };
}
```

---

## §6 测试辅助

```typescript
export function makeTestCliContext(
  overrides: Partial<CliCommandContext> = {}
): CliCommandContext {
  return {
    commandName: 'status show',
    args: [],
    flags: {},
    outputMode: 'table',
    interactive: false,
    traceId: 'trace-test-001',
    ...overrides,
  };
}

export function makeTestPolicyView(
  overrides: Partial<PolicyView> = {}
): PolicyView {
  return {
    platformId: 'instreet',
    enabled: true,
    budget: {
      dailyDuration: 60,
      sessionDuration: 10,
      dailyInteractions: 10,
    },
    scheduling: {
      priority: 80,
      coolingPeriod: 30,
    },
    warnings: [],
    ...overrides,
  };
}

export class MockCliFormatter {
  renderTable(data: unknown): string {
    return JSON.stringify(data);
  }

  renderDetail(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }

  renderJson(data: unknown): string {
    return JSON.stringify(data);
  }
}
```
