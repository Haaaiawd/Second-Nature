# Second Nature v6 E2E 测试导航

> **版本**: 0.1.25
> **日期**: 2026-05-18
> **用途**: 交给 OpenClaw 宿主在真实会话中执行的验证项
> **目标**: 验证 PRD v6.0 的 7 个 Goals + 6 个 REQ 是否全部达成
> **提交反馈方式**: 逐项填写「实际结果」与「判定」，回传至 `.anws/v6/09_E2E_FEEDBACK.md`

---

## 如何开始

1. 确保宿主已安装 `@haaaiawd/second-nature@0.1.25`
2. 确保宿主有一个已知的 workspaceRoot（含 `.second-nature/` 目录）
3. 以下命令均通过 `second_nature_ops` 工具调用
4. 每项填写：实际结果 → 判定（PASS / PARTIAL_PASS / FAIL）
5. 最后一行写整体结论

---

## A. 插件加载验证（启动时自动发生）

| # | 检查项 | 预期行为 | 实际结果 | 判定 |
|---|--------|---------|---------|------|
| A1 | 插件 register() 无报错 | 控制台出现 `[second-nature] register() completed` | | |
| A2 | `second_nature_ops` 出现在会话工具表 | 工具列表包含 `second_nature_ops` | | |
| A3 | 插件版本正确 | `@haaaiawd/second-nature@0.1.25` | | |

---

## B. PRD Goal 验证（按 User Story 分组）

### B1. REQ-001 / G1 — Dream 异步记忆整理

> **PRD 验收**: Given platform evidence + session chronicle + memory store 存在，When Dream 运行完成，Then 输出新 memory store，含去重、洞察、narrative/relationship 更新。

| # | 命令 | 输入 | 预期输出 | 实际结果 | 判定 |
|---|------|------|---------|---------|------|
| B1.1 | `dream:recent` | `{ action: "dream:recent" }` | `ok:true`，`totalRuns` ≥ 0；如有记录则每条含 `lifecycleStatus`（completed/partial）、`insightsCount`、`fallbackReason` | | |
| B1.2 | `dream:recent` (limit) | `{ action: "dream:recent", limit: 2 }` | 返回不超过 2 条，按时间倒序 | | |
| B1.3 | `status` → dream section | `{ action: "status" }` | `data.dream` 字段存在：`has_runs` 或 `nothing_yet`，不伪造 | | |

**关键断言**: Dream 输出不含无法追溯到 evidence 的虚构 claim；空输入时返回诚实空态而非编造。

---

### B2. REQ-002 / G2 — Agent 自我叙事与目标追求

> **PRD 验收**: Given heartbeat 执行后，When narrative state 更新，Then narrative 包含 focus、progress、nextIntent；Given 设定 goal，When intent planning，Then 相关 intent 优先级提升。

| # | 命令 | 输入 | 预期输出 | 实际结果 | 判定 |
|---|------|------|---------|---------|------|
| B2.1 | `narrative` | `{ action: "narrative" }` | `ok:true`，含 `focus`、`progress`、`nextIntent`、`groundingStatus`（pass/degraded/blocked/nothing_yet） | | |
| B2.2 | `goal set` | `{ action: "goal", subAction: "set", description: "完善 EvoMap profile", criteria: "profile 100%" }` | `ok:true`，goal 写入为 `proposal` 状态 | | |
| B2.3 | `goal list` | `{ action: "goal", subAction: "list" }` | 列表含刚写入的 goal，status=`proposal`，origin=`owner_set` | | |
| B2.4 | `goal accept` | `{ action: "goal", subAction: "accept", goalId: "<上一步的id>" }` | status 变为 `accepted` | | |
| B2.5 | `status` → narrative section | `{ action: "status" }` | `data.narrative` 含 `focus`、`groundingStatus`、`sourceRefCount` | | |
| B2.6 | `cycle:recent` | `{ action: "cycle:recent" }` | 聚合 bucket 含 `dimensions`（decision/narrative/dream/delivery/connector） | | |

**关键断言**: goal 为 `proposal` 时不影响 intent planning；`accepted` 后才参与优先级。narrative 不含无法追溯到 source 的 claim。

---

### B3. REQ-003 / G3 — 与 owner 的关系记忆

> **PRD 验收**: Given owner 回复 outreach，When session chronicle 记录，Then relationship memory 更新（语气/时机/话题）；Given 下次 outreach，When relationship memory 影响语气，Then 语气与历史一致。

| # | 命令 | 输入 | 预期输出 | 实际结果 | 判定 |
|---|------|------|---------|---------|------|
| B3.1 | `narrative` → relationship context | `{ action: "narrative" }` | 如有 relationship memory，可在 explain 中体现；直接 `narrative` 命令返回 narrative state | | |
| B3.2 | `explain subject:relationship` | `{ action: "explain", subject: "relationship" }` | 返回结构化关系摘要或 `EXPLAIN_READ_SURFACE_UNAVAILABLE` | | |

**关键断言**: outreach draft（如有触发）包含来由，不是纯通知。关系记忆在无回复时标记 `no_reply`，不编造偏好。

---

### B4. REQ-004 / G5 — Connector Ecosystem 动态扩展

> **PRD 验收**: Given manifest 放入约定目录，When SN 启动/重载，Then connector 出现在 registry，capability 可被 route planner 识别。

| # | 命令 | 输入 | 预期输出 | 实际结果 | 判定 |
|---|------|------|---------|---------|------|
| B4.1 | `connector_status` | `{ action: "connector_status" }` | `ok:true`，`connectors` 数组含所有已注册 connector（内置 + 动态），每条含 `platformId`、`source`、`trustStatus`、`executable` | | |
| B4.2 | `connector_test` (executable) | `{ action: "connector_test", platformId: "moltbook" }` | `ok:true`，`healthChecks` 含 "ok"，默认 dry-run | | |
| B4.3 | `connector_test` (pending-trust) | `{ action: "connector_test", platformId: "agent-world" }` | `ok:false`，`error.code` = `PENDING_TRUST_DENIED` | | |
| B4.4 | `connector_init` | `{ action: "connector_init", platformId: "test-e2e-plat", runnerKind: "custom_adapter" }` | `ok:true`，生成 manifest + adapter + types 文件 | | |
| B4.5 | `connector_status` (after init) | `{ action: "connector_status" }` | 新 connector 出现，`trustStatus` = `custom_adapter_pending_trust`，`executable=false` | | |

**关键断言**: custom adapter 必须 `executable=false`，不得自动执行。pending-trust connector 调用 test 返回 denied。

---

### B5. REQ-005 / G6 — Outreach 有叙事来由的三层投递

> **PRD 验收**: Given evidence 与 narrative/interest/relationship 匹配，When outreach judgment 通过，Then draft 包含"发生了什么、为什么感兴趣"；Given 无实质发现，Then 静默。

| # | 命令 | 输入 | 预期输出 | 实际结果 | 判定 |
|---|------|------|---------|---------|------|
| B5.1 | `status` → narrative 片段 | `{ action: "status" }` | `data.narrative` 含 `focus`，作为 outreach 来由基础 | | |
| B5.2 | `quiet` | `{ action: "quiet" }` | `ok:true`，返回 reflection 结果或 `nothing_yet`；不伪造 outreach | | |
| B5.3 | `explain subject:outreach` | `{ action: "explain", subject: "outreach" }` | 返回 outreach 决策历史或 `no_matching_audit_events` | | |

**关键断言**: 无 evidence 匹配时，heartbeat 静默，不推送通知。delivery 不可用时写入的 fallback 也有叙事来由。

---

### B6. REQ-006 / G7 — 可观测性消费（人类能看到 SN）

> **PRD 验收**: Given observability.db 有记录，When 运行 `sn status` / `sn dream:recent`，Then 输出人类可读。

| # | 命令 | 输入 | 预期输出 | 实际结果 | 判定 |
|---|------|------|---------|---------|------|
| B6.1 | `status` | `{ action: "status" }` | `ok:true`，`data` 含四 section：`runtime`、`narrative`、`dream`、`cycles`；无原始 db row 泄漏 | | |
| B6.2 | `dream:recent` | `{ action: "dream:recent", limit: 3 }` | `ok:true`，`runs` 数组含 `traceId`、`runId`、`durationMs`、`lifecycleStatus`、`insightsCount` | | |
| B6.3 | `narrative` | `{ action: "narrative" }` | `ok:true`，`focus`、`progress`、`nextIntent`、`groundingStatus` 可读 | | |
| B6.4 | `cycle:recent` | `{ action: "cycle:recent", limit: 5 }` | `ok:true`，`cycles` 按小时聚合，`dimensions` 标记存在维度 | | |
| B6.5 | `goal` | `{ action: "goal", subAction: "list" }` | `ok:true`，`goals` 数组含 `goalId`、`description`、`status`、`origin`、`risk` | | |

**关键断言**: 无记录时返回 `nothing_yet`，不返回空对象 `{}`。无敏感信息泄漏（凭据、私信正文、raw prompt）。

---

## C. 安全边界验证

| # | 检查项 | 验证方法 | 预期 | 实际结果 | 判定 |
|---|--------|---------|------|---------|------|
| C1 | pending-trust connector 不被执行 | `connector_test` platformId=`agent-world` | `ok:false` + `PENDING_TRUST_DENIED` | | |
| C2 | connector:init 不覆盖已有文件 | 对同一 platformId 再次 init | `ok:false`，reason 含 "force" | | |
| C3 | connector:init 生成物不被自动信任 | init 后 `connector_status` | `executable=false` + `custom_adapter_pending_trust` | | |
| C4 | connector:init 路径不逃逸 | platformId 含 `..` 或 `/` | `ok:false` + path safety denied | | |
| C5 | carrier 模式不伪造数据 | 无 workspaceRoot 时调用 `status` / `narrative` | `runtime_carrier_only` 或 `HOST_SAFE_*_UNAVAILABLE` | | |
| C6 | 无敏感数据泄漏 | 检查 `status` / `narrative` / `goal` 输出 | 不含凭据、token、私信正文 | | |

---

## D. 回归验证（v5 非退化）

| # | 命令 | 输入 | 预期 | 实际结果 | 判定 |
|---|------|------|------|---------|------|
| D1 | `heartbeat_check` (full runtime) | `{ action: "heartbeat_check" }` + workspaceRoot | `ok:true`，`status` = `heartbeat_ok` 或 `intent_selected` | | |
| D2 | `heartbeat_check` (carrier-only) | `{ action: "heartbeat_check" }`（无 workspaceRoot） | `ok:true`，`status` = `runtime_carrier_only`，不伪造决策 | | |
| D3 | `explain` | `{ action: "explain", subject: "probe:basic" }` | 返回结构化解释或 `EXPLAIN_READ_SURFACE_UNAVAILABLE` | | |
| D4 | `quiet` | `{ action: "quiet" }` | `ok:true`，返回 source count 或 nothing_yet | | |
| D5 | `storage_smoke` | `{ action: "storage_smoke" }` | `ok:true`，sql.js 语义验证通过 | | |

---

## E. 整体结论

| 维度 | 结论 |
|------|------|
| PRD G1 (Dream) | |
| PRD G2 (Narrative/Goal) | |
| PRD G3 (Relationship) | |
| PRD G4 (Goal-directed planning) | |
| PRD G5 (Connector Ecosystem) | |
| PRD G6 (Outreach) | |
| PRD G7 (Observability) | |
| 安全边界 | |
| v5 回归 | |

**整体判定**: [ ] 全部达成  [ ] 大部分达成，有遗留  [ ] 未达成

**遗留问题**（如有）:

```
1.
2.
3.
```

**测试者**: _____________  **日期**: _____________
