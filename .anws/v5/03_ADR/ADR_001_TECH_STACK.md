# ADR-001: 主技术栈、宿主运行时与验证策略选择

## 状态

Accepted

## 日期

2026-05-01

## 背景

Second Nature v5 的目标不是替换 v4 已经跑通的 OpenClaw plugin runtime spine，而是把它从 host-safe heartbeat acknowledgment 推进到 lived-experience closure：heartbeat 能读取真实或 near-real life evidence，进入 decision loop，并在高价值时通过 OpenClaw 用户可见会话主动联系 owner。

关键约束：

- 产品继续定位为 **OpenClaw native plugin**，不是独立 assistant runtime，也不是单纯 skill
- v4 已验证 plugin command/tool/service surface 与发布包 runtime spine，v5 必须复用而不是重做
- 主动联系用户的关键不在新通信栈，而在 OpenClaw heartbeat delivery target 是否可用
- life evidence、Quiet、user interest snapshot 与 outreach judgment 需要本地可审计状态，不需要外部 memory SaaS
- 验证策略必须覆盖 `target: "none"`、`HEARTBEAT_OK` ack drop、delivery unavailable、source-backed outreach 等真实失败模式

## 决策驱动因素

- 因素 1: 必须贴合 OpenClaw heartbeat、plugin、hook、delivery 与 workspace memory 语义
- 因素 2: 创新预算应保留给 lived-experience protocol，而不是重建 runtime
- 因素 3: 主动联系必须可审计、可冷却、可降级，不能只靠 prompt 愿望
- 因素 4: 发布包仍需保持自足 runtime artifact，不回到源码路径假设
- 因素 5: 测试门禁需要围绕宿主能力、证据链和投递链，而不只是普通单元测试

## 候选方案

### 方案 A: TypeScript + Node.js + SQLite/sql.js + OpenClaw native plugin

- **描述**: 继续使用 TypeScript / Node.js 构建 plugin、service、CLI、本地编排、connector、life evidence、Quiet 和记忆治理逻辑；使用 SQLite/sql.js + Markdown/JSON artifacts 保存索引、审计和可回看的生活证据；通过 OpenClaw heartbeat delivery 完成主动联系闭环。
- **优点**:
  - 与 OpenClaw 主栈、workspace、plugin 与 delivery 语义最贴合
  - 复用 v4 已完成的 runtime packaging 与 command/tool/service surface
  - 适合实现 life evidence index、operator explain、connector abstraction 与 Quiet artifacts
  - 能把 v5 风险集中到宿主 capability 和行为契约验证，而不是新 runtime glue code
- **缺点**:
  - 复杂 memory/reflection 实验不如 Python 生态舒适
  - OpenClaw delivery / plugin runtime API 演进会影响主动联系闭环

### 方案 B: Python-first sidecar on top of OpenClaw

- **描述**: 以 Python sidecar 实现 life evidence、reflection、outreach judgment 与 Quiet，通过 IPC 或文件与 OpenClaw plugin 交互。
- **优点**:
  - 更适合实验性 memory / reflection pipeline 和数据处理
- **缺点**:
  - 容易把系统撕裂为两个 runtime 心智模型
  - 与 OpenClaw heartbeat delivery、plugin hooks、session/workspace 语义贴合度下降
  - 主动联系链路会多一层跨进程失败面

### 方案 C: 独立新 runtime + 自定义 delivery / memory system

- **描述**: 绕过 OpenClaw heartbeat 和 delivery，自建调度、消息投递、memory store 与平台连接。
- **优点**:
  - 理论上自主权最高
- **缺点**:
  - 直接违背当前产品定位
  - 重做 OpenClaw 已经提供的 heartbeat、session、workspace 和 channel delivery
  - 审计、权限、投递、安装和用户体验风险都不可接受

### 方案 D: TypeScript plugin + 外部托管 memory / notification service

- **描述**: 保留 OpenClaw plugin，但将 evidence/memory/outreach 投递交给外部服务。
- **优点**:
  - 未来多设备和云同步可能更容易
- **缺点**:
  - 引入隐私、凭据和运维成本
  - 对当前单用户本地 plugin 目标明显过重
  - 会削弱 workspace memory 作为真相源的清晰性

## 决策

选择 **方案 A: TypeScript + Node.js + SQLite/sql.js + OpenClaw native plugin**。

核心理由：

- 当前项目真正的本质复杂度是 lived-experience protocol：life evidence、rhythm windows、Quiet、user interest、outreach judgment 与 delivery audit。
- OpenClaw 已经提供 heartbeat、session、workspace、plugin hooks、message delivery 与分发路径；重做这些会制造双重复杂度。
- TypeScript / Node.js 与 OpenClaw plugin SDK、现有代码、connector 和 CLI surface 最贴合。
- SQLite/sql.js + Markdown/JSON artifacts 足以支撑单用户 life evidence index、Quiet report、delivery audit 与 explain 需求。
- 测试门禁应围绕宿主 capability 与跨系统契约设计：普通单元测试只能覆盖一部分，必须补集成和宿主冒烟验证。

## 候选方案对比


| 候选                                                            | 总体判断 | 优势                                                                | 劣势                           |
| ------------------------------------------------------------- | ---- | ----------------------------------------------------------------- | ---------------------------- |
| TypeScript + Node.js + SQLite/sql.js + OpenClaw native plugin | 最优   | 最贴合宿主 heartbeat / delivery / plugin 语义；复用 v4 runtime spine；本地审计清晰 | 受 OpenClaw delivery/API 能力约束 |
| Python-first sidecar                                          | 次优   | memory/reflection 实验舒适                                            | 跨语言复杂度高；宿主 delivery 贴合差      |
| 独立新 runtime + 自定义 delivery                                    | 不可取  | 自主权高                                                              | 违背定位；重造轮子；权限和投递风险极高          |
| 外部托管 memory / notification service                            | 暂不采用 | 多设备/云同步潜力                                                         | 隐私、运维、成本和真相源复杂度过高            |


## 验证策略决策

v5 采用分层验证，而不是只依赖单元测试：

1. **Unit**: 覆盖 `LifeEvidence` schema、rhythm window selection、outreach judgment、cooldown/dedupe、redaction、Quiet empty-evidence behavior。
2. **Integration**: 覆盖 heartbeat decision loop 从 snapshot -> intent -> evidence -> decision record 的端到端路径。
3. **Host smoke**: 覆盖 OpenClaw plugin install/load、`second_nature_ops("heartbeat_check")`、heartbeat delivery target、`HEARTBEAT_OK` ack drop、`target: "none"` 不外送、delivery unavailable fallback。
4. **Milestone INT**: 每个 v5 里程碑必须至少有一个可复现 smoke report，说明“用户可见主动联系”是否真实成立。

`target: "none"` 场景必须被视为主动联系未闭合，而不是成功静默。

## 后果

### 正面

- 与 OpenClaw 运行时和 workspace memory 语义强一致
- 实现层可以专注在 life evidence、Quiet、outreach judgment 和 delivery audit，而不是底层搭台
- connector、审计、文件整理和用户可见 delivery 更容易在一个主栈内保持清晰边界
- 可通过 ClawHub / npm / 本地路径按 OpenClaw plugin 方式分发与安装
- 测试策略直接覆盖 v5 最危险的宿主能力假设

### 负面

- Second Nature 将在一段时间内受制于 OpenClaw 的宿主语义和演进节奏
- 若当前 OpenClaw 版本没有可用 delivery override 或 `runHeartbeatOnce`，主动联系需要降级或等待上游能力
- 若后续 reflection / memory pipeline 极度复杂，可能需要新 ADR 讨论 sidecar 或 context engine

### 需要的后续行动

- 在 `02_ARCHITECTURE_OVERVIEW.md` 中统一描述为 OpenClaw native plugin
- 在 `control-plane-system` 设计文档中明确 heartbeat decision loop、delivery target 和 fallback
- 在 `state-system` 设计文档中明确 life evidence index、sourceRefs、user interest snapshot 与 Quiet artifacts
- 在 `cli-system` 设计文档中明确 host smoke / capability probe / runtime artifact packaging
- 在 `/blueprint` 中生成 P0 验证任务，优先证明 OpenClaw 用户可见主动联系路径
- 若未来需要复杂模型工作流，再以新 ADR 讨论是否引入插件式 context engine、sidecar 或外部 service

## 参考资料

- `../01_PRD.md`
- `../02_ARCHITECTURE_OVERVIEW.md`
- `../04_SYSTEM_DESIGN/_research/openclaw-lived-experience-closure-research.md`
- `https://docs.openclaw.ai/gateway/heartbeat`
- `https://docs.openclaw.ai/plugin`
- `https://docs.openclaw.ai/plugins/hooks`
- `https://docs.openclaw.ai/cli/plugins`
- `https://github.com/openclaw/openclaw/issues/40297`

## 影响范围

本 ADR 被以下系统引用:

- `cli-system` - plugin surface、runtime artifact、capability probe、host smoke
- `control-plane-system` - heartbeat decision loop、delivery target、outreach judgment
- `connector-system` - 平台适配器实现语言与 life evidence 输入
- `state-system` - SQLite/sql.js index、workspace artifacts、source-backed memory
- `observability-system` - 本地结构化日志、delivery audit、host capability 证据
- `behavioral-guidance-system` - TypeScript guidance assembly 与 outreach draft 边界

