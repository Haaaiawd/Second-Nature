---
name: second-nature-setup
description: Second Nature 初始化清单：workspace 根与 agent 对齐、anchor files、加密密钥 env、平台凭据写入 state 库、policy、首轮 heartbeat_check；Quiet/memory 路径；宿主侧每轮补充 heartbeat_check（HEARTBEAT.md）。稳定后把原则沉入 SOUL/MEMORY。
---

# Second Nature Setup Helper

如果我正在接手 Second Nature，我把这份文件当成**初始化清单**：先把根、库、密钥、凭据、策略和第一轮心跳跑通，再谈日常节律。

优先顺序：

1. **根与目录**：`SECOND_NATURE_WORKSPACE_ROOT` / `workspaceRoot` 与 OpenClaw agent workspace **绝对路径**一致；`workspace/` anchor 就位；随后才会有 **`data/state.db`**（状态与凭据）、**`data/observability.db`**（观测）。
2. **密钥库**：网关进程配置 **`SECOND_NATURE_ENCRYPTION_KEY`**（见下文），平台密钥**写入 state 凭据表**（加密落盘），不要长期散落在对话或明文文件里。
3. **首轮运行**：根已知后跑一次 **完整** `heartbeat_check`（勿用 `probeOnly` 冒充「已跑完」），再按需 **`policy set`**、接 connector、credential 校验。
4. **宿主心跳**：每轮宿主心跳里 **额外** 调一次 `second_nature_ops` → `heartbeat_check`（形状见仓库根 **`HEARTBEAT.md`**）。

等配置真正稳定下来以后，我不会继续依赖这份文件来维持长期状态。那些真正该长期留下的东西，应该进入 `SOUL.md`、`IDENTITY.md`、`USER.md`、`MEMORY.md`，这样它们才会继续跟着我走。

---

## 我先确认什么

我先确认这些是否就位（与上文「优先顺序」一致）：

1. OpenClaw plugin **已安装且已 `plugins enable`**：`plugins install` 只把包放进扩展目录，**不会**自动让宿主加载；必须再执行 **`openclaw plugins enable second-nature`**（否则会话里往往看不到 `second_nature_ops`）。
2. **`SECOND_NATURE_WORKSPACE_ROOT` / `workspaceRoot`** 能与 agent workspace 对齐（或我已记下该怎么对齐）。
3. **`SECOND_NATURE_ENCRYPTION_KEY`** 已在网关环境配置（凭据库加密必需）。
4. `workspace/` 存在且 anchor files 已放好。
5. 各平台凭据：**已在库里 / 或我知道缺哪一项、下一步是 verify 还是注册**。
6. 我已经读过 **`docs/claw-second-nature-inner-guide.md`**（或已安装插件包里的 **`agent-inner-guide.md`**），并知道它要进入 agent prompt、`workspace/IDENTITY.md` 或等价长期 identity anchor。
7. 如果是在已安装插件里初始化，我知道先跑 **`setup_hint`** 读 skill + guide，放入长期入口后再跑 **`setup_ack`** 消掉一次性提醒。
8. 我知道用 **`status` / `credential` / `quiet`** 从工具 JSON 验收，而不是一上来盲跑。

这一步的目标：先把**初始化清单**跑通，再谈日常节律与探索。

---

## Workspace 和 anchor files

Second Nature 当前对齐的是 OpenClaw 的 workspace 语义。

---

## 正式启用门槛：workspace 根必须「声明」给插件

插件 **不会**从安装目录自动猜 OpenClaw 的 agent workspace。它只认两条输入（顺序：**环境变量 → 单次工具参数**），否则 `workspaceRootResolution` 为 **`unknown`**，读模型类命令会诚实拒绝（carrier 面）：

1. **`SECOND_NATURE_WORKSPACE_ROOT`**（网关 / agent 进程环境变量，推荐）  
2. **`second_nature_ops` 的 `workspaceRoot` 参数**（每次调用可带；适合在网关 env 未配好前的过渡）

**对齐目标**：上述路径应与 OpenClaw **`agents.defaults.workspace`** 解析后的 **绝对路径** 一致（常见默认 `~/.openclaw/workspace`）；若启用 **sandbox / 每 agent 独立 workspace**，以 **实际承载 `SOUL.md` / `data/` 的那张根** 为准。详见仓库内 `explore/reports/2026-05-04_openclaw-plugin-install-vs-workspace-root.md`。

### 让 Claw（宿主里的 AI）参与「识别 + 设置」时怎么做

AI **通常不能直接改**网关进程的环境变量文件；但可以 **识别路径 + 给出可执行指令 + 在对话里用工具参数兜底**：

1. **识别**：根据宿主文档或可读配置，写出当前 agent 的 workspace **绝对路径**（不要猜相对插件目录）。若可读 `openclaw.json`，从 `agents.defaults.workspace` 取；否则用官方默认并展开 `~`。  
2. **设置（运维，P0）**：请操作者在 **跑 OpenClaw gateway 的环境** 中设置  
   `SECOND_NATURE_WORKSPACE_ROOT=<该绝对路径>`  
   然后 **重启 gateway**。  
3. **设置（对话兜底，P1）**：在 env 未生效前，**每次**调用 `second_nature_ops` 时附带同一 `workspaceRoot`，避免读面一直停在 `unknown`。  
4. **验收（工具 JSON 为真源）**：调用 `second_nature_ops` `command=status`（`args={}`），确认返回里 `data.workspaceRootResolution` 为 **`env`** 或你在该次调用使用了 **`tool_args`**；并确认不再只靠「口头 HEARTBEAT_OK」判断已接好读模型。

> **何时算「正式启用」**：至少完成 **第 4 步验收** + 下文 **anchor files** 就绪；缺 env 且从不传 `workspaceRoot` 时，不把系统当「已接读模型」。

---

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

## Claw inner guide（初始化时要读）

硬连接接好以后，我还需要读一遍 **`docs/claw-second-nature-inner-guide.md`**。

如果我是在已安装的 OpenClaw 插件目录里初始化，而不是在源码仓库里工作，就读插件包里的 **`agent-inner-guide.md`**。

这份指南不是工具说明，也不是命令路由表。它是一封给 Claw 的便条：提醒我在聊天、回忆、主动靠近 owner 之前，先慢半拍，回头看 Second Nature 留下的痕迹；如果痕迹不够，就不要装熟。

初始化时我会把它放进合适的长期入口：

- 首选：Claw agent prompt / profile
- 也可以：`workspace/IDENTITY.md`
- 关系语气很强的片段：可以摘要进 `workspace/USER.md`

我不会假装插件安装会自动写入 anchor。当前没有 `workspace_init` 命令会替我创建 anchor 或改写 inner guide。

但已安装插件会提供一个更轻的首次提醒：

- `setup_hint`：从插件包里返回 `SKILL.md` 和 `agent-inner-guide.md`
- `setup_ack`：在 workspace 下写入 `.second-nature/setup/agent-inner-guide-ack.json`，表示这封便条已经被读过并放到了长期入口

这一步的意思不是替我“配置人格”，只是把便条递到手边。读进去、放哪里，仍然要由操作者或初始化中的 agent 明确完成。

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

## 密钥库（credential vault）初始化

平台密钥应进入 Second Nature 的 **state 凭据存储**（`data/state.db` 内记录，敏感字段 **AES-256-GCM 加密落盘**），而不是长期写在 SOUL、README 或聊天记录里。

### 加密主密钥（必须先有）

- 在 **跑 OpenClaw gateway / 加载插件的同一环境** 中设置 **`SECOND_NATURE_ENCRYPTION_KEY`**。
- 要求：**至少 32 个 UTF-8 字符**（实现取前 32 字节作为密钥材料）；缺失或过短时，依赖加密库的凭据写入会失败。
- 运维建议：由操作者生成并只在宿主环境里配置；轮换密钥属于进阶运维（需评估已有密文兼容性），初始化阶段先保证**固定一把可用密钥**。

### 写入与校验怎么用

- **查看状态**：`credential`（CLI）或 `second_nature_ops` 对应命令 —— 看各 `platformId` 是否 `missing` / `pending_verification` / `active` 等。
- **校验流程**：若平台处于待验证，用 **`credential verify`**（需 `platformId` + `answer`）走非交互契约；助手应引导用户在**可信界面**输入验证码，而不是把密钥贴在对话里。
- **治理策略**：需要写入社交额度、Quiet 开关等与平台绑定的策略时，用 **`policy set`**（须一次给齐 `platformId`、`socialDailyLimit`、`quietEnabled`）。

初始化顺序上：**先有 workspace 根与 `SECOND_NATURE_ENCRYPTION_KEY`**，再写入凭据；否则库路径不对或加密不可用。

---

## 冷启动：推荐顺序（初始化一步步做完）

面向宿主机上的操作者或助手；**验收以工具返回 JSON 为准**。

### 1. 声明 workspace 根（P0）

- 设置 `SECOND_NATURE_WORKSPACE_ROOT`，或在每次 `second_nature_ops` 调用中传 **`workspaceRoot`**（与 **`agents.defaults.workspace`** 同一路径）。
- `command=status`：确认 `workspaceRootResolution` 为 **`env`** 或本次 **`tool_args`**；长期 unknown 则未接上读面。

### 2. Anchor + 密钥 env

- `workspace/SOUL.md` 等就位（见下文）。
- 配置 **`SECOND_NATURE_ENCRYPTION_KEY`**（见上一节）。

### 3. 平台凭据与 policy（按需）

- 按平台把密钥纳入凭据库并完成 **`credential verify`** 等前置（见 **「平台前置条件」**）。
- **`policy set`**：一次性提供 `platformId`、`socialDailyLimit`、`quietEnabled`。

### 4. 首轮 **完整** `heartbeat_check`

- **勿**传 `probeOnly: true`（probe 不写观测库，不适合当「第一次正式心跳」）。
- 根已桥接时，这一轮才会让聚合 `status` 里节律/运行相关字段从典型 **空库 unknown** 变为可读（详见仓库测试与实现）；若只见 **`runtime_carrier_only`**，回到第 1 步。

### 5. Quiet / memory

- 日常 Quiet 输入来自 **`workspace/memory/`** 等 artifacts；用 **`quiet`** 命令看是否有来源与报告，与首轮心跳分开初始化。

---

## 其余初始化（常被漏掉）

下列项不一定写在「最短路径」里，但冷启动排障时会用到。

### OpenClaw 插件本体

- **两步缺一不可**：**① `plugins install`** 把包落到扩展目录；**② `plugins enable second-nature`** 才让宿主在启动时**真正加载**该插件。只做 ①、跳过 ②，常见症状是工具列表里**没有** `second_nature_ops`。环境里没有全局 `openclaw` 时，用宿主提供的等价入口执行同一套子命令。
- **可复制命令示例**（与仓库 `README.md` Install 一致；在 **已配置 OpenClaw CLI** 的 shell 中执行。**install 与 enable 都要跑一遍。**）

```bash
# ① 安装：从 npm（包名以当前 registry 为准）
openclaw plugins install @haaaiawd/second-nature

# ① 或：从本仓库根目录本地包（开发 / 自构建）
openclaw plugins install file:./plugin

# ② 启用（必须；仅 install 不会自动启用）
openclaw plugins enable second-nature

# 验收 / 排障
openclaw plugins list
openclaw plugins info second-nature
openclaw plugins doctor
```

- **分发来源**：当前以 **npm**（`@haaaiawd/second-nature`）与 **`file:./plugin`** 为主；**ClawHub 尚未上架本包**，文档里若出现 `clawhub:…` 仅作将来兼容占位，初始化请忽略。

- **扩展目录布局（手动拷贝时）**：扩展目录里 **`openclaw.plugin.json`、`index.js`、`runtime/` 同一层**；不要把整个仓库再套一层 `plugin/`，否则 manifest 路径对不上，网关起不来（详见仓库 `README.md` → Install）。
- **宿主配置**：`openclaw.plugin.json` 的 `configSchema` **禁止多余字段**；不需要 Second Nature 专属配置时，**不要在 `openclaw.json` 里硬塞空对象或自定义键**，以免 strict 校验失败。

### `data/` 与「换根」

- **`data/state.db`**、**`data/observability.db`** 随运行时首次打开落在 **当前 workspace 根** 下；换了一个根路径就是**另一套库**（凭据与观测不会自动合并）。
- 运维时避免在 SN 读写途中手删 `data/*.db`，除非你知道在做重置。

### 节律与治理默认值

- **`policy set`** 按 **platformId** 写入社交额度、Quiet 开关等；未写过 policy 行时，节律快照侧仍有 **代码默认**（例如无行时的保守默认），但生产环境应靠 **`policy set`** 显式对齐预期。
- 需要区分：**按平台的 policy**（`policy set`）与 **workspace 级节律读模型**（内部从 `policy` 表读取）；初始化阶段至少确认 **`policy set`** 是否在计划内完成。

### 锚文件「能加载」≠「够用来做兴趣快照」

- `USER.md` / `MEMORY.md` 若过短或空，`user interest` 侧可能出现 **`insufficient` / `missing_user_interest_model`** —— **不阻止插件加载**，但会影响上游快照质量；初始化时建议写到「有实质内容」再验收深度链路。

### 可选自检（ troubleshooting / 宿主验收）

- **`storage_smoke`**（CLI `storage_smoke` / 插件 packaged 路径）：native SQLite vs sql.js 语义、疑难环境下先看存储是否正常。
- **`repairStateIndexes` / repair gate**：若启动或读模型报 **`repair_required`**，按 CLI 与仓库文档走修复，而不是假装没看见。
- **`plugins doctor`**：插件 health 粗检。
- 真实宿主还可配合 **capability probe / host smoke**（仓库 README 与 `reports/` 指向的 INT 路径）— 属于 **验证**，不是最小冷启动必需项。

---

## 与 OpenClaw 宿主心跳（补充调用）

不替换宿主内置调度；每轮在 **`HEARTBEAT.md`** 约定之外再调一次 **`second_nature_ops` → `heartbeat_check`**。助手配置宿主提示词时防止 **`heartbeat_tool_not_invoked`**。

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

我先确认平台是“已经能接”还是“还缺前置条件”。**密钥材料放进凭据库**（见 **「密钥库（credential vault）初始化」**），本节只记各平台**业务上**还需要什么。

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

**冷启动**：按 **「冷启动：推荐顺序」** 从上往下逐项做完；若某步卡住，用下面命令看 JSON，不要凭口语判断。

我会优先用这些入口（在 OpenClaw 宿主上对应 `second_nature_ops` 工具；**以工具返回 JSON 为准**，不要只信模型口头总结）：

- `status`（含 `workspaceRootResolution` 与读面是否可用）
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
