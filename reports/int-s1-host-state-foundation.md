# INT-S1 — Host & State Foundation

**Milestone**: `.anws/v5/05_TASKS.md` INT-S1  
**Date**: 2026-05-03  
**验证策略**: 集成测试 + 单测 + 冒烟路径；**无**真实 OpenClaw 宿主 E2E（与任务说明一致：host smoke 不扩散到普通开发任务）。

## 退出标准对照

| 领域 | 状态 | 说明 |
| --- | :---: | --- |
| OpenClaw capability probe + 持久化 | pass | 见下表 #1 |
| Runtime artifact / packaged `storage_smoke` | pass | 见下表 #2 |
| startup repair gate / `repair_required` 语义 | pass | 见下表 #3 |
| `LifeEvidence` / state 基础契约 | pass | 见下表 #6 |
| Audit append-only / decision 记录骨架（S1 相关） | pass | 见下表 #7 |
| Host smoke **fixture**（非真实宿主会话） | pass | 见下表 #5 |
| native vs sql.js storage mode smoke | pass | 见下表 #2；`unknown` 不标为 `pass`（由报告字段与断言约束） |

---

## Given / When / Then 与证据

| # | Given | When | Then | 证据（测试名 / 命令） |
|---|--------|------|------|------------------------|
| 1 | Fake `HostCapabilityAdapter` | `probeHostCapability` → `recordHostCapability` | 报告写入 observability；含 delivery target / heartbeat tool 等字段 | `T1.1.2 recordHostCapability persists probe report` — `tests/integration/cli/host-capability-probe.test.ts`；单测 `tests/unit/cli/host-capability.test.ts` |
| 2 | 默认 / repair fixture 选项 | `runStorageModeSmoke` | sql.js 路径明确无 WAL 假设；native 探测有布尔结果；repair fixture 可重建 index | `T4.1.4 runStorageModeSmoke — sql.js runtime…`、`T4.1.4 repair fixture replays evidence…` — `tests/integration/storage/storage-mode-smoke.test.ts`；`T4.1.4 packaged runtime artifact exposes runStorageModeSmoke` — `tests/integration/storage/packaged-runtime-smoke.test.ts` |
| 3 | Artifact / index 不一致 workspace | `repairStateIndexes({ startupGate: true })` | 缺失 index 可回填；失败语义由测试覆盖 | `T4.1.3 repairStateIndexes backfills missing life_evidence_index rows` 等 — `tests/unit/storage/repair-gate.test.ts`；`startup repair fixes orphan index…` — `tests/integration/storage/repair-and-backup.test.ts` |
| 4 | Packaged plugin + `storage_smoke` tool | `second_nature_ops` / tool execute | 走包内 runtime，返回结构化 smoke 报告 | `T4.1.4 second_nature_ops storage_smoke uses packaged runtime path` — `tests/integration/cli/plugin-runtime-registration.test.ts` |
| 5 | Host transcript fixture（无真实 OpenClaw 会话） | `runHostSmoke` | `heartbeat_tool_not_invoked` / docs conflict 等可判定 fail + reasons | `T1.3.1 heartbeat_tool_invocation…`、`T1.3.1 heartbeat_tool_not_invoked…`、`T1.3.1 docs_vs_observed_conflict fixture` — `tests/integration/cli/host-smoke-heartbeat-tool.test.ts` |
| 6 | Evidence candidate → 写入 | `appendLifeEvidence` | artifact + index；拒绝空 sourceRefs / credential | `appendLifeEvidence writes artifact and index row` 等 — `tests/unit/storage/life-evidence.test.ts` |
| 7 | Decision ledger（audit 面） | `DecisionLedger` / heartbeat 记录 | `heartbeat_ok` / `denied` / `intent_selected` 可查询 | `T5.1.1 heartbeat_ok leaves a queryable record` 等 — `tests/integration/observability/heartbeat-decision-record.test.ts` |
| 8 | Runtime artifact 边界 | `resolvePackagedRuntime` / 禁止源码相对依赖 | 单元测试拒绝非法路径 | `tests/unit/cli/runtime-artifact-boundary.test.ts`（T1.1.1） |

---

## 与 `05_TASKS` INT-S1 验收条文映射

- **When 执行 capability probe、storage mode smoke、startup repair fixture 和基础 contract tests** — 上表 #1–#3、#5–#8 所列命令与测试路径。
- **Then 全部 pass 或明确 fail/unknown reason；unknown 不得被标为 pass** — capability / repair / decision ledger 用断言给出二元或结构化结果；storage smoke 报告字段约束 sql.js 不作 WAL 假设；native 探测以布尔呈现而不冒充「已用 native driver 跑业务」。
- **验证说明「真实冒烟收敛在本 INT」** — 在本报告中汇总 **可自动化执行** 的冒烟与契约验证（含 T1.3.1 transcript fixture）；与 INT-S4 独占的 **物理宿主会话** 冒烟分工见上文「已知边界」。

---

## 命令汇总

```bash
pnpm exec tsc --noEmit
pnpm test
```

`pnpm test` 已包含 `pnpm build` 与 `pnpm build:plugin`（见根 `package.json`）。

---

## 已知边界

- **「真实冒烟」口径（与 `05_TASKS` 分工）**：INT-S1 的 `验证说明` 指 **自动化** capability / storage / repair / contract / **fixture 级** host smoke **在本里程碑汇总可追溯**（不把同一套检查重复摊到每个日常开发任务）。**物理 OpenClaw 宿主会话上的冒烟** 由 INT-S4 独占（见该条「只在本 INT 执行真实宿主冒烟」）。本报告覆盖前者，不冒充后者已完成。
- **遗留脚本**：根目录 `scripts/verify-int-s1.cjs` 面向旧版 artifact 目录假设，**不作为** v5 INT-S1 权威验证；v5 以本文件 + `pnpm test` 为准。
