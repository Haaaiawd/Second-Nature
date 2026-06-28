# Wave 135 Code Review — 2026-06-28

## 1. 总结结论

**Partial Pass** — 核心交付完整：rollback liveness watchdog（success/failure/timeout-inference/heartbeat-count-inference/pending）+ 批量 sweep + needsWatchdogMonitoring 过滤。测试覆盖充分（21 unit + 6 integration）。存在 1 个 Medium 契约漂移（§3.7 pseudocode 使用 `rolling_back` 状态，ConnectorEvolutionStatus 契约无此值）与若干 Low 残留。无 Critical/High 阻塞。

## 2. 审查范围与静态边界

**已读**：
- `src/observability/v9-rollback-health-gate.ts`（全文）
- `src/shared/types/v9-contracts.ts`（ConnectorEvolutionPlan/ConnectorEvolutionStatus/RollbackHealth/SourceRef）
- `tests/unit/observability/v9-rollback-watchdog.test.ts`（全文）
- `tests/integration/v9/rollback-liveness-gate.test.ts`（全文）
- `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §1.7 §3.7 §5.4`
- `.anws/v9/05A_TASKS.md` T8.2.2 任务定义

**未读**（故意收缩）：
- 未读 §3.8 §3.9（digest/timeline — 属于 T8.2.3 范围）
- 未读 body-connector-system.detail.md §3.9（仅读 §3.7 引用段）

**需人工验证**：无。本波全部为静态可验证的纯函数 + 依赖注入逻辑。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|---|---|
| RollbackHealthGate | `v9-rollback-health-gate.ts` rollbackHealthGate |
| watchdog scheduler/read path | `v9-rollback-health-gate.ts` rollbackHealthGateBatch + listStageEvents dep |
| inferred stage event | `v9-rollback-health-gate.ts` InferredRollbackEvent + emitInferredEvent dep |
| rollback failure liveness | rollbackHealthGate timeout/heartbeat inference |
| `rollback_failed` blocked loop reason | inferred event reasonCode = ROLLBACK_WATCHDOG.INFERENCE_REASON_CODE |

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 契约忠实度 | Partial Pass — §3.7 pseudocode 使用 `plan.status === 'rolling_back'`，但 `ConnectorEvolutionStatus` 契约无 `rolling_back`，实现适配为 `gating`/`blocked` | `observability-recovery-system.detail.md:694` vs `v9-contracts.ts:579` vs `v9-rollback-health-gate.ts:142` |
| L2 任务兑现 | Pass — 输出/验收/边界全承接 | `05A_TASKS.md:587-604` 输出 3 项全交付，验收标准覆盖 |
| L3 架构适配 | Pass — 依赖注入纯函数，可测性高 | listStageEvents/emitInferredEvent/now/generateId 全注入 |
| L4 静态运行风险 | Pass — inferred event 只发射一次，batch sweep 顺序执行 | `v9-rollback-health-gate.ts:155` await emitInferredEvent |
| L5 验证证据 | Pass — 覆盖充分 | 21 unit + 6 integration；success/failure/timeout/heartbeat/pending/filtering/batch |
| L6 回流一致性 | Partial Pass — task checkbox 已勾选，1 个文档矛盾未回流 | `05A_TASKS.md:587` ✅；§3.7 pseudocode `rolling_back` vs ConnectorEvolutionStatus 不一致 |

## 5. Issues

### Medium

**M-1 | L1+L6 | §3.7 pseudocode 使用 `rolling_back` 状态，ConnectorEvolutionStatus 契约无此值（Contract Drift）**
- **Evidence**: `observability-recovery-system.detail.md:694`（`plan.status === 'rolling_back' || plan.status === 'gating'`）vs `v9-contracts.ts:579`（`ConnectorEvolutionStatus = "proposed" | "gating" | "activated" | "rolled_back" | "blocked"`）vs `v9-rollback-health-gate.ts:142`（实现使用 `plan.status === "gating" || plan.status === "blocked"`）
- **Impact**: 文档 pseudocode 引用了契约中不存在的状态值。实现层已按 `ConnectorEvolutionStatus` 契约适配，不阻塞功能。
- **Minimum fix**: 走 `/change` 修正 §3.7 pseudocode，将 `plan.status === 'rolling_back'` 替换为 `plan.status === 'blocked'`（或添加 `rolling_back` 到 ConnectorEvolutionStatus 契约——但这需要更大的契约变更）。
- **Anchor**: `observability-recovery-system.detail.md §3.7:694`、`shared-v9-contracts.md §7`

### Low

**L-1 | L4 | `rollbackHealthGateBatch` 顺序执行，未并行化（Performance — 已声明）**
- **Evidence**: `v9-rollback-health-gate.ts:175`（`for (const plan of plans) { ... await rollbackHealthGate(...) }`）
- **Impact**: 批量 sweep 顺序执行，大量 plan 时可能慢。但 watchdog sweep 通常只处理少量 gating/blocked plan（`needsWatchdogMonitoring` 过滤后），顺序执行是可接受的。
- **Minimum fix**: 无需本波修复。如果未来 plan 数量大，可引入 `Promise.all` 并行化。
- **Anchor**: `v9-rollback-health-gate.ts:175`

**L-2 | L3 | `listStageEvents` dep 返回全量事件，watchdog 在内存中过滤（Memory — 已声明）**
- **Evidence**: `v9-rollback-health-gate.ts:113`（`const events = await deps.listStageEvents(plan.createdAt, now.toISOString())`）然后 `events.filter(...)`
- **Impact**: 如果时间窗口内事件量大，全量加载到内存可能占用较多内存。但 watchdog 窗口通常 30s，事件量有限。
- **Minimum fix**: 无需本波修复。如果未来事件量大，可在 `listStageEvents` dep 中支持 server-side 过滤。
- **Anchor**: `v9-rollback-health-gate.ts:113`

## 6. 安全 / 测试覆盖补充

**安全**：
- 无密钥/PII 泄露风险：watchdog 只读取 stage event 元数据（stageKind/status/reasonCode/traceRefsJson），不接触 payload 内容。
- inferred event payload 只包含 `{ planId, inferred: true }`，不含敏感信息。
- `emitInferredEvent` 是注入的 callback，调用方控制 DB 写入，watchdog 不直接写 DB。

**测试覆盖**：
- success/failure/timeout/heartbeat/pending: sufficient
- event filtering (plan id match, non-rollback events): sufficient
- batch evaluation: sufficient
- needsWatchdogMonitoring: sufficient
- integration (inferred event → aggregateLoopHealth → blocked): sufficient

**无法静态确认**：无。本波全部为静态可验证的纯函数 + 依赖注入逻辑。

## 7. review-fix 决定

- **M-1**: 不在本波修复（需走 `/change` 修正 §3.7 pseudocode `rolling_back` → `blocked`）。实现层已按 `ConnectorEvolutionStatus` 契约适配，不阻塞功能。
- **L-1**: 无需修复（顺序执行在 watchdog sweep 场景下可接受）。
- **L-2**: 无需修复（30s 窗口事件量有限）。

**Final verdict**: **Partial Pass** — 核心交付完整、测试充分、无 Critical/High 阻塞。M-1 文档矛盾已由实现层适配，建议下一波前走 `/change` 修正 §3.7 pseudocode。
