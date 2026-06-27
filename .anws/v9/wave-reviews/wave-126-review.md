# Wave 126 Code Review — 2026-06-27

## 1. 总结结论

**最终 verdict: Partial Pass**

Wave 126 实现了 T2.2.1 的核心骨架：`EmbodiedContext` 并行装配了 `SelfContinuityCard`、`CharacterFramePointer`、独立 `EmbodiedContextCharacterProjection`、activity threads、routine list 与 affordance slices，并补充了 `ContextSerializer` 与单元/集成测试。然而，`ContextSerializer` 的 Agent-boundary forbidden-pattern 覆盖不完整，且未按设计将命中降级为 degraded slice / validation error；同时存在常量漂移、CharacterFrame 重复加载、测试覆盖缺口等问题。修复前不建议进入需要严格 prompt 安全门的下游任务（T2.2.2 / T2.2.4 / INT-S2）。

**最高严重度: High**（Agent-boundary 检测缺口）。

---

## 2. 审查范围与静态边界

**已读:**
- 变更文件：
  - `src/storage/v9-state-stores.ts`（新增 `readActivityThreadsByStatus`）
  - `src/core/second-nature/control-plane/v9-embodied-context-assembler.ts`（新）
  - `src/core/second-nature/control-plane/context-serializer.ts`（新）
  - `src/core/second-nature/memory/self-continuity-card-assembler.ts`（新增 `createCharacterFrameStoreAdapter` 导出）
  - `tests/unit/control-plane/v9-embodied-context.test.ts`（新）
  - `tests/integration/v9/context-continuity-injection.test.ts`（新）
- 设计权威：
  - `.anws/v9/01_PRD.md` §3.1 / §6.1 / US-001 / US-008 / G10
  - `.anws/v9/02_ARCHITECTURE_OVERVIEW.md` §2 System 2 / §3.5 Agent-Boundary Guardrails
  - `.anws/v9/03_ADR/ADR_006_CHARACTER_CONTINUITY_AS_EMERGENT_PROJECTION.md`
  - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md` §5.1 / §6.1 / §9.3 / §10 / §11
  - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md` §1 / §2 / §3.3 / §3.5 / §9.3a
  - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md` §3.5 / §3.6 / §4 / §5 / §10
  - `.anws/v9/05A_TASKS.md` T2.2.1
  - `.anws/v9/05B_VERIFICATION_PLAN.md` T2.2.1 / §3 / §5

**故意未执行:**
- 未运行 `pnpm typecheck` / `pnpm test` / `pnpm build`（纯静态审查）。
- 未读 `07_CHALLENGE_REPORT.md`（本波为 /forge 波末 review，不触发 challenge 流程）。
- 未审计上游 `character-frame-builder.ts` 的完整 validator 实现（仅审查 assembler 与 lifecycle 的交互边界）。

---

## 3. 契约 → 代码映射摘要

| 设计承诺 | 实现区域 | 状态 |
|---|---|---|
| `EmbodiedContext` 并行装配全部 v9 slices | `v9-embodied-context-assembler.ts:290-558` | ✅ 基本实现 |
| `SelfContinuityCard` 通过 `ContinuityReadPort` 加载 | `v9-embodied-context-assembler.ts:397-412` | ✅ |
| `CharacterFramePointer` / `EmbodiedContextCharacterProjection` 独立加载 | `v9-embodied-context-assembler.ts:415-460` | ⚠️ 重复调用同一端口 |
| ActivityThread active/paused 读取 | `v9-state-stores.ts:209-221` + `v9-embodied-context-assembler.ts:519-538` | ✅ |
| RoutineList 状态映射（installed/disabled/rollback） | `self-continuity-card-assembler.ts:598-602` | ✅ |
| Agent-boundary forbidden-pattern 检测 | `context-serializer.ts:37-42` + `:95-105` | ❌ 覆盖不全且未降级 |
| 1200/900/200 字符预算 | `self-continuity-card-assembler.ts:75-80` / `character-frame-lifecycle.ts:55-57` | ⚠️ 预算在 upstream 执行，assembler 不复核 |
| Contestable marker / newlyProposed 渲染 | `context-serializer.ts:160-167` | ✅ 部分 |

---

## 4. Lens 结果摘要

- **L1 契约忠实度**: 核心切片装配与类型对齐，但 `ContextSerializer` forbidden-pattern 集合严重小于 `shared-v9-contracts.md §3.6` 要求；`ACTIVE_ACTIVITY_THREAD_LIMIT` 与 `EMBODIED_CONTEXT_HARD_DEADLINE_MS` 与设计 L1 常量不符。
- **L2 任务兑现与交付闭合**: T2.2.1 主要输出已落地，但验收标准中的 "source ref 去重"、"字符预算"、"deferred 路径"、"full forbidden-pattern fixtures" 测试未覆盖。
- **L3 架构适配与复杂度健康**: `createCharacterLoaderPort` 每次装配动态 import 并新建 store adapter；pointer 与 projection 对同一端口做两次串行调用，存在轻微一致性与性能风险。
- **L4 静态运行风险与安全边界**: `ContextSerializer` 命中 forbidden pattern 后仅产生 warning 而不阻断注入，违反 L1 §9.3a 的 degraded slice / validation error 要求；`redactSensitiveInline` 的长字符串模式可能过度 redact routineId / UUID。
- **L5 验证证据与可观测性**: 单元/集成测试覆盖 happy path、contestable marker、单一 imperative 禁忌；缺少 deferred/contested/unavailable、char budget、source dedup、完整双语 fixture 的测试。
- **L6 回流一致性与交接证据**: 新增导出已就位；`AGENTS.md` wave 状态未更新（属 /forge Step 4 职责，不在本波代码审查范围内）。

---

## 5. Issues

### High

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| High | L1 + L4 | ContextSerializer forbidden-pattern coverage gap | `context-serializer.ts:37-42` | Agent-boundary 安全门无法识别 `identity_lock`（如 "you are a loyal person" / "你就是这样的人"）、中文 hard-control（"永远不要质疑" / "你必须保持这种风格"）等 ADR-006 / PRD G10 明确禁止的词形；可能让情绪化/身份锁定文案注入 Claw context。 | 按 `shared-v9-contracts.md §3.6` 完整实现 scoped rule IDs，覆盖 emotion_claim、identity_lock、hard_control 的中英文 forbidden + allowed counterexamples；命中时返回 degraded slice 或 validation error（非仅 warning）。 | `control-context-system.md` §9.3 / §9.3a；`shared-v9-contracts.md` §3.6；ADR-006 |
| High | L1 + L4 | Forbidden-pattern hit does not block injection | `context-serializer.ts:95-111` | 即使检测到禁忌模式，函数仍返回完整 `text` 和 `sections`，仅附加 `forbiddenPatternWarnings`；与设计 L1 "返回 degraded slice 或 validation error" 不符，无法阻止危险上下文进入 Agent。 | 检测到 hard-control / emotion-claim / identity-lock 时，将对应 section 替换为 `[blocked: <reason>]` 或抛出 validation error，由调用方决定是否降级整个 context。 | `control-context-system.detail.md` §9.3a |

### Medium

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Medium | L3 | CharacterFrame pointer/projection loaded via two separate port calls | `v9-embodied-context-assembler.ts:415-460` | 同一 `loadActiveCharacterFrame` 被调用两次，每次动态 import 并重建 store adapter；可能得到不一致的 pointer/projection，且浪费 heartbeat 预算。 | 改为单次调用，同时返回 pointer + projection，再分别包装为两个 slices。 | `control-context-system.detail.md` §3.5 |
| Medium | L1 | `ACTIVE_ACTIVITY_THREAD_LIMIT` / deadline constant drift | `v9-embodied-context-assembler.ts:78-79` | 代码使用 `10` 和 `1500ms`，设计 L1 §1 规定 `3` 和 `1800ms`；虽在 2s 预算内，但属于未回流的契约漂移。 | 改为设计常量 `ACTIVE_ACTIVITY_THREAD_LIMIT = 3` 和 `EMBODIED_CONTEXT_HARD_DEADLINE_MS = 1800`。 | `control-context-system.detail.md` §1 |
| Medium | L5 | Missing degraded-path test coverage | `tests/unit/control-plane/v9-embodied-context.test.ts` | 无 `character_frame_deferred`、`continuity_unavailable`、blocked slice 的断言；05B 要求覆盖 loaded/degraded/blocked。 | 补充测试：无 accepted frame 时 `characterFramePointer`/`characterFrameProjection` 为 degraded 且 reason 为 `character_frame_deferred`；无 card 时 `selfContinuityCard` 降级。 | `05B_VERIFICATION_PLAN.md` T2.2.1 |
| Medium | L5 | Missing char-budget and source-dedup tests | `tests/unit/control-plane/v9-embodied-context.test.ts` | 未验证 Card ≤1200 chars / Frame projection ≤900 bytes / source ref 去重。 | 补充 fixture 使 card/projection 接近预算边界，断言装配后的切片仍满足预算与去重。 | `05B_VERIFICATION_PLAN.md` T2.2.1 / `control-context-system.detail.md` §1 |
| Medium | L5 | Forbidden-pattern tests only cover one imperative fixture | `tests/unit/control-plane/v9-embodied-context.test.ts:346-357` | 仅断言 "you must"；未覆盖 emotion_claim、identity_lock、中文 hard-control 及 allowed counterexamples。 | 按 `shared-v9-contracts.md §3.6` 的 fixture 表增加参数化测试，验证命中与放行。 | `shared-v9-contracts.md` §3.6 |
| Medium | L4 | Over-redaction risk for source-like identifiers | `self-continuity-card-assembler.ts:82-86` / `:96-106` | `[A-Za-z0-9_\-]{32,}` 可能将 routineId / UUID / content hash 误判为 secret 并 redact，影响 cardText 可读性。 | 将 source ref / UUID 格式加入 allowlist，或仅在已知 credential 前缀上下文中 redact。 | PRD §6.2 / `05B_VERIFICATION_PLAN.md` T1.2.2 |

### Low

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Low | L3 | Empty `workspaceRoot` stubs passed to read ports | `v9-embodied-context-assembler.ts:400,418,442,467,486,504,523` | 多处使用 `workspaceRoot: ""`，若下游端口用于文件路径解析会出错；当前端口忽略该字段，但属于未解释的临时值。 | 从 assembler deps 传入真实 `workspaceRoot`，或在端口契约中明确该字段在 storage-backed 路径下可选。 | `control-context-system.detail.md` §2 |
| Low | L3 | Dead helper `toRoutinePointerFromRecord` | `self-continuity-card-assembler.ts:218-225` | 函数已定义但未被调用，与 `toRoutinePointer`（`src/storage/v9-state-stores.ts:150-157`）重复。 | 删除或替换为实际使用的转换器。 | N/A（代码卫生） |
| Low | L1 | `ContextSerializer` markers are English-only | `context-serializer.ts:32-35` | 双语场景下仅英文 marker 可能降低可读性；设计未强制双语 marker，但 contest prompt 要求 bilingual-safe。 | 根据 `locale` 参数或上下文选择中英文 marker。 | `shared-v9-contracts.md` §5.2 |
| Low | L3 | Dynamic import inside per-call adapter factory | `self-continuity-card-assembler.ts:364-365` | `createCharacterFrameStoreAdapter` 每次调用都重新 import storage 模块，可被调用方缓存。 | 将 import 提到模块顶层，或在 assembler factory 中复用同一 adapter 实例。 | N/A（性能卫生） |

---

## 6. 安全 / 测试覆盖补充

- **Agent-boundary 安全门**: 当前唯一需要修复后才能视为闭合的安全缺口是 `ContextSerializer` 的 forbidden-pattern 集合与降级行为。建议优先处理 High 项，再进入 T2.2.2/T2.2.4。
- **测试覆盖**: happy path 已有基本证据；需要补 degraded/blocked 路径、字符预算边界、source ref 去重、完整双语 forbidden-pattern fixture 表。
- **无法静态确认**: 实际 `pnpm typecheck` / `pnpm test` 是否通过需运行时验证；本报告未执行。
