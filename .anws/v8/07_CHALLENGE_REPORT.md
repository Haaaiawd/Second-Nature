# v8 Challenge Report — Round 5 (Wave 116-118 Implementation Fidelity Challenge)

**Target Dir**: `.anws/v8`
**Review Date**: 2026-06-21
**REVIEW_MODE**: `FULL` (design review + task review + code review all executed)
**Reviewer**: Nyx / multi-agent static analysis + direct code verification
**Scope**: Verify whether V8 implemented features (Wave 116A-D / 117 / 118) are faithful to design contracts and tests; close out Round 4 findings; surface residual contract drift that survived three waves of "completion" claims.

---

## 1. 问题总览

### Round 1 / Round 2 / Round 3 / Round 4（已归档）

| Round | ID 范围 | 最高严重度 | 状态 |
|-------|---------|-----------|:----:|
| Round 1 | DR-01 ~ DR-06 | High | Closed |
| Round 2 | CH-07 ~ CH-11 | High | Closed |
| Round 3 | CH-12 ~ CH-23 | Critical | Partially closed; structural remainder deferred to future refactoring waves |
| Round 4 | CH-24 ~ CH-35 | High | Closed (docs) / Closed (impl via Wave 116A-D) — see §11 archive |

### Round 5（当前活跃）

| 严重度 | 数量 | 摘要 | 状态 |
|--------|------|------|------|
| **Critical** | 0 | 无根本性阻断项；系统能运行、测试能通过 | — |
| **High** | 6 | CycleFinalizer 无幂等且被绕过、closure provenance 仍塞 payloadJson、host-discovery 无真实探测、heartbeat-surface 伪造空 cycleId、dream-runner 直接 accept、guidance degraded 分支 proof 当 source | ⏳ 待处理 |
| **Medium** | 5 | CLI setup envelope 非标准、plugin 重复 setup-ack、degraded-classifier 覆盖不全、normalizeEnvelopeResult 丢错误码、v7 heartbeat 未硬拒绝 | ⏳ 待处理 |
| **Low** | 3 | SourceRefFamily.projection 未定义、surfaceMode 枚举未文档化、closure 调用未完全集中 | ⏳ 待处理 |

---

## 2. 审查摘要

### 2.1 Mode Detection

| Item | Result |
| --- | --- |
| Latest architecture version | `.anws/v8` |
| `05A_TASKS.md` | Present; Wave 116/117 tasks checked; Wave 118 has no task section |
| `05B_VERIFICATION_PLAN.md` | Present; last updated 2026-06-11, lags Wave 117 (2026-06-20) |
| `src/` v8 implementation | Present and active; Wave 116A-D / 117 / 118 implemented |
| Review mode | `FULL` — user explicitly requested review of V8 implemented features against tests and design |
| Design review | Executed via sub-agent + `design-reviewer` skill |
| Task review | Executed via sub-agent + `task-reviewer` skill |
| Code review | Executed via sub-agent + `code-reviewer` skill + direct grep/read verification |

### 2.2 Evidence Sources

| Source | Purpose |
| --- | --- |
| `.anws/v8/01_PRD.md` | Business contracts: 9 US, REQ-001..009, G1-G8, DoD |
| `.anws/v8/02_ARCHITECTURE_OVERVIEW.md` | 10-system inventory, boundary matrix, dependency graph |
| `.anws/v8/03_ADR/ADR_001..005` | Accepted decisions |
| `.anws/v8/04_SYSTEM_DESIGN/*.md` | L0/L1 port contracts per system |
| `.anws/v8/05A_TASKS.md` | Wave 116/117/118 task descriptions |
| `.anws/v8/05B_VERIFICATION_PLAN.md` | Verification plans and traceability |
| `.anws/v8/wave-reviews/wave-116*.md` | Historical findings across 4 sub-waves |
| `src/`, `plugin/` | Direct code verification of residual drift |
| `reports/int-r11-*.md` | INT-R11 gate evidence (Wave 116 + Wave 117 stages) |

### 2.3 Metrics

| 维度 | 发现数 | Critical | High | Medium | Low |
| --- | :---: | :---: | :---: | :---: | :---: |
| 系统设计 (SD) | 2 | 0 | 1 | 0 | 1 |
| 运行模拟 (RS) | 4 | 0 | 3 | 0 | 1 |
| 工程实现 (EI) | 5 | 0 | 1 | 4 | 0 |
| 任务审查 (TR) | 2 | 0 | 1 | 1 | 0 |
| 代码审查 (CR) | 1 | 0 | 0 | 0 | 1 |
| **Total** | **14** | **0** | **6** | **5** | **3** |

**高信号结论**: Wave 116-118 声称"完成"且 `pnpm test` 1684/1693 pass，但一组反复出现在 wave-review 中却从未真正闭合的契约漂移仍然存在。它们的共同特征是"文档/类型层已修，运行时持久化/探测/写序层未跟进"。叠加后让 V8 的四个最不能撒谎的地方——host reality、exactly-one closure、provenance 分离、single heartbeat truth——同时失真。系统看起来在运行，但 operator 看到的 loop_status、closure ledger、memory projection 部分建立在伪造或半截的真相源上。

### 2.4 Sub-agent Result Correction Notes

三跑子代理均有事实误判，已通过直接 grep/read 核验纠正，以代码实际状态为准：

| 子代理误判 | 子代理结论 | 实际核验结论 | 纠正依据 |
| --- | --- | --- | --- |
| task-reviewer M-2 | `DegradedOperationResult.status` 仍含 `"degraded"` | **已闭合** | `src/shared/types/v8-contracts.ts:197` 实际为精确状态联合 |
| design-reviewer CH-DR-004 | closure schema 缺 proofRefsJson/traceRefsJson 列 | **schema 已加列，writer 未用** | `src/storage/db/index.ts:295-296` 有列；`v8-state-stores.ts:504-508` 仍塞 payloadJson |
| design-reviewer CH-DR-012 | EvidenceLevelClassifier 无晋级规则 | **已闭合（Round 4）** | `shared-v8-contracts.md §4.3` 已存在；`src/shared/evidence-level-classifier.ts` 已实现 |
| design-reviewer CH-DR-011 | SetupAck schema 未定义 | **已闭合（Round 4）** | `runtime-ops-system.md §3.2` 已定义；`src/shared/setup-ack.ts` 已实现 |
| code-reviewer D9 | host discovery 真实宿主探测已实现 | **未闭合** | `host-discovery-port.ts:84-103` 默认适配器仍只返回 `host_probe_unsupported` |
| code-reviewer D11 | CycleFinalizer 已实现幂等/写序/reconcile | **未闭合** | `cycle-finalizer.ts:66-165` 直接 insert，无重复检测/写序/reconcile |
| code-reviewer D14 | dream-runner 已移出 acceptMemoryProjection | **未闭合** | `dream-consolidation-runner.ts:271` 仍在 runner 内部循环调用 |
| code-reviewer H-1 | loop-stage-event-sink 未消费 proofRefs/traceRefs | **已闭合** | `loop-stage-event-sink.ts:153-166` 已读取并透传；`writeLoopStageEvent:964-965` 已用新列 |

---

## 3. 承诺模型摘要

| 承诺类型 | 承诺摘要 | 契约来源 | 当前失真风险 |
|---------|---------|---------|-------------|
| 结果承诺 | Evidence → Perception → Judgment → Action Closure → Quiet/Dream → Projection | PRD §3.1 / ADR-002,003 | dream-runner 直接 accept 模糊 candidate→accepted 边界（CH-40） |
| 状态承诺 | Memory 仅由 Quiet/Dream 形成；Projection lifecycle candidate→accepted→active→superseded | PRD §3.1 G5 / ADR-003 | 同上 |
| 时间承诺 | Evidence→Perception 2 heartbeat 内；Quiet 36h；Dream 6h after Quiet | PRD §3.1 G1 / shared-v8-contracts.md §3.3 | heartbeat-surface degraded 路径伪造空 cycleId/cycleSequence 破坏 cycleSequence 真相源（CH-39） |
| 错误承诺 | 统一 V8ReasonCode；精确状态 empty/partial/blocked/unavailable/unsafe | shared-v8-contracts.md §4.1 / §5 | degraded-classifier 覆盖不全，未列出 reason 默认 unavailable（CH-44） |
| 安全承诺 | Write-side 经 policy gate；provenance tiers 分离 | PRD §3.1 G2,G4 / ADR-004 / shared-v8-contracts.md §2.2 | closure writer 仍塞 payloadJson（CH-37）；guidance degraded 分支 proof 当 source（CH-41） |
| 审计承诺 | 100% Dream lifecycle trace；loop_status 定位 stalled stage | PRD §3.1 G6,G8 / ADR-005 | CycleFinalizer 无幂等且被绕过，closure ledger 可重复或丢失（CH-36） |
| 运行承诺 | Action dispatch 带 idempotency key；connector 执行有 proof | AC L1 §2.2 / §3.3 / §3.4 | 同 CH-36 |
| 宿主现实 | second_nature_ops 可见、SKILL.md 可发现 | runtime-ops-system.md §3.1 / T-ROS.R.5 | host-discovery 无真实宿主探测，正向路径只能靠 manual smoke（CH-38） |

---

## 4. Pre-Mortem

> 使用 `sequential-thinking` CLI 完成 5 步推演。场景：6 个月后 V8 living-loop 因实现未忠于设计/测试而失败。

| 失败原因 | 失真契约 | Root Cause | 证据 | 概率 | 影响 |
|---------|---------|-----------|------|:----:|:----:|
| closure ledger 重复或丢失，Quiet 输入基于错误 closure 集合 | 运行承诺 / 幂等 | CycleFinalizer 无幂等键/写序/reconcile；orchestrator 多处绕过 finalizeCycle 直接调 recordXxxClosure | `cycle-finalizer.ts:66-165`；`heartbeat-orchestrator.ts:511,537,565` | 🔴高 | 长期记忆形成基于错误输入 |
| loop_status 归因错位，operator 误判 stalled stage | 时间承诺 / cycleSequence 真相源 | heartbeat-surface v8 spine degraded 路径填 cycleId:''/cycleSequence:0 | `heartbeat-surface.ts:264-269` | 🔴高 | 错过修复窗口 |
| host reality 仍是 masquerading 镜像 | 宿主现实 | host-discovery 默认适配器只返回 unsupported，无真实 tool list 探测 | `host-discovery-port.ts:84-103`；`plugin/index.ts:478-522` | 🟠中高 | T-ROS.R.5 正向路径无代码实现 |
| memory projection 基于 policy proof 而非真实证据 | 安全承诺 / provenance tiers | guidance degraded 分支 sourceRefs: decision.proofRefs；closure writer 仍塞 payloadJson | `guidance-proposal-consumer.ts:143`；`v8-state-stores.ts:504-508` | 🟠中高 | 违反 ADR-003 长期记忆形成边界 |
| dream candidate→accepted 边界失真 | 状态承诺 / ADR-003 | dream-runner 在内部循环直接 acceptMemoryProjection | `dream-consolidation-runner.ts:271` | 🟡中 | 单元测试难以独立验证 candidate 状态 |

---

## 5. 核心发现清单

| ID | 类别 | 严重度 | 契约/Pass | 位置 | 发现 | 影响 | 建议 |
|----|------|--------|-----------|------|------|------|------|
| CH-36 | 运行模拟 / 运行承诺 | **High** | 幂等 / Contract Drift | `action-closure-policy-system.md §6.1a`；`src/core/second-nature/control-plane/cycle-finalizer.ts:66-165`；`src/core/second-nature/control-plane/heartbeat-orchestrator.ts:511,537,565` | CycleFinalizer doc comment 声称 "exactly-one closure invariant" 但 `finalizeCycle` 直接 insert 无重复检测、无写序协调、无重启 reconcile；且 orchestrator 多处仍绕过 finalizeCycle 直接调 recordPolicyOutcomeClosure/recordExecutionClosure | closure ledger 可重复或丢失；Quiet 输入和 loop_status 基于错误 closure 集合 | 实现 idempotency key（cycleId 唯一约束）、写序（state row 先 event 后）、周期启动 reconcile reader；将 orchestrator 所有 closure 调用统一经 finalizeCycle 单一入口 |
| CH-37 | 工程实现 / 安全承诺 | **High** | provenance tiers / Contract Drift | `shared-v8-contracts.md §2.2`；`src/storage/db/index.ts:295-296`；`src/storage/v8-state-stores.ts:500-508` | action_closure_record schema 已加 proof_refs_json/trace_refs_json 列，但 writeActionClosureRecord 仍把 proofRefs/traceRefs 序列化进 payloadJson，未用新列；与 loop_stage_event writer（已用新列）修复不对称 | closure provenance 无法直接查询/索引；provenance 分离在持久化层是半成品 | writeActionClosureRecord 改为写入 proofRefsJson/traceRefsJson 独立列，不再塞 payloadJson |
| CH-38 | 系统设计 / 宿主现实 | **High** | host reality / Task Drift | `runtime-ops-system.md §3.1`；`05A T-ROS.R.5`；`src/cli/host-capability/host-discovery-port.ts:84-103`；`plugin/index.ts:478-522` | T-ROS.R.5 "宿主可见 second_nature_ops" 正向路径无代码实现；默认适配器只返回 host_probe_unsupported，buildHostDiscoveryReport 同样直接返回 unsupported；setup_hint 使用 createDefaultHostDiscoveryPort() 而非真实宿主探测 | host reality 仍是 Wave 116 想消除的 masquerading 镜像（这次是反过来：只能报 unavailable，无法报 available）；INT-R11 自动化部分无法验证正向路径 | 提供基于 OpenClaw api 自省的 HostCapabilityDiscoveryPort 实现，或在文档明确 carrier 模式下由 manual smoke 承担并在 05B 标记"必须 manual host evidence" |
| CH-39 | 运行模拟 / 时间承诺 | **High** | cycleSequence 真相源 / Contract Drift | `control-plane-system.md §4.1`；`shared-v8-contracts.md §3.3`；`src/cli/ops/heartbeat-surface.ts:264-269` | v8 spine degraded 路径设置 cycleId:""/cycleSequence:0，伪造空值；下游按空 cycleId 查询 closure 得无意义结果 | loop_status 的 stalledAt 归因错位；operator 无法从 v8Spine 追溯实际失败 cycle | 使用 v8Result 中已有 cycleId/cycleSequence，或返回显式 v8_spine_degraded 结构而不填充空字段 |
| CH-40 | 运行模拟 / 状态承诺 | **High** | candidate→accepted 边界 / Contract Drift | `dream-quiet-memory-system.md §4.2/§8.3`；`src/core/second-nature/quiet-dream/dream-consolidation-runner.ts:271` | dream-consolidation-runner 仍在 runner 内部循环直接调用 acceptMemoryProjection，模糊 candidate generation 与 acceptance 边界 | 违反 ADR-003 长期记忆形成边界；单元测试难以独立验证 "candidate created but not accepted" 状态 | 将 acceptMemoryProjection 调用移出 runner，由 daily-rhythm-scheduler 或独立 projection lifecycle 步骤调用；runner 只返回 candidate 状态与 candidateIds |
| CH-41 | 工程实现 / 安全承诺 | **High** | provenance tiers / Contract Drift | `shared-v8-contracts.md §2.2`；`src/core/second-nature/guidance/guidance-proposal-consumer.ts:143` | degraded 分支 `sourceRefs: decision.proofRefs` 把 policy proof 当真实证据传入；主路径 :119 已正确分离，但 degraded 路径未跟进 | 若 Quiet/Dream 消费此 degraded result，会把 policy proof 误当真实证据，违反 provenance tier contract | degraded 分支改为 `sourceRefs: proposal.sourceRefs, proofRefs: decision.proofRefs` 分离 |
| CH-42 | 任务审查 | **High** | 任务承接 / Task Drift | `AGENTS.md` 状态块；`05A_TASKS.md` | AGENTS.md 声称 "Wave 118 release packaging complete; version 0.2.13 ready for upload"，但 05A_TASKS.md 无 Wave 118 段落、无 T-REL.* 任务条目；05B 无 Wave 118 验证计划 | 声称完成但任务清单无承接；违反"版本即法律"；无法追踪发布决策 | 在 05A 补充 Wave 118 段落（T-REL.C.1 version bump、T-REL.C.2 npm upload、T-REL.R.1 post-release smoke）；更新 05B 与 AGENTS.md |
| CH-43 | 工程实现 | **Medium** | envelope 契约 / Contract Drift | `runtime-ops-system.md §2`；`src/cli/commands/index.ts:163-171,222-235` | setup_hint/setup_ack 仍返回 {ok,command,surfaceMode,evidenceLevel,message,data}，缺 result/degraded/generatedAt | host/bridge 消费者期望 RuntimeOpsEnvelope 标准字段会解析失败 | payload 放 result，降级状态放 degraded，加 generatedAt |
| CH-44 | 工程实现 / 错误承诺 | **Medium** | 精确状态 / Contract Drift | `shared-v8-contracts.md §5`；`src/shared/degraded-status-classifier.ts:22-76` | 分类表覆盖 ~40 reason，V8ReasonCode 总数 >60；未列出 reason 默认 unavailable；如 host_tool_unavailable/host_policy_blocked/closure_idempotency_conflict 等会误分类 | stage-level 诊断不精确，违背 T-OBS.R.8 | 扩展分类表覆盖全部 V8ReasonCode，或文档化"未列出默认 unavailable"并补测试 |
| CH-45 | 工程实现 | **Medium** | 错误诊断 / Contract Drift | `src/cli/ops/ops-router.ts:883,2095,160-167` | normalizeEnvelopeResult 对缺 command 的分支返回通用 OPS_RESULT_NOT_AN_ENVELOPE，丢失 MISSING_FALLBACK_REF/unknown_ops_command 等 actionable code | operator 收到通用错误码无法定位根因 | 所有 dispatch 分支统一返回至少含 command 与 runtimeMode/surfaceMode 的对象；或非 envelope 分支优先透传 raw.error |
| CH-46 | 工程实现 | **Medium** | DRY / Architecture Fit | `src/shared/setup-ack.ts:66-147`；`plugin/index.ts:205-266` | plugin 仍重复实现 validateSetupAck/VALID_PLACEMENTS/VALID_WRITERS，未导入 src/shared/setup-ack.ts | setup-ack 规则变更时 CLI 与 plugin 可能不一致 | 将 src/shared/setup-ack.ts 加入 plugin runtime artifacts 并导入；或加 CI diff 检查 |
| CH-47 | 运行模拟 | **Medium** | v8-only operator model / Contract Drift | `runtime-ops-system.md §3.3`；`src/cli/ops/ops-router.ts:693-722` | v7 heartbeat 命令未被硬拒绝，而是委托 heartbeat_check 加 deprecation warning；与 CH-27 处方"返回 version_obsolete/command_unavailable"偏离 | operator 可能误用 v7 heartbeat 获得非 v8 cycle 结果 | 改为硬拒绝返回 version_obsolete/command_unavailable，或文档化"deprecated alias 委托"为有意决策 |
| CH-48 | 系统设计 | **Low** | SourceRef 契约 / Contract Drift | `shared-v8-contracts.md §2`；`src/shared/types/v8-contracts.ts:73` | SourceRefFamily 仍含未定义的 "projection"，与 "memory_projection" 语义关系不清 | 消费者无法解析 sn://projection/{id} | 移除 "projection" 或在 shared-v8-contracts.md §2 补充定义 |
| CH-49 | 系统设计 | **Low** | envelope 契约 / Contract Drift | `runtime-ops-system.md §2`；`src/cli/ops/ops-router.ts:109`；`src/cli/runtime/runtime-artifact-boundary.ts:14` | RuntimeOpsEnvelope.surfaceMode 含 cli/openclaw_tool/plugin_command/cron_probe，设计文档未声明 | 维护者无法从设计文档推导合法 surfaceMode 值 | 在 runtime-ops-system.md §2 显式定义 surfaceMode 取值与语义 |
| CH-50 | 工程实现 | **Low** | 单一入口 / Architecture Fit | `action-closure-policy-system.md §6.1a`；`src/core/second-nature/control-plane/heartbeat-orchestrator.ts` | closure 调用未完全集中到 finalizeCycle，orchestrator 多处直接调 recordXxxClosure | CycleFinalizer 的 exactly-one invariant 无法真正保证 | 将所有 closure 调用统一经 finalizeCycle 入口（与 CH-36 合并修复） |

---

## 6. 子代理结果摘要

### 6.1 Design Reviewer

| 维度 | 结论 | 关键证据 |
|------|------|----------|
| 系统设计 | 2 findings (0 Critical / 1 High / 0 Medium / 1 Low) | host-discovery 无真实探测（CH-38）；SourceRefFamily.projection 未定义（CH-48） |
| 运行模拟 | 4 findings (0 Critical / 3 High / 0 Medium / 1 Low) | CycleFinalizer 无恢复协议（CH-36）；heartbeat-surface 伪造空 cycleId（CH-39）；dream-runner 直接 accept（CH-40）；v7 heartbeat 未硬拒绝（CH-47） |
| 工程实现 | 5 findings (0 Critical / 1 High / 4 Medium / 0 Low) | closure provenance 塞 payloadJson（CH-37）；CLI setup envelope（CH-43）；degraded-classifier（CH-44）；plugin 重复 setup-ack（CH-46）；normalizeEnvelopeResult（CH-45） |

**纠正**: design-reviewer 重复报了 Round 4 已闭合的 EvidenceLevelClassifier（§4.3 已存在）、SetupAck schema（§3.2 已存在），并把 "schema 已加列但 writer 没用" 错描述为 "schema 缺列"。已以代码实际状态为准纠正。

### 6.2 Task Reviewer

| Pass | 结论 | 关键证据 |
|------|------|----------|
| A 重复检测 | Clean | Wave 116/117/118 内无重复 |
| B 歧义检测 | 1 Medium | T-ROS.R.6 surfaceMode 枚举漂移 |
| C 欠详述检测 | 1 High / 2 Medium | Wave 118 任务缺失（CH-42）；INT-R11 缺 manual host smoke 附录；T-DQ.R.9 placeholder 规则未在 05B 详述 |
| D 不一致性检测 | 2 Medium | 05B 滞后 Wave 117 三天；plugin 重复 setup-ack |
| E 覆盖率检测 | 9/9 REQ 已承接 | REQ-008/009 缺完整 E2E 链路证据 |
| F 质量粒度 | Clean | 粒度可执行 |
| G 契约覆盖 | 1 Low | SourceRefFamily.projection 未文档化 |

**纠正**: task-reviewer 误报 `DegradedOperationResult.status` 仍含 "degraded"（引用 wave-116-review 旧记录而非当前代码）。实际 `v8-contracts.ts:197` 已是精确状态。已纠正。

### 6.3 Code Reviewer

| Lens | 结论 |
|------|------|
| L1 契约忠实度 | Partial Pass — proofRefs/sourceRefs 分离在主路径已修，degraded 分支未修（CH-41）；closure writer 仍塞 payloadJson（CH-37） |
| L2 任务兑现 | Partial Pass — CycleFinalizer 框架存在但无幂等（CH-36）；host-discovery 无真实探测（CH-38） |
| L3 架构适配 | Partial Pass — plugin 重复 setup-ack（CH-46）；closure 调用未集中（CH-50） |
| L4 静态运行风险 | heartbeat-surface 伪造空 cycleId（CH-39） |
| L5 验证证据 | 缺 proofRefs 污染反例测试；缺 envelope 异常路径测试；缺 closure 独立列回归测试 |
| L6 回流一致性 | 05A Wave 118 缺失（CH-42）；05B 滞后 |

**纠正**: code-reviewer 误判 D9（host-discovery 标 Closed，实际未闭合）、D11（CycleFinalizer 标 Closed，实际无幂等）、D14（dream-runner 标 Closed，实际仍直接 accept）、H-1（loop-stage-event-sink 标 Open，实际已闭合）。已以直接代码核验为准纠正。

---

## 7. 建议行动清单

### P0 — 立即处理（阻塞 V8 living-loop 交付声明）

1. **[CH-36]** CycleFinalizer 实现 idempotency key（cycleId 唯一约束）、写序（state row 先 event 后）、周期启动 reconcile reader；将 orchestrator 所有 closure 调用统一经 finalizeCycle 单一入口（与 CH-50 合并）
2. **[CH-37]** writeActionClosureRecord 改为写入 proofRefsJson/traceRefsJson 独立列，不再塞 payloadJson
3. **[CH-38]** 提供基于 OpenClaw api 自省的 HostCapabilityDiscoveryPort 实现，或在文档明确 carrier 模式下由 manual smoke 承担并在 05B 标记"必须 manual host evidence"
4. **[CH-39]** heartbeat-surface v8 spine degraded 路径使用 v8Result 真实 cycleId/cycleSequence，或返回显式 v8_spine_degraded 结构
5. **[CH-40]** 将 acceptMemoryProjection 调用移出 dream-consolidation-runner，由 daily-rhythm-scheduler 或独立 projection lifecycle 步骤调用
6. **[CH-41]** guidance-proposal-consumer degraded 分支改为 sourceRefs: proposal.sourceRefs, proofRefs: decision.proofRefs 分离

### P1 — 近期处理

7. **[CH-42]** 在 05A 补充 Wave 118 任务段落；更新 05B 与 AGENTS.md
8. **[CH-43]** CLI setup_hint/setup_ack 对齐 RuntimeOpsEnvelope
9. **[CH-44]** degraded-status-classifier 扩展覆盖全部 V8ReasonCode
10. **[CH-45]** normalizeEnvelopeResult 非 envelope 分支优先透传 raw.error
11. **[CH-46]** plugin 导入 src/shared/setup-ack.ts 或加 CI diff 检查
12. **[CH-47]** v7 heartbeat 硬拒绝或文档化 deprecated alias 委托为有意决策

### P2 — 持续改进

13. **[CH-48]** 移除 SourceRefFamily.projection 或补充定义
14. **[CH-49]** 在 runtime-ops-system.md §2 定义 surfaceMode 枚举
15. **[CH-50]** 与 CH-36 合并修复
16. 补充 proofRefs 污染反例测试、envelope 异常路径测试、closure 独立列回归测试
17. Round 3 剩余 CH-17 ~ CH-23 排入后续重构 wave

---

## 8. 承诺闭合与假设验证摘要

| 项目 | 结论 | 证据 | 对应问题 |
|------|------|------|----------|
| 重复态 | Fail | CycleFinalizer 无幂等键，同一 cycleId 可重复 insert closure | CH-36 |
| 失败态 | Partial | degraded-classifier 覆盖不全；closure 写失败返回 degraded 但无 reconcile | CH-36, CH-44 |
| 默认态 | Partial | v7 heartbeat 默认委托而非硬拒绝；normalizeEnvelopeResult 默认丢错误码 | CH-45, CH-47 |
| 运行态 | Partial | dream-runner 直接 accept 模糊 lifecycle；closure provenance 塞 payloadJson | CH-37, CH-40 |
| 并发态 | Not tested | 无并发 closure 写入测试 | CH-36 |
| 观测态 | Partial | loop_stage_event provenance 已持久化；closure provenance 未持久化；heartbeat-surface 伪造空 cycleId | CH-37, CH-39 |
| 宿主现实 | Fail | host-discovery 无真实宿主探测 | CH-38 |
| provenance 分离 | Partial | 主路径已分离；degraded 分支未分离；closure 持久化层未分离 | CH-37, CH-41 |

---

## 9. ADR 影响追踪

| ADR 文件 | 引用该 ADR 的 SYSTEM_DESIGN | 影响说明 |
|---------|---------------------------|---------|
| ADR-002_LIVING_PERCEPTION_LOOP.md | perception-judgment / action-closure-policy / control-plane | CycleFinalizer 无幂等削弱 living-loop closure 可信度（CH-36） |
| ADR-003_QUIET_DREAM_LONG_TERM_MEMORY.md | dream-quiet-memory / state-memory | dream-runner 直接 accept 模糊 candidate→accepted 边界（CH-40） |
| ADR-004_PLATFORM_NEUTRAL_AUTONOMY_POLICY.md | action-closure-policy / body-tool / connector / guidance | closure provenance 塞 payloadJson + guidance degraded 分支 proof 当 source 违反 provenance tiers（CH-37, CH-41） |
| ADR-005_CAUSAL_LOOP_HEALTH.md | observability-health / runtime-ops / control-plane | heartbeat-surface 伪造空 cycleId 破坏 cycleSequence 真相源（CH-39） |

---

## 10. 最终判断

- [ ] 🟢 项目可继续，风险可控
- [x] 🟡 项目可继续，但需先解决 P0 问题
- [ ] 🔴 项目需要重新评估

**判断依据**: Round 5 发现 0 个 Critical、6 个 High、5 个 Medium、3 个 Low。无根本性阻断项，系统能运行、测试能过（1684/1693 pass）。但 6 个 High 全是"反复在 wave-review 出现却从未真正闭合"的契约漂移，共同特征是"文档/类型层已修，运行时持久化/探测/写序层未跟进"。叠加后让 V8 的四个最不能撒谎的地方——host reality、exactly-one closure、provenance 分离、single heartbeat truth——同时失真。不得在 P0 闭合前声明 V8 living-loop 已交付。

**Routing**:
- **建议**: 开 Wave 119 专门闭合 6 个 P0（CH-36 ~ CH-41），不得在闭合前声明 V8 living-loop 已交付。
- **AUTO 模式**: 不得自动穿过本关；需用户显式签名或先经 `/change` 闭合 P0。
- **测试增强**: Wave 119 应同步补充 proofRefs 污染反例测试、CycleFinalizer 幂等/并发测试、closure 独立列回归测试、host-discovery 真实探测测试。

---

## 11. Round 4 修复归档

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| CH-24 | `shared-v8-contracts.md §4.3` adds EvidenceLevelClassifier；`src/shared/evidence-level-classifier.ts` implemented | Closed (docs + impl) |
| CH-25 | `runtime-ops-system.md §3.1` adds HostCapabilityDiscoveryPort；`src/cli/host-capability/host-discovery-port.ts` implemented (fallback only — see CH-38) | Closed (docs) / Partial (impl) |
| CH-26 | `action-closure-policy-system.md §6.1a` adds CycleFinalizer protocol；`src/core/second-nature/control-plane/cycle-finalizer.ts` implemented (framework only — no idempotency, see CH-36) | Closed (docs) / Partial (impl) |
| CH-27 | `control-plane-system.md §4.1` / `runtime-ops-system.md §3.3` define v8-only operator heartbeat；v7 heartbeat delegated to heartbeat_check with deprecation warning (not hard-rejected — see CH-47) | Closed (docs) / Partial (impl) |
| CH-28 | `runtime-ops-system.md §3.1` / `05A T-ROS.R.7` define SkillDiscoveryProbe；implemented | Closed (docs + impl) |
| CH-29 | `05A/05B T-ROS.R.5` split automated plugin/host discovery proof from manual host smoke appendix | Closed (docs) / Partial (impl — manual smoke not executed, see CH-38) |
| CH-30 | `05A/05B` require rejecting unspecified ack, adding proofRefs/traceRefs, centralizing closure in CycleFinalizer；`src/shared/setup-ack.ts` rejects unspecified；closure recorder accepts proofRefs/traceRefs；CycleFinalizer exists (but orchestrator still bypasses it — see CH-36, CH-50) | Closed (docs) / Partial (impl) |
| CH-31 | `shared-v8-contracts.md §4.1` / `observability-health-system.md §6.1` align precise status；`src/shared/types/v8-contracts.ts:197` DegradedOperationResult.status now precise | Closed (docs + impl) |
| CH-32 | `perception-judgment-system.md §4.3` defines content_missing handoff；`src/connectors/base/normalized-evidence-content.ts` implemented | Closed (docs + impl) |
| CH-33 | `control-plane-system.md §4.2` / `dream-quiet-memory-system.md §4.3` define DailyRhythmTriggerRequest and scheduler ownership | Closed (docs) |
| CH-34 | `05A T-ROS.R.7` dependency changed to none | Closed (docs) |
| CH-35 | `05B` distinguishes automated host discovery/plugin evidence from manual host smoke appendix | Closed (docs) |

---

## 12. Round 3 Archive — Code Health (2026-06-16)

### 12.1 原 Round 3 问题总览

| 严重度 | 数量 | 摘要 |
|--------|------|------|
| **Critical** | 5 | SourceRef 契约漂移、v7/v8 双心跳无单一真相源、connector evidence 三重持久化、运行时神模块、双 status + SourceRef 序列化碎片化 |
| **High** | 6 | 控制平面直接依赖 StateDatabase、connector executor 越界、storage-guidance 循环依赖、observability 直接读 state 内部、console.warn 吞错误、测试重复与跳过用例 |
| **Medium** | 1 | `safeParseJson` 等 helper 重复 13 次 |

### 12.2 修复归档

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| CH-12 | Wave 112-113: canonical SourceRef object shape; removal of local clones; SourceRefTuple for v7 | Closed |
| CH-13 | Rolled into Round 4 / Wave 116 T-CP.R.5 (single external heartbeat model) → Round 4 CH-27 closed (docs) / partial (impl, see CH-47) | Closed via Round 4 |
| CH-14 | Partially addressed by Wave 109; remaining rolled into Round 4 / Wave 116 T-CS.R.9 + T-SH.R.6 → Round 4 CH-32 closed | Closed via Round 4 |
| CH-15 | closure scatter partially rolled into Round 4 / Wave 116 T-AC.R.2 (CycleFinalizer) → Round 4 CH-26 closed (docs) / partial (impl, see CH-36, CH-50) | Closed via Round 4 |
| CH-16 | Wave 114-115: single semantic status column; shared parseSourceRefs/serializeSourceRefs | Closed |
| CH-17 ~ CH-23 | Deferred to future refactoring waves (repository ports, telemetry/credential boundary decoupling, cycle dependency breakup, StateHealthPort, console.warn cleanup, test factories, helper unification) | Open / Deferred |

---

## 13. Round 2 修复归档（供追溯）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| CH-07 | `action-closure-policy-system.detail.md` adds guidance_unavailable / closure_downgraded_without_draft；05A/05B add guidance-unavailable dispatch/closure verification | Closed |
| CH-08 | `shared-v8-contracts.md §3.3` defines heartbeat rhythm contract；control-plane and observability detail use cycleSequence | Closed |
| CH-09 | `shared-v8-contracts.md §4.1` defines DegradedOperationResult and minimum degraded responses | Closed |
| CH-10 | `action-closure-policy-system.detail.md §3.4` defines idempotency retry matrix；05A/05B add duplicate retry verification | Closed |
| CH-11 | Filled in runtime-ops, control-plane, state-memory, body-tool, connector, guidance system designs | Closed |

---

## 14. Round 1 修复归档（供追溯）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| DR-01 ~ DR-06 | All closed via genesis v8 architecture and system design completion | Closed |
