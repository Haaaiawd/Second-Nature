# Second Nature v6 质疑报告

> 审查日期: 2026-05-18  
> TARGET_DIR: `.anws/v6`，按 `.anws/` 下最大数字版本定位。  
> REVIEW_MODE: CODE  
> 审查范围: v6 已宣称完成后的实现侧静态审查，重点覆盖 `cli-system` / OpenClaw `second_nature_ops`、Goal priority、NarrativeTrace、05A/05B 回流一致性。  
> 静态边界: 本轮遵循 code-reviewer 纯静态边界，未启动项目、未执行测试、未连接真实 OpenClaw 宿主或外部 connector。  
> sequential-thinking: 已用 `sthink` audit session `v6-full-code-challenge-2026-05-18` 完成 5-step Pre-Mortem。

---

## 问题总览

| ID | 严重度 | 类别 | 发现 | 状态 |
| --- | --- | --- | --- | --- |
| CH-V6-01..08 / DR3-01 / DR5-01..03 / DR6-01 / CR7-01..02 | Critical-High-Medium | 历史 design/tasks/code 审查 | 旧轮次发现已通过后续 Round / Wave 回流，本轮不再展开旧详情。 | Archived |
| CR8-01 | Critical | L1+L2+L6 Contract Drift | `second_nature_ops` 的宿主路由和 workspace bridge allowlist 都没有纳入 v6 ops 命令，OpenClaw 工具面无法调用 `narrative`、`goal`、`dream:recent`、`connector_*`、`cycle:recent` 或 `status:v6`。 | Open |
| CR8-02 | High | L1+L5 Acceptance Gap | T1.2.6 契约写的是 `sn status` / `second_nature_ops status` v6 aggregate，但实现和测试把 v6 聚合放在 `status:v6`，`status` 仍走旧 `loadStatus()`。 | Open |
| CR8-03 | High | L1+L4 Agent Self Governance Drift | policy allowlist 接受后的 agent-proposed goal 仍被 priority 过滤，NarrativeTrace 的 `goalInfluenceRefs` 又从 source refs 派生而不是从 candidate goal refs 派生。 | Open |
| CR8-04 | Medium | L6 Handoff Gap | `AGENTS.md` 与 milestone reports 宣称 T2.3.1、T5.1.2、INT-S1 已完成，但 05A source of truth 仍保留未勾选状态。 | Open |

---

## 审查摘要

| 项目 | 结论 | 证据 |
| --- | --- | --- |
| 定位架构版本 | Pass | `.anws/` 下最大数字版本为 `v6`。 |
| REVIEW_MODE | CODE | 用户明确要求 `/challenge` 以 code review 检查当前 v6 是否存在问题。 |
| Code review | Fail | 发现 1 个 Critical、2 个 High、1 个 Medium；v6 不能按当前证据签收为完整完成。 |
| 运行验证 | Not Run | code-reviewer 硬边界要求纯静态，本轮未执行 `pnpm test`。 |
| 下游门禁 | Blocked | Critical 未闭合前，不建议宣称 v6 release/host readiness 完成。 |

### 证据来源

| 类型 | 来源 |
| --- | --- |
| 产品/架构/设计契约 | `.anws/v6/01_PRD.md`、`02_ARCHITECTURE_OVERVIEW.md`、`03_ADR/*`、`04_SYSTEM_DESIGN/*` |
| 任务与验证契约 | `.anws/v6/05A_TASKS.md`、`.anws/v6/05B_VERIFICATION_PLAN.md` |
| 实现代码 | `plugin/index.ts`、`plugin/workspace-ops-bridge.ts`、`src/cli/commands/index.ts`、`src/cli/ops/ops-router.ts`、`src/core/second-nature/orchestrator/goal-priority.ts`、`src/core/second-nature/heartbeat/heartbeat-loop.ts` |
| 测试与报告 | `tests/integration/cli/t1-2-6-status-aggregate.test.ts`、`tests/integration/observability/heartbeat-narrative-trace.test.ts`、`reports/int-s*.md`、`AGENTS.md` |

---

## 规范来源与承诺模型

| 类型 | 摘要 | 来源 | 失真风险 |
| --- | --- | --- | --- |
| 结果承诺 | owner 可通过 `sn status` / `second_nature_ops status` 看到 v6 narrative、Dream、connector、cycle 与 runtime 聚合。 | `.anws/v6/05A_TASKS.md:207`, `.anws/v6/05A_TASKS.md:210-216`, `.anws/v6/05B_VERIFICATION_PLAN.md:96-104` | v6 聚合存在但挂在非契约命令名上，验收测试形成 false positive。 |
| 运行承诺 | `cli-system` 维护 CLI 与 `second_nature_ops` 的同构 command router，并暴露 v6 新命令。 | `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:43-58`, `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:75-79` | OpenClaw 工具面看不到 v6 命令，INT-S4 host readiness 不成立。 |
| 授权承诺 | proposal 默认不影响 priority；低风险、有完成标准、通过 policy allowlist 后才可影响 intent priority。 | `.anws/v6/01_PRD.md:91-98`, `.anws/v6/03_ADR/ADR_003_AGENT_SELF_LAYER.md:48-49` | 被 policy 接受的 agent proposal 仍不会影响 planning，Agent Self Layer 的目标追求被静默削弱。 |
| 审计承诺 | NarrativeTrace 记录 `goalInfluenceRefs`、source coverage、unsupportedClaims 与 groundingStatus。 | `.anws/v6/05A_TASKS.md:539-548`, `.anws/v6/04_SYSTEM_DESIGN/observability-system.detail.md:100-112` | trace 中 goal causality 与实际 priority boost 脱钩，explain/audit 无法复述为什么选中某 intent。 |
| 回流承诺 | 05A/05B 是 `/forge` 与 `/challenge` 的活动 source of truth。 | `AGENTS.md:18-24`, `.anws/v6/05A_TASKS.md:722-734` | 报告宣称完成但 source of truth 未完成，后续工作流入口会误判状态。 |

---

## Pre-Mortem

| 失败原因 | 失真契约 | Root Cause | 证据 | 概率 |
| --- | --- | --- | --- | --- |
| v6 发布后 owner 在 OpenClaw 调用 `second_nature_ops narrative` 或 `goal` 得到 unknown command。 | JSON-first ops surface / INT-S4 | host-safe router 先校验自身命令表，且 bridge allowlist 未包含 v6 命令。 | `plugin/index.ts:182-198`, `plugin/index.ts:744-882`, `plugin/index.ts:1165-1185` | High |
| `sn status` 仍显示旧 status，v6 aggregate 只有知道隐藏命名 `status:v6` 的测试能看到。 | T1.2.6 | 实现新增并测试 `status:v6`，没有升级契约命令 `status`。 | `src/cli/commands/index.ts:54-63`, `src/cli/commands/index.ts:343-350`, `tests/integration/cli/t1-2-6-status-aggregate.test.ts:1-8` | High |
| policy allowlist 接受 agent-proposed goal 后，heartbeat 仍不按该 accepted goal 提升 priority。 | US-002 / ADR-003 | priority filter 同时要求 `status=accepted` 与 `origin != agent_proposed`，而 transition 不改变 origin。 | `src/core/second-nature/orchestrator/goal-priority.ts:52-54`, `src/storage/goal/agent-goal-store.ts:159-167`, `tests/unit/storage/t4-1-4-agent-goal.test.ts:55-74` | High |
| NarrativeTrace 看似记录 goal refs，但实际记录的是 selected intent 的 source refs。 | T5.1.2 | trace emitter 使用 `selectedIntent.sourceRefs.map(id)`，测试只检查数组类型。 | `src/core/second-nature/heartbeat/heartbeat-loop.ts:219-237`, `src/core/second-nature/types.ts:58-59`, `tests/integration/observability/heartbeat-narrative-trace.test.ts:58-67` | Medium |

---

## Code Review

### 总结结论

Fail。v6 的后台读模型和部分 CLI 命令已经存在，但公共契约入口、OpenClaw 工具面、goal governance 与 NarrativeTrace causality 仍有静态可证的断裂。

### 审查范围与静态边界

已读: `AGENTS.md`、`.anws/v6/01_PRD.md`、`02_ARCHITECTURE_OVERVIEW.md`、`03_ADR/*`、`04_SYSTEM_DESIGN/*`、`05A_TASKS.md`、`05B_VERIFICATION_PLAN.md`、`07_CHALLENGE_REPORT.md`、`plugin/index.ts`、`plugin/workspace-ops-bridge.ts`、`src/cli/commands/index.ts`、`src/cli/ops/ops-router.ts`、`src/core/second-nature/orchestrator/goal-priority.ts`、`src/storage/goal/agent-goal-store.ts`、`src/core/second-nature/heartbeat/heartbeat-loop.ts` 与相关测试/报告。  
未确认: 真实 OpenClaw 宿主会话、真实外部 connector 网络、真实投递 side effect、当前机器完整测试运行结果。  
故意未执行: code-reviewer 静态边界下未运行 `pnpm test`、未启动服务、未连接外部服务。

### 契约到代码映射摘要

| 承诺 | 实现区域 | 结论 |
| --- | --- | --- |
| v6 ops command set 可由 CLI 与 `second_nature_ops` 同构访问 | `src/cli/commands/index.ts`, `plugin/index.ts`, `plugin/workspace-ops-bridge.ts` | Fail |
| `sn status` / `second_nature_ops status` 是 v6 aggregate | `src/cli/commands/index.ts`, `src/cli/read-models/index.ts` | Fail |
| accepted goal 影响 intent priority，proposal 不越权 | `src/core/second-nature/orchestrator/goal-priority.ts`, `src/storage/goal/agent-goal-store.ts` | Partial |
| NarrativeTrace 记录 goal influence causality | `src/core/second-nature/heartbeat/heartbeat-loop.ts`, `src/observability/services/lived-experience-audit.ts` | Partial |
| 05A/05B 与 AGENTS/report 回流一致 | `.anws/v6/05A_TASKS.md`, `AGENTS.md`, `reports/int-s*.md` | Partial |

### Lens 结果摘要

| Lens | 结论 | 证据 |
| --- | --- | --- |
| L1 Contract Fidelity | Fail | `second_nature_ops` 与 `sn status` 公共命令语义偏离 PRD/05A/05B/cli-system。 |
| L2 Task Fulfillment | Fail | T1.2.1-T1.2.6 / INT-S4 的工具面验收未被实现路径覆盖。 |
| L3 Architecture Fit | Partial | 读模型与核心模块分层基本沿设计走，但 plugin bridge 未承接 v6 命令扩展。 |
| L4 Runtime Risk from Static Evidence | Partial | goal policy allowlist accepted 后仍不进入 priority；运行时不会报错但行为静默偏离。 |
| L5 Verification Evidence | Partial | status 测试验证 `status:v6` 而非契约命令 `status`，NarrativeTrace 测试未断言 goal refs 值。 |
| L6 Backflow & Handoff | Partial | 05A、AGENTS 与 INT reports 对完成状态不一致。 |

### Issues

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
| --- | --- | --- | --- | --- | --- | --- |
| Critical | L1+L2+L6 | v6 `second_nature_ops` 命令集没有进入 OpenClaw 工具面。 | `plugin/index.ts:182-198`; `plugin/index.ts:744-882`; `plugin/index.ts:1165-1185`; `src/cli/commands/index.ts:332-384` | INT-S4 宣称的 OpenClaw JSON-first v6 ops surface 无法由实际工具调用，owner 在宿主中看不到 v6 narrative/goal/dream/cycle/connector 命令。 | 将 v6 命令加入 host-safe router 与 `WORKSPACE_BRIDGE_COMMANDS`，并补 `second_nature_ops` workspaceRoot 测试覆盖 `narrative`、`goal`、`dream:recent`、`connector_status/test`、`cycle:recent`、`status`。 | `.anws/v6/04_SYSTEM_DESIGN/cli-system.md:43-58`; `.anws/v6/05B_VERIFICATION_PLAN.md:373-380`; `reports/int-s4-v6-ops-host-readiness.md:17-20` |
| High | L1+L5 | v6 status aggregate 注册为 `status:v6`，不是契约要求的 `status`。 | `src/cli/commands/index.ts:54-63`; `src/cli/commands/index.ts:343-350`; `tests/integration/cli/t1-2-6-status-aggregate.test.ts:1-8`; `reports/int-s4-v6-ops-host-readiness.md:31-34` | `sn status` / `second_nature_ops status` 仍可能停留在 v5 摘要，测试与报告验证了替代命令名而不是用户契约。 | 让 `status` 返回 v6 aggregate 或提供显式兼容策略，并把测试与 INT-S4 报告改为断言 `status`。 | `.anws/v6/05A_TASKS.md:207-216`; `.anws/v6/05B_VERIFICATION_PLAN.md:96-104`; `.anws/v6/01_PRD.md:153-162` |
| High | L1+L4+L5 | policy-accepted agent proposal 与 NarrativeTrace goal refs 都丢失 goal causality。 | `src/core/second-nature/orchestrator/goal-priority.ts:52-54`; `src/storage/goal/agent-goal-store.ts:159-167`; `src/core/second-nature/heartbeat/heartbeat-loop.ts:219-237`; `tests/integration/observability/heartbeat-narrative-trace.test.ts:58-67` | 低风险且通过 policy allowlist 的 agent goal 不会影响 planning，trace 也无法解释 accepted goal 对 intent 的影响。 | 以 `status=accepted` + `acceptedBy`/policy gate 作为 priority 准入，trace 使用 `selectedIntent.goalInfluenceRefs ?? []`，并补 policy-accepted goal 与 trace 值断言。 | `.anws/v6/01_PRD.md:91-98`; `.anws/v6/03_ADR/ADR_003_AGENT_SELF_LAYER.md:48-49`; `.anws/v6/05A_TASKS.md:539-548` |
| Medium | L6 | v6 完成状态在 05A、AGENTS 与 INT reports 之间不一致。 | `.anws/v6/05A_TASKS.md:312-326`; `.anws/v6/05A_TASKS.md:539-553`; `.anws/v6/05A_TASKS.md:722-734`; `AGENTS.md:269-288`; `reports/int-s1-v6-foundation-connector.md:7-18` | 下游 `/forge`、`/challenge` 与交接读的是 05A source of truth，会把“全部施工完毕”判成未完成或反复返工。 | 在修复 CR8-01..03 后统一回流 05A/05B/AGENTS/INT reports，至少让 T2.3.1、T5.1.2、INT-S1 的状态与证据一致。 | `AGENTS.md:18-24`; `.anws/v6/05A_TASKS.md:5-6` |

### 安全 / 测试覆盖补充

| 项目 | 结论 | 说明 |
| --- | --- | --- |
| OpenClaw v6 command reachability | Fail | 静态代码显示工具面命令表与 bridge allowlist 未包含 v6 command set。 |
| status sensitive redaction | Cannot Confirm | 未运行测试，且当前发现先阻断了 `status` 命令契约本身。 |
| external connector side effect | Cannot Confirm | 本轮未连接真实平台，仍需 INT-S1/INT-S4 的真实宿主或手工 smoke 承接。 |
| full regression result | Cannot Confirm | 本轮未执行 `pnpm test`，现有报告中的 514/514 pass 作为历史声明，不作为本轮静态事实。 |

---

## 承诺闭合验证

| 维度 | 结论 | 证据 | 对应问题 |
| --- | --- | --- | --- |
| 重复态 | Partial | bridge command allowlist 固定，新增 v6 命令不会自动进入工具面。 | CR8-01 |
| 失败态 | Partial | unknown command 会诚实失败，但这不是 v6 ops 契约接受的降级语义。 | CR8-01 |
| 默认态 | Fail | 默认 `status` 命令没有承接 v6 aggregate。 | CR8-02 |
| 运行态 | Cannot Confirm | 未启动项目或真实宿主。 | 无 |
| 并发态 | Not Applicable | 本轮发现不涉及新增并发协议。 | 无 |
| 观测态 | Fail | `second_nature_ops` 看不到多数 v6 观测命令，NarrativeTrace goal refs 不可信。 | CR8-01, CR8-03 |
| 安全边界 | Partial | proposal 默认不越权，但 policy-accepted proposal 被过度过滤，授权后的目标也失效。 | CR8-03 |
| 验证责任 | Partial | 测试覆盖了存在性或替代命令名，未覆盖契约名和 causality 值。 | CR8-02, CR8-03 |

---

## 建议行动

| 优先级 | 行动 | 完成信号 |
| --- | --- | --- |
| P0 | 先通过 `/change` 回流 CR8-01..03 为明确修复任务和验证条目。 | 05A/05B 出现针对 v6 `second_nature_ops` reachability、`status` 契约名、policy-accepted goal priority、NarrativeTrace goal refs 的任务/验证锚点。 |
| P0 | 通过 `/forge` 修复 plugin bridge 与 host-safe router，让 v6 命令能从 `second_nature_ops` workspace full runtime 调用。 | `plugin-workspace-ops-bridge` 新增测试覆盖 `narrative`、`goal`、`dream:recent`、`connector_status/test`、`cycle:recent`、`status`，并返回 workspace read model 或 honest unavailable envelope。 |
| P1 | 修正 `status` 公共命令名，避免 `status:v6` 替代用户契约。 | `router.resolve("status")` 返回包含 narrative/dream/cycles 的 v6 aggregate，INT-S4 报告不再把 `status:v6` 当完成信号。 |
| P1 | 修正 accepted goal priority 与 NarrativeTrace goal refs。 | policy-accepted agent proposal 可影响 matching candidate；NarrativeTrace `goalInfluenceRefs` 等于 selected candidate 的 goal refs；新增断言覆盖具体 goal id。 |
| P2 | 统一 05A/05B/AGENTS/INT reports 状态。 | T2.3.1、T5.1.2、INT-S1 状态与实际证据一致，无“报告 pass 但 05A 未勾选”的漂移。 |

---

## 最终判断

当前 v6 不能按“全部施工完毕”签收。Critical 问题是 OpenClaw `second_nature_ops` 没有真正承接 v6 ops surface；High 问题是 `status` 契约名漂移和 Agent Self goal causality 漂移。建议先走 `/change` 写入修复任务，再走 `/forge` 修复并补针对性测试。
