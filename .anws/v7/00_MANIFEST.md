# .anws v7 - 版本清单

**创建日期**: 2026-05-21  
**状态**: Genesis-created / Design pending  
**前序版本**: v6

## 版本目标

v7 将 Second Nature 从 v6 的 Agent Self Layer + Dream + Connector Ecosystem，推进为 **Embodied Agent Loop**。

核心判断：Agent 的 LLM 是开放头脑，Second Nature 是身体和生活环境。系统提供跨平台身份、手脚可供性、工具经验、痛觉熔断、Quiet 日记、Dream 睡眠、心跳存在证明、历史浏览、有限回滚和身体健康感；但不把头脑脚本化。

## 主要变更

- [x] 新增 Mind / Body 架构隐喻，明确“引导而非变量约束”。
- [x] 新增 `IdentityProfile`：跨平台统一自我资料。
- [x] 新增 `ToolAffordanceMap` 与 `ToolExperienceLog`：工具从 API 变成身体手脚与触觉。
- [x] 新增 connector auto-probe、`connector_test --wet`、actualCapabilities 与 CircuitBreaker。
- [x] 新增 GoalLifecycle 与 IdleCuriosityPolicy。
- [x] 新增 Quiet DailyDiary、Quiet 后自动 Dream、accepted projection 回流。
- [x] 新增 HeartbeatDigest：仪表盘式存在证明，不等同 outreach。
- [x] 新增 NarrativeTimeline 与 RestoreSnapshot：历史浏览与有限回滚。
- [x] 新增 RuntimeSecretAnchor：encryption key 持久化路径与恢复原则，不记录明文 key。
- [x] 更新 README / AGENTS 入口叙事为 v7 embodied mental model。

## 文档清单

- [x] 00_MANIFEST.md (本文件)
- [x] 01_PRD.md
- [x] 02_ARCHITECTURE_OVERVIEW.md
- [x] 03_ADR/
- [x] 04_SYSTEM_DESIGN/README.md (详细设计待 `/design-system`)
- [ ] 05A_TASKS.md (执行主清单，由 `/blueprint` 生成)
- [ ] 05B_VERIFICATION_PLAN.md (验证计划，由 `/blueprint` 生成)
- [x] 06_CHANGELOG.md
- [ ] 07_CHALLENGE_REPORT.md (由 `/challenge` 生成)

## Gate

v7 当前不是 forge-ready。下一步应先逐个运行 `/design-system <system-id>`，再 `/challenge`，最后 `/blueprint` 生成任务与验证计划。
