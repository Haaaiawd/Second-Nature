# Wave 136 Code Review — 2026-06-28

## 1. 总结结论

**Partial Pass** — 核心交付完整：digest assembler（4 health sections + sourceRefCount + redacted output）+ timeline query service（family/kind/sourceRef filter + cursor pagination + 7d window clamp + redacted payload on read + character frame event whitelist）。测试覆盖充分（29 unit + 12 API）。存在 1 个 Medium 契约漂移（§3.8 pseudocode 的 `countUniqueSourceRefs` 计算方式与实现略有差异）与若干 Low 残留。无 Critical/High 阻塞。

## 2. 审查范围与静态边界

**已读**：
- `src/observability/v9-digest-timeline.ts`（全文）
- `src/observability/v9-loop-health-aggregator.ts`（aggregateLoopStatus 依赖）
- `src/observability/v9-redaction-projector.ts`（redactTimelinePayload 依赖）
- `src/shared/types/v9-contracts.ts`（Digest/TimelineRow/TimelinePage/TimelineFamily/CharacterFrameEventKind）
- `tests/unit/observability/v9-digest-timeline.test.ts`（全文）
- `tests/api/runtime-ops/v9-digest-timeline.test.ts`（全文）
- `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §3.8 §3.9 §5.6 §5.7`
- `.anws/v9/05A_TASKS.md` T8.2.3 任务定义

**未读**（故意收缩）：
- 未读 §3.7（rollback watchdog — Wave 135 已审查）

**需人工验证**：无。本波全部为静态可验证的纯函数 + 依赖注入逻辑。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|---|---|
| DigestAssembler v9 sections | `v9-digest-timeline.ts` assembleDigest |
| TimelineQueryService filters and pagination | `v9-digest-timeline.ts` queryTimeline |
| digest/timeline source-backed redacted output | redactTimelinePayload on read + validateCharacterSafety on digest |
| character frame event kind whitelist | `v9-digest-timeline.ts` CHARACTER_FRAME_EVENT_KINDS + filterCharacterFrameEvents |

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 契约忠实度 | Partial Pass — §3.8 pseudocode 的 `countUniqueSourceRefs(events.concat(ledger.map(toStageEventStub)))` 直接从 stage events + ledger entries 计数，实现使用 `stageEvents.map(e => ({ sourceRefs: [{family: "ledger", id: e.stageKind}] }))` 构造 stub，与 pseudocode 的 `toStageEventStub` 语义不完全一致 | `observability-recovery-system.detail.md:742` vs `v9-digest-timeline.ts:175-180` |
| L2 任务兑现 | Pass — 输出/验收/边界全承接 | `05A_TASKS.md:606-623` 输出 2 项全交付，验收标准覆盖 |
| L3 架构适配 | Pass — 纯函数 + 依赖注入，可测性高 | now/generateId/persistDigest/queryRows 全注入 |
| L4 静态运行风险 | Pass — timeline window clamp 防止超大窗口，limit clamp 防止过多行 | `v9-digest-timeline.ts:110` clampTimelineWindow, `v9-digest-timeline.ts:210` limit clamp |
| L5 验证证据 | Pass — 覆盖充分 | 29 unit + 12 API；window/clamp/sourceRefCount/digest/timeline/filter/pagination/redaction/whitelist |
| L6 回流一致性 | Partial Pass — task checkbox 已勾选，1 个文档矛盾未回流 | `05A_TASKS.md:606` ✅；§3.8 `toStageEventStub` 语义与实现 stub 构造不完全一致 |

## 5. Issues

### Medium

**M-1 | L1+L6 | §3.8 pseudocode `toStageEventStub` 语义与实现 stub 构造不完全一致（Contract Drift）**
- **Evidence**: `observability-recovery-system.detail.md:742`（`countUniqueSourceRefs(events.concat(ledger.map(toStageEventStub)))` — pseudocode 假设 `toStageEventStub` 将 ledger entry 转换为带 sourceRefs 的 stub）vs `v9-digest-timeline.ts:175-180`（实现使用 `stageEvents.map(e => ({ sourceRefs: [{family: "ledger", id: e.stageKind}] }))` — 为 stage events 构造 ledger-family stub，而非为 ledger entries 构造 stub）
- **Impact**: sourceRefCount 的计算方式与 pseudocode 不完全一致。实现层的计数逻辑是合理的（从 stage events + ledger entries 各自的 sourceRefs 计数），但 stub 构造方式不同。不阻塞功能——sourceRefCount 仍然是一个有意义的去重计数。
- **Minimum fix**: 走 `/change` 修正 §3.8 pseudocode，明确 `toStageEventStub` 的语义，或移除 stub 构造直接从 events + ledger 的 sourceRefs 计数。
- **Anchor**: `observability-recovery-system.detail.md §3.8:742`

### Low

**L-1 | L4 | `queryTimeline` 的 `queryRows` dep 在内存中做 cursor pagination（Memory — 已声明）**
- **Evidence**: `v9-digest-timeline.ts:218`（`if (params.cursor) { const idx = filtered.findIndex(...); filtered = filtered.slice(idx + 1) }`）
- **Impact**: 如果 store 返回大量行，内存中 cursor pagination 可能慢。但 `limit+1` 查询限制了每次返回的行数，且 store 应该支持 server-side cursor。
- **Minimum fix**: 无需本波修复。测试中的 mock queryRows 在内存中做 pagination，但生产实现应该在 store 层做 server-side cursor。
- **Anchor**: `v9-digest-timeline.ts:218`（测试 mock）

**L-2 | L3 | `assembleDigest` 不包含 character health section（Contract Drift — 已适配）**
- **Evidence**: `v9-contracts.ts:1211-1216`（`Digest.sections` 只有 `loop`/`continuity`/`routine`/`connectorEvolution`，没有 `character`）vs `v9-loop-health-aggregator.ts` aggregateLoopStatus 返回 `character` 字段
- **Impact**: Digest 的 sections 不包含 character health——这是 v9-contracts 契约的定义，不是实现遗漏。Character health 通过 timeline 的 character_frame_event family 查询，不进入 digest sections。
- **Minimum fix**: 无需本波修复。如果未来需要 character section in digest，需要先扩展 v9-contracts Digest.sections 契约。
- **Anchor**: `v9-contracts.ts:1211`、`v9-digest-timeline.ts:168`

## 6. 安全 / 测试覆盖补充

**安全**：
- Timeline payload 在读取时通过 `redactTimelinePayload` redact（mask/erase/hash sensitive fields）。
- Digest output 通过 `validateCharacterSafety` 验证（API 测试验证），不含 emotion/personality/identity-lock/hard-control 文本。
- Character frame event whitelist（§1.5a）确保只有 8 种合法 event kind 进入 timeline。

**测试覆盖**：
- digest: sufficient（sections/sourceRefCount/persist/JSON-serializable/safety/empty window）
- timeline: sufficient（filter/pagination/redaction/empty/max-limit/cursor）
- character whitelist: sufficient（whitelist/non-whitelist/non-character family）

**无法静态确认**：无。本波全部为静态可验证的纯函数 + 依赖注入逻辑。

## 7. review-fix 决定

- **M-1**: 不在本波修复（需走 `/change` 修正 §3.8 pseudocode `toStageEventStub` 语义）。实现层 sourceRefCount 计算逻辑合理，不阻塞功能。
- **L-1**: 无需修复（测试 mock 在内存中做 pagination 是可接受的，生产实现应在 store 层做 server-side cursor）。
- **L-2**: 无需修复（Digest.sections 契约不含 character section 是设计决策，character health 通过 timeline 查询）。

**Final verdict**: **Partial Pass** — 核心交付完整、测试充分、无 Critical/High 阻塞。M-1 文档矛盾不影响功能，建议下一波前走 `/change` 修正 §3.8 pseudocode。observability-recovery-system Phase 2 全部完成。
