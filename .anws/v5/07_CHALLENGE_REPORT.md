# Second Nature v5 质疑报告 (Challenge Report)

> **审查日期**: 2026-05-03  
> **审查范围**: `.anws/v5` + `src/` + `plugin/`（CODE 静态审查）  
> **累计轮次**: 13  
> **Round 10 执行**: `/challenge` CODE 脉络审查（宿主 `second_nature_ops` 真实观测 → shipping plugin）；子代理模型 **GPT‑5.4（medium）**，主会话已交叉核对关键 `path:line`。  
> **Round 11**: T1.1.4（插件 workspace 桥）**可行性 + 同类读面对齐**（`/challenge` 静态审查，2026-05-03）。  
> **Round 12**: **文档与任务回流闭合**（`/challenge` 对照 `05_TASKS` / explore / T7.1.1 / 本报告自洽性，2026-05-03）。  
> **Round 13**: **T1.1.4 交付后子代理静态核对**（只读 `explore` 子代理 Composer 2 Fast + 主会话抽样；`/challenge` 2026-05-03）。

---

## 📋 问题总览

> 已解决轮次仅保留摘要。当前活跃轮只保留影响判断的高信号问题。

### 已归档轮次


| 轮次        | 状态     | 摘要                                                                      |
| --------- | ------ | ----------------------------------------------------------------------- |
| Round 1-7 | ✅ 全部修复 | 设计与任务层历史问题已完成回流归档。                                                      |
| Round 8   | ✅ 全部修复 | S3/S4 依赖冲突、source coverage、幂等恢复、delivery proof 与文档 readiness 漂移均已修复并归档。 |


### 第 9 轮（已回流 — 2026-05-03）


| 严重度      | 数量  | 摘要                                                                                                                                                                   | 状态  |
| -------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Critical | 0   | CH-09-01：`dispatch-user-outreach` 已在实现层以 `hasDeliveryProof` 拦截无 proof 的 `sent`；`writeDeliveryAttempt` 校验拒绝无 proof 的 `sent`；集成测 `delivery-failed-fallback.test.ts` 覆盖 | ✅   |
| High     | 0   | CH-09-02：`heartbeatCheck` 在无 `readModels` 时返回 `runtime_carrier_only` + `host_safe_carrier`；有 `readModels` 时仍走 `runHeartbeatCycle`                                    | ✅   |
| High     | 0   | CH-09-03：`credential-vault` 对非密文 `encryptedValue` 改为 fail-fast，不再静默当明文返回                                                                                             | ✅   |
| Medium   | 0   | CH-09-04～06：补 heartbeat 级 Quiet 非空集成测、`ack_dropped`/`hostProofRef` 审计单测、low-value outreach 单测                                                                        | ✅   |
| Low      | 0   | —                                                                                                                                                                    | ✅ 无 |


### 第 10 轮（已回流 — 2026-05-03 / `plugin/index.ts` host-safe surface）


| 严重度      | 数量  | 摘要                                                                                                                                                                                          | 状态  |
| -------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Critical | 0   | —                                                                                                                                                                                           | ✅ 无 |
| High     | 0   | CH-10-01/02：`status`/`quiet`/`report`/`session`/`credential` 在 carrier 上不再 `ok: true` 冒充读模型；`heartbeat_check` 与 `HEARTBEAT.md` 对齐为 `runtime_carrier_only` + `continue_carrier_surface_only` | ✅   |
| Medium   | 0   | CH-10-03：`second_nature_ops` 支持 `workspaceRoot` 工具参数 + `SECOND_NATURE_WORKSPACE_ROOT`，并在 payload 中暴露 `workspaceRootResolution`；CH-10-04：Quiet 等返回 `evaluated: false` + `unavailableReason`  | ✅   |
| Low      | 0   | —                                                                                                                                                                                           | ✅ 无 |


### 第 11 轮（T1.1.4 — CH-11-02 已随实现闭合）


| 严重度      | 数量  | 摘要                                                                                                                             | 状态              |
| -------- | --- | ------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Critical | 0   | —                                                                                                                              | ✅ 无             |
| High     | 0   | —                                                                                                                              | ✅ 无             |
| Medium   | 1   | **CH-11-01**：宿主沙箱内惰性 `import`+sql.js 启动链 **仍无法静态证伪/证实**（INT-S4 / 根已知宿主证据）                                                                 | ⏳ 待 INT-S4      |

> **CH-11-02** ✅ **已闭合**（T1.1.4 实现后）：carrier `explain` 为 `ok: false` + `EXPLAIN_READ_SURFACE_UNAVAILABLE`（`plugin/index.ts:451-468`）；根已知且桥成功时走 `createCliCommands` / `explainSurfaceSubject`。


### 第 12 轮（已回流 — 文档 / 任务回流）


| 严重度      | 数量  | 摘要                                                                                         | 状态                |
| -------- | --- | ------------------------------------------------------------------------------------------ | ----------------- |
| Critical | 0   | —                                                                                          | ✅ 无               |
| High     | 0   | —                                                                                          | ✅ 无               |
| Medium   | 2   | `05_TASKS` T1.1.4 验收未显式承接 `explain`/同类读面（CH-11-02）；新 explore 报告与 T7.1.1 未回流 CH-11 锚点 | ✅ 已回流 `05_TASKS.md`、`reports/t7-1-1-documentation-traceability-checklist.md` |
| Low      | 2   | 本报告旧版「审查摘要」与 Round 11 指标矛盾；human 指南未单列 `explain` carrier 观感（CH-12-03✅ / CH-12-04✅） | 见 CH-12-03 / CH-12-04 |


### 第 13 轮（当前活跃 — 子代理 POST-T1.1.4 核对）


| 严重度      | 数量  | 摘要                                                                                         | 状态     |
| -------- | --- | ------------------------------------------------------------------------------------------ | ------ |
| Critical | 0   | —                                                                                          | ✅ 无    |
| High     | 0   | —                                                                                          | ✅ 无    |
| Medium   | 2   | **CH-11-01** 仍依赖真实宿主；**CH-13-01** 集成测未矩阵化桥接下 `fallback`/`report`/`session`/`credential` 与 **仅 env 根** | ⏳ 验证债 |
| Low      | 1   | **CH-13-02**：`README.md`「根已知 ⇒ full read bridge」运维句仍弱于 `05_TASKS` T1.1.4 输出承诺                                           | ⏳ 可选   |


---

## 📊 审查摘要

**审查模式**: `CODE` + Round 12 文档核对 + **Round 13 子代理静态核对**（`explore` / Composer 2 Fast）  
**整体判断**: 🟢 **无 Critical**；**T1.1.4 已在 `05_TASKS.md` 勾选完成**；🟡 **CH-11-01**（宿主 VM + 惰性加载）与 **CH-13-01**（桥接矩阵集成测缺口）为 **Medium 验证债**；**INT-S4** 仍 ⏳。  
**高信号结论**: **CH-11-02** 已在 **`plugin/index.ts`**（carrier `explain` → `ok: false` + `EXPLAIN_READ_SURFACE_UNAVAILABLE`，约 `451-468`）；读桥见 **`plugin/workspace-ops-bridge.ts`** 与 **`routeSecondNatureCommand`**。下文 Round 12「Code review」中 **carrier `explain` `ok:true` 一句已过时**。


| 指标                        | 数值                          |
| ------------------------- | --------------------------- |
| Critical（活跃）                | 0                           |
| High（活跃）                  | 0                           |
| Medium（活跃，Round 13）      | 2（CH-11-01；CH-13-01）        |
| Low（活跃，Round 13）        | 1（CH-13-02）                 |
| Total Findings（历史 Round 9–10） | 10（均已处理或证伪）                |



| 证据来源            | 结论                                                                                 |
| --------------- | ---------------------------------------------------------------------------------- |
| design-reviewer | Round 13 跳过                                                                 |
| task-reviewer   | Round 13 **轻量**：子代理对照 `05_TASKS` T1.1.4 `[x]` 与验收子集 vs `plugin-workspace-ops-bridge.test.ts` |
| code-reviewer   | Round 13：**子代理只读** + 主会话抽样 `plugin/index.ts`、`workspace-ops-bridge.ts`                    |
| Pre-Mortem      | 无矩阵集成测时，桥接下 **`explain`/`fallback` 等**仍可能在回归中静默漂移                              |
| 承诺闭合检查          | **Partial** — CH-11-02 已闭合；**CH-11-01 / CH-13-01** 仍 Partial                                     |


---

## 🔍 核心发现清单


| ID       | 类别          | 严重度      | 契约/Pass                             | 位置                                                                                                                                                                                    | 发现                                                                                           | 影响                                                        | 建议                                                                                                                               |
| -------- | ----------- | -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| CH-09-01 | 承诺失真        | Critical | Contract Drift / RS-6               | `src/core/second-nature/outreach/dispatch-user-outreach.ts:144`; `src/storage/delivery/write-delivery-attempt.ts:10`; `.anws/v5/05_TASKS.md` T4.3.1                                   | host 返回 `sent` 且缺 `messageId` 时，代码写入占位值 `host_message_id_missing`，绕过 `sent` 必须有真实 proof 的约束。 | 会把“无可验证投递证明”记录成已发送，导致 explain/audit 与真实联系结果分叉。            | `sent` 缺 proof 时改为 `failed`/`not_sent_fallback`；扩展 delivery port 支持 `hostProofRef`；补 sent-without-proof 集成测。                     |
| CH-09-02 | 任务承接 / 契约漂移 | High     | Task Drift / REQ-019                | `src/cli/index.ts:51`; `src/cli/ops/ops-router.ts:27`; `src/cli/ops/heartbeat-surface.ts:78`; `.anws/v5/04_SYSTEM_DESIGN/cli-system.detail.md` §3.5; `.anws/v5/01_PRD.md` US-001      | `heartbeat_check` workspace 主路径仍走 placeholder surface，未接 `controlPlane.runHeartbeatCycle()`。 | 返回 `heartbeat_ok` 但不进入真实 decision loop，造成“看起来正常、实际上没跑闭环”。 | 在 ops router 注入 `ControlPlanePort`，当 runtime 可用时调用 `runHeartbeatCycle` 并映射 `HeartbeatSurfaceResult`；否则显式 `runtime_carrier_only`。 |
| CH-09-03 | 安全边界漂移      | High     | Contract Drift / state-system §3.11 | `src/storage/state-api.ts:142`; `src/storage/services/credential-vault.ts:7`; `src/storage/services/credential-vault.ts:21`; `.anws/v5/04_SYSTEM_DESIGN/state-system.detail.md` §3.11 | state API 凭据写入未强制加密；vault 里存在随机 key fallback 与 decrypt 非法格式直返原文。                             | 凭据保护边界不可证，且若切换到 vault 路径可能出现重启后不可解密/静默数据语义污染。             | 凭据写入统一走 `ensureEncryptedPayload` 等价逻辑；无密钥时 fail-fast；decrypt 非法格式返回显式错误而非原文。                                                     |
| CH-09-04 | 基础测试缺口      | Medium   | Foundational Test Gap / T2.3.3      | `.anws/v5/05_TASKS.md` T2.3.3 验证说明; `src/core/second-nature/quiet/run-source-backed-quiet.ts:81`; `tests/integration/control-plane/heartbeat-quiet-orchestration.test.ts:10`          | 任务要求 Quiet empty/low/sufficient 三路径，但集成测试仅覆盖 empty_state。                                    | Quiet 非空路径回归可能在 heartbeat 编排层静默失效。                        | 新增 heartbeat 级非空 quiet 集成测（至少 low/sufficient 各 1 条）。                                                                             |
| CH-09-05 | 基础测试缺口      | Medium   | Foundational Test Gap / T5.2.1      | `.anws/v5/05_TASKS.md` T5.2.1 验证说明; `src/observability/query/explain-query.ts:50`; `tests/unit/observability/lived-experience-audit.test.ts:48`                                       | 任务要求覆盖 `ack_dropped` 与 `hostProofRef` 相关分类，但现有单测仅覆盖 `messageId` sent 路径。                     | delivery 分类规则变更时可能误把 no-contact 场景当成可见联系。                 | 增补 `ack_dropped` 与 `sent+hostProofRef` 单测。                                                                                       |
| CH-09-06 | 测试承接漂移      | Medium   | Test Drift / T2.3.1                 | `.anws/v5/05_TASKS.md` T2.3.1 验证说明; `src/core/second-nature/outreach/judge-outreach.ts:133`; `tests/unit/core/outreach-judgment.test.ts:98`                                           | 任务声明需覆盖 low-value 分支，但当前未断言 `value_score_too_low`。                                           | value guard 阈值被改坏时测试不报警。                                  | 增加 low-value candidate 用例，断言 deny + `value_score_too_low`。                                                                       |


#### 与 Round 9 的关系（根因去重说明）

- **CH-10-02** 在 CH-09-02（未接 `runHeartbeatCycle`）之上增加 **语义层根因**：同一 payload 同时给出 `**heartbeat_ok` / `HEARTBEAT_OK` / `rhythm.mode: "active"`** 与 `**serviceEntryMode: "runtime_carrier_only"**`，且 `tests/integration/cli/plugin-runtime-registration.test.ts:210-219` **将矛盾组合锁为期望行为**，放大 operator 误判。
- **CH-10-01** 将失真从「心跳单点」扩展到 `**status`/`quiet`/`report`/`session`/`credential` 整组 `ok: true` 占位**（`plugin/index.ts:164-256`、`398-499`），与 `**src/cli/index.ts:48-59**`（`createOpsRouter` + `readModels`）形成 **双轨语义**：CLI 真读、plugin 假形状。
- **CH-10-03 / CH-10-04** 为 workspace 根与 tri-state 合同问题，**不重复** CH-09-01～06 的 delivery/Quiet 编排测试缺口，但与 **US-006 / 观测诚实** 同一价值面。


| ID       | 类别                    | 严重度    | 契约/Pass                           | 位置                                                                                                                                                              | 发现                                                                                                                                                   | 影响                                                                                        | 建议                                                                                                                                               |
| -------- | --------------------- | ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| CH-10-01 | 观测语义 / Contract Drift | High   | Observability Gap / cli-system    | `plugin/index.ts:164-193`; `plugin/index.ts:195-206`; `plugin/index.ts:208-217`; `plugin/index.ts:220-245`; `plugin/index.ts:247-255`; `src/cli/index.ts:48-59` | `status`/`quiet`/`report`/`session`/`credential` 在 **未接 `readModels`/state** 时仍 `**ok: true**` 并返回 **零计数、空列表、空 summary、`connectors: []**` 等“像已读”的形状。 | Operator / 自动化 UI 易误判「workspace 真无数据」；与 PRD「source-backed / 可解释观测」冲突。                     | 要么 plugin 复用打包路径上的 `createOpsRouter`+`readModels`；要么 `**ok: false` 或 envelope**（`surfaceMode: "host_safe_carrier"`, `evaluated: false`），禁止假空读模型。 |
| CH-10-02 | 观测语义 / Test Lock-in   | High   | ADR-005 / US-001 / REQ-019        | `plugin/index.ts:176-182`; `plugin/index.ts:367-393`; `tests/integration/cli/plugin-runtime-registration.test.ts:210-219`                                       | `**heartbeat_ok` + `rhythm.mode: "active"**` 与 `**serviceEntryMode: "runtime_carrier_only"**` 同屏；测试断言前者为真且后者为 carrier-only。                          | 「桥接就绪」被读成「节律活跃 + 心跳健康闭环」；与 carrier-only **不得冒充 full loop** 的叙事对撞。                         | carrier-only 时顶层 `**status` 改为 `runtime_carrier_only**`（或等价），去掉 `**HEARTBEAT_OK`/`heartbeat_ok`/`rhythm.active` 正向组合**；同步修正集成测期望。                |
| CH-10-03 | 运行时前提                 | Medium | Workspace Boundary                | `plugin/index.ts:321-327`; `plugin/index.ts:509-513`                                                                                                            | `createActivationSpine` 中 `startRuntimeService({ workspaceRoot: process.cwd() })`；宿主进程 cwd **常不等于** 用户 workspace。                                    | 一旦 runtime 开始读 artifact/DB，易出现 **假空** 或错写根；与 `storage_smoke` 可显式传 `workspaceRoot` 的事实不对称。 | 从 **host API / 工具入参** 显式注入 `workspaceRoot`；缺失则 `**workspaceRootResolution: "unknown"**` 并拒绝“已读 workspace”类结果。                                    |
| CH-10-04 | API 形状 / 诚实 tri-state | Medium | US-006 / behavioral-guidance 观测边界 | `plugin/index.ts:180-204`                                                                                                                                       | `**mode: "unknown"**` 与 `**sourceCount: 0**` 等同屏，无 `**evaluated`/`surfaceMode`/`unavailableReason**`。                                                | 「未读」与「读了为零」不可分；放大 **unknown vs boolean** 的 UX/契约争议。                                       | 拆分字段：`**evaluated: false**` + reason；`**unknown` 仅保留给“已评估但不确定”`**；零计数不与 unevaluated 混发。                                                          |


---

## 建议行动清单

### P0 - 立即处理 (阻塞)

1. [CH-09-01] 修复 `sent` proof 伪值写入，禁止占位 messageId 冒充真实投递证明。
2. [CH-10-01] / [CH-10-02]（宿主交付面）**禁止**在 `runtime_carrier_only` / 未读模型时返回 **可误读为 lived-experience 真值** 的 `ok: true` 形状；优先 **envelope 降级** 或 **接线真实 `readModels`**，并修正 `plugin-runtime-registration` 期望。

### P1 - 近期处理 (重要)

1. [CH-09-02] 将 `heartbeat_check` workspace 主路径对齐到 `runHeartbeatCycle`。
2. [CH-09-03] 收敛凭据加密边界：强制加密写入、移除随机 key fallback、明确错误语义。
3. [CH-10-03] 替换 `process.cwd()` 默认 workspace 根：改为宿主显式上下文或参数，缺失则诚实不可读。

### P2 - 持续改进 (优化)

1. [CH-09-04] Quiet 非空编排集成测试补齐。
2. [CH-09-05] delivery `ack_dropped` / `hostProofRef` 测试补齐。
3. [CH-09-06] outreach low-value guard 测试补齐。
4. [CH-10-04] Quiet / read-surface tri-state 合同（`evaluated` + reason）与文档/README 对齐。

---

## 🚦 最终判断

- [x] 🟢 **项目可继续**（无未处理 **Critical**；Round 11 Medium 属实现计划内风险，由 T1.1.4 + INT-S4 闭合）
- [ ] 🟡 项目可继续，但需先解决 P0 问题
- [ ] 🔴 项目需要重新评估

**判断依据（更新）**: CH-09-01 在静态复核时 **未发现** `host_message_id_missing` 占位写入路径（以 `hasDeliveryProof` + `writeDeliveryAttempt` 校验为准）；CH-09-02/03 与 CH-10-01～04 已在 2026-05-03 提交中修复并附测试/文档更新。**Round 12**：文档与任务承接缺口已通过更新 `05_TASKS.md`（T1.1.4）与 `reports/t7-1-1-documentation-traceability-checklist.md` 部分闭合。**Round 13**：T1.1.4 **实现已交付**（`05_TASKS` `[x]`）；CH-11-02 **已闭合**；CH-11-01 / CH-13-01 / CH-13-02 见第 13 轮表与下文。

---

## 📚 附录

### A. 承诺闭合与假设验证摘要


| 项目  | 结论   | 证据                                                                                                           | 对应问题 |
| --- | ---- | ------------------------------------------------------------------------------------------------------------ | ---- |
| 重复态 | Pass | 幂等与 effect commit 主逻辑存在且有测试承接。                                                                               | —    |
| 失败态 | Pass | `sent` 无 proof 走 `delivery_unavailable` + `delivery_proof_missing`；DB 层拒绝无 proof 的 `sent`。                   | —    |
| 默认态 | Pass | 无 `readModels` 的 `heartbeatCheck` 显式 `runtime_carrier_only` / `host_safe_carrier`。                           | —    |
| 运行态 | Pass | Quiet 非空 low/sufficient 路径有 `heartbeat-quiet-orchestration` 集成覆盖。                                            | —    |
| 并发态 | Pass | connector 执行策略含并发冲突/重放语义。                                                                                    | —    |
| 观测态 | Pass | `ack_dropped` 计入 `no_user_visible_contact` 警告链；`hostProofRef` 单测；plugin carrier 读表面 `ok: false` + tri-state。 | —    |
| 文档态 | Partial→Pass | Round 12：`05_TASKS` T1.1.4 显式绑定 explain/同类读面；T7 US-001 含 T1.1.4；human 指南 §D7；本报告摘要自洽。 | CH-12-01～04 |
| 文档态 | Partial | Round 13：质疑报告正文已纠偏 CH-11-02；`README` 仍可加强（CH-13-02）。 | CH-13-02 |


### B. ADR 影响追踪


| ADR 文件                                                                      | 引用该 ADR 的 SYSTEM_DESIGN                                                                  | 影响说明                                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [ADR-007](./03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md) | `control-plane-system.md`, `state-system.md`, `observability-system.md`, `cli-system.md` | CH-09-01 / CH-09-05 影响 delivery proof 与 no-contact 语义闭合。                                                 |
| [ADR-005](./03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md)                   | `cli-system.md`, `control-plane-system.md`                                               | CH-09-02 影响 heartbeat 主入口是否真实进入 decision loop；**CH-10-02** 影响 **carrier-only 是否仍被 `HEARTBEAT_OK` 正向冒充**。 |
| [ADR-003](./03_ADR/ADR_003_SECOND_NATURE_GOVERNANCE.md)                     | `state-system.md`, `behavioral-guidance-system.md`, `control-plane-system.md`            | CH-09-04 影响 Quiet source-backed 编排闭环的验证可信度。                                                              |


---

## 第 11 轮 — 核心发现清单（T1.1.4 可行性 & 与 Quiet 同类表面）


| ID       | 类别                    | 严重度    | 位置                                                                                                                           | 发现                                                                                                                                                                                                                                                                                                          | 影响                                                                 | 建议                                                                                                                                                               |
| -------- | --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CH-11-01 | 架构 / 验证缺口             | Medium | `plugin/index.ts:1-22`（边界注释）；`src/cli/index.ts:32-54`；`explore/reports/2026-05-03_openclaw-plugin-quiet-workspace-bridge.md` | **T1.1.4 在架构上可行**：CLI 已具备 `createCliRuntimeDeps` → `createOpsRouter` → `heartbeatCheck(readModels)` → `runHeartbeatCycle`（`src/cli/ops/heartbeat-surface.ts:98-123`、`src/cli/ops/workspace-heartbeat-runner.ts:28-36`）。**风险**在于插件进程内 **惰性加载** 打包图 + **sql.js 异步引导** 是否被 OpenClaw **VM/沙箱**允许 — **纯静态无法闭合**。 | 若沙箱禁止，Plan B（子进程 CLI）成本上升；INT-S4 必须补一条 **根已知** 宿主证据。               | `/forge` 实现 T1.1.4 时先做 **fixture 集成测**，再 **目标 OpenClaw** 冒烟；失败则切子进程方案并回流任务验收。                                                                                    |
| CH-11-02 | 观测语义 / Contract Drift | ~~Medium~~ → **✅ 已闭合** | `plugin/index.ts:409-469`（`buildExplainPayload`）                                                                               | **（历史）** carrier `explain` 曾 `ok: true`。**（当前）** 有效 subject 且未走桥：`ok: false`、`EXPLAIN_READ_SURFACE_UNAVAILABLE`、`workspaceReadModelsEvaluated: false`。根已知且桥成功：`createCliCommands` → `explainSurfaceSubject`。                                                                                        | — | Round 13 归档；本行作时间线。 |


### 与 `quiet` 同类、应在 **同一 workspace 桥** 下对齐的命令（插件 `createHostSafeRouter`）


| 命令                 | 当前 carrier 行为（根 unknown）                                     | 桥接后应对齐的 CLI 读路径（`src/cli/commands/index.ts` 语义）                        | 备注                                                   |
| ------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `status`           | `ok: false` + `WORKSPACE_READ_SURFACE_UNAVAILABLE`           | `readModels.loadStatus(scope)`                                         | ✅ 已与 quiet 同「诚实拒绝」族                                  |
| `quiet`            | `ok: false` + `QUIET_READ_SURFACE_UNAVAILABLE`               | `readModels.loadQuiet(scope)`                                          | T1.1.4 用户诉求核心                                        |
| `report`           | `ok: false` + `REPORT_READ_SURFACE_UNAVAILABLE`              | `readModels.loadDailyReport(day)`                                      | 同族                                                   |
| `session`          | `ok: false` + `SESSION_READ_SURFACE_UNAVAILABLE`             | `readModels.loadSession(sessionId)`                                    | 同族                                                   |
| `credential`（show） | `ok: false` + `CREDENTIAL_READ_SURFACE_UNAVAILABLE`          | `readModels.loadCredential(platformId)`                                | 同族                                                   |
| `fallback`         | `HOST_SAFE_FALLBACK_VIEW_UNAVAILABLE`                        | `showOperatorFallback(ref, readModels)`                                | **同族**（需 DB）                                         |
| `heartbeat_check`  | `runtime_carrier_only` + `livedExperienceLoopClaimed: false` | `opsRouter.heartbeatCheck` / `heartbeatCheck({ readModels })`          | T1.1.4 核心接线点                                         |
| `explain`          | **根 unknown**：`ok: false` + `EXPLAIN_READ_SURFACE_UNAVAILABLE`（`plugin/index.ts:451-468`）；**根已知+桥**：CLI 同路径                          | `explainSurfaceSubject(subject, readModels)`                           | CH-11-02 **已闭合**                                |
| `policy`（show）     | `notImplemented` 泛化 `ok: false`                              | `src/cli/commands/index.ts:55-62` 亦为 `notImplemented("policy")`（与插件一致） | **低优先**：仅文案/错误码显式化；**不等同**于 Quiet 读库缺口               |
| `audit`            | `notImplemented`                                             | `src/cli/commands/index.ts:117-119` 亦为未实现                              | **低优先**：待 T1.2.1 扩展后再谈桥接                             |
| `storage_smoke`    | `ok: true`（独立 smoke）                                         | 非 read model 冒充类                                                       | **不强制** 纳入同一 read-bridge；已通过 `workspaceRoot` 参数对齐物理根 |


**结论（回答用户「方案可行吗」）**: **可行**，且与既有 `**src/cli`** 分解一致；**剩余不确定性**在 **宿主运行时加载**，属 CH-11-01。**与 quiet 同方案**的插件命令上表已列；**勿漏 `explain` / `fallback`**。


---

## 第 12 轮 — 核心发现清单（文档更新完整性 & 漏洞闭环）


| ID       | 类别                       | 严重度    | 契约/Pass                         | 位置                                                                                                                                                                                                                                                              | 发现                                                                                                                                                                                                                                                            | 影响                                                                                    | 建议                                                                                                                                                                                                               |
| -------- | ------------------------ | ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CH-12-01 | 任务承接 / Task Drift      | Medium | T1.1.4 vs CH-11-02              | `.anws/v5/05_TASKS.md` T1.1.4 验收（回流前仅写 `heartbeat_check` + 「约定的 `quiet`/`status`」）                                                                                                                                                                               | **未显式**写 `explain` / `fallback` / `report` / `session` / `credential` 与 CLI 对齐或根 unknown 时与 `status` 同构拒绝；与 CH-11 对照表及 CH-11-02 建议不一致，存在 **实现波次漏面** 风险。                                                                                                                                                       | `/forge` 可能只接线 heartbeat+quiet，carrier 上 `explain` 仍 `ok: true` 冒充半成功。                          | **已回流**：扩展 T1.1.4 验收与输入（见当前 `05_TASKS.md`）。                                                                                                                                                                      |
| CH-12-02 | 回流一致性 / Documentation Drift | Medium | explore → TASKS / changelog / T7 | `explore/reports/2026-05-03_t1-1-4-bridge-prd-feasibility.md`；`06_CHANGELOG.md`（仅记 `openclaw-plugin-quiet-workspace-bridge`）；`reports/t7-1-1-documentation-traceability-checklist.md` US-001 行（回流前 **无 T1.1.4**） | 第二轮 explore（PRD 可达性 / `heartbeat_check` 误判族）**未**进入任务「输入」与追溯清单，**CHANGELOG 未逐条追加**（可接受为轻量省略，但 TASKS/T7 应一致）。                                                                                                                                                          | 新会话只读 TASKS 时 **看不到** CH-11-02 的显式验收锚点来源。                                               | **已回流**：T1.1.4 `输入` + T7 US-001 行；若后续要审计完备，可在 `/change` 中单条追加 `06_CHANGELOG`。                                                                                                                                           |
| CH-12-03 | 元文档 / Self-consistency   | Low    | `07_CHALLENGE_REPORT.md` 自身     | 本文件 `## 📊 审查摘要` 旧版（Round 11 加入后未改）                                                                                                                                                                                                                         | 「Medium 0（活跃）」与 Round 11「Medium 2 ⏳」**自相矛盾**；易让读者误判已无开放 Medium。                                                                                                                                                                                         | 质疑报告作为 **执行真相** 的可信度下降。                                                          | **已修正**（见上文审查摘要与指标表）。                                                                                                                                                                                           |
| CH-12-04 | 验证指南 / Handoff Gap     | Low    | INT-S4 human guide              | `docs/validation/int-s4-human-operator-testing-guide.md` §D7；对话模板第 5 步（`explain` + `subject`）                                                                                                                                                                        | （回流前）未单列 `explain` 的 carrier `ok:true` 陷阱。                                                                                                                                                                                                                  | INT-S4 证据链易缺一角。                                                                         | **已补**：§D7 + 模板；INT-S4 任务验证说明已引用。                                                                                                                                                                                |


### Code review（Round 12，纯静态摘要）— **已过时常态**

- 其中 **「carrier `explain` `ok: true`」** 与当前 `plugin/index.ts` **不符**（以 Round 13 为准）。


### Code review（Round 13，子代理 + 主会话抽样）

- **总结结论**: **Partial Pass** — T1.1.4 **已落地**；**TASKS 验收 vs 集成测矩阵**仍 **Partial**（CH-13-01）。  
- **Lens 1**: carrier `explain` **`ok: false`**（`plugin/index.ts:451-468`）；CH-11-02 **闭合**。  
- **Lens 5**: `tests/integration/cli/plugin-workspace-ops-bridge.test.ts` 覆盖 unknown `explain`、桥接 `heartbeat_check` / `status` / `quiet`；**未**矩阵化桥接下 `fallback` / `report` / `session` / `credential` 与 **仅 `SECOND_NATURE_WORKSPACE_ROOT`**。  
- **Lens 6**: 本文件 CH-11-02 行与 `explain` 对照表 **已更新**；`README.md` 仍弱（CH-13-02）。


## 第 13 轮 — 核心发现清单（子代理 POST-T1.1.4）


| ID       | 类别              | 严重度    | 位置 / 证据                                                                                                                                           | 发现                                                                                                                                     | 影响                          | 建议                                                                                    |
| -------- | --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| CH-13-01 | 验证承接 / Test Drift | Medium | `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`                                                                                         | 桥接矩阵未覆盖 **fallback / report / session / credential** 与 **env 根** 全量断言。                                                                  | 回归静默漂移风险                | P1：每类最小 1 条 + env 根 1 条。                                                     |
| CH-13-02 | 文档回流            | Low    | `README.md`                                                                                                                                        | 「根已知 ⇒ `second_nature_ops` full read bridge」运维句弱于 `05_TASKS` T1.1.4 输出。                                                                                        | 冷启动低估插件能力                  | P2：README current 补一句边界。                                          |
| （继承）     | 架构 / 验证缺口        | Medium | CH-11-01；`plugin/workspace-ops-bridge.ts`                                                                                                            | Plan B 子进程 CLI **未**实现；惰性加载 **仅 INT-S4** 可闭合。                                                                                | 特定宿主桥接失败                  | INT-S4 根已知证据；失败再 `/change` 评 Plan B。 |

