# cli-system 调研笔记 (v4)

**日期**: 2026-03-27  
**系统**: `cli-system`  
**范围**: OpenClaw plugin surface、runtime artifact package、command/tool/service packaging

---

## 1. OpenClaw 插件系统给出的硬约束

来自 OpenClaw `插件` 文档的关键信号：

- 原生 OpenClaw 插件通过 `openclaw.plugin.json` + 运行时模块加载
- 发现和配置验证在 runtime 执行前完成，依赖的是 manifest/schema 元数据
- 原生运行时代码在 Gateway 进程内执行
- 插件可以注册：
  - command
  - tool
  - service
  - HTTP route
  - provider
  - hooks

### 对 cli-system 的直接启发

- `cli-system` 不是单纯 CLI 文本层，而是 plugin surface 的真正交付边界
- manifest/schema 要保持轻量、可验证
- runtime 代码必须在安装后就能被加载，而不是回头找源码仓

---

## 2. 当前问题的根因

云端实测已经暴露出一个非常具体的问题：

- 发布包只有 wrapper 和 manifest
- wrapper 运行时尝试 `require("../src/cli/index.js")`
- 安装后的宿主目录里没有源码仓 `src/`
- 所有命令进入 fallback

这说明当前插件包满足的是“可发现”与“可安装”，不满足“可运行”。

### 结论

`cli-system` 当前最关键的设计目标不是再加命令，而是把 plugin surface 做成真正可部署的 runtime artifact。

---

## 3. OpenClaw plugin surface 的最佳切分

从宿主模型看，一个健康的插件通常分成两层：

### 层 A: Manifest / Config Layer

负责：

- plugin id
- capabilities 声明
- config schema
- manifest metadata

特点：

- 宿主在 runtime 之前就能理解
- 不依赖执行插件代码

### 层 B: Runtime Registration Layer

负责：

- `registerCommand`
- `registerTool`
- `registerService`
- 将运行时代码接到宿主注册表

特点：

- 必须是安装后立即可加载的代码
- 不能依赖源码仓外部路径

---

## 4. 对 Second Nature 的 package 设计建议

### 建议 1: wrapper 继续保留，但只能引用包内 runtime

wrapper 可以继续存在，因为它是 OpenClaw plugin entry 的自然位置。

但 wrapper 只能做这几件事：

- 解析包内 runtime entry
- 注册 command / tool / service
- 在 runtime 缺失时给出极小 fallback

它不能再依赖：

- `../src/...`
- 外部源码仓结构

### 建议 2: 发布包要显式区分 artifact 边界

建议发布包内至少要有：

- `plugin/index.*` 作为 entry
- `runtime/cli/*`
- `runtime/state/*`
- `runtime/observability/*`
- `runtime/core/*`（至少包含 heartbeat entry 所需部分）

重点不是目录名本身，而是“运行时依赖必须在包内闭合”。

### 建议 3: fallback 不能再是常态路径

fallback 仍然值得保留，用于：

- artifact 损坏
- 版本不兼容
- 极端宿主加载失败

但 fallback 不能再被默认触发。否则 npm/ClawHub 发布的包只是“表面安装成功，实际全空壳”。

---

## 5. 当前命令面给出的信号

当前 `src/cli/index.ts` 已经说明：

- command router 是真实存在的
- 它会创建：
  - stateDb
  - observabilityDb
  - stateApi
  - readModels
  - actionBridge

也就是说，`cli-system` 实际上已经拥有一个最小 runtime dependency graph。

### 设计含义

发布包需要携带的，不只是命令函数本身，而是这条最小依赖图：

- command router
- read models
- action bridge
- state / observability runtime deps

否则 `status / credential / quiet / report / session / explain` 这些命令没有宿主内的运行基础。

---

## 6. 对 cli-system 的系统边界建议

### cli-system 负责什么

- plugin manifest / config surface
- command / tool / service registration
- runtime artifact package 交付边界
- operator-facing read / explain / policy / credential surface

### cli-system 不负责什么

- 不负责 heartbeat 决策本身
- 不负责 connector 执行策略
- 不负责 guidance 软层编排

但它负责一件非常要命的事：

> 把这些能力作为一个真的能安装、真的能运行的插件交给宿主。

---

## 7. 常见反模式

### 反模式 A: 把 plugin 包当成源码入口的快捷方式

表现：
- 运行时依赖 `../src/*`

问题：
- 本地开发时看起来没问题
- 一旦发布到云端或 npm 就立刻失效

### 反模式 B: 用 fallback 掩盖 artifact 缺失

表现：
- 安装成功
- 命令全 fallback
- 还觉得“至少没崩”

问题：
- 实际是在用安装成功假象掩盖运行失败

### 反模式 C: 把整个源码仓全打进插件包

表现：
- 简单粗暴
- 什么都带进去

问题：
- 包体膨胀
- 边界模糊
- 测试、文档、开发源码与运行时缠在一起

---

## 8. 调研结论

- `cli-system` 在 v4 的关键职责不是新增更多命令，而是把 plugin surface 做成真正可部署的 runtime artifact
- OpenClaw 插件模型本身支持这件事：manifest/schema 与 runtime registration 本来就应该分层
- 最合理的路线是：
  - 保留轻量 wrapper
  - 引入包内 runtime artifact
  - 让 command / tool / service 都从包内闭合依赖中运行
- 这条线是 v4 packaging 收口的核心，不应被视为边角修补
