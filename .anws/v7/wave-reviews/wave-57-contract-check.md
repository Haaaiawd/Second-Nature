# Wave 57 接口契约兼容性检查报告

> **检查范围**: 6 个新增模块 + 5 个既有接口文件 + 3 个既有实现文件
> **检查项**: 公共接口变更 / 类型一致性 / 导出完整性 / 路径兼容性 / 向后兼容 / 运行时绑定
> **检查日期**: 2026-05-22
> **检查者**: 子智能体 (Cognition Devin subagent)

---

## 1. 公共接口变更

### 1.1 既有公共接口是否被修改？
**状态：✅ PASS**

**证据：**
- `src/core/second-nature/types.ts` (72 lines) — 未被修改。`CandidateIntent`, `GuardEvaluation`, `GuardVerdict`, `CandidateEffectClass` 等类型保持原样。
- `src/core/second-nature/heartbeat/signal.ts` (53 lines) — 未被修改。`HeartbeatSignal`, `RuntimeScope`, `ScopedRuntimeInput`, `HeartbeatCycleResult`, `ScopeRouteResult` 等类型保持原样。
- `src/core/second-nature/heartbeat/heartbeat-loop.ts` (490 lines) — 未被修改。`ingestRhythmSignal`, `resolveAllowedIntentResult`, `HeartbeatDeps` 等导出保持原样。
- `src/core/second-nature/heartbeat/index.ts` (55 lines) — 未被修改（但存在遗漏，详见第 3 项）。
- `src/core/second-nature/orchestrator/guard-layer.ts` (125 lines) — 未被修改。`evaluateHardGuards` 签名保持 `(intent, runtime) => GuardEvaluation`。

### 1.2 命名冲突风险
**状态：⚠️ WARNING**

**证据：**
- `guard-layer.ts` 导出 `evaluateHardGuards(intent, runtime)` (line 42)
- `hard-guard-evaluator.ts` 导出同名函数 `evaluateHardGuards(intent, deps)` (line 35)
- 两者签名不同（参数 2 类型不同：`HeartbeatRuntimeSnapshot` vs `HardGuardEvaluatorDeps`）
- 目前没有既有代码同时从两个模块导入该函数，因此**当前无编译错误**
- 但未来若有迁移代码需要同时引用两个 guard 实现（例如渐进式替换期），必然出现命名冲突

**建议：**
- 在 `hard-guard-evaluator.ts` 中考虑将函数重命名为 `evaluateHardGuardsV7` 或 `evaluateAffordanceAwareGuards`，消除隐式冲突
- 或者在 barrel `heartbeat/index.ts` 中通过命名重导出区分两者
- 若设计意图是最终替换而非并存，应在 ADR 或任务文档中明确迁移时间表和 `guard-layer.ts` 的废弃计划

---

## 2. 类型一致性

### 2.1 新增代码使用的类型与既有类型系统匹配度
**状态：✅ PASS**

**证据：**

| 新增模块 | 引用的既有类型 | 来源文件 | 匹配结果 |
|---------|--------------|---------|---------|
| `hard-guard-evaluator.ts` | `CandidateIntent`, `GuardEvaluation` | `../types.js` | ✅ 完全一致 |
| `hard-guard-evaluator.ts` | `AffordanceMap`, `AffordanceItem` | `../../../shared/types/v7-entities.js` | ✅ 完全一致 |
| `downstream-intent-orchestrator.ts` | `CandidateIntent` | `../types.js` | ✅ 完全一致 |
| `run-heartbeat-cycle-v7.ts` | `HeartbeatSignal`, `RuntimeScope` | `./signal.js` | ✅ 完全一致 |
| `run-heartbeat-cycle-v7.ts` | `CandidateIntent`, `GuardEvaluation` | `../types.js` | ✅ 完全一致 |
| `run-heartbeat-cycle-v7.ts` | `EmbodiedContextAssembler` | `./embodied-context-assembler.js` | ✅ 接口匹配 (`assembleEmbodiedContext(): Promise<EmbodiedContext>`) |
| `goal-lifecycle-policy.ts` | `AgentGoal` | `../../../shared/types/goal.js` | ✅ 完全一致 |
| `idle-curiosity-policy.ts` | `AffordanceMap`, `AffordanceItem` | `../../../shared/types/v7-entities.js` | ✅ 完全一致 |

### 2.2 `GuardEvaluation` 语义一致性
**状态：⚠️ NOTE**

**证据：**
- `hard-guard-evaluator.ts` (line 141-148) 的 `deferOnlyReasons` 判定集为：
  `duplicate_intent`, `outreach_cooldown`, `connector_circuit_open`, `quiet_window_suppression`, `affordance_unavailable`
- `guard-layer.ts` (line 88-97) 的 `defer` 判定集仅为：
  `duplicate_intent`, `outreach_cooldown`
- `hard-guard-evaluator.ts` 将 `connector_circuit_open`, `affordance_unavailable`, `quiet_window_suppression` 也归类为 `defer`，而 `guard-layer.ts` 中的 `quiet_window_suppression` 会导致 `deny`

**建议：**
- 两个模块的 `defer` 语义存在差异，这是 v7 的设计扩展（affordance-aware + quiet -> defer），但应在文档中显式记录
- 若未来废弃 `guard-layer.ts`，需确认所有调用方已迁移到新的 defer 语义

### 2.3 内联类型导入可读性
**状态：⚠️ MINOR**

**证据：**
- `run-heartbeat-cycle-v7.ts` line 61 和 line 73 使用了 `import("../../../shared/types/v7-entities.js").EmbodiedContext` 作为内联类型注解
- 虽然 TypeScript 支持此语法，但可读性较差，且容易在重构路径时被遗漏

**建议：**
- 将内联 import 提取为文件顶部的 `import type { EmbodiedContext } from "..."`，提升可维护性

---

## 3. 导出完整性

### 3.1 `heartbeat/index.ts` barrel 文件
**状态：❌ FAIL**

**证据：**
- `src/core/second-nature/heartbeat/index.ts` (55 lines) 当前导出内容：
  - `signal.js` 类型
  - `snapshot-builder.js`
  - `heartbeat-loop.js`
  - `runtime-snapshot.js`
  - `planner-rhythm-window.js`
  - `run-heartbeat-cycle.js` (v6)
  - `scope-router.js`
  - `heartbeat-executor.js`
- **缺失的 v7 导出**（没有任何一个被加入 barrel）：
  - `runHeartbeatV7` (from `./run-heartbeat-cycle-v7.js`)
  - `evaluateHardGuards` (from `../orchestrator/hard-guard-evaluator.js`) — 注意路径是 `orchestrator/` 不在 `heartbeat/` 下
  - `createDownstreamIntentOrchestrator` (from `../orchestrator/downstream-intent-orchestrator.js`)
  - `createDecisionTraceEmitter`, `createNoOpTraceEmitter` (from `./decision-trace-emitter.js`)
  - `createGoalLifecyclePolicy` (from `./goal-lifecycle-policy.js`)
  - `createIdleCuriosityPolicy` (from `./idle-curiosity-policy.js`)
  - 以及各模块的接口类型（`HeartbeatDecision`, `CandidateIntentPlanner`, `HardGuardEvaluatorDeps`, `DownstreamRequest`, `DecisionTracePayload`, 等）

**影响：**
- 通过 `heartbeat/index.ts` barrel 路径消费 control-plane 的代码（例如 plugin 层或上层编排器）无法访问任何 Wave 57 新模块
- 测试文件目前通过直接路径 `../../../src/core/second-nature/heartbeat/run-heartbeat-cycle-v7.js` 绕过 barrel，掩盖了此问题

**建议：**
- **高优先级**：更新 `heartbeat/index.ts`，追加 v7 模块的导出
- `orchestrator/` 下的模块是否也应在 `heartbeat/index.ts` 中重导出，取决于项目 barrel 约定。若 `heartbeat/index.ts` 仅限 `heartbeat/` 目录，则 `orchestrator/` 模块应在 `orchestrator/index.ts` 或更高层 barrel 中导出

---

## 4. 路径兼容性与循环依赖

### 4.1 Import 路径正确性
**状态：✅ PASS**

**证据：**
- 所有新增模块均使用 `.js` 扩展名 import，与项目 ESM 约定一致
- 相对路径层级计算正确（`../types.js`, `../../../shared/types/v7-entities.js`, `./signal.js` 等）
- 无 `../../..` 以上的越界路径

### 4.2 循环依赖检测
**状态：✅ PASS**

**证据：**

| 方向 | 依赖关系 | 反向？ |
|-----|---------|-------|
| `run-heartbeat-cycle-v7.ts` -> `scope-router.js` | 导入 `routeScopedInput` | 无反向 |
| `run-heartbeat-cycle-v7.ts` -> `embodied-context-assembler.js` | 导入 `EmbodiedContextAssembler` 类型 | 无反向 |
| `run-heartbeat-cycle-v7.ts` -> `hard-guard-evaluator.ts` | 导入 `HardGuardEvaluatorDeps` 类型 | 无反向 |
| `run-heartbeat-cycle-v7.ts` -> `downstream-intent-orchestrator.ts` | 导入 `DownstreamIntentOrchestrator` 类型 | 无反向 |
| `run-heartbeat-cycle-v7.ts` -> `decision-trace-emitter.ts` | 导入 `DecisionTraceEmitter` 类型 | 无反向 |
| `hard-guard-evaluator.ts` -> `v7-entities.js` | 导入 `AffordanceMap` | 无反向 |
| `goal-lifecycle-policy.ts` -> `goal.js` | 导入 `AgentGoal` | 无反向 |
| `idle-curiosity-policy.ts` -> `v7-entities.js` | 导入 `AffordanceMap`, `AffordanceItem` | 无反向 |

- 新增模块形成**单向依赖图**：新增模块依赖既有模块，既有模块完全不感知新增模块
- 无循环依赖风险

---

## 5. 向后兼容性

### 5.1 v6 代码路径可用性
**状态：✅ PASS**

**证据：**
- `run-heartbeat-cycle.ts` — 完整保留，导出 `runHeartbeatCycle` (line 25) 和 `RunHeartbeatCycleInput`
- `heartbeat-loop.ts` — 完整保留，导出 `ingestRhythmSignal` (line 317)，继续调用 `guard-layer.ts` 的 `evaluateHardGuards`
- `guard-layer.ts` — 完整保留，`evaluateHardGuards` (line 42) 和 `evaluateGuards` (line 111) 均可用
- `heartbeat/index.ts` — 继续导出 v6 的所有符号
- `scope-router.ts` — 完整保留，继续被 `run-heartbeat-cycle.ts` 和 `run-heartbeat-cycle-v7.ts` 同时使用

### 5.2 数据契约兼容性
**状态：✅ PASS**

**证据：**
- `HeartbeatSignal` 结构在 v6 和 v7 中完全一致，`runHeartbeatV7` 无需修改 signal 格式即可接收 v6 的信号
- `CandidateIntent` 类型未变，v6 planner 产出的候选意图可直接被 v7 的 guard 评估
- `GuardEvaluation` 返回结构未变，verdict/reasons/quietSuppressed/leaseRequired/requiresCheckpoint 字段完全一致
- `ScopeRouteResult` 未变

### 5.3 `guard-layer.ts` 与 `hard-guard-evaluator.ts` 的并存策略
**状态：⚠️ NOTE**

**证据：**
- 两个模块同时存在，功能重叠但不相同
- `hard-guard-evaluator.ts` 是 v7 的 affordance-aware 实现，`guard-layer.ts` 是 v6 的 legacy 实现
- 当前没有任何既有代码调用 `hard-guard-evaluator.ts`（仅在测试和 `run-heartbeat-cycle-v7.ts` 的注入接口中出现）
- 若 `guard-layer.ts` 进入废弃路径，需逐步迁移 `heartbeat-loop.ts` 中的 `evaluateHardGuards` 调用

**建议：**
- 在 `guard-layer.ts` 文件头添加 `@deprecated` 标记，注明迁移目标为 `hard-guard-evaluator.ts`
- 或在 `05A_TASKS.md` 中创建后续任务，将 `heartbeat-loop.ts` 的 guard 调用迁移到 v7 实现

---

## 6. 运行时绑定

### 6.1 新增模块是否被既有启动路径加载？
**状态：❌ FAIL**

**证据：**
- 全局 grep 搜索（`src/` 目录）结果显示：
  - **没有任何既有代码** import 任何 Wave 57 新增模块
  - `heartbeat-loop.ts` 继续使用 v6 的 `evaluateHardGuards` from `guard-layer.ts`
  - `run-heartbeat-cycle.ts` 继续使用 v6 的 `ingestRhythmSignal`
  - `heartbeat-executor.ts` 继续使用 v6 的 `executeHeartbeatCycle`
- `plugin/index.ts` 和 plugin runtime 入口中无 v7 引用
- `heartbeat/index.ts` barrel 未导出新模块，因此任何通过 barrel 消费的代码都无法访问 v7

### 6.2 编译产物存在不等于被调用
**状态：⚠️ NOTE**

**证据：**
- `plugin/runtime/core/second-nature/heartbeat/run-heartbeat-cycle-v7.js` 和 `.d.ts` 存在，说明 TypeScript 编译成功
- 但编译产物只是静态文件，没有运行时代码加载并执行 `runHeartbeatV7`

**建议：**
- **高优先级**：在 `heartbeat/index.ts` 中导出新模块后，还需要在启动路径（plugin bridge / CLI 入口 / 上层编排器）中显式选择使用 `runHeartbeatV7` 还是 `runHeartbeatCycle`
- 若当前阶段是"代码先合入、接线留后一步"，应在 `05A_TASKS.md` 中创建明确的接线任务，标注依赖方和调用点

---

## 7. 总体评估

| 检查项 | 状态 | 严重度 |
|-------|------|-------|
| 公共接口变更 | ✅ 既有接口未被修改 | — |
| 命名冲突风险 | ⚠️ 同名异签函数并存 | Medium |
| 类型一致性 | ✅ 类型系统完全匹配 | — |
| GuardEvaluation 语义差异 | ⚠️ defer 判定集扩展 | Low |
| 内联类型导入可读性 | ⚠️ 可读性差 | Low |
| 导出完整性 | ❌ barrel 未导出新模块 | **High** |
| 路径兼容性 | ✅ 路径正确 | — |
| 循环依赖 | ✅ 无循环依赖 | — |
| 向后兼容性 | ✅ v6 路径完整保留 | — |
| 运行时绑定 | ❌ 新模块未被加载 | **High** |

### 关键问题汇总

1. **❌ barrel 缺失 (High)**：`heartbeat/index.ts` 没有导出新模块，导致任何通过 barrel 路径消费的代码无法访问 Wave 57 产出。这是 Wave 57 完成度的一个明显缺口。

2. **❌ 运行时未接线 (High)**：新增模块虽然存在且编译通过，但没有任何运行时代码加载它们。`runHeartbeatV7` 目前是"死代码"（从既有系统视角）。需要在启动路径中显式接线。

3. **⚠️ 命名冲突 (Medium)**：`guard-layer.ts` 和 `hard-guard-evaluator.ts` 导出同名函数 `evaluateHardGuards`，签名不同。当前无编译错误，但给未来的渐进式迁移埋下隐式冲突。

4. **⚠️ 语义差异 (Low)**：新 guard 将 `quiet_window_suppression` 从 `deny` 改为 `defer`，并新增了 `connector_circuit_open` 和 `affordance_unavailable` 的 `defer` 路径。这是设计意图，但需要文档化。

### 建议的后续行动

1. **立即**：更新 `heartbeat/index.ts`，追加 v7 模块的导出（或创建新的 barrel 文件）。
2. **立即**：在 `orchestrator/index.ts`（若不存在则创建）中导出 `hard-guard-evaluator.ts` 和 `downstream-intent-orchestrator.ts` 的公共符号。
3. **本 Wave 或下一 Wave**：在启动路径（plugin / CLI / bridge）中选择使用 `runHeartbeatV7` 或 `runHeartbeatCycle`，或提供基于 feature flag 的切换机制。
4. **后续任务**：决定是否废弃 `guard-layer.ts`，若废弃则标注 `@deprecated` 并创建迁移任务。
5. **可选**：将 `run-heartbeat-cycle-v7.ts` 中的内联类型导入提取为顶部 import type。
