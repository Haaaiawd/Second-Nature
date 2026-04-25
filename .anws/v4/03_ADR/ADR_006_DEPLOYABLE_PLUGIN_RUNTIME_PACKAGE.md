# ADR-006: 可发布的自足 Plugin Runtime Package

## 状态
Accepted

## 日期
2026-03-27

## 背景
Second Nature 当前的 npm 插件包可以被 OpenClaw 成功识别、下载和安装，但云端实测暴露出一个硬问题：

- 发布包只包含 plugin wrapper 和 manifest
- 安装后的 runtime 尝试加载 `../src/cli/index.js`
- 宿主环境并不存在源码仓 `src/` 目录
- 所有命令都退化为 fallback stub

这意味着当前的发布形态不是“可部署 plugin”，而只是“能被识别的 wrapper 包”。

## 决策驱动因素
- 因素 1: 发布包安装后必须直接可运行，不能依赖源码仓
- 因素 2: OpenClaw 插件分发应保持 npm / ClawHub 标准形态
- 因素 3: 运行时需要同时支撑 command、tool、service 与 heartbeat entry
- 因素 4: packaging 是跨系统交付问题，但不能继续停留在开发态假设里

## 候选方案

### 方案 A: 继续使用 wrapper + 源码相对路径假设
- **描述**: 保持当前 plugin wrapper，只在开发态假设宿主能访问源码仓 `src/`。
- **优点**:
  - 开发时最省事
  - 本地源码调试路径短
- **缺点**:
  - 发布后立即失效
  - command/tool/service 全部 fallback
  - 与 npm / ClawHub 分发目标直接冲突

### 方案 B: 构建自足 runtime artifact package
- **描述**: 发布包中包含 command router、read models、action bridge、runtime service 所需的最小构建产物，安装后不依赖源码仓。
- **优点**:
  - 符合发布插件的真实需求
  - command/tool/service 可以在宿主内直接运行
  - 允许 heartbeat runtime entry 一并进入发布产物
- **缺点**:
  - 需要引入明确的 build / package 过程
  - 需要梳理哪些 runtime 代码属于最小可发布边界

### 方案 C: 将整个源码仓打进插件包
- **描述**: 通过大包方式把 `src/`、测试与文档几乎全量带入插件发布包。
- **优点**:
  - 技术上简单粗暴，短期能跑
  - 能减少相对路径问题
- **缺点**:
  - 包体膨胀
  - 发布边界模糊
  - 将开发源码、测试与插件运行时混在一起

## 决策
选择 **方案 B: 构建自足 runtime artifact package**。

正式确定以下原则：

### 1. 发布包必须是自足运行包
- 安装后的 plugin 不能再依赖源码仓 `src/` 相对路径
- command/tool/service 所需运行时代码必须进入发布产物

### 2. runtime artifact 只包含最小运行时
- 不要求把整个源码仓都打包
- 但至少包含：
  - command router
  - read models
  - action bridge
  - state / observability runtime dependencies
  - heartbeat service entry

### 3. fallback 只保留为异常路径
- fallback 仍可保留用于极端场景
- 但正式 npm / ClawHub 发布包不得默认运行在 fallback 模式

### 4. packaging 需要先通过宿主可行性验证
- 在最终收口前，必须先验证 jiti 加载、原生模块、`npm install --ignore-scripts` 与 artifact 闭合边界是否可行
- 若 `better-sqlite3` 等原生依赖无法稳定工作，允许通过新 ADR 或实现任务切换到更适合发布的存储驱动或预编译策略

## 后果

### 正面
- Second Nature 插件首次真正具备“安装后可运行”的发布质量
- heartbeat runtime entry 可以自然并入同一发布产物
- command/tool/service 与云端宿主行为更加一致

### 负面
- 需要明确构建工艺和 artifact 边界
- 需要在后续任务中补 packaging 验证与发布检查
- 需要正视 `better-sqlite3` 等原生依赖在 OpenClaw 插件安装路径下的兼容性风险

### 需要的后续行动
- 在 `cli-system` 设计文档中补 runtime artifact package 结构
- 在 `cli-system` 设计文档中补 packaging feasibility 与原生依赖兼容性策略
- 在 blueprint 中新增 packaging 构建与验证任务
- 在发布前验证 npm / ClawHub 安装后的 command/tool/service 真正可用

## 参考资料
- `../01_PRD.md`
- `plugin/package.json`
- 云端安装实测记录（fallback 退化）

## 影响范围

本 ADR 被以下系统引用:
- `cli-system` - command/tool/service runtime artifact 边界
- `control-plane-system` - heartbeat entry 是否能进入发布产物
- `state-system` - 运行时依赖打包边界
- `observability-system` - explain / audit / status 读模型进入发布产物的边界
