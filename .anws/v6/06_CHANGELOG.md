# 变更日志 - .anws v6

> 此文件记录本版本迭代过程中的微调变更（由 /change 处理）。新增功能/任务需创建新版本（由 /genesis 处理）。

## 格式说明
- **[CHANGE]** 微调已有任务（由 /change 处理）
- **[FIX]** 修复问题
- **[REMOVE]** 移除内容

---

## 2026-05-15 - 初始化
- [ADD] 创建 `.anws` v6 版本
- [ADD] 从 v5 lived-experience closure 演进到 Agent Self Layer + Connector Ecosystem + Dream（原 Quiet）叙事记忆

## 2026-05-15 - Challenge Gate 回流
- [CHANGE] 将 v6 状态从 Active 调整为 Draft / Challenge Gate，明确当前不是 forge-ready。
- [CHANGE] 修正 Dream 性能边界：完整 LLM Dream 为 async job，不再承诺 5 分钟硬 P95；新增 30 分钟 operator timeout 与 partial output 语义。
- [CHANGE] Connector Ecosystem 默认安全策略改为 declarative manifest + 内置 runner；custom adapter / skill / browser runner 需 owner allowlist、签名或显式确认。
- [CHANGE] Agent Goal 自主提案默认不授权，必须经 owner 或 policy gate 才能影响 intent priority。
- [ADD] 新增 `.anws/v6/07_CHALLENGE_REPORT.md` 与 `04_SYSTEM_DESIGN/README.md`，并在任务清单加入 S0 Design Gate。

## 2026-05-16 - S0 Design Gate 闭合
- [ADD] 补齐 `control-plane-system.md`、`behavioral-guidance-system.md`、`cli-system.md` 与对应 `_research`。
- [CHANGE] 将 DR3-01 回流到任务层：新增 T5.1.2 `NarrativeTrace` 与 T5.1.3 `ConnectorInventoryAudit`。
- [CHANGE] `07_CHALLENGE_REPORT.md` 新增 Round 4 设计审查，未发现新的 Critical / High。

## 2026-05-16 - Round 5 验证真源回流
- [ADD] 新增 canonical `.anws/v6/05A_TASKS.md` 执行主清单，每个任务包含验证引用与证据产出。
- [ADD] 新增 `.anws/v6/05B_VERIFICATION_PLAN.md` 验证计划，包含 Task-by-Task、Contract Coverage、Testing Coverage 与 Verification Traceability Matrix。
- [CHANGE] 统一 v6 manifest、architecture gate、system design README 与根 `AGENTS.md` 的 latest / blueprint-ready 锚点。
- [CHANGE] 补强 T1.3.1 `connector init` 验收：pending trust、no-overwrite、workspace connector root path safety。

## 2026-05-16 - Round 6 Ops Surface 回流
- [CHANGE] 回流 DR6-01 / TR6-01：在 `05A_TASKS.md` 新增 T1.2.4 `goal` command、T1.2.5 `cycle:recent` read model、T1.2.6 v6 `status` aggregate，补齐 `cli-system` ops surface producer tasks。
- [CHANGE] 同步 `05B_VERIFICATION_PLAN.md` 的 Task-by-Task、Contract Coverage、Testing Coverage 与 Verification Traceability Matrix，为 `goal` / `cycle:recent` / `status` 增加 API、集成与 INT-S4 验证锚点。
- [CHANGE] 更新 v6 任务统计：总任务数 31，Level-3 任务 27，INT 任务 4，P0 21，P1 10，P2 0。
