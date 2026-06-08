# dream-quiet-memory-system Research

## 1. 问题与范围

| 子问题 | 方向 | 预期产出 |
| --- | --- | --- |
| Quiet/Dream 与实时层怎样分工？ | 混合 | 确认长期记忆只能由 Quiet/Dream 形成。 |
| Dream lifecycle 如何可诊断？ | 本地证据 | 定义 scheduled/started/completed/failed/blocked trace。 |
| MemoryProjection 怎样进入 EmbodiedContext？ | 混合 | 定义 candidate/accepted/active/superseded/retired 生命周期。 |

不包含：实时 perception/judgment、connector execution、ops UI 展示。

## 2. 核心洞察

1. Quiet/Dream 是长期记忆形成边界，实时 perception 只能成为当日回顾材料，不能直接写入 long-term memory。
2. ActionClosureRecord 是 heartbeat 到 Quiet/Dream 的桥，比 raw evidence 更适合表达“今天发生了什么”。
3. Dream fire-and-forget 失败必须落成 durable lifecycle trace，否则 causal health 无法解释 projection 为什么没更新。

## 3. 详细发现

### 长期记忆边界

`.anws/v8/03_ADR/ADR_003_QUIET_DREAM_LONG_TERM_MEMORY.md` 明确长期记忆只经 Quiet Daily Review 与 Dream Consolidation 形成。`.anws/v8/01_PRD.md` [REQ-005] 要求 accepted 后形成 long-term memory projection 并进入 `EmbodiedContext`。

### v7 现状

`.anws/v8/00_DEEPWIKI_MECHANISM_AUDIT.md` 指出 v7 conceptual lifecycle 正确，但 trigger、diary、Dream schedule 与 accepted projection 链路不稳定。v8 设计应把 lifecycle trace 作为必需输出。

### Projection 生命周期

`.anws/v8/concept_model.json` 要求 `Memory Projection` 暴露 accepted long-term memory，且 PRD 要求同一事实更新时 supersede 旧 projection。因此 projection 不是 append-only diary，而是带生命周期的 read model。

## 4. 创意/方案表

| 方案 | 判定 | 理由 |
| --- | --- | --- |
| 重要 Perception 直接写长期记忆 | 拒绝 | 违反 ADR-003，噪声会污染长期身份。 |
| Quiet 只写自然语言日记 | 拒绝 | 无法被 Dream 和 health 稳定消费。 |
| QuietDailyReview + DreamConsolidationRun + Projection lifecycle | 采纳 | 同时满足人类式回顾、可诊断和 EmbodiedContext 投影。 |

## 5. 行动建议

- L0 文档应明确 Quiet 输入来自 action closure、important perception、tool experience 和 relationship signals。
- L0 文档应定义 Dream validation 失败时的 rejected/blocked reason，禁止静默丢弃。

## 6. 局限与待探

无阻塞缺口；具体 Dream candidate scoring 可在 `/blueprint` 中拆成验证任务。

## 7. 参考来源

- `.anws/v8/01_PRD.md` [REQ-005], [REQ-006], [REQ-009]
- `.anws/v8/02_ARCHITECTURE_OVERVIEW.md` System 8
- `.anws/v8/concept_model.json`
- `.anws/v8/03_ADR/ADR_003_QUIET_DREAM_LONG_TERM_MEMORY.md`
- `.anws/v8/03_ADR/ADR_005_CAUSAL_LOOP_HEALTH.md`
- `.anws/v8/00_DEEPWIKI_MECHANISM_AUDIT.md` §4.4, §6.5

Skill harvesting 未使用；本轮依据 v8 本地 genesis 产物与机制审计收敛。
