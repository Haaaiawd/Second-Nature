# Wave 131 Code Review — 2026-06-28

## 1. 总结结论

**Partial Pass** — 核心契约闭合、验收标准已兑现、测试覆盖充分；存在 1 个 Medium 契约回流缺口（`routine_guard_sandbox_failed` reason code 在 §3.5 pseudocode 与 §6.3 权威枚举之间不一致，实现层已 fold 适配但未回流文档）与若干 Low 残留。无 Critical / High 阻塞。

## 2. 审查范围与静态边界

**已读**：
- `src/shared/types/v9-contracts.ts` §6 / §6.3 / §6.4（新增）
- `src/core/second-nature/body/tool-routine/v9-routine-validation.ts`（全文）
- `src/core/second-nature/body/tool-routine/v9-tool-routine-registry.ts`（全文）
- `src/storage/v9-state-stores.ts` ToolRoutine + RoutineExecutionTrace ports 块
- `src/storage/db/schema/v9-entities.ts` tool_routine / routine_execution_trace schema
- `src/storage/db/migrations/v9-001-self-continuity.ts`（migration 已落盘，无需新增）
- `tests/unit/body/v9-tool-routine-registry.test.ts`（全文）
- `tests/integration/v9/tool-routine-install-invoke.test.ts`（全文）
- `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md` §2 §3.5 §3.6
- `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md` §6 §6.3
- `.anws/v9/05A_TASKS.md` T6.2.2 任务定义
- `.anws/v9/05B_VERIFICATION_PLAN.md` T6.2.2 验证项

**未读**（故意收缩）：
- 未读 `body-connector-system.md` L0 全文（仅读 §5.1 §6.1 关键段）
- 未读 ADR-005 全文（仅读契约引用段）

**需人工验证**：无。本波全部为静态可验证的契约 + 存储逻辑，无运行时 / 网络 / 浏览器依赖。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|---|---|
| `ToolRoutineRegistry` lifecycle | `v9-tool-routine-registry.ts` install/invoke/retire/list/load |
| `validateGuardSchema`（guard grammar validation owner） | `v9-routine-validation.ts:validateGuardSchema`（语法复用 `parseToolRoutineGuardSchema` + 权限扩张检查） |
| `validateSandboxCompliance` | `v9-routine-validation.ts:validateSandboxCompliance`（declarative_only/scriptable + step count/timeout/capability 门禁） |
| `invokeToolRoutine` | `v9-tool-routine-registry.ts:invokeToolRoutine`（load active → policy gate → parse steps → trace → persist） |
| `RoutineExecutionTrace` | `v9-contracts.ts §6.4` + `v9-state-stores.ts:writeRoutineExecutionTrace` + `routine_execution_trace` schema |
| routine active/retired mapping | `ToolRoutineRecordRow.status` + `updateToolRoutineStatus` |
| routine execution still policy-bound | `invokeToolRoutine` step 2 检查 `ctx.policyAllowed` |

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 契约忠实度 | Partial Pass — 核心契约闭合，1 个 reason code 不一致已适配 | `v9-contracts.ts:1118-1120`（枚举无 `routine_guard_sandbox_failed`）vs `body-connector-system.detail.md:421`（pseudocode 用该 code） |
| L2 任务兑现 | Pass — 输出/验收/边界全承接 | `05A_TASKS.md:419-436` 输出 4 项全交付，验收标准 2 条全覆盖 |
| L3 架构适配 | Pass — ports 模式可测、依赖方向正确 | registry → ports → state-stores → schema 单向；无循环依赖 |
| L4 静态运行风险 | Pass — 输入校验、错误路径、回滚完整 | install 3 层 validation；invoke policy gate + not-found + retired 三路径；retire 状态前置检查 |
| L5 验证证据 | Pass — 覆盖充分 | 30 unit + 5 integration；guard syntax/expansion/sandbox/install/invoke/retire/read-model 全等价类 |
| L6 回流一致性 | Partial Pass — task checkbox 已勾选，1 个契约不一致未回流 | `05A_TASKS.md:419` ✅；`routine_guard_sandbox_failed` 文档不一致未走 /change |

## 5. Issues

### Medium

**M-1 | L1+L6 | `routine_guard_sandbox_failed` reason code 契约不一致（Contract Drift + Missing Change Backflow）**
- **Evidence**: `shared-v9-contracts.md §6.3:486-489`（权威枚举只有 `routine_guard_schema_invalid` / `routine_permission_expansion_denied` / `routine_guard_policy_denied`）；`body-connector-system.detail.md §3.5:421`（pseudocode 用 `routine_guard_sandbox_failed`）；`v9-contracts.ts:1118-1120`（V9ReasonCode 枚举无该 code）；`v9-tool-routine-registry.ts:268`（实现 fold 进 `routine_guard_schema_invalid` + detail）
- **Impact**: sandbox 失败的 reason code 在文档间不一致；调用方按 §3.5 pseudocode 匹配 `routine_guard_sandbox_failed` 会漏判。实现层已用 detail 区分，不会丢失信息，但契约表面不闭合。
- **Minimum fix**: 走 `/change` 决定二选一——(a) 在 V8ReasonCode 枚举补 `routine_guard_sandbox_failed` 并同步 §6.3；(b) 在 §3.5 pseudocode 改用 `routine_guard_schema_invalid`。推荐 (a) 因为 sandbox 失败与 guard schema 语法失败语义不同，独立 reason code 更利于 observability 定位。
- **Anchor**: `shared-v9-contracts.md §6.3`、`body-connector-system.detail.md §3.5`、`05B_VERIFICATION_PLAN.md:164`

### Low

**L-1 | L1 | `ToolRoutineReadModel.rollbackRef` 类型与 `ToolRoutine.rollbackRef` 不一致（Contract Drift）**
- **Evidence**: `v9-contracts.ts:846`（`ToolRoutineReadModel.rollbackRef?: SourceRef`）vs `v9-contracts.ts:384`（`ToolRoutine.rollbackRef: string`）；`v9-tool-routine-registry.ts:218`（实现层适配 `{ family: "routine", id: row.rollbackRef }`）
- **Impact**: read model 与 entity 的 rollbackRef 类型不同；调用方需感知两种形态。实现层已在边界适配，不会破坏运行，但契约表面不闭合。
- **Minimum fix**: 走 `/change` 统一——推荐 read model 也用 `string`（与 entity 一致），或 entity 也改 `SourceRef`（但会破坏已交付的 T4.2.2/T6.2.1 代码）。
- **Anchor**: `shared-v9-contracts.md §6`、`body-connector-system.detail.md §2:166-181`

**L-2 | L2 | scriptable step 执行为 `skipped` 占位（Mock Boundary Risk — 已声明）**
- **Evidence**: `v9-tool-routine-registry.ts:455-473`（`executeStep` 对 scriptable 返回 `skipped` + `detail: "scriptable_executor_pending_T6_3_x"`）；文件头注释 line 27-28 已声明边界
- **Impact**: 当前 `invokeToolRoutine` 不实际执行 scriptable steps，trace 记录为 skipped。这是 T6.3.x 的职责，不是本波缺陷，但若调用方误以为 `executed` = 真实执行会误判。
- **Minimum fix**: 无需本波修复。T6.3.x 实现 sandboxed adapter executor 后，`executeStep` 接入真实执行。当前 `skipped` + detail 已诚实标记边界。
- **Anchor**: `05A_TASKS.md:420`（任务描述只要求 invocation trace，不要求真实 connector 调用）、`body-connector-system.detail.md §3.6:472-476`

**L-3 | L3 | `inferCapabilitySideEffectClass` 在 validation 与 policy evaluator 间重复（Complexity Risk）**
- **Evidence**: `v9-routine-validation.ts:54-80`（本波新增）vs `v9-autonomy-policy-evaluator.ts:116-137`（T4.2.2 已有相同实现）
- **Impact**: 同一启发式函数在两处重复；未来 capability metadata registry 替换时需同步修改两处。
- **Minimum fix**: 后续波次提取到共享模块（如 `src/shared/capability-side-effect.ts`）。本波不阻塞，因为两处实现完全一致且注释已标注"interim heuristic"。
- **Anchor**: `v9-autonomy-policy-evaluator.ts:115`（注释 "interim heuristic until T6.2.2 provides a capability metadata registry"）

## 6. 安全 / 测试覆盖补充

**安全**：
- 无密钥 / PII 泄露风险：`writeToolRoutine` / `writeRoutineExecutionTrace` 只持久化 sourceRefs + payload，不接触 credential。
- `redactionClass` 字段已暴露在 `WriteToolRoutineOptions`，调用方可标记敏感 routine。
- ledger entry 的 `redactedPayloadJson` 只存 `name` + `triggerCapabilities`，不存 stepsJson / guardSchemaJson 内容。

**测试覆盖**：
- guard syntax: sufficient（valid + invalid version + missing fields）
- sandbox policy: sufficient（declarative_only/scriptable + step count + timeout + allowed/denied capabilities）
- install: sufficient（active + denied policy + denied guard + denied sandbox + denied expansion + supersede ledger）
- invoke: sufficient（executed + denied policy + not found + retired + scriptable skipped）
- retire: sufficient（active→retired + ledger + non-existent fail）
- read model: sufficient（loadActive + listByStatus + listByCapabilityPattern）
- 集成: sufficient（install+invoke+trace 全链路 + DB 持久化 + ledger 查询）

**无法静态确认**：无。本波全部为静态可验证逻辑。

## 7. review-fix 决定

- **M-1**: 不在本波修复（需走 `/change` 回流文档契约）。实现层已 fold 适配，不阻塞功能。
- **L-1**: 不在本波修复（需走 `/change` 统一契约类型）。实现层已边界适配。
- **L-2**: 无需修复（T6.3.x 职责，当前实现诚实标记边界）。
- **L-3**: 后续波次提取共享模块，本波不阻塞。

**Final verdict**: **Partial Pass** — 核心交付完整、测试充分、无 Critical/High 阻塞。M-1 契约不一致已由实现层适配，建议下一波前走 `/change` 回流 `routine_guard_sandbox_failed` reason code。
