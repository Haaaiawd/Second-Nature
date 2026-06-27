# Wave 124 Code Review — 2026-06-26

## 1. 总结结论

**Partial Pass**（静态审查结论）。

T7.2.2 的核心状态机、projection/pointer builder、字符预算和基础测试都已落地，但 `newlyProposed` 首注标记的生命周期未在 loader 内自闭合，导致存在真实的运行语义漂移风险。另有数据模型字段（`validUntil`）、L1 内部排序、`supersede` 操作覆盖和测试覆盖缺口需要修补。无 Critical 问题。

---

## 2. 审查范围与静态边界

### 已读输入
- `.anws/v9/01_PRD.md`（US-008 / G8 / NG1 / NG6）
- `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`（System 7 / Agent-boundary guardrails）
- `.anws/v9/03_ADR/ADR_006_CHARACTER_CONTINUITY_AS_EMERGENT_PROJECTION.md`
- `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.md`
- `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.detail.md`
- `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md`（§3.5 / §5）
- `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`（§5 CharacterFrame & projection）
- `.anws/v9/05A_TASKS.md`（T7.2.2）
- `.anws/v9/05B_VERIFICATION_PLAN.md`（T7.2.2 验证矩阵）

### 已读实现与测试
- `src/core/second-nature/character/character-frame-lifecycle.ts`
- `src/shared/types/v9-contracts.ts`
- `tests/unit/character/v9-character-lifecycle.test.ts`
- `tests/integration/v9/character-context-projection.test.ts`
- `src/storage/v9-state-stores.ts`（character frame 读写端口，供验证集成测试 store 映射）
- `src/core/second-nature/character/character-frame-builder.ts`（仅头注释，确认 first-injection 职责边界）

### 故意未执行
- 未运行 `pnpm typecheck` / `pnpm build` / `pnpm test` / Docker / 外部服务。
- 未读取 `control-context-system` assembler 实现细节（T2.2.1 范围）。

### 需人工/运行时验证
- `newlyProposed` 标记在真实 context assembly 中是否会被 `markFirstInjectionSeen` 清除。
- `readLatestAcceptedCharacterFrame` 在 `acceptedAt` 为 null 时的 ORDER BY 行为。
- `revise` 后原始 frame 置为 `candidate` 是否会导致 context 实际闪烁为 deferred。
- CJK 文本在 900 字节预算下的实际截断表现（是字节还是字符）。

---

## 3. 契约 → 代码映射摘要

| 契约承诺 | 实现区域 |
| --- | --- |
| `candidate/accepted/rejected/retired/superseded`  contest 状态机 | `character-frame-lifecycle.ts:171-184` + `:201-238` |
| `accept/reject/revise/retire` 动作与 `successorFrameId` | `character-frame-lifecycle.ts:201-238` |
| Bounded `EmbodiedContextCharacterProjection`（≤900）与 `CharacterFramePointer`（≤200） | `character-frame-lifecycle.ts:244-283` + `:87-128` |
| `newlyProposed` 首注标记 | `v9-contracts.ts:259,278` + `character-frame-lifecycle.ts:75,254,271,313-316` |
| Active frame loader（accepted-only / contested / deferred） | `character-frame-lifecycle.ts:296-323` |
| Store port 集成 | 集成测试通过 `v9-state-stores.ts:541-638` 的 `write/read/update` 端口映射 |

---

## 4. Lens 结果摘要

- **L1 契约忠实度**：状态转移矩阵、pointer/projection 类型、`newlyProposed` 字段与 shared contracts 基本一致；漂移在于 `validUntil` 未在 contest 中写入、内部 posture 排序未实现、`newlyProposed` 清除未自闭合。
- **L2 任务兑现与交付闭合**：T7.2.2 的输出文件已产生，单测/集成测覆盖 transitions、budgets、contested/deferred；缺少首注清除、supersede 操作和 `validUntil` 的显式覆盖。
- **L3 架构适配与复杂度健康**：模块边界清晰，projection adapter 与 store port 分离；`CharacterFrameStorePort` 与 builder 的 store port 略有重复但可接受。
- **L4 静态运行风险与安全边界**：无 credential/private content 泄漏路径；主要风险是 `newlyProposed` 默认 `true` 可能导致投影永久带 contest 前缀，削弱连续性可用性。
- **L5 验证证据与可观测性**：单元 + 集成测试存在；断言强度足够覆盖基础路径，但 first-injection lifecycle 和 terminal-state 元数据覆盖不足。
- **L6 回流一致性与交接证据**：文件头设计锚点完整，测试文件名与 05A 证据产出对齐；需要向下游 T2.2.1 / T5.2.2 交接 `markFirstInjectionSeen` 调用约定。

---

## 5. Issues

### High

- **H-1 | L1+L2+L4 | `newlyProposed` 首注标记未在 lifecycle loader 内自动清除**
  - **Evidence**: `character-frame-lifecycle.ts:296-323`（`loadActiveCharacterFrame` 默认 `newlyProposed: options.isFirstInjection ?? true`）；`character-frame-lifecycle.ts:325-340`（`markFirstInjectionSeen` 写入 `acceptedAt` 作为 seen marker，但 loader 不读取）。
  - **Impact**: 只要调用方不显式传 `isFirstInjection:false`，每次加载都会把已 accepted frame 标为首注，导致 contest prefix 永久存在，违反 `shared-v9-contracts.md §5.3`“首次注入后 Agent accept/contest 即清除标记”的激活策略。
  - **Minimum fix**: `loadActiveCharacterFrame` 根据 `frame.acceptedAt` / 专用 seen marker 判断是否为首次注入，默认 `newlyProposed=false`；`control-context-system` 在首次 projection 后调用 `markFirstInjectionSeen`。
  - **Anchor**: `shared-v9-contracts.md §5.3` activation policy；`05B_VERIFICATION_PLAN.md#t7-2-2`；`control-context-system.detail.md §3.5`、`§5`（newly proposed / contested 处理）。

### Medium

- **M-1 | L1+L2 | `applyCharacterContest` 未对 terminal/rejected 状态写入 `validUntil`**
  - **Evidence**: `character-frame-lifecycle.ts:201-238`（update 调用未传 `validUntil`）；`character-frame-lifecycle.ts:55-70`（port 已支持）。
  - **Impact**: `CharacterFrame.validUntil` 在 `rejected`/`retired` 乃至未来 `superseded` 时仍为 null，破坏 L0 数据模型和依赖时间边界的查询。
  - **Minimum fix**: 对 `reject`/`retire`/supersede 动作设置 `validUntil: now` 并传入 `updateFrameLifecycle`。
  - **Anchor**: `character-continuity-system.md §6.1`（`validUntil` 必填，superseded/retired 时设置）；`05A_TASKS.md#t7-2-2` 状态机。

- **M-2 | L1+L3 | projection serializer 未按 L1 对 posture 内部排序**
  - **Evidence**: `character-frame-lifecycle.ts:130-161` 按固定 section 顺序拼接，但未按 `sourceRefs` 数量降序、再按 confidence 排序。
  - **Impact**: 低来源/低置信度条目可能排在前面，降低 source-backed 可读性，偏离 `character-continuity-system.detail.md §1.1`。
  - **Minimum fix**: 序列化前对每个 posture 列表执行 `sourceRefs.length` 降序 + `confidence` 高低排序。
  - **Anchor**: `character-continuity-system.detail.md §1.1` SECTION_ORDER 内部排序规则。

- **M-3 | L1+L2 | 缺少显式 `supersedeFrame` lifecycle 操作**
  - **Evidence**: `character-frame-lifecycle.ts` 仅导出 `applyCharacterContest` / `loadActiveCharacterFrame` / builders；无 `supersedeFrame`。
  - **Impact**: supersede 逻辑散落在 `character-frame-builder.ts` 中，T7.2.2 对 `superseded` 状态的操作覆盖不完整，下游无法在 builder 外执行 supersede。
  - **Minimum fix**: 新增 `supersedeFrame(previousId, newFrameId, reason, store)`，设置 `status=superseded`、`validUntil=now`、`supersededBy`。
  - **Anchor**: `character-continuity-system.md §5.1` 操作契约表；`05A_TASKS.md#t7-2-2` "candidate/accepted/rejected/retired/superseded 状态机"。

- **M-4 | L1 | `revise` 将原 frame 置为 `candidate`，与 L1 §4.3 文字冲突**
  - **Evidence**: `character-frame-lifecycle.ts:220-229`（原 frame status 改为 `candidate`）；`character-continuity-system.detail.md §4.3` 表格写“旧 frame 保持 accepted 直到 revision accepted”。
  - **Impact**: revision pending 期间 active projection 立即变成 deferred（无 accepted frame），与“保持 accepted / pointer contested”两种语义存在二义性。
  - **Minimum fix**: 在 L1 内统一 revise 语义：要么保留原 frame `accepted` 并将 pointer 标为 `contested`，要么更新 §4.3 文字以匹配状态图/伪代码。
  - **Anchor**: `character-continuity-system.detail.md §3.2` / `§4.2` / `§4.3`；`05A_TASKS.md#t7-2-2` revise 验收。

### Low

- **L-1 | L1 | `buildEmbodiedContextProjection.text` 未显式自标识为 contestable projection**
  - **Evidence**: `character-frame-lifecycle.ts:258-273` 返回纯 posture 文本，contest affordance 仅存在于 `contestPrompt`。
  - **Impact**: 只读取 `text` 的消费方可能忽略 contestable 标签。
  - **Minimum fix**: 在 `text` 前缀加 bounded 标识（如 `[Contestable projection] `）或确保下游 serializer 拼接 `contestPrompt`。
  - **Anchor**: `shared-v9-contracts.md §5.3` Rules（`text` must explicitly identify itself as a contestable projection）。

- **L-2 | L1 | 字符预算按 UTF-8 字节而非码点计算**
  - **Evidence**: `character-frame-lifecycle.ts:87-106` 使用 `new TextEncoder().encode(text).length`。
  - **Impact**: CJK 文本实际可容纳字符数约为 1/3，可能比 PRD “≤900 UTF-8 chars” 更严格。
  - **Minimum fix**: 明确契约为 UTF-8 字节或改用码点计数；与 builder 的 `charCount` 语义保持一致。
  - **Anchor**: `character-continuity-system.detail.md §1`（`CHARACTER_FRAME_MAX_CHARS = 900`）；PRD US-008。

- **L-3 | L1 | `applyCharacterContest('accept')` 未设置 `acceptedAt`**
  - **Evidence**: `character-frame-lifecycle.ts:227-229` 只传 status/successorFrameId。
  - **Impact**: 手动 accept 的 candidate 缺少 accepted 时间戳，`readLatestAcceptedCharacterFrame` 的 ORDER BY 可能不稳定。
  - **Minimum fix**: accept 时设置 `acceptedAt: now`。
  - **Anchor**: `character-continuity-system.md §6.1` `acceptedAt`；`shared-v9-contracts.md §5.1`。

- **L-4 | L5 | 测试覆盖缺口：首注清除、terminal 元数据、supersede**
  - **Evidence**: `tests/unit/character/v9-character-lifecycle.test.ts:175-182` 只测 `isFirstInjection:true`；无 `validUntil`/`acceptedAt`/supersede 断言。
  - **Impact**: H-1 / M-1 / M-3 易在后续 waves 回退。
  - **Minimum fix**: 补充非首注加载、`markFirstInjectionSeen` 影响、accept 设置 `acceptedAt`、reject/retire 设置 `validUntil`、supersede helper 测试。
  - **Anchor**: `05B_VERIFICATION_PLAN.md#t7-2-2` 单元/集成覆盖清单。

- **L-5 | L6 | 任务描述称 `newlyProposed` 加入 `CharacterContestAction`/`CharacterContestResult`，实际未加入**
  - **Evidence**: `src/shared/types/v9-contracts.ts:262-270` 中 `CharacterContestAction` 为 union，`CharacterContestResult` 无 `newlyProposed`。
  - **Impact**: 仅描述/范围表述漂移，无设计契约要求。
  - **Minimum fix**: 更新 wave 描述，或仅在需要时扩展 result。
  - **Anchor**: 本轮任务描述；`shared-v9-contracts.md §5.2/§5.4`。

---

## 6. 安全 / 测试覆盖补充

- **敏感数据**：projection text 仅序列化已通过的 builder posture 与 source refs，未发现 raw credential / private message / raw prompt 注入路径。
- **首注标记耦合**：`markFirstInjectionSeen` 复用 `acceptedAt` 作为 seen marker，该耦合未在类型/注释外显式文档化；建议后续改为独立 `firstInjectedAt` 列或 payload marker。
- **下游依赖**：`control-context-system`（T2.2.1）必须调用 `markFirstInjectionSeen` 并在非首注加载时传 `isFirstInjection:false`，否则 H-1 会带入生产路径。
- **运行时待验证**：`revise` 后 `readLatestAcceptedCharacterFrame` 返回 null 时的 context 降级行为；CJK 截断后的可读性；`acceptedAt=null` 时的 SQLite 排序表现。

---

*Review produced by CODE REVIEWER skill; pure static evidence, no test execution.*

---

## 7. Review-fix Follow-up — 2026-06-26

All issues from §5 were addressed in a single review-fix pass.

| Issue | Fix | Evidence |
| --- | --- | --- |
| H-1 `newlyProposed` lifecycle | `loadActiveCharacterFrame` now defaults `newlyProposed` to `options.isFirstInjection ?? !hasFirstInjectionMarker(frame)`. First-injection marker is persisted in `payloadJson` by `markFirstInjectionSeen`. | `character-frame-lifecycle.ts:446-448`, `:461-466` |
| M-1 terminal `validUntil` | `reject`/`retire`/`supersede` now set `validUntil: now`. | `character-frame-lifecycle.ts:315-317`, `:351-354` |
| M-2 posture sorting | `serializeFrameText` and `buildFrameSummary` sort habits/tensions by `sourceRefs.length` desc, then confidence high→low. | `character-frame-lifecycle.ts:120-138`, `:186-199` |
| M-3 explicit `supersedeFrame` | Added exported `supersedeFrame(previousId, newFrameId, store, opts)`. | `character-frame-lifecycle.ts:337-361` |
| M-4 revise semantics | `revise` no longer changes original frame status; it stays `accepted` and a `candidate` revision is created. Accepting a revision supersedes the original. `loadActiveCharacterFrame` returns `contested` when a revision is pending. | `character-frame-lifecycle.ts:300-305`, `:323-328` |
| L-1 contestable prefix | `serializeFrameText` prefixes with `[Contestable projection] `. | `character-frame-lifecycle.ts:48`, `:238-242` |
| L-2 byte budget | Documented in code: budget is UTF-8 bytes, matching `charCount` semantics. | `character-frame-lifecycle.ts:49` |
| L-3 `acceptedAt` on accept | `accept` action now writes `acceptedAt: now`. | `character-frame-lifecycle.ts:312` |
| L-4 test coverage | Added tests for: first-injection default false, unseen default true, revision pending contested, accept sets acceptedAt, reject/retire set validUntil, accepting revision supersedes original, explicit supersede. | `tests/unit/character/v9-character-lifecycle.test.ts` |
| L-5 description drift | Wave description updated in `AGENTS.md` to accurately state `newlyProposed` was added to `CharacterFramePointer` only. | `AGENTS.md` Wave 124 entry |

### Verification after fix

- `pnpm typecheck` ✅
- `pnpm build` ✅
- `pnpm build:plugin` ✅
- `pnpm test` 1830 tests, 1821 pass, 0 fail, 9 skipped
- `tests/unit/character/v9-character-lifecycle.test.ts` 19/19 PASS
- `tests/integration/v9/character-context-projection.test.ts` 5/5 PASS

## Final Verdict: Pass

T7.2.2 契约、状态机、projection adapter、排序、首注生命周期与测试覆盖均已闭环，可以进入 Wave 125。

*Review produced by CODE REVIEWER skill; review-fix applied by forge agent.*
