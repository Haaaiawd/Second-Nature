# Second Nature v6 质疑报告

> 审查日期: 2026-05-16  
> TARGET_DIR: `.anws/v6`，按 `.anws/` 下最大数字版本定位。  
> REVIEW_MODE: CODE  
> 审查范围: v6 Waves 24-26 已勾选实现，重点覆盖 T3.1.2、T1.3.1、T5.1.3、T1.2.3、T3.2.1、T2.1.4、T6.1.1、T2.1.5。  
> 静态边界: code-reviewer 部分不把运行结果写成静态事实；`pnpm test` 作为独立运行验证记录。  
> sequential-thinking: 已用 `sthink` audit session `v6-code-challenge` 完成 5-step Pre-Mortem。

---

## 问题总览

| ID | 严重度 | 类别 | 发现 | 状态 |
| --- | --- | --- | --- | --- |
| CH-V6-01..08 / DR3-01 / DR5-01..03 / DR6-01 | Critical-High-Medium | 历史 design/tasks 审查 | 旧轮次发现已通过 Round 2-6 回流，当前不再展开详细审查。 | Archived |
| CR7-01 | High | Task Fulfillment / Contract Drift | `connector init` 已标记完成，但实现只生成 `manifest.yaml`，且目标已存在时返回 `ok:true skipped`，不符合 adapter/types 与失败语义。 | **Resolved** — connectorInit 现生成 manifest.yaml + adapter.ts + types.ts；目标已存在返回 ok:false + reason 含 force；T1.3.1 测试断言三文件存在 + fail-closed |
| CR7-02 | High | Trust Boundary / Acceptance Gap | `connector_test` 对 pending-trust / non-executable connector 返回 `ok:true`，没有按 T1.2.3 返回 denied/pending_trust。 | **Resolved** — connectorTest 对 executable=false 返回 ok:false + PENDING_TRUST_DENIED；T1.2.3 测试含 pending-trust fixture 断言 denied envelope |

---

## 审查摘要

| 项目 | 结论 | 证据 |
| --- | --- | --- |
| 定位架构版本 | Pass | `.anws/` 中最大数字版本为 `v6` |
| REVIEW_MODE | CODE | 用户明确要求 `/challenge` 调用 code review 检查 v6 变更能否跑通 |
| Code review | Partial Pass | 已覆盖 code-reviewer Lens 1-6；发现 2 个 High 级实现侧契约漂移 |
| 运行验证 | Pass | `pnpm test` 通过: build、plugin package build、Node test 均成功，433/433 pass |
| 工作树副作用 | Noted | `pnpm test` 的 `build:plugin` 重新生成 `plugin/runtime/**`，这些是验证产物，不是手写修复 |

### 证据来源

| 类型 | 来源 |
| --- | --- |
| 产品/架构/设计契约 | `.anws/v6/01_PRD.md`、`02_ARCHITECTURE_OVERVIEW.md`、`03_ADR/*`、`04_SYSTEM_DESIGN/*` |
| 任务与验证契约 | `.anws/v6/05A_TASKS.md`、`.anws/v6/05B_VERIFICATION_PLAN.md` |
| 实现代码 | `src/cli/commands/*`、`src/cli/ops/ops-router.ts`、`src/core/second-nature/**`、`src/guidance/**`、`src/observability/**` |
| 测试证据 | `tests/unit/cli/*`、`tests/unit/control-plane/*`、`tests/unit/guidance/*`、`tests/unit/observability/*`、`pnpm test` |

---

## 规范来源与承诺模型

| 类型 | 摘要 | 来源 | 失真风险 |
| --- | --- | --- | --- |
| 结果承诺 | `connector init` 生成 connector 骨架: manifest、adapter stub、types stub。 | `.anws/v6/05A_TASKS.md:233-242` | 只生成 manifest 会让 SDK 入口不可用但测试仍绿 |
| 错误承诺 | 目标文件存在且未显式 overwrite 时命令失败并保留用户文件。 | `.anws/v6/05A_TASKS.md:246-248` | `ok:true skipped` 会把失败语义伪装成成功 |
| 安全承诺 | pending-trust connector 执行 `connector:test` 返回 denied/pending_trust 且不触发副作用。 | `.anws/v6/05A_TASKS.md:145-150` | 非可信 connector 被操作面展示为测试成功 |
| 运行承诺 | `connector:test` 默认 dry-run，connector init/status/test 走 typed ops surface。 | `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:246-248`, `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:408-412` | 外部副作用与 operator 判断语义混淆 |
| 验证承诺 | T1.2.3/T1.3.1 测试覆盖 pending trust、no-overwrite、path safety 与生成物。 | `.anws/v6/05B_VERIFICATION_PLAN.md:63-118` | 测试覆盖跟实现一起偏离验收文本 |

---

## Pre-Mortem

| 失败原因 | 失真契约 | Root Cause | 证据 | 概率 |
| --- | --- | --- | --- | --- |
| 自动化全绿但 v6 connector SDK 无法按任务验收使用。 | T1.3.1 输出与错误语义 | 测试只断言 manifest，未断言 adapter/types 与 failure status。 | `src/cli/commands/connector-init.ts:113-121`, `tests/unit/cli/t1-3-1-connector-init.test.ts:22-41`, `tests/unit/cli/t1-3-1-connector-init.test.ts:46-61` | High |
| operator 对 pending-trust connector 执行 test 得到成功 envelope。 | ConnectorTrustPolicy / T1.2.3 | 实现把 non-executable 写入 healthChecks 后仍返回 `ok:true`。 | `src/cli/commands/connector-status.ts:150-162` | High |
| S1/S4 冒烟报告误判 connector ops surface 已闭合。 | Verification traceability | 05B 期望 pending trust 与生成骨架，但单测没有覆盖对应断言。 | `.anws/v6/05B_VERIFICATION_PLAN.md:63-118` | Medium |

---

## Code Review

### 总结结论

Pass。CR7-01（connector init 三文件生成 + fail-closed）和 CR7-02（connector test pending-trust denied）已修复并通过测试。v6 Waves 24-26 契约兑现已收敛。

### 审查范围与静态边界

已读: `src/cli/commands/connector-init.ts`、`src/cli/commands/connector-status.ts`、`src/cli/ops/ops-router.ts`、`src/cli/commands/index.ts`、`src/core/second-nature/heartbeat/heartbeat-loop.ts`、`src/core/second-nature/orchestrator/goal-priority.ts`、`src/core/second-nature/orchestrator/narrative-update.ts`、`src/guidance/draft-narrative-outreach.ts`、`src/observability/connector-inventory-ledger.ts` 与对应测试。  
未确认: 真实 OpenClaw 宿主会话、真实外部 connector 网络、真实 connector live side effect；这些必须由 INT-S4 / 手动宿主验证承接。  
故意未执行: code-reviewer 静态段不执行外部服务或 Docker；运行验证仅执行项目本地 `pnpm test`。

### 契约到代码映射摘要

| 承诺 | 实现区域 | 结论 |
| --- | --- | --- |
| CapabilityContractRegistry namespace + v5 parity | `src/connectors/base/*`, `tests/unit/connectors/t3-1-2-*`, `t3-2-1-*` | 基本闭合 |
| connector init CLI | `src/cli/commands/connector-init.ts`, `src/cli/ops/ops-router.ts`, `src/cli/commands/index.ts` | High gap |
| connector status/test | `src/cli/commands/connector-status.ts`, `src/cli/ops/ops-router.ts` | High gap |
| ConnectorInventoryAudit | `src/observability/connector-inventory-ledger.ts`, `tests/unit/observability/connector-inventory-ledger.test.ts` | 基本闭合 |
| Goal-directed planning | `src/core/second-nature/orchestrator/goal-priority.ts`, `heartbeat-loop.ts` | 基本闭合 |
| Narrative update after heartbeat | `src/core/second-nature/orchestrator/narrative-update.ts`, `heartbeat-loop.ts` | 基本闭合 |
| Narrative outreach draft | `src/guidance/draft-narrative-outreach.ts`, `tests/unit/guidance/t6-1-1-narrative-outreach.test.ts` | 基本闭合 |

### Lens 结果摘要

| Lens | 结论 | 证据 |
| --- | --- | --- |
| L1 Contract Fidelity | Partial | `connector_init` 与 `connector_test` 的公共语义偏离 05A/cli-system |
| L2 Task Fulfillment | Partial | T1.3.1 与 T1.2.3 已勾选但验收文本未完全兑现 |
| L3 Architecture Fit | Pass | 变更总体沿 CLI ops/router、connector registry、control-plane、guidance 分层接线 |
| L4 Runtime Risk from Static Evidence | Partial | pending trust 仍不触发副作用，但 `ok:true` 语义会误导 operator |
| L5 Verification Evidence | Partial | `pnpm test` 全绿，但相关单测断言低于 05A/05B 验收标准 |
| L6 Backflow & Handoff | Partial | 05A/05B 写得比实现和测试更强，需通过 `/change` 或 `/forge` 回流修正 |

### Issues

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
| --- | --- | --- | --- | --- | --- | --- |
| High | L1+L2+L5 | `connector init` 只生成 manifest 且把 no-overwrite 返回成成功。 | `src/cli/commands/connector-init.ts:113-121`; `src/cli/commands/connector-init.ts:102-110`; `tests/unit/cli/t1-3-1-connector-init.test.ts:22-41`; `tests/unit/cli/t1-3-1-connector-init.test.ts:46-61` | T1.3.1 被标记完成但 SDK 骨架和错误语义未兑现，自动化会给出 false positive。 | 生成 `adapter.ts` 和 `types.ts`，目标存在时返回 `ok:false` 或明确 failure code，并补对应断言。 | `.anws/v6/05A_TASKS.md:233-248`; `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:248`; `.anws/v6/04_SYSTEM_DESIGN/connector-system.md:495` |
| High | L1+L4+L5 | `connector_test` 对 pending-trust connector 返回 `ok:true` 而不是 denied/pending_trust。 | `src/cli/commands/connector-status.ts:144-162`; `src/cli/commands/connector-status.ts:173-175`; `tests/unit/cli/t1-2-3-connector-status.test.ts:92-147` | 未可信 connector 不会执行副作用，但 ops surface 会把不可执行 connector 包装成测试成功。 | 当 `entry.executable=false` 或 trustStatus 为 pending 时返回 denied envelope，并补 pending-trust fixture 测试。 | `.anws/v6/05A_TASKS.md:135-153`; `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:247`; `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:408-412` |

### 安全 / 测试覆盖补充

| 项目 | 结论 | 说明 |
| --- | --- | --- |
| connector live side effect | Cannot Confirm | 本轮未连接外部平台，真实 side-effect 路径仍需 INT-S1/INT-S4 的宿主与 connector smoke。 |
| pending trust execution | Partial | 静态证据显示未执行副作用，但返回 envelope 不是 denied/pending_trust。 |
| generated plugin runtime | Pass with side effect | `pnpm test` 生成 `plugin/runtime/**` 并通过 package verification；这些文件出现在 git status 中。 |
| v5 regression | Automated Pass | `pnpm test` 覆盖现有 433 个测试，未出现 v5 回归失败。 |

---

## 运行验证

| 命令 | 结果 | 关键信号 |
| --- | --- | --- |
| `pnpm test` | Pass | `pnpm build` 成功，`pnpm build:plugin` 成功，`node --test dist/tests/**/*.test.js` 433/433 pass |

---

## 承诺闭合验证

| 维度 | 结论 | 证据 | 对应问题 |
| --- | --- | --- | --- |
| 重复态 | Pass | connector init no-overwrite 保留文件，但返回语义不符合失败契约。 | CR7-01 |
| 失败态 | Partial | existing manifest 与 pending trust 都有路径，但 envelope 与 05A 不一致。 | CR7-01, CR7-02 |
| 默认态 | Partial | connector init 默认 pending trust，connector test 默认 dry-run；pending trust denied 缺失。 | CR7-02 |
| 运行态 | Pass | 自动化 build/test 当前可跑通。 | 无 |
| 并发态 | Not Applicable | 本轮 Wave 24-26 审查未发现新并发协议改动。 | 无 |
| 观测态 | Partial | connector status/test 可见，但 pending trust 的机器语义不够强。 | CR7-02 |
| 安全边界 | Partial | 没看到自动执行 workspace custom adapter，但 operator-facing success 语义削弱 trust boundary。 | CR7-02 |
| 验证责任 | Partial | 测试覆盖数量充足，但 T1.2.3/T1.3.1 的关键验收断言缺失。 | CR7-01, CR7-02 |

---

## 建议行动

| 优先级 | 行动 | 完成信号 |
| --- | --- | --- |
| P1 | 通过 `/forge` 修复 CR7-01，让 `connector init` 生成 manifest、adapter、types，并把 no-overwrite 改成失败 envelope。 | 新增或更新 T1.3.1 测试断言三个文件存在，existing target 返回失败且文件未变。 |
| P1 | 通过 `/forge` 修复 CR7-02，让 pending-trust/non-executable connector test 返回 denied/pending_trust。 | T1.2.3 测试含 pending-trust fixture，断言 `ok:false` 或等价 denied envelope 且无副作用。 |
| P2 | 修复后重新运行 `pnpm test` 并复查 git status 中 `plugin/runtime/**` 是否需要纳入交付。 | build/test 仍为全绿，生成 runtime 与源代码行为一致。 |

---

## 最终判断

当前仓库自动化可以跑通: `pnpm test` 已通过，433/433 tests pass。

CR7-01 和 CR7-02 已修复并通过测试验证（436/436 pass）。本轮 CODE `/challenge` 的 High 级契约漂移已全部收敛，v6 Waves 24-26 可按契约签收。
