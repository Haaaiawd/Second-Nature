# Second Nature v5 质疑报告 (Challenge Report)

> **审查日期**: 2026-05-01  
> **审查范围**: `.anws/v5` PRD / Architecture / ADR / System Design / `05_TASKS.md`  
> **累计轮次**: 8

---

## 📋 问题总览

> 已解决轮次仅保留摘要。当前活跃轮只保留影响进入 `/forge` 判断的高信号问题。

### 已归档轮次

| 轮次 | 状态 | 摘要 |
| --- | --- | --- |
| Round 1-6 | ✅ 全部修复 | 已完成 6 个系统的逐系统设计审查；旧轮次共 2 High、4 Medium、1 Low，均已修复并归档。 |
| Round 7 | ✅ 全部修复 | 已修复 `OutreachDraftRequest`、delivery fallback、RhythmWindow owner、DeliveryAttemptRecord、heartbeat tool invocation、startup repair、hash-chain、storage mode 等进入 `/blueprint` 前的设计缺口。 |

### 第 8 轮（当前活跃）

| 严重度 | 数量 | 摘要 | 状态 |
| --- | ---: | --- | --- |
| Critical | 0 | S3/INT 依赖冲突、heartbeat surface 方向、README/INT 循环依赖、source coverage、effect commit 等阻塞项已修复 | ✅ 已修复 |
| High | 0 | P0 outreach 追溯、旧 design 源污染、P0 基础单测承接、docs-vs-observed 证据缺口已修复 | ✅ 已修复 |
| Medium | 0 | manifest / Architecture readiness 元数据已更新 | ✅ 已修复 |
| Low | 0 | 未保留低价值措辞问题 | ✅ 无 |

---

## 📊 审查摘要

**审查模式**: `DESIGN + TASKS`  
**整体判断**: 🟢 可返回 `/forge`  
**高信号结论**: 第 8 轮 design/tasks review 发现的阻塞项已经通过 `/change AUTO` 回流到任务与设计契约：S1/S2 heartbeat surface 依赖方向已拆清，S3 Quiet writer/source coverage 纳入 INT-S3，README/INT-S4 循环依赖已解除，source coverage 统一为 all-claim grounding，side-effect 幂等恢复链与 delivery proof 状态机已补齐。

| 指标 | 数值 |
| --- | ---: |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Total Findings | 0 active / 9 fixed in round 8 |

| 证据来源 | 结论 |
| --- | --- |
| design-reviewer | 执行：核心 L0/L1 契约大体闭合；发现旧设计文件污染当前 design source |
| task-reviewer | 执行：REQ/US 主覆盖完整；发现 S3/S4 依赖冲突与 P0 追溯遗漏 |
| code-reviewer | 跳过：本轮用户明确要求 design/tasks review，未进入实现静态忠实度审查 |
| /change 最小复核 | 执行：task-reviewer 与 design-reviewer 二次复核后无 Critical / High 阻塞项，可返回 `/forge` |
| Pre-Mortem | 主要失败链已回流：里程碑、source grounding、幂等恢复与 delivery proof 不再互相打架 |
| 承诺闭合检查 | Pass after /change AUTO |

---

## 🔍 核心发现清单

| ID | 类别 | 严重度 | 契约/Pass | 位置 | 发现 | 影响 | 建议 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CH-08-01 | 任务排期冲突 | Critical | D3 / G2 | `05_TASKS.md` T2.3.3, T4.4.1, T6.1.2, INT-S3, INT-S4 | S3 Quiet closure 的核心 writer 不在 INT-S3。 | S3 验收失真。 | ✅ 已修复：`T4.4.1` 纳入 INT-S3，从 INT-S4 移除，并更新 Sprint/US/Contract overlays。 |
| CH-08-02 | P0 追溯漂移 | High | E3 / F5 / G2 | `05_TASKS.md` T2.3.1, T4.2.2, T6.1.2, T6.2.1, US-004 overlay | P0 outreach 隐式依赖 P1 user-interest/evidence pack。 | 必要前置任务可能被当成可选项。 | ✅ 已修复：`T4.2.2` 明确为 P0 最小 insufficient downgrade，US-004 overlay 显式纳入 `T4.2.2` / `T6.1.2`。 |
| CH-08-03 | 规范源污染 | High | SD-1 / D1 / D2 | `04_SYSTEM_DESIGN/control-plane-system.old.md` | 旧 Lobster Rhythm 控制层文件仍像正式契约。 | review / forge 可能读错设计源。 | ✅ 已修复：文件头标记为 `Non-Contract Archive`，明确不得作为 v5 当前设计源。 |
| CH-08-04 | readiness 元数据漂移 | Medium | Documentation Contract | `00_MANIFEST.md`; `02_ARCHITECTURE_OVERVIEW.md` §9 | manifest / Architecture 仍提示 design-system / blueprint 前状态。 | 新会话恢复路径会走错。 | ✅ 已修复：manifest 标记 design/tasks 完成；Architecture Next Steps 改为 `/forge` 前检查。 |
| CH-08-05 | source coverage 契约不一致 | Critical | SD-4 / RS-6 | `state-system.detail.md`, `observability-system.detail.md`, `behavioral-guidance-system.detail.md` | 多系统 source coverage 通过阈值不一致。 | unsupported claim 可能进入 source-backed 路径。 | ✅ 已修复：统一为 all-claim grounding，正常 pass 要求 coverage ratio 1.0 且 unsupported claims 为 0。 |
| CH-08-06 | side-effect 幂等恢复链未闭合 | Critical | RS-3 / RS-6 | `connector-system.detail.md`; `state-system.detail.md` | connector 只 create commit，不读取既有 committed/reconcile 状态。 | 重复 heartbeat / retry 可能重复外部副作用。 | ✅ 已修复：改为 `getOrCreateIntentCommitRecord` 与 idempotency key lookup，connector 在 adapter 前处理 committed/dispatched/reconcile 状态。 |
| CH-08-07 | 公共类型漂移 | High | SD-4 | `control-plane-system.detail.md`, `behavioral-guidance-system.detail.md`, `cli-system.detail.md` | `SourceRef`、interest signal、host capability evidence refs 表达不一致。 | 实现阶段会产生隐式 adapter 和 provenance 丢失。 | ✅ 已修复：control/guidance/cli 统一使用结构化 `SourceRef` 与 topic/affinity/reason interest signal。 |
| CH-08-08 | delivery fallback 顺序漂移 | High | RS-6 | `control-plane-system.md`; `control-plane-system.detail.md` | L0 与 L1 对 delivery unavailable 是否请求 guidance 的顺序不一致。 | fallback 文案和审计语义漂移。 | ✅ 已修复：明确先 resolve delivery，再按需请求 `fallback_candidate`，且 wording 固定 not_sent。 |
| CH-08-09 | delivery sent proof 缺口 | High | G3 | `state-system.detail.md`; `observability-system.detail.md`; `05_TASKS.md` T4.3.1/T5.2.1 | State 允许 sent 缺 messageId，Observability 会降级为 failed。 | explain 可能出现已联系/未联系分裂。 | ✅ 已修复：`sent` 必须有 `messageId` 或 `hostProofRef`，state 与 observability 对齐。 |

---

## 建议行动清单

### P0 - 立即处理

无活跃阻塞项。

### P1 - 近期处理

进入 `/forge` 后按 `05_TASKS.md` 的 Wave 1 开始实施；若实现中发现新契约漂移，继续通过 `/change` 回流。

---

## 🚦 最终判断

- [x] 🟢 项目可继续，风险可控
- [ ] 🟡 项目可继续，但需先解决 P0 问题
- [ ] 🔴 项目需要重新评估

**判断依据**: 第 8 轮 active blockers 已全部回流到 `05_TASKS.md`、相关 system design detail、manifest 与 Architecture Next Steps。当前无需重开 `/genesis`，可返回 `/forge`。

---

## 📚 附录

### A. 承诺闭合与假设验证摘要

| 项目 | 结论 | 证据 | 对应问题 |
| --- | --- | --- | --- |
| 重复态 | Pass | cooldown、dedupe、idempotency、effect commit 均已进入设计与任务。 | — |
| 失败态 | Pass | runtime unavailable、target none、delivery failed、empty evidence 均已建模。 | — |
| 默认态 | Pass | `runtime_carrier_only`、`heartbeat_tool_not_invoked`、`HEARTBEAT_OK` ack drop 均有任务承接。 | — |
| 运行态 | Pass | heartbeat/outreach 主链路可运行推演；Quiet writer/source coverage 已纳入 S3/INT-S3。 | CH-08-01 |
| 观测态 | Pass | decision trace、delivery audit、source coverage、guidance grounding、hash-chain 均有契约与任务。 | — |
| 任务承接 | Pass | REQ/US 主覆盖完整，P0/P1 依赖和 overlay 已修正。 | CH-08-02 |
| 文档契约 | Pass | 旧设计文件已标记 non-contract，readiness metadata 已更新。 | CH-08-03 / CH-08-04 |

### B. ADR 影响追踪

| ADR 文件 | 引用该 ADR 的 SYSTEM_DESIGN / TASKS | 影响说明 |
| --- | --- | --- |
| [ADR-007](./03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md) | `control-plane-system.md`, `state-system.md`, `behavioral-guidance-system.md`, `05_TASKS.md` | CH-08-01 / CH-08-02 影响 delivery、source-backed outreach 与 Quiet source coverage 的任务闭合。 |
| [ADR-003](./03_ADR/ADR_003_SECOND_NATURE_GOVERNANCE.md) | `control-plane-system.md`, `state-system.md`, `observability-system.md`, `05_TASKS.md` | CH-08-01 影响 Quiet / Narrative Reflection 必须 source-backed 的验收时机。 |
| [ADR-005](./03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md) | `control-plane-system.md`, `cli-system.md`, `05_TASKS.md` | readiness 元数据必须准确反映当前阶段，否则 host heartbeat 边界复核会走错工作流。 |
