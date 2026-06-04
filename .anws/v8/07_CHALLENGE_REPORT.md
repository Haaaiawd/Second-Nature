# v8 Challenge Report

**Target Dir**: `.anws/v8`
**Review Date**: 2026-06-01
**REVIEW_MODE**: `FULL` (DESIGN + TASKS; code skipped — no v8 implementation yet)
**Reviewer**: Nyx / Codex parent session + sequential-thinking Pre-Mortem
**Scope**: PRD, Architecture Overview, ADRs, System Designs (L0/L1), Shared Contracts, Tasks, Verification Plan

---

## 1. 问题总览

### Round 1（已归档）

| ID 范围 | 最高严重度 | 摘要 | 状态 |
|---------|-----------|------|:----:|
| DR-01 ~ DR-06 | High | 条约矛盾/毁约逻辑/升级公式/领地缺失 | ✅ 全部修复 |

### Round 2（当前活跃）

| 严重度 | 数量 | 摘要 | 状态 |
|--------|------|------|:----:|
| Critical | 0 | — | — |
| High | 1 | T-GVS.C.1 P1 阻塞 Sprint S3 P0 核心路径 | ✅ 已修复 |
| Medium | 4 | 时间口径混合、降级语义不一致、幂等语义缺失、设计文档覆盖不全 | ✅ 已修复 |
| Low | 0 | — | — |

---

## 2. 审查摘要

### 2.1 Mode Detection

| Item | Result |
| --- | --- |
| Latest architecture version | `.anws/v8` |
| `05A_TASKS.md` | Present |
| `05B_VERIFICATION_PLAN.md` | Present |
| `src/` v8 implementation | Not started (perception/, judgment/, action/, policy/ dirs do not exist) |
| Review mode | `FULL` (DESIGN + TASKS) |
| Task review | Executed — 05A/05B read and cross-checked against PRD/ADR/System Designs |
| Code review | Skipped — no v8 implementation code exists yet |

### 2.2 Evidence Sources

| Source | Purpose |
| --- | --- |
| `.anws/v8/01_PRD.md` | Product commitments, REQ/US, Definition of Done. |
| `.anws/v8/02_ARCHITECTURE_OVERVIEW.md` | System inventory, dependency direction, boundary rationale. |
| `.anws/v8/03_ADR/*.md` | Accepted cross-system decisions. |
| `.anws/v8/04_SYSTEM_DESIGN/*.md` | L0/L1 system contracts for 4 reviewed systems + shared contracts. |
| `.anws/v8/05A_TASKS.md` | Task decomposition, sprint roadmap, REQ coverage overlay. |
| `.anws/v8/05B_VERIFICATION_PLAN.md` | Verification layering, contract coverage, traceability matrix. |

### 2.3 Metrics

| 维度 | 发现数 | Critical | High | Medium | Low |
| --- | :---: | :---: | :---: | :---: | :---: |
| 系统设计 | 1 | 0 | 0 | 1 | 0 |
| 运行模拟 | 2 | 0 | 0 | 2 | 0 |
| 工程实现 | 1 | 0 | 0 | 1 | 0 |
| 任务承接 | 1 | 0 | 1 | 0 | 0 |
| **Total** | **5** | **0** | **1** | **4** | **0** |

**高信号结论**: Round 1 的契约修复方向正确；Round 2 的关键路径优先级错配、时间口径、跨系统降级语义、幂等重试和 L0 覆盖缺口均已闭合。v8 可进入下一步。

---

## 3. 承诺模型摘要

| 承诺类型 | 承诺摘要 | 契约来源 | 失真风险 |
|---------|---------|---------|---------|
| 结果承诺 | Evidence → Perception → Judgment → Action Closure → Quiet/Dream → Projection | PRD §3.1 / ADR-002,003 | 任务优先级阻塞导致 closure 路径不全 |
| 状态承诺 | Memory 仅由 Quiet/Dream 形成；Projection 生命周期 candidate→accepted→active→superseded | PRD §3.1 G5 / ADR-003 | Round 1 已修复，当前 Pass |
| 时间承诺 | Evidence→Perception 在 2 个 heartbeat 内；Quiet 36h stale；Dream 6h after Quiet | PRD §3.1 G1 / shared-v8-contracts.md §3.3 / OBS L1 §1.1 | 已区分 cycleSequence heartbeat-count SLA 与 wall-clock freshness |
| 错误承诺 | 统一 V8ReasonCode；默认失败路径降级而非崩溃 | shared-v8-contracts.md §4.1 / §5 | 已定义 cross-system degraded response |
| 安全承诺 | Write-side 经 policy gate；public technical 不误阻 | PRD §3.1 G2,G4 / ADR-004 | Round 1 已修复，当前 Pass |
| 审计承诺 | 100% Dream lifecycle trace；loop_status 定位 stalled stage | PRD §3.1 G6,G8 / ADR-005 | 重试场景下 closure 是否重复记录未定义 |
| 运行承诺 | Action dispatch 带 idempotency key；connector 执行有 proof | AC L1 §2.2 / §3.3 / §3.4 | closure retry/duplicate 语义已定义 |

---

## 4. Pre-Mortem

| 失败原因 | 失真契约 | Root Cause | 证据 | 概率 | 影响 |
|---------|---------|-----------|------|:----:|:----:|
| Sprint S3 无法验收 | 任务承接 / closure 承诺 | 原因是 T-GVS.C.1 P1 阻塞 T-AC.C.3 P0；已通过 T-AC.C.3 guidance-unavailable fallback 修复 | 05A_TASKS.md §T-AC.C.3 deps; AC L1 §3.3 | ✅关闭 | S3 可在无 guidance 时验收 closure |
| `stalled_at` 在不同环境判定不一致 | 时间承诺 / cycle 语义 | 已由 heartbeat rhythm contract 定义 cycleSequence 与 wall-clock 分工 | shared-v8-contracts.md §3.3; control-plane-system.md §6 | ✅关闭 | operator 诊断口径固定 |
| state 故障时 operator 无法定位 root cause | 错误承诺 / 降级语义 | 已定义 `DegradedOperationResult` 和 state unreadable 最小响应 | shared-v8-contracts.md §4.1; state-memory-system.md §6 | ✅关闭 | root cause 可归因 ownerStage |
| 重试导致重复外部 write | 运行承诺 / 幂等 | 已定义 `idempotencyKey`, `retryOfClosureId`, `dispatchAttempt` 与 duplicate 行为 | AC L1 §2.2 / §3.4; connector-system.md §6 | ✅关闭 | duplicate write 有闭环规则 |

---

## 5. 核心发现清单

| ID | 类别 | 严重度 | 契约/Pass | 位置 | 发现 | 影响 | 建议 |
|----|------|--------|-----------|------|------|------|------|
| CH-07 | 任务承接 | **High** | P0 路径被 P1 阻塞 | 05A_TASKS.md §T-AC.C.3 / §T-GVS.C.1 | T-AC.C.3 (P0) 曾依赖 T-GVS.C.1 (P1)；已拆出不依赖 guidance 的 `guidance_unavailable` 降级 dispatch result | S3 可在无 guidance 时产生 `closure_downgraded_without_draft` 并验收 closure | ✅ Closed：T-AC.C.3 移除 T-GVS.C.1 硬依赖，AC L1/05A/05B 增加 fallback contract |
| CH-08 | 运行模拟 | Medium | 时间承诺 | OBS L1 §1.1 / Arch §System 2 | heartbeat-count SLA 与 wall-clock SLA 曾混用；已在 shared contracts/control-plane/observability 中定义分工 | `stalled_at` 使用 `cycleSequence`，wall-clock 仅作 freshness/diagnostic | ✅ Closed：新增 heartbeat rhythm contract |
| CH-09 | 失败语义 | Medium | 错误承诺 | shared-v8-contracts.md §4.1 | state unreadable 曾缺少跨系统统一语义；已定义 `DegradedOperationResult` 和 root-cause ownerStage | operator 可按 ownerStage 定位 root cause | ✅ Closed：新增 cross-system degraded response |
| CH-10 | 写操作副作用 | Medium | 运行承诺 | AC L1 §3.4 / 05B §T-AC.C.4 | closure 层曾缺少 retry/duplicate 规则；已定义 idempotency retry matrix | duplicate external write 和 unlinked closure 可被验证 | ✅ Closed：补 closure idempotency semantics |
| CH-11 | 设计完整性 | Medium | 架构契约 | 04_SYSTEM_DESIGN/ | 10 个系统曾仅 4 个有 L0/L1；现已补齐 6 个缺失 L0 文档 | 05A 引用链不再悬空 | ✅ Closed：补齐 control/state/body/connector/guidance/runtime L0 |

---

## 6. 建议行动清单

### P0 — 立即处理（阻塞）
1. **[CH-07]** ✅ Closed：T-AC.C.3 已移除 T-GVS.C.1 硬依赖，并定义 guidance 不可用时以 `closure_downgraded_without_draft` 闭环。

### P1 — 近期处理（重要）
2. **[CH-08]** ✅ Closed：`shared-v8-contracts.md §3.3` 与 `control-plane-system.md` 定义 heartbeat rhythm contract。
3. **[CH-09]** ✅ Closed：`shared-v8-contracts.md §4.1` 定义 cross-system degraded response。
4. **[CH-10]** ✅ Closed：`action-closure-policy-system.detail.md §3.4` 定义 closure retry/duplicate 语义。

### P2 — 持续改进（优化）
5. **[CH-11]** ✅ Closed：6 个缺失 L0 系统设计文档已补齐，04_SYSTEM_DESIGN 与 Architecture system inventory 对齐。

---

## 7. 承诺闭合与假设验证摘要

| 项目 | 结论 | 证据 | 对应问题 |
|------|------|------|----------|
| 重复态 | Pass | closure retry/duplicate 语义已定义 | CH-10 |
| 失败态 | Pass | cross-system degraded response 已定义 | CH-09 |
| 默认态 | Pass | no_data、no_action、empty-input 状态显式定义 | N/A |
| 运行态 | Pass | heartbeat rhythm contract 已区分 cycleSequence 与 wall-clock | CH-08 |
| 并发态 | Pass | 无显式并发冲突场景；state ports 隐式串行 | N/A |
| 观测态 | Pass | stage events、audit trace、redaction 契约完整 | N/A |
| 任务承接 | Pass | P0/P1 阻塞与文档引用悬空均已关闭 | CH-07, CH-11 |

---

## 8. ADR 影响追踪

| ADR 文件 | 引用该 ADR 的 SYSTEM_DESIGN | 影响说明 |
|---------|---------------------------|---------|
| ADR-002_LIVING_PERCEPTION_LOOP.md | perception-judgment-system.md §8.1 / action-closure-policy-system.md §8.2 / control-plane-system.md §8 | cycle semantics 已由 heartbeat rhythm contract 闭合 |
| ADR-003_QUIET_DREAM_LONG_TERM_MEMORY.md | dream-quiet-memory-system.md §8.1 / state-memory-system.md §8 | memory boundary 与 state storage 边界已闭合 |
| ADR-004_PLATFORM_NEUTRAL_AUTONOMY_POLICY.md | action-closure-policy-system.md §8.1 / body-tool-system.md §8 / connector-system.md §8 / guidance-voice-system.md §8 | taxonomy、capability、connector、guidance 边界已闭合 |
| ADR-005_CAUSAL_LOOP_HEALTH.md | observability-health-system.md §8.1 / runtime-ops-system.md §8 / control-plane-system.md §8 | reason-code registry、loop_status、ops surface 已闭合 |

---

## 9. 最终判断

- [x] 🟢 项目可继续，风险可控
- [ ] 🟡 项目可继续，但需先解决 P0 问题
- [ ] 🔴 项目需要重新评估

**判断依据**: Round 2 发现 1 个 High（CH-07）和 4 个 Medium；CH-07~CH-11 均已通过契约、任务、验证计划或 L0 文档补齐关闭。无 Critical 问题，架构主方向继续成立。

**Routing**:
- 可进入 `/blueprint` 收尾或进入 `/forge` 前最终确认。
- 若采取保守流程，可对补齐后的 05A/05B 再跑一次快速 `/challenge`。

---

## 10. Round 2 修复归档（供追溯）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| CH-07 | `action-closure-policy-system.detail.md` 增加 `guidance_unavailable` / `closure_downgraded_without_draft`；`05A_TASKS.md` 移除 T-AC.C.3 对 T-GVS.C.1 的硬依赖；`05B_VERIFICATION_PLAN.md` 增加 guidance-unavailable dispatch/closure 验证 | ✅ Closed |
| CH-08 | `shared-v8-contracts.md §3.3` 定义 heartbeat rhythm contract；`control-plane-system.md` 和 `observability-health-system.detail.md` 明确 heartbeat-count SLA 使用 `cycleSequence` | ✅ Closed |
| CH-09 | `shared-v8-contracts.md §4.1` 定义 `DegradedOperationResult` 和 state unreadable/source unresolved/guidance unavailable 最小响应 | ✅ Closed |
| CH-10 | `action-closure-policy-system.detail.md §3.4` 定义 idempotency retry matrix；`05A/05B` 增加 duplicate retry 验证 | ✅ Closed |
| CH-11 | 补齐 `runtime-ops-system.md`, `control-plane-system.md`, `state-memory-system.md`, `body-tool-system.md`, `connector-system.md`, `guidance-voice-system.md` | ✅ Closed |

---

## 11. Round 1 修复归档（供追溯）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| DR-01 | `shared-v8-contracts.md` 定义 `HeartbeatCycleTrace` 和 `LoopStageEvent.cycleSequence` | ✅ Closed |
| DR-02 | `shared-v8-contracts.md` 定义 `MemoryReviewCandidateClosure`；action closure 和 Dream/Quiet L1 路由 `remember` 通过 `remember_for_review` | ✅ Closed |
| DR-03 | `shared-v8-contracts.md` 定义单一 action registry 和 connector capability side-effect classification | ✅ Closed |
| DR-04 | `shared-v8-contracts.md` 定义结构化 `SourceRef`；L0/L1 文档使用 `SourceRef[]` | ✅ Closed |
| DR-05 | `PerceptionCard` 和 memory-review closure 包含 `reviewPriority`；Dream/Quiet 消费 memory review candidates | ✅ Closed |
| DR-06 | `shared-v8-contracts.md` 定义 canonical reason codes；DQ 和 OBS 使用 shared code | ✅ Closed |
