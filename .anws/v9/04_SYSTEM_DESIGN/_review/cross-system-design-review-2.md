# v9 System Design Cross-System Review Report — Round 2

**Review Scope**: All `.anws/v9/04_SYSTEM_DESIGN/*.md` files + constraint sources (`01_PRD.md`, `02_ARCHITECTURE_OVERVIEW.md`, `03_ADR/ADR_002`–`ADR_006`).
**Review Date**: 2026-06-22
**Reviewer Role**: System Design Reviewer
**Output Rule**: Read-only review; no reviewed files modified.

---

## 1. 执行摘要 (Executive Summary)

**Highest Severity**: **High**

**Total Findings**: 19

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 4 |
| Medium | 5 |
| Low | 5 |
| Note | 5 |

**Compatibility Verdict**: **Conditional Pass — proceed to `/challenge` after closing 4 High findings.**

上一轮 4 个 Critical、9 个 High 以及 `character-continuity-boundary-review.md` 中的 6 个 Must-fix 项**已经全部关闭**。`shared-v9-contracts.md` 成功承担了跨系统 canonical schema 的角色，`AutonomousChangeLedger` 所有权、`SelfContinuityCard`/`CharacterFrame` schema、`ConnectorEvolutionPlan` 边界、ToolRoutine enum、AttentionSignal 存储对齐、SourceRef 统一、sandbox policy、action-closure L1、character-continuity L1 等关键冲突均已解决。

但第二轮审查发现 **4 个新的 High 级别不一致**，全部集中在 `shared-v9-contracts.md` 与具体系统 L0/L1 之间的核心实体 schema 漂移。这些漂移若带入 `/challenge` 和 `/forge`，会导致跨系统序列化、类型推导和验收测试冲突。建议在 `/challenge` 前完成一次 canonical contract 同步修复。

---

## 2. 上一轮修复状态表

### 2.1 Critical 关闭状态

| ID | 问题 | 状态 | 关闭证据 |
|----|------|:----:|----------|
| CR-01 | `AutonomousChangeLedger` schema/owner/write location 不一致 | **Closed** | `shared-v9-contracts.md` §8 明确定义 owner=`observability-recovery-system` 及 `AutonomousChangeLedgerWritePort`；`memory-continuity-system.md` §1.2 / `body-connector-system.md` §1.2 / `runtime-ops-system.detail.md` §2.7 均明确 ledger owner 为 `observability-recovery-system`；`action-closure-policy-system.detail.md` §2.4/§3.4 关闭 OPEN-03。 |
| CR-02 | `SelfContinuityCard` 在 structured fields 与 opaque `cardText` 之间分裂 | **Closed** | `shared-v9-contracts.md` §4 统一定义 runtime/read model 与 storage shape；`memory-continuity-system.detail.md` §2 `SelfContinuityCard` 字段表与 canonical shape 一致；`control-context-system.md` §6.1 `EmbodiedContext` 使用 structured card。 |
| CR-03 | `CharacterFrame` / `CharacterFramePointer` status enums 矛盾 | **Closed** | `shared-v9-contracts.md` §5 分离 `CharacterFrameStatus` (`candidate/accepted/rejected/retired/superseded`) 与 `CharacterFramePointerStatus` (`active/deferred/contested/superseded`)；`character-continuity-system.detail.md` §2.1 重申；`control-context-system.detail.md` §3.5 只加载 `accepted+active`。 |
| CR-04 | `ConnectorEvolutionPlan` planning boundary 模糊 | **Closed** | `memory-continuity-system.md` §5.1 `applyConnectorEvolutionPlan(plan, bodyConnectorApplyPort)` 明确 Dream 生成 plan；`body-connector-system.md` §5.1 声明 `planConnectorEvolution` 非公共契约；`body-connector-system.detail.md` §3.7 `deriveTargetVersion` 标记为 internal helper；`memory-continuity-system.detail.md` §3.6 / `body-connector-system.detail.md` §3.8 明确 Dream→gates→ledger→rollback hint 序列。 |

### 2.2 High 关闭状态

| ID | 问题 | 状态 | 关闭证据 |
|----|------|:----:|----------|
| HI-01 | `ToolRoutine` lifecycle/status enum 不一致 | **Closed** | `shared-v9-contracts.md` §6 定义 canonical `RoutineRegistryStatus = candidate/validated/active/retired`，`RoutineListItem.status` 映射为 `installed/disabled/rollback`；`body-connector-system.detail.md` §2 `RoutineStatus` 一致；`observability-recovery-system.detail.md` §2.1 一致。 |
| HI-02 | `AttentionSignal` 存储模型与 runtime 模型冲突 | **Closed** | `shared-v9-contracts.md` §3 统一定义 runtime shape 与 storage shape；`attention-system.detail.md` §2.1 `RepetitionKind = new/changed/duplicate/identity_unstable` 与 memory-continuity 存储一致；`memory-continuity-system.detail.md` §2 `AttentionSignal` 字段与 canonical 一致。 |
| HI-03 | stable evidence identity 被三个系统同时拥有 | **Closed** | `shared-v9-contracts.md` §2 定义 owner=`memory-continuity-system`；`attention-system.md` §1.2 / §4.2 明确 durable upsert 调用 `memory-continuity-system.normalizeEvidenceIdentity`；`body-connector-system.detail.md` §3.3 `normalizeEvidence` 调用 `memoryContinuity.normalizeEvidenceIdentity`。 |
| HI-04 | `SourceRef` canonical structure 与 URI scheme 不统一 | **Closed** | `shared-v9-contracts.md` §1 定义 canonical `SourceRef = { family, id, label? }` 及 `SourceRefFamily` 枚举；`attention-system.detail.md` §2.3 / `body-connector-system.detail.md` §2 / `action-closure-policy-system.detail.md` §2.4 均声明使用 canonical shape。 |
| HI-05 | `ConnectorVersion` / `ConnectorEvolutionPlan` status enums 不一致 | **Closed** | `shared-v9-contracts.md` §7 统一 `ConnectorEvolutionPlan = proposed/gating/activated/rolled_back/blocked`，`ConnectorVersion = candidate/staged/active/rolled_back`；`body-connector-system.detail.md` §2 `PlanStatus`/`VersionStatus` 一致；`runtime-ops-system.detail.md` §2.4 一致。 |
| HI-06 | `action-closure-policy-system` 无 L1 且 3 个 OPEN 项 | **Closed** | `action-closure-policy-system.detail.md` 已创建；L0 §末尾 3 个 OPEN 项标注 CLOSED：`AttentionSignal→ActionProposal` 输入格式、`ToolRoutine` 读模型/`RoutineInvocation` schema、`AutonomousChangeLedger` 写入接口位置。 |
| HI-07 | `character-continuity-system` contest/re-authoring 与 Frame Source Validator 未定义 | **Closed** | `character-continuity-system.detail.md` 已创建；§3.1–3.5 定义 `refreshCharacterFrame`、`applyCharacterContest`、`buildEmbodiedContextProjection`、`Frame Source Validator`、`detectConflictNotes`；§4.2 状态机；§4.3 supersede/revise 触发条件；§5.1 双语 contest prompt。 |
| HI-08 | `body-connector-system` sandbox policy 仍为 OPEN | **Closed** | `body-connector-system.detail.md` §1.1 详细定义 Sandbox Policy（`node:vm`+`worker_threads`、timeout/memory/fs/network 边界、globals/module 白名单、禁止 `vm2`）；L0 §9.3 引用 L1 §1。 |
| HI-09 | `ConnectorEvolutionPlan→ConnectorVersion` 激活流与 rollback hint 未端到端追溯 | **Closed** | `memory-continuity-system.detail.md` §3.6、`body-connector-system.detail.md` §3.8、`runtime-ops-system.detail.md` §5 共同构成 Dream→gates→activate→ledger→rollback hint→rollback 的完整序列。 |

### 2.3 Character-Continuity Boundary Must-fix 关闭状态

| ID | 问题 | 状态 | 关闭证据 |
|----|------|:----:|----------|
| H-1 | `control-context-system` 数据模型缺少完整 `CharacterFrame` bounded projection 槽位 | **Closed** | `control-context-system.md` §6.1 `EmbodiedContext` 新增 `characterFrameProjection: ContextSlice<EmbodiedContextCharacterProjection>`；`control-context-system.detail.md` §2 `EmbodiedContext` 包含该字段；`shared-v9-contracts.md` §5.3 定义 `EmbodiedContextCharacterProjection`。 |
| H-2 | 关键边界验证机制仍为 OPEN | **Closed** | `character-continuity-system.md` §末尾 4 个 OPEN 项标注 CLOSED；`character-continuity-system.detail.md` §1.1 section ordering、§3.4 Frame Source Validator 违禁模式、§4.3 supersede/revise 触发条件、§5.1 双语 contest prompt。 |
| M-1 | `CharacterPointerLoader` 未过滤 rejected/retired/contested frame | **Closed** | `control-context-system.detail.md` §3.5 明确只加载 `accepted+active`；`contested` 降级为 `character_frame_contested` slice；`rejected/retired/superseded` 不得作为 active projection 注入。 |
| M-2 | `memory-continuity-system` Dream 路由可能把 Card 输入误传给 character 系统 | **Closed** | `memory-continuity-system.detail.md` §3.4 `runDreamConsolidation` 注释“仅传递 source-backed refs；不传递 card 装配输入”；§4.1 Dream 输出族路由明确禁止把 `SelfContinuityCard` 装配输入直接传给 character 系统。 |
| L-1 | `contestPrompt` 仅英文 stub | **Closed** | `character-continuity-system.detail.md` §5.1 提供中英双语模板，且声明模板本身通过 `Frame Source Validator`。 |
| L-2 | `observability-recovery-system` `character_frame_event` 的 `TimelineRow.kind` 未约束 | **Closed** | `observability-recovery-system.detail.md` §1.5a 定义 `CHARACTER_FRAME_EVENT_KINDS` 白名单（`refresh/accepted/rejected/revised/retired/superseded/deferred/conflict`）；`character-continuity-system.md` §9.3 禁止情绪/人格断言类 kind。 |

### 2.4 Medium/Low/Note 关闭状态

| ID | 问题 | 状态 | 关闭证据 |
|----|------|:----:|----------|
| ME-01 | `AttentionActionKind` 扩展 `connector_read` | **Closed** | `attention-system.detail.md` §2.1 明确 `AttentionActionKind` 不包含 `connector_read`；connector 读取由 Agent/routine 在更高层决策。 |
| ME-02 | `observability-recovery-system.detail.md` `assembleDigest` 硬编码 placeholder | **Closed** | `observability-recovery-system.detail.md` §3.7 `assembleDigest` 调用 `aggregateLoopHealth`、`aggregateContinuityHealth`、`aggregateRoutineHealth`、`aggregateConnectorEvolutionHealth`。 |
| ME-03 | `ContinuityReadPort` 接口 shape 不一致 | **Closed** | `memory-continuity-system.md` §5.2 / `control-context-system.detail.md` §2 / `runtime-ops-system.md` §5.2 均统一为 `loadSelfContinuityCard(scope)` + `loadRoutineList(filters)` + `loadActiveMemoryProjections` + `loadActiveProceduralProjections`。 |
| ME-04 | `CharacterFrame` persistence 职责描述不一致 | **Closed** | `character-continuity-system.md` §5.2 `CharacterFrameStorePort` 由 `memory-continuity-system` 实现；`memory-continuity-system.md` §1.3 明确“持久化完整 `CharacterFrame` artifact”。 |
| ME-05 | v8 `JudgmentVerdict` 迁移路径无 owner | **Closed** | `control-context-system.md` §3.4 已决策：v8 `JudgmentVerdict` rows 视为只读 legacy；`memory-continuity-system` 读时映射为 `AttentionSignal(status=degraded, reason=v8_legacy_judgment_mapped)`。 |
| ME-06 | `EvidenceItem.identityStatus` 语义差异 | **Closed** | `memory-continuity-system.detail.md` §2 定义 `rowIdentityStatus ∈ {stable, unstable, duplicate_row}` 并与 `attention-system.RepetitionKind` 显式映射；`attention-system.detail.md` §2.1 保留 `RepetitionKind = new/changed/duplicate/identity_unstable`。 |
| LO-01 | `README.md` 声称 designs pending | **Closed** | `04_SYSTEM_DESIGN/README.md` §2 状态已更新为“L0 设计已完成；L1 detail 文件按系统拆分”并列出全部 L0/L1。 |
| LO-02 | `attention-system.detail.md` §5.6 Empty Evidence Content 是 L1 island | **Closed** | `attention-system.md` §9.3 Security Risks 已纳入空内容证据场景；`attention-system.detail.md` §5.6 有对应入口。 |
| LO-03 | `SelfContinuityCard` character pointer 字段在 ops 结果中未暴露 | **Closed** | `runtime-ops-system.md` §6.1 `ContinuityReadResult` 包含 `characterFrameProjection?: EmbodiedContextCharacterProjection`。 |

---

## 3. 新发现 (New Findings)

### High

#### HI-NEW-01: `CharacterFrame` schema 在 `shared-v9-contracts.md` 与 `character-continuity-system.md` / `character-continuity-system.detail.md` 之间存在字段缺失与类型漂移

- **描述**: `shared-v9-contracts.md` §5.1 将 `CharacterFrame` 定义为包含 `id, version, emergentHabits: string[], valuePosture, relationshipPosture, expressionPosture, growthTensions, contestPrompt, sourceRefs, status, supersededBy?, revisionOf?, createdAt, acceptedAt?`。但 `character-continuity-system.md` §6.1 的 `CharacterFrame` 增加了 `projectionKind`、`validFrom`、`validUntil`、`charCount`、`conflictNotes`，使用 `emergentHabits: EmergentHabit[]` 而非 `string[]`，`RelationshipPosture` 增加了 `toward`，`ExpressionPosture` 使用 `styleNotes` 而非 `tendencies`，且缺少 `createdAt`/`acceptedAt`。两个定义无法直接 round-trip，会影响 `character-continuity-system` 与 `memory-continuity-system` 之间的持久化契约。
- **涉及文件**: `shared-v9-contracts.md` §5.1、`character-continuity-system.md` §6.1、`character-continuity-system.detail.md` §2。
- **违反约束**: `shared-v9-contracts.md` 声明为“single source of truth for cross-system data shapes”；PRD [REQ-008] 要求 `CharacterFrame`  bounded、source-backed、contestable；schema 漂移会导致存储/读取实现不一致。
- **建议修复**: 以 `character-continuity-system.detail.md` 的完整五剖面结构为权威，更新 `shared-v9-contracts.md` §5.1，统一 `EmergentHabit`、`RelationshipPosture`（含 `toward`）、`ExpressionPosture`（`styleNotes` 或 `tendencies` 二选一）、`GrowthTension`、`ConflictNote`，并保留 `projectionKind/validFrom/validUntil/charCount/createdAt/acceptedAt`。

#### HI-NEW-02: `ToolRoutine.version` 类型在系统间不一致

- **描述**: `shared-v9-contracts.md` 未定义完整 `ToolRoutine`，但其 `RoutineListItem.version` 为 `number`；`action-closure-policy-system.detail.md` §2.1 `ToolRoutineReadModel.version: number`、§2.3 `RoutineInvocation.version: number`；`control-context-system.detail.md` §2 `RoutineListItem.version: number`。但 `memory-continuity-system.detail.md` §2 `ToolRoutine.version: text; semver`，`body-connector-system.detail.md` §2 `ToolRoutine.version: string`。跨系统调用 `RoutineInvocation.version`（number）与 `ToolRoutine.version`（string/semver）时会产生序列化/反序列化冲突。
- **涉及文件**: `memory-continuity-system.detail.md` §2、`body-connector-system.detail.md` §2、`action-closure-policy-system.detail.md` §2.1/§2.3、`control-context-system.detail.md` §2、`shared-v9-contracts.md` §6。
- **违反约束**: PRD [REQ-004] 要求 routine 有 version；ADR-005 要求可审计、可回滚的 verified routine；类型不一致会破坏接口契约。
- **建议修复**: 在 `shared-v9-contracts.md` 中新增完整 `ToolRoutine` canonical shape，统一 `version` 类型。若采用 semver string，则同步修改 `RoutineListItem`、`ToolRoutineReadModel`、`RoutineInvocation` 的 `version` 为 `string`；若采用 number，则修改 memory/body L1。

#### HI-NEW-03: `ConnectorVersion` schema 在 `shared-v9-contracts.md` 与 `body-connector-system` 之间不一致

- **描述**: `shared-v9-contracts.md` §7.2 定义 `ConnectorVersion` 为 `{ id, connectorId, version, assets: ConnectorAsset[], status, activatedAt?, rolledBackAt?, sourceRefs }`，但未定义 `ConnectorAsset`。`body-connector-system.md` §6.1 / `body-connector-system.detail.md` §2 使用 `manifestPath`、`recipePath`、`adapterPath`、`declaredCapabilities` 以及 7 个 gate result 字段。两者在 asset 表示与 gate result 持久化上存在漂移。
- **涉及文件**: `shared-v9-contracts.md` §7.2、`body-connector-system.md` §6.1、`body-connector-system.detail.md` §2。
- **违反约束**: PRD [REQ-005]/[REQ-007] 要求 connector evolution 可审计、可回滚；`ConnectorVersion` 是回滚与 canary 的核心实体。
- **建议修复**: 在 `shared-v9-contracts.md` 中定义 `ConnectorAsset` 类型（或改为 `manifestPath/recipePath/adapterPath`），并加入 7-gate result 摘要；或从 canonical 中移除 `assets` 并明确由 `body-connector-system` 拥有的扩展字段。

#### HI-NEW-04: `EmbodiedContext` canonical shape 在 `shared-v9-contracts.md` 中过于简化，与 `control-context-system.detail.md` 实际字段不一致

- **描述**: `shared-v9-contracts.md` §10 的 `EmbodiedContext` 只包含 `contextId, workspaceRoot, cycleSequence, attentionSignals, selfContinuityCard, characterFrameProjection, activeRoutines, bodyIntuition, currentProhibitions, sourceRefs, degradedReasons?`。`control-context-system.detail.md` §2 的实际 `EmbodiedContext` 还包含 `identity, goals, recentInteractions, toolExperience, acceptedDream, affordanceMap, selfHealth, characterFramePointer, activeMemoryProjections, activeProceduralProjections, routineList, assembledAt`。如果其他系统依赖 `shared-v9-contracts.md` 的简化版，会缺失 v8 兼容字段。
- **涉及文件**: `shared-v9-contracts.md` §10、`control-context-system.detail.md` §2。
- **违反约束**: `shared-v9-contracts.md` 声明为 cross-system canonical shape；PRD [REQ-001] 要求 `EmbodiedContext` 可被 Claw-facing 上下文读取。
- **建议修复**: 在 `shared-v9-contracts.md` §10 中扩展 `EmbodiedContext` 为完整字段集，或明确标注 §10 为“最小公共子集”，完整字段由 `control-context-system` 拥有并在其 L1 中定义。

---

### Medium

#### ME-NEW-01: `action-closure-policy-system.md` L0 §6.1 `ActionClosureRecord` 数据模型与 L1 / `shared-v9-contracts.md` 不一致

- **描述**: `action-closure-policy-system.md` §6.1 的 `ActionClosureRecord` 使用 v8 风格字段（`closureStatus`, `nextState`, `memoryReviewCandidate`, `closedAt`），而 `action-closure-policy-system.detail.md` §2.2 与 `shared-v9-contracts.md` §9 使用 v9 字段（`actionKind`, `decision`, `platformId`, `capabilityId`, `proofRefs`, `traceRefs`, `closureRefs`, `payloadJson`, `reasonCode`, `createdAt`）。L0 与 L1 无法对应。
- **涉及文件**: `action-closure-policy-system.md` §6.1、`action-closure-policy-system.detail.md` §2.2、`shared-v9-contracts.md` §9。
- **建议修复**: 更新 L0 §6.1 的 `ActionClosureRecord` 字段表，与 L1 / `shared-v9-contracts.md` 一致。

#### ME-NEW-02: `LoopStageEvent` 字段在 `control-context-system.detail.md` 与 `observability-recovery-system.md` 间存在命名与存在性漂移

- **描述**: `control-context-system.detail.md` §2 的 `LoopStageEvent` 包含 `cycleId`、`stage`、`reason?`、`redactionClass`、`occurredAt`；`observability-recovery-system.md` §6.1 使用 `stageKind`、`reasonCode`、`payloadJson`、`observedAt`、`redacted`。`cycleId` 在 observability L0 中缺失，`stage`/`stageKind`、`reason`/`reasonCode`、`occurredAt`/`observedAt`、`redactionClass`/`redacted` 未统一。
- **涉及文件**: `control-context-system.detail.md` §2、`observability-recovery-system.md` §6.1、`observability-recovery-system.detail.md` §2.1。
- **建议修复**: 统一 `LoopStageEvent` 字段名与必填字段；若 v8-contracts 已定义，则明确 v9 扩展项。建议 observability 侧补充 `cycleId`。

#### ME-NEW-03: `AttentionActionKind` 在 `attention-system.detail.md` 包含 `defer`，但 `shared-v9-contracts.md` §3 未包含

- **描述**: `shared-v9-contracts.md` §3 定义 `AttentionActionKind = "notify_owner" | "watch" | "remember"`。`attention-system.detail.md` §2.1 包含 `"defer"`。虽然 `defer` 是合理的 fallback，但 canonical enum 缺失会导致类型检查失败。
- **涉及文件**: `shared-v9-contracts.md` §3、`attention-system.detail.md` §2.1。
- **建议修复**: 在 `shared-v9-contracts.md` §3 中加入 `"defer"`，或在 L1 中说明 `defer` 是内部 fallback 不进入 canonical action suggestion。

#### ME-NEW-04: `body-connector-system.detail.md` `probeCapability` 创建非 canonical `SourceRef.family = "capability_probe_result"`

- **描述**: `body-connector-system.detail.md` §3.10 中 `CapabilityProbeResult.sourceRefs` 使用 `{ family: 'capability_probe_result', id: this.id }`，但 `shared-v9-contracts.md` §1 的 `SourceRefFamily` 白名单不包含 `capability_probe_result`。
- **涉及文件**: `body-connector-system.detail.md` §3.10、`shared-v9-contracts.md` §1。
- **建议修复**: 将 probe result 的 family 映射到白名单内（如 `"connector"`），或在 `shared-v9-contracts.md` 白名单中新增 `"capability_probe_result"` 并说明其 owner。

#### ME-NEW-05: `ConnectorEvolutionPlan.rollbackCommandHint` optional 语义轻微不一致

- **描述**: `shared-v9-contracts.md` §7.1 定义 `rollbackCommandHint?: string`（可选），但 `memory-continuity-system.detail.md` §2 `ConnectorEvolutionPlan` 表将该字段标记为 `not null` 并注释“由 `body-connector-system` 在激活时生成”。在 `proposed` 阶段该字段应为空/待定。
- **涉及文件**: `shared-v9-contracts.md` §7.1、`memory-continuity-system.detail.md` §2。
- **建议修复**: `memory-continuity-system.detail.md` 中将 `rollbackCommandHint` 改为 nullable，与 canonical 一致。

---

### Low

#### LO-NEW-01: `AutonomousChangeLedgerEntry.redactedPayloadJson` 必填/可选性在系统间不一致

- **描述**: `shared-v9-contracts.md` §8 定义 `redactedPayloadJson?: string`（可选）；`runtime-ops-system.detail.md` §2.7 标记为必填；`observability-recovery-system.detail.md` §2.1 标记为可选。
- **涉及文件**: `shared-v9-contracts.md` §8、`runtime-ops-system.detail.md` §2.7、`observability-recovery-system.detail.md` §2.1。
- **建议修复**: 统一为 optional；空 payload 时返回 `undefined` 或 `"{}"`。

#### LO-NEW-02: `SelfContinuityCard.activeRoutinePointers` 的 `RoutinePointer` 类型未在 `shared-v9-contracts.md` 中定义

- **描述**: `shared-v9-contracts.md` §4 `SelfContinuityCard` 包含 `activeRoutinePointers: RoutinePointer[]`，但未定义 `RoutinePointer` 结构。
- **涉及文件**: `shared-v9-contracts.md` §4。
- **建议修复**: 在 `shared-v9-contracts.md` 中补充 `RoutinePointer` 定义，或映射为 `RoutineListItem` 的轻量引用。

#### LO-NEW-03: `body-connector-system.md` L0 §6.1 `ToolRoutine.version` 仍为 `int`，与 L1 `string` 不一致

- **描述**: `body-connector-system.md` §6.1 `ToolRoutine` Python dataclass 使用 `version: int`，但 `body-connector-system.detail.md` §2 使用 `version: string`。
- **涉及文件**: `body-connector-system.md` §6.1、`body-connector-system.detail.md` §2。
- **建议修复**: 与 HI-NEW-02 一同修复，统一 L0/L1 version 类型。

#### LO-NEW-04: `memory-continuity-system.md` §6.1 `ToolRoutine.version` 描述“number, semver”自相矛盾

- **描述**: `memory-continuity-system.md` §6.1 中 `ToolRoutine.version` 字段类型标注为 `(number)`，注释又写 `semver`，两者语义冲突。
- **涉及文件**: `memory-continuity-system.md` §6.1。
- **建议修复**: 与 HI-NEW-02 一同统一为 `number` 或 `string (semver)`。

#### LO-NEW-05: `attention-system.md` §7.2 仍提到“需扩展 `attention`、`stable_identity` family”

- **描述**: `attention-system.md` §7.2 Key Libraries 中说“v9 可扩展 `attention`、`stable_identity` family”，但 `shared-v9-contracts.md` §1 已将 `attention` 纳入白名单，且 `stable_identity` 明确不作为 `SourceRefFamily`（`attention-system.detail.md` §2.3）。该描述已过时。
- **涉及文件**: `attention-system.md` §7.2。
- **建议修复**: 更新该段为“`attention` 已纳入 canonical `SourceRefFamily`；`stable_identity` 是 `memory-continuity-system` 内部概念，不暴露为 family”。

---

### Note

#### NO-NEW-01: `ConnectorEvolutionPlan.planType` 在 L1 中使用 `string` 而非 canonical enum

- **描述**: `body-connector-system.detail.md` §2 `ConnectorEvolutionPlan.planType` 和 `ConnectorVersion.planType` 类型为 `string`，而 L0 与 `shared-v9-contracts.md` 已约束为 `manifest_delta | recipe_delta | adapter_delta`。
- **涉及文件**: `body-connector-system.detail.md` §2。
- **说明**: 类型宽松在当前阶段不会导致冲突，但建议在 L1 中显式使用 union type 以利用 TypeScript 编译期检查。

#### NO-NEW-02: `HeartbeatCycleTrace` 字段在 `control-context-system.detail.md` 与 `observability-recovery-system.md` 间存在合理扩展差异

- **描述**: `control-context-system.detail.md` §2 `HeartbeatCycleTrace` 关注 `inputCount/outputCount/heartbeatStartedAt/heartbeatCompletedAt/status`；`observability-recovery-system.md` §6.1 关注 `startedAt/closedAt/closureRecordId/stageEventIds/degradedReasons/blockedReasons`。
- **涉及文件**: `control-context-system.detail.md` §2、`observability-recovery-system.md` §6.1。
- **说明**: 两个视角不同，observability 侧 richer 的字段用于健康归因。建议明确 `HeartbeatCycleTrace` 的 canonical core 字段与 observability 扩展字段，但当前不构成阻塞。

#### NO-NEW-03: `ActionClosureRecord.actionKind` 枚举与 v8 `action_closure_record.status` 列名不同

- **描述**: `shared-v9-contracts.md` §9 使用 `actionKind`（`no_action/remember/connector/guidance/routine`），而 `action-closure-policy-system.md` §6.2 数据表使用 `status` 列（`no_action/completed/denied/deferred/downgraded/failed`）。这是两个不同维度的字段，但命名接近，容易混淆。
- **涉及文件**: `shared-v9-contracts.md` §9、`action-closure-policy-system.md` §6.2。
- **说明**: 建议在 L0 表注释中明确 `status` 是持久化生命周期状态，`actionKind` 是 proposal/closure 语义类别。

#### NO-NEW-04: `CharacterFramePointer` 的 `superseded` 状态在 `control-context-system.detail.md` §3.5 中未显式处理

- **描述**: `control-context-system.detail.md` §3.5 对 `pointer.data.status !== "active"` 统一返回 `character_frame_deferred`，包括 `superseded`。这行为合理，但 L1 决策树未单独列出 `superseded` 分支。
- **涉及文件**: `control-context-system.detail.md` §3.5。
- **说明**: 建议在 §4 决策树或 §5 边缘情况中补充说明 `superseded` pointer 降级为 deferred。

#### NO-NEW-05: `body-connector-system.md` L0 末尾仍保留 2 个 OPEN 项

- **描述**: `body-connector-system.md` §末尾保留两个 OPEN 项：(1) routine guard schema DSL 与 `action-closure-policy-system` 复验引擎契约；(2) v8 connector manifests 迁移到 v9 `ConnectorVersion` status 的路径。
- **涉及文件**: `body-connector-system.md` §末尾。
- **说明**: 这两项属于 `/blueprint` / `/forge` 阶段需要落地的工作项，不是设计层冲突，但应在进入 `/challenge` 前评估是否仍需在设计文档中记录 owner 与决策标准。

---

## 4. Character-Continuity 情绪 / 人格边界保持检查

| 检查项 | 状态 | 证据 |
|--------|:----:|------|
| 无预配置人格属性表 / 人格分数 | ✅ | `character-continuity-system.md` §2.2 NG1；`character-continuity-system.detail.md` §3.4 Frame Source Validator 拦截 `personality_score`、`personality_label`。 |
| 无程序化情绪断言 | ✅ | `character-continuity-system.detail.md` §3.4 拦截 `emotion_assertion` 模式；`contestPrompt` 模板明确“不代表你的真实情绪”。 |
| `CharacterFrame` 可 contest/re-authoring | ✅ | `character-continuity-system.detail.md` §3.2 `applyCharacterContest` 支持 accept/reject/revise/retire；§4.2 状态机。 |
| `SelfContinuityCard` 仅保留 pointer | ✅ | `shared-v9-contracts.md` §4 `characterFramePointer` 为 `CharacterFramePointer`；`control-context-system.md` §2.2 G3 / §8.3 明确 Card 只保留 pointer。 |
| Observability 中无情绪/人格标签 | ✅ | `observability-recovery-system.detail.md` §1.5a `CHARACTER_FRAME_EVENT_KINDS` 白名单为事件/动作命名；`observability-recovery-system.md` §8.2 明确不使用“Agent feels”等措辞。 |
| 来源不足时降级 | ✅ | `character-continuity-system.detail.md` §3.1/§4.1 无来源 → `character_frame_deferred`；`control-context-system.detail.md` §3.5 返回 `character_frame_deferred` slice。 |

**结论**: character-continuity 的情绪/人格边界保持完整，无 injected personality、no programmatic emotion claim、contestable projection。

---

## 5. 最终判定与下一步建议

### 最终判定: **Conditional Pass**

上一轮所有 Critical/High/Must-fix 已关闭，且 character-continuity 边界保持完整。但新发现的 4 个 High 不一致集中在 `shared-v9-contracts.md` 与系统 L0/L1 的核心实体 schema 上，若不修复会直接影响 `/challenge` 的契约审查与 `/forge` 的类型实现。

### 建议的 /challenge 前最小动作

1. 修复 HI-NEW-01：同步 `CharacterFrame` 完整 schema（含 `EmergentHabit[]`、`RelationshipPosture.toward`、`ExpressionPosture.styleNotes`、`ConflictNote`、`projectionKind`、`validFrom`、`validUntil`、`charCount`、`createdAt`、`acceptedAt`）到 `shared-v9-contracts.md` §5.1。
2. 修复 HI-NEW-02：在 `shared-v9-contracts.md` 中新增完整 `ToolRoutine` canonical shape，统一 `version` 为 `number` 或 `string (semver)`，并同步所有 L0/L1。
3. 修复 HI-NEW-03：在 `shared-v9-contracts.md` 中明确 `ConnectorVersion` asset 表示（`manifestPath/recipePath/adapterPath` 或 `ConnectorAsset[]`）并加入 7-gate result 摘要。
4. 修复 HI-NEW-04：扩展 `shared-v9-contracts.md` §10 `EmbodiedContext` 为完整字段集，或明确其仅为最小公共子集、完整字段由 `control-context-system` 拥有。
5. 同步修复 ME-NEW-01~ME-NEW-05 与 LO-NEW-01~LO-NEW-05 中的命名、必填/可选、类型定义不一致。

完成上述修复后，建议进行第三轮快速审查（重点核对 `shared-v9-contracts.md` 与所有 L0/L1 的字段一致性），再进入 `/challenge`。

---

**Report Path**: `.anws/v9/04_SYSTEM_DESIGN/_review/cross-system-design-review-2.md`
