# 探索报告: control-plane-system v5 Heartbeat Decision Loop

**日期**: 2026-05-01  
**探索者**: GPT-5.5  
**系统**: `control-plane-system`

---

## 1. 问题与范围

**核心问题**: `control-plane-system` 如何把 Second Nature v5 从 host-safe heartbeat acknowledgment 推进到 lived-experience closure，并在不新增 `outreach-system` / `rhythm-system` 的前提下闭合 heartbeat decision loop、rhythm windows、outreach judgment、OpenClaw delivery target/fallback 与 Quiet source coverage？

**探索范围**:
- 包含: heartbeat 主入口、decision loop、life evidence snapshot、rhythm window、outreach judgment、delivery policy、fallback、Quiet source coverage、用户任务边界。
- 不包含: connector 具体平台协议、SQLite schema 完整实现、behavioral-guidance 文案模板、OpenClaw runtime artifact packaging。

---

## 2. 核心洞察 (Key Insights)

1. **heartbeat run 与用户联系成功必须分开建模**: OpenClaw heartbeat 可以成功运行但不外送；`target: "none"` 只能说明 heartbeat run 成功，不能说明主动联系用户成功。
2. **`HEARTBEAT_OK` ack drop 是宿主行为，不是异常噪声**: 无事时可以返回 ack，但需要提醒用户时不能把有效消息放进会被 ack drop 的短回复形态。
3. **outreach judgment 属于 control-plane，不属于 guidance**: guidance 可以生成朋友式草稿，但 hard allow / deny / cooldown / dedupe / delivery availability 必须由 control-plane 决定。
4. **Quiet 和 Narrative Reflection 必须消费 source-backed life evidence**: evidence 为空时只能静默、maintenance 或生成空状态解释，不能编造“今天我看到/做了什么”。
5. **v5 新复杂度应落在跨系统契约，而不是新系统数量**: rhythm window 和 outreach 都是 control-plane policy + state read model + observability audit 的组合，不该拆成新顶层系统。

---

## 3. 详细发现

### 3.1 OpenClaw heartbeat / delivery 约束

**探索方式**: 官方文档与 v5 OpenClaw capability research 复用。

**发现**:
- Heartbeat 是周期性 main-session agent turn，适合做 Second Nature 自由心跳主入口。
- Delivery 与运行上下文分离；`target` / `to` 控制是否向用户可见通道外送。
- `target: "none"` 是真实失败模式：模型轮次可以运行、工具可以调用，但回复不会发送给用户。
- `target: "last"` 或显式 channel/to 才有机会闭合用户可见主动联系。

**来源**: `./openclaw-lived-experience-closure-research.md`, https://docs.openclaw.ai/gateway/heartbeat

### 3.2 heartbeat decision loop 的本地架构模式

**探索方式**: 结合 v4 调研与 v5 PRD/ADR 收敛。

**发现**:
- 主入口应从 `ingestRhythmSignal()` 升级为 `runHeartbeatCycle()`，因为 v5 不只是“节律信号”，而是完整的 evidence-backed decision loop。
- cycle 需要显式产出 `heartbeat_ok`、`intent_selected`、`denied`、`deferred`、`delivery_unavailable` 等结构化结果。
- 每轮必须记录 decision record；静默、拒绝、延后、投递失败都要可解释。

### 3.3 rhythm windows 的合理边界

**探索方式**: 内部架构推演。

**发现**:
- `RhythmWindow` 是 state-system 的配置/read model，由 control-plane 在 heartbeat 中解释执行。
- work / exploration / social / quiet / reflection / maintenance 只决定候选 intent 集合和偏置，不直接授权动作。
- 用户明确任务必须绕过 rhythm gate；Quiet 不能成为拒绝用户任务的借口。

### 3.4 outreach judgment 的分层

**探索方式**: 外部 proactive notification 实践 + ADR-007 收敛。

**发现**:
- 主动联系需要 alert-worthy / relationship-worthy threshold，否则会退化为噪声。
- control-plane 判断四件事：价值是否足够、是否与用户兴趣有关、是否重复/冷却中、delivery target 是否可用。
- guidance 只在 control-plane allow 后生成短句草稿；不得把 hard deny 改成 allow。

**来源**: `./openclaw-lived-experience-closure-research.md`, https://dora.dev/capabilities/proactive-failure-notification/

### 3.5 Quiet source coverage

**探索方式**: Reflexion / agent reflection 实践复用。

**发现**:
- Reflection / Quiet 的高风险点是“自洽但失真”：模型生成了漂亮叙事，却没有 source refs。
- control-plane 应在 Quiet 入口检查 source coverage，并把 coverage 要求传给 state / guidance / observability。
- 空 evidence 是正常状态，不是让模型补故事的空白。

**来源**: `./openclaw-lived-experience-closure-research.md`, https://export.arxiv.org/pdf/2303.11366v1.pdf

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
|------|:------:|------|:------:|
| A. `runHeartbeatCycle` 统一编排 snapshot -> window -> intent -> guard -> delivery | 高 | 需要严格限制每轮成本 | 推荐 |
| B. 保留 v4 `ingestRhythmSignal`，仅补 outreach 分支 | 中 | 名义仍停留在 rhythm，容易漏掉 delivery/fallback | 不推荐 |
| C. 新增 `outreach-system` 承接主动联系 | 中 | 切碎 decision/guidance/delivery/audit 边界 | 不推荐 |
| D. 新增 `rhythm-system` 承接窗口选择 | 低 | 把 policy read model 误升为系统 | 不推荐 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
|:------:|------|------|
| P0 | L0 设计中把 `runHeartbeatCycle()` 作为主操作契约 | v5 的中心不是 signal routing，而是完整 decision loop |
| P0 | 明确 `DeliveryPolicy`：`target: "none"` 不算用户联系成功 | 避免再次把 heartbeat run 成功误读为 outreach 成功 |
| P0 | 将 `HEARTBEAT_OK` ack drop 写入数据模型和测试矩阵 | 这是 OpenClaw 明确宿主行为 |
| P0 | 将 `OutreachJudgment` 设计为 control-plane 产物 | 保护 guidance 边界，防止软层越权 |
| P1 | 将 Quiet source coverage 作为 Quiet / reflection 的准入条件 | 防止 Narrative Reflection 虚构经历 |

---

## 6. 局限性与待探索

- 当前公开资料与研究报告已足够支撑设计，但仍需要后续 `cli-system` 设计和 host smoke 验证确认当前 OpenClaw 版本是否暴露 `runHeartbeatOnce` 或等价能力。
- `target: "last"` 是否准确映射到 owner 当前可见会话，需要 INT / smoke report 证明。
- 本报告不定义 connector 真实平台写路径；control-plane 只消费 life evidence candidate 和 connector result。

---

## 7. 参考来源

1. [OpenClaw Heartbeat](https://docs.openclaw.ai/gateway/heartbeat)
2. [OpenClaw Plugin Hooks](https://docs.openclaw.ai/plugins/hooks)
3. [OpenClaw issue #40297: expose runHeartbeatOnce](https://github.com/openclaw/openclaw/issues/40297)
4. [DORA proactive failure notification](https://dora.dev/capabilities/proactive-failure-notification/)
5. [Reflexion paper](https://export.arxiv.org/pdf/2303.11366v1.pdf)
6. `./openclaw-lived-experience-closure-research.md`
7. `../../01_PRD.md`
8. `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
