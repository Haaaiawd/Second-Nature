# 05B_VERIFICATION_PLAN.md — Second Nature v7 验证计划

**项目**: Second Nature v7  
**版本**: 7.0  
**生成日期**: 2026-05-21  
**生成来源**: `/blueprint`  
**状态**: 初始规划  
**执行主清单**: `05A_TASKS.md`

---

## 1. 范围与目标

本验证计划覆盖 `.anws/v7/05A_TASKS.md` 中 42 个任务与 6 个 INT 里程碑，目标是证明 v7 的 embodied agent loop 不只被实现，而且能被客观证据验收。

验证目标：

- 所有 `[REQ-001]` ~ `[REQ-012]` 至少有一个任务和一个验证承接。
- 所有公共契约都有实现承接与验证承接，尤其是 CLI/ops 命令、跨系统 Port、持久化 schema、错误语义、redaction 与 recovery 语义。
- 项目级验收同时包含单元测试与 API 接口功能测试。
- E2E 只保留关键链路触发条件与证据预期，实际执行交给 `/forge`。
- Sprint 退出通过 `INT-S{N}` 关门任务收口，不能把冒烟测试散落成普通开发任务。

---

## 2. 验证分层策略

| 层次 | 负责范围 | 主要材料 | 触发边界 |
|---|---|---|---|
| 编译检查 | TypeScript 类型契约、non-empty tuple、品牌类型、enum 约束 | `pnpm typecheck` / `tsc --noEmit` | 类型或 schema 基础任务 |
| Lint检查 | 代码风格、未使用分支、基础质量 | `pnpm lint` | Foundation 与 release gate |
| 单元测试 | 状态机、算法、错误语义、redaction、policy、assembler | `tests/unit/` | 默认最小验证层 |
| API接口功能测试 | CLI/ops envelope、Port 方法、命令参数、错误码、before/after 状态 | `tests/api/` 或 `tests/integration/*commands*` | 对外或跨系统契约 |
| 集成测试 | SQLite/sql.js、write queue、heartbeat、connector、Dream/Quiet、audit chain | `tests/integration/` | 跨系统数据流 |
| 冒烟测试 | Sprint 退出标准 | `reports/int-s*-*.md` | 只绑定 INT 任务 |
| E2E测试 | OpenClaw host、plugin 工具可见、heartbeat 端到端 context、self_health dimensions | 手动截图/录屏/host 日志 | S6 release gate |
| 回归测试 | v6 兼容与既有测试套件 | `reports/v6-regression-gate-v7.md` | S6 release gate |

---

## 3. 风险类别覆盖原则

- **契约缺失风险**: 每个 Port/命令/schema/error code 至少落一个 API接口功能测试或集成测试。
- **状态机风险**: GoalLifecycle、BehaviorPromotion、CircuitBreaker、Dream lifecycle、RestoreAudit 用表驱动单元测试闭合。
- **数据一致性风险**: SQLite migration、write queue、store before/after 断言必须进集成测试。
- **安全与隐私风险**: credential、token、raw private content、raw prompt、encryption key 必须被 gate/redaction 类型和运行时双层拒绝。
- **观测死锁风险**: observability/state-memory 循环依赖用 partial health、audit core 解耦和 degraded reason code 验证。
- **外部真实性风险**: wet probe 必须验证真实 HTTP/status 和 safe_for_probe，不允许 dry-run ok 冒充健康。
- **反膨胀**: 用代表性正常/边界/异常样本覆盖风险类别，不做字段笛卡尔积枚举。

---

## 4. 测试材料与证据要求

| 验证类型 | 测试材料位置 | 证据形式 |
|---|---|---|
| 编译检查 | `tsconfig.json`、类型测试 | CI 日志 / `tsc --noEmit` 输出 |
| Lint检查 | repo lint script | CI 日志 |
| 单元测试 | `tests/unit/` | 测试报告 |
| API接口功能测试 | `tests/api/` 或命令级 integration test | JSON response / before-after 断言 |
| 集成测试 | `tests/integration/` | 集成测试报告 |
| 冒烟测试 | `reports/int-s*-*.md` | 通过/失败表 + Bug 清单 |
| E2E/手动验证 | OpenClaw host、plugin UI、terminal logs | 截图 / 录屏 / host log |
| 回归测试 | 既有 v6 test suite | `reports/v6-regression-gate-v7.md` |

---

## 5. Task-by-Task 验证计划

<a id="t-sms-f-1"></a>
### T-SMS.F.1
- **关联需求**: REQ-001, REQ-004, REQ-008
- **关联契约**: v7 entity types, `SourceRef` non-empty tuple, `AgentGoal.kind`, `RestoreSnapshot` whitelist
- **风险类别**: 类型契约 / 数据模型 / 架构一致性
- **单元测试覆盖**: 类型级断言覆盖合法实体、非法 kind、空 source refs、restore entity 白名单。
- **API接口功能测试覆盖**: 不适用；本任务不暴露 runtime API。
- **集成/E2E/冒烟覆盖**: INT-S1 编译关口复验。
- **前置数据**: v7 PRD、state-memory/control-plane/body-tool 设计文档。
- **断言**: 非法类型无法通过编译；实体字段与系统设计一致。
- **证据**: `tests/unit/shared/v7-entities.test.ts`, typecheck 日志。

<a id="t-sms-f-2"></a>
### T-SMS.F.2
- **关联需求**: REQ-001, REQ-003, REQ-011
- **关联契约**: SQLite schema migration, `_meta.schema_version`, migration failure degraded marker
- **风险类别**: 持久化结构 / migration 回滚 / 旧数据兼容
- **单元测试覆盖**: migration runner 顺序、失败标记、重复执行幂等。
- **API接口功能测试覆盖**: DB 初始化入口返回 schema ready 或 `schema_migration_failed`。
- **集成/E2E/冒烟覆盖**: 全新 DB、旧 schema、失败 SQL 三类集成路径。
- **前置数据**: 空 DB、旧版 DB fixture、故障 migration fixture。
- **断言**: schema version 正确递增；失败不丢已有数据；新增字段 DEFAULT NULL。
- **证据**: `tests/unit/storage/migration-runner.test.ts`, `tests/integration/storage/schema-migration.test.ts`。

<a id="t-sms-f-3"></a>
### T-SMS.F.3
- **关联需求**: REQ-001, REQ-003
- **关联契约**: serial write queue, `BEGIN EXCLUSIVE`, retry policy, `triggerSource`
- **风险类别**: 并发写入 / 数据一致性 / manual-vs-heartbeat 标记
- **单元测试覆盖**: queue 顺序、退避重试、flush 失败 stderr。
- **API接口功能测试覆盖**: 写入 API before/after 验证 `triggerSource` 被保留。
- **集成/E2E/冒烟覆盖**: 并发 heartbeat + manual run 集成路径。
- **前置数据**: initialized DB 与两个并发 write request。
- **断言**: 写入串行化；失败不阻塞读；`manual_run` 不被改写成 `heartbeat`。
- **证据**: `tests/unit/storage/write-queue.test.ts`, concurrency test log。

<a id="t-obs-f-1"></a>
### T-OBS.F.1
- **关联需求**: REQ-001, REQ-003, REQ-007
- **关联契约**: audit family registry, unknown family rejection
- **风险类别**: trace 扩展 / audit 聚合冲突 / 可观测性一致性
- **单元测试覆盖**: 8 系统 family 加载、未知 family 拒绝。
- **API接口功能测试覆盖**: audit write 接口对 unknown family 返回 `unknown_audit_family`。
- **集成/E2E/冒烟覆盖**: INT-S1 验证 registry 可加载。
- **前置数据**: `audit-family-registry.json`。
- **断言**: 所有系统 family 注册完整；未注册 family 不入链。
- **证据**: `tests/unit/observability/family-registry.test.ts`。

<a id="int-s1"></a>
### INT-S1
- **关联需求**: S1 退出标准
- **关联契约**: v7 基础类型、DB migration、write queue、audit family registry
- **风险类别**: Sprint 关口 / 基础设施可用性
- **单元测试覆盖**: 汇总 S1 单元测试。
- **API接口功能测试覆盖**: DB/init 与 audit write 代表性接口。
- **集成/E2E/冒烟覆盖**: 编译、DB 初始化、queue 并发、registry 加载冒烟。
- **前置数据**: T-SMS.F.1~F.3、T-OBS.F.1 全部完成。
- **断言**: S1 退出标准全部通过；失败项进入 Bug 清单。
- **证据**: `reports/int-s1-foundation-v7.md`。

<a id="t-sms-c-1"></a>
### T-SMS.C.1
- **关联需求**: REQ-001, REQ-008
- **关联契约**: `WriteValidationGate`, `write_validation_failed:{reason}`
- **风险类别**: 安全边界 / source grounding / 写入不可绕过
- **单元测试覆盖**: credential、token、raw private content、raw prompt、missing source refs、合规写入。
- **API接口功能测试覆盖**: 写入入口 before/after，非法 payload 被拒绝且不落库。
- **集成/E2E/冒烟覆盖**: INT-S2 state store 集成复验。
- **前置数据**: schema migration、write queue。
- **断言**: 所有写入路径经过 gate；错误 reason 可机读。
- **证据**: `tests/unit/storage/write-validation-gate.test.ts`。

<a id="t-sms-c-2"></a>
### T-SMS.C.2
- **关联需求**: REQ-001, REQ-006
- **关联契约**: `EmbodiedContextStatePort`, `loadAcceptedDreamProjection(limit)`, degraded reason code
- **风险类别**: read port 缺失 / bounded context / Dream projection 回流
- **单元测试覆盖**: 5 个 read 方法、limit/window、空态 reason。
- **API接口功能测试覆盖**: Port 方法代表性正常与空态请求。
- **集成/E2E/冒烟覆盖**: accepted DreamOutput 生命周期集成。
- **前置数据**: accepted/candidate DreamOutput fixtures、recent interaction fixtures。
- **断言**: candidate 不被读取；accepted 按 limit 返回；空态给 `context_degraded:dream_projection_unavailable`。
- **证据**: `tests/unit/storage/embodied-context-state-port.test.ts`, `tests/integration/state/dream-projection-lifecycle.test.ts`。

<a id="t-sms-c-3"></a>
### T-SMS.C.3
- **关联需求**: REQ-004
- **关联契约**: `GoalLifecycleStore`, `upsertAgentGoal`, `transitionGoalLifecycle`
- **风险类别**: 状态机 / 并发 replace / active goal 分裂
- **单元测试覆盖**: accepted/completed/expired/paused/replaced 转换与非法转换。
- **API接口功能测试覆盖**: goal write/read before-after 与错误语义。
- **集成/E2E/冒烟覆盖**: 并发同 kind+scope upsert 集成。
- **前置数据**: goal fixtures、write queue。
- **断言**: 同 kind+scope 只有一个 active；paused 可终结；并发无死锁。
- **证据**: `tests/unit/storage/goal-lifecycle-store.test.ts`, `tests/integration/state/goal-lifecycle.test.ts`。

<a id="t-sms-c-4"></a>
### T-SMS.C.4
- **关联需求**: REQ-004, REQ-008
- **关联契约**: `IdentityProfileStore`, `InteractionSnapshotProjector`
- **风险类别**: identity 合并 / raw content 泄漏 / bounded interaction
- **单元测试覆盖**: profile upsert、platform handle 合并、interaction trimming。
- **API接口功能测试覆盖**: profile read/write API 正常、缺参、非法 platformId。
- **集成/E2E/冒烟覆盖**: INT-S2 state read model 集成。
- **前置数据**: identity fixture、interaction fixture。
- **断言**: 跨平台 identity 可读；recent interaction 不含私信全文。
- **证据**: `tests/unit/storage/identity-profile-store.test.ts`。

<a id="t-sms-c-5"></a>
### T-SMS.C.5
- **关联需求**: REQ-003, REQ-009
- **关联契约**: `ToolExperienceStore`, `CapabilityProbeResultStore`, `failureClass`, `capabilityId`
- **风险类别**: probe 结果映射 / failure taxonomy / raw payload 泄漏
- **单元测试覆盖**: experience append-only、failureClass 转写、capabilityId required。
- **API接口功能测试覆盖**: store write before-after、非法 missing capabilityId 拒绝。
- **集成/E2E/冒烟覆盖**: connector probe result 被 affordance 读取。
- **前置数据**: connector result fixtures、probe result fixtures。
- **断言**: `failureClass` 不由 body-tool 猜测；raw payload 被 gate 拒绝。
- **证据**: `tests/unit/storage/tool-experience-store.test.ts`。

<a id="t-sms-c-6"></a>
### T-SMS.C.6
- **关联需求**: REQ-011, REQ-012
- **关联契约**: `RestoreSnapshotStore`, `RuntimeSecretAnchorStore`, excluded sensitive kinds
- **风险类别**: rollback 边界 / secret 泄漏 / snapshot 范围漂移
- **单元测试覆盖**: entity whitelist、最近 3 版保留、sensitive exclusion。
- **API接口功能测试覆盖**: snapshot create/read before-after；secret anchor 不返回明文。
- **集成/E2E/冒烟覆盖**: restore + audit 集成前置。
- **前置数据**: mutable state fixtures、credential fixture。
- **断言**: credential/raw prompt/encryption key 不进入 snapshot；anchor 仅存 locationRef。
- **证据**: `tests/unit/storage/restore-snapshot-store.test.ts`。

<a id="t-cs-c-1"></a>
### T-CS.C.1
- **关联需求**: REQ-009
- **关联契约**: manifest v7 schema, `probeConfig`, `endpointMappings`, `capabilityId`
- **风险类别**: connector 声明漂移 / probe 安全配置 / schema 严格性
- **单元测试覆盖**: valid manifest、missing capabilityId、invalid idempotencyClass。
- **API接口功能测试覆盖**: registry register 返回具体校验错误。
- **集成/E2E/冒烟覆盖**: INT-S2 connector registry 集成。
- **前置数据**: manifest v7 fixtures。
- **断言**: schema 严格校验；safeEndpoint 和 endpoint mapping 可读。
- **证据**: `tests/unit/connectors/manifest-v7-schema.test.ts`。

<a id="t-cs-c-2"></a>
### T-CS.C.2
- **关联需求**: REQ-009
- **关联契约**: `WetProbeRunner`, `CapabilityProbeResult`, `EffectCommitLedger`, safe_for_probe
- **风险类别**: 外部事实真实性 / side-effect 防护 / idempotency
- **单元测试覆盖**: safe endpoint request、strict side-effect 拒绝、ledger 幂等。
- **API接口功能测试覆盖**: `runWetProbe` 正常、HTTP 404、probe policy denied。
- **集成/E2E/冒烟覆盖**: probe idempotency 与 SQLite ledger 集成。
- **前置数据**: fake HTTP endpoint、connector manifest。
- **断言**: 返回真实 httpStatus；dry-run 不冒充 wet；side-effect endpoint 不执行。
- **证据**: `tests/unit/connectors/wet-probe-runner.test.ts`, `tests/integration/connectors/probe-idempotency.test.ts`。

<a id="t-cs-c-3"></a>
### T-CS.C.3
- **关联需求**: REQ-003, REQ-009
- **关联契约**: `StructuredUnavailableReason`, connector execution result, `failureClass`
- **风险类别**: 错误语义 / execution telemetry / failure taxonomy
- **单元测试覆盖**: auth missing、policy denied、http error、timeout、rate limited。
- **API接口功能测试覆盖**: connector execution 正常与异常 response schema。
- **集成/E2E/冒烟覆盖**: failure result 写入 ToolExperience。
- **前置数据**: connector adapter fixtures。
- **断言**: unavailable reason 可机读；`failureClass` 直接进入 result。
- **证据**: `tests/unit/connectors/structured-unavailable-reason.test.ts`。

<a id="t-sms-c-7"></a>
### T-SMS.C.7
- **关联需求**: REQ-005, REQ-010, REQ-011
- **关联契约**: `DiaryDreamStore`, `HistoryDigestStore`, Dream lifecycle persistence
- **风险类别**: Dream candidate/accepted 分离 / digest 可追溯 / timeline 数据源
- **单元测试覆盖**: diary/dream output write/read、candidate/accepted/archived transition。
- **API接口功能测试覆盖**: lifecycle transition before-after，非法 transition 拒绝。
- **集成/E2E/冒烟覆盖**: Dream output lifecycle 集成。
- **前置数据**: quiet claims、dream output fixtures。
- **断言**: state-memory 只执行 transition，不自行决策 acceptance。
- **证据**: `tests/unit/storage/diary-dream-store.test.ts`, `tests/integration/state/dream-output-lifecycle.test.ts`。

<a id="int-s2"></a>
### INT-S2
- **关联需求**: S2 退出标准
- **关联契约**: state-memory stores, connector registry, wet probe
- **风险类别**: Sprint 关口 / state+connector 集成
- **单元测试覆盖**: 汇总 S2 单元测试。
- **API接口功能测试覆盖**: Port 与 connector operation 代表性契约。
- **集成/E2E/冒烟覆盖**: DB 端口、wet probe、goal lifecycle 冒烟。
- **前置数据**: S2 所有任务完成。
- **断言**: state stores 可读写；wet probe 真实；goal lifecycle 可验证。
- **证据**: `reports/int-s2-core-state-connector-v7.md`。

<a id="t-bts-c-1"></a>
### T-BTS.C.1
- **关联需求**: REQ-002, REQ-003
- **关联契约**: `AffordanceAssembler.assembleAffordanceMap(contextScope)`, cache invalidation
- **风险类别**: affordance 过期 / 多源聚合 / 性能
- **单元测试覆盖**: manifest+breaker+probe+experience 聚合、缓存失效。
- **API接口功能测试覆盖**: affordance read API 按 scope 返回。
- **集成/E2E/冒烟覆盖**: probe 更新后 map 立即反映。
- **前置数据**: registry/probe/experience fixtures。
- **断言**: P95 < 1s for 50 manifests；breaker/probe 变更失效缓存。
- **证据**: `tests/unit/body/affordance-assembler.test.ts`, `tests/integration/body/affordance-map.test.ts`。

<a id="t-bts-c-2"></a>
### T-BTS.C.2
- **关联需求**: REQ-002, REQ-004
- **关联契约**: `AffordanceContextScope`
- **风险类别**: 权限/范围过滤 / goalKind 误用 / 默认值不清
- **单元测试覆盖**: platformIds allowlist、goalKind filter、allowedStatuses default。
- **API接口功能测试覆盖**: 不适用；T-BTS.C.1 的 read API 覆盖。
- **集成/E2E/冒烟覆盖**: INT-S3 affordance 集成。
- **前置数据**: mixed platform capabilities。
- **断言**: 未在 allowlist 的 platform 不返回；默认只返回可用/半开安全能力。
- **证据**: `tests/unit/body/affordance-context-scope.test.ts`。

<a id="t-bts-c-3"></a>
### T-BTS.C.3
- **关联需求**: REQ-004
- **关联契约**: `BehaviorPromotion` state machine
- **风险类别**: operator 授权幂等 / 过期清理 / promotion 误启用 / goal behavior 边界漂移
- **单元测试覆盖**: candidate->approved/rejected/expired、重复 approve、重新提交。
- **API接口功能测试覆盖**: promotion command 正常与非法状态。
- **集成/E2E/冒烟覆盖**: INT-S3 body tool 集成。
- **前置数据**: behavior promotion fixtures、goal lifecycle fixtures。
- **断言**: 7 天未授权自动 expired；reject 后可按规则重新提交；approved promotion 不自动获得 connector 执行授权。
- **证据**: `tests/unit/body/behavior-promotion-loop.test.ts`。

<a id="t-bts-c-4"></a>
### T-BTS.C.4
- **关联需求**: REQ-003
- **关联契约**: `ExperienceWriter.recordExperience(attempt)`, `ProbeSignalAdapter`, `getPainSignal`, `triggerSource`
- **风险类别**: 身体反馈丢失 / triggerSource 漂移 / failureClass 误推导
- **单元测试覆盖**: recordExperience、probe signal adaptation、getPainSignal bounded query、redaction before write。
- **API接口功能测试覆盖**: manual/heartbeat attempt before-after。
- **集成/E2E/冒烟覆盖**: auto-probe -> CapabilityProbeResult -> affordance map；pain signal 被 affordance/heartbeat 读取。
- **前置数据**: ConnectorResult fixtures。
- **断言**: `triggerSource` 必填；failureClass 从 connector result 转写；`getPainSignal(connectorId, capabilityId?)` 不返回 raw payload，且返回 `PainSignal` 字段 connectorId、capabilityId、painLevel、recentFailureRate、consecutiveFailures、cooldownRecommended、lastOutcomes。
- **证据**: `tests/unit/body/experience-writer.test.ts`, `tests/unit/body/pain-signal-query.test.ts`。

<a id="t-bts-c-5"></a>
### T-BTS.C.5
- **关联需求**: REQ-003, REQ-009
- **关联契约**: `CircuitBreakerManager`, HalfOpen wet probe request
- **风险类别**: breaker 永不恢复 / unsafe probe / state transition
- **单元测试覆盖**: Closed/Open/HalfOpen transitions、cooldown、safe_for_probe check。
- **API接口功能测试覆盖**: breaker probe request 正常、policy denied、probe failed。
- **集成/E2E/冒烟覆盖**: circuit-breaker lifecycle 集成。
- **前置数据**: repeated failure experience rows。
- **断言**: HalfOpen 主动调用 connector wet probe；成功恢复 Closed；失败回 Open。
- **证据**: `tests/unit/body/circuit-breaker-manager.test.ts`, `tests/integration/body/circuit-breaker-lifecycle.test.ts`。

<a id="t-cp-c-1"></a>
### T-CP.C.1
- **关联需求**: REQ-001, REQ-008
- **关联契约**: `EmbodiedContextAssembler`, bounded slices, degraded status
- **风险类别**: context 膨胀 / 降级不可解释 / read port 越界
- **单元测试覆盖**: 7 read port 上限、slice trim、loaded/degraded/blocked 状态。
- **API接口功能测试覆盖**: context assembly API 正常与依赖失败。
- **集成/E2E/冒烟覆盖**: heartbeat context 集成。
- **前置数据**: identity/goals/recent/toolExperience/acceptedDream fixtures。
- **断言**: P95 < 400ms；sourceRefs 最多 20 且去重；self-health/affordance 来源不混淆。
- **证据**: `tests/unit/control-plane/embodied-context-assembler.test.ts`, `tests/integration/control-plane/heartbeat-context.test.ts`。

<a id="t-cp-c-2"></a>
### T-CP.C.2
- **关联需求**: REQ-001
- **关联契约**: heartbeat loop, ScopeRouter, HardGuardEvaluator, DownstreamIntentOrchestrator
- **风险类别**: 编排失控 / guard 漏判 / 下游 intent 越权
- **单元测试覆盖**: guard decision、scope routing、reason code、timeout degraded reason。
- **API接口功能测试覆盖**: heartbeat command response schema 与异常依赖。
- **集成/E2E/冒烟覆盖**: heartbeat loop end-to-end within runtime；representative fixture benchmark P95 < 2s。
- **前置数据**: assembled context、allowed/denied intent fixtures。
- **断言**: denial 有明确 reason；不会直接执行平台动作；只输出受 guard 约束的 intent；heartbeat P95 < 2s，超时样本写 degraded reason。
- **证据**: `tests/unit/control-plane/hard-guard-evaluator.test.ts`, `tests/integration/control-plane/heartbeat-loop.test.ts`, `reports/heartbeat-p95-v7.md`。

<a id="t-cp-c-3"></a>
### T-CP.C.3
- **关联需求**: REQ-004
- **关联契约**: `GoalLifecyclePolicy`, `IdleCuriosityPolicy`, `GoalTransitionRequest`
- **风险类别**: goal 职责重叠 / idle polling 过量 / race condition
- **单元测试覆盖**: lifecycle evaluation、idle connector eligibility、rate limit。
- **API接口功能测试覆盖**: transition request emitted, state-memory executes transition。
- **集成/E2E/冒烟覆盖**: heartbeat with no active goal chooses at most one read-only sensing intent。
- **前置数据**: active/expired/completed goal fixtures、connector affordance fixtures。
- **断言**: control-plane 只评估并发 request；state-memory 执行写入；idle 每小时最多一次。
- **证据**: `tests/unit/control-plane/goal-lifecycle-policy.test.ts`, `tests/unit/control-plane/idle-curiosity-policy.test.ts`。

<a id="int-s3"></a>
### INT-S3
- **关联需求**: S3 退出标准
- **关联契约**: affordance map, circuit breaker, embodied context, heartbeat
- **风险类别**: Sprint 关口 / body+control 集成
- **单元测试覆盖**: 汇总 S3 单元测试。
- **API接口功能测试覆盖**: affordance/context/heartbeat command 契约。
- **集成/E2E/冒烟覆盖**: breaker lifecycle + heartbeat context 冒烟。
- **前置数据**: S3 所有任务完成。
- **断言**: heartbeat 能组装 5 类 state slice；breaker cooldown/halfopen/closed 可验证。
- **证据**: `reports/int-s3-body-heartbeat-v7.md`。

<a id="t-dqs-c-1"></a>
### T-DQS.C.1
- **关联需求**: REQ-005
- **关联契约**: Quiet pipeline, `ClaimSynthesizer`, `DailyDiaryWriter`, `claim_source_missing`
- **风险类别**: source-backed 断裂 / 弱 evidence 过度推断 / diary 空壳
- **单元测试覆盖**: fact sourceRefs non-empty、single weak evidence only observation、diary 三段。
- **API接口功能测试覆盖**: `runQuiet` 正常、empty slice、missing source。
- **集成/E2E/冒烟覆盖**: INT-S4 Quiet pipeline。
- **前置数据**: evidence slice fixtures。
- **断言**: fact claim 无 sourceRefs 被拒绝；DailyDiary 含 saw/noticed/tomorrow。
- **证据**: `tests/unit/quiet/claim-synthesizer.test.ts`, `tests/unit/quiet/daily-diary-writer.test.ts`。

<a id="t-dqs-c-2"></a>
### T-DQS.C.2
- **关联需求**: REQ-005
- **关联契约**: `DreamInputLoader.loadDreamInputs`, lock TTL, idempotent claim loading
- **风险类别**: claims 丢失 / 重复处理 / lock 竞争
- **单元测试覆盖**: 未被 accepted projection 引用 claims 加载、幂等去重、TTL。
- **API接口功能测试覆盖**: load input API 正常与 lock-held skip reason。
- **集成/E2E/冒烟覆盖**: Quiet completed while lock held -> next Dream includes claims。
- **前置数据**: quiet claim fixtures、accepted projection refs。
- **断言**: lock 导致本轮跳过时 claims 不丢失。
- **证据**: `tests/unit/dream/dream-input-loader.test.ts`。

<a id="t-dqs-c-3"></a>
### T-DQS.C.3
- **关联需求**: REQ-005
- **关联契约**: Dream pipeline, `RedactedEvidenceBundle`, validation then accepted transition
- **风险类别**: raw evidence 泄漏 / candidate 自动晋升 / ungrounded insight
- **单元测试覆盖**: redaction gate required、rules-only fallback、schema/source/sensitivity validation。
- **API接口功能测试覆盖**: `runDream` normal, model unavailable, validation failure archived。
- **集成/E2E/冒烟覆盖**: dream acceptance 集成。
- **前置数据**: DreamInputBundle fixture、redaction fixture。
- **断言**: ModelAssistPort 只接收 branded redacted bundle；validation 通过后由 dream-quiet 发起 transition。
- **证据**: `tests/unit/dream/dream-pipeline.test.ts`, `tests/integration/dream/dream-acceptance.test.ts`。

<a id="t-dqs-c-4"></a>
### T-DQS.C.4
- **关联需求**: REQ-005
- **关联契约**: Dream Scheduler, quiet-completion trigger, lock
- **风险类别**: auto schedule 缺失 / 并发重复 run / skip reason 不透明
- **单元测试覆盖**: cron/evidence/manual/quiet trigger、concurrent lock、explicit skip。
- **API接口功能测试覆盖**: schedule request normal/locked/no-input。
- **集成/E2E/冒烟覆盖**: quiet-dream trigger integration。
- **前置数据**: quiet completion event fixture。
- **断言**: Quiet 完成后允许窗口内自动调度；并发只运行一个 Dream。
- **证据**: `tests/unit/dream/dream-scheduler.test.ts`, `tests/integration/dream/quiet-dream-trigger.test.ts`。

<a id="t-dqs-c-5"></a>
### T-DQS.C.5
- **关联需求**: REQ-001, REQ-005
- **关联契约**: accepted projection heartbeat read, candidate exclusion, degraded reason
- **风险类别**: projection 回流失败 / candidate 泄入 context / E2E 关键链路
- **单元测试覆盖**: 已由 T-SMS.C.2 与 T-DQS.C.3 覆盖。
- **API接口功能测试覆盖**: accepted projection read API before-after。
- **集成/E2E/冒烟覆盖**: heartbeat reads accepted projection; E2E 触发保留到 S6 release gate。
- **前置数据**: accepted/candidate projection fixtures。
- **断言**: accepted 被读取；candidate 不进入 heartbeat；空态 reason 可见。
- **证据**: `tests/integration/control-plane/dream-projection-heartbeat.test.ts`。

<a id="t-gvs-c-1"></a>
### T-GVS.C.1
- **关联需求**: REQ-006
- **关联契约**: `GuidanceDraftService`, `GuidanceDraftRequest`, `validateDraftSources`, `draft_source_invalidated`
- **风险类别**: source-backed delivery 断裂 / draft 生命周期 / channel-safe copy
- **单元测试覆盖**: request schema、source validation、invalidated draft。
- **API接口功能测试覆盖**: draft generation normal/missing evidence/source removed。
- **集成/E2E/冒烟覆盖**: INT-S4 guidance integration。
- **前置数据**: evidence pack, narrative context, relationship context fixtures。
- **断言**: delivery 前重验证 source refs；invalid draft 不发送。
- **证据**: `tests/unit/guidance/guidance-draft-service.test.ts`。

<a id="t-gvs-c-2"></a>
### T-GVS.C.2
- **关联需求**: REQ-006
- **关联契约**: `ChannelFeedbackIngestionService`, RelationshipMemory update, retry policy
- **风险类别**: feedback 丢失 / relationship memory 不一致 / delivery proof 缺失
- **单元测试覆盖**: tone/timing/no-reply ingestion、retry 3 次、audit on failure。
- **API接口功能测试覆盖**: feedback ingestion before-after。
- **集成/E2E/冒烟覆盖**: channel feedback -> RelationshipMemory 集成。
- **前置数据**: delivery result fixtures、owner reaction fixtures。
- **断言**: 写入失败不静默；无 proof 标记 `not_sent`。
- **证据**: `tests/unit/guidance/channel-feedback-ingestion.test.ts`。

<a id="t-gvs-c-3"></a>
### T-GVS.C.3
- **关联需求**: REQ-006
- **关联契约**: `OutreachStrategySelector`, language quality checklist, fallback copy
- **风险类别**: 语气质量不可测 / channel fallback 空文本 / 过度打扰
- **单元测试覆盖**: relationship tone/frequency selection、fixture-based style_lint_failed、fallback copy。
- **API接口功能测试覆盖**: 不适用；selector 为纯策略。
- **集成/E2E/冒烟覆盖**: INT-S4 guidance smoke。
- **前置数据**: RelationshipMemory fixtures、dry/plain draft fixture、anchored concise draft fixture、fallback context fixture。
- **断言**: dry/plain fixture 触发 `style_lint_failed` 且列出命中规则；anchored concise fixture 通过；fallback copy 含具体锚点、channel-safe reason 且无 unsupported claim。
- **证据**: `tests/unit/guidance/outreach-strategy-selector.test.ts`, `tests/unit/guidance/outreach-style-fixtures.test.ts`。

<a id="int-s4"></a>
### INT-S4
- **关联需求**: S4 退出标准
- **关联契约**: Quiet, Dream, accepted projection, Guidance, ChannelFeedback
- **风险类别**: Sprint 关口 / meaning consolidation 集成
- **单元测试覆盖**: 汇总 S4 单元测试。
- **API接口功能测试覆盖**: Quiet/Dream/Guidance operation contracts。
- **集成/E2E/冒烟覆盖**: DailyDiary 三段、Dream accepted projection、feedback writeback。
- **前置数据**: S4 所有任务完成。
- **断言**: accepted projection 被 heartbeat 读取；feedback 写入 RelationshipMemory。
- **证据**: `reports/int-s4-dream-quiet-guidance-v7.md`。

<a id="t-obs-c-1"></a>
### T-OBS.C.1
- **关联需求**: REQ-001, REQ-003, REQ-007
- **关联契约**: `RedactionPolicy`, `AppendOnlyAuditStore`, `lastHashCache`, chain integrity failure handling
- **风险类别**: audit 性能 / hash chain 损坏 / sensitive data 泄漏
- **单元测试覆盖**: mask/erase/hash, O(1) lastHash append, corrupted segment handling。
- **API接口功能测试覆盖**: audit append normal/unknown family/corrupted chain warning。
- **集成/E2E/冒烟覆盖**: audit-chain integration。
- **前置数据**: audit family registry、event fixtures。
- **断言**: restart 后回填 lastHash；chain 损坏标记 degraded 且不自动修复。
- **证据**: `tests/unit/observability/audit-store.test.ts`, `tests/integration/observability/audit-chain.test.ts`。

<a id="t-obs-c-2"></a>
### T-OBS.C.2
- **关联需求**: REQ-007, REQ-012
- **关联契约**: `SelfHealthSnapshot`, per-probe timeout, partial health, `SelfHealthView`
- **风险类别**: 诊断超时 / 循环依赖死锁 / health schema 漂移
- **单元测试覆盖**: 动态维度注册、最小维度集、timeout、allSettled、state-memory unavailable。
- **API接口功能测试覆盖**: `self_health` response schema normal/degraded/timeout。
- **集成/E2E/冒烟覆盖**: self_health DB available P95 gate。
- **前置数据**: probe fixtures、last known health。
- **断言**: 最小维度集包含 env/cron/secret/credential/storage/delivery/dream/bridge/circuit_breaker/state_memory；总体上限 3000ms；全部超时返回 `lastKnownAt` 与 `probe_timeout`。
- **证据**: `tests/unit/observability/self-health-snapshot.test.ts`。

<a id="t-obs-c-3"></a>
### T-OBS.C.3
- **关联需求**: REQ-010
- **关联契约**: `HeartbeatDigestAssembler`
- **风险类别**: dashboard proof 失真 / digest 与 outreach 混淆 / source refs 缺失
- **单元测试覆盖**: connector/goal/dream/health aggregation、sourceRefs。
- **API接口功能测试覆盖**: digest read API by date/platform。
- **集成/E2E/冒烟覆盖**: INT-S5 digest sample。
- **前置数据**: heartbeat/audit/tool/dream fixtures。
- **断言**: digest 是 dashboard proof，不生成 outreach；计数按平台分类。
- **证据**: `tests/unit/observability/heartbeat-digest-assembler.test.ts`。

<a id="t-obs-c-4"></a>
### T-OBS.C.4
- **关联需求**: REQ-010
- **关联契约**: HeartbeatDigest delivery route, non-outreach posture
- **风险类别**: digest 被当成社交打扰 / delivery proof 缺失
- **单元测试覆盖**: delivery payload shaping 与 channel-safe fallback。
- **API接口功能测试覆盖**: digest delivery request normal/unavailable。
- **集成/E2E/冒烟覆盖**: digest delivery integration；手动验证仅记录证据预期。
- **前置数据**: digest output fixture、delivery adapter stub。
- **断言**: delivery mode 与 outreach 分离；失败时有 fallback/proof reason。
- **证据**: `tests/integration/observability/digest-delivery.test.ts`, 手动验证截图。

<a id="t-obs-c-5"></a>
### T-OBS.C.5
- **关联需求**: REQ-011
- **关联契约**: `NarrativeTimelineQueryService`, cursor pagination, max 90 days
- **风险类别**: timeline 查询性能 / 隐式 truncate / state-memory degraded
- **单元测试覆盖**: cursor paging、90 天范围、diff query、degraded return。
- **API接口功能测试覆盖**: timeline/diff command normal/out-of-range。
- **集成/E2E/冒烟覆盖**: INT-S5 timeline sample。
- **前置数据**: narrative timeline fixtures。
- **断言**: 超范围返回 error，不静默截断；cursor 稳定。
- **证据**: `tests/unit/observability/narrative-timeline-query.test.ts`。

<a id="t-obs-c-6"></a>
### T-OBS.C.6
- **关联需求**: REQ-011
- **关联契约**: `RestoreAuditService`, `partial_restore_error`
- **风险类别**: restore 一致性 / audit failure 策略 / credential restore 防护
- **单元测试覆盖**: success audit、partial failure、credential exclusion。
- **API接口功能测试覆盖**: restore audit before-after。
- **集成/E2E/冒烟覆盖**: restore command integration via S6。
- **前置数据**: restore snapshot fixtures。
- **断言**: partial error 含 completed/failed entity；不恢复 credential。
- **证据**: `tests/unit/observability/restore-audit-service.test.ts`。

<a id="t-obs-c-7"></a>
### T-OBS.C.7
- **关联需求**: REQ-012
- **关联契约**: `RuntimeSecretAnchorView`, `recoverySteps`, secret reason codes
- **风险类别**: secret recovery 不可操作 / key 明文泄漏 / wrong-key 误判
- **单元测试覆盖**: missing key、wrong key、rotated key、no plaintext。
- **API接口功能测试覆盖**: runtime secret view response schema。
- **集成/E2E/冒烟覆盖**: self_health secret dimension。
- **前置数据**: credential vault fixtures。
- **断言**: 输出包含 recoverySteps；不记录 encryption key 明文。
- **证据**: `tests/unit/observability/runtime-secret-anchor-view.test.ts`。

<a id="int-s5"></a>
### INT-S5
- **关联需求**: S5 退出标准
- **关联契约**: audit, self_health, digest, timeline, restore, runtime secret
- **风险类别**: Sprint 关口 / observability 集成
- **单元测试覆盖**: 汇总 S5 单元测试。
- **API接口功能测试覆盖**: self_health/digest/timeline/restore/read surfaces。
- **集成/E2E/冒烟覆盖**: audit chain、health 动态维度与最小维度集、digest、timeline、restore、secret 冒烟。
- **前置数据**: S5 所有任务完成。
- **断言**: self_health 任意探针超时不拖垮整体；digest/timeline/restore 可读。
- **证据**: `reports/int-s5-observability-v7.md`。

<a id="t-ros-c-1"></a>
### T-ROS.C.1
- **关联需求**: REQ-007, REQ-009, REQ-010, REQ-011, REQ-012
- **关联契约**: `RuntimeSurfaceRouter`, `RuntimeOpsEnvelope`, `self_health`, `tool_affordance`, `connector_test --wet`, `heartbeat_digest`, `narrative:diff`, `timeline`, `restore`, `runtime_secret_bootstrap`
- **风险类别**: ops API 契约 / wet truth / restore path / schema drift
- **单元测试覆盖**: command parsing、envelope shape、argument validation。
- **API接口功能测试覆盖**: 每个 v7 command normal + representative error + before/after where mutable。
- **集成/E2E/冒烟覆盖**: runtime commands integration。
- **前置数据**: S5 observability/body outputs、connector wet probe runner、RestoreSnapshotStore、RuntimeSecretAnchorView、SelfHealthSnapshot、CircuitBreakerManager。
- **断言**: `connector_test --wet` 返回真实 status；`restore` 不恢复 credential；`self_health` P95 < 1s when DB available 且包含动态最小维度集。
- **证据**: `tests/integration/runtime-ops/commands.test.ts`。

<a id="t-ros-c-2"></a>
### T-ROS.C.2
- **关联需求**: REQ-001, REQ-007
- **关联契约**: OpenClaw plugin registration, WorkspaceOpsBridge v7, `second_nature_ops`
- **风险类别**: host-safe loading / module scope DB 初始化 / tool visibility
- **单元测试覆盖**: bridge lazy init and registration helpers。
- **API接口功能测试覆盖**: plugin bridge command dispatch response。
- **集成/E2E/冒烟覆盖**: plugin registration integration + manual OpenClaw tool visibility evidence。
- **前置数据**: RuntimeSurfaceRouter v7。
- **断言**: register() 不触发 DB 初始化；workspace root resolved 后 v7 router 装配。
- **证据**: `tests/integration/plugin/plugin-registration.test.ts`, 手动验证截图。

<a id="t-ros-c-3"></a>
### T-ROS.C.3
- **关联需求**: REQ-002, REQ-003
- **关联契约**: `ManualRunDispatcher`, `ManualTriggerContext`, `triggerSource: manual_run`
- **风险类别**: manual run 污染 heartbeat cadence / 并发写入 / source 标记错误
- **单元测试覆盖**: manual connector run、wet test、cadence unchanged。
- **API接口功能测试覆盖**: manual run command before-after ToolExperienceRow。
- **集成/E2E/冒烟覆盖**: concurrent cron heartbeat + manual run。
- **前置数据**: write queue, wet probe runner, runtime router。
- **断言**: `affectsHeartbeatCadence=false`；write queue 串行化；triggerSource 正确。
- **证据**: `tests/unit/ops/manual-run-dispatcher.test.ts`。

<a id="t-ros-c-4"></a>
### T-ROS.C.4
- **关联需求**: REQ-001, REQ-007
- **关联契约**: README/AGENTS status, Bootstrap Recovery documentation
- **风险类别**: 文档承诺失真 / recovery 不可操作 / key 明文泄漏
- **单元测试覆盖**: 不适用。
- **API接口功能测试覆盖**: 不适用。
- **集成/E2E/冒烟覆盖**: 文档 review checklist。
- **前置数据**: RuntimeSecretAnchorView 输出契约。
- **断言**: README/AGENTS 只记录管理位置与恢复原则，不记录 key 明文；v7 状态不承诺未实现能力。
- **证据**: 文档 review checklist。

<a id="t-ros-c-5"></a>
### T-ROS.C.5
- **关联需求**: REQ-001~REQ-012
- **关联契约**: v6 compatibility, migration compatibility, existing tests
- **风险类别**: 回归破坏 / migration 破坏旧数据 / release gate
- **单元测试覆盖**: 复用既有单元测试。
- **API接口功能测试覆盖**: 复用既有 CLI/ops/API tests。
- **集成/E2E/冒烟覆盖**: v6 integration suite。
- **前置数据**: S1~S5 all outputs。
- **断言**: v6 tests 全部 pass 或有 justified skip；旧数据可被 v7 stores 读取。
- **证据**: `reports/v6-regression-gate-v7.md`。

<a id="int-s6"></a>
### INT-S6
- **关联需求**: v7 release gate, REQ-001~REQ-012
- **关联契约**: plugin, wet probe, self_health, heartbeat context, regression, docs
- **风险类别**: 最终发布关口 / E2E / host integration
- **单元测试覆盖**: 汇总全量单元测试。
- **API接口功能测试覆盖**: 全量 runtime ops command contract。
- **集成/E2E/冒烟覆盖**: plugin 加载、wet probe、self_health 动态最小维度集、heartbeat 5 类 slice + P95、v6 regression、docs review。
- **前置数据**: T-ROS.C.1~C.5, INT-S1~S5。
- **断言**: 12 个 REQ 全覆盖；self_health dimensions JSON 含最小维度集；heartbeat P95 < 2s；端到端证据齐全；失败项进入 release gate Bug 清单。
- **证据**: `reports/int-s6-e2e-release-gate-v7.md`。


<a id="t-cs-c-7"></a>
### T-CS.C.7
- **关联需求**: REQ-003, REQ-009
- **关联契约**: extractSourceRefs SourceRef 生成契约；mapLifeEvidence LifeEvidenceCandidate 返回契约
- **风险类别**: 平台数组字段不被识别 → life evidence 永不写入 → Q/D/C 全链阻断
- **单元测试覆盖**: `extractSourceRefs` 对 `posts`/`agents`/`nodes`/`results`/`entries` 数组字段的正向识别；深层嵌套 `{data: {posts: [...]}}` 递归穿透；回归 `sourceRefs`/`items` 原有分支不破坏；数组元素含 id/url 时生成正确 SourceRef kind=platform_item。
- **API接口功能测试覆盖**: `mapLifeEvidence` 在 `feed.read` intent + 平台数组 data 时返回非 null candidate；`mapLifeEvidence` 在 `message.send` intent 时仍返回 null（不变）。
- **集成/E2E/冒烟覆盖**: moltbook mock runner → policy layer → mapLifeEvidence 链路；agent-world runner → mapLifeEvidence 链路。
- **前置数据**: moltbook mock data fixture（含 posts 数组）、agent-world mock data fixture（含 agents 数组）、深层嵌套 fixture。
- **断言**: `extractSourceRefs(platformId, {posts: [{id:"p1", url:"u1"}]}, ts)` 返回长度 1 数组；`extractSourceRefs(platformId, {data: {agents: [{id:"a1"}]}}, ts)` 返回长度 1 数组；原 `sourceRefs`/`items` 测试全部通过。
- **证据**: `tests/unit/connectors/map-life-evidence.test.ts`（扩展用例）。

<a id="t-cs-c-8"></a>
### T-CS.C.8
- **关联需求**: REQ-003, REQ-009
- **关联契约**: life_evidence_index 写入契约；policy-layer ConnectorResult.data 包裹契约
- **风险类别**: policy-layer 包裹层级与 extractSourceRefs 递归不对齐 → life evidence 仍不写入
- **单元测试覆盖**: policy-layer `executeWithPolicy` 成功路径下 `mapLifeEvidence` 被调用且入参 data 包含正确层级；`appendLifeEvidence` 被调用的 before/after stub 断言。
- **API接口功能测试覆盖**: DB before/after 查询 `life_evidence_index` 行数；成功执行后行数增加断言。
- **集成/E2E/冒烟覆盖**: moltbook mock runner feed.read → life_evidence_index 完整端到端；DB before/after。
- **前置数据**: 配置了 mock runner 的 workspace fixture；SQLite in-memory 或临时 DB。
- **断言**: life_evidence_index 行数在 moltbook feed.read 成功后 +1；candidate.evidenceType = "platform_browse"；candidate.sourceRefs.length > 0。
- **证据**: `tests/integration/connectors/life-evidence-chain.test.ts`。

<a id="t-cs-c-9"></a>
### T-CS.C.9
- **关联需求**: REQ-009
- **关联契约**: instreet CapabilityContractRegistry 注册契约；StructuredUnavailableReason platform_unavailable 语义
- **风险类别**: instreet 未注册 → affordance assembler 不感知 instreet → 用户无法看到 instreet 能力
- **单元测试覆盖**: `resolveCapability("instreet", "notification.list")` 返回 ResolvedConnectorCapability（非 not_registered error）；executor instreet 分支返回 `{success: false, error: {code: "platform_unavailable"}}`（非 "unknown_platform"）。
- **API接口功能测试覆盖**: instreet 执行请求返回结构化 unavailable（非 unknown_platform）；registry 包含 instreet platform ID。
- **集成/E2E/冒烟覆盖**: 编译检查（instreet manifest import 无 TS 错误）。
- **前置数据**: instreetManifest fixture。
- **断言**: resolveCapability 返回类型为 ResolvedConnectorCapability；executor 返回 error.code = "platform_unavailable" 且 detail 包含 "instreet"。
- **证据**: `tests/unit/connectors/instreet-registration.test.ts`。

<a id="t-cs-c-10"></a>
### T-CS.C.10
- **关联需求**: REQ-003, REQ-009
- **关联契约**: evomap configuration_missing 返回语义；EvoMapSecretPort 持久化契约；真实 HTTP 执行契约
- **风险类别**: evomap 永远返回 not_implemented → agent 无法连接 evomap 平台
- **单元测试覆盖**: `SECOND_NATURE_EVOMAP_BASE_URL` 未设置时返回 `configuration_missing`（非 `not_implemented`）；mock fetch 下 `agent.heartbeat` 发送 HTTP 请求；`saveNodeSecret` + `loadNodeSecret` 持久化循环。
- **API接口功能测试覆盖**: evomap executor 在 base URL 未配置时返回结构化 configuration_missing；node_secret DB before/after。
- **集成/E2E/冒烟覆盖**: EvoMapSecretPort SQLite 实现；node_secret 跨调用持久化。
- **前置数据**: SECOND_NATURE_EVOMAP_BASE_URL 环境变量（测试时 mock 或 noop）；node_secret fixture。
- **断言**: error.code = "configuration_missing" when base URL missing；HTTP fetch 被调用 when base URL set；saveNodeSecret 后 loadNodeSecret 返回相同值。
- **证据**: `tests/unit/connectors/evomap-runner.test.ts`、`tests/integration/connectors/evomap-secret-port.test.ts`。

<a id="t-ros-c-6"></a>
### T-ROS.C.6
- **关联需求**: REQ-006, REQ-007
- **关联契约**: checkDeliveryTarget() 返回语义（available/unavailable，非 unknown）；evidenceRefs 非空要求
- **风险类别**: delivery target 永为 unknown → outreach 流程判断链路短路 → message.send 永不触发
- **单元测试覆盖**: workspace 有 message.send 能力时返回 available；workspace 无配置时返回 unavailable + reason；不抛异常断言（try-catch 覆盖）。
- **API接口功能测试覆盖**: checkDeliveryTarget 在 available 路径下 evidenceRefs 非空；在 unavailable 路径下有 reason 字段。
- **集成/E2E/冒烟覆盖**: ops-router static probe 路径完整调用链。
- **前置数据**: workspace fixture（含 message.send connector）；空 workspace fixture。
- **断言**: status ≠ "unknown"；available 时 evidenceRefs.length > 0；unavailable 时 reason 非空字符串。
- **证据**: `tests/unit/cli/delivery-target-probe.test.ts`。

<a id="t-cs-c-11"></a>
### T-CS.C.11
- **关联需求**: REQ-009
- **关联契约**: manifest schema scriptable_node runner kind；脚本接口契约（入参/出参 JSON）；四种错误分支语义
- **风险类别**: scriptable_node runner 类型未识别 → workspace 自定义脚本无法执行
- **单元测试覆盖**: manifest 声明 scriptable_node 时 executor 识别并尝试 import；脚本缺失返回 configuration_missing；脚本抛出返回 script_error；超时返回 timeout；成功返回 data。
- **API接口功能测试覆盖**: manifest schema 包含 scriptable_node kind 的 Zod 校验通过；TS 类型检查通过。
- **集成/E2E/冒烟覆盖**: 编译检查（新增 manifest kind 无 TS 错误）。
- **前置数据**: scriptable_node manifest fixture；mock import 替代真实 dynamic import。
- **断言**: error.code = "configuration_missing" when missing；error.code = "script_error" when throws；error.code = "timeout" when times out；success = true when returns {success: true, data: ...}。
- **证据**: `tests/unit/connectors/scriptable-node-runner.test.ts`。

<a id="t-cs-c-12"></a>
### T-CS.C.12
- **关联需求**: REQ-009
- **关联契约**: scriptable_node 端到端执行契约；与 life evidence 联动契约；quality gate 通过
- **风险类别**: scriptable_node runner 框架存在但集成链路断裂 → 用户脚本无法产生 evidence
- **单元测试覆盖**: 汇总 T-CS.C.11 单元测试。
- **API接口功能测试覆盖**: 无（集成测试覆盖）。
- **集成/E2E/冒烟覆盖**: workspace manifest + fixture runner.mjs → executor → ConnectorResult → mapLifeEvidence → life evidence；pnpm lint && pnpm typecheck 通过。
- **前置数据**: fixture runner.mjs（返回含 posts 数组的 data）；scriptable_node manifest。
- **断言**: ConnectorResult.success = true；data 来自脚本返回值；life_evidence_index 有新增记录；lint 0 errors；typecheck 0 errors。
- **证据**: `tests/integration/connectors/scriptable-node-e2e.test.ts`。

<a id="int-s9"></a>
### INT-S9
- **关联需求**: REQ-003, REQ-006, REQ-007, REQ-009
- **关联契约**: S9 全部任务产出契约
- **风险类别**: S9 局部通过但集成断点残留 / life evidence 链路仍阻断
- **单元测试覆盖**: 汇总 T-CS.C.7~C.12、T-ROS.C.6 单元测试。
- **API接口功能测试覆盖**: checkDeliveryTarget、instreet resolveCapability、evomap configuration_missing。
- **集成/E2E/冒烟覆盖**: life_evidence_index DB before/after（moltbook mock runner）；pnpm lint && pnpm typecheck 全量通过。
- **前置数据**: S9 所有任务完成。
- **断言**: 所有 S9 任务 PASS；life_evidence_index 有新增记录；lint 0 errors；typecheck 0 errors。
- **证据**: `reports/int-s9-connector-chain.md`。

---

<a id="t-v7c-c-1"></a>
### T-V7C.C.1
- **关联需求**: REQ-009, REQ-011
- **关联契约**: `snapshot:capture`, `NarrativeTimeline` snapshot production, `connector_test dryRun:false`, `CapabilityProbeResultStore`
- **风险类别**: 数据生产端缺失 / wet truth false positive / protocol drift
- **单元测试覆盖**: snapshot payload whitelist、timeline snapshot lookup、wet probe result persistence。
- **API接口功能测试覆盖**: `snapshot:capture`、`narrative:diff` normal/error、`connector_test dryRun:false` normal/error。
- **集成/E2E/冒烟覆盖**: runtime ops bridge 调用后断言 `narrative_timeline`、`restore_snapshot`、`capability_probe_result` before/after。
- **前置数据**: empty workspace、two narrative revisions、safe probe endpoint fixture。
- **断言**: diff 不因缺版本失败；restore 不因缺 snapshot 失败；wet probe 不返回 dry-run ok。
- **证据**: `tests/integration/runtime-ops/v7c-data-connector-truth.test.ts`。

<a id="t-v7c-c-1r"></a>
### T-V7C.C.1R
- **关联需求**: REQ-009, REQ-011
- **关联契约**: `narrative:diff` missing-version error semantics, `capability_probe_result` upsert, package/runtime version parity
- **风险类别**: 缺数据被误判为引擎失败 / wet re-probe 主键冲突 / 宿主加载旧 runtime
- **单元测试覆盖**: `CapabilityProbeResultStore.appendProbeResult` duplicate id upsert；NarrativeVersionNotFoundError 映射。
- **API接口功能测试覆盖**: `narrative:diff` missing from/to version 返回 structured missing-version code；`connector_test dryRun:false` repeated call 不抛 UNIQUE constraint。
- **集成/E2E/冒烟覆盖**: plugin/runtime package 检查 version 与 manifest 一致；Claw 复测时若仍冲突，报告宿主缓存/旧包加载证据。
- **前置数据**: single timeline row、missing version id、duplicate probeResultId fixture、built plugin runtime。
- **断言**: missing version 是缺数据错误而非 `NARRATIVE_DIFF_FAILED` 泛化；wet re-probe 幂等；package/plugin/runtime version 可追溯。
- **证据**: `tests/integration/runtime-ops/v7c-data-connector-truth.test.ts` 或 `tests/integration/runtime-ops/commands.test.ts`。

<a id="t-v7c-c-2"></a>
### T-V7C.C.2
- **关联需求**: REQ-003, REQ-009
- **关联契约**: connector result -> life evidence, connector result -> ToolExperience, wet/probe feedback, CircuitBreaker enforcement
- **风险类别**: evidence pipeline 断裂 / heartbeat 自然路径无 ToolExperience / body feedback 不生效 / 连败无冷却
- **单元测试覆盖**: connector result mapping、ExperienceWriter triggerSource、pain signal threshold、breaker open/half-open/closed。
- **API接口功能测试覆盖**: manual run before/after ToolExperience 与 life evidence rows；wet probe feedback/unavailable reason。
- **集成/E2E/冒烟覆盖**: heartbeat connector success/failure across evidence + experience + breaker；breaker open 后 heartbeat 不重复执行同 capability。
- **前置数据**: connector success fixture、terminal failure fixture、duplicate failure threshold fixture、half-open success/failure fixture。
- **断言**: heartbeat success 增长 evidence 且写 `trigger_source=heartbeat`；manual run 写 `trigger_source=manual_run`；所有 attempt 写 experience 或 explicit unavailable reason；breaker open 阻止重复执行。
- **证据**: `tests/integration/control-plane/v7c-evidence-body-feedback.test.ts`。

<a id="t-v7c-c-3"></a>
### T-V7C.C.3
- **关联需求**: REQ-005, REQ-010
- **关联契约**: Quiet completion trigger, Dream accepted projection, HeartbeatDigest delivery/fallback
- **风险类别**: rhythm loop 空转 / dream 只存在手动路径 / digest owner proof 缺失
- **单元测试覆盖**: scheduler gate、explicit skip reason、digest delivery fallback。
- **API接口功能测试覆盖**: heartbeat/digest command reads generated rhythm outputs。
- **集成/E2E/冒烟覆盖**: quiet -> dream -> heartbeat -> digest 的代表性链路。
- **前置数据**: source-backed diary fixture、dream allowed window、delivery adapter stub。
- **断言**: Quiet 后 Dream 自动触发或 skip；accepted projection 进入 heartbeat；digest 写 proof 或 fallback。
- **证据**: `tests/integration/dream/v7c-rhythm-loop.test.ts`, `reports/v7c-rhythm-loop.md`。

<a id="t-v7c-c-4r"></a>
### T-V7C.C.4R
- **关联需求**: REQ-006, REQ-008
- **关联契约**: capabilityClass 推断、impulse fallback 链、guidance bridge 接线、`guidance_payload` command、buildDraftText 中文内容、agent.* 排除
- **风险类别**: guidance bridge 断路导致 impulse 从不注入 / buildDraftText 继续返回英文占位 / capabilityClass 推断边界遗漏
- **单元测试覆盖**: `inferCapabilityClass` 覆盖所有已知前缀（feed/post/comment/message/notification/work/task/agent）；impulse assembler 三级 fallback（platform-specific → capabilityClass → intentKind）；agent.* 返回 null 断言。
- **API接口功能测试覆盖**: `guidance_payload` command 返回 impulseText/atmosphereText/sceneKind 非空结构体；`agent.heartbeat` 输入时返回空 impulse。
- **集成/E2E/冒烟覆盖**: `run-heartbeat-cycle-v7.ts` → `heartbeat-executor.ts` guidance bridge 接线后 buildDraftText 返回中文内容；platform-specific impulse 优先于系统预设。
- **前置数据**: mock capabilityIntent 覆盖表（6 种前缀）、workspace platform-specific impulse fixture、guidance scene mock。
- **断言**: `post.*` → broadcast；`feed.*` → consume；`agent.*` → null；有 platform-specific 时 assembler 优先返回 platform-specific；无时 fallback 到 capabilityClass preset；buildDraftText 结果为中文且来自 template-registry。
- **证据**: `tests/unit/guidance/capability-class.test.ts`、`tests/unit/guidance/impulse-assembler.test.ts`、`tests/integration/guidance/v7c-guidance-chain.test.ts`。

<a id="t-v7c-c-4"></a>
### T-V7C.C.4
- **关联需求**: REQ-004, REQ-006, REQ-008
- **关联契约**: GoalLifecycle replace/dedupe, IdentityProfile connector context, RelationshipMemory-guided strategy
- **风险类别**: active goal 分裂 / 身份孤岛 / feedback 不影响表达
- **单元测试覆盖**: goal replace table tests、identity profile read adapter、strategy no-reply/positive/negative cases。
- **API接口功能测试覆盖**: goal ops repeated set before/after；connector request identity context inspection。
- **集成/E2E/冒烟覆盖**: heartbeat reads deduped active goal and connector gets platform handle。
- **前置数据**: duplicate goal fixture、identity profile fixture、relationship memory fixture。
- **断言**: 同 kind/scope 只有一个 active；connector request 不含 credential 但含 platform identity；feedback 调整策略。
- **证据**: `tests/integration/state/v7c-identity-goal-hygiene.test.ts`。

<a id="int-v7c"></a>
### INT-V7C
- **关联需求**: v7 living loop closure, REQ-001~REQ-012
- **关联契约**: data lifecycle, connector truth, body feedback, rhythm loop, identity/goal hygiene
- **风险类别**: post-E2E release confidence / long-running agent environment
- **单元测试覆盖**: 汇总 T-V7C.C.1~C.4 单元测试。
- **API接口功能测试覆盖**: runtime ops closure commands and before/after DB assertions。
- **集成/E2E/冒烟覆盖**: plugin bridge + Claw final test manual representative commands。
- **前置数据**: T-V7C.C.1~C.4 全部完成。
- **断言**: 0.1.32 的 `NARRATIVE_DIFF_FAILED` 与 `snapshot_not_found` 不再是空库必然结论；connector wet truth 与 heartbeat protocol parity 有证据。
- **证据**: `reports/int-v7c-living-loop-closure.md`。

<a id="t-v7c-c-5"></a>
### T-V7C.C.5
- **关联需求**: REQ-006, REQ-007, REQ-009, REQ-011
- **关联契约**: Claw `second_nature_ops` command reachability, `guidance_payload` ops command, `connector_test` envelope truth, `restore snapshotId` compatibility, plugin manifest/runtime surface parity
- **风险类别**: plugin whitelist 漏注册 / host-safe router 漂移 / 成功被 wrapper 标为失败 / 文档参数与真实命令不一致 / Claw 旧 surface 被误判为 runtime failure
- **单元测试覆盖**: command parser 对 `guidance_payload`、`restore snapshotId`、legacy restore args 的输入映射；envelope ok 判定 helper（如抽出）覆盖 available/unavailable probe 状态。
- **API接口功能测试覆盖**: `ops-router` 对 `guidance_payload` 三态返回；`connector_test dryRun:false` 成功返回 `ok=true`；`restore snapshotId` 可恢复或返回 structured `SNAPSHOT_NOT_FOUND`。
- **集成/E2E/冒烟覆盖**: plugin registration / workspace bridge 测试确认 `guidance_payload` 在 `second_nature_ops` 可达；Claw 实机复测命令不再 `unknown_command`。
- **前置数据**: 0.1.38 plugin package、workspace bridge root、wet probe fixture、restore snapshot fixture、`post.publish/feed.read/agent.heartbeat` guidance fixture。
- **断言**: host command list、workspace bridge whitelist、host-safe router、simple parser 与 `ops-router` 命令集合一致；成功 wet probe envelope 为 `ok=true`；snapshotId 路径不要求 operator 手动补 from/to。
- **证据**: `tests/integration/plugin/plugin-registration.test.ts`、`tests/integration/runtime-ops/commands.test.ts`、`reports/claw-0.1.38-gap-regression.md`。

<a id="t-v7c-c-6"></a>
### T-V7C.C.6
- **关联需求**: REQ-003, REQ-005, REQ-009, REQ-010
- **关联契约**: heartbeat connector attempt -> ToolExperience, success result -> life_evidence_index, Quiet completion -> Dream schedule/run-or-skip, heartbeat digest persisted proof/fallback
- **风险类别**: 本地 mock PASS 但实机 DB 无增长 / defer-deny 被误读为已执行 / Dream 只存在手动路径 / digest 命令可用但无自然写入
- **单元测试覆盖**: heartbeat result reason classifier、Dream skip reason mapper、digest persistence/fallback helper。
- **API接口功能测试覆盖**: heartbeat before/after 查询 `life_evidence_index`、`tool_experience`、`dream_output_index`、`heartbeat_digest`；defer/deny 返回 structured reasons 不写假 evidence。
- **集成/E2E/冒烟覆盖**: Claw full heartbeat 代表路径执行；connector success/failure fixture；Quiet -> Dream -> digest representative chain。
- **前置数据**: 可执行 connector fixture、missing_source_refs fixture、source-backed diary fixture、digest window fixture、delivery target unavailable fixture。
- **断言**: 有执行就有 ToolExperience 或 explicit unavailable reason；有 success 就有 life evidence；Dream 触发或 skip 不静默；digest 有 row/proof/fallback。
- **证据**: `tests/integration/control-plane/v7c-production-growth.test.ts`、`tests/integration/dream/v7c-rhythm-loop.test.ts`、`reports/claw-0.1.38-db-growth.md`。

<a id="t-v7c-c-7"></a>
### T-V7C.C.7
- **关联需求**: REQ-006, REQ-008
- **关联契约**: expression boundary / outputGuard compatibility, atmosphere short runtime constraint, impulse/persona/boundary guidance context, hard guard ownership separation
- **风险类别**: guidance 字段只可预览不影响生成 / `outputGuard` 被误当 final formatter 或 hard guard / atmosphere 长文本污染 prompt / 新字段破坏旧消费者
- **单元测试覆盖**: `buildOutputGuard`/expressionBoundary compatibility；atmosphere mode/risk 短文本策略；hard guard boundary 不被 guidance 覆盖。
- **API接口功能测试覆盖**: `guidance_payload` 返回新旧兼容字段；`agent.heartbeat` 不注入 social impulse；invalid sceneType 仍返回 structured error。
- **集成/E2E/冒烟覆盖**: guidance draft/model prompt 代表路径能消费 impulse/persona/expression boundary；输出不呈现客服腔/日报腔/教程腔且不要求固定格式。
- **前置数据**: active/quiet/high-risk scene fixtures、persona candidate fixture、legacy `outputGuard` consumer fixture、agent internal capability fixture。
- **断言**: expression boundary 只塑造表达；hard guard 仍独占 allow/deny；atmosphere 不超过短约束预算；兼容字段存在且语义标注清晰。
- **证据**: `tests/integration/guidance/v7c-guidance-semantics.test.ts`、`tests/integration/guidance/v7c-guidance-chain.test.ts`。

<a id="int-v7c-r"></a>
### INT-V7C.R
- **关联需求**: 0.1.38 Claw gap regression, REQ-003, REQ-005, REQ-006, REQ-007, REQ-009, REQ-010, REQ-011
- **关联契约**: host ops parity, production DB growth, guidance semantics, package/runtime version parity
- **风险类别**: 实机与本地测试偏离 / 发布包旧缓存 / P0 gap 残留
- **单元测试覆盖**: 汇总 T-V7C.C.5~C.7 单元测试。
- **API接口功能测试覆盖**: runtime ops representative commands、restore snapshotId、guidance_payload、connector_test wet envelope、DB before/after。
- **集成/E2E/冒烟覆盖**: Claw 0.1.38+ 实机复测；plugin pack dry-run；workspace bridge direct call；full heartbeat representative run。
- **前置数据**: T-V7C.C.5~C.7 完成；`sn-0.1.38-full-issues.md` 作为 baseline。
- **断言**: P0 全 PASS；P1 PASS 或 structured non-blocking reason；任何 failure 有 next task/change handoff。
- **证据**: `reports/int-v7c-r-claw-gap-regression.md`。

---

## 6. Contract Coverage Overlay

| 契约 | 类型 | 实现承接 | 验证承接 | 状态 |
|---|---|---|---|---|
| v7 shared entities / SourceRef non-empty | 数据结构 | T-SMS.F.1 | T-SMS.F.1 编译检查 + 单元测试 | Planned |
| SQLite schema migration / `_meta.schema_version` | 持久化结构 | T-SMS.F.2 | T-SMS.F.2 单元 + 集成 | Planned |
| Write Queue / `BEGIN EXCLUSIVE` | 持久化协议 | T-SMS.F.3 | T-SMS.F.3 单元 + 并发集成 | Planned |
| Audit family registry | 可观测性契约 | T-OBS.F.1 | T-OBS.F.1 单元 + API接口功能测试 | Planned |
| WriteValidationGate / redaction write boundary | 安全契约 | T-SMS.C.1 | T-SMS.C.1 单元 + API接口功能测试 | Planned |
| EmbodiedContextStatePort | 跨系统 Port | T-SMS.C.2 | T-SMS.C.2 API接口功能测试 + 集成 | Planned |
| GoalLifecycleStore / transition semantics | 状态机契约 | T-SMS.C.3 | T-SMS.C.3 单元 + 集成 | Planned |
| IdentityProfileStore / InteractionSnapshotProjector | 状态 Port | T-SMS.C.4 | T-SMS.C.4 单元 + API接口功能测试 | Planned |
| ToolExperienceStore / CapabilityProbeResultStore | 状态 Port | T-SMS.C.5 | T-SMS.C.5 单元 + API接口功能测试 | Planned |
| RestoreSnapshotStore / RuntimeSecretAnchorStore | recovery contract | T-SMS.C.6 | T-SMS.C.6 单元 + API接口功能测试 | Planned |
| Manifest v7 schema / endpoint mappings | 配置契约 | T-CS.C.1 | T-CS.C.1 单元 + API接口功能测试 | Planned |
| WetProbeRunner / EffectCommitLedger | connector operation | T-CS.C.2 | T-CS.C.2 单元 + 集成 | Planned |
| StructuredUnavailableReason | 错误语义 | T-CS.C.3 | T-CS.C.3 单元 + API接口功能测试 | Planned |
| DiaryDreamStore / Dream lifecycle | 状态契约 | T-SMS.C.7 | T-SMS.C.7 单元 + 集成 | Planned |
| AffordanceAssembler / contextScope | body tool Port | T-BTS.C.1, T-BTS.C.2 | T-BTS.C.1/T-BTS.C.2 单元 + 集成 | Planned |
| BehaviorPromotion state machine | goal/behavior promotion contract | T-BTS.C.3 | T-BTS.C.3 单元 | Planned |
| ExperienceWriter / ProbeSignalAdapter / getPainSignal | body feedback contract | T-BTS.C.4 | T-BTS.C.4 单元 + 集成 | Planned |
| CircuitBreakerManager / HalfOpen probe | body tool protocol | T-BTS.C.5 | T-BTS.C.5 单元 + 集成 | Planned |
| EmbodiedContextAssembler | control-plane Port | T-CP.C.1 | T-CP.C.1 单元 + 集成 | Planned |
| Heartbeat loop / guard reasons / P95 < 2s | orchestration contract | T-CP.C.2 | T-CP.C.2 单元 + 集成 + benchmark evidence | Planned |
| GoalLifecyclePolicy / IdleCuriosityPolicy | policy contract | T-CP.C.3 | T-CP.C.3 单元 + 集成 | Planned |
| Quiet run / DailyDiary | operation contract | T-DQS.C.1 | T-DQS.C.1 单元 + API接口功能测试 | Planned |
| Dream input/pipeline/scheduler | operation contract | T-DQS.C.2~C.4 | T-DQS.C.2~C.4 单元 + 集成 | Planned |
| Accepted projection heartbeat read | cross-system contract | T-DQS.C.5 | T-DQS.C.5 集成 + S6 E2E | Planned |
| GuidanceDraftService / validateDraftSources | guidance contract | T-GVS.C.1 | T-GVS.C.1 单元 + API接口功能测试 | Planned |
| ChannelFeedbackIngestionService | feedback contract | T-GVS.C.2 | T-GVS.C.2 单元 + 集成 | Planned |
| RedactionPolicy / AppendOnlyAuditStore | observability core | T-OBS.C.1 | T-OBS.C.1 单元 + 集成 | Planned |
| SelfHealthSnapshot / SelfHealthView dynamic dimensions | ops read model | T-OBS.C.2 | T-OBS.C.2 API接口功能测试 + S6 command | Planned |
| HeartbeatDigest | dashboard proof | T-OBS.C.3, T-OBS.C.4 | T-OBS.C.3/T-OBS.C.4 单元 + 集成 | Planned |
| NarrativeTimeline / RestoreAudit | recovery observability | T-OBS.C.5, T-OBS.C.6 | T-OBS.C.5/T-OBS.C.6 单元 + API接口功能测试 | Planned |
| RuntimeSecretAnchorView | recovery surface | T-OBS.C.7 | T-OBS.C.7 单元 + API接口功能测试 | Planned |
|| extractSourceRefs 平台数组识别 | 算法契约 | T-CS.C.7 | T-CS.C.7 单元测试 | Planned |
|| life_evidence_index 写入（端到端） | 持久化契约 | T-CS.C.8 | T-CS.C.8 集成测试 DB before/after | Planned |
|| instreet platform_unavailable 语义 | 错误语义 | T-CS.C.9 | T-CS.C.9 单元测试 | Planned |
|| evomap configuration_missing 语义 + EvoMapSecretPort | connector operation + 持久化契约 | T-CS.C.10 | T-CS.C.10 单元 + 集成 | Planned |
|| checkDeliveryTarget available/unavailable（非 unknown） | 探测契约 | T-ROS.C.6 | T-ROS.C.6 单元 + API接口功能测试 | Planned |
|| scriptable_node runner kind + 脚本接口契约 | 配置契约 + 操作契约 | T-CS.C.11 | T-CS.C.11 单元 + 编译检查 | Planned |
|| scriptable_node 端到端执行 + life evidence 联动 | 集成契约 | T-CS.C.12 | T-CS.C.12 集成测试 | Planned |
| RuntimeSurfaceRouter v7 commands | CLI/ops API | T-ROS.C.1 | T-ROS.C.1 API接口功能测试 + 集成；前置依赖显式覆盖 S5/body/connector/recovery | Planned |
| OpenClaw plugin / WorkspaceOpsBridge | host integration | T-ROS.C.2 | T-ROS.C.2 集成 + 手动验证 | Planned |
| ManualRunDispatcher | runtime operation | T-ROS.C.3 | T-ROS.C.3 单元 + 集成 | Planned |
| Host ops surface parity / `guidance_payload` reachability | plugin/ops API | T-V7C.C.5 | T-V7C.C.5 API接口功能测试 + plugin integration + Claw manual verification | Planned |
| Production DB growth / real heartbeat evidence | production data contract | T-V7C.C.6 | T-V7C.C.6 integration + DB before/after E2E | Planned |
| Guidance expression boundary / atmosphere semantics | guidance expression contract | T-V7C.C.7 | T-V7C.C.7 单元 + 集成 + manual output review | Planned |

---

## 7. Testing Coverage Overlay

| 测试责任 | 风险类别 | 覆盖方法 | 任务承接 | 测试材料 | 状态 |
|---|---|---|---|---|---|
| TypeScript entity contracts | 类型/数据模型 | 编译检查 + 类型测试 | T-SMS.F.1 | `tests/unit/shared/v7-entities.test.ts` | Planned |
| SQLite migration and old data compatibility | 持久化/migration | 单元 + 集成 fixtures | T-SMS.F.2, T-ROS.C.6 | `tests/integration/storage/schema-migration.test.ts` | Planned |
| Write queue concurrency | 并发/一致性 | 单元 + concurrent integration | T-SMS.F.3, T-ROS.C.3 | `tests/unit/storage/write-queue.test.ts` | Planned |
| WriteValidationGate sensitive rejection | 安全/redaction | 单元 + before-after API test | T-SMS.C.1 | `tests/unit/storage/write-validation-gate.test.ts` | Planned |
| Goal lifecycle and replacement | 状态机 | 表驱动单元 + integration | T-SMS.C.3, T-CP.C.3 | `tests/integration/state/goal-lifecycle.test.ts` | Planned |
| Wet probe truth and idempotency | 外部事实/side effect | HTTP stub + ledger integration | T-CS.C.2 | `tests/integration/connectors/probe-idempotency.test.ts` | Planned |
| Structured unavailable reasons | 错误语义 | representative error samples | T-CS.C.3 | `tests/unit/connectors/structured-unavailable-reason.test.ts` | Planned |
| Affordance cache and scope | body tool read model | 单元 + integration | T-BTS.C.1, T-BTS.C.2 | `tests/integration/body/affordance-map.test.ts` | Planned |
| Pain signal query | body feedback read model | 单元 + integration | T-BTS.C.4 | `tests/unit/body/pain-signal-query.test.ts` | Planned |
| CircuitBreaker lifecycle | 状态机/connector protocol | table-driven unit + integration | T-BTS.C.5 | `tests/integration/body/circuit-breaker-lifecycle.test.ts` | Planned |
| EmbodiedContext bounded assembly | context/性能 | unit + heartbeat integration | T-CP.C.1 | `tests/integration/control-plane/heartbeat-context.test.ts` | Planned |
| Heartbeat guard, decision reasons, P95 | orchestration/性能 | unit + integration + benchmark evidence | T-CP.C.2 | `tests/integration/control-plane/heartbeat-loop.test.ts`, `reports/heartbeat-p95-v7.md` | Planned |
| Quiet source-backed claims | source grounding | unit + API接口功能测试 | T-DQS.C.1 | `tests/unit/quiet/claim-synthesizer.test.ts` | Planned |
| Dream redaction and acceptance | privacy/lifecycle | unit + integration | T-DQS.C.3 | `tests/integration/dream/dream-acceptance.test.ts` | Planned |
| Accepted projection into heartbeat | cross-system integration | integration + S6 E2E trigger | T-DQS.C.5, INT-S6 | `tests/integration/control-plane/dream-projection-heartbeat.test.ts` | Planned |
| Guidance draft source validation | source-backed delivery | unit + API接口功能测试 | T-GVS.C.1 | `tests/unit/guidance/guidance-draft-service.test.ts` | Planned |
| Channel feedback retry | reliability | unit + integration | T-GVS.C.2 | `tests/unit/guidance/channel-feedback-ingestion.test.ts` | Planned |
| Outreach style fixtures | language quality | fixture-based unit tests | T-GVS.C.3 | `tests/unit/guidance/outreach-style-fixtures.test.ts` | Planned |
| Audit chain and redaction | observability/security | unit + integration | T-OBS.C.1 | `tests/integration/observability/audit-chain.test.ts` | Planned |
| SelfHealth dynamic dimensions and degraded output | diagnostics | unit + command API test | T-OBS.C.2, T-ROS.C.1 | `tests/unit/observability/self-health-snapshot.test.ts` | Planned |
| Digest/timeline/restore read surfaces | ops read model | unit + API接口功能测试 | T-OBS.C.3~C.6, T-ROS.C.1 | `tests/integration/runtime-ops/commands.test.ts` | Planned |
| Runtime secret recovery | secret recovery | unit + API接口功能测试 + doc review | T-OBS.C.7, T-ROS.C.4 | `tests/unit/observability/runtime-secret-anchor-view.test.ts` | Planned |
|| T-CS.C.7 | 单元测试 | extractSourceRefs 平台数组分支 4 用例 + 回归 | `tests/unit/connectors/map-life-evidence.test.ts` | Planned |
|| T-CS.C.8 | 集成测试 | life evidence 写入端到端 DB before/after | `tests/integration/connectors/life-evidence-chain.test.ts` | Planned |
|| T-CS.C.9 | 单元测试 + 编译检查 | instreet 注册 + platform_unavailable | `tests/unit/connectors/instreet-registration.test.ts` | Planned |
|| T-CS.C.10 | 单元测试 + 集成测试 | evomap runner + node_secret 持久化 | `tests/unit/connectors/evomap-runner.test.ts`、`tests/integration/connectors/evomap-secret-port.test.ts` | Planned |
|| T-ROS.C.6 | 单元测试 + API接口功能测试 | delivery target 三态探测 | `tests/unit/cli/delivery-target-probe.test.ts` | Planned |
|| T-CS.C.11 | 单元测试 + 编译检查 | scriptable_node runner 四错误分支 | `tests/unit/connectors/scriptable-node-runner.test.ts` | Planned |
|| T-CS.C.12 | 集成测试 + Lint + 编译检查 | scriptable_node 端到端 + life evidence | `tests/integration/connectors/scriptable-node-e2e.test.ts` | Planned |
|| INT-S9 | 冒烟测试 | S9 全量退出标准 | `reports/int-s9-connector-chain.md` | Planned |
| Plugin host registration | host E2E | integration + manual screenshot | T-ROS.C.2, INT-S6 | `tests/integration/plugin/plugin-registration.test.ts` | Planned |
| v6 regression gate | compatibility | full regression suite | T-ROS.C.6, INT-S6 | `reports/v6-regression-gate-v7.md` | Planned |
| Claw host ops parity regression | host E2E/API drift | plugin integration + Claw command JSON | T-V7C.C.5, INT-V7C.R | `reports/claw-0.1.38-gap-regression.md` | Planned |
| Production growth before/after | real data lifecycle | integration + DB row-count assertions | T-V7C.C.6, INT-V7C.R | `reports/claw-0.1.38-db-growth.md` | Planned |
| Guidance semantics review | expression quality/boundary | fixture tests + manual output review | T-V7C.C.7, INT-V7C.R | `tests/integration/guidance/v7c-guidance-semantics.test.ts` | Planned |

---

## 8. Verification Traceability Matrix

| REQ/Contract | Task | Verification | Test Material | Evidence | Status |
|---|---|---|---|---|---|
| REQ-001 Heartbeat 读取具身上下文 | T-SMS.F.1, T-SMS.C.2, T-CP.C.1, T-CP.C.2, T-DQS.C.5, T-ROS.C.2 | 单元 + API接口功能测试 + 集成 + E2E trigger | context/heartbeat/plugin tests | heartbeat context log + release gate report | Planned |
| REQ-002 Tool Affordance Map | T-BTS.C.1, T-BTS.C.2, T-ROS.C.3 | 单元 + API接口功能测试 + 集成 | body/affordance tests | affordance map test report | Planned |
| REQ-003 Tool Experience 反馈 | T-SMS.F.3, T-SMS.C.5, T-CS.C.3, T-BTS.C.4, T-BTS.C.5, T-V7C.C.6 | 单元 + API接口功能测试 + 集成 + DB before/after E2E | storage/body/connector tests | experience write report + production growth report | Planned |
| REQ-004 Goal Lifecycle / Idle Curiosity | T-SMS.C.3, T-SMS.C.4, T-CP.C.3, T-BTS.C.2, T-BTS.C.3 | 单元 + 集成 | goal lifecycle tests | goal lifecycle report | Planned |
| REQ-005 Quiet / Dream Projection | T-SMS.C.7, T-DQS.C.1~C.5, T-V7C.C.6 | 单元 + API接口功能测试 + 集成 + E2E trigger | quiet/dream tests | Dream acceptance report + dream output row evidence | Planned |
| REQ-006 Channel Feedback Loop | T-SMS.C.2, T-GVS.C.1~C.3, T-V7C.C.5, T-V7C.C.7 | 单元 + API接口功能测试 + 集成 + manual output review | guidance tests | channel feedback report + guidance semantics report | Planned |
| REQ-007 Self Health Snapshot | T-OBS.F.1, T-OBS.C.1, T-OBS.C.2, T-ROS.C.1, T-ROS.C.2, T-ROS.C.4, T-V7C.C.5 | 单元 + API接口功能测试 + 手动验证 | observability/runtime/plugin tests | self_health JSON + doc checklist + host ops parity report | Planned |
| REQ-008 IdentityProfile | T-SMS.F.1, T-SMS.C.1, T-SMS.C.4, T-CP.C.1, T-V7C.C.7 | 单元 + API接口功能测试 + guidance semantics review | identity/context/guidance tests | identity profile test report + guidance semantics report | Planned |
| REQ-009 Auto-Probe / Wet Test / CircuitBreaker | T-CS.C.1~C.3, T-BTS.C.4, T-BTS.C.5, T-ROS.C.1, T-V7C.C.5, T-V7C.C.6 | 单元 + API接口功能测试 + 集成 + Claw E2E | connector/body/runtime tests | wet probe log + breaker lifecycle report + production growth report | Planned |
| REQ-010 HeartbeatDigest | T-SMS.C.7, T-OBS.C.3, T-OBS.C.4, T-ROS.C.1, T-V7C.C.6 | 单元 + API接口功能测试 + 集成 + DB before/after E2E | digest tests | digest delivery report + heartbeat_digest row evidence | Planned |
| REQ-011 NarrativeTimeline / RestoreSnapshot | T-SMS.F.2, T-SMS.C.6, T-OBS.C.5, T-OBS.C.6, T-ROS.C.1, T-V7C.C.5 | 单元 + API接口功能测试 + 集成 + Claw E2E | timeline/restore tests | restore audit report + restore snapshotId compatibility report | Planned |
| REQ-012 Bootstrap Recovery / RuntimeSecretAnchor | T-SMS.C.6, T-OBS.C.2, T-OBS.C.7, T-ROS.C.1, T-ROS.C.4 | 单元 + API接口功能测试 + 文档审查 | runtime secret tests | recovery view + checklist | Planned |
| DR-001 CapabilityProbeResult.capabilityId | T-CS.C.1, T-CS.C.2, T-SMS.C.5 | 单元 + API接口功能测试 | manifest/probe/store tests | capabilityId assertion | Planned |
| DR-002 HalfOpen wet probe responsibility | T-BTS.C.5, T-CS.C.2 | 单元 + 集成 | breaker/probe tests | HalfOpen transition log | Planned |
| DR-011/013 EmbodiedContextStatePort completeness | T-SMS.C.2, T-CP.C.1 | API接口功能测试 + 集成 | context state port tests | complete context fixture report | Planned |
| DR-012 GoalLifecycle responsibility split | T-SMS.C.3, T-CP.C.3 | 单元 + 集成 | goal policy/store tests | transition request audit | Planned |
| DR-023 Dream acceptance owner | T-SMS.C.7, T-DQS.C.3 | 单元 + 集成 | dream lifecycle tests | acceptance transition report | Planned |
| DR-032 Observability/state-memory loop | T-OBS.C.2, T-OBS.C.5 | API接口功能测试 | self_health/timeline tests | degraded health JSON | Planned |
| DR-034 RuntimeSecretAnchor recovery steps | T-OBS.C.7, T-ROS.C.4 | 单元 + 文档审查 | secret anchor tests | recovery checklist | Planned |
| S1 Foundation exit | INT-S1 | 冒烟测试 | S1 verification report | `reports/int-s1-foundation-v7.md` | Planned |
| S2 Core State + Connector exit | INT-S2 | 冒烟测试 | S2 verification report | `reports/int-s2-core-state-connector-v7.md` | Planned |
| S3 Body Tool + Heartbeat exit | INT-S3 | 冒烟测试 | S3 verification report | `reports/int-s3-body-heartbeat-v7.md` | Planned |
| S4 Dream/Quiet + Guidance exit | INT-S4 | 冒烟测试 | S4 verification report | `reports/int-s4-dream-quiet-guidance-v7.md` | Planned |
| S5 Observability exit | INT-S5 | 冒烟测试 | S5 verification report | `reports/int-s5-observability-v7.md` | Planned |
|| extractSourceRefs 平台数组识别 | T-CS.C.7 | 单元测试 | map-life-evidence.test.ts | extractSourceRefs 返回值非空断言 | Planned |
|| life_evidence_index 写入端到端 | T-CS.C.8 | 集成测试 | life-evidence-chain.test.ts | DB before/after 行数断言 | Planned |
|| instreet platform_unavailable 语义 | T-CS.C.9 | 单元测试 | instreet-registration.test.ts | error.code 断言 | Planned |
|| evomap configuration_missing + node_secret 持久化 | T-CS.C.10 | 单元 + 集成 | evomap-runner.test.ts + evomap-secret-port.test.ts | error.code + node_secret before/after | Planned |
|| checkDeliveryTarget available/unavailable | T-ROS.C.6 | 单元 + API | delivery-target-probe.test.ts | status ≠ unknown + evidenceRefs 非空 | Planned |
|| scriptable_node runner 四错误分支 | T-CS.C.11 | 单元 + 编译 | scriptable-node-runner.test.ts | error.code 四分支 + TS 编译 | Planned |
|| scriptable_node 端到端 + life evidence | T-CS.C.12 | 集成 + Lint | scriptable-node-e2e.test.ts | success=true + life evidence 行数 | Planned |
|| S9 全量退出标准 | INT-S9 | 冒烟 | reports/int-s9-connector-chain.md | 全部 PASS + lint/typecheck | Planned |
| S6 Release Gate | INT-S6 | E2E + 冒烟 + 回归 | release gate tests | `reports/int-s6-e2e-release-gate-v7.md` | Planned |
| 0.1.38 host ops parity | T-V7C.C.5 | API接口功能测试 + plugin integration + Claw manual | runtime ops/plugin tests | `reports/claw-0.1.38-gap-regression.md` | Planned |
| 0.1.38 production data growth | T-V7C.C.6 | integration + DB before/after E2E | heartbeat/dream/digest tests | `reports/claw-0.1.38-db-growth.md` | Planned |
| Guidance semantics refinement | T-V7C.C.7 | 单元 + 集成 + manual review | guidance semantics tests | guidance fixture report | Planned |
| 0.1.38 Claw gap regression | INT-V7C.R | E2E + 冒烟 + 回归 | Claw representative commands | `reports/int-v7c-r-claw-gap-regression.md` | Planned |

---

## 9. E2E 触发记录

`/blueprint` 不执行 E2E，只记录触发条件：

| 触发点 | 范围 | 证据预期 | 承接 |
|---|---|---|---|
| accepted Dream projection 进入 heartbeat | Dream accepted -> state -> EmbodiedContext | heartbeat context JSON / integration log | T-DQS.C.5, INT-S6 |
| OpenClaw plugin 工具可见 | host register -> `second_nature_ops` visible | host screenshot / tool list log | T-ROS.C.2, INT-S6 |
| wet probe 真实状态 | `connector_test --wet` -> real httpStatus | command JSON / endpoint log | T-ROS.C.1, INT-S6 |
| release gate | plugin + wet + dynamic self_health + heartbeat P95 + regression | release gate report + screenshots + heartbeat P95 report + self_health dimensions JSON | INT-S6 |
| 0.1.38 Claw gap regression | guidance_payload + connector_test + restore snapshotId + DB growth + Dream/digest | command JSON + DB before/after + plugin version evidence | T-V7C.C.5, T-V7C.C.6, T-V7C.C.7, INT-V7C.R |

---

## 10. Blueprint 对账结论

- `05A` 与 `05B` 已同时生成。
- 每个 `05A` 普通任务均有 `验证引用` 与 `证据产出`。
- `05B` 包含 Task-by-Task 验证计划、Contract Coverage Overlay、Testing Coverage Overlay、Verification Traceability Matrix。
- 项目级验证同时规划了单元测试与 API接口功能测试。
- 冒烟测试绑定 `INT-S{N}`，未扩散为普通任务。
- E2E 仅记录触发范围与证据预期，未在 `/blueprint` 阶段执行。
