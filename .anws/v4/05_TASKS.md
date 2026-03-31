# 任务清单 (Task List) - .anws v4

## 依赖图总览

```mermaid
graph TD
    T1_0_1[T1.0.1 Packaging feasibility POC] --> T1_1_1[T1.1.1 Package runtime build]
    T1_1_1 --> T1_1_2[T1.1.2 Package CLI deps]
    T1_1_2 --> T1_2_1[T1.2.1 Rewire plugin wrapper]
    T1_2_1 --> T1_2_2[T1.2.2 Package service surface]
    T1_2_2 --> INT_S1[INT-S1 Package Validation]

    T2_0_1[T2.0.1 Heartbeat host bridge POC] --> T2_1_1[T2.1.1 Heartbeat signal contract]
    T2_1_1 --> T2_1_2[T2.1.2 Scope signal router]
    T2_1_2 --> T2_2_1[T2.2.1 Heartbeat decision loop]
    T2_2_1 --> T2_2_2[T2.2.2 Guidance + effect bridge]
    T2_2_2 --> T5_1_1[T5.1.1 Decision observability]
    T5_1_1 --> INT_S2[INT-S2 Heartbeat Validation]

    T2_2_2 --> T3_1_1[T3.1.1 Moltbook minimal client]
    T2_1_2 --> T6_1_1[T6.1.1 Light continuity contract]
    INT_S1 --> INT_S3[INT-S3 Host Validation]
    INT_S2 --> INT_S3
    T3_1_1 --> INT_S3
    T6_1_1 --> INT_S3
```

## 📊 Sprint 路线图

| Sprint | 代号 | 核心任务 | 退出标准 | 预估 |
|--------|------|---------|---------|------|
| S1 | Runtime Package | packaging feasibility + plugin runtime artifact + command/tool/service 可运行 | 安装后的插件不再 fallback，核心命令可用，packaging 风险已验证 | 2-3d |
| S2 | Heartbeat Spine | heartbeat bridge POC + signal contract + decision record | heartbeat 桥接路径已确认，heartbeat 能完成一次静默或动作决策，并留下可解释记录 | 3-4d |
| S3 | Host Closure | 最小平台客户端 + 轻量 continuity + 宿主验证 | 云端宿主可安装、加载、查看 surface，heartbeat 主链与最小平台动作可验证 | 2-3d |

> **覆盖范围说明**: 本任务清单只覆盖 `.anws/v4/01_PRD.md` 中定义的 `REQ-014` ~ `REQ-018`。更广泛的平台扩展、更多 connector 能力和额外 UX 能力不在本次 v4 blueprint 范围内。

---

## System 1: Agent-facing Ops Surface System (`cli-system`)

### Phase 0: Packaging Feasibility

- [x] **T1.0.1** [REQ-017]: 验证 packaged runtime 与原生依赖可行性
  - **描述**: 在正式改造 packaging 之前，先验证 jiti 加载、`better-sqlite3` 等原生依赖、`npm install --ignore-scripts` 与 artifact 闭合边界是否成立。
  - **输入**: `.anws/v4/03_ADR/ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md`；`.anws/v4/04_SYSTEM_DESIGN/cli-system.md` §3.3, §8, §11.3
  - **输出**: packaging feasibility 记录、风险结论、可继续采用的构建策略
  - **📎 参考**: `ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md`；`cli-system.md` §8
  - **验收标准**:
    - Given 当前 packaging 依赖 jiti 与原生模块假设
    - When 完成可行性验证
    - Then 团队能输出一份明确结论：`可继续沿用`、`需调整实现` 或 `需更换依赖` 三者之一，且附带证据
    - Then 至少验证 1 条成功路径和 1 条阻塞或风险路径，不能只给主观判断
  - **验证类型**: 手动验证
  - **验证说明**: 通过最小打包 POC、安装测试和依赖解析验证，确认原生模块与安装流程是否兼容
  - **估时**: 4h
  - **依赖**: 无
  - **优先级**: P0

### Phase 1: Runtime Package Foundation

- [x] **T1.1.1** [REQ-017]: 建立 plugin runtime artifact 构建边界
  - **描述**: 为 `plugin/` 定义正式的 runtime artifact 构建入口，明确发布包如何包含包内 runtime，而不是继续依赖源码仓 `src/` 相对路径。
  - **输入**: `.anws/v4/01_PRD.md` §4 US-004 [REQ-017]；`.anws/v4/03_ADR/ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md`；`.anws/v4/04_SYSTEM_DESIGN/cli-system.md` §4.4
  - **输出**: plugin runtime artifact 构建入口、构建配置、artifact 目录约定
  - **📎 参考**: `ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md`；`cli-system.md` §4, §8
  - **验收标准**:
    - Given 当前发布包只有 wrapper 和 manifest
    - When 构建流程执行完成
    - Then 生成的发布产物中包含独立的 runtime artifact 边界，而不是仅保留 wrapper
    - Then 构建后的 runtime 入口不得再包含 `../src/` 形式的源码仓相对路径引用
  - **验证类型**: 编译检查
  - **验证说明**: 运行构建流程，确认产物目录中出现包内 runtime 入口与构建后的可发布文件
  - **估时**: 4h
  - **依赖**: T1.0.1
  - **优先级**: P0

- [x] **T1.1.2** [REQ-017]: 打包 command router 与 CLI runtime 依赖图
  - **描述**: 将 command router、read models、action bridge、state/observability runtime 依赖图纳入 artifact，保证命令执行路径在宿主里闭合。
  - **输入**: `.anws/v4/04_SYSTEM_DESIGN/cli-system.md` §4.2, §4.3, §5.1；`src/cli/index.ts`；T1.1.1 产出的 artifact 构建入口
  - **输出**: 被打包的 command router、CLI runtime deps、artifact 内引用关系
  - **📎 参考**: `cli-system.md` §4.2, §5.1；`ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md`
  - **验收标准**:
    - Given `status / policy / credential / quiet / report / session / explain` 依赖统一 runtime graph
    - When artifact 被生成
    - Then 这些命令所需依赖均存在于发布包内，不再引用源码仓 `src/`
    - Then 至少 `status`、`quiet`、`report`、`session`、`explain` 五个命令路径在 artifact 中可解析
  - **验证类型**: 编译检查
  - **验证说明**: 检查构建产物内容与模块引用路径，确认 CLI 运行图闭合
  - **估时**: 6h
  - **依赖**: T1.1.1
  - **优先级**: P0

### Phase 2: Plugin Surface Rewire

- [ ] **T1.2.1** [REQ-017]: 重写 plugin wrapper 到包内 runtime 解析路径
  - **描述**: 修改 `plugin/index.ts`，让 wrapper 只解析包内 runtime registration layer，不再尝试 `require("../src/...")`。
  - **输入**: `.anws/v4/04_SYSTEM_DESIGN/cli-system.md` §4.1, §4.3, §8；`plugin/index.ts`；T1.1.2 产出的 packaged runtime modules
  - **输出**: 重写后的 plugin wrapper、稳定的包内 runtime 解析路径
  - **📎 参考**: `cli-system.md` §4.1, §8；`ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md`
  - **验收标准**:
    - Given wrapper 作为原生 OpenClaw plugin entry 保留
    - When 插件在宿主中加载
    - Then wrapper 只会解析包内 runtime 模块，不再依赖源码仓外部路径
  - **验证类型**: 集成测试
  - **验证说明**: 在本地或临时宿主中加载插件，确认命令路径不再进入 packaging fallback mode
  - **估时**: 4h
  - **依赖**: T1.1.2
  - **优先级**: P0

- [ ] **T1.2.2** [REQ-017]: 将 service surface 纳入 packaged runtime
  - **描述**: 让 `second-nature-runtime` 与 `second-nature-lifecycle` 服务也由包内 runtime 产物驱动，为 heartbeat 主入口提供真正的 service 宿主入口。
  - **输入**: `.anws/v4/03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`.anws/v4/04_SYSTEM_DESIGN/cli-system.md` §5.1；T1.2.1 产出的 wrapper 解析路径
  - **输出**: packaged service runtime、service bootstrap 入口
  - **📎 参考**: `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`cli-system.md` §5.1
  - **验收标准**:
    - Given heartbeat 主入口最终要通过 service surface 暴露
    - When 插件完成注册
    - Then `second-nature-runtime` 与 lifecycle service 都来自 packaged runtime，而不是空壳 start()
    - Then 宿主 `plugins info second-nature` 能看到两项 service surface，且启动路径指向包内 runtime
  - **验证类型**: 集成测试
  - **验证说明**: 检查插件注册信息和服务启动行为，确认服务不再只是空 shell
  - **估时**: 6h
  - **依赖**: T1.2.1
  - **优先级**: P0

- [ ] **INT-S1** [MILESTONE]: S1 集成验证 — Runtime Package
  - **描述**: 验证 runtime artifact package 是否真正让插件安装后可运行，而不是继续退化为 fallback。
  - **输入**: T1.1.1、T1.1.2、T1.2.1、T1.2.2 的产出
  - **输出**: S1 集成验证报告（artifact 内容 + surface 可用性 + fallback 检查）
  - **验收标准**:
    - Given S1 所有任务已完成
    - When 安装或本地加载打包后的插件，并检查 command / tool / service surface
    - Then 核心命令不再默认进入 packaging fallback mode，S1 退出标准成立
  - **验证类型**: 集成测试
  - **验证说明**: 通过安装后的 `plugins info`、命令调用和工具调用结果确认 packaged runtime 生效
  - **估时**: 3h
  - **依赖**: T1.2.2
  - **优先级**: P0

---

## System 2: Second Nature Orchestration System (`control-plane-system`)

### Phase 0: Host Bridge Validation

- [ ] **T2.0.1** [REQ-014]: 确认 OpenClaw heartbeat 宿主桥接策略
  - **描述**: 在实现 heartbeat 主链前，先通过 POC 确认 OpenClaw heartbeat 如何被桥接进 Second Nature，可候选路径包括 `HEARTBEAT.md + tool use`、service-assisted bridge 或其他宿主可实现方案。
  - **输入**: `.anws/v4/03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`.anws/v4/04_SYSTEM_DESIGN/control-plane-system.md` §3.3, §4.1, §5.3, §11.3
  - **输出**: heartbeat host bridge 策略、POC 结论、选定桥接路径
  - **📎 参考**: `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`control-plane-system.md` §4.1, §5.3
  - **验收标准**:
    - Given OpenClaw heartbeat 是主会话 LLM 轮次，而非 plugin 直接事件
    - When 完成宿主桥接 POC
    - Then 团队能从候选路径中选定 1 条主桥接方案，并给出 1 条备选方案
    - Then 选定方案必须明确 signal 从哪来、带什么 metadata、由谁消费，不能停留在概念图层
  - **验证类型**: 手动验证
  - **验证说明**: 通过 OpenClaw 宿主实验与最小桥接方案验证，确认选定桥接路径可行
  - **估时**: 4h
  - **依赖**: T1.2.2
  - **优先级**: P0

### Phase 1: Runtime Boundary Foundation

- [ ] **T2.1.1** [REQ-014]: 建立 heartbeat signal contract 与 snapshot 构建合同
  - **描述**: 基于宿主桥接策略，为 control-plane 实现正式 `ingestRhythmSignal()` 合同与 `ContinuitySnapshot` 构建路径，让 heartbeat 语义进入自由心跳主链。
  - **输入**: `.anws/v4/01_PRD.md` §4 US-001 [REQ-014]；`.anws/v4/03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`.anws/v4/04_SYSTEM_DESIGN/control-plane-system.md` §4.1, §5.1, §6；T2.0.1 产出的 heartbeat host bridge 策略
  - **输出**: heartbeat signal contract、snapshot builder、heartbeat cycle result 合同
  - **📎 参考**: `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`control-plane-system.md` §4, §5, §6
  - **验收标准**:
    - Given 宿主桥接已将 heartbeat 轮次转换成可消费 signal
    - When 进入 control-plane runtime
    - Then 系统能构建一次完整的 `ContinuitySnapshot` 并产出 heartbeat cycle result
    - Then signal contract 至少包含 `trigger`、`scopeHint?`、`payload` 三类字段，且 snapshot builder 能消费这些字段
  - **验证类型**: 单元测试
  - **验证说明**: 运行心跳入口与 snapshot 相关测试，确认输入状态能稳定转成统一 snapshot 结构
  - **估时**: 6h
  - **依赖**: T2.0.1
  - **优先级**: P0

- [ ] **T2.1.2** [REQ-015]: 实现显式 scope signal router
  - **描述**: 基于桥接协议、入口类型或显式 metadata，在 control-plane 内实现 `Rhythm Scope`、`User Task Scope` 与 `User Reply Scope` 的 signal routing，而不是假设宿主天然分类。
  - **输入**: `.anws/v4/01_PRD.md` §4 US-002 [REQ-015]；`.anws/v4/03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`.anws/v4/04_SYSTEM_DESIGN/control-plane-system.md` §4.4, §5.1；T2.0.1 产出的 bridge metadata 约定
  - **输出**: scope signal router、trigger metadata 分类逻辑
  - **📎 参考**: `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`control-plane-system.md` §4.4, §5.1
  - **验收标准**:
    - Given heartbeat bridge signal、用户明确任务入口、用户直聊入口三种显式信号
    - When scope router 处理这些输入
    - Then 用户明确任务直接路由到任务链，heartbeat 留在 rhythm scope，用户直聊回复进入 user reply scope
    - Then 路由结果中必须显式输出 `rhythm / user_task / user_reply` 之一，不能依赖隐式推断
  - **验证类型**: 单元测试
  - **验证说明**: 通过不同触发源的测试用例确认 scope 归属和路由结果正确
  - **估时**: 4h
  - **依赖**: T2.1.1
  - **优先级**: P0

### Phase 2: Heartbeat Decision Spine

- [ ] **T2.2.1** [REQ-018]: 实现 heartbeat 轮的默认保守决策路径
  - **描述**: 将 candidate intent planning、guard evaluation 和 `HEARTBEAT_OK` 静默结果接成正式 decision loop，让 heartbeat 默认先判断再动作。
  - **输入**: `.anws/v4/01_PRD.md` §4 US-005 [REQ-018]；`.anws/v4/04_SYSTEM_DESIGN/control-plane-system.md` §4.2, §4.3, §5.1；T2.1.1 产出的 heartbeat signal contract；T2.1.2 产出的 scope signal router
  - **输出**: heartbeat decision loop、静默结果路径、candidate intent planning 逻辑
  - **📎 参考**: `control-plane-system.md` §4.2, §4.3, §8；`ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`
  - **验收标准**:
    - Given 一轮 heartbeat 进入 `Rhythm Scope`
    - When 当前没有足够理由执行动作
    - Then 系统返回 `HEARTBEAT_OK` 或等价静默结果，并且不会误触发外部动作
    - Then 在 `no obligation / no viable intent / guard deny` 三类代表性测试场景中，都能稳定落到静默或拒绝结果
  - **验证类型**: 单元测试
  - **验证说明**: 运行 heartbeat decision loop 测试，确认静默路径和 allow 路径都能稳定产出正确结果
  - **估时**: 6h
  - **依赖**: T2.1.2
  - **优先级**: P1

- [ ] **T2.2.2** [REQ-014]: 接通 guidance bridge 与 allow-only effect dispatch
  - **描述**: 仅在 scene 被选中时请求 guidance payload，并将 allow 的 heartbeat 结果接到 connector / Quiet / reflection / outreach judgment 路径。
  - **输入**: `.anws/v4/04_SYSTEM_DESIGN/control-plane-system.md` §4.3, §5.1；`.anws/v4/03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；T2.2.1 产出的 heartbeat decision loop
  - **输出**: heartbeat scene guidance 接口、allow-only effect dispatch 路径
  - **📎 参考**: `control-plane-system.md` §4.3, §5.1；`ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`
  - **验收标准**:
    - Given heartbeat 轮选中了需要生成的 scene
    - When 进入执行路径
    - Then guidance 只在该 scene 下被请求，且外部 effect 仅发生在 allow verdict 下
    - Then guidance payload 不直接传给 connector executor，而是只参与生成型路径的上下文组装
  - **验证类型**: 集成测试
  - **验证说明**: 检查 heartbeat 到 guidance request，再到 connector / Quiet / reflection 路径的联通性与 guard 约束
  - **估时**: 6h
  - **依赖**: T2.2.1
  - **优先级**: P0

---

## System 5: Observability & Safety System (`observability-system`)

### Phase 1: Decision Trace Closure

- [ ] **T5.1.1** [REQ-018]: 记录 heartbeat 决策与 scope 标签
  - **描述**: 为 observability 增加 heartbeat decision record、scope tag 和静默结果记录，使 `HEARTBEAT_OK`、deny、allow 都能被解释与追踪。
  - **输入**: `.anws/v4/04_SYSTEM_DESIGN/control-plane-system.md` §5.1, §9, §11；`.anws/v4/02_ARCHITECTURE_OVERVIEW.md` §System 5；T2.2.2 产出的 heartbeat decision loop
  - **输出**: heartbeat decision ledger、scope-tagged observability events、查询支持
  - **📎 参考**: `control-plane-system.md` §9, §11；`ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`
  - **验收标准**:
    - Given heartbeat 轮走过 silent、allow、deny 中任一结果
    - When 结果被记录
    - Then 记录中能区分 runtime scope、trigger source、decision status 与 reasons
    - Then 每条记录至少包含 `timestamp`、`runtimeScope`、`triggerSource`、`decisionStatus`、`reasons` 五类字段
  - **验证类型**: 集成测试
  - **验证说明**: 通过查询日志或审计读模型确认 heartbeat 决策链被完整记录
  - **估时**: 4h
  - **依赖**: T2.2.2
  - **优先级**: P1

- [ ] **INT-S2** [MILESTONE]: S2 集成验证 — Heartbeat Spine
  - **描述**: 验证 heartbeat 主入口、scope routing、默认静默策略与 decision record 是否形成完整主链。
  - **输入**: T2.1.1、T2.1.2、T2.2.1、T2.2.2、T5.1.1 的产出
  - **输出**: S2 集成验证报告（heartbeat 主链通过/失败 + Bug 清单）
  - **验收标准**:
    - Given S2 所有任务已完成
    - When 执行 heartbeat -> snapshot -> scope -> decision -> observability 的完整链路检查
    - Then 系统能够产生 `HEARTBEAT_OK` 或 allow 结果，并留下可解释 decision record
  - **验证类型**: 集成测试
  - **验证说明**: 按退出标准执行整链验证，确认 heartbeat 主链在宿主内可观测、可解释、可收敛
  - **估时**: 3h
  - **依赖**: T5.1.1
  - **优先级**: P0

---

## System 6: Behavioral Guidance System (`behavioral-guidance-system`)

### Phase 1: Light Continuity Closure

- [ ] **T6.1.1** [REQ-016]: 实现用户直聊的 very light continuity 合同
  - **描述**: 为 `User Reply Scope` 增加 very light continuity contract，让用户直聊回复保持轻量人格连续性，但不进入平台 `reply` scene。
  - **输入**: `.anws/v4/01_PRD.md` §4 US-003 [REQ-016]；`.anws/v4/03_ADR/ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`.anws/v4/04_SYSTEM_DESIGN/control-plane-system.md` §5.1；`.anws/v4/04_SYSTEM_DESIGN/behavioral-guidance-system.md` §5.4
  - **输出**: user reply light continuity contract、轻量 persona continuity block 或最小 guidance path
  - **📎 参考**: `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`behavioral-guidance-system.md` §5.4
  - **验收标准**:
    - Given 触发源是 direct user reply
    - When 系统生成用户回复上下文
    - Then 只应用 very light continuity guidance，不直接进入现有 `reply` scene impulse
  - **验证类型**: 集成测试
  - **验证说明**: 检查 direct user reply 路径的 guidance 结果，确认其轻量且与平台 reply scene 分离
  - **估时**: 4h
  - **依赖**: T2.1.2
  - **优先级**: P1

---

## System 3: Platform Connector System (`connector-system`)

### Phase 0: Integration Feasibility

- [ ] **T3.0.1** [REQ-014]: 确认 Moltbook 最小真实对接路径与文档依据
  - **描述**: 在实现 Moltbook 最小客户端前，先确认真实 API、CLI 或 skill/browser fallback 的可用路径，并记录文档或实测依据。
  - **输入**: `.anws/v4/02_ARCHITECTURE_OVERVIEW.md` §System 3；`.anws/v4/04_SYSTEM_DESIGN/connector-system.md` §4.2, §5；`.anws/v4/04_SYSTEM_DESIGN/control-plane-system.md` §4.3
  - **输出**: Moltbook 对接依据、最小可行 capability 路径、认证与能力边界说明
  - **📎 参考**: `connector-system.md` §4.2, §5
  - **验收标准**:
    - Given 目前 Moltbook 客户端尚未落地
    - When 完成对接前调研与验证
    - Then 团队能明确说明是走真实 API、CLI fallback 还是其他可验证路径，并给出依据
  - **验证类型**: 手动验证
  - **验证说明**: 通过文档查验、实测或现有 skill/CLI 入口确认最小对接路径存在且可行
  - **估时**: 3h
  - **依赖**: T2.2.2
  - **优先级**: P0

### Phase 1: Minimal External Closure

- [ ] **T3.1.1** [REQ-014]: 实现一个最小真实平台客户端闭环（Moltbook）
  - **描述**: 选择 Moltbook 作为第一优先平台，补一个最小真实客户端闭环，使 heartbeat allow path 至少有一个可以落到真实平台能力的出口。
  - **输入**: `.anws/v4/02_ARCHITECTURE_OVERVIEW.md` §System 3；`.anws/v4/04_SYSTEM_DESIGN/control-plane-system.md` §4.3；`.anws/v4/04_SYSTEM_DESIGN/connector-system.md` §4.2, §5；T2.2.2 产出的 allow-only effect dispatch 路径
  - **输出**: Moltbook 最小客户端实现、至少一个真实 capability 执行路径、错误归一化与验证记录
  - **📎 参考**: `connector-system.md` §4.2, §5；`control-plane-system.md` §4.3
  - **验收标准**:
    - Given heartbeat allow path 或手动触发路径已能进入 connector 执行
    - When 调用 Moltbook 最小 capability
    - Then 系统能够完成至少一个真实平台交互，而不是停在空接口
    - Then 所选 capability 必须明确指向一个可验证的真实出口，例如 `feed.read` 或 `post.publish`，不能只停留在 mock 返回
  - **验证类型**: 集成测试
  - **验证说明**: 使用真实或可验证的 Moltbook 接口完成一次 capability 调用，确认结果可被写回并记录
  - **估时**: 8h
  - **依赖**: T3.0.1
  - **优先级**: P0

---

## System Cross-Cut: Host Validation

### Phase 1: End-to-End Host Closure

- [ ] **INT-S3** [MILESTONE]: S3 集成验证 — Host Closure
  - **描述**: 在真实或近真实 OpenClaw 宿主里验证 v4 的 packaged runtime、heartbeat 主链、最小平台出口和 light continuity 边界是否共同成立。
  - **输入**: INT-S1、INT-S2、T3.1.1、T6.1.1 的产出
  - **输出**: 云端/宿主验证报告（安装、加载、surface、heartbeat、最小平台动作、边界验证）
  - **验收标准**:
    - Given Runtime Package 和 Heartbeat Spine 均已通过前置集成验证
    - When 在宿主环境安装并启用插件，检查 command/tool/service 与 heartbeat 入口
    - Then 插件可加载，核心命令可用，heartbeat 主链可验证，最小平台动作可执行，用户任务边界不被破坏
  - **验证类型**: 手动验证
  - **验证说明**: 在目标宿主中安装插件，重启 gateway，检查插件信息、命令执行、heartbeat 结果与边界行为
  - **估时**: 4h
  - **依赖**: INT-S1, INT-S2, T3.1.1, T6.1.1
  - **优先级**: P0

---

## 🎯 User Story Overlay

### US-001: 将 heartbeat 作为 Second Nature 的自由心跳主入口 [REQ-014] (P0)
**涉及任务**: T2.0.1 → T2.1.1 → T2.2.1 → T2.2.2 → T5.1.1 → INT-S2  
**关键路径**: T2.0.1 → T2.1.1 → T2.2.1 → T2.2.2 → T5.1.1 → INT-S2  
**独立可测**: ✅ S2 结束即可演示  
**覆盖状态**: ✅ 完整

### US-002: 明确用户任务链不受节律裁决 [REQ-015] (P0)
**涉及任务**: T2.0.1 → T2.1.2 → T2.2.1 → INT-S2 → INT-S3  
**关键路径**: T2.0.1 → T2.1.2 → T2.2.1 → INT-S2  
**独立可测**: ✅ S2 结束即可验证主边界，S3 完成宿主复核  
**覆盖状态**: ✅ 完整

### US-003: 用户直聊回复只保留 very light continuity guidance [REQ-016] (P1)
**涉及任务**: T6.1.1 → INT-S3  
**关键路径**: T6.1.1 → INT-S3  
**独立可测**: ✅ S3 结束可验证  
**覆盖状态**: ✅ 完整

### US-004: 发布包必须成为可独立运行的 plugin runtime [REQ-017] (P0)
**涉及任务**: T1.0.1 → T1.1.1 → T1.1.2 → T1.2.1 → T1.2.2 → INT-S1 → INT-S3  
**关键路径**: T1.0.1 → T1.1.1 → T1.1.2 → T1.2.1 → T1.2.2 → INT-S1  
**独立可测**: ✅ S1 结束即可验证，S3 宿主复核  
**覆盖状态**: ✅ 完整

### US-005: heartbeat 轮的默认行为保持克制 [REQ-018] (P1)
**涉及任务**: T2.2.1 → T5.1.1 → INT-S2  
**关键路径**: T2.2.1 → T5.1.1 → INT-S2  
**独立可测**: ✅ S2 结束即可验证  
**覆盖状态**: ✅ 完整

### 覆盖声明说明
本 Overlay 只声明 v4 PRD 中 `REQ-014` ~ `REQ-018` 的任务覆盖状态，不延伸宣称更早版本或更广范围 connector 需求已经全部实现。
