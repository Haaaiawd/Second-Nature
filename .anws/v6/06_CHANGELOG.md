# 变更日志 - .anws v6

> 此文件记录本版本迭代过程中的微调变更（由 /change 处理）。改变需求/架构/ADR 核心前提的新功能需创建新版本（由 /genesis 处理）；不改前提、可追溯用户原话或 forge 回流的少量承接任务可由 /change 受控追加。

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

## 2026-05-18 - Round 7 Life Loop Activation 回流
- [CHANGE] 在 `05A_TASKS.md` 新增 S5 `Life Loop Activation`：T1.4.1 runtime secret bootstrap、T3.3.1 real connector evidence、T2.4.1 platform-specific intent、T2.4.2 source-backed outreach delivery、T4.2.1 owner reply relationship feedback、T1.4.2 activation UX cleanup、INT-S5 关门验证。
- [CHANGE] 同步 `05B_VERIFICATION_PLAN.md` 的风险类别、Task-by-Task、Contract Coverage、Testing Coverage 与 Verification Traceability Matrix，为 runtime secret、真实 connector evidence、heartbeat platform intent、outreach/fallback、relationship feedback 与 UX alias/explain 增加验证锚点。
- [CHANGE] 更新 v6 任务统计：总任务数 38，Level-3 任务 33，INT 任务 5，P0 27，P1 11，P2 0。

## 2026-05-19 - Claw Inner Guide Setup 回流
- [ADD] 新增 `docs/claw-second-nature-inner-guide.md` 与 `docs/validation/claw-second-nature-inner-guide-checklist.md`，把 Second Nature 的软连接写成可被 Claw 自然吸收的便条与验收清单。
- [ADD] 插件包新增 `SKILL.md` 与 `agent-inner-guide.md`，并在 npm pack 校验中纳入 packaged guide 文件，避免源码仓库外安装后读不到内化入口。
- [CHANGE] 插件 `second_nature_ops` 新增 `setup_hint` / `setup_ack` 一次性 setup surface：安装后返回 skill + guide，guide 安放后写入 `.second-nature/setup/agent-inner-guide-ack.json` 取消后续提醒。
- [CHANGE] README / README.zh-CN / HEARTBEAT / 根 `SKILL.md` 同步说明当前没有 `workspace_init`，初始化真相是 `connector_init` + one-shot setup hint + 手动安放长期 anchor。

## 2026-05-19 - MoltBook Connector Auth Failure 修复
- [FIX] 修复 `CredentialVault.loadCredentialContext()` 只读取 camelCase 字段导致 sql.js/drizzle 返回 snake_case 行时丢失 `platformId` / `credentialType` / `encryptedValue` 的问题；该问题会让 active credential 在 connector executor 中表现为 `auth_failure`。
- [ADD] 新增 connector executor 回归测试：写入 `moltbook` active credential 后必须能解密 token，并实际命中 MoltBook API mock。
- [CHANGE] 同步插件 `runtime/storage/services/credential-vault.js`，保证 OpenClaw 安装包路径带上同一修复。

## 2026-05-20 - Agent World Profile Endpoint 修复
- [FIX] 修复 `agent-world` connector 仍调用不存在的 `/api/v1/feed`、`/api/v1/work`、`/api/v1/tasks/*/claim` 硬编码端点的问题。
- [CHANGE] `feed.read` 改为 `GET /api/agents/profile/{username}`，默认 username 为 `nyx_ha`；`work.discover` 同样走 profile endpoint，并允许 payload 指定 `targetUsername` / `username` / `agentUsername`。
- [CHANGE] 新增 `SECOND_NATURE_AGENT_WORLD_USERNAME`、`SECOND_NATURE_AGENT_WORLD_PROFILE_PATH_TEMPLATE` 与 payload `profilePathTemplate` / `claimEndpointPath` 覆盖口，避免 Claw 被写死在单一 endpoint 上。
- [ADD] 新增 Agent World connector executor 回归测试，覆盖 vault credential 注入、默认 profile endpoint、目标 username 覆盖与 path template 覆盖。
