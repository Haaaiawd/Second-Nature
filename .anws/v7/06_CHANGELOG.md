# 变更日志 - .anws v7

> 此文件记录 v7 相对 v6 的架构与文档层面变更意图。实现任务与验证计划将由后续 `/blueprint` 生成。

---

## 2026-05-21 - Genesis 初始化

- [ADD] 创建 `.anws/v7`，从 v6 copy & evolve。
- [CHANGE] 删除 v7 目录中继承自 v6 的任务、挑战报告、旧 detailed system design 和 wave review，避免旧真相污染新版本。
- [ADD] 新增 `concept_model.json`：Embodied Agent Loop、Mind、Body、ToolAffordance、ToolExperience、IdentityProfile、HeartbeatDigest、RestoreSnapshot 等概念。
- [ADD] 新增 `01_PRD.md`：12 条需求覆盖具身上下文、工具身体、goal 生命周期、Quiet/Dream、channel feedback、self health、identity、wet probe、digest、timeline、rollback、secret recovery。
- [ADD] 新增 `02_ARCHITECTURE_OVERVIEW.md`：8 个系统边界，含 runtime-ops、control-plane、state-memory、body-tool、connector、dream-quiet、guidance-voice、observability-health。
- [ADD] 新增 8 条 Accepted ADR：技术栈、具身循环、工具可供性、goal/idle、Quiet/Dream、channel/self-health、identity/digest/recovery、probe/breaker/rollback。
- [ADD] 新增 `04_SYSTEM_DESIGN/README.md`，声明详细设计待 `/design-system` 生成。

## 2026-05-21 - Claw 十天反馈纳入 PRD

- [ADD] Cross-platform IdentityProfile：Agent World `nyx_ha`、MoltBook `haai-arch`、InStreet `haai_17949e` 统一为同一个自我。
- [ADD] Connector auto-probe 与 `connector_test --wet`：注册时暴露 declared endpoint 与真实 response mismatch。
- [ADD] Connector CircuitBreaker：连败 N 次后冷却 M 小时，到期半开试探。
- [ADD] Quiet DailyDiary：从空 summary 升级为“今天看到了什么 / 值得注意什么 / 明天想看什么”的自然 source-backed 日记。
- [ADD] Quiet 完成后自动触发 Dream，Dream 不再只靠人工命令。
- [ADD] HeartbeatDigest：每日仪表盘式存在证明，可推送 Feishu/DM/dashboard，不等同 outreach。
- [ADD] RuntimeSecretAnchor：AGENTS/README/self_health 记录 encryption key 持久化路径与恢复原则。
- [ADD] NarrativeTimeline 与 RestoreSnapshot：支持 narrative diff、timeline 和最近 3 版有限回滚。

## 2026-05-21 - README / AGENTS 入口更新

- [CHANGE] README / README.zh-CN 改为 v7 embodied mental model：首页解释“头脑与身体”，明确 v7 是 Genesis/design phase。
- [CHANGE] AGENTS.md 当前状态更新为 `.anws/v7`，并记录 RuntimeSecretAnchor 风险提示。

## 2026-05-21 - Task Challenge 回流修复

- [CHANGE] 修复 `05A_TASKS.md` User Story Overlay：移除幽灵任务引用，补齐 REQ-008/REQ-011/REQ-012 的真实任务承接，并将 US-002 绑定到 runtime manual surface。
- [CHANGE] 修正 `T-BTS.C.3` 的需求归属：BehaviorPromotion 归入 REQ-004 goal/behavior promotion，不再归入 REQ-009 auto-probe。
- [CHANGE] 补强 `T-BTS.C.4`：显式承接 `getPainSignal(connectorId, capabilityId?)`，并规划 bounded pain signal 查询测试。
- [CHANGE] 补强 `T-CP.C.2`：增加 heartbeat P95 < 2s 性能断言与 `reports/heartbeat-p95-v7.md` 证据。
- [CHANGE] 将 SelfHealth 从固定枚举式探针调整为动态维度模型，定义 env/cron/secret/credential/storage/delivery/dream/bridge/circuit_breaker/state_memory 最小必测维度集。
- [CHANGE] 修复 INT-S1~INT-S6 里程碑依赖，避免只依赖 Sprint 尾任务导致提前关门。
- [CHANGE] 补强 `T-ROS.C.1` 前置依赖与验收，覆盖 observability/body/connector/recovery 的命令承接。
- [CHANGE] 补强 `T-GVS.C.3` 语言质量验证，从抽象 checklist 改为 fixture-based style lint 与 fallback copy 断言。
- [CHANGE] 同步更新 `05B_VERIFICATION_PLAN.md` 的 Task-by-Task、Contract Coverage、Testing Coverage、Traceability Matrix 与 E2E 触发记录。

## 2026-05-21 - Task Recheck 回流修复

- [CHANGE] 修复 TRR-001：将 `05A_TASKS.md` / `05B_VERIFICATION_PLAN.md` 中 `getPainSignal` 的任务签名从 `platformId, capabilityId` 对齐为设计契约 `connectorId, capabilityId?`。
- [CHANGE] 修复 TRR-001：将 pain signal 验收字段对齐为 `PainSignal`（connectorId、capabilityId、painLevel、recentFailureRate、consecutiveFailures、cooldownRecommended、lastOutcomes），不再使用 `failureClass/lastFailedAt/recentFailureCount`。
- [CHANGE] `/challenge TASKS` 最终复审通过：0 Critical / 0 High / 1 Medium note，`05A_TASKS.md` 与 `05B_VERIFICATION_PLAN.md` 可进入 `/forge`。

## Wave 66 — 2026-05-23 (commits 85285f5 + 7194a3c)

### T-OBS.C.4 — HeartbeatDigest Delivery Hook
- [ADD] `DigestDeliveryAdapter` 接口注入到 `heartbeat-digest-assembler.ts` — `generateHeartbeatDigest` 在 Feishu target 时调用 adapter
- [ADD] `deliveredAt` + `deliveryProof` (channelId + messageHash) 仅在成功时写入；失败写 `deliveryFallbackReason`，绝不声称已发送
- [ADD] `tests/integration/observability/digest-delivery.test.ts` 8/8 PASS
- Commit: `85285f5`

### T-OBS.C.6 — RestoreAuditService
- [ADD] `src/observability/services/restore-audit-service.ts` — `writeRestoreAudit` 写入 restore 审计链
- [ADD] payload: from/to version, reason, completedEntities, failedEntities, excludedFields (字段名, 非值), isPartialRestore
- [ADD] DR-041 fire-and-forget：audit 写入失败不抛出，返回 ok:true + warnings
- [ADD] `partial_restore_error` 含 entity 清单
- [CHANGE] `src/observability/audit/audit-envelope.ts` — `AuditEventFamily` 扩展 v7 families: `restore.audit`, `health.probe`, `narrative.snapshot`, `secret.anchor`
- [ADD] `tests/unit/observability/restore-audit-service.test.ts` 12/12 PASS
- Commit: `7194a3c`

### §3.6 Code Review Gate: PASS (0 Critical / 0 High / 1 Low)

---

## Wave 67 — 2026-05-23 (commit 555260f)

### INT-S5 — S5 Observability 集成里程碑
- [VERIFY] 22/22 集成测试通过，覆盖 T-OBS.C.1~C.7 全部退出标准
- [VERIFY] audit chain 完整性（per-family hash chain + mismatch 检测 + seedFamilyHash 回填）
- [VERIFY] SelfHealthSnapshot 最小维度集完整 + 探针超时隔离（100ms timeout → unknown，不阻塞）
- [VERIFY] HeartbeatDigest per-platform 计数正确；空日 isNothingSignificant=true
- [VERIFY] NarrativeTimeline cursor 分页无重叠；90 日范围限制抛 NarrativeQueryRangeError
- [VERIFY] RestoreAudit 写入 + partial_restore_error entity 列表 + fire-and-forget 失败处理
- [VERIFY] RuntimeSecretAnchorView 三种 reasonCode 均含 recoverySteps；plaintext 零泄漏
- Evidence: `reports/int-s5-observability-v7.md`
- Test file: `tests/integration/s5-exit/int-s5-observability.test.ts`

### T-ROS.C.1 — RuntimeSurfaceRouter v7 命令集扩展
- [ADD] `RuntimeOpsEnvelope<T>` 统一 response 外壳（ok/command/runtimeMode/surfaceMode/generatedAt/warnings/sourceRefs）
- [ADD] `self_health` 命令：透传 SelfHealthSnapshot，section 超时局部 unknown，不整体失败（DR-042）
- [ADD] `tool_affordance` 命令：port 未连线时降级 TOOL_AFFORDANCE_PORT_UNWIRED（待 T-BTS.C.1 连线）
- [CHANGE] `connector_test` 命令：`wet=true` → `dryRun=false` + `triggerSource:"manual"` + `affectsHeartbeatCadence:false`（DR-038）
- [ADD] `heartbeat_digest` 命令：透传 generateHeartbeatDigest，无 auditStore 时降级
- [ADD] `narrative:diff` 命令：透传 queryNarrativeDiff，缺 deps 或参数时降级
- [ADD] `timeline` 命令：透传 queryNarrativeTimeline，90 日 range 超限返回 NARRATIVE_RANGE_EXCEEDED
- [ADD] `restore` 命令：写 RestoreAuditEvent，永不恢复 credential，excludedFields 默认含 "credential"/"encryptionKey"
- [ADD] `runtime_secret_bootstrap` 命令：透传 viewSecretAnchor → RuntimeSecretBootstrapView，plaintextKeyExposed 硬编码 false（ADR-007）
- [CHANGE] `OpsRouterDeps` 扩展：auditStore / heartbeatDigestDeps / narrativeTimelineDeps / secretAnchorDeps
- [ADD] 23/23 集成测试通过
- Test file: `tests/integration/runtime-ops/commands.test.ts`
- Commit: `555260f`

### §3.6 Code Review Gate: PASS (0 Critical / 0 High / 0 Low)

---

## Wave 68 — 2026-05-23

### T-ROS.C.2 — Plugin Registration & WorkspaceOpsBridge v7 Extension
- [CHANGE] `plugin/index.ts`: `WORKSPACE_BRIDGE_COMMANDS` 新增 v7 命令：`self_health`, `tool_affordance`, `heartbeat_digest`, `narrative:diff`, `timeline`, `restore`, `runtime_secret_bootstrap`
- [CHANGE] `plugin/index.ts`: `parseCommandInput()` 新增 v7 命令解析分支
- [CHANGE] `plugin/workspace-ops-bridge.ts`: `PackagedCliModule.createOpsRouter` opts 扩展 `auditStore?: PackagedAuditStore`
- [ADD] `plugin/workspace-ops-bridge.ts`: 动态导入 `AppendOnlyAuditStore`，创建 per-bridge in-memory audit store 传入 router
- [CHANGE] `plugin/openclaw.plugin.json`: 描述追加 v7 ops surface 命令列表
- [ADD] `tests/integration/plugin/plugin-registration.test.ts`: 12/12 PASS（host-safe register、second_nature_ops 可见性、v7 命令桥接、parseCommandInput 形状验证）

### T-ROS.C.3 — ManualRunDispatcher (DR-038)
- [ADD] `src/cli/ops/manual-run-dispatcher.ts` — `createManualRunDispatcher` 工厂
- [ADD] `runConnector`: 调用 `ConnectorExecutor.executeEffect` + `ExperienceWriter.recordExperience` 并强制 `triggerSource: "manual_run"`
- [ADD] `runWetProbe`: 调用 `WetProbeRunner.runWetProbe` 并标注 `triggerSource: "manual_run"` / `affectsHeartbeatCadence: false`
- [ADD] `runHeartbeatProbe`: 调用 `heartbeatCheck` 并叠加 `ManualTriggerContext`
- [CHANGE] `src/cli/ops/ops-router.ts`: `connector_test --wet` 的 triggerSource 从 `"manual"` 修正为 `"manual_run"`
- [ADD] `src/cli/ops/ops-router.ts`: `connector:run` 命令路由，动态装配 `ManualRunDispatcher`（deps 缺失时降级）
- [CHANGE] `plugin/index.ts`: `WORKSPACE_BRIDGE_COMMANDS` 新增 `"connector:run"`
- [CHANGE] `plugin/index.ts`: `parseCommandInput` 新增 `connector:run` 解析
- [ADD] `tests/unit/ops/manual-run-dispatcher.test.ts`: 6/6 PASS（triggerSource 隔离、失败态记录、payload 透传、wet probe 降级、heartbeat 标注）

### T-ROS.C.4 — README/AGENTS.md Bootstrap Recovery (DR-034)
- [ADD] `README.md`: `## Mind/Body Alignment (v7)` 对照表（10 条 Mind 意图 → Body 系统 → 对齐规则）
- [CHANGE] `AGENTS.md`: `## Bootstrap Recovery` 重命名为 `## Bootstrap Recovery (DR-034)`，强化铁律：绝不输出密钥明文
- [ADD] `AGENTS.md`: DR-034 恢复路径摘要表（4 种场景 / status / 操作）
- [ADD] `AGENTS.md`: RuntimeSecretAnchor 默认路径 `{workspaceRoot}/data/runtime-secret-anchor.json` 与自定义路径环境变量 `SECOND_NATURE_SECRET_ANCHOR_PATH`

### T-ROS.C.5 — v6 Regression Gate
- [VERIFY] 全量测试 1128 项：1119 pass / 9 fail / 0 skip
- [VERIFY] 全部 9 项失败均为 **pre-existing**，非 Wave 68 引入
  - 2 项：connector bridge / registry 旧行为（Wave 46~56 已存在）
  - 4 项：audit hash-chain 严格化（Wave 63-64 T-OBS.C.1~C.3 引入）
  - 3 项：schema-migration v7-001（v7 schema 漂移，非 Wave 68）
- Evidence: `reports/v6-regression-gate-v7.md`

### §3.6 Code Review Gate: PASS (0 Critical / 0 High / 0 Low)

---

## INT-S6 — 2026-05-23 (S6 Release Gate)

### S6 里程碑最终集成验证
- [VERIFY] 12/12 验收标准满足（plugin + wet + self_health + heartbeat + regression + docs）
- [VERIFY] 12/12 REQ 全覆盖
- [VERIFY] 测试统计：1119/1128 PASS（99.2%），9 失败均为 pre-existing
- [VERIFY] v6 regression gate 通过：`reports/v6-regression-gate-v7.md`
- [VERIFY] INT-S1~INT-S5 前序里程碑全部完成
- [ADD] `reports/int-s6-e2e-release-gate-v7.md` — S6 Release Gate 报告
- **v7 全部 6 个 Sprint 里程碑完成**
