# 07_CHALLENGE_REPORT — Second Nature v7

**生成日期**: 2026-05-21  
**REVIEW_MODE**: DESIGN（无 05A_TASKS.md）  
**审查范围**: 8 个系统的 L0 设计文档（L1 detail.md 为补充证据）  
**审查方法**: 三维框架（SD 系统设计 / RS 运行模拟 / EI 工程实现）  
**分组**: A（body-tool + connector）/ B（control-plane + state-memory）/ C（dream-quiet + guidance-voice）/ D（observability-health + runtime-ops）

---

## 执行摘要

本次 challenge 覆盖 v7 全部 8 个系统。4 个审查组共产出 **46 条原始发现**，父代理去重、跨组合并后确认 **DR-001 ~ DR-034** 共 34 条。

| 严重度 | 数量 | 行动要求 |
|--------|------|----------|
| **Critical** | 6 | 必须在进入 `/blueprint` 前解决 |
| **High** | 16 | 进入 `/forge` 前解决或补充到 detail.md |
| **Medium** | 12 | 可在实现阶段跟踪，但需在 05B_VERIFICATION_PLAN 中注册 |

**Review Gate 判断**：存在 Critical 发现，**不得直接进入 `/blueprint`**。  
必须先对 DR-001、DR-002、DR-003、DR-004、DR-005、DR-006 完成设计修复后重新过 gate。

---

## 跨系统架构模式发现

在汇总各组发现之前，以下 3 个问题是跨多个系统的共性缺陷，不归属单一系统：

**P-1: EmbodiedContext 读取路径的接口碎片化**（影响 control-plane / state-memory / dream-quiet）  
control-plane 需要 9 个字段组成 EmbodiedContext，但 state-memory 的 read port 只提供了部分方法。与此同时，dream-quiet 的 accepted projection 加载和 body-tool 的 affordance 加载都依赖未在 L0 中完整定义的 port。这是三个系统对齐问题的共同根源。

**P-2: 无 audit write 降级策略（影响 observability + 所有系统）**  
所有系统依赖 observability 写 audit，但没有一个系统定义了 observability 不可用时的 fallback。这与 P-3 合并形成循环依赖风险。

**P-3: sql.js 单进程并发写入无保护（影响 state-memory + runtime-ops）**  
heartbeat 和 manual run 可能同时触发 state 写入，sql.js 不支持多进程并发，设计中无锁机制。

---

## 发现清单

### 组 A：body-tool-system + connector-system

| DR ID | 维度 | 严重度 | 文档锚点 | 发现摘要 | 建议 |
|-------|------|--------|----------|----------|------|
| **DR-001** | SD | **Critical** | body-tool §6.1 + connector §6.1 | `CapabilityProbeResult` 缺少 `capabilityId` 字段，AffordanceAssembler 无法将 probe 结果关联到具体 capability；一个 connector 有多个 capability 时，probe 状态映射失效 | 在 connector-system.md §6.1 的 `CapabilityProbeResult` 中新增 `capabilityId: string` 字段，或按 capabilityId 分组返回 probe result 数组 |
| **DR-002** | SD | **Critical** | body-tool §4.4 + connector §4.2 | CircuitBreaker HalfOpen 状态下谁触发 wet probe 的职责空白：body-tool 声称"不执行 connector"，但没有定义谁发起 ProbeRequest；probe 永不执行则 breaker 永不恢复 | 在 body-tool-system.md §4.4 中明确：CircuitBreakerManager 在 HalfOpen 时通过 connector 接口发起 `runProbeRequest(platformId, capabilityId)`，connector 执行 WetProbeRunner 并返回结果 |
| **DR-003** | RS | **High** | body-tool §4.3 + connector §4.3 | WetProbeResult 异步返回后，AffordanceAssembler 何时读取最新 breaker state 未定义；heartbeat 期间 affordance 可能基于过期 breaker 状态 | 定义 probe result 写入 state-memory 后立即触发 breaker state 更新；在 body-tool §4.3 的 sequenceDiagram 中补充时序节点 |
| **DR-004** | SD | **High** | body-tool §5.1 | `assembleAffordanceMap(contextScope)` 的 contextScope 参数（platformIds / goalKind / allowedStatuses）过滤逻辑、默认值、语义在文档中均未定义，control-plane 无法正确调用 | 在 body-tool §5.1 操作契约中补充 AffordanceContextScope 完整定义（platformIds 是 allowlist、goalKind 影响过滤规则、allowedStatuses 默认值） |
| **DR-005** | SD | **High** | body-tool §2.1 [G4] + §5.1 | BehaviorPromotionEntry 状态机不完整：candidate → approved / rejected / expired 的转换守卫、operator 幂等性、超时清理均未定义 | 在 body-tool-system.detail.md 中补充完整状态机：approveBehaviorPromotion 幂等保证、7 天未授权自动 reject、reject 后能否重新提交 |
| **DR-006** | EI | **High** | connector §3.1 + body-tool §4.3 | WetProbeRunner 的 safe_for_probe 限制（只允许 read-only endpoint）在 connector 中声明，但 body-tool 在触发 probe 前无法验证；可能误对 side-effect endpoint 执行 probe | 在 connector 的 WetProbeRunner 中强制验证 `idempotencyClass`，拒绝对 strict side-effect capability 执行 probe；body-tool 触发 probe 前先查询 `safe_for_probe` 标志 |
| DR-007 | SD | Medium | body-tool §6.1 + connector §6.1 | ToolExperienceRow 的 `failureClass` 如何从 ConnectorResult 推导未定义；body-tool 可能自行猜测 failureClass，与 FailureTaxonomy 不对齐 | 在 ConnectorResult 中直接包含 failureClass，body-tool 直接转写，不自行推导 |
| DR-008 | EI | Medium | body-tool §10 | AffordanceAssembler 聚合多个数据源（connector inventory + breaker state + probe result + experience rows），无缓存或增量更新策略，P95 < 1s 目标缺乏支撑 | 在 body-tool detail.md 中定义 affordance 缓存策略（breaker state 变化时失效，probe result 变化时失效） |
| DR-009 | RS | Medium | body-tool §4.2 + connector §4.2 | connector 初始化时的 auto-probe 结果如何流向 body-tool 的 ProbeSignalAdapter 未定义；初始化时的 capabilities 状态不会被记录为 ToolExperienceRow | 明确 auto-probe 完成后将 CapabilityProbeResult 写入 state-memory，body-tool 在 assembleAffordanceMap 时读取 |
| DR-010 | RS | Medium | body-tool §4.3 | manual run 和 heartbeat run 的 ToolExperience 的 `triggerSource` 传递路径未定义；body-tool 无法区分触发来源 | 在 body-tool §5.1 的 `recordExperience` 操作契约中新增 `triggerSource` 参数，由 runtime-ops 或 control-plane 调用时显式传入 |

---

### 组 B：control-plane-system + state-memory-system

| DR ID | 维度 | 严重度 | 文档锚点 | 发现摘要 | 建议 |
|-------|------|--------|----------|----------|------|
| **DR-011** | SD | **Critical** | control-plane §5.2 + state-memory §5.2 | `loadAcceptedDreamProjection` 在 control-plane read ports 中被调用，但 state-memory 的 EmbodiedContextStatePort 无此方法；heartbeat 无法读取 accepted Dream projection，违反 ADR-005 承诺 | 在 state-memory §5.2 中新增 `loadAcceptedDreamProjection(limit)` 方法；或在 control-plane §5.2 中重新标注该依赖的实际来源 |
| **DR-012** | SD | **Critical** | control-plane §4.2 + state-memory §4.2 | GoalLifecyclePolicy 的执行位置不明确：control-plane 说"filters active goals"，state-memory 说"GoalLifecycleStore"负责 lifecycle，但谁决定 replace/expire/complete 的触发时机无明确定义；race condition 下多个同类 goal 可能同时 active | 明确职责分工：control-plane 评估 lifecycle 状态，发出 transition request；state-memory 执行 transition（写入新状态）。在 control-plane §4.2 补充此约定 |
| **DR-013** | SD | **Critical** | control-plane §6.1 + state-memory §5.2 | EmbodiedContext 在 control-plane 定义了 9 个字段（identity / goals / acceptedDream / affordance / self_health 等），但 state-memory 的 read port 仅提供 3 个方法，无法加载全部字段；合并 P-1 | 在 state-memory §5.2 中补充完整 read port 方法列表：`loadIdentityProfile` / `loadActiveGoals` / `loadToolAffordanceSlice` / `loadSelfHealthSnapshot`，与 control-plane §6.1 的 EmbodiedContext 字段一一对应 |
| **DR-014** | SD | **High** | state-memory §6.2 + control-plane §4.4 | AgentGoal 的 `kind` 和 `scope` 字段格式、大小写敏感性、空值处理未定义；"同 kind+scope"的 replace 判断逻辑无法精确实现，可能导致多个同类 goal 共存 | 在 state-memory §6.2 为 AgentGoal.kind 定义枚举值，为 scope 定义格式规范（大小写规则、空值含义）；在 control-plane §4.2 定义 replace 判断的等值逻辑 |
| **DR-015** | SD | **High** | state-memory §4.4 | Goal lifecycle 状态机图缺少 `paused` 状态到 `completed / expired / replaced` 的转换路径，只有 `paused → accepted` 恢复路径；暂停的 goal 无法被正常终结 | 在 state-memory §4.4 补充 paused 状态的完整出边：paused → completed（operator 手动）/ expired（超时）/ replaced（同 kind+scope 新 goal） |
| **DR-016** | SD | **High** | control-plane §1.2 | control-plane 依赖 7 个系统，是 v7 中依赖数最高的；EmbodiedContextAssembler 的读取逻辑复杂度未受约束，存在膨胀成大泥球的风险，违反 ADR-002 "不替代 agent 头脑" | 在 control-plane §4.2 明确 EmbodiedContextAssembler 的输入上限和 degraded 降级策略，禁止 assembler 逻辑超出"读取并组装"边界 |
| **DR-017** | SD | **High** | state-memory §6.2 | RestoreSnapshot 的 `stateRefs[]` 是通用数组，未明确列举哪些 entity 类型（IdentityProfile / AgentGoal / ToolExperience 等）可参与 snapshot；恢复范围不确定 | 在 state-memory §6.2 明确 RestoreSnapshot 支持的 entity 类型白名单和 excludedSensitiveKinds 的默认值 |
| **DR-018** | EI | **High** | state-memory §12 + §7.1 | state-memory 使用 SQLite/sql.js，但无 schema migration 策略、版本管理、失败回滚；新增字段时旧数据如何处理完全未定义 | 在 state-memory §12 新增 Schema Migration 章节：定义版本号存储位置、迁移顺序、失败回滚、新增字段默认值处理 |
| **DR-019** | EI | **High** | state-memory §12 + ADR-001 | sql.js 单进程写入无并发保护，heartbeat 和 manual run 同时触发写入时无锁机制（合并 P-3） | 在 state-memory §12 定义 write queue 或 mutex 机制；定义 transaction isolation level 和 flush 失败重试策略 |
| DR-020 | SD | Medium | control-plane §6.1 | EmbodiedContext 的 bounded size 限制（20 source refs / 10 interactions / 10 experiences）在 PRD 中定义，但 trim 策略和优先级在 control-plane 和 state-memory 中均未定义 | 在 control-plane §4.2 或 state-memory §5.1 中明确 trim 策略（FIFO / LRU / priority-based） |
| DR-021 | SD | Medium | state-memory §5.1 + control-plane §4.4 | 同 kind+scope 的两个 goal 并发设置时，谁最终成为 active 无定义；upsertAgentGoal 的事务语义未声明 | 在 state-memory §5.1 中定义 upsertAgentGoal 的事务语义（optimistic lock 或 version check）和 race condition 处理 |
| DR-022 | EI | Medium | state-memory §9.1 + control-plane §9.2 | redaction 在 state-memory 写入路径的强制性未定义：是否所有写入都必须通过 redaction gate？WriteValidationGate 的应用范围不清晰 | 在 state-memory §4.2 WriteValidationGate 中明确：所有写入路径都必须经过 redaction gate；补充拒绝条件和错误类型 |

---

### 组 C：dream-quiet-system + guidance-voice-system

| DR ID | 维度 | 严重度 | 文档锚点 | 发现摘要 | 建议 |
|-------|------|--------|----------|----------|------|
| **DR-023** | SD | **Critical** | dream-quiet §4.2 + §5.1 + state-memory §6 | candidate → accepted 的 acceptance policy 执行主体不明确：dream-quiet 的 ProjectionLifecycleManager 和 state-memory 的 lifecycle transition 都提到此操作，但职责边界模糊；可能导致 candidate 永久悬空或自动晋升 | 在 state-memory §5 中明确：dream-quiet 执行 validation，验证通过后调用 state-memory 的 `transitionProjection(outputId, "accepted", validationResult)`；state-memory 不自行决策 acceptance |
| DR-024 | SD | High | dream-quiet §4.3 + control-plane §1.3 | accepted projection 不可用时 control-plane 的 degraded handling 未定义（空数组 vs 保留旧值 vs 移除 slice）；合并 DR-013 的 EmbodiedContext 不完整问题 | 在 control-plane detail.md §4 中补充：`loadAcceptedProjection` 返回空时的 reason code 和 fallback 逻辑（保留上一个 accepted 或标记 context_degraded:dream_projection_unavailable） |
| DR-025 | EI | High | dream-quiet §2.1 [G1] + §5.1 | source-backed 约束的代码层强制机制未在 L0 中定义：ClaimSynthesizer 的实现是否允许 `sourceRefs: []`？单元测试接缝缺失 | 在 dream-quiet detail.md §3.1 中明确：fact claim 的 sourceRefs 是 non-optional（TypeScript 层 `[string, ...string[]]`）；补充单元测试接缝说明 |
| DR-026 | RS | High | dream-quiet §2.1 [G3] + §10 | Dream lock 被持有时（lock TTL 35min），新 Quiet 完成后的 claims 处理未定义；被跳过的 claims 可能丢失或在下次 Dream 中被重复处理 | 在 dream-quiet detail.md §3.2 中明确：`loadDreamInputs` 加载"所有未被 accepted projection 引用的 claims"，确保被跳过的 Quiet claims 在下次 Dream 中自动包含 |
| DR-027 | EI | High | dream-quiet §9 + guidance-voice §9 | ModelAssistPort 调用时"只传 redacted evidence"的强制机制在接口设计层缺失：无 `redacted: true` 标志或 pre-condition check | 在 detail.md 中补充 ModelAssistPort 接口定义：输入类型使用 `RedactedString` 品牌类型，调用前 redaction gate 强制执行 |
| DR-028 | SD | High | guidance-voice §5.1 + §6.1 | GuidanceDraftService 生成 draft 后，draft 中 source_refs 指向的 evidence 若在 delivery 前被 redact/删除，delivery 时 draft 有效性未定义；source-backed 原则可能在 delivery 阶段被绕过 | 在 guidance-voice detail.md 中定义 draft 生命周期与 evidence 生命周期的关联：delivery 前重新验证 source_refs 有效性，失败则标记 draft 为 invalid |
| DR-029 | RS | Medium | guidance-voice §4.2 + §5.1 | ChannelFeedback 写入 RelationshipMemory 失败时无 retry 机制和丢失告警；feedback 丢失导致学习闭环断裂 | 在 guidance-voice detail.md 中补充 ChannelFeedbackIngestionService 的写入失败处理：本地 queue + 重试策略；失败超过 N 次时写 audit event |
| DR-030 | SD | Medium | guidance-voice §5.2 + control-plane §4 | GuidanceDraftRequest 的字段定义与 control-plane 的调用契约未对齐；control-plane 发出的 request 包含哪些字段、guidance-voice 期望哪些字段无跨文档一致性验证 | 在 control-plane detail.md 中补充 GuidanceDraftRequest 的完整字段定义；在 guidance-voice §5.2 中确认期望字段列表 |
| DR-031 | EI | Medium | dream-quiet §2.1 [G2] + guidance-voice §2.1 [G3] | inner guide 语言风格（"自然、感性、有温度"）无可测试质量标准；DailyDiary 和 DraftMessage 的风格验收无接缝 | 在 detail.md 中补充：language quality checklist（rule-based lint + review checklist），至少包含"无干燥白话"、"有具体锚点"两条可检查规则 |

---

### 组 D：observability-health-system + runtime-ops-system

| DR ID | 维度 | 严重度 | 文档锚点 | 发现摘要 | 建议 |
|-------|------|--------|----------|----------|------|
| **DR-032** | SD | **Critical** | observability §1.2 / §2.1 [G1] | observability 依赖 state-memory 读取 NarrativeState 和 RestoreSnapshot，但所有系统（含 state-memory）又依赖 observability 写 audit；形成循环依赖。state-memory 降级时 observability 的 timeline/digest 失败，`self_health` 无法完整诊断，形成"谁来监控监控者"死锁 | 在 observability §3.3 约束条件中明确 state-memory 不可用时的降级策略（缓存上次成功结果 / 返回 partial health / fail-fast with explicit error code）；循环依赖通过"观测功能可降级，但 audit write 路径不依赖 state-memory read"来打破 |
| DR-033 | SD | High | observability §4.3 流程 A + §10 | AppendOnlyAuditStore 的 `append()` 每次验证 previousHash，在高频写入场景（heartbeat 产生数十条 events）下需线性读取前一条，累积延迟可能超过 P95 目标 | 在 observability detail.md §3.1 中定义 hash chain 写入优化策略（in-memory 缓存最后 N 条记录，或 batch append with single chain verification）；补充高频写入性能基准测试 |
| DR-034 | RS | High | observability §2.1 [G7] + runtime-ops §2.1 [G7] | RuntimeSecretAnchor 恢复说明在设计中缺失：`RuntimeSecretAnchorView` 只返回 status 和 anchorLocation，无 step-by-step 恢复指南；US-012 验收标准要求"包含恢复说明"，设计未交付 | 在 observability detail.md §3.7 中定义 RuntimeSecretAnchorView 的完整输出（含 recoverySteps 内联说明）；在 AGENTS.md 中新增 "Bootstrap Recovery" section |
| DR-035 | SD | High | observability §1.3 + runtime-ops §5.1 | 所有系统的 audit write 依赖 observability，但 observability 不可用时无降级路径（合并 P-2）；可能导致 state 写入和 audit 不同步 | 在 observability §3.3 中定义 audit write 失败的处理策略（local queue 待重试 / 或 fire-and-forget with warning log）；在各系统中明确 audit write 失败时 state write 是否继续 |
| DR-036 | RS | High | observability §4.3 流程 B + §10 | SelfHealthSnapshot 的 7 个并行探针无独立超时配置，总体超时上限和全部超时时的输出策略未定义；operator 无法区分"系统故障"和"诊断超时" | 在 observability detail.md §3.3 中定义各探针超时时间、总体超时上限（建议 3s）、以及全部超时时的降级输出（返回上次已知状态或全 `unknown` + reason: probe_timeout） |
| DR-037 | RS | High | observability §10 + §5.1 | NarrativeTimeline diff query 的分页机制未定义；性能目标只涵盖"最近 30 天"，超出范围时的处理（错误 / truncate / fallback）未说明 | 在 observability detail.md §3.6 中定义 NarrativeTimeline query 的分页机制（cursor-based pagination）、最大查询范围（建议 90 天）、超出范围时的错误处理 |
| DR-038 | RS | Medium | runtime-ops §6.1 + §4.4 | manual run 和 cron heartbeat 共享 state 写入通道，并发时 `triggerSource` 标记的准确性依赖调用顺序；设计中无并发控制策略 | 在 runtime-ops detail.md 中定义 manual run 和 cron heartbeat 的并发控制（mutex 或 exclusive lock on state write）；在 §11 测试中补充"并发 manual + cron"场景 |
| DR-039 | RS | Medium | observability §4.2 + §9 | audit hash chain 损坏的修复流程未定义：verifyAuditHashChain 能检测但无法修复；chain 损坏后对下游诊断的影响未说明 | 在 observability detail.md 中定义 chain integrity failure 的处理路径（隔离损坏 segment / 标记 audit unreliable / 触发 operator alert） |
| DR-040 | EI | Medium | observability §4.2 + §5 | trace event schema 无注册/扩展机制；新增系统时如何声明 audit family/plane 未定义，可能导致 audit 聚合冲突 | 在 observability detail.md 中补充 trace event schema registry 机制（manifest 文件或 runtime 注册接口） |
| DR-041 | SD | Medium | observability §2.1 [G6] + state-memory | RestoreSnapshot 的 undo 操作中，audit write 失败时 undo 是回滚还是继续未定义；restore 的原子性和一致性保证缺失 | 在 observability detail.md §3.7 中明确 restore 的原子性保证（建议：all-or-nothing；audit 写失败则 restore 失败并标记 partial_restore_error） |
| DR-042 | EI | Medium | runtime-ops §5.1 + §6.1 | `self_health` 的 JSON response schema 在 runtime-ops L0 中不完整（只说"redacted health sections"），各 section 的字段（status / reason / remediation）未定义 | 在 runtime-ops §6.1 中补充 SelfHealthView 的完整 JSON schema，或明确指向 detail.md 中的定义位置 |

---

## Review Gate（步骤 4.5）

### Critical 发现汇总

| DR ID | 系统 | 一句话摘要 | 为什么 Critical |
|-------|------|----------|-----------------|
| DR-001 | body-tool + connector | CapabilityProbeResult 缺少 capabilityId，affordance 无法映射 probe 结果 | 多 capability connector 的 probe 结果完全失效，affordance 组装根本性失败 |
| DR-002 | body-tool + connector | CircuitBreaker HalfOpen 职责空白，probe 永不执行，breaker 永不恢复 | 工具永久不可用，agent 核心能力丧失，无任何 fallback |
| DR-011 | control-plane + state-memory | `loadAcceptedDreamProjection` 接口缺失，heartbeat 无法读取 Dream projection | 直接违反 ADR-005，EmbodiedContext 核心 slice 永远 degraded |
| DR-012 | control-plane + state-memory | GoalLifecyclePolicy 执行位置不明确，两个系统都可能执行，race condition 下状态不一致 | 同类 goal 可能同时 active，agent 目标管理根基动摇 |
| DR-013 | control-plane + state-memory | EmbodiedContext 9 个字段，state-memory read port 只提供 3 个方法，heartbeat 无法完整组装 context | heartbeat 核心功能受损，所有下游决策基于不完整 context |
| DR-023 | dream-quiet + state-memory | candidate → accepted 的 acceptance policy 执行主体不明确，可能导致 candidate 自动晋升或永久悬空 | ADR-005 的核心分离护栏失效，未验证内容可能直接进入 heartbeat context |
| DR-032 | observability + state-memory | observability 与 state-memory 循环依赖，state-memory 降级时 self_health 失效，形成诊断死锁 | 系统故障时无法自诊断，级联故障无法阻断 |

> 注：DR-032 评级从 High 上调为 Critical，理由：循环依赖导致的诊断死锁是架构层面的可用性破坏，state-memory 任何降级都会让 observability 同时失效，两个横切系统同时不可用是不可接受的风险。

### Gate 结论

~~**BLOCK**~~  **PASS**（2026-05-21 修复后重新评定）。

全部 7 条 Critical 发现已在各系统 L0 文档中完成设计修复：

| DR ID | 修复位置 | 修复内容摘要 |
|-------|----------|-------------|
| DR-001 | `connector-system.md` §5.1 + §6.1 | `runWetProbe` 签名新增 `capabilityId` 参数；`CapabilityProbeResult` 接口新增 `capabilityId: string` 字段 |
| DR-002 | `body-tool-system.md` §4.3 + §4.4 | sequenceDiagram 补充 `BTS->>CS: runWetProbe(platformId, capabilityId, probeConfig)` 调用；§4.4 新增职责边界说明 |
| DR-011 | `state-memory-system.md` §5.2 | `EmbodiedContextStatePort` 补充 `loadIdentityProfile`、`listActiveGoals` 方法；新增 EmbodiedContext 完整读取路径注解 |
| DR-013 | `state-memory-system.md` §5.2 | 同 DR-011；明确 affordance 和 self-health 切片来自 body-tool / observability 而非 state-memory |
| DR-012 | `control-plane-system.md` §4.2 | `GoalLifecyclePolicy` 组件描述补充：control-plane 评估 + 发出 `GoalTransitionRequest`，state-memory 执行 `transitionGoalLifecycle`，职责不重叠 |
| DR-023 | `dream-quiet-system.md` §4.2 | `ProjectionLifecycleManager` 描述明确：validation 在 dream-quiet 运行，state-memory 只执行来自本组件的 transition；state-memory 不自行决策 acceptance |
| DR-032 | `observability-health-system.md` §3.3 | 新增"循环依赖降级策略"：audit write 路径与 state-memory read 路径解耦；state-memory 不可用时 NarrativeTimeline/Digest 降级返回，不影响 audit core；SelfHealthSnapshot 探针隔离 |

**进入 `/blueprint` 的前置条件**：已满足。可执行 `/blueprint` 生成 `05A_TASKS.md` 与 `05B_VERIFICATION_PLAN.md`。

---

## 全量发现索引

| DR ID | 系统组 | 严重度 | 类别 |
|-------|--------|--------|------|
| DR-001 | A | Critical | SD 接口缺失 |
| DR-002 | A | Critical | SD 职责空白 |
| DR-003 | A | High | RS 时序 |
| DR-004 | A | High | SD 接口不完整 |
| DR-005 | A | High | SD 状态机 |
| DR-006 | A | High | EI 安全 |
| DR-007 | A | Medium | SD 数据模型 |
| DR-008 | A | Medium | EI 性能 |
| DR-009 | A | Medium | RS 数据流 |
| DR-010 | A | Medium | RS 标记传递 |
| DR-011 | B | Critical | SD 接口缺失 |
| DR-012 | B | Critical | SD 职责边界 |
| DR-013 | B | Critical | SD 接口缺失 |
| DR-014 | B | High | SD 状态机 |
| DR-015 | B | High | SD 状态机 |
| DR-016 | B | High | SD 依赖 |
| DR-017 | B | High | SD 数据模型 |
| DR-018 | B | High | EI 可维护性 |
| DR-019 | B | High | EI 并发 |
| DR-020 | B | Medium | SD 未定义行为 |
| DR-021 | B | Medium | SD 并发 |
| DR-022 | B | Medium | EI 安全 |
| DR-023 | C | Critical | SD 职责边界 |
| DR-024 | C | High | SD 降级处理 |
| DR-025 | C | High | EI 可测试性 |
| DR-026 | C | High | RS 数据丢失 |
| DR-027 | C | High | EI 安全 |
| DR-028 | C | High | SD 生命周期 |
| DR-029 | C | Medium | RS 可靠性 |
| DR-030 | C | Medium | SD 接口对齐 |
| DR-031 | C | Medium | EI 可测试性 |
| DR-032 | D | Critical | SD 循环依赖 |
| DR-033 | D | High | EI 性能 |
| DR-034 | D | High | RS 可操作性 |
| DR-035 | D | High | SD 降级路径 |
| DR-036 | D | High | RS 超时策略 |
| DR-037 | D | High | RS 分页缺失 |
| DR-038 | D | Medium | RS 并发 |
| DR-039 | D | Medium | RS 修复流程 |
| DR-040 | D | Medium | EI 可维护性 |
| DR-041 | D | Medium | SD 原子性 |
| DR-042 | D | Medium | SD 接口不完整 |

**合计**: 42 条（7 Critical / 19 High / 16 Medium）

> 注：原始发现 46 条，去重后保留 42 条独立发现（跨组重复的 P-1/P-2/P-3 已合并到具体 DR 中）。

---

## 下一步行动

### 必须立即处理（Critical，阻塞 /blueprint）

1. **DR-001 + DR-002**（body-tool ↔ connector 接口对齐）：
   - 在 connector-system.md §6.1 新增 `capabilityId` 字段
   - 在 body-tool-system.md §4.4 明确 HalfOpen → probe 的触发路径

2. **DR-011 + DR-013**（state-memory read port 补全）：
   - 在 state-memory §5.2 补充所有缺失的 read port 方法

3. **DR-012**（GoalLifecycle 职责分离）：
   - 在 control-plane §4.2 明确：control-plane 评估，state-memory 执行

4. **DR-023**（acceptance policy 执行主体）：
   - 在 state-memory §5 或 dream-quiet §4.2 明确 candidate → accepted 的唯一执行路径

5. **DR-032**（observability ↔ state-memory 循环依赖）：
   - 在 observability §3.3 定义 state-memory 不可用时的降级策略，打破循环

### 建议在 /blueprint 任务规划时注册（High）

DR-003 / DR-004 / DR-005 / DR-006 / DR-014 / DR-015 / DR-016 / DR-017 / DR-018 / DR-019 / DR-024 / DR-025 / DR-026 / DR-027 / DR-028 / DR-033 / DR-034 / DR-035 / DR-036 / DR-037

每条 High 发现建议在 05A_TASKS.md 中有对应 task，在 05B_VERIFICATION_PLAN 中有对应验证条目。

### 可在实现阶段跟踪（Medium）

DR-007 ~ DR-010 / DR-020 ~ DR-022 / DR-029 ~ DR-031 / DR-038 ~ DR-042

---

*本报告由父代理汇总 4 组子代理（A/B/C/D）的三维审查草案后统一写盘。子代理只产出发现草案，不写任何文件。最终严重度由父代理裁定。*
