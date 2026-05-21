# ADR-001: Continue TypeScript / Node / OpenClaw Plugin Runtime

## 状态
Accepted

## 日期
2026-05-21

## 背景
v7 要补的是 Embodied Agent Loop：IdentityProfile、EmbodiedContext、ToolAffordance、ToolExperience、Quiet/Dream 回流、HeartbeatDigest、history/restore 与 connector safety。v6 已有 TypeScript / Node / OpenClaw plugin、SQLite/sql.js、Markdown/JSON artifacts、connector manifests 与 audit/read-model 基础。当前风险不是运行时能力不足，而是身体语义没有闭环。

## 决策驱动因素
- v6 回归测试、plugin packaging、host bridge 和 connector registry 已在当前栈上工作。
- v7 的创新预算应投入 body semantics，而不是迁移运行时。
- OpenClaw 插件必须保持本地可安装、可解释、可手动验收。
- credential、workspace root、cron/env drift 需要继续贴近宿主环境。

## 候选方案

### 方案 A: 存量 TypeScript / Node / OpenClaw 内演进
- **优点**: 与 v6 连续；测试和打包成本低；便于增量加入 read models、state schema 和 ops commands。
- **缺点**: 需要严守模块边界，防止 heartbeat/control-plane 变成大泥球。

### 方案 B: 内部事件总线或 workflow engine
- **优点**: 统一 attempt、delivery、reply、dream 等事件形式。
- **缺点**: 当前问题不是缺事件机制，而是事件没有被整理成 agent 可读反馈；会增加偶然复杂度。

### 方案 C: 外部 daemon / service 化 body runtime
- **优点**: 长期产品化、跨宿主调度更强。
- **缺点**: 扩大部署、凭据、网络和恢复面；不适合当前 plugin-first 阶段。

## 决策
采用方案 A。v7 继续使用 TypeScript / Node / OpenClaw plugin runtime，状态仍以 SQLite/sql.js index 加 Markdown/JSON artifacts 为主。测试策略以 unit + integration + host E2E 分层：本地验证 body semantics，真实宿主验证 cron/env/channel/delivery。

## 后果

### 正面
- 直接复用 v6 成果和测试基线。
- 新能力可以按系统边界增量落地。
- host-specific 问题可通过 runtime-ops 和 self-health 继续可见。

### 负面
- 单体插件内模块边界必须靠设计和测试维护。
- 外部长期 daemon 的能力先不进入 v7。

### 需要的后续行动
- `/design-system` 必须把 `body-tool-system`、`runtime-ops-system` 和 `observability-health-system` 的边界写清。
- `/blueprint` 必须保留 v6 regression gate。

## 参考资料
- `.anws/v7/01_PRD.md`
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md`

## 影响范围
本 ADR 被以下系统引用:
- [runtime-ops-system](../04_SYSTEM_DESIGN/runtime-ops-system.md) - §8 Trade-offs
- [control-plane-system](../04_SYSTEM_DESIGN/control-plane-system.md) - §8 Trade-offs
- [state-memory-system](../04_SYSTEM_DESIGN/state-memory-system.md) - §8 Trade-offs
- [body-tool-system](../04_SYSTEM_DESIGN/body-tool-system.md) - §8 Trade-offs
- [connector-system](../04_SYSTEM_DESIGN/connector-system.md) - §8 Trade-offs
- [dream-quiet-system](../04_SYSTEM_DESIGN/dream-quiet-system.md) - §8 Trade-offs
- [guidance-voice-system](../04_SYSTEM_DESIGN/guidance-voice-system.md) - §8 Trade-offs
- [observability-health-system](../04_SYSTEM_DESIGN/observability-health-system.md) - §8 Trade-offs
