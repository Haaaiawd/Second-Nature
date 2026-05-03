# Second Nature v5 质疑报告 (Challenge Report)

> **审查日期**: 2026-05-03  
> **审查范围**: `.anws/v5` + `src/` + `plugin/`（CODE 静态审查）  
> **累计轮次**: 10  
> **Round 10 执行**: `/challenge` CODE 脉络审查（宿主 `second_nature_ops` 真实观测 → shipping plugin）；子代理模型 **GPT‑5.4（medium）**，主会话已交叉核对关键 `path:line`。

---

## 📋 问题总览

> 已解决轮次仅保留摘要。当前活跃轮只保留影响判断的高信号问题。

### 已归档轮次

| 轮次 | 状态 | 摘要 |
| --- | --- | --- |
| Round 1-7 | ✅ 全部修复 | 设计与任务层历史问题已完成回流归档。 |
| Round 8 | ✅ 全部修复 | S3/S4 依赖冲突、source coverage、幂等恢复、delivery proof 与文档 readiness 漂移均已修复并归档。 |

### 第 9 轮（已回流 — 2026-05-03）

| 严重度 | 数量 | 摘要 | 状态 |
| --- | ---: | --- | --- |
| Critical | 0 | CH-09-01：`dispatch-user-outreach` 已在实现层以 `hasDeliveryProof` 拦截无 proof 的 `sent`；`writeDeliveryAttempt` 校验拒绝无 proof 的 `sent`；集成测 `delivery-failed-fallback.test.ts` 覆盖 | ✅ |
| High | 0 | CH-09-02：`heartbeatCheck` 在无 `readModels` 时返回 `runtime_carrier_only` + `host_safe_carrier`；有 `readModels` 时仍走 `runHeartbeatCycle` | ✅ |
| High | 0 | CH-09-03：`credential-vault` 对非密文 `encryptedValue` 改为 fail-fast，不再静默当明文返回 | ✅ |
| Medium | 0 | CH-09-04～06：补 heartbeat 级 Quiet 非空集成测、`ack_dropped`/`hostProofRef` 审计单测、low-value outreach 单测 | ✅ |
| Low | 0 | — | ✅ 无 |

### 第 10 轮（已回流 — 2026-05-03 / `plugin/index.ts` host-safe surface）

| 严重度 | 数量 | 摘要 | 状态 |
| --- | ---: | --- | --- |
| Critical | 0 | — | ✅ 无 |
| High | 0 | CH-10-01/02：`status`/`quiet`/`report`/`session`/`credential` 在 carrier 上不再 `ok: true` 冒充读模型；`heartbeat_check` 与 `HEARTBEAT.md` 对齐为 `runtime_carrier_only` + `continue_carrier_surface_only` | ✅ |
| Medium | 0 | CH-10-03：`second_nature_ops` 支持 `workspaceRoot` 工具参数 + `SECOND_NATURE_WORKSPACE_ROOT`，并在 payload 中暴露 `workspaceRootResolution`；CH-10-04：Quiet 等返回 `evaluated: false` + `unavailableReason` | ✅ |
| Low | 0 | — | ✅ 无 |

---

## 📊 审查摘要

**审查模式**: `CODE`  
**整体判断**: 🟢 本轮所列实现项已按建议回流（2026-05-03）  
**高信号结论（历史快照）**: 原报告指出的占位 `sent`、无 `readModels` 时误报 `heartbeat_ok`、宿主 plugin 假读模型与 carrier-only 语义对撞等问题已在当前 `src/` + `plugin/index.ts` 中逐项闭合；详见下方 Remediation 与各 CH 行内「状态」列。

| 指标 | 数值 |
| --- | ---: |
| Critical | 0（活跃） |
| High | 0（活跃） |
| Medium | 0（活跃） |
| Low | 0 |
| Total Findings（原 Round 9–10） | 10（均已处理或证伪） |

| 证据来源 | 结论 |
| --- | --- |
| design-reviewer | 跳过（本轮仅执行 CODE） |
| task-reviewer | 跳过（以契约映射为锚点做静态交叉核验） |
| code-reviewer | 执行（纯静态、未跑项目/测试、未改实现代码）；Round 10 含 **GPT‑5.4（medium）** 子代理 + 主会话行号核对 |
| Pre-Mortem | 若继续推进，将优先暴露“假 sent 成功、假 heartbeat 闭环、**宿主 ops 假读模型**、测试误覆盖”四条失败链 |
| 承诺闭合检查 | **Pass（实现回流后）** — 失败态、carrier-only 观测态与测试承接已对齐本轮修复 |

---

## 🔍 核心发现清单

| ID | 类别 | 严重度 | 契约/Pass | 位置 | 发现 | 影响 | 建议 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CH-09-01 | 承诺失真 | Critical | Contract Drift / RS-6 | `src/core/second-nature/outreach/dispatch-user-outreach.ts:144`; `src/storage/delivery/write-delivery-attempt.ts:10`; `.anws/v5/05_TASKS.md` T4.3.1 | host 返回 `sent` 且缺 `messageId` 时，代码写入占位值 `host_message_id_missing`，绕过 `sent` 必须有真实 proof 的约束。 | 会把“无可验证投递证明”记录成已发送，导致 explain/audit 与真实联系结果分叉。 | `sent` 缺 proof 时改为 `failed`/`not_sent_fallback`；扩展 delivery port 支持 `hostProofRef`；补 sent-without-proof 集成测。 |
| CH-09-02 | 任务承接 / 契约漂移 | High | Task Drift / REQ-019 | `src/cli/index.ts:51`; `src/cli/ops/ops-router.ts:27`; `src/cli/ops/heartbeat-surface.ts:78`; `.anws/v5/04_SYSTEM_DESIGN/cli-system.detail.md` §3.5; `.anws/v5/01_PRD.md` US-001 | `heartbeat_check` workspace 主路径仍走 placeholder surface，未接 `controlPlane.runHeartbeatCycle()`。 | 返回 `heartbeat_ok` 但不进入真实 decision loop，造成“看起来正常、实际上没跑闭环”。 | 在 ops router 注入 `ControlPlanePort`，当 runtime 可用时调用 `runHeartbeatCycle` 并映射 `HeartbeatSurfaceResult`；否则显式 `runtime_carrier_only`。 |
| CH-09-03 | 安全边界漂移 | High | Contract Drift / state-system §3.11 | `src/storage/state-api.ts:142`; `src/storage/services/credential-vault.ts:7`; `src/storage/services/credential-vault.ts:21`; `.anws/v5/04_SYSTEM_DESIGN/state-system.detail.md` §3.11 | state API 凭据写入未强制加密；vault 里存在随机 key fallback 与 decrypt 非法格式直返原文。 | 凭据保护边界不可证，且若切换到 vault 路径可能出现重启后不可解密/静默数据语义污染。 | 凭据写入统一走 `ensureEncryptedPayload` 等价逻辑；无密钥时 fail-fast；decrypt 非法格式返回显式错误而非原文。 |
| CH-09-04 | 基础测试缺口 | Medium | Foundational Test Gap / T2.3.3 | `.anws/v5/05_TASKS.md` T2.3.3 验证说明; `src/core/second-nature/quiet/run-source-backed-quiet.ts:81`; `tests/integration/control-plane/heartbeat-quiet-orchestration.test.ts:10` | 任务要求 Quiet empty/low/sufficient 三路径，但集成测试仅覆盖 empty_state。 | Quiet 非空路径回归可能在 heartbeat 编排层静默失效。 | 新增 heartbeat 级非空 quiet 集成测（至少 low/sufficient 各 1 条）。 |
| CH-09-05 | 基础测试缺口 | Medium | Foundational Test Gap / T5.2.1 | `.anws/v5/05_TASKS.md` T5.2.1 验证说明; `src/observability/query/explain-query.ts:50`; `tests/unit/observability/lived-experience-audit.test.ts:48` | 任务要求覆盖 `ack_dropped` 与 `hostProofRef` 相关分类，但现有单测仅覆盖 `messageId` sent 路径。 | delivery 分类规则变更时可能误把 no-contact 场景当成可见联系。 | 增补 `ack_dropped` 与 `sent+hostProofRef` 单测。 |
| CH-09-06 | 测试承接漂移 | Medium | Test Drift / T2.3.1 | `.anws/v5/05_TASKS.md` T2.3.1 验证说明; `src/core/second-nature/outreach/judge-outreach.ts:133`; `tests/unit/core/outreach-judgment.test.ts:98` | 任务声明需覆盖 low-value 分支，但当前未断言 `value_score_too_low`。 | value guard 阈值被改坏时测试不报警。 | 增加 low-value candidate 用例，断言 deny + `value_score_too_low`。 |

#### 与 Round 9 的关系（根因去重说明）

- **CH-10-02** 在 CH-09-02（未接 `runHeartbeatCycle`）之上增加 **语义层根因**：同一 payload 同时给出 **`heartbeat_ok` / `HEARTBEAT_OK` / `rhythm.mode: "active"`** 与 **`serviceEntryMode: "runtime_carrier_only"`**，且 `tests/integration/cli/plugin-runtime-registration.test.ts:210-219` **将矛盾组合锁为期望行为**，放大 operator 误判。
- **CH-10-01** 将失真从「心跳单点」扩展到 **`status`/`quiet`/`report`/`session`/`credential` 整组 `ok: true` 占位**（`plugin/index.ts:164-256`、`398-499`），与 **`src/cli/index.ts:48-59`**（`createOpsRouter` + `readModels`）形成 **双轨语义**：CLI 真读、plugin 假形状。
- **CH-10-03 / CH-10-04** 为 workspace 根与 tri-state 合同问题，**不重复** CH-09-01～06 的 delivery/Quiet 编排测试缺口，但与 **US-006 / 观测诚实** 同一价值面。

| ID | 类别 | 严重度 | 契约/Pass | 位置 | 发现 | 影响 | 建议 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CH-10-01 | 观测语义 / Contract Drift | High | Observability Gap / cli-system | `plugin/index.ts:164-193`; `plugin/index.ts:195-206`; `plugin/index.ts:208-217`; `plugin/index.ts:220-245`; `plugin/index.ts:247-255`; `src/cli/index.ts:48-59` | `status`/`quiet`/`report`/`session`/`credential` 在 **未接 `readModels`/state** 时仍 **`ok: true`** 并返回 **零计数、空列表、空 summary、`connectors: []`** 等“像已读”的形状。 | Operator / 自动化 UI 易误判「workspace 真无数据」；与 PRD「source-backed / 可解释观测」冲突。 | 要么 plugin 复用打包路径上的 `createOpsRouter`+`readModels`；要么 **`ok: false` 或 envelope**（`surfaceMode: "host_safe_carrier"`, `evaluated: false`），禁止假空读模型。 |
| CH-10-02 | 观测语义 / Test Lock-in | High | ADR-005 / US-001 / REQ-019 | `plugin/index.ts:176-182`; `plugin/index.ts:367-393`; `tests/integration/cli/plugin-runtime-registration.test.ts:210-219` | **`heartbeat_ok` + `rhythm.mode: "active"`** 与 **`serviceEntryMode: "runtime_carrier_only"`** 同屏；测试断言前者为真且后者为 carrier-only。 | 「桥接就绪」被读成「节律活跃 + 心跳健康闭环」；与 carrier-only **不得冒充 full loop** 的叙事对撞。 | carrier-only 时顶层 **`status` 改为 `runtime_carrier_only`**（或等价），去掉 **`HEARTBEAT_OK`/`heartbeat_ok`/`rhythm.active` 正向组合**；同步修正集成测期望。 |
| CH-10-03 | 运行时前提 | Medium | Workspace Boundary | `plugin/index.ts:321-327`; `plugin/index.ts:509-513` | `createActivationSpine` 中 `startRuntimeService({ workspaceRoot: process.cwd() })`；宿主进程 cwd **常不等于** 用户 workspace。 | 一旦 runtime 开始读 artifact/DB，易出现 **假空** 或错写根；与 `storage_smoke` 可显式传 `workspaceRoot` 的事实不对称。 | 从 **host API / 工具入参** 显式注入 `workspaceRoot`；缺失则 **`workspaceRootResolution: "unknown"`** 并拒绝“已读 workspace”类结果。 |
| CH-10-04 | API 形状 / 诚实 tri-state | Medium | US-006 / behavioral-guidance 观测边界 | `plugin/index.ts:180-204` | **`mode: "unknown"`** 与 **`sourceCount: 0`** 等同屏，无 **`evaluated`/`surfaceMode`/`unavailableReason`**。 | 「未读」与「读了为零」不可分；放大 **unknown vs boolean** 的 UX/契约争议。 | 拆分字段：**`evaluated: false`** + reason；**`unknown` 仅保留给“已评估但不确定”`**；零计数不与 unevaluated 混发。 |

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

- [x] 🟢 项目可继续，风险可控（针对本报告 Round 9–10 所列 CODE 项；真实宿主 INT-S4 仍以任务与发布门禁为准）
- [ ] 🟡 项目可继续，但需先解决 P0 问题
- [ ] 🔴 项目需要重新评估

**判断依据（更新）**: CH-09-01 在静态复核时 **未发现** `host_message_id_missing` 占位写入路径（以 `hasDeliveryProof` + `writeDeliveryAttempt` 校验为准）；CH-09-02/03 与 CH-10-01～04 已在 2026-05-03 提交中修复并附测试/文档更新。

---

## 📚 附录

### A. 承诺闭合与假设验证摘要

| 项目 | 结论 | 证据 | 对应问题 |
| --- | --- | --- | --- |
| 重复态 | Pass | 幂等与 effect commit 主逻辑存在且有测试承接。 | — |
| 失败态 | Pass | `sent` 无 proof 走 `delivery_unavailable` + `delivery_proof_missing`；DB 层拒绝无 proof 的 `sent`。 | — |
| 默认态 | Pass | 无 `readModels` 的 `heartbeatCheck` 显式 `runtime_carrier_only` / `host_safe_carrier`。 | — |
| 运行态 | Pass | Quiet 非空 low/sufficient 路径有 `heartbeat-quiet-orchestration` 集成覆盖。 | — |
| 并发态 | Pass | connector 执行策略含并发冲突/重放语义。 | — |
| 观测态 | Pass | `ack_dropped` 计入 `no_user_visible_contact` 警告链；`hostProofRef` 单测；plugin carrier 读表面 `ok: false` + tri-state。 | — |

### B. ADR 影响追踪

| ADR 文件 | 引用该 ADR 的 SYSTEM_DESIGN | 影响说明 |
| --- | --- | --- |
| [ADR-007](./03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md) | `control-plane-system.md`, `state-system.md`, `observability-system.md`, `cli-system.md` | CH-09-01 / CH-09-05 影响 delivery proof 与 no-contact 语义闭合。 |
| [ADR-005](./03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md) | `cli-system.md`, `control-plane-system.md` | CH-09-02 影响 heartbeat 主入口是否真实进入 decision loop；**CH-10-02** 影响 **carrier-only 是否仍被 `HEARTBEAT_OK` 正向冒充**。 |
| [ADR-003](./03_ADR/ADR_003_SECOND_NATURE_GOVERNANCE.md) | `state-system.md`, `behavioral-guidance-system.md`, `control-plane-system.md` | CH-09-04 影响 Quiet source-backed 编排闭环的验证可信度。 |
