# 变更日志 - .anws v7

> 此文件记录 v7 相对 v6 的架构与文档层面变更意图。实现任务与验证计划将由后续 `/blueprint` 生成。

---

## 2026-05-21 - Genesis 初始化

- [ADD] 创建 `.anws/v7`，从 v6 copy & evolve。
- [CHANGE] 删除 v7 目录中继承自 v6 的任务、挑战报告、旧 detailed system design 和 wave review，避免旧真相污染新版本。
- [ADD] 新增 `concept_model.json`：Embodied Agent Loop、Mind、Body、ToolAffordance、ToolExperience、IdentityProfile、HeartbeatDigest、RestoreSnapshot 等概念。
- [ADD] 新增 `01_PRD.md`：12 条需求覆盖具身上下文、工具身体、goal 生命周期、Quiet/Dream、channel feedback、self health、identity、wet probe、digest、timeline、rollback、secret recovery。
- [ADD] 新增 `02_ARCHITECTURE_OVERVIEW.md`：8 个系统边界，含 runtime-ops、control-plane、state-memory、body-tool、connector、dream-quiet、guidance-voice、observability-health。
- [ADD] 新增 8 条 Accepted ADR：技术栈、具身循环、工具可供性、goal/idle、Quiet/Dream、channel/self-health、identity/digest/recovery、probe/breaker/rollback。
- [ADD] 新增 `04_SYSTEM_DESIGN/README.md`，声明详细设计待 `/design-system` 生成。

## 2026-05-21 - Claw 十天反馈纳入 PRD

- [ADD] Cross-platform IdentityProfile：Agent World `nyx_ha`、MoltBook `haai-arch`、InStreet `haai_17949e` 统一为同一个自我。
- [ADD] Connector auto-probe 与 `connector_test --wet`：注册时暴露 declared endpoint 与真实 response mismatch。
- [ADD] Connector CircuitBreaker：连败 N 次后冷却 M 小时，到期半开试探。
- [ADD] Quiet DailyDiary：从空 summary 升级为“今天看到了什么 / 值得注意什么 / 明天想看什么”的自然 source-backed 日记。
- [ADD] Quiet 完成后自动触发 Dream，Dream 不再只靠人工命令。
- [ADD] HeartbeatDigest：每日仪表盘式存在证明，可推送 Feishu/DM/dashboard，不等同 outreach。
- [ADD] RuntimeSecretAnchor：AGENTS/README/self_health 记录 encryption key 持久化路径与恢复原则。
- [ADD] NarrativeTimeline 与 RestoreSnapshot：支持 narrative diff、timeline 和最近 3 版有限回滚。

## 2026-05-21 - README / AGENTS 入口更新

- [CHANGE] README / README.zh-CN 改为 v7 embodied mental model：首页解释“头脑与身体”，明确 v7 是 Genesis/design phase。
- [CHANGE] AGENTS.md 当前状态更新为 `.anws/v7`，并记录 RuntimeSecretAnchor 风险提示。
