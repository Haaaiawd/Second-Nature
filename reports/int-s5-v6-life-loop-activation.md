# INT-S5 — Life Loop Activation

**Milestone**: `.anws/v6/05A_TASKS.md` INT-S5  
**Date**: 2026-05-18  
**验证策略**: 集成测试 + 单测 + 静态代码审查；`:memory:` state；fake delivery；无 OpenClaw E2E。

## 状态

**✅ 里程碑 INT-S5 已勾选完成。**

Sprint S5 全部 6 个 P0/P1 任务已完成并通过集成验证：

- T1.4.1 Runtime Secret Bootstrap — ✅
- T3.3.1 Real connector evidence — ✅
- T2.4.1 Platform-specific intent — ✅
- T2.4.2 Source-backed outreach delivery — ✅
- T4.2.1 Owner reply → Relationship feedback — ✅
- T1.4.2 Activation UX contract — ✅

---

## Given / When / Then 与证据

### 1. Runtime Secret Bootstrap (T1.4.1)

| # | Given | When | Then | 证据 |
|---|-------|------|------|------|
| 1-A | 缺失 `SECOND_NATURE_ENCRYPTION_KEY` | 查询凭证状态 | 返回 `decrypt_failed` + `keyHealth: missing_key` + 可操作的 `nextStep` | `tests/integration/cli/t1-4-1-runtime-secret-bootstrap.test.ts` |
| 1-B | 用错误的密钥加密凭证 | 用不同密钥查询 | 返回 `decrypt_failed` + `keyHealth: wrong_key` + 恢复指引 | 同上 |
| 1-C | 有效密钥 + 已存储凭证 | 查询凭证 | 返回 `status: active` + `keyHealth: ok`，无密钥泄露 | 同上 |
| 1-D | 缺失密钥但有凭证记录 | 调用 `status` 命令 | 凭证列表包含 `keyHealth` 字段，显示 `missing_key` | 同上 |

### 2. Real Connector Evidence (T3.3.1)

| # | Given | When | Then | 证据 |
|---|-------|------|------|------|
| 2-A | 连接器成功 + 返回数据（2 个 post） | 解析允许的意图结果 | 写入生命证据工件 + DB 索引，包含 `platform_item` refs | `tests/integration/connectors/t3-3-1-real-connector-evidence.test.ts` |
| 2-B | 连接器成功但返回空数据 | 解析意图结果 | 返回 `intent_selected`，无证据写入（`snapshot.empty = true`） | 同上 |
| 2-C | 连接器终端失败 | 解析意图结果 | 返回 `intent_selected` + `connector_terminal_failure`，无证据写入 | 同上 |
| 2-D | 缺失 state/workspaceRoot | 解析意图结果 | 返回 `intent_selected` + `connector_effect_executed`，不崩溃 | 同上 |

### 3. Platform-Specific Intent (T2.4.1)

| # | Given | When | Then | 证据 |
|---|-------|------|------|------|
| 3-A | 目标描述包含平台名（如 `moltbook`） | 心跳规划意图 | 选中的意图 ID 包含平台标识 | `tests/integration/control-plane/t2-4-1-heartbeat-platform-intent.test.ts` |
| 3-B | 有平台注册表 + 连接器执行器 | 执行心跳效果 | `executeEffect` 接收 `platformId: moltbook` | 同上 |
| 3-C | 无连接器注册表 | 心跳完成 | 仍返回 `intent_selected`，`platformId` 未定义（向后兼容） | 同上 |
| 3-D | 模糊平台（无注册表） | 心跳规划 | 返回 `intent_selected`，无特定平台 | 同上 |
| 3-E | 设置 `platformId` 时目标优先级提升 | 执行连接器效果 | 返回 `intent_selected` + `reasons` 包含 `connector_effect_executed` | 同上 |

### 4. Source-Backed Outreach Delivery (T2.4.2)

| # | Given | When | Then | 证据 |
|---|-------|------|------|------|
| 4-A | 快照包含 3 个证据引用 | 规划候选意图 | 外联候选携带证据 `sourceRefs`（`ev-0`, `ev-1`, `ev-2`） | `tests/integration/control-plane/t2-4-2-source-backed-outreach-loop.test.ts` |
| 4-B | 证据支持的候选 + 叙述/关系记忆 | 调度外联意图 | 草稿包含叙述/关系/证据上下文，返回 `intent_selected` + `outreach_sent` | 同上 |
| 4-C | 投递不可用（`target: none`） | 调度外联 | 返回 `delivery_unavailable` + 写入 `fallbackRef`（包含 `fallback` 字符串） | 同上 |
| 4-D | 无证据（空快照 + 低置信度） | 调度外联 | 返回 `denied` + `reasons` 包含 `value_score_too_low` | 同上 |

### 5. Owner Reply → Relationship Feedback (T4.2.1)

| # | Given | When | Then | 证据 |
|---|-------|------|------|------|
| 5-A | 存在关系记忆 | 处理所有者回复 | 写入 `SessionChronicle` 条目（`kind: owner_reply`），`relationshipUpdated: true` | `tests/integration/state/t4-2-1-owner-reply-relationship-loop.test.ts` |
| 5-B | 正面回复（"Great work!"） | 处理回复 | `tonePreference: casual` + `noReplyCount: 0` + 添加 `owner_reply_feedback` sourceRef | 同上 |
| 5-C | 负面回复（"frustrated"） | 处理回复 | `tonePreference: quiet` + `noReplyCount: 0` | 同上 |
| 5-D | 忙碌回复（"deadline"） | 处理回复 | 提取话题（`work`），更新 topic affinity >= 0.6 | 同上 |
| 5-E | 无现有关系记忆 | 处理回复 | 创建默认关系（`tonePreference: casual` + `noReplyCount: 0` + `revision: 1`） | 同上 |
| 5-F | 更新后的记忆 | 查询 sourceRefs | 包含可追溯到 chronicle 条目的 ref（`kind: owner_reply_feedback`） | 同上 |
| 5-G | 混合回复（正面 + 负面） | 处理回复 | `tonePreference: quiet`（负面优先） | 同上 |

### 6. Activation UX Contract (T1.4.2)

| # | Given | When | Then | 证据 |
|---|-------|------|------|------|
| 6-A | 使用 `criteria` 别名设置目标 | 执行 `goal set` | `completionCriteria` 字段持久化相同文本 | `tests/integration/cli/t1-4-2-activation-ux-contract.test.ts` |
| 6-B | 存在关系记忆 | 执行 `explain relationship:default` | 返回编辑后的摘要，包含 tone、responsiveness、keyFactors、evidenceRefs | 同上 |
| 6-C | 无关系记忆 | 执行 `explain relationship:unknown-id` | 返回 `conclusion: nothing_yet` + `keyFactors` 包含 `no_relationship_memory_recorded` | 同上 |
| 6-D | 关系记忆样本稀少 | 执行 `explain relationship:sparse` | 返回 `conclusion` 包含 `cooldown` + `keyFactors` 包含 `insufficient_history` | 同上 |

---

## 静态审查闭环

Wave 39 完成了全量静态代码审查（6 个 Lens），产出 `.anws/v6/wave-reviews/wave-39-review.md`：

- **Critical**: 4 项 → 全部修复（CR-01..CR-04）
- **High**: 3 项 → 全部修复（H-01..H-03）
- **Medium**: 3 项 → 全部修复（M-02..M-04）
- **Low**: 3 项 → 全部修复（L-01..L-03）

关键修复：
- **CR-01**: `platform-capability-router.ts` 从注册表动态读取平台 ID，消除硬编码
- **CR-02**: `intent-planner.ts` 读取 `NarrativeState` / `RelationshipMemory` 影响意图优先级
- **CR-04**: Owner reply inference 函数可配置、防御空输入、PII redaction、失败可观测
- **M-03**: `AgentGoal` 类型隐性耦合 → 本地 `GoalRouterContext` / `GoalContext` / `GoalPriorityContext` 接口
- **M-04**: `intent-planner.ts` 提取 `INTENT_CONFIGS` + `planIntentWithKind` 工厂函数

---

## 命令汇总

```bash
pnpm exec tsc --noEmit
pnpm test
```

**结果**: 208 个测试全部通过，0 失败。

---

## 已知边界

1. **真实宿主冒烟**: 本验证使用 `:memory:` SQLite + fake delivery adapter。目标宿主（OpenClaw）的真实 E2E 仍标记为 `validation-needed`，需在实际宿主环境中复验 `second_nature_ops` 工具可见性与心跳投递行为。
2. **Wave 39 静态审查**: 所有 CR/High/Medium/Low 已修复，但后续 Sprint 仍需在 `/challenge` 中继续执行代码审查。
3. **版本统一**: `package.json`、`plugin/package.json`、`plugin/openclaw.plugin.json` 版本三元组已统一为 `0.1.25`。

---

## User Story 状态

| User Story | 任务链 | 状态 |
|------------|--------|------|
| US-001 Dream 异步记忆整理 | T4.1.1 → T4.1.5 → T7.1.1 → T7.1.2 → T7.1.3 → T7.1.4 → T7.1.5 → T5.1.1 → T1.2.2 → INT-S2 → T3.3.1 → INT-S5 | ✅ Activated |
| US-002 Agent 自我叙事与目标追求 | T4.1.2 → T4.1.4 → T1.2.4 → T2.1.4 → T2.1.5 → T5.1.2 → T7.1.4 → T1.2.1 → INT-S3 → T2.4.1 → INT-S5 | ✅ Activated |
| US-003 与 owner 的关系记忆 | T4.1.3 → T7.1.5 → T6.1.1 → T2.3.1 → INT-S3 → T4.2.1 → T1.4.2 → INT-S5 | ✅ Activated |
| US-004 Connector Ecosystem 动态扩展 | T3.1.1 → T3.1.2 → T3.2.1 → T5.1.3 → T1.3.1 → T1.2.3 → INT-S1 → T1.4.1 → T3.3.1 → INT-S5 | ✅ Activated |
| US-005 Outreach 有叙事来由 | T2.1.4 → T2.1.5 → T6.1.1 → T2.3.1 → INT-S3 → T2.4.2 → T4.2.1 → INT-S5 | ✅ Activated |
| US-006 可观测性消费 | T5.1.1 → T5.1.2 → T5.1.3 → T1.2.1 → T1.2.2 → T1.2.3 → T1.2.4 → T1.2.5 → T1.2.6 → INT-S4 → T1.4.1 → T1.4.2 → INT-S5 | ✅ Activated |
