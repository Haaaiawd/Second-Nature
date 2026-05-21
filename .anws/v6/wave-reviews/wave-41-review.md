# Wave 41 Code Review — 2026-05-18

**审查范围**: Second Nature v6 Sprint S5 (Life Loop Activation) 全量静态审查
**审查依据**: `.anws/v6/01_PRD.md`, `02_ARCHITECTURE_OVERVIEW.md`, `03_ADR/`, `04_SYSTEM_DESIGN/`, `05A_TASKS.md`, `05B_VERIFICATION_PLAN.md`
**执行方式**: 三子代理并行审查 Lens 1-6，编排侧验证关键发现并去重

---

## 1. 总结结论

**PARTIAL PASS** ⚠️

- Lens 1 契约忠实度：**PASS** ✅
- Lens 2 任务兑现：**PARTIAL PASS** ⚠️（验收标准闭合，但错误处理诊断不足）
- Lens 3 架构适配：**PARTIAL PASS** ⚠️（类型松弛与关键字匹配宽松）
- Lens 4 静态安全风险：**FAIL** ❌（Critical: credential 异常未捕获 + PII redaction 不完整）
- Lens 5 验证证据：**PARTIAL PASS** ⚠️（05B 要求的单元测试覆盖不足）
- Lens 6 回流一致性：**FAIL** ❌（Critical: 版本三元组不一致 + README 未更新）

---

## 2. 审查范围与静态边界

**已读**
- `src/core/second-nature/heartbeat/heartbeat-loop.ts`
- `src/core/second-nature/orchestrator/intent-planner.ts`, `platform-capability-router.ts`, `goal-priority.ts`, `narrative-update.ts`
- `src/core/second-nature/feedback/owner-reply-feedback.ts`
- `src/core/second-nature/heartbeat/snapshot-builder.ts`
- `src/core/second-nature/index.ts`
- `src/cli/commands/goal.ts`, `connector-init.ts`, `connector-status.ts`
- `src/cli/ops/ops-router.ts`, `workspace-heartbeat-runner.ts`
- `src/cli/explain/resolve-subject.ts`, `src/cli/read-models/index.ts`
- `src/cli/read-models/types.ts`
- `src/storage/services/credential-vault.ts`
- `src/connectors/base/map-life-evidence.ts`
- `src/observability/query/explain-query.ts`
- `tests/integration/cli/t1-4-1-*.ts`, `t1-4-2-*.ts`
- `tests/integration/control-plane/t2-4-1-*.ts`, `t2-4-2-*.ts`
- `tests/integration/connectors/t3-3-1-*.ts`
- `tests/integration/state/t4-2-1-*.ts`
- `tests/unit/feedback/t4-2-1-*.ts`, `tests/unit/connectors/t3-3-1-*.ts`
- `tests/unit/control-plane/t2-4-1-*.ts`
- `package.json`, `plugin/package.json`, `plugin/openclaw.plugin.json`
- `README.md`, `AGENTS.md`
- `.anws/v6/05A_TASKS.md` (S5 部分), `05B_VERIFICATION_PLAN.md` (S5 部分)

**未读**
- `04_SYSTEM_DESIGN/*.md` 全文（仅读取相关章节）
- `03_ADR/` 全文（仅读取 ADR-001/002 摘要）
- `src/` 中 S5 未触及的历史代码

**需人工验证**
- 真实 OpenClaw 宿主上 `second_nature_ops` 工具可见性
- 实际 `pnpm test` 输出总数（208 vs 214 声明矛盾）
- `decryptCredentialAtRest` 在 wrong_key 场景下的调用链崩溃是否已在生产调用方被 catch

---

## 3. 契约 → 代码映射摘要

| 契约 | 实现区域 | 状态 |
|------|---------|------|
| T1.4.1 RuntimeSecretBootstrap | `src/storage/services/credential-vault.ts:90-136` (probe), `src/cli/ops/workspace-heartbeat-runner.ts` (注入) | ✅ 诊断语义闭合 |
| T1.4.2 criteria alias | `src/cli/commands/goal.ts:101-105` | ✅ 别名映射闭合 |
| T2.4.1 platformId:capability | `src/core/second-nature/orchestrator/platform-capability-router.ts` | ✅ 路由契约闭合 |
| T2.4.2 source-backed outreach | `src/core/second-nature/heartbeat/heartbeat-loop.ts:156-178` + `src/core/second-nature/outreach/*.ts` | ✅ 全链路闭合 |
| T3.3.1 real connector evidence | `src/connectors/base/map-life-evidence.ts:60-91` + `heartbeat-loop.ts:164-177` | ✅ 映射与写入闭合 |
| T4.2.1 owner reply feedback | `src/core/second-nature/feedback/owner-reply-feedback.ts:136-224` | ✅ 反馈链路闭合 |

---

## 4. Lens 结果摘要

| Lens | 结论 | 关键证据 |
|------|------|---------|
| L1 契约忠实度 | **PASS** | 核心设计契约全部兑现；minor: criteria 优先级未在验收标准中明确 |
| L2 任务兑现 | **PARTIAL PASS** | 6 个任务验收标准全部闭合；但 evidence append / relationship update 失败无诊断信号 |
| L3 架构适配 | **PARTIAL PASS** | 工厂提取完成；但 `[key: string]: unknown` 索引签名引入类型松弛；focusMatchesKind 模糊匹配过于宽松 |
| L4 静态安全风险 | **FAIL** | credential 解密异常未捕获（`loadCredentialContext`）；PII redaction 遗漏电话/token/SSN；goal/platformId 输入校验不足 |
| L5 验证证据 | **PARTIAL PASS** | 集成测试覆盖完整；05B 要求的 6 个单元测试中至少 4 个缺失或不完整 |
| L6 回流一致性 | **FAIL** | `package.json` 0.1.24 与 plugin 0.1.25 不一致；README 未描述 v6 新增能力 |

---

## 5. Issues

### Critical

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|----------|------|-------|----------|--------|------------|--------|
| **Critical** | L4 | `loadCredentialContext` 未捕获 `decryptCredentialAtRest` 异常 | `src/storage/services/credential-vault.ts:179` — `plain = decryptCredentialAtRest(record.encryptedValue)` 在 key 错误时 throw，但整个 `loadCredentialContext` 无 try-catch | 单个格式错误或 key 错误的 credential 会导致整个调用链（如 heartbeat snapshot 构建）崩溃 | 在 `loadCredentialContext` line 174-179 添加 try-catch，wrong_key / decrypt_failed 时返回 `{ ...record, encryptedValue: undefined, status: "decrypt_failed" }` | `05B_VERIFICATION_PLAN.md:389` T1.4.1 "missing/wrong/valid key" |
| **Critical** | L4 | `redactSensitive` 遗漏常见 PII 模式 | `src/core/second-nature/feedback/owner-reply-feedback.ts:109-113` — 仅覆盖信用卡、密码、邮箱；遗漏电话号码、API key、OAuth token、SSN | 敏感数据写入 chronicle，可能在 explain 查询或日志中泄露 | 扩展正则：添加 `\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b` (电话)、`[A-Za-z0-9_-]{20,}` (token)、`\b\d{3}-\d{2}-\d{4}\b` (SSN) | ADR-003 §Privacy，State-system §9 |
| **Critical** | L6 | 版本三元组不一致 | `package.json:3` = `0.1.24`；`plugin/package.json:3` = `0.1.25`；`plugin/openclaw.plugin.json:4` = `0.1.25` | 根 package.json 与插件包版本不同步；发布时版本混淆 | 将 `package.json` version 更新为 `0.1.25`，与插件包一致 | Wave 39/40 commit 记录声称已统一为 0.1.25 |

### High

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|----------|------|-------|----------|--------|------------|--------|
| **High** | L2 | evidence append 失败无诊断信号 | `src/core/second-nature/heartbeat/heartbeat-loop.ts:174-177` — `catch` 块为空，仅注释 "Evidence append must not break the heartbeat cycle" | 真实 connector 执行成功但 evidence 未持久化，operator 无法诊断；下次 outreach 因缺 evidence 被拒 | 在 catch 块中至少记录错误类型：`console.error('[heartbeat] evidence append failed:', err)`；或将失败写入 decision trace / status | `05B_VERIFICATION_PLAN.md:400` T3.3.1 |
| **High** | L2 | relationship update 失败无诊断信号 | `src/core/second-nature/feedback/owner-reply-feedback.ts:204-216` — update 失败返回 `relationshipUpdated: false`，但 chronicle 已写入；无后续诊断 | owner 回复被记录但关系记忆未更新，下次 outreach 策略无法反映该信号 | 在返回结果中确保 `relationshipUpdateError` 被调用方检查；或在 chronicle entry 中记录失败原因 | `05B_VERIFICATION_PLAN.md:433` T4.2.1 |
| **High** | L3 | `GoalPriorityContext` 索引签名引入类型松弛 | `src/core/second-nature/orchestrator/goal-priority.ts:23` — `[key: string]: unknown` 允许任意字段注入 | 调用方可能传入未验证字段，导致后续类型断言失败或逻辑漂移；与 ADR-003 的显式约束相悖 | 移除索引签名，改用显式字段 + `Partial<>` 或 discriminated union；或在文档中明确说明这是鸭子类型兼容的临时措施 | ADR-003 Agent Self Layer 边界 |
| **High** | L3 | `planCandidateIntents` 双重数据来源 | `src/core/second-nature/orchestrator/intent-planner.ts:279-280` — `narrativeState = options?.narrativeState ?? runtime.narrativeState` 允许调用方覆盖 runtime 值 | 优先级计算来源不清晰，难以调试；可能导致 narrative focus bias 应用于错误状态 | 明确文档化优先级顺序（options > runtime），或禁止 options 覆盖 runtime 值 | Control-plane-system §4.3 |
| **High** | L4 | `ops-router.ts` goal 命令输入无长度限制 | `src/cli/ops/ops-router.ts:305-315` — `description`、`completionCriteria`、`criteria` 直接传入，无长度/字符校验 | 恶意或误操作输入可能导致超大字符串存储或处理异常 | 添加长度限制（如 max 1000 chars）、trim、基本字符白名单 | State-system §9 |
| **High** | L5 | T1.4.1 缺少单元测试 | 05B:389 要求 "secret health mapper handles missing/wrong/valid key and missing base URL"；无 `tests/unit/storage/t1-4-1-*.test.ts` | 边界场景无单元级验证；重构时易被破坏 | 新增 `tests/unit/storage/t1-4-1-credential-health-mapper.test.ts`，覆盖 4 个 health 状态转换 | `05B_VERIFICATION_PLAN.md:389` |
| **High** | L5 | T2.4.1 单元测试不完整 | 05B:411 要求 "planner selects platform-specific intent only when capability and credential route are unambiguous"；现有单元测试仅覆盖 goal/evidence 推断 | credential unavailable 场景下 platformId 行为无单元验证 | 补充单元测试：credential `decrypt_failed` / `missing` 时 `platformId` 应为 undefined；或在 planner 中增加 credential health 前置检查 | `05B_VERIFICATION_PLAN.md:411` |
| **High** | L5 | T3.3.1 缺少单元测试 | 05B:400 要求 "connector result mapper rejects source-less or credential-sensitive evidence candidates"；现有单元测试仅覆盖 success/empty/failure | PII/credential 敏感性检查无单元验证 | 补充单元测试：验证 `mapLifeEvidence` 对 credential/PII 模式在 sourceRefs 中的 redaction 处理 | `05B_VERIFICATION_PLAN.md:400` |
| **High** | L6 | README 未更新 v6 新增能力 | `README.md:130-323` 仅描述 v5，未提及 platform-specific intent、owner reply feedback、runtime secret bootstrap、real connector evidence 等 S5 能力 | 用户无法从 README 了解 v6 核心创新 | 在 README 中新增 "v6: Agent Self Layer & Life Loop Activation" 章节，列举 6 个 S5 任务核心能力 | Lens 6 README 回流 |

### Medium

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|----------|------|-------|----------|--------|------------|--------|
| **Medium** | L1 | T1.4.2 criteria 优先级未在验收标准中明确 | `src/cli/commands/goal.ts:102-105` — `completionCriteria?.trim() \|\| criteria?.trim()` 使 completionCriteria 优先，但验收标准未定义两者都提供时的行为 | API 调用者行为可能与预期不符 | 在 `05A_TASKS.md` T1.4.2 验收标准中明确："criteria 作为别名，当 completionCriteria 为空时使用；两者都提供时 completionCriteria 优先" | `05A_TASKS.md:919-922` |
| **Medium** | L2 | connectorRegistry 未加载时 platform resolution 降级无诊断 | `src/cli/ops/workspace-heartbeat-runner.ts:203-204` — registry 为 undefined 时 `resolvePlatformForIntent` 降级但无明确诊断 | host-safe carrier 场景下 intent 无 platformId，operator 无法区分 "无信号" 与 "registry 未加载" | 在 `resolvePlatformForIntent` 返回 undefined 时附加 reason；或在 status 中报告 registry 健康度 | `05B_VERIFICATION_PLAN.md:411` T2.4.1 |
| **Medium** | L3 | `focusMatchesKind` 模糊匹配过于宽松 | `src/core/second-nature/orchestrator/intent-planner.ts:46-66` — `.includes("work")` 会匹配 "network" 中的子串 | 可能导致意外的 intent 优先级提升 | 改用词边界匹配（`\bwork\b`）或显式分词 | Control-plane-system §4.2 |
| **Medium** | L3 | `SnapshotInputs` 索引签名引入类型松弛 | `src/core/second-nature/heartbeat/snapshot-builder.ts:51` — `[key: string]: unknown` | 与 GoalPriorityContext 同源问题，影响 snapshot 构建可靠性 | 移除索引签名，使用显式字段 | State-system §6.1 |
| **Medium** | L4 | `heartbeat-loop.ts` connector action 输入未 sanitize | `src/core/second-nature/heartbeat/heartbeat-loop.ts:147-154` — `intent` 对象直接传入 `connectorExecutor.executeEffect`，未检查敏感数据 | 若 intent 的 sourceRefs 包含 PII，会被传入 connector 执行层 | 在 `toCapabilityIntent` 或 guard-layer 中添加敏感字段校验 | Connector-system §9 |
| **Medium** | L5 | T4.2.1 单元测试覆盖不足 | 05B:433 要求 "reply classifier handles single-sample insufficient history"；现有单元测试未覆盖 confidence 降级 | 单次回复过度推断风险未被单元验证 | 补充单元测试：验证 `applyRelationshipUpdate` 在 sourceRefs.length < 2 时的 confidence 降级 | `05B_VERIFICATION_PLAN.md:433` |
| **Medium** | L5 | T1.4.2 单元测试缺失 | 05B:444 要求 "goal input mapper accepts criteria and completionCriteria with deterministic precedence"；仅有集成测试 | 重构时 criteria alias 逻辑易被破坏 | 新增 `tests/unit/cli/t1-4-2-goal-input-mapper.test.ts` | `05B_VERIFICATION_PLAN.md:444` |
| **Medium** | L5 | T2.4.2 缺少单元测试 | 05B:422 要求 "outreach trigger mapper requires evidence + source refs + guard allow"；仅有集成测试 | evidence/sourceRefs/guard 三层检查无单元验证 | 新增 `tests/unit/control-plane/t2-4-2-outreach-trigger-mapper.test.ts` | `05B_VERIFICATION_PLAN.md:422` |
| **Medium** | L6 | INT-S5 报告未列出单元测试证据 | `reports/int-s5-v6-life-loop-activation.md` 仅列出集成测试路径 | 证据链不完整 | 补充"单元测试证据"列或标记缺失 | Lens 6 报告完整性 |
| **Medium** | L6 | 05B 单元测试要求与实现不对齐 | 05B:389/400/411/422/433/444 列出的单元测试要求部分未实现 | 验证计划与实现脱节 | 更新 05B 为 "已实现/缺失" 标记，或补充实现 | Lens 6 05B 对齐 |

### Low

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|----------|------|-------|----------|--------|------------|--------|
| **Low** | L1 | T2.4.1 platform resolution 缺少 base URL 验证 | `src/core/second-nature/orchestrator/platform-capability-router.ts:96-110` — 验证 capability 但不检查 base URL | credential 缺 base URL 时 heartbeat 仍会选中 intent，后续 executor 才失败 | 在 guard layer 或 executor 前检查 base URL | `05A_TASKS.md:868` T2.4.1 |
| **Low** | L2 | T1.4.2 criteria alias 优先级未在验收标准明确 | `tests/integration/cli/t1-4-2-activation-ux-contract.test.ts:65-88` — 测试覆盖三种情况，但验收标准未明确定义 | API 调用者可能困惑 | 在验收标准中补充优先级定义 | `05A_TASKS.md:919-922` |
| **Low** | L3 | `INTENT_CONFIGS` 工厂复杂度改善有限 | `src/core/second-nature/orchestrator/intent-planner.ts:84-121` — 工厂化了配置但条件分支仍多 | 可读性改善有限，新增 kind 时仍需修改多处 | 考虑将条件分支提取为独立 "modifier" 函数，形成 pipeline | Control-plane-system §8.4 |
| **Low** | L5 | INT-S5 报告测试数量声明矛盾 | `reports/int-s5-v6-life-loop-activation.md` 写 "208"；`AGENTS.md:87` 写 "214"；`AGENTS.md:191` 写 "208" | 无法确认实际总数 | 运行 `pnpm test` 确认总数，统一所有文档 | INT-S5 报告完整性 |
| **Low** | L5 | T1.4.1 集成测试缺 base URL missing 路径 | `tests/integration/cli/t1-4-1-runtime-secret-bootstrap.test.ts` — 未覆盖 credential 有效但 base URL 缺失 | 05B 要求 "missing base URL" 但无 case | 补充集成测试 case | `05B_VERIFICATION_PLAN.md:389` |
| **Low** | L6 | 新增 CLI 键未在 README 说明 | `goal set` 新增 `criteria` 参数；README 未提及 | 用户不知道别名存在 | 在 README goal set 说明中补充 | Lens 6 新增 CLI 键文档 |

---

## 6. 安全 / 测试覆盖补充

### 无法静态确认的风险
- **真实宿主运行时行为**: OpenClaw 宿主上 `second_nature_ops` 工具可见性、心跳投递行为需人工验证
- **并发与资源泄漏**: 未发现明显的 race condition 或未关闭连接，但 `owner-reply-feedback.ts` 的 best-effort 语义需要运行时验证
- **Dream candidate memory 污染**: 设计文档禁止 heartbeat 消费 Dream candidate，但代码中未找到明确检查点；建议 `loadDreamInputs` 实现时添加断言

### 测试缺口速览
| 缺失测试 | 对应任务 | 优先级 |
|---------|---------|--------|
| credential health mapper 单元测试 | T1.4.1 | High |
| planner credential route 单元测试 | T2.4.1 | High |
| evidence mapper PII redaction 单元测试 | T3.3.1 | High |
| outreach trigger mapper 单元测试 | T2.4.2 | Medium |
| goal input mapper 单元测试 | T1.4.2 | Medium |
| relationship insufficient history 单元测试 | T4.2.1 | Medium |

### 修复优先级建议
| 优先级 | 项 | Lens |
|--------|-----|------|
| P0 | `package.json` version → 0.1.25 | L6 |
| P0 | `loadCredentialContext` 添加 decrypt try-catch | L4 |
| P0 | 扩展 `redactSensitive` 正则 | L4 |
| P1 | heartbeat-loop evidence append 失败记录日志 | L2 |
| P1 | relationship update 失败诊断增强 | L2 |
| P1 | 补充 3 个 High 优先级单元测试 | L5 |
| P2 | README 新增 v6 能力描述 | L6 |
| P2 | 移除 `GoalPriorityContext` / `SnapshotInputs` 索引签名（或文档化原因） | L3 |
| P2 | `focusMatchesKind` 改为词边界匹配 | L3 |
