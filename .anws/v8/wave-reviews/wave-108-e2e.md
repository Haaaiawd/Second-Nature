<!--
评测列语义（旅程结果 / Step 结果）：仅允许 PASS | PARTIAL_PASS | FAIL。
未在用户授权并完成浏览器回填前：留空或写「待实机」——严禁写任一 verdict，严禁自拟其它档位或同义粉饰。
-->

# Wave 108 E2E Verification — v8 Runtime Recovery Closure for Claw

## E2E Verification

### Scope
- **PRD / 需求来源**: `.anws/v8/01_PRD.md` §3.1 G1–G9, §4 US-006 (REQ-006), US-008 (REQ-008), US-009 (REQ-009), `.anws/v8/05A_TASKS.md` Wave 108 (T-CP.R.3, T-DQ.R.5, T-CS.R.2, T-CS.R.3, T-OBS.R.4, INT-R3)
- **Target**: OpenClaw host 中加载的 `second-nature` plugin v0.2.5；通过 `second_nature_ops` tool surface 触发 runtime-ops 命令
- **Environment**: OpenClaw workspace with `SECOND_NATURE_WORKSPACE_ROOT` pointing to a prepared `.second-nature` workspace；本地 `node` test harness 也可复现大部分断言
- **Browser / Viewport（计划）**: N/A；本版本无 UI surface，验证全部通过 OpenClaw tool JSON 输出或 CLI JSON 输出完成
- **User Role**: operator / owner（Claw 侧作为 agent 调用 tool，人类在旁确认输出）
- **Build / Commit**: `main @ e7d3819` (v0.2.5)
- **Side effects**: `heartbeat_run` 会写入 `EvidenceItem`, `PerceptionCard`, `JudgmentVerdict`, `ActionClosureRecord`, `DailyRhythmState`, `QuietDailyReview`, `DreamConsolidationRun`, `LoopStageEvent`；建议仅在测试 workspace 执行

### PRD traceability (RTM)
| PRD ref | Summary | Priority | Journeys |
| --- | --- | --- | --- |
| REQ-006 §4 | Quiet/Dream/Diary lifecycle trace truth | P1 | J1, J3 |
| REQ-008 §4 | Causal loop health with stage-level stall reason | P1 | J2, J4, J5 |
| REQ-009 §4 | Heartbeat action closure and no-action reason | P0 | J1, J4 |
| T-CP.R.3 | Heartbeat closure advances daily rhythm into Quiet/Dream | P0 | J1 |
| T-DQ.R.5 | Quiet/Dream runtime chain distinguish scheduled/blocked/empty | P0 | J1, J3 |
| T-CS.R.2 | Connector failure truth: HTTP/auth/config classes | P0 | J4 |
| T-CS.R.3 | Connector terminal failure bounded by cooldown | P0 | J4, J5 |
| T-OBS.R.4 | Decision denial/replay attribution without governance false blame | P0 | J2, J5 |

### Surface coverage
| 功能面 / 入口 | 如何发现 | Journey | PRD ref | Notes |
| --- | --- | --- | --- | --- |
| `second_nature_ops` tool call (`heartbeat_run`) | OpenClaw 会话 tool 列表可见 | J1, J4 | T-CP.R.3, REQ-009 | 手动或 host cadence 触发 |
| `second_nature_ops` (`loop_status`) | OpenClaw 会话 tool 列表可见 | J2, J5 | REQ-008, T-OBS.R.4 | 读取当前 workspace 因果健康 |
| `second_nature_ops` (`connector:run`) | OpenClaw 会话 tool 列表可见 | J4 | T-CS.R.2 | 直接触发 connector read |
| `second_nature_ops` (`quiet_status` / `dream_status`) | 若插件扩展了对应命令 | J3 | REQ-006, T-DQ.R.5 | 否则通过 `loop_status` 子段覆盖 |
| CLI `second-nature loop_status` | 终端直接运行 | J2, J5 | REQ-008, T-OBS.R.4 | 与 plugin 输出等价校验 |

### Journeys（旅程级）
| ID | PRD ref | User Journey | 旅程结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J1 | T-CP.R.3, T-DQ.R.5, REQ-006 | 触发一次真实 heartbeat，验证 closure 产生且自动推进到 Quiet/Dream rhythm | 待实机 | `heartbeat_run` JSON result；workspace state DB 中 `action_closure_record`, `daily_rhythm_state`, `quiet_daily_review`, `dream_consolidation_run` 行 | 需在测试 workspace 执行；断言 cycleSequence 递增 |
| J2 | T-OBS.R.4, REQ-008 | 对同一 workspace 调用 `loop_status`，验证 denial/replay 归因字段真实且不归咎于 governance | 待实机 | `loop_status` JSON；与 J1 同一 cycle window | 需检查无 `api-key` / `token` / raw payload 泄露 |
| J3 | T-DQ.R.5, REQ-006 | 跨天触发 heartbeat，验证 Quiet/Dream 状态从 `due` → `completed` / `scheduled` 推进，无重复 schedule | 待实机 | `loop_status` 或专用 status command 的 `rhythmState` 字段；state DB 行 | 需要准备两天 closure 数据 |
| J4 | T-CS.R.2, T-CS.R.3, REQ-009 | 配置一个会返回 401/403/5xx 的 connector runner，触发 connector run / heartbeat，验证失败分类与 cooldown 边界 | 待实机 | `connector:run` 或 `heartbeat_run` 返回的 failureClass；`connector_cooldown_state` 表；`loop_status` attribution | 不会执行真实外部平台写 |
| J5 | T-OBS.R.4, REQ-008 | 在 denial/cooldown 状态下调用 `loop_status`，验证 six attribution counters 与 next action 可读 | 待实机 | `loop_status` JSON；state DB 中 `action_closure_record` reason 与 `connector_cooldown_state` | 可与 J4 共用同一 workspace |

### Step breakdown
| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J1 | 1. 打开 OpenClaw 会话，确认 `second_nature_ops` 出现在可用 tool 列表中 | T-ROS.C.1 | 待实机 | 截图 / tool 列表 JSON | 若不可见，检查 plugin 是否加载 v0.2.5 |
| J1 | 2. 在已设置 `SECOND_NATURE_WORKSPACE_ROOT` 的 workspace 中调用 `second_nature_ops` 命令 `heartbeat_run` | T-CP.R.3 | 待实机 | `heartbeat_run` 返回 JSON | 命令参数：`{ "command": "heartbeat_run", "workspaceRoot": "<test>" }` |
| J1 | 3. 断言返回 `ok=true`，包含 `cycleId` 与 `cycleSequence`；若 closure 产生，包含 `closureRef`；若无，包含 `noActionReason` | REQ-009 | 待实机 | 返回 JSON 字段 | 不能两者同时缺失 |
| J1 | 4. 查询 state DB，断言存在至少一条 `action_closure_record` 或一条带 `no_action_reason` 的 closure | REQ-009 | 待实机 | SQL / JSON artifact | `closure_status` 或 `no_action_reason` 必填 |
| J1 | 5. 断言 `daily_rhythm_state` 已写入，`quietStatus` 为 `completed`，`dreamStatus` 为 `scheduled` | T-CP.R.3, T-DQ.R.5 | 待实机 | `daily_rhythm_state` 行 | 与旧版本 `dreamStatus=missing` 区分 |
| J1 | 6. 断言 `quiet_daily_review` 存在且 `closureRefs` 非空 | T-DQ.R.5 | 待实机 | `quiet_daily_review` 行 | closure provenance 必须保留 |
| J2 | 1. 对 J1 同一 workspace 调用 `second_nature_ops` 命令 `loop_status` | REQ-008 | 待实机 | `loop_status` JSON | 不触发新 heartbeat |
| J2 | 2. 断言返回包含 `causalHealth` 段，至少列出 `ingestion/perception/judgment/action_policy/execution/action_closure/quiet_review/dream_consolidation` 中各 stage 的 `healthy|stalled|blocked|missing` 状态 | REQ-008 | 待实机 | `causalHealth.stages[]` | 不允许全部默认 healthy |
| J2 | 3. 断言 `attribution` 段存在六个计数：`policyDeniedCount`, `hardGuardDeniedCount`, `cooldownReplayCount`, `sourceAbsenceCount`, `quietSuppressionCount`, `connectorTerminalCount` | T-OBS.R.4 | 待实机 | `attribution.*` | 可为 0，但字段必须存在 |
| J2 | 4. 断言输出 JSON 字符串中不包含 `api-key`, `token`, `Bearer`, `encrypted_value` 等 credential-like 子串 | REQ-008, NG4 | 待实机 | JSON 字符串搜索 | 红action必须生效 |
| J3 | 1. 准备或复用已有两天 closure 数据的 workspace，确保前一天已有 `ActionClosureRecord` | T-DQ.R.5 | 待实机 | state DB query | 可手动构造或使用 fixture |
| J3 | 2. 触发 heartbeat，等待 `advanceAndRecordDailyRhythm` 完成对前一天日记的 review | T-CP.R.3 | 待实机 | `heartbeat_run` 返回 | 注意 rhythm 推进发生在 closure 之后 |
| J3 | 3. 断言 `daily_rhythm_state` 未出现重复 `dreamConsolidationRunId`；`dreamStatus` 不为 `skipped`  unless scheduler unavailable | T-DQ.R.5 | 待实机 | `daily_rhythm_state` + `dream_consolidation_run` | duplicate-schedule guard 必须生效 |
| J4 | 1. 在 connector manifest 中配置一个 `declarative_http` runner，指向返回 401/403/5xx 的本地 mock URL | T-CS.R.2 | 待实机 | `manifest.yaml` | 不触碰真实平台 |
| J4 | 2. 调用 `connector:run` 或等待 heartbeat 触发该 connector | T-CS.R.2 | 待实机 | `connector:run` 返回 / `heartbeat_run` 返回 | 断言 failureClass 为 `auth_failure` / `rate_limited` / `transport_error` / `configuration_missing` / `permanent_input`，而非 `unknown_platform_change` |
| J4 | 3. 重复触发 connector 直到第三次，断言第三次返回 `cooldown_blocked`，且底层 runner 实际调用次数不超过 cooldown 阈值 | T-CS.R.3 | 待实机 | `connector_cooldown_state` 表；mock 请求计数 | terminalCount 与 failureCount 必须分离 |
| J4 | 4. 断言返回中不暴露请求头里的 `Authorization` 或 credential 值 | REQ-008, NG4 | 待实机 | 返回 JSON 字符串 | credential leak 检查 |
| J5 | 1. 在 J4 同一 workspace 冷却期内调用 `loop_status` | T-OBS.R.4 | 待实机 | `loop_status` JSON | 与 J2 同一接口 |
| J5 | 2. 断言 `attribution.cooldownReplayCount` > 0，`connectorTerminalCount` > 0 | T-OBS.R.4 | 待实机 | attribution 字段 | 归因必须指向 root cause |
| J5 | 3. 断言 `nextAction` 提示修复 credential / connector config / 等待 cooldown，而不是模糊地提示 governance denied | T-OBS.R.4 | 待实机 | `nextAction` 字符串 | 禁止 generic governance blame |

### Findings
- 待实机后回填

### Coverage gaps
- **无 UI 表面**: v8 Wave 108 是纯 runtime / ops surface 变更，没有可点击的 Web UI；所有验证通过 OpenClaw tool 或 CLI 完成。
- **真实外部平台写**: 默认 autonomy policy 保守，v0.2.5 不执行真实 `broadcast/interact/claim/auto_*` 写操作；相关 write-side 验证保留为 policy-gated dry-run 或 deny 路径。
- **跨浏览器 / 移动端**: 不适用。
- **Deep host integration**: OpenClaw host 的 tool 列表可见性、plugin 加载顺序、workspaceRoot 解析属于宿主行为；本指南覆盖 SN plugin 侧契约，宿主侧异常需单独排查。

### Recommendation
- 指南阶段：建议先完成 J1 + J2 的最小实机走查，确认 plugin v0.2.5 在目标 OpenClaw 环境中正常注册并返回真实 runtime 产物。
- J4 需要本地 mock HTTP server（可用 `npx http-server` 或 `node -e` 快速启动），建议在隔离 workspace 执行。
- 全部旅程通过且归因字段无 credential 泄露后，可判定 Wave 108 host smoke 完成。

---

## Claw 操作速查

当 Claw 在实机验证时代替人类执行时，参考以下最小命令集：

```json
// 触发一次真实 heartbeat
{
  "name": "second_nature_ops",
  "arguments": {
    "command": "heartbeat_run",
    "workspaceRoot": "/path/to/test-workspace"
  }
}

// 读取因果健康与归因
{
  "name": "second_nature_ops",
  "arguments": {
    "command": "loop_status",
    "workspaceRoot": "/path/to/test-workspace"
  }
}

// 直接触发一个 connector（用于 J4 失败分类验证）
{
  "name": "second_nature_ops",
  "arguments": {
    "command": "connector:run",
    "workspaceRoot": "/path/to/test-workspace",
    "platformId": "moltbook",
    "capabilityId": "feed.read"
  }
}
```

Claw 应使用 `.second-nature/mock/` 下的 fixture 或本地 HTTP mock，不要调用真实生产平台写接口。

---

## 证据清单（实机回填）

- [ ] OpenClaw tool 列表含 `second_nature_ops`
- [ ] `heartbeat_run` 返回 JSON（含 `cycleId`/`cycleSequence`/`closureRef`/`noActionReason`）
- [ ] `loop_status` 返回 JSON（含 `causalHealth`/`attribution`/`nextAction`）
- [ ] state DB 中 `action_closure_record` / `daily_rhythm_state` / `quiet_daily_review` / `dream_consolidation_run` 行截图或 SQL dump
- [ ] `connector_cooldown_state` 行截图或 SQL dump
- [ ] 对 `loop_status` JSON 做 credential leak 搜索的结果（应无命中）
