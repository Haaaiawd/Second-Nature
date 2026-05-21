# Runtime Ops System — 实现细节 (L1)

| 字段 | 值 |
| --- | --- |
| **对应 L0** | [runtime-ops-system.md](./runtime-ops-system.md) |
| **文件性质** | L1 实现层 |
| **创建日期** | 2026-05-21 |

> 本文件仅在 `/forge` 任务明确引用时加载。日常设计与任务规划优先读取 L0。

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v1.0 | 2026-05-21 | 初始实现层；command JSON Schema、wet probe 状态机、reason code 字典、4 个核心算法 |

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §9 / §10 / §12 |
| §2 | [核心数据结构完整定义](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 / §5 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 / §11 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

| Key | Default | Owner | Notes |
| --- | --- | --- | --- |
| `runtime.wetProbeIntervalMs` | `60000` | runtime-ops | wet probe 定时间隔 |
| `runtime.wetProbeTimeoutMs` | `5000` | runtime-ops | 单次 wet probe 超时 |
| `runtime.wetProbeRetryCount` | `2` | runtime-ops | 超时后重试次数 |
| `runtime.commandQueueMaxPending` | `50` | runtime-ops | CommandQueue 最大积压 |
| `runtime.commandQueueMaxBurstMs` | `200` | runtime-ops | 允许的突发等待窗口 |
| `runtime.commandSchemaRegistryMaxEntries` | `500` | runtime-ops | CommandSchemaRegistry 最大条目 |
| `runtime.reasonCodeRegistryVersion` | `"v7.0"` | runtime-ops | ReasonCode 字典版本 |
| `runtime.connectorProbeMaxParallel` | `8` | runtime-ops | 并发 probe connector 数量上限 |

---

## §2 核心数据结构完整定义 (Full Data Structures)

L0 §6 已声明公共字段。本节补充实现层专用类型，包含完整 JSON Schema 和命令处理内部类型。

### §2.1 CommandSchemaRegistry 条目结构

每个 CommandSchemaRegistry 条目是一个 JSON Schema v7 对象，标准结构如下：

```json
{
  "commandKind": "set_connector_probe_interval",
  "version": "v7.0.0",
  "description": "Update wet probe interval for a specific connector",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["connectorId", "intervalMs"],
    "additionalProperties": false,
    "properties": {
      "connectorId": {
        "type": "string",
        "minLength": 1,
        "description": "Target connector identifier"
      },
      "intervalMs": {
        "type": "integer",
        "minimum": 5000,
        "maximum": 3600000,
        "description": "New probe interval in milliseconds"
      }
    }
  },
  "idempotencyKeyFields": ["connectorId"],
  "effectClass": "maintenance"
}
```

### §2.2 ReasonCode 字典（完整）

对应 L0 §5.1 中 `runWetProbe` 的 `reason` 字段：

| Code | 类别 | 含义 |
| --- | --- | --- |
| `probe_ok` | success | 探测成功，连接器健康 |
| `probe_timeout` | degraded | 探测请求超时（超过 `wetProbeTimeoutMs`） |
| `probe_auth_failure` | failure | 探测时认证失败（401/403） |
| `probe_network_error` | failure | 网络层错误（DNS / TCP 失败） |
| `probe_schema_mismatch` | failure | 连接器响应不符合已注册 schema |
| `probe_breaker_open` | deferred | 该连接器当前 circuit breaker open，跳过探测 |
| `probe_rate_limited` | deferred | 探测被连接器端限速（429） |
| `probe_dependency_unavailable` | degraded | 探测依赖（如 secret anchor）不可用 |
| `command_schema_valid` | success | 命令 payload 通过 schema 校验 |
| `command_schema_invalid` | rejection | 命令 payload 不符合已注册 schema |
| `command_not_registered` | rejection | commandKind 未在 registry 中注册 |
| `command_idempotent_skip` | skip | idempotency key 命中，跳过重复执行 |
| `command_execution_ok` | success | 命令执行成功 |
| `command_execution_failed` | failure | 命令执行失败（非 schema / 非 idempotency 原因） |
| `heartbeat_context_timeout` | degraded | EmbodiedContext assembly 超时（某 slice 降级） |

### §2.3 WetProbeState 类型（内部状态机完整类型）

```ts
export type WetProbeStatus =
  | "idle"
  | "probing"
  | "success"
  | "timeout"
  | "failed"
  | "deferred"
  | "rate_limited";

export interface WetProbeState {
  connectorId: string;
  status: WetProbeStatus;
  lastProbeAt?: string;         // ISO-8601
  nextRetryAt?: string;         // ISO-8601，timeout 后指数退避时间
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastReasonCode: string;       // 来自 ReasonCode 字典
  breakerPosture: "closed" | "half_open" | "open";
}

export interface WetProbeResult {
  connectorId: string;
  status: WetProbeStatus;
  reasonCode: string;
  durationMs: number;
  probeAt: string;
  retryCount: number;
  errorDetail?: string;
}
```

### §2.4 CommandExecutionContext

```ts
export interface CommandExecutionContext {
  commandId: string;
  commandKind: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  enqueuedAt: string;         // ISO-8601
  attemptCount: number;
  sourceRef?: string;
}

export interface CommandExecutionResult {
  commandId: string;
  reasonCode: string;         // 来自 ReasonCode 字典
  executedAt?: string;
  skippedReason?: string;     // 若 idempotent_skip
  error?: string;
}
```

> 对应 L0 入口：§6

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 `runWetProbe(connectorId)`

**对应契约**：L0 §5.1
**准入理由**：wet probe 状态机含重试、指数退避、circuit breaker 更新，顺序敏感。

```text
FUNCTION runWetProbe(connectorId):

  -- Step 1: check circuit breaker state
  state = wetProbeStateMap.get(connectorId)
  if state.breakerPosture == "open":
    state.lastReasonCode = "probe_breaker_open"
    state.status = "deferred"
    emit ProbeResult { connectorId, reasonCode: "probe_breaker_open" }
    return

  -- Step 2: check secret anchor availability
  anchor = secretAnchors.get(connectorId)
  if anchor == null or anchor.keyHealth != "ok":
    state.lastReasonCode = "probe_dependency_unavailable"
    state.status = "degraded"
    emit ProbeResult { connectorId, reasonCode: "probe_dependency_unavailable" }
    return

  -- Step 3: set status to probing
  state.status = "probing"

  -- Step 4: execute probe with retry loop
  retries = 0
  while retries <= wetProbeRetryCount:
    result = await probeConnector(connectorId, withTimeout: wetProbeTimeoutMs)

    if result is TimeoutError:
      retries++
      if retries <= wetProbeRetryCount:
        await exponentialBackoff(retries)
        continue
      else:
        state.status = "timeout"
        state.lastReasonCode = "probe_timeout"
        state.consecutiveFailures++
        state.nextRetryAt = now() + computeRetryDelay(state.consecutiveFailures)
        break

    if result is RateLimitError:
      state.status = "rate_limited"
      state.lastReasonCode = "probe_rate_limited"
      state.nextRetryAt = result.retryAfter ?? now() + 60000
      break

    if result is AuthError:
      state.status = "failed"
      state.lastReasonCode = "probe_auth_failure"
      state.consecutiveFailures++
      break

    if result is NetworkError:
      state.status = "failed"
      state.lastReasonCode = "probe_network_error"
      state.consecutiveFailures++
      break

    if not schemaRegistry.validate(connectorId, result.responseShape):
      state.status = "failed"
      state.lastReasonCode = "probe_schema_mismatch"
      state.consecutiveFailures++
      break

    -- SUCCESS
    state.status = "success"
    state.lastReasonCode = "probe_ok"
    state.consecutiveSuccesses++
    state.consecutiveFailures = 0
    state.lastProbeAt = now()
    break

  -- Step 5: update circuit breaker posture
  state.breakerPosture = computeBreakerPosture(state.consecutiveFailures,
                                               state.consecutiveSuccesses)

  -- Step 6: persist state delta to state-memory
  stateMemory.upsertCapabilityProbeResult({
    connectorId,
    status: state.status,
    reasonCode: state.lastReasonCode,
    breakerPosture: state.breakerPosture,
    probedAt: now()
  })

  -- Step 7: emit probe event
  emit WetProbeResult {
    connectorId, status: state.status,
    reasonCode: state.lastReasonCode,
    durationMs, probeAt: now(), retryCount: retries
  }
```

> 对应 L0 入口：§5.1

---

### §3.2 `processCommandQueue()`

**对应契约**：L0 §5.1
**准入理由**：queue draining 中 schema validate → idempotency → execute → ack 的顺序是 exactly-once 语义的基础。

```text
FUNCTION processCommandQueue():

  LOOP (until queue is empty):
    cmd = queue.dequeue()               -- block/await if empty

    -- 1. Idempotency check (early, before validation overhead)
    if idempotencyRegistry.has(cmd.idempotencyKey):
      emit CommandResult {
        commandId: cmd.commandId,
        reasonCode: "command_idempotent_skip"
      }
      continue

    -- 2. CommandKind registration check
    if not schemaRegistry.has(cmd.commandKind):
      emit CommandResult {
        commandId: cmd.commandId,
        reasonCode: "command_not_registered",
        error: "unknown commandKind: " + cmd.commandKind
      }
      continue

    -- 3. JSON Schema validation
    validationResult = schemaRegistry.validate(cmd.commandKind, cmd.payload)
    if not validationResult.valid:
      emit CommandResult {
        commandId: cmd.commandId,
        reasonCode: "command_schema_invalid",
        error: validationResult.errors.join("; ")
      }
      continue

    -- 4. Execute command
    try:
      handler = handlerRegistry.get(cmd.commandKind)
      await handler.execute(cmd.payload, { commandId: cmd.commandId })

      -- 5. Register idempotency key after success
      idempotencyRegistry.set(cmd.idempotencyKey, { commandId: cmd.commandId, executedAt: now() })

      emit CommandResult {
        commandId: cmd.commandId,
        reasonCode: "command_execution_ok",
        executedAt: now()
      }
    catch error:
      emit CommandResult {
        commandId: cmd.commandId,
        reasonCode: "command_execution_failed",
        error: error.message
      }
      -- do NOT register idempotency key on failure (allow retry)
```

> 对应 L0 入口：§5.1

---

### §3.3 `initRuntime(config)`

**对应契约**：L0 §5.1
**准入理由**：init 顺序（schema registry → command queue → wet probe scheduler → heartbeat scheduler）有严格 dependency 顺序。

```text
FUNCTION initRuntime(config):

  -- Step 1: load command schema registry (must succeed, no degraded path)
  schemaRegistry.load(config.commandSchemaManifestPath)
  if schemaRegistry.failed:
    throw RuntimeInitError("command_schema_load_failed")

  -- Step 2: wire command queue
  commandQueue.init({
    maxPending: commandQueueMaxPending,
    maxBurstMs: commandQueueMaxBurstMs
  })
  commandQueue.startProcessingLoop()

  -- Step 3: init wet probe scheduler
  for each connectorId in config.connectors:
    wetProbeStateMap.set(connectorId, {
      status: "idle",
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      breakerPosture: "closed"
    })
  probeScheduler.start(
    interval: wetProbeIntervalMs,
    parallelLimit: connectorProbeMaxParallel
  )

  -- Step 4: init heartbeat scheduler
  heartbeatScheduler.init({
    rhythmScope: "rhythm",
    channelScope: "user_task"
  })
  heartbeatScheduler.start()

  -- Step 5: self-report init complete
  selfHealth.reportStatus({ component: "runtime-ops", status: "ok", startedAt: now() })

  return { status: "ok", connectors: config.connectors.length }
```

> 对应 L0 入口：§5.1

---

### §3.4 `handleRuntimeModeSwitch(newMode)`

**对应契约**：L0 §5.1
**准入理由**：runtime mode 切换（`plugin` ↔ `carrier` ↔ `cli`）中 heartbeat scope 和 probe behavior 的联动逻辑有非显而易见的副作用。

```text
FUNCTION handleRuntimeModeSwitch(newMode):

  -- Step 1: validate mode
  validModes = ["plugin", "carrier", "cli"]
  if newMode not in validModes:
    return { success: false, reason: "invalid_mode" }

  oldMode = runtimeState.currentMode

  -- Step 2: pause heartbeat during switch (avoid race)
  heartbeatScheduler.pause()

  -- Step 3: mode-specific adjustments
  if newMode == "carrier":
    -- carrier: no rhythm heartbeat, no wet probe, no EmbodiedContext
    probeScheduler.pause()
    heartbeatScheduler.setScope("user_task_only")
    heartbeatScheduler.setMode("carrier_lite")
  else if newMode == "plugin":
    -- plugin: full rhythm heartbeat, wet probe active
    probeScheduler.resume()
    heartbeatScheduler.setScope("rhythm")
    heartbeatScheduler.setMode("full")
  else if newMode == "cli":
    -- cli: no rhythm heartbeat, wet probe on demand only
    probeScheduler.pause()
    heartbeatScheduler.setScope("user_task")
    heartbeatScheduler.setMode("on_demand")

  -- Step 4: update runtime mode state
  runtimeState.currentMode = newMode
  runtimeState.modeSwitchedAt = now()

  -- Step 5: resume heartbeat with new scope
  heartbeatScheduler.resume()

  -- Step 6: emit mode switch event
  observability.emit("runtime_mode_switched", { from: oldMode, to: newMode, at: now() })

  return { success: true, oldMode, newMode }
```

> 对应 L0 入口：§5.1

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 wet probe 状态机完整路径

```text
[idle]
  |── 定时触发 ──> [probing]
  |                 |── SUCCESS ──> [success] -> consecutive_successes++ -> posture: closed
  |                 |── TIMEOUT ──> retry?
  |                 |               |── yes (retries <= max) -> [probing]
  |                 |               └── no  ──> [timeout]   -> consecutive_failures++ -> posture update
  |                 |── RATE_LIMIT ──> [rate_limited] -> nextRetryAt = retryAfter
  |                 |── AUTH_ERROR ──> [failed] -> consecutive_failures++ -> posture update
  |                 |── NETWORK    ──> [failed] -> consecutive_failures++ -> posture update
  |                 └── SCHEMA_ERR ──> [failed] -> consecutive_failures++ -> posture update
  |── breaker OPEN ──> [deferred] (reason: probe_breaker_open)
  └── dep missing  ──> [degraded]  (reason: probe_dependency_unavailable)

posture update rule:
  consecutive_failures >= 5  -> "open"
  0 < consecutive_failures < 5 -> "half_open"
  consecutive_failures == 0  -> "closed"
```

> 对应 L0 入口：§4.1 组件图 WetProbeScheduler

---

### §4.2 command queue 满负荷策略

```text
queue.length >= commandQueueMaxPending?
  |── YES: 触发时间 > commandQueueMaxBurstMs？
  |          |── YES: 拒绝新命令，返回 { dropped: true, reason: "queue_overflow" }
  |          |         emit 命令被丢弃事件，selfHealth 标记 degraded
  |          └── NO:  允许短暂 burst，命令继续进队，等待 queue drain
  └── NO:   正常入队
```

> 对应 L0 入口：§4.1 组件图 CommandQueue

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| **wet probe 与 heartbeat 竞争锁** | probe 写入 state-memory 与 heartbeat 读取 context 发生竞态，导致 context 读到半更新状态 | probe 写入使用 `upsertCapabilityProbeResult`（幂等，覆盖写）；heartbeat context assembly 读取 snapshot（时间点查询），不存在中间状态 |
| **schema registry 热更新失败** | 新 schema 加载失败，commandKind 被暂时注销 | 失败时保留旧 registry；emit schema_update_failed 事件；selfHealth 标记 degraded（不影响已注册命令执行） |
| **idempotency key 缓存满** | 过期 key 未 evict，导致 cache 溢出 | LRU 缓存；max size = commandQueueMaxPending × 100；TTL = 24h；满时 evict oldest entries，保留最近 80% |
| **carrier 模式下 rhythm heartbeat 触发** | mode switch 时已入队的 rhythm task 继续执行 | pause heartbeat scheduler 先于 mode 切换；pause 期间已入队的 rhythm task 等待 resume 后被判断 scope，carrier 模式下被丢弃（不执行） |
| **多个 connector 同时探测失败** | 所有 breaker open，探测全部 deferred，自愈需要人工 | half_open 后的 probe 周期需允许一次探测（即使 breaker open 也应每 N 个周期 probe 一次探活）；至少一次成功后 breaker 关闭 |
| **命令 payload 超大** | 命令 JSON payload 过大导致 schema 校验阻塞事件循环 | `commandSchemaRegistryMaxEntries` 限制注册上限；payload 大小上限在 schema 中以 `maxLength` / `maxItems` 约束；解析超时 1s 则视为 schema_invalid |
| **runtime init schema 加载失败** | 命令无法处理，队列开始积压 | init 失败是 hard fail，不允许 degraded 启动；调用方（host extension）负责呈现错误信息 |

> 对应 L0 入口：§9 / §5.3

---

## §6 测试辅助 (Test Helpers)

建议的测试辅助（fixtures / helpers）：

| Helper | 用途 |
| --- | --- |
| `makeWetProbeState(connectorId, status, failures)` | 生成指定状态的 WetProbeState，用于状态机测试 |
| `stubProbeConnector(result)` | mock `probeConnector`，控制返回 success / timeout / auth / network 等，无需真实网络 |
| `makeCommandExecution(commandKind, payload)` | 生成最小合法 CommandExecutionContext，自动生成 idempotencyKey |
| `makeCommandSchema(commandKind, requiredFields)` | 生成最小合法 JSON Schema，注册到 stub schema registry |
| `assertReasonCode(result, expectedCode)` | 断言 CommandExecutionResult / WetProbeResult 的 reasonCode 字段 |
| `flushCommandQueue(queue)` | 同步 drain command queue，用于 integration test 确认所有命令都已处理 |
| `stubHeartbeatScheduler(scope)` | mock heartbeat scheduler，控制 scope 和触发时机，用于 runtime mode switch 测试 |

> 对应 L0 入口：§11
