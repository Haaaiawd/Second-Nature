# Wave 132 Code Review — 2026-06-28

## 1. 总结结论

**Partial Pass** — 核心契约闭合、7-gate 顺序正确、验收标准已兑现、测试覆盖充分；存在 1 个 Medium 文档矛盾回流缺口（§1 `EVOLUTION_GATE_ORDER` 数组顺序与 §4.2 决策树不一致，实现层已按 §4.2 权威顺序适配）与若干 Low 残留。无 Critical / High 阻塞。

## 2. 审查范围与静态边界

**已读**：
- `src/shared/types/v9-contracts.ts` §7b（新增 EvolutionGateName / PRE_ACTIVATION_GATES / RollbackResult / EvolutionApplyResult / StageEvent / StageEventSink）
- `src/core/second-nature/body/connector-evolution/v9-connector-evolution-gates.ts`（全文）
- `src/core/second-nature/body/connector-evolution/v9-connector-evolution-engine.ts`（全文）
- `src/storage/v9-state-stores.ts` ConnectorVersion ports 块（新增 writeConnectorVersion / readConnectorVersionById / readActiveConnectorVersion / updateConnectorVersionStatus）
- `src/storage/db/schema/v9-entities.ts` connector_version schema
- `tests/unit/connectors/v9-connector-evolution-gates.test.ts`（全文）
- `tests/integration/v9/connector-evolution-activation.test.ts`（全文）
- `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md` §1 §3.7 §3.8 §3.9 §4.2 §5
- `.anws/v9/05A_TASKS.md` T6.3.1 任务定义

**未读**（故意收缩）：
- 未读 `body-connector-system.md` L0 全文（仅读 §5.1 关键段）
- 未读 ADR-004 全文（仅读契约引用段）

**需人工验证**：无。本波全部为静态可验证的契约 + 存储逻辑，无运行时 / 网络 / 浏览器依赖。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|---|---|
| `ConnectorEvolutionEngine` | `v9-connector-evolution-engine.ts` applyConnectorEvolution + rollbackConnectorVersion |
| 7-gate activation | `v9-connector-evolution-gates.ts` 7 个 gate 函数 + `v9-connector-evolution-engine.ts` PRE_ACTIVATION_GATES 串行循环 |
| `ConnectorVersion` activation | `applyConnectorEvolution` step 4: status=active + activatedAt + rollbackCommandHint |
| gate result writer | gateResults 数组贯穿 applyConnectorEvolution + ledger gateResultsJson |
| ledger write calls | `applyConnectorEvolution` step 5 + `rollbackConnectorVersion` ledger entry |
| canary fail rollback | `applyConnectorEvolution` step 6: canary fail → rollbackConnectorVersion |
| workspace-only file modification | 本波不修改 workspace 文件，只写 DB rows + ledger entries |

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 契约忠实度 | Partial Pass — 7-gate 顺序按 §4.2 权威决策树实现，但 §1 数组顺序矛盾 | `v9-contracts.ts:642-649` PRE_ACTIVATION_GATES = [schema, permission, sandbox, fixture, wet_probe, rollback_setup] vs `body-connector-system.detail.md:29-37` EVOLUTION_GATE_ORDER = [..., canary, rollback_setup] |
| L2 任务兑现 | Pass — 输出/验收/边界全承接 | `05A_TASKS.md:440-457` 输出 4 项全交付，验收标准 2 条全覆盖 |
| L3 架构适配 | Pass — ports 模式可测、依赖方向正确 | engine → gates + ports → state-stores → schema 单向；无循环依赖 |
| L4 静态运行风险 | Pass — gate 串行 fail-fast、rollback 前置检查完整 | pre-activation gate fail → blocked + candidate persist；canary fail → rollback + previous restore；rollback no-previous → blocked |
| L5 验证证据 | Pass — 覆盖充分 | 38 unit + 4 integration；7 gate 独立 + orchestrator active/blocked/rolled_back + rollback blocked/no-previous/missing |
| L6 回流一致性 | Partial Pass — task checkbox 已勾选，1 个文档矛盾未回流 | `05A_TASKS.md:440` ✅；§1 EVOLUTION_GATE_ORDER 数组顺序与 §4.2 矛盾未走 /change |

## 5. Issues

### Medium

**M-1 | L1+L6 | §1 `EVOLUTION_GATE_ORDER` 数组顺序与 §4.2 决策树矛盾（Contract Drift + Missing Change Backflow）**
- **Evidence**: `body-connector-system.detail.md:29-37`（`EVOLUTION_GATE_ORDER = ['schema', 'permission', 'sandbox', 'fixture', 'wet_probe', 'canary', 'rollback_setup']`——canary 在 rollback_setup 之前）vs `body-connector-system.detail.md:819-836`（§4.2 决策树：schema→permission→sandbox→fixture→wet_probe→rollback_setup→activate→canary——rollback_setup 在 canary 之前）vs `body-connector-system.detail.md:838`（§4.2 注释："canary gate runs *after* version activation and `rollback_setup`"）vs `v9-contracts.ts:642-649`（`PRE_ACTIVATION_GATES` 按 §4.2 顺序，不含 canary）
- **Impact**: §1 配置常量数组顺序错误，如果后续实现直接引用 `EVOLUTION_GATE_ORDER` 而非 `PRE_ACTIVATION_GATES`，会导致 canary 在 activate 之前运行。实现层已按 §4.2 权威顺序适配，不阻塞功能。
- **Minimum fix**: 走 `/change` 修正 §1 `EVOLUTION_GATE_ORDER` 数组顺序为 `['schema', 'permission', 'sandbox', 'fixture', 'wet_probe', 'rollback_setup', 'canary']`，与 §4.2 决策树一致。
- **Anchor**: `body-connector-system.detail.md §1:29-37`、`body-connector-system.detail.md §4.2:819-838`

### Low

**L-1 | L2 | Gate 函数为结构化验证器，真实 adapter 执行延后 T6.3.2（Mock Boundary Risk — 已声明）**
- **Evidence**: `v9-connector-evolution-gates.ts:425-430`（fixture gate: "No fixture provider injected — structural pass"）vs `v9-connector-evolution-gates.ts:447-452`（wet_probe gate: "No wet probe provider injected — structural pass"）vs 文件头注释 line 8-10
- **Impact**: fixture / wet_probe gates 在无 dep 注入时返回 structural pass，不执行真实 adapter。这是 T6.3.2 的职责，不是本波缺陷。
- **Minimum fix**: 无需本波修复。T6.3.2 实现 sandboxed adapter executor 后，注入 `getFixtureData` / `getWetProbeConfig` 即可激活真实检查。
- **Anchor**: `05A_TASKS.md:441`（任务描述只要求 7-gate orchestrator，不要求真实 adapter 调用）、`body-connector-system.detail.md §3.8:534-535`

**L-2 | L1 | `ConnectorEvolutionPlan` 契约缺 `workspaceRoot` 字段（Contract Drift — 已适配）**
- **Evidence**: `v9-contracts.ts:582-593`（`ConnectorEvolutionPlan` 无 `workspaceRoot`）vs `body-connector-system.detail.md:562`（§3.8 pseudocode: `plan.workspaceRoot`）vs `v9-connector-evolution-engine.ts:282`（`applyConnectorEvolution` 签名单独接收 `workspaceRoot` 参数）
- **Impact**: plan 契约与 pseudocode 不一致；实现层通过函数参数适配，不阻塞功能。
- **Minimum fix**: 走 `/change` 决定——(a) 在 `ConnectorEvolutionPlan` 补 `workspaceRoot` 字段 + schema 列；(b) 保持当前函数参数方式（推荐，因为 workspaceRoot 是运行时上下文，不是 plan 本身属性）。
- **Anchor**: `shared-v9-contracts.md §6`、`body-connector-system.detail.md §3.8:562`

**L-3 | L3 | `storageRowToVersion` 大量 `as unknown as` 类型断言（Complexity Risk）**
- **Evidence**: `v9-connector-evolution-engine.ts:264-282`（`storageRowToVersion` 接收一个手动定义的中间类型，调用处用 `as unknown as` 断言 drizzle row）
- **Impact**: 类型断言绕过了 TypeScript 编译时检查；如果 drizzle row 结构变化，运行时才会暴露。
- **Minimum fix**: 后续波次提取共享的 `ConnectorVersionRecord → ConnectorVersion` 转换函数到 state-store 层，让 port 直接返回 `ConnectorVersion`。本波不阻塞。
- **Anchor**: `v9-connector-evolution-engine.ts:264`

## 6. 安全 / 测试覆盖补充

**安全**：
- 无密钥 / PII 泄露风险：`writeConnectorVersion` 只持久化 sourceRefs + declaredCapabilities + assetPaths，不接触 credential。
- ledger `redactedPayloadJson` 只存 `declaredCapabilities`（activation）或 `{ reason: "canary_failure" }`（rollback），不存 adapter 代码内容。
- sandbox gate 检查 forbidden module patterns（child_process / vm2 / eval / Function / require / fs），T6.3.2 将提供文件内容级扫描。

**测试覆盖**：
- schema gate: sufficient（valid + missing manifestPath + invalid capabilities type）
- permission gate: sufficient（within scope + exceed scope + no capabilities + structural fallback pass/fail）
- sandbox gate: sufficient（manifest-only + safe adapter + child_process + vm2 structural fallback）
- fixture gate: sufficient（fixture exists + no fixture + structural pass）
- wet_probe gate: sufficient（config exists + no config + structural pass）
- rollback_setup gate: sufficient（resolvable + no previous + not resolvable）
- canary gate: sufficient（healthy + unhealthy + structural pass）
- orchestrator: sufficient（all pass → active + schema fail → blocked + permission fail → blocked + canary fail → rolled_back + canary fail no previous → blocked）
- rollback: sufficient（restore previous + no previous stable + previous missing）
- integration: sufficient（full activation + ledger + schema block + canary rollback + no-previous block）

**无法静态确认**：无。本波全部为静态可验证逻辑。

## 7. review-fix 决定

- **M-1**: 不在本波修复（需走 `/change` 修正 §1 配置常量数组顺序）。实现层已按 §4.2 权威顺序适配，不阻塞功能。
- **L-1**: 无需修复（T6.3.2 职责，当前实现诚实标记边界）。
- **L-2**: 不在本波修复（需走 `/change` 决定契约方式）。实现层已通过函数参数适配。
- **L-3**: 后续波次提取共享转换函数，本波不阻塞。

**Final verdict**: **Partial Pass** — 核心交付完整、测试充分、无 Critical/High 阻塞。M-1 文档矛盾已由实现层适配，建议下一波前走 `/change` 修正 §1 `EVOLUTION_GATE_ORDER` 数组顺序。
