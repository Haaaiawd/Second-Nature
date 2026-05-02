# ADR-005: Heartbeat 作为 Second Nature 的主运行入口与三层运行时边界

## 状态
Accepted

> 实现注记（2026-04-27）:
> 本 ADR 仍代表目标架构方向。
> 当前代码已经坐实的是同步 plugin 注册、包内 runtime artifact、最小 activation/runtime evidence，以及 runtime status truth split。
> 当前已选定的 shipping bridge contract 是 `HEARTBEAT.md + second_nature_ops("heartbeat_check")`；但这个 contract 还没有完整进入 shipping plugin surface。
> `src/core/second-nature/runtime/service-entry.ts` 仍只是最小 runtime handle / carrier，不应被表述为已收到 per-heartbeat callback。
> 因此不能把当前发布物表述成 ADR-005 已完整落地。
>
> v5 延伸注记（2026-05-01）:
> 本 ADR 继续确定 heartbeat 是 Second Nature 的自由心跳主入口；但 v5 的“朋友式主动联系”闭环不再由本 ADR 单独定义。
> `HEARTBEAT.md + second_nature_ops("heartbeat_check")` 只证明宿主可唤醒和插件可响应，不能证明用户可见 delivery。
> OpenClaw heartbeat delivery target、`target: "none"` 丢弃回复、`HEARTBEAT_OK` ack drop、`runHeartbeatOnce` / hook / injection 能力验证，统一由 `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md` 约束。

## 日期
2026-03-27

## 背景
Second Nature v3 已完成 behavioral guidance 的系统化设计与最小运行时接入，但仍缺一个真正连接 OpenClaw 宿主脉搏的正式入口。

与此同时，产品边界也需要被正式写清楚：
- 用户明确下达的任务，不应被节律系统拖慢或否决
- Agent 的第二天性，应主要体现在“它自己活着时的自由心跳”
- 用户直聊回复应保留轻量连续性，但不应直接复用平台 `reply` 场景

OpenClaw 文档进一步提供了关键约束：
- heartbeat 运行在主会话中，适合周期性感知与上下文判断
- cron 适合精确定时与隔离任务
- hooks 可承接消息事件，但不等于应默认接管所有用户消息

## 决策驱动因素
- 因素 1: 需要为 Second Nature 找到与产品目标最匹配的宿主主入口
- 因素 2: 必须保护用户明确任务链的直接性
- 因素 3: 需要把“第二天性”落实为自由脉搏，而不是所有入口的全局接管
- 因素 4: 必须与 OpenClaw heartbeat / cron / hooks 的现有语义对齐

## 候选方案

### 方案 A: 以 OpenClaw heartbeat 语义为主生命线，通过宿主桥接接入 Second Nature
- **描述**: 将 OpenClaw heartbeat 定义为 Second Nature 的自由心跳主生命线，但不假设 plugin API 原生提供 heartbeat 回调；通过宿主可实现的桥接方式，把 heartbeat 轮次引导到 Second Nature 的 `Rhythm Scope`，并明确 `User Task Scope` 与 `User Reply Scope` 三层边界。
- **优点**:
  - 与 OpenClaw heartbeat 的产品意图一致
  - 自然承接 obligation、exploration、Quiet、reflection 与主动外联判断
  - 保护用户明确任务链不受节律裁决
  - 保留后续为用户直聊增加轻量 continuity 的空间
- **缺点**:
  - 需要先确认 heartbeat 到 plugin runtime 的宿主桥接方式
  - 需要在实现上区分用户任务链与自由心跳链

### 方案 B: 以 cron 为主入口，heartbeat 只做辅助
- **描述**: 使用 cron 作为 Second Nature 的主要调度方式，heartbeat 仅作为保活或附加检查。
- **优点**:
  - 精确定时能力更强
  - 更接近传统调度器思维
- **缺点**:
  - 弱化主会话上下文
  - 与“Agent 自由脉搏”的产品目标不贴合
  - 容易把 Second Nature 退化为定时任务系统

### 方案 C: 用户消息、heartbeat、cron 全部接入同一节律 runtime
- **描述**: 把所有宿主入口都统一接入 Second Nature 的节律裁决。
- **优点**:
  - 表面统一
  - 看起来像单一总入口
- **缺点**:
  - 会误伤用户明确任务的执行链
  - 用户直聊与平台 reply、自由心跳容易混成一团
  - 节律系统会过度膨胀，侵入宿主所有入口

## 决策
选择 **方案 A: 以 OpenClaw heartbeat 语义为主生命线，通过宿主桥接接入 Second Nature**。

正式确定以下原则：

### 1. Heartbeat 是 Second Nature 的自由心跳主生命线
- `Rhythm Scope` 以 OpenClaw heartbeat 语义为主体生命线
- 当前不假设 plugin API 存在直接的 heartbeat callback
- heartbeat 轮需要通过宿主桥接方式进入 Second Nature 的节律链
- 当前选定的主桥接合同为 `HEARTBEAT.md + second_nature_ops("heartbeat_check")`
- service surface 只提供 packaged runtime carrier / lifecycle truth，不单独伪装成 per-heartbeat callback
- 默认无事时允许 `HEARTBEAT_OK` 或等价静默结果

### 2. 用户明确任务不受节律裁决
- `User Task Scope` 直接进入任务执行链
- 节律系统不对其做“现在该不该做”的窗口性否决
- 同一动作若由用户明确要求执行，则按任务链处理，而不是按自由心跳处理
- 运行时 scope 的区分不依赖宿主天然分类，而依赖桥接协议、入口类型或显式 signal metadata

### 3. 用户直聊回复只保留 very light continuity
- `User Reply Scope` 不进入节律裁决
- 不直接复用平台 `reply` scene
- 仅允许 very light persona continuity / tone consistency

### 4. cron 是辅助调度，不是主体生命线
- cron 仍适合精确定时、一次性提醒、隔离任务
- 但不承担 Second Nature 的主体生命线

## 后果

### 正面
- Second Nature 的“第二天性”第一次拥有清晰的宿主脉搏定义
- 用户任务链与自由心跳链被正式分开，产品边界更健康
- 用户关系中的 continuity 可作为轻量层独立演进，而不污染节律系统

### 负面
- 需要在控制层详细设计中明确 heartbeat 桥接策略，而不是直接假设 plugin 回调存在
- 需要在实现层小心区分 scope，避免误把用户任务纳入节律裁决

### 需要的后续行动
- 在 `control-plane-system` 设计文档中补 heartbeat host bridge 与 output policy
- 在 `cli-system` / plugin 设计中明确 heartbeat 对应的 shipping tool / command / prompt bridge 合同
- 在 blueprint 中新增 heartbeat bridge POC、shipping surface 收口与 user-scope signal contract 相关任务

## 参考资料
- `https://docs.openclaw.ai/zh-CN/automation/cron-vs-heartbeat`
- `https://docs.openclaw.ai/zh-CN/plugins`
- `../01_PRD.md`
- `ADR_003_SECOND_NATURE_GOVERNANCE.md`

## 影响范围

本 ADR 被以下系统引用:
- `control-plane-system` - heartbeat 主入口、自由心跳链与用户任务边界
- `cli-system` - service runtime 与宿主入口暴露方式
- `behavioral-guidance-system` - 用户直聊 continuity 的轻量边界
