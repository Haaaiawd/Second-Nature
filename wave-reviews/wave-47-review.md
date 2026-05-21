# Wave 47 Code Review — 2026-05-21

## 1. 总结结论

**Pass**

Wave 47 忠实实现了 T-SMS.F.2（SQLite schema migration mechanism）和 T-OBS.F.1（audit family registry）。所有验收标准有对应测试覆盖，无 Critical/High 发现。

## 2. 审查范围与静态边界

**已读**:
- `src/storage/db/migration-runner.ts`
- `src/storage/db/migrations/index.ts`
- `src/storage/db/migrations/v7-001-foundation.ts`
- `src/observability/audit/family-registry.ts`
- `src/observability/audit/audit-family-registry.json`
- `tests/unit/storage/migration-runner.test.ts`
- `tests/integration/storage/schema-migration.test.ts`
- `tests/unit/observability/family-registry.test.ts`
- `src/storage/db/index.ts`（现有 DB 初始化）
- `src/observability/audit/audit-envelope.ts`（AuditEventFamily 类型定义）
- `.anws/v7/05A_TASKS.md` T-SMS.F.2 / T-OBS.F.1 条目
- `.anws/v7/05B_VERIFICATION_PLAN.md` #t-sms-f-2 / #t-obs-f-1

**未读**: `04_SYSTEM_DESIGN/` 详细设计文档（物理缺失，以 05A 契约 + ADR 为权威，与 Wave 46 同一风险备注）。

**需人工验证**: migration runner 在真实文件系统 DB（非 :memory:）上的持久化行为。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|------|---------|
| `_meta.schema_version` 递增管理 | `src/storage/db/migration-runner.ts:44-66` |
| 迁移失败标记 degraded 而非崩溃 | `src/storage/db/migration-runner.ts:68-80,107-118` |
| v7 全量新增表 | `src/storage/db/migrations/v7-001-foundation.ts` |
| 新增列 DEFAULT NULL | v7-001-foundation.ts 所有 ALTER TABLE 与 CREATE TABLE 可空列 |
| 8 系统 audit family 注册 | `src/observability/audit/audit-family-registry.json` |
| 未知 family 拒绝 `unknown_audit_family` | `src/observability/audit/family-registry.ts:55-58` |

## 4. Lens 结果摘要

| Lens | 结论 |
|------|------|
| L1 契约忠实度 | Pass — migration-runner API（`runMigrations`, `isMigrationFailed`）与 05A 验收一致；family-registry `validateFamily` 返回 `unknown_audit_family` 与 05A/05B 一致 |
| L2 任务兑现 | Pass — 05A 产出文件路径全部匹配；证据产出（8+4+9 = 21 tests）覆盖所有验收标准 |
| L3 架构适配 | Pass — 新文件放置在 `src/storage/db/`（state-memory-system）和 `src/observability/audit/`（observability-health-system），符合 02_ARCHITECTURE_OVERVIEW 系统边界 |
| L4 静态运行风险 | Pass — migration 使用 BEGIN EXCLUSIVE + ROLLBACK 保护；无 credential/PII 泄露 |
| L5 验证证据 | Pass — 单元测试覆盖正常/边界/异常路径；集成测试覆盖完整 DB 初始化、幂等、失败、DEFAULT NULL |
| L6 回流一致性 | Pass — 05A checkbox 已更新；migration-runner 为新增模块，无需 README/CLI 回流 |

## 5. Issues

无。

## 6. 安全 / 测试覆盖补充

- `loadAuditFamilyRegistry()` 使用 `readFileSync` 从文件系统加载 JSON 注册表。在 bundle/打包环境下 JSON 文件需随构建产出复制（构建脚本已在 Wave 46 前置条件中被证实正常拷贝 dist）。
- migration-runner `markMigrationFailed` 对 error message 做了单引号转义（`safeError`），避免 SQL 注入。对极端非 ASCII 或含 NUL 的错误消息，**无法通过静态审查确认**运行时安全性，但属低概率场景。
