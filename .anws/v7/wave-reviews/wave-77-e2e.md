# Wave 77 E2E Verification — T-V7C.C.6 Production Data Growth Closure

**波次**: Wave 77
**任务**: T-V7C.C.6
**模式**: guide-only（实机 Claw 复测，无浏览器 UI 界面）
**日期**: 2026-05-27

---

## 1. RTM（需求追溯表）

| 验收条目 | PRD/05A Ref | 验证方式 | 状态 |
|---|---|---|---|
| heartbeat_digest 每次 heartbeat 有新行 | 05A T-V7C.C.6 AC-1 | Claw `second_nature_ops heartbeat_check` + DB 行计数 | 待实机 |
| life_evidence_index 在 connector success 后有新行 | 05A T-V7C.C.6 AC-2 | Claw `connector_test dryRun:false` + DB 行计数 | 待实机 |
| tool_experience 在 connector attempt 后有新行 | 05A T-V7C.C.6 AC-3 | Claw `heartbeat_check` with connectorExecutor + DB | 待实机 |
| dream_output_index 在 dream 完成后有新行 | 05A T-V7C.C.6 AC-4 | Claw dream trigger + DB 行计数 | 待实机 |
| heartbeat_check 异常时返回结构化错误而非抛出 | Code review H-3 | 集成测试已覆盖（test case 3），实机可选 | PASS（集成） |
| digestOpts 在无 auditStore 时不组装 | Code review H-1 | 集成测试 case 2 PASS | PASS（集成） |

---

## 2. Surface Coverage

| 入口 | 说明 | 是否覆盖 |
|---|---|---|
| `heartbeat_check` (ops-router) | auditStore + state + digestOpts 注入路径 | 是（集成测试 T-V7C.C.6 全部 PASS） |
| `heartbeat-surface.ts` exception catch | cycle 异常 → 结构化 HeartbeatSurfaceResult | 是（代码层已验证） |
| `ops-router.ts` exception catch | dispatch 异常 → RuntimeOpsEnvelope | 是（代码层已验证） |
| `plugin/runtime/dream/` | dream-scheduler 打包到插件运行时 | 是（build-plugin-package.ts 已修复，bridge test 16/16 PASS） |
| OpenClaw `second_nature_ops` tool | Claw agent session 中调用 | 待实机 |

---

## 3. Journey / Steps

### Journey A: heartbeat_digest 持久化验证

**前置**: Claw 已加载 Second Nature plugin 0.1.38+；`SECOND_NATURE_WORKSPACE_ROOT` 指向有效 workspace；`auditStore` 已由宿主注入。

| Step | 读屏预期 | 动作 | 结果 | Evidence |
|:---|:---|:---|:---|:---|
| A1 | Agent session 可用；`second_nature_ops` 在工具列表中 | 调用 `second_nature_ops { command: "heartbeat_check", args: { probeOnly: false } }` | 待实机 | Claw JSON response |
| A2 | `ok: true`, `surfaceMode: "workspace_full_runtime"` | 检查 response 字段 | 待实机 | response JSON |
| A3 | `heartbeat_digest` 表行数 ≥ 1 | 查询 `state.db` 中 `heartbeat_digest` COUNT(*) | 待实机 | DB 查询结果 |

### Journey B: plugin runtime dream/ 加载验证

**前置**: Plugin 以打包形式（plugin/ 目录）加载，非 source 模式。

| Step | 读屏预期 | 动作 | 结果 | Evidence |
|:---|:---|:---|:---|:---|
| B1 | Plugin 无 `Cannot find module dream-scheduler` 错误 | 启动 Claw session，检查 plugin load 日志 | 待实机 | Claw load log |
| B2 | `second_nature_ops` 工具正常注册 | `openclaw plugins list` 或 Claw tool list | 待实机 | tool list output |

### Journey C: 异常处理路径验证（可选，集成测试已覆盖）

| Step | 读屏预期 | 动作 | 结果 | Evidence |
|:---|:---|:---|:---|:---|
| C1 | `ok: false`, `error.code: "HEARTBEAT_CYCLE_EXCEPTION"` | 构造 readModels 抛异常场景，dispatch heartbeat_check | 集成测试 PASS | commands.test.ts line 370 |

---

## 4. Coverage Gaps

- **life_evidence_index / tool_experience / dream_output_index** 行增长需要真实 connector 执行（`connectorExecutor` wired + platformId 有效 + 外部平台可达）。在无 connector 的内存测试中不会增长，属已知约束，非回归。
- **dream_output_index** 增长需要 dream 完成周期（quiet → dream schedule → dream run → output 写入），链路较长，E2E 验证依赖完整 dream pipeline。
- 实机 heartbeat_digest 行写入依赖 `auditStore` 注入与 digest 窗口时间（默认无窗口限制时写入，production 设定 `digestWindowHour` 后只在对应 UTC 小时写入）。

---

## 5. 集成测试总结（替代实机的最强静态证据）

| 测试 | 文件 | 结论 |
|---|---|---|
| `T-V7C.C.6 persists heartbeat_digest when auditStore + state + digestOpts are wired` | commands.test.ts:312 | **PASS** — heartbeat_digest=1 ✅ |
| `T-V7C.C.6 does NOT persist heartbeat_digest when auditStore is absent` | commands.test.ts:347 | **PASS** — heartbeat_digest=0 ✅ |
| `T-V7C.C.6 heartbeat_check returns ok:true even when stateMemoryPort throws during digest` | commands.test.ts:368 | **PASS** — cycle survives digest failure ✅ |
| Bridge tests (plugin-workspace-ops-bridge.test.ts) 16/16 | all bridge tests | **PASS** — dream/ runtime 打包修复后全部通过 ✅ |
| commands.test.ts 全量 33/33 | all commands | **PASS** ✅ |

---

## 6. Findings

| ID | PRD Ref | 发现 | 严重度 | 状态 |
|---|---|---|---|---|
| F-77-01 | build-plugin-package.ts | `dream/` 目录未打包到 plugin/runtime，导致 `createQuietDreamSchedulePort` import 失败 | High | **已修复** — dream/ 加入 RUNTIME_ARTIFACTS |
| F-77-02 | heartbeat-surface.ts / ops-router.ts | 异常路径未 catch，cycle 崩溃时无结构化返回 | High | **已修复** — try-catch 覆盖两层 |
| F-77-03 | commands.test.ts | 旧测试断言 life_evidence/tool_experience/dream_output 行增长，但纯内存测试无 connector exec，断言不可达 | Medium | **已修复** — 测试改为仅验证 heartbeat_digest=1 |

---

## 7. Blockers

- 需 Claw 0.1.38+ 实机环境以验证 heartbeat_digest 真实写入。
- 需 workspace 含已注册 connector 以验证 life_evidence_index / tool_experience 行增长。
