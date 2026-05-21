# Connector System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`connector-system.md`](./connector-system.md)
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。
> **孤岛检查**: 本文件各节均须在 L0 有对应超链接入口，禁止孤岛内容。

---

## 版本历史

| 版本 | 日期         | Changelog |
| ---- | ------------ | --------- |
| v1.0 | 2026-05-21   | 初始版本，基于 v7 Genesis 设计 |

---

## 本文件章节索引

|   §   | 章节                                                                                   | 对应 L0 入口             |
| :---: | -------------------------------------------------------------------------------------- | :----------------------: |
|  §1   | [配置常量](#1-配置常量-config-constants)                                               | L0 §6 数据模型           |
|  §2   | [完整数据结构](#2-核心数据结构完整定义-full-data-structures)                           | L0 §6 数据模型           |
|  §3   | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode)                   | L0 §5 操作契约表         |
|  §4   | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details)                             | L0 §4 架构图             |
|  §5   | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas)                       | L0 §5 / §9               |
|  §6   | [测试辅助](#6-测试辅助-test-helpers)                                                   | L0 §11 测试策略          |

---

## §1 配置常量 (Config Constants)

> 所有硬编码配置、枚举映射、查找表集中放在此处。
> **L0 对应入口**: L0 §6 末尾锚点 → *配置常量字典详见 [L1 §1]*

```typescript
// ── Connector Schema Version ──
export const CONNECTOR_SCHEMA_VERSION_V7 = "sn.connector.v7" as const;
export const CONNECTOR_SCHEMA_VERSION_V6 = "sn.connector.v1" as const;

// ── Capability Type 枚举 ──
export const CAPABILITY_TYPES = ["read", "write", "claim", "heartbeat"] as const;
export type CapabilityType = (typeof CAPABILITY_TYPES)[number];

// ── Idempotency Class 枚举 ──
export const IDEMPOTENCY_CLASSES = ["none", "best_effort", "strict"] as const;
export type IdempotencyClass = (typeof IDEMPOTENCY_CLASSES)[number];

// ── 强制 strict idempotency 的 capability type ──
export const STRICT_IDEMPOTENCY_REQUIRED_TYPES: CapabilityType[] = ["write", "claim"];

// ── StructuredUnavailableReason.reason 枚举 ──
export const UNAVAILABLE_REASONS = [
  "not_registered",
  "credentials_missing",
  "circuit_open",
  "trust_denied",
  "platform_error",
  "probe_failed",
] as const;
export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

// ── Trust Status 枚举（继承自 v6）──
export const CONNECTOR_TRUST_STATUSES = [
  "declarative_trusted",
  "custom_adapter_pending_trust",
  "trusted_custom_adapter",
  "blocked",
] as const;
export type ConnectorTrustStatus = (typeof CONNECTOR_TRUST_STATUSES)[number];

// ── 可执行的 trust status（不可执行的直接 trust_denied）──
export const EXECUTABLE_TRUST_STATUSES: ConnectorTrustStatus[] = [
  "declarative_trusted",
  "trusted_custom_adapter",
];

// ── Failure Class 枚举（继承自 v6，13 种）──
export const FAILURE_CLASSES = [
  "auth_failure",
  "not_found",
  "rate_limited",
  "server_error",
  "timeout",
  "policy_denied",
  "payload_rejected",
  "circuit_open",
  "credential_missing",
  "trust_denied",
  "network_error",
  "schema_mismatch",
  "unknown",
] as const;
export type FailureClass = (typeof FAILURE_CLASSES)[number];

// ── HTTP status → FailureClass 映射表 ──
export const HTTP_STATUS_TO_FAILURE_CLASS: Record<number, FailureClass> = {
  400: "payload_rejected",
  401: "auth_failure",
  403: "trust_denied",
  404: "not_found",
  408: "timeout",
  422: "schema_mismatch",
  429: "rate_limited",
  500: "server_error",
  502: "server_error",
  503: "server_error",
  504: "timeout",
};

// ── Wet Probe 默认配置 ──
export const WET_PROBE_DEFAULTS = {
  timeoutMs: 5000,
  maxRedactedSampleBytes: 512,
  maxRetryOnTimeout: 0,          // probe 不重试
} as const;

// ── EffectCommitLedger 默认 TTL ──
export const EFFECT_COMMIT_LEDGER_TTL_HOURS = 72;

// ── ConnectorResult sourceRef 前缀 ──
export const CONNECTOR_AUDIT_REF_PREFIX = "connector:audit:";
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

> 含方法签名和关键注释的完整 TypeScript 类型定义。
> **L0 对应入口**: L0 §6.1 末尾锚点 → *完整方法实现详见 [L1 §2]*

```typescript
import { z } from "zod";
import type {
  ConnectorTrustStatus,
  CapabilityType,
  IdempotencyClass,
  UnavailableReason,
  FailureClass,
} from "./constants.js";

// ── ConnectorManifestV7 Zod Schema ──
export const capabilityDeclarationV7Schema = z.object({
  capabilityId: z.string().min(1).regex(/^[a-zA-Z0-9_.:-]+$/),
  type: z.enum(["read", "write", "claim", "heartbeat"]),
  endpointTemplate: z.string().min(1),
  trustRequired: z.enum([
    "declarative_trusted",
    "custom_adapter_pending_trust",
    "trusted_custom_adapter",
    "blocked",
  ]),
  safe_for_probe: z.boolean(),
  idempotencyClass: z.enum(["none", "best_effort", "strict"]),
  description: z.string().optional(),
});

export const endpointMappingsSchema = z.object({
  profilePath: z.string().optional(),
  claimPath: z.string().optional(),
  heartbeatPath: z.string().optional(),
  feedPath: z.string().optional(),
});

export const probeConfigSchema = z.object({
  safeEndpoint: z.string().url(),
  expectedStatus: z.number().int().min(100).max(599),
  timeoutMs: z.number().int().positive().optional(),
});

export const connectorManifestV7Schema = z.object({
  schemaVersion: z.literal("sn.connector.v7"),
  platformId: z.string().min(1),
  displayName: z.string().min(1),
  family: z.enum(["social_community", "agent_network", "work_platform", "custom"]),
  capabilities: z.array(capabilityDeclarationV7Schema).min(1),
  endpointMappings: endpointMappingsSchema,
  probeConfig: probeConfigSchema,
  runner: z.object({
    kind: z.enum([
      "declarative_http",
      "declarative_a2a",
      "declarative_mcp",
      "cli_descriptor",
      "custom_adapter",
      "skill",
      "browser",
    ]),
    entrypoint: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  }),
  credentials: z.array(
    z.object({
      type: z.string().min(1),
      required: z.boolean().default(true),
      description: z.string().optional(),
    }),
  ),
  sourceRefPolicy: z.object({
    minSourceRefs: z.number().int().min(0).default(1),
    rejectInlineSensitivePayload: z.boolean().optional(),
  }),
  trust: z
    .object({
      status: z
        .enum([
          "declarative_trusted",
          "custom_adapter_pending_trust",
          "trusted_custom_adapter",
          "blocked",
        ])
        .optional(),
      override: z.boolean().optional(),
      reason: z.string().optional(),
    })
    .optional(),
});

export type ConnectorManifestV7 = z.infer<typeof connectorManifestV7Schema>;

// ── ConnectorResult ──
export interface ConnectorResult {
  executionId: string;           // crypto.randomUUID() 或 hash(decisionId + idempotencyKey)
  platformId: string;
  capabilityId: string;
  status: "success" | "failure" | "timeout" | "policy_denied";
  sourceRef: string;             // format: "connector:audit:{executionId}"
  redactedSummary: string | null;
  telemetry: ExecutionTelemetry;
  failureClass?: FailureClass;
}

// ── ExecutionTelemetry ──
export interface ExecutionTelemetry {
  durationMs: number;
  timestamp: string;
  channel: string;
  attemptNumber: number;
}

// ── CapabilityProbeResult ──
export interface CapabilityProbeResult {
  platformId: string;
  probeEndpoint: string;
  probedAt: string;
  httpStatus: number;
  latencyMs: number;
  declaredCapabilities: string[];
  actualCapabilities: string[];
  endpointMismatch: boolean;
  mismatchReason?: string;
  redactedSample: string | null;  // max 512 bytes
}

// ── StructuredUnavailableReason ──
export interface StructuredUnavailableReason {
  reason: UnavailableReason;
  details: string;
  platformId?: string;
  capabilityId?: string;
}

// ── ConnectorExecutionRequest ──
export interface ConnectorExecutionRequest {
  platformId: string;
  capabilityId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  decisionId?: string;
  timeoutMs?: number;
}

// ── CredentialContext ──
export interface CredentialContext {
  platformId: string;
  encryptedValue: string | null;
  status: "active" | "inactive" | "missing";
  credentialType: string;
}

// ── TrustDecision ──
export interface TrustDecision {
  allowed: boolean;
  trustStatus: ConnectorTrustStatus;
  denyReason?: string;
}

// ── ConnectorRegistrationResult ──
export interface ConnectorRegistrationResult {
  platformId: string;
  success: boolean;
  validationErrors?: Array<{ path: string; message: string }>;
  probeScheduled: boolean;  // auto wet probe 是否已异步触发
}

// ── ResolvedConnectorCapability ──
export interface ResolvedConnectorCapability {
  platformId: string;
  capabilityId: string;
  type: CapabilityType;
  endpointTemplate: string;
  trustRequired: ConnectorTrustStatus;
  safe_for_probe: boolean;
  idempotencyClass: IdempotencyClass;
}

// ── EffectCommitRecord ──
export interface EffectCommitRecord {
  key: string;          // format: "{decisionId}::{idempotencyKey}"
  state: "committed" | "pending";
  committedAt: string;
  expiresAt: string;    // committedAt + TTL_HOURS
  executionId: string;
}

// ── IConnectorSystem 接口（完整签名）──
export interface IConnectorSystem {
  registerConnector(manifest: ConnectorManifestV7): Promise<ConnectorRegistrationResult>;
  unregisterConnector(platformId: string): Promise<{ success: boolean; auditRef: string }>;
  resolveCapability(
    platformId: string,
    capabilityId: string,
  ): ResolvedConnectorCapability | StructuredUnavailableReason;
  executeCapability(
    request: ConnectorExecutionRequest,
    credentialCtx: CredentialContext,
    trustDecision: TrustDecision,
  ): Promise<ConnectorResult | StructuredUnavailableReason>;
  runWetProbe(
    platformId: string,
    probeConfig: { safeEndpoint: string; expectedStatus: number; timeoutMs?: number },
  ): Promise<CapabilityProbeResult>;
  listRegisteredConnectors(): ConnectorInventoryEntry[];
  getCapabilityProbeResult(platformId: string): Promise<CapabilityProbeResult | null>;
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 registerConnector

**对应契约**: L0 §5.1 — `registerConnector(manifest)`
**准入理由**: 含多步骤副作用链（Zod 校验 → registry 原子替换 → 异步 probe 触发）+ 不明显的 conflict 处理规则

```typescript
async function registerConnector(
  manifest: unknown,
): Promise<ConnectorRegistrationResult> {
  // Step 1: Zod strict parse
  const parseResult = connectorManifestV7Schema.safeParse(manifest);
  if (!parseResult.success) {
    return {
      platformId: (manifest as Record<string, unknown>)?.platformId as string ?? "unknown",
      success: false,
      validationErrors: parseResult.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
      probeScheduled: false,
    };
  }

  const parsed = parseResult.data;

  // Step 2: Conflict check — 同 platformId 已存在时 fail-closed
  const existing = registry.getSnapshot().entries.get(parsed.platformId);
  if (existing && existing.source === "built_in" && manifest_source === "workspace") {
    return {
      platformId: parsed.platformId,
      success: false,
      validationErrors: [{ path: "platformId", message: "conflict:built_in_already_registered" }],
      probeScheduled: false,
    };
  }

  // Step 3: Atomic snapshot swap
  registry.atomicSwap(parsed.platformId, parsed);

  // Step 4: Async wet probe (不阻塞 register 返回)
  const probeable = parsed.capabilities.some((c) => c.safe_for_probe && c.type === "read");
  if (probeable) {
    setImmediate(() => {
      runWetProbe(parsed.platformId, parsed.probeConfig).catch((err) => {
        observabilityPort.emit("probe_error", { platformId: parsed.platformId, err });
      });
    });
  }

  return {
    platformId: parsed.platformId,
    success: true,
    probeScheduled: probeable,
  };
}
```

> **注意事项**: Step 4 使用 `setImmediate` 异步触发，不 await；调用方不应依赖 probe 结果同步可用。probe 失败由 observability 异步记录。

---

### §3.2 resolveCapability

**对应契约**: L0 §5.1 — `resolveCapability(platformId, capabilityId)`
**准入理由**: 含不明显的 namespace 解析规则（与 v6 `resolveCapability` 行为兼容）

```typescript
function resolveCapability(
  platformId: string,
  capabilityId: string,
): ResolvedConnectorCapability | StructuredUnavailableReason {
  const snapshot = registry.getSnapshot();
  const manifestEntry = snapshot.entries.get(platformId);

  if (!manifestEntry) {
    return {
      reason: "not_registered",
      details: `Platform '${platformId}' is not registered in CapabilityContractRegistry`,
      platformId,
      capabilityId,
    };
  }

  const manifest = manifestEntry.manifest as ConnectorManifestV7;
  const capability = manifest.capabilities.find((c) => c.capabilityId === capabilityId);

  if (!capability) {
    return {
      reason: "not_registered",
      details: `Capability '${capabilityId}' not declared in manifest for '${platformId}'`,
      platformId,
      capabilityId,
    };
  }

  return {
    platformId,
    capabilityId: capability.capabilityId,
    type: capability.type,
    endpointTemplate: capability.endpointTemplate,
    trustRequired: capability.trustRequired,
    safe_for_probe: capability.safe_for_probe,
    idempotencyClass: capability.idempotencyClass,
  };
}
```

---

### §3.3 executeCapability

**对应契约**: L0 §5.1 — `executeCapability(request, credentialCtx, trustDecision)`
**准入理由**: 含多步骤副作用链（credential 校验 → trust 校验 → idempotency 校验 → HTTP 执行 → redaction → telemetry 写入）+ 多分支不可用路径

```typescript
async function executeCapability(
  request: ConnectorExecutionRequest,
  credentialCtx: CredentialContext,
  trustDecision: TrustDecision,
): Promise<ConnectorResult | StructuredUnavailableReason> {
  const startMs = Date.now();

  // Step 1: Resolve capability
  const resolved = resolveCapability(request.platformId, request.capabilityId);
  if ("reason" in resolved) return resolved;

  // Step 2: Credential gate
  if (
    credentialCtx.status !== "active" ||
    !credentialCtx.encryptedValue
  ) {
    return {
      reason: "credentials_missing",
      details: `Credential for '${request.platformId}' is ${credentialCtx.status}`,
      platformId: request.platformId,
      capabilityId: request.capabilityId,
    };
  }

  // Step 3: Trust policy gate
  if (!trustDecision.allowed) {
    return {
      reason: "trust_denied",
      details: trustDecision.denyReason ?? `Trust status '${trustDecision.trustStatus}' is not executable`,
      platformId: request.platformId,
      capabilityId: request.capabilityId,
    };
  }

  // Step 4: Idempotency gate (side_effect / claim require strict key)
  if (STRICT_IDEMPOTENCY_REQUIRED_TYPES.includes(resolved.type)) {
    if (!request.idempotencyKey) {
      return {
        reason: "platform_error",
        details: `Capability type '${resolved.type}' requires idempotencyKey`,
        platformId: request.platformId,
        capabilityId: request.capabilityId,
      };
    }
    const ledgerKey = `${request.decisionId ?? "no-decision"}::${request.idempotencyKey}`;
    const existing = await effectCommitLedger.getOrCreate(ledgerKey);
    if (existing.state === "committed") {
      // Already committed — skip adapter, return reference
      return {
        executionId: existing.executionId,
        platformId: request.platformId,
        capabilityId: request.capabilityId,
        status: "success",
        sourceRef: `${CONNECTOR_AUDIT_REF_PREFIX}${existing.executionId}`,
        redactedSummary: "[already_committed:idempotent_skip]",
        telemetry: {
          durationMs: 0,
          timestamp: new Date().toISOString(),
          channel: "ledger_skip",
          attemptNumber: 0,
        },
      };
    }
  }

  // Step 5: Resolve endpoint from endpointMappings
  const manifest = registry.getManifest(request.platformId)!;
  const endpoint = resolveEndpoint(resolved.endpointTemplate, manifest.endpointMappings, request.payload);

  // Step 6: HTTP execution — credential decrypted in-memory, injected into header
  const decryptedCredential = credentialVault.decryptInMemory(credentialCtx.encryptedValue);
  let httpResponse: Response;
  let executionId: string;

  try {
    executionId = crypto.randomUUID();
    httpResponse = await fetch(endpoint, {
      method: capabilityTypeToHttpMethod(resolved.type),
      headers: {
        Authorization: `Bearer ${decryptedCredential}`,
        "Content-Type": "application/json",
      },
      body: resolved.type !== "read" ? JSON.stringify(request.payload) : undefined,
      signal: AbortSignal.timeout(request.timeoutMs ?? 10000),
    });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const failureClass = err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network_error";
    return buildFailureResult(request, executionId!, failureClass, durationMs);
  } finally {
    // Immediately zero out in-memory credential reference
    // (TypeScript cannot guarantee GC, but we release the reference)
    // decryptedCredential = null; // handled by scope exit
  }

  // Step 7: Classify failure
  if (!httpResponse.ok) {
    const failureClass = HTTP_STATUS_TO_FAILURE_CLASS[httpResponse.status] ?? "unknown";
    const durationMs = Date.now() - startMs;
    return buildFailureResult(request, executionId, failureClass, durationMs);
  }

  // Step 8: Redact and size-bound response
  const rawText = await httpResponse.text();
  const redactedSummary = redactAndBound(rawText, 512);

  // Step 9: Mark ledger committed (side_effect only)
  if (STRICT_IDEMPOTENCY_REQUIRED_TYPES.includes(resolved.type) && request.idempotencyKey) {
    await effectCommitLedger.markCommitted(
      `${request.decisionId ?? "no-decision"}::${request.idempotencyKey}`,
      executionId,
    );
  }

  const durationMs = Date.now() - startMs;

  // Step 10: Emit telemetry (async, non-blocking)
  const telemetry: ExecutionTelemetry = {
    durationMs,
    timestamp: new Date().toISOString(),
    channel: "api_rest",
    attemptNumber: 1,
  };
  observabilityPort.emit("execution_telemetry", { executionId, ...telemetry });

  return {
    executionId,
    platformId: request.platformId,
    capabilityId: request.capabilityId,
    status: "success",
    sourceRef: `${CONNECTOR_AUDIT_REF_PREFIX}${executionId}`,
    redactedSummary,
    telemetry,
  };
}
```

> **注意事项**:
> - Step 6 中 `decryptedCredential` 变量在 try 块内，函数返回后由 GC 回收；不得赋值给外部变量或放入闭包
> - Step 9 只在 HTTP 成功后 markCommitted；失败不提交 ledger，允许后续重试
> - redaction 必须在 `rawText` 赋值后立即执行，不得 await 其他操作

---

### §3.4 runWetProbe

**对应契约**: L0 §5.1 — `runWetProbe(platformId, probeConfig)`
**准入理由**: 含多步骤副作用链（HTTP GET → actualCapabilities 比对 → 持久化）+ 不明显的 safe_for_probe 校验规则

```typescript
async function runWetProbe(
  platformId: string,
  probeConfig: { safeEndpoint: string; expectedStatus: number; timeoutMs?: number },
): Promise<CapabilityProbeResult> {
  const probedAt = new Date().toISOString();
  const manifest = registry.getManifest(platformId);

  if (!manifest) {
    return {
      platformId,
      probeEndpoint: probeConfig.safeEndpoint,
      probedAt,
      httpStatus: 0,
      latencyMs: 0,
      declaredCapabilities: [],
      actualCapabilities: [],
      endpointMismatch: true,
      mismatchReason: "platform_not_registered",
      redactedSample: null,
    };
  }

  // Only probe capabilities with safe_for_probe: true AND type: "read"
  const declaredCapabilities = manifest.capabilities
    .filter((c) => c.safe_for_probe && c.type === "read")
    .map((c) => c.capabilityId);

  const startMs = Date.now();
  let httpStatus = 0;
  let redactedSample: string | null = null;
  let endpointMismatch = false;
  let mismatchReason: string | undefined;

  try {
    // Probe does NOT use credential — only checks endpoint reachability
    const response = await fetch(probeConfig.safeEndpoint, {
      method: "GET",
      signal: AbortSignal.timeout(probeConfig.timeoutMs ?? WET_PROBE_DEFAULTS.timeoutMs),
    });

    httpStatus = response.status;
    const latencyMs = Date.now() - startMs;

    if (httpStatus !== probeConfig.expectedStatus) {
      endpointMismatch = true;
      mismatchReason = `Expected ${probeConfig.expectedStatus}, got ${httpStatus} at ${probeConfig.safeEndpoint}`;
    }

    // Collect redacted sample (size-bounded)
    const rawText = await response.text().catch(() => "");
    redactedSample = redactAndBound(rawText, WET_PROBE_DEFAULTS.maxRedactedSampleBytes);

    const actualCapabilities = endpointMismatch ? [] : [...declaredCapabilities];

    const result: CapabilityProbeResult = {
      platformId,
      probeEndpoint: probeConfig.safeEndpoint,
      probedAt,
      httpStatus,
      latencyMs,
      declaredCapabilities,
      actualCapabilities,
      endpointMismatch,
      mismatchReason,
      redactedSample,
    };

    // Persist to state-memory-system
    await stateMemoryPort.upsertCapabilityProbeResult(platformId, result);

    return result;
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    const result: CapabilityProbeResult = {
      platformId,
      probeEndpoint: probeConfig.safeEndpoint,
      probedAt,
      httpStatus: 0,
      latencyMs,
      declaredCapabilities,
      actualCapabilities: [],
      endpointMismatch: true,
      mismatchReason: err instanceof Error ? err.message : "unknown_probe_error",
      redactedSample: null,
    };

    await stateMemoryPort.upsertCapabilityProbeResult(platformId, result);
    return result;
  }
}
```

> **注意事项**: probe 不携带 Authorization header / credential / cookie / payload。probe 只验证 endpoint 可达性。如果 safeEndpoint 需要认证才能返回 200，那该 endpoint 不适合作为 probeConfig.safeEndpoint，应改用公开健康检查 endpoint。

---

### §3.5 connector_test --wet

**对应契约**: L0 §5.1 — `connector_test --wet (platformId)`
**准入理由**: 是 operator 操作入口，内部委托 runWetProbe；含结果格式化和 dry-run 防兜底逻辑

```typescript
async function connectorTestWet(platformId: string): Promise<ConnectorWetTestReport> {
  const manifest = registry.getManifest(platformId);

  if (!manifest) {
    return {
      platformId,
      success: false,
      unavailableReason: {
        reason: "not_registered",
        details: `Platform '${platformId}' not found in registry`,
        platformId,
      },
    };
  }

  const probeConfig = manifest.probeConfig;
  const probeResult = await runWetProbe(platformId, probeConfig);

  // Format: never return dry-run ok if probe shows mismatch
  return {
    platformId,
    success: !probeResult.endpointMismatch,
    probeEndpoint: probeResult.probeEndpoint,
    httpStatus: probeResult.httpStatus,       // real HTTP status, not assumed
    latencyMs: probeResult.latencyMs,
    actualCapabilities: probeResult.actualCapabilities,
    declaredCapabilities: probeResult.declaredCapabilities,
    endpointMismatch: probeResult.endpointMismatch,
    mismatchReason: probeResult.mismatchReason,
    redactedSample: probeResult.redactedSample,
    probedAt: probeResult.probedAt,
    // Explicitly NOT: success: true when httpStatus !== expectedStatus
  };
}

interface ConnectorWetTestReport {
  platformId: string;
  success: boolean;
  probeEndpoint?: string;
  httpStatus?: number;
  latencyMs?: number;
  actualCapabilities?: string[];
  declaredCapabilities?: string[];
  endpointMismatch?: boolean;
  mismatchReason?: string;
  redactedSample?: string | null;
  probedAt?: string;
  unavailableReason?: StructuredUnavailableReason;
}
```

---

### §3.6 resolveUnavailableReason

**对应契约**: L0 §5.1 — `resolveUnavailableReason(context)`
**准入理由**: 含不明显的 context → reason code 映射规则；六种 reason code 每种有不同 details 格式

```typescript
interface UnavailableContext {
  platformId: string;
  capabilityId?: string;
  failureSource:
    | "registry_miss"
    | "credential_inactive"
    | "credential_not_found"
    | "trust_blocked"
    | "trust_pending"
    | "circuit_open"
    | "http_error"
    | "probe_failed"
    | "timeout";
  httpStatus?: number;
  additionalDetails?: string;
}

function resolveUnavailableReason(ctx: UnavailableContext): StructuredUnavailableReason {
  const base = { platformId: ctx.platformId, capabilityId: ctx.capabilityId };

  switch (ctx.failureSource) {
    case "registry_miss":
      return {
        ...base,
        reason: "not_registered",
        details: `Platform '${ctx.platformId}' or capability '${ctx.capabilityId ?? "?"}' not found in registry`,
      };
    case "credential_inactive":
    case "credential_not_found":
      return {
        ...base,
        reason: "credentials_missing",
        details: `Credential for '${ctx.platformId}' is ${ctx.failureSource === "credential_not_found" ? "not found" : "inactive"}`,
      };
    case "trust_blocked":
      return {
        ...base,
        reason: "trust_denied",
        details: `Connector '${ctx.platformId}' trust status is 'blocked'`,
      };
    case "trust_pending":
      return {
        ...base,
        reason: "trust_denied",
        details: `Connector '${ctx.platformId}' has 'custom_adapter_pending_trust'; owner approval required`,
      };
    case "circuit_open":
      return {
        ...base,
        reason: "circuit_open",
        details: ctx.additionalDetails ?? `CircuitBreaker for '${ctx.platformId}' is OPEN; cooldown in progress`,
      };
    case "http_error":
      return {
        ...base,
        reason: "platform_error",
        details: `HTTP ${ctx.httpStatus ?? "?"} from '${ctx.platformId}'${ctx.additionalDetails ? `: ${ctx.additionalDetails}` : ""}`,
      };
    case "probe_failed":
      return {
        ...base,
        reason: "probe_failed",
        details: ctx.additionalDetails ?? `Wet probe for '${ctx.platformId}' failed; endpoint unreachable`,
      };
    case "timeout":
      return {
        ...base,
        reason: "platform_error",
        details: `Request to '${ctx.platformId}' timed out`,
      };
    default: {
      const _exhaustive: never = ctx.failureSource;
      return {
        ...base,
        reason: "platform_error",
        details: `Unknown failure source: ${String(_exhaustive)}`,
      };
    }
  }
}
```

---

### §3.7 unregisterConnector

**对应契约**: L0 §5.1 — `unregisterConnector(platformId)`
**准入理由**: 含不明显的"不中断正在执行的 capability"保证 + 审计记录生成

```typescript
async function unregisterConnector(platformId: string): Promise<{ success: boolean; auditRef: string }> {
  const snapshot = registry.getSnapshot();

  if (!snapshot.entries.has(platformId)) {
    return { success: false, auditRef: "" };
  }

  // Mark as unregistering — new execute requests after this point will see not_registered
  // In-flight executions already past resolveCapability() will complete normally
  registry.atomicRemove(platformId);

  const auditRef = `connector:unregister:${platformId}:${Date.now()}`;
  await observabilityPort.emit("connector_unregistered", { platformId, auditRef });

  return { success: true, auditRef };
}
```

> **注意事项**: `atomicRemove` 之后，正在等待 HTTP response 的 in-flight 执行不会被中断（它们已经通过了 registry 校验）。但 `EffectCommitLedger` 中的 committed record 会继续持久化到 TTL 过期，确保幂等保护不丢失。

---

## §4 决策树详细逻辑 (Decision Tree Details)

**L0 对应入口**: L0 §4 架构图注释 → *完整决策逻辑见 [L1 §4]*

### §4.1 executeCapability 门控决策树

**对应 L0 Mermaid**: `connector-system.md §4.3`

```
executeCapability(request, credentialCtx, trustDecision)
│
├─ resolveCapability → StructuredUnavailableReason{not_registered}?
│    └─ YES → return StructuredUnavailableReason
│
├─ credentialCtx.status != "active" OR encryptedValue null?
│    └─ YES → return StructuredUnavailableReason{credentials_missing}
│
├─ trustDecision.allowed == false?
│    └─ YES → return StructuredUnavailableReason{trust_denied}
│
├─ type in STRICT_IDEMPOTENCY_REQUIRED_TYPES AND idempotencyKey missing?
│    └─ YES → return StructuredUnavailableReason{platform_error, "idempotencyKey required"}
│
├─ effectCommitLedger.get(key).state == "committed"?
│    └─ YES → return ConnectorResult{status:success, "[already_committed:idempotent_skip]"}
│
├─ HTTP execute
│    ├─ timeout / network error → return ConnectorResult{status:timeout/failure}
│    └─ httpResponse.ok == false → return ConnectorResult{status:failure, failureClass}
│
└─ SUCCESS
     ├─ redact + size-bound response
     ├─ markCommitted in ledger (if side_effect)
     ├─ emit telemetry (async)
     └─ return ConnectorResult{status:success}
```

### §4.2 runWetProbe 结果分类

```
runWetProbe(platformId, probeConfig)
│
├─ registry.getManifest(platformId) == null?
│    └─ YES → return CapabilityProbeResult{endpointMismatch:true, mismatchReason:"platform_not_registered"}
│
├─ fetch(safeEndpoint, GET, no-credential) throws?
│    └─ YES → return CapabilityProbeResult{httpStatus:0, endpointMismatch:true, actualCapabilities:[]}
│
├─ httpStatus != probeConfig.expectedStatus?
│    └─ YES → endpointMismatch:true, actualCapabilities:[]
│    └─ NO  → endpointMismatch:false, actualCapabilities = declaredCapabilities (read+safe_for_probe)
│
└─ persist CapabilityProbeResult to state-memory-system
   return result
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

**L0 对应入口**: L0 §5 / §9

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| probe safeEndpoint 需要认证才能 200 | 永远 endpointMismatch，actualCapabilities:[] | manifest 设计时 safeEndpoint 应为公开健康 endpoint；文档说明此约束 |
| side_effect 执行成功但 markCommitted 失败 | 重复执行（幂等保护漏洞） | markCommitted 失败时记录 warn 日志 + observability event；允许上层重试（幂等 key 保护第二次） |
| registerConnector 与 resolveCapability 并发 | 读到旧 snapshot | atomicSwap 保证读取端始终看到一致 snapshot；concurrent register 不 lock resolve 路径 |
| credential decryptedValue 为空字符串 | 绕过 credential gate | credential gate 校验 `encryptedValue !== null && encryptedValue.trim() !== ""` |
| 同一 idempotencyKey + 不同 decisionId | 不同 ledger key，不互相影响 | ledger key = `decisionId::idempotencyKey`；无 decisionId 时用 `"no-decision"` 前缀（有碰撞风险，应告警） |
| wet probe redactedSample 包含 PII | PII 泄露至 probe result | redactAndBound 必须在存储前运行；sample 默认 512 bytes max；不得跳过 redaction |
| unregisterConnector 后 in-flight execution 提交 ledger | 孤儿 ledger record | TTL 到期自动清理；不影响正确性 |
| probeConfig.expectedStatus 与实际 API 不符 | 永远 endpointMismatch | manifest 作者责任；registry 注册时可选做 expectedStatus 合理性校验（200/204 以外发出 warn） |

### §5.1 Credential 生命周期安全

```typescript
// 错误做法 — 将 decryptedCredential 放入闭包或外部变量
let storedCred: string;
storedCred = credentialVault.decryptInMemory(encryptedValue);
setTimeout(() => { /* storedCred still in scope */ }, 1000);

// 正确做法 — 在 try 块内使用，用完即离开作用域
try {
  const decryptedCredential = credentialVault.decryptInMemory(encryptedValue);
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${decryptedCredential}` },
  });
  // decryptedCredential goes out of scope after try block
} catch (err) {
  // ...
}
```

### §5.2 EffectCommitLedger 并发 race condition

```typescript
// 问题：两个并发请求同一 idempotencyKey，getOrCreate 可能都返回 "pending"
// 然后都执行 HTTP，都 markCommitted

// 处理方式：数据库层使用 INSERT OR IGNORE（SQLite）保证唯一性
// getOrCreate 使用事务：
// BEGIN TRANSACTION;
// INSERT OR IGNORE INTO effect_commit_ledger (key, state, ...) VALUES (?, 'pending', ...);
// SELECT * FROM effect_commit_ledger WHERE key = ?;
// COMMIT;
// 返回的 row 无论是 INSERT 还是已存在的 IGNORE 结果，state 都可信
```

---

## §6 测试辅助 (Test Helpers)

**L0 对应入口**: L0 §11 测试策略锚点

```typescript
// ── Test Fixtures ──

export function makeTestManifestV7(
  platformId: string,
  overrides: Partial<ConnectorManifestV7> = {},
): ConnectorManifestV7 {
  return {
    schemaVersion: "sn.connector.v7",
    platformId,
    displayName: `Test Platform ${platformId}`,
    family: "custom",
    capabilities: [
      {
        capabilityId: "feed.read",
        type: "read",
        endpointTemplate: `https://api.${platformId}.test/feed`,
        trustRequired: "declarative_trusted",
        safe_for_probe: true,
        idempotencyClass: "none",
      },
    ],
    endpointMappings: {
      feedPath: "/feed",
      profilePath: "/users/{handle}/profile",
    },
    probeConfig: {
      safeEndpoint: `https://api.${platformId}.test/health`,
      expectedStatus: 200,
      timeoutMs: 1000,
    },
    runner: { kind: "declarative_http" },
    credentials: [{ type: "bearer_token", required: true }],
    sourceRefPolicy: { minSourceRefs: 1 },
    ...overrides,
  };
}

export function makeTestCredentialContext(
  platformId: string,
  status: CredentialContext["status"] = "active",
): CredentialContext {
  return {
    platformId,
    encryptedValue: status === "active" ? "enc:mock-token" : null,
    status,
    credentialType: "bearer_token",
  };
}

export function makeTestTrustDecision(allowed = true): TrustDecision {
  return {
    allowed,
    trustStatus: allowed ? "declarative_trusted" : "custom_adapter_pending_trust",
    denyReason: allowed ? undefined : "pending_trust_approval",
  };
}

export function makeTestExecutionRequest(
  platformId: string,
  capabilityId = "feed.read",
  overrides: Partial<ConnectorExecutionRequest> = {},
): ConnectorExecutionRequest {
  return {
    platformId,
    capabilityId,
    payload: {},
    ...overrides,
  };
}

// Mock fetch for wet probe tests
export function mockFetchForProbe(status: number, body = "") {
  return vi.fn().mockResolvedValue(
    new Response(body, { status }),
  );
}
```
