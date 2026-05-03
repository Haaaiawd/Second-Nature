# INT-S2 — Evidence & Rhythm Loop

**Milestone**: `.anws/v5/05_TASKS.md` INT-S2  
**Date**: 2026-05-03  
**验证策略**: 集成测试为主；`:memory:` / 临时 DB；**无** OpenClaw E2E。

## 退出标准对照

| 领域 | 状态 | 说明 |
| --- | :---: | --- |
| evidence snapshot → rhythm / planner → heartbeat 决策链 | pass | 见下表 |
| `LifeEvidenceSnapshot` / empty safe | pass | T4.2.1 单测 + 集成脊柱 |
| `RhythmPolicySnapshot` → `RhythmWindowDecision` 边界 | pass | T2.1.2 单测 + `routeScopedInput` 集成测 |
| `UserInterestSnapshot.staleness === insufficient` | pass | T4.2.2 单测 |
| Connector → `LifeEvidenceCandidate` 映射 | pass | T3.1.2 单测 + connector 集成 |
| source-backed decision trace | pass | observability 脊柱与 decision ledger |

---

## Given / When / Then 与证据

| # | Given | When | Then | 证据（测试名 / 命令） |
|---|--------|------|------|------------------------|
| 1 | 受控 `SnapshotInputs` + ledger | `executeHeartbeatCycle` / spine helpers | `intent_selected`、`deferred`、`denied` 等结构化结果；可观测 decision 记录 | `T2.2.1 has obligation and allow → intent_selected`、`T2.2.1 [no obligation] all candidates blocked…` 等 — `tests/integration/control-plane/heartbeat-spine.test.ts` |
| 2 | 全窗口节律与守卫 | `whole-loop validation…` | active / quiet / interrupt / outreach / deny 路径与 durability | `whole-loop validation covers active/quiet/interrupt/outreach/deny and durability+explainability chain` — `tests/integration/control-plane/decision-loop-validation.test.ts` |
| 3 | INT-S2 集成脊柱（同文件内测试名与断言可能不完全一致，以断言为准） | `runHeartbeatSpine` 等 | **Test title** `… HEARTBEAT_OK path…` 实际断言 `cycleResult.status === "denied"`（`awaitingUserInput: true`）；allow / deferred / 全链并列另有专用用例 | `INT-S2 heartbeat spine: HEARTBEAT_OK path is observable…`（断言 `denied`）— `tests/integration/control-plane/heartbeat-spine-integration.test.ts:138`–`179`；`INT-S2 heartbeat spine: allow path…`、`duplicate-intent…`、`full chain…`、`heartbeat_ok status is preserved…（heartbeat_ok or denied）` — 同文件 |
| 4 | Near-real connector → evidence 入库 | `runNearRealConnectorSmoke` | platform/work evidence index 非空；execution attempts 可审计 | `T3.3.1 near-real smoke — feed.read + work.discover evidence…` — `tests/integration/connectors/near-real-connector-smoke.test.ts` |
| 5 | Rhythm scope routing | `routeScopedInput` | heartbeat_bridge / user_task / user_reply 路由正确 | `T2.1.2 routeScopedInput routes heartbeat_bridge to rhythm` 等 — `tests/integration/control-plane/heartbeat-spine.test.ts` |
| 6 | Connector 契约与 evidence | manifest + mapper | source-backed candidate 与 schema | `tests/unit/connectors/connector-manifest-and-evidence-map.test.ts`；`tests/integration/connectors/platform-adapters.test.ts`；`tests/integration/connectors/connector-base.test.ts`；`tests/integration/connectors/moltbook-client.test.ts` |
| 7 | Side-effect 策略 | `enforceExecutionPolicy` | idempotency / retry gate | `tests/unit/connectors/execution-policy.test.ts`；`tests/integration/connectors/policy-layer.test.ts` |
| 8 | S1 repair / read-model 门修复验（与 INT-S1 报告交叉引用） | 同仓库已存在的 repair + storage smoke | 「同时复验」：不重复跑物理宿主；复用 **INT-S1** 证据表 #2/#3/#6 + `tests/unit/storage/repair-gate.test.ts`、`tests/integration/storage/repair-and-backup.test.ts`、`tests/integration/storage/storage-mode-smoke.test.ts` | 见 `reports/int-s1-host-state-foundation.md`；本里程碑 heartbeat 脊柱在此基础上叠加控制层集成 |

---

## 与 `05_TASKS` INT-S2 验收条文映射

对 `.anws/v5/05_TASKS.md` INT-S2 **验收标准** 的逐项承接：

- **Given near-real life evidence fixture 和 rhythm policy snapshot** — **Near-real fixture**：`T3.3.1 near-real smoke`（`runNearRealConnectorSmoke`）写入可追溯 platform/work evidence。**Rhythm policy**：由 `SnapshotInputs` / `routeScopedInput` / planner fixtures 表达节律窗口与预算（与 `T4.1.2` read model、控制面节律测试一致）；脊柱集成用例显式设置 `currentWindowId`、obligations、budgets。
- **When heartbeat integration test 运行** — `tests/integration/control-plane/heartbeat-spine.test.ts`、`heartbeat-spine-integration.test.ts`、`decision-loop-validation.test.ts` 内对 `ingestRhythmSignal` / `runHeartbeatCycle` / `executeHeartbeatCycle` 的集成调用（非单测桩的完整控制链片段）。
- **Then 输出结构化 decision result，并记录 source-backed decision trace** — 结构化 `status` / `intent_selected` / `deferred` / `denied` 等由脊柱与 whole-loop 用例断言；**source-backed**：near-real 路径产生带 source 的 evidence 行（T3.3.1）+ decision ledger / evidenceRefs（INT-S2 脊柱与 `T5.1.1` 记录链）。同一仓库内 **无需** 单一巨型用例重复串联——由本表 #1–#3、#4 与 INT-S1 门重复验 #8 共同闭合。

---

## 命令汇总

```bash
pnpm exec tsc --noEmit
pnpm test
```

---

## 已知边界

- **Near-real vs 纯 fake snapshot**：里程碑 `Given` 中的 *near-real life evidence fixture* 由 **T3.3.1** `runNearRealConnectorSmoke`（Moltbook/EvoMap 哨兵 + 真实写入 state index）承接；`heartbeat-spine-integration` 用 **内存构建的** `SnapshotInputs` 覆盖控制面决策链，两者互补而非重复。
- **S1 门重复验**：见上表 #8；INT-S2 不重复粘贴每个 repair 断言，以 INT-S1 报告 + 相同测试文件为单一起源。
- **INT-S3**：delivery / Quiet 深度闭合见 `reports/int-s3-outreach-delivery-quiet.md`；INT-S2 仅保证决策链、平台 evidence 与节律主轴。
