# INT-S1 — S1 Foundation & Connector Ecosystem (v6)

**Milestone**: `.anws/v6/05A_TASKS.md` INT-S1  
**Date**: 2026-05-16  
**验证策略**: 单元测试 + 集成测试 + 冒烟路径；**无**真实 OpenClaw 宿主 E2E（分工见 INT-S4）。

## 退出标准对照

| 领域 | 状态 | 说明 |
| --- | --- | --- |
| State schemas (SessionChronicle / NarrativeState / RelationshipMemory / AgentGoal / MemoryStore) | pass | 见下表 #1–#5 |
| DynamicConnectorRegistry + CapabilityContractRegistry | pass | 见下表 #6–#7 |
| ConnectorTrustPolicy + manifest schema | pass | 见下表 #8 |
| v5 connector parity (Moltbook / InStreet / EvoMap) | pass | 见下表 #9 |
| ConnectorInventoryAudit (T5.1.3) | pass | 见下表 #10 |
| CLI ops surface (connector init / connector:status / connector:test) | pass | 见下表 #11 |
| v5 schema 兼容性回归 | pass | 见下表 #12 |
| Host capability probe + storage mode smoke | pass | INT-S1 v5 已覆盖，v6 不回归降级 |

---

## Given / When / Then 与证据

| # | Given | When | Then | 证据（测试名 / 命令） |
| --- | --- | --- | --- | --- |
| 1 | 空 state DB | `appendSessionChronicle` | 写入 chronicle row；字段齐全；时间序正确 | `T4.1.1 appendSessionChronicle writes row with full fields` — `tests/unit/storage/t4-1-1-session-chronicle.test.ts` |
| 2 | 空 narrative state | `updateNarrativeState` → `loadNarrativeState` | 可读写；revision 自增；sourceRefs / unsupportedClaims / status 语义完整 | `T4.1.2 narrative state store round-trip` — `tests/unit/storage/t4-1-2-narrative-state.test.ts` |
| 3 | 空 relationship state | `updateRelationshipMemory` → `loadRelationshipMemory` | tone/timing/topic deltas 可写；sourceRefs 和 confidence 保留 | `T4.1.3 relationship memory round-trip` — `tests/unit/storage/t4-1-3-relationship-memory.test.ts` |
| 4 | 空 goal state | `appendAgentGoal` / `updateAgentGoalStatus` / `listGoalsByStatus` | proposal/accepted/rejected/completed/paused 生命周期；origin 字段保留 | `T4.1.4 agent goal lifecycle` — `tests/unit/storage/t4-1-4-agent-goal.test.ts` |
| 5 | 空 memory store | `appendDreamOutput` / `acceptDreamOutput` / `archiveDreamOutput` / `listDreamOutputs` | candidate → accepted → archived 生命周期；active pointer 语义 | `T4.1.5 memory store lifecycle round-trip` — `tests/integration/storage/t4-1-5-memory-store-lifecycle.test.ts` |
| 6 | 多 manifest fixture | `DynamicConnectorRegistry.scan()` / `register()` | manifest 可解析；name/version/entry/trust 字段校验；重复注册幂等 | `T3.1.1 registry scan registers manifests` — `tests/unit/connectors/t3-1-1-dynamic-registry.test.ts` |
| 7 | registered manifest + capability map | `CapabilityContractRegistry.resolve()` | 契约匹配；namespace 隔离；v5 compat 路径 | `T3.1.2 capability contract registry resolves` — `tests/unit/connectors/t3-1-2-capability-registry.test.ts` |
| 8 | manifest with trust policy | `TrustPolicy.evaluate()` | allow / deny / require-review 决策；trustLevel 阈值 | `T3.1.1 trust policy evaluation` — `tests/integration/connectors/policy-layer.test.ts` |
| 9 | v5 connector implementation | manifest parity fixture + registry | Moltbook feed.read、InStreet engage、EvoMap work.discover/task.claim 行为一致 | `T3.2.1 v5 parity manifest fixtures` — `tests/unit/connectors/t3-2-1-v5-parity.test.ts`；`T3.3.1 near-real connector smoke` — `tests/integration/connectors/near-real-connector-smoke.test.ts` |
| 10 | connector scan/reload | `recordConnectorInventory()` | scanned/registered/skipped/conflicts/validationErrors/trust summary 写入 ledger | `T5.1.3 connector inventory audit` — `tests/unit/observability/connector-inventory-ledger.test.ts` |
| 11 | CLI surface | `sn connector init <name>` / `sn connector:status` / `sn connector:test <name>` | 命令可达；JSON-first 输出；dry-run 测试返回 honest 结果 | `T1.3.1 connector init` — `tests/unit/cli/t1-3-1-connector-init.test.ts`；`T1.2.3 connector:status/test` — `tests/unit/cli/t1-2-3-connector-status.test.ts` |
| 12 | v5 state schema artifact | v5 INT-S1 已验证的测试集 | v6 不破坏已有契约；state schema 扩展为新增列/表，无重命名/删除 | `pnpm test` 全量回归通过；v5 测试路径在 v6 CI 中保留 |

---

## 与 `05A_TASKS` INT-S1 验收条文映射

- **Given S1 tasks completed** — 上表 #1–#12 所列测试路径全部 green。
- **When run unit/API/integration suites and connector registry smoke** — 457 总测试，454 pass，3 fail（guidance review workflow 预存失败，与 S1 无关）。
- **Then state new schema works, manifest registers, custom runner pending trust, v5 regression passes** — SessionChronicle/NarrativeState/RelationshipMemory/AgentGoal/MemoryStore 可读写；registry 可扫描注册；trust policy 可评估；v5 parity fixture 通过。

---

## 命令汇总

```bash
npm run build
npx tsx --test tests/**/*.test.ts
```

`npm run build` 无 TypeScript error；`npx tsx --test` 457 测试中 454 pass。

---

## 已知边界

- **「真实冒烟」分工**：INT-S1 覆盖自动化 state/connector/ops 契约验证。**物理 OpenClaw 宿主会话冒烟** 由 INT-S4 独占。
- **Custom runner 执行**：trust policy 评估通过，但自定义 runner 的物理执行仍受宿主环境约束；runner 可用性在 INT-S4 host readiness 中验证。
- **v5 兼容性**：v6 新增表/列，不修改 v5 已存在列名；v5 测试集在 CI 中保留以检测意外回归。
