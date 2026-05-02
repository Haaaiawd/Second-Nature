# ADR-007: Heartbeat Delivery 与 Life Evidence 闭环

## 状态
Accepted

## 日期
2026-05-01

## 背景
v4 已经证明 Second Nature 可以作为 OpenClaw plugin 被宿主加载，并通过 `HEARTBEAT.md + second_nature_ops("heartbeat_check")` 返回 host-safe acknowledgment。但这只证明“能被唤醒”，没有证明以下 v5 核心体验：

- heartbeat 会读取真实或 near-real life evidence
- 系统会基于 rhythm window、user interest、cooldown、dedupe 和 source refs 做 outreach judgment
- 值得联系用户时，消息会真的投递到 OpenClaw 用户可见会话
- 投递不可用时，系统会留下可解释 fallback，而不是声称已联系

OpenClaw heartbeat 文档明确说明 heartbeat 是周期性 main-session agent turn。是否外送由 delivery 配置控制：`target: "none"` 会运行但不外送；`target: "last"` 或显式 channel/to 才能投递。`HEARTBEAT_OK` 在回复首尾出现且剩余内容较短时会被当作 ack 并丢弃。

因此，v5 的主动联系不能只依赖 “heartbeat_check 返回非错误”。它必须把 heartbeat run、life evidence、outreach judgment 与 delivery target 作为一个闭环设计。

## 决策驱动因素
- 因素 1: README 目标是“主动找用户聊天 / 有自己的生活”，不能再停留在 host-safe acknowledgment
- 因素 2: OpenClaw 已有 heartbeat delivery 语义，重建消息通道会制造不必要复杂度
- 因素 3: 默认 `target: "none"` 是真实失败模式，必须在架构层显式防住
- 因素 4: 主动联系必须 evidence-backed、低频、高阈值、可冷却、可审计
- 因素 5: Quiet 和记忆整理必须消费 source-backed life evidence，不能靠模型自述编故事

## 候选方案

### 方案 A: Heartbeat delivery 作为主闭环，plugin hooks / injection 提供动态上下文
- **描述**: 以 OpenClaw heartbeat 作为主运行入口；通过 `heartbeat_prompt_contribution`、next-turn injection 或等价 runtime API 注入 life evidence summary；由 control-plane 生成 outreach judgment；通过 OpenClaw delivery target 投递。
- **优点**:
  - 与 OpenClaw 官方 heartbeat / delivery 语义一致
  - 不重建 channel / DM / notification 栈
  - 可以自然处理 `HEARTBEAT_OK` 静默与用户可见提醒
  - hook 与 message delivery 审计点清晰
- **缺点**:
  - 依赖宿主 heartbeat target 配置与 plugin runtime API 可用性
  - `target: "last"` 对当前用户会话的映射需要实测验证

### 方案 B: 只保留 `HEARTBEAT.md + second_nature_ops("heartbeat_check")`
- **描述**: 继续让 OpenClaw heartbeat 调用工具，工具返回状态和建议，由模型自然决定是否回复。
- **优点**:
  - 延续 v4 已验证 bridge，改动小
  - 容易保持 host-safe
- **缺点**:
  - 无法证明用户可见 delivery
  - 容易继续出现“醒了但没找用户”的错觉
  - life evidence / outreach judgment / delivery audit 边界不清

### 方案 C: 插件直接实现自有 outbound channel
- **描述**: Second Nature 插件绕过 OpenClaw heartbeat delivery，自己接第三方私信或通知 API。
- **优点**:
  - 自主控制投递路径
- **缺点**:
  - 重建 OpenClaw 已有 channel delivery
  - 权限、审计、配置、失败处理复杂
  - 容易和宿主会话状态分裂

### 方案 D: Operator-visible inbox 作为唯一输出
- **描述**: 主动联系不发用户会话，只写入本地 inbox / report / explain 视图。
- **优点**:
  - 易实现，风险低
  - 适合作为 delivery unavailable fallback
- **缺点**:
  - 无法兑现“像朋友一样主动找我说”的核心体验
  - 用户需要主动打开查看，关系感弱

## 决策
选择 **方案 A: Heartbeat delivery 作为主闭环，plugin hooks / injection 提供动态上下文**。

正式确定以下原则：

### 1. Delivery target 是主动联系闭环成立的硬前提
- heartbeat run 成功不等于 outreach delivery 成功
- `target: "none"` 必须被记录为 `delivery_unavailable` 或 `not_delivered_by_host_policy`
- 只有当 OpenClaw delivery target 可解析到用户可见 channel / recipient 时，系统才能声明主动联系闭环成立
- `HEARTBEAT_OK` 只用于无事静默；需要提醒用户时不得把 `HEARTBEAT_OK` 放在会被 ack drop 的位置

### 2. Life evidence 是所有主动联系和 Quiet 的事实来源
- 主动联系必须引用 `LifeEvidence.sourceRefs` 或 `UserInterestSnapshot.sourceRefs`
- Quiet / Narrative Reflection 可以有主观语气，但 claim 必须能追溯到 evidence
- evidence 为空时，系统应静默或记录空状态，不得虚构“今天看到/做了什么”

### 3. Outreach judgment 属于 control-plane，表达草稿属于 guidance
- `control-plane-system` 负责判断是否值得联系、是否冷却、是否重复、是否有可用 delivery
- `behavioral-guidance-system` 只负责生成自然、短句、有来由的朋友式表达
- guidance 不得把 hard deny 改成 allow

### 4. OpenClaw hooks / runtime API 是参与点，不是替代通道
- `heartbeat_prompt_contribution` 用于注入 heartbeat-only context
- `enqueueNextTurnInjection` 适合把 life evidence summary 或 policy delta exactly-once 带到下一轮
- 若宿主版本暴露 `runHeartbeatOnce({ heartbeat: { target: "last" } })` 或等价能力，可作为插件主动唤醒并投递的增强路径
- 若该能力不可用，v5 仍可依赖 Gateway heartbeat 配置，但必须在 capability report 中写明限制

### 5. Operator-visible inbox 是兜底，不是主体验
- 当 delivery target 不可用、channel 未配置、host policy 阻止 DM 或投递失败时，系统必须写入 operator-visible fallback
- fallback 必须携带 reason、source refs、candidate message 和下一步建议
- fallback 不得被表述为“已联系用户”

## 候选方案对比

| 候选 | 总体判断 | 优势 | 劣势 |
|------|----------|------|------|
| Heartbeat delivery + hooks / injection | 最优 | 贴合 OpenClaw 语义；不重建通道；可审计 | 需要实测 delivery target 与 runtime API |
| 只保留 heartbeat_check bridge | 不足 | 延续 v4，改动小 | 不能证明用户可见主动联系 |
| 插件自建 outbound channel | 不推荐 | 自主控制投递 | 重建宿主能力，权限和审计复杂 |
| Operator-visible inbox only | 兜底 | 简单、安全 | 不能兑现朋友式主动联系 |

## 质量门禁

v5 blueprint 必须产生以下验证任务：

- **Host capability probe**: 验证当前 OpenClaw 版本是否支持 heartbeat `target: "last"`、显式 channel/to、plugin runtime `runHeartbeatOnce` 或等价能力。
- **Ack behavior test**: 验证 `HEARTBEAT_OK` 被正确静默，非 ack alert 不被误丢弃。
- **Target-none test**: 验证 `target: "none"` 下 run 成功但 delivery 不成立，并记录正确 reason。
- **Evidence-backed outreach test**: 给定一条 `LifeEvidence` 与 `UserInterestSnapshot`，验证 outreach message 包含 source-backed reason。
- **Delivery fallback test**: 当 OpenClaw delivery 不可用时，验证 operator-visible fallback 被写入且不冒充已发送。
- **Quiet empty-evidence test**: 当当天 evidence 为空时，Quiet 不得虚构经历。

## 后果

### 正面
- v5 主动联系目标第一次拥有可验证宿主路径
- “有自己的生活”被绑定到 evidence，而不是 prompt 表演
- 默认 `target: "none"`、ack drop、delivery unavailable 等坑被前置到架构层
- 控制层、guidance、state、observability 的职责边界更清楚

### 负面
- v5 进度会受 OpenClaw 当前版本 capability 影响
- 需要增加宿主 smoke test，而不是只跑本地单元测试
- 若用户没有配置外部 channel，体验只能降级到 operator-visible fallback

### 需要的后续行动
- 在 `control-plane-system` 设计中定义 heartbeat decision loop、outreach judgment、delivery policy 与 fallback
- 在 `cli-system` 设计中定义 capability probe 与 host smoke report
- 在 `state-system` 设计中定义 `LifeEvidence`、`UserInterestSnapshot`、`DeliveryAttempt` 与 `QuietArtifact`
- 在 `observability-system` 设计中定义 delivery audit、source coverage 与 denial/fallback reasons
- 在 `/blueprint` 中把质量门禁拆成 P0 验证任务

## 参考资料
- `../01_PRD.md`
- `../02_ARCHITECTURE_OVERVIEW.md`
- `../04_SYSTEM_DESIGN/_research/openclaw-lived-experience-closure-research.md`
- `https://docs.openclaw.ai/gateway/heartbeat`
- `https://docs.openclaw.ai/plugin`
- `https://docs.openclaw.ai/plugins/hooks`
- `https://github.com/openclaw/openclaw/issues/40297`
- `https://dora.dev/capabilities/proactive-failure-notification/`
- `https://export.arxiv.org/pdf/2303.11366v1.pdf`

## 影响范围

本 ADR 被以下系统引用:
- `control-plane-system` - heartbeat decision loop、outreach judgment、delivery policy、fallback
- `cli-system` - host capability probe、OpenClaw smoke test、operator-visible fallback
- `state-system` - life evidence、user interest snapshot、delivery attempt、Quiet artifact
- `behavioral-guidance-system` - friends-like outreach draft 与 source-backed expression
- `observability-system` - delivery audit、ack/drop/fallback reason、source coverage
- `connector-system` - life evidence producer contract
