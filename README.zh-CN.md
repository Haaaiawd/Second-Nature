<h1 align="center">Second Nature</h1>

<p align="center">
  <strong>让 OpenClaw agent 不只是响应命令，而是在平台、记忆和关系里真正长期存在。</strong>
</p>

<p align="center">
  Second Nature 给 OpenClaw agent 带来行动节律、Quiet 记忆整理、跨平台连续性，以及面向操作者的可解释能力。
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a> | <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/OpenClaw-Plugin-111827?style=for-the-badge" alt="OpenClaw Plugin">
  <img src="https://img.shields.io/badge/Milestones-INT--S1_to_INT--S4-1d4ed8?style=for-the-badge" alt="Milestones">
  <img src="https://img.shields.io/badge/Host-Validated-059669?style=for-the-badge" alt="Host Validated">
  <img src="https://img.shields.io/badge/License-Apache--2.0-f59e0b?style=for-the-badge" alt="License Apache 2.0">
</p>

<p align="center">
  <img src="docs/images/second-nature-lobster-triptych.jpeg" alt="Second Nature overview" width="900">
</p>

---

## 为什么你需要 Second Nature？

真正麻烦的，从来不是让 agent 多接一个平台。真正麻烦的是，当平台越接越多之后，系统还能不能保持稳定。

现在每个平台都有自己的 skill、自己的 CLI、自己的状态和限制。浏览、阅读、点赞、回复、发帖、看通知、保持在线、发现任务，这些动作底层逻辑明明有大量重合，表层却总在变化。

这种碎片化很快就会把系统拖乱。对 agent 来说，它会不断重复学习相似但又不完全相同的操作模式。对操作者来说，它会变成一堆脆弱、零散、难维护的流程。

Second Nature 想做的，就是把这堆碎片压成一套更稳定的操作模型。

## 用了 Second Nature 之后，会多出什么能力？

### 一套跨平台都能复用的操作方式

Second Nature 会把那些反复出现的动作收敛成一套 agent 能长期复用的操作方式。

对 agent 来说，下面这些事情不需要每换一个平台就重新学一遍：

- 浏览内容
- 阅读帖子或机会
- 点赞、回复
- 发布内容
- 检查通知
- 联系用户
- 保持在线
- 发现任务

平台自己的限制和细节当然还在，但这些东西不应该每次都冲进主决策里。Second Nature 做的，就是先把操作层的共同逻辑收起来，再把平台差异留在下面处理。

### 一个更有分寸的行动节律

很多系统接上平台之后，马上会掉进另一个问题。它开始什么都想做，什么都能做，但不知道什么时候该停。

Second Nature 处理的是这个节律问题。

它会帮助 agent 判断：

- 什么时候值得行动
- 什么时候该克制
- 什么时候该先观察
- 什么时候该进入 Quiet

所以它带来的不是更高频的自动化，而是更有分寸的行动。

### 一个真正有用的 Quiet 机制

Quiet 不是暂停键。Quiet 是一个低主动性的整理窗口。agent 在这个窗口里不急着对外动作，而是回头整理刚刚发生过的事，把零散活动变成后面还能继续用的东西。

它会用来做这些事：

- 整理日志和观察记录
- 提炼可以保留的记忆
- 做一次较安静的反思
- 更新连续运行所需的上下文

如果一个长期运行的 agent 每次都像刚被叫醒一样从头开始，那它很难真正积累什么。Quiet 机制的意义，就是让它慢慢积累，而不只是临时反应。

### 一套值得信赖的记录与查询能力

Second Nature 不只是让 agent 去行动，也会把关键过程留下来。

它会把状态、动作、恢复路径和关键决策以本地可追踪的方式保存下来。这意味着系统跑起来之后，你不需要靠猜去理解它发生了什么。

你可以回头看：

- 它现在是什么状态
- 刚刚执行了什么
- 哪一步失败了
- 为什么进入 Quiet
- 为什么联系了用户，或者为什么没有联系
- 哪些记忆被保留下来了

更重要的是，这些记录不只是给人类事后查日志用的。agent 自己也可以基于这套记录继续查询、解释和恢复，这样系统才真的能长期跑下去，而不是每次出问题都重新人工接管。

### 一个操作者真的能用起来的表面层

最后，Second Nature 会把这些能力整理成一个操作者能真正用起来的表面层，而不是把复杂性全藏在系统内部。

你能看到的包括：

- status 视图
- recovery 路径
- credential 状态
- report 和 Quiet 视图
- 基于证据的 explain 路径

可解释性在这里不是摆设。它的作用，是让这套长期运行机制在变复杂之后，依然能被看懂、被追问，也能被接管。

---

## 当前状态

### 里程碑链路

- `INT-S1` Substrate ✅
- `INT-S2` Decision Spine ✅
- `INT-S3` World Contact ✅
- `INT-S4` Operator Voice ✅

### 宿主验证

已经在 `D:\QClaw` 捆绑的 OpenClaw runtime 中完成宿主级验证。

- install ✅
- enable ✅
- list ✅
- info ✅
- doctor ✅

### 剩余后续项

- `T4.4.2` 正式 `ingestTick` 入口收敛

这件事依然值得做，但它不阻塞已经完成的里程碑链路。

### 当前已知但不阻塞的问题

- `plugin id mismatch`
- `plugins.allow is empty`

---

## 安装

### 本地路径安装

```bash
openclaw plugins install file:./plugin
openclaw plugins enable second-nature
openclaw plugins list
openclaw plugins info second-nature
openclaw plugins doctor
```

如果你在这台机器上使用的是 QClaw 内置的 OpenClaw runtime，已经验证过的命令路径是：

```bash
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins install file:./plugin
```

### ClawHub

如果之后发布到 ClawHub：

```bash
openclaw plugins install clawhub:<package>
```

### npm

如果之后发布到 npm：

```bash
openclaw plugins install @second-nature/openclaw-plugin
```

### 云端或远程宿主

如果你的 OpenClaw 运行在云端，就在对应的宿主环境或 workspace 里执行安装和启用。命令本身不变，变的是你执行命令的位置。

---

## 快速开始

1. 安装并启用插件。
2. 用 `plugins list` 和 `plugins info second-nature` 确认插件已加载。
3. 配置 policy，按需恢复 credential。
4. 查看 status、Quiet、report、session、credential 等聚合视图。
5. 需要时走 explain 路径理解决策、恢复和记忆相关变化。

完整 operator 路径见 `docs/operator-walkthrough.md`。

---

## 架构快照

Second Nature 当前分成五个系统：

- `cli-system` 负责配置、解释、恢复和 operator-facing 视图
- `control-plane-system` 负责节律、意图、Quiet、恢复和主动联系编排
- `connector-system` 负责能力契约和执行适配层
- `state-system` 负责本地状态、记忆资产、治理写入和凭证所有权
- `observability-system` 负责证据、遥测、脱敏和治理审计

架构与任务的真相源统一在 `.anws/v2`。

---

## 验证与报告

验证产物位于 `docs/validation/`：

- `docs/validation/s1-substrate-report.md`
- `docs/validation/s2-decision-spine-report.md`
- `docs/validation/s3-world-contact-report.md`
- `docs/validation/s4-operator-voice-report.md`

端到端 operator 路径记录在 `docs/operator-walkthrough.md`。

---

## 发布备注

OpenClaw 当前支持从以下来源安装插件：

- 本地路径
- ClawHub
- npm

如果准备正式对外发布，至少建议保留这些材料：

- `README.md`
- `README.zh-CN.md`
- `plugin/package.json`
- `plugin/openclaw.plugin.json`
- `docs/operator-walkthrough.md`
- `docs/validation/*.md`

---

## 许可证

本项目使用 Apache-2.0 许可证。
