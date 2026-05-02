# 探索报告: OpenClaw Lived Experience Closure

**日期**: 2026-05-01  
**探索者**: GPT-5.5

---

## 1. 问题与范围

**核心问题**: Second Nature v5 如何基于当前 OpenClaw 插件、heartbeat、hook 与 delivery 能力，完成“真实生活证据 + 朋友式主动联系用户”的产品闭环？

**探索范围**:
- 包含: OpenClaw heartbeat delivery、plugin 能力、plugin hooks、主动联系用户的设计约束、agent reflection / memory 最小实践。
- 不包含: 完整实现代码、全平台生产级 connector、非 OpenClaw 宿主的适配方案。

---

## 2. 核心洞察 (Key Insights)

1. **OpenClaw heartbeat 已经是主动联系的主语义入口**: 官方文档说明 heartbeat 是周期性 main-session agent turn，用于 surface anything that needs attention without spamming you；它不是后台 task record，也不是插件天然 callback。
2. **是否“找用户说话”由 delivery 决定，不由 heartbeat 是否运行决定**: `target: "none"` 会运行 heartbeat 但不外送；`target: "last"` 或显式 channel/to 才会送到外部目标。`HEARTBEAT_OK` 在首尾出现且剩余内容短时会被当作 ack 丢弃。
3. **插件应通过 hook / injection / runtime API 参与 heartbeat，而不是伪造发送通道**: `heartbeat_prompt_contribution` 可为 heartbeat 注入状态；`enqueueNextTurnInjection` 适合把插件状态带到下一轮；GitHub issue #40297 显示 `runHeartbeatOnce({ heartbeat: { target: "last" } })` 是插件触发可投递 heartbeat 的关键能力。
4. **主动联系必须有阈值和分层，防止 alert fatigue**: 外部最佳实践强调只对 alert-worthy signal 发送通知，低重要度进入摘要，高价值/紧急才主动 DM。
5. **Quiet / reflection 必须 grounded in evidence**: Reflexion 与现代 agent reflection 实践都强调外部 evidence / trajectory / observations，不能只靠模型自我感觉沉淀记忆。

---

## 3. 详细发现

### 3.1 OpenClaw heartbeat 的真实能力

**探索方式**: 搜索 + 官方文档阅读

**发现**:
- Heartbeat 会周期性运行 agent turn，默认 prompt 要求读取 `HEARTBEAT.md`，没事时回复 `HEARTBEAT_OK`。
- `HEARTBEAT_OK` 若出现在回复开头或结尾，且剩余内容不超过 `ackMaxChars`，OpenClaw 会把它当作 ack 并丢弃消息。
- Delivery 与运行上下文分离：`session` 控制 run context，`target` / `to` 控制是否外送和送到哪里。
- `target: "none"` 是默认值；这意味着 agent 可以运行、调用工具、产出回复，但不会被发送到用户。
- `target: "last"` 可投递到最近使用的外部 channel；也可显式配置 channel，如 Discord、Telegram、Slack、iMessage 等。

**来源**:
- https://docs.openclaw.ai/gateway/heartbeat

### 3.2 OpenClaw plugin 能力边界

**探索方式**: 搜索 + 官方文档阅读

**发现**:
- OpenClaw native plugin 通过 `register(api)` 在 Gateway 进程内注册工具、命令、服务、HTTP route、hook、channel、provider、context engine 等能力。
- 插件不是 sandbox，必须按可信 Gateway 扩展处理；v5 不应让插件任意静默外送用户消息而没有审计。
- plugin runtime code 更新后需要重启 Gateway；`plugins list/info/inspect` 对冷启动和能力可见性有帮助，但不是 live runtime 完整证明。

**来源**:
- https://docs.openclaw.ai/plugin
- https://docs.openclaw.ai/cli/plugins

### 3.3 Hook 与主动联系相关入口

**探索方式**: 官方 hook 文档

**发现**:
- `heartbeat_prompt_contribution` 专门用于 heartbeat turn 的背景 monitor / lifecycle 插件，返回 `prependContext` 或 `appendContext`。
- `message_sending` / `message_sent` 可观察或改写 outbound delivery，是审计主动联系投递的好位置。
- `enqueueNextTurnInjection` 可让插件把 durable context exactly-once 带到下一轮模型 turn，适合把 life evidence summary 或 outreach candidate 注入到 heartbeat。
- `before_agent_reply` 可合成回复或 silence，但它更像短路当前模型回合，不应作为 v5 主动联系主路径的第一选择。

**来源**:
- https://docs.openclaw.ai/plugins/hooks

### 3.4 插件触发可投递 heartbeat 的关键风险

**探索方式**: GitHub issue 阅读

**发现**:
- Issue #40297 描述了一个真实失败模式：插件用 `enqueueSystemEvent + requestHeartbeatNow` 唤醒 agent，但 `heartbeat.target` 默认 `none`，导致 agent 生成的回复被丢弃，`message_sending` hook 也不会触发。
- 该 issue 已关闭，提案是暴露 `runHeartbeatOnce` 给插件 runtime，并允许传入 `heartbeat: { target: "last" }`。
- 这对 v5 很关键：如果 Second Nature 要主动找用户，必须验证当前宿主版本是否已有 plugin-safe `runHeartbeatOnce` 或等价能力；否则只能依赖 Gateway heartbeat 配置而不是插件主动覆盖 delivery。

**来源**:
- https://github.com/openclaw/openclaw/issues/40297

### 3.5 主动 agent 通知最佳实践

**探索方式**: 外部实践搜索

**发现**:
- 主动通知需要清晰 alert-worthy threshold、priority tier、路由策略和最小权限：读数据源 + 写一个通信通道。
- DORA 的 proactive notification 经验强调阈值要预测真实问题，通知必须可行动，否则会导致 alert fatigue。
- Microsoft custom engine agent 文档区分 asynchronous follow-up 与 proactive messaging；核心思想是后台处理完成后投递 follow-up，或由系统触发创建/使用 conversation 发消息。

**来源**:
- https://agentc2.ai/blog/build-proactive-ai-agent-notifications
- https://dora.dev/capabilities/proactive-failure-notification/
- https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/custom-engine-agent-asynchronous-flow

### 3.6 Reflection / memory 最小实践

**探索方式**: 外部研究搜索

**发现**:
- Reflexion 类方法把轨迹、观察、失败/奖励与自然语言反思写入 memory，用于下一次尝试。
- 现代 reflection 实践强调不要只靠模型自我评价；高价值反思要 grounded in external tools/data，并限制反思轮次，避免自洽但错误的记忆沉淀。
- 对 Second Nature 而言，Quiet 应读取 life evidence / sourceRefs，而不是把主观叙事直接当事实。

**来源**:
- https://export.arxiv.org/pdf/2303.11366v1.pdf
- https://zylos.ai/research/2026-03-06-ai-agent-reflection-self-evaluation-patterns

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
|------|:------:|------|:------:|
| A. 只依赖 OpenClaw heartbeat delivery 配置，`target: "last"` 或显式 channel/to | 高 | 需要用户/宿主配置；插件不能强控所有场景 | 推荐主路径 |
| B. 插件通过 `heartbeat_prompt_contribution` 注入 life evidence，由 heartbeat 自然决定是否发消息 | 高 | 需要控制 payload 大小和隐私 | 推荐主路径 |
| C. 插件通过 `runHeartbeatOnce({ target: "last" })` 主动唤醒并投递 | 中 | 必须验证当前宿主版本 API 是否暴露 | P0 验证项 |
| D. 插件直接实现自有 outbound channel | 低 | 重建 OpenClaw delivery，审计和权限复杂 | 不推荐 |
| E. 只写 operator inbox，不主动发用户会话 | 高 | 体验弱，不能兑现“朋友式主动联系” | 兜底 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
|:------:|------|------|
| P0 | 将 v5 主动联系 bridge 决策建立在 OpenClaw heartbeat delivery 上，要求 `target != "none"` 才能声明“主动联系用户”闭环成立 | 这是官方语义，不用伪造发送通道 |
| P0 | 在 ADR 中明确验证 `runHeartbeatOnce` 或等价 plugin runtime API 是否可用 | issue #40297 说明默认 requestHeartbeatNow 会丢弃回复 |
| P0 | 使用 `heartbeat_prompt_contribution` 或 next-turn injection 注入 life evidence summary，而不是把所有 evidence 塞进 `HEARTBEAT.md` | 更符合 plugin runtime 和动态状态边界 |
| P1 | 将主动联系分为 friend-share / work-nudge / help-needed / critical-alert 四类，并设置不同阈值和 cooldown | 防止“朋友感”退化为噪声 |
| P1 | Quiet / reflection 只沉淀 source-backed claims | 防止虚构经历和记忆污染 |

---

## 6. 局限性与待探索

- 当前仅基于公开文档和 GitHub issue；还需要在本地/云端 OpenClaw 版本中实测 plugin runtime API 是否包含 `runHeartbeatOnce` 或等价能力。
- `target: "last"` 对“当前用户会话”的映射依赖宿主 channel/session 状态，后续需要在 INT 验证中明确。
- 如果用户只在本地 IDE/CLI 使用 OpenClaw 而无外部 channel，delivery target 可能没有外部可见目标；这种场景需要 operator inbox 或下一轮 visible reply 兜底。

---

## 7. 参考来源

1. [OpenClaw Heartbeat](https://docs.openclaw.ai/gateway/heartbeat)
2. [OpenClaw Plugin Overview](https://docs.openclaw.ai/plugin)
3. [OpenClaw Plugin CLI](https://docs.openclaw.ai/cli/plugins)
4. [OpenClaw Plugin Hooks](https://docs.openclaw.ai/plugins/hooks)
5. [OpenClaw issue #40297: expose runHeartbeatOnce](https://github.com/openclaw/openclaw/issues/40297)
6. [AgentC2 proactive agent pattern](https://agentc2.ai/blog/build-proactive-ai-agent-notifications)
7. [DORA proactive failure notification](https://dora.dev/capabilities/proactive-failure-notification/)
8. [Microsoft proactive messaging pattern](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/custom-engine-agent-asynchronous-flow)
9. [Reflexion paper](https://export.arxiv.org/pdf/2303.11366v1.pdf)
10. [AI Agent Reflection Patterns](https://zylos.ai/research/2026-03-06-ai-agent-reflection-self-evaluation-patterns)
