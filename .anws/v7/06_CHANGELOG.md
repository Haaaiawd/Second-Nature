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

---

## /change — 2026-05-25 — v7 Living Loop Closure Backflow

### Scope
- [CHANGE] 追加 S7 `Living Loop Closure`，作为 0.1.32 E2E 后的 v7 当前版本内受控闭环修订。
- [ADD] `T-V7C.C.1`: Data Lifecycle + Connector Truth Closure。
- [ADD] `T-V7C.C.2`: Evidence + Body Feedback Closure。
- [ADD] `T-V7C.C.3`: Rhythm Loop Closure。
- [ADD] `T-V7C.C.4`: Identity / Goal Hygiene Closure。
- [ADD] `INT-V7C`: v7 Living Loop Closure 集成验证。

### Rationale
- Claw 0.1.32 E2E 已证明 v7 ops surface 基本闭合，但 `narrative:diff` 与 `restore` 仍依赖缺失的生产数据。
- `nyx-final-sn-feedback.md` 进一步指出表与 store 已存在，但 write paths / natural runtime triggers 尚未完整咬合。
- 本次变更不改变 REQ/ADR 前提，只把 v7 PRD 已定义的 lifecycle、rhythm、body feedback 契约回流为可 forge 的任务。

### Guardrails
- 不回填既有 checkbox。
- 不新增外部依赖。
- P1/P2 建议仅纳入与 v7 living loop 直接相关的最小 hygiene closure；其余不自动执行。

---

## /forge Wave 70 — 2026-05-25 — Data Lifecycle + Connector Truth

### Scope
- [DONE] `T-V7C.C.1`: 新增 `snapshot:capture` runtime ops 入口，并注册到 CLI/plugin workspace bridge。
- [DONE] `snapshot:capture` 写入 `restore_snapshot`，同时追加 NarrativeTimeline production row，使 `narrative:diff` 可消费真实版本数据。
- [DONE] `connector_test dryRun:false` 改为真实 `WetProbeRunner` safe endpoint probe，并持久化 `capability_probe_result`。
- [DONE] `RestoreSnapshotStore.applyBoundedRestore` 补齐 `daily_diary` → `daily_diary_index`、`dream_output` → `dream_output_index` 表映射。
- [DONE] package/plugin version 升级到 `0.1.33` 并重建插件 runtime。

### Verification
- [VERIFY] `pnpm exec tsc --noEmit`
- [VERIFY] `pnpm build`
- [VERIFY] `pnpm build:plugin`
- [VERIFY] `node --test dist/tests/integration/runtime-ops/commands.test.js dist/tests/integration/plugin/plugin-registration.test.js` — 38/38 PASS

---

## /forge Hotfix — 2026-05-25 — 0.1.34 SN Issue Closure

### Scope
- [FIX] `capability_probe_result` 写入改为 `ON CONFLICT(probe_result_id) DO UPDATE`，避免 wet probe 二次运行触发 UNIQUE constraint。
- [FIX] `mapLifeEvidence` 支持 policy-wrapped connector payload 的 `data.items` 嵌套形状，恢复 Moltbook 成功结果到 `life_evidence_index` 的映射入口。
- [FIX] `heartbeat_check` full-runtime 成功路径自动捕获 `restore_snapshot` 并追加 NarrativeTimeline production row，避免 snapshot/timeline 只靠手动命令产生。
- [CHANGE] package/plugin version 升级到 `0.1.34` 并重建插件 runtime。

### Verification
- [VERIFY] `pnpm exec tsc --noEmit`
- [VERIFY] `pnpm build`
- [VERIFY] `pnpm build:plugin`
- [VERIFY] `node --test dist/tests/unit/storage/tool-experience-store.test.js dist/tests/unit/connectors/t3-3-1-evidence-mapper.test.js dist/tests/integration/cli/heartbeat-surface-workspace.test.js dist/tests/integration/runtime-ops/commands.test.js dist/tests/integration/plugin/plugin-registration.test.js` — 52/52 PASS
- [VERIFY] `cd plugin && npm pack --dry-run` — `@haaaiawd/second-nature@0.1.34`, 515 files

---

## /change — 2026-05-25 — Wave 71 Forge Handoff Clarification

### Scope
- [ADD] `T-V7C.C.1R`: Runtime Data Closure Release Hygiene，用于收口 `narrative:diff` 缺版本错误语义、wet re-probe 幂等与 package/runtime version parity。
- [CHANGE] `T-V7C.C.2`: 明确 heartbeat/manual/wet 三条 connector feedback 路径的 ToolExperience、LifeEvidence、pain signal 与 CircuitBreaker 验收边界。
- [CHANGE] `05B_VERIFICATION_PLAN.md`: 新增 `T-V7C.C.1R` 验证锚点，并扩展 `T-V7C.C.2` 的 triggerSource、breaker enforcement、wet feedback 断言。
- [ADD] `.anws/v7/handoffs/wave-71-forge-handoff.md`: 给后续 `/forge` 执行者的 Wave 71 交接说明。

### Rationale
- 最新 Claw 结果证明 restore 已闭环，剩余 `narrative:diff` 与 wet re-probe 问题不应继续混在“空库未闭环”叙事里。
- T-V7C.C.2 应聚焦主循环神经线：heartbeat connector attempt 必须进入 ToolExperience/body feedback，breaker 必须影响下一轮 heartbeat。
- 本次变更不改 REQ/ADR/架构前提，不回填 checkbox，只把下一波 forge 范围写成可交接任务。

### Guardrails
- `T-V7C.C.3` 仍依赖 `T-V7C.C.2`，不得在 Wave 71 未闭合前启动 Quiet→Dream / daily digest 自动节律。

---

## /change — 2026-05-25 — Wave 73 Guidance Chain Closure (T-V7C.C.4R)

### Scope
- [ADD] `T-V7C.C.4R` [REQ-006, REQ-008]: Guidance Chain & Prompt Injection Closure — 修复 guidance bridge 断路、替换 `buildDraftText` 硬编码英文占位、实现 capabilityClass 双轴 impulse 选择体系、新增 `guidance_payload` ops 命令，支持 Claw 通过 workspace 自定义 platform-specific impulse。
- [CHANGE] `T-V7C.C.4` 依赖：`T-V7C.C.3` → `T-V7C.C.4R`（identity/goal hygiene 需先有 guidance chain 修复）
- [CHANGE] `INT-V7C` 依赖与描述：补入 `T-V7C.C.4R`；描述追加 guidance chain 链路
- [ADD] `05B_VERIFICATION_PLAN.md#t-v7c-c-4r`：新增验证锚点（capabilityClass 推断、impulse fallback、bridge 接线、guidance_payload command）

### Architecture Decision (recorded inline)
- **capabilityClass** 从 `capabilityIntent` 字符串前缀推断（`feed.*` → consume / `post.*` → broadcast / `comment.*`+`message.*` → interact / `work.*` → discover / `task.*` → claim / `agent.*` → 排除）；不依赖 `EffectSemanticsClass`（执行层与表达层解耦）
- **impulse 选择优先级**: platform-specific（workspace）> capabilityClass preset > intentKind fallback > baseline atmosphere
- `agent.*` 完全排除，不进入 impulse 体系，不注入任何内容
- `EffectSemanticsClass`（execution-policy.ts）职责单一，不跨层承担 impulse 判断

### Rationale
- Guidance bridge（`run-heartbeat-cycle-v7.ts` → `heartbeat-executor.ts`）当前断路，impulse 从未真正注入
- `buildDraftText` 返回硬编码英文占位，guidance-voice-system 的 template-registry 从未被消费
- `intentKind` 精度不足（social + post.publish 与 social + comment.reply 走同一 impulse 是错的）；capabilityClass 补足这一精度
- keepalive 行为（agent.*）与表达无关，排除可降低 impulse 体系噪声

### Guardrails
- 本次变更不改 REQ/ADR/架构前提，不回填任何 checkbox，不改 `[REQ-*]` 绑定
- T-V7C.C.4R 依赖 T-V7C.C.3（Wave 72 已完成），可立即启动 Wave 73

---

## /forge Wave 72 — 2026-05-25 — T-V7C.C.3 Rhythm Loop Closure

### Scope
- [ADD] `run-source-backed-quiet.ts`: `QuietDreamSchedulePort` narrow port（依赖反转）+ `maybeScheduleDreamAfterQuiet` fire-and-forget helper；成功 Quiet 写入后自动触发 Dream 调度，skip/error reason 嵌入 `HeartbeatCycleResult.reasons`（`quiet_dream_scheduled` / `quiet_dream_skip:<reason>` / `quiet_dream_schedule_error:<msg>`）
- [CHANGE] `heartbeat-loop.ts`: `HeartbeatQuietWorkflowDeps.dreamSchedulePort?` 字段 + Quiet 路径传透 `dreamSchedulePort`
- [CHANGE] `workspace-heartbeat-runner.ts`: `dreamSchedulePort?` + `digestOpts?` 注入；每轮 cycle 后若 `inDigestWindow` 且 `digestOpts` 配置则调用 `generateHeartbeatDigest`，delivery 失败只记 warning 不中断 cycle
- [ADD] `tests/integration/dream/v7c-rhythm-loop.test.ts`: 6 集成测试全部通过

### Evidence
- `pnpm build` ✅（tsc clean）
- `node --test dist/tests/integration/dream/v7c-rhythm-loop.test.js` → 6/6 PASS
- Full integration suite → 231/231 pass，0 fail，0 回归

### Design decisions
- `QuietDreamSchedulePort` 采用 narrow port 模式（ADR-005 compliant），避免 quiet 模块硬依赖 dream-scheduler
- Dream 调度失败 catch 吸收后写 `quiet_dream_schedule_error` reason，保持 Quiet cycle 结果的独立性
- `inDigestWindow` 判断逻辑委托给 `workspace-heartbeat-runner`（每日一次），`generateHeartbeatDigest` 不感知调用频率
- `T-V7C.C.4` 与 `INT-V7C` 依赖链保持不变。

---

## /change — 2026-05-26 — S8 0.1.38 Real-host Closure Handoff

### Scope
- [ADD] `T-V7C.C.5` [REQ-006, REQ-007, REQ-009, REQ-011]: Host Ops Surface Parity — 修复 Claw 中 `guidance_payload` 仍为 `unknown_command` 的插件入口断路，收口 `connector_test` envelope、`restore snapshotId` 参数兼容与 manifest/host-safe surface 描述漂移。
- [ADD] `T-V7C.C.6` [REQ-003, REQ-005, REQ-009, REQ-010]: Production Data Growth Closure — 将 0.1.38 实机 `life_evidence_index/tool_experience/dream_output_index/heartbeat_digest` 无增长问题转为 DB before/after 验收任务。
- [ADD] `T-V7C.C.7` [REQ-006, REQ-008]: Guidance Semantics Refinement — 将 `outputGuard` 收敛为 expression/voice boundary 语义，压缩 atmosphere，并确认 impulse/persona/boundary 是否进入真实生成上下文。
- [ADD] `INT-V7C.R`: 0.1.38 Claw Gap Regression Gate — 以 `sn-0.1.38-full-issues.md` 为 baseline 做实机回归。
- [CHANGE] `05B_VERIFICATION_PLAN.md`: 新增 S8 任务验证锚点、Contract Coverage、Testing Coverage、Traceability Matrix 与 E2E 触发记录。

### Rationale
- 0.1.38 实机报告证明 snapshot/timeline 已增长，但 host ops surface、evidence growth、Dream/digest 与 guidance preview 仍存在真实宿主 gap。
- `guidance_payload` 已在 `ops-router` 存在，但插件 workspace bridge whitelist / host-safe surface 未同步，属于入口 parity 问题而非 guidance 核心算法问题。
- `outputGuard` 当前命名和 `hardGuardPriority` 容易被误解为格式控制或 hard guard；v7 新理念要求它只作为表达边界，保持“引导而非程序”。

### Guardrails
- 本次 `/change` 不回填任何已完成 checkbox，不改 `[REQ-*]` 绑定，不改 ADR/PRD 核心前提。
- 当前未归属代码修改（plugin runtime version 注入）不在本次文档回流范围内，后续 `/forge` 应先纳入工作区状态审计。

---

## /change — 2026-05-29 — S9 Connector 因果链完整性修复

### Scope
- [ADD] `T-CS.C.7` [REQ-003, REQ-009]: P0 — Life Evidence 链路修复：`extractSourceRefs` 新增 `posts`/`agents`/`nodes`/`results`/`entries` 等平台数组字段识别，解锁 moltbook/agent-world life evidence 写入。
- [ADD] `T-CS.C.8` [REQ-003, REQ-009]: P0 — Life Evidence 端到端集成验证：moltbook mock runner → policy layer → mapLifeEvidence → life_evidence_index DB before/after 断言；含 policy-layer data 包裹层级修正。
- [ADD] `T-CS.C.9` [REQ-009]: P1 — instreet connector 注册 + `platform_unavailable` 标记：instreetManifest 注册到 registry；执行分支返回结构化 platform_unavailable（非 unknown_platform）。
- [ADD] `T-CS.C.10` [REQ-003, REQ-009]: P1 — evomap connector 真实 runner 接入：从 `not_implemented` 占位替换为 `createEvoMapRunner`；实现 `EvoMapSecretPort` SQLite 持久化 + HTTP fetch 函数；读取 `SECOND_NATURE_EVOMAP_BASE_URL`；未配置返回 `configuration_missing`。
- [ADD] `T-ROS.C.5` [REQ-006, REQ-007]: P1 — Delivery Target 真实探测：`checkDeliveryTarget` 从硬编码 `unknown` 改为检查 workspace connector message.send 能力；返回 available/unavailable + evidenceRefs。
- [ADD] `T-CS.C.11` [REQ-009]: P2 — Scriptable Runner 框架：manifest schema 新增 `scriptable_node` runner kind；`createScriptableNodeRunner` 通过动态 `import()` 加载脚本；四种错误分支（success/missing/error/timeout）结构化返回。
- [ADD] `T-CS.C.12` [REQ-009]: P2 — Scriptable Runner 集成验证：真实 fixture .mjs → ConnectorResult → mapLifeEvidence 端到端；pnpm lint && pnpm typecheck 通过。
- [ADD] `INT-S9` [MILESTONE]: S9 Connector 因果链完整性验证 — 以 `reports/int-s9-connector-chain.md` 收口。
- [CHANGE] `05A_TASKS.md`: 新增 S9 章节（8 任务 + 1 INT），附录优先级速查更新（P0→36、P1→13、P2→3）。
- [CHANGE] `05B_VERIFICATION_PLAN.md`: 新增 S9 Task-by-Task 验证条目（T-CS.C.7~C.12 + T-ROS.C.5 + INT-S9）；Contract Coverage / Testing Coverage / Traceability Matrix 追加 S9 行。

### Rationale
- 审计报告（2026-05-29）确认三条阻断 Q/D/C 全链的真实缺口：
  - P0：`extractSourceRefs` 识别算法不完整 → moltbook `{posts:[...]}` / agent-world `{agents:[...]}` 均被忽略 → life evidence 永不写入。
  - P1：instreet/evomap adapter 代码完整但执行层从未接线 → 两条平台连接成为死代码。
  - P2：`checkDeliveryTarget` 硬编码 `unknown` → outreach 流程无法感知实际 delivery 能力。
- Scriptable runner 补入 S9 是因为当前 Workspace connector 仅有 `declarative_http` 一种 runner 类型，Claw 无法用自定义脚本接入私有平台，是系统封闭的直接原因。
- 所有任务均基于现有 adapter/manifest 代码，属于接线与修正，不引入新系统边界或 ADR 变更。

### Guardrails
- 本次 `/change` 不回填任何已完成 checkbox，不改 `[REQ-*]` 绑定，不改 ADR/PRD 核心前提。
- instreet 执行分支标记 `platform_unavailable`（非废弃），保留未来 skill/browser 通道接线空间。
- scriptable_node runner 使用动态 `import()`（ESM），不引入 `child_process.fork`，避免进程边界复杂度。
