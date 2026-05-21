# ADR-002: Embodied Agent Loop Guides the Mind Without Scripted Control

## 状态
Accepted

## 日期
2026-05-21

## 背景
用户明确原则：Agent 像人一样，有开放头脑，但没有手脚；Second Nature 的 connector、Quiet、guidance、state、observability 是身体和环境。v7 需要让 heartbeat 带着 embodied context 醒来，但不能把模型替换成 deterministic planner。

## 决策驱动因素
- Mind 必须保留开放推理，不被 enum、goal 或变量强制脚本化。
- Body 必须提供可供性、经验、健康、身份、历史和回滚。
- Heartbeat 是醒来和节律入口，不是单向自动化任务队列。
- Guidance / Dream / Quiet 只能提供 proposal、claim 或 projection，不直接授权行动。

## 候选方案

### 方案 A: Deterministic Planner
- **优点**: 行为可预测、易写状态机。
- **缺点**: 把 agent 头脑降格为程序，违背 v7 核心原则。

### 方案 B: Prompt-only Habit
- **优点**: 改动小，语言自然。
- **缺点**: 无可靠状态、工具经验、健康反馈和回滚能力。

### 方案 C: Embodied Context + Guarded Affordance
- **优点**: 让 Mind 自由判断，同时提供 bounded context、工具可供性和安全护栏。
- **缺点**: 需要跨系统 read model 与 trace discipline。

## 决策
采用方案 C。每轮 heartbeat 构造 bounded `EmbodiedContext`，包含 IdentityProfile、accepted goals、recent interactions、accepted Dream projection、ToolExperience、SelfHealthSnapshot 与 life evidence。系统只提供上下文、可供性、护栏和反馈，不替 agent 做最终语义判断。

## 后果

### 正面
- 行为更像被引导的长期主体，而不是脚本机器人。
- recent conversation、Dream、Quiet 和 tool experience 能自然影响下一轮。

### 负面
- Context assembly 需要严格限流和 redaction。
- 需要把“引导”与“授权”在文档和实现中持续区分。

### 需要的后续行动
- 定义 `EmbodiedContextAssembler` 的输入上限、degraded reason 与 trace。
- 在 README/AGENTS 写清 Mind/Body 隐喻。

## 参考资料
- `.anws/v7/concept_model.json`
- `.anws/v7/01_PRD.md`

## 影响范围
本 ADR 被以下系统引用:
- [control-plane-system](../04_SYSTEM_DESIGN/control-plane-system.md) - §8 Trade-offs
- [state-memory-system](../04_SYSTEM_DESIGN/state-memory-system.md) - §8 Trade-offs
- [dream-quiet-system](../04_SYSTEM_DESIGN/dream-quiet-system.md) - §8 Trade-offs
- [guidance-voice-system](../04_SYSTEM_DESIGN/guidance-voice-system.md) - §8 Trade-offs
