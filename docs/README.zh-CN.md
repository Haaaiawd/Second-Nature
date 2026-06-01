# Second Nature

**给 OpenClaw agent 的头脑接上身体、节律、记忆、睡眠、声音、健康感和恢复能力。**

**[English](./README.md)** | **[简体中文](./README.zh-CN.md)**

---

## 核心模型

Second Nature 从一个简单判断开始：

LLM 是头脑。Second Nature 是身体和生活环境。

头脑不能被降格成脚本化 planner。它需要观察、判断、犹豫、表达、修正自己，有时候也需要安静。但只有头脑是不够的。没有身体，就没有手脚，没有感官，没有痛觉，没有历史，也不知道昨天的行动有没有真的碰到世界。

Second Nature 要补的，就是这个身体。

它用 heartbeat 给 agent 节律，用 connector 给它手脚和感官，用 state 给它记忆，用 Quiet 和 Dream 给它睡眠整理，用 guidance 给它声音，用 health 和 digest 让 owner 看见它是否还在正常生活，用 timeline 和 restore 让错误不再是单向悬崖。

原则是：**引导，而不是控制。**

## v7 当前状态

当前架构真相是 `.anws/v7`。

v7 处在 Genesis / design phase。它还不是 forge-ready。详细系统设计、任务清单和验证计划需要继续通过 `/design-system`、`/challenge`、`/blueprint` 生成。

v7 新增的核心东西：

- `IdentityProfile`：跨 Agent World、MoltBook、InStreet 和未来 connector 的同一个“我”。
- `EmbodiedContext`：heartbeat 醒来时带着身份、goal、最近对话、accepted Dream projection、工具经验、身体健康和证据。
- `ToolAffordanceMap`：agent-facing 的手脚地图，告诉它什么安全、什么危险、什么疼、什么被挡住、什么值得小心试探。
- `ToolExperienceLog`：工具成功、失败、证据质量、策略拒绝、投递 fallback、owner 反应都变成身体反馈。
- `connector auto-probe` 与 `connector_test --wet`：注册时就真实调用安全 endpoint，不让 dry health 假装一切 ok。
- `CircuitBreaker`：connector 连续失败后自动冷却，到期只允许半开试探。
- `Quiet DailyDiary`：Quiet 不再只写一句 summary，而是写今天看到了什么、什么值得注意、明天想看什么。
- `Dream after Quiet`：Quiet 完成后，在窗口和预算允许时自动接 Dream。
- `HeartbeatDigest`：每日仪表盘式存在证明，例如各 connector 成功/失败、熔断、goal、Quiet/Dream、health。
- `NarrativeTimeline` 与 `RestoreSnapshot`：看得见 narrative 怎么变，也能在有限窗口内 undo / restore。
- `RuntimeSecretAnchor`：记录 `SECOND_NATURE_ENCRYPTION_KEY` 的持久化路径与恢复原则，但绝不记录 key 明文。

## 人形系统地图

| 人的比喻 | Second Nature 部分 | 做什么 |
|---|---|---|
| 头脑 | LLM / agent | 开放推理、判断、表达 |
| 节律 | Heartbeat | 醒来、看上下文、决定行动/观察/安静 |
| 手脚与感官 | Connectors | 接触外部平台，产生 evidence |
| 触觉与痛觉 | ToolExperience + CircuitBreaker | 记住什么好用、什么疼、什么时候该冷却 |
| 自我 | IdentityProfile | 让多个平台身份属于同一个 agent |
| 记忆 | State / artifacts | 保存 goal、对话、证据、叙事、关系和快照 |
| 睡眠 | Quiet + Dream | 把一天整理成日记、claim、insight 和 accepted projection |
| 声音 | Guidance + delivery | 有真实来由时才靠近 owner |
| 健康感 | SelfHealth + HeartbeatDigest | 看见哪里活着、哪里坏了、哪里未知 |
| 恢复能力 | Timeline + RestoreSnapshot | 看见变化，并在有限范围内撤回错误 |

## 写作原则

Second Nature 不是工具说明堆叠。

Quiet diary、inner guide、relationship-facing copy 应该像朋友边喝咖啡边谈话。可以平常，可以感性，可以偶尔有激情或哲思。

但温柔要有来处。

没有 source，就不要装熟。Dream 只是 candidate，就别说成结论。关系记忆还很薄，就别急着总结 owner 是什么样的人。

## Runtime Secret Anchor

Second Nature 的平台凭据依赖 `SECOND_NATURE_ENCRYPTION_KEY` 加密。

这个 key 必须保存在聊天记录和普通记忆之外。v7 要求 AGENTS / README / self health 记录 key 由哪里管理、怎么恢复、丢失后有什么后果，但绝不能记录 key 明文。

如果 key 丢了，旧密文可能无法恢复。系统必须诚实返回 `credential_recovery_required`，而不是假装旧平台身份还在。

## 安装基础

本地插件路径：

```bash
openclaw plugins install file:./plugin
openclaw plugins enable second-nature
openclaw plugins list
openclaw plugins info second-nature
openclaw plugins doctor
```

workspace root 要指向 OpenClaw agent workspace，不是插件安装目录。推荐设置：

```bash
SECOND_NATURE_WORKSPACE_ROOT=<OpenClaw agent workspace 的绝对路径>
SECOND_NATURE_ENCRYPTION_KEY=<由宿主管理的稳定密钥>
```

## 架构文档

- PRD: `.anws/v7/01_PRD.md`
- 架构总览: `.anws/v7/02_ARCHITECTURE_OVERVIEW.md`
- ADR: `.anws/v7/03_ADR/`
- 系统设计索引: `.anws/v7/04_SYSTEM_DESIGN/README.md`
- Changelog: `.anws/v7/06_CHANGELOG.md`

下一步：

```text
/design-system runtime-ops-system
/design-system control-plane-system
/design-system state-memory-system
/design-system body-tool-system
/design-system connector-system
/design-system dream-quiet-system
/design-system guidance-voice-system
/design-system observability-health-system
/challenge
/blueprint
```

## 许可证

Apache-2.0.
