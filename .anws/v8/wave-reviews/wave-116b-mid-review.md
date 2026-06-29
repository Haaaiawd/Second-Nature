# Wave 116B Mid Review — 2026-06-18

## 1. 总结结论

**Partial Pass（静态语义下）**。

T-OBS.R.8 的精确降级状态分类器与 T-SH.R.6 的来源/证明/追踪三层 provenance 契约在共享类型与存储写入层已经落地，但 **生产代码中仍存在把 `decision.proofRefs` 直接当作 `sourceRefs` 传递的实例**，与 `shared-v8-contracts.md §2.2` 的 provenance tier 规则直接冲突。Closure 的 `proofRefs`/`traceRefs` 仍被塞进 `payloadJson`，缺少 schema 级字段。 pending 的 T-CP.R.5（v8-only heartbeat model）与 T-AC.R.2（CycleFinalizer）尚未实现，因此本轮不能标记 Wave 116B 完成。

---

## 2. 审查范围与静态边界

### 已读
- `.anws/v8/01_PRD.md`、`02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md`、`action-closure-policy-system.md`、`observability-health-system.md`
- `.anws/v8/05A_TASKS.md`、`05B_VERIFICATION_PLAN.md`、`07_CHALLENGE_REPORT.md`
- 变更文件：`src/shared/types/v8-contracts.ts`、`src/shared/degraded-status-classifier.ts`、`src/shared/provenance-tier.ts`、`src/storage/v8-state-stores.ts`、`src/core/second-nature/action/action-closure-recorder.ts`、`src/cli/ops/heartbeat-surface.ts`
- 新增测试：`tests/unit/shared/degraded-status-classifier.test.ts`、`tests/unit/shared/provenance-tier.test.ts`
- 为验证接线，额外读取了 `src/core/second-nature/control-plane/heartbeat-orchestrator.ts`、`src/core/second-nature/action/policy-bound-dispatch.ts`、`src/core/second-nature/guidance/guidance-proposal-consumer.ts`、`src/observability/loop-stage-event-sink.ts`

### 未读/未执行
- 未运行任何测试、未执行 `pnpm build`/`typecheck`（用户要求纯静态审查）。
- 未完整审计 `src/core/second-nature/quiet-dream/*` 对 provenance 的使用，仅抽样检查。
- pending 任务 T-CP.R.5、T-AC.R.2 的实现文件尚未产生，无法审查。

---

## 3. 契约 → 代码映射摘要

| 契约承诺 | 实现区域 | 状态 |
|---|---|---|
| `DegradedOperationResult.status` 精确状态（empty/partial/blocked/unavailable/unsafe） | `src/shared/types/v8-contracts.ts:197`、`src/shared/degraded-status-classifier.ts:65-73` | ✅ 类型与类型一致 |
| Provenance tier：`sourceRefs` 仅放真实证据 | `src/shared/provenance-tier.ts:32-43`、`src/shared/types/v8-contracts.ts:106-110` | ⚠️ 辅助函数正确，但生产调用点仍把 proof 当 source |
| `ActionClosureRecord.proofRefs` / `traceRefs` 分离持久化 | `src/storage/v8-state-stores.ts:484-516`、`src/core/second-nature/action/action-closure-recorder.ts:54-73` | ⚠️ 写入接口已分离，但 proof/trace 被序列化进 `payloadJson`，无独立列 |
| `LoopStageEvent.proofRefs` / `traceRefs` 字段存在 | `src/shared/types/v8-contracts.ts:161-162` | ⚠️ 类型已加，`recordLoopStageEvent` 未消费，调用方也未传 |

---

## 4. Lens 结果摘要

### Lens 1: 契约忠实度
- `DegradedOperationResult.status` 已对齐 `shared-v8-contracts.md §4.1` 的精确枚举（`empty`/`partial`/`blocked`/`unavailable`/`unsafe`），`HeartbeatCycleStatus` 中的 `degraded` 保留为 cycle trace 聚合态，不冲突。
- `ProvenanceBundle` 与 `LoopStageEvent.proofRefs`/`traceRefs` 字段已加入 `v8-contracts.ts`，与 design doc §2.2 一致。
- **偏差**：`policy-bound-dispatch.ts:127`、`policy-bound-dispatch.ts:143/162` 把 `decision.proofRefs` 或 `proposal.sourceRefs` 序列化后塞进 `ConnectorDispatchRequest.sourceRefs` / `GuidanceDispatchRequest.sourceRefs`；`heartbeat-orchestrator.ts:489/500/628` 把 `decision.proofRefs` 直接作为 `sourceRefs` 写入 `LoopStageEvent`；`guidance-proposal-consumer.ts:117` 把 `decision.proofRefs` 混入 `GuidanceOutput.sourceRefs`。这些均违反 §2.2 “synthetic proofs … must not be serialized into `sourceRefs`”。

### Lens 2: 任务兑现与交付闭合
- T-OBS.R.8：分类器与类型已落地，但 `05A_TASKS.md` 仍标记为 `[ ]`（pending），与本阶段“completed since last review”描述不一致；可能是 mid-point 状态未更新。
- T-SH.R.6：provenance-tier helper 与 closure recorder 改造完成，但 **受影响 payload 清单中的 `LoopStageEvent`、`RuntimeOpsEnvelope`、heartbeat cycle traces、setup/tool visibility proofs 尚未看到迁移**。
- T-CP.R.5、T-AC.R.2：仍为 pending，无实现文件。

### Lens 3: 架构适配与复杂度健康
- `degraded-status-classifier.ts` 与 `provenance-tier.ts` 作为纯函数 helper，边界清晰，无 I/O，符合“简单”原则。
- `v8-state-stores.ts` 中 `writeActionClosureRecord` 把 `proofRefs`/`traceRefs` 折进 `payloadJson`，导致 closure payload 同时承担“业务 payload”与“provenance 容器”两个职责，长期会带来查询/索引困难。建议按 design doc 提示加显式列。
- `heartbeat-orchestrator.ts` 中 closure 调用仍分散在多个分支（lines 235、294、373、394、455、509、535、563、591、647），T-AC.R.2 的 `CycleFinalizer` 尚未收敛。

### Lens 4: 静态运行风险与安全边界
- `heartbeat-surface.ts:263` 对 v8 spine degraded 结果的处理把 `cycleId`/`cycleSequence` 留空（`""`、`0`），如果后续代码按空字符串查询 closure 会产生无效查询或错误归因。
- `guidance-proposal-consumer.ts:117` 把 decision proof 与 proposal evidence 合并后作为 `GuidanceOutput.sourceRefs`，下游若据此生成 draft 的 source backing，会错误地把 policy proof 当成事实证据。
- 无 credential/secret 明文泄露的直接静态证据。

### Lens 5: 验证证据与可观测性
- 新增单元测试覆盖了分类器的基本映射与 provenance helper 的校验逻辑，但 **未覆盖生产代码中 proofRefs 被错放到 sourceRefs 的反例**。
- `provenance-tier.test.ts` 验证了存储层 `payloadJson` 包含 proof/trace，但未验证读取侧能还原；也未验证 `action_closure_record` 表是否有独立列的回归。
- `05B_VERIFICATION_PLAN.md` 要求 T-SH.R.6 产出 “provenance-tier search log”，目前未见产出文件。

### Lens 6: 回流一致性与交接证据
- `05A_TASKS.md` 中 T-OBS.R.8 状态未勾选，与用户提供的“completed since last review”矛盾，需同步更新。
- T-SH.R.6 的契约清单（`ActionClosureRecord`、`ActionPolicyDecision`、`GuidanceUnavailableDispatchResult`、`LoopStageEvent`、`RuntimeOpsEnvelope`、heartbeat cycle traces、setup/tool visibility proofs）中，仅 `ActionClosureRecord` 与 `LoopStageEvent` 类型层面有字段；其余未在本变更集中看到迁移或明确“无需迁移”的注释。

---

## 5. Issues

### Critical

无。

### High

#### H-1 | Contract Drift — `decision.proofRefs` 仍被当作 `sourceRefs` 传入 stage events / dispatch / guidance output
- **Lens**: L1 + L2
- **Evidence**: `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:489`, `:500`, `:628`; `src/core/second-nature/action/policy-bound-dispatch.ts:127`, `:143`, `:162`, `:177`; `src/core/second-nature/guidance/guidance-proposal-consumer.ts:117`
- **Impact**: 违反 `shared-v8-contracts.md §2.2`，synthetic policy proof 混入 evidence source refs；Quiet/Dream 若消费这些 refs 会把 policy artifact 误当真实证据，loop_status 归因失真。
- **Minimum fix**: 
  - `heartbeat-orchestrator.ts` 中 stage event 的 `sourceRefs` 使用 `proposal.sourceRefs`（若有）或真实 evidence refs；`decision.proofRefs` 传入新增的 `proofRefs` 字段。
  - `policy-bound-dispatch.ts` 中 `ConnectorDispatchRequest` / `GuidanceDispatchRequest` 若需 proof，新增 `proofRefs` 字段，不要把 proof 塞进 `sourceRefs`。
  - `guidance-proposal-consumer.ts:117` 改为 `sourceRefs: proposal.sourceRefs`，`proofRefs: decision.proofRefs` 另设字段。
- **Anchor**: `shared-v8-contracts.md §2.2 Provenance Tier Contract`; `07_CHALLENGE_REPORT.md CH-30`

#### H-2 | LoopStageEvent 类型已加 `proofRefs`/`traceRefs` 但 sink/调用方未使用
- **Lens**: L1 + L2
- **Evidence**: `src/shared/types/v8-contracts.ts:161-162`; `src/observability/loop-stage-event-sink.ts:155-167` 只读取 `event.sourceRefs`，未读 `event.proofRefs`/`traceRefs`
- **Impact**: 即使调用方正确传了 proof/trace，也不会被持久化；stage event 仍把 synthetic refs 当 source。
- **Minimum fix**: `recordLoopStageEvent` 接收并透传 `proofRefs`/`traceRefs` 到 `writeLoopStageEvent`；`writeLoopStageEvent` 在 schema/序列化层支持这两列（或先写入 `payloadJson` 并留 migration 注释）。
- **Anchor**: `shared-v8-contracts.md §3.2 LoopStageEvent`; `05B_VERIFICATION_PLAN.md#t-sh-r-6`

#### H-3 | `heartbeat-surface.ts` v8 spine degraded 路径伪造空 cycleId/cycleSequence
- **Lens**: L4
- **Evidence**: `src/cli/ops/heartbeat-surface.ts:264-267`
- **Impact**: degraded v8 spine 结果写入 surface 时 `cycleId: ""`、`cycleSequence: 0`，下游 closure/loop_status 若按此查询会得到无意义结果，可能掩盖真实降级原因。
- **Minimum fix**: 当 `v8Result` 为 degraded 时，直接使用其 `cycleId`（若存在）或显式返回 `v8_spine_degraded` 而不填充空 spine 结构。
- **Anchor**: `05B_VERIFICATION_PLAN.md#t-cp-r-5`

### Medium

#### M-1 | Closure `proofRefs`/`traceRefs` 仅通过 `payloadJson` 存储，缺少 schema 列
- **Lens**: L3
- **Evidence**: `src/storage/v8-state-stores.ts:500-504`
- **Impact**: 查询 closure 的 proof/trace 需要解析 JSON，无法索引；与 design doc “Add explicit fields instead” 建议不符。
- **Minimum fix**: 在 `action_closure_record` schema 增加 `proofRefsJson`/`traceRefsJson` 两列（或 JSON 列），`writeActionClosureRecord` 写入这两列，保留 `payloadJson` 仅用于业务 payload。
- **Anchor**: `shared-v8-contracts.md §2.2`; `action-closure-policy-system.md §6.1 ActionClosureRecord`

#### M-2 | `degraded-status-classifier` 未精确覆盖部分生产 reason code
- **Lens**: L1 + L5
- **Evidence**: `src/shared/degraded-status-classifier.ts:22-63`; 生产中出现的 `proposal_risk_blocked`、`perception_contract_drift`、`dream_failed`、`dream_scheduled_stalled`、`ingestion_connector_failed`、`execution_failed`、`execution_timeout` 等均落入默认 `unavailable`
- **Impact**: 默认 `unavailable` 仍可接受，但 T-OBS.R.8 要求“精确状态”；`blocked`/`partial`/`unsafe` 的语义可能未对齐真实失败原因。
- **Minimum fix**: 扩展分类表，或明确文档化“未列出的 reason 默认 unavailable”；至少把 `proposal_risk_blocked`→`blocked`、`evidence_batch_truncated` 已覆盖、`dream_scheduled_stalled`→`partial` 等补上。
- **Anchor**: `05B_VERIFICATION_PLAN.md#t-obs-r-8`

#### M-3 | `recordLoopStageEvent` 未把 event 的 `proofRefs`/`traceRefs` 写入持久化
- **Lens**: L1
- **Evidence**: `src/observability/loop-stage-event-sink.ts:152-167`
- **Impact**: 即使上游修正传入 proofRefs，sink 也会丢失。
- **Minimum fix**: 同 H-2。
- **Anchor**: `shared-v8-contracts.md §3.2`

### Low

#### L-1 | `05A_TASKS.md` T-OBS.R.8 状态未勾选
- **Lens**: L6
- **Evidence**: `.anws/v8/05A_TASKS.md:2030` 仍为 `- [ ] T-OBS.R.8`
- **Impact**: 任务状态与 mid-point 声称的 completed 不一致，影响下游 `/change` 与 INT-R11 验收。
- **Minimum fix**: 若 mid-point 确认 T-OBS.R.8 已完成当前范围，勾选 `[x]` 并注明“mid-point 实现层完成，待 Wave 116C 验证回归”。
- **Anchor**: `.anws/v8/05A_TASKS.md §Wave 116`

#### L-2 | T-SH.R.6 受影响 payload 迁移清单未完全闭合
- **Lens**: L6
- **Evidence**: `05A_TASKS.md:1964` 列出 `ActionPolicyDecision`、`GuidanceUnavailableDispatchResult`、`RuntimeOpsEnvelope`、heartbeat cycle traces、setup/tool visibility proofs；本变更集中未见这些类型的 provenance 拆分
- **Impact**: 遗留 provenance 污染风险。
- **Minimum fix**: 对每项标注“已完成”/“无需迁移”/“待 116C”，并补充到 `07_CHALLENGE_REPORT.md` Round 4 修复归档。
- **Anchor**: `05A_TASKS.md T-SH.R.6`

---

## 6. 安全 / 测试覆盖补充

- **高风险缺口**：H-1 的 provenance 污染如果被 Quiet/Dream 消费，会导致 memory candidate 基于 policy proof 而非真实证据，但当前静态审查无法确认 Quiet/Dream 是否已消费这些 refs；需测试或代码搜索验证。
- **无法静态确认**：`pnpm typecheck`、`pnpm build`、单元/集成测试是否全部通过需运行时验证，本审查未执行。
- **测试增强建议**：
  - 在 `provenance-tier.test.ts` 增加反例：调用 `recordLoopStageEvent` 时传 `proofRefs`，断言持久化后 proofRefs 不进入 `sourceRefsJson`。
  - 在 `degraded-status-classifier.test.ts` 增加所有 `V8ReasonCode` 的覆盖，确保无未预期默认。
  - 新增集成测试：一个完整 heartbeat cycle 结束后，读取 `action_closure_record` 与 `loop_stage_event`，验证 `proofRefs` 未污染 `sourceRefs`。

---

## 7. 下一步建议

1. 修复 H-1/H-2：把 `heartbeat-orchestrator.ts`、`policy-bound-dispatch.ts`、`guidance-proposal-consumer.ts`、`loop-stage-event-sink.ts` 中的 proofRefs 从 `sourceRefs` 解耦。
2. 决定 M-1：是否为 closure 增加独立 `proofRefsJson`/`traceRefsJson` 列；若时间紧，至少在 `payloadJson` 外保留显式 schema migration 与注释。
3. 完成 pending 的 T-CP.R.5 与 T-AC.R.2 后再进入 Wave 116C 验证。
4. 更新 `05A_TASKS.md` 与 `07_CHALLENGE_REPORT.md` CH-30 修复状态，避免文档状态与代码事实脱节。
