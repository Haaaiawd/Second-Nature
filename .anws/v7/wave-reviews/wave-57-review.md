# Wave 57 Code Review — 2026-05-22

## 1. 总结结论

**Partial Pass**

Wave 57 实现了 T-CP.C.2（heartbeat 主循环 + HardGuardEvaluator + DownstreamIntentOrchestrator + DecisionTraceEmitter）和 T-CP.C.3（GoalLifecyclePolicy + IdleCuriosityPolicy）的核心代码与基础测试，全部 29 个现有测试通过，TypeScript 编译零错误。但存在以下阻碍 Partial Pass 的问题：

1. `src/core/second-nature/heartbeat/index.ts` barrel 文件未导出任何 v7 新增模块，公共 API 面断裂。
2. `CandidateIntent` / `CandidateEffectClass` / `IntentKind` 的实现类型与 `control-plane-system.md` §6.1 的设计契约存在字段名和枚举值不一致。
3. `GoalLifecyclePolicy` 头文档声称检测 `complete` 条件，但实现未覆盖。
4. 多个被源码头注释引用的测试文件（downstream-intent-orchestrator、decision-trace-emitter、run-heartbeat-cycle-v7）实际不存在。
5. `run-heartbeat-cycle-v7.ts` 中对 `signal.payload` 的盲 cast 和 `goal-lifecycle-policy.ts` 中对日期字符串的零校验构成静态安全隐患。

---

## 2. 审查范围与静态边界

| 类别 | 文件 | 行数 | 审查方式 |
|------|------|------|----------|
| 新实现 | `src/core/second-nature/orchestrator/hard-guard-evaluator.ts` | 169 | 全量 |
| 新实现 | `src/core/second-nature/orchestrator/downstream-intent-orchestrator.ts` | 92 | 全量 |
| 新实现 | `src/core/second-nature/heartbeat/decision-trace-emitter.ts` | 47 | 全量 |
| 新实现 | `src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.ts` | 227 | 全量 |
| 新实现 | `src/core/second-nature/heartbeat/goal-lifecycle-policy.ts` | 101 | 全量 |
| 新实现 | `src/core/second-nature/heartbeat/idle-curiosity-policy.ts` | 109 | 全量 |
| 测试 | `tests/unit/control-plane/hard-guard-evaluator.test.ts` | 127 | 全量 |
| 测试 | `tests/integration/control-plane/heartbeat-loop.test.ts` | 206 | 全量 |
| 测试 | `tests/unit/control-plane/goal-lifecycle-policy.test.ts` | 82 | 全量 |
| 测试 | `tests/unit/control-plane/idle-curiosity-policy.test.ts` | 77 | 全量 |
| 契约 | `.anws/v7/05A_TASKS.md` T-CP.C.2 / T-CP.C.3 | — | 相关章节 |
| 契约 | `.anws/v7/04_SYSTEM_DESIGN/control-plane-system.md` | 509 | §4.2, §5.1, §5.3, §6.1, §9, §10, §11 |
| 契约 | `.anws/v7/03_ADR/ADR_002_EMBODIED_AGENT_LOOP.md` | 58 | 全文 |
| 契约 | `.anws/v7/03_ADR/ADR_004_GOAL_LIFECYCLE_AND_IDLE_CURIOSITY.md` | 56 | 全文 |
| 既有接口 | `src/core/second-nature/types.ts` | 72 | 全文 |
| 既有接口 | `src/core/second-nature/heartbeat/signal.ts` | 53 | 全文 |
| 既有接口 | `src/shared/types/v7-entities.ts` | 287 | 相关类型 |
| 既有接口 | `src/core/second-nature/heartbeat/embodied-context-assembler.ts` | 227 | 接口与调用关系 |
| 既有代码 | `src/core/second-nature/heartbeat/index.ts` | 55 | 导出完整性 |
| 既有代码 | `src/core/second-nature/orchestrator/guard-layer.ts` | 125 | 命名冲突 |
| 既有代码 | `src/core/second-nature/heartbeat/scope-router.ts` | 69 | 调用关系 |

**静态边界声明**：本次审查为静态代码审查，未执行性能基准测试（P95 统计量未实测），未审查下游系统（connector、guidance-voice、state-memory 写入端）的实现细节。

---

## 3. 契约 → 代码映射摘要

| 契约点 | 来源 | 代码承接 | 状态 |
|--------|------|----------|------|
| `runHeartbeat` 返回 `HeartbeatDecision` | T-CP.C.2, control-plane §5.1 | `runHeartbeatV7` 返回 `HeartbeatDecision` | ✅ |
| Guard 结果最终 | T-CP.C.2, control-plane §4.2 | `evaluateHardGuards` 为纯函数，调用方直接消费 | ✅ |
| Trace 写 observability | T-CP.C.2, control-plane §5.1 | `safeEmitTrace` 包装 `emit` 并吞异常 | ✅ |
| `connector_circuit_open` → deferred | T-CP.C.2, control-plane §5.3 | `hard-guard-evaluator.ts:63-64` | ✅ |
| `missing_source_refs` → denied | T-CP.C.2, control-plane §5.3 | `hard-guard-evaluator.ts:42-48` | ✅ |
| GoalLifecycle 只发出 transition request | T-CP.C.3, DR-012 | `goal-lifecycle-policy.ts` 不调用任何 write port | ✅ |
| Idle curiosity 最多 1 个 read-only | T-CP.C.3, ADR-004 | `idle-curiosity-policy.ts` 取 eligible[0] | ✅ |
| `idle_policy_no_eligible_connector` | T-CP.C.3 | `idle-curiosity-policy.ts:89` | ✅ |
| Same kind+scope replace | T-CP.C.3, 05A_TASKS | `goal-lifecycle-policy.ts:70-78` | ✅ |
| Expired goal detection | T-CP.C.3, 05A_TASKS | `goal-lifecycle-policy.ts:83-91` | ✅ |
| `CandidateIntent.intentId` | control-plane §6.1 | 代码使用 `id` | ❌ 不一致 |
| `CandidateIntent.kind` 含 `idle_sensing` | control-plane §6.1 | `types.ts` 无 `idle_sensing` | ❌ 缺失 |
| `CandidateIntent.effectClass` 含 `quiet_run` / `dream_schedule` | control-plane §6.1 | 代码无此两项，新增 `external_platform_action` / `memory_curation` / `narrative_reflection` | ❌ 不一致 |
| `ContextSliceStatus[]` 在 `EmbodiedContext` | control-plane §6.1 | 代码 `EmbodiedContext` 无 `sliceStatuses` 数组 | ❌ 缺失 |
| `EmbodiedContext.contextId` | control-plane §6.1 | 代码 `EmbodiedContext` 无 `contextId` | ❌ 缺失 |
| `GoalLifecyclePolicy` 检测 complete | 05A_TASKS / 源码头 | 实现未检测 complete | ❌ 未兑现 |

---

## 4. Lens 结果摘要

| Lens | 结论 | 关键发现 |
|------|------|----------|
| **L1 契约忠实度** | ⚠️ Partial | 核心逻辑（guard、idle、lifecycle）与任务契约一致；但 `CandidateIntent` / `EmbodiedContext` 的数据模型与 SYSTEM_DESIGN §6.1 存在字段名和枚举值漂移；`GoalLifecyclePolicy` 头文档声明的 `complete` 检测未实现。 |
| **L2 任务兑现** | ⚠️ Partial | T-CP.C.2 的 4 条验收标准中，第 4 条（P95 < 2s benchmark）未在测试中以统计方式验证，仅做单次 2.1s 延迟降级测试；T-CP.C.3 的 3 条验收标准均通过单元测试承接。 |
| **L3 架构适配** | ⚠️ Partial | 依赖方向正确（新增模块单向依赖既有模块，无循环依赖）；模块职责边界清晰；但 `heartbeat/index.ts` barrel 文件遗漏全部 v7 导出，破坏公共 API 面。 |
| **L4 静态安全风险** | ⚠️ Partial | 无 PII/密钥硬编码；无明显的 secrets 泄露路径。但存在 `signal.payload` 盲 cast、日期字符串零校验导致的静默 NaN 失败、`Date.now()` 碰撞风险。 |
| **L5 验证证据** | ⚠️ Partial | 29/29 测试通过，基础覆盖完整；但缺少 `escalate`  verdict、`leaseRequired` / `requiresCheckpoint` 字段断言、多原因组合、日期 malformed、barrel 导出、以及 3 个被源码引用但缺失的测试文件。 |
| **L6 回流一致性** | ✅ Pass | `README.md` / `AGENTS.md` 的 v7 状态、Mind/Body 隐喻、Bootstrap Recovery 章节与当前实现一致；但 barrel 文件未同步。 |

---

## 5. Issues

### Critical

_无_

---

### High

#### H1 | barrel 文件遗漏全部 v7 导出，公共 API 面断裂

| 属性 | 内容 |
|------|------|
| **Severity** | High |
| **Lens** | L3 |
| **Title** | heartbeat/index.ts 未导出 Wave 57 新增模块 |
| **Evidence** | `src/core/second-nature/heartbeat/index.ts` 当前导出 5 个 v6 模块（signal、snapshot-builder、heartbeat-loop、runtime-snapshot、run-heartbeat-cycle、scope-router、heartbeat-executor），但完全缺失 `runHeartbeatV7`、`createDecisionTraceEmitter`、`createGoalLifecyclePolicy`、`createIdleCuriosityPolicy` 及 orchestrator 模块。 |
| **Impact** | 任何通过 barrel `heartbeat/index.ts` 消费 control-plane 的上层代码（plugin、CLI、runtime-ops）无法访问 v7 新增能力；测试目前通过直接相对路径绕过，掩盖了此问题。 |
| **Minimum fix** | 在 `heartbeat/index.ts` 追加 v7 符号的 `export * from './run-heartbeat-cycle-v7.js'` 等重导出；`orchestrator/` 模块应在 `orchestrator/index.ts` 或更高层 barrel 中导出。 |
| **Anchor** | `src/core/second-nature/heartbeat/index.ts:1-55` |

#### H2 | `CandidateIntent` 数据模型与 SYSTEM_DESIGN §6.1 不一致

| 属性 | 内容 |
|------|------|
| **Severity** | High |
| **Lens** | L1 |
| **Title** | CandidateIntent 字段名与 effectClass 枚举与设计契约漂移 |
| **Evidence** | SYSTEM_DESIGN §6.1 定义 `CandidateIntent.intentId`，代码 `types.ts:47` 使用 `id`；设计定义 `kind` 含 `"idle_sensing"`，代码 `types.ts:3` 缺失；设计定义 `effectClass` 含 `"quiet_run"` / `"dream_schedule"`，代码 `types.ts:37-44` 缺失此两项，代之以 `"external_platform_action"` / `"memory_curation"` / `"narrative_reflection"`。 |
| **Impact** | 跨系统接口契约不一致会导致：1) 下游系统按设计文档集成时类型不匹配；2) `idle_sensing` 意图在类型层面无法表达；3) 设计中的 `quiet_run` / `dream_schedule` 效果类在控制平面无对应建模。 |
| **Minimum fix** | 二选一：A) 更新 `types.ts` 以匹配设计（重命名 `id`→`intentId`，追加 `idle_sensing`，统一 effectClass）；B) 更新 `control-plane-system.md` §6.1 以反映实现，并在 ADR 中记录变更理由。 |
| **Anchor** | `src/core/second-nature/types.ts:1-72` vs `.anws/v7/04_SYSTEM_DESIGN/control-plane-system.md:295-305` |

#### H3 | `EmbodiedContext` 缺少设计契约中的 `contextId` 和 `sliceStatuses`

| 属性 | 内容 |
|------|------|
| **Severity** | High |
| **Lens** | L1 |
| **Title** | EmbodiedContext 结构未包含 contextId 与 sliceStatuses 数组 |
| **Evidence** | SYSTEM_DESIGN §6.1 的 `EmbodiedContext` 包含 `contextId: string` 和 `sliceStatuses: ContextSliceStatus[]`；代码 `v7-entities.ts:275-287` 的 `EmbodiedContext` 无此二字段。`run-heartbeat-cycle-v7.ts:135` 在循环内部自行构造 `contextId = \`ctx:${Date.now()}\``，但该 ID 未写入返回的 context 对象。 |
| **Impact** | Trace 与 observability 系统无法通过 context 自身获取其唯一标识；缺少 `sliceStatuses` 数组则无法统一遍历各切片状态，调用方需硬编码字段名检查每个 optional slice。 |
| **Minimum fix** | 在 `EmbodiedContext` 中追加 `contextId` 和 `sliceStatuses`；`EmbodiedContextAssembler` 在组装时填充。 |
| **Anchor** | `src/shared/types/v7-entities.ts:275-287` vs `.anws/v7/04_SYSTEM_DESIGN/control-plane-system.md:273-291` |

---

### Medium

#### M1 | GoalLifecyclePolicy 头文档声明检测 complete，实现缺失

| 属性 | 内容 |
|------|------|
| **Severity** | Medium |
| **Lens** | L1 / L2 |
| **Title** | GoalLifecyclePolicy 未实现 complete 条件检测 |
| **Evidence** | `goal-lifecycle-policy.ts:5` 注释："detects replace/expire/complete conditions"；`GoalTransitionRequest.newStatus` 类型包含 `"completed"`（line 26）；但 `evaluate()` 方法中仅处理了 `replaced`（line 74）和 `expired`（line 87），无任何逻辑检测 goal 是否达到 `completionCriteria`。 |
| **Impact** | 契约文档与实现不符；控制平面无法主动提议 goal 完成迁移，complete 语义只能由外部系统（如 state-memory）驱动，破坏了 ADR-004 中 goal 生命周期的闭环。 |
| **Minimum fix** | 在 `evaluate()` 中追加 completion criteria 评估逻辑（例如检查关联的 sourceRefs 或外部完成证据），或修正头文档移除 "complete" 声明，并在 ADR/TASKS 中记录该语义由其他系统承接。 |
| **Anchor** | `src/core/second-nature/heartbeat/goal-lifecycle-policy.ts:5, 26, 43-99` |

#### M2 | 源码引用的测试文件缺失

| 属性 | 内容 |
|------|------|
| **Severity** | Medium |
| **Lens** | L5 |
| **Title** | 3 个被源码 header 引用的测试文件不存在 |
| **Evidence** | `downstream-intent-orchestrator.ts:12` 引用 `tests/unit/control-plane/downstream-intent-orchestrator.test.ts`（不存在）；`decision-trace-emitter.ts:12` 引用 `tests/unit/control-plane/decision-trace-emitter.test.ts`（不存在）；`run-heartbeat-cycle-v7.ts:27` 引用 `tests/unit/control-plane/run-heartbeat-cycle-v7.test.ts`（不存在）。 |
| **Impact** | 源码文档与测试覆盖脱节；下游代码审查者会误以为这些模块已被单元测试覆盖，实际上只有集成测试（heartbeat-loop）间接触及了 `DownstreamIntentOrchestrator` 和 `DecisionTraceEmitter`，`runHeartbeatV7` 无独立单元测试。 |
| **Minimum fix** | 补全缺失的单元测试文件，或修正源码头注释中的测试路径为实际存在的文件。 |
| **Anchor** | `src/core/second-nature/orchestrator/downstream-intent-orchestrator.ts:12` `src/core/second-nature/heartbeat/decision-trace-emitter.ts:12` `src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.ts:27` |

#### M3 | `signal.payload` 盲 cast 缺乏输入校验

| 属性 | 内容 |
|------|------|
| **Severity** | Medium |
| **Lens** | L4 |
| **Title** | runHeartbeatV7 对 signal.payload 进行无校验的类型断言 |
| **Evidence** | `run-heartbeat-cycle-v7.ts:96`：`payload: signal.payload as Record<string, unknown>`。该值直接来自外部信号输入，但未经任何结构校验即断言为 Record。 |
| **Impact** | 若 payload 为 `null`、`undefined`、数组或基本类型，`routeScopedInput` 接收的 `payload` 字段类型与运行时值不符，可能导致后续 `routeScopedInput` 内部逻辑异常（如尝试访问属性时失败）。 |
| **Minimum fix** | 在 cast 前增加运行时校验：`typeof signal.payload === 'object' && signal.payload !== null && !Array.isArray(signal.payload)`，否则降级处理或返回携带 `payload_invalid` reason 的决策。 |
| **Anchor** | `src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.ts:96` |

#### M4 | 日期字符串零校验导致静默 NaN 失败

| 属性 | 内容 |
|------|------|
| **Severity** | Medium |
| **Lens** | L4 |
| **Title** | GoalLifecyclePolicy 对 expiresAt / updatedAt 的日期解析无校验 |
| **Evidence** | `goal-lifecycle-policy.ts:62-63`：`new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()`；line 84：`new Date(goal.expiresAt) < new Date(now)`。若传入 `""`、`"invalid"`、`undefined`，`new Date(...).getTime()` 返回 `NaN`，比较结果为 `false`。 |
| **Impact** | 恶意或损坏数据可导致：1) 过期 goal 被误判为未过期；2) 排序比较产生 NaN，在 V8 中导致排序不稳定，可能选错 active goal；3) 故障被完全静默吞没，无降级 reason。 |
| **Minimum fix** | 解析日期后检查 `isNaN(date.getTime())`，若无效则将该 goal 标记为 degraded 并输出 `goal_date_malformed:{field}` reason，避免进入 active 集合。 |
| **Anchor** | `src/core/second-nature/heartbeat/goal-lifecycle-policy.ts:62-63, 84` |

#### M5 | idle-curiosity-policy 对历史日期无校验

| 属性 | 内容 |
|------|------|
| **Severity** | Medium |
| **Lens** | L4 |
| **Title** | IdleCuriosityPolicy 的 cooldown 计算不校验 history.at 有效性 |
| **Evidence** | `idle-curiosity-policy.ts:79-81`：`now - new Date(lastIdle.at).getTime()`，若 `lastIdle.at` 无效则减法产生 `NaN`，`NaN < IDLE_COOLDOWN_MS` 为 `false`，结果视为已过冷却期。 |
| **Impact** | 损坏的 idle history 会导致平台被错误地认为已过冷却期，可能突破每小时一次的限制。 |
| **Minimum fix** | 在计算前校验 `!isNaN(lastDate.getTime())`，无效则忽略该 history 条目。 |
| **Anchor** | `src/core/second-nature/heartbeat/idle-curiosity-policy.ts:79-81` |

#### M6 | 集成测试命名与断言语义不一致

| 属性 | 内容 |
|------|------|
| **Severity** | Medium |
| **Lens** | L5 |
| **Title** | heartbeat-loop 集成测试 "denies when source refs missing" 实际断言 deferred |
| **Evidence** | `tests/integration/control-plane/heartbeat-loop.test.ts:146-170` 测试标题为 "denies when source refs missing"，但断言 `result.status === "deferred"`。虽然单个 guard 评估为 deny，但因无其他候选意图，循环 fallthrough 到最终 deferred。 |
| **Impact** | 测试名称误导维护者；若验收标准要求最终决策为 denied，则测试未正确承接。更关键的是，该路径未测试当存在其他允许候选时 deny 是否会导致正确跳过。 |
| **Minimum fix** | 重命名测试为 "defers when all candidates denied" 或补充一个真实 deny 路径：注入两个候选，第一个 denied，第二个 allowed，验证最终选中第二个。 |
| **Anchor** | `tests/integration/control-plane/heartbeat-loop.test.ts:146-170` |

#### M7 | `evaluateHardGuards` 与 v6 `guard-layer.ts` 同名函数签名冲突

| 属性 | 内容 |
|------|------|
| **Severity** | Medium |
| **Lens** | L3 |
| **Title** | evaluateHardGuards 命名冲突：v6 与 v7 并存期存在导入歧义 |
| **Evidence** | `src/core/second-nature/orchestrator/guard-layer.ts:42` 导出 `evaluateHardGuards(intent, runtime: HeartbeatRuntimeSnapshot)`；`src/core/second-nature/orchestrator/hard-guard-evaluator.ts:35` 导出同名 `evaluateHardGuards(intent, deps: HardGuardEvaluatorDeps)`。两者参数二类型不同。 |
| **Impact** | 渐进替换期若有模块同时导入二者，产生编译错误；IDE 自动导入可能选错版本；维护者需通过路径区分，增加认知负担。 |
| **Minimum fix** | 将 v7 函数重命名为 `evaluateHardGuardsV7` 或 `evaluateAffordanceAwareGuards`，并在 `heartbeat/index.ts` 中统一重导出；若意图是直接替换，应在 barrel 中显式废弃 v6 版本。 |
| **Anchor** | `src/core/second-nature/orchestrator/hard-guard-evaluator.ts:35` vs `src/core/second-nature/orchestrator/guard-layer.ts:42` |

#### M8 | 内联类型导入影响可读性与重构安全

| 属性 | 内容 |
|------|------|
| **Severity** | Medium |
| **Lens** | L3 |
| **Title** | run-heartbeat-cycle-v7.ts 使用内联 import 类型注解 |
| **Evidence** | `run-heartbeat-cycle-v7.ts:61` 和 `:73` 使用 `import("../../../shared/types/v7-entities.js").EmbodiedContext` 和 `import("../../../shared/types/v7-entities.js").HardGuardEvaluatorDeps` 作为内联类型。 |
| **Impact** | 可读性差；全局搜索 `import type { EmbodiedContext }` 时无法命中；重构文件路径时工具难以自动更新内联路径。 |
| **Minimum fix** | 提取为文件顶部的 `import type { EmbodiedContext } from "../../../shared/types/v7-entities.js"`。 |
| **Anchor** | `src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.ts:61, 73` |

---

### Low

#### L1 | 基于时间戳的 decisionId 存在高频碰撞风险

| 属性 | 内容 |
|------|------|
| **Severity** | Low |
| **Lens** | L4 |
| **Title** | decisionId 与 traceId 使用 Date.now() 存在碰撞与回拨风险 |
| **Evidence** | `run-heartbeat-cycle-v7.ts:103, 113, 123, 149, 184, 212` 均使用 `Date.now()` 构造 ID：`\`decision:carrier:${Date.now()}\``、`\`trace:${decision.decisionId}\`` 等。 |
| **Impact** | 系统时钟回拨或高并发（<1ms 内两次 heartbeat）时 ID 碰撞，导致 trace 去重失败或 observability 索引冲突。 |
| **Minimum fix** | 使用 `crypto.randomUUID()` 或自增 counter + timestamp 组合，确保唯一性。 |
| **Anchor** | `src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.ts:103, 113, 123, 149, 184, 212` |

#### L2 | `delivery_unavailable` 声明但未使用

| 属性 | 内容 |
|------|------|
| **Severity** | Low |
| **Lens** | L1 |
| **Title** | HeartbeatDecisionStatus 包含 delivery_unavailable 但 runHeartbeatV7 从未返回该状态 |
| **Evidence** | `run-heartbeat-cycle-v7.ts:41-47` 的 `HeartbeatDecisionStatus` 联合类型包含 `"delivery_unavailable"`；整个 `runHeartbeatV7` 函数无任何路径返回该值。 |
| **Impact** | 类型层面允许但实现层面缺失；下游系统若对该状态做 switch-case 将遇到死代码。 |
| **Minimum fix** | 在下游执行失败场景（如 connector 返回 unavailable 且重试耗尽）中返回该状态，或从类型中移除并在 design doc 中记录该状态由下游系统产生而非控制平面。 |
| **Anchor** | `src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.ts:41-47` |

#### L3 | `leaseRequired` / `requiresCheckpoint` / `quietSuppressed` 零断言

| 属性 | 内容 |
|------|------|
| **Severity** | Low |
| **Lens** | L5 |
| **Title** | GuardEvaluation 的 leaseRequired、requiresCheckpoint、quietSuppressed 在测试中从未断言 |
| **Evidence** | `hard-guard-evaluator.test.ts` 全部 11 个测试仅断言 `verdict` 和 `reasons`；无任何测试检查 `leaseRequired`、`requiresCheckpoint`、`quietSuppressed` 的值。 |
| **Impact** | 若这些字段在未来被错误修改，现有测试无法捕获回归。 |
| **Minimum fix** | 为 allow / defer / deny / escalate 各路径补全至少一个完整字段断言。 |
| **Anchor** | `tests/unit/control-plane/hard-guard-evaluator.test.ts:33-126` |

#### L4 | `escalate` verdict 路径无测试覆盖

| 属性 | 内容 |
|------|------|
| **Severity** | Low |
| **Lens** | L5 |
| **Title** | escalate verdict 在单元测试和集成测试中均未被触发 |
| **Evidence** | `hard-guard-evaluator.ts:160-161` 定义 escalate 条件：`reasons.includes("awaiting_user") && intent.kind === "outreach"`；但 `hard-guard-evaluator.test.ts` 和 `heartbeat-loop.test.ts` 中无任何测试设置 `awaitingUser: true` + `kind: "outreach"。 |
| **Impact** | escalate 路径若出现逻辑回归（如条件被意外放宽或收紧），测试无法发现。 |
| **Minimum fix** | 补充 escalate 路径单元测试，以及非 outreach kind 的 awaitingUser 路径（应 deny 而非 escalate）。 |
| **Anchor** | `src/core/second-nature/orchestrator/hard-guard-evaluator.ts:160-161` `tests/unit/control-plane/hard-guard-evaluator.test.ts` |

#### L5 | `paused` goal 被完全忽略

| 属性 | 内容 |
|------|------|
| **Severity** | Low |
| **Lens** | L1 |
| **Title** | GoalLifecyclePolicy 对 paused 状态 goal 无任何处理 |
| **Evidence** | `goal-lifecycle-policy.ts:51` 仅处理 `goal.status === "accepted"` 的 goal；`paused` 状态 goal 被跳过。`AgentGoalStatus` 包含 `"paused"`，且 05A_TASKS T-SMS.C.3 要求 paused 完整出边（paused → completed/expired/replaced/accepted）。 |
| **Impact** | paused goal 在生命周期评估中不可见，无法被重新激活或过期，可能导致僵尸 goal 积累。 |
| **Minimum fix** | 明确 paused goal 的评估策略：是作为非 active 忽略，还是检测其是否满足重新激活/过期条件？并更新代码与文档。 |
| **Anchor** | `src/core/second-nature/heartbeat/goal-lifecycle-policy.ts:51` |

---

## 6. 安全 / 测试覆盖补充

### 6.1 安全扫描

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 硬编码密钥 / token | ❌ 未发现 | 代码中无 credential、secret、API key 硬编码。 |
| PII 进入 trace / context | ❌ 未发现 | `DecisionTracePayload` 仅含 ID、reason code、scope、status，无个人身份信息或私信内容。 |
| 原始私信进入决策路径 | ❌ 未发现 | `CandidateIntent.sourceRefs` 使用 redacted excerptHash 和 URI，不含原始文本。 |
| 日志中暴露敏感结构 | ❌ 未发现 | `safeEmitTrace` 的错误被完全吞掉，不记录任何可能含敏感信息的 stack trace。 |
| 盲 cast 风险 | ⚠️ 发现 2 处 | `signal.payload as Record<string, unknown>`（M3）和 `Object.entries(affordanceMap)`（若传入 null 会 throw，但类型未显式排除）。 |
| 注入 / 路径遍历 | ❌ 未发现 | `decisionId`、`traceId` 使用模板字符串拼接，无外部输入直接拼接进文件系统路径或 shell 命令。 |
| 资源耗尽 / 无限循环 | ❌ 未发现 | 所有循环均为 bounded（candidates 数组、goals 数组、affordance items）。 |

### 6.2 测试覆盖矩阵

| 测试文件 | 测试数 | 通过 | 失败 | 覆盖度评估 |
|----------|--------|------|------|------------|
| `tests/unit/control-plane/hard-guard-evaluator.test.ts` | 11 | 11 | 0 | 基础 verdict + reasons 覆盖完整；缺失 escalate、leaseRequired、requiresCheckpoint、quietSuppressed、多原因组合 |
| `tests/integration/control-plane/heartbeat-loop.test.ts` | 7 | 7 | 0 | 覆盖了 carrier_only、user_task、user_reply、intent_selected、deferred（circuit open / missing refs）、degraded P95；缺失 delivery_unavailable、trace 失败、多候选跳过 |
| `tests/unit/control-plane/goal-lifecycle-policy.test.ts` | 5 | 5 | 0 | 覆盖了 replace、expire、ignore non-accepted、multi-group；缺失 complete、paused、malformed date、same updatedAt tie-break |
| `tests/unit/control-plane/idle-curiosity-policy.test.ts` | 6 | 6 | 0 | 覆盖了 select read-only、no eligible、painful、unavailable、cooldown、expired cooldown；缺失 needs_auth、mixed platform、empty map、malformed history date |
| **缺失（源码引用但无文件）** | — | — | — | downstream-intent-orchestrator.test.ts、decision-trace-emitter.test.ts、run-heartbeat-cycle-v7.test.ts |
| **合计现有** | **29** | **29** | **0** | — |

### 6.3 回归检查

- `npx tsc --noEmit`：✅ 零错误
- `node --test`（Wave 57 相关 4 个测试文件）：✅ 29/29 pass
- 全量 S2+S3 单元测试（前期 wave 数据）：135/135 pass（Wave 56 基线）

---

## 7. 建议的最低修复优先级

1. **P0（阻塞）**：补全 `heartbeat/index.ts` barrel 导出（H1）；修复 `CandidateIntent` / `EmbodiedContext` 与设计模型的不一致（H2、H3），或回流更新 design doc。
2. **P1（高优）**：补充缺失的单元测试文件（M2）；修复 `signal.payload` 盲 cast（M3）；修复日期零校验（M4、M5）；解决 `evaluateHardGuards` 命名冲突（M7）。
3. **P2（中优）**：修正 `goal-lifecycle-policy.ts` 头文档或实现 complete 检测（M1）；补充 `leaseRequired` / `escalate` / `quietSuppressed` 断言（L3、L4）；替换 `Date.now()` ID 为更安全生成方式（L1）。
4. **P3（低优）**：提取内联 import（M8）；处理 paused goal 策略（L5）；决定 `delivery_unavailable` 去留（L2）。
