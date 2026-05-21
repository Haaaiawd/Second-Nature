# connector-system 调研报告

**调研时间**: 2026-05-21  
**服务于**: `connector-system` 详细设计  
**调研方法**: web_search + 现有代码库扫描

---

## 一、调研主题与关键发现

### 1. Connector Manifest Registry Design Pattern (TypeScript 2025)

**搜索词**: "connector manifest registry design pattern TypeScript 2025"

**关键发现**:

- **514-labs connector-registry**: 采用"每个 connector 一个 manifest YAML + 语言实现"的分目录结构，manifest 声明 connector name、metadata、schema。与 v7 思路一致——manifest 是声明，实现是 adapter。
- **Archestra connector registry**: 使用 Zod discriminated union 作为 connector type schema，所有 connector type 集中在单文件 `knowledge-connector.ts`，新增 connector 时 TypeScript 会报错精确指向需要更新的位置。这种"类型系统引导注册"的模式值得参考。
- **fractary/forge**: manifest-based 3层解析（local → global → remote），TTL 缓存 + SHA-256 checksum 验证，manifest 与 plugin 分离。为 v7 workspace manifest scan 提供设计参考。
- **Manifest Pattern (Andrew Hathaway)**: manifest 应封装所有 implementation-specific detail，不得在 manifest 外部对特定 connector 做特殊处理。这与 v7 "endpoint mapping 配置在 manifest，不硬编码" 的设计原则完全吻合。

**对设计的影响**:
- ConnectorManifestV6 schema 应通过 Zod 严格验证，新增字段通过 schema evolution 而非 if/else 处理
- CapabilityContractRegistry 应持有 immutable snapshot，swap 而非 mutate（v6 已有 `RegistrySnapshotStore.swap()` 正在做这件事）
- manifest 中声明 `probe_safe_endpoint` 字段，避免 WetProbeRunner 硬编码平台 URL

---

### 2. Capability Contract Registry / Plugin Architecture

**搜索词**: "capability contract registry plugin architecture"

**关键发现**:

- **OpenClaw CapabilityContractRegistry 实现** (在调研中发现真实代码): `buildCapabilityContractRegistry` 接受 plugins 数组并 flatMap 出 `CapabilityContractEntry`，按 pluginId 去重。与 v6 `CapabilityContractRegistry` 已接近。
- **plumbus framework**: Capability 是"原子业务操作"，每个 capability 声明 access policy、idempotency class。这为 v7 `CapabilityDeclaration` 增加 `idempotencyClass`、`accessPolicy` 字段提供参考。
- **FCP (Flywheel Connector Protocol)**: 每个 capability 声明 `idempotency: none | best_effort | strict`，`requires_approval: none | policy | interactive`。映射到 v7 trust_required 和 effectSemanticsClass。
- **weaveintel tools**: Extended tool registry 包含 versioning、risk tagging、health tracking——这与 v7 的 ToolAffordanceMap 思路互通，但 affordance 计算属于 body-tool-system，connector-system 只需提供 actualCapabilities 和 probe 结果。

**对设计的影响**:
- `CapabilityContractRegistry` 负责 manifest lifecycle（register / unregister / snapshot），不承担 affordance 计算
- connector manifest 中每个 capability 应可声明 `effectClass: read_only | side_effect | task_claim | keepalive`（v6 已有 `classifyConnectorIntentEffect`，v7 应将此前置到 manifest 声明层）

---

### 3. Wet Probe Pattern / API Health Check Connector

**搜索词**: "wet probe pattern API health check connector TypeScript"

**关键发现**:

- **AuditBuffet Pattern Catalog**: "health check endpoint that only returns HTTP 200 without verifying dependencies will report healthy during connection pool exhaustion"。这正是 v7 ADR-008 解决的问题——dry test 不等于真实健康。
- **health-probes (smnbbrv)**: 将 liveness / readiness / startup probe 分离；readiness probe 仅在所有 non-optional checks 通过时才 200。对 v7 WetProbeRunner 的启示：probe 应有 `isReadinessBlocker` 标记，endpoint 404 才是真正的不可用。
- **@nestjs/terminus**: `HttpHealthIndicator.pingCheck()` 模式——实际 HTTP 请求到目标地址，返回 HealthCheckResult。v7 WetProbeRunner 应同样发起真实 HTTP 请求到 manifest 声明的 `probe_safe_endpoint`，记录 status code、response size-bounded summary。

**对设计的影响**:
- WetProbeRunner 必须记录: `probeEndpoint`（实际请求的 URL）、`declaredCapabilities`、`actualCapabilities`（probe 成功则为 declared 子集，失败则为空）、`endpointMismatch`（404/401 时）
- Probe 结果 `CapabilityProbeResult` 应包含 `httpStatus`, `latencyMs`, `redactedSample`（size-bounded）, `mismatchReason`
- wet probe 必须限制只允许 GET / read-only safe endpoint，不允许 side-effect probe

---

### 4. Credential Vault / Connector Security (TypeScript Agent)

**搜索词**: "credential vault connector security TypeScript agent idempotency external API"

**关键发现**:

- **Agent Vault (Infisical)**: "Agent Vault never reveals vault-stored credentials to agents. Credentials are encrypted at rest, decrypted only in memory at proxy time, and injected into outbound requests server-side."这与 v7 `CredentialGatedExecutionAdapter` 的设计原则完全一致。
- **1Claw Vault**: HSM-backed，agent JWT 携带 `shroud_enabled`，secret 只在代理层解密注入。v7 规模不需要 HSM，但"credential 不暴露给 agent"原则相同。
- **Network Guard**: Agent Vault 对每个 outbound proxy 连接做 IP 级验证，阻止私有 IP 范围。v7 在 plugin-first 架构下等价物是 `execution_policy` + trust gate——只有 declarative_trusted 和 trusted_custom_adapter 可执行。
- **Request Logging**: Agent Vault 对所有代理请求做审计日志，但不记录 credential 明文。v7 `ExecutionTelemetry` 已记录 attempt 行，v7 新增 wet probe 结果也应进入 telemetry 而非明文 log。

**对设计的影响**:
- `CredentialGatedExecutionAdapter` 在执行前必须验证: credential 存在 + status=active + encryptedValue 非空；不满足任一条件则返回 `StructuredUnavailableReason{code: credentials_missing}`
- credential 永远不进入 ConnectorResult.data、redactedSample 或任何 artifact；只在 execution adapter 内存中短暂持有
- wet probe 不使用 credential；probe 只验证 endpoint 可达性和 schema 合规性

---

### 5. Idempotency / External API Connector

**搜索词**: "capability contract registry idempotency connector TypeScript plugin architecture 2025"

**关键发现**:

- **FCP-Core Protocol**: "Idempotency keys for retries" 是 Request-Response archetype 的 default expectation。`side_effect` 和 `task_claim` 类 intent 必须携带 idempotency key。
- **InMemoryEffectCommitLedger (v6 已有)**: `getOrCreateIntentCommitRecord` 以 `decisionId::idempotencyKey` 为 key，若 record.state == "committed" 则 skipAdapter。v7 应将 ledger 持久化（目前是 in-memory）以支持跨 heartbeat cycle 的幂等保护。
- **FCP Capability**: `idempotencyClass: none | best_effort | strict`——`strict` 要求 key 级别幂等。v7 `task.claim` 属于 `strict`，`feed.read` 属于 `none`。

**对设计的影响**:
- `EffectCommitLedger` 在 v7 需要持久化实现（SQLite 行），in-memory 版本保留为 test seam
- `ConnectorResult` 应包含 `execution_id`（与 idempotency key 绑定）以支持幂等重试识别
- manifest capability 声明中新增 `idempotencyClass` 字段，默认 `none`，side-effect 强制 `strict`

---

## 二、Circuit Breaker 设计参考

**搜索词**: "circuit breaker pattern TypeScript connector half-open probe recovery"

**关键发现**:

- **DEV Community 80行实现**: 三态（CLOSED / OPEN / HALF_OPEN）+ error-rate window + exponential cooldown + 单次 half-open probe。HALF_OPEN 状态只允许一次 probe call，成功则 CLOSED，失败则 OPEN with doubled cooldown。
- **CircuitBreaker (mostafasayed gist)**: `halfOpenCalls` 计数 + `halfOpenMaxCalls` 配置，probe in-flight 检查避免并发多次 probe。
- **ts-easy-circuit-breaker**: `failureThreshold` 是比率（0~1），配合 `timeWindow`、`minAttempts`、`minFailures`，比单纯计数更稳健。

**对 v7 body-tool-system CircuitBreaker 的影响**（注意：CircuitBreaker 状态在 body-tool-system，connector-system 负责接受 probe 执行请求并返回真实结果）:
- v7 WetProbeRunner 在 HALF_OPEN 时被 body-tool-system 调用，执行 safe endpoint 的真实 HTTP 请求
- WetProbeRunner 返回 `CapabilityProbeResult`，CircuitBreaker 根据结果决定转换为 CLOSED 或重新 OPEN

---

## 三、v6 基线代码扫描结果

| 文件 | 发现 |
|------|------|
| `src/connectors/base/contract.ts` | `ConnectorResult<T>`（已有 status/data/failureClass），`ConnectorRequest`（platformId/intent/payload/idempotencyKey），`ConnectorExecutionPort`，`CapabilityIntent` 枚举（9 个内建 intent） |
| `src/connectors/base/manifest.ts` | `CapabilityContractRegistry`（register/loadManifest/hasCapability/resolveCapability），`ConnectorManifest` Zod schema |
| `src/connectors/manifest/manifest-schema.ts` | `ConnectorManifestV6`（schemaVersion/platformId/family/capabilities/runner/credentials/sourceRefPolicy/trust），`ConnectorTrustStatus`（4 种），`ConnectorRunnerKind`（7 种） |
| `src/connectors/registry/dynamic-connector-registry.ts` | `DynamicConnectorRegistry`（扫描 workspace manifests，conflict fail-closed，atomically swap snapshot） |
| `src/connectors/registry/trust-policy.ts` | `classifyTrust()`（runner kind → trust status），`isExecutable()` |
| `src/connectors/services/connector-executor-adapter.ts` | `createConnectorExecutorAdapter()`，接线 vault + registry + routePlanner + telemetry + policy；已有 moltbook/evomap/agent-world 三平台 runner；credential 在 adapter 内部解密，不暴露 |
| `src/connectors/base/execution-policy.ts` | `enforceExecutionPolicy()`（side-effect 必须 idempotency key，degraded channel 不允许 side-effect，EffectCommitLedger 防重复）；`InMemoryEffectCommitLedger` |
| `src/connectors/base/failure-taxonomy.ts` | 13 种 `FailureClass`，`classifyFailure()`，HTTP status → failure class 映射 |
| `src/connectors/near-real/near-real-connector-smoke.ts` | 近实连接器冒烟（sentinel adapter + policy + telemetry）；已有 feed.read / work.discover / task.claim 三种 fixture |

**v7 新增缺口**（v6 尚未实现）:
1. `WetProbeRunner`——真实 HTTP probe 到 safe endpoint，记录 actualCapabilities
2. `CapabilityProbeResult`——probe 结果 schema，含 httpStatus、mismatch、redactedSample
3. `StructuredUnavailableReason`——能力不可用时 reason code（非静默失败）
4. manifest v7 字段——`probe_safe_endpoint`、`endpoint_mapping`（避免代码硬编码 URL）
5. `EffectCommitLedger` 持久化实现（SQLite 行，跨 heartbeat cycle 幂等）
6. `execution_id` in `ConnectorResult`（与 idempotency key 绑定）

---

## 四、设计结论摘要

| 设计决策 | 结论 | 来源 |
|---------|------|------|
| manifest schema 验证 | 使用 Zod strict parse，新字段通过 schema evolution | Archestra + v6 已有 Zod |
| endpoint mapping | manifest 中声明 endpoint / profile_path / claim_path template | Manifest Pattern 原则 + v6 硬编码问题 |
| credential isolation | 解密在 adapter 内存，不进入 result / artifact / log | Agent Vault 设计 + v6 已有 |
| wet probe 限制 | 只允许 GET / read-only safe endpoint，结果 redacted | health-probes + AuditBuffet |
| idempotency | side_effect/task_claim 强制 strict idempotency key，read_only exempt | FCP + v6 enforceExecutionPolicy |
| StructuredUnavailableReason | 5 种 reason code，不允许静默失败 | v7 PRD [REQ-009] |
| EffectCommitLedger | v7 target: SQLite 持久化，v6 in-memory 保留为 test seam | FCP idempotency + v6 InMemoryEffectCommitLedger |

---

*本报告仅为设计输入，最终方案以 PRD、ADR、Architecture Overview 和 connector-system.md 为准。*
