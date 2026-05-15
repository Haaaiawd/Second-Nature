# Second Nature v5 质疑报告 (Challenge Report)

> **审查日期**: 2026-05-10（Round 14 实机质疑回流）；历史轮次见文内  
> **审查范围**: `.anws/v5` + `src/` + `plugin/`；**Round 14** 叠加 **Nyx 实机 v0.1.18 ~29h** + 三路子代理（**Composer 2 Fast**）`/challenge` design review  
> **累计轮次**: 14  
> **Round 10 执行**: `/challenge` CODE 脉络审查（宿主 `second_nature_ops` 真实观测 → shipping plugin）；子代理模型 **GPT‑5.4（medium）**，主会话已交叉核对关键 `path:line`。  
> **Round 11**: T1.1.4（插件 workspace 桥）**可行性 + 同类读面对齐**（`/challenge` 静态审查，2026-05-03）。  
> **Round 12**: **文档与任务回流闭合**（`/challenge` 对照 `05_TASKS` / explore / T7.1.1 / 本报告自洽性，2026-05-03）。  
> **Round 13**: **T1.1.4 交付后子代理静态核对**（只读 `explore` 子代理 Composer 2 Fast + 主会话抽样；`/challenge` 2026-05-03）。  
> **Round 14**: **v0.1.18 长时运行场测**（Nyx，2026-05-10）+ 子代理 A「connector + evidence」/ B「delivery + ops 观测」/ C「Quiet + report + readModels」**设计审查证据层**。

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


### 第 13 轮（已归档 — 子代理 POST-T1.1.4 核对）


| 严重度      | 数量  | 摘要                                                                                         | 状态     |
| -------- | --- | ------------------------------------------------------------------------------------------ | ------ |
| Critical | 0   | —                                                                                          | ✅ 无    |
| High     | 0   | —                                                                                          | ✅ 无    |
| Medium   | 1   | **CH-11-01** 仍依赖真实宿主（惰性 `import` + sql.js 仅 INT-S4 可证）                                                                 | ⏳ INT-S4 |
| Low      | 0   | —                                                                                                                                  | ✅ 无    |

> **CH-13 跟进（2026-05-04 `/forge`）**: **CH-13-01** 已补最小集成矩阵（`fallback` / `report` / `session` / `credential` / `explain` + 子进程 **仅 env 根** `heartbeat_check`）见 `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`。**CH-13-02** 已在 `README.md` §Current 补一句根已知读桥与 INT-S4 边界。


### 第 14 轮（已归档摘要 — v0.1.18 场测 + `/challenge` 三路子代理；**P0 已由 T2.2.2～T1.2.5 `/forge` 闭合**，详见 **第 15 轮**）


| 严重度      | 数量  | 摘要                                                                                                                                     | 状态      |
| -------- | --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Critical | 3   | **CH-14-01** 心跳快照未并入 state 侧 life evidence → 场测「血管无血」；**CH-14-02** 心跳路径未接通 `connector_action` 执行；**CH-14-07** v5 Quiet JSON 写入与 Markdown `daily report` 读面断裂 | ✅ 已由 `src/` + 专用测承接（Round 15 复查）；**CH-14-02** 的 `connector_action` **诚实链**仍见 **CH-15-01** |
| High     | 5   | **CH-14-03** `status.connectors` 为 attempts 子集非注册表；**CH-14-04** `delivery:none` 硬编码 + `status` 缺投递姿态；**CH-14-05** 默认 readModels 未接 `livedExperienceAuditStore`；**CH-14-08** `quiet.mode: unknown` 与 `active` 节律并存误导；**CH-14-09** `quietBias`/UTC 窗口门控致 Quiet 候选可能永不出现 | CH-14-04/05 ✅；CH-14-03 ⏳ **CH-15-04**；CH-14-08/09 ⏳ 仍待后续任务 |
| Medium   | 1   | **CH-14-10** `HEARTBEAT.md` 与「heartbeat-state.json / 主动检查清单」期望落差（bridge 契约 vs 运维想象）                                                                                 | 文档/契约澄清 |
| Low      | 1   | **CH-14-06** `policy`/`audit` CLI 仍为 `notImplemented`（与场测「骨架」一致）                                                                                          | 待排期     |

> **场测来源**: Nyx《Second Nature v0.1.18 — 运行效果与问题分析报告》（2026-05-10，~29h，sql.js，delivery none，isolated session）。**子代理**: 同一仓库只读审查，证据链见 Round 14 详表与代码引用。

### Round 14 — 场测勘误（2026-05-10 Claw 回填，`/change` 已批准回流）

| 原叙述（初报 / 推断） | 实测 / 根因修正 | 对 CH 的影响 |
| --- | --- | --- |
| 长期 `silent_no_candidates`「空转」 | 全量心跳实测 **`intent_selected` + `reasons: []` + `surfaceMode: workspace_full_runtime`**；**maintenance** 过 guard 且无 outreach/quiet dispatch；**observability.db** 持续增长 | **CH-14-01** 仍成立（快照未并入 life evidence），但「空转」应表述为 **「无外部可见效应的 maintenance 回路」**；**T2.2.2** 验收不得硬绑 `silent_no_candidates` |
| `connectors: []` = connector 包未加载 | **未跑** near_real 等；**无** `platformId` ≠ `second-nature-runtime` 的 attempt；与读模型 **telemetry 语义**一致 | **CH-14-03** 强化为「误读纠偏」；**CH-14-02** 仍指向 **dispatch / 诚实 reason** |
| Quiet「写了读不到」canonical 断裂 | 磁盘 **无** `.second-nature/quiet/` → **未写**；断裂假设 **当前现场不适用** | **CH-14-07** 保留为 **一旦 Quiet 运行后** 的读合并风险；**T1.2.4** 验收分 **A 触发写** / **B 已写再读** |
| `delivery: none` 全归 SN | **OpenClaw cron** `delivery.mode: none` 与 SN workspace 快照 **`none`** 并存；bridge **无** probe 命令 | **CH-14-04/05** 仍成立；**T1.2.5** 须能区分 **workspace vs cron** 来源（命名可等价实现） |
| 须依赖 agent 工具表含 `second_nature_ops` | 生产可为 **cron + bridge**；工具不可见 → **Finding** 单列，**不**与 `heartbeat_tool_not_invoked` 混 | **INT-S4** 验证说明已增 **双路径证据**（见 `05_TASKS.md`） |


---

## 📊 审查摘要

**审查模式**: `DESIGN` + **场测对照 `CODE`**（Round 14）；Round 12–13 结论仍有效于「桥/载体」层  
**整体判断**: 🔴 **Round 14 存在未处理 Critical（CH-14-01 / CH-14-02 / CH-14-07）** — 按 `/challenge` **Review Gate**，**不得**在无用户显式豁免下当作「仅 INT-S4」静默穿过；**CH-11-01**（INT-S4 验证债）仍 ⏳。  
**高信号结论**（**已叠加 Claw 勘误**）：初报「**空转 / silent_no_candidates**」应以 **实测 JSON** 为准——常见为 **`intent_selected` + maintenance + `reasons: []` + `workspace_full_runtime`**（**observability 仍在写**）。与「connector 包没进宿主」**仍不**等价：**(1)** `loadSnapshotInputsForWorkspaceHeartbeat` **未**并入 `loadLifeEvidenceSnapshot` → **需 refs 的候选**仍缺输入；**(2)** `resolveAllowedIntentResult` 对 **`connector_action`** / **maintenance** 在缺效应器时易呈 **无外部可见效应**；**(3)** `status.connectors: []` = **无非 runtime attempt**，**非**注册表空。**Quiet**：当前现场 **无** `.second-nature/quiet/` → **未写**，「写了读不到」**暂不适用**；**CH-14-07** 仍防 **Quiet 运行后** 读断裂。下文 Round 14 详表 + **场测勘误**表。


| 指标                        | 数值                          |
| ------------------------- | --------------------------- |
| Critical（活跃，Round 14）       | 3                           |
| High（活跃，Round 14）        | 5                           |
| Medium（活跃，Round 14）      | 1                           |
| Low（活跃，Round 14）        | 1                           |
| Medium（继承，Round 13）      | 1（CH-11-01 / INT-S4）         |
| Total Findings（历史 Round 9–10） | 10（均已处理或证伪）                |



| 证据来源            | 结论                                                                                 |
| --------------- | ---------------------------------------------------------------------------------- |
| design-reviewer | **Round 14 已执行**（三路子代理：connector+evidence / delivery+ops / Quiet+report；证据：PRD US-001、control-plane、connector-system、cli-system、observability、state-system、`workspace-heartbeat-runner.ts`、`heartbeat-loop.ts`、`read-models/index.ts`） |
| task-reviewer   | Round 14 **跳过**（未请求 `05A_TASKS` 任务审查）                                            |
| code-reviewer   | Round 14：**子代理静态** + 场测 JSON 症状交叉验证（非全仓库 diff）                                      |
| Pre-Mortem      | 「**泵在动、对外无感**」= **maintenance 回路** + **快照未接 life evidence（需 refs 路径）** + **connector 无 attempt** + **telemetry 语义误读**；初报 `silent_no_candidates` **已证伪**（见勘误表） |
| 承诺闭合检查          | **Fail（Round 14 视角）** — PRD US-001/US-002 与 control-plane「CONN」分支在 **workspace 心跳路径**上 **未闭合**；operator **REQ-022** 类「为何无联系」在 **delivery none + 默认 explain 线**上 **Partial** |


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

- [ ] 🟢 **项目可继续**（Round 14：**存在未处理 Critical**，Review Gate 默认 **否**）
- [x] 🟡 项目可继续，但需先解决 P0 问题（**Round 14：快照并入 life evidence + 心跳路径接通 connector 执行或显式降级契约 + Quiet 读写 canonical 对齐**；并与 Nyx 场测优先级：**观测面**、**delivery 姿态**、**explain audit 默认接线** 同波或紧随）
- [ ] 🔴 项目需要重新评估

**判断依据（更新）**: CH-09-01 在静态复核时 **未发现** `host_message_id_missing` 占位写入路径（以 `hasDeliveryProof` + `writeDeliveryAttempt` 校验为准）；CH-09-02/03 与 CH-10-01～04 已在 2026-05-03 提交中修复并附测试/文档更新。**Round 12**：文档与任务承接缺口已通过更新 `05_TASKS.md`（T1.1.4）与 `reports/t7-1-1-documentation-traceability-checklist.md` 部分闭合。**Round 13**：T1.1.4 **实现已交付**（`05_TASKS` `[x]`）；CH-11-02 **已闭合**；**CH-13-01/02** 于 2026-05-04 `/forge` 补矩阵测与 README；**CH-11-01** 仍待 INT-S4。**Round 14（2026-05-10）**: 实机 v0.1.18 与代码交叉后，**新增** CH-14-01～10；**在默认 `/forge` 门禁下应先消化 Critical** 再宣称「 lived-experience 场测闭环」。

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
| 文档态 | Pass | Round 13：`README` §Current 已补根已知读桥（CH-13-02 ✅）。 | — |


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
| CH-12-04 | 验证指南 / Handoff Gap     | Low    | INT-S4 human guide              | `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`（J-HOST-01 Step 6：`explain`）；`.anws/v5/05_TASKS.md` INT-S4 验证说明；`reports/int-s4-release-readiness.md`（**已删除** `int-s4-human-operator-testing-guide.md`，SoT 收敛至此）                                                                                                                                                                        | （回流前）未单列 `explain` 的 carrier `ok:true` 陷阱。                                                                                                                                                                                                                  | INT-S4 证据链易缺一角。                                                                         | **已补**：J-HOST 表 + INT-S4 验证说明 + readiness 记录面。                                                                                                                                                                                |


### Code review（Round 12，纯静态摘要）— **已过时常态**

- 其中 **「carrier `explain` `ok: true`」** 与当前 `plugin/index.ts` **不符**（以 Round 13 为准）。


### Code review（Round 13，子代理 + 主会话抽样）

- **总结结论**: **Partial Pass** — T1.1.4 **已落地**；**TASKS 验收 vs 集成测矩阵** 已于 2026-05-04 补 **CH-13-01** 最小覆盖；宿主惰性链仍 **Partial**（CH-11-01 / INT-S4）。  
- **Lens 1**: carrier `explain` **`ok: false`**（`plugin/index.ts:451-468`）；CH-11-02 **闭合**。  
- **Lens 5**: `tests/integration/cli/plugin-workspace-ops-bridge.test.ts` 已覆盖 unknown `explain`、桥接 `heartbeat_check` / `status` / `quiet`、**CH-13-01** 矩阵（`fallback` / `report` / `session` / `credential` / `explain`）与 **env-only** `SECOND_NATURE_WORKSPACE_ROOT` 子进程 `heartbeat_check`（与 Round 13 表 CH-13-01 ✅ 一致）。  
- **Lens 6**: 本文件 CH-11-02 行与 `explain` 对照表 **已更新**；`README.md` Current **已补**（CH-13-02 ✅）。


## 第 13 轮 — 核心发现清单（子代理 POST-T1.1.4）


| ID       | 类别              | 严重度    | 位置 / 证据                                                                                                                                           | 发现                                                                                                                                     | 影响                          | 建议                                                                                    |
| -------- | --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| CH-13-01 | 验证承接 / Test Drift | ~~Medium~~ → **✅** | `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`                                                                                         | **（历史）**矩阵未覆盖。**（当前）** 已补 `fallback`/`report`/`session`/`credential`/`explain` + 子进程 env 根 `heartbeat_check`（2026-05-04）。                                                                  | — | 已闭合 |
| CH-13-02 | 文档回流            | ~~Low~~ → **✅** | `README.md` §Current                                                                                                                                        | **（历史）**运维句偏弱。**（当前）** 已补根已知读桥与 INT-S4 边界一句。                                                                                        | — | 已闭合 |
| （继承）     | 架构 / 验证缺口        | Medium | CH-11-01；`plugin/workspace-ops-bridge.ts`                                                                                                            | Plan B 子进程 CLI **未**实现；惰性加载 **仅 INT-S4** 可闭合。                                                                                | 特定宿主桥接失败                  | INT-S4 根已知证据；失败再 `/change` 评 Plan B。 |


---

## 第 14 轮 — 场测 v0.1.18 与三路子代理 `/challenge`（设计审查证据层）


### 场测症状 → 质疑结论（去重后）


| 场测原文（摘要） | 根因归类（Round 14） | 代表 CH |
| --- | --- | --- |
| Snapshot 全空、~~`silent_no_candidates`~~（**勘误**：实测多为 **`intent_selected`+maintenance**）、`missing_source_refs`（对需 refs 的候选） | **快照未读 state 侧 life evidence**；**maintenance** 可不依赖 refs 过 guard → **对外无可见效应** 与空输入 **并存** | CH-14-01（+ **T2.2.3** 诚实原因） |
| 「connector 未通电」「connectors: []」 | **(A)** 无证据/无 dispatch → 无平台 attempts；**(B)** `loadStatus.connectors` **非** manifest 注册表 | CH-14-02、CH-14-03 |
| `delivery: none`、操作者黑盒 | **`loadSnapshotInputsForWorkspaceHeartbeat` 硬编码 `target: "none"`**；`status` **缺**投递姿态摘要；`livedExperienceAuditStore` 默认未接线 → **`explain` 审计型退化** | CH-14-04、CH-14-05 |
| `quiet.mode: unknown`、Quiet 未触发、daily report 空 | **读模型语义**（`active` → `quiet.mode` 映射为 `unknown`）；**Quiet JSON 与 Markdown report 读路径断裂**；**quietBias + UTC 窗口**可能使 planner **永不**产出 quiet 候选 | CH-14-07、CH-14-08、CH-14-09 |
| `HEARTBEAT.md` 无主动检查 / 无 `heartbeat-state.json` | **宿主 bridge 契约** vs **运维期望**落差（非单点代码 bug） | CH-14-10 |
| `policy` / `explain` / `report`「骨架」 | **`policy`/`audit` `notImplemented`**；report 受 **CH-14-07** 与上游数据双重影响 | CH-14-06、CH-14-07 |


### 核心发现清单（Round 14）


| ID        | 类别           | 严重度      | 契约/Pass                         | 位置（证据入口） | 发现 | 影响 | 建议 |
| --------- | ------------ | -------- | ------------------------------- | ---------- | --- | --- | --- |
| CH-14-01  | 承诺失真 / 运行模拟  | Critical | US-001 / control-plane §4.2–4.3 | `src/cli/ops/workspace-heartbeat-runner.ts`（`loadSnapshotInputsForWorkspaceHeartbeat`）；`loadLifeEvidenceSnapshot` 未在此路径调用 | Workspace 心跳快照 **未**并入 state DB / 索引中的 life evidence → **需 refs 的候选**仍缺输入；**与** **maintenance** 过 guard、**`intent_selected`+空 `reasons`**、**observability 持续写入** **可并存**（Claw 回填） | operator 易误判「全空转」；需 **life evidence 并入** + **无外部效应时诚实 JSON**（见 **T2.2.2**、**T2.2.3**） | 在 `loadSnapshotInputsForWorkspaceHeartbeat` **并入** bounded life-evidence；补集成测；**勿**将初报 `silent_no_candidates` 写死为唯一验收 |
| CH-14-02  | 承诺失真 / 运行模拟  | Critical | US-002 / control-plane CONN 分支 | `src/core/second-nature/heartbeat/heartbeat-loop.ts` `resolveAllowedIntentResult`；`createWorkspaceHeartbeatRunner` deps | **`connector_action`** 允许后 **无** connector-system dispatch；**仅** outreach / quiet 分支有副作用 | 即使快照修复，**心跳仍可能不产生平台读或 execution_attempt** | 接线 **效应器**（或显式 **`intent_selected` + `no_connector_runtime_wired`** 诚实原因）并在 PRD/任务层闭合 **US-002** |
| CH-14-03  | 观测语义         | High     | ADR-002 / connector-system §4   | `src/cli/read-models/index.ts`（`connectors` 来自 `execution_attempts` 的 `find`） | `connectors: []` **≠**「未注册」；常为 **无非 `second-nature-runtime` 的 connector attempt** | 场测误判 **「adapter 未打包」**；与 **T1.2.3 runtime ledger** 写入并存时更易假阴性 | `status` 增加 **inventory**（manifest / 注册凭据）与 **telemetry**（最近 attempt）**分列**；或文档+JSON schema 明确 **`connectors` 语义** |
| CH-14-04  | 运行契约 / 观测      | High     | ADR-007 / cli-system REQ-022    | `workspace-heartbeat-runner.ts` `deliveryCapability: { target: "none" }`；`loadStatus` 无投递姿态块 | **合成 `none`** 与 **宿主实测 `none`** 在 operator 视角 **不可分** | `delivery: none` 时 **诚实**与 **可解释** 不同；场测「黑盒」 | `status` 增加 `deliveryPosture`（`source: workspace_default_none \| host_probe \| …`）；有机会时并入 **probeHostCapability** |
| CH-14-05  | 承诺失真 / 观测      | High     | observability §5.1 / cli G2     | `src/cli/index.ts` `createCliReadModels({ stateDb, observabilityDb })`；`read-models/index.ts` audit store 提示路径 | 默认路径 **未**注入 `livedExperienceAuditStore` → **`explain`** 对 `decision:`/`delivery:`/`fallback:` **退化** | 场测「explain 骨架」与 **审计闭环叙事** 不一致 | 默认接线 **audit store**（或等价只读投影），并保持 **host-safe** 红acted |
| CH-14-06  | 工程缺口         | Low      | cli-system / REQ-026            | `src/cli/commands/index.ts` `policy` 非 `set`、`audit` → `notImplemented` | 与场测「policy 骨架」一致 | 运维面无法 **只读**审计索引 | 最小 **`policy show` / `audit` 只读切片**（计数/最近 id） |
| CH-14-07  | 承诺失真 / 集成      | Critical | PRD REQ-024 / state-system Quiet | `run-source-backed-quiet` + `persist-quiet-artifact`（JSON）；`loadDailyReport` / `quiet-input-loader`（Markdown） | **写入 canonical（JSON）** 与 **读取 canonical（Markdown）** **不一致**（**Claw**：当前现场 **无** `.second-nature/quiet/` → **未写**，断裂假设 **暂不适用**；**一旦 Quiet 运行** 仍须防此裂口） | **Quiet 已跑仍 `report` 空** 可与 **P0 连接器** 独立复现 | read model **合并**两源或 **单一 canonical**；**T1.2.4** 分 A/B 验收 |
| CH-14-08  | 观测语义         | High     | ADR-003 / status 聚合            | `read-models/index.ts` `quietMode` 映射；`runtime-decision-recorder` 默认 `active` | **`rhythm.mode: active`** 可与 **`quiet.mode: unknown`** 同屏 | 误判 **「从未进入 Quiet」** | 拆分 **节律顶层** / **Quiet 内务窗口** / **产物存在性**；或映射规则显式区分 `active` |
| CH-14-09  | 运行模拟         | High     | US-003 / ADR-003                | `intent-planner.ts` `planQuietReflectionIntents`；`planner-rhythm-window` / `policy-bridge` UTC | **`quietBias`** 与 **UTC 内置窗口** 下，本地时段可能 **永不**触发 quiet 候选 | 场测「Quiet mode 未触发」**部分**为 **门控/时区** 而非仅无证据 | 时区从 policy/state **拉出**；文档说明默认窗口；集成测覆盖非 UTC |
| CH-14-10  | 文档契约         | Medium   | ADR-005 / HEARTBEAT.md          | `HEARTBEAT.md`；INT-S4 人类指南 | 场测期望 **结构化 `heartbeat-state.json`** 与当前 **TOOL bridge 契约** 不一致 | 非代码缺陷但 **放大黑盒感** | 在 README / 验证指南中 **显式列出「本桥不承诺的文件面」** 或 **新增可选 artifact**（需 `/change` 决策） |


### Round 14 — 子代理设计审查发现 ID 对照


| 子代理主题 | 代理内 ID | 映射 CH |
| --- | --- | --- |
| Connector + evidence | DR-C1～C5 | CH-14-01～03（C4 并入 CH-14-04） |
| Delivery + ops 观测 | DR-D1～D6 | CH-14-04、CH-14-05、CH-14-06 |
| Quiet + report + readModels | DR-Q1～Q7 | CH-14-07～10（Q3/Q6 并入表内叙述） |


### Round 14 — 建议行动（与场测「修复优先级」对齐）


**P0（阻塞 lived-experience 场测意义）**

1. **[CH-14-01]** 心跳快照 **读入** life evidence / continuity（bounded），消灭「DB 有证据、快照恒空」。
2. **[CH-14-02]** 为 **`connector_action`** 提供 **真实 dispatch** 或 **显式不可执行** 的 JSON 原因链（禁止长期 **无效应 `intent_selected`**）。
3. **[CH-14-07]** **统一 Quiet 工件的读 canonical**（JSON ↔ Markdown 或单一源）。

**P1**

4. **[CH-14-03]** 澄清或拆分 **`status.connectors`** 语义，避免 `[]` 被读成「未安装」。
5. **[CH-14-04]** `status` / `heartbeat_check` 增加 **delivery posture**（含 `workspace_default_none` 来源）。
6. **[CH-14-05]** 默认 **`livedExperienceAuditStore`** 接线，闭合 **`explain`** 审计型路径。
7. **[CH-14-08]、[CH-14-09]** 修正 **quiet 聚合语义** 与 **时区/quietBias** 可解释性。

**P2**

8. **[CH-14-06]** 只读 **`policy` / `audit`** 最小实现。
9. **[CH-14-10]** 文档与验证路径对齐 **HEARTBEAT bridge** 承诺边界。

---

## 第 15 轮（2026-05-10 — `/forge` 后静态复查：T2.2.2～T1.2.5 + 报告/任务表同步）

> **触发**: 另一会话宣称 **T2.2.2 / T2.2.3 / T1.2.4 / T1.2.5** 已全部交付；本回合按 `/challenge` **CODE + 设计抽查**（纯静态；全量 `pnpm test` 未在本机重跑）。

### 第 15 轮 — 问题总览

| 严重度 | 数量 | 摘要 | 状态 |
|--------|------|------|------|
| Critical | 0 | Round 14 三项 P0（CH-14-01/02/07）在 `src/` 侧已有对应实现与专用测文件承接 | ✅ 静态闭合（**INT-S4 宿主债 CH-11-01 仍 ⏳**） |
| High | 0 | — | — |
| Medium | 3 | **CH-15-01** `connector_action` 仍可为 `intent_selected` + **空 `reasons`**（与 `05_TASKS` T2.2.3 字面验收「禁止空 reasons 冒充已执行」存在 **任务—实现—单测** 三处收窄）；**CH-15-02** `deliveryPosture.source` 类型含 `openclaw_cron_delivery_none` / `host_capability_probe` 但 **`loadStatus` 默认恒为 `workspace_default_none`**；**CH-15-03** T1.2.4 仍写 **`quietEnabledBridge` ← `status.quiet.mode`**（`workspace-heartbeat-runner.ts:50`），与任务「不得长期错误依赖」存在 **残留张力** | ⏳ 建议 `/change` 收窄任务措辞或补实现 |
| Low | 2 | **CH-15-04** T2.2.3 产出要求「文档或 JSON 注释」澄清 `status.connectors` 语义 — **`read-models/index.ts` 内未见就近注释**（CH-14-03 误读风险仍部分存在）；**CH-15-05** `05_TASKS.md` 契约映射表（约 L946–L1017）仍标 **⏳** 与已 `[x]` 任务 **不一致** | 文档同步 |

### 第 15 轮 — 审查摘要

**审查模式**: `CODE` + 设计契约 **抽查**（对照 `05_TASKS.md` 与 Round 14 CH）  
**整体判断**: 🟢 **可继续 INT-S4 / 后续 forge** — 无新的静态 **Critical**；**Medium** 为「验收字面 vs 实现选项」与 **文档漂移**，不复制 Round 14 的「未并入 life evidence」假阳性。

| 证据来源 | 结论 |
|----------|------|
| code-reviewer（本会话） | **Partial Pass**：`loadLifeEvidenceSnapshot` 已接入 `loadSnapshotInputsForWorkspaceHeartbeat`（`workspace-heartbeat-runner.ts:58-87`）；`internal_tick` 已入 `resolveAllowedIntentResult`（`heartbeat-loop.ts:114-122`）；Quiet 工件 FS 合并入 `loadQuiet`/`loadDailyReport`（`read-models/index.ts:128-395`）；`deliveryPosture` + 默认 `AppendOnlyAuditStore`（`read-models/index.ts:195-318`、`447-469`）。 |
| design-reviewer | **抽查**：控制面 / 读模型边界与 Round 14 设计叙述 **基本一致**；残留为 **投递姿态多来源** 与 **connector 读面注释** 的工程闭合度。 |
| 与 Round 14 关系 | **CH-14-01** ↔ T2.2.2 实现+`tests/integration/cli/t2-2-2-snapshot-life-evidence.test.ts`；**CH-14-07** ↔ T1.2.4+`t1-2-4-quiet-report-read-canonical.test.ts`；**CH-14-04/05** ↔ T1.2.5+`t1-2-5-status-delivery-posture-audit-store.test.ts`；**CH-14-02** ↔ `internal_tick` + **CH-15-01**（`connector_action` 空 reasons 仍存）。 |

### 第 15 轮 — 核心发现清单

| ID | 类别 | 严重度 | 位置 | 发现 | 影响 | 建议 |
|----|------|--------|------|------|------|------|
| CH-15-01 | 任务—测试—实现三角 | Medium | `heartbeat-loop.ts:110-122`；`tests/unit/core/t2-2-3-connector-action-honest-result.test.ts:117-139`；`05_TASKS.md` T2.2.3 验收 | **`connector_action`** 在无 dispatch 时仍返回 **`reasons: []`**；单测 **D** 显式将此举固化为期望（「本次不强制 internal_tick」），与任务正文「**禁止**长期 `intent_selected` + 空 reasons」**字面冲突** | Operator 仍可能把「未执行 connector」读成「无输出已成功」 | **`/change`** 二选一：收窄任务验收为「允许空 + 文档化」；或实现稳定 **`reasonCodes`**（如 `connector_dispatch_unwired`）并改测 |
| CH-15-02 | 契约 Partial | Medium | `read-models/index.ts:311-318`；`types.ts:56-70`；`05_TASKS.md` T1.2.5 | **`DeliveryPosture.source`** 枚举含 cron/probe，但 **`loadStatus` 默认只产出 `workspace_default_none`** | 与任务「区分 workspace vs OpenClaw cron」**仅部分闭合**（类型就绪、观测未接） | `/change` 标注「宿主未暴露配置时恒为 workspace 默认」或接 **probe / 配置入口** |
| CH-15-03 | 任务残留张力 | Medium | `workspace-heartbeat-runner.ts:48-50` | **`quietEnabledBridge`** 仍绑定 **`status.quiet.mode === "quiet"`** | 与 T1.2.4 文字「**不得长期错误依赖**」并存；在 **`quiet.mode` 长期 `unknown`** 时可能 **低估** quiet 窗口 | 读模型侧修聚合 **或** 快照桥用 **ledger/window** 替代该桥；并 `/change` 对齐验收 |
| CH-15-04 | 回流 / CH-14-03 | Low | `read-models/index.ts:239-274`（`latestConnectorAttempt` / `connectorSummary`） | **未见** T2.2.3 要求的就近 **「`connectors` = 最近非 runtime attempt，非 manifest」** 注释 | 运维仍易误读 `connectors: []` | README 或 **StatusReadModel** JSDoc / schema 补一句 |
| CH-15-05 | 文档一致性 | Low | `05_TASKS.md` ~L946–L1017 | 契约覆盖表仍写 **⏳ T2.2.2…T1.2.5** 与正文 **`[x]`** 矛盾 | 新会话误判未交付 | `/change` 或 `/forge` settle 时 **整表同步** |

### 第 15 轮 — 建议行动

1. **P2**：更新 **`05_TASKS.md`** 契约映射表与 Sprint 覆盖行，使之与 **`[x]`** 一致。
2. **P2**：`/change` 消化 **CH-15-01**（改任务或改代码，**禁止**长期三角不一致）。
3. **P3**：补 **CH-15-04** 注释；评估 **CH-15-02**/**CH-15-03** 是否另开任务或在 INT-S4 记 Finding。

