# Observability Health System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`observability-health-system.md`](./observability-health-system.md)
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。
> **孤岛检查**: 本文件各节均须在 L0 有对应超链接入口，禁止孤岛内容。

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v1.0 | 2026-05-21 | 初始版本，v7 genesis 设计 |

---

## 本文件章节索引

|   §   | 章节                                                                              |   对应 L0 入口   |
| :---: | --------------------------------------------------------------------------------- | :--------------: |
|  §1   | [配置常量](#1-配置常量-config-constants)                                          | L0 §6 数据模型   |
|  §2   | [完整数据结构](#2-核心数据结构完整定义-full-data-structures)                      | L0 §6 数据模型   |
|  §3   | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode)              | L0 §5 操作契约表 |
|  §4   | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details)                        | L0 §4 架构图     |
|  §5   | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas)                  | L0 §5 / §9       |
|  §6   | [测试辅助](#6-测试辅助-test-helpers)                                              | L0 §11 测试策略  |

---

## §1 配置常量 (Config Constants)

> **L0 对应入口**: L0 §6 末尾锚点 → *配置常量字典详见 [L1 §1]*

```typescript
// ── Redaction Policy 常量 ──
export const REDACTION_CONFIG_V7 = {
  // v6 原有 + v7 新增（credential_value, raw_payload）
  maskedFieldNames: [
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "apiSecret",
    "secret",
    "password",
    "bearer_token",
    "authorization",
    "node_secret",
    "encryption_key",        // v7 新增
    "key_material",          // v7 新增
  ],
  eraseFieldNames: [
    "full_message",
    "full_post",
    "private_message",
    "prompt",
    "system_prompt",
    "completion",
    "response_content",
    "raw_payload",           // v7 新增
    "credential_value",      // v7 新增
    "raw_prompt",            // v7 新增（别名）
  ],
  hashFieldNames: [
    "user_id",
    "session_id",
    "trace_id",
    "content_hash",
    "message_hash",          // v7 新增（delivery proof 引用）
  ],
  sensitivityLevels: ["public", "internal", "confidential", "restricted"] as const,
} as const;

// ── SelfHealth 探针超时配置（毫秒） ──
export const HEALTH_PROBE_TIMEOUTS = {
  env: 200,              // 环境变量读取
  cron: 300,             // cron 调度状态
  secretAnchor: 400,     // key 路径校验（可能涉及文件读取）
  storage: 500,          // SQLite 连接探测
  delivery: 300,         // 最近 delivery proof 查询
  circuitBreakers: 400,  // circuit breaker posture 读取
  auditChain: 500,       // chain integrity 快速验证（最近 100 条）
} as const;

// ── SelfHealth 探针状态 ──
export const HEALTH_STATUS = {
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  UNKNOWN: "unknown",
} as const;

// ── DiagnosticReasonCode 前缀 ──
export const DIAGNOSTIC_REASON_PREFIXES = {
  CRON: "cron",
  CONNECTOR: "connector",
  STORAGE: "storage",
  SECRET: "secret",
  DELIVERY: "delivery",
  AUDIT: "audit",
  DREAM: "dream",
  ENV: "env",
} as const;

// ── 标准 DiagnosticReasonCode 值 ──
export const DIAGNOSTIC_REASON_CODES = {
  // 环境漂移
  ENV_MISMATCH: "env:mismatch",               // manual run env ≠ cron env
  ENV_ROOT_DRIFT: "env:workspace_root_drift",  // workspaceRoot 变化
  BRIDGE_DRIFT: "env:bridge_drift",            // plugin bridge 路径变化
  CRON_GAP: "cron:gap",                        // cron 超过预期间隔未触发

  // Secret & Credential
  SECRET_ANCHOR_MISSING: "secret:anchor_missing",          // 无 key anchor 记录
  SECRET_UNAVAILABLE: "secret:unavailable",                // key 路径存在但无法读取
  CREDENTIAL_RECOVERY_REQUIRED: "secret:credential_recovery_required",
  WRONG_KEY: "secret:wrong_key",                           // key 存在但解密失败

  // Connector
  CIRCUIT_OPEN: "connector:circuit_open",     // 前缀，格式：connector:circuit_open:{platformId}
  PROBE_TIMEOUT: "probe:timeout",             // 前缀，格式：probe:timeout:{dimension}

  // Storage
  STORAGE_DEGRADED: "storage:degraded",       // DB 连接失败
  AUDIT_CHAIN_BROKEN: "audit:chain_broken",   // hash chain 完整性问题

  // Dream / Quiet
  DREAM_STALE: "dream:stale",                 // Dream 上次运行超时（>48h）
  QUIET_STALE: "quiet:stale",                 // Quiet 上次运行超时（>24h）

  // Delivery
  DELIVERY_PROOF_MISSING: "delivery:proof_missing",  // 无 proof 但标为 sent
  NO_USER_VISIBLE_CONTACT: "no_user_visible_contact_claim_prohibited",
} as const;

// ── HeartbeatDigest 聚合配置 ──
export const DIGEST_CONFIG = {
  maxConnectorSummaries: 20,       // 最多汇总 20 个 connector
  nothingSignificantThreshold: 0,  // 0 个有效事件 → nothing_significant
  digestWindowHours: 24,           // 聚合最近 24 小时
  maxAuditEventsToScan: 2000,      // 单次 digest 最多扫描 2000 条 audit events
} as const;

// ── ExplainBundle 配置 ──
export const EXPLAIN_CONFIG = {
  maxMatchedEvents: 50,            // 单次 explain 最多返回 50 条 matched events
  maxScanDepth: 1000,              // 扫描 audit store 最多 1000 条后早停
} as const;

// ── NarrativeTimeline 配置 ──
export const NARRATIVE_TIMELINE_CONFIG = {
  maxVersionsReturned: 30,         // timeline 最多返回 30 个版本条目
  defaultRetentionDays: 30,        // 默认保留 30 天的 timeline 记录
} as const;

// ── AuditEventFamily v7 完整枚举 ──
export const AUDIT_EVENT_FAMILIES_V7 = [
  // v6 原有
  "heartbeat.decision",
  "delivery",
  "source_coverage",
  "guidance.grounding",
  "host_capability",
  "connector.attempt",
  "state.governance",
  "narrative.trace",
  "dream.trace",
  // v7 新增
  "restore.audit",
  "health.probe",
  "narrative.snapshot",
  "secret.anchor",
] as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

> 含方法体的完整类定义和接口细化。
> **L0 对应入口**: L0 §6.1 末尾锚点 → *完整方法实现详见 [L1 §2]*

```typescript
// ── HealthDimension 维度基础类型 ──
interface HealthDimension {
  status: "healthy" | "degraded" | "unknown";
  checkedAt: string;
  diagnosticReasonCodes: string[];
  detail?: string;                  // human-readable 诊断说明（不含敏感信息）
}

// ── 各维度具体类型 ──
interface CircuitBreakerHealthDimension extends HealthDimension {
  openBreakers: Array<{
    platformId: string;
    capability: string;
    openSince: string;
    cooldownUntil?: string;
  }>;
  totalChecked: number;
}

interface DeliveryHealthDimension extends HealthDimension {
  recentDeliverySuccessRate: number;   // 0-1，最近 24h 成功率
  proofMissingCount: number;           // 最近 24h 无 proof 但标 sent 的数量
}

interface QuietDreamHealthDimension extends HealthDimension {
  lastQuietRunAt?: string;
  lastDreamRunAt?: string;
  quietStaleSince?: string;            // 若 > 24h 未运行则设置
  dreamStaleSince?: string;            // 若 > 48h 未运行则设置
}

interface SecretAnchorHealthDimension extends HealthDimension {
  anchors: Array<{
    anchorId: string;
    keyPath: string;                   // 只记录路径，不记录值
    status: "verified" | "missing" | "wrong_key" | "decryption_failed";
    lastVerifiedAt?: string;
  }>;
}

interface StorageHealthDimension extends HealthDimension {
  dbConnectionStatus: "connected" | "disconnected" | "degraded";
  auditTableRowCount?: number;
}

interface CronEnvDriftDimension extends HealthDimension {
  driftType?: "workspace_root" | "env_vars" | "bridge_path" | "none";
  manualRunEnvSnapshot?: Record<string, string>;   // redacted，只含非敏感 key
  cronRunEnvSnapshot?: Record<string, string>;
}

interface AuditChainHealthDimension extends HealthDimension {
  lastVerifiedAt?: string;
  verifiedCount?: number;
  brokenAt?: number;                   // audit event sequence 号，null = 未发现问题
}

// ── SelfHealthSnapshot 完整类型 ──
interface SelfHealthSnapshot {
  generatedAt: string;
  overall: "healthy" | "degraded" | "unknown";
  dimensions: {
    connectorCircuitBreakers: CircuitBreakerHealthDimension;
    deliveryTruth: DeliveryHealthDimension;
    quietDreamCadence: QuietDreamHealthDimension;
    secretAnchor: SecretAnchorHealthDimension;
    storageLayer: StorageHealthDimension;
    cronEnvDrift: CronEnvDriftDimension;
    auditChainIntegrity: AuditChainHealthDimension;
  };
  diagnosticReasonCodes: string[];   // 聚合所有维度的 reason codes
}

// ── HeartbeatDigest 完整类型 ──
interface GoalDaySummary {
  accepted: number;
  completed: number;
  expired: number;
  replaced: number;
  activeCount: number;
}

interface QuietDreamDaySummary {
  quietRanCount: number;
  dreamRanCount: number;
  acceptedProjections: number;
  candidateProjections: number;      // 未被接受的，不进入 heartbeat context
  skipReasons: string[];
}

interface HealthDaySummary {
  degradedDimensions: string[];      // 当日发生 degraded 的维度名
  newCircuitOpenCount: number;
  resolvedCircuitOpenCount: number;
  secretAnchorStatusChanged: boolean;
}

interface DeliveryProofRef {
  messageId?: string;
  hostProofRef?: string;
  channel: string;
  deliveredAt: string;
  // 原始消息内容不存储在此
}

interface HeartbeatDigest {
  date: string;
  generatedAt: string;
  isNothingSignificant: boolean;
  connectorSummary: ConnectorDaySummary[];
  goalSummary: GoalDaySummary;
  quietDreamSummary: QuietDreamDaySummary;
  healthSummary: HealthDaySummary;
  deliveredAt?: string;
  deliveryProof?: DeliveryProofRef;
  deliveryFallbackReason?: string;   // 投递失败时的说明
}

// ── RestoreAuditEvent 完整类型 ──
interface RestoreAuditEvent {
  id: string;
  restoreTarget: "goal" | "narrative" | "evidence" | "relationship";
  fromVersion: string;
  toVersion: string;
  triggeredBy: "operator" | "agent";
  reason: string;
  excludedFields: string[];          // 明确列出不恢复的敏感字段
  restoredFieldCount: number;        // 实际恢复的字段数
  createdAt: string;
  traceId: string;                   // 关联 audit 的 traceId
}

// ── NarrativeTimeline 完整类型 ──
interface NarrativeFieldChange {
  field: "focus" | "progress" | "nextIntent" | "toneSignal" | "acceptedGoalId" | "sourceRefs";
  from: string | null;
  to: string | null;
}

interface NarrativeDiff {
  fromVersion: string;
  toVersion: string;
  computedAt: string;
  changes: NarrativeFieldChange[];
  sourceRefChanges: {
    added: string[];
    removed: string[];
  };
  reasonCode?: string;
  isNoChange: boolean;               // 无字段变化时为 true
}

interface NarrativeTimelineEntry {
  version: string;
  timestamp: string;
  triggerKind:
    | "heartbeat.decision"
    | "goal.transition"
    | "restore.applied"
    | "dream.projection"
    | "owner.override";
  sourceRefs: string[];
  reasonCode?: string;
  summaryText?: string;              // 人类可读的变化摘要（不含私信原文）
}

interface NarrativeTimeline {
  from: string;
  to: string;
  entries: NarrativeTimelineEntry[];
  totalVersions: number;
  truncated: boolean;                // 若超过 maxVersionsReturned 则为 true
}

// ── RuntimeSecretAnchorView 完整类型 ──
interface RuntimeSecretAnchorView {
  anchorId: string;
  keyPath: string;                   // 环境变量名或文件路径（不含值）
  status: "verified" | "missing" | "wrong_key" | "decryption_failed";
  lastCheckedAt: string;
  recoveryDocRef: string;            // 如 "AGENTS.md#bootstrap-recovery"
  rotationSchedule?: string;         // 如 "every 90 days" 或 "on workspace migration"
  checkedCredentialIds?: string[];   // 尝试解密验证的 credential IDs（不含值）
  // 明文 key 值：永远不出现在此结构中
}

// ── ExplainBundle 错误语义 ──
type AuditIngestionError =
  | "audit_previous_hash_mismatch"    // hash chain 断裂
  | "audit_genesis_previous_hash"     // 首条不应有 previousHash
  | "audit_payload_redaction_failed"; // redaction 异常（极少发生）

type HealthProbeError =
  | `probe_timeout:${string}`        // 格式：probe_timeout:{dimension}
  | "runtime_secret_unavailable"
  | "credential_recovery_required"
  | "runtime_secret_anchor_missing";
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

> **L0 对应入口**: L0 §5 操作契约表各行的「实现细节」链接

### §3.1 ingestTraceEvent

**对应契约**: L0 §5.1 — `ingestTraceEvent(envelope)`
**准入理由**: 含多步骤副作用链（验证 → 写入 → hash chain 更新），顺序不可颠倒

```typescript
async function ingestTraceEvent(
  envelope: AuditEnvelope<unknown>,
  store: AppendOnlyAuditStore,
  db: ObservabilityDatabase
): Promise<void> {
  // Step 1: 验证 hash chain 链接
  const lastHash = store.lastRecordHash();
  if (lastHash !== undefined && envelope.integrity.previousHash !== lastHash) {
    throw new Error("audit_previous_hash_mismatch");
  }
  if (lastHash === undefined && envelope.integrity.previousHash !== undefined) {
    throw new Error("audit_genesis_previous_hash");
  }

  // Step 2: 追加到 in-memory store（快速路径，不阻塞）
  store.append(envelope);

  // Step 3: 持久化到 SQLite（异步，失败不影响 in-memory）
  try {
    await db.db.insert(auditLog).values({
      eventId: envelope.eventId,
      family: envelope.family,
      plane: envelope.plane,
      traceId: envelope.traceId,
      sequence: envelope.sequence,
      createdAt: envelope.createdAt,
      payloadJson: JSON.stringify(envelope.payload),
      redactionJson: JSON.stringify(envelope.redaction),
      previousHash: envelope.integrity.previousHash ?? null,
      recordHash: envelope.integrity.recordHash,
      schemaVersion: envelope.integrity.schemaVersion,
    });
  } catch (err) {
    // SQLite 写入失败：标记 storage degraded，但不影响链完整性
    // in-memory store 已有记录，不抛出（fire-and-forget safe）
    emitStorageError("audit_db_write_failed", err);
  }
}
```

> **注意事项**: Step 3 是 fire-and-forget safe — SQLite 失败只影响持久化，不破坏 in-memory hash chain；下次 `probeHealth()` 会检测 `storage: degraded`

---

### §3.2 redactPayload

**对应契约**: L0 §5.1 — `redactPayload(payload)`
**准入理由**: 含不明显的业务规则（mask vs erase vs hash 三种 action；嵌套对象递归处理）

```typescript
function redactPayload<T extends object>(
  payload: T,
  policy: RedactionPolicy = DEFAULT_REDACTION_POLICY_V7
): RedactResult<T> {
  const maskedPaths: string[] = [];
  const erasedPaths: string[] = [];
  const hashedPaths: string[] = [];

  function processValue(obj: Record<string, unknown>, path: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      const rule = getFieldRedactionRule(key, policy);

      if (rule.action === "mask") {
        result[key] = "***";
        maskedPaths.push(`/payload/${fullPath.replace(/\./g, "/")}`);
      } else if (rule.action === "erase") {
        result[key] = null;  // erase: 置 null，不删除字段（保留结构）
        erasedPaths.push(`/payload/${fullPath.replace(/\./g, "/")}`);
      } else if (rule.action === "hash") {
        result[key] = crypto.createHash("sha256").update(String(value ?? "")).digest("hex");
        hashedPaths.push(`/payload/${fullPath.replace(/\./g, "/")}`);
      } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        // 递归处理嵌套对象
        result[key] = processValue(value as Record<string, unknown>, fullPath);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  const redactedPayload = processValue(payload as Record<string, unknown>, "") as T;

  return {
    payload: redactedPayload,
    manifest: {
      maskedPaths,
      erasedPaths,
      hashedPaths,
      sensitivity: inferSensitivity(maskedPaths, erasedPaths),
    },
  };
}

function inferSensitivity(masked: string[], erased: string[]): AuditEnvelopeSensitivity {
  if (erased.length > 0) return "sensitive";   // erase 表示最敏感
  if (masked.length > 0) return "private";     // mask 表示私密
  return "internal";
}
```

> **注意事项**: `erase` action 将字段值置为 `null` 而非删除字段，保留 payload 结构，便于 schema 验证。数组不递归处理（避免复杂度）。

---

### §3.3 probeHealth

**对应契约**: L0 §5.1 — `probeHealth(scope)`
**准入理由**: 含并行多步骤副作用链（7个并行探针）+ 聚合逻辑 + 超时处理

```typescript
async function probeHealth(
  scope: HealthProbeScope | undefined,
  deps: HealthProbeDeps
): Promise<SelfHealthSnapshot> {
  const generatedAt = new Date().toISOString();

  // Step 1: 并行运行所有探针（Promise.allSettled，任意失败不影响整体）
  const [
    cbResult,
    deliveryResult,
    qdResult,
    secretResult,
    storageResult,
    cronResult,
    chainResult,
  ] = await Promise.allSettled([
    withTimeout(probeCircuitBreakers(deps.bodyToolPort), HEALTH_PROBE_TIMEOUTS.circuitBreakers),
    withTimeout(probeDeliveryTruth(deps.auditStore), HEALTH_PROBE_TIMEOUTS.delivery),
    withTimeout(probeQuietDreamCadence(deps.stateMemoryPort), HEALTH_PROBE_TIMEOUTS.cron),
    withTimeout(probeSecretAnchor(deps.runtimeOpsPort), HEALTH_PROBE_TIMEOUTS.secretAnchor),
    withTimeout(probeStorageLayer(deps.db), HEALTH_PROBE_TIMEOUTS.storage),
    withTimeout(probeCronEnvDrift(deps.runtimeOpsPort), HEALTH_PROBE_TIMEOUTS.env),
    withTimeout(probeAuditChainIntegrity(deps.auditStore), HEALTH_PROBE_TIMEOUTS.auditChain),
  ]);

  // Step 2: 将 settled results 转为维度（rejected = unknown）
  const dimensions = {
    connectorCircuitBreakers: settledToDimension(cbResult, "connectorCircuitBreakers"),
    deliveryTruth: settledToDimension(deliveryResult, "deliveryTruth"),
    quietDreamCadence: settledToDimension(qdResult, "quietDreamCadence"),
    secretAnchor: settledToDimension(secretResult, "secretAnchor"),
    storageLayer: settledToDimension(storageResult, "storageLayer"),
    cronEnvDrift: settledToDimension(cronResult, "cronEnvDrift"),
    auditChainIntegrity: settledToDimension(chainResult, "auditChainIntegrity"),
  };

  // Step 3: 聚合 overall status 和 reason codes
  const allCodes = Object.values(dimensions).flatMap(d => d.diagnosticReasonCodes);
  const overall = inferOverallStatus(dimensions);

  return { generatedAt, overall, dimensions, diagnosticReasonCodes: [...new Set(allCodes)] };
}

function settledToDimension<T extends HealthDimension>(
  result: PromiseSettledResult<T>,
  dimensionName: string
): T {
  if (result.status === "fulfilled") return result.value;
  return {
    status: "unknown",
    checkedAt: new Date().toISOString(),
    diagnosticReasonCodes: [`probe_timeout:${dimensionName}`],
    detail: `probe timed out or failed: ${result.reason}`,
  } as unknown as T;
}

function inferOverallStatus(dimensions: SelfHealthSnapshot["dimensions"]): "healthy" | "degraded" | "unknown" {
  const statuses = Object.values(dimensions).map(d => d.status);
  if (statuses.some(s => s === "degraded")) return "degraded";
  if (statuses.every(s => s === "healthy")) return "healthy";
  return "unknown";  // 含 unknown 但无 degraded → 整体 unknown
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}
```

---

### §3.4 generateHeartbeatDigest

**对应契约**: L0 §5.1 — `generateHeartbeatDigest(date)`
**准入理由**: 含多步骤聚合链（按 family 查询 → 分 section 统计 → 判断 nothing_significant）

```typescript
async function generateHeartbeatDigest(
  date: string,    // YYYY-MM-DD
  deps: DigestDeps
): Promise<HeartbeatDigest> {
  const generatedAt = new Date().toISOString();

  // Step 1: 从 audit store 按日期和 family 批量查询
  const auditSlice = await deps.auditStore.queryByDateAndFamilies(
    date,
    ["connector.attempt", "heartbeat.decision", "dream.trace", "delivery", "health.probe", "restore.audit"],
    { limit: DIGEST_CONFIG.maxAuditEventsToScan }
  );

  // Step 2: 从 state-memory 查询 goal transitions 和 quiet/dream runs
  const [goalTransitions, qdActivity] = await Promise.all([
    deps.stateMemoryPort.queryGoalTransitions(date),
    deps.stateMemoryPort.queryQuietDreamActivity(date),
  ]);

  // Step 3: 聚合 connector summary（按 platformId + capability 分组）
  const connectorSummary = aggregateConnectorSummary(
    auditSlice.filter(e => e.family === "connector.attempt")
  );

  // Step 4: 聚合 goal summary
  const goalSummary = aggregateGoalSummary(goalTransitions);

  // Step 5: 聚合 quiet/dream summary
  const quietDreamSummary = aggregateQuietDreamSummary(qdActivity);

  // Step 6: 聚合 health changes
  const healthChanges = aggregateHealthChanges(
    auditSlice.filter(e => e.family === "health.probe")
  );

  // Step 7: 判断 nothing_significant
  const isNothingSignificant =
    connectorSummary.length === 0 &&
    goalSummary.accepted === 0 &&
    goalSummary.completed === 0 &&
    quietDreamSummary.quietRanCount === 0 &&
    healthChanges.degradedDimensions.length === 0;

  return {
    date,
    generatedAt,
    isNothingSignificant,
    connectorSummary,
    goalSummary,
    quietDreamSummary,
    healthSummary: healthChanges,
  };
}

function aggregateConnectorSummary(
  attempts: AuditEnvelope<unknown>[]
): ConnectorDaySummary[] {
  const groups = new Map<string, ConnectorDaySummary>();

  for (const attempt of attempts) {
    const p = attempt.payload as Record<string, unknown>;
    const platformId = String(p.platformId ?? "unknown");
    const capability = String(p.capability ?? "unknown");
    const key = `${platformId}:${capability}`;
    const status = String(p.status ?? "unknown");

    if (!groups.has(key)) {
      groups.set(key, { platformId, capability, successCount: 0, failureCount: 0, circuitOpenCount: 0, blockedCount: 0 });
    }
    const summary = groups.get(key)!;

    if (status === "succeeded") summary.successCount++;
    else if (status === "failed") summary.failureCount++;
    else if (status === "circuit_open") summary.circuitOpenCount++;
    else if (status === "blocked") summary.blockedCount++;
  }

  return Array.from(groups.values()).slice(0, DIGEST_CONFIG.maxConnectorSummaries);
}
```

---

### §3.5 queryNarrativeDiff

**对应契约**: L0 §5.1 — `queryNarrativeDiff(fromVer, toVer)`
**准入理由**: 含不明显业务规则（哪些字段参与 diff，sourceRefs 差异计算）

```typescript
async function queryNarrativeDiff(
  fromVersion: string,
  toVersion: string,
  deps: NarrativeTimelineDeps
): Promise<NarrativeDiff> {
  const computedAt = new Date().toISOString();

  // Step 1: 读取两个版本快照
  const [fromSnap, toSnap] = await Promise.all([
    deps.stateMemoryPort.queryNarrativeSnapshot(fromVersion),
    deps.stateMemoryPort.queryNarrativeSnapshot(toVersion),
  ]);

  if (!fromSnap || !toSnap) {
    throw new Error(`narrative_version_not_found: ${!fromSnap ? fromVersion : toVersion}`);
  }

  // Step 2: 比较结构化字段（不含 raw private content）
  const DIFF_FIELDS = ["focus", "progress", "nextIntent", "toneSignal", "acceptedGoalId"] as const;
  const changes: NarrativeFieldChange[] = [];

  for (const field of DIFF_FIELDS) {
    const fromVal = String(fromSnap[field] ?? null);
    const toVal = String(toSnap[field] ?? null);
    if (fromVal !== toVal) {
      changes.push({ field, from: fromSnap[field] ?? null, to: toSnap[field] ?? null });
    }
  }

  // Step 3: 计算 sourceRefs 差异（集合运算）
  const fromRefs = new Set(fromSnap.sourceRefs ?? []);
  const toRefs = new Set(toSnap.sourceRefs ?? []);
  const addedRefs = [...toRefs].filter(r => !fromRefs.has(r));
  const removedRefs = [...fromRefs].filter(r => !toRefs.has(r));

  return {
    fromVersion,
    toVersion,
    computedAt,
    changes,
    sourceRefChanges: { added: addedRefs, removed: removedRefs },
    reasonCode: toSnap.lastChangeReasonCode,
    isNoChange: changes.length === 0 && addedRefs.length === 0 && removedRefs.length === 0,
  };
}
```

---

### §3.6 queryNarrativeTimeline

**对应契约**: L0 §5.1 — `queryNarrativeTimeline(from, to)`
**准入理由**: 含多步聚合 + 截断逻辑

```typescript
async function queryNarrativeTimeline(
  from: string,    // ISO 8601
  to: string,
  deps: NarrativeTimelineDeps
): Promise<NarrativeTimeline> {
  const entries = await deps.stateMemoryPort.queryNarrativeTimelineEntries(from, to, {
    limit: NARRATIVE_TIMELINE_CONFIG.maxVersionsReturned + 1,  // +1 检测截断
  });

  const truncated = entries.length > NARRATIVE_TIMELINE_CONFIG.maxVersionsReturned;
  const trimmed = truncated ? entries.slice(0, NARRATIVE_TIMELINE_CONFIG.maxVersionsReturned) : entries;

  return {
    from,
    to,
    entries: trimmed.map(mapToTimelineEntry),
    totalVersions: trimmed.length,
    truncated,
  };
}

function mapToTimelineEntry(row: NarrativeTimelineRow): NarrativeTimelineEntry {
  return {
    version: row.version,
    timestamp: row.createdAt,
    triggerKind: row.triggerKind as NarrativeTimelineEntry["triggerKind"],
    sourceRefs: row.sourceRefs ?? [],
    reasonCode: row.reasonCode ?? undefined,
    // summaryText 从 row.summaryText 取，已 redact，不含原始内容
    summaryText: row.summaryText ?? undefined,
  };
}
```

---

### §3.7 writeRestoreAudit

**对应契约**: L0 §5.1 — `writeRestoreAudit(event)`
**准入理由**: 含不明显业务规则（restore 操作必须同步写 audit，且 audit payload 明确记录 excludedFields）

```typescript
async function writeRestoreAudit(
  event: RestoreAuditEvent,
  store: AppendOnlyAuditStore,
  db: ObservabilityDatabase
): Promise<void> {
  // Step 1: 构建 audit payload（不含 credential 或 key）
  const safePayload = {
    restoreTarget: event.restoreTarget,
    fromVersion: event.fromVersion,
    toVersion: event.toVersion,
    triggeredBy: event.triggeredBy,
    reason: event.reason,
    excludedFields: event.excludedFields,
    restoredFieldCount: event.restoredFieldCount,
    createdAt: event.createdAt,
    // 明确不包含：actual field values（只记录元数据）
  };

  const previousHash = store.lastRecordHash();
  const envelope = buildAuditEnvelope({
    family: "restore.audit",
    plane: "governance",
    traceId: event.traceId,
    sequence: store.list().length,
    payload: safePayload,
    previousHash,
  });

  // Step 2: 追加到 store（同步，确保 restore 操作有 audit 记录再返回）
  await ingestTraceEvent(envelope, store, db);
}
```

> **注意事项**: `writeRestoreAudit` 必须在 restore 操作**执行期间**同步调用，不是事后补写。如果 restore 失败，audit 仍需写入（记录尝试事实）。

---

### §3.8 queryExplainBundle

**对应契约**: L0 §5.1 — `queryExplainBundle(query)`
**准入理由**: 含不明显业务规则（delivery not_sent 触发特定 warning，早停逻辑）

```typescript
function queryExplainBundle(
  query: ExplainQuery,
  store: AppendOnlyAuditStore
): OperatorExplainReadModel {
  const events = store.list();
  const matched: AuditEnvelope<unknown>[] = [];
  const warnings: string[] = [];
  let deliveryStatus: string | undefined;

  // 早停扫描（不超过 maxScanDepth）
  let scanned = 0;
  for (const e of events) {
    if (scanned >= EXPLAIN_CONFIG.maxScanDepth) break;
    if (matched.length >= EXPLAIN_CONFIG.maxMatchedEvents) break;
    scanned++;

    if (eventMatchesQuery(e, query)) {
      matched.push(e);

      // 检测 delivery 相关 warning
      if (e.family === "delivery") {
        const status = (e.payload as Record<string, unknown>)?.status as string;
        if (status) deliveryStatus = status;
        if (isNoUserVisibleDelivery(status)) {
          warnings.push(DIAGNOSTIC_REASON_CODES.NO_USER_VISIBLE_CONTACT);
        }
      }
    }
  }

  const summary =
    matched.length === 0
      ? "no_matching_audit_events"
      : `matched_events=${matched.length};subject=${query.kind};scanned=${scanned}`;

  return {
    query,
    summary,
    warnings: [...new Set(warnings)],
    deliveryStatus: deliveryStatus as any,
    relatedEventIds: matched.map(e => e.eventId),
    events: matched.map(summarizeForExplain),
  };
}

function summarizeForExplain(e: AuditEnvelope<unknown>): RedactedExplainEvent {
  const p = e.payload as Record<string, unknown>;
  let summary: string;

  switch (e.family) {
    case "delivery":
      summary = `delivery:${p.status ?? "unknown"}`;
      break;
    case "heartbeat.decision":
      summary = `decision:${p.outcome ?? "unknown"}`;
      break;
    case "connector.attempt":
      summary = `connector:${p.platformId ?? "?"}:${p.capability ?? "?"}:${p.status ?? "?"}`;
      break;
    case "restore.audit":
      summary = `restore:${p.restoreTarget ?? "?"}:${p.fromVersion ?? "?"}→${p.toVersion ?? "?"}`;
      break;
    default:
      summary = e.family;
  }

  return {
    eventId: e.eventId,
    family: e.family,
    plane: e.plane,
    createdAt: e.createdAt,
    summary,
    // payload 不直接暴露（已 redact，但 summary 更简洁）
  };
}
```

---

### §3.9 verifyAuditChain

**对应契约**: L0 §5.1 — `verifyAuditChain(range?)`

```typescript
function verifyAuditChain(
  store: AppendOnlyAuditStore,
  range?: { startSequence?: number; endSequence?: number }
): AuditHashChainVerificationReport {
  const events = store.list();
  const subset = range
    ? events.slice(range.startSequence ?? 0, range.endSequence)
    : events;

  let brokenAt: number | undefined;
  let verifiedCount = 0;

  for (let i = 0; i < subset.length; i++) {
    const e = subset[i];
    const recomputed = computeAuditRecordHash(e);

    if (recomputed !== e.integrity.recordHash) {
      brokenAt = e.sequence;
      break;
    }

    if (i > 0) {
      const prev = subset[i - 1];
      if (e.integrity.previousHash !== prev.integrity.recordHash) {
        brokenAt = e.sequence;
        break;
      }
    }

    verifiedCount++;
  }

  return {
    valid: brokenAt === undefined,
    verifiedCount,
    totalCount: subset.length,
    brokenAt,
    verifiedAt: new Date().toISOString(),
  };
}
```

---

### §3.10 viewSecretAnchor

**对应契约**: L0 §5.1 — `viewSecretAnchor()`
**准入理由**: 含不明显业务规则（只暴露路径和状态，永远不暴露 key 值）

```typescript
async function viewSecretAnchor(
  deps: SecretAnchorDeps
): Promise<RuntimeSecretAnchorView> {
  const keyPath = deps.runtimeOpsPort.getEncryptionKeyPath();
  // 注意：getEncryptionKeyPath() 只返回路径（如 "SECOND_NATURE_ENCRYPTION_KEY"），不返回值

  let status: RuntimeSecretAnchorView["status"];
  let checkedCredentialIds: string[] = [];

  try {
    // Step 1: 检查路径是否存在
    const keyExists = await deps.runtimeOpsPort.checkKeyPathExists(keyPath);
    if (!keyExists) {
      return {
        anchorId: "primary",
        keyPath,
        status: "missing",
        lastCheckedAt: new Date().toISOString(),
        recoveryDocRef: "AGENTS.md#bootstrap-recovery",
      };
    }

    // Step 2: 尝试解密一个已知 credential（验证 key 正确性）
    // 使用的是解密操作，不是读取 key 值本身
    const sampleResult = await deps.credentialPort.verifySampleDecrypt();
    checkedCredentialIds = sampleResult.checkedIds;

    if (sampleResult.status === "ok") {
      status = "verified";
    } else if (sampleResult.status === "wrong_key") {
      status = "wrong_key";
    } else {
      status = "decryption_failed";
    }
  } catch (err) {
    status = "missing";
  }

  return {
    anchorId: "primary",
    keyPath,
    status,
    lastCheckedAt: new Date().toISOString(),
    recoveryDocRef: "AGENTS.md#bootstrap-recovery",
    rotationSchedule: "on workspace migration or manual rotation request",
    checkedCredentialIds,
    // key 明文：永远不出现
  };
}
```

> **注意事项**: `viewSecretAnchor()` 的返回值通过单元测试验证不含 key/secret/token/password 字段（字段枚举检查）。

---

## §4 决策树详细逻辑 (Decision Tree Details)

> **L0 对应入口**: L0 §4 架构图注释 → *完整决策逻辑见 [L1 §4]*

### §4.1 SelfHealthSnapshot Overall 状态推导

**对应 L0 Mermaid**: 流程 B（SelfHealth 诊断）

```
inferOverallStatus(dimensions):
  IF any dimension.status == "degraded" → overall = "degraded"
  ELSE IF all dimension.status == "healthy" → overall = "healthy"
  ELSE → overall = "unknown"
  (含 unknown 但无 degraded → 整体 unknown，不草率判为健康)
```

**设计理由**: 用 `degraded > unknown > healthy` 的悲观推导，避免在 probe 失败时虚报 healthy。

### §4.2 Redaction action 优先级

```
对字段 F，apply policy:
  1. 检查 defaultPolicy（精确字段名匹配）
  2. 若无匹配，检查 fieldOverrides（前缀匹配）
  3. 若均无匹配 → action = "keep"

action 处理：
  "mask"  → value = "***"
  "erase" → value = null
  "hash"  → value = SHA-256(String(original))
  "keep"  → value 不变
```

### §4.3 HeartbeatDigest nothing_significant 判断

```
isNothingSignificant = true iff:
  connectorSummary.length == 0
  AND goalSummary.accepted == 0
  AND goalSummary.completed == 0
  AND quietDreamSummary.quietRanCount == 0
  AND healthSummary.degradedDimensions.length == 0
```

**设计理由**: 无 significant 事件时发 stub 摘要（`isNothingSignificant: true`），不编造活跃度；但仍发送（不是完全不发），让 owner 知道系统仍在运行。

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

> **L0 对应入口**: L0 §5 / §9 安全性章节

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| 首条 audit 事件带 previousHash | 链式错误 | `append()` 检测 `previousHash !== undefined` → 抛 `audit_genesis_previous_hash` |
| SQLite 写入失败但 in-memory 成功 | 数据丢失风险 | 标记 `storage: degraded`，下次 health probe 检测；不抛异常（fire-and-forget safe） |
| `viewSecretAnchor()` 被注入 key 值 | 严重安全问题 | `getEncryptionKeyPath()` 接口契约只返回路径字符串；单测枚举验证返回对象无 key 字段 |
| SelfHealth 探针超时 | 过度标 unknown | 每个探针有独立 timeout（200-500ms）；超时标 `unknown` 而非 `degraded`，避免误报 |
| redact 后字段值为 `null` vs `undefined` | 序列化差异 | erase action 使用 `null`（JSON 可序列化）；`undefined` 会被 JSON.stringify 跳过，导致 schema 验证失败 |
| NarrativeDiff fromVersion = toVersion | 空 diff | `isNoChange: true`，返回空 changes 数组，不抛错 |
| HeartbeatDigest 当日无 audit 事件 | 空摘要 | `isNothingSignificant: true`，发送 stub 摘要 |
| RestoreAudit 写入时 restore 失败 | audit 应仍写入 | `writeRestoreAudit()` 在 restore 执行路径上调用，即使后续 restore 失败也应写入"attempted"的 audit |
| `probeHealth()` 在 heartbeat critical path 被同步等待 | heartbeat 延迟 | `probeHealth()` 设计为 optional context，heartbeat 不 await；runtime-ops 异步触发 |

### §5.1 erase vs null 序列化

```typescript
// 错误做法
result[key] = undefined;  // JSON.stringify 会跳过此字段
// { "full_message": undefined } → JSON → {}   ← schema 验证可能 pass（字段消失）

// 正确做法
result[key] = null;       // JSON.stringify 保留字段
// { "full_message": null } → JSON → {"full_message": null}  ← schema 能检测到已 erase
```

### §5.2 audit chain 在 restart 后的连续性

```typescript
// 重启后 in-memory store 为空，但 SQLite 有记录
// 正确恢复步骤：
// 1. 从 SQLite 读取最后一条记录的 recordHash
// 2. 设为 in-memory store 的初始 lastHash（虚拟锚点）
// 3. 后续 append 时以此 hash 为 previousHash 起点

// 若不做恢复，重启后首条新 event 的 previousHash 会与 SQLite 链尾不匹配
// → verifyAuditChain() 会在重启点报 broken
```

---

## §6 测试辅助 (Test Helpers)

> **L0 对应入口**: L0 §11 测试策略锚点

```typescript
// ── Audit 测试辅助 ──

function makeTestAuditEnvelope(
  overrides: Partial<BuildAuditEnvelopeInput<Record<string, unknown>>> = {}
): AuditEnvelope<Record<string, unknown>> {
  return buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: `trace-test-${Date.now()}`,
    sequence: 0,
    payload: { outcome: "intent_selected", decisionId: "test-decision-001" },
    ...overrides,
  });
}

function makeChainedAuditEnvelopes(count: number): AuditEnvelope<Record<string, unknown>>[] {
  const envelopes: AuditEnvelope<Record<string, unknown>>[] = [];
  let previousHash: string | undefined;

  for (let i = 0; i < count; i++) {
    const e = buildAuditEnvelope({
      family: "heartbeat.decision",
      plane: "decision",
      traceId: `trace-chain-${i}`,
      sequence: i,
      payload: { outcome: "intent_selected", seq: i },
      previousHash,
    });
    envelopes.push(e);
    previousHash = e.integrity.recordHash;
  }

  return envelopes;
}

// ── SelfHealth 测试辅助 ──

function makeHealthySnapshot(): SelfHealthSnapshot {
  const now = new Date().toISOString();
  const dim = (extra: Partial<HealthDimension> = {}): HealthDimension => ({
    status: "healthy",
    checkedAt: now,
    diagnosticReasonCodes: [],
    ...extra,
  });

  return {
    generatedAt: now,
    overall: "healthy",
    dimensions: {
      connectorCircuitBreakers: { ...dim(), openBreakers: [], totalChecked: 3 },
      deliveryTruth: { ...dim(), recentDeliverySuccessRate: 0.95, proofMissingCount: 0 },
      quietDreamCadence: { ...dim(), lastQuietRunAt: now, lastDreamRunAt: now },
      secretAnchor: { ...dim(), anchors: [{ anchorId: "primary", keyPath: "SECOND_NATURE_ENCRYPTION_KEY", status: "verified", lastVerifiedAt: now }] },
      storageLayer: { ...dim(), dbConnectionStatus: "connected" },
      cronEnvDrift: { ...dim(), driftType: "none" },
      auditChainIntegrity: { ...dim(), lastVerifiedAt: now, verifiedCount: 100, brokenAt: undefined },
    },
    diagnosticReasonCodes: [],
  };
}

function makeCredentialMissingSnapshot(): Partial<SelfHealthSnapshot> {
  return {
    overall: "degraded",
    dimensions: {
      secretAnchor: {
        status: "degraded",
        checkedAt: new Date().toISOString(),
        diagnosticReasonCodes: [
          "secret:anchor_missing",
          "secret:credential_recovery_required",
        ],
        anchors: [{ anchorId: "primary", keyPath: "SECOND_NATURE_ENCRYPTION_KEY", status: "missing" }],
      },
    } as any,
    diagnosticReasonCodes: ["secret:anchor_missing", "secret:credential_recovery_required"],
  };
}

// ── RestoreAudit 测试辅助 ──

function makeRestoreAuditEvent(
  overrides: Partial<RestoreAuditEvent> = {}
): RestoreAuditEvent {
  return {
    id: `restore-test-${Date.now()}`,
    restoreTarget: "goal",
    fromVersion: "v1",
    toVersion: "v2",
    triggeredBy: "operator",
    reason: "test restore",
    excludedFields: ["credential_value", "encryption_key"],
    restoredFieldCount: 3,
    createdAt: new Date().toISOString(),
    traceId: `trace-restore-${Date.now()}`,
    ...overrides,
  };
}
```
