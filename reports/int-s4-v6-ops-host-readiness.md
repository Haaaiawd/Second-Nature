# INT-S4 — S4 Ops Surface & Host Readiness (v6)

**Milestone**: `.anws/v6/05A_TASKS.md` INT-S4  
**Date**: 2026-05-16  
**验证策略**: 单元测试 + 集成测试 + plugin bridge 冒烟；**真实 OpenClaw 宿主 E2E** 须在目标宿主会话中手动验证（见「已知边界」）。

## 退出标准对照

| 领域 | 状态 | 说明 |
| --- | --- | --- |
| `sn narrative` — NarrativeState read + groundingStatus (T1.2.1) | pass | 见下表 #1 |
| `sn dream:recent` — DreamTrace read + lifecycleStatus (T1.2.2) | pass | 见下表 #2 |
| `sn connector:status` / `sn connector:test` (T1.2.3) | pass | 见下表 #3 |
| `sn goal` set/list/accept/reject (T1.2.4) | pass | 见下表 #4 |
| `sn cycle:recent` — aggregate cycle buckets (T1.2.5) | pass | 见下表 #5 |
| `sn status` — v6 aggregate narrative+dream+cycles (T1.2.6) | pass | 见下表 #6 |
| host-safe carrier returns honest `runtimeMode=host_safe_carrier` | pass | 见下表 #7 |
| workspace full runtime heartbeat returns `heartbeat_ok` | pass | 见下表 #8 |
| plugin bridge `second_nature_ops` JSON-first surface | pass | 见下表 #9 |
| DreamTrace + NarrativeTrace in audit store (T5.1.1 / T5.1.2) | pass | 见下表 #10 |
| v5 non-regression (514 total tests green) | pass | 见下表 #11 |

---

## Given / When / Then 与证据

| # | Given | When | Then | 证据（测试名 / 文件） |
| --- | --- | --- | --- | --- |
| 1 | 空 / 有 NarrativeState（confidence 0.3 / 0.5 / 0.8；active / awaiting_sources） | `sn narrative` | 空→ `nothing_yet` + `groundingStatus:blocked`；有数据→ focus/progress/nextIntent/sourceRefs/groundingStatus 正确；awaiting_sources→ blocked；confidence≥0.7+active→ pass | `T1.2.1-A/B/C/D` — `tests/integration/cli/t1-2-1-narrative-command.test.ts`（4 cases） |
| 2 | 空 audit store / 单 DreamTrace / 5 events + limit=2 | `sn dream:recent [limit]` | 空→ `totalRuns:0 runs:[]`；有数据→ traceId/runId/durationMs/inputCounts/lifecycleStatus 正确；limit 截断有效 | `T1.2.2-A/B/C/D` — `tests/integration/cli/t1-2-2-dream-recent.test.ts`（4 cases） |
| 3 | connector manifest fixture + trust policy | `sn connector:status` / `sn connector:test` | status 返回 registered/trust/executable 摘要；test 返回 dry-run 诚实结果；命令已注册 | `T1.2.3 connector status/test` — `tests/unit/cli/t1-2-3-connector-status.test.ts` |
| 4 | 空 / 有 AgentGoal（proposal/accepted/rejected） | `sn goal set / list / accept / reject` | set→ proposal 写入；list→ 按 status 过滤；accept/reject→ 治理边界正确；proposal goal 不影响优先级 | `T1.2.4 goal command` — `tests/unit/cli/t1-2-4-goal-command.test.ts`（11 cases） |
| 5 | 空 audit / 多维度 events（decision+dream+connector）/ limit | `sn cycle:recent [limit]` | 空→ `nothing_yet`；有数据→ buckets 按小时聚合；dimensions 标记存在维度；limit 截断有效 | `T1.2.5-A/B/C/D` — `tests/integration/cli/t1-2-5-cycle-recent.test.ts`（4 cases） |
| 6 | 空 / 有 narrative+dream+cycle 数据；部分缺失 | `sn status` | 全空→ 三 section 均 `nothing_yet`；有数据→ narrative.status+focus+groundingStatus，dream.status+totalRuns，cycles.status+dimensions 正确；缺失 section 返回 `nothing_yet` 不伪造 | `T1.2.6-A/B/C/D` — `tests/integration/cli/t1-2-6-status-aggregate.test.ts`（4 cases） |
| 7 | carrier-only mode（无 workspaceRoot） | `heartbeat_check` | 返回 `runtimeMode:host_safe_carrier`；无 heartbeat_ok claim；无 lived-experience 断言 | `T1.1.4 carrier-only baseline` — `tests/integration/cli/plugin-workspace-ops-bridge.test.ts` |
| 8 | full runtime（有 workspaceRoot） | workspace `heartbeat_check` | 返回 `heartbeat_ok`；决策链路走通；runtime 决策写入 ledger | `T1.1.4 known workspaceRoot bridges heartbeat_check` — `tests/integration/cli/plugin-workspace-ops-bridge.test.ts` |
| 9 | `second_nature_ops` tool call（root known / root unknown） | `openWorkspaceOpsBridge` → JSON-first dispatch | known root→ workspace_full_runtime read surface；unknown root→ carrier-only honest `ok:false`；explain/fallback/audit 命令可达 | `T1.1.4 bridge tests` — `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`（12 cases） |
| 10 | DreamTrace / NarrativeTrace events | `auditStore.list()` | dream.trace 与 narrative.trace envelope 写入正确；hash-chain 完整；explain 可解析 auditId | `T5.1.1` — `tests/integration/observability/t5-1-1-dream-trace-audit.test.ts`（5 cases）；`T5.1.2` — `tests/integration/observability/heartbeat-narrative-trace.test.ts` |
| 11 | 全量 v5 + v6 测试集 | `pnpm build && node --test dist/tests/**/*.test.js` | 514 tests pass，0 fail；TypeScript 无 error；v5 已有契约未被破坏 | 全量回归 — 514/514 pass |

---

## 与 `05A_TASKS` INT-S4 验收条文映射

- **Given workspace full runtime is available** — T1.1.4 plugin bridge 测试覆盖 `workspaceRoot` 已知场景，返回 `workspace_full_runtime`。
- **When invoking v6 ops commands** — T1.2.1–T1.2.6 各命令集成测试全 pass。
- **Then each returns structured JSON data** — 所有命令返回 `{ ok: true, data: {...} }`；无 notImplemented 占位。
- **Given host-safe carrier** — T1.1.3 验证 carrier-only 场景诚实报告。
- **Then response truthfully reports unavailable** — carrier path 返回 `runtimeMode:host_safe_carrier`，不伪造 heartbeat_ok。
- **sensitive fields not exposed** — 无 raw prompt / token / credential / 私信正文出现在任何 read model 输出。

---

## 命令汇总

```bash
pnpm build
node --test dist/tests/**/*.test.js
```

`pnpm build` 无 TypeScript error；514 tests pass，0 fail。

---

## 已知边界

- **真实 OpenClaw 宿主 E2E**：上表覆盖的是 plugin bridge 冒烟（进程内模拟），不含真实 OpenClaw 会话中 `second_nature_ops` 工具出现性验证。真实宿主验证须在目标工作区中确认工具表含 `second_nature_ops`（见 `reports/second-nature-ops-tool-visibility-issue-2026-05-06.md`）。
- **redaction**：`StatusV6ReadModel` 不包含 raw prompt/token/credential 字段；redaction 契约由数据模型设计保证，无需运行时过滤。
- **T1.2.3 完整 E2E**：connector_status / connector_test 命令通过 ops router dispatch 路由，功能测试 pass；真实 connector HTTP 调用仍受宿主环境约束。
