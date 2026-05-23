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

- [ ] **T-GVS.C.1** [REQ-006]: 实现 GuidanceDraftService（DR-028，delivery 前 validateDraftSources）
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

- [ ] **T-GVS.C.2** [REQ-006]: 实现 ChannelFeedbackIngestionService（DR-029）
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

- [ ] **T-GVS.C.3** [REQ-006]: 实现 OutreachStrategySelector
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

- [ ] **INT-S4** [MILESTONE]: S4 Dream/Quiet + Guidance 集成验证
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

- [ ] **T-OBS.C.1** [REQ-001, REQ-003, REQ-007]: 实现 RedactionPolicy 统一强制化与 AppendOnlyAuditStore in-memory lastHashCache（DR-033）
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

- [ ] **T-OBS.C.2** [REQ-007, REQ-012]: 实现 SelfHealthSnapshot per-probe 超时配置（DR-036）
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

- [ ] **T-OBS.C.3** [REQ-010]: 实现 HeartbeatDigest 生成服务
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

- [ ] **T-OBS.C.4** [REQ-010]: 实现 HeartbeatDigest delivery 推送服务
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

- [ ] **T-OBS.C.5** [REQ-011]: 实现 NarrativeTimeline cursor 分页（DR-037）
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

- [ ] **T-OBS.C.6** [REQ-011]: 实现 RestoreAudit（DR-041）
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

- [ ] **T-OBS.C.7** [REQ-012]: 实现 RuntimeSecretAnchorView（DR-034）
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

- [ ] **INT-S5** [MILESTONE]: S5 Observability 集成验证
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

- [ ] **T-ROS.C.1** [REQ-007, REQ-009, REQ-010, REQ-011, REQ-012]: 实现 RuntimeSurfaceRouter v7 命令集扩展
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

- [ ] **T-ROS.C.2** [REQ-001, REQ-007]: 实现 OpenClaw plugin 注册与 WorkspaceOpsBridge v7
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

- [ ] **T-ROS.C.3** [REQ-002, REQ-003]: 实现 ManualRunDispatcher（DR-038）
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

- [ ] **T-ROS.C.4** [REQ-001, REQ-007]: 更新 README/AGENTS.md（Bootstrap Recovery Section，DR-034）
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

- [ ] **T-ROS.C.5** [REQ-001~REQ-012]: v6 回归测试门禁
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

- [ ] **INT-S6** [MILESTONE]: S6 Runtime Ops + E2E 最终集成验证（Release Gate）
  - **描述**: 验证 S6 及全项目退出标准：plugin 加载成功；connector_test --wet 返回真实 status；self_health P95 < 1s 且动态最小维度集完整；端到端 heartbeat 读取 5 类 slice EmbodiedContext 且 heartbeat P95 < 2s；v6 regression gate 通过；12 个 REQ 全覆盖；AGENTS.md 更新完成
  - **输入**: T-ROS.C.1~C.5、所有 INT-S1~S5 报告
  - **输出**: `reports/int-s6-e2e-release-gate-v7.md`
  - **验收标准**: Given S6 完成 / When 逐条检查 plugin+wet+health+heartbeat+regression+docs / Then 全通过→发布，失败→记 Bug
  - **验证说明**: 端到端截图/录屏 + self_health dimensions JSON + heartbeat 5 类 slice 日志 + heartbeat P95 报告 + v6 regression 报告
  - **估时**: 4h
  - **依赖**: INT-S1、INT-S2、INT-S3、INT-S4、INT-S5、T-ROS.C.1、T-ROS.C.2、T-ROS.C.3、T-ROS.C.4、T-ROS.C.5

---

## 附录：优先级速查

| 优先级 | 任务数 | 代表任务 |
|--------|--------|---------|
| P0 | 32 | Foundation schema、WriteValidationGate、CircuitBreaker、EmbodiedContext、Dream acceptance、audit chain |
| P1 | 9 | RestoreSnapshot、BehaviorPromotion、ChannelFeedback、HeartbeatDigest delivery、NarrativeTimeline、SecretAnchorView |
| P2 | 1 | OutreachStrategySelector、language quality lint 等 |

---

*本文档由 `/blueprint` 自动生成，应随 `/forge` 执行进度更新 checkbox 状态。*
