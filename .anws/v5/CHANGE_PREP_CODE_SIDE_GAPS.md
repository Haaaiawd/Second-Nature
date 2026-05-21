# /change 准备稿 — SN 代码侧真实缺口（宿主配置除外）

**日期**: 2026-05-11  
**用途**: 进入 `/change` 时的单一事实来源（仅 **仓库内代码/契约**；不含 OpenClaw `tools.profile` / cron `delivery` 等宿主配置）。  
**对照**: 场测结论「daemon、manifest、`registerTool` 正常；卡点主要为 **`tools.profile: coding`** + **`delivery.mode: none`**」——该结论 **不归档为本文件条目**，仅在验收文档中区分归因。

---

## 1. 范围声明

| 类别 | 说明 |
|------|------|
| **本文收录** | 可在 `src/`、`plugin/` 内通过实现或语义修正闭合的问题 |
| **本文不收录** | `tools.allow` / `tools.profile`、`~/.openclaw/cron/jobs.json` 的 delivery、gateway 重启策略等 —— **运维改配置即可** |

---

## 2. 缺口清单（代码侧）

### SN-CODE-01 — Policy CLI：`policy show` 为空壳

| 字段 | 内容 |
|------|------|
| **现象** | `policy` 命令仅 `action === "set"` 走 `policySet`；`show` 返回 `notImplemented` 占位文案 |
| **证据** | `src/cli/commands/index.ts`：`notImplemented("policy")` |
| **插件侧** | `plugin/index.ts` host-safe router 对 policy 同样受限（非 bridge 路径） |
| **建议路由** | `/forge`：实现 `policy` + `action: show`（或等价）与读模型/ActionBridge 对齐 |
| **关联 REQ** | `05_TASKS.md` 中与 policy CLI / operator policy 相关的条目（核对后绑定 ID） |

---

### SN-CODE-02 — Audit CLI：全盘未实现

| 字段 | 内容 |
|------|------|
| **现象** | `audit` 命令恒返回占位 `notImplemented` |
| **证据** | `src/cli/commands/index.ts`：`execute: () => notImplemented("audit")` |
| **备注** | T1.2.5 已为 explain 默认注入空 audit store；**CLI 级 audit 查询**仍缺 |
| **建议路由** | `/forge`：最小闭环 — list/export 或委托现有 `queryExplain` / observability 读路径 |
| **关联 REQ** | [REQ-019] 观测与 explain；对齐 `04_SYSTEM_DESIGN` observability-system |

---

### SN-CODE-03 — `probeHostCapability` 未接入 ops bridge / 路由

| 字段 | 内容 |
|------|------|
| **现象** | `probeHostCapability` 已从 `src/cli/index.ts` **导出**，但 **不可**通过 `createOpsRouter.dispatch`、workspace bridge 白名单调用 |
| **证据** | `src/cli/ops/ops-router.ts`：`dispatch` 仅处理 `heartbeat_check`、`fallback`；未知命令返回 `unknown_ops_command` |
| **证据** | `plugin/index.ts`：`WORKSPACE_BRIDGE_COMMANDS` 无 `probe` / `capability_probe` 等 |
| **证据** | `plugin/workspace-ops-bridge.ts`：仅装配 `createCliCommands` 现有命令 |
| **任务书** | `05_TASKS.md` **T1.2.5** 已写明 bridge **可不**暴露 probe，可选另开任务 |
| **建议路由** | `/change` 立项 + `/forge`：新增 CLI 命令（如 `capability_probe`）+ `dispatch` 分支 +（可选）bridge 白名单 |
| **关联** | INT-S4 explain(`delivery:`) 与宿主 capability 对照 |

---

### SN-CODE-04 — `decision_denied` 被聚合为 **degraded**（语义过激）

| 字段 | 内容 |
|------|------|
| **现象** | 控制面 **deny**（如无候选/硬门禁）经 recorder 写入 **failureClass `decision_denied`** 后，`loadStatus` 将 runtime **serviceStatus** 显示为 **degraded**，易被误读为「故障」而非「暂无可用动作 / 待数据源」 |
| **证据** | `src/observability/services/runtime-decision-recorder.ts`：`isFailureCycle` 含 `denied`；`cycleStatusFailureClass` 对 `denied` 返回 `decision_denied` |
| **证据** | `src/cli/read-models/index.ts`：`mapRuntimeStatus` — 任意 `failureClass` → `degraded` |
| **建议路由** | `/change`：**调整 telemetry/recorder 或 read-model 映射**（例如 `decision_denied` → 非 failure，或单独 `serviceStatus: idle` / `awaiting_sources`）；须补单测防回归 |
| **风险** | 修改后与既有 INT-S2/S3 报告表述对齐；更新 `07_CHALLENGE_REPORT` 若曾将 deny 记为 degraded |

---

### SN-CODE-05 — Connector 执行入口：`heartbeat` 不自动「通电」平台连接器

| 字段 | 内容 |
|------|------|
| **现象** | 无 **`near_real` / `connector_smoke` 类 CLI 或 bridge 子命令**；`runNearRealConnectorSmoke` 存在于 `src/connectors/near-real/near-real-connector-smoke.ts`，主要用于 **集成测** |
| **证据** | `plugin/index.ts`：`WORKSPACE_BRIDGE_COMMANDS` 无 near-real |
| **证据** | `src/core/second-nature/heartbeat/heartbeat-loop.ts`：对 `connector_action` 返回 **`connector_dispatch_unwired`**（诚实未接线），**非**自动执行 Moltbook/EvoMap |
| **任务书** | **T2.2.3** 要求 connector_action **要么**真实 execution attempt **要么**显式 reason —— `connector_dispatch_unwired` 符合「诚实降级」，**不等于已实现连接器调度** |
| **建议路由** | `/change` 若产品需要「一键冒烟」：**新增任务** — CLI + bridge 包装 `runNearRealConnectorSmoke`；更大范围「heartbeat 内联 connector executor」需对照 ADR-002/connector-system **单独评估**（可能超出纯 `/change`） |

---

## 3. 建议处理顺序（仅代码）

1. **SN-CODE-04** — 语义修正影响 operator 读脸，改动面相对集中（recorder + read-model + 测试）。  
2. **SN-CODE-03** — 若 INT-S4 / explain 依赖宿主 capability 同台对照，优先级上调。  
3. **SN-CODE-01 / SN-CODE-02** — 按 PRD 是否承诺「CLI 完整」决定 Wave。  
4. **SN-CODE-05** — 与 connector-system 路线图一致；可先文档化「官方通电路径 = 集成测 smoke / 自建脚本」，再 forge 命令。

---

## 4. `/change` 回流检查（拟）

- [x] `05_TASKS.md`：SN-CODE-01～05 已落为 **T1.2.6～T1.2.9**、**T3.3.2**（`/change` **2026-05-11**；未改已有 `[REQ-*]` 绑定文本）。  
- [x] `06_CHANGELOG.md`：已追加 **2026-05-11** 条目。  
- [ ] `07_CHALLENGE_REPORT.md`：待 **T1.2.9** `/forge` 闭合后更新场测「degraded」误读表述。  
- [x] `AGENTS.md`：已更新「当前任务状态」计数（本 Wave 不由 forge 自动写块）。

---

## 5. 追溯

- 会话结论：宿主侧 **`tools.profile` / `delivery`** 已澄清；本文档 **仅**承接仓库内缺口。  
- 交叉引用：`reports/second-nature-ops-tool-visibility-issue-2026-05-06.md`（工具不可见 —— 归因已更新为 profile 时可加注「参见宿主 OpenClaw 文档」）。
