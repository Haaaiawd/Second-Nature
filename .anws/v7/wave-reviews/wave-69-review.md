# Wave 69 Code Review — 2026-05-24

## 1. 总结结论

**Pass**

Wave 69 修复了 `07_CHALLENGE_REPORT.md` 全部 5 项发现（0 Critical / 3 High / 2 Medium）。
实现忠实兑现 challenge 承诺，契约边界清晰，测试覆盖补充到位，文档回流完整。

---

## 2. 审查范围与静态边界

| 读取项 | 范围 | 状态 |
|---|---|---|
| `src/storage/services/restore-snapshot-store.ts` | 全文件 + 新测试 | 已读 |
| `src/cli/ops/ops-router.ts` | restore 命令段 + OpsRouterDeps | 已读 |
| `tests/unit/storage/restore-snapshot-store.test.ts` | applyBoundedRestore 新增测试 | 已读 |
| 6 个 skip 测试文件 | skip 注释与上下文 | 已读 |
| `README.md`, `AGENTS.md`, `package.json` | 状态更新段 | 已读 |
| `reports/int-s6-e2e-release-gate-v7.md` | Wave 69 版本 | 已读 |
| `05A_TASKS.md` §T-ROS.C.1, §T-ROS.C.5 | 验收标准 | 已读 |
| `05B_VERIFICATION_PLAN.md` §T-ROS.C.1, §T-OBS.C.6 | 验证契约 | 已读 |
| `.anws/v7/07_CHALLENGE_REPORT.md` | 原始发现 | 已读 |

**未读/需人工验证**：OpenClaw host E2E 实机加载、self_health P95 多轮采样、真实 connector wet probe HTTP 往返。

---

## 3. 契约 → 代码映射摘要

| 承诺来源 | 核心承诺 | 实现区域 |
|---|---|---|
| 05A T-ROS.C.1 AC | `restore` 触发 RestoreSnapshotStore + RestoreAuditService，不恢复 credential | `ops-router.ts:850` 调用 `applyBoundedRestore`；audit event 使用 restoreResult 字段 |
| 05A T-ROS.C.5 AC | v6 tests 全部 pass 或有 justified skip | 9 个 `test.skip`/`it.skip` + 单行理由注释 |
| CR-CODE-002 | Wire real restore operation port into restore | `RestoreSnapshotStore.applyBoundedRestore` 接口 + `ops-router.ts` 依赖注入 |
| CR-CODE-004 | README/AGENTS 状态不 stale | README badge + v7 status 文本；AGENTS Wave 68/69 块更新 |
| CR-CODE-005 | `pnpm lint` 可执行 | `package.json:63` `"lint": "tsc --noEmit"` |

---

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 Contract Fidelity | Pass | `ops-router.ts:850` 调用 `applyBoundedRestore`；envelope.ok 联合 restoreResult.ok + auditResult.ok；credential 始终被 `DEFAULT_EXCLUDED_KINDS` 拦截 |
| L2 Task Fulfillment | Pass | Wave 69 5 项 challenge 发现全部有代码/测试/文档对应物；无 mock 误入正式路径 |
| L3 Architecture Fit | Pass | `parseSnapshotRow` 提取消除 `loadLatestSnapshot`/`listSnapshots`/`applyBoundedRestore` 三处重复；`applyBoundedRestore` 内聚于 RestoreSnapshotStore 合理 |
| L4 Runtime Risk | Pass | `kind` 严格来自 `ALL_RESTORABLE_KINDS` 过滤后的 whitelist，`INSERT OR REPLACE` 无 SQL 注入；输入参数 `restoreTarget`/`fromVersion`/`toVersion` 在 ops-router 层已校验；snapshot 不存在时优雅降级 |
| L5 Verification Evidence | Pass | 3 个新增 applyBoundedRestore 单元测试覆盖 no-snapshot / payload-restore / latest-fallback；9 skip 均附 owner+scope+justification |
| L6 Backflow | Pass | README badge + 状态文本；AGENTS 当前状态块 + Wave 68 下一步；lint 脚本；INT-S6 报告 AC-9 / skip 清单 / 07 修复追踪表 |

---

## 5. Issues

**无 Critical / High / Medium。**

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Low | L3 | Table-name coupling in applyBoundedRestore | `restore-snapshot-store.ts:285` `INSERT OR REPLACE INTO ${kind}` | Future restorable kind 表名若与 kind 值不一致会导致恢复失败 | 在 `applyBoundedRestore` 中显式映射 kind→tableName 或文档约束「restorable kind 必须与表名一致」 | T-SMS.C.6 |

---

## 6. 安全 / 测试覆盖补充

- **密钥/PII**: `applyBoundedRestore` 的 `DEFAULT_EXCLUDED_KINDS` 检查与 `payload[kind]` 遍历互不重叠（`credential` 等不在 `ALL_RESTORABLE_KINDS` 中），双重保险。无 key 明文进入 snapshot payload。
- **运行时边界**: `sqlite.run` 的参数化 values 为 `SqlValue[]`，类型安全。`exactMatch` 查询使用参数化 `?`。
- **无法静态确认**: OpenClaw 实机 heartbeat P95、真实 connector wet probe HTTP、host screenshot/log 仍需 INT-S6 手工验证条目覆盖。

---

*Wave 69 Code Review — 最高严重度: Low (1) — Pass*
