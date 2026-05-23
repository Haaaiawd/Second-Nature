# Wave 62 Code Review — 2026-05-23

## 1. 总结结论

**结论: Partial Pass**

Wave 62 实现了 T-DQS.C.4（Quiet-completion 触发调度）、T-DQS.C.5（accepted projection 回流 heartbeat 验证）和 T-GVS.C.1（GuidanceDraftService 7 字段契约 + delivery 前 source 验证）的核心骨架，但存在 **1 处 Critical 契约断裂** 和 **4 处 High 缺陷**，导致无法直接标记为 Pass。

- **Critical**: `dream-scheduler.ts` 的 `SchedulerInput` 与 `scheduleDream` 未承接 `modelAssistPort`，使 DR-027 `RedactedEvidenceBundle` 品牌类型在调度层失效，v7 安全调用路径被阻断。
- **High**: `guidance-draft-service.ts` 的 `generateGuidanceDraft` 接受 DR-030 7 字段输入但只使用 4 个字段，`unsupported_scene_kind` 错误码不可达，draft 文本为机械拼接而非 inner-guide 风格；`dream-scheduler.ts` 的 fire-and-forget catch 块静默吞掉所有异常，无 trace 无日志。
- **Medium/Low**: 测试代码存在 SQL 注入风险、调度器 windowKey 写死、内存锁为模块级单例等工程债务。

建议修复 Critical 和 High 问题后复评，当前状态 **不可合并到 main**。

---

## 2. 审查范围与静态边界

### 审查文件清单

| 文件 | 行数 | 变更性质 |
|------|------|----------|
| `src/dream/types.ts` | 230 | 新增 `quiet_completion` trigger kind、`modelAssistPort`/`RedactedEvidenceBundle`（DR-027） |
| `src/dream/dream-scheduler.ts` | 211 | 新增 `QuietCompletionPolicy`、`shouldTrigger` 分支、`scheduleDream` fire-and-forget |
| `src/dream/index.ts` | 16 | 新增导出 `scheduleDream`、`shouldTrigger`、`memoryLockPort` 及关联类型 |
| `src/guidance/guidance-draft-service.ts` | 108 | 新增 `GuidanceDraftRequest`（7 字段）、`generateGuidanceDraft`、`validateDraftSources` |
| `src/guidance/index.ts` | 13 | 新增导出 `guidance-draft-service.ts` |
| `tests/unit/dream/dream-scheduler.test.ts` | 68 | `shouldTrigger` 单元测试（quiet_completion 窗内/窗外/环绕/边界） |
| `tests/integration/dream/quiet-dream-trigger.test.ts` | 86 | `scheduleDream` 集成测试（quiet_completion 调度、锁竞争） |
| `tests/integration/control-plane/dream-projection-heartbeat.test.ts` | 137 | `EmbodiedContextAssembler` 读取 accepted projection 集成测试 |
| `tests/unit/guidance/guidance-draft-service.test.ts` | 146 | `generateGuidanceDraft` 与 `validateDraftSources` 单元测试 |

### 静态边界声明
- 本次评审 **未执行** 任何测试、编译、lint 或 Docker 构建。
- 未审查 `src/dream/dream-engine.ts`、`src/storage/services/embodied-context-state-port.ts` 等未在变更列表中的下游实现。
- 锚定文档为 `.anws/v7` 下的任务清单、验证计划、系统设计 L0 及 ADR。

---

## 3. 契约 → 代码映射摘要

| 任务 | 锚定契约 | 代码承接文件 | 映射评估 |
|------|----------|--------------|----------|
| **T-DQS.C.4** | `QuietCompletionPolicy` + `shouldTrigger` 窗内触发；`scheduleDream` lock + skip reason；35min TTL | `src/dream/dream-scheduler.ts` | **Partial**。`shouldTrigger` 与 `QuietCompletionPolicy` 完全实现；`scheduleDream` lock/skip reason 实现；但 **缺失 `modelAssistPort` 透传**（Critical）。 |
| **T-DQS.C.4** | quiet_completion 为第四种 `DreamTriggerKind` | `src/dream/types.ts:25` | **Pass**。`"quiet_completion"` 已加入 union。 |
| **T-DQS.C.5** | accepted projection 被 `EmbodiedContextAssembler` 读取；candidate/archived 隔离；空态降级 reason | `tests/integration/control-plane/dream-projection-heartbeat.test.ts` | **Pass（测试层面）**。4 个测试场景覆盖 accepted 加载、candidate 排除、空态降级、状态过滤。 |
| **T-GVS.C.1** | `GuidanceDraftRequest` 7 字段（DR-030）；`generateGuidanceDraft` source-backed draft；`validateDraftSources` delivery 前重验证（DR-028）；返回 `draft_source_invalidated` | `src/guidance/guidance-draft-service.ts` | **Partial**。7 字段类型定义完整；`generateGuidanceDraft` 生成 draft 并绑定 sourceRefs；`validateDraftSources` 实现 source 可用性检查并返回正确错误码。但 **3 个字段被忽略**、`unsupported_scene_kind` 不可达、draft 文本非 inner-guide 风格（High）。 |
| **DR-027** | `ModelAssistPort` 只接受 `RedactedEvidenceBundle` 品牌类型；`DreamEngineInput` 同时保留 deprecated `modelPort` 与新 `modelAssistPort` | `src/dream/types.ts:170-195` | **Pass（类型定义）**。`RedactedEvidenceBundle` 品牌类型与 `ModelAssistPort` 接口定义正确。 |
| **DR-028** | delivery 前调用 `validateDraftSources`；若 source 被 redact/删除则 draft 标记 invalid | `src/guidance/guidance-draft-service.ts:97-108` | **Partial**。函数返回 `draft_source_invalidated`，但 **未提供"标记 draft 状态为 invalid"的接口或副作用**（Medium）。 |

---

## 4. Lens 结果摘要

| Lens | 评级 | 关键发现 |
|------|------|----------|
| **L1 Contract Fidelity** | Weak | `dream-scheduler.ts` 未将 `modelAssistPort` 纳入 `SchedulerInput`，DR-027 在调度入口断裂；`guidance-draft-service.ts` 声明 7 字段却只消费 4 个，契约 fidelity 不足。 |
| **L2 Task Fulfillment** | Partial | T-DQS.C.4 触发策略与锁机制已落地，但缺少 modelAssistPort 透传；T-DQS.C.5 测试已覆盖回流验证；T-GVS.C.1 核心逻辑存在但 draft 质量与字段利用率不达标。 |
| **L3 Architecture Fit** | Good | fire-and-forget 异步调度不阻塞 heartbeat，符合设计；端口化依赖注入（`evidencePort`、`validatorPort`）利于测试；accepted/candidate 分离由 state-memory 执行，职责边界正确。 |
| **L4 Runtime Risk** | Elevated | `scheduleDream` catch 块静默吞异常，无 trace 无日志，故障不可观测；`generateGuidanceDraft` 不校验 `sceneKind` 运行时有效性；`memoryLocks` 为模块级单例，存在跨 workspace 污染风险。 |
| **L5 Verification Evidence** | Adequate | 单元测试覆盖 `shouldTrigger` 边界；集成测试覆盖锁竞争与 heartbeat 回流；`guidance-draft-service` 单元测试覆盖生成、缺失 pack、空 sourceRefs、source 重验证。但缺少 `modelAssistPort` 集成路径测试。 |
| **L6 Backflow & Handoff** | Partial | `src/dream/index.ts` 与 `src/guidance/index.ts` 正确导出新增公共 API；`validateDraftSources` 返回错误码但未提供 draft 状态置 invalid 的接口，与 runtime-ops 的 handoff 语义不完整。 |

---

## 5. Issues

### Critical

**CRIT-001 | L1 Contract Fidelity | SchedulerInput 与 scheduleDream 未承接 modelAssistPort，阻断 DR-027 RedactedEvidenceBundle 安全路径**
- **Evidence**: `src/dream/dream-scheduler.ts:31` `SchedulerInput` 仅有 `modelPort?: DreamModelPort`，无 `modelAssistPort`；`src/dream/dream-scheduler.ts:108-117` `runDream(...)` 调用仅传递 `modelPort`。
- **Impact**: 调用方无法通过调度器使用 v7 `ModelAssistPort`；未经 redaction 的 bundle 可能经 `modelPort` 传入，品牌类型保护失效。
- **Minimum fix**: 在 `SchedulerInput` 增加 `modelAssistPort?: ModelAssistPort`；在 `scheduleDream` 中透传给 `runDream`；废弃 `modelPort` 透传路径。
- **Anchor**: DR-027; `dream-quiet-system.md §9.2`

### High

**HIGH-001 | L1 Contract Fidelity | generateGuidanceDraft 忽略 DR-030 7 字段契约中的 3 个字段**
- **Evidence**: `src/guidance/guidance-draft-service.ts:20-28` 定义 `relationshipContextRef`、`channelHint`、`ownerPreferenceRef`；`src/guidance/guidance-draft-service.ts:72-95` 实现仅使用 `requestId`、`sceneKind`、`evidencePackRef`。
- **Impact**: relationship-aware phrasing、channel 适配、owner 偏好均未生效，draft 质量降级。
- **Minimum fix**: 在 `generateGuidanceDraft` 中消费 `relationshipContextRef`（加载 RelationshipContext 影响措辞）、`channelHint`（影响 deliveryWording 或格式）、`ownerPreferenceRef`（影响语气）；若暂不支持，应在实现中显式抛出 `not_implemented` 或 todo 注释，而非静默忽略。
- **Anchor**: T-GVS.C.1; `guidance-voice-system.md §5.2` DR-030

**HIGH-002 | L1 Contract Fidelity | unsupported_scene_kind 错误码在 generateGuidanceDraft 中不可达**
- **Evidence**: `src/guidance/guidance-draft-service.ts:40` `DraftServiceError` union 含 `"unsupported_scene_kind"`；`src/guidance/guidance-draft-service.ts:69-95` 无 sceneKind 运行时校验逻辑，TypeScript 编译时类型窄化后不会触发，但运行时 JSON/JS 传入非法值将穿透。
- **Impact**: 非法 sceneKind 不会返回约定错误码，可能产生不可预期的 draft 文本或下游失败。
- **Minimum fix**: 在 `generateGuidanceDraft` 入口增加运行时校验：`if (!["outreach","follow_up","reconnect"].includes(request.sceneKind)) return { error: "unsupported_scene_kind" }`。
- **Anchor**: T-GVS.C.1; `guidance-voice-system.md §5.1`

**HIGH-003 | L4 Runtime Risk | scheduleDream fire-and-forget catch 块静默吞掉所有异常，无 trace 无日志**
- **Evidence**: `src/dream/dream-scheduler.ts:122-125` `.catch(async () => { await lock.releaseLock(...) })` 无任何错误记录、trace 写入或 stderr 输出。
- **Impact**: `runDream` 异常（模型失败、statePort 异常、内存不足等）完全不可观测，运维时无法区分"成功"与"静默失败"。
- **Minimum fix**: catch 块至少调用 `tracePort?.recordDreamTrace(...)` 记录 `fallbackReason: "unexpected_scheduler_error"` 与异常摘要；或写入 `console.error`。
- **Anchor**: `dream-quiet-system.md §12.2` "DreamTrace 记录 timing、cost、fallback reason"; T-DQS.C.4 "生成 trace 或 explicit skip reason"

**HIGH-004 | L2 Task Fulfillment | Draft 文本为机械拼接，未实现 inner-guide 风格**
- **Evidence**: `src/guidance/guidance-draft-service.ts:83-85` `const text = \`Draft for ${request.sceneKind} (${request.requestId}): ${pack.claims.map(...).join("; ")}\`` 为纯模板字符串拼接，无情感锚点、无具名 entity、无 relationship-aware 调整。
- **Impact**: T-GVS.C.1 明确要求"inner guide 语言风格（自然、感性、source-backed）"，当前实现仅为占位符级别，不满足任务验收标准。
- **Minimum fix**: 引入 inner-guide 文本模板或至少为每个 sceneKind 提供区分化的自然语言模板（如 outreach/follow_up/reconnect 不同开场），并注入 claims 作为具体锚点。若规则优先实现尚不完整，应在代码中标注 `TODO(DR-031)`。
- **Anchor**: T-GVS.C.1; `guidance-voice-system.md §2.1 G3`; `dream-quiet-system.md §11.3` DR-031

### Medium

**MED-001 | L4 Runtime Risk | SQL 注入风险于测试辅助函数 insertDreamOutput**
- **Evidence**: `tests/integration/control-plane/dream-projection-heartbeat.test.ts:64-68` `db.sqlite.exec(\`INSERT ... VALUES ('${outputId}', '${runId}', ... )\`)` 直接字符串插值，未参数化。
- **Impact**: 测试 fixture 若含单引号等特殊字符将导致 SQL 语法错误或行为异常；虽为测试代码，但属于不良示范。
- **Minimum fix**: 使用 `db.sqlite.prepare()` + `.run()` 参数化绑定，或确保插值前对字符串做 escape。
- **Anchor**: 通用工程规范

**MED-002 | L3 Architecture Fit | scheduleDream windowKey 硬编码为 "dream_lock:default"**
- **Evidence**: `src/dream/dream-scheduler.ts:86` `const windowKey = "dream_lock:default"`。
- **Impact**: 多 workspace / 多 agent 场景下所有实例共享同一把锁，串行化全局调度，违背设计文档 "Multi-agent Dream" 扩展方向。
- **Minimum fix**: 允许 `SchedulerInput` 传入 `windowKey?: string`，默认 `"dream_lock:default"`，为 future multi-agent 预留。
- **Anchor**: `dream-quiet-system.md §13.1` "当前设计单 agent 单 Dream；多 agent 场景需要 per-agent lock key"

**MED-003 | L4 Runtime Risk | memoryLocks 为模块级 Map 单例，缺乏命名空间隔离**
- **Evidence**: `src/dream/dream-scheduler.ts:56` `const memoryLocks = new Map<...>()` 为模块顶级变量；`memoryLockPort()` 返回的 port 共享该 Map。
- **Impact**: 测试并行运行或同一进程多 workspace 时，锁状态会交叉污染。
- **Minimum fix**: `memoryLockPort()` 改为工厂模式返回独立 Map 实例，或支持命名空间前缀。
- **Anchor**: `dream-quiet-system.md §12.3` "In-memory lock fallback 在无 lockPort 时使用"

**MED-004 | L6 Backflow & Handoff | validateDraftSources 仅返回错误码，未提供 draft 状态置 invalid 的接口**
- **Evidence**: `src/guidance/guidance-draft-service.ts:97-108` 返回 `{ valid: false, reason: "draft_source_invalidated" }`，无状态修改能力。
- **Impact**: 设计文档要求"draft 状态标记为 invalid"，当前仅返回结果，调用方（runtime-ops）需自行实现状态翻转，handoff 不完整。
- **Minimum fix**: 新增 `async invalidateDraft(draftId: string, reason: DraftServiceError): Promise<void>` 端口或返回包含 `invalidated: true` 与 `draftId` 的结构，供下游消费。
- **Anchor**: DR-028; `guidance-voice-system.md §5.1` "draft 状态标记为 invalid"

**MED-005 | L4 Runtime Risk | validateDraftSources 使用顺序 await 循环校验 source**
- **Evidence**: `src/guidance/guidance-draft-service.ts:101-106` `for (const ref of draft.sourceRefs) { const available = await deps.validatorPort.checkSourceAvailable(ref); ... }`。
- **Impact**: sourceRefs 数量多时（设计上限 20 条）延迟为线性累加，不符合 P95 < 100ms 的 source validation 性能目标。
- **Minimum fix**: 改用 `Promise.all` 并行校验，或至少限制并发数（如 `pLimit(5)`）。
- **Anchor**: `guidance-voice-system.md §10.1` "Source Validation P95 < 100ms"

### Low

**LOW-001 | L5 Verification Evidence | scheduleDream 接受 budgetPort 但未在调度层做预算预检**
- **Evidence**: `src/dream/dream-scheduler.ts:33` `budgetPort?: DreamBudgetPort` 被透传给 `runDream`，调度前无 `checkBudget` 调用。
- **Impact**: 设计文档 sequence diagram 显示 "acquireLock + checkBudget"，当前实现将预算检查推迟到引擎内，可能导致锁已占用才发现预算不足。
- **Minimum fix**: 若需保持现状，添加注释说明预算检查由 `runDream` 负责；若需符合设计，在 `acquireLock` 成功后增加 `budgetPort?.checkBudget` 预检。
- **Anchor**: `dream-quiet-system.md §4.3` sequence diagram

**LOW-002 | L5 Verification Evidence | 缺少 modelAssistPort 透传路径的测试覆盖**
- **Evidence**: 全部 8 个变更文件及测试中，无任何测试验证 `SchedulerInput` 传入 `modelAssistPort` 或 `runDream` 接收 `modelAssistPort` 后的行为。
- **Impact**: CRIT-001 的修复缺乏回归保护。
- **Minimum fix**: 在 `tests/integration/dream/quiet-dream-trigger.test.ts` 或新增 `tests/unit/dream/dream-scheduler.test.ts` 中增加 `modelAssistPort` 透传断言。
- **Anchor**: T-DQS.C.4; DR-027

---

## 6. 安全 / 测试覆盖补充

### 安全静态检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| credential/token 硬编码 | 未检出 | 变更文件无硬编码密钥 |
| SQL 注入（生产代码） | 未检出 | 生产代码无字符串拼接 SQL |
| SQL 注入（测试代码） | **存在** | `tests/integration/control-plane/dream-projection-heartbeat.test.ts:64-68` `insertDreamOutput` 直接插值 |
| raw private message 泄漏 | 未检出 | 变更文件不处理 raw message |
| RedactionGate 绕过风险 | **存在** | CRIT-001 导致 `modelAssistPort` 无法经调度器使用，可能迫使调用方回退到无品牌保护的 `modelPort` |
| PII/credential 进入 DraftMessage | 未检出 | `generateGuidanceDraft` 仅拼接 claim.text，未做额外 redaction，但 claim.text 假设已在前置环节 redact |

### 测试覆盖矩阵

| 任务 | 测试文件 | 覆盖场景 | 缺口 |
|------|----------|----------|------|
| T-DQS.C.4 | `tests/unit/dream/dream-scheduler.test.ts` | quiet_completion 窗内触发、窗外跳过、环绕窗口、边界小时 | 未测试 `scheduleDream` 直接调用 `shouldTrigger` 之外的分支（如 cron、evidence_threshold） |
| T-DQS.C.4 | `tests/integration/dream/quiet-dream-trigger.test.ts` | quiet_completion 异步启动、锁竞争 skip:lock_held、非 quiet 锁竞争 legacy reason | 未测试 budgetPort 拒绝场景；未测试 `modelAssistPort` 透传（因接口缺失） |
| T-DQS.C.5 | `tests/integration/control-plane/dream-projection-heartbeat.test.ts` | accepted 加载、candidate 排除、空态降级、状态过滤 | 未测试 `partial` 状态排除；未测试 archived 状态排除（代码中测了但非显式断言） |
| T-GVS.C.1 | `tests/unit/guidance/guidance-draft-service.test.ts` | 正常生成、缺失 pack、空 sourceRefs、source 全可用、单 source 被 redact、全 source 删除 | 未测试 `unsupported_scene_kind`（因代码不可达）；未测试 `relationshipContextRef`/`channelHint`/`ownerPreferenceRef` 影响（因代码未实现） |

### 测试质量评价
- **单元测试**: `shouldTrigger` 与 `guidance-draft-service` 的边界覆盖充分，断言明确。
- **集成测试**: heartbeat 回流测试自建表结构，虽能验证 assembler 行为，但绕过真实 `DiaryDreamStore` 生命周期，对 T-DQS.C.5 的验证属于"assembler 集成"而非"端到端生命周期集成"。
- **缺失测试**: `modelAssistPort` 调用链、预算门拒绝、运行时异常 trace 记录、`sceneKind` 运行时非法值。

---

*评审完成时间: 2026-05-23*
*评审人: Code Reviewer (subagent)*
*方法: 纯静态分析，未执行编译/测试/运行时验证*
