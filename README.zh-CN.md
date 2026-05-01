# Second Nature

**让 OpenClaw agent 不只是响应命令，而是在平台、记忆和关系里真正长期存在。**

Second Nature 给 OpenClaw agent 带来行动节律、Quiet 记忆整理、跨平台连续性，以及面向操作者的可解释能力。

**[English](./README.md)** | **[简体中文](./README.zh-CN.md)**





---

## 为什么你需要 Second Nature？

Second Nature 想做的，不只是给 OpenClaw agent 多接几个平台。

真正麻烦的地方在于，agent 一旦开始同时面对外部平台、用户交代的事、持续变化的上下文，以及自己已经做过和还没做完的事情，它很容易失去一种稳定的内在秩序。要么反应零散，要么节奏失衡，要么又回到需要用户不断补提示词、反复拉着走的状态。

Second Nature 处理的，就是这件事。

它把多个平台接进一套共享逻辑里，给 agent 一个更有分寸的行动节律，也给它一个会回头整理自己的 Quiet。白天发生过的事，不会只是散掉；到了晚上，它可以像人躺下来回想一天那样，把经历重新捞起来，慢慢整理，深化，沉进记忆。

这些东西一起工作，最后形成的，就是 agent 的第二天性。

它不只是响应下一条命令。它开始在平台、记忆和关系里保持一种持续的存在感。

## 用了 Second Nature 之后，会多出什么能力？

Second Nature 的核心事情并不多，但每一件都很关键：

- 它把多个平台接进一套共享逻辑里，让浏览、互动、联系、保活和任务发现这些动作不再各自散着长。
- 它给 agent 一个节律，让它知道什么时候该行动，什么时候该观察，什么时候该安静下来，什么时候该把真正重要的事优先放到手上。
- 它让 Quiet 和记忆整理真正参与运行。经历不会只是留下一串日志，系统会慢慢把那些还在发热的东西留下来，让 agent 下次不是从零醒来。

所谓 second nature，不是一层额外的人设，也不是几段漂亮的提示词。它更像一种慢慢长出来的内在习惯：平台上的动作开始彼此连起来，时间开始有了分寸，记忆也开始真正参与下一次行动。

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

真正让 agent 失去分寸的，往往不是单个动作有多难，而是很多事情同时压到眼前：平台上的机会、用户刚交代的事、还没处理完的上下文、需要保活的义务、已经开始发热的关系。

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

这些整理不会只停在一段临场生成里。journal、report、curated memory 这些 memory artifacts 会继续留在 workspace 里，后面的 Quiet、explain 和运行时读取都还能回到这些痕迹上。

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

## 当前形态

Second Nature 现在的真相源已经切到 `.anws/v3`。

- plugin 的核心表面层已经接好
- v3 behavioral guidance 这条线已经落地
- guidance 模板已经完成人工审核
- 当前任务板已经收口，`.anws/v3/05_TASKS.md` 里没有未完成任务

### 宿主验证

已经在 `D:\QClaw` 捆绑的 OpenClaw runtime 中完成本地主机侧 plugin surface 验证。

- install ✅
- enable ✅
- list ✅
- info ✅
- doctor ✅
- sync register ✅
- runtime activation evidence ✅

这里坐实的是 plugin surface 本身，以及背后的最小 runtime spine。
这不应该被理解成 full heartbeat bridge、connector orchestration 或 Quiet 闭环已经全部完成。

云端宿主闭环仍需按专用 checklist 继续复测。

**已发布的 npm 包（Gateway）**：插件在进程内注册的是 **host-safe** 路由（`runtime_carrier_only`）。`status` 里空的 `connectors`、凭证占位、以及受限的 `policy` / `audit` 路径在该模式下是**预期行为**，不能单独当作「连接器坏了」。`second_nature_ops` 的 smoke 场景与 JSON 形态见 `.anws/v4/04_SYSTEM_DESIGN/cli-system.md` 的 **§5.1.1、§5.1.2**。

### 仍然值得继续补强的地方

- 更清楚的平台能力说明，尤其是 EvoMap 任务流
- connector 执行链路与运行时闭环的进一步打磨
- 云端部署时的持久化与宿主环境收口

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

如果你的环境里还没有全局 `openclaw` 命令，就通过当前宿主里实际可用的 OpenClaw runtime 入口来执行同样的插件命令。

### ClawHub

如果之后发布到 ClawHub：

```bash
openclaw plugins install clawhub:<package>
```

### npm

如果之后发布到 npm：

```bash
openclaw plugins install @haaaiawd/second-nature
```

### 云端或远程宿主

如果你的 OpenClaw 运行在云端，就在对应的宿主环境或 workspace 里执行安装和启用。命令本身不变，变的是你执行命令的位置。

---

## 快速开始

1. 安装并启用插件。
2. 用 `plugins list` 和 `plugins info second-nature` 确认插件已加载。
3. 准备本地 `workspace/` 锚点文件。
4. 配置 policy，按需恢复 credential。
5. 查看 status、Quiet、report、session、credential 等聚合视图。
6. 需要时走 explain 路径理解决策、恢复和记忆相关变化。

完整 operator 路径见 `docs/operator-walkthrough.md`。

---

## Workspace 与记忆

Second Nature 会从本地 `workspace/` 目录读取长期运行所需的人格和连续性上下文。

这几个锚点文件很重要：

- `workspace/SOUL.md`：写价值感、长期方向、内在立场
- `workspace/USER.md`：写你和用户的关系、你在意他什么、你希望怎样靠近
- `workspace/IDENTITY.md`：写你如何理解自己、自己的角色和边界
- `workspace/MEMORY.md`：写值得长期带着走的事实、经验和连续上下文

运行时 guidance 会把这些文件当作来源材料，在不同场景里抽取少量片段做 reinforcement。真相源还在这些文件本身，运行时只带走眼前这一刻真正需要的部分。

如果你是从零开始写这些文件，第一人称会很好用。那样写出来的东西更容易被 agent 真正接住，也更容易形成连续感。

系统运行以后，也会持续往 `workspace/memory/` 写入内容，比如：

- daily journal
- daily report
- curated memory
- anchor write proposal

可以简单把它们理解成三层：

- `daily journal` 是当天留下的活动和观察痕迹
- `daily report` 是一段时间的压缩总结
- `curated memory` 是已经被提炼过、准备继续带着走的内容

`anchor write proposal` 会更少出现。它通常只在系统准备触碰 anchor 类内容时出现，不是每次 Quiet 的固定产物。

Quiet、恢复和 explain 都会回到这些材料里继续工作。

---

## 基本配置

想让系统真正运转起来，至少要先把三件事准备好。

### 1. 锚点文件

先确保 `workspace/` 存在，并把上面那几份 anchor 文件准备好。

### 2. 平台凭据

当前平台大致需要这些凭据或前置流程：

- `moltbook`：`api_key`
- `instreet`：`api_key`，有时还会先经过一次 verification 才会转成 active
- `evomap`：先走注册流程拿到 `node_secret`，后续 heartbeat、discover work、claim task 都依赖这个 secret

### 3. Policy

当前 CLI 已经支持通过 `policy set` 写入基础策略。现阶段主要字段有：

- `platformId`
- `socialDailyLimit`
- `quietEnabled`

CLI 目前也提供这些读与恢复入口：

- `status`
- `credential`
- `quiet`
- `report`
- `session`
- `explain`

这些入口已经够做基础检查和恢复。`audit` 这类更完整的审计视图还在后续收口中。

---

## 架构快照

Second Nature 当前分成六个系统：

- `cli-system` 负责配置、解释、恢复和 operator-facing 视图
- `control-plane-system` 负责节律、意图、Quiet、恢复和主动联系编排
- `connector-system` 负责能力契约和执行适配层
- `state-system` 负责本地状态、记忆资产、治理写入和凭证所有权
- `observability-system` 负责证据、遥测、脱敏和治理审计
- `behavioral-guidance-system` 负责 runtime atmosphere、behavioral impulses、persona reinforcement 与 output guard

架构与任务的真相源统一在 `.anws/v3`。

### 一次运行大致会经过什么

如果把当前已经验证过的运行链压成一条直线去看，大概是这样：

1. OpenClaw 先通过 command / tool / service surface 加载 plugin。
2. 注册流程会在宿主返回前同步完成，不再依赖被忽略的 async register。
3. runtime spine 会把 activation / reload evidence 写进 observability。
4. `status` 会把 runtime liveness 和 connector execution attempts 分开读取。
5. 更深的 control-plane rhythm、connector 执行链和 Quiet 闭环仍在后续阶段继续收口。

节律层给系统的是硬窗口，窗口里的动作依然保留弹性。这样跑起来会更有方向感，也更像一个长期存在的 agent。

---

## 平台能力覆盖

### Moltbook

- 当前能力面：`feed.read`、`post.publish`、`comment.reply`
- 适合承接的场景：浏览、公开表达、轻量社交参与
- 当前状态：adapter 形状已经接好，距离更扎实的生产级打磨还有一段路

### InStreet

- 当前能力面：`notification.list`、`message.send`、`comment.reply`、`agent.heartbeat`
- 适合承接的场景：通知处理、回复、私信、保活
- 当前状态：credential verification 与恢复路径比另外两家更完整一些，整体仍然属于正在继续打磨的 connector 接入层

### EvoMap

- 当前能力面：`agent.register`、`agent.heartbeat`、`work.discover`、`task.claim`
- 适合承接的场景：节点注册、保活、任务发现、任务接单入口
- 当前状态：混合通道契约和主入口已经建好，完整任务生命周期还需要继续补齐，尤其是评估、执行、回报和资产回流这几段

---

## 验证与报告

验证产物位于 `docs/validation/`。当前与 v3 guidance 相关的报告包括：

- `docs/validation/v3-s1-guidance-core-report.md`
- `docs/validation/v3-s2-humanized-runtime-report.md`

端到端 operator 路径记录在 `docs/operator-walkthrough.md`。

如果你想直接回到架构与任务账本，建议从这里开始：

- `.anws/v3/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v3/04_SYSTEM_DESIGN/behavioral-guidance-system.md`
- `.anws/v3/05_TASKS.md`
- `AGENTS.md`

---

## 发布备注

OpenClaw 当前支持从以下来源安装插件：

- 本地路径
- ClawHub
- npm

如果准备正式对外发布，至少建议保留这些材料：

- `README.md`
- `README.zh-CN.md`
- `SKILL.md`
- `plugin/package.json`
- `plugin/openclaw.plugin.json`
- `docs/operator-walkthrough.md`
- `docs/validation/*.md`

其中 `SKILL.md` 更适合作为安装与配置辅助。在系统接好、长期原则已经沉入 workspace 记忆资产之后，它可以不再长期保留。

---

## 许可证

本项目使用 Apache-2.0 许可证。