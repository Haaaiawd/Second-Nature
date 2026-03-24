# control-plane-system 调研摘要

**日期**: 2026-03-23
**来源工作流**: `/explore`
**系统**: `control-plane-system`

---

## 1. 核心结论

- `control-plane-system` 不应被设计成“万能 agent 框架”，而应是围绕单个长期 agent 的 **durable decision loop + rhythm governance** 控制层。
- 最稳的结构是三层：`tick/signal ingress`、`policy evaluation`、`effect execution`。
- 行为节律应建模为“时间窗口 + 模式约束 + interrupt policy”，而不是拟人化生理作息表演。
- Quiet / Narrative Reflection 属于长期记忆提炼管线，不应与 OpenClaw 的 compaction/pruning 混为一谈。
- 主动联系用户应是“价值阈值触发”，而不是固定频率问候。
- observability 最重要的是 `decision record` 与 `deny reason taxonomy`，不仅记录发生了什么，还要记录为什么没发生。

## 2. 推荐架构模式

- **Decision Loop**: 每次由 `cron/heartbeat/platform event/user event` 触发一次控制循环，产出 `allow / defer / deny / enter-quiet / resume / outreach / reflect`。
- **Hierarchical State Machine**: 顶层状态建议为 `active`、`quiet`、`maintenance_only`、`paused_for_interrupt`；子状态再拆 `work / explore / social / reflection`。
- **Intent -> Guard -> Effect**: 先形成意图，再通过 guard 校验，最后执行 effect；失败与拒绝都要结构化落盘。
- **Checkpointed Resume**: 在“进入 Quiet 前”“外部调用前”“等待人类/平台反馈后”做显式 checkpoint，恢复时从 checkpoint 而不是从 prompt 猜测。

## 3. 可借鉴点

### Temporal
- 借鉴 `event history`、`signals`、`continue-as-new` 与持久化恢复思路。
- 不引入 Temporal 本身，只吸收 durable workflow 设计方法。

### LangGraph
- 借鉴 `checkpoint + interrupt/resume + human-in-the-loop` 模式。
- 注意 nested interrupt / duplicate interrupt 这类边界问题很常见。

### OpenTelemetry / Grafana
- 借鉴 trace/span/event 的决策链表达方式。
- 借鉴 active intervals、降噪、告警归并的治理理念。

### mem0 / OpenClaw
- mem0 仅借“记忆提炼/检索/历史分离”思路。
- OpenClaw workspace docs 决定主记忆资产边界，应作为宿主约束而不是被替代对象。

## 4. 应避免的反模式

- 把一堆 cron job 拼成 control plane
- 把 Quiet 做成“假装睡觉”的表演逻辑
- 只用布尔值表示状态，如 `isQuiet`, `isWorking`
- 把 retry 当成 durability
- 把 nightly reflection 和 compaction 混为一谈
- 让 LLM 直接决定是否外呼且不留理由
- 允许多个 scheduler 实例同时拥有执行权
- observability 只记 allow path，不记 deny path

## 5. 对本系统的直接影响

- 需要显式的顶层状态机、意图层、guard 层与 effect 层
- 每个外部 effect 必须携带 `intent_id`、`idempotency_key`、`lease_owner`、`decision_snapshot_id`
- Quiet 默认是“禁止高噪主动行为，但允许 maintenance / memory curation / low-frequency inspection”
- user outreach 需要 `cooldown`、`quiet-hour suppression`、`similar-outreach dedupe`
- observability 需要记录 `candidate action`、`inputs`、`matched guards`、`reasons`、`final verdict`

## 6. 参考资料

- `https://docs.temporal.io/workflow-execution`
- `https://langchain-ai.github.io/langgraph/`
- `https://opentelemetry.io/docs/concepts/signals/traces/`
- `https://docs.openclaw.ai/concepts/agent-workspace`
- `https://docs.mem0.ai/open-source/overview`
