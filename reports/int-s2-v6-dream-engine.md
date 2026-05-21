# INT-S2 — S2 Dream Engine (v6)

**Milestone**: `.anws/v6/05A_TASKS.md` INT-S2  
**Date**: 2026-05-16  
**验证策略**: 单元测试 + 集成测试；**无**真实 OpenClaw 宿主 E2E（分工见 INT-S4）。

## 退出标准对照

| 领域 | 状态 | 说明 |
| --- | --- | --- |
| Dream pipeline (T7.1.1) — MemoryStore / DreamOutputLifecycle | pass | 见下表 #1 |
| Dream scheduler (T7.1.2) — shouldTrigger / lock semantics | pass | 见下表 #2 |
| Insight extraction (T7.1.3) — rules-based, sourceRefs | pass | 见下表 #3 |
| Narrative update proposal (T7.1.4) — draftNarrativeFromDream | pass | 见下表 #4 |
| Relationship update proposal (T7.1.5) — draftRelationshipFromDream | pass | 见下表 #5 |
| DreamTrace audit (T5.1.1) — dream.trace envelope in AppendOnlyAuditStore | pass | 见下表 #6 |
| dream:recent CLI read model (T1.2.2) — lifecycleStatus / limit | pass | 见下表 #7 |
| candidate semantics — accepted projection 不污染 input store | pass | 见下表 #8 |

---

## Given / When / Then 与证据

| # | Given | When | Then | 证据（测试名 / 文件） |
| --- | --- | --- | --- | --- |
| 1 | 空 memory store | `appendDreamOutput` → `acceptDreamOutput` → `archiveDreamOutput` → `listDreamOutputs` | candidate→accepted→archived 生命周期正确；active pointer 语义保持；accepted projection 不修改原始 input store | `T4.1.5 memory store lifecycle round-trip` — `tests/integration/storage/t4-1-5-memory-store-lifecycle.test.ts` |
| 2 | evidence threshold / cron / manual trigger 策略 | `scheduleDream` + `shouldTrigger` | 各策略正确触发；同一 window 内并发返回 skipped；DreamRunLock 语义正确 | `T7.1.2 dream scheduler` — `tests/integration/dream/t7-1-2-dream-scheduler.test.ts`（8 cases） |
| 3 | chronicle + evidence snapshot | `extractInsights` | recurring word、learning keyword、conflict、high-activity 四类模式正确识别；每条 insight 含 type/summary/sourceRefs/confidence | `T7.1.3 insight extraction` — `tests/unit/dream/t7-1-3-insight-extraction.test.ts`（6 cases） |
| 4 | evidence + insights（含 conflict / 低 confidence / 无 evidence） | `draftNarrativeFromDream` | focus/progress/nextIntent 正确；conflict 触发 nextIntent=resolve；低 confidence 降级；无 evidence 阻断 | `T7.1.4 narrative update proposal` — `tests/unit/dream/t7-1-4-narrative-update.test.ts`（5 cases） |
| 5 | chronicle（含无 reply / positive / negative / neutral / busy / tech 场景） | `draftRelationshipFromDream` | tone/timing/topic 推断正确；单样本 unsupported claim 防止过度推断；无 reply 返回 cooldown | `T7.1.5 relationship update proposal` — `tests/unit/dream/t7-1-5-relationship-update.test.ts`（6 cases） |
| 6 | 空 / 正常 / 部分 DreamTrace | `recordDreamTrace` → `auditStore.list()` | dream.trace family envelope 写入；traceId/runId/durationMs/inputCounts 字段完整；partial 场景含 fallbackReason；limit+sort 降序 | `T5.1.1 DreamTrace audit` — `tests/integration/observability/t5-1-1-dream-trace-audit.test.ts`（5 cases） |
| 7 | dream.trace events in audit store（空 / 单条 / limit / 注册） | `loadDreamRecent(limit)` | 空返回 totalRuns:0 runs:[]；有数据返回正确 lifecycleStatus(completed/partial)；limit 截断生效 | `T1.2.2 dream:recent` — `tests/integration/cli/t1-2-2-dream-recent.test.ts`（4 cases） |
| 8 | accepted DreamOutput 写入 accepted store | 从 active store 查询 | accepted projection 不出现在 input（candidate）store；lifecycle 状态独立 | `T4.1.5 memory store lifecycle round-trip` — `tests/integration/storage/t4-1-5-memory-store-lifecycle.test.ts` |

---

## 与 `05A_TASKS` INT-S2 验收条文映射

- **Given S2 tasks completed** — 上表 #1–#8 所列测试路径全部 green。
- **When execute Dream smoke with normal, empty, timeout, model unavailable fixtures** — 单元测试覆盖策略边界（empty/low-confidence/no-evidence）；集成测试覆盖 MemoryStore lifecycle 与 scheduler lock 语义。
- **Then candidate/partial/accepted semantics and DreamTrace evidence are correct** — candidate→accepted→archived 生命周期完整；DreamTrace envelope 可审计；dream:recent CLI 返回 honest 空态或有效聚合。

---

## 命令汇总

```bash
pnpm build
node --test dist/tests/**/*.test.js
```

`pnpm build` 无 TypeScript error；全套 514 测试 514 pass，0 fail。

---

## 已知边界

- **真实 Dream LLM 调用**：T7.1.3–T7.1.5 使用 rules-based stub，不调用真实 LLM；真实模型可用性测试由 INT-S4 host readiness 覆盖。
- **timeout/budget 中断**：scheduler 策略单测覆盖，但物理 timeout 计时在 test 环境中不触发；生产 timeout 行为依赖宿主运行时注入 `timeoutMs`。
- **DreamRunLock 持久化**：默认 in-memory lock；持久化 lock 适配器（SQLite-backed）保留为未来 Wave 升级路径。
