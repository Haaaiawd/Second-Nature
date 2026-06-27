# Wave 127 Code Review — 2026-06-27

## 1. 总结结论

**Partial Pass（静态意义下）**。

T2.2.4 的核心骨架已实现：`ActivityThreadCoordinator` 提供了 create/continue/pause/complete 分支，每轮最多推进一个 `ActivityStep`，side-effecting step 不自行执行，持久化端口已 wiring，单元/集成测试覆盖了主要 happy path 与 runaway guard。但存在**阻断级常量漂移**（runaway guard 阈值与设计文档不一致），以及 ActivityThreadPort 接口、source-free association fallback、`threadSuggestion="none"` 处理等契约偏离。修复前不建议进入依赖这些常量和端口的下游任务（T4.2.1 / T8.2.1 / INT-S2）。

---

## 2. 审查范围与静态边界

**已读**：
- 设计契约：`.anws/v9/04_SYSTEM_DESIGN/control-context-system.md` §5.1、`.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md` §3.9、`.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md` §3.1b、`.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md` §3.5
- 任务/验证：`.anws/v9/05A_TASKS.md` T2.2.4、`.anws/v9/05B_VERIFICATION_PLAN.md` T2.2.4
- 源码：`src/core/second-nature/control-plane/activity-thread-coordinator.ts`、`src/core/second-nature/control-plane/v9-embodied-context-assembler.ts`
- 测试：`tests/unit/control-plane/v9-activity-thread-coordinator.test.ts`、`tests/integration/v9/activity-thread-continuation.test.ts`
- 辅助验证（非审查目标，仅确认 wiring）：`src/storage/v9-state-stores.ts` 相关 activity thread/step 端口、`src/storage/db/schema/v9-entities.ts` schema

**未读/未执行**：
- 未运行 `pnpm test` / `pnpm build` / `pnpm typecheck`；所有测试/编译结论为静态推断
- 未检查 `ContextSerializer` 对 activity thread 的渲染（属于 T2.2.1 残留，非 T2.2.4 范围）
- 未审计 `action-closure-policy-system` 对 `propose_action` step 的实际 handoff（属于 T4.2.1 范围）
- 未验证 Node.js `crypto.randomUUID()` 在目标 runtime 的可用性

---

## 3. 契约 → 代码映射摘要

| 契约承诺 | 实现位置 | 状态 |
|---|---|---|
| `advanceActivityThread` 操作契约：create/continue/pause/complete + 0..1 step | `activity-thread-coordinator.ts:129-254` | ✅ |
| 每轮最多推进一个 bounded `ActivityStep` | `activity-thread-coordinator.ts:214-253` | ✅ |
| Side-effecting step 不执行，仅记录 | `activity-thread-coordinator.ts:299-311` 集成测试 | ✅ |
| `ActivityThreadPort` 读写端口 | `activity-thread-coordinator.ts:49-85`、`v9-embodied-context-assembler.ts:214-302` | ⚠️ 接口形状漂移 |
| Runaway guard：`ACTIVITY_THREAD_MAX_STEPS` / `ACTIVITY_THREAD_STALE_HEARTBEATS` | `activity-thread-coordinator.ts:42-43` | ❌ 常量与设计文档不一致 |
| `EmbodiedContext.activityThreads` active/paused 加载 | `v9-embodied-context-assembler.ts:630-650` | ✅ |
| Source refs 非空阻断 | `activity-thread-coordinator.ts:146-156` | ✅ |
| Stage event 记录 | `activity-thread-coordinator.ts:87-99`、`244-251` | ⚠️ stale 暂停被标记为 blocked |

---

## 4. Lens 结果摘要

- **L1 契约忠实度**：核心操作已实现，但 `ActivityThreadPort` 接口形状、`ACTIVITY_THREAD_MAX_STEPS` / `ACTIVITY_THREAD_STALE_HEARTBEATS` 常量、`threadSuggestion="none"` 语义与 L1/共享契约存在偏离。
- **L2 任务兑现与交付闭合**：05A/05B 要求的 create/continue/pause/complete、max-step、stale、side-effect handoff 均有代码与测试承接；但 source-free association、blocked terminal status、`threadSuggestion="none"` 等边界未闭合。
- **L3 架构适配与复杂度健康**：coordinator 与 assembler 职责分离清晰；`updateActivityThreadProgress` 被加入本地端口以复用 storage upsert，属于轻微接口膨胀。
- **L4 静态运行风险与安全边界**：source-free `focusSimilar` fallback 可能导致无 source 的 thread 关联；常量漂移削弱 runaway 防护；`emitStageEvent` 静默吞异常（已声明 best-effort）。
- **L5 验证证据与可观测性**：单元/集成测试覆盖主要路径，但缺少 `threadSuggestion="none"`、blocked 状态、source-free false positive、stale 事件 status 的断言。
- **L6 回流一致性与交接证据**：代码文件头已标注设计权威；`06_CHANGELOG.md` 已记录 ActivityThread 变更；未发现 ADR/System Design 状态需同步。

---

## 5. Issues

### Critical

`Critical | L1 | Contract Drift: runaway guard constants mismatch design doc | activity-thread-coordinator.ts:42-43 declares ACTIVITY_THREAD_MAX_STEPS=20 and ACTIVITY_THREAD_STALE_HEARTBEATS=3; control-context-system.detail.md:47-48 specifies 8 and 6 | Runaway prevention thresholds deviate from canonical safety boundary; overlong threads allowed 2.5x longer, stale detection twice as aggressive, masking degraded/blocked health classification | Align constants to L1 values (8 and 6) or escalate ADR; add explicit test asserting design-doc thresholds | control-context-system.detail.md §1 Config Constants, 05B runaway prevention principle`

### High

`High | L1+L3 | ActivityThreadPort interface shape drift from canonical ProjectionSlice | activity-thread-coordinator.ts:49-85 defines local { threads; degraded? } and adds updateActivityThreadProgress; control-context-system.detail.md:281-286 defines ProjectionSlice<ActivityThread[]> with status/reason and only four methods | Cross-system port contract narrowed to ("active"|"paused")[] and custom degraded envelope; downstream consumers expecting canonical ProjectionSlice may fail or load incomplete statuses | Reconcile port with L1: return ProjectionSlice<ContextSlice<ActivityThread[]>> shape, support ActivityThreadStatus[] in loadActivityThreads, justify updateActivityThreadProgress separately or fold into appendActivityStep/updateActivityThreadStatus | control-context-system.detail.md §2.4 ActivityThreadPort`

`High | L4+L1 | Source-free association fallback via focusSimilar | activity-thread-coordinator.ts:269-272 falls back to sourceOverlap || focusSimilar; focusSimilar at :386-390 matches purely by substring overlap without shared SourceRef | Creates ActivityThread continuation without source grounding, violating shared-v9-contracts §3.5 "Threads are continuity scaffolds ... source refs" and 05B source-free association risk | Remove focusSimilar fallback or require at least one overlapping SourceRef plus a bounded confidence marker; add test for source-free attention that must not continue unrelated thread | shared-v9-contracts.md §3.5 Rules, 05B §3 Runaway prevention`

`High | L1+L5 | Stale pause misreported as blocked stage event | activity-thread-coordinator.ts:169-176 emits status: "blocked" with reason activity_thread_stale when the thread is actually set to "paused"; observability-recovery-system.detail.md:97-100 distinguishes ACTIVITY_STALE from ACTIVITY_BLOCKED | Health consumers reading stage events will classify stale pause as blocked, distorting loop_status activity dimension and violating 05B "stale/overlong/missing-closure ... not healthy" but distinct classification | Emit status: "blocked" only for status==="blocked"; emit status: "completed" or a dedicated "skipped"/"blocked" with reason activity_thread_stale for stale pause; align with observability reason codes | observability-recovery-system.detail.md §1.8 reason codes, 05B T8.2.1`

### Medium

`Medium | L1+L2 | threadSuggestion="none" still creates and advances thread | activity-thread-coordinator.ts:293-295 maps "none" to "observe"; :180-212 creates thread and appends step without checking threadSuggestion | Contradicts attention-system.detail.md §3.5a where "none" means suppressed/non-actionable/novelty insufficient; produces phantom threads from attentions explicitly marked non-actionable | Skip advance (return skipped with reason attention_thread_suggestion_none) when threadSuggestion==="none" and status==="attentive"; add unit test | attention-system.detail.md §3.5a, shared-v9-contracts.md §3.3 threadSuggestion semantics`

`Medium | L1 | nextPossibleMoves not refreshed after step advance | activity-thread-coordinator.ts:232-239 updates status/completedStepCount/lastStepKind but never writes nextPossibleMoves | Thread read model advertises stale possible moves after rotation; diverges from ActivityThread type contract | After chooseNextStepKind, recompute deriveNextPossibleMoves(attention) and persist to nextPossibleMoves | control-context-system.detail.md §2 ActivityThread, shared-v9-contracts.md §3.5`

`Medium | L4 | parseSourceRef fallback exposes internal parse failure as activity source ref | v9-embodied-context-assembler.ts:336-342 returns { family: "activity", id: "parse_failed" } on JSON parse error | Malformed closureRefJson could surface a synthetic source ref in EmbodiedContext, potentially misleading Agent about provenance | Return undefined and log/emit degraded reason instead of fabricating a source ref; add fallback test | shared-v9-contracts.md §1 SourceRef rules`

### Low

`Low | L3+L2 | stopCondition hardcoded to single_step_done | activity-thread-coordinator.ts:202 sets stopCondition: "single_step_done" and never updates it | Type allows agent_paused/goal_satisfied/blocked/stale/max_steps but these terminal states are not reflected, reducing observability precision | Set stopCondition based on actual terminal cause (max_steps/stale) when thread transitions to blocked/paused | control-context-system.detail.md §2 ActivityThread`

`Low | L5 | Missing explicit blocked-terminal-status test | no test in v9-activity-thread-coordinator.test.ts for attention arriving with a pre-existing blocked/completed/abandoned thread | shouldStopThread path for terminal statuses is not exercised | Add test asserting terminal status thread is stopped and not advanced | 05B T2.2.4 "stale/max-step guard"`

---

## 6. 安全 / 测试覆盖补充

**高优先级缺口（需修复后验证）**：
1. **常量一致性**：`ACTIVITY_THREAD_MAX_STEPS` / `ACTIVITY_THREAD_STALE_HEARTBEATS` 必须与 L1 对齐，这是 runaway prevention 的最后一道静态防线。
2. **source-free association**：`focusSimilar` fallback 是最大 false-positive 来源，需在单元测试中覆盖“summary 相似但 sourceRefs 完全不重叠时不得 continue”。
3. **stale vs blocked 语义**：stage event 的 status 必须忠实反映 thread lifecycle 状态，否则 T8.2.1 的 health 分类会被污染。

**无法通过静态审查确认**：
- 真实 SQLite upsert/append 的幂等性（需要实际运行集成测试验证 `writeActivityStep` 重复 append 不会 double count）。
- `v9-embodied-context-assembler.ts` 与 `activity-thread-coordinator.ts` 的 TypeScript 编译是否通过（`ActivityThreadPort` 本地定义与 canonical type 可能存在隐式不兼容）。
- `ContextSerializer` 对 ActivityThread 的渲染是否仍然满足 Agent-boundary invariants（T2.2.1 残留问题，不在本任务范围但需在 INT-S2 前确认）。
- `crypto.randomUUID()` 在 OpenClaw plugin runtime / 目标 Node.js 版本的可用性。

**建议修复顺序**：Critical 常量 → High 端口/ source-free / stale event → Medium `threadSuggestion="none"` / `nextPossibleMoves` → Low 测试补全。
