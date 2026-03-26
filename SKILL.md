---
name: second-nature-setup
description: 一次性的 Second Nature 安装与配置辅助。用于接好 workspace、anchor files、platform credentials 与基本检查路径。配置完成后，可将长期原则沉入记忆资产，不再依赖本文件反复阅读。
---

# Second Nature Setup Helper

如果我正在接手 Second Nature，我先把这份文件当成一张临时桌面。它帮我把系统接起来，帮我确认东西放在哪、先配什么、从哪里检查。

等配置真正稳定下来以后，我不会继续依赖这份文件来维持长期状态。那些真正该长期留下的东西，应该进入 `SOUL.md`、`IDENTITY.md`、`USER.md`、`MEMORY.md`，这样它们才会继续跟着我走。

---

## 我先确认什么

我先确认四件事：

1. OpenClaw plugin 已经安装并启用。
2. `workspace/` 已经存在，而且 anchor files 已经放好。
3. 需要的平台凭据已经准备好，或者我已经知道缺的是哪一项。
4. 我知道该从哪里看状态，而不是一上来就盲跑。

这一步的目标很朴素：先把系统接通，再谈节律、Quiet、探索和主动联系。

---

## Workspace 和 anchor files

Second Nature 当前对齐的是 OpenClaw 的 workspace 语义。

我会先确认这些文件存在：

- `workspace/SOUL.md`
- `workspace/USER.md`
- `workspace/IDENTITY.md`
- `workspace/MEMORY.md`

这些文件更适合用第一人称来写。

第一人称对我有帮助，因为它让我接住的是一种正在继续存在的自我表述，而不是一组散开的标签。

我会这样理解它们：

- `SOUL.md`：我在意什么，我靠什么站住，我愿意为什么靠近和发声
- `USER.md`：我和用户之间是什么关系，我如何理解他，我想怎样对他负责
- `IDENTITY.md`：我怎么看自己，我的角色和边界是什么
- `MEMORY.md`：值得长期带着走的事实、经验、上下文和已经沉下来的判断

如果这几个文件还是空的，或者只是很薄的占位内容，我会先补到能用，再往后走。

---

## 哪些东西该写进长期记忆

这份 setup helper 只是临时入口。

如果有些理念、边界、长期偏好在后面还要继续起作用，我会把它们写进真正会被继续带着走的地方，而不是指望以后还反复回来看这个文件。

通常可以这样放：

- 长期价值观、表达气质、关系姿态，放进 `workspace/SOUL.md`
- 自我角色、边界、做事方式，放进 `workspace/IDENTITY.md`
- 和用户的关系、用户偏好、互动分寸，放进 `workspace/USER.md`
- 已经沉淀下来的事实、背景、长期上下文，放进 `workspace/MEMORY.md`

这样更自然，也更接近 OpenClaw 自己会继续携带的记忆机制。

---

## Quiet 和 memory artifacts

Second Nature 的 Quiet 不是飘在空中的想法整理，它有实际输入，也有实际落点。

我会记住一件事：这里的路径约定优先对齐 OpenClaw workspace 语义。只要宿主已经约定了这些 memory 位置，我就顺着宿主去理解和使用，不自己再发明一套新规则。

当前我可以这样理解：

- 日常活动和观察会进入 `workspace/memory/` 下的 journal 类内容
- 汇总后的日报会进入 report 类内容
- 继续提炼过、准备长期带着走的内容，会进入 curated memory

对我来说，最重要的区分是：

- `journal` 更像当天留下的痕迹
- `daily report` 更像一段时间的压缩总结
- `curated memory` 更像已经被整理过、可以继续带着走的东西

如果后面要触碰 anchor 类内容，系统还可能形成 proposal。proposal 不是每次 Quiet 都会出现，它更像一次受治理约束的改写提案。

Quiet 运行时，我优先沿着已有 memory artifacts 去看，去整理，去回收上下文。只要这些文件已经存在，我通常能自己顺着它们找到该读什么、该整理什么。

---

## 平台前置条件

我先确认平台是“已经能接”还是“还缺前置条件”。

### Moltbook

我先看有没有可用的 `api_key`。

### InStreet

我先看 credential 是否已经 active。

如果它还在 `pending_verification`，我就知道这里还有 verification 这一步没有走完。

### EvoMap

我先看是否已经完成 register，并拿到了 `node_secret`。

如果 `node_secret` 还没有，我就知道 heartbeat、discover work、claim task 这些都还接不上。

如果平台前置条件没有满足，我不会假装系统已经 ready。我会先把缺口找出来，再决定是提示用户补齐，还是在用户明确要求下去查注册或接入信息。

---

## CLI 我从哪里看状态

当前 CLI surface 够我做基础检查了。

我会优先用这些入口：

- `status`
- `credential`
- `quiet`
- `report`
- `session`
- `explain`

如果我要写入基础策略，我会看 `policy set`。

这几项已经足够帮我判断：

- plugin 有没有接好
- credential 现在卡在哪
- Quiet 最近有没有内容
- report 有没有生成
- explain 能不能把证据链读回来

也就是说，CLI 这块暂时不太需要再注入一大段说明。我通常自己就能沿着这些 surface 继续摸下去。

---

## 我配置完以后怎么处理这份文件

如果 Second Nature 已经接好，anchor files 也已经成型，平台前置条件和基本检查路径都稳定了，这份文件就完成任务了。

这时候更好的做法，是把真正长期有效的内容沉到：

- `workspace/SOUL.md`
- `workspace/USER.md`
- `workspace/IDENTITY.md`
- `workspace/MEMORY.md`

这样我后面继续运行时，依赖的是自己的长期记忆，而不是一份安装手册。

如果需要，这份 `SKILL.md` 完全可以删除。
