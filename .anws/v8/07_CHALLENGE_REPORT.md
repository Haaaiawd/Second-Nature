# v8 Challenge Report — Round 3 (Code Health)

**Target Dir**: `.anws/v8`
**Review Date**: 2026-06-16
**REVIEW_MODE**: `CODE` (static code review; design review and task review skipped)
**Reviewer**: Nyx / multi-agent static analysis
**Scope**: `src/` + `tests/` duplication, architectural boundary drift, data-flow redundancy, complexity smells, and test health

---

## 1. 问题总览

### Round 1 / Round 2（已归档）

| Round | ID 范围 | 最高严重度 | 状态 |
|-------|---------|-----------|:----:|
| Round 1 | DR-01 ~ DR-06 | High | Closed |
| Round 2 | CH-07 ~ CH-11 | High | Closed |

### Round 3（当前活跃）

| 严重度 | 数量 | 摘要 |
|--------|------|------|
| **Critical** | 5 | SourceRef 契约漂移、v7/v8 双心跳无单一真相源、connector evidence 三重持久化、运行时神模块、双 status + SourceRef 序列化碎片化 |
| **High** | 6 | 控制平面直接依赖 StateDatabase、connector executor 越界、storage-guidance 循环依赖、observability 直接读 state 内部、console.warn 吞错误、测试重复与跳过用例 |
| **Medium** | 1 | `safeParseJson` 等 helper 重复 13 次 |

---

## 2. 审查摘要

### 2.1 Mode Detection

| Item | Result |
| --- | --- |
| Latest architecture version | `.anws/v8` |
| `05A_TASKS.md` | Present |
| `05B_VERIFICATION_PLAN.md` | Present |
| `src/` v8 implementation | Present and active (Wave 109) |
| Review mode | `CODE` — focused on static code health; design/task layers skipped because this round responds to explicit request for code duplication and structural debt |
| Design review | Skipped — `REVIEW_MODE = CODE` |
| Task review | Skipped — `REVIEW_MODE = CODE` |
| Code review | Executed via 5 parallel static-analysis agents + `code-reviewer` skill |

### 2.2 Evidence Sources

| Source | Purpose |
| --- | --- |
| `src/` | Implementation layer across all v8 systems |
| `tests/unit/`, `tests/integration/`, `tests/api/` | Verification duplication, fragility, skip coverage |
| `.anws/v8/01_PRD.md` | Product commitments (Living Perception Loop, memory formation) |
| `.anws/v8/02_ARCHITECTURE_OVERVIEW.md` | System inventory and dependency direction |
| `.anws/v8/03_ADR/` | Accepted decisions on loop, memory, autonomy policy, causal health |
| `.anws/v8/04_SYSTEM_DESIGN/` | L0/L1 port contracts per system |
| `.anws/v8/05A_TASKS.md` / `05B_VERIFICATION_PLAN.md` | Task and verification traceability |

### 2.3 Metrics

| 维度 | 发现数 | Critical | High | Medium | Low |
| --- | :---: | :---: | :---: | :---: | :---: |
| 契约忠实度 (L1) | 1 | 1 | 0 | 0 | 0 |
| 任务兑现 / 数据流 (L2) | 1 | 1 | 0 | 0 | 0 |
| 架构适配与复杂度 (L3) | 7 | 2 | 5 | 0 | 0 |
| 静态运行风险 (L4) | 2 | 1 | 1 | 0 | 0 |
| 验证证据 (L5) | 1 | 0 | 1 | 0 | 0 |
| 回流 / helper 重复 | 1 | 0 | 0 | 1 | 0 |
| **Total** | **13** | **5** | **6** | **1** | **0** |

**高信号结论**: v8 代码已完成 Wave 109 功能交付，但实现层严重偏离设计文档的端口边界。下一次功能增量或 bug 修复极可能触发跨系统 silent failure。

---

## 3. 承诺模型摘要

| 承诺类型 | 承诺摘要 | 契约来源 | 当前失真风险 |
|---------|---------|---------|-------------|
| 结果承诺 | Evidence → Perception → Judgment → Action Closure → Quiet/Dream → Projection | PRD §3.1 / ADR-002,003 | v7/v8 evidence 双轨导致 Perception 输入不完整或重复 |
| 状态承诺 | Memory 仅由 Quiet/Dream 形成；Projection 生命周期 candidate→accepted→active→superseded | PRD §3.1 G5 / ADR-003 | `status` + `lifecycleStatus` 双字段造成生命周期判读分歧 |
| 时间承诺 | Evidence→Perception 在 2 个 heartbeat 内；Quiet 36h stale；Dream 6h after Quiet | PRD §3.1 G1 / shared-v8-contracts.md §3.3 | 双 heartbeat 无单一 cycle 真相源，`stalled_at` 归因可能错位 |
| 错误承诺 | 统一 V8ReasonCode；默认失败路径降级而非崩溃 | shared-v8-contracts.md §4.1 / §5 | `console.warn` 吞错误，破坏 `DegradedOperationResult` 统一降级语义 |
| 安全承诺 | Write-side 经 policy gate；public technical 不误阻 | PRD §3.1 G2,G4 / ADR-004 | connector executor 直接构造 credential vault，边界泄露 |
| 审计承诺 | 100% Dream lifecycle trace；loop_status 定位 stalled stage | PRD §3.1 G6,G8 / ADR-005 | observability 直接读 storage schema，health 诊断与业务状态可能脱节 |
| 运行承诺 | Action dispatch 带 idempotency key；connector 执行有 proof | AC L1 §2.2 / §3.3 / §3.4 | 神模块内嵌 idempotency/closure 逻辑，部分失败路径可能重复写 closure |

---

## 4. Pre-Mortem

| 失败原因 | 失真契约 | Root Cause | 证据 | 概率 | 影响 |
|---------|---------|-----------|------|:----:|:----:|
| v8 perception 基于不完整或重复证据做判断 | 结果承诺 / Evidence→Perception | 同一 connector result 经 `mapLifeEvidence` (v7) 与 `normalizeConnectorEvidence` (v8) 分别持久化，去重规则不同；v8 perception 只读 `evidence_item` | `heartbeat-loop.ts:206-224`; `append-life-evidence.ts:27-89`; `evidence-normalizer.ts:151-257` | 高 | judgment 错误 → closure 错误 → 长期记忆污染 |
| 一次 heartbeat cycle 产生多个 closure 或丢失 closure | 运行承诺 / 幂等 | `heartbeat-orchestrator.ts` 一个函数串起所有 stage，idempotency 与 safety-net closure 散落在 orchestrator 与 recorder 中 | `heartbeat-orchestrator.ts:160-672`; `action-closure-recorder.ts:107-136` | 高 | exactly-once closure 契约被破坏 |
| loop_status 报告健康但实际业务状态已损坏 | 审计承诺 / 观测态 | observability 直接读 `StateDatabase` 与 `loop_stage_event`，而非通过健康端口；stage event 写失败时诊断失效 | `loop-status.ts:22-28`; `loop-stage-event-sink.ts:24-25`; `living-loop-health-gate.ts:20` | 中高 | operator 无法定位 root cause |
| connector 凭证或敏感配置在 executor 层泄露 | 安全承诺 | `connector-executor-adapter.ts` 直接导入 `createCredentialVault` 与 `decryptCredentialAtRest` | `connector-executor-adapter.ts:32-35` | 中 | 执行层拥有解密权限，违反最小权限 |
| 新增命令或 stage 再次扩大神模块 | 架构适配 | `ops-router.ts` 与 `heartbeat-orchestrator.ts` 未拆分为端口/处理器，新需求只能 inline 扩展 | `ops-router.ts:551-1945` (1875 LOC); `heartbeat-orchestrator.ts:160-672` (626 LOC) | 高 | 维护成本指数上升，review 无法覆盖组合爆炸 |

---

## 5. 核心发现清单

| ID | 类别 | 严重度 | 位置 | 发现 | 影响 | 建议 |
|----|------|--------|------|------|------|------|
| CH-12 | 契约忠实度 | **Critical** | `src/shared/types/source-ref.ts:14`; `src/shared/types/v8-contracts.ts:92`; `src/core/second-nature/types.ts:8`; `src/cli/host-capability/types.ts:17`; `src/storage/life-evidence/types.ts:18`; `src/storage/chronicle/session-chronicle-store.ts:15`; `src/storage/narrative/narrative-state-store.ts:6`; `src/storage/memory-store/memory-store-lifecycle.ts:6`; `src/storage/goal/agent-goal-store.ts:6`; `src/storage/relationship/relationship-memory-store.ts:6`; `src/shared/types/index.ts:7-9` | `SourceRef` 被定义成 3 种互不兼容的形状（tuple、v8 object、storage object、control-plane object），`shared/types/index.ts` 因冲突故意不重新导出 `v8-contracts`。 | 同名异构类型在跨系统传递时 silently 错配，refactor 搜索不可靠，grounding 链接可能断裂。 | 统一为 `src/shared/types/v8-contracts.ts` 的 object 形状；v7 tuple 重命名为 `SourceRefTuple`；删除存储模块本地克隆。 |
| CH-13 | 架构适配 | **Critical** | `src/core/second-nature/heartbeat/heartbeat-loop.ts:1-613`; `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:1-626`; `src/core/second-nature/control-plane/real-runtime-spine.ts:1-84` | v7 `heartbeat-loop.ts` 与 v8 `heartbeat-orchestrator.ts` 两个循环并存，`real-runtime-spine.ts` 仅包装 v8，未统一 cycle 真相源。 | 一个周期内可能产生两套互不可见的 state/audit/evidence；`loop_status` 无法确定哪个循环代表当前 cycle。 | 定义单一 `HeartbeatCycle` 端口，v7 循环作为 connector/life-evidence 适配器向 v8 cycle 输送 evidence，v8 orchestrator 拥有唯一 cycle trace。 |
| CH-14 | 数据流 / 任务兑现 | **Critical** | `src/core/second-nature/heartbeat/heartbeat-loop.ts:206-224`; `src/storage/life-evidence/append-life-evidence.ts:27-89`; `src/connectors/evidence-normalizer.ts:151-257`; `src/storage/db/schema/v8-entities.ts:20-45`; `src/storage/life-evidence/index.ts` | 同一 connector result 被 `mapLifeEvidence` (v7 `life_evidence_index` + FS artifact) 与 `normalizeConnectorEvidence` (v8 `evidence_item`) 分别持久化，去重规则分别是 UUID 与 `(platformId, contentHash)`。 | v7-only 证据对 v8 perception 不可见；v8 与 v7 去重规则不同导致重复计数；digest 与 loop health 可能基于残缺数据。 | 合并为单一 `ingestConnectorEvidence` port，v8 `evidence_item` 为真相源，v7 `life_evidence_index` 仅作兼容镜像。 |
| CH-15 | 架构适配 / 复杂度 | **Critical** | `src/cli/ops/ops-router.ts:551-1945` (1875 LOC); `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:160-672` (513 LOC 单一函数，嵌套深度 18) | `ops-router.ts` 一个 `dispatch` 处理所有 runtime 命令，`heartbeat-orchestrator.ts` 一个函数跑完 perceive→judge→propose→execute→close→rhythm。 | 违反单一职责与端口边界；新命令/新 stage 必须修改神文件，review 无法覆盖所有交互组合。 | `ops-router.ts` 按系统拆分为 `handlers/connector.ts`、`handlers/health.ts`、`handlers/dream.ts` 等；orchestrator 拆为 stage 函数 + pipeline runner。 |
| CH-16 | 静态运行风险 | **Critical** | `src/storage/db/schema/v8-entities.ts:100-106` (`action_closure_record`); `src/storage/db/schema/v8-entities.ts:136-145` (`dream_consolidation_run`); `src/storage/db/schema/v8-entities.ts:155-164` (`long_term_memory_projection`); `src/storage/db/schema/v8-entities.ts:182-186` (`heartbeat_cycle_trace`); `src/storage/db/schema/v8-entities.ts:201-208` (`loop_stage_event`); `src/core/second-nature/perception/perception-builder.ts:93-105`; `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:119-127`; `src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts:198-206` | 多个 v8 表同时存在 `status` 与 `lifecycleStatus`，且 `sourceRefsJson` 的 parse/serialize 在每个消费模块独立实现。 | 查询可能过滤错列导致 stale reads；同一 malformed JSON 在不同模块被不同解释， lifecycle 与 health 诊断可能不一致。 | 仅保留语义明确的单一状态列；`parseSourceRefs` / `serializeSourceRefs` 集中到 `src/shared/serialization.ts` 并强制复用。 |
| CH-17 | 架构适配 | **High** | `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:25`; `src/core/second-nature/perception/perception-builder.ts:25`; `src/core/second-nature/perception/judgment-engine.ts:25`; `src/core/second-nature/action/action-proposal-builder.ts:26`; `src/core/second-nature/action/action-closure-recorder.ts:24`; `src/core/second-nature/quiet-dream/daily-rhythm-scheduler.ts:26` | 控制平面与感知/判断/action/dream 模块直接导入 `StateDatabase` 与 `v8-state-stores.ts` 具体实现。 | 业务逻辑被钉到 sql.js/drizzle 细节；存储后端变更会波及所有语义系统；单元测试必须构造真实 DB 或大量 mock。 | 在 `core/second-nature` 定义 `EvidencePort`、`PerceptionPort`、`ClosurePort`、`DreamQuietPort` 等接口，由 `v8-state-stores.ts` 实现。 |
| CH-18 | 架构适配 / 安全边界 | **High** | `src/connectors/services/connector-executor-adapter.ts:32-35`; `src/connectors/services/connector-executor-adapter.ts:161-180`; `src/connectors/services/connector-executor-adapter.ts:728-771` | connector executor 直接依赖 `ObservabilityDatabase`、`ExecutionTelemetry`、`createCredentialVault`、`decryptCredentialAtRest`。 | connector 系统不再是纯执行边界，而是拥有解密与遥测写入权；违反 connector-system.md 的 trust/credential 分层。 | executor 只返回 `ConnectorResult`；telemetry 由调用方或装饰器写入；credential 通过 `CredentialContextPort` 传入，不在 executor 内解密。 |
| CH-19 | 架构适配 | **High** | `src/storage/state-api.ts:22-24`; `src/storage/services/persona-candidate-loader.ts:4`; `src/guidance/draft-narrative-outreach.ts:12-13`; `src/guidance/evidence-guidance.ts:6-7` | `storage` 导入 `guidance` 类型 (`PersonaCandidate`, `SceneContext`)，同时 `guidance` 导入 `storage` 存储内部类型，形成循环依赖。 | 低层 storage 依赖高层 guidance，任何 guidance 模型变更都会被迫反向修改 storage API。 | 将 `PersonaCandidate` / `SceneContext` 下沉到 `src/shared/types/`；guidance 通过只读端口消费 state，不导入 store 内部。 |
| CH-20 | 架构适配 / 可观测性 | **High** | `src/observability/loop-status.ts:22-28`; `src/observability/causal-loop-health.ts:24`; `src/observability/living-loop-health-gate.ts:20`; `src/observability/loop-stage-event-sink.ts:24-25` | observability 服务直接导入 `StateDatabase` 与 `v8-state-stores.ts`，而不是通过声明的健康端口读取 bounded read models。 | observability 与存储 schema 耦合；schema 变更会破坏健康诊断；测试困难。 | 定义 `StateHealthPort` 返回 stage counts、freshness、projection statuses；observability 只依赖该端口。 |
| CH-21 | 静态运行风险 | **High** | `src/core/second-nature/heartbeat/heartbeat-loop.ts:219,233,248,262`; `src/cli/ops/manual-run-dispatcher.ts:186,201,205`; `src/core/second-nature/quiet/run-source-backed-quiet.ts:84` | 关键失败路径使用 `console.warn` 吞掉错误，而不是返回 `DegradedOperationResult`。 | 失败对 operator/digest/health 不可见，系统可能以为 cycle 成功，实际 evidence append、breaker update、tool experience 已失败。 | 统一改为结构化降级结果，按 `shared-v8-contracts.md §4.1` 的 `DegradedOperationResult` 模式返回 reason code。 |
| CH-22 | 验证证据 | **High** | `tests/` 全量：`createStateDatabase(":memory:")` 出现 368 次；`createObservabilityDatabase(":memory:")` 出现 120 次；`.skip(` 出现 9 处 | 无共享 test factory，每个测试自行创建 DB/seed/fixture；多个集成测试用 `.skip` 跳过真实场景。 | DB bootstrap、凭证 seed、manifest 创建逻辑漂移；跳过的用例成为 silent regression 温床。 | 创建 `tests/support/factories.ts` 提供 `createTestStateDb`、`seedCredential`、`buildEvidenceItem` 等；重新启用或删除 skipped tests。 |
| CH-23 | helper 重复 | **Medium** | `src/storage/chronicle/session-chronicle-store.ts:70`; `src/storage/memory-store/memory-store-lifecycle.ts:83`; `src/storage/goal/agent-goal-store.ts:70`; `src/storage/narrative/narrative-state-store.ts:49`; `src/storage/relationship/relationship-memory-store.ts:52`; `src/storage/services/goal-lifecycle-store.ts:44`; `src/storage/services/diary-dream-store.ts:53`; `src/storage/services/embodied-context-state-port.ts:164`; `src/storage/services/history-digest-store.ts:38`; `src/storage/services/identity-profile-store.ts:23`; `src/storage/services/tool-experience-store.ts:26`; `src/storage/services/restore-snapshot-store.ts:86`; `src/dream/dream-input-loader.ts:38` | `safeParseJson` 在 13 个文件中重复实现，且 `hashSha256`、`randomUUID`、`nowIso` 等基础操作散落各处。 | 行为变更需要在十几处同步修改， inevitable drift；新模块继续复制旧实现。 | 新建 `src/shared/pure-utils.ts` 统一导出 `safeParseJson`、`hashSha256`、`generateUuid`、`nowIso` 等，并全局替换。 |

---

## 6. Lens 结果摘要

| Lens | 结论 | 关键证据 |
|------|------|----------|
| L1 契约忠实度 | Fail | `SourceRef` 同名异构 (`source-ref.ts:14` vs `v8-contracts.ts:92` vs `types.ts:8`) |
| L2 任务兑现与交付闭合 | Fail | v7/v8 evidence 双写 (`heartbeat-loop.ts:206-224`) |
| L3 架构适配与复杂度健康 | Fail | 神模块 (`ops-router.ts:551-1945`, `heartbeat-orchestrator.ts:160-672`); 37 处 `StateDatabase` 直接导入 |
| L4 静态运行风险与安全边界 | Fail | `console.warn` 吞错误 (`heartbeat-loop.ts:219,233,248,262`); 双 status 列 (`v8-entities.ts:100-106,136-145,155-164`) |
| L5 验证证据与可观测性 | Partial Fail | 368 次 inline DB 创建；9 个 `.skip`；observability 直接读 state DB |
| L6 回流一致性与交接证据 | Pass | README / AGENTS / plugin docs 已同步当前 Wave 109 状态；问题仅在于实现与文档边界不符 |

---

## 7. 建议行动清单

### P0 — 立即处理（阻断 /forge）

1. **[CH-12]** 统一 `SourceRef`：以 `src/shared/types/v8-contracts.ts:92` 为 canonical object；v7 tuple 重命名；删除所有本地克隆。
2. **[CH-13]** 统一心跳 cycle：让 v8 orchestrator 成为唯一 cycle owner；v7 heartbeat-loop 降级为 connector/evidence 适配器。
3. **[CH-14]** 单一 evidence 摄入 port：v8 `evidence_item` 为真相源，v7 `life_evidence_index` 作为只读兼容镜像。
4. **[CH-15]** 拆分神模块：
   - `ops-router.ts` → `src/cli/ops/handlers/*.ts` + 命令注册表
   - `heartbeat-orchestrator.ts` → `perceive / judge / propose / evaluatePolicy / dispatch / recordClosure / advanceRhythm` stage 函数 + pipeline runner
5. **[CH-16]** 消除双 status + 集中 SourceRef 序列化：
   - 每表只保留一个语义状态列
   - `parse/serializeSourceRefs` 移到 `src/shared/serialization.ts` 并全局复用

### P1 — forge 之前修复

6. **[CH-17]** 在 `core/second-nature` 定义 repository ports，移除 `StateDatabase` 直接导入。
7. **[CH-18]** 将 `ExecutionTelemetry` 写出与 credential 解密移出 connector executor adapter。
8. **[CH-19]** 打破 `storage ↔ guidance` 循环：把共享类型下沉到 `src/shared/types/`。
9. **[CH-20]** 为 observability 引入 `StateHealthPort`，禁止直接 import `StateDatabase`。
10. **[CH-21]** 将 `console.warn` 失败路径统一改为 `DegradedOperationResult`。
11. **[CH-22]** 建立 `tests/support/` 工厂与 fixtures；重新启用或删除 9 个 skipped tests。

### P2 — 后续持续改进

12. **[CH-23]** 建立 `src/shared/pure-utils.ts`，统一 `safeParseJson` / hash / UUID / ISO timestamp。
13. 引入架构 lint 规则：禁止 `src/storage/**` import `src/guidance/**`；禁止 `src/connectors/**` import `src/observability/db/**`；禁止 `src/core/second-nature/**` 直接 import `StateDatabase`（port 实现除外）。
14. 将 `payloadJson` bag 升级为版本化 Zod schema（`PerceptionPayload`、`JudgmentPayload`、`QuietReviewPayload` 等）。

---

## 8. 承诺闭合与假设验证摘要

| 项目 | 结论 | 证据 | 对应问题 |
|------|------|------|----------|
| 重复态 | Fail | evidence 三重持久化、closure idempotency 分散在 orchestrator 与 recorder | CH-14, CH-15, CH-16 |
| 失败态 | Fail | `console.warn` 吞错误，未统一 `DegradedOperationResult` | CH-21 |
| 默认态 | Pass | `no_data`、`no_action`、`empty_input` 等状态已显式定义 | N/A |
| 运行态 | Fail | v7/v8 双循环，无单一 cycle 真相源 | CH-13 |
| 并发态 | Cannot confirm | 无显式并发代码；需运行时验证 | N/A |
| 观测态 | Fail | observability 直接读 state DB / stage event 作为 closure 真相源 | CH-20, CH-21 |
| 任务承接 | Pass | 05A/05B 任务与验收项完整，但验证基础设施薄弱 | CH-22 |

---

## 9. ADR 影响追踪

| ADR 文件 | 引用该 ADR 的 SYSTEM_DESIGN | 影响说明 |
|---------|---------------------------|---------|
| ADR-002_LIVING_PERCEPTION_LOOP.md | perception-judgment-system.md / action-closure-policy-system.md / control-plane-system.md | v7/v8 双循环与 evidence 双写直接违背单一 living loop 承诺；需重构统一 cycle |
| ADR-003_QUIET_DREAM_LONG_TERM_MEMORY.md | dream-quiet-memory-system.md / state-memory-system.md | `status` + `lifecycleStatus` 双字段使 projection 生命周期模糊；需统一 |
| ADR-004_PLATFORM_NEUTRAL_AUTONOMY_POLICY.md | action-closure-policy-system.md / body-tool-system.md / connector-system.md / guidance-voice-system.md | connector executor 直接解密 credential 违反最小权限与平台中立执行边界 |
| ADR-005_CAUSAL_LOOP_HEALTH.md | observability-health-system.md / runtime-ops-system.md / control-plane-system.md | observability 直接读 state DB / 吞错误破坏 causal loop health 的 reason-code 与诊断可信度 |

---

## 10. 最终判断

- [ ] 项目可继续，风险可控
- [x] 项目可继续，但需先解决 P0 问题
- [ ] 项目需要重新评估

**判断依据**: Round 3 发现 5 个 Critical、6 个 High、1 个 Medium。CH-12 ~ CH-16 属于结构性阻断问题，不修复即继续 `/forge` 会导致返工成本指数级上升。

**Routing**:
- **不得默认进入 `/forge`**。应先通过 `/change` 或专门的重构 wave 收敛 P0/P1。
- 推荐顺序：先止血（CH-12, CH-16）→ 再统一循环与 evidence（CH-13, CH-14）→ 再拆神模块（CH-15）→ 最后 ports 与测试基建（CH-17~CH-23）。
- 全部 Critical/High 关闭后，方可重新 challenge 并进入下一轮 `/forge`。

---

## 11. Round 3 修复归档（待后续填写）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| CH-12 | TBD | Open |
| CH-13 | TBD | Open |
| CH-14 | TBD | Open |
| CH-15 | TBD | Open |
| CH-16 | TBD | Open |
| CH-17 | TBD | Open |
| CH-18 | TBD | Open |
| CH-19 | TBD | Open |
| CH-20 | TBD | Open |
| CH-21 | TBD | Open |
| CH-22 | TBD | Open |
| CH-23 | TBD | Open |

---

## 12. Round 2 修复归档（供追溯）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| CH-07 | `action-closure-policy-system.detail.md` 增加 `guidance_unavailable` / `closure_downgraded_without_draft`；`05A_TASKS.md` 移除 T-AC.C.3 对 T-GVS.C.1 的硬依赖；`05B_VERIFICATION_PLAN.md` 增加 guidance-unavailable dispatch/closure 验证 | Closed |
| CH-08 | `shared-v8-contracts.md §3.3` 定义 heartbeat rhythm contract；`control-plane-system.md` 和 `observability-health-system.detail.md` 明确 heartbeat-count SLA 使用 `cycleSequence` | Closed |
| CH-09 | `shared-v8-contracts.md §4.1` 定义 `DegradedOperationResult` 和 state unreadable/source unresolved/guidance unavailable 最小响应 | Closed |
| CH-10 | `action-closure-policy-system.detail.md §3.4` 定义 idempotency retry matrix；`05A/05B` 增加 duplicate retry 验证 | Closed |
| CH-11 | 补齐 `runtime-ops-system.md`, `control-plane-system.md`, `state-memory-system.md`, `body-tool-system.md`, `connector-system.md`, `guidance-voice-system.md` | Closed |

---

## 13. Round 1 修复归档（供追溯）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| DR-01 | `shared-v8-contracts.md` 定义 `HeartbeatCycleTrace` 和 `LoopStageEvent.cycleSequence` | Closed |
| DR-02 | `shared-v8-contracts.md` 定义 `MemoryReviewCandidateClosure`；action closure 和 Dream/Quiet L1 路由 `remember` 通过 `remember_for_review` | Closed |
| DR-03 | `shared-v8-contracts.md` 定义单一 action registry 和 connector capability side-effect classification | Closed |
| DR-04 | `shared-v8-contracts.md` 定义结构化 `SourceRef`；L0/L1 文档使用 `SourceRef[]` | Closed |
| DR-05 | `PerceptionCard` 和 memory-review closure 包含 `reviewPriority`；Dream/Quiet 消费 memory review candidates | Closed |
| DR-06 | `shared-v8-contracts.md` 定义 canonical reason codes；DQ 和 OBS 使用 shared code | Closed |
