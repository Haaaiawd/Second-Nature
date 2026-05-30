# Second Nature v8 核心缺口摘要

> 版本: 0.1.51 | v7 已完成（70 任务，1290 测试通过）| 当前状态: 有眼睛，没脑子，没手

---

## 当前链路（已运行）

```
heartbeat → connector:run → fetch feed → write evidence → narrative: "scan...continue" → 等下次 heartbeat
```

- 109 条 evidence，revision 372
- 0 条触发了下游动作

---

## 缺什么

| 环节 | 现状 | 缺口 |
|------|------|------|
| **抓取** | connector 能读 moltbook/instreet/evomap feed | ✅ 已就绪 |
| **存储** | evidence 写入 `life-evidence-index` + `narrative-state` | ✅ 已就绪 |
| **感知** | evidence 存在 SN DB，Nyx（agent）看不到 | ❌ 无 Evidence → Agent Context 回流 |
| **判断** | narrative 永远是 "scan opportunities"，confidence 0.95 | ❌ 无"这条重要吗"的过滤/打分 |
| **行动** | 无自动 trigger | ❌ 无 reply/publish/notify_owner 的触发机制 |
| **记忆** | evidence 存了就存了 | ❌ 未融入 MEMORY.md 塑造后续行为 |

---

## 关键代码位置（给 GPT5.5 定位用）

| 文件 | 作用 |
|------|------|
| `src/core/second-nature/heartbeat/embodied-context-assembler.ts:129` | `recentInteractions` LIFO 10，但只存 interaction，不进 evidence 语义 |
| `src/core/second-nature/orchestrator/effect-dispatcher.ts` | `ConnectorExecutor` 执行 connector action，但只在 heartbeat 里被调用 |
| `src/storage/life-evidence/append-life-evidence.ts` | evidence 写入 DB 的入口 |
| `src/observability/services/narrative-timeline-query-service.ts` | narrative 查询，但只有聚合版本，不含原始 evidence |
| `plugin/index.ts:230-242` | v7 ops surface 白名单：`self_health`、`tool_affordance`、`connector:run` 等 |
| `src/cli/ops/ops-router.ts:979-1042` | `connector:run` 实现 —— 需要 `connectorExecutor + state`，目前只支持手动调用 |
| `src/core/second-nature/guidance/impulse-assembler.ts` | `guidance_payload` 的 impulse 组装，纯同步，无 evidence 输入 |

---

## 想要的样子

```
evidence ──→ 感知层（回注 agent context）
           ──→ 判断层（基于 personality/focus 过滤打分）
           ──→ 行动层（reply / publish / notify Haa）
           ──→ 记忆层（重要 evidence 融入 MEMORY.md）
```

---

## 两个可能的切入方向

1. **感知通路（T-PR.C.1）**: 让 evidence 语义能回到 Nyx 的 prompt/context 里
   - 最小实现：Quiet 阶段把 recent evidence 摘要写进 `workspace/memory/` 或注入 `EmbodiedContext`

2. **行动通路（T-PR.C.3）**: 让 judgment 结果能调用 connector 执行 reply/publish
   - 最小实现：扩展 `connector:run` 的触发条件，从 manual 变成 judgment-driven

---

## 约束

- 运行时是 OpenClaw plugin 模式（`plugin/index.ts`）+ workspace CLI 模式并存
- 不能破坏 v7 的 1290 个测试
- `SECOND_NATURE_ENCRYPTION_KEY` 已配置，凭据库可用
- connector manifest/capability 已注册，只差"谁来决定调用"
