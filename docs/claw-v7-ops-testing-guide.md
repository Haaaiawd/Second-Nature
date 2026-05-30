# Second Nature v7 Ops Surface — Claw 测试指南

> 版本: 0.1.51 | 目标读者: OpenClaw Agent (Claw) | 验收标准: 工具返回 JSON 为准，不凭口头推断

---

## 0. 前置条件

以下全部满足后才能进入正式测试。每步都必须以 `second_nature_ops` 返回 JSON 验收，不凭"看起来正常"判断。

| # | 检查项 | 验收方式 |
|---|--------|----------|
| 0.1 | Plugin 已安装并启用 | `openclaw plugins list` 包含 `second-nature`，`openclaw plugins info second-nature` 返回 version 0.1.51 |
| 0.2 | `SECOND_NATURE_ENCRYPTION_KEY` 已配置（>=32 字符） | 由操作者确认；后续 `runtime_secret_bootstrap` 会验证 |
| 0.3 | `SECOND_NATURE_WORKSPACE_ROOT` 指向 OpenClaw agent workspace（含 `SOUL.md`、`data/` 的目录） | 后续 `status` 命令确认 `workspaceRootResolution` 为 `env` 或 `tool_args` |
| 0.4 | Anchor files 就位 | `workspace/SOUL.md`、`workspace/IDENTITY.md`、`workspace/USER.md`、`workspace/MEMORY.md` 存在且有实质内容 |
| 0.5 | 首轮完整 `heartbeat_check` 已跑过 | 非 `probeOnly`，状态从 `runtime_carrier_only` 退出 |

---

## Phase 1: 基础连通性（必须全部通过）

### 1.1 setup_hint — 读取初始化指引

```json
{
  "command": "setup_hint",
  "args": { "format": "summary" }
}
```

**预期**: `ok: true`，`data.status` 为 `pending` 或 `acknowledged`。若 `pending`，继续 Phase 1.2。

### 1.2 setup_ack — 确认已读指引

仅当 1.1 返回 `pending` 时执行。

```json
{
  "command": "setup_ack",
  "args": { "acceptedBy": "claw", "placedIn": "agent prompt" }
}
```

**预期**: `ok: true`，`data.status` 变为 `acknowledged`。

### 1.3 status — 验证 workspace root 桥接

```json
{
  "command": "status",
  "args": {}
}
```

**预期**: `ok: true`，`data.workspaceRootResolution` 为 `env` 或 `tool_args`。若仍为 `unknown`，**停止测试**，回到前置条件 0.3。

**反例**（workspace root 未接上时）:
```json
{
  "ok": false,
  "surfaceMode": "host_safe_carrier",
  "workspaceReadModelsEvaluated": false,
  "data": { "workspaceRootResolution": "unknown" }
}
```

### 1.4 storage_smoke — 存储层探针

```json
{
  "command": "storage_smoke",
  "args": {}
}
```

**预期**: `ok: true`，`data.nativeAvailable` 和 `data.sqlJsAvailable` 至少一个为 `true`。`data.canOpenStateDb` 应为 `true`。

---

## Phase 2: 心跳与 v6 基础面（验证 backward compatibility）

### 2.1 heartbeat_check (probe only)

```json
{
  "command": "heartbeat_check",
  "args": { "probeOnly": true, "timestamp": "2026-05-30T00:00:00.000Z" }
}
```

**预期**: `ok: true`，`status: "heartbeat_ok"`，`surfaceMode: "capability_probe"`，`livedExperienceLoopClaimed: false`。

### 2.2 heartbeat_check (full)

```json
{
  "command": "heartbeat_check",
  "args": { "timestamp": "2026-05-30T00:00:00.000Z", "sessionContext": "v7 ops testing" }
}
```

**预期**: 若 runtime 已接好，返回 `status: "heartbeat_ok"` 或 `"intent_selected"` 等 lived-experience 状态；`surfaceMode` 为 `"workspace_full_runtime"`。若返回 `runtime_carrier_only`，说明前置条件未满足。

### 2.3 narrative — 叙事状态

```json
{
  "command": "narrative",
  "args": {}
}
```

**预期**: `ok: true`，`data` 包含 `focus`、`progress`、`nextIntent`、`sourceRefs`。

### 2.4 goal — 目标列表

```json
{
  "command": "goal",
  "args": { "action": "list" }
}
```

**预期**: `ok: true`，`data` 为 goal 数组（可能为空）。

### 2.5 credential — 凭据状态

```json
{
  "command": "credential",
  "args": {}
}
```

**预期**: `ok: true`，返回各平台凭据状态（`missing`/`pending_verification`/`active`）。

---

## Phase 3: v7 Ops Surface 逐项测试

以下 11 个命令是 v7 新增 ops surface。每个命令的**首测**在 workspace full runtime 环境下进行（Phase 1.3 已确认 root 接通）。

### 3.1 self_health — 自健康快照

```json
{
  "command": "self_health",
  "args": {}
}
```

**预期**:
- `ok: true`
- `runtimeMode: "workspace_full_runtime"`
- `data.overall` 为 `"healthy"`、`"degraded"` 或 `"unknown"`
- `data.dimensions` 为对象，键是维度 ID，值包含 `status` 和 `checkedAt`
- `data.degraded_dimensions` 为数组（若 healthy 则为空数组）

**关键断言**:
```
data.dimensions 至少包含以下键之一（说明 probe 已注册）：
  "storage", "heartbeat", "connector", "narrative", "dream", "quiet", "credential"
```

### 3.2 tool_affordance — 工具能力图

```json
{
  "command": "tool_affordance",
  "args": {}
}
```

**预期**:
- 若 body-tool affordance port **已接入**: `ok: true`，`data` 包含 affordance map
- 若 **未接入**（当前常态）: `ok: false`，`error.code: "TOOL_AFFORDANCE_PORT_UNWIRED"`，`error.nextStep: "wire_body_tool_port_into_ops_router_deps"`

**边界测试**（带查询参数）:
```json
{
  "command": "tool_affordance",
  "args": { "platformId": "moltbook", "goalKind": "exploration" }
}
```

**预期**: 同上一致（port 未接入时参数不影响错误码）。

### 3.3 heartbeat_digest — 心跳摘要

```json
{
  "command": "heartbeat_digest",
  "args": { "date": "2026-05-30" }
}
```

**预期**:
- 若当天无 connector 活动: `ok: true`，`data.isNothingSignificant: true`，`data.connectorSummary` 为空数组
- 若有活动: `data.connectorSummary` 为数组，元素包含 `platformId`、`successCount`、`failureCount`、`circuitOpenCount`、`blockedCount`

**关键断言**:
```
data.connectorSummary 每个元素不包含 "password"、"raw_payload"、"private_message"、"Bearer "
```

**空日期测试**:
```json
{
  "command": "heartbeat_digest",
  "args": {}
}
```

**预期**: 默认使用当天日期（`new Date().toISOString().slice(0, 10)`），行为同上。

### 3.4 snapshot:capture — 恢复快照捕获

```json
{
  "command": "snapshot:capture",
  "args": { "snapshotId": "test-v7-001" }
}
```

**预期**:
- `ok: true`
- `runtimeMode: "workspace_full_runtime"`
- `data.snapshotId` 与输入一致
- `data.capturedAt` 为 ISO 时间戳
- `data.entityWhitelist` 为默认 6 种: `identity_profile`, `agent_goal`, `tool_experience`, `daily_diary`, `dream_output`, `narrative_timeline`
- `data.rowCounts` 为各 entity 的行数记录

**自定义 entity 白名单测试**:
```json
{
  "command": "snapshot:capture",
  "args": { "snapshotId": "test-v7-002", "entityWhitelist": ["agent_goal", "dream_output"] }
}
```

**预期**: `data.capturedKinds` 仅包含请求的两个 kind，`data.rowCounts` 其他 kind 不出现或计数为 0。

### 3.5 timeline — 叙事时间线查询

```json
{
  "command": "timeline",
  "args": { "limit": 5 }
}
```

**预期**:
- `ok: true`
- `data.entries` 为数组，长度不超过 `limit`
- `data.nextCursor` 存在（当有更多数据时）或不存在（末页）

**分页测试**:
```json
{
  "command": "timeline",
  "args": { "limit": 2, "cursor": "<上一步返回的nextCursor>" }
}
```

**预期**: 新页面 entries 与上一页无重叠。

**90 天范围超限测试**:
```json
{
  "command": "timeline",
  "args": { "from": "2025-01-01T00:00:00.000Z", "to": "2026-05-30T00:00:00.000Z" }
}
```

**预期**: `ok: false`，`error.code: "NARRATIVE_RANGE_EXCEEDED"`（或 `"TIMELINE_QUERY_FAILED"`）。

### 3.6 narrative:diff — 版本差异比较

**前置**: 需先执行 3.4 `snapshot:capture` 至少两次，获得两个 narrative version。

```json
{
  "command": "narrative:diff",
  "args": { "from": "test-v7-001", "to": "test-v7-002" }
}
```

**预期**:
- `ok: true`
- `data.changes` 为数组（可能为空）

**版本不存在测试**:
```json
{
  "command": "narrative:diff",
  "args": { "from": "nonexistent-v1", "to": "nonexistent-v2" }
}
```

**预期**: `ok: false`，`error.code: "NARRATIVE_VERSION_NOT_FOUND"`。

**缺失参数测试**:
```json
{
  "command": "narrative:diff",
  "args": {}
}
```

**预期**: `ok: false`，`error.code: "MISSING_VERSIONS"`。

### 3.7 restore — 有界恢复

**方式 A: 通过 snapshotId（推荐）**
```json
{
  "command": "restore",
  "args": { "snapshotId": "test-v7-001", "triggeredBy": "operator", "reason": "v7_ops_test" }
}
```

**方式 B: 通过显式字段**
```json
{
  "command": "restore",
  "args": {
    "restoreTarget": "agent_goal",
    "fromVersion": "v1",
    "toVersion": "v2",
    "triggeredBy": "operator",
    "reason": "v7_ops_test"
  }
}
```

**预期**:
- `ok: true` 或 `ok: false`（取决于 restoreSnapshotStore 是否可用及数据状态）
- `data.auditWritten: true`（只要 auditStore 可用）
- `data.fromVersion`、`data.toVersion`、`data.restoreTarget` 与输入一致
- `data.excludedFields` 包含 `"credential"`（凭据字段永不恢复）
- `data.isPartialRestore` 为 `true` 当且仅当 `failedEntities.length > 0`

**关键安全断言**:
```
返回 JSON 字符串中不得包含 "sk-"、"Bearer "、任何 credential 明文
```

**缺失参数测试**:
```json
{
  "command": "restore",
  "args": {}
}
```

**预期**: `ok: false`，`error.code: "MISSING_RESTORE_FIELDS"`。

### 3.8 runtime_secret_bootstrap — 运行时密钥锚点

```json
{
  "command": "runtime_secret_bootstrap",
  "args": {}
}
```

**预期**:
- `ok: true`
- `data.status` 为 `"ok"`、`"runtime_secret_anchor_missing"`、`"credential_recovery_required"` 或 `"runtime_secret_unavailable"`
- `data.plaintextKeyExposed` 必须为 `false`
- `data.anchorLocation` 为密钥环境变量名（如 `"SECOND_NATURE_ENCRYPTION_KEY"`）
- `data.recoverySteps` 为数组（当 status 非 ok 时应有内容）

**关键安全断言**:
```
返回 JSON 字符串中不得包含实际的加密密钥值（如 32 字符以上的随机字符串）
data.plaintextKeyExposed === false
```

### 3.9 connector:run — 手动连接器执行

**前置**: 需有已注册的 connector 和有效凭据。

```json
{
  "command": "connector:run",
  "args": {
    "platformId": "moltbook",
    "capabilityId": "feed.read",
    "payload": { "limit": 5 },
    "caller": "v7_ops_test",
    "reason": "manual test run"
  }
}
```

**预期**:
- 若 deps 完备: `ok: true` 或 `ok: false`（取决于 connector 实际执行结果）
- 若 `connectorExecutor` 未接入: `ok: false`，`error.code: "MANUAL_RUN_DEPS_UNAVAILABLE"`

**缺失参数测试**:
```json
{
  "command": "connector:run",
  "args": { "platformId": "moltbook" }
}
```

**预期**: `ok: false`，`error.code: "MISSING_PLATFORM_OR_CAPABILITY_ID"`。

### 3.10 guidance_payload — 引导载荷组装

```json
{
  "command": "guidance_payload",
  "args": { "sceneType": "social" }
}
```

**预期**:
- `ok: true`
- `data.sceneType: "social"`
- `data.impulseText` 为字符串或 `null`
- `data.atmosphereText` 为字符串
- `data.expressionBoundaryConstraints` 为数组
- `data.expressionBoundaryStyle` 为字符串

**全场景类型测试**:
依次测试 `sceneType`: `"social"`, `"reply"`, `"outreach"`, `"quiet"`, `"explain"`, `"user_reply"`。

**预期**: 全部返回 `ok: true`，`data.capabilityClass` 随场景变化。

**无效场景类型测试**:
```json
{
  "command": "guidance_payload",
  "args": { "sceneType": "invalid_scene" }
}
```

**预期**: `ok: false`，`error.code: "INVALID_SCENE_TYPE"`。

**带 capabilityIntent 和 platformId 测试**:
```json
{
  "command": "guidance_payload",
  "args": {
    "sceneType": "reply",
    "capabilityIntent": "comment.reply",
    "platformId": "moltbook"
  }
}
```

**预期**: `ok: true`，`data.capabilityIntent: "comment.reply"`，`data.platformId: "moltbook"`。

---

## Phase 4: 边界与降级场景

### 4.1 workspace root 断开时 v7 命令行为

临时移除 `SECOND_NATURE_WORKSPACE_ROOT`（或在调用时不传 `workspaceRoot`），执行:

```json
{
  "command": "self_health",
  "args": {},
  "workspaceRoot": ""
}
```

**预期**: `ok: false`，`surfaceMode: "host_safe_carrier"`，`workspaceReadModelsEvaluated: false`，`error.code: "WORKSPACE_READ_SURFACE_UNAVAILABLE"` 或等效错误。

### 4.2 未知命令

```json
{
  "command": "not_a_real_command",
  "args": {}
}
```

**预期**: `ok: false`，`message` 包含 `"Unknown Second Nature command"`。

### 4.3 heartbeat_check 参数边界

**空 timestamp**:
```json
{
  "command": "heartbeat_check",
  "args": { "timestamp": "" }
}
```

**预期**: 使用当前时间填充，正常返回。

**超大 sessionContext**:
```json
{
  "command": "heartbeat_check",
  "args": { "sessionContext": "<超过 10KB 的字符串>" }
}
```

**预期**: 正常处理或截断，不崩溃。

---

## 验收标准汇总

| 分类 | 通过标准 |
|------|----------|
| **Phase 1** | 1.3 `status` 返回 `workspaceRootResolution !== "unknown"` |
| **Phase 2** | 2.2 `heartbeat_check` (full) 返回 lived-experience 状态，非 `runtime_carrier_only` |
| **Phase 3** | `self_health`、`heartbeat_digest`、`snapshot:capture`、`timeline`、`narrative:diff`、`restore`、`runtime_secret_bootstrap`、`guidance_payload` 8 个命令在 full runtime 下返回 `ok: true`（`tool_affordance` 和 `connector:run` 因依赖端口状态可接受 `ok: false` 但错误码必须准确） |
| **安全** | `restore`、`runtime_secret_bootstrap` 返回中无 credential 明文；`snapshot:capture` 不暴露敏感行内容 |
| **边界** | 4.1 workspace root 断开时所有 v7 命令返回 carrier-only 降级，不抛异常 |

---

## 故障排除

| 症状 | 诊断 | 修复 |
|------|------|------|
| 所有命令返回 `runtime_carrier_only` 或 `host_safe_carrier` | `workspaceRootResolution` 为 `unknown` | 设置 `SECOND_NATURE_WORKSPACE_ROOT` 并重启 gateway，或在每次调用时传 `workspaceRoot` |
| `self_health` 返回 `SELF_HEALTH_PROBE_FAILED` | Probe 注册或执行异常 | 检查 `data/error.message`，通常是 DB 不可写；运行 `storage_smoke` |
| `heartbeat_digest` 返回 `AUDIT_STORE_UNAVAILABLE` | OpsRouterDeps 未接入 auditStore | 这是运行时 wiring 问题，非 Claw 侧可修复；记录并上报 |
| `timeline`/`narrative:diff` 返回 `NARRATIVE_TIMELINE_PORT_UNAVAILABLE` | narrativeTimelineDeps 未接入 | 同上，属于运行时 wiring |
| `restore` 返回 `RESTORE_SNAPSHOT_STORE_UNAVAILABLE` | restoreSnapshotStore 未接入 | 同上；回退到 audit-only 模式仍应写入 restore audit |
| `guidance_payload` 返回 `INVALID_SCENE_TYPE` | 传了未定义的场景 | 检查 `sceneType` 是否为 6 个有效值之一 |
| `connector:run` 返回 `MANUAL_RUN_DEPS_UNAVAILABLE` | connectorExecutor 或 state 未接入 | 确认 connector 子系统已初始化 |

---

## 测试完成后的动作

1. 将本指南测试结果摘要写入 `workspace/MEMORY.md`:
   - 测试日期、版本、通过的 Phase
   - 任何 `ok: false` 但属于预期行为的情况（如 `tool_affordance` port 未接入）
   - 需要操作者或开发者跟进的异常

2. 若测试中发现异常行为（非预期内的错误码、崩溃、credential 泄露），记录到 issue tracker 并附上:
   - 精确的工具调用 JSON
   - 脱敏后的响应 JSON（手动移除任何敏感值）
   - `openclaw gateway run` 的 stderr 中 `[second-nature]` 前缀的行

3. 定期回归：每次版本升级后重跑 Phase 1 + Phase 3 核心命令（`self_health`、`heartbeat_digest`、`snapshot:capture`、`guidance_payload`）。
