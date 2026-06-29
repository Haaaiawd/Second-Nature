# Wave 22 Code Review — 2026-05-16

## 1. 总结结论

Pass（静态语义下）。T3.1.1 DynamicConnectorRegistry 与 T4.1.1 SessionChronicle 均忠实兑现 design 契约与验收标准；25 单元测试全绿；未发现 Critical / High / Medium / Low 级 issue。

## 2. 审查范围与静态边界

已审：
- `src/connectors/manifest/manifest-schema.ts`
- `src/connectors/manifest/manifest-parser.ts`
- `src/connectors/registry/trust-policy.ts`
- `src/connectors/registry/manifest-scanner.ts`
- `src/connectors/registry/dynamic-connector-registry.ts`
- `src/connectors/registry/index.ts`
- `src/storage/db/schema/session-chronicle.ts`
- `src/storage/chronicle/session-chronicle-store.ts`
- `tests/unit/connectors/t3-1-1-dynamic-registry.test.ts`
- `tests/unit/storage/t4-1-1-session-chronicle.test.ts`

未审：真实 workspace manifest 文件系统权限边界、宿主 VM 中 sql.js 并发读写；这些属运行时/宿主验证边界，静态审查不覆盖。

## 3. 契约 → 代码映射摘要

- T3.1.1：`DynamicConnectorRegistry.reloadConnectors` 对应 design §5.1 `reloadConnectors()` 契约；`RegistrySnapshotStore` 对应 design §4.2 immutable snapshot + atomic swap；`parseConnectorManifestV6` 对应 design §4.2 safe YAML parse + schema validation。
- T4.1.1：`sessionChronicle` drizzle table 对应 design §6.1 `SessionChronicleEntry` 字段；`appendSessionChronicle` / `loadSessionChronicle` 对应 design §5.2 `StateSelfLayerPort`；indexes 对应 design §4.2 SessionChronicleStore 索引要求。

## 4. Lens 结果摘要

**L1 Contract Fidelity**：Pass。manifest v6 schemaVersion `sn.connector.v1`、trust status 枚举、conflict fail-closed 行为、chronicle eventKind / actor / result 枚举均与 design 一致；无未回流公共契约。

**L2 Task Fulfillment**：Pass。T3.1.1 验收标准 4 条（valid/invalid/duplicate/custom adapter）均有测试证据；T4.1.1 验收标准（append/read/owner reply projection）均有测试证据。Mock/Stub 边界清晰（temp dir + :memory: DB）。

**L3 Architecture Fit**：Pass。目录结构与 design §7.2 一致（`src/connectors/registry/`、`src/connectors/manifest/`、`src/storage/chronicle/`）；`DynamicConnectorRegistry` 不侵入旧 `CapabilityContractRegistry`，`SessionChronicleStore` 通过 `StateDatabase` 端口接入，边界干净。

**L4 Runtime/Safety**：Pass。manifest parser 使用 `yaml.JSON_SCHEMA` 阻止 custom constructors（`manifest-parser.ts:19`）；scanner 不执行代码；chronicle store 使用 drizzle ORM 参数化查询；`safeParseJson` 防止 malformed JSON crash。无 PII/密钥泄露路径。

**L5 Verification**：Pass。`pnpm typecheck` 0 error；`node --test` 25/25 pass。T3.1.1 覆盖 valid/invalid/trust/conflict/snapshot；T4.1.1 覆盖 append/filter/actor/limit/order/date-range/roundtrip。

**L6 Backflow/Handoff**：Pass。新增公共 API 均通过 `src/connectors/registry/index.ts` 与 `src/storage/index.ts` 导出；`package.json` 已补充 `js-yaml`（ADR-002 批准的 YAML parse 依赖）；测试文件名与 05A 证据产出路径对齐。

## 5. Issues

无。

## 6. 安全 / 测试覆盖补充

- 真实 workspace 中 `.second-nature/connectors/` 的不可写/不可读边界未由静态审查证明。
- sql.js 在真实宿主中的并发读写与 WAL 回退未由静态审查证明；现有 `:memory:` 单元测试已通过。
- `js-yaml` 的 `JSON_SCHEMA` 仅允许标准标量/序列/映射；若未来 manifest 需要自定义 tag，须重新评估 schema 选择。
