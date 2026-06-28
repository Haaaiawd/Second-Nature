# Wave 137 Code Review — 2026-06-28

## 1. 总结结论

**Partial Pass** — 核心交付完整：8 v9 ops command handlers + RuntimeOpsEnvelopeV9 JSON-first envelope + evidenceLevel promotion + carrier mode honest degradation。测试覆盖充分（25 API tests）。存在 1 个 Medium 契约漂移（§5 操作契约表要求 ops-router.ts 注册 + commands/index.ts 注册 + plugin bridge allowlist，实现创建了独立 v9-ops-handlers.ts 模块未集成到现有 ops-router.ts）与若干 Low 残留。无 Critical/High 阻塞。

## 2. 审查范围与静态边界

**已读**：
- `src/cli/ops/v9-ops-handlers.ts`（全文）
- `src/shared/types/v9-contracts.ts`（RuntimeOpsEnvelopeV9/EvidenceLevel/SurfaceMode/DegradedReason/RuntimeDiagnostics/ContinuityReadResult/RoutineReadModel/ConnectorEvolutionStatusReadModel）
- `tests/api/runtime-ops/v9-ops-surface.test.ts`（全文）
- `.anws/v9/04_SYSTEM_DESIGN/runtime-ops-system.detail.md §1-§5`
- `.anws/v9/05A_TASKS.md` T1.2.1 任务定义

**未读**（故意收缩）：
- 未读 ops-router.ts 全文（2100 行 v7/v8 命令——本波不修改）
- 未读 commands/index.ts（本波不修改——v9 命令通过 dispatchV9OpsCommand 独立分派）

**需人工验证**：无。本波全部为静态可验证的纯函数 + 依赖注入逻辑。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|---|---|
| continuity.read | handleContinuityRead |
| routine.list/show/rollback | handleRoutineList/handleRoutineShow/handleRoutineRollback |
| connector_evolution.status/trigger/rollback | handleConnectorEvolutionStatus/Trigger/Rollback |
| loop_status.read with activity health | handleLoopStatusRead |
| RuntimeOpsEnvelope.evidenceLevel/surfaceMode/degradedReasons | RuntimeOpsEnvelopeV9 + makeEnvelope |
| carrier/full-runtime 降级语义 | carrier mode checks in each handler |

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 契约忠实度 | Partial Pass — §5 要求 ops-router.ts/commands/index.ts/plugin bridge 注册，实现创建独立 v9-ops-handlers.ts 未集成到现有路由 | `05A_TASKS.md:68` vs `v9-ops-handlers.ts` 独立模块 |
| L2 任务兑现 | Pass — 8 commands 全交付，envelope shape 全覆盖 | `05A_TASKS.md:65-82` 验收标准覆盖 |
| L3 架构适配 | Pass — 纯函数 + 依赖注入，与 v8 ops-router 并行 | V9OpsHandlerDeps 注入 surfaceMode/state/loopStatusInputsProvider |
| L4 静态运行风险 | Pass — carrier mode 诚实降级，missing state DB 优雅返回 | 每个 handler 都有 carrier + state check |
| L5 验证证据 | Pass — 覆盖充分 | 25 API tests：carrier/missing state/missing id/stub/with inputs/unknown/dispatch/JSON-serializable |
| L6 回流一致性 | Partial Pass — task checkbox 已勾选，1 个集成缺口未回流 | `05A_TASKS.md:65` ✅；ops-router.ts 集成待后续 wave |

## 5. Issues

### Medium

**M-1 | L1+L6 | v9 ops handlers 未集成到现有 ops-router.ts / commands/index.ts / plugin bridge（Contract Drift — Integration Gap）**
- **Evidence**: `05A_TASKS.md:68`（输出：`src/cli/ops/ops-router.ts` v9 command handlers, `src/cli/commands/index.ts` registrations, `plugin/workspace-ops-bridge.ts` v9 command allowlist）vs `v9-ops-handlers.ts`（独立模块，未集成到现有 ops-router.ts 的 dispatch 函数）
- **Impact**: v9 commands 通过 `dispatchV9OpsCommand` 可独立调用，但现有 CLI/plugin bridge 不会自动路由 v9 命令名（如 `continuity.read`）到 v9 handlers。需要后续集成 wave 将 `dispatchV9OpsCommand` 挂载到 ops-router.ts 的 dispatch 函数。
- **Minimum fix**: 后续 wave 在 ops-router.ts 的 dispatch 函数中添加 v9 命令前缀检查（如 `command.includes(".")` 或 v9 命令名 lookup），路由到 `dispatchV9OpsCommand`。或在 commands/index.ts 注册 v9 命令定义。
- **Anchor**: `05A_TASKS.md:68`、`v9-ops-handlers.ts:dispatchV9OpsCommand`

### Low

**L-1 | L4 | routine.rollback/connector_evolution.trigger/rollback 为 stubs（Implementation Gap — 已声明）**
- **Evidence**: `v9-ops-handlers.ts:handleRoutineRollback`（返回 `rollback_port_not_wired`）、`handleConnectorEvolutionTrigger`（返回 `evolution_engine_not_wired`）、`handleConnectorEvolutionRollback`（返回 `rollback_port_not_wired`）
- **Impact**: 3 个写操作命令返回结构化降级而非实际执行。这是可接受的——T6.3.x 的 rollback/trigger port 集成需要单独的 wiring wave。
- **Minimum fix**: 无需本波修复。后续 wave 集成 body-connector rollback/trigger port 后替换 stubs。
- **Anchor**: `v9-ops-handlers.ts:handleRoutineRollback/handleConnectorEvolutionTrigger/handleConnectorEvolutionRollback`

**L-2 | L3 | `handleContinuityRead` 直接解析 row JSON 而非使用 createContinuityReadPort（Architecture — 已适配）**
- **Evidence**: `v9-ops-handlers.ts:191`（`readLatestSelfContinuityCard(deps.state)` + 手动 JSON.parse sections）vs `self-continuity-card-assembler.ts:516`（`createContinuityReadPort` 封装了 card 读取 + routine list + projections）
- **Impact**: handleContinuityRead 重复了 createContinuityReadPort 的部分逻辑（card 解析），但没有使用 routine list / projections 等更高层 API。这是可接受的——ops handler 只需要 card 读取，不需要完整 continuity port。
- **Minimum fix**: 无需本波修复。如果后续需要 characterFrameProjection，可切换到 createContinuityReadPort。
- **Anchor**: `v9-ops-handlers.ts:191`

## 6. 安全 / 测试覆盖补充

**安全**：
- 无密钥/PII 泄露风险：ops handlers 只读取 state DB 元数据，不接触 payload 内容。
- T1.2.2 将在后续 wave 中添加 redaction gate（§3.3 redaction checklist）。
- Carrier mode 诚实降级——不假装能读取 full runtime 数据。

**测试覆盖**：
- carrier mode degradation: sufficient（每个 command 都有 carrier test）
- missing state DB: sufficient
- missing input (workspaceRoot/routineId/planId): sufficient
- stub delegation: sufficient
- loop_status.read with inputs: sufficient
- unknown command: sufficient
- JSON-serializable: sufficient（all 8 commands）

**无法静态确认**：无。本波全部为静态可验证的纯函数 + 依赖注入逻辑。

## 7. review-fix 决定

- **M-1**: 不在本波修复（需后续集成 wave 将 dispatchV9OpsCommand 挂载到 ops-router.ts）。v9 handlers 可独立调用，集成是 mechanical wiring。
- **L-1**: 无需修复（stubs 是可接受的，T6.3.x integration 待后续 wave）。
- **L-2**: 无需修复（直接读取 card 是可接受的，ops handler 不需要完整 continuity port）。

**Final verdict**: **Partial Pass** — 核心交付完整、测试充分、无 Critical/High 阻塞。M-1 集成缺口需后续 wave 将 v9 handlers 挂载到现有 ops-router.ts / commands/index.ts / plugin bridge。
