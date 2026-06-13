# Second Nature v8 — Living Perception Loop E2E 测试指南

> **版本**: 0.2.6 | **目标读者**: OpenClaw Agent (Claw) | **验收标准**: 工具返回 JSON 为准，不凭口头推断

---

## 0. 前置条件

以下全部满足后才能进入正式测试。每步都必须以 `second_nature_ops` 返回 JSON 验收，不凭"看起来正常"判断。

| # | 检查项 | 验收方式 |
|---|--------|----------|
| 0.1 | Plugin 已安装并启用，版本 >= 0.2.6 | `openclaw plugins list` 包含 `second-nature`，`openclaw plugins info second-nature` 返回 version 0.2.6 |
| 0.2 | `SECOND_NATURE_ENCRYPTION_KEY` 已配置（>=32 字符） | 由操作者确认；后续 `runtime_secret_bootstrap` 会验证 |
| 0.3 | `SECOND_NATURE_WORKSPACE_ROOT` 指向有效 workspace | `status` 命令确认 `workspaceRootResolution` 为 `env` 或 `tool_args` |
| 0.4 | Anchor files 就位 | `workspace/SOUL.md`、`workspace/IDENTITY.md`、`workspace/USER.md`、`workspace/MEMORY.md` 存在且有实质内容 |
| 0.5 | 首轮完整 `heartbeat_check` 已跑过 | 非 `probeOnly`，状态从 `runtime_carrier_only` 退出 |
| 0.6 | v7 基础面已验证 | 若未验证，先执行 `docs/claw-v7-ops-testing-guide.md` Phase 1-2 |

---

## Phase 1: v8 基础连通性（必须全部通过）

### 1.1 loop_status — v8 因果循环健康

```json
{
  "command": "loop_status",
  "args": {}
}
```

**预期**: 
- `ok: true` 或 `ok: false`（取决于 state DB 是否可用和是否有数据）
- `command: "loop_status"`
- `surfaceMode: "cli"`
- `generatedAt` 为 ISO 时间戳

**若 `ok: true`**:
- `data.overallStatus` 为 `"healthy"`、`"stalled"`、`"blocked"`、`"degraded"` 或 `"no_data"`
- `data.lastCycleSequence` 为数字（有 heartbeat 时）
- `data.stageSummaries` 为数组，元素包含 `stage`、`eventCount`、`stalled`
- `data.nextAction` 为字符串（人类可读的操作指引）

**若 `ok: false`（state DB 不可用时）**:
- `error.code: "STATE_DB_UNAVAILABLE"` 或 `"LOOP_STATUS_DEGRADED"`
- `error.nextStep` 存在

**首次运行的典型状态**:
```json
{
  "ok": true,
  "data": {
    "overallStatus": "no_data",
    "lastCycleSequence": 0,
    "stageSummaries": [],
    "policyDeniedCount": 0,
    "nextAction": "Run a heartbeat cycle or check connector configuration to generate initial evidence."
  }
}
```

### 1.2 heartbeat_check (full, 非 probeOnly)

```json
{
  "command": "heartbeat_check",
  "args": { "timestamp": "2026-06-03T00:00:00.000Z", "sessionContext": "v8_e2e_test" }
}
```

**预期**:
- `ok: true`
- `status` 不为 `"runtime_carrier_only"`
- `surfaceMode: "workspace_full_runtime"`
- `reasons` 数组非空（包含具体 action reason）

**关键断言**:
```
result.status ∈ ["heartbeat_ok", "intent_selected", "deferred", "denied"]
result.reasons.length > 0
result.decisionId 存在且为字符串
```

### 1.3 再次 loop_status — 验证 cycle 被记录

```json
{
  "command": "loop_status",
  "args": {}
}
```

**预期**:
- `ok: true`
- `data.lastCycleSequence` > 0（比 1.1 时有增长）
- `data.lastHeartbeatAt` 为最近的时间戳
- `stageSummaries` 非空（至少包含已执行过的 stage）

---

## Phase 2: v8 Living Loop 核心链路

**前提**: Phase 1 全部通过，workspace 已产生至少一轮 heartbeat 数据。

### 2.1 audit — 查看循环事件

```json
{
  "command": "audit",
  "args": {}
}
```

**预期**:
- `ok: true`
- `data.events` 为数组，包含最近的 heartbeat/decision/closure 事件
- `data.totalEvents` >= 1

**关键断言**:
```
data.events 中至少一条记录的 scope 为 "rhythm" 或 "heartbeat"
```

### 2.2 quiet — 检查日回顾状态

```json
{
  "command": "quiet",
  "args": { "scope": "recent" }
}
```

**预期**:
- `ok: true`
- `data` 包含 `day`、`closureCount`、`memoryCandidateCount` 或等效结构
- 若当天无 Quiet 数据: `data` 可能为空或包含 `nothing_yet`

### 2.3 dream:recent — 检查 Dream 状态

```json
{
  "command": "dream:recent",
  "args": { "limit": 3 }
}
```

**预期**:
- `ok: true`
- `data` 为数组（可能为空）
- 若有 Dream 记录: 元素包含 `runId`、`status`、`candidateCount` 或等效字段

### 2.4 cycle:recent — 查看最近循环

```json
{
  "command": "cycle:recent",
  "args": { "limit": 5 }
}
```

**预期**:
- `ok: true`
- `data` 为数组，元素包含 `cycleId`、`timestamp`、`status`、`reasons`

---

## Phase 3: v8 降级与边界场景

### 3.1 loop_status 在 state DB 不可用时

临时断开 state DB（如移动或重命名 `.second-nature/data/state.db`），执行:

```json
{
  "command": "loop_status",
  "args": {}
}
```

**预期**:
- `ok: false`
- `error.code: "STATE_DB_UNAVAILABLE"` 或 `"LOOP_STATUS_DEGRADED"`
- `runtimeMode: "unavailable"`
- `error.nextStep` 为 `"wire_state_db_into_ops_router"` 或 `"check_state_db_and_retry"`

**恢复后重新验证**: 恢复 state DB 后再次执行，应返回 `ok: true`。

### 3.2 heartbeat_check probeOnly 模式

```json
{
  "command": "heartbeat_check",
  "args": { "probeOnly": true }
}
```

**预期**:
- `ok: true`
- `surfaceMode: "capability_probe"` 或 `"host_safe_carrier"`
- `livedExperienceLoopClaimed: false`（不写入 lived-experience 数据）

### 3.3 连续 heartbeat 验证 cycleSequence 递增

执行两次完整 heartbeat（间隔 >= 1 分钟或改变 timestamp）:

```json
{ "command": "heartbeat_check", "args": { "timestamp": "2026-06-03T00:01:00.000Z" } }
```

```json
{ "command": "heartbeat_check", "args": { "timestamp": "2026-06-03T00:02:00.000Z" } }
```

然后:

```json
{ "command": "loop_status", "args": {} }
```

**预期**:
- `data.lastCycleSequence` >= 2
- `data.stageSummaries` 中各 stage 的 `eventCount` 随心跳次数增长

### 3.4 未知命令

```json
{
  "command": "loop_status_fake",
  "args": {}
}
```

**预期**:
- `ok: false`
- `error.code: "unknown_ops_command"` 或包含 `"Unknown"`

---

## Phase 4: v7 向后兼容验证

v8 不应破坏 v7 的 ops surface。抽样验证以下 v7 命令在 v8 下仍正常工作:

### 4.1 self_health

```json
{ "command": "self_health", "args": {} }
```

**预期**: `ok: true`，`data.overall` 存在，`data.dimensions` 存在。

### 4.2 heartbeat_digest

```json
{ "command": "heartbeat_digest", "args": {} }
```

**预期**: `ok: true`，`data` 为 digest 对象。

### 4.3 snapshot:capture

```json
{ "command": "snapshot:capture", "args": { "snapshotId": "v8-e2e-test-001" } }
```

**预期**: `ok: true`，`data.snapshotId` 与输入一致。

### 4.4 runtime_secret_bootstrap

```json
{ "command": "runtime_secret_bootstrap", "args": {} }
```

**预期**: `ok: true`，`data.plaintextKeyExposed === false`。

---

## 验收标准汇总

| 分类 | 通过标准 |
|------|----------|
| **Phase 1** | 1.1 `loop_status` 返回有效 envelope（ok 或 degraded 都有正确 shape）；1.3 cycleSequence 在 heartbeat 后递增 |
| **Phase 2** | audit/quiet/dream:recent/cycle:recent 全部返回 `ok: true`，数据结构符合预期 |
| **Phase 3** | 3.1 state DB 断开时 `loop_status` 返回 degraded 而非崩溃；3.3 连续 heartbeat 后 cycleSequence 正确递增 |
| **向后兼容** | 4.1-4.4 的 v7 命令全部返回 `ok: true`，无异常错误码 |
| **安全** | `runtime_secret_bootstrap` 返回中 `plaintextKeyExposed === false`；无任何命令返回 credential 明文 |

---

## 故障排除

| 症状 | 诊断 | 修复 |
|------|------|------|
| `loop_status` 返回 `STATE_DB_UNAVAILABLE` | `deps.state` 未接入 OpsRouter | 这是运行时 wiring 问题，非 Claw 侧可修复；确认 `SECOND_NATURE_WORKSPACE_ROOT` 有效后重试 |
| `loop_status` 返回 `LOOP_STATUS_DEGRADED` | state DB 可读但事件数据异常 | 检查 `error.message` 中的具体原因；运行 `storage_smoke` |
| `loop_status` 的 `stageSummaries` 为空但已有 heartbeat | 无前序 wave 的 stage event 写入 | 正常，v8 stage event 从当前版本开始累积 |
| `heartbeat_check` 始终返回 `runtime_carrier_only` | `workspaceRootResolution` 为 `unknown` | 回到 v7 Phase 1.3，检查 `SECOND_NATURE_WORKSPACE_ROOT` |
| `audit` 返回空数组 | 无 heartbeat 历史 | 先执行至少一次完整 heartbeat_check |
| `quiet`/`dream:recent` 返回 `nothing_yet` | 当天无 Quiet/Dream 数据 | 正常；Quiet 在 36h 窗口后自动触发 |

---

## 测试完成后的动作

1. 将测试结果摘要写入 `workspace/MEMORY.md`:
   - 测试日期、版本、通过的 Phase
   - `loop_status` 返回的 `overallStatus` 和 `lastCycleSequence`
   - 任何 `ok: false` 但属于预期行为的情况

2. 若测试中发现异常行为（非预期内的错误码、崩溃、credential 泄露），记录并附上:
   - 精确的工具调用 JSON
   - 脱敏后的响应 JSON（手动移除任何敏感值）
   - `openclaw gateway run` 的 stderr 中 `[second-nature]` 前缀的行

3. 定期回归：每次版本升级后重跑 Phase 1（`loop_status` + `heartbeat_check` + cycleSequence 验证）+ Phase 4（v7 向后兼容抽样）。
