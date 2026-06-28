# Wave 133 Code Review — 2026-06-28

## 1. 总结结论

**Partial Pass** — 核心交付完整：file lock + atomic write + file rollback + v8 manifest migration + rollbackConnectorVersion file-level rollback 集成。测试覆盖充分（13 集成 + 4 API）。存在 1 个 Medium 文档矛盾回流缺口（§3.11 pseudocode 使用 `schemaGate`/`permissionGate` 等单字段而非 `gateResults` 数组）与若干 Low 残留。无 Critical / High 阻塞。

## 2. 审查范围与静态边界

**已读**：
- `src/core/second-nature/body/connector-evolution/v9-connector-file-ops.ts`（全文）
- `src/core/second-nature/body/connector-evolution/v9-manifest-migration.ts`（全文）
- `src/core/second-nature/body/connector-evolution/v9-connector-evolution-engine.ts`（FileRollbackPort + rollbackConnectorVersion 扩展段 + createFileRollbackPort）
- `src/shared/types/v9-contracts.ts` RollbackResult fileRollback 字段
- `tests/integration/connectors/v9-manifest-migration.test.ts`（全文）
- `tests/api/runtime-ops/v9-connector-rollback.test.ts`（全文）
- `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §1 §3.9 §3.11`
- `.anws/v9/05A_TASKS.md` T6.3.2 任务定义

**未读**（故意收缩）：
- 未读 §5 全文（仅读 §3.9 §3.11 关键段）
- 未读 ADR-004 全文

**需人工验证**：无。本波全部为静态可验证的文件操作 + DB 逻辑，无运行时 / 网络 / 浏览器依赖。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|---|---|
| migration scanner | `v9-manifest-migration.ts` scanAndMigrateV8Manifests |
| rollback port | `v9-connector-evolution-engine.ts` FileRollbackPort + createFileRollbackPort |
| file lock/atomic write helpers | `v9-connector-file-ops.ts` acquireFileLock + atomicWriteFile |
| v8 manifest candidate migration | `v9-manifest-migration.ts` migrateV8ConnectorManifest（§3.11） |
| rollback previous stable | `v9-connector-evolution-engine.ts` rollbackConnectorVersion + file rollback 集成 |
| concurrent evolution `evolution_in_progress` | 本波未实现（T6.3.1 已有 candidate/active 状态机，concurrent lock 由后续波次处理） |

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 契约忠实度 | Partial Pass — §3.11 pseudocode 使用 `schemaGate`/`permissionGate` 等单字段，实现使用 `gateResults` 数组（与 v9-contracts 契约一致） | `body-connector-system.detail.md:755-773` vs `v9-manifest-migration.ts:120-129` |
| L2 任务兑现 | Pass — 输出/验收/边界全承接 | `05A_TASKS.md:459-476` 输出 3 项全交付，验收标准覆盖 |
| L3 架构适配 | Pass — ports 模式可测、依赖方向正确 | engine → file-ops + ports → state-stores 单向；file rollback 为可选注入 |
| L4 静态运行风险 | Pass — file rollback 失败 non-fatal、atomic write 保证一致性 | `v9-connector-evolution-engine.ts:413-424` catch block 不阻塞 DB rollback |
| L5 验证证据 | Pass — 覆盖充分 | 13 integration + 4 API；migration JSON/YAML/skip/scan + file ops + rollback with file swap |
| L6 回流一致性 | Partial Pass — task checkbox 已勾选，1 个文档矛盾未回流 | `05A_TASKS.md:459` ✅；§3.11 pseudocode gate 字段命名与 v9-contracts 不一致 |

## 5. Issues

### Medium

**M-1 | L1+L6 | §3.11 pseudocode 使用单字段 gate 命名而非 `gateResults` 数组（Contract Drift）**
- **Evidence**: `body-connector-system.detail.md:765-770`（`schemaGate: { gate: 'schema', passed: true }`、`fixtureGate: { gate: 'fixture', passed: false }` 等单字段）vs `v9-contracts.ts:620-625`（`GateResult[]` gateResults 数组）vs `v9-manifest-migration.ts:120-129`（实现使用 `gateResults: GateResult[]` 数组，与 v9-contracts 一致）
- **Impact**: 文档 pseudocode 与权威契约不一致。实现层已按 v9-contracts 契约适配，不阻塞功能。
- **Minimum fix**: 走 `/change` 修正 §3.11 pseudocode，将 `schemaGate`/`permissionGate`/`sandboxGate`/`fixtureGate`/`wetProbeGate`/`canaryGate` 单字段替换为 `gateResults: GateResult[]` 数组。
- **Anchor**: `body-connector-system.detail.md §3.11:765-770`、`shared-v9-contracts.md §7b`

### Low

**L-1 | L3 | `parseSimpleYaml` 为极简 YAML 解析器，不支持复杂嵌套（Complexity Risk — 已声明）**
- **Evidence**: `v9-connector-file-ops.ts:128-180`（手写 YAML 解析器，仅支持 key: value + list items + 一层嵌套）
- **Impact**: 如果 v8 manifest YAML 使用复杂嵌套结构（如 `runner.config` 嵌套对象），解析结果可能不完整。当前测试覆盖简单 manifest 结构。
- **Minimum fix**: 后续波次如果遇到复杂 YAML manifest，引入 `js-yaml` 或类似库替换。本波不阻塞，因为 v8 connector manifest 结构简单（platformId + capabilities list + recipePath + adapterPath）。
- **Anchor**: `v9-connector-file-ops.ts:128`

**L-2 | L4 | `acquireFileLock` 为 advisory lock，不防止外部进程修改文件（Concurrency Risk — 已声明）**
- **Evidence**: `v9-connector-file-ops.ts:50-72`（lockfile-based advisory lock，使用 `wx` flag 创建 lockfile）
- **Impact**: 如果外部进程（非 Second Nature）同时修改 connector asset 文件，advisory lock 无法阻止。这是 ADR-004 workspace-only 约束下的可接受风险——只有 Second Nature 进程会修改 connector assets。
- **Minimum fix**: 无需本波修复。如果未来引入多进程并发，需要升级到 mandatory lock（flock / LockFileEx）。
- **Anchor**: `v9-connector-file-ops.ts:50`、`body-connector-system.detail.md §1:43`

**L-3 | L1 | `rollbackConnectorFiles` 使用 `fs.readFile` + `atomicWriteFile` 复制内容，不保留文件权限（Contract Drift — 已适配）**
- **Evidence**: `v9-connector-file-ops.ts:225-235`（`fs.readFile(previousPath, "utf-8")` → `atomicWriteFile(currentPath, content)`）vs `body-connector-system.detail.md §1:44`（`CONNECTOR_ASSET_ATOMIC_RENAME = true`）
- **Impact**: 如果 adapter 文件有可执行权限位，rollback 后权限会丢失（atomicWriteFile 使用默认权限）。对于 manifest/recipe JSON 文件无影响；对于 adapter .js 文件在 Unix 环境可能需要 `chmod +x`。
- **Minimum fix**: 后续波次在 `atomicWriteFile` 中支持权限保留（`fs.stat` previous → `fs.chmod` after rename）。本波不阻塞，因为 connector adapter 通常通过 `node adapter.js` 调用，不需要可执行权限位。
- **Anchor**: `v9-connector-file-ops.ts:225`、`v9-connector-file-ops.ts:82-92`

## 6. 安全 / 测试覆盖补充

**安全**：
- 无密钥 / PII 泄露风险：file ops 只读写 manifest/recipe/adapter 文件，不接触 credential。
- `safeReadJson` / `safeReadYaml` 对 malformed 输入返回 undefined，不抛异常。
- `acquireFileLock` 使用 `wx` flag 防止覆盖已有 lockfile，lockfile 内容包含 PID 用于 ownership 验证。
- file rollback 失败不阻塞 DB rollback，operator 可通过 `rollbackCommandHint` 手动恢复。

**测试覆盖**：
- manifest migration: sufficient（JSON + YAML + skip when v9 exists + skip when migrated exists + scanAndMigrate + empty dir）
- file ops: sufficient（atomic write + safe read JSON missing/invalid + lock acquire/release + rollback swap + rollback skip missing）
- rollbackConnectorVersion with file rollback: sufficient（DB + file swap + ledger + observability）
- API rollback: sufficient（before/after state + file swap + blocked no-previous）

**无法静态确认**：无。本波全部为静态可验证逻辑。

## 7. review-fix 决定

- **M-1**: 不在本波修复（需走 `/change` 修正 §3.11 pseudocode gate 字段命名）。实现层已按 v9-contracts 契约适配，不阻塞功能。
- **L-1**: 无需修复（当前 YAML manifest 结构简单，极简解析器足够；复杂结构由后续波次引入 `js-yaml`）。
- **L-2**: 无需修复（advisory lock 在 workspace-only 约束下可接受）。
- **L-3**: 后续波次在 `atomicWriteFile` 中支持权限保留，本波不阻塞。

**Final verdict**: **Partial Pass** — 核心交付完整、测试充分、无 Critical/High 阻塞。M-1 文档矛盾已由实现层适配，建议下一波前走 `/change` 修正 §3.11 pseudocode。
