# 05A_TASKS.md — Second Nature v7 执行主清单

**项目**: Second Nature v7
**版本**: 7.0
**生成日期**: 2026-05-21
**生成来源**: `/blueprint`
**状态**: 初始规划
**任务总计**: 42 个任务 + 6 个 INT 里程碑
**关联文档**: `05B_VERIFICATION_PLAN.md`

---

## 目录

- [User Story Overlay](#user-story-overlay)
- [Sprint 路线图](#sprint-路线图)
- [S1 Foundation — TypeScript 基础、Schema、Write Queue](#s1-foundation)
- [S2 Core State + Connector](#s2-core-state--connector)
- [S3 Body Tool + Heartbeat](#s3-body-tool--heartbeat)
- [S4 Dream / Quiet + Guidance](#s4-dream--quiet--guidance)
- [S5 Observability](#s5-observability)
- [S6 Runtime Ops + E2E](#s6-runtime-ops--e2e)
- [S7 v7 Living Loop Closure](#s7-v7-living-loop-closure)

---

## User Story Overlay

| User Story | REQ | 覆盖 Sprint | 核心任务 |
|---|---|---|---|
| US-001 Heartbeat 读取具身上下文 | REQ-001 | S2/S3 | T-CP.C.1, T-CP.C.2, T-SMS.C.1, T-SMS.C.2 |
| US-002 Agent-facing Tool Affordance Map | REQ-002 | S3 | T-BTS.C.1, T-BTS.C.2, T-ROS.C.3 |
| US-003 Tool Experience 身体反馈 | REQ-003 | S2/S3 | T-CS.C.3, T-BTS.C.4, T-BTS.C.5 |
| US-004 Goal Lifecycle 与 Idle Curiosity | REQ-004 | S2/S3 | T-SMS.C.3, T-SMS.C.4, T-CP.C.3 |
| US-005 Quiet Claim 与 Dream Projection 回流 | REQ-005 | S4 | T-DQS.C.1~C.5 |
| US-006 Channel Feedback Loop | REQ-006 | S4 | T-GVS.C.1, T-GVS.C.2, T-GVS.C.3 |
| US-007 Self Health Snapshot | REQ-007 | S5 | T-OBS.C.1, T-OBS.C.2 |
| US-008 Cross-platform IdentityProfile | REQ-008 | S2 | T-SMS.F.1, T-SMS.C.1, T-SMS.C.4, T-CP.C.1 |
| US-009 Connector Auto-Probe & CircuitBreaker | REQ-009 | S2/S3 | T-CS.C.1, T-CS.C.2, T-BTS.C.5 |
| US-010 HeartbeatDigest | REQ-010 | S5 | T-OBS.C.3, T-OBS.C.4 |
| US-011 NarrativeTimeline & RestoreSnapshot | REQ-011 | S5 | T-SMS.F.2, T-SMS.C.6, T-OBS.C.5, T-OBS.C.6, T-ROS.C.1 |
| US-012 Bootstrap Recovery & RuntimeSecretAnchor | REQ-012 | S5/S6 | T-SMS.C.6, T-OBS.C.2, T-OBS.C.7, T-ROS.C.1, T-ROS.C.4 |

---

## Sprint 路线图

| Sprint | 代号 | 核心任务 | 退出标准 | 预估 |
|--------|------|---------|---------|------|
| **S1** | Foundation | TypeScript 共享类型、SQLite schema+migration、write queue 并发保护、audit-family registry | 编译无错误、DB 初始化成功、write queue 单测通过、audit family registry 可加载 | 3-4d |
| **S2** | Core State + Connector | state-memory 全部读写端口（WriteValidationGate、GoalLifecycleStore、IdentityProfileStore 等）、connector registry+execution+wet probe | S1 所有产出存在；DB 端口集成测试通过；connector wet probe 返回真实 status；goal lifecycle 状态机 replace/expire/complete 可验证 | 4-5d |
| **S3** | Body Tool + Heartbeat | AffordanceAssembler+CircuitBreaker+BehaviorPromotion、control-plane heartbeat+EmbodiedContextAssembler | S2 所有产出存在；affordance map 正确过滤；heartbeat 能组装含 5 类 slice 的 EmbodiedContext；breaker cooldown/halfopen/closed 可验证 | 4-5d |
| **S4** | Dream/Quiet + Guidance | Quiet pipeline+DailyDiary、Dream pipeline+lifecycle、GuidanceDraftService+ChannelFeedback | S3 所有产出存在；DailyDiary 含 3 段；Dream accepted projection 被 heartbeat 读取；channel feedback 写入 RelationshipMemory | 4-5d |
| **S5** | Observability | RedactionPolicy 强制化、AppendOnlyAuditStore+lastHashCache、SelfHealthSnapshot+per-probe 超时、HeartbeatDigest、NarrativeTimeline 分页、RestoreAudit | S4 所有产出存在；audit chain 完整性可验证；self_health 覆盖动态维度且最小维度集完整；digest 按平台分类；timeline cursor 分页正常 | 3-4d |
| **S6** | Runtime Ops + E2E | OpenClaw plugin+CLI、manual run/wet test/self_health/restore ops、端到端集成冒烟 | S5 所有产出存在；plugin 加载成功；connector_test --wet 返回真实 status；self_health 在 DB 可用时 P95 < 1s；端到端 heartbeat 读取 EmbodiedContext | 3-4d |
| **S7** | Living Loop Closure | post-E2E 数据生命周期、connector truth、body feedback、rhythm loop、identity/goal hygiene 闭环 | `narrative:diff`/`restore` 有生产数据；wet probe 写 probe result；connector result 写 evidence+experience；Dream/digest 自然触发；identity/goal 长期运行卫生可验收 | 4-6d |

---

## S1 Foundation

> **目标**: 建立 TypeScript 共享类型、SQLite schema migration 机制、write queue 并发保护、audit family registry。
> **退出**: 编译通过 + DB 初始化成功 + write queue 单测通过。

---

- [x] **T-SMS.F.1** [REQ-001, REQ-004, REQ-008]: 定义 v7 TypeScript 共享类型（SourceRef、AgentGoal、IdentityProfile、ToolExperience、DreamOutput、EmbodiedContext 等）
  - **描述**: 在 `src/shared/` 或 `src/storage/types/` 下声明 v7 全量实体类型，保证跨系统类型一致性；包括 `AgentGoal.kind`/`scope` 格式约束（DR-014）、`RestoreSnapshot` entity 白名单（DR-017）、`SourceRef` non-empty tuple
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §6.2`（字段声明表）、`04_SYSTEM_DESIGN/control-plane-system.md §6.1`（EmbodiedContext）、`04_SYSTEM_DESIGN/body-tool-system.md §6`（ToolAffordanceMap 等）
  - **输出**: `src/shared/types/v7-entities.ts`、`src/shared/types/source-ref.ts`、`src/shared/types/goal.ts`（含 kind enum）
  - **契约承接**: `SourceRef`（non-empty tuple 强制）、`AgentGoal.kind` snake_case enum、`RestoreSnapshot.excludedSensitiveKinds` 默认值
  - **参考**: `state-memory-system.md §6.2`、DR-014、DR-017
  - **验收标准**:
    - Given v7 实体类型文件存在，When TypeScript 编译，Then 零类型错误
    - Given `AgentGoal.kind` 传入非 enum 值，When 编译时检查，Then 报类型错误
    - Given `SourceRef` 为空数组赋值给 non-empty tuple，When 编译，Then 报类型错误
  - **验证类型**: 编译检查 | Lint检查 | 单元测试
  - **验证摘要**: 类型安全性；DR-014 kind/scope 约束；DR-017 entity 白名单完整性
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-f-1`
  - **证据产出**: `tests/unit/shared/v7-entities.test.ts`
  - **估时**: 4h
  - **依赖**: 无
  - **优先级**: P0

---

- [x] **T-SMS.F.2** [REQ-001, REQ-003, REQ-011]: 实现 SQLite schema migration 机制（DR-018）
  - **描述**: 在 `src/storage/db/` 下实现 `_meta` 表版本号管理、事务迁移执行器、失败后标记 `schema_migration_failed`、新增列 DEFAULT NULL 规则；包含 v7 全部新增表（identity_profile、agent_goal v7 扩展、tool_experience、daily_diary_index、dream_output_index、capability_probe_result、restore_snapshot、runtime_secret_anchor、heartbeat_digest、narrative_timeline 等）
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §12.X`（Schema Migration 策略）、T-SMS.F.1 产出
  - **输出**: `src/storage/db/migrations/` 目录、`src/storage/db/migration-runner.ts`、初始 migration SQL 文件（v1 schema）
  - **契约承接**: `_meta.schema_version` 递增管理；迁移失败标记 `degraded` 而非崩溃
  - **参考**: `state-memory-system.md §12.X`、DR-018、ADR-001
  - **验收标准**:
    - Given 全新 DB，When 启动并运行 migration，Then `_meta.schema_version = 1` 且所有表已创建
    - Given migration SQL 报错，When 执行 migration，Then DB 标记 `schema_migration_failed`，已有数据不丢失
    - Given 旧 schema_version < 当前，When 启动，Then 按序执行 pending migrations
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: migration 顺序；失败标记；新字段 DEFAULT NULL 规则
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-f-2`
  - **证据产出**: `tests/unit/storage/migration-runner.test.ts`、`tests/integration/storage/schema-migration.test.ts`
  - **估时**: 6h
  - **依赖**: T-SMS.F.1
  - **优先级**: P0

---

- [x] **T-SMS.F.3** [REQ-001, REQ-003]: 实现 Write Queue 与并发保护（DR-019）
  - **描述**: 在 `src/storage/db/` 下实现串行 write queue 单例；所有写入路径通过 `BEGIN EXCLUSIVE` transaction；50ms 退避重试最多 3 次；flush 失败写 stderr 而非阻塞读路径；支持 `triggerSource` 字段区分 `heartbeat`/`manual_run`/`probe`
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §12.Y`（Write Queue 并发保护）、T-SMS.F.2 产出
  - **输出**: `src/storage/db/write-queue.ts`、`src/storage/db/transaction-utils.ts`
  - **契约承接**: 写入队列串行化；flush 失败仅 stderr 不阻塞；triggerSource 正确传递
  - **参考**: `state-memory-system.md §12.Y`、DR-019、DR-038
  - **验收标准**:
    - Given 并发 2 个 write 请求，When 同时到达 queue，Then 串行执行，无冲突
    - Given flush 失败 3 次，When write queue 放弃，Then 错误写入 stderr，读路径继续正常
    - Given manual_run 写入，When triggerSource 传入，Then 写入的 ToolExperienceRow.triggerSource = "manual_run"
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: 并发安全；triggerSource 传递准确性；flush 失败行为
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-f-3`
  - **证据产出**: `tests/unit/storage/write-queue.test.ts`
  - **估时**: 4h
  - **依赖**: T-SMS.F.2
  - **优先级**: P0

---

- [x] **T-OBS.F.1** [REQ-001, REQ-003, REQ-007]: 实现 audit family registry（DR-040）
  - **描述**: 创建 `src/observability/audit/audit-family-registry.json`，注册 8 个系统的 audit family/plane；实现运行时注册接口；新增系统写入 audit 前必须在 registry 注册其 family
  - **输入**: `04_SYSTEM_DESIGN/observability-health-system.md §6.1`、DR-040
  - **输出**: `src/observability/audit/audit-family-registry.json`、`src/observability/audit/family-registry.ts`
  - **契约承接**: 8 个已注册系统 family 表；未注册 family 的写入被拒绝
  - **参考**: `observability-health-system.md §6.1`、DR-040
  - **验收标准**:
    - Given audit-family-registry.json 加载，When 读取 family 列表，Then 8 个系统 family 均存在
    - Given 未注册 family 的 audit write 请求，When 执行，Then 返回 `unknown_audit_family` 错误
  - **验证类型**: 单元测试 | 编译检查
  - **验证摘要**: 8 个系统 family 注册完整；未知 family 拒绝策略
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-obs-f-1`
  - **证据产出**: `tests/unit/observability/family-registry.test.ts`
  - **估时**: 2h
  - **依赖**: T-SMS.F.1
  - **优先级**: P1

---

- [x] **INT-S1** [MILESTONE]: S1 Foundation 集成验证
  - **描述**: 验证 S1 退出标准：TypeScript 类型编译通过、DB 初始化正常、write queue 并发安全、audit family registry 可加载
  - **输入**: T-SMS.F.1、T-SMS.F.2、T-SMS.F.3、T-OBS.F.1 全部产出
  - **输出**: `reports/int-s1-foundation-v7.md` 集成验证报告
  - **验收标准**: Given S1 完成 / When 逐条检查编译+DB+queue+registry / Then 全通过→完成，失败→记 Bug
  - **验证说明**: `tsc --noEmit` + 集成测试矩阵执行截图
  - **估时**: 2h
  - **依赖**: T-SMS.F.1、T-SMS.F.2、T-SMS.F.3、T-OBS.F.1

---

## S2 Core State + Connector

> **目标**: 实现 state-memory 全部读写端口（WriteValidationGate、GoalLifecycleStore 等）、connector registry+execution+wet probe。
> **退出**: DB 端口集成测试通过；wet probe 返回真实 status；goal lifecycle 可验证。

---

- [x] **T-SMS.C.1** [REQ-001, REQ-008]: 实现 WriteValidationGate（DR-022）
  - **描述**: 在 `src/storage/services/` 下实现强制所有写入路径必须通过的 `WriteValidationGate`；验证敏感字段（credential/token/raw private content/raw prompt）、source refs 非空约束（fact claim 类型）、sensitivity scan、schema 校验；拒绝时返回 `write_validation_failed:{reason}`
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §4.2`（WriteValidationGate 强制范围）、T-SMS.F.1 类型定义
  - **输出**: `src/storage/services/write-validation-gate.ts`
  - **契约承接**: 所有写入路径必须经过；拒绝条件 4 类；错误类型 `write_validation_failed:{reason}`
  - **参考**: `state-memory-system.md §4.2`、DR-022
  - **验收标准**:
    - Given 含 credential 字段的写入请求，When 经过 gate，Then 拒绝并返回 `write_validation_failed:credential_detected`
    - Given fact claim 无 sourceRefs，When 经过 gate，Then 拒绝并返回 `write_validation_failed:source_refs_missing`
    - Given 合规写入请求，When 经过 gate，Then 通过并继续写入
  - **验证类型**: 单元测试 | API接口功能测试
  - **验证摘要**: 4 类拒绝条件；gate 不可绕过；敏感字段检测
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-c-1`
  - **证据产出**: `tests/unit/storage/write-validation-gate.test.ts`
  - **估时**: 4h
  - **依赖**: T-SMS.F.3
  - **优先级**: P0

---

- [x] **T-SMS.C.2** [REQ-001, REQ-006]: 实现 EmbodiedContextStatePort（DR-011, DR-013）
  - **描述**: 实现 `EmbodiedContextStatePort` 的全部方法：`loadIdentityProfile`、`listActiveGoals`、`loadRecentInteractionSnapshot`、`loadToolExperienceSlice`、`loadAcceptedDreamProjection`；每个方法支持 bounded query（limit/window）；affordance 和 self-health 切片注明来自 body-tool / observability，非 state-memory 直接读取
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §5.2`（EmbodiedContextStatePort）、T-SMS.C.1 WriteValidationGate
  - **输出**: `src/storage/services/embodied-context-state-port.ts`
  - **契约承接**: `loadAcceptedDreamProjection(limit)` 方法存在并返回 accepted projection 列表；空时返回空数组 + reason code（DR-011）
  - **参考**: `state-memory-system.md §5.2`、DR-011、DR-013、DR-024
  - **验收标准**:
    - Given DB 含 accepted DreamOutput，When `loadAcceptedDreamProjection(3)` 调用，Then 返回最多 3 条 accepted projection
    - Given DB 无 accepted DreamOutput，When `loadAcceptedDreamProjection`，Then 返回空数组 + reason `context_degraded:dream_projection_unavailable`（DR-024）
    - Given DB 含 10 条 recentInteraction，When `loadRecentInteractionSnapshot(10)`，Then 返回 10 条，无私信全文
  - **验证类型**: 单元测试 | API接口功能测试 | 集成测试
  - **验证摘要**: 5 个 read port 方法正确；accepted/candidate 分离；degraded reason code
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-c-2`
  - **证据产出**: `tests/unit/storage/embodied-context-state-port.test.ts`、`tests/integration/state/dream-projection-lifecycle.test.ts`
  - **估时**: 6h
  - **依赖**: T-SMS.C.1
  - **优先级**: P0

---

- [x] **T-SMS.C.3** [REQ-004]: 实现 GoalLifecycleStore（DR-014, DR-015）
  - **描述**: 实现 `GoalLifecycleStore`：`upsertAgentGoal`（BEGIN EXCLUSIVE 事务，先到胜出，后到执行 replace 语义）、`transitionGoalLifecycle`（支持 accepted/completed/expired/paused/replaced 转换）、`listActiveGoals`；补充 paused 状态完整出边（DR-015）：paused → completed/expired/replaced/accepted；kind snake_case lowercase 强制（DR-014）
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §4.4`（Goal lifecycle 状态机）、`§5.1`（upsertAgentGoal 事务语义）、T-SMS.C.1
  - **输出**: `src/storage/services/goal-lifecycle-store.ts`
  - **契约承接**: same kind+scope replace 原子性；paused 完整出边；`transitionGoalLifecycle` 由 control-plane 调用
  - **参考**: `state-memory-system.md §4.4`、DR-012、DR-014、DR-015、ADR-004
  - **验收标准**:
    - Given 同 kind+scope 已有 accepted goal，When upsert 新 goal，Then 旧 goal 转为 replaced，新 goal 成为唯一 active
    - Given paused goal，When expiresAt 到达，Then 可转换为 expired（而非永久悬空）
    - Given 并发两个同 kind+scope upsert，When 执行，Then 先到者胜出，后到者执行 replace 语义，无死锁
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: replace 原子性；paused 出边完整性；并发安全
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-c-3`
  - **证据产出**: `tests/unit/storage/goal-lifecycle-store.test.ts`、`tests/integration/state/goal-lifecycle.test.ts`
  - **估时**: 6h
  - **依赖**: T-SMS.C.1
  - **优先级**: P0

---

- [x] **T-SMS.C.4** [REQ-004, REQ-008]: 实现 IdentityProfileStore 与 InteractionSnapshotProjector
  - **描述**: 实现 `IdentityProfileStore`（canonical identity + per-platform handles，不存 credential）、`InteractionSnapshotProjector`（redacted recent conversation / reply / commitment summary，不含私信全文）；`loadIdentityProfile` 缺少某平台时返回 `identity_profile_degraded:{platformId}` reason
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §6.2`（IdentityProfile、RecentInteractionSnapshot 字段）、T-SMS.C.1
  - **输出**: `src/storage/services/identity-profile-store.ts`、`src/storage/services/interaction-snapshot-projector.ts`
  - **契约承接**: 跨平台 handles 统一读取；RecentInteractionSnapshot 无私信全文
  - **参考**: `state-memory-system.md §6.2`、ADR-007、REQ-008
  - **验收标准**:
    - Given 三平台 profile fixture，When `loadIdentityProfile`，Then 返回 canonical name/bio + 3 个 platform handles
    - Given 某平台 profile 缺失，When 读取，Then 返回 `identity_profile_degraded:{platformId}`，不阻断其他平台
    - Given InteractionSnapshot 含原始私信，When 写入，Then WriteValidationGate 拒绝，仅允许 summary/contentRef
  - **验证类型**: 单元测试 | API接口功能测试
  - **验证摘要**: 跨平台 identity 正确性；隐私边界；degraded reason
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-c-4`
  - **证据产出**: `tests/unit/storage/identity-profile-store.test.ts`
  - **估时**: 5h
  - **依赖**: T-SMS.C.1
  - **优先级**: P0

---

- [x] **T-SMS.C.5** [REQ-003, REQ-009]: 实现 ToolExperienceStore 与 CapabilityProbeResultStore
  - **描述**: 实现 append-only `ToolExperienceStore`（outcome/failureClass/latencyMs/evidenceQuality/sourceRefs，raw payload 被 gate 拒绝）；`failureClass` 直接从 ConnectorResult 转写（DR-007）；`triggerSource` 字段必填（DR-010）；实现 `CapabilityProbeResultStore`（含 capabilityId、actualStatus、httpStatus、sampleResponseRef）
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §6.2`（ToolExperience、CapabilityProbeResult 字段）、T-SMS.C.1
  - **输出**: `src/storage/services/tool-experience-store.ts`、`src/storage/services/capability-probe-result-store.ts`
  - **契约承接**: ToolExperience append-only；failureClass 来自 ConnectorResult；triggerSource 必填
  - **参考**: `state-memory-system.md §6.2`、DR-007、DR-010、ADR-003
  - **验收标准**:
    - Given connector execution result，When `appendToolExperience`，Then 写入含 outcome/failureClass/triggerSource 的行
    - Given 含 raw payload 的 experience，When 写入，Then WriteValidationGate 拒绝
    - Given CapabilityProbeResult，When 写入，Then 含 capabilityId + actualStatus
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: append-only 约束；failureClass 转写；triggerSource 强制
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-c-5`
  - **证据产出**: `tests/unit/storage/tool-experience-store.test.ts`
  - **估时**: 4h
  - **依赖**: T-SMS.C.1
  - **优先级**: P0

---

- [x] **T-SMS.C.6** [REQ-011, REQ-012]: 实现 RestoreSnapshotStore 与 RuntimeSecretAnchorStore
  - **描述**: 实现 `RestoreSnapshotStore`（支持 6 类 entity 白名单快照，排除 credential/raw_private_message/raw_prompt/encryption_key/session_token，默认保留最近 3 版，DR-017）；实现 `RuntimeSecretAnchorStore`（只存 locationRef/health/rotationPolicyRef，禁止 key 明文）
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §6.2`（RestoreSnapshot、RuntimeSecretAnchor）、DR-017、T-SMS.C.1
  - **输出**: `src/storage/services/restore-snapshot-store.ts`、`src/storage/services/runtime-secret-anchor-store.ts`
  - **契约承接**: RestoreSnapshot entity 白名单（6 类）；excludedSensitiveKinds 默认值；RuntimeSecretAnchor 无 key 明文
  - **参考**: `state-memory-system.md §6.2`、DR-017、ADR-007、ADR-008
  - **验收标准**:
    - Given capture snapshot 请求含 credential，When 执行，Then credential 被排除，snapshot 仅含白名单 entity
    - Given 保存第 4 版 snapshot，When 执行，Then 最旧版本被清理，只保留 3 版
    - Given RuntimeSecretAnchor 含 key 明文，When 写入，Then WriteValidationGate 拒绝
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: entity 白名单；retention 策略；key 明文拒绝
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-c-6`
  - **证据产出**: `tests/unit/storage/restore-snapshot-store.test.ts`
  - **估时**: 4h
  - **依赖**: T-SMS.C.1
  - **优先级**: P1

---

- [x] **T-CS.C.1** [REQ-009]: 实现 CapabilityContractRegistry v7 扩展（manifest v7 schema）
  - **描述**: 扩展 `CapabilityContractRegistry` 支持 v7 manifest 新增字段：`probeConfig`（safeEndpoint、idempotencyClass）、`endpointMappings`（profilePath/claimPath/heartbeatPath）、`capabilityId`（DR-001 修复）；Zod 严格校验；注册失败返回具体校验错误
  - **输入**: `04_SYSTEM_DESIGN/connector-system.md §4.2`（CapabilityContractRegistry）、T-SMS.F.1 类型
  - **输出**: `src/connectors/base/manifest-v7.ts`（扩展 schema）、更新 `src/connectors/registry/`
  - **契约承接**: `capabilityId` 在 CapabilityProbeResult 中存在（DR-001 修复）；probeConfig.safeEndpoint 限定 probe 范围
  - **参考**: `connector-system.md §5.1`、DR-001、DR-006、ADR-008
  - **验收标准**:
    - Given manifest 含 probeConfig 和 endpointMappings，When Zod 校验，Then 通过
    - Given manifest 缺少 capabilityId，When 注册，Then 返回具体校验错误，不静默拒绝
    - Given resolveCapability 调用，When 返回 CapabilityProbeResult，Then 含 capabilityId 字段
  - **验证类型**: 单元测试 | API接口功能测试
  - **验证摘要**: v7 manifest schema 扩展；capabilityId 存在；严格 Zod 校验
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cs-c-1`
  - **证据产出**: `tests/unit/connectors/manifest-v7-schema.test.ts`
  - **估时**: 4h
  - **依赖**: T-SMS.F.1
  - **优先级**: P0

---

- [x] **T-CS.C.2** [REQ-009]: 实现 WetProbeRunner 与 EffectCommitLedger SQLite 持久化
  - **描述**: 实现 `WetProbeRunner`（真实 HTTP GET safe endpoint，返回 CapabilityProbeResult 含 capabilityId）；`safe_for_probe` 双重验证（DR-006）：body-tool 调用前验证 + connector 强制校验 idempotencyClass，strict side-effect 拒绝 probe；`EffectCommitLedger` 持久化至 SQLite（v7 target）
  - **输入**: `04_SYSTEM_DESIGN/connector-system.md §4.3`（数据流）、`§5.1`（WetProbeRunner 契约）、DR-001、DR-006
  - **输出**: `src/connectors/base/wet-probe-runner.ts`、`src/connectors/base/effect-commit-ledger-sqlite.ts`
  - **契约承接**: WetProbeRunner 只接受 safe endpoint；strict side-effect 返回 `probe_policy_denied`；capabilityId 在结果中
  - **参考**: `connector-system.md §5.1`、DR-001、DR-002、DR-006、ADR-008
  - **验收标准**:
    - Given connector manifest 含 safe probe endpoint，When `runWetProbe`，Then 返回真实 HTTP status（404/401/200）
    - Given capability idempotencyClass = "strict"，When 触发 probe，Then 返回 `probe_policy_denied`，不执行 HTTP 请求
    - Given EffectCommitLedger SQLite 模式，When 进程重启后同一 idempotency key 写入，Then 正确防重复
  - **验证类型**: 单元测试 | API接口功能测试 | 集成测试
  - **验证摘要**: 真实 HTTP probe（非 dry run）；safe_for_probe 双重校验；SQLite 幂等保护
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cs-c-2`
  - **证据产出**: `tests/unit/connectors/wet-probe-runner.test.ts`、`tests/integration/connectors/probe-idempotency.test.ts`
  - **估时**: 6h
  - **依赖**: T-CS.C.1、T-SMS.C.5
  - **优先级**: P0

---

- [x] **T-CS.C.3** [REQ-003, REQ-009]: 实现 StructuredUnavailableReason 与 connector execution 完整路径
  - **描述**: 实现 `StructuredUnavailableReason Builder`（覆盖 credentials_missing / not_registered / trust_denied / circuit_open / platform_error / probe_failed / probe_policy_denied）；`ConnectorResult` 新增 `executionId` 和 `failureClass`（直接来自 FailureTaxonomy）；禁止静默失败
  - **输入**: `04_SYSTEM_DESIGN/connector-system.md §4.2`（StructuredUnavailableReason Builder）、T-CS.C.2
  - **输出**: `src/connectors/base/structured-unavailable-reason.ts`、更新 `src/connectors/services/connector-executor-adapter.ts`
  - **契约承接**: 所有不可用场景返回 machine-readable reason code；connector 执行返回 executionId
  - **参考**: `connector-system.md §2.1 G6`、DR-007、ADR-003
  - **验收标准**:
    - Given connector 未注册，When 执行，Then 返回 `StructuredUnavailableReason{code: not_registered}`
    - Given connector 执行返回 404，When FailureTaxonomy 映射，Then ConnectorResult.failureClass = 对应 class
    - Given credential 缺失，When 执行，Then 返回 `credentials_missing`，不 throw 异常
  - **验证类型**: 单元测试 | API接口功能测试
  - **验证摘要**: reason code 覆盖率；failureClass 映射准确性；禁止静默失败
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cs-c-3`
  - **证据产出**: `tests/unit/connectors/structured-unavailable-reason.test.ts`
  - **估时**: 4h
  - **依赖**: T-CS.C.2
  - **优先级**: P0

---

- [x] **T-SMS.C.7** [REQ-005, REQ-010, REQ-011]: 实现 DiaryDreamStore、HistoryDigestStore
  - **描述**: 实现 `DiaryDreamStore`（DailyDiary artifact ref + index、DreamOutput lifecycle 含 candidate/accepted/archived/partial 状态机、`transitionDreamOutputLifecycle`）；实现 `HistoryDigestStore`（NarrativeTimeline append-only rows、HeartbeatDigest daily summary rows）；accepted projection 读路径只暴露 accepted 状态
  - **输入**: `04_SYSTEM_DESIGN/state-memory-system.md §4.4`（DreamOutput lifecycle）、`§5.1`（WriteDailyDiary、WriteDreamOutput）、T-SMS.C.1
  - **输出**: `src/storage/services/diary-dream-store.ts`、`src/storage/services/history-digest-store.ts`
  - **契约承接**: candidate 不进入 active read 路径；accepted 由 dream-quiet 发起 transition；NarrativeTimeline append-only
  - **参考**: `state-memory-system.md §4.4`、DR-023（acceptance policy 执行主体）、ADR-005
  - **验收标准**:
    - Given DreamOutput status = candidate，When `loadAcceptedDreamProjection`，Then 不返回
    - Given `transitionDreamOutputLifecycle(outputId, "accepted")`，When 执行，Then status 更新为 accepted，下次 load 可见
    - Given NarrativeTimeline append，When 追加第 N+1 条，Then 前 N 条仍存在（append-only）
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: candidate/accepted 分离；lifecycle 状态机；append-only 约束
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-sms-c-7`
  - **证据产出**: `tests/unit/storage/diary-dream-store.test.ts`、`tests/integration/state/dream-output-lifecycle.test.ts`
  - **估时**: 5h
  - **依赖**: T-SMS.C.1
  - **优先级**: P0

---

- [x] **INT-S2** [MILESTONE]: S2 Core State + Connector 集成验证
  - **描述**: 验证 S2 退出标准：所有 state-memory 端口集成测试通过；connector wet probe 返回真实 status；goal lifecycle replace/expire/complete 可验证；WriteValidationGate 拒绝敏感字段
  - **输入**: T-SMS.C.1~C.7、T-CS.C.1~C.3 全部产出
  - **输出**: `reports/int-s2-core-state-connector-v7.md`
  - **验收标准**: Given S2 完成 / When 逐条检查 state port + connector + goal + redaction / Then 全通过→完成，失败→记 Bug
  - **验证说明**: 集成测试矩阵执行日志 + DB 状态截图
  - **估时**: 3h
  - **依赖**: T-SMS.C.1、T-SMS.C.2、T-SMS.C.3、T-SMS.C.4、T-SMS.C.5、T-SMS.C.6、T-SMS.C.7、T-CS.C.1、T-CS.C.2、T-CS.C.3

---

## S3 Body Tool + Heartbeat

> **目标**: AffordanceAssembler、CircuitBreaker、BehaviorPromotion 实现；control-plane heartbeat+EmbodiedContextAssembler。
> **退出**: affordance map 正确过滤；heartbeat 能组装 5 类 slice EmbodiedContext；CircuitBreaker 状态机可验证。

---

- [x] **T-BTS.C.1** [REQ-002, REQ-003]: 实现 AffordanceAssembler 含缓存失效策略（DR-003, DR-004, DR-008）
  - **描述**: 实现 `AffordanceAssembler.assembleAffordanceMap(contextScope)`；`contextScope`（AffordanceContextScope）完整语义：platformIds 白名单、goalKind 影响过滤、allowedStatuses 默认值（DR-004）；heartbeat-cycle TTL 缓存 + breaker/probe/registry 变更时失效（DR-003、DR-008）；P95 < 1s for 50 manifests
  - **输入**: `04_SYSTEM_DESIGN/body-tool-system.md §4.3`（数据流）、`§5.1`（AffordanceContextScope 语义，DR-004 注释）、T-CS.C.1、T-SMS.C.5
  - **输出**: `src/core/second-nature/body/tool-affordance/affordance-assembler.ts`
  - **契约承接**: assembleAffordanceMap 返回 status-filtered 视图（safe/exploratory/needs_auth/painful/unavailable）；credential 不进入 affordance；缓存失效正确
  - **参考**: `body-tool-system.md §5.1`、DR-003、DR-004、DR-008、ADR-003
  - **验收标准**:
    - Given 50 connector manifests，When `assembleAffordanceMap`，Then P95 < 1s
    - Given probe result 更新后，When 读取 affordance，Then 缓存失效，返回最新状态（DR-003）
    - Given contextScope.allowedStatuses 未传，When 过滤，Then 默认使用 ['available','degraded','half_open']
  - **验证类型**: 单元测试 | API接口功能测试 | 集成测试
  - **验证摘要**: 5 类状态视图；缓存失效策略；默认 allowedStatuses；credential 隔离
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-bts-c-1`
  - **证据产出**: `tests/unit/body/affordance-assembler.test.ts`、`tests/integration/body/affordance-map.test.ts`
  - **估时**: 6h
  - **依赖**: T-CS.C.1、T-SMS.C.5
  - **优先级**: P0

---

- [x] **T-BTS.C.2** [REQ-002, REQ-004]: 实现 AffordanceContextScope 过滤逻辑（DR-004）
  - **描述**: 单独实现 AffordanceContextScope 的过滤语义作为独立模块：`platformIds` 白名单（空数组 = 全部）、`goalKind` 过滤规则（task_completion 优先 write/claim；passive_sensing 只暴露 read）、`allowedStatuses` 默认值 `['available','degraded','half_open']`、`blocked`/`pending_trust` 始终排除
  - **输入**: `04_SYSTEM_DESIGN/body-tool-system.md §5.1`（AffordanceContextScope 语义说明，DR-004）、T-BTS.C.1
  - **输出**: `src/core/second-nature/body/tool-affordance/affordance-context-scope.ts`
  - **契约承接**: goalKind 映射到 trust tier 过滤规则；blocked 和 pending_trust 始终排除
  - **参考**: `body-tool-system.md §5.1`、DR-004
  - **验收标准**:
    - Given goalKind = "passive_sensing"，When 过滤，Then 只返回 read-only capabilities
    - Given allowedStatuses 不传，When 过滤，Then 使用默认值，blocked 不出现
    - Given platformIds = ["moltbook"]，When 过滤，Then 只返回 moltbook 的 capabilities
  - **验证类型**: 单元测试
  - **验证摘要**: goalKind 过滤规则；platformIds 白名单；blocked 排除
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-bts-c-2`
  - **证据产出**: `tests/unit/body/affordance-context-scope.test.ts`
  - **估时**: 3h
  - **依赖**: T-BTS.C.1
  - **优先级**: P0

---

- [x] **T-BTS.C.3** [REQ-004]: 实现 BehaviorPromotion 状态机（DR-005）
  - **描述**: 实现 `BehaviorPromotionLoop` 状态机：candidate → approved（幂等，重复 approve 返回现有记录）/ rejected（附 reason）/ expired（7 天内无操作自动过期）；rejected/expired 只读，可重新 submitBehaviorPromotion 创建新 candidate
  - **输入**: `04_SYSTEM_DESIGN/body-tool-system.md §4.5`（BehaviorPromotion 状态机）、T-SMS.C.3、T-SMS.C.4
  - **输出**: `src/core/second-nature/body/behavior-promotion/behavior-promotion-loop.ts`
  - **契约承接**: approved 幂等；7 天 TTL 过期；不自动获得执行授权；只承接 operator-authorized behavior suggestion，不承接 connector auto-probe
  - **参考**: `body-tool-system.md §4.5`、DR-005、ADR-004、REQ-004
  - **验收标准**:
    - Given candidate promotionEntry，When operator approve 两次，Then 第二次返回已有 approved 记录（幂等）
    - Given candidate 已 7 天无操作，When 检查状态，Then 自动转为 expired
    - Given rejected entry，When 重新 submit，Then 创建新 candidate，旧 rejected 不可修改
  - **验证类型**: 单元测试
  - **验证摘要**: 幂等 approve；7 天 TTL；rejected/expired 不可修改
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-bts-c-3`
  - **证据产出**: `tests/unit/body/behavior-promotion-loop.test.ts`
  - **估时**: 4h
  - **依赖**: T-SMS.C.3、T-SMS.C.4
  - **优先级**: P1

---

- [x] **T-BTS.C.4** [REQ-003]: 实现 ExperienceWriter、ProbeSignalAdapter 与 getPainSignal（DR-010）
  - **描述**: 实现 `ExperienceWriter.recordExperience(attempt)`（含 `triggerSource` 必填参数，DR-010）；写入前调用 redaction policy；failureClass 直接从 ConnectorResult 转写（DR-007）；实现 `ProbeSignalAdapter`（将 WetProbeRunner 结果转为 pain signal 和 experience row）；实现 `getPainSignal(connectorId, capabilityId?)` 供 affordance map 与 heartbeat guard 读取最近痛感
  - **输入**: `04_SYSTEM_DESIGN/body-tool-system.md §5.1`（recordExperience 契约）、T-BTS.C.1、T-CS.C.2
  - **输出**: `src/core/second-nature/body/tool-experience/experience-writer.ts`、`src/core/second-nature/body/probe-signal-adapter.ts`、`src/core/second-nature/body/tool-experience/pain-signal-query.ts`
  - **契约承接**: recordExperience 含 triggerSource；raw payload 拒绝；failureClass 转写；`getPainSignal` 返回 bounded recent pain signal，不暴露 raw payload
  - **参考**: `body-tool-system.md §5.1`、DR-007、DR-009、DR-010
  - **验收标准**:
    - Given connector 执行结果（含 failureClass），When `recordExperience`，Then ToolExperienceRow.failureClass = ConnectorResult.failureClass
    - Given trigger = "manual_run"，When `recordExperience`，Then row.triggerSource = "manual_run"
    - Given probe result 写入，When auto-probe 完成，Then state-memory 中 CapabilityProbeResult 可被 assembleAffordanceMap 读取（DR-009）
    - Given 某 connector capability 最近失败体验存在，When `getPainSignal(connectorId, capabilityId?)`，Then 返回 `PainSignal`（connectorId、capabilityId、painLevel、recentFailureRate、consecutiveFailures、cooldownRecommended、lastOutcomes），不返回 raw payload
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: triggerSource 传递；failureClass 转写；probe result 可被 affordance 读取；getPainSignal 查询边界
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-bts-c-4`
  - **证据产出**: `tests/unit/body/experience-writer.test.ts`、`tests/unit/body/pain-signal-query.test.ts`
  - **估时**: 4h
  - **依赖**: T-BTS.C.1、T-CS.C.2
  - **优先级**: P0

---

- [x] **T-BTS.C.5** [REQ-003, REQ-009]: 实现 CircuitBreakerManager（DR-002, DR-006）
  - **描述**: 实现 `CircuitBreakerManager` 状态机（Closed → Open → HalfOpen → Closed/Open）；HalfOpen 时主动发起 `connector-system.runWetProbe(platformId, capabilityId, probeConfig)`（DR-002）；probe 前验证 `safe_for_probe: true`，strict side-effect 返回 `probe_policy_denied` 而非执行 probe（DR-006）；breaker state 持久化至 state-memory；状态转换写 observability audit
  - **输入**: `04_SYSTEM_DESIGN/body-tool-system.md §4.3~4.4`（CircuitBreaker 状态机、HalfOpen probe 发起职责）、T-CS.C.2、T-SMS.C.5
  - **输出**: `src/core/second-nature/body/circuit-breaker/circuit-breaker-manager.ts`
  - **契约承接**: CircuitBreakerManager 拥有"决定何时探测"的控制权；connector-system 只执行探测；状态机转换可持久化恢复
  - **参考**: `body-tool-system.md §4.4`、DR-002、DR-006、ADR-003、ADR-008
  - **验收标准**:
    - Given connector 连续失败 3 次，When `evaluateFailure`，Then breaker 进入 Open 状态
    - Given Open 状态 cooldown 到期，When 检测，Then 进入 HalfOpen 并自动触发 runWetProbe
    - Given strict side-effect capability HalfOpen，When 尝试 probe，Then 返回 `probe_policy_denied`，breaker 维持 HalfOpen
    - Given probe 成功，When 结果回调，Then breaker 转为 Closed，affordance 缓存失效（DR-003）
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: 状态机完整性；HalfOpen 自动 probe；safe_for_probe 验证；状态持久化恢复
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-bts-c-5`
  - **证据产出**: `tests/unit/body/circuit-breaker-manager.test.ts`、`tests/integration/body/circuit-breaker-lifecycle.test.ts`
  - **估时**: 6h
  - **依赖**: T-BTS.C.1、T-CS.C.2
  - **优先级**: P0

---

- [x] **T-CP.C.1** [REQ-001, REQ-008]: 实现 EmbodiedContextAssembler（DR-013, DR-016, DR-020）
  - **描述**: 实现 `EmbodiedContextAssembler`，通过 `EmbodiedContextStatePort` 读取 5 类 state slice（identity/goals/recent/toolExperience/acceptedDream）；affordance slice 来自 body-tool；self-health slice 来自 observability；最多 7 个 read port 调用，P95 < 400ms（DR-016）；trim 策略：recentInteractions LIFO 10 条，experiences 10 条，sourceRefs 20 条去重（DR-020）；每个 slice 标记 loaded/degraded/blocked
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.md §4.2`（EmbodiedContextAssembler 边界约束）、T-SMS.C.2、T-BTS.C.1
  - **输出**: `src/core/second-nature/heartbeat/embodied-context-assembler.ts`
  - **契约承接**: 7 read port 上限；P95 < 400ms；per-slice degraded reason；candidate Dream projection 不进入 context
  - **参考**: `control-plane-system.md §4.2`、DR-013、DR-016、DR-020、ADR-002
  - **验收标准**:
    - Given 5 类 state fixture 存在，When `assembleEmbodiedContext`，Then EmbodiedContext 含 5 类 slice，所有 status = loaded
    - Given 某类 slice DB 不可用，When assemble，Then 对应 slice status = degraded，含 reason，其他 slice 正常加载
    - Given recentInteractions 有 15 条，When assemble，Then 只取最新 10 条（LIFO trim）
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: 5 类 slice 加载；degraded 降级；trim 策略；7 port 上限
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cp-c-1`
  - **证据产出**: `tests/unit/control-plane/embodied-context-assembler.test.ts`、`tests/integration/control-plane/heartbeat-context.test.ts`
  - **估时**: 6h
  - **依赖**: T-SMS.C.2、T-BTS.C.1
  - **优先级**: P0

---

- [x] **T-CP.C.2** [REQ-001]: 实现 heartbeat 主循环（ScopeRouter + HardGuardEvaluator + DownstreamIntentOrchestrator）
  - **描述**: 实现 `ScopeRouter`（rhythm/user_task/user_reply 分类）；`HardGuardEvaluator`（source refs、affordance、breaker、budget、cooldown、quiet、risk、privacy 守卫）；`DownstreamIntentOrchestrator`（允许 intent → ConnectorIntentRequest/QuietRunRequest/DreamScheduleRequest/GuidanceDraftRequest）；`DecisionTraceEmitter`（发出 trace payload 至 observability）
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.md §4.2`（核心组件表）、`§5.1`（操作契约）、T-CP.C.1
  - **输出**: `src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.ts`（或更新现有文件）、`src/core/second-nature/orchestrator/hard-guard-evaluator.ts`
  - **契약承接**: `runHeartbeat` 返回 HeartbeatDecision；guard 结果最终；trace 写 observability
  - **参考**: `control-plane-system.md §5.1`、`§5.3`（Failure Semantics）、ADR-002
  - **验收标准**:
    - Given EmbodiedContext 组装完成，When `runHeartbeat(rhythm scope)`，Then 返回 HeartbeatDecision 含 status/selectedIntentId/reasons
    - Given connector circuit open，When guard 评估，Then 决策 status = deferred，reason = connector_circuit_open
    - Given missing source_refs，When guard 评估，Then 决策 status = denied，reason = missing_source_refs
    - Given representative EmbodiedContext fixture，When 连续执行 heartbeat benchmark，Then heartbeat P95 < 2s，超时样本写入 degraded reason
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: heartbeat 完整路径；guard 语义；decision trace 输出；P95 < 2s 性能门禁
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cp-c-2`
  - **证据产出**: `tests/unit/control-plane/hard-guard-evaluator.test.ts`、`tests/integration/control-plane/heartbeat-loop.test.ts`、`reports/heartbeat-p95-v7.md`
  - **估时**: 8h
  - **依赖**: T-CP.C.1
  - **优先级**: P0

---

- [x] **T-CP.C.3** [REQ-004]: 实现 GoalLifecyclePolicy 与 IdleCuriosityPolicy（DR-012）
  - **描述**: 实现 `GoalLifecyclePolicy`（评估 active/expired/completed/replaced goal，发出 `GoalTransitionRequest` 给 state-memory 执行，DR-012 职责分离：control-plane 评估不直接写 goal state）；实现 `IdleCuriosityPolicy`（无 active goal 时选择最多一个 healthy allowlisted read-only sensing intent；无 eligible connector 时返回 `idle_policy_no_eligible_connector`；每小时最多 1 次，每轮最多 1 个 connector）
  - **输入**: `04_SYSTEM_DESIGN/control-plane-system.md §4.4`（Goal and Idle Decision Model）、`§4.2`（GoalLifecyclePolicy 注释）、T-SMS.C.3
  - **输出**: `src/core/second-nature/heartbeat/goal-lifecycle-policy.ts`、`src/core/second-nature/heartbeat/idle-curiosity-policy.ts`
  - **契约承接**: GoalLifecyclePolicy 只发出 transition request，不直接写；idle curiosity 不执行 side-effect；budget 限制
  - **参考**: `control-plane-system.md §4.2`、DR-012、ADR-004、REQ-004
  - **验收标准**:
    - Given 同 kind+scope 两个 goal，When GoalLifecyclePolicy 评估，Then 发出 replace GoalTransitionRequest，旧 goal 非 active
    - Given 无 active goal，When idle curiosity，Then 选择最多 1 个 read-only healthy connector
    - Given 无 eligible connector，When idle curiosity，Then 返回 `idle_policy_no_eligible_connector`，不执行任何 connector
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: lifecycle 职责分离；idle 选择策略；budget 限制；no side-effect
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cp-c-3`
  - **证据产出**: `tests/unit/control-plane/goal-lifecycle-policy.test.ts`、`tests/unit/control-plane/idle-curiosity-policy.test.ts`
  - **估时**: 6h
  - **依赖**: T-CP.C.1、T-SMS.C.3
  - **优先级**: P0

---

- [x] **INT-S3** [MILESTONE]: S3 Body Tool + Heartbeat 集成验证
  - **描述**: 验证 S3 退出标准：affordance map 正确过滤5类状态；heartbeat 组装含 5 类 slice EmbodiedContext；CircuitBreaker cooldown/halfopen/closed 可验证；idle curiosity 无 side-effect 执行
  - **输入**: T-BTS.C.1~C.5、T-CP.C.1~C.3 全部产出
  - **输出**: `reports/int-s3-body-heartbeat-v7.md`
  - **验收标准**: Given S3 完成 / When 逐条检查 affordance + heartbeat + breaker + idle / Then 全通过→完成，失败→记 Bug
  - **验证说明**: heartbeat 集成测试日志 + affordance map 截图
  - **估时**: 3h
  - **依赖**: T-BTS.C.1、T-BTS.C.2、T-BTS.C.3、T-BTS.C.4、T-BTS.C.5、T-CP.C.1、T-CP.C.2、T-CP.C.3

---

## S4 Dream / Quiet + Guidance

> **目标**: Quiet pipeline+DailyDiary、Dream pipeline+lifecycle、GuidanceDraftService+ChannelFeedback。
> **退出**: DailyDiary 含 3 段；accepted projection 被 heartbeat 读取；channel feedback 写入 RelationshipMemory。

---

- [x] **T-DQS.C.1** [REQ-005]: 实现 Quiet Pipeline（ClaimSynthesizer non-empty sourceRefs，DR-025）
  - **描述**: 实现 `EvidenceAggregator`、`ClaimDeduplicator`、`ClaimSynthesizer`；fact claim 的 `sourceRefs` TypeScript 类型强制为 `[string, ...string[]]` non-empty tuple（DR-025）；单条弱 evidence 只能生成 observation 不能生成 pattern；`SourceValidator` 拒绝 sourceRefs 为空的 fact claim，返回 `claim_source_missing`；`DailyDiaryWriter` 输出三段（observedToday/notableSignals/tomorrowDirection）
  - **输入**: `04_SYSTEM_DESIGN/dream-quiet-system.md §4.1`（Quiet Pipeline 架构图）、`§2.1 G1`（sourceRefs non-empty tuple，DR-025）、T-SMS.C.7
  - **输出**: `src/core/second-nature/quiet/claim-synthesizer.ts`、`src/core/second-nature/quiet/daily-diary-writer.ts`
  - **契约承接**: QuietClaim.sourceRefs 非空 tuple；三段 DailyDiary；sensitive refs blocked 不落盘
  - **参考**: `dream-quiet-system.md §2.1 G1`、DR-025、ADR-005、REQ-005
  - **验收标准**:
    - Given life evidence refs 存在，When `runQuiet`，Then 生成含 sourceRefs 的 observation/fact claims
    - Given fact claim sourceRefs 为空，When ClaimSynthesizer，Then 返回 `claim_source_missing` 错误
    - Given evidence 足够，When DailyDiaryWriter，Then artifact 含 observedToday/notableSignals/tomorrowDirection 三段
  - **验证类型**: 单元测试 | API接口功能测试
  - **验证摘要**: sourceRefs non-empty 强制；三段 diary；sensitive refs 阻断
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-dqs-c-1`
  - **证据产出**: `tests/unit/quiet/claim-synthesizer.test.ts`、`tests/unit/quiet/daily-diary-writer.test.ts`
  - **估时**: 6h
  - **依赖**: T-SMS.C.7
  - **优先级**: P0

---

- [x] **T-DQS.C.2** [REQ-005]: 实现 Dream InputLoader 幂等加载（DR-026）
  - **描述**: 实现 `DreamInputLoader.loadDreamInputs`：加载"所有未被 accepted projection 引用的 claims"，保证 Dream lock 被持有时新 Quiet 完成的 claims 不丢失，在下次 Dream 中自动包含（DR-026，幂等去重）；lock TTL 35min；加载 ToolExperience 摘要作为 Dream 输入
  - **输入**: `04_SYSTEM_DESIGN/dream-quiet-system.md §2.1 G3`（DR-026 注释）、T-DQS.C.1、T-SMS.C.7
  - **输出**: `src/dream/dream-input-loader.ts`（更新现有）
  - **契约承接**: loadDreamInputs 查询"未被 accepted projection 引用的 claims"；lock 下 claims 不丢失
  - **参考**: `dream-quiet-system.md §2.1`、DR-026、ADR-005
  - **验收标准**:
    - Given Dream lock 持有期间 Quiet 产生新 claims，When lock 释放后下次 Dream 运行，Then 之前 skip 的 claims 被加载
    - Given accepted projection 已引用 claim A，When 下次 loadDreamInputs，Then claim A 不被重复加载
    - Given 无未引用 claims，When loadDreamInputs，Then 返回空集，不 fabricate inputs
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: lock 下 claims 不丢失；幂等去重；无 fabricate
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-dqs-c-2`
  - **证据产出**: `tests/unit/dream/dream-input-loader.test.ts`
  - **估时**: 4h
  - **依赖**: T-DQS.C.1
  - **优先级**: P0

---

- [x] **T-DQS.C.3** [REQ-005]: 实现 Dream Pipeline + ModelAssistPort RedactedEvidenceBundle（DR-027）
  - **描述**: 实现完整 Dream pipeline（MemoryConsolidator → EvidenceSampler → RedactionGate → optional ModelAssistPort → InsightExtractor → OutputMerger → OutputValidator → OutputWriter）；`ModelAssistPort` 输入类型使用 `RedactedEvidenceBundle` 品牌类型（DR-027）；调用前 `RedactionGate.redactBundle()` 为必要前置；validation pass 后由 dream-quiet 调用 `transitionDreamOutputLifecycle(outputId, "accepted")`（DR-023 修复）
  - **输入**: `04_SYSTEM_DESIGN/dream-quiet-system.md §4.1`（Dream Pipeline）、`§9.4`（DR-027 ModelAssistPort 注释）、T-DQS.C.2、T-SMS.C.7
  - **输出**: `src/dream/dream-engine-v7.ts`（更新现有）、`src/dream/model-assist-port.ts`
  - **契约承接**: ModelAssistPort 只接受 RedactedEvidenceBundle；validation 后 dream-quiet 发起 accepted transition（DR-023）
  - **参考**: `dream-quiet-system.md §4.2`、DR-023、DR-027、ADR-005
  - **验收标准**:
    - Given Dream pipeline 运行，When validation pass，Then dream-quiet 调用 `transitionDreamOutputLifecycle(outputId, "accepted")`
    - Given ModelAssistPort 调用，When 传入非 RedactedEvidenceBundle，Then TypeScript 编译拒绝
    - Given Dream output 生成，When validation fail，Then status = archived，不进入 accepted
  - **验证类型**: 单元测试 | 集成测试 | 编译检查
  - **验证摘要**: accepted transition 由 dream-quiet 发起；RedactedEvidenceBundle 品牌类型；validation 控制 lifecycle
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-dqs-c-3`
  - **证据产出**: `tests/unit/dream/dream-pipeline.test.ts`、`tests/integration/dream/dream-acceptance.test.ts`
  - **估时**: 8h
  - **依赖**: T-DQS.C.2
  - **优先级**: P0

---

- [x] **T-DQS.C.4** [REQ-005]: 实现 Dream Scheduler（Quiet-completion 触发）
  - **描述**: 实现 Dream Scheduler 的 Quiet-completion 触发策略（Quiet 完成后在允许窗口自动触发 Dream，生成 trace 或 explicit skip reason）；lock 机制（TTL 35min）；budget gate；cron/evidence_threshold/manual 触发复用现有
  - **输入**: `04_SYSTEM_DESIGN/dream-quiet-system.md §1.3`（负责: Dream scheduler）、T-DQS.C.3
  - **输出**: 更新 `src/dream/dream-scheduler.ts`
  - **契约承接**: Quiet 完成后在允许窗口 100% 触发 Dream 或写明 skip reason；lock 防并发
  - **参考**: `dream-quiet-system.md §4`、ADR-005、REQ-005
  - **验收标准**:
    - Given Quiet 成功完成且在允许窗口，When scheduler 检测，Then 自动触发 Dream 或写 skip reason
    - Given Dream lock 已持有，When Quiet 完成触发，Then 不重复启动 Dream，写 `skip:lock_held`
    - Given 非允许窗口，When Quiet 完成，Then 写 `skip:out_of_window`，不触发
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: Quiet-completion 触发；lock 防并发；skip reason 完整性
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-dqs-c-4`
  - **证据产出**: `tests/unit/dream/dream-scheduler.test.ts`、`tests/integration/dream/quiet-dream-trigger.test.ts`
  - **估时**: 4h
  - **依赖**: T-DQS.C.3
  - **优先级**: P0

---

- [x] **T-DQS.C.5** [REQ-001, REQ-005]: 实现 accepted projection 回流至 heartbeat 验证
  - **描述**: 端到端验证：accepted Dream projection 在 state-memory 后可被 `EmbodiedContextAssembler.loadAcceptedDreamProjection` 读取；candidate projection 不进入 heartbeat context；`loadAcceptedProjection` 降级 reason code `context_degraded:dream_projection_unavailable`（DR-024）
  - **输入**: T-DQS.C.3、T-CP.C.1、T-SMS.C.2（loadAcceptedDreamProjection）
  - **输出**: `tests/integration/control-plane/dream-projection-heartbeat.test.ts`
  - **契约承接**: accepted projection 进入 EmbodiedContext；candidate 不进入；降级 reason code 正确
  - **参考**: `control-plane-system.md §2.1 G5`、DR-024、ADR-005
  - **验收标准**:
    - Given Dream projection status = accepted，When heartbeat 组装 EmbodiedContext，Then acceptedDream slice 含该 projection
    - Given Dream projection status = candidate，When heartbeat，Then acceptedDream slice 为空（不含 candidate）
    - Given DB 无 accepted projection，When heartbeat，Then context slice status = degraded，reason = `context_degraded:dream_projection_unavailable`
  - **验证类型**: 集成测试 | E2E测试
  - **验证摘要**: accepted 回流；candidate 隔离；降级 reason
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-dqs-c-5`
  - **证据产出**: `tests/integration/control-plane/dream-projection-heartbeat.test.ts`
  - **估时**: 3h
  - **依赖**: T-DQS.C.3、T-CP.C.1
  - **优先级**: P0

---

- [x] **T-GVS.C.1** [REQ-006]: 实现 GuidanceDraftService（DR-028，delivery 前 validateDraftSources）
  - **描述**: 实现 `GuidanceDraftService`；`GuidanceDraftRequest` TypeScript 接口定义（7 字段：requestId/sceneKind/evidencePackRef/relationshipContextRef 等，DR-030）；delivery 前重验证 `validateDraftSources`（DR-028）：evidence 在 delivery 前被 redact/删除则 draft 标记 `invalid`，返回 `draft_source_invalidated`；inner guide 语言风格（自然、感性、source-backed）
  - **输入**: `04_SYSTEM_DESIGN/guidance-voice-system.md §4`、`§5.1`（GuidanceDraftService 操作契约）、DR-028、DR-030
  - **输出**: `src/guidance/guidance-draft-service.ts`（更新现有 draft-outreach-message.ts）
  - **契约承接**: DraftMessage 含 source_refs；delivery 前重验证；draft_source_invalidated 语义
  - **参考**: `guidance-voice-system.md §5.1`、DR-028、DR-030、ADR-006
  - **验收标准**:
    - Given evidence pack 存在，When generateDraft，Then DraftMessage 含 source_refs，每条 claim source-backed
    - Given draft 生成后 evidence source 被 redact，When delivery 前 validateDraftSources，Then draft 标记 invalid，返回 `draft_source_invalidated`
    - Given GuidanceDraftRequest 缺少必填字段，When 调用，Then TypeScript 编译报错
  - **验证类型**: 单元测试 | API接口功能测试
  - **验证摘要**: source-backed draft；delivery 前重验证；接口字段完整性
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-gvs-c-1`
  - **证据产出**: `tests/unit/guidance/guidance-draft-service.test.ts`
  - **估时**: 6h
  - **依赖**: T-SMS.C.2
  - **优先级**: P1

---

- [x] **T-GVS.C.2** [REQ-006]: 实现 ChannelFeedbackIngestionService（DR-029）
  - **描述**: 实现 `ChannelFeedbackIngestionService`：将 delivery result、owner reaction（tone/timing/no-reply signal）写入 RelationshipMemory；写入失败时指数退避重试 3 次（500/1000/2000ms），失败后写 audit event，禁止静默丢失（DR-029）；缺少 delivery proof 时状态标记 `not_sent`
  - **输入**: `04_SYSTEM_DESIGN/guidance-voice-system.md §4.1`（ChannelFeedbackIngestionService）、DR-029
  - **输出**: `src/guidance/channel-feedback-ingestion-service.ts`（更新现有）
  - **契约承接**: 写入失败重试 + audit；not_sent 语义；owner 回复/未回复均记录
  - **参考**: `guidance-voice-system.md §4.1`、DR-029、ADR-006
  - **验收标准**:
    - Given owner 回复，When 处理 ChannelFeedback，Then RelationshipMemory 更新 tone/timing
    - Given 写入 RelationshipMemory 失败，When 重试 3 次仍失败，Then 写入 audit event，不静默丢失
    - Given 缺少 messageId/hostProofRef，When 处理 delivery result，Then 状态标记 `not_sent`
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: 学习闭环；写入失败重试；not_sent 语义
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-gvs-c-2`
  - **证据产出**: `tests/unit/guidance/channel-feedback-ingestion.test.ts`
  - **估时**: 4h
  - **依赖**: T-GVS.C.1
  - **优先级**: P1

---

- [x] **T-GVS.C.3** [REQ-006]: 实现 OutreachStrategySelector
  - **描述**: 实现 `OutreachStrategySelector`（基于 RelationshipMemory 选择表达频率、措辞风格、fallback copy；language quality checklist：无干燥白话/有具体锚点/无过度阐释，style_lint_failed 降级标记，DR-031）；fallback copy 提供 channel-safe 信息而非空文本
  - **输入**: `04_SYSTEM_DESIGN/guidance-voice-system.md §1.3`（OutreachStrategySelector）、DR-031
  - **输出**: `src/guidance/outreach-strategy-selector.ts`
  - **契约承接**: 语言质量 3 条 lint 规则；style_lint_failed 降级不 block delivery；fallback copy 有信息价值
  - **参考**: `guidance-voice-system.md`、DR-031、ADR-005
  - **验收标准**:
    - Given RelationshipMemory 含 no-reply signals，When 选择策略，Then 降低联系频率
    - Given draft 触发 style_lint_failed，When 检查，Then 降级标记，不 throw，不 block delivery
    - Given delivery 不可用，When 生成 fallback copy，Then 提供有信息量的说明而非空字符串
    - Given dry/plain draft fixture，When 执行 language quality checklist，Then 返回 `style_lint_failed` 且列出命中的规则
    - Given anchored concise draft fixture，When 执行 language quality checklist，Then 通过且不产生降级标记
    - Given fallback context 含 sourceRefs 与 reason，When 生成 fallback copy，Then 文案包含具体锚点、channel-safe reason，且不含 unsupported claim
  - **验证类型**: 单元测试
  - **验证摘要**: 策略选择；fixture-based lint 规则；fallback copy 质量
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-gvs-c-3`
  - **证据产出**: `tests/unit/guidance/outreach-strategy-selector.test.ts`、`tests/unit/guidance/outreach-style-fixtures.test.ts`
  - **估时**: 4h
  - **依赖**: T-GVS.C.2
  - **优先级**: P2

---

- [x] **INT-S4** [MILESTONE]: S4 Dream/Quiet + Guidance 集成验证
  - **描述**: 验证 S4 退出标准：DailyDiary 含 3 段；Dream 在 Quiet 完成后自动触发或写 skip reason；accepted projection 被 heartbeat 读取；channel feedback 写入 RelationshipMemory；delivery proof missing 时 not_sent
  - **输入**: T-DQS.C.1~C.5、T-GVS.C.1~C.3 全部产出
  - **输出**: `reports/int-s4-dream-quiet-guidance-v7.md`
  - **验收标准**: Given S4 完成 / When 逐条检查 diary+dream+projection+feedback / Then 全通过→完成，失败→记 Bug
  - **验证说明**: 集成测试 + DailyDiary artifact 内容截图 + projection lifecycle 追踪日志
  - **估时**: 3h
  - **依赖**: T-DQS.C.1、T-DQS.C.2、T-DQS.C.3、T-DQS.C.4、T-DQS.C.5、T-GVS.C.1、T-GVS.C.2、T-GVS.C.3

---

## S5 Observability

> **目标**: RedactionPolicy 强制化、AppendOnlyAuditStore+lastHashCache、SelfHealthSnapshot+per-probe 超时、HeartbeatDigest、NarrativeTimeline 分页、RestoreAudit。
> **退出**: audit chain 完整性可验证；self_health 覆盖动态维度且最小维度集完整；digest 按平台分类；timeline cursor 分页正常。

---

- [x] **T-OBS.C.1** [REQ-001, REQ-003, REQ-007]: 实现 RedactionPolicy 统一强制化与 AppendOnlyAuditStore in-memory lastHashCache（DR-033）
  - **描述**: 强化 `RedactionPolicy` 为所有系统写入 audit 前的统一 gate（统一 mask/erase/hash 三类规则）；`AppendOnlyAuditStore` 实现 in-memory `lastHashCache`（per-family，O(1) hash chain 写入，DR-033）；进程重启后从 DB 最新记录回填 lastHash；hash chain integrity 可按需验证；DR-039：chain 损坏 5 步处理（隔离/标记 degraded/alert/downstream warnings/不自动修复）
  - **输入**: `04_SYSTEM_DESIGN/observability-health-system.md §1.3`（AppendOnlyAuditStore）、`§3.3`（RedactionPolicy）、DR-033、DR-039
  - **输出**: `src/observability/audit/append-only-audit-store-v7.ts`（更新现有）
  - **契约承接**: lastHashCache O(1) 写入；进程重启回填；chain 损坏 5 步处理；redaction 统一 gate
  - **参考**: `observability-health-system.md §4.2`、DR-033、DR-039、ADR-001
  - **验收标准**:
    - Given 高频 audit write（100 条/s），When 使用 lastHashCache，Then P95 audit append < 10ms
    - Given 进程重启，When AuditStore 初始化，Then 从 DB 最新记录回填 lastHash，chain 不断裂
    - Given chain 损坏检测，When verifyAuditHashChain，Then 隔离 segment 并标记 degraded，不自动修复
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: lastHashCache 性能；重启回填；chain 损坏 5 步处理
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-obs-c-1`
  - **证据产出**: `tests/unit/observability/audit-store.test.ts`、`tests/integration/observability/audit-chain.test.ts`
  - **估时**: 6h
  - **依赖**: T-OBS.F.1
  - **优先级**: P0

---

- [x] **T-OBS.C.2** [REQ-007, REQ-012]: 实现 SelfHealthSnapshot per-probe 超时配置（DR-036）
  - **描述**: 实现 `SelfHealthSnapshot` 动态维度探针模型；最小必测维度为 env/cron/secret/credential/storage/delivery/dream/bridge/circuit_breaker/state_memory，允许后续系统注册扩展维度；每个探针独立超时配置（env 200ms / cron 500ms / secret 1000ms 等，DR-036）；总体上限 3000ms（Promise.allSettled）；全部超时时返回 `lastKnownAt` + `reason: probe_timeout`；循环依赖降级策略（DR-032）：state-memory 不可用时 narrative_timeline / digest 探针标记 degraded，不影响其他探针；SelfHealthView 完整 JSON schema（DR-042）
  - **输入**: `04_SYSTEM_DESIGN/observability-health-system.md §5.1`（DR-036、DR-042 内容）、`§3.3`（DR-032 循环依赖降级）
  - **输出**: `src/observability/services/self-health-snapshot.ts`（更新现有）
  - **契约承接**: 动态维度注册；最小必测维度集；per-probe 超时；3s 总上限；partial health 返回；DR-032 降级策略
  - **参考**: `observability-health-system.md §5.1`、DR-032、DR-036、DR-042、ADR-006
  - **验收标准**:
    - Given 最小必测维度全部正常，When `getSelfHealthSnapshot`，Then 返回 overall=healthy，P95 < 1s，且 SelfHealthView.dimensions 包含每个维度状态
    - Given secret 探针超时 > 1000ms，When 执行，Then 该维度标记 unknown + reason: probe_timeout，其他维度不受影响
    - Given state-memory 不可用，When 执行，Then narrative_timeline 维度 degraded，env/cron/delivery 维度正常
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: 动态维度注册；最小维度集完整性；超时降级；DR-032 循环依赖解耦；SelfHealthView schema
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-obs-c-2`
  - **证据产出**: `tests/unit/observability/self-health-snapshot.test.ts`
  - **估时**: 6h
  - **依赖**: T-OBS.C.1
  - **优先级**: P0

---

- [x] **T-OBS.C.3** [REQ-010]: 实现 HeartbeatDigest 生成服务
  - **描述**: 实现 `HeartbeatDigestAssembler`：每日聚合 connector 操作（按平台列出 success/failure/blocked/circuit-open 计数）、goal 变化、Quiet/Dream 状态、health 变化；无事件时发送 `nothing_significant`，不编造活跃度；digest 格式为 dashboard-style 仪表盘摘要，不是日志转储，不是 outreach；不含 raw payload/credential/私信全文
  - **输入**: `04_SYSTEM_DESIGN/observability-health-system.md §2.1 G4`（HeartbeatDigest）、T-OBS.C.2
  - **输出**: `src/observability/services/heartbeat-digest-assembler.ts`
  - **契约承接**: 按平台计数；nothing_significant 低噪声；dashboard 语气（非 outreach）
  - **参考**: `observability-health-system.md §2.1 G4`、ADR-007、REQ-010
  - **验收标准**:
    - Given 今日含 connector attempts，When 生成 digest，Then 按平台列出 success/failure/blocked/circuit-open 计数
    - Given 无事件，When 生成 digest，Then 输出 `nothing_significant`，不编造活跃度
    - Given digest 内容，When 检查，Then 不含 raw payload、credential 或私信全文
  - **验证类型**: 单元测试 | API接口功能测试
  - **验证摘要**: 计数准确性；nothing_significant 诚实性；内容边界
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-obs-c-3`
  - **证据产出**: `tests/unit/observability/heartbeat-digest-assembler.test.ts`
  - **估时**: 5h
  - **依赖**: T-OBS.C.1
  - **优先级**: P0

---

- [x] **T-OBS.C.4** [REQ-010]: 实现 HeartbeatDigest delivery 推送服务
  - **描述**: 实现 digest delivery：推送到 Feishu/dm/dashboard mock；记录 delivery proof 或 fallback；digest delivery 使用 runtime-ops 推送机制，不使用 guidance-voice 语气；delivery 失败时记录 fallback reason，不声称已发送
  - **输入**: T-OBS.C.3、T-GVS.C.2（参考 delivery proof 模式）
  - **输出**: 更新 `src/observability/services/heartbeat-digest-assembler.ts` 添加 delivery hook
  - **契约承接**: delivery proof 或 fallback；digest 非 outreach 语气；delivery 失败不声称 sent
  - **参考**: `observability-health-system.md §2.1 G4`、ADR-007
  - **验收标准**:
    - Given digest delivery target 为 Feishu，When 生成 digest，Then 推送并记录 delivery proof
    - Given delivery 失败，When 记录，Then 写入 fallback reason，状态 not_sent，不声称 sent
  - **验证类型**: 集成测试 | 手动验证
  - **验证摘要**: delivery proof；fallback 诚实性
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-obs-c-4`
  - **证据产出**: `tests/integration/observability/digest-delivery.test.ts`
  - **估时**: 3h
  - **依赖**: T-OBS.C.3
  - **优先级**: P1

---

- [x] **T-OBS.C.5** [REQ-011]: 实现 NarrativeTimeline cursor 分页（DR-037）
  - **描述**: 实现 `NarrativeTimelineQueryService`：cursor-based pagination（不是 offset）；最大查询范围 90 天（DR-037）；超出范围时返回 error（不 truncate，不静默截断）；diff query 支持任意两版本字段差异对比；state-memory 不可用时降级返回（DR-032）
  - **输入**: `04_SYSTEM_DESIGN/observability-health-system.md §5.1`（DR-037 注释）、T-SMS.C.7、T-OBS.C.1
  - **输出**: `src/observability/services/narrative-timeline-query-service.ts`
  - **契约承接**: cursor 分页；90 天上限；超出返回 error；diff 字段差异
  - **参考**: `observability-health-system.md §2.1 G5`、DR-037、ADR-008
  - **验收标准**:
    - Given timeline 有 100 条记录，When cursor 分页查询，Then 每次返回 limit 条 + next cursor
    - Given 查询范围超过 90 天，When 执行，Then 返回 error（`query_range_exceeded`），不截断
    - Given narrative v1 和 v2，When `narrativeDiff(v1, v2)`，Then 返回 focus/progress/nextIntent/sourceRefs/reasonCode 差异
  - **验证类型**: 单元测试 | API接口功能测试
  - **验证摘要**: cursor 分页；90 天范围限制；diff 正确性
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-obs-c-5`
  - **证据产出**: `tests/unit/observability/narrative-timeline-query.test.ts`
  - **估时**: 4h
  - **依赖**: T-OBS.C.1、T-SMS.C.7
  - **优先级**: P1

---

- [x] **T-OBS.C.6** [REQ-011]: 实现 RestoreAudit（DR-041）
  - **描述**: 实现 `RestoreAuditService`：每次 restore 操作必须写 audit log（from_version/to_version/reason/completed_entities/failed_entities）；restore 原子性策略（DR-041）：audit 写失败采用 fire-and-forget，partial_restore_error 记录已完成/未完成 entity 清单；不恢复 credential 明文；不绕过 trust policy
  - **输入**: `04_SYSTEM_DESIGN/observability-health-system.md §2.1 G6`（RestoreAudit）、T-SMS.C.6、T-OBS.C.1
  - **输出**: `src/observability/services/restore-audit-service.ts`
  - **契约承接**: 每次 restore 写 audit；partial_restore_error 含 entity 清单；audit 失败 fire-and-forget
  - **参考**: `observability-health-system.md §2.1 G6`、DR-041、ADR-008
  - **验收标准**:
    - Given restore 成功，When 执行，Then audit log 含 from_version/to_version/reason
    - Given restore 部分失败，When 记录，Then `partial_restore_error` 含已完成和未完成 entity 清单
    - Given restore 包含 credential entity，When 执行，Then credential 字段被排除，不恢复到 state
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: restore audit 完整性；partial_restore_error；credential 排除
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-obs-c-6`
  - **证据产出**: `tests/unit/observability/restore-audit-service.test.ts`
  - **估时**: 4h
  - **依赖**: T-SMS.C.6、T-OBS.C.1
  - **优先级**: P1

---

- [x] **T-OBS.C.7** [REQ-012]: 实现 RuntimeSecretAnchorView（DR-034）
  - **描述**: 实现 `RuntimeSecretAnchorView`：包含 `recoverySteps: RecoveryStep[]` 内联恢复步骤（DR-034）；检测 missing key / wrong key / rotated key 三类场景，返回 `runtime_secret_unavailable` / `credential_recovery_required` / `runtime_secret_anchor_missing`；不记录 key 明文
  - **输入**: `04_SYSTEM_DESIGN/observability-health-system.md §6.1`（DR-034 内容）、T-OBS.C.2
  - **输出**: `src/observability/services/runtime-secret-anchor-view.ts`
  - **契约承接**: recoverySteps 内联；3 类 reason code；key 明文不记录
  - **参考**: `observability-health-system.md §2.1 G7`、DR-034、ADR-007
  - **验收标准**:
    - Given wrong encryption key，When 读取 credential health，Then 返回 `credential_recovery_required` + recoverySteps
    - Given 新 workspace 无 key anchor，When self health 运行，Then 标记 `runtime_secret_anchor_missing`
    - Given RuntimeSecretAnchorView 输出，When 检查，Then 无 encryption key 明文
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: 3 类 reason code；recoverySteps 内联；key 明文排除
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-obs-c-7`
  - **证据产出**: `tests/unit/observability/runtime-secret-anchor-view.test.ts`
  - **估时**: 4h
  - **依赖**: T-OBS.C.2、T-SMS.C.6
  - **优先级**: P0

---

- [x] **INT-S5** [MILESTONE]: S5 Observability 集成验证
  - **描述**: 验证 S5 退出标准：audit chain 完整性可验证；self_health 覆盖动态维度且最小维度集完整，任意探针超时不影响整体；digest 按平台分类计数正确；timeline cursor 分页正常；restore audit 写入；RuntimeSecretAnchorView 输出 recoverySteps
  - **输入**: T-OBS.C.1~C.7 全部产出
  - **输出**: `reports/int-s5-observability-v7.md`
  - **验收标准**: Given S5 完成 / When 逐条检查 audit+health+digest+timeline+restore+secret / Then 全通过→完成，失败→记 Bug
  - **验证说明**: audit chain 验证日志 + self_health JSON 截图 + digest 样本输出
  - **估时**: 3h
  - **依赖**: T-OBS.C.1、T-OBS.C.2、T-OBS.C.3、T-OBS.C.4、T-OBS.C.5、T-OBS.C.6、T-OBS.C.7

---

## S6 Runtime Ops + E2E

> **目标**: OpenClaw plugin+CLI、manual run/wet test/self_health/restore ops、端到端集成冒烟。
> **退出**: plugin 加载成功；connector_test --wet 返回真实 status；self_health P95 < 1s；端到端 heartbeat 读取 EmbodiedContext。

---

- [x] **T-ROS.C.1** [REQ-007, REQ-009, REQ-010, REQ-011, REQ-012]: 实现 RuntimeSurfaceRouter v7 命令集扩展
  - **描述**: 实现/更新 `RuntimeSurfaceRouter` v7 新增命令：`self_health`（透传 observability SelfHealthSnapshot）、`tool_affordance`（透传 body-tool AffordanceMap）、`connector_test --wet`（标记 triggerSource:"manual"）、`heartbeat_digest`（透传 digest）、`narrative:diff`（透传 NarrativeTimeline diff）、`timeline`（透传 NarrativeTimeline）、`restore`（触发 RestoreSnapshot + RestoreAudit）、`runtime_secret_bootstrap`（透传 RuntimeSecretAnchorView）；所有命令返回统一 `RuntimeOpsEnvelope`
  - **输入**: `04_SYSTEM_DESIGN/runtime-ops-system.md §5`（命令集）、`§6.1`（SelfHealthView schema，DR-042）、T-OBS.C.1~C.7、T-BTS.C.1、T-BTS.C.5、T-CS.C.2、T-SMS.C.6
  - **输出**: 更新 `src/cli/commands/`、`plugin/index.ts`
  - **契约承接**: 所有命令返回 RuntimeOpsEnvelope；connector_test --wet 非 dry run；triggerSource:"manual" 隔离 heartbeat cadence
  - **参考**: `runtime-ops-system.md §5.1`、DR-038、DR-042、ADR-006、ADR-008
  - **验收标准**:
    - Given `connector_test --wet` 命令，When endpoint 返回 404，Then 输出真实 404 status，不返回 dry-run ok
    - Given `self_health` 命令，When DB 可用，Then P95 < 1s，返回动态维度健康状态且包含最小维度集
    - Given `restore` 命令，When 执行，Then 触发 RestoreSnapshotStore + RestoreAuditService，不恢复 credential
  - **验证类型**: API接口功能测试 | 集成测试
  - **验证摘要**: wet test 真实性；self_health 性能；restore 完整路径；triggerSource 隔离
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-ros-c-1`
  - **证据产出**: `tests/integration/runtime-ops/commands.test.ts`
  - **估时**: 8h
  - **依赖**: T-OBS.C.1、T-OBS.C.2、T-OBS.C.3、T-OBS.C.4、T-OBS.C.5、T-OBS.C.6、T-OBS.C.7、T-BTS.C.1、T-BTS.C.5、T-CS.C.2、T-SMS.C.6
  - **优先级**: P0

---

- [x] **T-ROS.C.2** [REQ-001, REQ-007]: 实现 OpenClaw plugin 注册与 WorkspaceOpsBridge v7
  - **描述**: 更新 `plugin/index.ts` 注册 v7 命令集；`WorkspaceOpsBridge` lazy 装配 v7 db/read models/router；保持 host-safe 注册不在 module scope 加载 DB；plugin JSON 描述更新；手动验证 OpenClaw 会话中 `second_nature_ops` 工具可见
  - **输入**: `04_SYSTEM_DESIGN/runtime-ops-system.md §4.2`（PluginSurfaceRegistrar、WorkspaceOpsBridge）、T-ROS.C.1
  - **输出**: 更新 `plugin/index.ts`、`plugin/workspace-ops-bridge.ts`、`plugin/openclaw.plugin.json`
  - **契约承接**: 插件加载不在 module scope 触发 DB；second_nature_ops 工具可见
  - **参考**: `runtime-ops-system.md §4.2`、ADR-001、ADR-006
  - **验收标准**:
    - Given plugin 加载，When OpenClaw 注册，Then second_nature_ops 工具可见
    - Given plugin 在 host-safe 模式，When register()，Then 不触发 DB 初始化，不抛出异常
    - Given workspace root resolved，When WorkspaceOpsBridge 装配，Then v7 router 正确初始化
  - **验证类型**: 集成测试 | 冒烟测试 | 手动验证
  - **验证摘要**: 插件加载安全性；second_nature_ops 可见性；v7 router 初始化
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-ros-c-2`
  - **证据产出**: `tests/integration/plugin/plugin-registration.test.ts`、手动验证截图
  - **估时**: 4h
  - **依赖**: T-ROS.C.1
  - **优先级**: P0

---

- [x] **T-ROS.C.3** [REQ-002, REQ-003]: 实现 ManualRunDispatcher（DR-038）
  - **描述**: 实现 `ManualRunDispatcher`：`connector:run`、`connector_test --wet`、manual heartbeat probe 的隔离入口；`triggerSource: "manual_run"` 标记传给下游；`ManualTriggerContext.affectsHeartbeatCadence: false`；通过 write queue 串行化，不阻塞 cron heartbeat；manual run 隔离不推进 heartbeat cadence
  - **输入**: `04_SYSTEM_DESIGN/runtime-ops-system.md §4.2`（ManualRunDispatcher，DR-038 注释）、T-SMS.F.3、T-CS.C.2
  - **输出**: `src/cli/ops/manual-run-dispatcher.ts`
  - **契约承接**: triggerSource: "manual_run"；不推进 heartbeat cadence；write queue 串行化
  - **参考**: `runtime-ops-system.md §4.2`、DR-038、ADR-006
  - **验收标准**:
    - Given `connector:run` 手动执行，When 执行，Then ToolExperienceRow.triggerSource = "manual_run"
    - Given 并发 cron heartbeat + manual run，When 同时执行，Then write queue 串行化，无数据冲突
    - Given manual run 执行，When 记录，Then affectsHeartbeatCadence = false，cron cadence 不变
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: triggerSource 隔离；cadence 不影响；并发串行化
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-ros-c-3`
  - **证据产出**: `tests/unit/ops/manual-run-dispatcher.test.ts`
  - **估时**: 4h
  - **依赖**: T-SMS.F.3、T-ROS.C.1
  - **优先级**: P0

---

- [x] **T-ROS.C.4** [REQ-001, REQ-007]: 更新 README/AGENTS.md（Bootstrap Recovery Section，DR-034）
  - **描述**: 更新 README.md 添加 Mind/Body 对照表与"引导而非脚本化"原则；在 AGENTS.md 新增 `## Bootstrap Recovery` 章节（DR-034），包含 RuntimeSecretAnchor 路径与"不记录明文 key"的恢复说明；v7 status 标记为 Genesis / design phase；更新"当前状态"块（05A/05B 已生成）
  - **输入**: `01_PRD.md §5.2`（交互规范，核心隐喻）、`AGENTS.md`（当前状态块）、DR-034
  - **输出**: 更新 `README.md`（Mind/Body map）、更新 `AGENTS.md`（Bootstrap Recovery + 任务状态）
  - **契约承接**: README 含 Mind/Body map；AGENTS.md Bootstrap Recovery 节；不记录 key 明文
  - **参考**: ADR-007、DR-034、REQ-007、REQ-012
  - **验收标准**:
    - Given README 打开，When 读者查看 Architecture Map，Then 能看到 Mind/Body 对照表与引导原则
    - Given AGENTS.md，When 查看 Bootstrap Recovery 节，Then 含 RuntimeSecretAnchor 路径与不记录 key 明文说明
    - Given README，When 检查，Then v7 状态标记正确，不承诺未实现能力
  - **验证类型**: 手动验证
  - **验证摘要**: Mind/Body 文档质量；Bootstrap Recovery 完整性；v7 状态标记
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-ros-c-4`
  - **证据产出**: 文档 review checklist
  - **估时**: 2h
  - **依赖**: T-OBS.C.7
  - **优先级**: P1

---

- [x] **T-ROS.C.5** [REQ-001~REQ-012]: v6 回归测试门禁
  - **描述**: 确保 v7 新增代码不破坏 v6 回归测试套件；运行现有 v6 integration tests；修复因 v7 schema migration / type 变更导致的回归失败；生成 v6 regression gate 报告
  - **输入**: 所有 S1~S5 产出、现有 `tests/integration/` v6 测试套件
  - **输出**: `reports/v6-regression-gate-v7.md`
  - **契约承接**: v6 tests 全部 pass（或 explicitly justified skip）
  - **参考**: ADR-001（v6 回归），`02_ARCHITECTURE_OVERVIEW.md §5`（验证策略）
  - **验收标准**:
    - Given v7 代码部署，When 运行 v6 integration tests，Then 全部通过或有 justified skip 说明
    - Given migration 执行，When 检查旧数据，Then v6 格式数据仍可被 v7 stores 读取
  - **验证类型**: 回归测试
  - **验证摘要**: v6 向后兼容；migration 不破坏旧数据
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-ros-c-5`
  - **证据产出**: `reports/v6-regression-gate-v7.md`
  - **估时**: 4h
  - **依赖**: T-ROS.C.2
  - **优先级**: P0

---

- [x] **INT-S6** [MILESTONE]: S6 Runtime Ops + E2E 最终集成验证（Release Gate）
  - **描述**: 验证 S6 及全项目退出标准：plugin 加载成功；connector_test --wet 返回真实 status；self_health P95 < 1s 且动态最小维度集完整；端到端 heartbeat 读取 5 类 slice EmbodiedContext 且 heartbeat P95 < 2s；v6 regression gate 通过；12 个 REQ 全覆盖；AGENTS.md 更新完成
  - **输入**: T-ROS.C.1~C.5、所有 INT-S1~S5 报告
  - **输出**: `reports/int-s6-e2e-release-gate-v7.md`
  - **验收标准**: Given S6 完成 / When 逐条检查 plugin+wet+health+heartbeat+regression+docs / Then 全通过→发布，失败→记 Bug
  - **验证说明**: 端到端截图/录屏 + self_health dimensions JSON + heartbeat 5 类 slice 日志 + heartbeat P95 报告 + v6 regression 报告
  - **估时**: 4h
  - **依赖**: INT-S1、INT-S2、INT-S3、INT-S4、INT-S5、T-ROS.C.1、T-ROS.C.2、T-ROS.C.3、T-ROS.C.4、T-ROS.C.5

---

## S7 v7 Living Loop Closure

> **目标**: 把 v7 从“ops surface 可调用”推进到“状态生命周期、节律与身体反馈自然闭环”。
> **退出**: 0.1.32 E2E 剩余缺口不再依赖空库解释；关键生产链路有 before/after 数据证据。

---

- [x] **T-V7C.C.1** [REQ-009, REQ-011]: Data Lifecycle + Connector Truth Closure
  - **描述**: 补齐 `NarrativeTimeline` 与 `RestoreSnapshot` 的生产入口，并使 `connector_test dryRun:false` 走真实 wet probe；wet probe 结果写入 `capability_probe_result`，heartbeat/manual/wet 三条路径共享 capability/channel 解析，避免 registry health 冒充 wet truth。
  - **输入**: `01_PRD.md §3.1 G9/G11`、`04_SYSTEM_DESIGN/runtime-ops-system.md §5`、`04_SYSTEM_DESIGN/state-memory-system.md §6.2`、T-SMS.C.5、T-SMS.C.6、T-CS.C.2、T-ROS.C.1、0.1.32 E2E 反馈
  - **输出**: 更新 `src/cli/commands/`、`src/cli/ops/`、`src/storage/services/`、相关插件 runtime 产物
  - **契约承接**: `snapshot:capture` ops 入口；narrative timeline snapshot 可被 `narrative:diff` 消费；`connector_test dryRun:false` 返回真实 wet probe status 并持久化 CapabilityProbeResult
  - **参考**: ADR-008、REQ-009、REQ-011
  - **验收标准**:
    - Given workspace 有两个 narrative timeline snapshot，When 调用 `narrative:diff --from A --to B`，Then 返回实际 diff 而非 `NARRATIVE_DIFF_FAILED`
    - Given workspace 无 restore snapshot，When 调用 `snapshot:capture` 后再调用 `restore`，Then restore 不再返回 `snapshot_not_found` 且写入 restore audit
    - Given `connector_test` 传入 `dryRun:false`，When safe endpoint 返回 404/401/200，Then response 含真实 `actualStatus/httpStatus` 且 `capability_probe_result` 增长
  - **验证类型**: API接口功能测试 | 集成测试 | 回归测试
  - **验证摘要**: data production before/after；wet truth；protocol parity
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-v7c-c-1`
  - **证据产出**: `tests/integration/runtime-ops/v7c-data-connector-truth.test.ts`
  - **估时**: 8h
  - **依赖**: INT-S6
  - **优先级**: P0

---

- [x] **T-V7C.C.1R** [REQ-009, REQ-011]: Runtime Data Closure Release Hygiene
  - **描述**: 收口 0.1.34 实机反馈中仍会误判的 release hygiene：`narrative:diff` 对缺失版本返回结构化缺数据错误，而非泛化 `NARRATIVE_DIFF_FAILED`；确认 `connector_test dryRun:false` / wet re-probe 在源码与打包 plugin runtime 中均使用 `capability_probe_result` upsert，不因重复 probe id 崩溃；确认发布包版本与宿主缓存提示一致。
  - **输入**: `01_PRD.md §3.1 G9/G11`、`05B_VERIFICATION_PLAN.md#t-v7c-c-1r`、T-V7C.C.1、0.1.34 Claw 15/16 PASS 反馈
  - **输出**: 更新 `src/cli/ops/ops-router.ts` 错误语义、相关 plugin runtime 产物、runtime ops 回归测试；如 package/plugin version 有变更，更新 `package.json` 与 `plugin/package.json`
  - **契约承接**: `narrative:diff` 缺版本属于缺数据/版本不存在错误；wet re-probe 写入必须幂等；发布包版本必须能被宿主侧明确识别
  - **参考**: ADR-008、REQ-009、REQ-011
  - **验收标准**:
    - Given `narrative:diff` 的 `from` 或 `to` 版本不在 timeline，When 调用命令，Then 返回 `NARRATIVE_VERSION_NOT_FOUND` 或等价 structured reason，且 message 指明缺失 version
    - Given 同一 connector/capability 重复执行 `connector_test dryRun:false`，When probeResultId 重复，Then `capability_probe_result` upsert 更新旧行且命令不抛 UNIQUE constraint
    - Given 插件包被重新构建，When 检查 package/plugin manifest/runtime，Then version 与修复说明一致，Claw 不应继续加载旧 runtime 而无提示
  - **验证类型**: API接口功能测试 | 集成测试 | 回归测试
  - **验证摘要**: narrative 缺版本错误语义；wet re-probe 幂等；package/runtime 版本一致
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-v7c-c-1r`
  - **证据产出**: `tests/integration/runtime-ops/v7c-data-connector-truth.test.ts` 或 `tests/integration/runtime-ops/commands.test.ts`
  - **估时**: 2h
  - **依赖**: T-V7C.C.1
  - **优先级**: P0

---

- [x] **T-V7C.C.2** [REQ-003, REQ-009]: Evidence + Body Feedback Closure
  - **描述**: 将 heartbeat connector、manual connector run 与 wet probe 的结果统一写入 life evidence / ToolExperience / pain signal 输入；连续失败进入 CircuitBreaker，affordance 与 heartbeat 尊重 breaker posture。
  - **输入**: `01_PRD.md §3.1 G3/G9`、`04_SYSTEM_DESIGN/body-tool-system.md §4.3~4.4`、`04_SYSTEM_DESIGN/connector-system.md §5.1`、T-BTS.C.4、T-BTS.C.5、T-CS.C.3、T-V7C.C.1、T-V7C.C.1R
  - **输出**: 更新 connector execution 写入适配、heartbeat connector path、manual run dispatcher、body feedback 集成测试
  - **契约承接**: connector attempt 100% 写 ToolExperience 或 explicit unavailable reason；success evidence 写入 `life_evidence_index`；heartbeat/manual/wet triggerSource 可区分；breaker open 时 heartbeat 不继续执行同 capability
  - **参考**: ADR-003、ADR-008、REQ-003、REQ-009
  - **验收标准**:
    - Given connector success，When heartbeat connector path 完成，Then `life_evidence_index` 增长且 `tool_experience.trigger_source = "heartbeat"`
    - Given manual connector run 成功或失败，When 命令完成，Then ToolExperience 写入且 `trigger_source = "manual_run"`，不推进 heartbeat cadence
    - Given wet probe 执行成功/失败，When body feedback 汇总读取，Then probe result 可转为 pain signal 或 explicit unavailable reason，不冒充 connector execution success
    - Given 同一 capability 连续失败达到阈值，When 下一轮 heartbeat 计划同 capability，Then 返回 `connector_circuit_open` 或等价 structured reason
    - Given breaker cooldown 到期，When half-open probe 成功，Then breaker 恢复 closed，失败则保持 cooldown
  - **验证类型**: 单元测试 | 集成测试 | 回归测试
  - **验证摘要**: evidence growth；heartbeat/manual/wet experience feedback；breaker enforcement
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-v7c-c-2`
  - **证据产出**: `tests/integration/control-plane/v7c-evidence-body-feedback.test.ts`
  - **估时**: 8h
  - **依赖**: T-V7C.C.1R
  - **优先级**: P0

---

- [x] **T-V7C.C.3** [REQ-005, REQ-010]: Rhythm Loop Closure
  - **描述**: 让 Quiet completion 后的 Dream scheduler 与 heartbeat/daily digest 进入自然运行链路；Dream 未运行时必须写 explicit skip reason，digest 推送失败必须写 fallback，不把手动命令可用冒充自动节律闭环。
  - **输入**: `01_PRD.md §3.1 G5/G10`、`04_SYSTEM_DESIGN/dream-quiet-system.md §4`、`04_SYSTEM_DESIGN/observability-health-system.md §2.1 G4`、T-DQS.C.4、T-DQS.C.5、T-OBS.C.3、T-OBS.C.4、T-V7C.C.2
  - **输出**: 更新 quiet/dream scheduler 接线、heartbeat digest trigger/delivery hook、rhythm integration tests
  - **契约承接**: Quiet 后 Dream 自动触发或写 skip；accepted Dream projection 进入 heartbeat；heartbeat/daily digest 自动生成并推送或记录 fallback proof
  - **参考**: ADR-005、ADR-006、REQ-005、REQ-010
  - **验收标准**:
    - Given Quiet 产出 source-backed diary，When 进入 Dream 允许窗口，Then 自动调度 Dream 或写 explicit skip reason
    - Given accepted Dream projection 存在，When heartbeat 构造 EmbodiedContext，Then projection 进入 context summary
    - Given digest delivery target 可用/不可用，When digest window 到达，Then 写 delivery proof 或 fallback reason
  - **验证类型**: 集成测试 | 冒烟测试 | 手动验证
  - **验证摘要**: quiet→dream；dream→heartbeat；heartbeat→digest owner proof
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-v7c-c-3`
  - **证据产出**: `tests/integration/dream/v7c-rhythm-loop.test.ts`、`reports/v7c-rhythm-loop.md`
  - **估时**: 8h
  - **依赖**: T-V7C.C.2
  - **优先级**: P0

---

- [x] **T-V7C.C.4R** [REQ-006, REQ-008]: Guidance Chain & Prompt Injection Closure
  - **描述**: 修复 guidance bridge 接线断路、替换 `buildDraftText` 硬编码英文占位、新增 `guidance_payload` ops 命令、实现 capabilityClass 双轴 impulse 选择体系，并支持 Claw 通过 workspace 自定义 platform-specific impulse。capabilityClass 从 `capabilityIntent` 字符串前缀推断，不依赖 `EffectSemanticsClass`（执行层与表达层解耦）。`agent.*` 能力完全排除，不进入 impulse 体系。
  - **输入**: `04_SYSTEM_DESIGN/guidance-voice-system.md`、`src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.ts`、`src/core/second-nature/heartbeat/heartbeat-executor.ts`、`src/guidance/guidance-draft-service.ts`、`src/cli/ops/ops-router.ts`、`src/guidance/templates/impulses/`、T-GVS.C.1、T-V7C.C.3
  - **输出**:
    - `src/guidance/capability-class.ts`：`inferCapabilityClass(capabilityIntent)` 推断函数 + `CapabilityClass` 类型（consume / broadcast / interact / discover / claim）
    - `src/guidance/impulse-assembler.ts`：三级 fallback 选择逻辑（platform-specific → capabilityClass → intentKind → baseline）
    - `src/guidance/templates/impulses/explore.md`：consume/discover 场景姿态模板
    - `src/guidance/templates/impulses/work.md`：claim 场景极简姿态模板
    - `src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.ts`：接入 `heartbeat-executor.ts` guidance bridge
    - `src/guidance/guidance-draft-service.ts`：`buildDraftText` 替换为真实中文模板内容（消费 `template-registry.ts`）
    - `src/cli/ops/ops-router.ts`：新增 `guidance_payload` command（返回当前 scene 的 impulse + atmosphere + persona 组装结果）
    - `plugin/agent-inner-guide.md`：补充平台语言指导章节（capabilityClass 语义与 platform-specific impulse 自定义说明）
  - **契约承接**: capabilityClass 推断覆盖所有已知 capability 前缀；impulse 三级 fallback 可单测；`guidance_payload` 返回结构体含 impulseText/atmosphereText/sceneKind；`agent.*` 不注入任何 impulse
  - **参考**: ADR-005、ADR-006、REQ-006、REQ-008
  - **验收标准**:
    - Given `capabilityIntent = "post.publish"`，When `inferCapabilityClass`，Then 返回 `broadcast`
    - Given `capabilityIntent = "feed.read"`，When `inferCapabilityClass`，Then 返回 `consume`
    - Given `capabilityIntent = "agent.heartbeat"`，When impulse assembler，Then 返回 null（排除）
    - Given `intentKind = "social"` + `capabilityClass = "broadcast"`，When assembler，Then 返回 `social.md` impulse（无 platform-specific 时）
    - Given platform-specific impulse 存在 workspace，When assembler，Then 优先使用 platform-specific
    - Given `run-heartbeat-cycle-v7.ts` 调用 heartbeat executor，When guidance bridge 有上下文，Then `buildDraftText` 返回中文模板内容而非英文占位
    - Given `ops-router.ts` 收到 `guidance_payload` 命令，When 执行，Then 返回含 impulseText/atmosphereText 的结构体
  - **验证类型**: 单元测试 | 集成测试 | API接口功能测试
  - **验证摘要**: capabilityClass 推断正确性；impulse fallback 链路；guidance bridge 接线；buildDraftText 中文内容；guidance_payload command 结构
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-v7c-c-4r`
  - **证据产出**: `tests/unit/guidance/capability-class.test.ts`、`tests/unit/guidance/impulse-assembler.test.ts`、`tests/integration/guidance/v7c-guidance-chain.test.ts`
  - **估时**: 10h
  - **依赖**: T-V7C.C.3
  - **优先级**: P0

---

- [x] **T-V7C.C.4** [REQ-004, REQ-006, REQ-008]: Identity / Goal Hygiene Closure
  - **描述**: 加固长期运行卫生：同 kind/scope goal replace/dedupe 在 ops 与 heartbeat 路径一致；IdentityProfile 成为 connector request 的统一身份源；owner feedback/relationship memory 继续影响 guidance strategy。
  - **输入**: `01_PRD.md §4 US-004/US-006/US-008`、`04_SYSTEM_DESIGN/state-memory-system.md §4.4`、`04_SYSTEM_DESIGN/guidance-voice-system.md §4.1`、T-SMS.C.3、T-SMS.C.4、T-GVS.C.2、T-GVS.C.3、T-V7C.C.4R
  - **输出**: 更新 goal ops/heartbeat hygiene tests、connector identity context adapter、relationship feedback regression tests
  - **契约承接**: active goal 不分裂；connector 不依赖 prompt 临时身份；owner feedback 影响后续表达策略
  - **参考**: ADR-004、ADR-006、ADR-007、REQ-004、REQ-006、REQ-008
  - **验收标准**:
    - Given 同 kind/scope 多次设置 goal，When heartbeat 读取 active goals，Then 只有最新 accepted goal 有效
    - Given IdentityProfile 含平台 handle，When connector request 构造，Then 对应平台身份可读且不含 credential
    - Given owner no-reply/positive/negative feedback，When guidance strategy 选择，Then frequency/tone 按 RelationshipMemory 调整
  - **验证类型**: 单元测试 | 集成测试 | 回归测试
  - **验证摘要**: goal dedupe；identity source；relationship feedback
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-v7c-c-4`
  - **证据产出**: `tests/integration/state/v7c-identity-goal-hygiene.test.ts`
  - **估时**: 6h
  - **依赖**: T-V7C.C.4R
  - **优先级**: P1

---

- [x] **INT-V7C** [MILESTONE]: v7 Living Loop Closure 集成验证
  - **描述**: 验证 v7 post-E2E closure：data lifecycle、connector truth、body feedback、rhythm loop、guidance chain、identity/goal hygiene 全链路均有真实 before/after 证据。
  - **输入**: T-V7C.C.1、T-V7C.C.2、T-V7C.C.3、T-V7C.C.4R、T-V7C.C.4 全部产出
  - **输出**: `reports/int-v7c-living-loop-closure.md`
  - **验收标准**: Given v7 closure tasks 完成 / When 逐条检查 0.1.32 剩余缺口与 living-loop 核心路径 / Then 全通过→v7 living loop closure 完成，失败→记 Bug
  - **验证说明**: 运行相关集成测试、插件 bridge 回归、Claw E2E 手册关键命令；记录 16/16 或明确 non-blocking external unavailable
  - **估时**: 4h
  - **依赖**: T-V7C.C.4

---

## S8 0.1.38 Real-host Closure

> **目标**: 将 0.1.38 Claw 实机反馈中暴露的宿主入口、生产数据增长与 guidance 语义悬空问题转化为可验证修复，避免本地集成测试 PASS 冒充真实宿主闭环。
> **退出**: `sn-0.1.38-full-issues.md` 的 P0/P1 项均有源码修复或结构化 non-blocking 解释；Claw 复测报告能看到 command 可达性、DB before/after 与 guidance 语义证据。

---

- [x] **T-V7C.C.5** [REQ-006, REQ-007, REQ-009, REQ-011]: Host Ops Surface Parity
  - **描述**: 修复 0.1.38 实机中 `guidance_payload` 仍为 `unknown_command` 的插件层入口断路，并收口 `connector_test` 成功 wrapper、`restore snapshotId` 参数兼容与 manifest/host-safe command 描述漂移。
  - **输入**: `01_PRD.md §3.1 G6/G7/G9/G11`、`04_SYSTEM_DESIGN/runtime-ops-system.md §5`、`04_SYSTEM_DESIGN/guidance-voice-system.md §4`、T-ROS.C.1、T-ROS.C.2、T-V7C.C.1R、T-V7C.C.4R、`C:\Users\11341\Downloads\sn-0.1.38-full-issues.md`
  - **输出**: 更新 `plugin/index.ts` workspace bridge whitelist / host-safe router / simple CLI parser、`plugin/openclaw.plugin.json` 描述、`src/cli/ops/ops-router.ts` response/restore 参数兼容、相关 plugin runtime 产物与回归测试
  - **契约承接**: `guidance_payload` 在 Claw `second_nature_ops` 可达；wet probe 成功时 envelope `ok=true`；`restore` 同时接受 legacy `restoreTarget/fromVersion/toVersion` 与 operator-friendly `snapshotId`；manifest 描述包含真实 v7 ops surface
  - **参考**: ADR-006、ADR-007、ADR-008、REQ-006、REQ-007、REQ-009、REQ-011
  - **验收标准**:
    - Given Claw 通过 `second_nature_ops` 调用 `guidance_payload`，When 输入 `post.publish/feed.read/agent.heartbeat`，Then 命令不再 `unknown_command` 且返回对应 impulse/none 结构
    - Given wet probe 返回健康结果，When 调用 `connector_test dryRun:false`，Then envelope `ok=true` 且 `capability_probe_result` upsert 成功
    - Given operator 只传 `snapshotId`，When 调用 `restore`，Then 命令可恢复该 snapshot 或返回结构化 `SNAPSHOT_NOT_FOUND`，不再 `MISSING_RESTORE_FIELDS`
    - Given plugin package 被 Claw 加载，When 查看 manifest/command list，Then v7 ops surface 描述与实际 whitelist 一致
  - **验证类型**: API接口功能测试 | 集成测试 | 手动验证 | 回归测试
  - **验证摘要**: plugin entry parity；ops envelope truth；restore parameter compatibility；host manifest truth
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-v7c-c-5`
  - **证据产出**: `tests/integration/plugin/plugin-registration.test.ts`、`tests/integration/runtime-ops/commands.test.ts`、`reports/claw-0.1.38-gap-regression.md`
  - **估时**: 6h
  - **依赖**: INT-V7C
  - **优先级**: P0

---

- [x] **T-V7C.C.6** [REQ-003, REQ-005, REQ-009, REQ-010]: Production Data Growth Closure
  - **描述**: 修复实机中 `life_evidence_index`、`tool_experience`、`dream_output_index`、`heartbeat_digest` 无增长的问题；区分“没有可执行 intent”的合理 defer/deny 与“生产写入链路没接上”的真实缺口。
  - **输入**: `01_PRD.md §3.1 G3/G5/G9/G10`、`04_SYSTEM_DESIGN/control-plane-system.md §4`、`04_SYSTEM_DESIGN/body-tool-system.md §4.3`、`04_SYSTEM_DESIGN/dream-quiet-system.md §4`、T-V7C.C.2、T-V7C.C.3、`C:\Users\11341\Downloads\sn-0.1.38-full-issues.md`
  - **输出**: 更新 heartbeat connector/evidence 写入路径、ToolExperience 生产注入、Quiet→Dream 实机触发或 explicit skip、heartbeat_digest 持久化/可观测路径、DB before/after 验证报告
  - **契约承接**: heartbeat connector attempt 写 ToolExperience 或 explicit unavailable reason；success evidence 写入 `life_evidence_index`；Dream 自动触发或写 skip reason；heartbeat digest 有持久化 row 或明确无 delivery target 的 fallback
  - **参考**: ADR-003、ADR-005、ADR-006、ADR-008、REQ-003、REQ-005、REQ-009、REQ-010
  - **验收标准**:
    - Given 实机 heartbeat 选择 connector intent 并执行成功，When 比较前后 DB，Then `life_evidence_index` 与 `tool_experience` 至少一项增长且 triggerSource 可读
    - Given connector intent 因 `missing_source_refs` 或 `affordance_unavailable` defer/deny，When 读取 heartbeat result，Then 返回结构化原因并不冒充执行成功
    - Given Quiet 写入 source-backed diary，When Dream 允许窗口满足，Then `dream_output_index` 增长或写 explicit skip reason
    - Given heartbeat/digest window 触发，When digest delivery target 不可用，Then 写 fallback/proof 信息而不是静默 0 rows
  - **验证类型**: 集成测试 | API接口功能测试 | 冒烟测试 | 手动验证
  - **验证摘要**: production DB growth；heartbeat defer/deny truth；quiet→dream rows；digest rows/fallback
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-v7c-c-6`
  - **证据产出**: `tests/integration/control-plane/v7c-production-growth.test.ts`、`tests/integration/dream/v7c-rhythm-loop.test.ts`、`reports/claw-0.1.38-db-growth.md`
  - **估时**: 8h
  - **依赖**: T-V7C.C.5
  - **优先级**: P0

---

- [x] **T-V7C.C.7** [REQ-006, REQ-008]: Guidance Semantics Refinement
  - **描述**: 将 guidance payload 从“可预览字段”收敛为“引导而非程序”的表达协议：`outputGuard` 不再被误解为最终格式规范或 hard guard；`atmosphere` 压缩为低频状态约束；`impulse/persona/expression boundary` 必须能进入真实生成上下文或明确标记为 preview-only。
  - **输入**: `01_PRD.md §3.1 G6/G8`、`04_SYSTEM_DESIGN/guidance-voice-system.md §4`、ADR-006、T-GVS.C.1、T-GVS.C.3、T-V7C.C.4R、用户关于“引导而非程序”的确认
  - **输出**: 更新 `src/guidance/output-guard.ts` 命名/兼容层、`src/guidance/template-registry.ts` atmosphere 文本策略、guidance assembly/apply 语义、agent-inner-guide 说明与测试 fixtures
  - **契约承接**: expression boundary 只塑造表达、不决定 allow/deny、不规定最终格式；atmosphere 是短状态约束；impulse 是动作姿态；hard guard 仍由 guard layer 独占
  - **参考**: ADR-002、ADR-006、REQ-006、REQ-008
  - **验收标准**:
    - Given guidance payload 包含 expression boundary，When 进入生成上下文，Then 它只表现为 avoid/prefer 式表达约束，不要求固定 JSON/Markdown 格式
    - Given `agent.heartbeat` 或内部能力，When 组装 guidance，Then 不注入 social impulse，且 boundary 不越权影响 hard guard verdict
    - Given high-risk / quiet / active 三类 mode，When 生成 atmosphere，Then 返回短约束文本而非长篇背景散文
    - Given 现有消费者仍读取 `outputGuard`，When 运行兼容测试，Then 不发生破坏性字段缺失；新语义以 `expressionBoundary` 或等价字段为主
  - **验证类型**: 单元测试 | 集成测试 | 回归测试 | 手动验证
  - **验证摘要**: guidance semantics；backward compatibility；prompt pollution reduction；hard guard boundary
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-v7c-c-7`
  - **证据产出**: `tests/integration/guidance/v7c-guidance-semantics.test.ts`、`tests/integration/guidance/v7c-guidance-chain.test.ts`
  - **估时**: 6h
  - **依赖**: T-V7C.C.5
  - **优先级**: P1

---

- [x] **INT-V7C.R** [MILESTONE]: 0.1.38 Claw Gap Regression Gate
  - **描述**: 以 `sn-0.1.38-full-issues.md` 为回归基线，验证 host ops 可达、生产数据增长、Dream/digest、guidance 语义与发布包版本在 Claw 实机中闭合。
  - **输入**: T-V7C.C.5、T-V7C.C.6、T-V7C.C.7 全部产出
  - **输出**: `reports/int-v7c-r-claw-gap-regression.md`
  - **验收标准**: Given 0.1.38 gap 修复完成 / When 在 Claw 实机与本地集成测试执行 representative commands / Then P0 全 PASS，P1 有 PASS 或结构化 non-blocking reason，失败项进入下一轮 change
  - **验证说明**: 对照 `sn-0.1.38-full-issues.md` 逐项执行；记录 command JSON、DB before/after、插件版本、package dry-run 与实机截图/日志
  - **估时**: 4h
  - **依赖**: T-V7C.C.6、T-V7C.C.7

---

## S8 Heartbeat Unlock — SourceRefs / Affordance / Execution 因果链修复

> **背景**: 用户分析确认心跳失败的三步因果链 — (1) sourceRefs 为空 → (2) guard 拦截 (missing_source_refs + affordance_unavailable) → (3) execution 从未到达。本 Sprint 分三层解锁。

- [x] **T-V7C.C.8** [REQ-003, REQ-009]: Guard Pass — SourceRefs Goal-Bound Fallback + Affordance Default Posture
  - **描述**: 修复 planCandidateIntents 的 sourceRefs 生成逻辑（空 evidence 时回退到 goal-based refs）；修复 affordance assembler 使 built-in connectors 默认 `needs_auth` 而非 `unavailable`，让 hard guard 放行。
  - **输入**: `src/core/second-nature/orchestrator/intent-planner.ts`、`src/cli/index.ts` affordance 组装、`src/core/second-nature/orchestrator/hard-guard-evaluator.ts`
  - **输出**: 更新 intent-planner sourceRefs 回退逻辑、affordance assembler credentialRequired 策略、单元测试
  - **契约承接**: exploration/social/outreach/reflection intent 在无 lifeEvidence 时仍能有非空 sourceRefs；affordance 对无 probe 的 built-in connector 标记为 `needs_auth`（guard 不拦截）而非 `unavailable`（guard 拦截）
  - **参考**: ADR-003、ADR-008、REQ-003、REQ-009
  - **验收标准**:
    - Given heartbeat runtime 无 lifeEvidence 但有 accepted goals / When planCandidateIntents 生成 exploration/social/outreach / Then sourceRefs 非空且指向 goal uri
    - Given affordance assembler 无 probe 历史 / When 组装 affordance map / Then built-in connectors (moltbook/evomap/agent-world) 状态为 `needs_auth` 而非 `unavailable`
    - Given exploration intent 有 goal sourceRefs + affordance needs_auth / When evaluateHardGuards / Then verdict=`allow`（无 missing_source_refs 或 affordance_unavailable）
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: sourceRefs fallback；affordance default posture；guard pass
  - **估时**: 4h
  - **依赖**: INT-V7C.R
  - **优先级**: P0

- [x] **T-V7C.C.9** [REQ-003, REQ-009]: Execution Unlock — Moltbook Mock Runner
  - **描述**: 在 connector-executor-adapter 中为 moltbook 添加 mock/demo 执行路径：当 `SECOND_NATURE_MOLTBOOK_BASE_URL` 缺失时，读取 workspace mock JSON 返回模拟 feed 数据，让心跳链路完整跑通到 evidence 写入。
  - **输入**: `src/connectors/services/connector-executor-adapter.ts`、T-V7C.C.8
  - **输出**: moltbook mock runner 内联逻辑 + workspace mock 数据模板 + 集成测试
  - **契约承接**: mock 数据必须产生有效的 ConnectorResult，能被 policy layer 正常处理并生成 life evidence；mock 路径必须显式标记为 `demo/mock` 来源，不冒充真实平台数据
  - **参考**: ADR-003、REQ-003
  - **验收标准**:
    - Given `SECOND_NATURE_MOLTBOOK_BASE_URL` 未设置且 workspace 存在 mock 数据 / When 执行 moltbook feed.read / Then 返回成功结果且结果标记 `source: "mock"`
    - Given mock 执行成功 / When heartbeat 后续处理 / Then `life_evidence_index` 或 `tool_experience` 有写入记录
    - Given mock 数据不存在 / When 执行 moltbook / Then 仍返回 `configuration_missing`（不降级为静默失败）
  - **验证类型**: 集成测试 | 手动验证
  - **验证摘要**: mock runner；evidence generation；heartbeat e2e
  - **估时**: 4h
  - **依赖**: T-V7C.C.8
  - **优先级**: P0

- [x] **INT-V7C.U** [MILESTONE]: Heartbeat Unlock Integration Verification
  - **描述**: 验证 T-V7C.C.8 + T-V7C.C.9 + Wave 83 后，心跳能完整跑通 intent → guard pass → connector execute → life evidence → narrative update；同时验证通用自定义 connector (declarative_http) 可被 executor 执行。
  - **输出**: `reports/int-v7c-u-heartbeat-unlock.md`
  - **验收标准**: Given 本地无真实 API credential / When 触发完整心跳周期 / Then 至少一个 connector intent 经历完整链路并产生 evidence row；Given `connector init --baseUrl` / When 执行 declarative_http connector / Then 通用 HTTP runner 发送请求到配置域名
  - **验证说明**: 5 项新测试全部 PASS；核心回归 364/364（361 pass + 3 skips）
  - **估时**: 2h
  - **依赖**: T-V7C.C.9
  - **输入**: T-V7C.C.8、T-V7C.C.9
  - **输出**: `reports/int-v7c-u-heartbeat-unlock.md`
  - **验收标准**: Given 本地无真实 API credential / When 触发完整心跳周期 / Then 至少一个 connector intent 经历完整链路并产生 evidence row
  - **估时**: 2h
  - **依赖**: T-V7C.C.9

---

## S9 Connector 因果链完整性修复

> **背景**: 审计报告（2026-05-29）确认三条阻断 Q/D/C 全链的缺口：(P0) Life Evidence 永不写入 — `extractSourceRefs` 不识别 `posts`/`agents` 等平台数组字段；(P1) instreet/evomap 有完整 adapter 但执行层未接线；(P2) delivery target 硬编码 `unknown` 阻断 outreach 流。同时补齐声明式 runner 框架（Scriptable runner），使 Workspace connector 可通过自定义脚本执行，不依赖 `declarative_http`。

- [x] **T-CS.C.7** [REQ-003, REQ-009]: P0 — Life Evidence 链路修复：extractSourceRefs 平台数组识别
  - **描述**: 修复 `extractSourceRefs`（`src/connectors/base/map-life-evidence.ts`），使其能识别平台返回的 `posts`/`nodes`/`agents`/`edges`/`results`/`entries` 等通用数组字段，并从中生成有效 SourceRef。修复后 moltbook feed.read（返回 `{posts: [...]}`）和 agent-world feed.read（返回 `{agents: [...]}`）均能产生非空 sourceRefs，解锁 life evidence 写入。
  - **输入**: `src/connectors/base/map-life-evidence.ts`、moltbook mock runner 产出、agent-world adapter 产出
  - **输出**: 更新后的 `map-life-evidence.ts`（新增平台数组识别分支）+ 单元测试
  - **契约承接**: `ConnectorResult.data` 携带 `posts`/`agents` 等平台数组时，`extractSourceRefs` 返回非空 SourceRef 列表；`mapLifeEvidence` 对 feed.read / work.discover intent 返回非 null 的 `LifeEvidenceCandidate`
  - **参考**: ADR-003、ADR-008、REQ-003、REQ-009
  - **验收标准**:
    - Given moltbook feed.read 返回 `{posts: [{id, url}]}` / When `extractSourceRefs` 处理 / Then 返回 SourceRef 数组且长度 > 0
    - Given agent-world feed.read 返回 `{agents: [{id}]}` / When `extractSourceRefs` 处理 / Then 返回 SourceRef 数组且长度 > 0
    - Given 深层嵌套 `{data: {posts: [...]}}` / When `extractSourceRefs` 递归 / Then 正确穿透并识别 posts 数组
    - Given 已有 sourceRefs/items 字段 / When 处理 / Then 不破坏原有分支逻辑（回归）
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: extractSourceRefs 平台数组分支覆盖；mapLifeEvidence 端到端返回值验证；回归原有 sourceRefs/items 路径
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cs-c-7`
  - **证据产出**: `tests/unit/connectors/map-life-evidence.test.ts`（扩展）
  - **估时**: 3h
  - **依赖**: INT-V7C.U
  - **优先级**: P0

- [x] **T-CS.C.8** [REQ-003, REQ-009]: P0 — Life Evidence 链路修复：端到端写入集成验证
  - **描述**: 以 T-CS.C.7 修复为基础，验证完整链路：moltbook mock runner 执行 → policy layer 处理 ConnectorResult → `mapLifeEvidence` 返回非 null candidate → `appendLifeEvidence` 写入 `life_evidence_index`。确认 policy-layer 的 `payload` 包裹方式（`{capability, channel, data: <platform_data>}`）与 `extractSourceRefs` 递归匹配；如不匹配，在 policy-layer 侧修正包裹层级。
  - **输入**: T-CS.C.7 产出、`src/connectors/base/policy-layer.ts`、`src/storage/life-evidence/append-life-evidence.ts`
  - **输出**: 集成测试（heartbeat → evidence 端到端）+ 必要的 policy-layer 修复
  - **契约承接**: heartbeat 单次执行后 `life_evidence_index` 至少有一条新记录；DB before/after 断言可客观验证
  - **参考**: ADR-003、REQ-003
  - **验收标准**:
    - Given moltbook mock runner 已配置 / When 触发 feed.read 执行 / Then `life_evidence_index` 行数在执行后增加（DB before/after）
    - Given policy layer 包裹 ConnectorResult.data / When extractSourceRefs 递归 / Then 识别内层平台数组
    - Given `feed.read` intent 成功 / When `mapLifeEvidence` 处理 / Then 返回 `evidenceType: "platform_browse"` 的非 null candidate
  - **验证类型**: 集成测试 | 手动验证
  - **验证摘要**: life evidence 写入端到端；policy-layer data 包裹与 extractSourceRefs 对齐；heartbeat DB growth
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cs-c-8`
  - **证据产出**: `tests/integration/connectors/life-evidence-chain.test.ts`
  - **估时**: 3h
  - **依赖**: T-CS.C.7
  - **优先级**: P0

- [x] **T-CS.C.9** [REQ-009]: P1 — instreet connector 接线：注册 + platform_unavailable 标记
  - **描述**: 在 `createConnectorExecutorAdapter` 的 registry 注册 `instreetManifest`；在 `createAdaptiveExecutionRunner` 增加 instreet 执行分支，返回结构化 `platform_unavailable` reason（instreet 的验证流程依赖 skill/browser 宿主通道，纯 api_rest 下当前不可用）。不实例化完整 runner，但确保 affordance assembler 能感知 instreet 已注册，生成 `needs_auth` 而非因 `unknown_platform` 静默失败。
  - **输入**: `src/connectors/services/connector-executor-adapter.ts`、`src/connectors/social-community/instreet/manifest.ts`
  - **输出**: 更新后的 `connector-executor-adapter.ts` + 编译检查
  - **契约承接**: `resolveCapability("instreet", *)` 返回已注册能力而非 `not_registered`；instreet 执行返回 `{success: false, error: {code: "platform_unavailable", detail: "instreet_requires_skill_browser_channel"}}` 而非 `"unknown_platform"`
  - **参考**: ADR-008、REQ-009
  - **验收标准**:
    - Given instreet 已注册 / When `resolveCapability("instreet", "notification.list")` / Then 返回 ResolvedConnectorCapability（非 not_registered）
    - Given instreet 执行分支触发 / When executor 处理 instreet 请求 / Then 返回 `success: false, error.code: "platform_unavailable"`
    - Given `pnpm typecheck` / When 编译 / Then 无新增类型错误
  - **验证类型**: 编译检查 | 单元测试
  - **验证摘要**: instreet registry 注册；执行分支结构化返回；不引入 unknown_platform 语义混淆
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cs-c-9`
  - **证据产出**: `tests/unit/connectors/instreet-registration.test.ts`
  - **估时**: 2h
  - **依赖**: T-CS.C.8
  - **优先级**: P1

- [x] **T-CS.C.10** [REQ-003, REQ-009]: P1 — evomap connector 接线：真实 runner 接入
  - **描述**: 修复 `createAdaptiveExecutionRunner` 中 evomap 执行分支——从 `not_implemented` 占位替换为真实的 `createEvoMapRunner` 调用。需要：① 实现 `EvoMapSecretPort` 的持久化版本（复用 credential vault KV 模式存储 node_secret）；② 实现 `EvoMapApiClient` / `EvoMapA2AClient` 的 HTTP fetch 函数（参照 `fetchAgentWorldJson` 模式）；③ 读取环境变量 `SECOND_NATURE_EVOMAP_BASE_URL`；④ 未配置时返回 `configuration_missing`（非 `not_implemented`）。
  - **输入**: `src/connectors/services/connector-executor-adapter.ts`、`src/connectors/agent-network/evomap/adapter.ts`、credential vault 实现
  - **输出**: 更新后的 `connector-executor-adapter.ts`（evomap 真实 runner）+ `EvoMapSecretPort` 实现 + HTTP fetch 函数 + 单元测试
  - **契约承接**: `SECOND_NATURE_EVOMAP_BASE_URL` 未设置时返回 `configuration_missing`；已设置且 node_secret 存在时向配置 URL 发送真实 HTTP；`saveNodeSecret` 持久化后 `loadNodeSecret` 可读
  - **参考**: ADR-003、ADR-008、REQ-003、REQ-009
  - **验收标准**:
    - Given `SECOND_NATURE_EVOMAP_BASE_URL` 未设置 / When 执行 evomap 任意 intent / Then 返回 `error.code: "configuration_missing"`（非 `"not_implemented"`）
    - Given base URL 已设置且 node_secret 已存在 / When 执行 `agent.heartbeat` / Then 向配置 URL 发送真实 HTTP 请求
    - Given `agent.register` 成功 / When `saveNodeSecret` 后 / Then `loadNodeSecret` 可读回 node_secret
    - Given `pnpm typecheck` / When 编译 / Then 无新增类型错误
  - **验证类型**: 单元测试 | 集成测试
  - **验证摘要**: evomap configuration_missing 语义；真实 runner 接线；node_secret 持久化
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cs-c-10`
  - **证据产出**: `tests/unit/connectors/evomap-runner.test.ts`、`tests/integration/connectors/evomap-secret-port.test.ts`
  - **估时**: 5h
  - **依赖**: T-CS.C.9
  - **优先级**: P1

- [x] **T-ROS.C.6** [REQ-006, REQ-007]: P1 — Delivery Target 真实探测（替换硬编码 unknown）
  - **描述**: 修复 `ops-router.ts` 中 `createStaticHostCapabilityAdapter` 的 `checkDeliveryTarget`：当前 static probe 路径硬编码 `{status: "unknown", evidenceRefs: []}`，导致 outreach 流程永远无法判断 delivery 可用性。改为检查 workspace connector 是否注册有 `message.send`/`comment.reply` 能力的 manifest，返回 `available`/`unavailable` 状态和 evidenceRefs。无 workspace connector 时返回 `unavailable` + reason，不再使用 `unknown`。
  - **输入**: `src/cli/ops/ops-router.ts`（`createStaticHostCapabilityAdapter`）、`src/cli/host-capability/types.ts`、manifest scanner
  - **输出**: 更新后的 `checkDeliveryTarget` 实现 + 单元测试
  - **契约承接**: workspace connector 有 `message.send` 能力时返回 `available`；无配置时返回 `unavailable` + reason；不抛异常；不再硬编码 `"unknown"`
  - **参考**: ADR-006、REQ-006、REQ-007
  - **验收标准**:
    - Given workspace 有 message.send 能力的 connector manifest / When `checkDeliveryTarget()` / Then 返回 `status: "available"` 且 evidenceRefs 非空
    - Given workspace 无 delivery connector / When `checkDeliveryTarget()` / Then 返回 `status: "unavailable"` 且有 reason（非 unknown）
    - Given static probe 路径无 plugin context / When `checkDeliveryTarget()` / Then 结构化返回（不抛异常）
  - **验证类型**: 单元测试 | API接口功能测试
  - **验证摘要**: delivery target 三态；evidenceRefs 非空断言；unavailable reason 明确
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-ros-c-6`
  - **证据产出**: `tests/unit/cli/delivery-target-probe.test.ts`
  - **估时**: 4h
  - **依赖**: T-CS.C.10
  - **优先级**: P1

- [x] **T-CS.C.11** [REQ-009]: P2 — 声明式 Workspace Connector：Scriptable Runner 框架
  - **描述**: 为 workspace connector manifest 新增 `scriptable_node` runner 类型。`runner.json` 声明 `kind: "scriptable_node", entry: "runner.mjs"`（相对于 manifest 目录）。`createAdaptiveExecutionRunner` 识别此类型后用动态 `import()` 加载脚本，以 `{intent, payload, credential}` 为入参，期待脚本导出默认函数返回 `{success: boolean, data?: unknown, error?: {code: string, detail: string}}`。超时（默认 10s）、脚本缺失、运行时抛出分别返回 `timeout`/`configuration_missing`/`script_error`。
  - **输入**: `src/connectors/services/connector-executor-adapter.ts`、`src/connectors/manifest/manifest-schema.ts`（新增 runner kind）、`src/connectors/registry/manifest-scanner.ts`
  - **输出**: 更新后的 manifest schema + `createScriptableNodeRunner` 函数 + executor 分支 + 单元测试
  - **契约承接**: manifest 声明 `runner.kind: "scriptable_node"` 时 executor 加载脚本；脚本接口契约固定；四种错误分支均有结构化返回
  - **参考**: ADR-001、REQ-009
  - **验收标准**:
    - Given manifest 声明 `scriptable_node` / When 执行对应 platformId / Then executor 加载并调用 runner.mjs 导出函数
    - Given runner.mjs 不存在 / When 执行 / Then 返回 `error.code: "configuration_missing"` 含脚本路径
    - Given runner.mjs 抛出错误 / When 执行 / Then 返回 `error.code: "script_error"` 含错误信息
    - Given runner.mjs 超时 / When 执行 / Then 返回 `error.code: "timeout"`
    - Given `pnpm typecheck` / When 编译 / Then manifest schema 新增 kind 无类型错误
  - **验证类型**: 单元测试 | 编译检查
  - **验证摘要**: scriptable_node runner 加载与执行；四种错误分支；manifest schema 类型正确
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cs-c-11`
  - **证据产出**: `tests/unit/connectors/scriptable-node-runner.test.ts`
  - **估时**: 5h
  - **依赖**: T-ROS.C.6
  - **优先级**: P2

- [x] **T-CS.C.12** [REQ-009]: P2 — 声明式 Workspace Connector：Scriptable Runner 集成验证
  - **描述**: 基于 T-CS.C.11，编写集成测试验证完整链路：workspace manifest 注册 scriptable_node → scanner 识别 → executor 加载真实 fixture .mjs → ConnectorResult 返回 → mapLifeEvidence 处理生成 evidence。同时以 inline 注释补充脚本接口规范（入参/出参结构、timeout 约定、credential 传递方式）。
  - **输入**: T-CS.C.11 产出、manifest scanner、fixture runner.mjs（测试用）
  - **输出**: 集成测试（使用真实 .mjs fixture）+ 脚本接口规范注释
  - **契约承接**: scriptable_node connector 端到端执行链路有测试证据；脚本接口契约（输入/输出 JSON）明确且文档化
  - **参考**: ADR-001、REQ-009
  - **验收标准**:
    - Given workspace 有完整 scriptable_node connector（manifest + runner.mjs fixture）/ When executor 执行 / Then ConnectorResult.success = true 且 data 来自脚本返回值
    - Given 脚本返回 data 含 items/posts 数组 / When mapLifeEvidence 处理 / Then 生成 life evidence
    - Given `pnpm lint && pnpm typecheck` / When 运行 / Then 通过
  - **验证类型**: 集成测试 | Lint检查 | 编译检查
  - **验证摘要**: scriptable_node 端到端执行；与 life evidence 联动；quality gate 通过
  - **验证引用**: `05B_VERIFICATION_PLAN.md#t-cs-c-12`
  - **证据产出**: `tests/integration/connectors/scriptable-node-e2e.test.ts`
  - **估时**: 4h
  - **依赖**: T-CS.C.11
  - **优先级**: P2

- [x] **INT-S9** [MILESTONE]: S9 Connector 因果链完整性验证
  - **描述**: 验证 S9 退出标准：life evidence 写入、connector 接线、delivery target 探测、scriptable runner 执行全部通过集成验证。
  - **输入**: T-CS.C.7 ~ T-CS.C.12、T-ROS.C.6 全部产出
  - **输出**: `reports/int-s9-connector-chain.md`
  - **验收标准**:
    - Given S9 所有任务已完成 / When 执行集成测试套件 / Then T-CS.C.7/C.8（life evidence）、T-CS.C.9（instreet registered）、T-CS.C.10（evomap runner）、T-ROS.C.6（delivery target）、T-CS.C.11/C.12（scriptable runner）全部 PASS
    - Given `pnpm lint && pnpm typecheck` / When 运行 / Then 无错误
    - Given 单次 heartbeat 循环（moltbook mock runner）/ When feed.read 完成 / Then `life_evidence_index` 有新增记录（DB before/after）
  - **验证说明**: 按退出标准逐条执行，日志/DB 截图确认
  - **估时**: 2h
  - **依赖**: T-CS.C.12

---

## 附录：优先级速查

| 优先级 | 任务数 | 代表任务 |
|--------|--------|---------|
| P0 | 36 | Foundation schema、WriteValidationGate、CircuitBreaker、EmbodiedContext、Dream acceptance、audit chain、host ops parity、production data growth、**life evidence chain fix (T-CS.C.7/C.8)** |
| P1 | 13 | RestoreSnapshot、BehaviorPromotion、ChannelFeedback、HeartbeatDigest delivery、NarrativeTimeline、SecretAnchorView、guidance semantics、**instreet registration (T-CS.C.9)、evomap runner (T-CS.C.10)、delivery target probe (T-ROS.C.6)** |
| P2 | 3 | OutreachStrategySelector、language quality lint、**scriptable runner framework (T-CS.C.11/C.12)** |

---

*本文档由 `/blueprint` 自动生成，应随 `/forge` 执行进度更新 checkbox 状态。*
