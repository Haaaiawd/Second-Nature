# CLI System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`cli-system.md`](./cli-system.md)  
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。  
> **孤岛检查**: 本文件各节均须在 L0 有对应超链接入口，禁止孤岛内容。

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v5.0 | 2026-05-01 | 升级为 host capability / delivery smoke / ops surface L1 |

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §6 数据模型 |
| §2 | [完整数据结构](#2-核心数据结构完整定义-full-data-structures) | L0 §6 数据模型 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 操作契约表 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 架构图 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 安全性 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 测试策略 |

---

## §1 配置常量 (Config Constants)

```ts
export const OPS_SURFACE_CONFIG = {
  pluginId: 'second-nature',
  commandName: 'second-nature',
  toolName: 'second_nature_ops',
  runtimeServiceName: 'second-nature-runtime',
  defaultOutputMode: 'json',
  supportedOutputModes: ['json', 'detail', 'table', 'explain'] as const,
} as const;

export const COMMAND_REGISTRY = {
  readOnly: ['status', 'report', 'audit', 'explain', 'fallback', 'capability_report'] as const,
  bridge: ['heartbeat_check'] as const,
  probe: ['capability_probe', 'host_smoke'] as const,
  write: ['policy', 'credential', 'quiet'] as const,
} as const;

export const RUNTIME_ARTIFACT_CONFIG = {
  requiredModules: [
    'runtime_registration',
    'ops_router',
    'heartbeat_bridge_adapter',
    'host_capability_adapter',
    'probe_runner',
    'read_model_adapter',
    'fallback_shell',
  ] as const,
  sourcePathDependencyAllowed: false,
  fallbackAllowedFor: ['runtime_artifact_missing', 'host_api_unavailable', 'schema_validation_failed'] as const,
} as const;

export const HOST_PROBE_CONFIG = {
  requiredCases: [
    'plugin_load',
    'heartbeat_check',
    'target_none',
    'target_last_or_explicit',
    'heartbeat_ok_ack_drop',
    'delivery_fallback',
  ] as const,
  optionalCases: ['run_heartbeat_once', 'heartbeat_prompt_contribution', 'message_sending_hook', 'next_turn_injection'] as const,
  defaultTimeoutMs: 10_000,
  sentinelPrefix: '[Second Nature host smoke]',
} as const;

export const OUTPUT_TRUTH_CONFIG = {
  sentStatuses: ['delivered', 'sent'] as const,
  notSentStatuses: ['not_sent', 'target_none', 'channel_missing', 'host_unsupported', 'host_api_unavailable'] as const,
  carrierOnlyStatus: 'runtime_carrier_only',
} as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

```ts
export type SurfaceMode = 'host_safe_carrier' | 'workspace_full_runtime' | 'capability_probe';
export type RuntimeArtifactModule =
  | 'runtime_registration'
  | 'ops_router'
  | 'heartbeat_bridge_adapter'
  | 'host_capability_adapter'
  | 'probe_runner'
  | 'read_model_adapter'
  | 'fallback_shell';

export type OpsCommandName =
  | 'status'
  | 'report'
  | 'audit'
  | 'explain'
  | 'fallback'
  | 'capability_report'
  | 'heartbeat_check'
  | 'capability_probe'
  | 'host_smoke'
  | 'policy'
  | 'credential'
  | 'quiet';

export type DeliveryCapabilityStatus =
  | 'target_available'
  | 'target_none'
  | 'channel_missing'
  | 'host_api_unavailable'
  | 'host_unsupported'
  | 'unknown';

export type CapabilityVerdict = 'pass' | 'fail' | 'unknown' | 'not_applicable';

export interface SourceRef {
  id: string;
  kind: 'platform_item' | 'workspace_artifact' | 'decision_record' | 'user_anchor' | 'connector_result' | 'host_report' | 'fallback_artifact';
  uri: string;
  excerptHash?: string;
  observedAt?: string;
}

export interface CapabilityCheckResult {
  name: string;
  verdict: CapabilityVerdict;
  observedAt: string;
  reason?: string;
  evidenceRefs: SourceRef[];
}

export interface OpsCommandInput {
  command: OpsCommandName;
  args?: Record<string, unknown>;
  outputMode?: 'json' | 'detail' | 'table' | 'explain';
}

export interface OpsCommandResult {
  ok: boolean;
  command: OpsCommandName;
  surfaceMode: SurfaceMode;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    requiredUserInput?: string[];
  };
  evidenceRefs: SourceRef[];
}

export interface HostCapabilityDocReference {
  title: string;
  url: string;
  checkedAt: string;
  documentedBehavior: string;
}

export interface HostCapabilityConflictRecord {
  capability: string;
  documentedBehavior: string;
  observedBehavior: string;
  hostVersion?: string;
  docUrl?: string;
}

export interface HeartbeatSurfaceInput {
  signalId?: string;
  target?: 'none' | 'last' | 'explicit';
  channel?: string;
  recipient?: string;
  probeOnly?: boolean;
}

export interface HeartbeatSurfaceResult {
  ok: boolean;
  status:
    | 'heartbeat_ok'
    | 'intent_selected'
    | 'denied'
    | 'deferred'
    | 'runtime_carrier_only'
    | 'delivery_unavailable';
  surfaceMode: SurfaceMode;
  decisionId?: string;
  deliveryAttemptId?: string;
  capabilityReportRef?: string;
  fallbackRef?: string;
  reasons: string[];
}

export interface HostCapabilityProbeInput {
  target?: 'none' | 'last' | 'explicit';
  channel?: string;
  recipient?: string;
  includeOptionalCases?: boolean;
  dryRun?: boolean;
}

export interface HostCapabilityReport {
  reportId: string;
  generatedAt: string;
  hostVersion?: string;
  observedVersion?: string;
  docLinks: HostCapabilityDocReference[];
  conflictRecords: HostCapabilityConflictRecord[];
  pluginLoad: CapabilityCheckResult;
  heartbeatBridge: CapabilityCheckResult;
  heartbeatToolInvocation: CapabilityCheckResult;
  deliveryTarget: DeliveryCapabilityStatus;
  ackDropBehavior: CapabilityCheckResult;
  runHeartbeatOnce?: CapabilityCheckResult;
  hookSupport: CapabilityCheckResult[];
  evidenceRefs: SourceRef[];
  recommendedNextStep?: string;
}

export interface HostSmokePlan {
  planId: string;
  cases: string[];
  target?: 'none' | 'last' | 'explicit';
  channel?: string;
  recipient?: string;
  dryRun: boolean;
}

export interface HostSmokeReport {
  reportId: string;
  planId: string;
  generatedAt: string;
  cases: CapabilityCheckResult[];
  overallVerdict: CapabilityVerdict;
  deliveryTarget: DeliveryCapabilityStatus;
  evidenceRefs: SourceRef[];
}

export interface OperatorFallbackView {
  fallbackRef: string;
  reason: string;
  status: 'not_sent';
  sourceRefs: SourceRef[];
  candidateMessage?: string;
  nextStep: string;
}

export interface OpenClawHostAdapter {
  getHostVersion(): Promise<string | undefined>;
  inspectHeartbeatCapability(): Promise<CapabilityCheckResult>;
  inspectHeartbeatToolInvocation(input: HostCapabilityProbeInput): Promise<CapabilityCheckResult>;
  inspectDeliveryTarget(input: HostCapabilityProbeInput): Promise<DeliveryCapabilityStatus>;
  inspectAckDropBehavior(): Promise<CapabilityCheckResult>;
  inspectHooks(): Promise<CapabilityCheckResult[]>;
  tryRunHeartbeatOnce?(input: HostCapabilityProbeInput): Promise<CapabilityCheckResult>;
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 registerPluginSurface

**对应契约**: L0 §5.1 — `registerPluginSurface(api)`  
**准入理由**: OpenClaw host 的 command/tool/service/hook 注册是本系统所有能力的宿主入口。

```ts
export async function registerPluginSurface(api: PluginSurfacePort): Promise<void> {
  const runtime = await resolvePackagedRuntime();

  api.registerCommand(createCommandDefinition(runtime.opsRouter));
  api.registerTool(createToolDefinition(runtime.opsRouter));
  api.registerService(createRuntimeService(runtime.runtimeCarrier));

  if (api.registerHook) {
    api.registerHook('heartbeat_prompt_contribution', runtime.hooks.heartbeatPromptContribution);
    api.registerHook('message_sending', runtime.hooks.messageSendingAudit);
    api.registerHook('message_sent', runtime.hooks.messageSentAudit);
  }
}
```

### §3.2 resolvePackagedRuntime

**对应契约**: L0 §5.1 — `resolvePackagedRuntime()`  
**准入理由**: ADR-006 要求发布包安装后不依赖源码仓路径。

```ts
export async function resolvePackagedRuntime(): Promise<PackagedRuntime> {
  const artifact = resolvePackageLocalArtifact();

  if (!artifact.exists) {
    return createFallbackRuntime('runtime_artifact_missing');
  }

  if (artifact.referencesSourcePath) {
    return createFallbackRuntime('source_path_dependency_forbidden');
  }

  return loadRuntimeRegistration(artifact.entry);
}
```

### §3.3 createOpsRouter

**对应契约**: L0 §5.1 — `createOpsRouter(deps)`  
**准入理由**: command 与 tool 必须共享同一语义，不允许 surface 漂移。

```ts
export function createOpsRouter(deps: CliOpsDeps): OpsRouter {
  return {
    async execute(input) {
      const validated = validateOpsCommandInput(input);
      if (!validated.ok) return validationFailure(input, validated.error);

      return executeOpsCommand(validated.value, deps);
    },
  };
}
```

### §3.4 executeOpsCommand

**对应契约**: L0 §5.1 — `executeOpsCommand(command,args)`  
**准入理由**: 所有 operator-facing surface 都必须返回稳定结构化结果。

```ts
export async function executeOpsCommand(input: OpsCommandInput, deps: CliOpsDeps): Promise<OpsCommandResult> {
  switch (input.command) {
    case 'heartbeat_check':
      return wrapHeartbeatResult(await heartbeatCheck(input.args, deps));
    case 'capability_probe':
      return success(input.command, await probeHostCapability(input.args, deps), 'capability_probe');
    case 'host_smoke':
      return success(input.command, await runHostSmoke(input.args, deps), 'capability_probe');
    case 'fallback':
      return success(input.command, await showOperatorFallback(String(input.args?.ref), deps), deps.surfaceMode);
    case 'explain':
      return success(input.command, await explainSurfaceSubject(String(input.args?.subject), deps), deps.surfaceMode);
    default:
      return deps.readModels.executeReadOrWriteCommand(input);
  }
}
```

### §3.5 heartbeatCheck

**对应契约**: L0 §5.1 — `heartbeatCheck(args)`  
**准入理由**: `heartbeat_check` 是 shipping bridge，必须区分 host-safe carrier 与真实 decision loop。

```ts
export async function heartbeatCheck(args: unknown, deps: CliOpsDeps): Promise<HeartbeatSurfaceResult> {
  const input = parseHeartbeatSurfaceInput(args);

  if (input.probeOnly) {
    const report = await probeHostCapability(input, deps);
    return {
      ok: report.deliveryTarget === 'target_available',
      status: report.deliveryTarget === 'target_available' ? 'heartbeat_ok' : 'delivery_unavailable',
      surfaceMode: 'capability_probe',
      capabilityReportRef: report.reportId,
      reasons: [`delivery_target:${report.deliveryTarget}`],
    };
  }

  if (!deps.controlPlaneAvailable) {
    return {
      ok: true,
      status: 'runtime_carrier_only',
      surfaceMode: 'host_safe_carrier',
      reasons: ['full_runtime_unavailable'],
    };
  }

  const result = await deps.controlPlane.runHeartbeatCycle(toHeartbeatSignal(input));
  return mapControlPlaneResultToSurface(result, deps.surfaceMode);
}
```

### §3.6 probeHostCapability

**对应契约**: L0 §5.1 — `probeHostCapability(options)`  
**准入理由**: REQ-025 要求明确哪条 OpenClaw path 能产生用户可见消息。

```ts
export async function probeHostCapability(raw: unknown, deps: CliOpsDeps): Promise<HostCapabilityReport> {
  const input = parseHostCapabilityProbeInput(raw);
  const hostVersion = await deps.host.getHostVersion();

  const pluginLoad = await deps.selfCheck.pluginLoad();
  const heartbeatBridge = await deps.host.inspectHeartbeatCapability();
  const heartbeatToolInvocation = await deps.host.inspectHeartbeatToolInvocation(input);
  const deliveryTarget = await deps.host.inspectDeliveryTarget(input);
  const ackDropBehavior = await deps.host.inspectAckDropBehavior();
  const hookSupport = await deps.host.inspectHooks();

  const runHeartbeatOnce = input.includeOptionalCases && deps.host.tryRunHeartbeatOnce
    ? await deps.host.tryRunHeartbeatOnce(input)
    : undefined;

  const report = assembleCapabilityReport({
    hostVersion,
    pluginLoad,
    heartbeatBridge,
    heartbeatToolInvocation,
    deliveryTarget,
    ackDropBehavior,
    hookSupport,
    runHeartbeatOnce,
  });

  await deps.observability.recordHostCapabilityReport(report);
  return report;
}
```

### §3.7 runHostSmoke

**对应契约**: L0 §5.1 — `runHostSmoke(plan)`  
**准入理由**: release gate 需要可复现 host smoke，而不是静态文档声明。

```ts
export async function runHostSmoke(raw: unknown, deps: CliOpsDeps): Promise<HostSmokeReport> {
  const plan = parseHostSmokePlan(raw);
  const results: CapabilityCheckResult[] = [];

  for (const smokeCase of plan.cases) {
    const result = await runSingleSmokeCase(smokeCase, plan, deps);
    results.push(result);
  }

  const report = assembleHostSmokeReport(plan, results);
  await deps.observability.recordHostSmokeReport(report);
  return report;
}
```

### §3.8 explainSurfaceSubject

**对应契约**: L0 §5.1 — `explainSurfaceSubject(subject)`  
**准入理由**: v5 operator 必须能追问 delivery/probe/fallback 的真实原因。

```ts
export async function explainSurfaceSubject(subject: string, deps: CliOpsDeps): Promise<ExplainReadModel> {
  if (!subject) {
    return missingSubjectExplain();
  }

  if (subject.startsWith('delivery:')) return deps.readModels.explainDelivery(subject);
  if (subject.startsWith('probe:')) return deps.readModels.explainCapabilityReport(subject);
  if (subject.startsWith('fallback:')) return deps.readModels.explainFallback(subject);
  if (subject.startsWith('decision:')) return deps.readModels.explainDecision(subject);

  return unsupportedExplainSubject(subject);
}
```

### §3.9 showOperatorFallback

**对应契约**: L0 §5.1 — `showOperatorFallback(ref)`  
**准入理由**: fallback 是 delivery unavailable 的用户可见兜底，但绝不能冒充 sent。

```ts
export async function showOperatorFallback(ref: string, deps: CliOpsDeps): Promise<OperatorFallbackView> {
  const fallback = await deps.readModels.loadFallbackView(ref);

  return {
    ...fallback,
    status: 'not_sent',
  };
}
```

### §3.10 fallbackUnavailable

**对应契约**: L0 §5.1 — `fallbackUnavailable(reason)`  
**准入理由**: runtime/probe 不可用时要显式失败，不能吞成成功。

```ts
export function fallbackUnavailable(reason: string, command?: OpsCommandName): OpsCommandResult {
  return {
    ok: false,
    command: command ?? 'status',
    surfaceMode: 'host_safe_carrier',
    error: {
      code: reason,
      message: `Second Nature runtime surface is unavailable: ${reason}`,
    },
    evidenceRefs: [],
  };
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Delivery capability status 归类

**对应 L0 Mermaid**: `cli-system.md §4.4`

```ts
export function classifyDeliveryCapability(input: DeliveryTargetProbeResult): DeliveryCapabilityStatus {
  if (input.target === 'none') return 'target_none';
  if (input.hostUnsupported) return 'host_unsupported';
  if (input.hostApiUnavailable) return 'host_api_unavailable';
  if (input.target !== 'none' && input.channelResolved && input.recipientResolved) return 'target_available';
  if (input.target === 'last' || input.target === 'explicit') return 'channel_missing';
  return 'unknown';
}
```

### §4.2 Host smoke overall verdict

**对应 L0 Mermaid**: `cli-system.md §4.4`

```ts
export function resolveSmokeVerdict(cases: CapabilityCheckResult[]): CapabilityVerdict {
  if (cases.some((item) => item.verdict === 'fail')) return 'fail';
  if (cases.some((item) => item.verdict === 'unknown')) return 'unknown';
  if (cases.every((item) => item.verdict === 'pass' || item.verdict === 'not_applicable')) return 'pass';
  return 'unknown';
}
```

### §4.3 `HEARTBEAT_OK` 输出保护

**对应 L0 §11 Host Smoke Testing**

```ts
export function shouldUseHeartbeatAck(result: HeartbeatSurfaceResult): boolean {
  return result.status === 'heartbeat_ok'
    && !result.deliveryAttemptId
    && !result.fallbackRef
    && result.reasons.every((reason) => !reason.includes('outreach'));
}
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| `ok: true` 被理解为“主动联系成功” | 误导用户 | 必须同时检查 `status`、`deliveryAttemptId`、`surfaceMode` |
| `target: "none"` heartbeat 成功 | 被误判为用户已收到 | status 写 `delivery_unavailable` 或 report 写 `target_none` |
| ack 文本包住有效提醒 | 被 OpenClaw ack drop 吞掉 | alert/outreach 不得输出短 `HEARTBEAT_OK` 形态 |
| capability probe 发送真实消息打扰用户 | 噪声/惊扰 | 默认 dry-run/sentinel；真实投递需显式配置 |
| host-safe status connectors 为空 | 被误认为真实无连接器 | 返回 `surfaceMode: host_safe_carrier` 与说明 |
| fallback 展示 candidate message | 泄露敏感内容 | candidate message 只使用 redacted summary/sourceRefs |
| unknown hook/API | 被当作失败实现 | 标为 `unknown` / `host_api_unavailable`，进入 report |
| command/tool schema 漂移 | agent 调用失败 | command 与 tool 共用 `OpsCommandInput` |

### §5.1 错误: fallback 标记为 sent

```ts
// 错误
const fallback = { status: 'sent', reason: 'target_none' };

// 正确
const fallback = { status: 'not_sent', reason: 'target_none' };
```

### §5.2 错误: 只看 `ok`

```ts
// 错误
if (result.ok) markUserContacted();

// 正确
if (result.deliveryAttemptId && result.status !== 'delivery_unavailable') markUserContacted();
```

### §5.3 错误: wrapper 引用源码仓路径

```ts
// 错误
require('../src/cli/index.js');

// 正确
resolvePackageLocalArtifact('runtime/registration.js');
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeCapabilityCheck(overrides: Partial<CapabilityCheckResult> = {}): CapabilityCheckResult {
  return {
    name: 'target_none',
    verdict: 'fail',
    observedAt: '2026-05-01T00:00:00.000Z',
    reason: 'heartbeat target was none, so no user-visible delivery occurred',
    evidenceRefs: [{ id: 'smoke:target-none', kind: 'workspace_artifact', uri: 'reports/smoke/target-none.md' }],
    ...overrides,
  };
}

export function makeHostCapabilityReport(overrides: Partial<HostCapabilityReport> = {}): HostCapabilityReport {
  return {
    reportId: 'capability-report:test',
    generatedAt: '2026-05-01T00:00:00.000Z',
    hostVersion: 'openclaw:test',
    observedVersion: 'openclaw:test',
    docLinks: [{ title: 'OpenClaw heartbeat delivery', url: 'https://docs.openclaw.ai/gateway/heartbeat', checkedAt: '2026-05-01', documentedBehavior: 'target none does not deliver to user' }],
    conflictRecords: [],
    pluginLoad: makeCapabilityCheck({ name: 'plugin_load', verdict: 'pass' }),
    heartbeatBridge: makeCapabilityCheck({ name: 'heartbeat_check', verdict: 'pass' }),
    heartbeatToolInvocation: makeCapabilityCheck({ name: 'heartbeat_tool_invocation', verdict: 'pass' }),
    deliveryTarget: 'target_none',
    ackDropBehavior: makeCapabilityCheck({ name: 'heartbeat_ok_ack_drop', verdict: 'pass' }),
    hookSupport: [],
    evidenceRefs: [{ id: 'smoke:target-none', kind: 'workspace_artifact', uri: 'reports/smoke/target-none.md' }],
    recommendedNextStep: 'configure target:last or explicit channel/to and rerun host_smoke',
    ...overrides,
  };
}

export function makeHeartbeatSurfaceResult(overrides: Partial<HeartbeatSurfaceResult> = {}): HeartbeatSurfaceResult {
  return {
    ok: true,
    status: 'runtime_carrier_only',
    surfaceMode: 'host_safe_carrier',
    reasons: ['full_runtime_unavailable'],
    ...overrides,
  };
}

export function makeOperatorFallbackView(overrides: Partial<OperatorFallbackView> = {}): OperatorFallbackView {
  return {
    fallbackRef: 'fallback:test',
    reason: 'target_none',
    status: 'not_sent',
    sourceRefs: [{ id: 'life:evidence:test', kind: 'workspace_artifact', uri: 'memory/evidence/test.md' }],
    nextStep: 'configure a user-visible OpenClaw delivery target',
    ...overrides,
  };
}
```
