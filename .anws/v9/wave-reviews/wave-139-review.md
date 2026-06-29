# Wave 139 Code Review — 2026-06-29

## 1. 总结结论

**Pass** — T2.2.3 核心交付完整：将 v9 context assembly 从串行改为 parallel `Promise.all` + per-slice `withTimeout`，添加 critical/non-critical slice timeout 分发（1500ms/600ms），添加 `ContextAssemblyLatencyReport` + `ContextAssemblyStageEventSink` latency stage events。14 新测试（11 unit + 3 integration）覆盖充分，全量 2270 tests / 2261 pass / 0 fail / 9 skipped。无 Critical/High/Medium 阻塞，仅 1 个 Low 残留。

## 2. 审查范围与静态边界

**已读**：
- `src/core/second-nature/control-plane/v9-embodied-context-assembler.ts`（全文 772 行，重写 assembleEmbodiedContext）
- `src/shared/types/v9-contracts.ts`（新增 `ContextAssemblyLatencyReport`、`LoopStageKind` 新增 `context_assembly`）
- `tests/unit/control-plane/v9-context-deadline.test.ts`（全文 11 tests）
- `tests/integration/v9/context-deadline-integration.test.ts`（全文 3 tests）
- `reports/v9-context-deadline-benchmark.md`
- `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.3`
- `.anws/v9/05A_TASKS.md` T2.2.3 任务定义

**未读**（故意收缩）：
- `v9-heartbeat-orchestrator.ts` 全文（本波未修改，stage event sink 是可选注入）
- `loop-stage-event-sink.ts` 全文（本波未修改）

**需人工验证**：无。本波全部为静态可验证的逻辑 + 性能基准。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|---|---|
| 2s heartbeat deadline | `EMBODIED_CONTEXT_HARD_DEADLINE_MS = 1800` + parallel assembly |
| per-slice timeout 分发 | `CRITICAL_SLICE_TIMEOUT_MS = 1500` / `NON_CRITICAL_SLICE_TIMEOUT_MS = 600` + `sliceTimeouts` map |
| non-critical slice degraded 而不阻塞 | parallel `Promise.all` + per-slice `withTimeout` + catch → degraded |
| latency stage events | `ContextAssemblyStageEventSink` + `ContextAssemblyLatencyReport` |
| continuity unavailable 显式 reason | `slice_timeout` / `continuity_unavailable` / `self_health_provider_unavailable` |
| parallel assembly (§3.3 设计) | `Promise.all(slicePromises)` 替代串行 await |

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 契约忠实度 | Pass — §3.3 要求 parallel assembly + per-slice timeout，实现完整 | `v9-embodied-context-assembler.ts:456-695` parallel + per-slice timeout |
| L2 任务兑现 | Pass — 验收标准全覆盖 | `05A_TASKS.md:147` ✅；slow port → degraded + deadline 内完成 |
| L3 架构适配 | Pass — 纯函数 + 依赖注入，stageEventSink 可选 | `ContextAssemblyStageEventSink` 接口注入 |
| L4 静态运行风险 | Pass — depth limit 不适用（无递归），timeout 防止 hang | per-slice `withTimeout` + `Promise.all` |
| L5 验证证据 | Pass — 11 unit + 3 integration tests | deadline/timeout/parallel/latency event/p95 全覆盖 |
| L6 回流一致性 | Pass — task checkbox 已勾选，AGENTS.md 已更新 | `05A_TASKS.md:147` ✅；`AGENTS.md:87-89` |

## 5. Issues

### Low

**L-1 | L3 | `loadProjectionSlice` / `toSlice` / `toBodySlice` / `toProjectionSlice` 成为 dead code（Cleanup — 无功能影响）**
- **Evidence**: `v9-embodied-context-assembler.ts:175-194`（`toSlice`/`toBodySlice`/`toProjectionSlice`）+ `:734-747`（`loadProjectionSlice`）— parallel 实现不再调用这些 helper
- **Impact**: 无功能影响，仅代码整洁度。这些 helper 仍被导出但无内部调用。
- **Minimum fix**: 后续 cleanup wave 可删除这些 helper，或保留供外部消费者使用。
- **Anchor**: `v9-embodied-context-assembler.ts:175-194, 734-747`

## 6. 安全 / 测试覆盖补充

**安全**：
- 无密钥/PII 泄露风险：context assembly 只读取 state DB 元数据。
- timeout 防止 hanging port 消耗 heartbeat budget。
- parallel assembly 确保一个 slice 失败不影响其他 slice。

**测试覆盖**：
- all fast: assembly completes quickly, all slices loaded
- non-critical timeout: slow slice degraded, others loaded
- critical timeout: critical slice degraded, non-critical loaded
- latency event: correct timing data, degradedSlices, timedOutSlices
- parallel vs serial: total time ≈ max(slice times)
- continuity unavailable: explicit reason
- affordance failure: degraded slice only
- selfHealth unavailable: explicit reason
- activity threads blocked: preserved
- multiple timeouts: all appear in report
- withinDeadline false: when total > hardDeadline
- integration: real DB + slow port fixture
- p95 budget: 10 consecutive assemblies all within 2s

**无法静态确认**：无。性能基准在 in-memory DB 环境验证。

## 7. review-fix 决定

- **L-1**: 无需本波修复（dead code 无功能影响，后续 cleanup wave 可处理）。

**Final verdict**: **Pass** — 核心交付完整、测试充分、无 Critical/High/Medium 阻塞。T2.2.3 2s heartbeat deadline + per-slice timeout + latency stage events 已交付。05A 所有任务已完成。
