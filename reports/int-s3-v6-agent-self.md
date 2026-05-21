# INT-S3 — S3 Agent Self Integration (v6)

**Milestone**: `.anws/v6/05A_TASKS.md` INT-S3  
**Date**: 2026-05-16  
**验证策略**: 单元测试 + 集成测试；**无**真实 OpenClaw 宿主 E2E（分工见 INT-S4）。

## 退出标准对照

| 领域 | 状态 | 说明 |
| --- | --- | --- |
| Goal-directed planning (T2.1.4) — accepted goal affects candidate priority | pass | 见下表 #1 |
| Heartbeat narrative update (T2.1.5) — NarrativeState written + NarrativeTrace | pass | 见下表 #2 |
| Outreach draft (T2.3.1) — source-backed reason, delivery judgment | pass | 见下表 #3 |
| Relationship-aware outreach (T6.1.1) — draft references RelationshipMemory | pass | 见下表 #4 |
| NarrativeTrace audit (T5.1.2) — narrative.trace envelope in audit store | pass | 见下表 #5 |
| proposal goals do not affect intent (governance boundary) | pass | 见下表 #6 |
| source-backed draft contains narrative/relationship context | pass | 见下表 #7 |

---

## Given / When / Then 与证据

| # | Given | When | Then | 证据（测试名 / 文件） |
| --- | --- | --- | --- | --- |
| 1 | accepted goal + active goals in AgentGoalStore | `resolveGoalPriorityAdjustment` | accepted goal 提升 candidate 优先级；proposal goal 不影响优先级；rejected/completed/paused goal 无效 | `T2.1.4 goal priority affects candidate selection` — `tests/unit/control-plane/t2-1-4-goal-priority.test.ts` |
| 2 | snapshot inputs + dream insights | `updateNarrativeFromHeartbeat` → NarrativeStateStore | NarrativeState 正确写入 focus/progress/nextIntent；NarrativeTrace envelope 写入 audit store；低 confidence 状态降级 | `T2.1.5 narrative update from heartbeat` — `tests/unit/control-plane/t2-1-5-narrative-update.test.ts`；`T5.1.2 narrative trace audit` — `tests/integration/observability/heartbeat-narrative-trace.test.ts` |
| 3 | outreach candidate + delivery available / unavailable | `runOutreachJudgment` | allow→draft 含 source-backed 来由；deny(value_too_low)→无 draft；defer(cooldown)→无 draft；delivery_unavailable→fallback draft + operator fallback | `T2.3.1 outreach judgment` — `tests/integration/control-plane/t2-3-1-outreach-v6.test.ts`（5 cases） |
| 4 | relationship memory + recipient in candidate | `draftOutreach` | draft 引用 relationship context（tone/timing/topic）；无 relationship 时退化为 generic draft | `T6.1.1 outreach draft` — `tests/integration/control-plane/t2-3-1-outreach-v6.test.ts` |
| 5 | heartbeat cycle with narrative update | `recordNarrativeTrace` → `auditStore.list()` | narrative.trace family envelope 写入；groundingStatus/confidence/sourceCount 字段正确；hash-chain 完整 | `T5.1.2 NarrativeTrace` — `tests/integration/observability/heartbeat-narrative-trace.test.ts` |
| 6 | proposal goal (not accepted) + planning | `resolveGoalPriorityAdjustment` | proposal goal 对 candidate priority 无效；accepted 才触发优先级调整 | `T2.1.4 proposal goal does not affect intent` — `tests/unit/control-plane/t2-1-4-goal-priority.test.ts` |
| 7 | source-backed draft flow (T6.2.1 / T2.3.2) | delivery_failed → fallback | draft 包含 narrative context；delivery 失败写入 operator fallback；audit not_sent 语义正确 | `INT-S3 source-backed draft → delivery failed → not_sent fallback` — `tests/integration/control-plane/int-s3-outreach-delivery-quiet-closure.test.ts` |

---

## 与 `05A_TASKS` INT-S3 验收条文映射

- **Given accepted goal and relationship memory exist** — 上表 #1/#4 覆盖。
- **When heartbeat/outreach flow runs** — 上表 #2/#3/#7 覆盖完整判断链路。
- **Then goal affects candidate priority** — T2.1.4 单测 6 cases，accepted 提升，proposal/rejected 不影响。
- **proposal goals do not** — T2.1.4 显式 case 验证 proposal 无效。
- **draft contains source-backed reason** — T2.3.1 `allow` path 验证 draft 含 narrative/relationship context；T6.1.1 outreach draft 含 sourceRefs。

---

## 命令汇总

```bash
pnpm build
node --test dist/tests/**/*.test.js
```

`pnpm build` 无 TypeScript error；全套 514 测试 514 pass，0 fail。

---

## 已知边界

- **真实 LLM draft 生成**：outreach draft 在测试环境中使用 stub/rules-based 输出；真实 LLM 接入由 INT-S4 host readiness 覆盖。
- **delivery 真实投递**：T2.3.1/T6.2.1 路径测试 delivery_unavailable / delivery_failed 语义，不涉及真实平台 HTTP 调用。
- **RelationshipMemory 持久化**：T4.1.3 单测验证 tone/timing/topic 读写；INT-S3 验证其在 outreach draft 链路的消费。
