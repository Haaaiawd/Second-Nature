# 探索报告: control-plane-system v6 Agent Self Orchestration

**日期**: 2026-05-15  
**探索者**: GPT-5.5 / Nyx  
**系统**: `control-plane-system`

---

## 1. 问题与范围

**核心问题**: `control-plane-system` 如何在继承 v5 heartbeat decision loop 的前提下，读取 NarrativeState、RelationshipMemory、AgentGoal 与 Dream 输出，并让它们影响 intent priority、narrative 更新和 outreach 判断，同时不破坏 hard guard、delivery policy 与 user task 边界。

**范围内**: heartbeat 主链、scope routing、snapshot 扩展、goal-directed planning、narrative 更新点、Dream trigger、outreach v6、decision/narrative trace 写入。  
**范围外**: state schema 细节、Dream pipeline 算法、guidance prompt 模板、connector manifest 执行细节。

---

## 2. 核心洞察

1. **Agent Self Layer 是 planning signal，不是授权来源**: Narrative/Relationship/Goal 可以影响候选排序和表达上下文，不能绕过 evidence、risk、cooldown、delivery 和 owner scope guard。
2. **goal priority 必须有上限**: `user_task > accepted_goal > rhythm` 是 v6 的决策顺序；agent-proposed goal 默认只是 proposal，不进入 priority。
3. **narrative 更新必须在 effect 之后**: 控制面只有在本轮 decision/effect/fallback 已有事实结果后才能写 NarrativeState，不可先写“我要做成了什么”。
4. **Dream 触发不应阻塞 heartbeat**: control-plane 只发起 trigger 或读取 accepted projection；Dream candidate 输出由 state lifecycle 接纳后才可影响后续 heartbeat。
5. **无证据状态是正常状态**: 当 evidence、accepted memory 或 relationship 不足时，结果应是 `awaiting_sources` / `insufficient_history`，不是编出连续叙事。

---

## 3. 详细发现

### 3.1 v5 decision loop 可以承载 v6 增强

v5 已有 snapshot -> rhythm window -> candidate intent -> hard guard -> effect/fallback -> audit 的主链。v6 不需要新增 `agent-self-system`，只需要在 SnapshotBuilder 和 CandidateIntentPlanner 中增加 self-layer 读模型。

**来源**: `.anws/v5/04_SYSTEM_DESIGN/control-plane-system.md`, `ADR_003_AGENT_SELF_LAYER.md`

### 3.2 goal-directed planning 的危险点是越权

AgentGoal 若被当作“agent 想做所以能做”，会直接破坏 v5 治理。设计上必须区分:
- `proposal`: 可展示、可解释，不影响 planning。
- `accepted`: owner 或 policy allowlist 接纳后，才进入 priority boost。
- `completed/rejected/paused`: 不再提升候选。

### 3.3 narrative trace 是控制面的解释责任

NarrativeState 是 state truth，但“为什么这次 narrative 被更新、依据哪些 source、哪些 claim 被拦住”属于 observability。控制面每次写入或拒绝 narrative revision 时，应调用 `recordNarrativeTrace()`。

**来源**: `observability-system.md` §5-6, `state-system.md` §5-6

### 3.4 Dream 与 heartbeat 必须异步解耦

Dream 可由 heartbeat 的 evidence 阈值或 maintenance window 触发，但完整 Dream 可能运行数分钟到数十分钟。控制面应只记录 trigger decision，并在后续读取 accepted projection；不得等待 LLM Dream 完成后才结束 heartbeat。

**来源**: `ADR_004_DREAM_MECHANISM.md`, `dream-system.md`

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
| --- | :---: | --- | :---: |
| A. 在 v5 `runHeartbeatCycle()` 内扩展 self-layer snapshot 与 goal priority | 高 | 需要清楚记录 priority reason | 推荐 |
| B. 新增独立 Agent Self control loop | 中 | 双控制面，决策责任分裂 | 不推荐 |
| C. 让 Dream 输出直接驱动下一步动作 | 低 | candidate memory 可能污染 active behavior | 不推荐 |
| D. guidance 生成 narrative 后直接写 state | 低 | guidance 间接获得决策权 | 不推荐 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
| :---: | --- | --- |
| P0 | 在 `HeartbeatRuntimeSnapshot` 增加 narrative、relationship、accepted goals、accepted memory projection | T2.1.4 / T2.1.5 需要同一输入面 |
| P0 | 定义 `applyGoalPriority()`，仅接受 accepted low-risk goal，并输出 priority reason | 防止 proposal 越权 |
| P0 | 定义 `updateNarrativeAfterEffect()`，所有 claim 带 source refs 或 insufficient reason | 防止先写叙事后找证据 |
| P0 | narrative 写入后调用 `recordNarrativeTrace()` | 承接 DR3-01 和 observability 设计 |
| P1 | Dream trigger 只产生 async command 和 trace，不阻塞 heartbeat | 保持 heartbeat P95 < 2s |

---

## 6. 局限性与待探索

- 本报告不定义具体评分公式；实现阶段应保持规则化、可测试，避免引入模型评分。
- OpenClaw delivery target 的真实能力仍沿用 v5 INT-S4 证据要求。
- 多 owner / 多 agent 不在 v6 范围内。

---

## 7. 参考来源

1. `.anws/v6/01_PRD.md`
2. `.anws/v6/02_ARCHITECTURE_OVERVIEW.md`
3. `.anws/v6/03_ADR/ADR_003_AGENT_SELF_LAYER.md`
4. `.anws/v6/03_ADR/ADR_004_DREAM_MECHANISM.md`
5. `.anws/v6/04_SYSTEM_DESIGN/state-system.md`
6. `.anws/v6/04_SYSTEM_DESIGN/observability-system.md`
7. `.anws/v5/04_SYSTEM_DESIGN/control-plane-system.md`

